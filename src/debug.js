
import gulp from 'gulp';
import through2 from 'through2';
import vinylFile from 'vinyl';
import fs from 'fs';
import path from 'path';
import { GLTFExporter } from "three-universal/examples/node-jsm/exporters/GLTFExporter.js";
import { MTLLoader } from "three-universal/examples/node-jsm/loaders/MTLLoader";
import { OBJLoader } from "three-universal/examples/node-jsm/loaders/OBJLoader";
import {LoadingManager} from "three-universal/build/three.module.node.js";
import { JSDOM } from 'jsdom';

const jsdom = new JSDOM(
	`<!DOCTYPE html><body id="main"><p >Hello world</p></body>`,
	{
        pretendToBeVisual: true,
        storageQuota: 1e9,
        resources: "usable",
        runScripts: "dangerously"
    }
);

export function buildDebugTileset0(tileset) {
    return gulp.src(['H:/OpenLab/도로3D_여의도 데이터/정밀도로지도-지형정합/과속방지턱/15/00116068/00116068_00279374/C419BS030044.obj']) 
    .pipe(through2.obj(function (file, _, cb) {
        //console.log(`tile=${file.path}`);
        try {
            /*const loadImage = src => new Promise((resolve, reject) => {
                const img = new jsdom.window.Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = src;
            });
            loadImage('file:///H:/OpenLab/도로3D_여의도 데이터/정밀도로지도-지형정합/과속방지턱/15/00116068/00116068_00279374/../../../../Resource/SpeedBump_Diffuse.jpg')
            .then(image => console.log(image, `\nloaded? ${image.complete} ${image.width}}`));*/
            const srcDir  = path.dirname(file.path) + path.sep;
            const loadingManager = new LoadingManager( function () {
                console.log(`materials.preload() done`);
                // persist raw MTL material object into MeshMaterial
                for( var k in materials.materialsInfo) {
                    var m = materials.materials[k];
                    m.raw = JSON.stringify(materials.materialsInfo[k]);
                    //console.log(`m.name=${m.name} ${m.map.image}`);
                }
                var model = new OBJLoader().setMaterials( materials ).setPath( srcDir ).parse(
                    fs.readFileSync(file.path).toString()
                );
                var gltfExp = new GLTFExporter();
                gltfExp.parse([model], (gltf)=>{
                    // https://threejs.org/docs/#examples/en/loaders/GLTFLoader
                    //(new GLTFLoader()).parse(gltf, (obj)=>{console.log(obj.scene);});
                    const scene = gltf.scenes[0];
                    scene.extensionsUsed.push('CESIUM_RTC');
                    if (!scene.extensions) {
                        scene.extensions = {}
                    }
                    scene.extensions["CESIUM_RTC"] = {
                        center: [1, 2, 3]
                    };
                    console.log('gltfExp done'); //console.log(JSON.stringify(gltf));
                    var gltfTile = new vinylFile({
                        path: `test.debug.gltf`,//`${ti[2]}/${ti[0]}/${ti[1]}`,
                        contents: new Buffer.from(JSON.stringify(gltf))
                    });
                    // ToDo! gltfTile.featureProperties = {}
                    cb(null, gltfTile);
                }, {});
            } );
            var materials = new MTLLoader(loadingManager).setPath( srcDir ).parse( 
                fs.readFileSync(file.path.replace('.obj', '.mtl')).toString(), 'file:///' + srcDir
            );
            materials.preload();
            cb();
        } catch(e) {
            console.log(e);
        }
    }))
    .pipe( gulp.dest('./dest/') );
}

async function genGltf(file) {
    try {
        /*const loadImage = src => new Promise((resolve, reject) => {
            const img = new jsdom.window.Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
        loadImage('file:///H:/OpenLab/도로3D_여의도 데이터/정밀도로지도-지형정합/과속방지턱/15/00116068/00116068_00279374/../../../../Resource/SpeedBump_Diffuse.jpg')
        .then(image => console.log(image, `\nloaded? ${image.complete} ${image.width}}`));*/
        const srcDir  = path.dirname(file.path) + path.sep;
        const loadingManager = new LoadingManager( function () {
            console.log(`materials.preload() done`);
            // persist raw MTL material object into MeshMaterial
            for( var k in materials.materialsInfo) {
                var m = materials.materials[k];
                m.raw = JSON.stringify(materials.materialsInfo[k]);
                //console.log(`m.name=${m.name} ${m.map.image}`);
            }
            var model = new OBJLoader().setMaterials( materials ).setPath( srcDir ).parse(
                fs.readFileSync(file.path).toString()
            );
            var gltfExp = new GLTFExporter();
            gltfExp.parse([model], (gltf)=>{
                // https://threejs.org/docs/#examples/en/loaders/GLTFLoader
                //(new GLTFLoader()).parse(gltf, (obj)=>{console.log(obj.scene);});
                const scene = gltf.scenes[0];
                scene.extensionsUsed.push('CESIUM_RTC');
                if (!scene.extensions) {
                    scene.extensions = {}
                }
                scene.extensions["CESIUM_RTC"] = {
                    center: [1, 2, 3]
                };
                console.log('gltfExp done'); //console.log(JSON.stringify(gltf));
                var gltfTile = new vinylFile({
                    path: `test.debug.gltf`,//`${ti[2]}/${ti[0]}/${ti[1]}`,
                    contents: new Buffer.from(JSON.stringify(gltf))
                });
                // ToDo! gltfTile.featureProperties = {}
                return gltfTile;
            }, {});
        } );
        var materials = new MTLLoader(loadingManager).setPath( srcDir ).parse( 
            fs.readFileSync(file.path.replace('.obj', '.mtl')).toString(), 'file:///' + srcDir
        );
        materials.preload();
        cb();
    } catch(e) {
        console.log(e);
    }
}

export function buildDebugTileset(tileset) {
    const all = [];
    return gulp.src(['H:/OpenLab/도로3D_여의도 데이터/정밀도로지도-지형정합/과속방지턱/15/00116068/00116068_00279374/C419BS030044.obj']) 
    .pipe(through2.obj(function (file, _, cb) {
        // https://stackoverflow.com/questions/47661288/gulp-stream-completion-with-promises
        Promise.resolve(file)
        .then(file=>{
            const srcDir  = path.dirname(file.path) + path.sep;
            const loadingManager = new LoadingManager( function () {
                console.log(`materials.preload() done`);
                // persist raw MTL material object into MeshMaterial
                for( var k in materials.materialsInfo) {
                    var m = materials.materials[k];
                    m.raw = JSON.stringify(materials.materialsInfo[k]);
                    //console.log(`m.name=${m.name} ${m.map.image}`);
                }
                var model = new OBJLoader().setMaterials( materials ).setPath( srcDir ).parse(
                    fs.readFileSync(file.path).toString()
                );
                var gltfExp = new GLTFExporter();
                gltfExp.parse([model], (gltf)=>{
                    // https://threejs.org/docs/#examples/en/loaders/GLTFLoader
                    //(new GLTFLoader()).parse(gltf, (obj)=>{console.log(obj.scene);});
                    const scene = gltf.scenes[0];
                    if (!scene.extensionsUsed) {
                        scene.extensionsUsed = [];
                    }
                    scene.extensionsUsed.push('CESIUM_RTC');
                    if (!scene.extensions) {
                        scene.extensions = {}
                    }
                    scene.extensions["CESIUM_RTC"] = {
                        center: [1, 2, 3]
                    };
                    console.log(`gltfExp done=${gltf.scenes.length}`); //console.log(JSON.stringify(gltf));
                    var gltfTile = new vinylFile({
                        path: `test.debug.gltf`,//`${ti[2]}/${ti[0]}/${ti[1]}`,
                        contents: new Buffer.from(JSON.stringify(gltf))
                    });
                    // ToDo! gltfTile.featureProperties = {}
                    cb(null, gltfTile);
                }, {});
            } );
            var materials = new MTLLoader(loadingManager).setPath( srcDir ).parse( 
                fs.readFileSync(file.path.replace('.obj', '.mtl')).toString(), 'file:///' + srcDir
            );
            materials.preload();
        }).catch(e => {
            console.log(`error = ${e}`);
        })
    }))
    .pipe( gulp.dest('./dest/') );
}
