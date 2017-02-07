/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const chai = require('chai');
const chai_as_promised = require('chai-as-promised');
const nock = require('nock');

const errors = require('../../src/api_server/errors');
const eventbrite_actions = require('../../src/api_server/sources/eventbrite/actions');
const { EVENTBRITE_API_BASE_URL, EventbriteRequest } = require('../../src/api_server/sources/eventbrite/base');

const { create_stubs } = require('../stubs');

const expect = chai.expect;
chai.use(chai_as_promised);


describe('Eventbrite', function () {
    beforeEach(function () {
        this.stubs = create_stubs();
    });

    describe('request', function () {
        it('disconnects source when unauthorized', function () {
            const stub_reply = {
                status_code: 401,
                error_description: 'The OAuth token you provided was invalid.',
                error: 'INVALID_AUTH',
            };

            nock(EVENTBRITE_API_BASE_URL)
                .get('/test')
                .reply(401, stub_reply);

            const req_promise = new EventbriteRequest(this.stubs.req, this.stubs.source.id).api('test');
            return expect(req_promise)
                .to.be.rejectedWith(errors.KinDisconnectedSourceError);
        });
    });

    describe('actions', function () {
        describe('#load_layers', function () {
            // https://developer.eventbrite.com/documentation/endpoints/list
            it('eventually returns a list of layers', function () {
                const promise = eventbrite_actions.load_layers(this.stubs.req, this.stubs.source);
                return expect(promise)
                    .to.eventually.deep.equal([
                        {
                            id: 'kin-1234:events_attending',
                            title: 'Events I\'m attending',
                            color: '#FF8400',
                            text_color: '#FFFFFF',
                            acl: {
                                edit: false,
                                create: false,
                                delete: false,
                            },
                            selected: true,
                        },
                        {
                            id: 'kin-1234:events_organizing',
                            title: 'Events I\'m organizing',
                            color: '#FF8400',
                            text_color: '#FFFFFF',
                            acl: {
                                edit: false,
                                create: false,
                                delete: false,
                            },
                            selected: false,
                        },
                    ]);
            });
        });

        describe('#load_events', function () {
            // https://www.eventbrite.com/developer/v3/endpoints/users/#ebapi-get-users-id-events
            // https://www.eventbrite.com/developer/v3/endpoints/users/#ebapi-get-users-id-orders
            // https://www.eventbrite.com/developer/v3/formats/event/#ebapi-std:format-event
            it('eventually returns a list of events (Events I\'m attending)', function () {
                const layer_id = 'kin-1234:events_attending';
                nock(EVENTBRITE_API_BASE_URL)
                    .get('/users/me/orders')
                    .query({
                        expand: 'event',
                    })
                    .reply(200, {
                        orders: [
                            {
                                event: {
                                    id: 'alpha',
                                    name: {
                                        text: 'Alpha',
                                    },
                                    description: {
                                        text: 'Alpha description',
                                    },
                                    url: 'https://www.eventbrite.com/e/alpha-alpha',
                                    status: 'live', // canceled, live, started, ended, completed, draft
                                    start: {
                                        local: '2016-10-10T08:00:00',
                                        timezone: 'Europe/Paris',
                                    },
                                    end: {
                                        local: '2016-10-10T10:00:00',
                                        timezone: 'Europe/Paris',
                                    },
                                },
                            },
                            {
                                event: {
                                    id: 'beta',
                                    name: {
                                        text: 'Beta',
                                    },
                                    url: 'https://www.eventbrite.com/e/beta-beta',
                                    status: 'draft', // canceled, live, started, ended, completed, draft
                                    start: {
                                        local: '2016-10-11T08:00:00',
                                        timezone: 'Europe/Paris',
                                    },
                                    end: {
                                        local: '2016-10-11T10:00:00',
                                        timezone: 'America/New_York',
                                    },
                                },
                            },
                        ],
                    });

                return expect(eventbrite_actions.load_events(
                    this.stubs.req, this.stubs.source, layer_id) // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    events: [
                        {
                            id: 'kin-1234:events_attending:alpha',
                            title: 'Alpha',
                            description: 'Alpha description',
                            status: 'confirmed',
                            kind: 'event#basic',
                            link: 'https://www.eventbrite.com/e/alpha-alpha',
                            start: {
                                date_time: '2016-10-10T08:00:00+02:00',
                                timezone: 'Europe/Paris',
                            },
                            end: {
                                date_time: '2016-10-10T10:00:00+02:00',
                                timezone: 'Europe/Paris',
                            },
                        },
                        {
                            id: 'kin-1234:events_attending:beta',
                            title: 'Beta',
                            status: 'tentative',
                            kind: 'event#basic',
                            link: 'https://www.eventbrite.com/e/beta-beta',
                            start: {
                                date_time: '2016-10-11T08:00:00+02:00',
                                timezone: 'Europe/Paris',
                            },
                            end: {
                                date_time: '2016-10-11T10:00:00-04:00',
                                timezone: 'America/New_York',
                            },
                        },
                    ],
                });
            });
            it('eventually returns a list of events (Events I\'m organizing)', function () {
                const layer_id = 'kin-1234:events_organizing';
                nock(EVENTBRITE_API_BASE_URL)
                    .get('/users/me/events')
                    .reply(200, {
                        events: [
                            {
                                id: 'alpha',
                                name: {
                                    text: 'Alpha',
                                },
                                description: {
                                    text: 'Alpha description',
                                },
                                url: 'https://www.eventbrite.com/e/alpha-alpha',
                                status: 'started', // canceled, live, started, ended, completed, draft
                                start: {
                                    local: '2016-10-10T08:00:00',
                                    timezone: 'Europe/London',
                                },
                                end: {
                                    local: '2016-10-10T10:00:00',
                                    timezone: 'Europe/London',
                                },
                            },
                            {
                                id: 'beta',
                                name: {
                                    text: 'Beta',
                                },
                                url: 'https://www.eventbrite.com/e/beta-beta',
                                status: 'ended', // canceled, live, started, ended, completed, draft
                                start: {
                                    local: '2016-10-11T08:00:00',
                                    timezone: 'Europe/Paris',
                                },
                                end: {
                                    local: '2016-10-11T10:00:00',
                                    timezone: 'Europe/Paris',
                                },
                            },
                        ],
                    });

                return expect(eventbrite_actions.load_events(
                    this.stubs.req, this.stubs.source, layer_id) // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    events: [
                        {
                            id: 'kin-1234:events_organizing:alpha',
                            title: 'Alpha',
                            description: 'Alpha description',
                            status: 'confirmed',
                            kind: 'event#basic',
                            link: 'https://www.eventbrite.com/e/alpha-alpha',
                            start: {
                                date_time: '2016-10-10T08:00:00+01:00',
                                timezone: 'Europe/London',
                            },
                            end: {
                                date_time: '2016-10-10T10:00:00+01:00',
                                timezone: 'Europe/London',
                            },
                        },
                        {
                            id: 'kin-1234:events_organizing:beta',
                            title: 'Beta',
                            status: 'confirmed',
                            kind: 'event#basic',
                            link: 'https://www.eventbrite.com/e/beta-beta',
                            start: {
                                date_time: '2016-10-11T08:00:00+02:00',
                                timezone: 'Europe/Paris',
                            },
                            end: {
                                date_time: '2016-10-11T10:00:00+02:00',
                                timezone: 'Europe/Paris',
                            },
                        },
                    ],
                });
            });
        });
    });

    afterEach(function () {
        // Make sure we don't leak nock interceptors to the next test
        nock.cleanAll();
    });
});
