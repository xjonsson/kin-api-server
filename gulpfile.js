/*!
 * kin
 * Copyright(c) 2016-2017 Benoit Person
 * Apache 2.0 Licensed
 */


"use strict";

const del = require('del');
const eslint = require('gulp-eslint');
const fs = require('fs');
const gulp = require('gulp');
const gulp_mocha = require('gulp-spawn-mocha');
const gutil = require('gulp-util');
const plumber = require('gulp-plumber');
const pm2 = require('pm2');
const vfs = require('vinyl-fs');
const _ = require('lodash');


/**
 *  Environments configuration
 */
const chalk = require('chalk');
const ALLOWED_ENVS = ['dev', 'prod', 'preprod'];
const env_name = process.env.NODE_ENV;
if (ALLOWED_ENVS.indexOf(env_name) != -1) {
    console.log(`Running environment ${chalk.green(env_name)}`);
} else {
    console.error(chalk.red(`Environment ${chalk.blue(env_name)} not in ${chalk.yellow(ALLOWED_ENVS)}`));
    process.exit(1);
}


/**
 * Globbing expressions
 */
const api_server_files = 'src/api_server/**/*.js';
const test_files = 'test/**/*.js';


/**
 * Main tasks
 */

// TODO: symlinks will be overriden by folders, but the reverse isn't true:
//    dev -> prod: OK
//    prod -> dev: KO   e.g: you will need to clean `servers/`
gulp.task('api-server', () => {
    if (env_name === 'prod' || env_name === 'preprod') {
        return gulp.src(api_server_files)
            .pipe(plumber())
            .pipe(gulp.dest('servers/api_server'));
    } else {
        return vfs.src('src/api_server').pipe(vfs.symlink('servers/'));
    }
});

gulp.task('servers', ['api-server', ]);

gulp.task('lint', () => {
    return gulp.src([
        api_server_files,
        test_files
    ])
        .pipe(eslint())
        .pipe(eslint.format())
});

gulp.task('watch', ['lint', 'graceful-reload'], () => {
    return gulp.watch(
        [
            api_server_files,
        ],
        ['lint', 'graceful-reload']
    );
});

gulp.task('graceful-reload', ['servers'], (cb) => {
    pm2.connect(function(error) {
        if (error) {
            console.error(error);
            process.exit(2);
        }

        pm2.reload('all', (error) => {
            if (error) {
                console.error(error);
                process.exit(3);
            }
            pm2.disconnect();
            cb();
        });
    });

});


/**
 * Test tasks
 */
gulp.task('coverage', ['_set-test-node-env'], () => {
    return gulp
        .src(test_files, { read: false})
        .pipe(gulp_mocha({
            istanbul: true,
        }));
});

gulp.task('test', ['_set-test-node-env'], () => {
    return gulp
        .src(test_files, { read: false})
        .pipe(gulp_mocha());
});

gulp.task('test-watch', ['test'], () => {
    return gulp.watch(
        [
            api_server_files,
            test_files
        ],
        ['test']
    );
});

gulp.task('_set-test-node-env', function() {
    return process.env.NODE_ENV = 'test';
});


/**
 * Utils tasks
 */
gulp.task('clean', () => {
    del([
        './public/*.otf',
        './public/*.html',
        './public/*.css',
        './public/*.map',
        './public/*.js',
        './public/*.png',
    ]);
});

gulp.task('pm', () => {
    const PM_SERVERS_TEMPLATES = {
        dev: {
            api_server: {
                name: 'kin-api',
                args: '--color',
                exec_mode: 'cluster',
                instances: 2,
                script: './servers/api_server/api.js',
                env: {
                    NODE_ENV: 'dev',
                    // 'DEBUG': 'express:*',
                },
                maxRestarts: 2,
            },
        },
        preprod: {
            api_server: {
                name: 'kin-api',
                args: '--color',
                exec_mode: 'cluster',
                instances: 5,
                script: './servers/api_server/api.js',
                env: {
                    NODE_ENV: 'preprod',
                    UV_THREADPOOL_SIZE: 32,
                },
            },
        },
        prod: {
            api_server: {
                name: 'kin-api',
                args: '--color',
                exec_mode: 'cluster',
                instances: 5,
                script: './servers/api_server/api.js',
                env: {
                    NODE_ENV: 'production',
                    UV_THREADPOOL_SIZE: 32,
                },
            },
        },
    }
    const pm_output = {
        apps: [
            PM_SERVERS_TEMPLATES[env_name].api_server,
        ]
    };
    fs.writeFileSync('./pm.json', JSON.stringify(pm_output, null, 4));
});
