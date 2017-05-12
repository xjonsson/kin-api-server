/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const dnscache = require("dnscache");

function setup() {
    dnscache({
        enable: true,
        ttl: 300,
        cachesize: 1000
    });
}

module.exports = {
    setup
};
