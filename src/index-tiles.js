import through2 from 'through2';
import minimatch from 'minimatch';
import vinylFile from 'vinyl';
import fs from 'fs';
import path from 'path';
import proj4 from 'proj4';
import {tileToQuadkey, quadkeyToTile, lngLatToTile} from 'global-mercator';
import { Vector3, Box3 } from "three-universal/build/three.module.node";
import { FBXLoader } from "three-universal/examples/node-jsm/loaders/FBXLoader";
import { TDSLoader } from "three-universal/examples/node-jsm/loaders/TDSLoader";
import { OBJLoader } from "three-universal/examples/node-jsm/loaders/OBJLoader";
import { GLTFLoader } from "three-universal/examples/node-jsm/loaders/GLTFLoader";
import {citygmlToGltf} from './citygml2gltf';


export function indexTiles(config) {
    var tilesDic = {};
    var layerFiles = [];
    var layerFileDic = {};
    //
    function bufferContents(file, _, cb) {
        const ext = path.extname(file.path);
        if (ext === '.json') {
            const indexJson = JSON.parse(file.contents);
            if (!!indexJson.objects && Array.isArray(indexJson.objects)) {
                const dirName = path.dirname(file.path);
                indexJson.objects.forEach(x=>{
                    if (!!x.center) {
                        if (x.center.x !== undefined) {
                            x.center.x = parseFloat(x.center.x);
                        } 
                        if (x.center.y !== undefined) {
                            x.center.y = parseFloat(x.center.y);
                        } 
                        if (x.center.z !== undefined) {
                            x.center.z = parseFloat(x.center.z);
                        } 
                        if (x.center.lon !== undefined) {
                            x.center.lon = parseFloat(x.center.lon);
                        } 
                        if (x.center.lat !== undefined) {
                            x.center.lat = parseFloat(x.center.lat);
                        } 
                    }
                    if (!!x.heightOfDEM) {
                        x.heightOfDEM = parseFloat(x.heightOfDEM);
                    }
                    if (!!x.heightOfCenter) {
                        x.heightOfCenter = parseFloat(x.heightOfCenter);
                    }
                    if (!!x.id) {
                        let filePath = path.join(dirName, x.id);
                        const layer = config.layers.find(l => {
                            return minimatch(filePath+'.'+l.fileType, path.resolve(l.pathPattern));
                        });
                        if (!!layer) {
                            filePath = filePath+'.'+layer.fileType;
                            console.log(`layer=${path.resolve(layer.pathPattern)} filePath=${filePath}`);
                        }
                        if (!!layer && fs.existsSync(filePath)) {
                            if (!layerFileDic[layer.layerName]) {
                                layerFileDic[layer.layerName] = [];
                                layerFiles.push(layerFileDic[layer.layerName]);
                            }
                            layerFileDic[layer.layerName].push(filePath);
                            if (!!x.center && !!x.center.lon && !!x.center.lat) {
                                var tileIndex = lngLatToTile(
                                    [x.center.lon, x.center.lat], config.tileLevel
                                );
                                var tileKey = tileToQuadkey(tileIndex);
                                if (!tilesDic[tileKey]) {
                                    tilesDic[tileKey] = [];
                                }
                                tilesDic[tileKey].push({path:filePath.replace(/\\/g,'/'), layer:layer, index:x});
                            }
                        }
                    }
                })
            }
        } else {
            //console.log(`file.path=${file.path}`);
            const layer = config.layers.find(l => {
                return minimatch(file.path+'.'+l.fileType, path.resolve(l.pathPattern));
            });
            if (!!layer) {
                load3dModel(layer.fileType, file.path, (model)=>{
                    var bbox = (new Box3).setFromObject(model);
                    var center = bbox.getCenter(new Vector3());
                    //console.log(`format=${layer.fileType} center=${center.x},${center.y},${center.z}`);
                    // https://stackoverflow.com/questions/11782113/how-to-compute-bounding-box-after-using-objloader-three-js
                    var mcen = proj4(`EPSG:${layer.srid}`, 'EPSG:4326', [center.x, center.y]);
                    var tileIndex = lngLatToTile(mcen, config.tileLevel);
                    var tileKey = tileToQuadkey(tileIndex);
                    if (!tilesDic[tileKey]) {
                        tilesDic[tileKey] = [];
                    }
                    tilesDic[tileKey].push({path:file.path.replace(/\\/g,'/'), layer:layer});
                },(e)=>{
                    console.log(e);
                });
            }
        }
        cb();
    }
    //
    function endStream(cb) {
        Object.keys(tilesDic).forEach((k)=>{
            var tile = tilesDic[k];
            var ti = quadkeyToTile(k);
            //console.log(`${ti[2]}/${ti[0]}/${ti[1]}: ${tile.length} files`);
            this.push(new vinylFile({
                path: k,//`${ti[2]}/${ti[0]}/${ti[1]}`,
                contents: new Buffer.from(JSON.stringify(tile))
            }));
        });
        cb();
    }
    //
    return through2.obj(bufferContents, endStream);
}

//
// utility to load 3d model(.obj, .fbx only)
//
function load3dModel(format, srcFile, onParse, onError) {
    format = format.toLowerCase();
    const onComplete = model => {
        onParse(model);
    }
    const srcDir  = path.dirname(srcFile) + path.sep;
    const srcBase = path.basename(srcFile);
    if (format === 'obj') {
        try {
            // without MTL
            var model = new OBJLoader().setPath( srcDir ).parse(
                fs.readFileSync(srcFile).toString()
            );
            onComplete(model);
        } catch(e) {
            onError( e );
        }
    } else if (format === 'fbx') {
        try {
            var model = new FBXLoader().setPath( srcDir ).parse(
                fs.readFileSync(srcFile)
            );
            onComplete(model);
        } catch(e) {
            onError( e );
        }
    } else if (format === '3ds') {
        try {
            var model = new TDSLoader().setPath( srcDir ).parse(
                fs.readFileSync(srcFile).buffer, `/${srcDir}`
            );
            onComplete(model);
        } catch(e) {
            onError( e );
        }
    } else if (format === 'citygml') {
        try {
            citygmlToGltf(srcFile).then(gltf=>{
                var model = new GLTFLoader().setPath( srcDir ).parse(
                    gltf.buffer, `/${srcDir}`
                );
                onComplete(model);
            });
        } catch(e) {
            onError( e );
        }
    }
}