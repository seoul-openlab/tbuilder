
import through2 from 'through2';
import vinylFile from 'vinyl';
import fs from 'fs';
import path, { resolve } from 'path';
import proj4 from 'proj4';
import minimatch from 'minimatch';
import {tileToBBox,tileToQuadkey, quadkeyToTile, lngLatToTile} from 'global-mercator';
import { Vector3, Box3, LoadingManager } from "three-universal/build/three.module.node";
import { GLTFExporter } from "three-universal/examples/node-jsm/exporters/GLTFExporter.js";
import { MTLLoader } from "three-universal/examples/node-jsm/loaders/MTLLoader";
import { OBJLoader } from "three-universal/examples/node-jsm/loaders/OBJLoader";
import { BufferGeometryUtils } from "three-universal/examples/node-jsm/utils/BufferGeometryUtils";
import { group } from 'console';

//
// load3dModel
//
function load3dModel(file) {
    return new Promise((resolve, reject)=>{
        try {
            const format = path.extname(file.path).toLowerCase();
            const srcDir  = path.dirname(file.path) + path.sep;
            const srcBase = path.basename(file.path);
            if (format === '.obj') {
                const loadingManager = new LoadingManager( function () {
                    // persist raw MTL material object into MeshMaterial
                    for( var k in materials.materialsInfo) {
                        var m = materials.materials[k];
                        m.raw = JSON.stringify(materials.materialsInfo[k]);
                        //console.log(`m.name=${m.name} ${m.map.image}`);
                    }
                    var model = new OBJLoader().setMaterials( materials ).setPath( srcDir ).parse(
                        file.contents.toString()
                    );
                    //console.log(`<=${file.path}`);
                    resolve(model);
                } );
                var materials = new MTLLoader(loadingManager).setPath( srcDir ).parse( 
                    fs.readFileSync(file.path.replace('.obj', '.mtl')).toString(), 'file:///' + srcDir
                );
                materials.preload();
                //console.log(`>=${file.path}`);
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

function exportMeshToGltf(file, groupMesh) {
    return new Promise((resolve, reject)=>{
        new GLTFExporter().parse(groupMesh, (gltf)=>{
            const gltfTile = new vinylFile({
                path: `${file.path}.gltf`,
                contents: new Buffer.from(JSON.stringify(gltf))
            });
            // ToDo! gltfTile.featureProperties = {}
            resolve(gltfTile);
        }, {
            binary: false,
            embedImages: false
        });
    }).catch(e=>reject(e));
}

///
/// Gulp Plugin 
/// Transform ECEF and gltf
///
export function transformEcefGltf(config) {
    //
    const indexJsonCache = {};
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
                indexJsonCache[indexPath] = JSON.parse(fs.readFileSync(indexPath).toString());
            }
            const indexJson = indexJsonCache[indexPath];
            //console.log(`indexJson=${indexJson.objects}/${!!indexJson.objects && Array.isArray(indexJson.objects)}`);
            if (!!indexJson.objects && Array.isArray(indexJson.objects)) {
                const baseName = path.basename(file.path);
                index = indexJson.objects.find(x=>x.fileName == baseName);
            }
        }
        // 1. Load 3d mesh
        const groupMesh = await load3dModel(file);
        //console.log(`1.OnLoadDone=${file.path}`);
        const srcSrid = `EPSG:${layer.srid}`;
        var scratchV = new Vector3();
        // 2. Transformn cordinates to ecef
        groupMesh.children.forEach(mesh=>{
            //console.log(`mesh.material=${JSON.stringify(mesh.material)}`);
            var cx = 0, cy = 0, cz = 0;
            var attrPosition = mesh.geometry.attributes.position;
            if (!!index && !!index.center && layer.srid === 'unity') {
                cx =-parseFloat(index.center.z);
                cy = parseFloat(index.center.x);
                cz = parseFloat(index.center.y);
                //console.log(`index=${JSON.stringify(index.center)}`);
                for (var i = 0, l = attrPosition.count; i < l; i++) {
                    scratchV.x =-attrPosition.getZ(i) + cx;
                    scratchV.y = attrPosition.getX(i) + cy;
                    scratchV.z = attrPosition.getY(i) + cz;
                    var ecef = proj4(srcSrid, 'EPSG:4978', scratchV);
                    attrPosition.setXYZ(i, ecef.x,ecef.y,ecef.z);
                    //console.log(`${ecef.x}/${ecef.y}/${ecef.z}`);
                }
            } else if (layer.srid !== 4978) {
                for (var i = 0, l = attrPosition.count; i < l; i++) {
                    scratchV.x = attrPosition.getX(i);
                    scratchV.y = attrPosition.getY(i);
                    scratchV.z = attrPosition.getZ(i);
                    const ecef = proj4(srcSrid, 'EPSG:4978', scratchV);
                    attrPosition.setXYZ(i, ecef.x,ecef.y,ecef.z);
                }
            }
        });
        //console.log(`2.OnEcefDone=${file.path}`);
        // 3. Export mesh to gltf
        // https://threejs.org/docs/#examples/en/exporters/GLTFExporter
        const gltfFile = await exportMeshToGltf(file, groupMesh);
        //console.log(`3.OnSaveDone=${gltfFile.path}`); //  ${JSON.stringify(gltf)}
        cb(null, gltfFile);
    }
    //
    return through2.obj(bufferContents);
}