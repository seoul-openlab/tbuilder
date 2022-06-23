
import through2 from 'through2';
import vinylFile from 'vinyl';
import fs from 'fs';
import path from 'path';

/**
 * Generates a sqlite database for a tileset, saved as a .3dtiles file.
 *
 * @param {String} inputDirectory The input directory of the tileset.
 * @param {String} [outputFile] The output .3dtiles database file.
 * @returns {Promise} A promise that resolves when the database is written.
 */
 function tilesetToDatabase(inputDirectory, outputFile) {
    if (!defined(inputDirectory)) {
        throw new DeveloperError('inputDirectory is required.');
    }

    outputFile = defaultValue(outputFile,
        path.join(path.dirname(inputDirectory), path.basename(inputDirectory) + '.3dtiles'));

    var db;
    var dbRun;
    // Delete the .3dtiles file if it already exists
    return Promise.resolve(fsExtra.remove(outputFile))
        .then(function () {
            // Create the database.
            db = new sqlite3.Database(outputFile, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
            dbRun = Promise.promisify(db.run, {context: db});

            // Disable journaling and create the table.
            return dbRun(`PRAGMA encoding='UTF-8'; PRAGMA synchronous=OFF; PRAGMA journal_mode='OFF'; PRAGMA page_size = 65536;`);
        })
        .then(function () {
            return dbRun(`
            CREATE TABLE IF NOT EXISTS g3d_tile_content
			(
			 tile_z     integer  NOT NULL               
			,tile_x     integer  NOT NULL               
			,tile_y     integer  NOT NULL               
			,tile_w     integer  NOT NULL  default(0) 
			,data_mesh  blob                            
			,data_tex   blob                            
			,data_json  blob                            
			,PRIMARY KEY (tile_z,tile_x,tile_y)
            )`);
        })
        .then(function () {
            //Build the collection of file paths to be inserted.
            var filePaths = [];
            var stream = klaw(inputDirectory);
            stream.on('readable', function () {
                var filePath = stream.read();
                while (defined(filePath)) {
                    if (filePath.stats.isFile()) {
                        filePaths.push(filePath.path);
                    }
                    filePath = stream.read();
                }
            });

            return new Promise(function (resolve, reject) {
                stream.on('error', reject);
                stream.on('end', function () {
                    resolve(filePaths);
                });
            });
        })
        .then(function (filePaths) {
            return Promise.map(filePaths, function (filePath) {
                return fsExtra.readFile(filePath)
                    .then(function (data) {
                        filePath = path.normalize(path.relative(inputDirectory, filePath)).replace(/\\/g, '/');
                        /*let str = '12345/12/34/56.';
                        const result = /[/\\](?<z>[0-9]{1,})[/\\](?<x>[0-9]{1,})[/\\](?<y>[0-9]{1,})[.]/gm.exec(str);
                        console.log( `result.group.z=${result.groups.z}/${result.groups.x}/${result.groups.y}` );*/

                        // Only gzip tiles and json files. Other files like external textures should not be gzipped.
                        var shouldGzip = isTile(filePath) || path.extname(filePath) === '.json';
                        if (shouldGzip && !isGzipped(data)) {
                            data = zlib.gzipSync(data);
                        }
                        return dbRun('INSERT OR REPLACE INTO g3d_tile_content(?, ?, ?, ?, ?, ?, ?)', [filePath, data]);
                    });
            }, {concurrency: 100});
        })
        .finally(function () {
            if (defined(db)) {
                db.close();
            }
        });
}
