// Diagnostic only: compare seam policies and optionally diff against a reference PNG.
// Usage: node tests/diagnose-beveled-stacked-side.js [--reference=old.png] [--save-current=current.png]
const fs = require('fs');
const path = require('path');
const { open, ADD_FN } = require('./lib');
(async () => {
  const opts = Object.fromEntries(process.argv.slice(2).filter(x => x.startsWith('--') && x.includes('='))
    .map(x => { const i = x.indexOf('='); return [x.slice(2, i), x.slice(i + 1)]; }));
  const { browser, page, errors } = await open({ width: 1200, height: 800 });
  await page.evaluate(ADD_FN);
  const baseline = JSON.parse(fs.readFileSync('tests/fixtures/architecture-pixels.chromium.json', 'utf8'))['beveledStackedBuilding:side:false'];
  const policies = ['current', 'apex-only', 'non-apex', 'all', 'none', 'no-occlusion', 'no-bin-min-width', 'no-surface-fill', 'full-depth', 'no-face-cull', 'no-face-buffer', 'no-depth-interp', 'force-regen', 'no-binary', 'binary-threshold-zero', 'binary-threshold-max'];
  const referenceDataUrl = opts.reference ? 'data:image/png;base64,' + fs.readFileSync(opts.reference).toString('base64') : null;
  const result = await page.evaluate(async ({ policies, referenceDataUrl }) => {
    async function capture(kind, view, policy = 'current') {
      window.__legacyRecessedCaps = false; window.__legacyCornerFascia = false; window.__legacyRailingBars = true;
      window.__noLineCache = true; $('bin').checked = true; P.bt = 128; P.surfaceMode = true;
      S.length = 0; clearSelection(); window.__add(kind, 1);
      const o = [...new Map(S.filter(s => s.ob).map(s => [s.ob.id, s.ob])).values()].find(o => !o.attachment);
      setOb(o.id, { ca: 0, cb: 0, lift: 0 }); regenObjects();
      sel = null; tool = 'view'; setMode('draw'); P.surfaceMode = true;
      cityStandardView(view); sync(); CAMKEY = null;
      if (policy === 'no-occlusion') window.__noOccl = true;
      if (policy === 'no-bin-min-width') window.__noBinMinW = true;
      if (policy === 'no-surface-fill') P.surfaceMode = false;
      if (policy === 'no-binary') $('bin').checked = false;
      if (policy === 'binary-threshold-zero') P.bt = 0;
      if (policy === 'binary-threshold-max') P.bt = 255;
      if (policy === 'full-depth') { window.__noDepthCache = true; window.__noDirtyDepth = true; }
      if (policy === 'no-face-cull') window.__noFaceCull = true;
      if (policy === 'no-face-buffer') window.__noFaceBuf = true;
      if (policy === 'no-depth-interp') window.__noDepthInterp = true;
      if (policy === 'force-regen') regenObjects();
      const original = updateSeamPicks;
      updateSeamPicks = function(...args) {
        original(...args);
        if (policy === 'apex-only') seamPicks = new Set(S.filter(s => s.seam != null && s.seamApex));
        else if (policy === 'non-apex') seamPicks = new Set(S.filter(s => s.seam != null && !s.seamApex));
        else if (policy === 'all') seamPicks = new Set(S.filter(s => s.seam != null));
        else if (policy === 'none') seamPicks = new Set();
      };
      render(); updateSeamPicks = original;
      delete window.__noOccl; delete window.__noBinMinW; delete window.__noDepthCache; delete window.__noDirtyDepth; delete window.__noFaceCull; delete window.__noFaceBuf; delete window.__noDepthInterp;
      const hash = await crypto.subtle.digest('SHA-256', ctx.getImageData(0, 0, W, H).data);
      return { hash: Array.from(new Uint8Array(hash)).map(n => n.toString(16).padStart(2, '0')).join(''), seamLines: S.filter(s => s.seam != null).length, apexLines: S.filter(s => s.seam != null && s.seamApex).length };
    }
    for (const [kind, view] of [['building','home'], ['cornerCutBox','home'], ['cornerCutBox','top'], ['cornerCutStackedBuilding','home']]) await capture(kind, view);
    const rows = [];
    for (const policy of policies) rows.push({ policy, ...await capture('beveledStackedBuilding', 'side', policy) });
    const current = await capture('beveledStackedBuilding', 'side', 'current');
    const currentPng = ctx.canvas.toDataURL('image/png');
    let diff = null;
    if (referenceDataUrl) {
      const image = new Image(); image.src = referenceDataUrl; await image.decode();
      const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(image, 0, 0);
      const ref = x.getImageData(0, 0, c.width, c.height).data, now = ctx.getImageData(0, 0, W, H).data;
      if (c.width !== W || c.height !== H) diff = { sizeMismatch: { reference: [c.width, c.height], current: [W, H] } };
      else {
        let pixels = 0, channels = 0, x0 = W, y0 = H, x1 = -1, y1 = -1, maxDelta = 0;
        for (let i = 0; i < ref.length; i += 4) {
          let changed = false;
          for (let k = 0; k < 4; k++) { const d = Math.abs(ref[i+k] - now[i+k]); if (d) { channels++; changed = true; maxDelta = Math.max(maxDelta, d); } }
          if (changed) { pixels++; const px = (i >> 2) % W, py = Math.floor((i >> 2) / W); x0=Math.min(x0,px);x1=Math.max(x1,px);y0=Math.min(y0,py);y1=Math.max(y1,py); }
        }
        diff = { pixels, channels, maxDelta, bounds: pixels ? [x0,y0,x1,y1] : null };
      }
    }
    delete window.__noLineCache;
    return { rows, current, currentPng, diff };
  }, { policies, referenceDataUrl });
  if (opts['save-current']) {
    const out = path.resolve(opts['save-current']); fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(result.currentPng.split(',')[1], 'base64'));
  }
  console.log(JSON.stringify({ baseline, current: result.current, rows: result.rows.map(row => ({ ...row, matchesBaseline: row.hash === baseline })), diff: result.diff, saved: opts['save-current'] || null, errors }));
  await browser.close();
  if (errors.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
