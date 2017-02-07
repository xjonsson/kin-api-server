/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const { OUTLOOK_SCOPES } = require('./base');
const { deauth_source, save_source, send_home_redirects } = require('../source');
const { API_HOSTNAME, logger } = require('../../config');
const secrets = require('../../secrets');
const { ensured_logged_in, get_static_url } = require('../../utils');

const express = require('express');
const OutlookStrategy = require('passport-outlook').Strategy;
const passport = require('passport');
const querystring = require('querystring');
const _ = require('lodash');


const router = express.Router(); // eslint-disable-line new-cap
const source_redirect_url = `https://${API_HOSTNAME}/1.0/source/outlook/connector`;


function save_outlook_source(req, access_token, refresh_token, profile, done) {
    // Override the provider from `windowslive` to `outlook`
    profile.provider = 'outlook'; // eslint-disable-line no-param-reassign
    return save_source(req, access_token, refresh_token, profile, done);
}


const strategy = new OutlookStrategy({
    clientID: secrets.get('OUTLOOK_CLIENT_ID'),
    clientSecret: secrets.get('OUTLOOK_CLIENT_SECRET'),
    callbackURL: source_redirect_url,
    passReqToCallback: true,
}, save_outlook_source);
passport.use('outlook-source', strategy);


router.get(
    '/connector',
    (req, res) => {
        const connector_qs = _.merge({}, req.query, {
            provider: 'outlook',
            role: 'source',
        });
        const code = connector_qs.code;
        delete connector_qs.code;
        const url = `${get_static_url()}/connector.html?${querystring.stringify(connector_qs)}#code=${code}`;
        logger.debug('%s outlook connector, redirecting to %s', req.id, url);
        res.redirect(url);
    }
);


router.get(
    '/',
    ensured_logged_in,
    passport.authorize('outlook-source', {
        scope: OUTLOOK_SCOPES,
    })
);


router.get(
    '/callback',
    ensured_logged_in,
    passport.authorize('outlook-source', {
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
        } else {
            // TODO: need to ask the user to go to outlook to revoke the app
            deauth_source(req, source);
            logger.debug('%s revoked source `%s` for user `%s`',
                         req.id, source_id, user.id);
        }
        next();
    },
    send_home_redirects
);


module.exports = {
    router,
};
