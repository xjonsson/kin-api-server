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
const wunderlist_actions = require('../../src/api_server/sources/wunderlist/actions');
const { WUNDERLIST_API_BASE_URL, WunderlistRequest } = require('../../src/api_server/sources/wunderlist/base');

const { create_stubs } = require('../stubs');

const expect = chai.expect;
chai.use(chai_as_promised);


describe('Wunderlist', function () {
    beforeEach(function () {
        this.stubs = create_stubs();
    });

    describe('request', function () {
        it('disconnects source when unauthorized', function () {
            const stub_reply = {
                error: {
                    type: 'unauthorized',
                    translation_key: 'api_error_unauthorized',
                    message: 'You are not authorized.',
                },
            };
            nock(WUNDERLIST_API_BASE_URL)
                .get('/test')
                .reply(401, stub_reply);

            const req_promise = new WunderlistRequest(this.stubs.req, this.stubs.source.id).api('test');
            return expect(req_promise)
                .to.be.rejectedWith(errors.KinDisconnectedSourceError);
        });
    });

    describe('actions', function () {
        describe('#load_layers', function () {
            // https://developer.wunderlist.com/documentation/endpoints/list
            it('eventually returns a list of layers', function () {
                nock(WUNDERLIST_API_BASE_URL)
                    .get('/lists')
                    .reply(200, [
                        {
                            id: 'abcd',
                            title: 'ABCD',
                        },
                        {
                            id: 'efgh',
                            title: 'EFGH',
                        },
                    ]);

                const promise = wunderlist_actions.load_layers(this.stubs.req, this.stubs.source);
                return expect(promise)
                    .to.eventually.deep.equal([
                        {
                            id: 'kin-1234:abcd',
                            title: 'ABCD',
                            color: '#E84228',
                            text_color: '#FFFFFF',
                            acl: {
                                edit: true,
                                create: true,
                                delete: true,
                            },
                            selected: true,
                        },
                        {
                            id: 'kin-1234:efgh',
                            title: 'EFGH',
                            color: '#E84228',
                            text_color: '#FFFFFF',
                            acl: {
                                edit: true,
                                create: true,
                                delete: true,
                            },
                            selected: true,
                        },
                    ]);
            });
        });

        describe('#load_events', function () {
            // https://developer.wunderlist.com/documentation/endpoints/task
            it('eventually returns a list of events', function () {
                const wunderlist_list_id = 'abcd';
                const layer_id = `kin-1234:${wunderlist_list_id}`;
                nock(WUNDERLIST_API_BASE_URL)
                    .get('/tasks')
                    .query(true)
                    .reply(200, [
                        {
                            id: 'alpha',
                            due_date: '2016-10-10',
                            title: 'Alpha',
                            revision: 1,
                        },
                        {
                            id: 'beta',
                            due_date: '2016-10-11',
                            revision: 2,
                        },
                        {
                            id: 'gamma',
                            title: 'Gamma',
                            revision: 2,
                        },
                    ]);

                return expect(wunderlist_actions.load_events(
                    this.stubs.req, this.stubs.source, layer_id) // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    events: [
                        {
                            id: 'kin-1234:abcd:alpha',
                            title: 'Alpha',
                            kind: 'event#basic',
                            start: {
                                date: '2016-10-10',
                            },
                            end: {
                                date: '2016-10-11',
                            },
                            etag: 1,
                        },
                        {
                            id: 'kin-1234:abcd:beta',
                            kind: 'event#basic',
                            start: {
                                date: '2016-10-11',
                            },
                            end: {
                                date: '2016-10-12',
                            },
                            etag: 2,
                        },
                        // Gamma should not be there, filtered
                    ],
                });
            });

            it('eventually throws a `KinLayerNotFoundError` when the list is not found', function () {
                const wunderlist_list_id = 'notFound';
                const layer_id = `kin-1234:${wunderlist_list_id}`;
                const stub_reply = {
                    error: {
                        type: 'not_found',
                        translation_key: 'api_error_not_found',
                        message: 'The resource you requested could not be found.',
                    },
                };
                nock(WUNDERLIST_API_BASE_URL)
                    .get('/tasks')
                    .query(true)
                    .reply(404, stub_reply);

                return expect(wunderlist_actions.load_events(
                    this.stubs.req, this.stubs.source, layer_id) // eslint-disable-line comma-dangle
                ).to.be.rejectedWith(errors.KinLayerNotFoundError);
            });

            it('eventually throws a `KinLayerNotFoundError` when the user has restricted access to a list', function () {
                const wunderlist_list_id = 'notFound';
                const layer_id = `kin-1234:${wunderlist_list_id}`;
                const stub_reply = {
                    error: {
                        type: 'permission_error',
                        translation_key: 'api_error_permission_error',
                        message: 'You\'ve not enough permissions.',
                        permissions: 'failed',
                    },
                };
                nock(WUNDERLIST_API_BASE_URL)
                    .get('/tasks')
                    .query(true)
                    .reply(404, stub_reply);

                return expect(wunderlist_actions.load_events(
                    this.stubs.req, this.stubs.source, layer_id) // eslint-disable-line comma-dangle
                ).to.be.rejectedWith(errors.KinLayerNotFoundError);
            });
        });

        describe('#patch_event', function () {
            // https://developer.wunderlist.com/documentation/endpoints/task
            beforeEach(function () {
                this.wunderlist_list_id = 1234;
                this.wunderlist_task_id = 112233;
                this.event_id = `kin-1234:${this.wunderlist_list_id}:${this.wunderlist_task_id}`;
                this.expected_uri = `/tasks/${this.wunderlist_task_id}`;
                this.stub_reply = {
                    id: 112233,
                    project_id: 1234,
                    due_date: '2016-10-10',
                    title: 'Alpha',
                    revision: 2,
                };
                this.expected_reply = {
                    id: 'kin-1234:1234:112233',
                    title: 'Alpha',
                    start: {
                        date: '2016-10-10',
                    },
                    end: {
                        date: '2016-10-11',
                    },
                    kind: 'event#basic',
                    etag: 2,
                };
            });

            it('eventually returns an event after editing its title', function () {
                const event_patch = {
                    etag: 1,
                };
                const expected_patch = {
                    revision: 1,
                };
                const title = 'Alpha edited';
                expected_patch.title = title;
                this.stub_reply.title = title;
                event_patch.title = title;
                this.expected_reply.title = title;

                nock(WUNDERLIST_API_BASE_URL)
                    .patch(this.expected_uri, expected_patch)
                    .reply(200, this.stub_reply);
                return expect(wunderlist_actions.patch_event(
                    this.stubs.req, this.stubs.source, this.event_id, event_patch))
                    .to.eventually.deep.equal(this.expected_reply);
            });

            it('eventually returns an event after editing its start date (all-day)', function () {
                const event_patch = {
                    start: {
                        date: '2016-10-12',
                    },
                    etag: 1,
                };
                this.expected_reply.start = {
                    date: '2016-10-12',
                };
                this.expected_reply.end = {
                    date: '2016-10-13',
                };

                const expected_patch = {
                    due_date: '2016-10-12',
                    revision: 1,
                };
                this.stub_reply.due_date = '2016-10-12';

                nock(WUNDERLIST_API_BASE_URL)
                    .patch(this.expected_uri, expected_patch)
                    .reply(200, this.stub_reply);
                return expect(wunderlist_actions.patch_event(
                    this.stubs.req, this.stubs.source, this.event_id, event_patch))
                    .to.eventually.deep.equal(this.expected_reply);
            });

            it('eventually returns an event after editing its start date (timed)', function () {
                const event_patch = {
                    start: {
                        date_time: '2016-10-12T00:00:00Z',
                    },
                    etag: 1,
                };
                this.expected_reply.start = {
                    date: '2016-10-12',
                };
                this.expected_reply.end = {
                    date: '2016-10-13',
                };

                const expected_patch = {
                    due_date: '2016-10-12',
                    revision: 1,
                };
                this.stub_reply.due_date = '2016-10-12';

                nock(WUNDERLIST_API_BASE_URL)
                    .patch(this.expected_uri, expected_patch)
                    .reply(200, this.stub_reply);
                return expect(wunderlist_actions.patch_event(
                    this.stubs.req, this.stubs.source, this.event_id, event_patch))
                    .to.eventually.deep.equal(this.expected_reply);
            });

            it('throws `KinInvalidFormatError` when not respecting proper format (all-day)', function () {
                const event_patch = {
                    start: {
                        date_time: '2016-10-22',
                    },
                };

                return expect(
                    _.partial(wunderlist_actions.patch_event,
                        this.stubs.req, this.stubs.source, this.event_id, event_patch) // eslint-disable-line comma-dangle
                ).to.throw(errors.KinInvalidFormatError);
            });

            it('throws `KinInvalidFormatError` when not respecting proper format (timed)', function () {
                const event_patch = {
                    start: {
                        date: '2016-10-11T00:00:00Z',
                    },
                };

                return expect(
                    _.partial(wunderlist_actions.patch_event,
                        this.stubs.req, this.stubs.source, this.event_id, event_patch) // eslint-disable-line comma-dangle
                ).to.throw(errors.KinInvalidFormatError);
            });

            // TODO: test limits on chars, max dates, min dates ...
        });

        describe('#create_event', function () {
            // https://developer.wunderlist.com/documentation/endpoints/task
            // TODO
        });

        describe('#delete_event', function () {
            // https://developer.wunderlist.com/documentation/endpoints/task
            it('returns a fulfilled promise', function () {
                const wunderlist_list_id = 1234;
                const wunderlist_task_id = 112233;
                const event_id = `kin-1234:${wunderlist_list_id}:${wunderlist_task_id}`;
                nock(WUNDERLIST_API_BASE_URL)
                    .delete(`/tasks/${wunderlist_task_id}`)
                    .query({
                        revision: 1, // etag
                    })
                    .reply(204);
                this.stubs.req.body = {
                    etag: 1,
                };

                return expect(wunderlist_actions.delete_event(
                    this.stubs.req, this.stubs.source, event_id) // eslint-disable-line comma-dangle
                ).to.eventually.be.fulfilled;
            });
        });
    });

    afterEach(function () {
        // Make sure we don't leak nock interceptors to the next test
        nock.cleanAll();
    });
});
