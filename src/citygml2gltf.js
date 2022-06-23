
import CityDocument from "citygml-to-3dtiles/src/citygml/Document.mjs"
import Mesh from 'citygml-to-3dtiles/src/3dtiles/Mesh.mjs'
import createGltf from 'citygml-to-3dtiles/src/3dtiles/createGltf.mjs'
import BatchTable from 'citygml-to-3dtiles/src/3dtiles/BatchTable.mjs';
import Batched3DModel from 'citygml-to-3dtiles/src/3dtiles/Batched3DModel.mjs'
import SRSTranslator from 'citygml-to-3dtiles/src/citygml/SRSTranslator.mjs'
import Tileset from 'citygml-to-3dtiles/src/3dtiles/Tileset.mjs'
import BoundingBox from 'citygml-to-3dtiles/src/geometry/BoundingBox.mjs'
import fs from 'fs'
import Path from 'path'

let srsTranslator = new SRSTranslator({
    "EPSG:5186":'+ellps=GRS80 +proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +units=m +no_defs'
});

function _getProperties (cityObject) {
  let properties = Object.assign(
    cityObject.getExternalReferences(),
    cityObject.getAttributes(),
  )
  return properties
}

export async function citygmlToTileset(inputPaths, outputFolder) {
    //let cityDocument = CityDocument.fromFile(inputPath, srsTranslator);
    let cityObjects = [], boundingBoxes = [];
    inputPaths.forEach((inputPath, i) => {
      console.debug(`Reading CityGML file ${i + 1}/${inputPaths.length}...`);
      let cityDocument = CityDocument.fromFile(inputPath, srsTranslator);
      let cityModel = cityDocument.getCityModel();
      let objs = cityModel.getCityObjects();
      console.debug(` Found ${objs.length} city objects.`);
      if (objs.length > 0) {
        cityObjects.push(...objs);
        boundingBoxes.push(cityModel.getBoundingBox());
      }
    })
    console.debug(`Converting to 3D Tiles...`);
    let boundingBox = BoundingBox.fromBoundingBoxes(boundingBoxes);
    let tileset = await convertCityObjects(cityObjects, boundingBox);

    console.debug(`Writing 3D Tiles...`);
    await tileset.writeToFolder(outputFolder);
    console.debug('Done.');
}

/**
   * @param  {CityObject[]} cityObjects
   * @param  {BoundingBox} boundingBox
   * @returns {Tileset}
   */
 async function convertCityObjects (cityObjects, boundingBox) {
  let meshes = cityObjects.map((cityObject) => {
    return Mesh.fromTriangleMesh(cityObject.getTriangleMesh())
  })
  let mesh = Mesh.batch(meshes)

  let batchTable = new BatchTable()
  cityObjects.forEach((cityObject, i) => {
    batchTable.addFeature(i, _getProperties(cityObject))
  })

  let gltf = await createGltf({
    mesh: mesh,
    useBatchIds: true,
    optimizeForCesium: true,
    relativeToCenter: true
  })

  let b3dm = new Batched3DModel(gltf, batchTable, boundingBox)

  return new Tileset(b3dm)
}

export function citygmlToGltf(inputPath) {
  let cityDocument = CityDocument.fromFile(inputPath, srsTranslator);
  let cityModel = cityDocument.getCityModel();
  let objs = cityModel.getCityObjects();
  let meshes = objs.map((cityObject) => {
      return Mesh.fromTriangleMesh(cityObject.getTriangleMesh())
    })
    let mesh = Mesh.batch(meshes)

    let batchTable = new BatchTable()
    objs.forEach((cityObject, i) => {
      batchTable.addFeature(i, _getProperties(cityObject))
    })

    return createGltf({
      mesh: mesh,
      useBatchIds: true,
      optimizeForCesium: false,
      relativeToCenter: false
    });
}
