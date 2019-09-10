/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const errors = require("../errors");
const { logger } = require("../config");
const { create_source, get_static_url, get_ios_url, split_source_id } = require("../utils");
const { load_layers_mapping } = require("./actions_mappings");
const { load_google_colors } = require("./google/base");

const bluebird = require("bluebird");
const _ = require("lodash");

function autoload_all_selected_layers(req, source) {
    const { provider_name } = split_source_id(source.id);
    return load_layers_mapping[provider_name](req, source).then(source_layers => {
        _(source_layers).filter("selected").forEach(layer => {
            req.user.toggle_selected_layer(layer.id, true);
        });
    });
}

const deauth_source = (req, source) =>
    req.user.delete_source(source).then(() => {
        logger.debug("%s removed source `%s` from user `%s`", req.id, source.id, req.user.id);
    });

const ensured_source_exists = source_param_name => (req, res, next) =>
    next(
        _.isUndefined(req.user.get_source(req.params[source_param_name]))
            ? new errors.KinSourceNotFoundError(req.params[source_param_name])
            : null
    );

function save_source(req, access_token, refresh_token, profile, done) {
    const user = req.user;
    const source = create_source(profile, {
        access_token,
        refresh_token
    });

    return user
        .add_source(source, true)
        .then(() => {
            const promises = [autoload_all_selected_layers(req, source)];
            if (profile.provider === "google") {
                promises.push(load_google_colors(req, source));
            }

            return bluebird.all(promises).then(() => {
                logger.debug("%s added source `%s` to user `%s`", req.id, source.id, user.id);
                done(null, user);
            });
        })
        .catch(_.partialRight(done, null));
}

function send_home_redirects(req, res, next) {
    // TODO: do we really need to check for headers sent?
    // It's probably caused by something erroring and calling Express's `next`
    // without passing an error
    if (!res.headersSent) {
        // TODO: should we server a redirect based on the user agent? Since the
        // iOS redirect is used inside our apps, we have complete control over
        // it, and we can default to giving the web URL for other use cases
        res.json({
            redirect: get_static_url(),
            ios_redirect: `${get_ios_url()}source`
        });
    }
    next();
}

module.exports = {
    autoload_all_selected_layers,
    deauth_source,
    ensured_source_exists,
    save_source,
    send_home_redirects
};
