/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const env = require('./env');

const _ = require('lodash');


/* eslint-disable no-useless-escape */
const SECRETS_MAPPING = {

    // Express settings
    EXPRESS_SECRET: '',
    HTTPS_KEY_FILE: {
        dev: '',
        prod: '',
    },
    HTTPS_CERT_FILE: {
        dev: '',
        prod: '',
    },

    // Eventbrite
    EVENTBRITE_CLIENT_ID: {
        dev: '',
        prod: '',
    },
    EVENTBRITE_CLIENT_SECRET: {
        dev: '',
        prod: '',
    },

    // Facebook
    FACEBOOK_CLIENT_ID: {
        dev: '',
        prod: '',
    },
    FACEBOOK_CLIENT_SECRET: {
        dev: '',
        prod: '',
    },

    // Github
    GITHUB_CLIENT_ID: {
        dev: '',
        prod: '',
    },
    GITHUB_CLIENT_SECRET: {
        dev: '',
        prod: '',
    },

    // Google
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    GOOGLE_MAPS_KEY: '',

    // Meetup
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

    // Outlook
    OUTLOOK_CLIENT_ID: {
        prod: '',
        dev: '',
    },
    OUTLOOK_CLIENT_SECRET: {
        prod: '',
        dev: '',
    },

    // Todoist
    TODOIST_CLIENT_ID: {
        prod: '',
        dev: '',
    },
    TODOIST_CLIENT_SECRET: {
        prod: '',
        dev: '',
    },

    // Trello
    TRELLO_KEY: '',
    TRELLO_SECRET: '',

    // Wunderlist
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
