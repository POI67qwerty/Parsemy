// Clipboard-only line alpha correction: retain transparent background and strengthen AA strokes.
const assert = require('assert');
const { open, ADD_FN } = require('./lib');
(async () => {
  const { browser, page, errors } = await open({ width: 900, height: 650 });
  await page.evaluate(ADD_FN);
  const result = await page.evaluate(() => {
    S.length = 0; clearSelection(); window.__add('building', 1);
    const o = [...new Map(S.filter(s => s.ob).map(s => [s.ob.id, s.ob])).values()].find(o => !o.attachment);
    setOb(o.id, { ca: 0, cb: 0, lift: 0 }); regenObjects();
    sel = null; tool = 'view'; setMode('draw'); P.surfaceMode = false;
    $('bin').checked = false; cityStandardView('front'); sync(); CAMKEY = null;
    const original = out('line'), clipboard = out('line', false, true);
    const a = original.getContext('2d').getImageData(0, 0, original.width, original.height).data;
    const b = clipboard.getContext('2d').getImageData(0, 0, clipboard.width, clipboard.height).data;
    $('bin').checked = true;
    const binaryPng = out('line');
    const c = binaryPng.getContext('2d').getImageData(0, 0, binaryPng.width, binaryPng.height).data;
    let visible = 0, partial = 0, boosted = 0, weakened = 0, backgroundChanged = 0, alphaBefore = 0, alphaAfter = 0, binaryPartial = 0, binaryInk = 0;
    for (let i = 3; i < a.length; i += 4) {
      alphaBefore += a[i]; alphaAfter += b[i];
      if (a[i] > 0) {
        visible++;
        if (a[i] < 255) partial++;
        if (b[i] > a[i]) boosted++;
        if (b[i] < a[i]) weakened++;
      } else if (b[i] !== 0) backgroundChanged++;
    }
    for (let i = 3; i < c.length; i += 4) {
      if (c[i] > 0 && c[i] < 255) binaryPartial++;
      if (c[i] === 255) binaryInk++;
    }
    return { visible, partial, boosted, weakened, backgroundChanged, alphaBefore, alphaAfter, binaryPartial, binaryInk, width: original.width, height: original.height };
  });
  assert(result.visible > 0, 'expected visible line pixels');
  assert(result.alphaAfter >= result.alphaBefore, 'clipboard alpha must not be lower');
  assert.strictEqual(result.weakened, 0, 'no line pixel should become more transparent');
  assert.strictEqual(result.backgroundChanged, 0, 'transparent background must remain transparent');
  assert.strictEqual(result.boosted, result.partial, 'every antialiased line pixel should be strengthened');
  assert.strictEqual(result.binaryPartial, 0, 'binary PNG must not contain partially transparent pixels');
  assert(result.binaryInk > 0, 'binary PNG should contain fully opaque line pixels');
  assert(errors.length === 0, JSON.stringify(errors));
  console.log(JSON.stringify(result));
  console.log('OK: clipboard alpha strengthened; binary PNG ink fully opaque; transparent background preserved');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
