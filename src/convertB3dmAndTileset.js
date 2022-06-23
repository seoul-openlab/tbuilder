
import through2 from 'through2';
import vinylFile from 'vinyl';
import fs from 'fs';
import path from 'path';
import proj4 from 'proj4';
import minimatch from 'minimatch';
import {tileToBBox,tileToQuadkey, quadkeyToTile, lngLatToTile} from 'global-mercator';
import { Matrix4, Vector3, Box3, LoadingManager, Scene } from "three-universal/build/three.module.node";
import { MTLLoader } from "three-universal/examples/node-jsm/loaders/MTLLoader";
import { OBJLoader } from "three-universal/examples/node-jsm/loaders/OBJLoader";
import Canvas from 'canvas';
import {glbToB3dm} from './glb2b3dm';
//import { GLTFExporter } from "three-universal/examples/node-jsm/exporters/GLTFExporter.js";
import { GLTFExporter } from "./GLTFExporter.js";

// https://github.com/jsdom/jsdom/issues/1749
global.ImageData = Canvas.ImageData;

//
// load3dModel
//
function load3dModel(format, srcFile) {
    return new Promise((resolve, reject)=>{
        try {
            format = format.toLowerCase();
            const srcDir  = path.dirname(srcFile) + path.sep;
            const srcBase = path.basename(srcFile);
            if (format === 'obj') {
                const loadingManager = new LoadingManager( function () {
                    // persist raw MTL material object into MeshMaterial
                    for( var k in materials.materialsInfo) {
                        var m = materials.materials[k];
                        m.raw = JSON.stringify(materials.materialsInfo[k]);
                        //console.log(`m.name=${m.name} ${m.map.image}`);
                    }
                    var model = new OBJLoader().setMaterials( materials ).setPath( srcDir ).parse(
                        fs.readFileSync(srcFile).toString()
                    );
                    //console.log(`<=${srcFile}`);
                    resolve(model);
                } );
                var materials = new MTLLoader(loadingManager).setPath( srcDir ).parse( 
                    fs.readFileSync(srcFile.replace('.obj', '.mtl')).toString(), 'file:///' + srcDir
                );
                materials.preload();
                //console.log(`>=${srcFile}`);
            } else if (format === 'fbx') {
                try {
                    new FBXLoader().setPath( srcDir ).load(
                        srcBase, resolve, undefined, onError 
                    );
                } catch(e) {
                    onError( e );
                }
            }
        } catch(e) {
            reject(e);
        }
    });
}

function exportMeshToGltf(scene, options) {
    return new Promise((resolve, reject)=>{
        new GLTFExporter().parse(scene, resolve, options);
    });
}

function enuToEcefMatrix(T,lon,lat) {
    var r = lon*Math.PI/180, p = lat*Math.PI/180;
    var sr = Math.sin(r), cr = Math.cos(r);
    var sp = Math.sin(p), cp = Math.cos(p);
    //console.log(`${p}/${r}/${x}/${y}/${z}`);
    /*return [
        -sr*x + -sp*cr*y + cp*cr*z + ecef[0],
         cr*x + -sp*sr*y + cp*sr*z + ecef[1],
         0    +  cp   *y + sp   *z + ecef[2]
    ]*/
    /*
    |  sr cp*cr -sp*cr Tx |   | -sr -sp*cr cp*cr Tx |   | -1 0 0 0 |
    | -cr cp*sr -sp*sr Ty |   |  cr -sp*sr cp*sr Ty |   |  0 0 1 0 |
    |   0 sp     cp    Tz | = |  0   cp    sp    Tz | * |  0 1 0 0 | 
    |   0  0     0     1  |   |  0   0     0     1  |   |  0 0 0 1 |
    */
    return new Matrix4().set(
            sr,   -cr,     0, 0,
         cp*cr, cp*sr,    sp, 0,
        -sp*cr,-sp*sr,    cp, 0,
          T[0],  T[1],  T[2], 1
    );
}

///
/// Generate cesium b3dm 3d tile
///
export function convertB3dmAndTileset(config) {
    //
    const indexJsonCache = {};
    var scratchV = new Vector3();
    //
    async function bufferContents(file, _, cb) {
        // 0.1 Query lauyer
        const layer = config.layers.find(l => {
            return minimatch(file.path, l.pathPattern);
        });//console.log(`layer=${JSON.stringify(layer)}`);
        // 0.2 Use index.json to transform file
        let index = undefined;
        if (layer.useIndexJson) {
            const indexPath = path.join(path.dirname(file.path),"index.json");
            if (!indexJsonCache[indexPath]) {
                const indexJson = JSON.parse(fs.readFileSync(indexPath).toString());
                indexJsonCache[indexPath] = indexJson;
                if (!!indexJson.objects && Array.isArray(indexJson.objects)) {
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
                    });
                }
            }
            const indexJson = indexJsonCache[indexPath];
            //console.log(`indexJson=${indexJson.objects}/${!!indexJson.objects && Array.isArray(indexJson.objects)}`);
            if (!!indexJson.objects && Array.isArray(indexJson.objects)) {
                const baseName = path.basename(file.path);
                index = indexJson.objects.find(x=>x.fileName == baseName);
            }
        }
        // 1. Load 3d mesh
        //
        const groupMesh = await load3dModel(layer.fileType, file.path).catch(
                e=>console.log(`load3dModel catch! ${e}`)
        );
        // Workaround
        // THREE.GLTFExporter: userData of '' won't be serialized because of JSON.stringify error - Maximum call stack size exceeded 
        groupMesh.children.forEach(mesh=>{
            mesh.material.userData = {};
            mesh.geometry.userData = {};
        })
        //console.log(`srcPath=${file.path} groupMesh.isGroup=${groupMesh.isGroup}`);
        // Transform To ECEF Coordinate 
        if (!!index && !!index.center && layer.srid === 'unity') {
            const enuToEcef = enuToEcefMatrix(proj4('EPSG:unity', 'EPSG:4978', 
                    [-index.center.z,index.center.x,index.center.y]),
                index.center.lon, index.center.lat
            );
            groupMesh.applyMatrix4(enuToEcef);
        } else if (layer.srid !== 4978) {
            groupMesh.children.forEach(mesh=>{
                var attrPosition = mesh.geometry.attributes.position;
                const srcSrid = `EPSG:${layer.srid}`;
                for (var i = 0, l = attrPosition.count; i < l; i++) {
                    scratchV.x = attrPosition.getX(i);
                    scratchV.y = attrPosition.getY(i);
                    scratchV.z = attrPosition.getZ(i);
                    const ecef = proj4(srcSrid, 'EPSG:4978', scratchV);
                    attrPosition.setXYZ(i, ecef.x,ecef.y,ecef.z);
                }
            });
        }
        // CESIUM_RTC
        const scene  = new Scene();
        const bbox   = new Box3().setFromObject(groupMesh);
        const cent   = [0.5*(bbox.min.x+bbox.max.x), 0.5*(bbox.min.y+bbox.max.y), bbox.min.z];
        const matRtc = new Matrix4().makeTranslation(-cent[0],-cent[1],-cent[2]);
        groupMesh.applyMatrix4(matRtc);
        scene.add(groupMesh);
        scene.userData.gltfExtensions = {CESIUM_RTC: { center: cent}};
        const llmin = proj4('EPSG:4978', 'EPSG:4326', bbox.min);
        const llmax = proj4('EPSG:4978', 'EPSG:4326', bbox.max);
        const bboxRegion = [llmin.x,llmin.y, llmax.x,llmax.y, llmin.z,llmax.z];
        //
        // convert gltf
        const glb = await exportMeshToGltf(scene, {
            binary                 : true,
            embedImages            : true,
            includeCustomExtensions: true,
            maxTextureSize: 512, // NOTE! when maxTextureSize is greater than 256, "Segmentation fault" may be raised
        });
        /* b3dm
        const b3dm = glbToB3dm(Buffer.from(glb), undefined, undefined, undefined, undefined);
        // NOTE!
        //   THREE.GLTFExporter: userData of '' won't be serialized because of JSON.stringify error - Maximum call stack size exceeded
        const b3dmFile = new vinylFile({
            path: `${scene.uuid}.b3dm`, // file.path.replace(/\.[^.]+$/, '.b3dm')
            contents: b3dm, 
            bboxRegion: bboxRegion,
        });*/
        const b3dmFile = new vinylFile({
            path: `${scene.uuid}.glb`, // file.path.replace(/\.[^.]+$/, '.b3dm')
            contents: Buffer.from(glb), 
            bboxRegion: bboxRegion,
        });
        // ToDo! gltfTile.featureProperties = {}
        cb(null, b3dmFile);
    }
    //
    return through2.obj(bufferContents);
}