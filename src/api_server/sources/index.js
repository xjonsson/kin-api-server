/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const _ = require("lodash");

const { require_from_all_sources } = require("./sources_utils");

const auth_routers = _.mapValues(require_from_all_sources("auth.js"), "router");

module.exports = {
    auth_routers
};
