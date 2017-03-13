/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const KinRequest = require('../kin_request');
const { logger, rp } = require('../../config');
const secrets = require('../../secrets');

const _ = require('lodash');


const OUTLOOK_API_BASE_URL = 'https://outlook.office.com/api/v2.0/';
const OUTLOOK_API_TIMEOUT = 8 * 1000;
const OUTLOOK_SCOPES = [
    'openid',
    'profile',
    'offline_access',
    'https://outlook.office.com/calendars.read',
];


class OutlookRequest extends KinRequest {
    constructor(req, source_id, options = {}) {
        super(req, source_id, OUTLOOK_API_BASE_URL, _.merge({
            use_refresh_token: true,
        }, options));
    }

    get source_name() {
        return 'outlook';
    }

    refresh_token() {
        logger.debug('%s refreshing token for user `%s` and source `%s`',
                     this._req.id, this._user.id, this._source.id);
        const options = {
            method: 'POST',
            uri: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            form: {
                client_id: secrets.get('OUTLOOK_CLIENT_ID'),
                client_secret: secrets.get('OUTLOOK_CLIENT_SECRET'),
                grant_type: 'refresh_token',
                refresh_token: this._source.refresh_token,
            },
            json: true,
            timeout: OUTLOOK_API_TIMEOUT,
        };

        return rp(options)
            .then((outlook_res) => {
                _.merge(this._source, {
                    access_token: outlook_res.access_token,
                    refresh_token: outlook_res.refresh_token,
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
            timeout: OUTLOOK_API_TIMEOUT,
        }, overrides);
    }
}


module.exports = {
    OUTLOOK_API_BASE_URL,
    OUTLOOK_API_TIMEOUT,
    OUTLOOK_SCOPES,

    OutlookRequest,
};
