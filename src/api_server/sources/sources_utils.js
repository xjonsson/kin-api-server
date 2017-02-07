/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */

const fs = require('fs');
const path = require('path');

const { logger } = require('../config');


function require_from_all_sources(file_name) {
    const modules = {};
    fs
        .readdirSync(__dirname)
        .filter((relative_path) => {
            const absolute_path = path.resolve(__dirname, relative_path);
            return fs.statSync(absolute_path).isDirectory();
        })
        .forEach((source_name) => {
            try {
                const source_dir_absolute_path = path.resolve(__dirname, source_name, file_name);
                const module = require(source_dir_absolute_path); // eslint-disable-line global-require, import/no-dynamic-require
                modules[source_name] = module;
            } catch (err) {
                logger.warn(`could not load file ${file_name} for source ${source_name}: ${err}`);
            }
        });
    return modules;
}


module.exports = {
    require_from_all_sources,
};
