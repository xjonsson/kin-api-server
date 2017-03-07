/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const chai = require('chai');
const chai_as_promised = require('chai-as-promised');
const nock = require('nock');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const sinon_chai = require('sinon-chai');
const _ = require('lodash');

const errors = require('../../src/api_server/errors');
const { TODOIST_API_BASE_URL, TodoistRequest } = require('../../src/api_server/sources/todoist/base');

const { create_stubs } = require('../stubs');

const cuid_stub = sinon.stub().returns('#RealStringsHaveEntropy');
const todoist_actions = proxyquire('../../src/api_server/sources/todoist/actions', {
    cuid: cuid_stub,
});

const expect = chai.expect;
chai.use(chai_as_promised);
chai.use(sinon_chai);


describe('Todoist', function () {
    beforeEach(function () {
        this.stubs = create_stubs();
        cuid_stub.reset();
    });

    describe('request', function () {
        it('disconnects source when unauthorized', function () {
            const reply = {
                error_tag: 'AUTH_INVALID_TOKEN',
                error_code: 401,
                http_code: 403,
                error_extra: {
                    access_type: 'access_token',
                },
                error: 'Invalid token',
            };
            nock(TODOIST_API_BASE_URL)
                .post('/test')
                .reply(403, reply);
            const req_promise = new TodoistRequest(this.stubs.req, this.stubs.source.id).api('test');
            return expect(req_promise)
                .to.be.rejectedWith(errors.KinDisconnectedSourceError);
        });
    });

    describe('actions', function () {
        describe('#load_layers', function () {
            // https://developer.todoist.com/#projects
            it('eventually returns a list of layers', function () {
                nock(TODOIST_API_BASE_URL)
                    .post('/sync')
                    .reply(200, {
                        projects: [
                            {
                                id: 1234,
                                name: 'ABCD',
                                color: 1,
                            },
                            {
                                id: 5678,
                                name: 'EFGH',
                                color: 10,
                            },
                        ],
                    });

                const promise = todoist_actions.load_layers(this.stubs.req, this.stubs.source);
                return expect(promise)
                    .to.eventually.deep.equal([
                        {
                            id: 'kin-1234:1234',
                            title: 'ABCD',
                            text_color: '#FFFFFF',
                            color: '#ff8581',
                            acl: {
                                edit: true,
                                create: true,
                                delete: true,
                            },
                            selected: false,
                        },
                        {
                            id: 'kin-1234:5678',
                            title: 'EFGH',
                            text_color: '#FFFFFF',
                            color: '#74e8d3',
                            acl: {
                                edit: true,
                                create: true,
                                delete: true,
                            },
                            selected: false,
                        },
                    ]);
            });
        });

        describe('#load_events', function () {
            it('eventually returns a list of events', function () {
                const layer_id = 'kin-1234:1234';
                nock(TODOIST_API_BASE_URL)
                    .post('/sync')
                    .reply(200, {
                        items: [
                            {
                                // Nominal
                                all_day: false,
                                content: 'Alpha',
                                due_date_utc: 'Mon 10 Oct 2016 10:00:00 +0000',
                                id: 112233,
                                project_id: 1234,
                                in_history: 0,
                            },
                            {
                                // No due date, should be filtered
                                content: 'Beta',
                                due_date_utc: null,
                                id: 445566,
                                project_id: 1234,
                                in_history: 0,
                            },
                            {
                                // Wrong project, should be filtered
                                content: 'Gamma',
                                due_date_utc: 'Mon 10 Oct 2016 10:00:00 +0000',
                                id: 778899,
                                project_id: 5678,
                                in_history: 0,
                            },
                            {
                                // All-day
                                all_day: true,
                                content: 'Delta',
                                due_date_utc: 'Mon 10 Oct 2016 10:00:00 +0000',
                                id: 101010,
                                project_id: 1234,
                                in_history: 0,
                            },
                            {
                                // FIXME: No `all-day` parameter as it's undocumented
                                // by Todoist, should defaults to non all-day
                                content: 'Epsilon',
                                due_date_utc: 'Mon 10 Oct 2016 10:00:00 +0000',
                                id: 111111,
                                project_id: 1234,
                                in_history: 0,
                            },
                        ],
                        sync_token: 'nextSuperAwesomeSyncToken',
                    });

                return expect(todoist_actions.load_events(
                    this.stubs.req, this.stubs.source, layer_id)  // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    events: [
                        {
                            id: 'kin-1234:1234:112233',
                            title: 'Alpha',
                            kind: 'event#basic',
                            start: {
                                date_time: '2016-10-10T10:00:00+0000',
                            },
                            end: {
                                date_time: '2016-10-10T11:00:00+0000',
                            },
                            link: 'https://en.todoist.com/app#project%2F1234',
                            status: 'confirmed',
                        },
                        {
                            id: 'kin-1234:1234:101010',
                            title: 'Delta',
                            kind: 'event#basic',
                            start: {
                                date: '2016-10-10',
                            },
                            end: {
                                date: '2016-10-11',
                            },
                            link: 'https://en.todoist.com/app#project%2F1234',
                            status: 'confirmed',
                        },
                        {
                            id: 'kin-1234:1234:111111',
                            title: 'Epsilon',
                            kind: 'event#basic',
                            start: {
                                date_time: '2016-10-10T10:00:00+0000',
                            },
                            end: {
                                date_time: '2016-10-10T11:00:00+0000',
                            },
                            link: 'https://en.todoist.com/app#project%2F1234',
                            status: 'confirmed',
                        },
                    ],
                    next_sync_token: 'nextSuperAwesomeSyncToken',
                    sync_type: 'full',
                });
            });
            it('eventually returns a set of events when providing a sync token', function () {
                this.stubs.req.query.sync_token = 'superAwesomeSyncToken';
                const layer_id = 'kin-1234:1234';
                nock(TODOIST_API_BASE_URL)
                    .post('/sync')
                    .reply(200, {
                        items: [
                            {
                                all_day: false,
                                content: 'Alpha',
                                due_date_utc: 'Mon 10 Oct 2016 10:00:00 +0000',
                                id: 112233,
                                project_id: 1234,
                                in_history: 0,
                            },
                            {
                                // Item is marked as completed
                                all_day: false,
                                content: 'Beta',
                                due_date_utc: 'Mon 11 Oct 2016 10:00:00 +0000',
                                id: 445566,
                                project_id: 1234,
                                in_history: 1,
                            },
                        ],
                        sync_token: 'nextSuperAwesomeSyncToken',
                    });

                return expect(todoist_actions.load_events(
                    this.stubs.req, this.stubs.source, layer_id)  // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    events: [
                        {
                            id: 'kin-1234:1234:112233',
                            title: 'Alpha',
                            kind: 'event#basic',
                            start: {
                                date_time: '2016-10-10T10:00:00+0000',
                            },
                            end: {
                                date_time: '2016-10-10T11:00:00+0000',
                            },
                            link: 'https://en.todoist.com/app#project%2F1234',
                            status: 'confirmed',
                        },
                        {
                            id: 'kin-1234:1234:445566',
                            title: 'Beta',
                            kind: 'event#basic',
                            start: {
                                date_time: '2016-10-11T10:00:00+0000',
                            },
                            end: {
                                date_time: '2016-10-11T11:00:00+0000',
                            },
                            link: 'https://en.todoist.com/app#project%2F1234',
                            status: 'cancelled',
                        },
                    ],
                    next_sync_token: 'nextSuperAwesomeSyncToken',
                    sync_type: 'incremental',
                });
            });
        });

        describe('#patch_event', function () {
            // https://developer.todoist.com/#update-an-item
            beforeEach(function () {
                this.todoist_project_id = 1234;
                this.todoist_item_id = 112233;
                this.event_id = `kin-1234:${this.todoist_project_id}:${this.todoist_item_id}`;
                this.stub_reply = {
                    items: [
                        {
                            all_day: true,
                            content: 'Alpha',
                            due_date_utc: 'Mon 10 Oct 2016 10:00:00 +0000',
                            id: 112233,
                            project_id: 1234,
                            in_history: 0,
                        },
                    ],
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
                    link: 'https://en.todoist.com/app#project%2F1234',
                    status: 'confirmed',
                };
            });

            it('eventually returns an event after editing its title', function () {
                const event_patch = {};
                const expected_body = {
                    token: 'youShallPassAccessToken',
                    resource_types: JSON.stringify(['items']),
                    sync_token: '*',
                    commands: JSON.stringify([
                        {
                            type: 'item_update',
                            uuid: '#RealStringsHaveEntropy',
                            args: {
                                content: 'Alpha edited',
                                id: '112233',
                            },
                        },
                    ]),
                };
                const title = 'Alpha edited';
                event_patch.title = title;
                this.expected_reply.title = title;
                this.stub_reply.items[0].content = 'Alpha edited';

                nock(TODOIST_API_BASE_URL)
                    .post('/sync', expected_body)
                    .reply(200, this.stub_reply);
                return expect(todoist_actions.patch_event(
                    this.stubs.req, this.stubs.source, this.event_id, event_patch))
                    .to.eventually.deep.equal(this.expected_reply);
            });

            it('eventually returns an event after editing its start date (all-day)', function () {
                const event_patch = {
                    start: {
                        date: '2016-10-12',
                    },
                };
                this.expected_reply.start = {
                    date: '2016-10-12',
                };
                this.expected_reply.end = {
                    date: '2016-10-13',
                };

                const expected_body = {
                    token: 'youShallPassAccessToken',
                    resource_types: JSON.stringify(['items']),
                    sync_token: '*',
                    commands: JSON.stringify([
                        {
                            type: 'item_update',
                            uuid: '#RealStringsHaveEntropy',
                            args: {
                                due_date_utc: '2016-10-12T23:59:59',
                                date_string: 'today',
                                id: '112233',
                            },
                        },
                    ]),
                };
                this.stub_reply.items[0].due_date_utc = 'Wed 12 Oct 2016 00:00:00 +0000';

                nock(TODOIST_API_BASE_URL)
                    .post('/sync', expected_body)
                    .reply(200, this.stub_reply);
                return expect(todoist_actions.patch_event(
                    this.stubs.req, this.stubs.source, this.event_id, event_patch))
                    .to.eventually.deep.equal(this.expected_reply);
            });

            it('eventually returns an event after editing its start date (timed)', function () {
                const event_patch = {
                    start: {
                        date_time: '2016-10-12T00:00:00Z',
                    },
                };
                this.expected_reply.start = {
                    date: '2016-10-12',
                };
                this.expected_reply.end = {
                    date: '2016-10-13',
                };

                const expected_body = {
                    token: 'youShallPassAccessToken',
                    resource_types: JSON.stringify(['items']),
                    sync_token: '*',
                    commands: JSON.stringify([
                        {
                            type: 'item_update',
                            uuid: '#RealStringsHaveEntropy',
                            args: {
                                due_date_utc: '2016-10-12T00:00',
                                date_string: 'today',
                                id: '112233',
                            },
                        },
                    ]),
                };
                this.stub_reply.items[0].due_date_utc = 'Wed 12 Oct 2016 00:00:00 +0000';

                nock(TODOIST_API_BASE_URL)
                    .post('/sync', expected_body)
                    .reply(200, this.stub_reply);
                return expect(todoist_actions.patch_event(
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
                    _.partial(todoist_actions.patch_event,
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
                    _.partial(todoist_actions.patch_event,
                        this.stubs.req, this.stubs.source, this.event_id, event_patch) // eslint-disable-line comma-dangle
                ).to.throw(errors.KinInvalidFormatError);
            });

            it('throws `KinLimitError` when setting a >2048 chars title');
        });

        describe('#create_event', function () {
            // TODO
        });

        describe('#delete_event', function () {
            // https://developer.todoist.com/#delete-items
            it('returns a fulfilled promise', function () {
                const todoist_project_id = 1234;
                const todoist_item_id = 112233;

                const event_id = `kin-1234:${todoist_project_id}:${todoist_item_id}`;
                nock(TODOIST_API_BASE_URL)
                    .post('/sync')
                    .reply(204);
                return expect(todoist_actions.delete_event(
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
