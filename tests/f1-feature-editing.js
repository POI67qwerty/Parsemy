const fs = require('fs');
const assert = require('assert');
const asset = fs.readFileSync(require.resolve('../asset.js'), 'utf8');
const render = fs.readFileSync(require.resolve('../engine-render.js'), 'utf8');
const input = fs.readFileSync(require.resolve('../engine-input.js'), 'utf8');
const canvas = fs.readFileSync(require.resolve('../studio-canvas-controls.js'), 'utf8');

// Ensure both visible linework and rendered surfaces read the editable component properties.
for (const key of ['f1AwningWidth','f1AwningOffsetX','f1AwningDepth','f1AwningBackZ','f1AwningFrontZ',
                   'f1SignWidth','f1SignHeight','f1SignOffsetX','f1SignZ','f1SignDepth']) {
  assert(asset.includes(key), `missing control/line geometry property ${key}`);
  assert(render.includes(key) || render.includes('f1AwningPanels'), `rendered surface ignores ${key}`);
}
assert(asset.includes('out[i].f1Feature="awning"') && asset.includes('out[i].f1Feature="sign"'), 'F1 component linework must be hit-testable');
assert(input.includes('cv.addEventListener("dblclick"') && input.includes('window.__f1EditFeature'), 'double-click editing focus is missing');
assert(asset.includes('f1FacadeControls') && asset.includes('out[i].f1Feature="facade"'), 'facade must have focused double-click controls');
assert(render.includes('beveledBoxFootprint(sw,sh,sb,4)'), 'front sign bevel must trim the sign face outline (width x height), not the building or the sign depth footprint');
assert(asset.includes('o.f1SignBevelOffset==null ? .18 : Number(o.f1SignBevelOffset)'), 'front sign bevel must use its own parameter, never the building bevel fallback');
assert(asset.includes('f1SignBracketLength'), 'front sign must retain the legacy bracket-length control');
assert(!render.includes('f1SignBracketLength'), 'front sign must not generate physical metal brackets');
assert(canvas.includes('c.canvasVisible(o)'), 'canvas must show controls for the double-clicked feature');
const ui=fs.readFileSync(require.resolve('../studio-ui.js'),'utf8');
assert(ui.includes('data-object-collapse') && ui.includes('childParent.has(o.id)'), 'attached F1 parts must fold under the parent in the object list');
console.log('PASS F1 feature editing: dimensions/positions, line hit-test tags, double-click focus, and focused canvas controls are wired.');
