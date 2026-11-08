/* 選択変更時の線層キャッシュ：旧方式と全RGBA画素を比較し、再利用されたことも検証。 */
const {open,ADD_FN}=require('./lib');
(async()=>{const {browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);
 const rows=await page.evaluate(()=>{const out=[];for(const view of ['home','front','side','top'])for(const mode of ['surface-bin','surface-aa','line-bin']){
   S.length=0;clearSelection();window.__add('cornerCutBox',1);window.__add('beveledStackedBuilding',1);window.__add('sphere',1);
   const objs=[...new Map(S.filter(s=>s.ob).map(s=>[s.ob.id,s.ob])).values()];objs.forEach((o,i)=>setOb(o.id,{ca:(i-1)*3,cb:0,lift:0}));regenObjects();cityStandardView(view);P.surfaceMode=mode!=='line-bin';$('bin').checked=mode!=='surface-aa';tool='edit';setMode('draw');
   window.__lineCacheBySelection=false;setSelection(objs[0].id,false);render();const key=lineLayerKey;
   setSelection(objs[1].id,false);render();const reused=key===lineLayerKey,fast=ctx.getImageData(0,0,W,H).data;
   window.__lineCacheBySelection=true;render();const full=ctx.getImageData(0,0,W,H).data;let pixels=0;for(let i=0;i<fast.length;i+=4)if(fast[i]!==full[i]||fast[i+1]!==full[i+1]||fast[i+2]!==full[i+2]||fast[i+3]!==full[i+3])pixels++;
   out.push({view,mode,reused,pixels});window.__lineCacheBySelection=false;
 }return out;});
 const bad=rows.filter(r=>!r.reused||r.pixels);console.log(JSON.stringify({cases:rows.length,bad,errors}));if(bad.length||errors.length){console.error('NG');process.exitCode=1}else console.log('OK: selection layer reused; all RGBA pixels match legacy across 12 scenarios');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
