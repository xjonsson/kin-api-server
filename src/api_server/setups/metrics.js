/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const { API_HOST, logger } = require("../config");

const express = require("express");
const http = require("http");
const prometheus_client = require("prom-client");

const BASE_PORT = 10000;

function setup() {
    const pm_id = parseInt(process.env.pm_id, 10);
    const port = BASE_PORT + pm_id;
    const app = express();
    app.get("/metrics", (req, res) => {
        res.end(prometheus_client.register.metrics());
    });
    http.createServer(app).listen(port, API_HOST);
    logger.info("Prometheus server running on http://%s:%s", API_HOST, port);
}

module.exports = {
    setup
};
