/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const _ = require("lodash");

const env = _.get(
    {
        dev: "dev",
        preprod: "preprod",
        production: "prod",
        test: "test"
    },
    process.env.NODE_ENV,
    "dev"
);

module.exports = env;
