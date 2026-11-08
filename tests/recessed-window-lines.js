/* 凹階層建物の窓枚数を変えたとき、生成した桟が実際に描かれるかを確認。 */
const { open, ADD_FN } = require('./lib');
(async () => {
    const { browser,page,errors }=await open();
    await page.evaluate(ADD_FN);
    const rows=await page.evaluate(()=>{
        S.length=0; clearSelection(); window.__add('recessedStackedBuilding',1);
        const o=S.find(s=>s.ob && s.ob.asset==='recessedStackedBuilding').ob;
        setOb(o.id,{ca:0,cb:0,lift:0}); regenObjects(); sel=null;
        P.surfaceMode=true; cityStandardView('home'); window.__noLineCache=true;
        const orig=strokeWVisible; let target=null;
        strokeWVisible=function(c,s){if(s===target)return orig.apply(this,arguments)};
        const out=[];
        for(const [count,depth] of [[2,.32],[5,.32],[9,.32],[5,.05],[5,.7],[5,1.2]]) {
            setOb(o.id,{recessedWindowCount:count,recessedWindowDepth:depth}); regenObjects();
            const lines=S.filter(s=>s.ob && s.ob.id===o.id && s.recessedWindowMullion);
            let drawn=0;
            for(const s of lines) {
                target=s; render();
                const im=LC.getContext('2d').getImageData(0,0,W,H).data, tf=[Z,0,0,Z,...viewShift()];
                let hits=0;
                for(const v of s.p) {
                    const p=projPoint(v,tf),x=Math.round(p.x),y=Math.round(p.y);
                    if(!p.ok || x<1 || y<1 || x>=W-1 || y>=H-1) continue;
                    let ink=false;
                    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(im[((y+dy)*W+x+dx)*4+3]>120)ink=true;
                    if(ink)hits++;
                }
                if(hits>=2)drawn++;
            }
            out.push({count,depth,lines:lines.length,drawn});
        }
        return out;
    });
    console.log(JSON.stringify(rows));
    const bad=rows.filter(r=>r.lines!==3*(r.count-1) || r.drawn<(r.depth===1.2 ? r.lines-3 : r.lines));
    if(bad.length || errors.length){console.error('NG',JSON.stringify({bad,errors}));process.exitCode=1;}
    else console.log('OK: 全3階の窓桟の生成・描画（最深設定では一部がこの視点で遮蔽）');
    await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
