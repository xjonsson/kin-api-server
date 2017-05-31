/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const { GOOGLE_SCOPES, GOOGLE_API_TIMEOUT } = require("./base");
const { deauth_source, ensured_source_exists, save_source, send_home_redirects } = require("../source");
const { rp } = require("../../config");
const secrets = require("../../secrets");
const { ensured_logged_in, get_callback_url, get_static_url } = require("../../utils");

const bluebird = require("bluebird");
const express = require("express");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const passport = require("passport");

const router = express.Router(); // eslint-disable-line new-cap
const source_redirect_url = get_callback_url("google");

passport.use(
    "google-source",
    new GoogleStrategy(
        {
            clientID: secrets.get("GOOGLE_CLIENT_ID"),
            clientSecret: secrets.get("GOOGLE_CLIENT_SECRET"),
            callbackURL: source_redirect_url,
            passReqToCallback: true
        },
        save_source
    )
);

router.get(
    "/",
    ensured_logged_in,
    passport.authorize("google-source", {
        scope: GOOGLE_SCOPES,
        accessType: "offline",
        includeGrantedScopes: true,
        prompt: "consent"
    })
);

router.get(
    "/callback",
    ensured_logged_in,
    passport.authorize("google-source", {
        failureRedirect: get_static_url()
    }),
    send_home_redirects
);

router.get(
    "/deauth/:source_id*",
    ensured_logged_in,
    ensured_source_exists("source_id"),
    (req, res, next) => {
        const source = req.user.get_source(req.params.source_id);
        bluebird
            .all([
                rp({
                    method: "GET",
                    uri: "https://accounts.google.com/o/oauth2/revoke",
                    qs: {
                        token: source.access_token
                    },
                    timeout: GOOGLE_API_TIMEOUT
                }),
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
