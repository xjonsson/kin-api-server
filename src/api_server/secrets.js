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
     * Paths to your certificate's private key and chain.
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
     * After this, all secrets are related to specific providers (Google,
     * Facebook ... ). You're not required to create an OAuth app for each one.
     *
     * Providers are disabled by default until you set values for their various
     * secrets. You will be greeted by messages like this in the logs when
     * starting the server for each unconfigured provider:
     *     WARN could not load file auth.js for source github: TypeError:
     *     OAuth2Strategy requires a clientID option
     *     (in this case we have no client ID / client secret for Github)
     *
     * FIXME: that said, for now Facebook and Google are required. They are used
     * as an authentication mechanism to connect to Kin, and we haven't had time
     * to make them bypassable if not configured.
     */


    /*
     * Eventbrite OAuth app secrets (optional)
     * https://www.eventbrite.com/myaccount/apps
     */
    EVENTBRITE_CLIENT_ID: {
        // Eventbrite "Application Key"
        dev: '',
        prod: '',
    },
    EVENTBRITE_CLIENT_SECRET: {
        // Eventbrite "OAuth Client Secret"
        dev: '',
        prod: '',
    },


    /*
     * Facebook OAuth app secrets (required)
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
     * Github OAuth app secrets (optional)
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
     * Google OAuth app secrets (required)
     * https://console.developers.google.com/projectselector/apis/credentials
     */
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',

    /*
     * Google Static Map API key (optional)
     * https://developers.google.com/maps/documentation/static-maps/
     */
    GOOGLE_MAPS_KEY: '',


    /*
     * Meetup OAuth app secrets (optional)
     * https://secure.meetup.com/meetup_api/oauth_consumers/
     */
    MEETUP_CLIENT_ID: {
        dev: '',
        prod: '',
    },
    MEETUP_CLIENT_INTERNAL_ID: {
        // This is the internal ID of your app for Meetup, it's used for
        // de-authing Kin when a user disconnect its Meetup account.
        //
        // Once you've created the OAuth App in Meetup's dashboard, click on
        // "Edit Settings" and you'll be able to find the internal ID in the URL
        // (labeled consumer_id):
        //   https://secure.meetup.com/meetup_api/oauth_consumers/edit/?consumer_id=123456
        dev: '',
        prod: '',
    },
    MEETUP_CLIENT_SECRET: {
        dev: '',
        prod: '',
    },


    /*
     * Outlook/Office365 OAuth app secrets (optional)
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
     * Todoist OAuth app secrets (optional)
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
     * Trello OAuth app secrets (optional)
     * https://trello.com/app-key
     */
    TRELLO_KEY: '',
    TRELLO_SECRET: '',


    /*
     * Wunderlist OAuth app secrets (optional)
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
