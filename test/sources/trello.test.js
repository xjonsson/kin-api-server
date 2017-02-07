/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const chai = require('chai');
const chai_as_promised = require('chai-as-promised');
const nock = require('nock');
const querystring = require('querystring');

const errors = require('../../src/api_server/errors');
const trello_actions = require('../../src/api_server/sources/trello/actions');
const { TRELLO_API_BASE_URL, TrelloRequest } = require('../../src/api_server/sources/trello/base');

const { create_stubs } = require('../stubs');

const expect = chai.expect;
chai.use(chai_as_promised);


describe('Trello', function () {
    beforeEach(function () {
        this.stubs = create_stubs();
    });

    describe('request', function () {
        it('disconnects source when unauthorized', function () {
            nock(TRELLO_API_BASE_URL)
                .get('/test')
                .query(true)
                .reply(401, 'invalid token');
            const req_promise = new TrelloRequest(this.stubs.req, this.stubs.source.id).api('test');
            return expect(req_promise)
                .to.be.rejectedWith(errors.KinDisconnectedSourceError);
        });
    });

    describe('actions', function () {
        describe('#load_layers', function () {
            // https://developers.trello.com/advanced-reference/board
            it('eventually returns a list of layers', function () {
                nock(TRELLO_API_BASE_URL)
                    .get('/members/me/boards')
                    .query(true)
                    .reply(200, [
                        {
                            id: 'abcd',
                            name: 'ABCD',
                            desc: 'ABCD description',
                            prefs: {
                                backgroundColor: '#0079BF',
                            },
                        },
                        {
                            id: 'efgh',
                            name: 'EFGH',
                        },
                    ]);

                const promise = trello_actions.load_layers(this.stubs.req, this.stubs.source);
                return expect(promise)
                    .to.eventually.deep.equal([
                        {
                            id: 'kin-1234:kin_my_cards',
                            title: 'My Cards',
                            text_color: '#FFFFFF',
                            color: '#026AA7',
                            acl: {
                                edit: true,
                                create: false,
                                delete: true,
                            },
                            selected: true,
                        },
                        {
                            id: 'kin-1234:abcd',
                            title: 'ABCD',
                            color: '#0079BF',
                            text_color: '#FFFFFF',
                            acl: {
                                edit: true,
                                create: false,
                                delete: true,
                            },
                            selected: false,
                        },
                        {
                            id: 'kin-1234:efgh',
                            title: 'EFGH',
                            color: '#026AA7',
                            text_color: '#FFFFFF',
                            acl: {
                                edit: true,
                                create: false,
                                delete: true,
                            },
                            selected: false,
                        },
                    ]);
            });
        });

        describe('#load_events', function () {
            it('eventually returns a list of events (from my cards)', function () {
                const layer_id = 'kin-1234:kin_my_cards';
                nock(TRELLO_API_BASE_URL)
                    .get('/members/me/cards')
                    .query(true)
                    .reply(200, [
                        {
                            id: 'alpha',
                            name: 'Alpha',
                            desc: 'Alpha description',
                            due: '2016-10-10T00:00:00.000Z',
                            url: 'https://trello.com/c/alpha/alpha',
                        },
                        {
                            id: 'beta',
                            name: 'Beta',
                            desc: 'Beta has no due date',
                            url: 'https://trello.com/c/beta/beta',
                        },
                    ]);

                return expect(trello_actions.load_events(
                    this.stubs.req, this.stubs.source, layer_id)  // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    events: [
                        {
                            id: 'kin-1234:kin_my_cards:alpha',
                            title: 'Alpha',
                            description: 'Alpha description',
                            kind: 'event#basic',
                            link: 'https://trello.com/c/alpha/alpha',
                            start: {
                                date_time: '2016-10-10T00:00:00Z',
                            },
                            end: {
                                date_time: '2016-10-10T00:00:00Z',
                            },
                        },
                        // Beta should not be there ;)
                    ],
                });
            });

            // https://developers.trello.com/advanced-reference/card
            it('eventually returns a list of events (from board)', function () {
                const trello_board_id = 'abcd';
                const layer_id = `kin-1234:${trello_board_id}`;
                nock(TRELLO_API_BASE_URL)
                    .get(`/boards/${trello_board_id}/cards`)
                    .query(true)
                    .reply(200, [
                        {
                            id: 'alpha',
                            name: 'Alpha',
                            desc: 'Alpha description',
                            due: '2016-10-10T00:00:00.000Z',
                            url: 'https://trello.com/c/alpha/alpha',
                        },
                        {
                            id: 'beta',
                            name: 'Beta',
                            desc: 'Beta has no due date',
                            url: 'https://trello.com/c/beta/beta',
                        },
                    ]);

                return expect(trello_actions.load_events(
                    this.stubs.req, this.stubs.source, layer_id)  // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    events: [
                        {
                            id: 'kin-1234:abcd:alpha',
                            title: 'Alpha',
                            description: 'Alpha description',
                            kind: 'event#basic',
                            link: 'https://trello.com/c/alpha/alpha',
                            start: {
                                date_time: '2016-10-10T00:00:00Z',
                            },
                            end: {
                                date_time: '2016-10-10T00:00:00Z',
                            },
                        },
                        // Beta should not be there ;)
                    ],
                });
            });
        });

        describe('#patch_event', function () {
            // https://developers.trello.com/advanced-reference/card#put-1-cards-card-id-or-shortlink
            it('eventually returns an event after editing title and description', function () {
                const trello_board_id = 'abcd';
                const trello_card_id = 'alpha';
                const event_id = `kin-1234:${trello_board_id}:${trello_card_id}`;
                const event_patch = {
                    title: 'Alpha edited',
                    description: 'Alpha description edited',
                };

                nock(TRELLO_API_BASE_URL)
                    .put(`/cards/${querystring.escape(trello_card_id)}`, {
                        name: 'Alpha edited',
                        desc: 'Alpha description edited',
                    })
                    .query(true)
                    .reply(200, {
                        id: 'alpha',
                        name: 'Alpha edited',
                        desc: 'Alpha description edited',
                        due: '2016-10-10T00:00:00.000Z',
                        url: 'https://trello.com/c/alpha/alpha-edited',
                    });


                return expect(trello_actions.patch_event(
                    this.stubs.req, this.stubs.source, event_id, event_patch) // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    id: 'kin-1234:abcd:alpha',
                    title: 'Alpha edited',
                    description: 'Alpha description edited',
                    kind: 'event#basic',
                    link: 'https://trello.com/c/alpha/alpha-edited',
                    start: {
                        date_time: '2016-10-10T00:00:00Z',
                    },
                    end: {
                        date_time: '2016-10-10T00:00:00Z',
                    },
                });
            });

            it('eventually returns an event after editing start date (all-day)', function () {
                const trello_board_id = 'abcd';
                const trello_card_id = 'alpha';
                const event_id = `kin-1234:${trello_board_id}:${trello_card_id}`;
                const event_patch = {
                    start: {
                        date: '2016-10-11',
                    },
                };

                nock(TRELLO_API_BASE_URL)
                    .put(`/cards/${querystring.escape(trello_card_id)}`, {
                        due: '2016-10-11',
                    })
                    .query(true)
                    .reply(200, {
                        id: 'alpha',
                        name: 'Alpha edited',
                        desc: 'Alpha description edited',
                        due: '2016-10-11T00:00:00.000Z',
                        url: 'https://trello.com/c/alpha/alpha-edited',
                    });

                // TODO: we houlsd find a way to keep all-day trello events ... all-day?
                return expect(trello_actions.patch_event(
                    this.stubs.req, this.stubs.source, event_id, event_patch) // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    id: 'kin-1234:abcd:alpha',
                    title: 'Alpha edited',
                    description: 'Alpha description edited',
                    kind: 'event#basic',
                    link: 'https://trello.com/c/alpha/alpha-edited',
                    start: {
                        date_time: '2016-10-11T00:00:00Z',
                    },
                    end: {
                        date_time: '2016-10-11T00:00:00Z',
                    },
                });
            });

            it('eventually returns an event after editing start date (timed)', function () {
                const trello_board_id = 'abcd';
                const trello_card_id = 'alpha';
                const event_id = `kin-1234:${trello_board_id}:${trello_card_id}`;
                const event_patch = {
                    start: {
                        date_time: '2016-10-10T10:00:00Z',
                    },
                };

                nock(TRELLO_API_BASE_URL)
                    .put(`/cards/${querystring.escape(trello_card_id)}`, {
                        due: '2016-10-10T10:00:00Z',
                    })
                    .query(true)
                    .reply(200, {
                        id: 'alpha',
                        name: 'Alpha edited',
                        desc: 'Alpha description edited',
                        due: '2016-10-10T10:00:00.000Z',
                        url: 'https://trello.com/c/alpha/alpha-edited',
                    });

                // TODO: we houlsd find a way to keep all-day trello events ... all-day?
                return expect(trello_actions.patch_event(
                    this.stubs.req, this.stubs.source, event_id, event_patch) // eslint-disable-line comma-dangle
                ).to.eventually.deep.equal({
                    id: 'kin-1234:abcd:alpha',
                    title: 'Alpha edited',
                    description: 'Alpha description edited',
                    kind: 'event#basic',
                    link: 'https://trello.com/c/alpha/alpha-edited',
                    start: {
                        date_time: '2016-10-10T10:00:00Z',
                    },
                    end: {
                        date_time: '2016-10-10T10:00:00Z',
                    },
                });
            });
        });

        describe('#delete_event', function () {
            // https://developers.trello.com/advanced-reference/card#delete-1-cards-card-id-or-shortlink
            it('returns a fulfilled promise', function () {
                const trello_board_id = 'abcd';
                const trello_card_id = 'alpha';
                const event_id = `kin-1234:${trello_board_id}:${trello_card_id}`;
                nock(TRELLO_API_BASE_URL)
                    .delete(`/cards/${trello_card_id}`)
                    .query(true)
                    .reply(204);
                return expect(trello_actions.delete_event(
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
