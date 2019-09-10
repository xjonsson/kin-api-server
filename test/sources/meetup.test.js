/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const bluebird = require("bluebird");
const chai = require("chai");
const chai_as_promised = require("chai-as-promised");
const nock = require("nock");

const errors = require("../../src/api_server/errors");
const meetup_actions = require("../../src/api_server/sources/meetup/actions");
const { MEETUP_API_BASE_URL, MeetupRequest } = require("../../src/api_server/sources/meetup/base");

const { create_stubs } = require("../stubs");

const expect = chai.expect;
chai.use(chai_as_promised);

describe("Meetup", function() {
    beforeEach(function() {
        this.stubs = create_stubs();
    });

    describe("request", function() {
        it("disconnects source when unauthorized", function() {
            const stub_reply = {
                errors: [
                    {
                        code: "auth_fail",
                        message: "Invalid oauth credentials"
                    }
                ]
            };
            // TODO: add tests where we try to refresh token?
            this.stubs.user.should_refresh.returns(bluebird.resolve(1));

            nock(MEETUP_API_BASE_URL).get("/test").query(true).times(2).reply(401, stub_reply);

            const req_promise = new MeetupRequest(this.stubs.req, this.stubs.source.id, {
                backoff_delay: 1,
                max_backoff_attempts: 2
            }).api("test", {}, 0);
            return expect(req_promise).to.be.rejectedWith(errors.KinDisconnectedSourceError);
        });
    });

    describe("actions", function() {
        describe("#load_layers", function() {
            it("eventually returns a list of layers", function() {
                const promise = meetup_actions.load_layers(this.stubs.req, this.stubs.source);
                return expect(promise).to.eventually.deep.equal([
                    {
                        id: "kin-1234:events_attending",
                        title: "Events I'm attending",
                        color: "#ED1C40",
                        text_color: "#FFFFFF",
                        acl: {
                            edit: false,
                            create: false,
                            delete: false
                        },
                        selected: true
                    }
                ]);
            });
        });

        describe("#load_events", function() {
            // https://www.meetup.com/meetup_api/docs/self/events/
            it("eventually returns a list of events", function() {
                const layer_id = "kin-1234:events_attending";
                nock(MEETUP_API_BASE_URL)
                    .get("/self/events")
                    .query({
                        access_token: "youShallPassAccessToken"
                    })
                    .reply(200, [
                        {
                            id: "alpha",
                            name: "Alpha",
                            venue: {
                                name: "Paris, France"
                            },
                            description: "<p>Alpha description</p>",
                            link: "http://www.meetup.com/MeetupGroupName/events/alpha/",
                            time: 1476057600000,
                            duration: 3600000
                        }
                    ]);

                return expect(
                    meetup_actions.load_events(this.stubs.req, this.stubs.source, layer_id) // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    events: [
                        {
                            id: "kin-1234:events_attending:alpha",
                            title: "Alpha",
                            description: "Alpha description",
                            link: "http://www.meetup.com/MeetupGroupName/events/alpha/",
                            location: "Paris, France",
                            kind: "event#basic",
                            start: {
                                date_time: "2016-10-10T00:00:00Z"
                            },
                            end: {
                                date_time: "2016-10-10T01:00:00Z"
                            }
                        }
                    ]
                });
            });
        });
    });

    afterEach(function() {
        // Make sure we don't leak nock interceptors to the next test
        nock.cleanAll();
    });
});
