/* 主要アセットについて、カメラの向き・位置を変えたときの線画を簡易診断する。
   深度バッファによる推定なので、Blender等の基準画像との一致を保証するものではない。
   使い方: tests/run.sh tests/hidden-lines-angles.js [アセット名 ...] */
const { open, ADD_FN, URL } = require('./lib');
const { PROBE } = require('./hidden-lines');
(async () => {
    const kinds = process.argv.slice(2);
    const list = kinds.length ? kinds : [
        'stackedBuilding', 'beveledStackedBuilding', 'recessedStackedBuilding', 'sphere',
        'outdoorUnit', 'trafficSignal', 'railing', 'sedan',
    ];
    const { browser, page, errors } = await open({ width:1200, height:800 });
    await page.close();
    let bad = 0;
    for (const kind of list) {
        const p = await browser.newPage({ viewport:{width:1200, height:800} });
        const pageErrors = [];
        p.on('pageerror', e => pageErrors.push(String(e)));
        await p.goto(URL);
        await p.evaluate(ADD_FN);
        await p.evaluate(PROBE);
        const rows = await p.evaluate(k => {
            window.__hlInstall();
            S.length=0; clearSelection(); sel=null;
            window.__add(k,1);
            const objs=[...new Map(S.filter(s=>s.ob).map(s=>[s.ob.id,s.ob])).values()];
            objs.forEach(o=>setOb(o.id,{ca:0,cb:0,lift:0,rot:0}));
            regenObjects(); sel=null; P.surfaceMode=true; cityStandardView('home');
            const origin={yaw:P.yaw,pitch:P.pitch,cx:P.cx,cz:P.cz,ch:P.ch};
            // 小さい丸椅子は1m移動だと画面外に出るため、移動試験だけ0.2mにする。
            const step = k === 'stool' ? 0.2 : 1;
            const views=[
                ['home',0,0,0,0,0], ['left',-25,0,0,0,0], ['right',25,0,0,0,0],
                ['up',0,10,0,0,0], ['down',0,-10,0,0,0],
                ['move-left',0,0,-step,0,0], ['move-right',0,0,step,0,0],
                ['move-back',0,0,0,-step,0], ['move-up',0,0,0,0,step],
            ];
            return views.map(([view,dy,dp,dx,dz,dh]) => {
                // 左右は対象の周りを回る（位置を据え置いて向きだけ変えると対象が画面外に出る）。
                const rad=dy*Math.PI/180, cs=Math.cos(rad), sn=Math.sin(rad);
                Object.assign(P,{yaw:origin.yaw+dy,pitch:origin.pitch+dp,
                    cx:origin.cx*cs-origin.cz*sn+dx, cz:origin.cx*sn+origin.cz*cs+dz, ch:origin.ch+dh});
                sync(); regenObjects();
                const r=window.__hlScan(.06), tf=[Z,0,0,Z,...viewShift()];
                const onScreen=S.reduce((n,s)=>n+s.p.filter(v=>{
                    const q=projPoint(v,tf);
                    return q && q.ok && q.x>=0 && q.x<W && q.y>=0 && q.y<H;
                }).length,0);
                return { view, over:r.over.reduce((n,v)=>n+v.ov,0), miss:r.miss.reduce((n,v)=>n+v.ms,0), onScreen };
            });
        }, kind);
        const failures=rows.filter(r=>r.over || r.miss || r.onScreen<10);
        if (failures.length || pageErrors.length) bad++;
        console.log(kind,JSON.stringify(rows),pageErrors.length ? JSON.stringify(pageErrors) : '');
        await p.close();
    }
    await browser.close();
    if (bad || errors.length) { console.log('=> 要調査',bad,'種',JSON.stringify(errors)); process.exitCode=1; }
    else console.log(`=> OK（${list.length}種 × 9視点の簡易診断）`);
})().catch(e=>{console.error(e);process.exitCode=1});
