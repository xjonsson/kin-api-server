/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const { logger } = require("../config");
const {
    ensured_logged_in,
    split_merged_id,
    split_source_id,
    validate_source
} = require("../utils");
const { delete_event_mapping, patch_event_mapping } = require("../sources/actions_mappings");
const errors = require("../errors");

const body_parser = require("body-parser");
const express = require("express");
const _ = require("lodash");

const router = express.Router(); // eslint-disable-line new-cap
router.use(ensured_logged_in);
const json_parser = body_parser.json();

router.patch("/:event_id", json_parser, (req, res, next) => {
    const event_id = req.params.event_id;
    const user = req.user;
    const [source_id, ,] = split_merged_id(event_id); // eslint-disable-line array-bracket-spacing
    const source = user.get_source(source_id);

    const source_error = validate_source(req, source_id);
    if (!_.isUndefined(source_error)) {
        next(source_error);
        return;
    }

    const { provider_name } = split_source_id(source_id);
    if (!(provider_name in patch_event_mapping)) {
        next(new errors.KinActionNotSupportedError("patch event", provider_name));
        return;
    }

    const notify_attendees = _.get(req, "query.notify") === "true";
    const patch_event = patch_event_mapping[provider_name];
    patch_event(req, source, event_id, req.body, notify_attendees)
        .then(event => {
            logger.debug("%s updated event `%s` for user `%s`", req.id, event.id, user.id);
            res.json({
                event
            });
            next();
        })
        .catch(next);
});

router.delete("/:event_id", json_parser, (req, res, next) => {
    const event_id = req.params.event_id;
    const user = req.user;
    const [source_id, ,] = split_merged_id(event_id); // eslint-disable-line array-bracket-spacing
    const source = user.get_source(source_id);

    const source_error = validate_source(req, source_id);
    if (!_.isUndefined(source_error)) {
        next(source_error);
        return;
    }

    const { provider_name } = split_source_id(source_id);
    if (!(provider_name in delete_event_mapping)) {
        next(new errors.KinActionNotSupportedError("delete event", provider_name));
        return;
    }

    const delete_event = delete_event_mapping[provider_name];
    delete_event(req, source, event_id)
        .then(() => {
            logger.debug("%s deleted event `%s` for user `%s`", req.id, event_id, user.id);
            res.json(true);
            next();
        })
        .catch(next);
});

module.exports = {
    router
};
