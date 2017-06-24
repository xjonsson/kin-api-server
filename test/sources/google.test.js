/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const chai = require("chai");
const chai_as_promised = require("chai-as-promised");
const nock = require("nock");
const { escape } = require("querystring");
const _ = require("lodash");

const errors = require("../../src/api_server/errors");
const google_actions = require("../../src/api_server/sources/google/actions");
const {
    GCAL_API_BASE_URL,
    GPLACES_API_BASE_URL
} = require("../../src/api_server/sources/google/base");

const { create_stubs } = require("../stubs");

const expect = chai.expect;
chai.use(chai_as_promised);

describe("Google", function() {
    beforeEach(function() {
        this.stubs = create_stubs();
    });

    afterEach(function() {
        // Make sure we don't leak nock interceptors to the next test
        nock.cleanAll();
    });

    describe("actions", function() {
        describe("#load_layers", function() {
            // https://developers.google.com/google-apps/calendar/v3/reference/calendarList
            it("eventually returns a layer", function() {
                nock(GCAL_API_BASE_URL).get("/users/me/calendarList").reply(200, {
                    items: [
                        {
                            // Only required parameters
                            id: "abcd",
                            summary: "ABCD title",
                            accessRole: "freeBusyReader"
                        }
                    ]
                });

                const promise = google_actions.load_layers(this.stubs.req, this.stubs.source);
                return expect(promise).to.eventually.deep.equal([
                    {
                        id: "kin-1234:abcd",
                        title: "ABCD title",
                        acl: {
                            create: false,
                            delete: false,
                            edit: false
                        }
                    }
                ]);
            });
            it("eventually returns a layer with proper optional colors", function() {
                nock(GCAL_API_BASE_URL).get("/users/me/calendarList").reply(200, {
                    items: [
                        {
                            id: "efgh",
                            summary: "EFGH title",
                            accessRole: "reader",

                            // Adding optional parameters
                            backgroundColor: "#FF0000",
                            foregroundColor: "#00FF00"
                        }
                    ]
                });

                const promise = google_actions.load_layers(this.stubs.req, this.stubs.source);
                return expect(promise).to.eventually.deep.equal([
                    {
                        id: "kin-1234:efgh",
                        title: "EFGH title",
                        acl: {
                            create: false,
                            delete: false,
                            edit: false
                        },
                        color: "#FF0000",
                        text_color: "#00FF00"
                    }
                ]);
            });
            it("eventually returns a layer preserving its selection status", function() {
                nock(GCAL_API_BASE_URL).get("/users/me/calendarList").reply(200, {
                    items: [
                        {
                            id: "ijkl",
                            summary: "IJKL title",
                            accessRole: "reader",
                            selected: true
                        }
                    ]
                });

                const promise = google_actions.load_layers(this.stubs.req, this.stubs.source);
                return expect(promise).to.eventually.deep.equal([
                    {
                        id: "kin-1234:ijkl",
                        title: "IJKL title",
                        acl: {
                            create: false,
                            delete: false,
                            edit: false
                        },
                        selected: true
                    }
                ]);
            });
            it("eventually returns a layer with proper acls", function() {
                nock(GCAL_API_BASE_URL).get("/users/me/calendarList").reply(200, {
                    items: [
                        {
                            id: "freeBusyReader",
                            summary: "Free Busy Reader",
                            accessRole: "freeBusyReader"
                        },
                        {
                            id: "reader",
                            summary: "Reader",
                            accessRole: "reader"
                        },
                        {
                            id: "writer",
                            summary: "Writer",
                            accessRole: "writer"
                        },
                        {
                            id: "owner",
                            summary: "Owner",
                            accessRole: "owner"
                        }
                    ]
                });

                const promise = google_actions.load_layers(this.stubs.req, this.stubs.source);
                return expect(promise).to.eventually.deep.equal([
                    {
                        id: "kin-1234:freeBusyReader",
                        title: "Free Busy Reader",
                        acl: {
                            create: false,
                            delete: false,
                            edit: false
                        }
                    },
                    {
                        id: "kin-1234:reader",
                        title: "Reader",
                        acl: {
                            create: false,
                            delete: false,
                            edit: false
                        }
                    },
                    {
                        id: "kin-1234:writer",
                        title: "Writer",
                        acl: {
                            create: true,
                            delete: true,
                            edit: true
                        }
                    },
                    {
                        id: "kin-1234:owner",
                        title: "Owner",
                        acl: {
                            create: true,
                            delete: true,
                            edit: true
                        }
                    }
                ]);
            });
        });

        describe("#load_events", function() {
            // https://developers.google.com/google-apps/calendar/v3/reference/events
            it("eventually returns a list of events", function() {
                const google_layer_id = "abcd";
                const layer_id = `kin-1234:${google_layer_id}`;
                nock(GCAL_API_BASE_URL)
                    .get(`/calendars/${google_layer_id}/events`)
                    .query(true)
                    .reply(200, {
                        items: [
                            {
                                id: "alpha",
                                summary: "Alpha title",
                                start: {
                                    date: "2016-10-10"
                                },
                                end: {
                                    date: "2016-10-10"
                                }
                            },
                            {
                                id: "beta",
                                summary: "Beta title",
                                start: {
                                    dateTime: "2016-10-10T10:00:00+00:00"
                                },
                                end: {
                                    dateTime: "2016-10-10T20:00:00+00:00"
                                }
                            }
                        ]
                    });

                return expect(
                    google_actions.load_events(this.stubs.req, this.stubs.source, layer_id) // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    events: [
                        {
                            id: "kin-1234:abcd:alpha",
                            title: "Alpha title",
                            status: "confirmed",
                            start: {
                                date: "2016-10-10"
                            },
                            end: {
                                date: "2016-10-10"
                            },
                            kind: "event#basic",
                            attendees: [],
                            reminders: []
                        },
                        {
                            id: "kin-1234:abcd:beta",
                            title: "Beta title",
                            status: "confirmed",
                            start: {
                                date_time: "2016-10-10T10:00:00+00:00"
                            },
                            end: {
                                date_time: "2016-10-10T20:00:00+00:00"
                            },
                            kind: "event#basic",
                            attendees: [],
                            reminders: []
                        }
                    ],
                    next_sync_token: undefined,
                    sync_type: "full"
                });
            });
            it("eventually returns a list of events with status, location and description", function() {
                const google_layer_id = "abcd";
                const layer_id = `kin-1234:${google_layer_id}`;
                nock(GCAL_API_BASE_URL)
                    .get(`/calendars/${google_layer_id}/events`)
                    .query(true)
                    .reply(200, {
                        items: [
                            {
                                id: "alpha",
                                summary: "Alpha title",
                                status: "confirmed", // optional
                                location: "Paris, France", // optional
                                description: "alpha description", // optional
                                start: {
                                    date: "2016-10-10"
                                },
                                end: {
                                    date: "2016-10-10"
                                },
                                attendees: [
                                    // Testing all variants of `response_status`
                                    {
                                        email: "alice@kin.today",
                                        responseStatus: "needsAction",
                                        self: false
                                    },
                                    {
                                        email: "bob@kin.today",
                                        responseStatus: "declined",
                                        self: false
                                    },
                                    {
                                        email: "charlie@kin.today",
                                        responseStatus: "tentative",
                                        self: false
                                    },
                                    {
                                        email: "dan@kin.today",
                                        responseStatus: "accepted",
                                        self: false
                                    }
                                ],
                                reminders: {
                                    overrides: [
                                        {
                                            minutes: 10
                                        },
                                        {
                                            minutes: 15
                                        }
                                    ]
                                },
                                colorId: 0 // optional
                            }
                        ],
                        nextSyncToken: "lessSuperToken"
                    });

                return expect(
                    google_actions.load_events(this.stubs.req, this.stubs.source, layer_id) // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    events: [
                        {
                            id: "kin-1234:abcd:alpha",
                            title: "Alpha title",
                            status: "confirmed",
                            location: "Paris, France",
                            description: "alpha description",
                            start: {
                                date: "2016-10-10"
                            },
                            end: {
                                date: "2016-10-10"
                            },
                            attendees: [
                                {
                                    email: "alice@kin.today",
                                    response_status: "needs_action",
                                    self: false
                                },
                                {
                                    email: "bob@kin.today",
                                    response_status: "declined",
                                    self: false
                                },
                                {
                                    email: "charlie@kin.today",
                                    response_status: "tentative",
                                    self: false
                                },
                                {
                                    email: "dan@kin.today",
                                    response_status: "accepted",
                                    self: false
                                }
                            ],
                            reminders: [
                                {
                                    minutes: 10
                                },
                                {
                                    minutes: 15
                                }
                            ],
                            kind: "event#basic"
                        }
                    ],
                    next_sync_token: "lessSuperToken",
                    sync_type: "full"
                });
            });
            it("eventually returns a set of incremental results when providing a sync token", function() {
                this.stubs.req.query.sync_token = "superAwesomeSyncToken";
                const google_layer_id = "abcd";
                const layer_id = `kin-1234:${google_layer_id}`;
                nock(GCAL_API_BASE_URL)
                    .get(`/calendars/${google_layer_id}/events`)
                    .query(true)
                    .reply(200, {
                        items: [
                            {
                                id: "beta",
                                summary: "Beta title",
                                start: {
                                    date: "2016-10-20"
                                },
                                end: {
                                    date: "2016-10-21"
                                }
                            }
                        ],
                        nextSyncToken: "nextSuperAwesomeSyncToken"
                    });

                return expect(
                    google_actions.load_events(this.stubs.req, this.stubs.source, layer_id) // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    events: [
                        {
                            id: "kin-1234:abcd:beta",
                            title: "Beta title",
                            start: {
                                date: "2016-10-20"
                            },
                            end: {
                                date: "2016-10-21"
                            },
                            attendees: [],
                            reminders: [],
                            status: "confirmed",
                            kind: "event#basic"
                        }
                    ],
                    next_sync_token: "nextSuperAwesomeSyncToken",
                    sync_type: "incremental"
                });
            });
            it("eventually returns a list of events, using GCal pagination", function() {
                const google_layer_id = "abcd";
                const layer_id = `kin-1234:${google_layer_id}`;
                nock(GCAL_API_BASE_URL)
                    .get(`/calendars/${google_layer_id}/events`)
                    .query(function(query) {
                        return _.isEmpty(query.pageToken);
                    })
                    .reply(200, {
                        items: [
                            {
                                id: "gamma",
                                summary: "Gamma title",
                                start: {
                                    date: "2016-10-20"
                                },
                                end: {
                                    date: "2016-10-21"
                                }
                            }
                        ],
                        nextPageToken: "nextPageToken"
                    });

                nock(GCAL_API_BASE_URL)
                    .get(`/calendars/${google_layer_id}/events`)
                    .query(function(query) {
                        return !_.isEmpty(query.pageToken) && query.pageToken === "nextPageToken";
                    })
                    .reply(200, {
                        items: [
                            {
                                id: "delta",
                                summary: "Delta title",
                                start: {
                                    date: "2016-10-21"
                                },
                                end: {
                                    date: "2016-10-22"
                                }
                            }
                        ],
                        nextSyncToken: "nextSuperAwesomeSyncToken"
                    });

                return expect(
                    google_actions.load_events(this.stubs.req, this.stubs.source, layer_id) // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    events: [
                        {
                            id: "kin-1234:abcd:gamma",
                            title: "Gamma title",
                            start: {
                                date: "2016-10-20"
                            },
                            end: {
                                date: "2016-10-21"
                            },
                            attendees: [],
                            reminders: [],
                            status: "confirmed",
                            kind: "event#basic"
                        },
                        {
                            id: "kin-1234:abcd:delta",
                            title: "Delta title",
                            start: {
                                date: "2016-10-21"
                            },
                            end: {
                                date: "2016-10-22"
                            },
                            attendees: [],
                            reminders: [],
                            status: "confirmed",
                            kind: "event#basic"
                        }
                    ],
                    next_sync_token: "nextSuperAwesomeSyncToken",
                    sync_type: "full"
                });
            });
            it("eventually throws if the calendar is not found", function() {
                const google_layer_id = "notFound";
                const layer_id = `kin-1234:${google_layer_id}`;
                const stub_reply = {
                    error: {
                        errors: [
                            {
                                domain: "global",
                                reason: "notFound",
                                message: "Not Found"
                            }
                        ],
                        code: 404,
                        message: "Not Found"
                    }
                };

                nock(GCAL_API_BASE_URL)
                    .get(`/calendars/${google_layer_id}/events`)
                    .query(true)
                    .reply(404, stub_reply);
                return expect(
                    google_actions.load_events(this.stubs.req, this.stubs.source, layer_id) // eslint-disable-line comma-dangle
                ).to.be.rejectedWith(errors.KinLayerNotFoundError);
            });
        });

        describe("#delete_event", function() {
            // https://developers.google.com/google-apps/calendar/v3/reference/events/delete
            it("returns a fulfilled promise", function() {
                const google_layer_id = "abcd";
                const google_event_id = "alpha";
                const event_id = `kin-1234:${google_layer_id}:${google_event_id}`;
                nock(GCAL_API_BASE_URL)
                    .delete(`/calendars/${google_layer_id}/events/${google_event_id}`)
                    .reply(204);
                return expect(
                    google_actions.delete_event(this.stubs.req, this.stubs.source, event_id) // eslint-disable-line comma-dangle
                ).to.eventually.be.fulfilled;
            });
        });

        describe("#patch_event", function() {
            // https://developers.google.com/google-apps/calendar/v3/reference/events/patch
            beforeEach(function() {
                this.google_layer_id = "abcd";
                this.google_event_id = "alpha";
                this.event_id = `kin-1234:${this.google_layer_id}:${this.google_event_id}`;
                this.expected_uri = `/calendars/${escape(this.google_layer_id)}/events/${escape(
                    this.google_event_id
                )}`;
                this.expected_query = {
                    sendNotifications: false
                };
                this.stub_reply = {
                    id: "alpha",
                    summary: "Alpha",
                    start: {
                        date: "2016-10-10"
                    },
                    end: {
                        date: "2016-10-10"
                    }
                };
                this.expected_reply = {
                    id: "kin-1234:abcd:alpha",
                    title: "Alpha",
                    status: "confirmed",
                    start: {
                        date: "2016-10-10"
                    },
                    end: {
                        date: "2016-10-10"
                    },
                    kind: "event#basic",
                    attendees: [],
                    reminders: []
                };
            });

            it("eventually returns an event after editing its title", function() {
                const event_patch = {};
                const expected_patch = {};
                const title = "Alpha edited";
                event_patch.title = title;
                this.expected_reply.title = title;
                expected_patch.summary = title;
                this.stub_reply.summary = title;

                nock(GCAL_API_BASE_URL)
                    .patch(this.expected_uri, expected_patch)
                    .query(this.expected_query)
                    .reply(200, this.stub_reply);
                return expect(
                    google_actions.patch_event(
                        this.stubs.req,
                        this.stubs.source,
                        this.event_id,
                        event_patch
                    )
                ).to.eventually.deep.equal(this.expected_reply);
            });
            it("eventually returns an event after editing its start and end dates (start < end)", function() {
                const event_patch = {};
                const kin_start = {
                    date_time: "2016-10-11T00:00:00Z"
                };
                const kin_end = {
                    date_time: "2016-10-11T01:00:00Z"
                };
                const google_start = {
                    dateTime: "2016-10-11T00:00:00Z"
                };
                const google_end = {
                    dateTime: "2016-10-11T01:00:00Z"
                };

                event_patch.start = kin_start;
                event_patch.end = kin_end;

                this.expected_reply.start = kin_start;
                this.expected_reply.end = kin_end;

                const expected_patch = {
                    start: google_start,
                    end: google_end
                };
                // When switching from an all-day event to a timed event, you need
                // to nullify the other "timing" parameter in the patch sent to Google
                expected_patch.end.date = null;
                expected_patch.start.date = null;

                this.stub_reply.start = google_start;
                this.stub_reply.end = google_end;

                nock(GCAL_API_BASE_URL)
                    .patch(this.expected_uri, expected_patch)
                    .query(this.expected_query)
                    .reply(200, this.stub_reply);
                return expect(
                    google_actions.patch_event(
                        this.stubs.req,
                        this.stubs.source,
                        this.event_id,
                        event_patch
                    )
                ).to.eventually.deep.equal(this.expected_reply);
            });
            it("eventually returns an event after editing attendees", function() {
                const event_patch = {
                    attendees: [
                        {
                            email: "alice@kin.today"
                        },
                        {
                            email: "bob@kin.today",
                            response_status: "tentative"
                        }
                    ]
                };
                this.expected_reply.attendees = [
                    {
                        email: "alice@kin.today",
                        response_status: "needs_action",
                        self: false
                    },
                    {
                        email: "bob@kin.today",
                        response_status: "tentative",
                        self: false
                    }
                ];

                const expected_patch = {
                    attendees: [
                        {
                            email: "alice@kin.today",
                            responseStatus: "needsAction"
                        },
                        {
                            email: "bob@kin.today",
                            responseStatus: "tentative"
                        }
                    ]
                };
                this.stub_reply.attendees = [
                    {
                        email: "alice@kin.today",
                        responseStatus: "needsAction",
                        self: false
                    },
                    {
                        email: "bob@kin.today",
                        responseStatus: "tentative",
                        self: false
                    }
                ];

                nock(GCAL_API_BASE_URL)
                    .patch(this.expected_uri, expected_patch)
                    .query(this.expected_query)
                    .reply(200, this.stub_reply);
                return expect(
                    google_actions.patch_event(
                        this.stubs.req,
                        this.stubs.source,
                        this.event_id,
                        event_patch
                    )
                ).to.eventually.deep.equal(this.expected_reply);
            });
            it("eventually returns an event after editing reminders", function() {
                const event_patch = {
                    reminders: [
                        {
                            minutes: 1
                        },
                        {
                            minutes: 2
                        }
                    ]
                };
                this.expected_reply.reminders = [
                    {
                        minutes: 1
                    },
                    {
                        minutes: 2
                    }
                ];

                const expected_patch = {
                    reminders: {
                        useDefault: false,
                        overrides: [
                            {
                                minutes: 1,
                                method: "popup"
                            },
                            {
                                minutes: 2,
                                method: "popup"
                            }
                        ]
                    }
                };
                this.stub_reply.reminders = {
                    overrides: [
                        {
                            minutes: 1,
                            method: "popup"
                        },
                        {
                            minutes: 2,
                            method: "popup"
                        }
                    ]
                };

                nock(GCAL_API_BASE_URL)
                    .patch(this.expected_uri, expected_patch)
                    .query(this.expected_query)
                    .reply(200, this.stub_reply);
                return expect(
                    google_actions.patch_event(
                        this.stubs.req,
                        this.stubs.source,
                        this.event_id,
                        event_patch
                    )
                ).to.eventually.deep.equal(this.expected_reply);
            });

            it("throws `KinInvalidFormatError` when not respecting proper format (all-day)", function() {
                const event_patch = {
                    start: {
                        date_time: "2016-10-22"
                    }
                };

                return expect(
                    _.partial(
                        google_actions.patch_event,
                        this.stubs.req,
                        this.stubs.source,
                        this.event_id,
                        event_patch
                    ) // eslint-disable-line comma-dangle
                ).to.throw(errors.KinInvalidFormatError);
            });
            it("throws `KinInvalidFormatError` when not respecting proper format (timed)", function() {
                const event_patch = {
                    start: {
                        date: "2016-10-11T00:00:00Z"
                    }
                };

                return expect(
                    _.partial(
                        google_actions.patch_event,
                        this.stubs.req,
                        this.stubs.source,
                        this.event_id,
                        event_patch
                    ) // eslint-disable-line comma-dangle
                ).to.throw(errors.KinInvalidFormatError);
            });
            // TODO: test Google mixed date / date_time?
            it("throws `KinLimitError` when adding more than 5 unique reminders", function() {
                const event_patch = {
                    reminders: [
                        {
                            minutes: 1
                        },
                        {
                            minutes: 2
                        },
                        {
                            minutes: 3
                        },
                        {
                            minutes: 4
                        },
                        {
                            minutes: 5
                        },
                        {
                            minutes: 6
                        }
                    ]
                };

                return expect(
                    _.partial(
                        google_actions.patch_event,
                        this.stubs.req,
                        this.stubs.source,
                        this.event_id,
                        event_patch
                    ) // eslint-disable-line comma-dangle
                ).to.throw(errors.KinLimitError);
            });

            it("throws `KinLimitError` when setting a >1024 chars title");
            it("throws `KinLimitError` when setting a >1024 chars location");
            it("throws `KinLimitError` when setting a >8196 chars description");

            it("eventually throws `KinTimeRangeEmptyError` when end <= start", function() {
                const event_patch = {
                    start: {
                        date_time: "2016-10-11T00:00:00Z"
                    },
                    end: {
                        date_time: "2016-10-11T00:00:00Z"
                    }
                };
                const expected_patch = {
                    start: {
                        dateTime: "2016-10-11T00:00:00Z"
                    },
                    end: {
                        dateTime: "2016-10-11T00:00:00Z"
                    }
                };
                this.stub_reply = {
                    error: {
                        errors: [
                            {
                                domain: "calendar",
                                reason: "timeRangeEmpty",
                                message: "The specified time range is empty.",
                                locationType: "parameter",
                                location: "timeMax"
                            }
                        ],
                        code: 400,
                        message: "The specified time range is empty."
                    }
                };

                nock(GCAL_API_BASE_URL)
                    .patch(this.expected_uri, expected_patch)
                    .query(this.expected_query)
                    .reply(400, this.stub_reply);
                return expect(
                    google_actions.patch_event(
                        this.stubs.req,
                        this.stubs.source,
                        this.event_id,
                        event_patch
                    )
                ).to.be.rejectedWith(errors.KinTimeRangeEmptyError);
            });
            it("eventually throws `KinInvalidFormatError` when adding an attendee with a bad email (RFC5322)", function() {
                const event_patch = {
                    attendees: [
                        {
                            email: "bob",
                            response_status: "needs_action"
                        }
                    ]
                };
                const expected_patch = {
                    attendees: [
                        {
                            email: "bob",
                            responseStatus: "needsAction"
                        }
                    ]
                };
                this.stub_reply = {
                    error: {
                        errors: [
                            {
                                domain: "global",
                                reason: "invalid",
                                message: "Invalid attendee email."
                            }
                        ],
                        code: 400,
                        message: "Invalid attendee email."
                    }
                };

                nock(GCAL_API_BASE_URL)
                    .patch(this.expected_uri, expected_patch)
                    .query(this.expected_query)
                    .reply(400, this.stub_reply);
                return expect(
                    google_actions.patch_event(
                        this.stubs.req,
                        this.stubs.source,
                        this.event_id,
                        event_patch
                    )
                ).to.be.rejectedWith(errors.KinInvalidFormatError);
            });
        });

        describe("#create_event", function() {
            // https://developers.google.com/google-apps/calendar/v3/reference/events/insert
            beforeEach(function() {
                this.google_layer_id = "abcd";
                this.layer_id = `kin-1234:${this.google_layer_id}`;
                this.expected_uri = `/calendars/${escape(this.google_layer_id)}/events`;
                this.expected_query = {
                    sendNotifications: false
                };
                this.stub_reply = {
                    id: "alpha",
                    summary: "Alpha",
                    start: {
                        date: "2016-10-10"
                    },
                    end: {
                        date: "2016-10-10"
                    }
                };
                this.expected_reply = {
                    id: "kin-1234:abcd:alpha",
                    title: "Alpha",
                    status: "confirmed",
                    start: {
                        date: "2016-10-10"
                    },
                    end: {
                        date: "2016-10-10"
                    },
                    kind: "event#basic",
                    attendees: [],
                    reminders: []
                };
            });

            it("eventually returns an event with only a title", function() {
                const event_patch = {};
                const expected_patch = {};
                const title = "Alpha created";
                event_patch.title = title;
                this.expected_reply.title = title;
                expected_patch.summary = title;
                this.stub_reply.summary = title;

                nock(GCAL_API_BASE_URL)
                    .post(this.expected_uri, expected_patch)
                    .query(this.expected_query)
                    .reply(200, this.stub_reply);
                return expect(
                    google_actions.create_event(
                        this.stubs.req,
                        this.stubs.source,
                        this.layer_id,
                        event_patch
                    )
                ).to.eventually.deep.equal(this.expected_reply);
            });
            it("eventually returns an event with a title, description and location", function() {
                const event_patch = {};
                const expected_patch = {};
                const title = "Alpha created";
                event_patch.title = title;
                this.expected_reply.title = title;
                expected_patch.summary = title;
                this.stub_reply.summary = title;

                const description = "Alpha description";
                event_patch.description = description;
                this.expected_reply.description = description;
                expected_patch.description = description;
                this.stub_reply.description = description;

                const location = "Alpha location";
                event_patch.location = location;
                this.expected_reply.location = location;
                expected_patch.location = location;
                this.stub_reply.location = location;

                nock(GCAL_API_BASE_URL)
                    .post(this.expected_uri, expected_patch)
                    .query(this.expected_query)
                    .reply(200, this.stub_reply);
                return expect(
                    google_actions.create_event(
                        this.stubs.req,
                        this.stubs.source,
                        this.layer_id,
                        event_patch
                    )
                ).to.eventually.deep.equal(this.expected_reply);
            });
            it("eventually returns an event with a title, a start date and an end date (start >= end)", function() {
                const event_patch = {};
                const kin_start = {
                    date_time: "2016-10-11T00:00:00Z"
                };
                const kin_end = {
                    date_time: "2016-10-11T01:00:00Z"
                };
                const google_start = {
                    dateTime: "2016-10-11T00:00:00Z"
                };
                const google_end = {
                    dateTime: "2016-10-11T01:00:00Z"
                };
                event_patch.start = kin_start;
                event_patch.end = kin_end;

                this.expected_reply.start = kin_start;
                this.expected_reply.end = kin_end;

                const expected_patch = {
                    start: google_start,
                    end: google_end
                };
                this.stub_reply.start = google_start;
                this.stub_reply.end = google_end;

                nock(GCAL_API_BASE_URL)
                    .post(this.expected_uri, expected_patch)
                    .query(this.expected_query)
                    .reply(200, this.stub_reply);
                return expect(
                    google_actions.create_event(
                        this.stubs.req,
                        this.stubs.source,
                        this.layer_id,
                        event_patch
                    )
                ).to.eventually.deep.equal(this.expected_reply);
            });
            // TODO: should test more stuff, not a priority, most of the code is
            // already tested via patch tests
        });

        describe("#load_places", function() {
            // https://developers.google.com/places/web-service/query
            //
            // TO MONITOR: currently - no matter the status code returned - we get
            // a `predictions` key in the output, thus the lack of "tests" there.
            it("eventually returns a list of places", function() {
                nock(GPLACES_API_BASE_URL).get("/queryautocomplete/json").query(true).reply(200, {
                    predictions: [
                        {
                            description: "Paris, France"
                        },
                        {
                            description: "Lyon, France"
                        },
                        {
                            description: "Marseille, France"
                        }
                    ]
                });
                return expect(
                    google_actions.load_places(this.stubs.req, this.stubs.source, "france")
                ).to.eventually.deep.equal([
                    {
                        description: "Paris, France"
                    },
                    {
                        description: "Lyon, France"
                    },
                    {
                        description: "Marseille, France"
                    }
                ]);
            });
            it("eventually returns an empty list when the search query is empty", function() {
                return expect(
                    google_actions.load_places(this.stubs.req, this.stubs.source, "")
                ).to.eventually.deep.equal([]);
            });
        });
    });
});
