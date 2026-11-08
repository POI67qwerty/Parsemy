/* 凹窓階層建物：上階の階高と1階の実高さが独立していることを検証。 */
const { open, ADD_FN } = require('./lib');
(async () => {
  const { browser, page, errors } = await open();
  await page.evaluate(ADD_FN);
  const result = await page.evaluate(() => {
    S.length = 0; clearSelection(); window.__add('recessedStackedBuilding', 1);
    const id = sel, original = obOf(id), q0 = recessedStackedBuildingParams(original);
    const upperPatch = recessedHandlePatch(original, 'recessed-floor-height', q0.floorHeight + .4);
    const upper = recessedStackedBuildingParams({ ...original, ...upperPatch });
    const firstPatch = recessedHandlePatch(original, 'recessed-first-floor-height', q0.firstFloorHeight + .3);
    const first = recessedStackedBuildingParams({ ...original, ...firstPatch });
    const firstCount = recessedStackedBuildingParams({ ...original, recessedFloorCount: 5 });
    return {
      original: { upper: q0.floorHeight, first: q0.firstFloorHeight },
      afterUpperEdit: { upper: upper.floorHeight, first: upper.firstFloorHeight },
      afterFirstEdit: { upper: first.floorHeight, first: first.firstFloorHeight },
      afterCountEdit: { upper: firstCount.floorHeight, first: firstCount.firstFloorHeight },
      handles: Object.fromEntries(Object.entries(recessedStackedGizmo(original).handles)
        .filter(([, h]) => ['recessed-floor-height', 'recessed-first-floor-height'].includes(h.kind))
        .map(([key, h]) => [key, h.kind])),
    };
  });
  const ok = Math.abs(result.afterUpperEdit.upper - (result.original.upper + .4)) < 1e-8 &&
    Math.abs(result.afterUpperEdit.first - result.original.first) < 1e-8 &&
    Math.abs(result.afterFirstEdit.first - (result.original.first + .3)) < 1e-8 &&
    Math.abs(result.afterFirstEdit.upper - result.original.upper) < 1e-8 &&
    Math.abs(result.afterCountEdit.first - result.original.first) < 1e-8;
  console.log(JSON.stringify({ result, ok, errors }));
  if (!ok || errors.length) process.exitCode = 1;
  else console.log('OK: 上階の階高・1階の高さ・階数変更が互いに独立');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
