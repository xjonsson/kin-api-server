/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const bluebird = require('bluebird');

// FIXME: Need to eslint-disable that line because the file is not considered as "test" by ESLint
const sinon = require('sinon'); // eslint-disable-line import/no-extraneous-dependencies


// TODO: add a `restore_stubs`?

function create_stubs() {
    const source = {
        id: 'kin-1234',
        access_token: 'youShallPassAccessToken',
    };

    const user = {
        id: 'kin-9876',

        add_source() {},

        get_source() {
            return source;
        },

        reload() {
            return user;
        },

        save: sinon.stub().returns(bluebird.resolve()),
        should_refresh: sinon.stub().returns(bluebird.resolve(0)),
    };

    const req = {
        user,
        query: {},
        id: 'ciwnojljo0000f1pso1veus4w',
        nb_reqs_out: 0,
    };

    return {
        req,
        source,
        user,
    };
}

module.exports = {
    create_stubs,
};
