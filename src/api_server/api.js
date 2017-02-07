/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


const dns_cache = require('./setups/dns_cache');
const metrics = require('./setups/metrics');


dns_cache.setup();
metrics.setup();


const { API_HOST, API_PORT, logger } = require('./config');
const errors = require('./errors');
const redis_clients = require('./redis_clients');
const secrets = require('./secrets');
const { log_request, prepare_request_stats, set_cors_headers, save_dirty_user } = require('./utils');

const { auth_routers } = require('./sources');

const authentication_router = require('./routers/authentication');
const events_router = require('./routers/events');
const layers_router = require('./routers/layers');
const sources_router = require('./routers/sources');
const user_router = require('./routers/user');


const express = require('express');
const fs = require('fs');
const https = require('https');
// TODO: need to remove this or patch it upstream so that it doesn't "swallow" errors
const JWTRedisSession = require('jwt-redis-session');
const _ = require('lodash');


process.on('unhandledRejection', (reason, promise) => {
    logger.error(reason);
    logger.error(promise);
    process.exit(1);
});


const app = express();
app.disable('x-powered-by');

app.use(prepare_request_stats);
app.use(JWTRedisSession({
    client: redis_clients.main,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    requestArg: 'token',
    secret: secrets.get('EXPRESS_SECRET'),
}));
app.use(set_cors_headers);
app.use('/.well-known', express.static('public/.well-known/'));
app.use(log_request);

// TODO: this might be a tad too permissive
app.options('*', (req, res) => {
    res.end();
});


/**
 * API
 */
const API_VERSION = '1.0';


app.get(`/${API_VERSION}/ping`, (req, res) => {
    redis_clients.main.get('monitor')
        .then((redis_res) => {
            if (_.isEmpty(redis_res)) {
                throw new Error('empty redis monitor result');
            }
            return res.json({
                status: redis_res,
            });
        })
        .catch((err) => {
            logger.error('%s\n', req.id, err);
            return res.status(503).json({
                status: 'down',
            });
        });
});


app.use(`/${API_VERSION}/authentication`, authentication_router.router);
app.use(`/${API_VERSION}/events`, events_router.router);
app.use(`/${API_VERSION}/layers`, layers_router.router);
app.use(`/${API_VERSION}/sources`, sources_router.router);
app.use(`/${API_VERSION}/user`, user_router.router);

_.forEach(auth_routers, (auth_router, source_name) => {
    app.use(`/${API_VERSION}/source/${source_name}`, auth_router);
});

app.use((err, req, res, next) => {
    if (err instanceof errors.KinError) {
        if (err.status_code >= 500) {
            logger.error('%s\n', req.id, err);
        } else {
            logger.warn('%s\n', req.id, err);
        }

        res
            .status(err.status_code)
            .json(err.json);
    } else {
        logger.error('%s\n', req.id, err);
        res.status(500).json({
            code: 10,
            error: 'unexpected error, please retry later',
        });
    }
    next();
});
app.use(save_dirty_user);


const https_options = {
    key: fs.readFileSync(secrets.get('HTTPS_KEY_FILE')),
    cert: fs.readFileSync(secrets.get('HTTPS_CERT_FILE')),
};
const https_server = https.createServer(https_options, app);
https_server.listen(API_PORT, API_HOST);
logger.info(`API server (v ${API_VERSION}) running on https://${API_HOST}:${API_PORT}`);


process.on('SIGINT', () => {
    // PM2 sends a SIGINT for graceful stops
    logger.debug('Caught SIGINT');
    redis_clients.disconnect();
    https_server.close(() => {
        process.exit(0);
    });
});
