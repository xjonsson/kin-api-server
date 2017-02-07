/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const log4js = require('log4js');
const request = require('request-promise-native');

const env = require('./env');


const API_HOST = {
    dev: '',
    prod: '',
}[env];
const API_PORT = {
    dev: 0,
    prod: 0,
}[env];

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
