/* 車のタイヤの側面の母線が少数生成され、見える側に線画があるか確認。 */
const { open, ADD_FN, URL } = require('./lib');
(async () => {
    const { browser, page, errors } = await open(); await page.close();
    const results=[];
    for (const kind of ['keiTruck','keiVan','sedan','sedan2']) {
        const p=await browser.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
        await p.goto(URL); await p.evaluate(ADD_FN);
        const row=await p.evaluate(k=>{
            S.length=0;clearSelection(); window.__add(k,1);
            const o=S.find(s=>s.ob && s.ob.asset===k).ob;
            setOb(o.id,{ca:0,cb:0,lift:0}); regenObjects(); sel=null;
            P.surfaceMode=true; cityStandardView('home'); window.__noLineCache=true;
            const w=pentaGeometry(o).tireW;
            const candidates=S.filter(s=>{
                const p0=s.p[0], p1=s.p[s.p.length-1];
                return Math.abs(Math.abs(p1[0]-p0[0])-w)<.001 && Math.abs(p1[1]-p0[1])<.001 && Math.abs(p1[2]-p0[2])<.001;
            });
            const orig=strokeWVisible; let target=null;
            strokeWVisible=function(c,s){ if(s===target) return orig.apply(this,arguments); };
            let visible=0, hidden=0;
            for (const s of candidates) {
                target=s; render();
                const im=LC.getContext('2d').getImageData(0,0,W,H).data, tf=[Z,0,0,Z,...viewShift()];
                let seen=0,n=0;
                for(const v of s.p) {
                    const q=projPoint(v,tf),x=Math.round(q.x),y=Math.round(q.y);
                    if(!q.ok || x<1 || y<1 || x>=W-1 || y>=H-1) continue;
                    n++; let hit=false;
                    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) if(im[((y+dy)*W+x+dx)*4+3]>120)hit=true;
                    if(hit) seen++;
                }
                if(n && seen>=2) visible++; else hidden++;
            }
            return {kind:k,lines:candidates.length,visible,hidden};
        },kind);
        row.errors=errs; results.push(row); await p.close();
    }
    console.log(JSON.stringify(results));
    const bad=results.filter(r=>r.lines!==16 || r.visible<2 || r.errors.length);
    if(bad.length || errors.length){console.error('NG',JSON.stringify({bad,errors}));process.exitCode=1;}
    else console.log('OK: 4 lines per tire; visible-side ink present');
    await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
