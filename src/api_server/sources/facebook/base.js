/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const KinRequest = require('../kin_request');
const secrets = require('../../secrets');

const crypto = require('crypto');
const _ = require('lodash');


const FACEBOOK_API_BASE_URL = 'https://graph.facebook.com/v2.7/';
const FACEBOOK_API_TIMEOUT = 4 * 1000;
const FACEBOOK_SCOPES = [
    'user_events',
    'rsvp_event',
];


class FacebookRequest extends KinRequest {
    constructor(req, source_id) {
        super(req, source_id, FACEBOOK_API_BASE_URL);
    }

    get source_name() {
        return 'facebook';
    }

    is_invalid_creds_error(err) {
        // Doc about FB Graph errors:
        // https://developers.facebook.com/docs/graph-api/using-graph-api#errors
        if (!_.has(err, 'error.error')) {
            return false;
        }

        const fb_error = err.error.error;
        if (_.isUndefined(fb_error)) {
            return false;
        }

        if (fb_error.type !== 'OAuthException') {
            return false;
        }

        if (_.has(fb_error, 'error_subcode')) {
            const subcode = fb_error.error_subcode;
            const handled_subcodes = [
                463, // expiration
                460, // password changed
                458, // app revoked / app not authorized
            ];
            if (handled_subcodes.indexOf(subcode) === -1) {
                return false;
            }
        }

        return true;
    }

    api_request_options(access_token, overrides) {
        return _.merge({
            qs: {
                access_token,
                appsecret_proof: this._gen_app_secret_proof(),
            },
            json: true,
            timeout: FACEBOOK_API_TIMEOUT,
        }, overrides);
    }

    _gen_app_secret_proof() {
        const hmac = crypto.createHmac('sha256', secrets.get('FACEBOOK_CLIENT_SECRET'));
        hmac.update(this._source.access_token);
        return hmac.digest('hex');
    }
}


module.exports = {
    FACEBOOK_API_BASE_URL,
    FACEBOOK_API_TIMEOUT,
    FACEBOOK_SCOPES,

    FacebookRequest,
};
