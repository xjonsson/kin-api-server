/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const { FACEBOOK_SCOPES, FacebookRequest } = require("./base");
const {
    deauth_source,
    ensured_source_exists,
    save_source,
    send_home_redirects
} = require("../source");
const secrets = require("../../secrets");
const {
    ensured_logged_in,
    get_callback_url,
    get_static_url,
    split_source_id
} = require("../../utils");

const bluebird = require("bluebird");
const express = require("express");
const FacebookStrategy = require("passport-facebook").Strategy;
const passport = require("passport");

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
    ensured_source_exists("source_id"),
    (req, res, next) => {
        const source_id = req.params.source_id;
        const source = req.user.get_source(source_id);
        const { provider_user_id } = split_source_id(source_id);
        bluebird
            .all([
                new FacebookRequest(req, source_id).api(
                    `${provider_user_id}/permissions`,
                    {
                        method: "DELETE"
                    },
                    1
                ),
                deauth_source(req, source)
            ])
            // NOTE: the `then` is here to make sure we're not passing anything
            // to express `next` as it would be interpreted as an error.
            .then(() => next())
            .catch(next);
    },
    send_home_redirects
);

module.exports = {
    router
};
