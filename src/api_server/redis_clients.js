/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const Redis = require("ioredis");

/**
 * Redis setup 1/2
 */
const _redis_options = {
    port: 6390,
    db: 1,

    // Used to prevent it from connecting during tests
    lazyConnect: true
};

// Need 2 clients because `pubsub_client` will be in 'subscriber mode',
// preventing it from executing commands
const main_client = new Redis(_redis_options);
const pubsub_client = new Redis(_redis_options);

const SHOULD_REFRESH_LUA_SCRIPT = `
-- Checks if we can refresh the source's token
--
-- Return values
--  0: token should be refreshed
--  1: token is already refreshing

local raw_source = redis.call("hget", KEYS[1], KEYS[2])
local json_source = cjson.decode(raw_source)
local source_status = json_source["status"]
if source_status == nil or source_status == "connected" then
    json_source["status"] = "refreshing"
    redis.call('hset', KEYS[1], KEYS[2], cjson.encode(json_source))
    return 0
else
    return 1
end
`;

main_client.defineCommand("shouldRefresh", {
    numberOfKeys: 2,
    lua: SHOULD_REFRESH_LUA_SCRIPT
});

/**
 * Utils
 */
function disconnect() {
    main_client.disconnect();
    pubsub_client.disconnect();
}

/**
 * Exports
 */
module.exports = {
    disconnect,
    main: main_client,
    pubsub: pubsub_client
};
