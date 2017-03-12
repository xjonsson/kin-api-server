/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const log4js = require('log4js');
const request = require('request-promise-native');

const env = require('./env');


/*
 * host / ip that will be listened on
 *
 * e.g.:
 *  dev: 127.0.0.1
 *  prod: <ip used to reach the server>
 */
const API_HOST = {
    dev: '',
    prod: '',
}[env];


/*
 * Local port on which the app will listen on.
 *
 * e.g: 8080
 */
const API_PORT = {
    dev: 0,
    prod: 0,
}[env];


/*
 * Externally facing hostnames of your setup: API endpoint, static assets endpoint
 *
 * e.g: kin.today / static.kin.today
 */
const API_HOSTNAME = {
    dev: '',
    prod: '',
}[env];
const STATIC_HOSTNAME = {
    dev: '',
    prod: '',
}[env];


const PROVIDER_NB_MONTHS_PAST = 6;
const PROVIDER_NB_MONTHS_FUTURE = 12;


/**
 * Logger setup
 */
const log4js_options = {
    appenders: [],
};
if (env !== 'test') {
    log4js_options.appenders.push({
        type: 'console',
        layout: {
            type: 'pattern',
            pattern: '%d %p %m',
        },
    });
    log4js_options.replaceConsole = true;
}
log4js.configure(log4js_options);
const logger = log4js.getLogger();


/**
 * Request setup
 */
const rp = request.defaults({
    pool: {
        maxSockets: Infinity,
    },
    gzip: true,
});


/**
 * Exports
 */
module.exports = {
    API_HOST,
    API_PORT,
    API_HOSTNAME,
    STATIC_HOSTNAME,

    PROVIDER_NB_MONTHS_PAST,
    PROVIDER_NB_MONTHS_FUTURE,

    logger,
    rp,
};
