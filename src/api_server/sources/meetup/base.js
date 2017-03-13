/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const KinRequest = require('../kin_request');
const { logger, rp } = require('../../config');
const secrets = require('../../secrets');

const _ = require('lodash');


const MEETUP_DEFAULT_EVENT_DURATION = 3 * 60 * 60 * 1000;
const MEETUP_API_BASE_URL = 'https://api.meetup.com/';
const MEETUP_API_TIMEOUT = 4 * 1000;
const MEETUP_SCOPES = [
    'basic',
];


class MeetupRequest extends KinRequest {
    constructor(req, source_id, options = {}) {
        super(req, source_id, MEETUP_API_BASE_URL, _.merge({
            use_refresh_token: true,
        }, options));
    }

    get source_name() {
        return 'meetup';
    }

    refresh_token() {
        const options = {
            method: 'POST',
            uri: 'https://secure.meetup.com/oauth2/access',
            qs: {
                client_id: secrets.get('MEETUP_CLIENT_ID'),
                client_secret: secrets.get('MEETUP_CLIENT_SECRET'),
                grant_type: 'refresh_token',
                refresh_token: this._source.refresh_token,
            },
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
            },
            json: true,
            timeout: MEETUP_API_TIMEOUT,
        };

        return rp(options)
            .then((meetup_res) => {
                logger.debug('%s token refreshed', this._req.id);
                _.merge(this._source, {
                    access_token: meetup_res.access_token,
                    refresh_token: meetup_res.refresh_token,
                    status: 'connected',
                });
                this._user.add_source(this._source);
            });
    }

    api_request_options(access_token, overrides) {
        return _.merge({
            qs: {
                access_token,
            },
            json: true,
            timeout: MEETUP_API_TIMEOUT,
        }, overrides);
    }
}


module.exports = {
    MEETUP_DEFAULT_EVENT_DURATION,
    MEETUP_API_BASE_URL,
    MEETUP_API_TIMEOUT,
    MEETUP_SCOPES,

    MeetupRequest,
};
