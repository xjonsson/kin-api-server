/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const _ = require("lodash");

const { require_from_all_sources } = require("./sources_utils");

function _filter_actions_for_mapping(all_actions, action_name) {
    return _(all_actions)
        .pickBy(source_actions => _.isFunction(source_actions[action_name]))
        .mapValues(action_name)
        .value();
}

const actions = require_from_all_sources("actions.js");

const create_event_mapping = _filter_actions_for_mapping(actions, "create_event");
const delete_event_mapping = _filter_actions_for_mapping(actions, "delete_event");
const load_contacts_mapping = _filter_actions_for_mapping(actions, "load_contacts");
const load_events_mapping = _filter_actions_for_mapping(actions, "load_events");
const load_layers_mapping = _filter_actions_for_mapping(actions, "load_layers");
const load_places_mapping = _filter_actions_for_mapping(actions, "load_places");
const patch_event_mapping = _filter_actions_for_mapping(actions, "patch_event");

module.exports = {
    create_event_mapping,
    delete_event_mapping,
    load_contacts_mapping,
    load_events_mapping,
    load_layers_mapping,
    load_places_mapping,
    patch_event_mapping
};
