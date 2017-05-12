/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const { ensured_logged_in } = require("../utils");

const body_parser = require("body-parser");
const express = require("express");
const moment = require("moment-timezone");
const _ = require("lodash");

const router = express.Router(); // eslint-disable-line new-cap
router.use(ensured_logged_in);
const json_parser = body_parser.json();

function _format_user(user) {
    return {
        id: user.id,
        display_name: user.display_name,
        timezone: user.timezone,
        first_day: user.first_day,
        default_view: user.default_view,
        default_calendar_id: user.default_calendar_id,
        plan: user.plan,
        plan_expiration: user.plan_expiration
    };
}

router.get("/debug", (req, res, next) => {
    const output = {
        session: req.session,
        user: req.user
    };
    res.json(output);
    next();
});

router.get("/", (req, res, next) => {
    res.json(_format_user(req.user));
    next();
});

router.patch("/", json_parser, (req, res, next) => {
    const user = req.user;
    const body = req.body;
    if (!_.isEmpty(body.display_name)) {
        user.display_name = body.display_name;
    }
    if (!_.isEmpty(body.timezone) && moment.tz.names().indexOf(body.timezone) !== -1) {
        user.timezone = body.timezone;
    }
    if ([0, 1, 6].indexOf(body.first_day) !== -1) {
        user.first_day = body.first_day;
    }
    if (["month", "agendaWeek"].indexOf(body.default_view) !== -1) {
        user.default_view = body.default_view;
    }
    if (!_.isEmpty(body.default_calendar_id)) {
        user.default_calendar_id = body.default_calendar_id;
    }
    res.json(_format_user(user));
    next();
});

module.exports = {
    router
};
