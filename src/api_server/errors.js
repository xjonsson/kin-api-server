/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


/* eslint-disable class-methods-use-this */
class KinError extends Error {
    get status_code() { return 500; }
    get code() { return 10; }
    get params() { return {}; }
    get json() {
        return {
            code: this.code,
            error: this.message,
            params: this.params,
        };
    }
}


class KinDisconnectedSourceError extends KinError {
    constructor(source_id) {
        super(`disconnected source \`${source_id}\``);
        this.name = this.constructor.name;
        this._source_id = source_id;
    }

    get status_code() { return 400; }
    get code() { return 20; }
    get params() {
        return {
            source_id: this._source_id,
        };
    }
}


class KinActionNotSupportedError extends KinError {
    constructor(action, provider_name) {
        super(`action \`${action}\` not supported for provider \`${provider_name}\``);
        this.name = this.constructor.name;
    }

    get status_code() { return 400; }
    get code() { return 30; }
}


class KinSourceNotFoundError extends KinError {
    constructor(source_id) {
        super(`source \`${source_id}\` not found`);
        this.name = this.constructor.name;
        this._source_id = source_id;
    }

    get status_code() { return 404; }
    get code() { return 40; }
    get params() {
        return {
            source_id: this._source_id,
        };
    }
}


class KinUnauthenticatedUser extends KinError {
    constructor() {
        super('user not authenticated');
        this.name = this.constructor.name;
    }

    get status_code() { return 401; }
    get code() { return 50; }
}


class KinUserNoPlan extends KinError {
    constructor() {
        super('user has no plan');
        this.name = this.constructor.name;
    }

    get status_code() { return 403; }
    get code() { return 60; }
}


class KinUserExpiredPlan extends KinError {
    constructor() {
        super('user\'s plan has expired');
        this.name = this.constructor.name;
    }

    get status_code() { return 403; }
    get code() { return 70; }
}


class KinInvalidFormatError extends KinError {
    constructor(value, field, format) {
        super(`${field} (\`${value}\`) is in the wrong format \`${format}\``);
        this.name = this.constructor.name;
    }

    get status_code() { return 400; }
    get code() { return 60; }
}


class KinTimeRangeEmptyError extends KinError {
    constructor(start, end) {
        super(`time range between \`${start}\` and \`${end}\` is empty`);
        this.name = this.constructor.name;
    }

    get status_code() { return 400; }
    get code() { return 70; }
}


class KinLimitError extends KinError {
    constructor(field, limit) {
        super(`\`${field}\` reach the limit \`${limit}\``);
        this.name = this.constructor.name;
    }

    get status_code() { return 400; }
    get code() { return 80; }
}

class KinLayerNotFoundError extends KinError {
    constructor(layer_id) {
        super(`layer \`${layer_id}\` not found`);
        this.name = this.constructor.name;
        this._layer_id = layer_id;
    }

    get status_code() { return 404; }
    get code() { return 90; }
    get params() {
        return {
            layer_id: this._layer_id,
        };
    }
}


class KinRouteNotFound extends KinError {
    constructor() {
        super('route not found');
        this.name = this.constructor.name;
    }

    get status_code() { return 404; }
    get code() { return 100; }
}

module.exports = {
    KinError,
    KinDisconnectedSourceError,
    KinSourceNotFoundError,
    KinLayerNotFoundError,
    KinActionNotSupportedError,
    KinUnauthenticatedUser,
    KinUserNoPlan,
    KinUserExpiredPlan,
    KinInvalidFormatError,
    KinTimeRangeEmptyError,
    KinLimitError,
    KinRouteNotFound,
};
/* eslint-enable class-methods-use-this */
