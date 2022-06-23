
import through2 from 'through2';
import vinylFile from 'vinyl';
import fs from 'fs';
import path from 'path';
import proj4 from 'proj4';
import {tileToBBox,tileToQuadkey, quadkeyToTile, lngLatToTile} from 'global-mercator';
import { Matrix4, Vector3, Box3, LoadingManager, Scene } from "three-universal/build/three.module.node";
import { MTLLoader } from "three-universal/examples/node-jsm/loaders/MTLLoader";
import { OBJLoader } from "three-universal/examples/node-jsm/loaders/OBJLoader";
import { FBXLoader } from "three-universal/examples/node-jsm/loaders/FBXLoader";
import { TDSLoader } from "three-universal/examples/node-jsm/loaders/TDSLoader";
import { GLTFLoader } from "three-universal/examples/node-jsm/loaders/GLTFLoader";
import { BufferGeometryUtils } from "three-universal/examples/node-jsm/utils/BufferGeometryUtils";
import Canvas from 'canvas';
//import { GLTFExporter } from "three-universal/examples/node-jsm/exporters/GLTFExporter.js";
import { GLTFExporter } from "./GLTFExporter.js";
import {glbToB3dm} from './glb2b3dm';
import {enuToEcefMatrix} from './convertUtil';
import {citygmlToGltf} from './citygml2gltf';

// https://github.com/jsdom/jsdom/issues/1749
global.ImageData = Canvas.ImageData;

//
// load3dModel
//
function load3dModel(format, srcFile) {
    return new Promise((resolve, reject)=>{
        try {
            format = format.toLowerCase();
            const srcDir  = path.dirname(srcFile).replace(/\\/g,'/') + '/';
            const srcBase = path.basename(srcFile);
            if (format === 'obj') {
                const loadingManager = new LoadingManager(()=>{
                    var model = new OBJLoader(loadingManager)
                    .setMaterials( materials )
                    .setPath( srcDir )
                    .parse(
                        fs.readFileSync(srcFile).toString()
                    );
                    //console.log(`<=${srcFile}`);
                    resolve(model);
                }).setURLModifier((url)=>'file:///'+url);
                var materials = new MTLLoader(loadingManager).setPath( srcDir ).parse( 
                    fs.readFileSync(srcFile.replace('.obj', '.mtl')).toString(), srcDir
                );
                loadingManager.itemStart();
                materials.preload();
                setTimeout( function () {
                    loadingManager.itemEnd();
                }, 0 );
                //console.log(`>=${srcFile}`);
            } else if (format === 'fbx') {
                try {
                    const loadingManager = new LoadingManager(()=>{
                        console.log(`<=${srcFile}`);
                        resolve(model);
                    } ).setURLModifier((url)=>'file:///'+url);
                    var model = new FBXLoader(loadingManager).setPath( srcDir ).parse(
                        fs.readFileSync(srcFile).buffer, srcDir
                    );
                } catch(e) {
                    onError( e );
                }
            } else if (format === '3ds') {
                try {
                    const loadingManager = new LoadingManager(()=>{
                        //console.log(`<=${srcFile}`);
                        resolve(model);
                    } ).setURLModifier((url)=>'file:///'+url);
                    var model = new TDSLoader(loadingManager).setPath( srcDir ).parse(
                        fs.readFileSync(srcFile).buffer, srcDir
                    );
                } catch(e) {
                    onError( `3ds.loader ${JSON.stringify(e)}` );
                }
            } else if (format === 'citygml') {
                try {
                    citygmlToGltf(srcFile).then(gltf=>{
                        var model = new GLTFLoader().setPath( srcDir ).parse(
                            gltf, `/${srcDir}`
                        );
                        resolve(model);
                    });
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

///
/// Generate cesium b3dm 3d tile
///
export function generateB3dmTile(config) {
    //
    var rootTileset = {
        asset: {
            version: "1.0",
            tilesetVersion: "tbuilder v1.0",
            gltfUpAxis: "Z",
        },
        geometricError:  40075017,
        root: {
            boundingVolume: { // order [west, south, east, north, minimum height, maximum height]
                region: [...tileToBBox([0,0,0]), 0,0]
            },
            geometricError: 40075017,
            refine: "REPLACE",
            children: []
        }
    }
    //
    var parentTiles = {'0/0/0': {t:rootTileset.root, x:0, y:0, z:0, w:0}};
    var scratchV = new Vector3();
    //
    async function bufferContents(file, _, cb) {
        file.path = file.path.replace(/\\/g,'/');
        const tileSources = JSON.parse(file.contents);
        const tidx  = quadkeyToTile(file.path); // https://www.npmjs.com/package/global-mercator
        const tbox  = tileToBBox(tidx);
        const tcent = proj4('EPSG:4326', 'EPSG:4978', new Vector3(0.5*(tbox[0]+tbox[2]),0.5*(tbox[1]+tbox[3]),0));
        const models = [];
        //
        for (var k = 0, kn = tileSources.length; k < kn; k++) {
            var src = tileSources[k];
            console.log(`tile=${tidx[2]}/${tidx[0]}/${tidx[1]}![${k}/${kn}] ${src.path}`);
            const groupMesh = await load3dModel(src.layer.fileType, src.path).catch(
                e=>console.log(`load3dModel catch! ${e}`)
            );
            //console.log(`srcPath=${src.path}`);
            models.push(groupMesh);
            const srcSrid = `EPSG:${src.layer.srid}`;
            //console.log(`srcPath=${src.path} groupMesh.isGroup=${groupMesh.isGroup}`);
            if (!!src.index && !!src.index.center && src.layer.srid === 'unity') {
                const enuToEcef = enuToEcefMatrix(
                        //proj4('EPSG:unity', 'EPSG:4978', [-src.index.center.z,src.index.center.x,src.index.center.y]),
                        proj4('EPSG:4326', 'EPSG:4978', [src.index.center.lon,src.index.center.lat,src.index.heightOfDEM]),
                        src.index.center.lon, src.index.center.lat
                );
                //enuToEcef.multiply(new Matrix4().makeScale(0.25, 1, 0.25));
                //console.log(`enuToEcef=${JSON.stringify(enuToEcef)}`);
                groupMesh.children.forEach(mesh=>{
                    var attrPosition = mesh.geometry.attributes.position;
                    //console.log(`B ${attrPosition.getX(0)},${attrPosition.getY(0)},${attrPosition.getZ(0)}`);
                    mesh.geometry.applyMatrix4(enuToEcef);
                    //console.log(`A ${attrPosition.getX(0)},${attrPosition.getY(0)},${attrPosition.getZ(0)}`);
                });
            } else if (src.layer.srid !== 4978) {
                groupMesh.children.forEach(mesh=>{
                    var attrPosition = mesh.geometry.attributes.position;
                    for (var i = 0, l = attrPosition.count; i < l; i++) {
                        scratchV.x = attrPosition.getX(i);
                        scratchV.y = attrPosition.getY(i);
                        scratchV.z = attrPosition.getZ(i);
                        const ecef = proj4(srcSrid, 'EPSG:4978', scratchV);
                        attrPosition.setXYZ(i, ecef.x,ecef.y,ecef.z);
                    }
                });
            }
        };
        // merge models into single mesh
        const mergingMeshsDic = {};
        const mergedMaterials = [];
        const mergedMeshs     = [];
        const scene           = new Scene();
        models.forEach(groupMesh=>{
            groupMesh.children.forEach(mesh=>{
                var matName = `${mesh.material.name}!${Object.keys(mesh.geometry.attributes).sort().join(',')}`;
                //console.log(`matName=${matName}`);
                if (!!!mergingMeshsDic[matName]) {
                    var m = {mesh: mesh, materialIndexOffset: mergedMaterials.length, ref: 0};
                    mergingMeshsDic[matName] = m;
                    mergedMeshs.push(m.mesh); // NOTE! DO NOT call scene.add at here since groupMesh erase the child
                    mergedMaterials.push(mesh.material); // mesh.geometry instanceof BufferGeometry
                } else {
                    var m = mergingMeshsDic[matName];
                    m.mesh.geometry = BufferGeometryUtils.mergeBufferGeometries([m.mesh.geometry, mesh.geometry]);
                    m.ref++;
                }
            });
        });
        mergedMeshs.forEach(m=>{
            scene.add(m);
        });
        // RTC
        const tboxG  = new Box3().setFromObject(scene);
        const cent   = [0.5*(tboxG.min.x+tboxG.max.x), 0.5*(tboxG.min.y+tboxG.max.y), tboxG.min.z];
        const matRtc = new Matrix4().makeTranslation(-cent[0],-cent[1],-cent[2]);
        scene.traverse(function(obj){
            if(obj.type === 'Mesh'){
                //var attrPosition = obj.geometry.attributes.position;
                //console.log(`B ${attrPosition.getX(0)},${attrPosition.getY(0)},${attrPosition.getZ(0)}`);
                obj.geometry.applyMatrix4(matRtc);
                //console.log(`A ${attrPosition.getX(0)},${attrPosition.getY(0)},${attrPosition.getZ(0)}`);
                // Workaround
                // THREE.GLTFExporter: userData of '' won't be serialized because of JSON.stringify error - Maximum call stack size exceeded 
                obj.material.userData = {};
                obj.geometry.userData = {};
            }
        });
        scene.userData.gltfExtensions = {CESIUM_RTC: { center: cent}};
        //console.log(`scene.geometry.boundingBox=${JSON.stringify(new Box3().setFromObject(scene))}`);
        //console.log(`${tidx[2]}/${tidx[0]}/${tidx[1]}: ${mergedMeshs.length}mesh/${models.length}models/${tileSources.length}files`);
        // export merged mesh into glb
        const glb = await exportMeshToGltf(scene, {
            binary: true,
            embedImages: true,
            includeCustomExtensions: true,
            maxTextureSize: 512, // NOTE! when maxTextureSize is greater than 256, "Segmentation fault" may be raised
        });
        //console.log(`OnGlbDone=${file.path}`);
        //
        // b3dm
        //
        const b3dm = glbToB3dm(Buffer.from(glb), undefined, undefined, undefined, undefined);
        // NOTE!
        //   THREE.GLTFExporter: userData of '' won't be serialized because of JSON.stringify error - Maximum call stack size exceeded
        const b3dmTile = new vinylFile({
            path: `${tidx[2]}/${tidx[0]}/${tidx[1]}.b3dm`,
            contents: b3dm 
        });
        // ToDo! gltfTile.featureProperties = {}
        //console.log(`OnB3dmDone=${file.path} tboxG=${JSON.stringify(tboxG)}`);
        // tileset
        // compute minHeight, maxHeight in 
        tboxG.min = proj4('EPSG:4978', 'EPSG:4326', tboxG.min);
        tboxG.max = proj4('EPSG:4978', 'EPSG:4326', tboxG.max);
        var childTile = {t:{
            boundingVolume: {
                region: [Math.min(tboxG.min.x,tboxG.max.x)*Math.PI/180,Math.min(tboxG.min.y,tboxG.max.y)*Math.PI/180,
                    Math.max(tboxG.min.x,tboxG.max.x)*Math.PI/180,Math.max(tboxG.min.y,tboxG.max.y)*Math.PI/180,
                    tboxG.min.z,tboxG.max.z]
            },
            geometricError: 40075016.68558/(1<<tidx[2]),
            content: {
                uri: `${tidx[2]}/${tidx[0]}/${tidx[1]}.b3dm`
            }
        }, x:tidx[0], y:tidx[1], z:tidx[2], w:0};
        //
        for( var tz = tidx[2]-1, ty = tidx[1]>>1, tx = tidx[0]>>1; tz >= 0; tz--, tx>>=1, ty>>=1) {
            var key = `${tz}/${tx}/${ty}`;
            if (!parentTiles[key]) {
                const tbox = tileToBBox([tx,ty,tz]);
                tbox[0] *= Math.PI/180; tbox[1] *= Math.PI/180; tbox[2] *= Math.PI/180; tbox[3] *= Math.PI/180;
                tbox.push(childTile.t.boundingVolume.region[4]); tbox.push(childTile.t.boundingVolume.region[5]);
                var baseTile = {t:{
                    boundingVolume: {
                        region: tbox
                    },
                    geometricError: 40075016.68558/(1<<tz),
                    children: [childTile.t],
                }, x:tx, y:ty, z:tz, w:1<<(childTile.y-(ty<<1))*2+(childTile.x-(tx<<1))};
                parentTiles[key] = baseTile;
            } else {
                baseTile = parentTiles[key];
                const br = baseTile.t.boundingVolume.region;
                br[4] = Math.min(br[4], childTile.t.boundingVolume.region[4]);
                br[5] = Math.max(br[5], childTile.t.boundingVolume.region[5]);
                var w = 1<<(childTile.y-(baseTile.y<<1))*2+(childTile.x-(baseTile.x<<1));
                if ((baseTile.w & w) == 0) {
                    baseTile.t.children.push(childTile.t);
                    baseTile.w |= w;
                }
            }
            childTile = baseTile;
        }
        // 
        cb(null, b3dmTile); // endStream function will be called! 
    }
    //
    function endStream(cb) {
        // trim root to single parent
        var p = rootTileset.root;
        while (!!p.children && p.children.length === 1) {
            p = p.children[0];
        }
        rootTileset.root = p;
        rootTileset.geometricError = rootTileset.root.geometricError;
        //console.log(`rootTileset.root=${JSON.stringify(rootTileset.root)}`);
        //
        var tilesetJson = new vinylFile({
            path: `${config.currentTileset}.tileset.json`,
            contents: new Buffer.from(JSON.stringify(rootTileset))
        });
        this.push(tilesetJson);
        cb();
    }
    //
    return through2.obj(bufferContents, endStream);
}