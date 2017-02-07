/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const { logger } = require('../config');
const errors = require('../errors');
const { ensured_logged_in, split_merged_id, split_source_id, validate_source } = require('../utils');
const { create_event_mapping, load_events_mapping } = require('../sources/actions_mappings');


const body_parser = require('body-parser');
const express = require('express');
const _ = require('lodash');


const router = express.Router(); // eslint-disable-line new-cap
router.use(ensured_logged_in);
const json_parser = body_parser.json();


router.patch(
    '/:layer_id',
    json_parser,
    (req, res, next) => {
        // TODO: return a better error if `body.selected` is not a boolean
        const layer_id = req.params.layer_id;
        const user = req.user;
        let updated = false;

        const [source_id, ] = split_merged_id(layer_id); // eslint-disable-line array-bracket-spacing
        const source = user.get_source(source_id);
        if (!_.isUndefined(source) && _.isBoolean(req.body.selected)) {
            updated = user.toggle_selected_layer(layer_id, req.body.selected);
        }
        logger.debug('%s patched layer `%s`: %j', req.id, layer_id, req.body);
        res.json(updated);
        next();
    }
);


router.get(
    '/:layer_id/events',
    (req, res, next) => {
        const layer_id = req.params.layer_id;
        const user = req.user;
        const [source_id, ] = split_merged_id(layer_id); // eslint-disable-line array-bracket-spacing
        const source = user.get_source(source_id);

        const source_error = validate_source(req, source_id);
        if (!_.isUndefined(source_error)) {
            next(source_error);
            return;
        }

        const { provider_name } = split_source_id(source_id);
        if (!(provider_name in load_events_mapping)) {
            next(new errors.KinActionNotSupportedError('load events', provider_name));
            return;
        }

        load_events_mapping[provider_name](req, source, layer_id)
            .then((events_source) => {
                logger.debug('%s loaded `%d` events in layer `%s` for user `%s`',
                             req.id, _.get(events_source, 'events.length', 0), layer_id, user.id);
                res.json(events_source);
                next();
            })
            .catch(next);
    }
);


router.post(
    '/:layer_id/events',
    json_parser,
    (req, res, next) => {
        const layer_id = req.params.layer_id;
        const user = req.user;
        const [source_id, ] = split_merged_id(layer_id); // eslint-disable-line array-bracket-spacing
        const source = user.get_source(source_id);

        const source_error = validate_source(req, source_id);
        if (!_.isUndefined(source_error)) {
            next(source_error);
            return;
        }

        const { provider_name } = split_source_id(source_id);
        if (!(provider_name in create_event_mapping)) {
            next(new errors.KinActionNotSupportedError('create event', provider_name));
            return;
        }

        const notify_attendees = (_.get(req, 'query.notify') === 'true');
        create_event_mapping[provider_name](req, source, layer_id, req.body, notify_attendees)
            .then((event) => {
                logger.debug('%s created event `%s` for user `%s`',
                             req.id, event.id, user.id);
                res.json({
                    event,
                });
                next();
            })
            .catch(next);
    }
);


module.exports = {
    router,
};
