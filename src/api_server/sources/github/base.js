/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const KinRequest = require('../kin_request');
const { disconnect_source } = require('../../utils');

const _ = require('lodash');


const GITHUB_API_BASE_URL = 'https://api.github.com/';
const GITHUB_API_TIMEOUT = 4 * 1000;
const GITHUB_SCOPES = [
    'repo',
];

function is_invalid_creds_error(err) {
    return err.statusCode === 401;
}


class GithubRequest extends KinRequest {
    constructor(req, source_id) {
        super(req, source_id, GITHUB_API_BASE_URL);
    }

    get source_name() {
        return 'github';
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
            headers: {
                Authorization: `token ${access_token}`,
                'User-Agent': 'Kin Calendar',
            },
            json: true,
            timeout: GITHUB_API_TIMEOUT,
        }, overrides);
    }
}


module.exports = {
    GITHUB_API_BASE_URL,
    GITHUB_API_TIMEOUT,
    GITHUB_SCOPES,

    GithubRequest,
};
