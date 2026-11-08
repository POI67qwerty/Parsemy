/* 凹窓階層建物の梁／庇の廃止。古い保存データの旧値も形状に影響しない。 */
const { open, ADD_FN } = require('./lib');
(async () => {
    const { browser, page, errors } = await open();
    await page.evaluate(ADD_FN);
    const res = await page.evaluate(() => {
        S.length = 0; clearSelection(); window.__add('recessedStackedBuilding',1);
        const placed = S.find(s=>s.ob && s.ob.asset==='recessedStackedBuilding').ob;
        setOb(placed.id,{ca:0,cb:0,lift:0,rot:0}); regenObjects(); sel=null; P.surfaceMode=true; cityStandardView('home'); sync(); render();
        const inputsGone = !document.getElementById('recessedBeamHeight') && !document.getElementById('recessedBeamProjection');
        const results = [];
        for (const dims of [[2.5,1.8,0],[3.3,2.2,37],[1.8,1.5,90]]) {
            const base=normalizedAsset({...placed, ca:0, cb:0, lift:0, ra:dims[0],rb:dims[1],rot:dims[2],recessedWindowCount:5});
            const legacy=normalizedAsset(JSON.parse(JSON.stringify({...base,recessedBeamHeight:0.5,recessedBeamProjection:0.7})));
            const lines=o=>recessedStackedBuildingLines(o).map(s=>s.p);
            const faces=o=>surfaceTriangles(o);
            const lineSame=JSON.stringify(lines(base))===JSON.stringify(lines(legacy));
            const faceSame=JSON.stringify(faces(base))===JSON.stringify(faces(legacy));
            const boundsSame=JSON.stringify(obBounds(base))===JSON.stringify(obBounds(legacy));
            const origin=customPt(base,0,0,0), ex=customPt(base,1,0,0).map((v,i)=>v-origin[i]),
                ey=customPt(base,0,1,0).map((v,i)=>v-origin[i]), ez=customPt(base,0,0,1).map((v,i)=>v-origin[i]),
                local=p=>[ex,ey,ez].map(e=>e.reduce((sum,v,i)=>sum+(p[i]-origin[i])*v,0));
            const q=recessedStackedBuildingParams(base);
            const pts=[...lines(legacy).flat(),...faces(legacy).flat()].map(local);
            const outside=pts.filter(([x,y,z])=>x < -q.w/2-1e-6 || x > q.w/2+1e-6 || y < -q.d/2-1e-6 || y > q.d/2+1e-6 || z < -1e-6 || z > q.totalH+1e-6).length;
            const mullions=recessedStackedBuildingLines(legacy).filter(s=>s.recessedWindowMullion).length;
            const gizmo=recessedStackedGizmo(legacy);
            const floorHeightHandle=!!gizmo?.handles?.floorHeight?.s?.ok && gizmo.handles.floorHeight.kind==='recessed-floor-height';
            const changed=normalizedAsset({...legacy,...recessedHandlePatch(legacy,'recessed-floor-height',q.floorHeight+0.4)});
            results.push({dims,lineSame,faceSame,boundsSame,outside,mullions,floorHeightHandle,heightChanged:recessedStackedBuildingParams(changed).totalH>q.totalH});
        }
        return {inputsGone,results};
    });
    // 実際に3Dビューの階高ハンドルをドラッグして値が変わることも確認する。
    const drag = await page.evaluate(() => {
        const o=S.find(s=>s.ob && s.ob.asset==='recessedStackedBuilding').ob;
        sel=o.id; tool='edit'; setMode('draw'); cityStandardView('home'); CAMKEY=null; render();
        const h=specialGizmo(o)?.handles?.floorHeight, cv=document.querySelector('canvas'), rc=cv.getBoundingClientRect(), css=cv.width/rc.width;
        return h?.s?.ok ? {x:rc.x+h.s.x/css,y:rc.y+h.s.y/css,dx:h.dir.x*35,dy:h.dir.y*35,hit:(hitGizmo({x:h.s.x,y:h.s.y})||{}).t,before:recessedStackedBuildingParams(o).floorHeight} : null;
    });
    if(drag) {
        await page.mouse.move(drag.x,drag.y); await page.mouse.down();
        await page.mouse.move(drag.x+drag.dx,drag.y+drag.dy,{steps:4}); await page.mouse.up();
        drag.after=await page.evaluate(()=>recessedStackedBuildingParams(S.find(s=>s.ob&&s.ob.asset==='recessedStackedBuilding').ob).floorHeight);
    }
    res.drag=drag;
    console.log(JSON.stringify(res));
    const bad=res.results.filter(r=>!r.lineSame||!r.faceSame||!r.boundsSame||r.outside||r.mullions!==12||!r.floorHeightHandle||!r.heightChanged);
    if(!res.inputsGone||bad.length||errors.length || !drag || drag.hit!=='recessed-floor-height' || Math.abs(drag.after-drag.before)<0.01){console.error('NG',JSON.stringify({bad,errors}));process.exitCode=1;}
    else console.log('OK: no beam geometry or controls; old data ignored; size, windows and height handle preserved');
    await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
