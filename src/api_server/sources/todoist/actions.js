/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const { TodoistRequest } = require("./base");
const errors = require("../../errors");
const { merge_ids, split_merged_id } = require("../../utils");

const cuid = require("cuid");
const moment = require("moment-timezone");
const _ = require("lodash");

const TODOIST_DATE_TIME_FORMAT = "ddd DD MMM YYYY HH:mm:ss ZZ";
const TODOIST_FULL_SYNC_TOKEN = "*";

// TODO: Should be shared / accessible in utils
// Kin's date formats
const DATE_TIME_FORMAT = "YYYY-MM-DDTHH:mm:ssZZ";
const DATE_FORMAT = "YYYY-MM-DD";

/**
 * Formatting Helpers
 */
function _format_layer(source_id, todoist_project) {
    const output = {
        id: merge_ids(source_id, todoist_project.id),
        title: todoist_project.name,
        text_color: "#FFFFFF",
        acl: {
            edit: true,
            create: true,
            delete: true
        },

        // used as a default coming from the source,
        // it's overridden by our custom selected layer db
        selected: false
    };

    const colors = [
        // free
        "#95ef63",
        "#ff8581",
        "#ffc471",
        "#f9ec75",
        "#a8c8e4",
        "#d2b8a3",
        "#e2a8e4",
        "#cccccc",
        "#fb886e",
        "#ffcc00",
        "#74e8d3",
        "#3bd5fb",

        // premium
        "#dc4fad",
        "#ac193d",
        "#d24726",
        "#82ba00",
        "#03b3b2",
        "#008299",
        "#5db2ff",
        "#0072c6",
        "#000000",
        "#777777"
    ];
    output.color = _.get(colors, todoist_project.color, 0);
    return output;
}

function _format_event(layer_id, todoist_tz, todoist_item) {
    const [, todoist_project_id] = split_merged_id(layer_id);

    const output = {
        id: merge_ids(layer_id, todoist_item.id),
        title: todoist_item.content,
        kind: "event#basic",

        // Todoist has no direct link to a task? So we will redirect
        // to the project's page in the webapp
        link: `https://en.todoist.com/app#project%2F${todoist_project_id}`
    };

    const parsed_due_date = moment.tz(
        todoist_item.due_date_utc,
        TODOIST_DATE_TIME_FORMAT,
        true,
        todoist_tz
    );

    // FIXME: `all_day` is in all responses sent by Todoist now, but it's not documented
    // https://developer.todoist.com/#items
    // Need to contact Todoist folks about it
    if (_.get(todoist_item, "all_day", false)) {
        output.start = {
            date: parsed_due_date.format(DATE_FORMAT)
        };
        output.end = {
            date: parsed_due_date.add(1, "day").format(DATE_FORMAT)
        };
    } else {
        // NOTE: converstion to UTC before formatting isn't mandatory as we're
        // formatting with the TZ offset (`ZZ` in the format string), the idea
        // is to use UTC as much as possible in Kin's API
        output.start = {
            date_time: parsed_due_date.tz("UTC").format(DATE_TIME_FORMAT)
        };
        output.end = {
            date_time: parsed_due_date.add(1, "hour").tz("UTC").format(DATE_TIME_FORMAT)
        };
    }

    output.status = todoist_item.in_history === 1 ? "cancelled" : "confirmed";

    return output;
}

function _format_patch(event_patch, timezone) {
    const output = {
        content: event_patch.title
    };

    if (!_.isEmpty(event_patch.start)) {
        let parsed_start = null;

        const date_time = _.get(event_patch, ["start", "date_time"], null);
        if (!_.isNull(date_time)) {
            parsed_start = moment.tz(date_time, DATE_TIME_FORMAT, true, "utc");
            if (!parsed_start.isValid()) {
                throw new errors.KinInvalidFormatError(
                    date_time,
                    "start.date_time",
                    DATE_TIME_FORMAT
                );
            }
        } else {
            const date = _.get(event_patch, ["start", "date"], null);
            if (!_.isNull(date)) {
                // NOTE: Todoist expects `due_date_utc` to be in UTC but its default
                // behavior (for existing dates AND setting new dates) is to use
                // midnight (-1s) relative to its users' timezone:
                //
                // User in Europe/Paris sets a date of `2017-07-10`:
                // Todoist sets (and consequently expects us) `due_date_utc` to
                // `2017-07-10T21:59:59Z` -> `2017-07-10T21:59:59+02:00`
                //
                // User in US/Hawaii sets a date of `2017-07-10`:
                // Todoist sets (and consequently expects us) `due_date_utc` to
                // `2017-07-11T09:59:59Z` -> `2017-07-10T21:59:59-10:00`
                parsed_start = moment.tz(date, DATE_FORMAT, true, timezone).endOf("day").tz("UTC");
                if (!parsed_start.isValid()) {
                    throw new errors.KinInvalidFormatError(date, "start.date", DATE_FORMAT);
                }
            }
        }

        if (!_.isNull(parsed_start)) {
            output.due_date_utc = parsed_start.format("YYYY-MM-DDTHH:mm:ss");
        }
    }
    return output;
}

/**
 * Actions
 */
function load_layers(req, source) {
    const request_options = {
        form: {
            resource_types: JSON.stringify(["projects"]),
            sync_token: "*"
        }
    };
    return new TodoistRequest(req, source.id).api("sync", request_options).then(todoist_res => {
        return _.map(todoist_res.projects, _.partial(_format_layer, source.id));
    });
}

function _load_events(req, source, layer_id, sync_token = TODOIST_FULL_SYNC_TOKEN) {
    const [, todoist_project_id] = split_merged_id(layer_id);
    const request_options = {
        form: {
            resource_types: JSON.stringify(["items", "user"]),
            sync_token
        }
    };

    const events_res = {
        events: [],
        sync_type: sync_token === TODOIST_FULL_SYNC_TOKEN ? "full" : "incremental"
    };

    return new TodoistRequest(req, source.id).api("sync", request_options).then(todoist_res => {
        const parsed_todoist_project_id = parseInt(todoist_project_id, 10);
        const todoist_tz = _.get(todoist_res, "user.tz_info.timezone", "UTC");

        events_res.events = _(todoist_res.items)
            .filter(item => {
                return item.project_id === parsed_todoist_project_id && !_.isNil(item.due_date_utc);
            })
            .map(_.partial(_format_event, layer_id, todoist_tz))
            .value();
        events_res.next_sync_token = todoist_res.sync_token;
        return events_res;
    });
}

function load_events(req, source, layer_id) {
    return _load_events(req, source, layer_id, req.query.sync_token);
}

function patch_event(req, source, event_id, event_patch) {
    const [source_id, todoist_project_id, todoist_item_id] = split_merged_id(event_id);
    const formatted_patch = _format_patch(event_patch, req.user.timezone);

    const query_options = {
        form: {
            // TODO: we shouldn't do a full-resync each time we update something ;)
            resource_types: JSON.stringify(["items", "user"]),
            sync_token: "*",
            commands: JSON.stringify([
                {
                    type: "item_update",
                    uuid: cuid(),
                    args: _.merge(formatted_patch, {
                        id: todoist_item_id
                    })
                }
            ])
        }
    };

    return new TodoistRequest(req, source.id).api("sync", query_options).then(todoist_res => {
        const parsed_todoist_item_id = parseInt(todoist_item_id, 10);
        const todoist_item = _.find(todoist_res.items, { id: parsed_todoist_item_id });
        const todoist_tz = _.get(todoist_res, "user.tz_info.timezone", "UTC");
        return _format_event(merge_ids(source_id, todoist_project_id), todoist_tz, todoist_item);
    });
}

function create_event(req, source, layer_id, event_patch) {
    const [, todoist_project_id] = split_merged_id(layer_id);
    const formatted_patch = _format_patch(event_patch, req.user.timezone);

    const item_temp_id = cuid();
    const query_options = {
        form: {
            // TODO: we shouldn't do a full-resync each time we update something ;)
            resource_types: JSON.stringify(["items", "user"]),
            sync_token: "*",
            commands: JSON.stringify([
                {
                    type: "item_add",
                    temp_id: item_temp_id,
                    uuid: cuid(),
                    args: _.merge(formatted_patch, {
                        project_id: todoist_project_id
                    })
                }
            ])
        }
    };
    return new TodoistRequest(req, source.id).api("sync", query_options).then(todoist_res => {
        const todoist_item_id = _.get(todoist_res, ["temp_id_mapping", item_temp_id]);
        const parsed_todoist_item_id = parseInt(todoist_item_id, 10);
        const todoist_item = _.find(todoist_res.items, { id: parsed_todoist_item_id });
        const todoist_tz = _.get(todoist_res, "user.tz_info.timezone", "UTC");
        return _format_event(layer_id, todoist_tz, todoist_item);
    });
}

function delete_event(req, source, event_id) {
    const [, , todoist_item_id] = split_merged_id(event_id);
    const request_options = {
        form: {
            commands: JSON.stringify([
                {
                    type: "item_delete",
                    uuid: cuid(),
                    args: {
                        ids: [todoist_item_id]
                    }
                }
            ])
        }
    };
    // TODO: need to handle errors appropriately
    return new TodoistRequest(req, source.id).api("sync", request_options);
}

module.exports = {
    load_layers,
    load_events,
    create_event,
    patch_event,
    delete_event
};
