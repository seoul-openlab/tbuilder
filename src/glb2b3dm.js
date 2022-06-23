
/**
 * Convert the JSON object to a padded buffer.
 *
 * Pad the JSON with extra whitespace to fit the next 8-byte boundary. This ensures proper alignment
 * for the section that follows (for example, batch table binary or feature table binary).
 * Padding is not required by the 3D Tiles spec but is important when using Typed Arrays in JavaScript.
 *
 * @param {Object} [json] The JSON object.
 * @param {Number} [byteOffset=0] The byte offset on which the buffer starts.
 * @returns {Buffer} The padded JSON buffer.
 *
 * @private
 */
 function getJsonBufferPadded(json, byteOffset) {
    // Check for undefined or empty
    if (json === undefined || Object.keys(json).length === 0) {
        return Buffer.alloc(0);
    }

    byteOffset = byteOffset || 0;
    var string = JSON.stringify(json);

    var boundary = 8;
    var byteLength = Buffer.byteLength(string);
    var remainder = (byteOffset + byteLength) % boundary;
    var padding = (remainder === 0) ? 0 : boundary - remainder;
    var whitespace = '';
    for (var i = 0; i < padding; ++i) {
        whitespace += ' ';
    }
    string += whitespace;

    return Buffer.from(string);
}

/**
 * Pad the buffer to the next 8-byte boundary to ensure proper alignment for the section that follows.
 * Padding is not required by the 3D Tiles spec but is important when using Typed Arrays in JavaScript.
 *
 * @param {Buffer} buffer The buffer.
 * @param {Number} [byteOffset=0] The byte offset on which the buffer starts.
 * @returns {Buffer} The padded buffer.
 *
 * @private
 */
 function getBufferPadded(buffer, byteOffset) {
    if (buffer === undefined) {
        return Buffer.alloc(0);
    }

    byteOffset = byteOffset || 0;

    var boundary = 8;
    var byteLength = buffer.length;
    var remainder = (byteOffset + byteLength) % boundary;
    var padding = (remainder === 0) ? 0 : boundary - remainder;
    var emptyBuffer = Buffer.alloc(padding);
    return Buffer.concat([buffer, emptyBuffer]);
}

/**
 * Generates a new Buffer representing a b3dm asset.
 *
 * @param {Buffer} glbBuffer A buffer containing a binary glTF asset.
 * @param {Object} [featureTableJson] The feature table JSON.
 * @param {Buffer} [featureTableBinary] The feature table binary.
 * @param {Object} [batchTableJson] The batch table JSON.
 * @param {Buffer} [batchTableBinary] The batch table binary.
 * @returns {Buffer} Buffer representing the b3dm asset.
 */
 export function glbToB3dm(glbBuffer, featureTableJson, featureTableBinary, batchTableJson, batchTableBinary) {
    var headerByteLength         = 28;
    var featureTableJsonBuffer   = getJsonBufferPadded(featureTableJson, headerByteLength);
    var featureTableBinaryBuffer = getBufferPadded(featureTableBinary);
    var batchTableJsonBuffer     = getJsonBufferPadded(batchTableJson);
    var batchTableBinaryBuffer   = getBufferPadded(batchTableBinary);

    var byteLength = headerByteLength + featureTableJsonBuffer.length + featureTableBinaryBuffer.length + batchTableJsonBuffer.length + batchTableBinaryBuffer.length + glbBuffer.length;
    var header = Buffer.alloc(headerByteLength);
    header.write('b3dm', 0);                                    // magic
    header.writeUInt32LE(1, 4);                                 // version
    header.writeUInt32LE(byteLength, 8);                        // byteLength - length of entire tile, including header, in bytes
    header.writeUInt32LE(featureTableJsonBuffer.length, 12);    // featureTableJSONByteLength - length of feature table JSON section in bytes.
    header.writeUInt32LE(featureTableBinaryBuffer.length, 16);  // featureTableBinaryByteLength - length of feature table binary section in bytes.
    header.writeUInt32LE(batchTableJsonBuffer.length, 20);      // batchTableJSONByteLength - length of batch table JSON section in bytes. (0 for basic, no batches)
    header.writeUInt32LE(batchTableBinaryBuffer.length, 24);    // batchTableBinaryByteLength - length of batch table binary section in bytes. (0 for basic, no batches)

    return Buffer.concat([header, featureTableJsonBuffer, featureTableBinaryBuffer, batchTableJsonBuffer, batchTableBinaryBuffer, glbBuffer]);
}
