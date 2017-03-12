/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const KinRequest = require('../kin_request');
const secrets = require('../../secrets');
const { disconnect_source } = require('../../utils');

const _ = require('lodash');


const WUNDERLIST_API_BASE_URL = 'https://a.wunderlist.com/api/v1/';
const WUNDERLIST_API_TIMEOUT = 4 * 1000;
const WUNDERLIST_SCOPES = [];

function is_invalid_creds_error(err) {
    const wunderlist_error = _.get(err, ['error', 'error']);
    if (!_.isEmpty(wunderlist_error)) {
        return wunderlist_error.type === 'unauthorized';
    }
    return false;
}


class WunderlistRequest extends KinRequest {
    constructor(req, source_id) {
        super(req, source_id, WUNDERLIST_API_BASE_URL);
    }

    get source_name() {
        return 'wunderlist';
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
