/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const { OutlookRequest } = require("./base");
const { merge_ids, split_merged_id } = require("../../utils");
const { PROVIDER_NB_MONTHS_FUTURE, PROVIDER_NB_MONTHS_PAST } = require("../../config");

const moment = require("moment-timezone");
const querystring = require("querystring");
const _ = require("lodash");

/**
 * Utils
 */
function _normalize_response_status(response_status) {
    return {
        None: "needs_action",
        Declined: "declined",
        TentativelyAccepted: "tentative",
        Accepted: "accepted"
    }[response_status];
}

/**
 * Formatting helpers
 */
function _format_layer(source_id, outlook_layer) {
    const output = {
        id: merge_ids(source_id, outlook_layer.Id),
        title: outlook_layer.Name,
        text_color: "#FFFFFF",
        acl: {
            edit: false,
            create: false,
            delete: false
        },
        selected: false
    };

    // TODO: make it work for `Auto`?
    const colors = {
        LightBlue: "#a6d1f5",
        LightTeal: "#4adacc",
        LightGreen: "#87d28e",
        LightGray: "#c0c0c0",
        LightRed: "#f88c9b",
        LightPink: "#f08cc0",
        LightBrown: "#cba287",
        LightOrange: "#fcab73",
        LightYellow: "#f4d07a"
    };
    output.color = _.get(colors, _.get(outlook_layer, "Color", "Auto"), "#EB3D01");
    return output;
}

function _format_event(layer_id, event) {
    const output = {
        id: merge_ids(layer_id, event.Id),
        title: event.Subject,
        start: {
            timezone: _.get(event, ["Start", "TimeZone"])
        },
        end: {
            timezone: _.get(event, ["End", "TimeZone"])
        },
        link: _.get(event, "WebLink"),
        kind: "event#basic"
    };

    const location = _.get(event, ["Location", "DisplayName"]);
    if (!_.isEmpty(location)) {
        output.location = location;
    }

    if (_.get(event, "IsAllDay", false)) {
        const date_format = "YYYY-MM-DD";
        output.start.date = moment
            .tz(event.Start.DateTime, event.Start.Timezone)
            .format(date_format);
        output.end.date = moment.tz(event.End.DateTime, event.End.Timezone).format(date_format);
    } else {
        output.start.date_time = moment.tz(event.Start.DateTime, event.Start.Timezone).format();
        output.end.date_time = moment.tz(event.End.DateTime, event.End.Timezone).format();
    }

    if (_.get(event, ["Body", "ContentType"], "") === "Text") {
        output.description = _.get(event, ["Body", "Content"], "");
    }

    output.attendees = _.map(_.get(event, "Attendees", []), attendee => {
        // eslint-disable-line arrow-body-style
        return {
            email: _.get(attendee, ["EmailAddress", "Address"]),
            response_status: _normalize_response_status(_.get(attendee, ["Status", "Response"])),
            self: false // TODO: need to fix this
        };
    });

    output.reminders = [];
    if (_.get(event, "IsReminderOn", false)) {
        output.reminders.push({
            minutes: _.get(event, "ReminderMinutesBeforeStart", 0)
        });
    }

    return output;
}

/**
 * Actions
 */
function load_layers(req, source) {
    return new OutlookRequest(req, source.id)
        .api("me/calendars", {
            qs: {
                $select: "Name,Color",
                $top: 50 // TODO: might need to handle pagination as well?
            }
        })
        .then(outlook_res => _.map(outlook_res.value, _.partial(_format_layer, source.id)));
}

function _load_events_promise(req, source_id, uri, options, format_event_func, events = []) {
    return new OutlookRequest(req, source_id).api(uri, options).then(outlook_res => {
        const all_events = _.concat(events, _.map(outlook_res.value, format_event_func));
        if (_.has(outlook_res, "@odata.nextLink")) {
            options.qs.$skip += options.qs.$top; // eslint-disable-line no-param-reassign
            return _load_events_promise(
                req,
                source_id,
                uri,
                options,
                format_event_func,
                all_events
            );
        }
        return all_events;
    });
}

function load_events(req, source, layer_id) {
    const [, calendar_id] = split_merged_id(layer_id);
    const min_date = new Date();
    min_date.setMonth(min_date.getMonth() - PROVIDER_NB_MONTHS_PAST);
    const max_date = new Date();
    max_date.setMonth(max_date.getMonth() + PROVIDER_NB_MONTHS_FUTURE);

    const options = {
        qs: {
            startDateTime: min_date.toISOString(),
            endDateTime: max_date.toISOString(),
            $top: 50,
            $skip: 0,
            $select: "Subject,Location,Start,End,WebLink,IsAllDay," +
                "Body,Attendees,IsReminderOn,ReminderMinutesBeforeStart"
        }
    };
    return _load_events_promise(
        req,
        source.id,
        `me/calendars/${querystring.escape(calendar_id)}/calendarview`,
        options,
        _.partial(_format_event, layer_id)
    ).then(events => {
        // eslint-disable-line arrow-body-style
        return {
            events
        };
    });
}

module.exports = {
    load_layers,
    load_events
};
