/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const bluebird = require('bluebird');
const chai = require('chai');
const chai_as_promised = require('chai-as-promised');
const nock = require('nock');

const errors = require('../../src/api_server/errors');
const { GCAL_API_BASE_URL, GOOGLE_OAUTH_TOKEN_URL, GoogleRequest } = require('../../src/api_server/sources/google/base');

const { create_stubs } = require('../stubs');

const expect = chai.expect;
chai.use(chai_as_promised);


describe('GoogleRequest', function () {
    beforeEach(function () {
        this.stubs = create_stubs();
    });

    afterEach(function () {
        // Make sure we don't leak nock interceptors to the next test
        nock.cleanAll();
    });

    describe('#api', function () {
        it('refreshes token when unauthorized and eventually returns the response\'s body', function () {
            const unauthorized_stub_reply = {
                error: {
                    errors: [
                        {
                            domain: 'global',
                            reason: 'authError',
                            message: 'Invalid Credentials',
                            locationType: 'header',
                            location: 'Authorization',
                        },
                    ],
                    code: 401,
                    message: 'Invalid Credentials',
                },
            };
            // TODO: add tests where we try to refresh token?
            this.stubs.user.should_refresh.returns(bluebird.resolve(0));

            nock(GCAL_API_BASE_URL)
                .get('/test')
                .reply(401, unauthorized_stub_reply);

            nock(GOOGLE_OAUTH_TOKEN_URL)
                .post('')
                .reply(200, {
                    access_token: 'test',
                });

            nock(GCAL_API_BASE_URL)
                .get('/test')
                .reply(200, 'ok');

            const req_promise = new GoogleRequest(
                this.stubs.req, this.stubs.source.id, GCAL_API_BASE_URL, {
                    backoff_delay: 1,
                    max_backoff_attempts: 2,
                })
                .api('test', {}, 0);
            return expect(req_promise)
                .to.eventually.deep.equal('ok');
        });

        it('disconnects source when unauthorized (and fails to refresh the token)', function () {
            const unauthorized_stub_reply = {
                error: {
                    errors: [
                        {
                            domain: 'global',
                            reason: 'authError',
                            message: 'Invalid Credentials',
                            locationType: 'header',
                            location: 'Authorization',
                        },
                    ],
                    code: 401,
                    message: 'Invalid Credentials',
                },
            };
            // TODO: add tests where we try to refresh token?
            this.stubs.user.should_refresh.returns(bluebird.resolve(0));

            nock(GCAL_API_BASE_URL)
                .get('/test')
                .reply(401, unauthorized_stub_reply);

            nock(GOOGLE_OAUTH_TOKEN_URL)
                .post('')
                .reply(401, unauthorized_stub_reply);

            nock(GCAL_API_BASE_URL)
                .get('/test')
                .reply(200, 'ok');

            const req_promise = new GoogleRequest(
                this.stubs.req, this.stubs.source.id, GCAL_API_BASE_URL, {
                    backoff_delay: 1,
                    max_backoff_attempts: 2,
                })
                .api('test', {}, 0);
            return expect(req_promise)
                .to.be.rejectedWith(errors.KinDisconnectedSourceError);
        });

        it('disconnects source when unauthorized - proper json response (token is already being refreshed)', function () {
            const stub_reply = {
                error: {
                    errors: [
                        {
                            domain: 'global',
                            reason: 'authError',
                            message: 'Invalid Credentials',
                            locationType: 'header',
                            location: 'Authorization',
                        },
                    ],
                    code: 401,
                    message: 'Invalid Credentials',
                },
            };
            // TODO: add tests where we try to refresh token?
            this.stubs.user.should_refresh.returns(bluebird.resolve(1));

            nock(GCAL_API_BASE_URL)
                .get('/test')
                .times(3)
                .reply(401, stub_reply);

            const req_promise = new GoogleRequest(
                this.stubs.req, this.stubs.source.id, GCAL_API_BASE_URL, {
                    backoff_delay: 1,
                    max_backoff_attempts: 3,
                })
                .api('test', {}, 0);
            return expect(req_promise)
                .to.be.rejectedWith(errors.KinDisconnectedSourceError);
        });

        it('disconnects source when unauthorized - html-gibberish response (token is already being refreshed)', function () {
            const stub_reply = '<html><body><p><b>401.</b><ins>That&#39;s an error.</ins></p><p>There was an error in your request.<ins>That&#39;s all we know.</ins></p></body></html>';
            // TODO: add tests where we try to refresh token?
            this.stubs.user.should_refresh.returns(bluebird.resolve(1));

            nock(GCAL_API_BASE_URL)
                .get('/test')
                .times(3)
                .reply(401, stub_reply);

            const req_promise = new GoogleRequest(
                this.stubs.req, this.stubs.source.id, GCAL_API_BASE_URL, {
                    backoff_delay: 1,
                    max_backoff_attempts: 3,
                })
                .api('test', {}, 0);
            return expect(req_promise)
                .to.be.rejectedWith(errors.KinDisconnectedSourceError);
        });

        it('disconnects source when refresh token has been revoked', function () {
            const stub_reply = {
                error: 'invalid_grant',
                error_description: 'Token has been expired or revoked.',
            };

            nock(GCAL_API_BASE_URL)
                .get('/test')
                .reply(400, stub_reply);

            const req_promise = new GoogleRequest(
                this.stubs.req, this.stubs.source.id, GCAL_API_BASE_URL)
                .api('test', {}, 0);
            return expect(req_promise)
                .to.be.rejectedWith(errors.KinDisconnectedSourceError);
        });
    });
});
