/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const { STATIC_HOSTNAME, logger } = require("../config");
const { FACEBOOK_SCOPES } = require("../sources/facebook/base");
const { GOOGLE_SCOPES } = require("../sources/google/base");

const errors = require("../errors");
const { save_source } = require("../sources/source");
const secrets = require("../secrets");
const User = require("../user");
const {
    ensured_logged_in,
    get_callback_url,
    get_ios_url,
    get_source_id,
    get_static_url
} = require("../utils");

const express = require("express");
const passport = require("passport");
const FacebookStrategy = require("passport-facebook").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const router = express.Router(); // eslint-disable-line new-cap
const authentication_urls = {
    facebook: get_callback_url("facebook", "authentication"),
    google: get_callback_url("google", "authentication")
};

function end_authentication(req, res, next) {
    req.session.user = req.user.id; // eslint-disable-line no-param-reassign

    const claims = {
        iss: "kin",
        aud: "kin.today"
    };

    req.session.create(claims, (error, token) => {
        const redirect_url = `${get_static_url()}#token=${token}`;
        const ios_redirect_url = `${get_ios_url()}authentication?token=${token}`;

        res.json({
            redirect: redirect_url,
            ios_redirect: ios_redirect_url,
            token
        });

        next();
    });
}

function _create_user(access_token, refresh_token, profile) {
    const source_id = get_source_id(profile.provider, profile.id);
    const user = new User(source_id, {
        display_name: profile.displayName
    });
    return user;
}

function save_token(req, access_token, refresh_token, profile, done) {
    const source_id = get_source_id(profile.provider, profile.id);
    User.get_alias(source_id)
        .then(User.load)
        .catch(errors.KinUnauthenticatedUser, () => {
            const user = _create_user(access_token, refresh_token, profile);
            logger.debug(`${req.id} created new user \`${user.id}\``);
            return user;
        })
        .then(user => {
            req.user = user; // eslint-disable-line no-param-reassign
            return save_source(req, access_token, refresh_token, profile, done);
        })
        .catch(err => {
            logger.error(`${req.id} \n ${err}`);
            done(err, null);
        });
}

passport.use(
    "facebook-authentication",
    new FacebookStrategy(
        {
            clientID: secrets.get("FACEBOOK_CLIENT_ID"),
            clientSecret: secrets.get("FACEBOOK_CLIENT_SECRET"),
            callbackURL: authentication_urls.facebook,
            passReqToCallback: true
        },
        save_token
    )
);
passport.use(
    "google-authentication",
    new GoogleStrategy(
        {
            clientID: secrets.get("GOOGLE_CLIENT_ID"),
            clientSecret: secrets.get("GOOGLE_CLIENT_SECRET"),
            callbackURL: authentication_urls.google,
            passReqToCallback: true
        },
        save_token
    )
);

router.get(
    "/facebook",
    passport.authenticate("facebook-authentication", {
        scope: FACEBOOK_SCOPES,
        session: false
    })
);
router.get(
    "/facebook/callback",
    passport.authenticate("facebook-authentication", {
        failureRedirect: get_static_url(),
        session: false
    }),
    end_authentication
);

router.get(
    "/google",
    passport.authenticate("google-authentication", {
        scope: GOOGLE_SCOPES,
        accessType: "offline",
        prompt: "consent",
        session: false
    })
);
router.get(
    "/google/callback",
    passport.authenticate("google-authentication", {
        failureRedirect: get_static_url(),
        session: false
    }),
    end_authentication
);

router.get("/logout", ensured_logged_in, (req, res, next) => {
    req.session.destroy(() => {
        res.json({
            redirect: `https://${STATIC_HOSTNAME}`
        });
        next();
    });
});

module.exports = {
    router
};
