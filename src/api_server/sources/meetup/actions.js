/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const { MEETUP_DEFAULT_EVENT_DURATION,
      MeetupRequest } = require('./base');
const { merge_ids } = require('../../utils');


const bluebird = require('bluebird');
const moment = require('moment-timezone');
const _ = require('lodash');


/**
 * Formatting helpers
 */
function _format_event(layer_id, event) {
    const output = {
        id: merge_ids(layer_id, event.id),
        title: event.name,
        location: _.get(event, 'venue.name', ''),
        description: _.get(event, 'description', '').replace(/<(?:.|\n)*?>/gm, ''),
        link: event.link,
        kind: 'event#basic',
    };

    output.start = {
        date_time: moment.tz(event.time, 'utc').format(),
    };
    const end_timestamp = event.time + _.get(event, 'duration', MEETUP_DEFAULT_EVENT_DURATION);
    output.end = {
        date_time: moment.tz(end_timestamp, 'utc').format(),
    };

    return output;
}


/**
 * Actions
 */
function load_layers(req, source) {
    return bluebird.resolve([
        {
            id: merge_ids(source.id, 'events_attending'),
            title: 'Events I\'m attending',
            color: '#ED1C40',
            text_color: '#FFFFFF',
            acl: {
                edit: false,
                create: false,
                delete: false,
            },

            // used as a default coming from the source,
            // it's overridden by our custom selected layer db
            selected: true,
        },
    ]);
}


function load_events(req, source, layer_id) {
    return new MeetupRequest(req, source.id)
        .api('self/events')
        .then((meetup_res) => { // eslint-disable-line arrow-body-style
            return {
                events: _.map(meetup_res, _.partial(_format_event, layer_id)),
            };
        });
}


module.exports = {
    load_layers,
    load_events,
};
