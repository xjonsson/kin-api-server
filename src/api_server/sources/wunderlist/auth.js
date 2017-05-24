/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const { WUNDERLIST_SCOPES, WUNDERLIST_API_BASE_URL, WUNDERLIST_API_TIMEOUT } = require("./base");
const { deauth_source, save_source, send_home_redirects } = require("../source");
const { logger, rp } = require("../../config");
const secrets = require("../../secrets");
const { ensured_logged_in, get_callback_url, get_static_url } = require("../../utils");

const express = require("express");
const passport = require("passport");
const OAuth2Strategy = require("passport-oauth2").Strategy;
const { InternalOAuthError } = require("passport-oauth2");
const _ = require("lodash");

const router = express.Router(); // eslint-disable-line new-cap
const source_redirect_url = get_callback_url("wunderlist");
const SOURCE_NAME = "wunderlist-source";

const strategy = new OAuth2Strategy(
    {
        authorizationURL: "https://www.wunderlist.com/oauth/authorize",
        tokenURL: "https://www.wunderlist.com/oauth/access_token",
        clientID: secrets.get("WUNDERLIST_CLIENT_ID"),
        clientSecret: secrets.get("WUNDERLIST_CLIENT_SECRET"),
        callbackURL: source_redirect_url,
        passReqToCallback: true
    },
    save_source
);
strategy.userProfile = function user_profile(access_token, done) {
    const options = {
        headers: {
            "X-Client-ID": secrets.get("WUNDERLIST_CLIENT_ID"),
            "X-Access-Token": access_token
        },
        json: true,
        timeout: WUNDERLIST_API_TIMEOUT,
        uri: `${WUNDERLIST_API_BASE_URL}user`
    };
    rp(options)
        .then(wunderlist_res => {
            const profile = {
                provider: "wunderlist",
                id: wunderlist_res.id,
                displayName: wunderlist_res.name,
                emails: [
                    {
                        value: wunderlist_res.email,
                        type: "work"
                    }
                ],
                _json: wunderlist_res.json
            };
            done(null, profile);
        })
        .catch(err => {
            logger.error(err);
            return done(new InternalOAuthError("Failed to fetch user profile", err));
        });
};
passport.use(SOURCE_NAME, strategy);

router.get(
    "/",
    ensured_logged_in,
    passport.authorize(SOURCE_NAME, {
        scope: WUNDERLIST_SCOPES
    })
);

router.get(
    "/callback",
    ensured_logged_in,
    passport.authorize(SOURCE_NAME, {
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
            return;
        }

        // TODO: need to ask the user to go to wunderlist to revoke the app
        // NOTE: the `then` is here to make sure we're not passing anything
        // to express `next` as it would be interpreted as an error.
        deauth_source(req, source).then(() => next()).catch(next);
    },
    send_home_redirects
);

module.exports = {
    router
};
