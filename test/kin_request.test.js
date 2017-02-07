/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const chai = require('chai');
const chai_as_promised = require('chai-as-promised');
const nock = require('nock');
const sinon = require('sinon');
const _ = require('lodash');

const KinRequest = require('../src/api_server/sources/kin_request');

const { create_stubs } = require('./stubs');

const expect = chai.expect;
chai.use(chai_as_promised);


const TEST_TIMEOUT = 100;

class TestKinRequest extends KinRequest {
    api_request_options(access_token, overrides) {
        return _.merge({
            timeout: TEST_TIMEOUT,
        }, overrides);
    }
}

describe('KiNRequest', function () {
    beforeEach(function () {
        this.base_api_url_stub = 'https://kin.today';
        this.stubs = create_stubs();
    });

    describe('#api', function () {
        before(function () {
            // FIXME: this might not be the greatest of idea ;)
            // - Using fake timers leads to weird issues with code not
            //   controlled
            // - Setting setTimeout to setImmediate will trigger request'
            //   timeout before hitting the socket timeout, not good
            const _setTimeout = setTimeout;
            this.sandbox = sinon.sandbox.create();
            this.sandbox.stub(global, 'setTimeout', (func, delay) => {
                _setTimeout(func, delay / 100);
            });
        });

        after(function () {
            this.sandbox.restore();
        });

        it('eventually returns the response body', function () {
            nock(this.base_api_url_stub)
                .get('/test')
                .reply(200, 'ok');

            const kin_request = new TestKinRequest(
                this.stubs.req, this.stubs.source.id, this.base_api_url_stub, false);
            return expect(kin_request.api('/test'))
                .to.eventually.deep.equal('ok');
        });

        it('eventually returns a reply, even while experiencing socket timeouts', function () {
            nock(this.base_api_url_stub)
                .get('/test')
                .socketDelay(TEST_TIMEOUT * 2)
                .reply(200, 'ko');
            nock(this.base_api_url_stub)
                .get('/test')
                .reply(200, 'ok');

            const kin_request = new TestKinRequest(
                this.stubs.req, this.stubs.source.id, this.base_api_url_stub, false);
            return expect(kin_request.api('/test'))
                .to.eventually.deep.equal('ok');
        });

        // FIXME: nock's delay options actually send `response` event before
        // the delay, which makes the `request` package that we use forget its
        // connection timeout.
        it('eventually returns a reply, even while experiencing head/body response timeouts');
    });

    afterEach(function () {
        // Make sure we don't leak nock interceptors to the next test
        nock.cleanAll();
        delete this.stubs;
    });
});
