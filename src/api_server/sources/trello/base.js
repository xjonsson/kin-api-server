/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const KinRequest = require('../kin_request');
const secrets = require('../../secrets');
const { disconnect_source } = require('../../utils');

const _ = require('lodash');


const TRELLO_API_BASE_URL = 'https://api.trello.com/1/';
const TRELLO_API_TIMEOUT = 4 * 1000;
const TRELLO_SCOPES = 'read,write';


function is_invalid_creds_error(err) {
    const trello_error = err.error;
    if (!_.isEmpty(trello_error) && err.statusCode === 401) {
        return trello_error === 'invalid token';
    }
    return false;
}


class TrelloRequest extends KinRequest {
    constructor(req, source_id) {
        super(req, source_id, TRELLO_API_BASE_URL);
    }

    get source_name() {
        return 'trello';
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
            qs: {
                key: secrets.get('TRELLO_KEY'),
                token: access_token,
                filter: 'open',
            },
            json: true,
            timeout: TRELLO_API_TIMEOUT,
        }, overrides);
    }
}


module.exports = {
    TRELLO_API_BASE_URL,
    TRELLO_API_TIMEOUT,
    TRELLO_SCOPES,

    TrelloRequest,
};
