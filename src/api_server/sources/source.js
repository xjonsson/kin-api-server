/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const { logger } = require("../config");
const { create_source, get_static_url, get_ios_url, split_source_id } = require("../utils");
const { load_layers_mapping } = require("./actions_mappings");
const { load_google_colors } = require("./google/base");

const bluebird = require("bluebird");
const _ = require("lodash");

function deauth_source(req, source) {
    const user = req.user;
    user.delete_source(source);
    logger.debug("%s removed source `%s` from user `%s`", req.id, source.id, user.id);
}

function autoload_all_selected_layers(req, source) {
    const { provider_name } = split_source_id(source.id);
    return load_layers_mapping[provider_name](req, source).then(source_layers => {
        _(source_layers).filter("selected").forEach(layer => {
            req.user.toggle_selected_layer(layer.id, true);
        });
    });
}

function save_source(req, access_token, refresh_token, profile, done) {
    const user = req.user;
    const source = create_source(profile, {
        access_token,
        refresh_token
    });
    user.add_source(source);

    const promises = [autoload_all_selected_layers(req, source)];
    if (profile.provider === "google") {
        promises.push(load_google_colors(req, source));
    }

    return bluebird
        .all(promises)
        .then(() => {
            logger.debug("%s added source `%s` to user `%s`", req.id, source.id, user.id);
            done(null, user);
        })
        .catch(err => {
            done(err, null);
        });
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
    deauth_source,
    save_source,
    autoload_all_selected_layers,
    send_home_redirects
};
