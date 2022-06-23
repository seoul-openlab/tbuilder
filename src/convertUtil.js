
import proj4 from 'proj4';
import { Matrix4, Vector3, Box3, LoadingManager, Scene } from "three-universal/build/three.module.node";

export function enuToEcefMatrix(T,lon,lat) {
    var r = lon*Math.PI/180, p = lat*Math.PI/180;
    var sr = Math.sin(r), cr = Math.cos(r);
    var sp = Math.sin(p), cp = Math.cos(p);
    //console.log(`${p}/${r}/${x}/${y}/${z}`);
    /*return [
        -sr*x + -sp*cr*y + cp*cr*z + ecef[0],
         cr*x + -sp*sr*y + cp*sr*z + ecef[1],
         0    +  cp   *y + sp   *z + ecef[2]
    ]*/
    /*                                                    <-x,z,y>
    |  sr cp*cr -sp*cr Tx |   | -sr -sp*cr cp*cr Tx |   | -1 0 0 0 |
    | -cr cp*sr -sp*sr Ty |   |  cr -sp*sr cp*sr Ty |   |  0 0 1 0 |
    |   0 sp     cp    Tz | = |  0   cp    sp    Tz | * |  0 1 0 0 | 
    |   0  0     0     1  |   |  0   0     0     1  |   |  0 0 0 1 |
    */
    return new Matrix4().set(
         sr, cp*cr,  -sp*cr, T[0],
        -cr, cp*sr,  -sp*sr, T[1],
          0, sp   ,   cp   , T[2],
          0,     0,       0, 1
    );
}

function enuToEcefMatrixV1(T,lon,lat) {
    var r = lon*Math.PI/180, p = lat*Math.PI/180;
    var sr = Math.sin(r), cr = Math.cos(r);
    var sp = Math.sin(p), cp = Math.cos(p);
    //console.log(`${p}/${r}/${x}/${y}/${z}`);
    /*return [
        -sr*x + -sp*cr*y + cp*cr*z + ecef[0],
         cr*x + -sp*sr*y + cp*sr*z + ecef[1],
         0    +  cp   *y + sp   *z + ecef[2]
    ]*/
    /*                                                    <-x,z,y>
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
