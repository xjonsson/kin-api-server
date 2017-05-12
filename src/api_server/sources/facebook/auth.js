/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const { FACEBOOK_SCOPES, FacebookRequest } = require("./base");
const { deauth_source, save_source, send_home_redirects } = require("../source");
const { logger } = require("../../config");
const secrets = require("../../secrets");
const {
    ensured_logged_in,
    get_callback_url,
    get_static_url,
    split_source_id
} = require("../../utils");

const express = require("express");
const FacebookStrategy = require("passport-facebook").Strategy;
const passport = require("passport");
const _ = require("lodash");

const router = express.Router(); // eslint-disable-line new-cap
const source_redirect_url = get_callback_url("facebook");

passport.use(
    "facebook-source",
    new FacebookStrategy(
        {
            clientID: secrets.get("FACEBOOK_CLIENT_ID"),
            clientSecret: secrets.get("FACEBOOK_CLIENT_SECRET"),
            callbackURL: source_redirect_url,
            passReqToCallback: true
        },
        save_source
    )
);

router.get(
    "/",
    ensured_logged_in,
    passport.authorize("facebook-source", {
        scope: FACEBOOK_SCOPES
    })
);

router.get(
    "/callback",
    ensured_logged_in,
    passport.authorize("facebook-source", {
        failureRedirect: get_static_url()
    }),
    send_home_redirects
);

router.get(
    "/deauth/:source_id*",
    ensured_logged_in,
    (req, res, next) => {
        const source_id = req.params.source_id;
        const user = req.user;

        const source = user.get_source(source_id);
        if (_.isUndefined(source)) {
            res.status(404).json({
                msg: `bad source id: \`${source_id}\``
            });
            next();
        } else {
            const { provider_user_id } = split_source_id(source_id);
            new FacebookRequest(req, source_id)
                .api(
                    `${provider_user_id}/permissions`,
                {
                    method: "DELETE"
                },
                    1
                )
                .then(() => {
                    logger.debug(
                        "%s revoked source `%s` for user `%s`",
                        req.id,
                        source_id,
                        user.id
                    );
                })
                .catch(next);
            deauth_source(req, source);
            next();
        }
    },
    send_home_redirects
);

module.exports = {
    router
};
