// Optional lower cross-support for pedestrian signals: control, geometry, history and save/load.
const assert = require('assert');
const { open, ADD_FN } = require('./lib');
(async () => {
  const { browser, page, errors } = await open({ width: 1200, height: 800 });
  await page.evaluate(ADD_FN);
  const result = await page.evaluate(async () => {
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    S.length = 0; clearSelection(); __add('pedSignal', 1);
    const id = sel; setOb(id, { ca: 0, cb: 0, lift: 0, rot: 0 });
    setSelection(id, false); tool = 'edit'; setMode('draw'); sync(); regenObjects(); render();
    const left = document.querySelector('#assetEditorFields input[data-asset-control="pedSignalLowerSupport"]');
    const canvas = document.querySelector('#canvasAssetControl input[data-asset-toggle="pedSignalLowerSupport"]');
    const initial = { prop: obOf(id).pedSignalLowerSupport, lines: S.filter(s => s.ob?.id === id).length, faces: surfaceTriangles(obOf(id)).length,
      leftPresent: !!left, canvasPresent: !!canvas, canvasChecked: canvas?.checked };
    canvas?.click(); await frame();
    const enabled = { prop: obOf(id).pedSignalLowerSupport, lines: S.filter(s => s.ob?.id === id).length, faces: surfaceTriangles(obOf(id)).length,
      leftChecked: document.querySelector('#assetEditorFields input[data-asset-control="pedSignalLowerSupport"]')?.checked,
      canvasChecked: document.querySelector('#canvasAssetControl input[data-asset-toggle="pedSignalLowerSupport"]')?.checked };
    const saved = JSON.parse(JSON.stringify(pack(true)));
    undo(); await frame();
    const afterUndo = { value: obOf(id).pedSignalLowerSupport, lines: S.filter(s => s.ob?.id === id).length };
    redo(); await frame();
    const afterRedo = { value: obOf(id).pedSignalLowerSupport, lines: S.filter(s => s.ob?.id === id).length };
    unpack(saved); setSelection(id, false); await frame();
    const afterLoad = { value: obOf(id).pedSignalLowerSupport, lines: S.filter(s => s.ob?.id === id).length };
    S.length = 0; clearSelection(); __add('trafficSignal', 1); const trafficId = sel;
    const trafficControl = assetEditorControls(obOf(trafficId)).some(c => c.key === 'pedSignalLowerSupport');
    const trafficBaseline = S.filter(s => s.ob?.id === trafficId).length;
    setOb(trafficId, { pedSignalLowerSupport: true }); regenObjects();
    const trafficWithPedFlag = S.filter(s => s.ob?.id === trafficId).length;
    return { initial, enabled, afterUndo, afterRedo, afterLoad, savedValue: saved.S.find(s => s.ob?.id === id)?.ob?.pedSignalLowerSupport,
      trafficControl, trafficBaseline, trafficWithPedFlag };
  });
  assert.strictEqual(result.initial.prop, false, 'default off preserves existing appearance');
  assert(result.initial.leftPresent && result.initial.canvasPresent, 'both checkbox controls should be present');
  assert.strictEqual(result.initial.canvasChecked, false);
  assert.strictEqual(result.enabled.prop, true);
  assert(result.enabled.lines > result.initial.lines, 'enabled support adds line geometry');
  assert(result.enabled.faces > result.initial.faces, 'enabled support adds surface geometry');
  assert.strictEqual(result.enabled.leftChecked, true);
  assert.strictEqual(result.enabled.canvasChecked, true);
  assert.strictEqual(result.afterUndo.value, false);
  assert.strictEqual(result.afterUndo.lines, result.initial.lines);
  assert.strictEqual(result.afterRedo.value, true);
  assert.strictEqual(result.afterRedo.lines, result.enabled.lines);
  assert.strictEqual(result.savedValue, true);
  assert.strictEqual(result.afterLoad.value, true);
  assert.strictEqual(result.afterLoad.lines, result.enabled.lines);
  assert.strictEqual(result.trafficControl, false, 'option is pedestrian-signal only');
  assert.strictEqual(result.trafficWithPedFlag, result.trafficBaseline, 'pedestrian support flag does not affect traffic signal');
  assert.strictEqual(errors.length, 0, JSON.stringify(errors));
  console.log(JSON.stringify(result));
  console.log('OK: optional lower support, both checkboxes, geometry, undo/redo, save/load, traffic-signal isolation');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
