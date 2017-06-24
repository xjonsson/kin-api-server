module.exports = {
    extends: ["airbnb", "prettier"],
    parserOptions: {
        ecmaVersion: 6,
        sourceType: "module",
        ecmaFeatures: {
            impliedStrict: true
        }
    },
    rules: {
        camelcase: "off",
        "no-underscore-dangle": "off",
        indent: ["error", 4],

        //TODO: those could probably be re-enabled
        "new-cap": [
            "error",
            {
                capIsNewExceptions: ["JWTRedisSession"]
            }
        ],

        // Disable preference because mocha recommends not using arrow functions
        "prefer-arrow-callback": "off",

        // Prevent warnings for function in mocha's describe/it
        "func-names": "off",

        // Disabling this because of chai's `expect` format
        //
        // https://github.com/eslint/eslint/issues/2102
        "no-unused-expressions": "off",

        // Both styles are awesome ;)
        "arrow-body-style": "off",

        // This rule is stoopid ;)
        "class-methods-use-this": "off",

        // To enable 100char lines with comments
        "max-len": [
            "error",
            100,
            2,
            {
                ignoreUrls: true,
                ignoreComments: true,
                ignoreStrings: true,
                ignoreTemplateLiterals: true
            }
        ],

        // TODO: comment
        "comma-dangle": "off",

        // TODO: comment
        "no-bitwise": "off"
    }
};
