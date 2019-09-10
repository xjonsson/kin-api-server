/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const { logger } = require("../config");
const errors = require("../errors");
const { ensured_logged_in, split_source_id, validate_source } = require("../utils");
const {
    load_contacts_mapping,
    load_layers_mapping,
    load_places_mapping
} = require("../sources/actions_mappings");

const express = require("express");
const _ = require("lodash");

const router = express.Router(); // eslint-disable-line new-cap
router.use(ensured_logged_in);

function _format_source(source) {
    // Strip down all `token`-related properties
    return _.pickBy(source, (value, key) => key.indexOf("token") === -1);
}

router.get("/", (req, res, next) => {
    res.json({
        sources: _.mapValues(req.user.sources, _format_source)
    });
    next();
});

router.get("/:source_id/layers", (req, res, next) => {
    const source_id = req.params.source_id;
    const user = req.user;
    const source = user.get_source(source_id);

    const source_error = validate_source(req, source_id);
    if (!_.isUndefined(source_error)) {
        next(source_error);
        return;
    }

    const { provider_name } = split_source_id(source_id);
    if (!(provider_name in load_layers_mapping)) {
        next(new errors.KinActionNotSupportedError("load layers", provider_name));
        return;
    }

    const load_layers = load_layers_mapping[provider_name];
    load_layers(req, source)
        .then(layers => {
            _.forEach(layers, layer => {
                layer.selected = user.is_layer_selected(layer.id); // eslint-disable-line no-param-reassign
            });
            logger.debug(
                "%s loaded `%d` layers in source `%s` for user `%s`",
                req.id,
                layers.length,
                source_id,
                user.id
            );
            res.json({
                layers
            });
            next();
        })
        .catch(next);
});

router.get("/:source_id/places", (req, res, next) => {
    const source_id = req.params.source_id;
    const user = req.user;
    const source = user.get_source(source_id);

    const source_error = validate_source(req, source_id);
    if (!_.isUndefined(source_error)) {
        next(source_error);
        return;
    }

    const { provider_name } = split_source_id(source_id);
    if (!(provider_name in load_places_mapping)) {
        next(new errors.KinActionNotSupportedError("load places", provider_name));
        return;
    }

    const query_input = req.query.input;
    const load_places = load_places_mapping[provider_name];
    load_places(req, source, query_input)
        .then(places => {
            logger.debug(
                "%s loaded `%d` places in source `%s` for user `%s`",
                req.id,
                places.length,
                source_id,
                user.id
            );
            res.json({
                places
            });
            next();
        })
        .catch(next);
});

router.get("/:source_id/contacts", (req, res, next) => {
    const source_id = req.params.source_id;
    const user = req.user;
    const source = user.get_source(source_id);

    const source_error = validate_source(req, source_id);
    if (!_.isUndefined(source_error)) {
        next(source_error);
        return;
    }

    const { provider_name } = split_source_id(source_id);
    if (!(provider_name in load_contacts_mapping)) {
        next(new errors.KinActionNotSupportedError("load contacts", provider_name));
        return;
    }

    const query_input = req.query.input;
    const load_contacts = load_contacts_mapping[provider_name];
    load_contacts(req, source, query_input)
        .then(contacts => {
            logger.debug(
                "%s loaded `%d` contacts in source `%s` for user `%s`",
                req.id,
                contacts.length,
                source_id,
                user.id
            );
            res.json({
                contacts
            });
            next();
        })
        .catch(next);
});

module.exports = {
    router
};
