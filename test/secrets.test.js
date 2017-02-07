/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const chai = require('chai');

const secrets = require('../src/api_server/secrets');

const expect = chai.expect;


describe('secrets', function () {
    describe('#get_secret', function () {
        beforeEach(function () {
            const mapping_stub = {
                TEST_ENV_KEY: {
                    prod: 'prod-secret',
                    dev: 'dev-secret',
                },
                TEST_KEY: 'secret',
            };

            this.stubs = {
                mapping: mapping_stub,
            };
        });

        it('returns a string when key is environment agnostic', function () {
            expect(secrets.get('TEST_KEY', this.stubs.mapping))
                .to.equal('secret');
        });

        it('returns a string when key is environment dependent (prod)', function () {
            expect(secrets.get('TEST_ENV_KEY', this.stubs.mapping, 'prod'))
                .to.equal('prod-secret');
        });

        it('returns a string when key is env dependent (dev)', function () {
            expect(secrets.get('TEST_ENV_KEY', this.stubs.mapping, 'dev'))
                .to.equal('dev-secret');
        });

        it('returns null when key is not found', function () {
            expect(secrets.get('TEST_NOT_FOUND', this.stubs.mapping))
                .to.be.null;
        });
    });
});
