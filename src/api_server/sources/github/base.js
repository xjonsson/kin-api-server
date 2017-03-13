/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const KinRequest = require('../kin_request');

const _ = require('lodash');


const GITHUB_API_BASE_URL = 'https://api.github.com/';
const GITHUB_API_TIMEOUT = 4 * 1000;
const GITHUB_SCOPES = [
    'repo',
];


class GithubRequest extends KinRequest {
    constructor(req, source_id) {
        super(req, source_id, GITHUB_API_BASE_URL);
    }

    get source_name() {
        return 'github';
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
