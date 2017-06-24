/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const bluebird = require("bluebird");
const chai = require("chai");
const proxyquire = require("proxyquire").noCallThru();
const sinon = require("sinon");
const sinon_chai = require("sinon-chai");

const errors = require("../src/api_server/errors");

const user_stub = {
    load: sinon.stub().returns(
        bluebird.resolve({
            id: "kin-1234",
            display_name: "Bob Kin"
        }) // eslint-disable-line comma-dangle
    )
};

const utils = proxyquire("../src/api_server/utils", {
    "./user": user_stub
});

const expect = chai.expect;
chai.use(sinon_chai);

describe("utlis", function() {
    beforeEach(function() {
        user_stub.load.resetHistory();
        this.next_spy = sinon.spy();
    });

    describe("#ensured_logged_in", function() {
        it("call `next` with `KinUnauthenticatedUser` error when unauthenticated", function() {
            const req = {
                session: {
                    id: undefined
                }
            };
            utils.ensured_logged_in(req, {}, this.next_spy);
            // .to.throw(errors.KinUnauthenticatedUser);
            expect(this.next_spy).to.have.been.calledOnce;
            const args = this.next_spy.firstCall.args;
            expect(args[0]).to.be.an.instanceof(errors.KinUnauthenticatedUser);
        });

        it("call `next` with no args when authenticated", function() {
            const req = {
                user: {}
            };
            utils.ensured_logged_in(req, {}, this.next_spy);
            expect(this.next_spy).to.have.been.calledOnce;
            expect(this.next_spy).to.always.have.been.calledWithExactly();
        });

        it("load user when not yet authenticated and eventually calls `next` if successful", function() {
            const req = {
                session: {
                    id: "1234",
                    user: "kin-1234"
                }
            };
            return expect(
                utils.ensured_logged_in(req, {}, this.next_spy)
            ).to.be.fulfilled.then(() => {
                expect(req.user).to.deep.equal({
                    id: "kin-1234",
                    display_name: "Bob Kin"
                });
                expect(this.next_spy).to.have.been.calledOnce;
                expect(this.next_spy).to.always.have.been.calledWithExactly();
            });
        });

        it("load user when not yet authenticated and eventually calls `next` with `KinUnauthenticatedUser` error if unsuccessful", function() {
            user_stub.load.returns(bluebird.reject("test"));
            const req = {
                session: {
                    id: "1234",
                    user: "kin-1234"
                }
            };
            return expect(
                utils.ensured_logged_in(req, {}, this.next_spy)
            ).to.be.fulfilled.then(() => {
                expect(this.next_spy).to.have.been.calledOnce;
                const args = this.next_spy.firstCall.args;
                expect(args[0]).to.be.an.instanceof(errors.KinUnauthenticatedUser);
            });
        });
    });

    describe("#validate_source", function() {
        it("return errors when source is not found", function() {
            const req = {
                user: {
                    get_source() {
                        return undefined;
                    }
                }
            };
            expect(utils.validate_source(req, "invalid_id")).to.be.an.instanceof(
                errors.KinSourceNotFoundError
            );
        });

        it("returns error when source is disconnected", function() {
            const req = {
                user: {
                    get_source() {
                        return {
                            status: "disconnected"
                        };
                    }
                }
            };
            expect(utils.validate_source(req, "1234")).to.be.an.instanceof(
                errors.KinDisconnectedSourceError
            );
        });

        it("returns undefined when source is connected", function() {
            const req = {
                user: {
                    get_source() {
                        return {
                            status: "connected"
                        };
                    }
                }
            };
            expect(utils.validate_source(req, "1234")).to.be.undefined;
        });
    });

    describe("#create_source", function() {
        beforeEach(function() {
            // use to stub `created_at`
            this.clock = sinon.useFakeTimers();
            this.profile_stub = {
                id: "test",
                provider: "test",
                displayName: "Bob Tester",
                emails: [
                    {
                        value: "bob.tester@kin.today"
                    }
                ]
            };
        });

        it("should return a valid source given a valid profile", function() {
            const source = utils.create_source(this.profile_stub);
            expect(source).to.be.deep.equal({
                id: "test-test",
                display_name: "Bob Tester",
                email: "bob.tester@kin.today",
                status: "connected",
                created_at: 0
            });
        });

        afterEach(function() {
            this.clock.restore();
        });
    });

    describe("#split_source_id", function() {
        it("returns an empty object if it's not a valid source id /.+-.+/", function() {
            expect(utils.split_source_id("kin1234")).to.deep.equal({});
            expect(utils.split_source_id("kin-")).to.deep.equal({});
            expect(utils.split_source_id("-1234")).to.deep.equal({});
        });

        it("splits the source into a provider name and an ID", function() {
            expect(utils.split_source_id("kin-1234")).to.deep.equal({
                provider_name: "kin",
                provider_user_id: "1234"
            });
        });

        it("splits the source into a provider name and an ID at the first '-' encountered", function() {
            expect(utils.split_source_id("kin-1234-5678")).to.deep.equal({
                provider_name: "kin",
                provider_user_id: "1234-5678"
            });
        });
    });

    describe("#prepare_request_stats", function() {
        it("adds `id` and `nb_reqs_out` to the request and calls `next`", function() {
            const req = {
                id: null
            };
            utils.prepare_request_stats(req, {}, this.next_spy);
            expect(req.id).to.not.be.null;
            expect(req.nb_reqs_out).to.equal(0);
            expect(this.next_spy).to.have.been.called;
        });
    });
});
