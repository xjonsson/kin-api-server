/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const chai = require("chai");
const chai_as_promised = require("chai-as-promised");
const nock = require("nock");

const errors = require("../../src/api_server/errors");
const github_actions = require("../../src/api_server/sources/github/actions");
const { GITHUB_API_BASE_URL, GithubRequest } = require("../../src/api_server/sources/github/base");

const { create_stubs } = require("../stubs");

const expect = chai.expect;
chai.use(chai_as_promised);

describe("Github", function() {
    beforeEach(function() {
        this.stubs = create_stubs();
    });

    describe("request", function() {
        it("disconnects source when unauthorized", function() {
            const stub_reply = {
                message: "Bad credentials",
                documentation_url: "https://developer.github.com/v3"
            };

            nock(GITHUB_API_BASE_URL).get("/test").reply(401, stub_reply);

            const req_promise = new GithubRequest(this.stubs.req, this.stubs.source.id).api("test");
            return expect(req_promise).to.be.rejectedWith(errors.KinDisconnectedSourceError);
        });
    });

    describe("actions", function() {
        describe("#load_layers", function() {
            // https://developer.github.com/v3/repos/#list-your-repositories
            it("eventually returns a list of layers", function() {
                nock(GITHUB_API_BASE_URL).get("/user/repos").reply(200, [
                    {
                        full_name: "kin/abcd",
                        name: "ABCD"
                    },
                    {
                        full_name: "kin/efgh",
                        name: "EFGH"
                    }
                ]);

                const promise = github_actions.load_layers(this.stubs.req, this.stubs.source);
                return expect(promise).to.eventually.deep.equal([
                    {
                        id: "kin-1234:kin\\abcd",
                        title: "ABCD",
                        color: "#000000",
                        text_color: "#FFFFFF",
                        acl: {
                            edit: true,
                            create: true,
                            delete: true
                        },
                        selected: false
                    },
                    {
                        id: "kin-1234:kin\\efgh",
                        title: "EFGH",
                        color: "#000000",
                        text_color: "#FFFFFF",
                        acl: {
                            edit: true,
                            create: true,
                            delete: true
                        },
                        selected: false
                    }
                ]);
            });
        });

        describe("#load_events", function() {
            // https://developer.github.com/v3/issues/milestones/#list-milestones-for-a-repository
            it("eventually returns a list of events", function() {
                const normalized_github_repo_id = "kin\\abcd";
                const unnormalized_github_repo_id = "kin/abcd";
                const layer_id = `kin-1234:${normalized_github_repo_id}`;
                nock(GITHUB_API_BASE_URL)
                    .get(`/repos/${unnormalized_github_repo_id}/milestones`)
                    .reply(200, [
                        {
                            number: 42,
                            title: "Alpha",
                            description: "Alpha description",
                            html_url: "https://github.com/kin/abcd/milestones/alpha",
                            due_on: "2016-10-10T00:00:00Z"
                        }
                    ]);

                return expect(
                    github_actions.load_events(this.stubs.req, this.stubs.source, layer_id) // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    events: [
                        {
                            id: "kin-1234:kin\\abcd:42",
                            title: "Alpha",
                            description: "Alpha description",
                            kind: "event#basic",
                            link: "https://github.com/kin/abcd/milestones/alpha",
                            start: {
                                date: "2016-10-10"
                            },
                            end: {
                                date: "2016-10-11"
                            }
                        }
                    ]
                });
            });

            it("eventually throws a `KinLayerNotFoundError` when the user has restricted access to it", function() {
                const normalized_github_repo_id = "kin\\abcd";
                const unnormalized_github_repo_id = "kin/abcd";
                const layer_id = `kin-1234:${normalized_github_repo_id}`;
                nock(GITHUB_API_BASE_URL)
                    .get(`/repos/${unnormalized_github_repo_id}/milestones`)
                    .reply(404, {
                        message: "Not Found",
                        documentation_url: "https://developer.github.com/v3"
                    });

                return expect(
                    github_actions.load_events(this.stubs.req, this.stubs.source, layer_id) // eslint-disable-line comma-dangle
                ).to.be.rejectedWith(errors.KinLayerNotFoundError);
            });
        });

        describe("#create_event", function() {
            // https://developer.github.com/v3/issues/milestones/#create-a-milestone
            it("eventually returns an event with only a title");
            it("eventually returns an event with a title, description and due date");
        });

        describe("#patch_event", function() {
            // https://developers.github.com/advanced-reference/card#put-1-cards-card-id-or-shortlink
            it("eventually returns an event after editing title and description");
            it("eventually returns an event after editing start date");
            it("eventually returns an event after editing end date");
        });

        describe("#delete_event", function() {
            // https://developers.github.com/advanced-reference/card#delete-1-cards-card-id-or-shortlink
            it("returns a fulfilled promise", function() {
                const normalized_github_repo_id = "kin\\abcd";
                const unnormalized_github_repo_id = "kin/abcd";
                const github_milestone_id = 42;
                const event_id = `kin-1234:${normalized_github_repo_id}:${github_milestone_id}`;
                nock(GITHUB_API_BASE_URL)
                    .delete(
                        `/repos/${unnormalized_github_repo_id}/milestones/${github_milestone_id}`
                    )
                    .reply(204);
                return expect(
                    github_actions.delete_event(this.stubs.req, this.stubs.source, event_id) // eslint-disable-line comma-dangle
                ).to.eventually.be.fulfilled;
            });
        });
    });

    afterEach(function() {
        // Make sure we don't leak nock interceptors to the next test
        nock.cleanAll();
    });
});
