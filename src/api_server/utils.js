/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const { STATIC_HOSTNAME, logger } = require("./config");
const errors = require("./errors");
const User = require("./user");

const cuid = require("cuid");
const moment = require("moment-timezone");
const querystring = require("querystring");
const _ = require("lodash");

function ensured_logged_in(req, res, next) {
    if (!_.isUndefined(req.user)) {
        return next();
    }

    if (_.isUndefined(req.session.id)) {
        return next(new errors.KinUnauthenticatedUser());
    }

    return User.load(req.session.user)
        .then(user => {
            req.user = user; // eslint-disable-line no-param-reassign
            next();
        })
        .catch(err => {
            logger.error("%s error while loading user `%s` \n", req.id, req.session.user, err);
            next(new errors.KinUnauthenticatedUser());
        });
}

function validate_source(req, source_id) {
    // Can't make this an express middleware because all routes that need validation
    // don't have the same scheme to get the source ID (some require extraction from
    // layer ID / event ID)
    const user = req.user;
    const source = user.get_source(source_id);

    if (_.isUndefined(source)) {
        return new errors.KinSourceNotFoundError(source_id);
    }

    if (source.status === "disconnected") {
        return new errors.KinDisconnectedSourceError(source_id);
    }

    return undefined;
}

function set_cors_headers(req, res, next) {
    const static_url = `https://${STATIC_HOSTNAME}`;
    res.setHeader("Access-Control-Allow-Origin", static_url);
    res.setHeader("Access-Control-Allow-Methods", ["DELETE", "GET", "PATCH", "OPTIONS"]);
    res.setHeader("Access-Control-Allow-Headers", ["Content-Type", "X-token"]);
    next();
}

function save_dirty_user(req, res, next) {
    if (_.get(req, "user.dirty", false)) {
        const user_id = _.get(req, "user.id", "no user ID");
        req.user
            .save()
            .then(() => {
                logger.debug("%s saved dirty user `%s`", req.id, user_id);
                next();
            })
            .catch(err => {
                logger.error("%s error while saving dirty user `%s` \n", req.id, user_id, err);
            });
    }
    next();
}

function log_request(req, res, next) {
    // Make sure to not store the qs in logs
    logger.debug("%s IN %s %s", req.id, req.method, req.path);
    next();
}

function get_static_url() {
    return `https://${STATIC_HOSTNAME}`;
}

function get_ios_url() {
    return "kin-ios://";
}

function get_callback_url(provider, role = "source") {
    const qs = querystring.stringify({
        provider,
        role
    });
    return `https://${STATIC_HOSTNAME}/connector.html?${qs}`;
}

function merge_ids(...args) {
    return args.join(":");
}

function split_merged_id(merged_id) {
    return merged_id.split(":");
}

function get_source_id(provider_name, provider_user_id) {
    return [provider_name, provider_user_id].join("-");
}

function split_source_id(source_id) {
    const first_index = source_id.indexOf("-");
    if (first_index === -1) {
        return {};
    }

    const provider_name = source_id.substring(0, first_index);
    const provider_user_id = source_id.substring(first_index + 1);
    if (provider_name.length <= 0 || provider_user_id.length <= 0) {
        return {};
    }

    return { provider_name, provider_user_id };
}

function create_source(profile, base = {}) {
    /* eslint-disable no-param-reassign */
    base.id = get_source_id(profile.provider, profile.id);
    base.display_name = profile.displayName;
    if (!_.isEmpty(profile.emails)) {
        base.email = profile.emails[0].value;
    }
    base.created_at = moment().unix();
    base.status = "connected";
    return base;
    /* eslint-enable no-param-reassign */
}

function prepare_request_stats(req, res, next) {
    /* eslint-disable no-param-reassign */
    // Add a unique ID to the request
    req.id = cuid();
    req.nb_reqs_out = 0;
    next();
    /* eslint-enable no-param-reassign */
}

function disconnect_source(req, source) {
    source.status = "disconnected"; // eslint-disable-line no-param-reassign
    req.user.add_source(source);
    throw new errors.KinDisconnectedSourceError(source.id);
}

module.exports = {
    ensured_logged_in,
    validate_source,
    set_cors_headers,
    save_dirty_user,
    log_request,
    get_static_url,
    get_ios_url,
    get_callback_url,
    merge_ids,
    split_merged_id,
    get_source_id,
    split_source_id,
    create_source,
    prepare_request_stats,
    disconnect_source
};
