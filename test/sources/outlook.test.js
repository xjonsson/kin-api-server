/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const chai = require("chai");
const chai_as_promised = require("chai-as-promised");
const nock = require("nock");
const querystring = require("querystring");

const outlook_actions = require("../../src/api_server/sources/outlook/actions");
const { OUTLOOK_API_BASE_URL } = require("../../src/api_server/sources/outlook/base");

const { create_stubs } = require("../stubs");

const expect = chai.expect;
chai.use(chai_as_promised);

describe("Outlook", function() {
    beforeEach(function() {
        this.stubs = create_stubs();
    });

    describe("request", function() {
        it("disconnects source when unauthorized");
    });

    describe("actions", function() {
        describe("#load_layers", function() {
            it("eventually returns a list of layers", function() {
                nock(OUTLOOK_API_BASE_URL)
                    .get("/me/calendars")
                    .query({
                        $select: "Name,Color",
                        $top: 50
                    })
                    .reply(200, {
                        value: [
                            {
                                Id: "abcd",
                                Name: "ABCD",
                                Color: "LightTeal"
                            },
                            {
                                Id: "efgh",
                                Name: "EFGH",
                                Color: "Auto"
                            }
                        ]
                    });

                const promise = outlook_actions.load_layers(this.stubs.req, this.stubs.source);
                return expect(promise).to.eventually.deep.equal([
                    {
                        id: "kin-1234:abcd",
                        title: "ABCD",
                        color: "#4adacc",
                        text_color: "#FFFFFF",
                        acl: {
                            edit: false,
                            create: false,
                            delete: false
                        },
                        selected: false
                    },
                    {
                        id: "kin-1234:efgh",
                        title: "EFGH",
                        color: "#EB3D01",
                        text_color: "#FFFFFF",
                        acl: {
                            edit: false,
                            create: false,
                            delete: false
                        },
                        selected: false
                    }
                ]);
            });
        });

        describe("#load_events", function() {
            // https://msdn.microsoft.com/en-us/office/office365/api/calendar-rest-operations
            // TODO: need to test more attendees RSVP
            it("eventually returns a list of events", function() {
                const outlook_calendar_id = "abcd";
                const layer_id = `kin-1234:${outlook_calendar_id}`;
                nock(OUTLOOK_API_BASE_URL)
                    .get(`/me/calendars/${querystring.escape(outlook_calendar_id)}/calendarview`)
                    .query(true) // TODO: use proper query params
                    .reply(200, {
                        value: [
                            {
                                Id: "alpha",
                                Subject: "Alpha",
                                Location: {
                                    DisplayName: "Paris, France"
                                },
                                Body: {
                                    ContentType: "Text",
                                    Content: "Alpha description"
                                },
                                IsAllDay: true,
                                Start: {
                                    DateTime: "2016-10-10T10:00:00",
                                    TimeZone: "Europe/Paris"
                                },
                                End: {
                                    DateTime: "2016-10-10T11:00:00",
                                    TimeZone: "Europe/Paris"
                                },
                                Attendees: [
                                    {
                                        EmailAddress: {
                                            Address: "bob@kin.today"
                                        },
                                        Status: {
                                            Response: "TentativelyAccepted" // None, Organizer, TentativelyAccepted, Accepted, Declined, NotResponded.
                                        }
                                    }
                                ],
                                IsReminderOn: true,
                                ReminderMinutesBeforeStart: 10,
                                WebLink:
                                    "https://outlook.office.com/owa/WithAWayTooLongURIForTheGoodOfThePlanet"
                            },
                            {
                                Id: "beta",
                                Subject: "Beta",
                                IsAllDay: false,
                                Start: {
                                    DateTime: "2016-10-10T10:00:00",
                                    TimeZone: "Europe/London"
                                },
                                End: {
                                    DateTime: "2016-10-10T11:00:00",
                                    TimeZone: "America/New_York"
                                },
                                WebLink:
                                    "https://outlook.office.com/owa/WithAWayTooLongURIForTheGoodOfThePlanet"
                            }
                        ]
                    });

                return expect(
                    outlook_actions.load_events(this.stubs.req, this.stubs.source, layer_id) // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    events: [
                        {
                            id: "kin-1234:abcd:alpha",
                            title: "Alpha",
                            location: "Paris, France",
                            description: "Alpha description",
                            attendees: [
                                {
                                    email: "bob@kin.today",
                                    response_status: "tentative",
                                    self: false
                                }
                            ],
                            reminders: [
                                {
                                    minutes: 10
                                }
                            ],
                            kind: "event#basic",
                            start: {
                                date: "2016-10-10",
                                timezone: "Europe/Paris"
                            },
                            end: {
                                date: "2016-10-10",
                                timezone: "Europe/Paris"
                            },
                            link:
                                "https://outlook.office.com/owa/WithAWayTooLongURIForTheGoodOfThePlanet"
                        },
                        {
                            id: "kin-1234:abcd:beta",
                            title: "Beta",
                            kind: "event#basic",
                            start: {
                                date_time: "2016-10-10T10:00:00Z",
                                timezone: "Europe/London"
                            },
                            end: {
                                date_time: "2016-10-10T11:00:00Z",
                                timezone: "America/New_York"
                            },
                            attendees: [],
                            reminders: [],
                            link:
                                "https://outlook.office.com/owa/WithAWayTooLongURIForTheGoodOfThePlanet"
                        }
                    ]
                });
            });
            it("eventually returns a list of events, using pagination", function() {
                const outlook_calendar_id = "abcd";
                const layer_id = `kin-1234:${outlook_calendar_id}`;
                nock(OUTLOOK_API_BASE_URL)
                    .get(`/me/calendars/${querystring.escape(outlook_calendar_id)}/calendarview`)
                    .query(function(query) {
                        return query.$skip === "0";
                    })
                    .reply(200, {
                        value: [
                            {
                                Id: "alpha",
                                Subject: "Alpha",
                                IsAllDay: true,
                                Start: {
                                    DateTime: "2016-10-10T10:00:00",
                                    TimeZone: "Europe/Paris"
                                },
                                End: {
                                    DateTime: "2016-10-10T11:00:00",
                                    TimeZone: "Europe/Paris"
                                },
                                WebLink:
                                    "https://outlook.office.com/owa/WithAWayTooLongURIForTheGoodOfThePlanet"
                            }
                        ],
                        "@odata.nextLink": "https://outlook.office.com/nextLink"
                    });

                nock(OUTLOOK_API_BASE_URL)
                    .get(`/me/calendars/${querystring.escape(outlook_calendar_id)}/calendarview`)
                    .query(function(query) {
                        return query.$skip !== "0";
                    })
                    .reply(200, {
                        value: [
                            {
                                Id: "beta",
                                Subject: "Beta",
                                IsAllDay: true,
                                Start: {
                                    DateTime: "2016-10-11T10:00:00",
                                    TimeZone: "Europe/Paris"
                                },
                                End: {
                                    DateTime: "2016-10-11T11:00:00",
                                    TimeZone: "Europe/Paris"
                                },
                                WebLink:
                                    "https://outlook.office.com/owa/WithAWayTooLongURIForTheGoodOfThePlanet"
                            }
                        ]
                    });

                return expect(
                    outlook_actions.load_events(this.stubs.req, this.stubs.source, layer_id) // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    events: [
                        {
                            id: "kin-1234:abcd:alpha",
                            title: "Alpha",
                            kind: "event#basic",
                            start: {
                                date: "2016-10-10",
                                timezone: "Europe/Paris"
                            },
                            end: {
                                date: "2016-10-10",
                                timezone: "Europe/Paris"
                            },
                            attendees: [],
                            reminders: [],
                            link:
                                "https://outlook.office.com/owa/WithAWayTooLongURIForTheGoodOfThePlanet"
                        },
                        {
                            id: "kin-1234:abcd:beta",
                            title: "Beta",
                            kind: "event#basic",
                            start: {
                                date: "2016-10-11",
                                timezone: "Europe/Paris"
                            },
                            end: {
                                date: "2016-10-11",
                                timezone: "Europe/Paris"
                            },
                            attendees: [],
                            reminders: [],
                            link:
                                "https://outlook.office.com/owa/WithAWayTooLongURIForTheGoodOfThePlanet"
                        }
                    ]
                });
            });
            it("eventually throws if the calendar is not found");
        });
    });

    afterEach(function() {
        // Make sure we don't leak nock interceptors to the next test
        nock.cleanAll();
    });
});
