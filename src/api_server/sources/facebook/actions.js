/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const { FacebookRequest } = require('./base');
const { PROVIDER_NB_MONTHS_FUTURE, PROVIDER_NB_MONTHS_PAST } = require('../../config');
const { merge_ids, split_merged_id } = require('../../utils');


const bluebird = require('bluebird');
const moment = require('moment-timezone');
const _ = require('lodash');


/**
 * Formatting helpers
 */
function _format_event(layer_id, kind, event) {
    const output = {
        id: merge_ids(layer_id, event.id),
        kind,
        link: `https://www.facebook.com/events/${event.id}`,
    };

    // Checking each prop to make sure we can keep require props (title) even
    // if they have empty/nil values
    if (!_.isEmpty(event.name)) {
        output.title = event.name;
    }

    if (!_.isEmpty(event.description)) {
        output.description = event.description;
    }

    const location = _.get(event.place, 'name');
    if (!_.isEmpty(location)) {
        output.location = location;
    }

    _.forEach(['start', 'end'], (prop_name) => {
        const full_prop_name = `${prop_name}_time`;
        if (!_.isEmpty(event[full_prop_name])) {
            const prop = event[full_prop_name];
            const values = {
                date_time: moment.tz(prop, event.timezone).format(),
                timezone: prop.timeZone,
            };
            output[prop_name] = _.omitBy(values, _.isNil);
        }
    });

    return output;
}


/**
 * Load events helpers
 */
function _load_events_promise(req, source_id, uri, options, format_event_func, events = []) {
    return new FacebookRequest(req, source_id)
        .api(uri, options)
        .then((fb_res) => {
            const all_events = _.concat(events, _.map(fb_res.data, format_event_func));
            if (_.has(fb_res, ['paging', 'cursors', 'after'])) {
                options.qs.after = fb_res.paging.cursors.after; // eslint-disable-line no-param-reassign
                return _load_events_promise(
                    req, source_id,
                    uri, options, format_event_func,
                    all_events
                );
            }
            return all_events;
        });
}

function _load_events_default_options() {
    const min_date = new Date();
    min_date.setMonth(min_date.getMonth() - PROVIDER_NB_MONTHS_PAST);
    const min_date_timestamp = Math.floor(min_date.getTime() / 1000);
    const max_date = new Date();
    max_date.setMonth(max_date.getMonth() + PROVIDER_NB_MONTHS_FUTURE);
    const max_date_timestamp = Math.ceil(max_date.getTime() / 1000);

    const options = {
        qs: {
            fields: 'description,end_time,name,place{name},start_time,timezone',
            limit: 250,
            since: min_date_timestamp,
            until: max_date_timestamp,
        },
    };
    return options;
}

function _load_attending_events(req, source_id, layer_id) {
    const options = _.merge(_load_events_default_options(), {
        qs: { type: 'attending', },
    });
    return _load_events_promise(
        req, source_id,
        'me/events',
        options, _.partial(_format_event, layer_id, 'event#basic')
    );
}

function _load_created_events(req, source_id, layer_id) {
    const options = _.merge(_load_events_default_options(), {
        qs: { type: 'created', },
    });
    return _load_events_promise(
        req, source_id,
        'me/events',
        options, _.partial(_format_event, layer_id, 'event#basic')
    );
}

function _load_declined_events(req, source_id, layer_id) {
    const options = _.merge(_load_events_default_options(), {
        qs: { type: 'declined', },
    });
    return _load_events_promise(
        req, source_id,
        'me/events',
        options, _.partial(_format_event, layer_id, 'event#basic')
    );
}

function _load_tentative_events(req, source_id, layer_id) {
    const options = _.merge(_load_events_default_options(), {
        qs: { type: 'maybe', },
    });
    return _load_events_promise(
        req, source_id,
        'me/events',
        options, _.partial(_format_event, layer_id, 'event#basic')
    );
}

function _load_not_replied_events(req, source_id, layer_id) {
    const options = _.merge(_load_events_default_options(), {
        qs: { type: 'not_replied', },
    });
    return _load_events_promise(
        req, source_id,
        'me/events',
        options, _.partial(_format_event, layer_id, 'event#basic')
    );
}


/**
 * Actions
 */
function load_layers(req, source) {
    return bluebird.resolve([
        {
            id: merge_ids(source.id, 'events_attending'),
            title: 'Attending',
            color: '#3B5998',
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
        {
            id: merge_ids(source.id, 'events_tentative'),
            title: 'Maybe / Interested',
            color: '#3B5998',
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
        {
            id: merge_ids(source.id, 'events_not_replied'),
            title: 'Not Replied ',
            color: '#3B5998',
            text_color: '#FFFFFF',
            acl: {
                edit: false,
                create: false,
                delete: false,
            },

            // used as a default coming from the source,
            // it's overridden by our custom selected layer db
            selected: false,
        },
        {
            id: merge_ids(source.id, 'events_created'),
            title: 'Created',
            color: '#3B5998',
            text_color: '#FFFFFF',
            acl: {
                edit: false,
                create: false,
                delete: false,
            },

            // used as a default coming from the source,
            // it's overridden by our custom selected layer db
            selected: false,
        },
        {
            id: merge_ids(source.id, 'events_declined'),
            title: 'Declined',
            color: '#3B5998',
            text_color: '#FFFFFF',
            acl: {
                edit: false,
                create: false,
                delete: false,
            },

            // used as a default coming from the source,
            // it's overridden by our custom selected layer db
            selected: false,
        },
    ]);
}


function load_events(req, source, layer_id) {
    const [, short_layer_id] = split_merged_id(layer_id);

    const layer_promise_mapping = {
        events_attending: _load_attending_events,
        events_created: _load_created_events,
        events_declined: _load_declined_events,
        events_tentative: _load_tentative_events,
        events_not_replied: _load_not_replied_events,
    };

    if (short_layer_id in layer_promise_mapping) {
        const promise_func = layer_promise_mapping[short_layer_id];
        return promise_func(req, source.id, layer_id)
            .then((events) => { // eslint-disable-line arrow-body-style
                return {
                    events,
                };
            });
    }
    return bluebird.reject(new Error(`invalid layer id \`${layer_id}\``));
}


function _load_event(req, source_id, event_id) {
    const [, short_layer_id, short_event_id] = split_merged_id(event_id);
    const layer_id = merge_ids(source_id, short_layer_id);

    return new FacebookRequest(req, source_id)
        .api(
            short_event_id,
        {
            qs: {
                fields: 'description,end_time,name,place{name},start_time,timezone',
            },
        }
        ).then(fb_res => _format_event(layer_id, 'event#basic', fb_res));
}


function patch_event(req, source, event_id, event_patch) {
    if (!_.isEmpty(event_patch.attendees)) {
        const [, , short_event_id] = split_merged_id(event_id);

        const response_status = event_patch.attendees[0].response_status;
        const actions_mapping = {
            accepted: 'attending',
            declined: 'declined',
            tentative: 'maybe',
        };

        return new FacebookRequest(req, source.id)
            .api(
                `${short_event_id}/${actions_mapping[response_status]}`,
            {
                method: 'POST',
            }
            )
            .then(() => _load_event(req, source.id, event_id));
    }
    return undefined; // TODO: this definitely isn't great ;)
}


module.exports = {
    load_layers,
    load_events,
    patch_event,
};
