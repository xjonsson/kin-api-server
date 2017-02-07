module.exports = {
    "extends": "airbnb",
    "parserOptions": {
        "ecmaVersion": 6,
        "sourceType": "module",
        "ecmaFeatures": {
            "impliedStrict": true,
        }
    },
    "env": {
        "node": true,
    },
    "rules": {
        "camelcase": 0,
        "no-underscore-dangle": 0,
        "indent": ["error", 4],

        "new-cap": [2, {
            "capIsNewExceptions": ["JWTRedisSession"],
        }],
        "comma-dangle": 0,
        "max-len": ["error", 100, 2, {
            ignoreUrls: true,
            ignoreComments: true,
            ignoreStrings: true,
            ignoreTemplateLiterals: true,
        }],
        "class-methods-use-this": 0,
        "no-bitwise": 0,

        // Both styles are awesome ;)
        "arrow-body-style": 0,
    }
}
