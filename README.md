# tbuilder
Simple Converter for 3d models to cesium 3d tileset
# Setup
1. 최신 node.js 설치(14버전권장)
2. tbuilder repositary 복제
```
git clone https://github.com/seoul-openlab/tbuilder.git && cd tbuilder
```
3. node module 설치
```
npm install
```
4. config.json 설명
```
tbuilder는 command line에 복잡하게 파라미터를 전달하는 방법이 아닌 config.json 파일에 싫행설정을 입력하여 실행된다.
config.json 파일의 위치는 tbuilder node 모듈의 root에 존재해야한다.
config.json 파일의 구성은 Cesium 3D tileset를 생산에 필요한 설정들로 구성로 아래의 설명과 같다.
{
    "tileLevel": tileset의 레벨값(정수) 0~20,
    "maxTextureSize": 최대텍스쳐크기(2배수픽셀) 16~4096,
    "layers": 레이어설정(배열) [
        {
            "tileset": 타일셋 식별하는 id(저장 디렉토리명으로도 사용됨),
            "layerName": 레이어식별 명칭,
            "fileType": 모델 파일 확장자(obj: WavefronOBJ파일, 3ds: 3DMax파일, unity: 유니티에서 정의된 좌표체계의 모델),
            "pathPattern": 파일검색 glob 패턴(자세한설명 https://gulpjs.com/docs/en/getting-started/explaining-globs/),
            "description": 모델 레이어 설명,
            "yAxisUp": Y축이 카메라 UP 벡터여부(false/true 기본값: false),
            "srid": 모델의 EPSG 좌표계 번호(정의된 EPSG번호: 4326, 3857, 5186, 5181, 32652, 5179, 4978, unity),
            "useIndexJson": "실감형공간정보연구단"에서 정의한 모델관련 설정파일 해석여부(false/true 기본값: false)
        },
    ]
}
```
5. example 실행
```
npx gulp citygml --tileset seoul
npx gulp model --tileset drone
npx gulp model --tileset hdmap
npx gulp model --tileset palace
```
6. 한계점
 [CityGML to 3d-tiles]
- Only city objects of type Building are converted.
- Textures are not converted.
- Only a single B3DM file is generated. (This works fine for small data sets, for larger sets probably a hierarchy of multiple files with different resolutions should be generated.)
- Files larger than 2GB cannot be converted because of the limits of NodeJS' Buffer.
- CityGML관련 자세한 한계점은 https://github.com/njam/citygml-to-3dtiles 참조
