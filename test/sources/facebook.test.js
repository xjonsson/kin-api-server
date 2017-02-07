/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const chai = require('chai');
const chai_as_promised = require('chai-as-promised');
const nock = require('nock');
const _ = require('lodash');

const errors = require('../../src/api_server/errors');
const facebook_actions = require('../../src/api_server/sources/facebook/actions');
const { FACEBOOK_API_BASE_URL, FacebookRequest } = require('../../src/api_server/sources/facebook/base');

const { create_stubs } = require('../stubs');

const expect = chai.expect;
chai.use(chai_as_promised);


describe('Facebook', function () {
    beforeEach(function () {
        this.stubs = create_stubs();
    });

    describe('request', function () {
        it('disconnects source when unauthorized', function () {
            // TODO: need to test other OAuth issues
            const stub_reply = {
                error: {
                    message: 'The access token could not be decrypted',
                    type: 'OAuthException',
                    code: 190,
                    fbtrace_id: 'superRandomID',
                },
            };

            nock(FACEBOOK_API_BASE_URL)
                .get('/test')
                .query(true)
                .reply(401, stub_reply);

            const req_promise = new FacebookRequest(this.stubs.req, this.stubs.source.id).api('test', {}, 0);
            return expect(req_promise)
                .to.be.rejectedWith(errors.KinDisconnectedSourceError);
        });
    });

    describe('actions', function () {
        describe('#load_layers', function () {
            it('eventually returns a list of layers', function () {
                const promise = facebook_actions.load_layers(this.stubs.req, this.stubs.source);
                return expect(promise)
                    .to.eventually.deep.equal([
                        {
                            id: 'kin-1234:events_attending',
                            title: 'Attending',
                            color: '#3B5998',
                            text_color: '#FFFFFF',
                            acl: {
                                edit: false,
                                create: false,
                                delete: false,
                            },
                            selected: true,
                        },
                        {
                            id: 'kin-1234:events_tentative',
                            title: 'Maybe / Interested',
                            color: '#3B5998',
                            text_color: '#FFFFFF',
                            acl: {
                                edit: false,
                                create: false,
                                delete: false,
                            },
                            selected: true,
                        },
                        {
                            id: 'kin-1234:events_not_replied',
                            title: 'Not Replied ',
                            color: '#3B5998',
                            text_color: '#FFFFFF',
                            acl: {
                                edit: false,
                                create: false,
                                delete: false,
                            },
                            selected: false,
                        },
                        {
                            id: 'kin-1234:events_created',
                            title: 'Created',
                            color: '#3B5998',
                            text_color: '#FFFFFF',
                            acl: {
                                edit: false,
                                create: false,
                                delete: false,
                            },
                            selected: false,
                        },
                        {
                            id: 'kin-1234:events_declined',
                            title: 'Declined',
                            color: '#3B5998',
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
            // https://developers.facebook.com/docs/graph-api/reference/user/events/
            // https://developers.facebook.com/docs/graph-api/reference/event/
            it('eventually returns a list of events', function () {
                const layer_id = 'kin-1234:events_attending';
                nock(FACEBOOK_API_BASE_URL)
                    .get('/me/events')
                    .query(true)
                    .reply(200, {
                        data: [
                            {
                                id: 'alpha',
                                name: 'alpha title',
                                description: 'alpha description',
                                start_time: '2016-10-10T13:37:00+0000',
                                end_time: '2016-10-10T14:37:00+0000',
                                place: {
                                    name: 'Paris, France',
                                },
                            },
                            {
                                id: 'beta',
                                description: 'beta has no title / no location / no end',
                                start_time: '2016-10-11T13:37:00+0000',
                            },
                            {
                                id: 'gamma',
                                name: 'gamma is for no procrastination',
                                end_time: '2016-10-12T13:37:00+0000',
                            },
                            {
                                // Can we make one without anything?
                                id: 'delta',
                            },
                        ],
                    });

                return expect(facebook_actions.load_events(
                    this.stubs.req, this.stubs.source, layer_id) // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    events: [
                        {
                            id: 'kin-1234:events_attending:alpha',
                            title: 'alpha title',
                            description: 'alpha description',
                            location: 'Paris, France',
                            kind: 'event#basic',
                            link: 'https://www.facebook.com/events/alpha',
                            start: {
                                date_time: '2016-10-10T13:37:00Z',
                            },
                            end: {
                                date_time: '2016-10-10T14:37:00Z',
                            },
                        },
                        {
                            id: 'kin-1234:events_attending:beta',
                            description: 'beta has no title / no location / no end',
                            kind: 'event#basic',
                            link: 'https://www.facebook.com/events/beta',
                            start: {
                                date_time: '2016-10-11T13:37:00Z',
                            },
                        },
                        {
                            id: 'kin-1234:events_attending:gamma',
                            title: 'gamma is for no procrastination',
                            kind: 'event#basic',
                            link: 'https://www.facebook.com/events/gamma',
                            end: {
                                date_time: '2016-10-12T13:37:00Z',
                            },
                        },
                        {
                            id: 'kin-1234:events_attending:delta',
                            kind: 'event#basic',
                            link: 'https://www.facebook.com/events/delta',
                        },
                    ],
                });
            });
            it('eventually returns a list of events, using pagination', function () {
                const layer_id = 'kin-1234:events_attending';
                nock(FACEBOOK_API_BASE_URL)
                    .get('/me/events')
                    .query(function (query) {
                        return _.isEmpty(query.after);
                    })
                    .reply(200, {
                        data: [
                            {
                                id: 'alpha',
                            },
                        ],
                        paging: {
                            cursors: {
                                after: 'nextCursor',
                            },
                        },
                    });

                nock(FACEBOOK_API_BASE_URL)
                    .get('/me/events')
                    .query(function (query) {
                        return !_.isEmpty(query.after) && query.after === 'nextCursor';
                    })
                    .reply(200, {
                        data: [
                            {
                                id: 'beta',
                            },
                        ],
                    });

                return expect(facebook_actions.load_events(
                    this.stubs.req, this.stubs.source, layer_id) // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    events: [
                        {
                            id: 'kin-1234:events_attending:alpha',
                            kind: 'event#basic',
                            link: 'https://www.facebook.com/events/alpha',
                        },
                        {
                            id: 'kin-1234:events_attending:beta',
                            kind: 'event#basic',
                            link: 'https://www.facebook.com/events/beta',
                        },
                    ],
                });
            });
        });

        describe('#patch_event', function () {
            // This seems to use undocumented behaviors in recent Graph APIs
            it('eventually returns an event, with updated RSVP');
            // TODO: add tests error-ing when updating something else from the events?
        });
    });

    afterEach(function () {
        // Make sure we don't leak nock interceptors to the next test
        nock.cleanAll();
    });
});
