const fs=require('fs'),assert=require('assert');
const kit=fs.readFileSync(require.resolve('../asset-kit.js'),'utf8');
const assets=fs.readFileSync(require.resolve('../asset-kit-assets.js'),'utf8');
const catalog=fs.readFileSync(require.resolve('../asset-controller.js'),'utf8');
assert(kit.includes('function cameraContourIndices')&&kit.includes('part.__owner'),'cylinder silhouette candidates must use the active camera');
assert(kit.includes('viewContour ||')&&kit.includes('preciseTubeEdge'),'camera contours must feed smooth cylinders and revolutions');
assert(assets.includes("ASSET_KIT.define('torii'")&&assets.includes('preciseTubeEdge:true'),'torii tubes must use precise camera contours');
assert(assets.includes("ASSET_KIT.define('ramenBowl'")&&assets.includes('K.revolution'),'ramen bowl must be a contour-aware revolution');
assert(assets.includes('K.quadraticTube(o,[[x,-wireSpan/2,edgeZ]'),'power wire must be a surfaced, contour-aware tube');
const groups=[...catalog.matchAll(/\{ key: "([^"]+)", label: "([^"]+)", kinds:/g)];
assert.deepStrictEqual(groups.at(-1)?.slice(1),['old','旧'],'旧カテゴリ must be the final asset category');
for(const id of ['buildingAwning','buildingAwningOpen','buildingSign','sign','wallSideSign','shopFront','guardPoleHalf','beveledBox','beveledStackedBuilding'])
  assert(catalog.includes(`"${id}"`),`old asset ${id} must stay accessible in the legacy shelf`);
console.log('PASS camera-facing cylinder/revolution contours, power-wire tube, and final 旧 catalog group.');
