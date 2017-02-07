/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const KinRequest = require('../kin_request');

const { disconnect_source } = require('../../utils');

const _ = require('lodash');


const EVENTBRITE_API_BASE_URL = 'https://www.eventbriteapi.com/v3/';
const EVENTBRITE_API_TIMEOUT = 8 * 1000;


function is_invalid_creds_error(err) {
    const eventbrite_error = _.get(err, 'error');
    if (!_.isEmpty(eventbrite_error)) {
        // TODO: check on `error` status string as well?
        return eventbrite_error.status_code === 401;
    }
    return false;
}


class EventbriteRequest extends KinRequest {
    constructor(req, source_id) {
        super(req, source_id, EVENTBRITE_API_BASE_URL);
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
                Authorization: `Bearer ${access_token}`,
            },
            json: true,
            timeout: EVENTBRITE_API_TIMEOUT,
        }, overrides);
    }
}


module.exports = {
    EVENTBRITE_API_BASE_URL,
    EVENTBRITE_API_TIMEOUT,

    EventbriteRequest,
};
