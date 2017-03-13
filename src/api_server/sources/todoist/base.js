/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const KinRequest = require('../kin_request');

const _ = require('lodash');


const TODOIST_API_BASE_URL = 'https://todoist.com/API/v7/';
const TODOIST_API_TIMEOUT = 4 * 1000;
const TODOIST_SCOPES = [
    // https://developer.todoist.com/#oauth
    'data:read_write',
    'data:delete',
];


class TodoistRequest extends KinRequest {
    constructor(req, source_id) {
        super(req, source_id, TODOIST_API_BASE_URL);
    }

    get source_name() {
        return 'todoist';
    }

    is_invalid_creds_error(err) {
        return err.statusCode === 403;
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
