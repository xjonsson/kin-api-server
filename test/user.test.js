/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const bluebird = require('bluebird');
const chai = require('chai');
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const sinon_chai = require('sinon-chai');
const _ = require('lodash');

const errors = require('../src/api_server/errors');

const expect = chai.expect;
chai.use(sinon_chai);


const stub_user_misc = {
    display_name: 'Bob Kin',
    timezone: 'Europe/London',
    first_day: 1,
    default_view: 'agendaWeek',
    default_calendar_id: 'testDefaultCalendarID',
    created_at: 1481198485,
    updated_at: 1481198495,
};

const redis_client_stub = {
    hmset: sinon.stub().returns(bluebird.resolve()),
    hdel: sinon.stub().returns(bluebird.resolve()),
    hgetall: sinon.stub().returns(bluebird.resolve({})),
};
redis_client_stub.hgetall
    .withArgs('bk-1234:misc')
    .returns(bluebird.resolve(stub_user_misc));

const fake_moment = function () {
    return {
        unix() {
            return 1234;
        },
    };
};

fake_moment.tz = {
    names() {
        return ['Europe/Paris', 'Europe/London', 'Europe/Zurich'];
    },
};

const User = proxyquire('../src/api_server/user', {
    './redis_clients': {
        main: redis_client_stub,
    },
    'moment-timezone': fake_moment,
});


describe('user', function () {
    beforeEach(function () {
        this.user = new User('bk-1234', stub_user_misc);

        redis_client_stub.hdel.resetHistory();
        redis_client_stub.hgetall.resetHistory();
        redis_client_stub.hmset.resetHistory();

        // FIXME: Waiting on Sinon's fixing this issue:
        // https://github.com/sinonjs/sinon/issues/1361
        redis_client_stub.hgetall
            .withArgs('bk-1234:misc')
            .returns(bluebird.resolve(stub_user_misc));
    });

    afterEach(function () {
        delete this.user;
    });

    describe('accessors', function () {
        describe('`id`', function () {
            it('returns the id used when intantiating the user', function () {
                expect(this.user.id).to.equal('bk-1234');
            });
        });

        describe('`created_at`', function () {
            it('returns the timestamp of when the user was created (after save)', function () {
                expect(this.user.created_at).to.equal(1481198485);
            });

            it('returns `0` if it\'s a new user not yet saved', function () {
                const new_user = new User('bk-1234', _.omit(stub_user_misc, ['created_at', 'updated_at']));
                expect(new_user.created_at).to.equal(0);
            });
        });

        describe('`updated_at`', function () {
            it('returns the timestamp of when the user was last saved', function () {
                expect(this.user.updated_at).to.equal(1481198495);
            });

            it('returns `0` if it\'s a new user not yet saved', function () {
                const new_user = new User('bk-1234', _.omit(stub_user_misc, ['created_at', 'updated_at']));
                expect(new_user.updated_at).to.equal(0);
            });
        });

        describe('`display_name`', function () {
            it('sets `display_name`', function () {
                this.user.display_name = 'Alice Kin';
                expect(this.user.display_name).to.equal('Alice Kin');
                expect(this.user.dirty).to.be.true;
            });

            it('does nothing when setting `display_name` to its current value', function () {
                expect(this.user.display_name).to.equal('Bob Kin');
                expect(this.user.dirty).to.be.false;
                this.user.display_name = 'Bob Kin';
                expect(this.user.display_name).to.equal('Bob Kin');
                expect(this.user.dirty).to.be.false;
            });
        });

        describe('`timezone`', function () {
            it('throws `KinInvalidFormatError` when setting it to something not in the tz database', function () {
                // https://en.wikipedia.org/wiki/Tz_database
                expect(() => {
                    this.user.timezone = 'MostLikelyNotATimezoneForACoupleOfCenturies';
                }).to.throw(errors.KinInvalidFormatError);
            });

            it('sets `timezone` properly setting a valid timezone', function () {
                this.user.timezone = 'Europe/Zurich';
                expect(this.user.timezone).to.equal('Europe/Zurich');
                expect(this.user.dirty).to.be.true;
            });

            it('does nothing when setting `timezone` to its current value', function () {
                expect(this.user.timezone).to.equal('Europe/London');
                expect(this.user.dirty).to.be.false;
                this.user.timezone = 'Europe/London';
                expect(this.user.timezone).to.equal('Europe/London');
                expect(this.user.dirty).to.be.false;
            });
        });

        describe('`first_day`', function () {
            it('throws `KinInvalidFormatError` when setting it to a non-integer', function () {
                expect(() => {
                    this.user.first_day = 1.2;
                }).to.throw(errors.KinInvalidFormatError);
            });

            it('throws `KinInvalidFormatError` when setting it to <0', function () {
                expect(() => {
                    this.user.first_day = -1;
                }).to.throw(errors.KinInvalidFormatError);
            });

            it('throws `KinInvalidFormatError` when setting it to >6', function () {
                expect(() => {
                    this.user.first_day = 7;
                }).to.throw(errors.KinInvalidFormatError);
            });

            it('sets `first_day` properly when 0 <= x <= 6', function () {
                this.user.first_day = 6;
                expect(this.user.first_day).to.equal(6);
                expect(this.user.dirty).to.be.true;
            });

            it('does nothing when setting `first_day` to its current value', function () {
                expect(this.user.first_day).to.equal(1);
                expect(this.user.dirty).to.be.false;
                this.user.first_day = 1;
                expect(this.user.first_day).to.equal(1);
                expect(this.user.dirty).to.be.false;
            });
        });

        describe('`default_view`', function () {
            it('throws `KinInvalidFormatError` when not `month` or `agendaWeek`', function () {
                expect(() => {
                    this.user.default_view = 'ImNeverGonnaGiveYouUp';
                }).to.throw(errors.KinInvalidFormatError);
            });

            // TODO: this definitely isn't the best way to test all values of an enum-like
            it('sets `default_view` to its accepted values', function () {
                this.user.default_view = 'month';
                expect(this.user.default_view).to.equal('month');
                expect(this.user.dirty).to.be.true;

                this.user.default_view = 'agendaWeek';
                expect(this.user.default_view).to.equal('agendaWeek');
                expect(this.user.dirty).to.be.true;
            });

            it('does nothing when setting `default_view` to its current value', function () {
                expect(this.user.default_view).to.equal('agendaWeek');
                expect(this.user.dirty).to.be.false;
                this.user.default_value = 'agendaWeek';
                expect(this.user.default_view).to.equal('agendaWeek');
                expect(this.user.dirty).to.be.false;
            });
        });

        describe('`default_calendar_id`', function () {
            it('sets `default_calendar_id`', function () {
                this.user.default_calendar_id = 'newDefaultCalendarID';
                expect(this.user.default_calendar_id).to.equal('newDefaultCalendarID');
                expect(this.user.dirty).to.be.true;
            });

            it('does nothing when setting `default_calendar_id` to its current value', function () {
                expect(this.user.default_calendar_id).to.equal('testDefaultCalendarID');
                expect(this.user.dirty).to.be.false;
                this.user.default_calendar_id = 'testDefaultCalendarID';
                expect(this.user.default_calendar_id).to.equal('testDefaultCalendarID');
                expect(this.user.dirty).to.be.false;
            });
        });
    });

    describe('#save', function () {
        it('eventually set dirty to false', function () {
            return expect(this.user.save())
                .to.be.fulfilled
                .then(() => {
                    expect(this.user.dirty).to.be.false;
                    expect(redis_client_stub.hmset)
                        .to.have.been.calledOnce;
                });
        });

        describe('eventually save added source', function () {
            function _assert_added_source(user, source) {
                return expect(user.save())
                    .to.be.fulfilled
                    .then(() => {
                        expect(user.dirty).to.be.false;
                        expect(redis_client_stub.hmset)
                            .to.have.been.calledTwice;

                        const source_key = 'bk-1234:sources';
                        const hmset_dict = { [source.id]: JSON.stringify(source) };
                        expect(redis_client_stub.hmset)
                            .to.have.been.calledWithExactly(source_key, hmset_dict);
                    });
            }

            beforeEach(function () {
                this._source = { id: 'kin-1234' };
            });

            it('single source', function () {
                this.user.add_source(this._source);
                return _assert_added_source(this.user, this._source);
            });

            it('single source added multiple times (dedup)', function () {
                this.user.add_source(this._source);
                this.user.add_source(this._source);
                return _assert_added_source(this.user, this._source);
            });
        });

        describe('eventually save deleted source', function () {
            function _assert_deleted_source(user, source) {
                return expect(user.save())
                    .to.be.fulfilled
                    .then(() => {
                        expect(user.dirty).to.be.false;
                        expect(redis_client_stub.hmset)
                            .to.have.been.calledonce;

                        const source_key = 'bk-1234:sources';
                        const hdel_array = [source.id];
                        expect(redis_client_stub.hdel)
                            .to.have.been.calledWithExactly(source_key, hdel_array);
                    });
            }

            beforeEach(function () {
                this._source = { id: 'kin-1234' };
            });

            it('single source', function () {
                this.user.delete_source(this._source);
                return _assert_deleted_source(this.user, this._source);
            });

            it('single source deleted multiple times (dedup)', function () {
                this.user.delete_source(this._source);
                this.user.delete_source(this._source);
                return _assert_deleted_source(this.user, this._source);
            });
        });

        it('eventually populates `created_at` on first save', function () {
            const new_user = new User('bk-1234', _.omit(stub_user_misc, ['created_at', 'updated_at']));

            return expect(new_user.save())
                .to.be.fulfilled
                .then(() => {
                    expect(new_user.updated_at).to.equal(1234);
                    expect(new_user.created_at).to.equal(1234);
                });
        });

        it('eventually updates `updated_at` and keeps `created_at` on subsequent saves', function () {
            return expect(this.user.save())
                .to.be.fulfilled
                .then(() => {
                    expect(this.user.updated_at).to.equal(1234);
                    expect(this.user.created_at).to.equal(1481198485);
                });
        });
    });

    describe('#load', function () {
        it('eventually returns `null` if user is not found', function () {
            return expect(User.load('user-not-found'))
                .to.be.rejectedWith(errors.KinUnauthenticatedUser);
        });

        it('eventually returns a complete `User` if user is found', function () {
            return expect(User.load('bk-1234'))
                .to.be.fulfilled
                .then((user) => {
                    expect(user.id).to.equal('bk-1234');
                    expect(user.display_name).to.equal('Bob Kin');
                    expect(user.timezone).to.equal('Europe/London');
                    expect(user.first_day).to.equal(1);
                    expect(user.default_view).to.equal('agendaWeek');
                    expect(user.default_calendar_id).to.equal('testDefaultCalendarID');
                });
        });
    });
});
