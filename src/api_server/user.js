/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const errors = require("./errors");
const redis_clients = require("./redis_clients");

const bluebird = require("bluebird");
const moment = require("moment-timezone");
const _ = require("lodash");

function _misc_key(user_id) {
    return `${user_id}:misc`;
}

function _sources_key(user_id) {
    return `${user_id}:sources`;
}

function _selected_layers_key(user_id) {
    return `${user_id}:selected_layers`;
}

const accepted_timezones = moment.tz.names();
const accepted_default_views = ["month", "agendaWeek"];

const default_options = {
    display_name: "John Doe",
    timezone: "",
    first_day: 0,
    default_view: "month",
    default_calendar_id: "",
    plan: null,
    plan_expiration: -1,

    updated_at: 0,
    created_at: 0,
    news_updated_at: 0
};

class User {
    constructor(id, options = {}, sources = {}, selected_layers = {}) {
        this._id = id;

        this._misc = options;

        this._sources = sources;
        this._selected_layers = selected_layers;

        this._dirty = false;
        this._added_sources_id = new Set();
        this._deleted_sources_id = new Set();
    }

    static get_alias(user_id) {
        return redis_clients.main
            .hgetall(_misc_key(user_id))
            .then(misc => _.isEmpty(misc) ? null : _.get(misc, 'alias', user_id));
    }

    static create_alias(alias_id, aliased_id) {
        return redis_clients.main
            .hset(_misc_key(alias_id), 'alias', aliased_id);
    }

    static delete_alias(alias_id) {
        return redis_clients.main.del(_misc_key(alias_id));
    }

    static load(user_id) {
        if (!user_id) {
            return bluebird.reject(new errors.KinUnauthenticatedUser());
        }

        const promises = [
            redis_clients.main.hgetall(_misc_key(user_id)),
            redis_clients.main.hgetall(_sources_key(user_id)),
            redis_clients.main.hgetall(_selected_layers_key(user_id))
        ];
        return bluebird.all(promises).then(results => {
            const misc = results[0];
            const sources = _.mapValues(results[1], JSON.parse);
            const selected_layers = _.mapValues(results[2], JSON.parse);

            if (_.isEmpty(misc)) {
                throw new errors.KinUnauthenticatedUser();
            }

            return new User(user_id, misc, sources, selected_layers);
        });
    }

    get id() {
        return this._id;
    }
    get updated_at() {
        return this._updated_at;
    }
    get created_at() {
        return this._created_at;
    }
    get dirty() {
        return this._dirty;
    }

    get sources() {
        // TODO: potentially return a copy of `sources` to prevent mutation?
        return this._sources;
    }

    get display_name() {
        return this._display_name;
    }
    set display_name(display_name) {
        if (display_name === this._display_name) {
            return;
        }

        this._display_name = display_name;
        this._dirty = true;
    }

    get timezone() {
        return this._timezone;
    }
    set timezone(timezone) {
        if (timezone === this._timezone) {
            return;
        }

        if (accepted_timezones.indexOf(timezone) === -1) {
            throw new errors.KinInvalidFormatError(timezone, "timezone", "not in tz database");
        }

        this._timezone = timezone;
        this._dirty = true;
    }

    get first_day() {
        return this._first_day;
    }
    set first_day(first_day) {
        if (first_day === this._first_day) {
            return;
        }

        if (!(_.inRange(first_day, 0, 7) && _.isInteger(first_day))) {
            throw new errors.KinInvalidFormatError(first_day, "first_day", "0 < x <= 6");
        }

        this._first_day = first_day;
        this._dirty = true;
    }

    get default_view() {
        return this._default_view;
    }
    set default_view(default_view) {
        if (default_view === this._default_view) {
            return;
        }

        if (accepted_default_views.indexOf(default_view) === -1) {
            throw new errors.KinInvalidFormatError(
                default_view,
                "default_view",
                "not in ['month', 'agendaWeek']"
            );
        }

        this._default_view = default_view;
        this._dirty = true;
    }

    get default_calendar_id() {
        return this._default_calendar_id;
    }
    set default_calendar_id(default_calendar_id) {
        if (default_calendar_id !== this._default_calendar_id) {
            this._default_calendar_id = default_calendar_id;
            this._dirty = true;
        }
    }

    get plan() {
        return this._plan;
    }
    set plan(plan) {
        if (plan !== this._plan) {
            this._plan = plan;
            this._dirty = true;
        }
    }

    get plan_expiration() {
        return this._plan_expiration;
    }
    set plan_expiration(plan_expiration) {
        if (plan_expiration !== this._plan_expiration) {
            this._plan_expiration = plan_expiration;
            this._dirty = true;
        }
    }

    get news_updated_at() {
        return this._news_updated_at;
    }
    set news_updated_at(news_updated_at) {
        if (news_updated_at !== this._news_updated_at) {
            this._news_updated_at = news_updated_at;
            this._dirty = true;
        }
    }

    get _misc() {
        return {
            display_name: this._display_name,
            timezone: this._timezone,
            first_day: this._first_day,
            default_view: this._default_view,
            default_calendar_id: this._default_calendar_id,
            plan: this._plan,
            plan_expiration: this._plan_expiration,
            updated_at: this._updated_at,
            created_at: this._created_at,
            news_updated_at: this._news_updated_at
        };
    }

    set _misc(options) {
        _.forEach(default_options, (default_value, key) => {
            this[`_${key}`] = _.get(options, key, default_value);
        });

        // TODO: find a better way to preserve / deserialize types?
        this._first_day = parseInt(this._first_day, 10);
        this._updated_at = parseInt(this._updated_at, 10);
        this._created_at = parseInt(this._created_at, 10);
        this._news_updated_at = parseInt(this._news_updated_at, 10);
        this._plan_expiration = parseInt(this._plan_expiration, 10);
    }

    reload() {
        // TODO: add a way to not reload completely the user ;)
        return User.load(this.id);
    }

    save() {
        const misc_dict = this._misc;
        misc_dict.updated_at = moment().unix();
        if (misc_dict.created_at === 0) {
            misc_dict.created_at = misc_dict.updated_at;
        }

        const promises = [redis_clients.main.hmset(_misc_key(this._id), misc_dict)];
        if (!_.isEmpty(this._selected_layers)) {
            promises.push(
                redis_clients.main.hmset(_selected_layers_key(this._id), this._selected_layers)
            );
        }
        if (!_.isEmpty(this._added_sources_id)) {
            const added_sources = _(this._sources)
                .at(Array.from(this._added_sources_id))
                .keyBy("id")
                .value();
            promises.push(
                redis_clients.main.hmset(
                    _sources_key(this._id),
                    _.mapValues(added_sources, source => JSON.stringify(source))
                )
            );
        }
        if (!_.isEmpty(this._deleted_sources_id)) {
            promises.push(
                redis_clients.main.hdel(
                    _sources_key(this._id),
                    Array.from(this._deleted_sources_id)
                )
            );
        }
        return bluebird.all(promises).then(results => {
            this._dirty = false;
            this._added_sources_id = new Set();
            this._deleted_sources_id = new Set();
            this._misc = misc_dict;
            return results;
        });
    }

    add_source(source, with_alias=false) {
        if (!with_alias) {
            return bluebird.resolve(this._add_source(source));
        }

        // FIXME: this is not transactionally safe
        return User.get_alias(source.id)
            .then(aliased_id => {
                if (aliased_id === null || aliased_id === this.id) {
                    // alias not found, or alias already set to current user
                    this._add_source(source);
                    return User.create_alias(source.id, this.id);
                }
                throw new errors.KinSourceAlreadyUsed(source.id);
            });
    }

    _add_source(source) {
        this._added_sources_id.add(source.id);
        this._sources[source.id] = source;
        this._dirty = true;
    }

    delete_source(source) {
        if (source.id === this.id) {
            return bluebird.resolve(this._delete_source(source));
        }

        if (source.id in this._sources) {
            return User.delete_alias(source.id)
                .then(this._delete_source.bind(this, source));
        }

        return bluebird.reject(new errors.KinSourceNotFoundError(source.id));
    }

    _delete_source(source) {
        // TODO: we shoud probably delete the selected layers as well
        this._deleted_sources_id.add(source.id);
        delete this._sources[source.id];
        this._dirty = true;
    }

    get_source(source_id) {
        return this._sources[source_id];
    }

    is_layer_selected(layer_id) {
        return _.get(this._selected_layers, layer_id, false);
    }

    toggle_selected_layer(layer_id, selected = false) {
        if (!_.isBoolean(selected)) {
            return false;
        }

        const current = this._selected_layers[layer_id];
        if (current !== selected) {
            this._selected_layers[layer_id] = selected;
            this._dirty = true;
        }
        return true;
    }

    should_refresh(source_id) {
        return redis_clients.main.shouldRefresh(_sources_key(this.id), source_id);
    }
}

module.exports = User;
