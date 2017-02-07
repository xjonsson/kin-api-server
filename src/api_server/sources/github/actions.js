/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const { GithubRequest } = require('./base');
const errors = require('../../errors');
const { merge_ids, split_merged_id } = require('../../utils');


const moment = require('moment-timezone');
const querystring = require('querystring');
const _ = require('lodash');


/**
 * Utils
 */

 // Normalization is used as a way to remove '/' from URLs, which mess
 // up with Express's routing
function _unnormalize_repo_id(normalized_repo_id) {
    return normalized_repo_id.replace('\\', '/');
}

function _normalize_repo_id(gh_repo_id) {
    return gh_repo_id.replace('/', '\\');
}


/**
 * Formatting Helpers
 */
function _format_layer(source_id, gh_repo) {
    return {
        id: merge_ids(source_id, _normalize_repo_id(gh_repo.full_name)),
        title: gh_repo.name,
        color: '#000000',
        text_color: '#FFFFFF',
        acl: {
            edit: true, // TODO: no github ACL limiting the ability to create milestones?
            create: true,
            delete: true,
        },

        // used as a default coming from the source,
        // it's overridden by our custom selected layer db
        selected: false,
    };
}


function _format_event(layer_id, gh_milestone) {
    const output = {
        id: merge_ids(layer_id, gh_milestone.number),
        title: gh_milestone.title,
        description: gh_milestone.description,
        link: gh_milestone.html_url,
        kind: 'event#basic',
    };
    output.start = {
        date: moment(gh_milestone.due_on).format('YYYY-MM-DD'),
    };
    output.end = {
        date: moment(gh_milestone.due_on).add(1, 'day').format('YYYY-MM-DD'),
    };
    return output;
}


function _format_patch(event_patch) {
    const output = {};
    if (!_.isUndefined(event_patch.title)) {
        output.title = event_patch.title;
    }
    if (!_.isUndefined(event_patch.description)) {
        output.description = event_patch.description;
    }
    if (!_.isUndefined(event_patch.start)) {
        const date = moment(event_patch.start.date_time || event_patch.start.date);
        date.add(1, 'day'); // because Github put the due on one day before
        output.due_on = date.format();
    }
    return output;
}


/**
 * Actions
 */
function load_layers(req, source) {
    return new GithubRequest(req, source.id)
        .api('user/repos')
        .then(github_res => _.map(github_res, _.partial(_format_layer, source.id)));
}


function load_events(req, source, layer_id) {
    const [, gh_repo_id] = split_merged_id(layer_id);
    return new GithubRequest(req, source.id)
        .api(`repos/${_unnormalize_repo_id(gh_repo_id)}/milestones`)
        .then((github_res) => { // eslint-disable-line arrow-body-style
            return {
                events: _.map(github_res, _.partial(_format_event, layer_id)),
            };
        })
        .catch((err) => {
            if (err.statusCode === 404) {
                throw new errors.KinLayerNotFoundError();
            }
        });
}


function patch_event(req, source, event_id, event_patch) {
    const [source_id, gh_repo_id, gh_milestone_number] = split_merged_id(event_id);
    const formatted_patch = _format_patch(event_patch);

    return new GithubRequest(req, source.id)
        .api(
            `repos/${_unnormalize_repo_id(gh_repo_id)
                }/milestones/${querystring.escape(gh_milestone_number)}`,
        {
            method: 'PATCH',
            body: formatted_patch,
        }
        )
        .then((gh_res) => {
            const layer_id = merge_ids(source_id, gh_repo_id);
            return _format_event(layer_id, gh_res);
        });
}


function create_event(req, source, layer_id, event_patch) {
    const [, gh_repo_id] = split_merged_id(layer_id);
    const formatted_patch = _format_patch(event_patch);

    return new GithubRequest(req, source.id)
        .api(
            `repos/${_unnormalize_repo_id(gh_repo_id)}/milestones`,
        {
            method: 'POST',
            body: formatted_patch,
        }
        )
        .then(gh_res => _format_event(layer_id, gh_res));
}


function delete_event(req, source, event_id) {
    const [, gh_repo_id, gh_milestone_number] = split_merged_id(event_id);

    return new GithubRequest(req, source.id)
        .api(
            `repos/${_unnormalize_repo_id(gh_repo_id)
                }/milestones/${querystring.escape(gh_milestone_number)}`,
        {
            method: 'DELETE',
        }
        );
}


module.exports = {
    load_layers,
    load_events,
    patch_event,
    create_event,
    delete_event
};
