/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const KinRequest = require('../kin_request');
const secrets = require('../../secrets');

const _ = require('lodash');


const WUNDERLIST_API_BASE_URL = 'https://a.wunderlist.com/api/v1/';
const WUNDERLIST_API_TIMEOUT = 4 * 1000;
const WUNDERLIST_SCOPES = [];


class WunderlistRequest extends KinRequest {
    constructor(req, source_id) {
        super(req, source_id, WUNDERLIST_API_BASE_URL);
    }

    get source_name() {
        return 'wunderlist';
    }

    is_invalid_creds_error(err) {
        const wunderlist_error = _.get(err, ['error', 'error']);
        if (!_.isEmpty(wunderlist_error)) {
            return wunderlist_error.type === 'unauthorized';
        }
        return false;
    }

    api_request_options(access_token, overrides) {
        return _.merge({
            headers: {
                'X-Client-ID': secrets.get('WUNDERLIST_CLIENT_ID'),
                'X-Access-Token': access_token,
            },
            json: true,
            timeout: WUNDERLIST_API_TIMEOUT,
        }, overrides);
    }
}

module.exports = {
    WUNDERLIST_API_BASE_URL,
    WUNDERLIST_API_TIMEOUT,
    WUNDERLIST_SCOPES,

    WunderlistRequest,
};
