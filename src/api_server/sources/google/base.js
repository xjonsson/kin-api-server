/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const KinRequest = require('../kin_request');
const { logger, rp } = require('../../config');
const secrets = require('../../secrets');

const _ = require('lodash');


const GCAL_API_BASE_URL = 'https://www.googleapis.com/calendar/v3/';
const GPLACES_API_BASE_URL = 'https://maps.googleapis.com/maps/api/place/';
const GOOGLE_OAUTH_TOKEN_URL = 'https://www.googleapis.com/oauth2/v4/token';
const GOOGLE_API_TIMEOUT = 4 * 1000;
const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/contacts.readonly',

    // Next ones are needed for passportjs to compute the profile
    'profile',
    'email',
];


class GoogleRequest extends KinRequest {
    constructor(req, source_id, base = GCAL_API_BASE_URL, options = {}) {
        super(req, source_id, base, _.merge({
            use_refresh_token: true,
        }, options));
    }

    get source_name() {
        return 'google';
    }

    is_invalid_creds_error(err) {
        return (
            err.statusCode === 401
            || (
                err.statusCode === 400
                && _.get(err, ['error', 'error']) === 'invalid_grant'
            )
        );
    }

    refresh_token() {
        logger.debug('%s refreshing token for user `%s` and source `%s`',
                     this._req.id, this._user.id, this._source_id);
        const options = {
            method: 'POST',
            uri: GOOGLE_OAUTH_TOKEN_URL,
            form: {
                client_id: secrets.get('GOOGLE_CLIENT_ID'),
                client_secret: secrets.get('GOOGLE_CLIENT_SECRET'),
                grant_type: 'refresh_token',
                refresh_token: this._source.refresh_token,
            },
            json: true,
            timeout: GOOGLE_API_TIMEOUT,
        };

        return rp(options)
            .then((google_res) => {
                logger.debug('%s token refreshed', this._req.id);
                _.merge(this._source, {
                    access_token: google_res.access_token,
                    status: 'connected',
                });
                this._user.add_source(this._source);
            });
    }

    api_request_options(access_token, overrides) {
        return _.merge({
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
            json: true,
            timeout: GOOGLE_API_TIMEOUT,
        }, overrides);
    }
}


function load_google_colors(req, source) {
    return new GoogleRequest(req, source.id)
        .api('colors')
        .then((google_res) => {
            source.colors = _.get(google_res, 'event'); // eslint-disable-line no-param-reassign
            req.user.add_source(source);
        });
}


module.exports = {
    GCAL_API_BASE_URL,
    GPLACES_API_BASE_URL,
    GOOGLE_OAUTH_TOKEN_URL,
    GOOGLE_API_TIMEOUT,
    GOOGLE_SCOPES,

    GoogleRequest,
    load_google_colors,
};
