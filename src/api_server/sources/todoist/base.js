/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const KinRequest = require('../kin_request');
const { disconnect_source } = require('../../utils');

const _ = require('lodash');


const TODOIST_API_BASE_URL = 'https://todoist.com/API/v7/';
const TODOIST_API_TIMEOUT = 4 * 1000;
const TODOIST_SCOPES = [
    // https://developer.todoist.com/#oauth
    'data:read_write',
    'data:delete',
];

function is_invalid_creds_error(err) {
    return err.statusCode === 403;
}


class TodoistRequest extends KinRequest {
    constructor(req, source_id) {
        super(req, source_id, TODOIST_API_BASE_URL);
    }

    api(uri, options = {}, attempt = 0) {
        return super
            .api(uri, options, attempt)
            .catch((err) => {
                if (is_invalid_creds_error(err)) {
                    disconnect_source(this._req, this._source, err);
                } else {
                    throw err;
                }
            });
    }

    api_request_options(access_token, overrides) {
        return _.merge({
            method: 'POST',
            form: {
                token: access_token,
            },
            json: true,
            timeout: TODOIST_API_TIMEOUT,
        }, overrides);
    }
}

module.exports = {
    TODOIST_API_BASE_URL,
    TODOIST_API_TIMEOUT,
    TODOIST_SCOPES,

    TodoistRequest,
};
