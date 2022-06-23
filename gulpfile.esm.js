'use strict';

import gulp from 'gulp';
import {buildTileset, buildTilesetCityGML} from './src/task.js';
import {buildDebugTileset} from './src/debug.js';
import config from './config.json';


export default gulp.parallel(hdmap,vworld_building,drone_manual);

function debug() {
    return buildDebugTileset(config, 'hdmap');
}
exports.debug = debug;

function hdmap() {
    //return buildDebugTileset(config, 'hdmap');
    return buildTileset(config, 'hdmap');
}
exports.hdmap = hdmap;

function hdmap1() {
    //return buildDebugTileset(config, 'hdmap');
    return buildTileset(config, 'hdmap1');
}
exports.hdmap1 = hdmap1;

function vworld_building() {
    return buildTileset(config, 'vworld-building');
}
exports.vworld_building = vworld_building;

function drone_manual() {
    return buildTileset(config, 'drone-manual');
}
exports.drone_manual = drone_manual;

function palace() {
    return buildTileset(config, 'palace');
}
exports.palace = palace;

function citygml(cb) {
    buildTilesetCityGML(config, 'citygml');
    cb();
}
exports.citygml = citygml;


/** 
 * references
 * What is gulp-multi-thread-task
 *   https://github.com/CT1994/gulp-multi-thread-task
 * 
 * gulp-image-resize
 *   https://www.npmjs.com/package/gulp-image-resize
 *   https://www.npmjs.com/package/image-js
 * 
 * https://github.com/izrik/FbxSharp
 * 
 * Gulp condition inside pipe
 *   https://stackoverflow.com/questions/27181719/gulp-condition-inside-pipe
 *   case 1
 *     .pipe(gulpif(condition1, g.dest(output.css)))
 *   case 2
 *      gulp.task('task', function () {
        let stream = gulp.src(sources.sass)
            .pipe(changed(output.css)).pipe(sass({
            style: 'compressed',
            sourcemap: true
            }));
        if (2 + 2 === 4) {
            stream = stream
            .pipe(someModule())
            .pipe(someModule2());
        }
        else {
            stream = stream
            .pipe(someModule3())
            .pipe(someModule4());
        }
        stream = stream.pipe(notify('scss converted to css and compressed'));
        return stream;
    }); 
 * 
*/