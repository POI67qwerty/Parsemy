/* 実際の球と箱を重ね、球面の赤道線が別オブジェクトに隠れることを検査。 */
const { open, ADD_FN } = require('./lib');
(async () => {
    const { browser, page, errors } = await open();
    await page.evaluate(ADD_FN);
    const r = await page.evaluate(() => {
        S.length=0; clearSelection();
        window.__add('sphere',1); window.__add('box',1);
        const objs=[...new Map(S.filter(s=>s.ob).map(s=>[s.ob.id,s.ob])).values()];
        const sphere=objs.find(o=>o.asset==='sphere'), box=objs.find(o=>o.asset==='box');
        setOb(sphere.id,{ca:0,cb:2,lift:0});
        setOb(box.id,{ca:0,cb:0,lift:0,ra:.22,rb:.2,h:1.8});
        regenObjects(); sel=null; P.surfaceMode=true; cityStandardView('front');
        window.__noLineCache=true;
        const target=S.find(s=>s.ob && s.ob.id===sphere.id && s.onFace);
        if (!target) throw new Error('赤道線が見つからない');
        const orig=strokeWVisible;
        strokeWVisible=function(c,s) { if (s===target) return orig.apply(this,arguments); };
        render();
        const im=LC.getContext('2d').getImageData(0,0,W,H).data;
        const tf=[Z,0,0,Z,...viewShift()], other=depthOwnerMap.get(box.id);
        const result={blocked:0,blockedInk:0,front:0,frontInk:0};
        for (const v of target.p) {
            const p=projPoint(v,tf), x=Math.round(p.x), y=Math.round(p.y);
            if (!p.ok || x<2 || y<2 || x>=W-2 || y>=H-2) continue;
            const z=depthBuffer[y*W+x]; if (!Number.isFinite(z)) continue;
            let ink=false;
            for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++)
                if (im[((y+dy)*W+x+dx)*4+3]>120) ink=true;
            if (depthOwner[y*W+x]===other && p.depth>z+.2) {
                result.blocked++; if (ink) result.blockedInk++;
            }
            if (depthOwner[y*W+x]!==other && p.depth<z-.02) {
                result.front++; if (ink) result.frontInk++;
            }
        }
        return result;
    });
    console.log(JSON.stringify(r));
    // 輪郭付近では線幅のため数画素が重なるので、完全ゼロではなく割合で判定。
    if (errors.length || r.blocked<10 || r.front<10 || r.blockedInk/r.blocked>0.10 || r.frontInk/r.front<0.90) {
        console.error('NG',JSON.stringify(errors)); process.exitCode=1;
    } else console.log('OK: 前面は表示、手前の箱の後ろは遮蔽');
    await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
