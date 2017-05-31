/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const { TRELLO_SCOPES } = require("./base");
const {
    deauth_source,
    ensured_source_exists,
    save_source,
    send_home_redirects
} = require("../source");
const { logger } = require("../../config");
const secrets = require("../../secrets");
const { ensured_logged_in, get_callback_url, get_static_url } = require("../../utils");

const express = require("express");
const passport = require("passport");
const TrelloStrategy = require("passport-trello").Strategy;

const router = express.Router(); // eslint-disable-line new-cap
const source_redirect_url = get_callback_url("trello");

// This is largely inspired by the SessionStore in passport-oauth1:
//
// Since we use jwt-redis-session [1] which requires an explicit call to `update` to save the session
// to redis, we need to create our own SessionStore before Passport redirects the user
//
// [0] https://github.com/jaredhanson/passport-oauth1/blob/master/lib/requesttoken/session.js
// [1] https://github.com/azuqua/jwt-redis-session
function SessionStore(options) {
    if (!options.key) {
        throw new TypeError("Session-based request token store requires a session key");
    }
    this._key = options.key;
}

SessionStore.prototype.get = function session_store_get(req, token, callback) {
    if (!req.session) {
        return callback(new Error("OAuth authentication requires session support"));
    }
    if (!req.session[this._key]) {
        return callback(new Error("Failed to find request token in session"));
    }
    const tokenSecret = req.session[this._key].oauth_token_secret;
    return callback(null, tokenSecret);
};

SessionStore.prototype.set = function session_store_set(req, token, tokenSecret, callback) {
    /* eslint-disable no-param-reassign */
    if (!req.session) {
        callback(new Error("OAuth authentication requires session support"));
        return;
    }

    if (!req.session[this._key]) {
        req.session[this._key] = {};
    }
    req.session[this._key].oauth_token = token;
    req.session[this._key].oauth_token_secret = tokenSecret;
    req.session.update(error => {
        if (error) {
            callback(
                new Error(
                    "Failed to save session after setting request token for OAuth authentication"
                )
            );
            return;
        }

        callback();
    });
    /* eslint-enable no-param-reassign */
};

SessionStore.prototype.destroy = function session_store_destroy(req, token, callback) {
    /* eslint-disable no-param-reassign */
    delete req.session[this._key].oauth_token;
    delete req.session[this._key].oauth_token_secret;
    if (Object.keys(req.session[this._key]).length === 0) {
        delete req.session[this._key];
    }
    req.session.update(error => {
        if (error) {
            return callback(
                new Error(
                    "Failed to save session after destroying request token for OAuth authentication"
                )
            );
        }
        return callback();
    });
    /* eslint-enable no-param-reassign */
};

passport.use(
    "trello-source",
    new TrelloStrategy(
        {
            consumerKey: secrets.get("TRELLO_KEY"),
            consumerSecret: secrets.get("TRELLO_SECRET"),
            callbackURL: source_redirect_url,
            passReqToCallback: true,
            requestTokenStore: new SessionStore({ key: secrets.get("TRELLO_KEY") }),
            trelloParams: {
                scope: TRELLO_SCOPES,
                name: "Kin Calendar",
                expiration: "never"
            }
        },
        save_source
    )
);

router.get("/", ensured_logged_in, passport.authorize("trello-source"), req => {
    // TODO: need to be more thorough
    req.session.update(error => {
        // TODO: error while updating redis session
        logger.error(error);
    });
});

router.get(
    "/callback",
    ensured_logged_in,
    passport.authorize("trello-source", {
        failureRedirect: get_static_url()
    }),
    send_home_redirects
);

router.get(
    "/deauth/:source_id*",
    ensured_logged_in,
    ensured_source_exists("source_id"),
    (req, res, next) => {
        // TODO: need to ask the user to go to trello to revoke the app
        // NOTE: the `then` is here to make sure we're not passing anything
        // to express `next` as it would be interpreted as an error.
        deauth_source(req, req.user.get_source(req.params.source_id))
            .then(() => next())
            .catch(next);
    },
    send_home_redirects
);

module.exports = {
    router
};
