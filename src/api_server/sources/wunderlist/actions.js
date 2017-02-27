/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const { WunderlistRequest } = require('./base');
const { merge_ids, split_merged_id } = require('../../utils');
const errors = require('../../errors');

const moment = require('moment-timezone');
const _ = require('lodash');


const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm:ssZZ';
const DATE_FORMAT = 'YYYY-MM-DD';


/**
 * Formatting helpers
 */
function _format_layer(source_id, wunderlist_list) {
    const output = {
        id: merge_ids(source_id, wunderlist_list.id),
        title: wunderlist_list.title,
        color: '#E84228',
        text_color: '#FFFFFF',
        acl: {
            edit: true,
            create: true,
            delete: true,
        },
        selected: true,
    };
    return output;
}

function _format_event(layer_id, wd_task) {
    const output = {
        id: merge_ids(layer_id, wd_task.id),
        kind: 'event#basic',
    };

    if (!_.isEmpty(wd_task.title)) {
        output.title = wd_task.title;
    }

    if (!_.isEmpty(wd_task.due_date)) {
        output.start = {
            date: moment(wd_task.due_date).format('YYYY-MM-DD'),
        };
        output.end = {
            date: moment(wd_task.due_date).add(1, 'day').format('YYYY-MM-DD'),
        };
    }

    output.etag = wd_task.revision;

    return output;
}

function _format_patch(event_patch) {
    const output = {
        title: event_patch.title,
    };

    if (!_.isEmpty(event_patch.start)) {
        let parsed_start = null;

        const date_time = _.get(event_patch, ['start', 'date_time'], null);
        if (!_.isNull(date_time)) {
            parsed_start = moment.tz(date_time, DATE_TIME_FORMAT, true, 'utc');
            if (!parsed_start.isValid()) {
                throw new errors.KinInvalidFormatError(date_time, 'start.date_time', DATE_TIME_FORMAT);
            }
        } else {
            const date = _.get(event_patch, ['start', 'date'], null);
            if (!_.isNull(date)) {
                parsed_start = moment.tz(date, DATE_FORMAT, true, 'utc');
                if (!parsed_start.isValid()) {
                    throw new errors.KinInvalidFormatError(date, 'start.date', DATE_FORMAT);
                }
            }
        }

        if (!_.isNull(parsed_start)) {
            output.due_date = parsed_start.format('YYYY-MM-DD');
        }
    }

    if (!_.isUndefined(event_patch.etag)) {
        output.revision = event_patch.etag;
    }

    return output;
}


/**
 * Actions
 */
function load_layers(req, source) {
    return new WunderlistRequest(req, source.id)
        .api('lists')
        .then(
            wunderlist_res => _.map(wunderlist_res, _.partial(_format_layer, source.id))
        );
}


function load_events(req, source, layer_id) {
    const [, wunderlist_list_id] = split_merged_id(layer_id);

    const options = {
        qs: {
            list_id: wunderlist_list_id,
        },
    };
    return new WunderlistRequest(req, source.id)
        .api('tasks', options)
        .then((wunderlist_res) => { // eslint-disable-line arrow-body-style
            return {
                events: _(wunderlist_res)
                    .filter(task => !_.isEmpty(task.due_date))
                    .map(_.partial(_format_event, layer_id))
                    .value(),
            };
        })
        .catch((err) => {
            if (err.statusCode === 404) {
                throw new errors.KinLayerNotFoundError();
            }
            throw err;
        });
}


function patch_event(req, source, event_id, event_patch) {
    const [source_id, wunderlist_list_id, wunderlist_task_id] = split_merged_id(event_id);
    const formatted_patch = _format_patch(event_patch);

    const query_options = {
        method: 'PATCH',
        body: formatted_patch,
    };
    return new WunderlistRequest(req, source.id)
        .api(`tasks/${wunderlist_task_id}`, query_options)
        .then((wunderlist_res) => {
            const layer_id = merge_ids(source_id, wunderlist_list_id);
            return _format_event(layer_id, wunderlist_res);
        });
}


function create_event(req, source, layer_id, event_patch) {
    const [, wunderlist_list_id] = split_merged_id(layer_id);
    const formatted_patch = _format_patch(event_patch);

    // Wunderlist expects this to be stringified as a Number
    const parsed_list_id = parseInt(wunderlist_list_id, 10);

    const query_options = {
        method: 'POST',
        body: _.merge({}, formatted_patch, {
            list_id: parsed_list_id,
        }),
    };
    return new WunderlistRequest(req, source.id)
        .api('tasks', query_options)
        .then((wunderlist_res) => {
            return _format_event(layer_id, wunderlist_res);
        });
}


function delete_event(req, source, event_id) {
    const [,, wunderlist_task_id] = split_merged_id(event_id);
    const request_options = {
        method: 'DELETE',
        qs: {
            revision: req.body.etag,
        },
    };
    // TODO: need to handle errors appropriately
    return new WunderlistRequest(req, source.id)
        .api(`tasks/${wunderlist_task_id}`, request_options);
}


module.exports = {
    create_event,
    delete_event,
    load_events,
    load_layers,
    patch_event,
};
