/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const { TODOIST_SCOPES } = require("./base");
const {
    deauth_source,
    ensured_source_exists,
    save_source,
    send_home_redirects
} = require("../source");
const secrets = require("../../secrets");
const { ensured_logged_in, get_callback_url, get_static_url } = require("../../utils");

const express = require("express");
const passport = require("passport");
const TodoistStrategy = require("passport-todoist").Strategy;

const router = express.Router(); // eslint-disable-line new-cap
const source_redirect_url = get_callback_url("todoist");

passport.use(
    "todoist-source",
    new TodoistStrategy(
        {
            clientID: secrets.get("TODOIST_CLIENT_ID"),
            clientSecret: secrets.get("TODOIST_CLIENT_SECRET"),
            callbackURL: source_redirect_url,
            passReqToCallback: true
        },
        save_source
    )
);

router.get(
    "/",
    ensured_logged_in,
    passport.authorize("todoist-source", {
        scope: TODOIST_SCOPES
    })
);

router.get(
    "/callback",
    ensured_logged_in,
    passport.authorize("todoist-source", {
        failureRedirect: get_static_url()
    }),
    send_home_redirects
);

router.get(
    "/deauth/:source_id*",
    ensured_logged_in,
    ensured_source_exists("source_id"),
    (req, res, next) => {
        // TODO: need to ask the user to go to todoist to revoke the app
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
