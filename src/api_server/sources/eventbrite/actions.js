/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const { EventbriteRequest } = require("./base");
const { merge_ids, split_merged_id } = require("../../utils");

const bluebird = require("bluebird");
const moment = require("moment-timezone");
const _ = require("lodash");

/**
 * Utils
 */
function _normalize_event_status(event_status) {
    // DOC: https://www.eventbrite.com/developer/v3/formats/event/
    return {
        canceled: "cancelled",
        live: "confirmed",
        started: "confirmed",
        ended: "confirmed",
        completed: "confirmed",
        draft: "tentative"
    }[event_status];
}

/**
 * Formatting Helpers
 */
function _format_event(layer_id, event) {
    const output = {
        id: merge_ids(layer_id, event.id),
        title: event.name.text,
        link: event.url,
        status: _normalize_event_status(event.status),
        kind: "event#basic"
    };

    if (!_.isEmpty(event.description) && _.isObject(event.description)) {
        output.description = event.description.text;
    }

    output.start = {
        date_time: moment.tz(event.start.local, event.start.timezone).format(),
        timezone: event.start.timezone
    };

    output.end = {
        date_time: moment.tz(event.end.local, event.end.timezone).format(),
        timezone: event.end.timezone
    };

    return output;
}

/**
 * Actions
 */
function load_layers(req, source) {
    return bluebird.resolve([
        {
            id: merge_ids(source.id, "events_attending"),
            title: "Events I'm attending",
            color: "#FF8400",
            text_color: "#FFFFFF",
            acl: {
                edit: false,
                create: false,
                delete: false
            },

            // used as a default coming from the source,
            // it's overridden by our custom selected layer db
            selected: true
        },
        {
            id: merge_ids(source.id, "events_organizing"),
            title: "Events I'm organizing",
            color: "#FF8400",
            text_color: "#FFFFFF",
            acl: {
                edit: false,
                create: false,
                delete: false
            },

            // used as a default coming from the source,
            // it's overridden by our custom selected layer db
            selected: false
        }
    ]);
}

function _load_attending_events(req, source_id, layer_id) {
    return new EventbriteRequest(req, source_id)
        .api("users/me/orders", {
            qs: {
                expand: "event"
            }
        })
        .then(ebrite_res => {
            // eslint-disable-line arrow-body-style
            return {
                events: _(ebrite_res.orders)
                    .filter(order => !_.isNull(order.event))
                    .map(order => _format_event(layer_id, order.event))
                    .value()
            };
        });
}

function _load_organizing_events(req, source_id, layer_id) {
    return new EventbriteRequest(req, source_id).api("users/me/events").then(ebrite_res => {
        // eslint-disable-line arrow-body-style
        return {
            events: _.map(ebrite_res.events, _.partial(_format_event, layer_id))
        };
    });
}

function load_events(req, source, layer_id) {
    const [, short_layer_id] = split_merged_id(layer_id);

    const layer_mapping = {
        events_attending: _load_attending_events,
        events_organizing: _load_organizing_events
    };
    if (short_layer_id in layer_mapping) {
        return layer_mapping[short_layer_id](req, source.id, layer_id);
    }
    return bluebird.reject(new Error(`invalid layer id \`${layer_id}\``));
}

module.exports = {
    load_layers,
    load_events
};
