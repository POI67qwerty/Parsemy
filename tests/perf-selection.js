/* 同じシーンで選択変更を交互に計測。旧方式と新方式の中央値（ヘッドレス環境）。 */
const {open,ADD_FN}=require('./lib');
(async()=>{const {browser,page,errors}=await open();await page.evaluate(ADD_FN);
 const r=await page.evaluate(()=>{
  S.length=0;window.__add('railing',6);window.__add('beveledStackedBuilding',4);
  const ids=[...new Set(S.filter(s=>s.ob).map(s=>s.ob.id))];tool='edit';mode='draw';
  const median=old=>{window.__lineCacheBySelection=old;setSelection(ids[0],false);render();const times=[];
   for(let i=1;i<=13;i++){const t=performance.now();setSelection(ids[i%ids.length],false);render();ctx.getImageData(0,0,1,1);times.push(performance.now()-t);}
   return +times.sort((a,b)=>a-b)[6].toFixed(1);};
  const runs=[];for(let i=0;i<3;i++)runs.push({old:median(true),optimized:median(false)});
  window.__lineCacheBySelection=false;return {objects:ids.length,points:S.reduce((n,s)=>n+s.p.length,0),runs};
 });console.log(JSON.stringify({r,errors}));if(errors.length)process.exitCode=1;await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
