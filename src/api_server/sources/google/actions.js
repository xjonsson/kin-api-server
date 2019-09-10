/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const { GPLACES_API_BASE_URL, GoogleRequest } = require("./base");
const {
    logger,
    PROVIDER_NB_MONTHS_FUTURE,
    PROVIDER_NB_MONTHS_PAST,
    STATIC_HOSTNAME
} = require("../../config");
const errors = require("../../errors");
const secrets = require("../../secrets");
const { merge_ids, split_merged_id } = require("../../utils");

const bluebird = require("bluebird");
const moment = require("moment-timezone");
const querystring = require("querystring");
const xml2js = require("xml2js");
const _ = require("lodash");

const DATE_TIME_FORMAT = "YYYY-MM-DDTHH:mm:ssZZ";
const DATE_FORMAT = "YYYY-MM-DD";

/**
 * Utils
 */
function _is_writable(access_role) {
    return access_role === "owner" || access_role === "writer";
}

function _normalize_response_status(response_status) {
    const mapping = {
        needsAction: "needs_action",
        declined: "declined",
        tentative: "tentative",
        accepted: "accepted"
    };
    return _.get(mapping, response_status, "needs_action");
}

function _unnormalize_response_status(response_status) {
    const mapping = {
        needs_action: "needsAction",
        declined: "declined",
        tentative: "tentative",
        accepted: "accepted"
    };
    return _.get(mapping, response_status, "needsAction");
}

function _normalize_event_status(event_status) {
    return (
        {
            confirmed: "confirmed",
            tentative: "tentative",
            cancelled: "cancelled"
        }[event_status] || "confirmed"
    );
}

function is_invalid_sync_token(err) {
    return err.statusCode === 410;
}

/**
 * Formatting helpers
 */
function _format_layer(source_id, gc_layer) {
    const is_writable = _is_writable(gc_layer.accessRole);
    const output = {
        id: merge_ids(source_id, gc_layer.id),
        title: _.get(gc_layer, "summaryOverride", gc_layer.summary),
        acl: {
            edit: is_writable,
            create: is_writable,
            delete: is_writable
        }
    };

    if (gc_layer.id === "p#weather@group.v.calendar.google.com") {
        // Google reports weather layers with a title of "Weather: <Random City>"
        // (random most likely being city close to Kin's DCs ;) ),
        // this is a simple hack to remove this
        output.title = _.get(gc_layer, "summaryOverride", "Weather");
    }

    if (!_.isEmpty(gc_layer.backgroundColor)) {
        output.color = gc_layer.backgroundColor;
    }
    if (!_.isEmpty(gc_layer.foregroundColor)) {
        output.text_color = gc_layer.foregroundColor;
    }
    // used as a default coming from the source,
    // it's overridden by our custom selected layer db
    if (_.isBoolean(gc_layer.selected)) {
        output.selected = gc_layer.selected;
    }
    return output;
}

function _format_event(layer_id, colors, event) {
    // colors can be undefined

    // Required props
    const output = {
        id: merge_ids(layer_id, event.id),
        title: event.summary,
        status: _normalize_event_status(event.status)
    };

    // Checking each prop to make sure we can keep require props (title) even
    // if they have empty/nil values
    if (!_.isEmpty(event.description)) {
        output.description = event.description;
    }

    if (!_.isEmpty(event.location)) {
        output.location = event.location;
    }

    _.forEach(["start", "end"], prop_name => {
        if (!_.isEmpty(event[prop_name]) && _.isObject(event[prop_name])) {
            const prop = event[prop_name];
            const values = {
                date_time: prop.dateTime,
                date: prop.date,
                timezone: prop.timeZone
            };
            output[prop_name] = _.omitBy(values, _.isNil);
        }
    });

    output.attendees = _.map(event.attendees, attendee => {
        // eslint-disable-line arrow-body-style
        return {
            email: attendee.email,
            response_status: _normalize_response_status(attendee.responseStatus),
            self: attendee.self
        };
    });

    output.reminders = _.map(_.get(event.reminders, "overrides", {}), reminder => {
        // eslint-disable-line arrow-body-style
        return {
            minutes: reminder.minutes
        };
    });

    output.kind = (() => {
        const me = _.find(event.attendees, "self");
        if (!_.isUndefined(me) && me.responseStatus === "needsAction") {
            return "event#invitation";
        }
        return "event#basic";
    })();

    if (!_.isUndefined(colors)) {
        output.color = _.get(colors, [event.colorId, "background"]);
    }

    return output;
}

function _format_patch(event_patch) {
    const output = {};
    _(["start", "end"]).filter(prop => !_.isEmpty(event_patch[prop])).forEach(prop => {
        output[prop] = {};
        const date_time = _.get(event_patch, `${prop}.date_time`, null);
        const date = _.get(event_patch, `${prop}.date`, null);

        if (!_.isNull(date_time) && !moment(date_time, DATE_TIME_FORMAT, true).isValid()) {
            throw new errors.KinInvalidFormatError(date_time, prop, DATE_TIME_FORMAT);
        }
        if (!_.isNull(date) && !moment(date, DATE_FORMAT, true).isValid()) {
            throw new errors.KinInvalidFormatError(date_time, prop, DATE_FORMAT);
        }

        output[prop] = {
            dateTime: date_time,
            date
        };
    });
    if (!_.isUndefined(event_patch.color_id)) {
        output.colorId = event_patch.color_id;
    }
    if (!_.isUndefined(event_patch.title)) {
        output.summary = event_patch.title;
    }
    if (!_.isUndefined(event_patch.location)) {
        output.location = event_patch.location;
    }
    if (!_.isUndefined(event_patch.description)) {
        output.description = event_patch.description;
    }
    if (!_.isUndefined(event_patch.attendees)) {
        output.attendees = _.map(event_patch.attendees, attendee => {
            // eslint-disable-line arrow-body-style
            return {
                email: attendee.email,
                responseStatus: _unnormalize_response_status(attendee.response_status)
            };
        });
    }
    if (!_.isUndefined(event_patch.reminders)) {
        const overrides = _(event_patch.reminders)
            .uniqBy("minutes")
            .map(reminder => {
                return {
                    method: "popup",
                    minutes: reminder.minutes
                };
            })
            .value();
        if (overrides.length > 5) {
            throw new errors.KinLimitError("reminders", 5);
        }
        output.reminders = {
            useDefault: false,
            overrides
        };
    }
    return output;
}

function _format_place_prediction(place_prediction) {
    const output = {
        description: _.get(place_prediction, "description")
    };
    return output;
}

/**
 * Actions
 */
function load_layers(req, source) {
    return new GoogleRequest(req, source.id).api("users/me/calendarList").then(google_res => {
        return _.map(google_res.items, _.partial(_format_layer, source.id));
    });
}

function _load_events_promise(req, source_id, uri, options, format_event_func, results) {
    return new GoogleRequest(req, source_id).api(uri, options).then(google_res => {
        results.events = _.concat(results.events, _.map(google_res.items, format_event_func)); // eslint-disable-line no-param-reassign
        if (_.has(google_res, "nextPageToken")) {
            options.qs.pageToken = google_res.nextPageToken; // eslint-disable-line no-param-reassign
            return _load_events_promise(req, source_id, uri, options, format_event_func, results);
        }
        results.next_sync_token = _.get(google_res, "nextSyncToken"); // eslint-disable-line no-param-reassign
        return results;
    });
}

function _load_events(req, source, layer_id, sync_token = "") {
    const [, calendar_id] = split_merged_id(layer_id);
    const options = {
        qs: {
            singleEvents: true,
            maxResults: 250,
            // TODO: we can get the defaultReminders with this query ;)
            fields: "items(id,summary,status,location,description,start,end,attendees,reminders,colorId),nextPageToken,nextSyncToken"
        }
    };
    const events_res = {
        events: [],
        sync_type: "full"
    };

    if (!_.isEmpty(sync_token)) {
        options.qs.syncToken = sync_token;
        events_res.sync_type = "incremental";
    } else {
        const min_date = new Date();
        min_date.setMonth(min_date.getMonth() - PROVIDER_NB_MONTHS_PAST);
        const max_date = new Date();
        max_date.setMonth(max_date.getMonth() + PROVIDER_NB_MONTHS_FUTURE);

        _.merge(options.qs, {
            timeMin: min_date.toISOString(),
            timeMax: max_date.toISOString(),
            showDeleted: false
        });
    }

    return _load_events_promise(
        req,
        source.id,
        `calendars/${querystring.escape(calendar_id)}/events`,
        options,
        _.partial(_format_event, layer_id, source.colors),
        events_res
    ).catch(err => {
        if (is_invalid_sync_token(err)) {
            _load_events(req, source, layer_id);
        } else {
            const first_error = _.get(err, ["error", "error", "errors"], [])[0];
            if (!_.isEmpty(first_error)) {
                if (first_error.reason === "notFound") {
                    throw new errors.KinLayerNotFoundError();
                }
            }
            throw err;
        }
    });
}

function load_events(req, source, layer_id) {
    return _load_events(req, source, layer_id, req.query.sync_token);
}

function patch_event(req, source, event_id, event_patch, notify_attendees = false) {
    const [source_id, short_layer_id, short_event_id] = split_merged_id(event_id);
    const formatted_patch = _format_patch(event_patch);

    const options = {
        method: "PATCH",
        qs: {
            sendNotifications: notify_attendees
        },
        body: formatted_patch
    };
    return new GoogleRequest(req, source.id)
        .api(
            `calendars/${querystring.escape(short_layer_id)}/events/${querystring.escape(short_event_id)}`,
            options
        )
        .then(google_res => {
            return _format_event(merge_ids(source_id, short_layer_id), source.colors, google_res);
        })
        .catch(err => {
            const first_error = _.get(err, ["error", "error", "errors"], [])[0];
            if (!_.isEmpty(first_error)) {
                if (first_error.reason === "timeRangeEmpty") {
                    throw new errors.KinTimeRangeEmptyError();
                }
                logger.error("%s ", req.id, err);
                throw new errors.KinInvalidFormatError();
            }
            throw err;
        });
}

function create_event(req, source, layer_id, event_patch, notify_attendees = false) {
    const [, short_layer_id] = split_merged_id(layer_id);
    const formatted_patch = _format_patch(event_patch);

    const options = {
        method: "POST",
        qs: {
            sendNotifications: notify_attendees
        },
        body: formatted_patch
    };

    return new GoogleRequest(req, source.id)
        .api(`calendars/${querystring.escape(short_layer_id)}/events`, options)
        .then(google_res => {
            return _format_event(layer_id, source.colors, google_res);
        })
        .catch(err => {
            const first_error = _.get(err, ["error", "error", "errors"], [])[0];
            if (!_.isEmpty(first_error)) {
                if (first_error.reason === "timeRangeEmpty") {
                    throw new errors.KinTimeRangeEmptyError();
                }
            }
            throw err;
        });
}

function delete_event(req, source, event_id) {
    const [, short_layer_id, short_event_id] = split_merged_id(event_id);
    return new GoogleRequest(
        req,
        source.id
    ).api(
        `calendars/${querystring.escape(short_layer_id)}/events/${querystring.escape(short_event_id)}`,
        { method: "DELETE" }
    );
}

function load_places(req, source, query_input) {
    if (_.isEmpty(query_input)) {
        return bluebird.resolve([]);
    }
    return new GoogleRequest(req, source.id, GPLACES_API_BASE_URL)
        .api("queryautocomplete/json", {
            headers: {
                Referer: `https://${STATIC_HOSTNAME}`
            },
            qs: {
                key: secrets.get("GOOGLE_MAPS_KEY"),
                input: query_input
            }
        })
        .then(google_res => {
            return _.map(google_res.predictions, _format_place_prediction);
        });
}

function load_contacts(req, source, query_input) {
    if (_.isEmpty(query_input)) {
        return bluebird.resolve([]);
    }
    const query_options = {
        headers: {
            "GData-Version": "3.0"
        },
        qs: {
            q: query_input
        }
    };

    const GCONTACTS_API_BASE_URL = "https://www.google.com/m8/feeds/contacts/";
    return new GoogleRequest(req, source.id, GCONTACTS_API_BASE_URL)
        .api("default/full", query_options)
        .then(google_res => {
            const parse_xml_string = bluebird.promisify(xml2js.parseString);

            return parse_xml_string(google_res).then(parsed_res => {
                const entries = _.get(parsed_res, ["feed", "entry"], []);
                return _(entries)
                    .map(entry => {
                        const id = _.get(entry, ["id", 0]);
                        const display_name = _.get(entry, ["title", 0]);
                        const email = _.get(entry, ["gd:email", 0, "$", "address"]);

                        return { display_name, email, id };
                    })
                    .filter(entry => !_.isNil(entry.email));
            });
        });
}

module.exports = {
    load_contacts,
    load_layers,
    load_events,
    delete_event,
    patch_event,
    create_event,
    load_places
};
