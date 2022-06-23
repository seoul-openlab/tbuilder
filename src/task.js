
import gulp from 'gulp';
import through2 from 'through2';
import proj4 from 'proj4';
import glob from 'glob';

import {indexTiles} from './index-tiles';
import {generateB3dmTile} from './generate-gltf-tiles.js';
import {transformEcefGltf} from './transform-ecef-gltf.js';
import {convertB3dmAndTileset} from './convertB3dmAndTileset.js';
import {citygmlToTileset} from './citygml2gltf';

// define EPSG proj
proj4.defs('EPSG:4326','+ellps=WGS84 +proj=longlat +datum=WGS84 +no_defs');
proj4.defs('EPSG:3857','+ellps=WGS84 +proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 +a=6378137 +b=6378137 +units=m +no_defs');
proj4.defs('EPSG:5186','+ellps=GRS80 +proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +units=m +no_defs');
proj4.defs('EPSG:5181','+ellps=GRS80 +proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +units=m +no_defs');
proj4.defs('EPSG:32652','+proj=utm +zone=52 +ellps=WGS84 +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:4978' ,'+ellps=WGS84 +proj=geocent +units=m +no_defs +datum=WGS84'         ); //ECEF
proj4.defs('EPSG:unity','+ellps=WGS84 +proj=geocent +units=m +no_defs +a=6378137 +b=6378137'); //ECEF of Unity

//
// gulp task function
//
export function buildTilesetV3(config, tileset) {
    // tile sources
    config.currentTileset = tileset;
    const tilesetLayers = config.layers.filter(x=>{
        return x.tileset === tileset;
    });
    const sources = tilesetLayers.map(layer => {
        return layer.pathPattern;
    });
    //
    return gulp.src(sources) 
    .pipe(convertB3dmAndTileset(config))
    //.pipe(generateTileGltf(config))
    .pipe(through2.obj(function (file, _, callback) {
        console.log(`tile=${file.path}`);
        callback(null, file);
    }))
    .pipe( gulp.dest(`./dest/${tileset}/`) );
}

export function buildTilesetV1(config, tileset) {
    // tile sources
    config.currentTileset = tileset;
    const tilesetLayers = config.layers.filter(x=>{
        return x.tileset === tileset;
    });
    const sources = tilesetLayers.map(layer => {
        return layer.pathPattern;
    });
    //
    return gulp.src(sources) 
    .pipe(transformEcefGltf(config))
    //.pipe(generateTileGltf(config))
    .pipe(through2.obj(function (file, _, callback) {
        console.log(`tile=${file.path}`);
        callback(null, file);
    }))
    .pipe( gulp.dest(`./dest/${tileset}/`) );
}

export function tilesetToSQLite(sources) {
    // tile sources
    config.currentTileset = tileset;
    const tilesetLayers = config.layers.filter(x=>{
        return x.tileset === tileset;
    });
    const srcs = tilesetLayers.map(layer => {
        return layer.useIndexJson ? layer.pathPattern.substr(
            0, layer.pathPattern.lastIndexOf("*.")) + "index.json" 
            : layer.pathPattern;
    });
    //
    return gulp.src(srcs) 
    .pipe(indexTiles(config))
    .pipe(through2.obj(function (file, _, callback) {
        console.log(`file=${file.path}`);
        callback(null, file);
    }))
    .pipe(generateB3dmTile(config))
    .pipe( gulp.dest(`./dest/${tileset}/`) );
}

export function buildTilesetCityGML(config, tileset) {
    // tile sources
    config.currentTileset = tileset;
    const tilesetLayers = config.layers.filter(x=>{
        return x.tileset === tileset;
    });
    const sources = [];
    tilesetLayers.forEach(layer => {
        const files = glob.sync(layer.pathPattern);
        sources.push(...files);
    });
    console.log(`sources=${sources}`);
    //
    citygmlToTileset(sources, './dest/citygml/');
}

export function buildTileset(config, tileset) {
    // tile sources
    config.currentTileset = tileset;
    const tilesetLayers = config.layers.filter(x=>{
        return x.tileset === tileset;
    });
    const sources = tilesetLayers.map(layer => {
        return layer.useIndexJson ? layer.pathPattern.substr(
            0, layer.pathPattern.lastIndexOf("*.")) + "index.json" 
            : layer.pathPattern;
    });
    console.log(`sources=${sources}`);
    //
    return gulp.src(sources) 
    .pipe(indexTiles(config))
    .pipe(through2.obj(function (file, _, callback) {
        console.log(`index=${file.path}`);
        callback(null, file);
    }))
    .pipe(generateB3dmTile(config))
    .pipe( gulp.dest(`./dest/${tileset}/`) );
}
