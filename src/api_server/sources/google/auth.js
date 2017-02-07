/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const { GOOGLE_SCOPES, GOOGLE_API_TIMEOUT } = require('./base');
const { deauth_source, save_source, send_home_redirects } = require('../source');
const { logger, rp } = require('../../config');
const secrets = require('../../secrets');
const { ensured_logged_in, get_callback_url, get_static_url } = require('../../utils');

const express = require('express');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const passport = require('passport');
const _ = require('lodash');


const router = express.Router(); // eslint-disable-line new-cap
const source_redirect_url = get_callback_url('google');


passport.use('google-source', new GoogleStrategy({
    clientID: secrets.get('GOOGLE_CLIENT_ID'),
    clientSecret: secrets.get('GOOGLE_CLIENT_SECRET'),
    callbackURL: source_redirect_url,
    passReqToCallback: true,
}, save_source));

router.get(
    '/',
    ensured_logged_in,
    passport.authorize('google-source', {
        scope: GOOGLE_SCOPES,
        accessType: 'offline',
        includeGrantedScopes: true,
        prompt: 'consent',
    })
);


router.get(
    '/callback',
    ensured_logged_in,
    passport.authorize('google-source', {
        failureRedirect: get_static_url(),
    }),
    send_home_redirects
);


router.get(
    '/deauth/:source_id*',
    ensured_logged_in,
    (req, res, next) => {
        const source_id = req.params.source_id;
        const user = req.user;

        const source = user.get_source(source_id);
        if (_.isUndefined(source)) {
            res.status(404).json({
                msg: `bad source id: \`${source_id}\``,
            });
            next();
        } else {
            const options = {
                method: 'GET',
                uri: 'https://accounts.google.com/o/oauth2/revoke',
                qs: {
                    token: source.access_token,
                },
                timeout: GOOGLE_API_TIMEOUT,
            };
            rp(options)
                .then(() => {
                    logger.debug(`${req.id} revoked source \`${source_id}\` for user \`${user.id}\``);
                })
                .catch((err) => {
                    logger.warn(`${req.id} error while revoking token for source \`${source_id}\`: \n`, err);
                });
            // This is on purpose outside of the request promise as the results
            // of the request to revoke the token are mostly "optional".
            // Most people (and providers) don't give us the ability to revoke
            // a token, we might as well not make people wait for it
            deauth_source(req, source);
            next();
        }
    },
    send_home_redirects
);


module.exports = {
    router,
};
