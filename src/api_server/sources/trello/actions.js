/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const { TrelloRequest } = require("./base");
const { merge_ids, split_merged_id } = require("../../utils");

const moment = require("moment-timezone");
const querystring = require("querystring");
const _ = require("lodash");

const KIN_MY_CARDS_LAYER_ID = "kin_my_cards";

/**
 * Formatting helpers
 */
function _format_layer(source_id, trello_board) {
    const output = {
        id: merge_ids(source_id, trello_board.id),
        title: trello_board.name,
        text_color: "#FFFFFF",
        color: "#026AA7",
        acl: {
            edit: true,
            create: false,
            delete: true
        },

        // used as a default coming from the source,
        // it's overridden by our custom selected layer db
        selected: false
    };
    const trello_board_background_color = _.get(trello_board, "prefs.backgroundColor", null);
    if (!_.isNull(trello_board_background_color)) {
        output.color = trello_board_background_color;
    }
    return output;
}

function _format_event(layer_id, trello_card) {
    const output = {
        id: merge_ids(layer_id, trello_card.id),
        title: trello_card.name,
        description: trello_card.desc,
        link: trello_card.url,
        start: {
            date_time: moment.tz(trello_card.due, "utc").format()
        },
        end: {
            date_time: moment.tz(trello_card.due, "utc").format()
        },
        kind: "event#basic"
    };
    return output;
}

function _format_patch(event_patch) {
    const output = {};
    if (!_.isUndefined(event_patch.title)) {
        output.name = event_patch.title;
    }
    if (!_.isUndefined(event_patch.description)) {
        output.desc = event_patch.description;
    }
    if (!_.isUndefined(event_patch.start)) {
        output.due = event_patch.start.date_time || event_patch.start.date;
    }
    return output;
}

/**
 * Actions
 */
function load_layers(req, source) {
    return new TrelloRequest(req, source.id).api("members/me/boards").then(trello_res => {
        const board_layers = _.map(trello_res, _.partial(_format_layer, source.id));
        return [
            {
                id: merge_ids(source.id, KIN_MY_CARDS_LAYER_ID),
                title: "My Cards",
                text_color: "#FFFFFF",
                color: "#026AA7",
                acl: {
                    edit: true,
                    create: false,
                    delete: true
                },

                // used as a default coming from the source,
                // it's overridden by our custom selected layer db
                selected: true
            },
            ...board_layers
        ];
    });
}

function _load_events_from_board(req, source, layer_id) {
    const [, trello_board_id] = split_merged_id(layer_id);
    const query_options = {
        qs: {
            fields: _.join(["id", "name", "desc", "due", "dueComplete", "url"], ",")
        }
    };
    return new TrelloRequest(req, source.id)
        .api(`boards/${querystring.escape(trello_board_id)}/cards`, query_options)
        .then(trello_res => {
            return {
                events: _(trello_res)
                    .filter(card => !_.isEmpty(card.due) && !card.dueComplete)
                    .map(_.partial(_format_event, layer_id))
                    .value()
            };
        });
}

function _load_events_from_my_cards(req, source, layer_id) {
    const query_options = {
        qs: {
            fields: _.join(["id", "name", "desc", "due", "dueComplete", "url"], ",")
        }
    };
    return new TrelloRequest(req, source.id)
        .api("members/me/cards", query_options)
        .then(trello_res => {
            return {
                events: _(trello_res)
                    .filter(card => !_.isEmpty(card.due) && !card.dueComplete)
                    .map(_.partial(_format_event, layer_id))
                    .value()
            };
        });
}

function load_events(req, source, layer_id) {
    const [, trello_board_id] = split_merged_id(layer_id);
    if (trello_board_id === KIN_MY_CARDS_LAYER_ID) {
        return _load_events_from_my_cards(req, source, layer_id);
    }
    return _load_events_from_board(req, source, layer_id);
}

function patch_event(req, source, event_id, event_patch) {
    const [source_id, trello_board_id, trello_card_id] = split_merged_id(event_id);
    const formatted_patch = _format_patch(event_patch);

    const query_options = {
        method: "PUT",
        body: formatted_patch
    };
    return new TrelloRequest(req, source.id)
        .api(`cards/${querystring.escape(trello_card_id)}`, query_options)
        .then(trello_res => {
            const layer_id = merge_ids(source_id, trello_board_id);
            return _format_event(layer_id, trello_res);
        });
}

function delete_event(req, source, event_id) {
    const [, , trello_card_id] = split_merged_id(event_id);

    const query_options = {
        method: "DELETE"
    };
    return new TrelloRequest(req, source.id).api(
        `cards/${querystring.escape(trello_card_id)}`,
        query_options
    );
}

module.exports = {
    load_layers,
    load_events,
    patch_event,
    delete_event
};
