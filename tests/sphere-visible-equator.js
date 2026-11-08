/* 球の赤道線を面ONで点検。指定角度で手前側の線が消えないことと、
   十分に奥の区間が描かれないことを、他の線を除いた画素で測る。 */
const { open, ADD_FN } = require('./lib');
(async () => {
    const { browser, page, errors } = await open({ width: 1200, height: 800 });
    await page.evaluate(ADD_FN);
    const results = await page.evaluate(() => {
        S.length = 0; clearSelection(); sel = null;
        window.__add('sphere', 1);
        const o = S.find(s => s.ob && s.ob.asset === 'sphere').ob;
        setOb(o.id, { ca: 0, cb: 0, lift: 0 });
        regenObjects(); sel = null;
        P.surfaceMode = true;
        cityStandardView('home');
        const orig = strokeWVisible;
        strokeWVisible = function(c, s) {
            if (s.ob && s.ob.asset === 'sphere' && s.onFace) return orig.apply(this, arguments);
        };
        window.__noLineCache = true;
        const rows = [];
        const baseYaw = P.yaw, basePitch = P.pitch;
        for (const [label, dyaw, dpitch] of [['home',0,0], ['right',20,0], ['left',-20,0], ['up',0,10], ['down',0,-10]]) {
            P.yaw = baseYaw + dyaw; P.pitch = basePitch + dpitch;
            sync(); regenObjects(); render();
            const s = S.find(x => x.ob && x.ob.asset === 'sphere' && x.onFace);
            if (!s) throw new Error('equator line not found');
            const im = LC.getContext('2d').getImageData(0, 0, W, H).data;
            const tf = [Z,0,0,Z,...viewShift()];
            let front=0, frontInk=0, back=0, backInk=0;
            for (const p3 of s.p) {
                const p = projPoint(p3, tf); if (!p || !p.ok) continue;
                const x=Math.round(p.x), y=Math.round(p.y);
                if (x<2 || y<2 || x>=W-2 || y>=H-2) continue;
                const z=depthBuffer[y*W+x]; if (!Number.isFinite(z)) continue;
                let ink=false;
                for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) if (im[((y+dy)*W+x+dx)*4+3]>120) ink=true;
                if (p.depth < z-0.025) { front++; if (ink) frontInk++; }
                if (p.depth > z+0.16) { back++; if (ink) backInk++; }
            }
            rows.push({label,front,frontInk,back,backInk});
        }
        return rows;
    });
    console.log(JSON.stringify(results));
    const bad = results.filter(r => r.front >= 5 && r.frontInk / r.front < 0.8 || r.back >= 5 && r.backInk / r.back > 0.15);
    if (bad.length || errors.length || !results.some(r => r.front >= 5) || !results.some(r => r.back >= 5)) {
        console.error('NG', JSON.stringify({bad,errors})); process.exitCode=1;
    } else console.log('OK: sampled front visible and rear hidden');
    await browser.close();
})().catch(e => { console.error(e); process.exitCode=1; });
