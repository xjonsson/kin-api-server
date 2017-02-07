/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const { STATIC_HOSTNAME, logger } = require('../config');
const { FACEBOOK_SCOPES } = require('../sources/facebook/base');
const { GOOGLE_SCOPES, load_google_colors } = require('../sources/google/base');

const errors = require('../errors');
const { autoload_all_selected_layers } = require('../sources/source');
const secrets = require('../secrets');
const User = require('../user');
const { create_source, ensured_logged_in,
       get_callback_url, get_ios_url,
       get_source_id, get_static_url } = require('../utils');


const bluebird = require('bluebird');
const express = require('express');
const moment = require('moment-timezone');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const _ = require('lodash');


const router = express.Router(); // eslint-disable-line new-cap
const authentication_urls = {
    facebook: get_callback_url('facebook', 'authentication'),
    google: get_callback_url('google', 'authentication'),
};


function end_authentication(req, res) {
    req.session.user = req.user.id; // eslint-disable-line no-param-reassign

    const claims = {
        iss: 'kin',
        aud: 'kin.today',
    };

    req.session.create(claims, (error, token) => {
        const redirect_url = `${get_static_url()}#token=${token}`;
        const ios_redirect_url = `${get_ios_url()}authentication?token=${token}`;

        res.json({
            redirect: redirect_url,
            ios_redirect: ios_redirect_url,
            token,
        });
    });
}


function save_token(req, access_token, refresh_token, profile, done) {
    const source_id = get_source_id(profile.provider, profile.id);
    const get_or_create_user = User.load(source_id)
        .catch((err) => {
            if (err instanceof errors.KinUnauthenticatedUser) {
                const source = create_source(profile, { access_token, refresh_token });

                const user = new User(source_id, {
                    display_name: profile.displayName
                });
                req.user = user; // eslint-disable-line no-param-reassign
                user.add_source(source);

                const promises = [
                    autoload_all_selected_layers(req, source),
                ];
                if (profile.provider === 'google') {
                    promises.push(load_google_colors(req, source));
                }

                return bluebird
                    .all(promises)
                    .then(() => {
                        return user;
                    });
            }
            throw err;
        })
        .then((user) => {
            const source = create_source(profile, { access_token, refresh_token });
            const prev_source = user.get_source(source.id);
            req.user = user; // eslint-disable-line no-param-reassign
            user.add_source(_.merge(prev_source, source));
            return bluebird.resolve(user);
        });
    get_or_create_user
        .then(user => user.save(moment().unix()))
        .then(() => {
            const user = get_or_create_user.value();
            logger.debug('%s saved dirty user `%s`', req.id, user.id);
            return done(null, user);
        })
        .catch((err) => {
            logger.error('%s \n', req.id, err);
            done(err, null);
        });
}


passport.use('facebook-authentication', new FacebookStrategy({
    clientID: secrets.get('FACEBOOK_CLIENT_ID'),
    clientSecret: secrets.get('FACEBOOK_CLIENT_SECRET'),
    callbackURL: authentication_urls.facebook,
    passReqToCallback: true,
}, save_token));
passport.use('google-authentication', new GoogleStrategy({
    clientID: secrets.get('GOOGLE_CLIENT_ID'),
    clientSecret: secrets.get('GOOGLE_CLIENT_SECRET'),
    callbackURL: authentication_urls.google,
    passReqToCallback: true,
}, save_token));


router.get(
    '/facebook',
    passport.authenticate('facebook-authentication', {
        scope: FACEBOOK_SCOPES,
        session: false,
    })
);
router.get(
    '/facebook/callback',
    passport.authenticate('facebook-authentication', {
        failureRedirect: get_static_url(),
        session: false,
    }),
    end_authentication
);


router.get(
    '/google',
    passport.authenticate('google-authentication', {
        scope: GOOGLE_SCOPES,
        accessType: 'offline',
        prompt: 'consent',
        session: false,
    })
);
router.get(
    '/google/callback',
    passport.authenticate('google-authentication', {
        failureRedirect: get_static_url(),
        session: false,
    }),
    end_authentication
);


router.get(
    '/logout',
    ensured_logged_in,
    (req, res, next) => {
        req.session.destroy(() => {
            res.json({
                redirect: `https://${STATIC_HOSTNAME}`,
            });
            next();
        });
    }
);


module.exports = {
    router,
};
