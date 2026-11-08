// Stacked / beveled-stacked building body edges must stop at the underside of each rim.
const assert = require('assert');
const { open, ADD_FN } = require('./lib');
(async () => {
  const { browser, page, errors } = await open({ width: 1000, height: 700 });
  await page.evaluate(ADD_FN);
  const result = await page.evaluate(() => {
    const rows = [];
    for (const [kind, bevelOffset] of [['stackedBuilding', 0], ['stackedBuilding', .28]]) {
      S.length = 0; clearSelection(); __add(kind, 1);
      const id = sel;
      setOb(id, { ca: 0, cb: 0, lift: 0, rot: 0, bevelOffset,
        floors: obOf(id).floors.map(f => ({ ...f, bevelOffset })) }); regenObjects();
      const o = obOf(id), floors = o.floors || [];
      const axis = o.k;
      const vertical = S.filter(s => s.ob?.id === id && s.d3 && s.p?.length > 1)
        .map(s => {
          const spans=[0,1,2].map(k=>Math.max(...s.p.map(p=>p[k]))-Math.min(...s.p.map(p=>p[k])));
          return { seam:s.seam, length:spans[axis], other:spans.filter((_,k)=>k!==axis).reduce((m,v)=>Math.max(m,v),0) };
        })
        .filter(v => v.other < 1e-5 && v.length > .1);
      const floorHeights = floors.map(f => Math.max(.05, Math.abs(Number(f.h)||2.2))),
        rimHeights = floors.map((f,i) => Math.max(.01, Math.min(floorHeights[i], Math.abs(Number(f.rimHeight)||.16)))),
        expectedBody = floorHeights.map((h,i) => h-rimHeights[i]);
      const counts = vertical.reduce((map,v) => { const key=v.length.toFixed(3); map[key]=(map[key]||0)+1; return map; },{});
      rows.push({ kind, floors: floors.length, verticalCount: vertical.length, bodyHeights: expectedBody,
        fullHeightCount: vertical.filter(v=>floorHeights.some(h=>Math.abs(v.length-h)<1e-5)).length,
        bodyLengthCount: vertical.filter(v=>expectedBody.some(h=>Math.abs(v.length-h)<1e-5)).length, lengthClasses:counts });
    }
    return rows;
  });
  for (const row of result) {
    assert(row.floors > 0, `${row.kind}: floors missing`);
    assert(row.verticalCount > 0, `${row.kind}: vertical edges missing`);
    assert.strictEqual(row.fullHeightCount, 0, `${row.kind}: body vertical line still spans into the rim`);
    assert(row.bodyLengthCount >= row.floors * 4, `${row.kind}: expected shortened body vertical edges not found`);
  }
  assert.strictEqual(errors.length, 0, JSON.stringify(errors));
  console.log(JSON.stringify(result));
  console.log('OK: body vertical edges end at the rim underside for both stacked building variants');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
