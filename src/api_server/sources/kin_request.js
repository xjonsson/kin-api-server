/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const { logger, rp } = require('../config');
const { disconnect_source } = require('../utils');


const bluebird = require('bluebird');
const _ = require('lodash');


class KinRequest {
    constructor(req, source_id, base, options) {
        this._req = req;
        this._source_id = source_id;
        this._base = base;

        this._use_refresh_token = _.get(options, 'use_refresh_token', false);
        this._backoff_delay = _.get(options, 'backoff_delay', 1000);
        this._max_backoff_attempts = _.get(options, 'max_backoff_attempts', 3);
    }

    get _user() {
        return this._req.user;
    }

    set _user(user) {
        this._req.user = user;
    }

    get _source() {
        return this._user.get_source(this._source_id);
    }

    _delay(attempt) {
        // Simple Fibonacci ;)
        let [a, b] = [0, this._backoff_delay];
        for (let i = 0; i < attempt; i += 1) {
            [a, b] = [b, a + b];
        }
        return b;
    }

    is_invalid_creds_error(err) {
        return err.statusCode === 401;
    }

    api(uri, options = {}, attempt = 0) {
        options.uri = this._base + uri; // eslint-disable-line no-param-reassign
        const merged_options = this.api_request_options(this._source.access_token, options);
        this._req.nb_reqs_out += 1;
        logger.debug('%s OUT `%d` %s %s', this._req.id, this._req.nb_reqs_out, _.get(merged_options, 'method', 'GET'), options.uri);
        return rp(merged_options)
            .catch((err) => {
                const next_attempt = attempt + 1;

                if (next_attempt >= this._max_backoff_attempts) {
                    logger.error(`${this._req.id} exhausted retry ttl for user \`${this._user.id}\` and source \`${this._source_id}\``);
                    throw err;
                }

                if (_.get(err, 'statusCode', 500) === 401 && this._use_refresh_token) {
                    return this.try_refreshing_token(next_attempt)
                        .then(this.api.bind(this, uri, options, next_attempt));
                }

                // Timeout handling
                if (err.message === 'Error: ETIMEDOUT' || err.message === 'Error: ESOCKETTIMEDOUT') {
                    return this.delayed_retry(next_attempt, err)
                        .then(this.api.bind(this, uri, options, next_attempt));
                }

                throw err;
            })
            .catch((err) => {
                if (this.is_invalid_creds_error(err)) {
                    disconnect_source(this._req, this._source, err);
                } else {
                    throw err;
                }
            });
    }

    try_refreshing_token(attempt) {
        return this._user
            .should_refresh(this._source_id)
            .then((res) => {
                if (res === 0) {
                    // We can refresh
                    return this.refresh_token()
                        .catch((err) => {
                            logger.warn(`${this._req.id} failed to refresh token`);
                            _.merge(this._source, {
                                status: 'connected', // TODO: other status?
                            });
                            this._user.add_source(this._source);
                            return this._user.save()
                                .then(() => {
                                    throw err;
                                });
                        })
                        .then(this._user.save.bind(this._user));
                }

                return this.delayed_retry(attempt, { message: 'already refreshing token' });
            });
    }

    delayed_retry(attempt, error) {
        const delay = this._delay(attempt);
        logger.debug(`${this._req.id} \`${error.message}\`, retrying in ${delay}ms`);
        return bluebird.delay(delay)
            // Reload the user to check if there are new access tokens
            .then(this._user.reload.bind(this._user))
            .then((user) => {
                this._user = user;
            });
    }

    refresh_token() {
        throw new Error('KinRequest - refresh_token - not implemented');
    }

    api_request_options(access_token, overrides) { // eslint-disable-line no-unused-vars
        throw new Error('KinRequest - api_request_options - not implemented');
    }
}


module.exports = KinRequest;
