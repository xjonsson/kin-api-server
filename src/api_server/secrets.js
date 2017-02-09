/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const env = require('./env');

const _ = require('lodash');


/* eslint-disable no-useless-escape */
const SECRETS_MAPPING = {


    /*
     * Secret key used to encrypt the JWT token used for user authentication
     * https://github.com/azuqua/jwt-redis-session#initialization
     */
    EXPRESS_SECRET: '',


    /*
     * Paths your certificate's private key and chain.
     *
     * In Let's Encrypt (https://letsencrypt.org/) default setup, this will be
     * something along those lines:
     * HTTPS_KEY_FILE = /etc/letsencrypt/live/<YOUR_DOMAIN_NAME>/privkey.pem
     * HTTPS_CERT_FILE = /etc/letsencrypt/live/<YOUR_DOMAIN_NAME>/fullchain.pem
     */
    HTTPS_KEY_FILE: {
        dev: '',
        prod: '',
    },
    HTTPS_CERT_FILE: {
        dev: '',
        prod: '',
    },


    /*
     * Eventbrite OAuth app secrets
     * https://www.eventbrite.com/myaccount/apps
     */
    EVENTBRITE_CLIENT_ID: {
        dev: '',
        prod: '',
    },
    EVENTBRITE_CLIENT_SECRET: {
        dev: '',
        prod: '',
    },


    /*
     * Facebook OAuth app secrets
     * https://developers.facebook.com/apps
     */
    FACEBOOK_CLIENT_ID: {
        dev: '',
        prod: '',
    },
    FACEBOOK_CLIENT_SECRET: {
        dev: '',
        prod: '',
    },


    /*
     * Github OAuth app secrets
     * https://github.com/settings/developers
     */
    GITHUB_CLIENT_ID: {
        dev: '',
        prod: '',
    },
    GITHUB_CLIENT_SECRET: {
        dev: '',
        prod: '',
    },


    /*
     * Google OAuth app secrets
     * https://console.developers.google.com/projectselector/apis/credentials
     */
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    GOOGLE_MAPS_KEY: '',


    /*
     * Meetup OAuth app secrets
     * https://secure.meetup.com/meetup_api/oauth_consumers/
     */
    MEETUP_CLIENT_ID: {
        dev: '',
        prod: '',
    },
    MEETUP_CLIENT_INTERNAL_ID: {
        dev: '',
        prod: '',
    },
    MEETUP_CLIENT_SECRET: {
        dev: '',
        prod: '',
    },


    /*
     * Outlook/Office365 OAuth app secrets
     * https://apps.dev.microsoft.com/
     */
    OUTLOOK_CLIENT_ID: {
        prod: '',
        dev: '',
    },
    OUTLOOK_CLIENT_SECRET: {
        prod: '',
        dev: '',
    },


    /*
     * Todoist OAuth app secrets
     * https://developer.todoist.com/appconsole.html
     */
    TODOIST_CLIENT_ID: {
        prod: '',
        dev: '',
    },
    TODOIST_CLIENT_SECRET: {
        prod: '',
        dev: '',
    },


    /*
     * Trello OAuth app secrets
     * https://trello.com/app-key
     */
    TRELLO_KEY: '',
    TRELLO_SECRET: '',


    /*
     * Wunderlist OAuth app secrets
     * https://developer.wunderlist.com/apps
     */
    WUNDERLIST_CLIENT_ID: {
        dev: '',
        prod: '',
    },
    WUNDERLIST_CLIENT_SECRET: {
        dev: '',
        prod: '',
    },
};
/* eslint-enable no-useless-escape */


// For now, I'm forcing it to use `dev` strings while testing, because I don't
// have a "nicer" solution that do not involve massive amount of copy-pasting,
// or massive amount of stubbing the tests
function get_secret(name, mapping = SECRETS_MAPPING, secret_env = (env === 'test' ? 'dev' : env)) {
    const secret = _.get(mapping, name, null);
    if (!_.isNull(secret)) {
        if (_.isObject(secret)) {
            return _.get(secret, secret_env);
        }
        return secret;
    }
    return null;
}


module.exports = {
    get: get_secret,
};
