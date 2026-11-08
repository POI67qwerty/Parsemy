/* 既存基準を維持し、意図的な描画修正は個別に承認済み基準へ反映。今回のベベル階縦線は縁の下で止める。 */
const fs=require('fs');const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);
 const cases=[['building','home',false],['cornerCutBox','home',true],['cornerCutBox','top',true],['cornerCutStackedBuilding','home',false],['beveledStackedBuilding','side',false],['recessedStackedBuilding','home',false],['railing','home',true],['sedan','side',true],['sphere','home',true],['stall','home',true]];
 async function capture([kind,view,selected],legacy=false){return page.evaluate(async([kind,view,selected,legacy])=>{
   window.__legacyRecessedCaps=legacy;window.__legacyCornerFascia=legacy;window.__legacyRailingBars=true;S.length=0;clearSelection();window.__add(kind,1);
   const o=[...new Map(S.filter(s=>s.ob).map(s=>[s.ob.id,s.ob])).values()].find(o=>!o.attachment);setOb(o.id,{ca:0,cb:0,lift:0});regenObjects();
   sel=selected?o.id:null;tool=selected?'edit':'view';setMode('draw');P.surfaceMode=true;cityStandardView(view);sync();CAMKEY=null;render();
   const a=ctx.getImageData(0,0,W,H).data;const hash=await crypto.subtle.digest('SHA-256',a);return Array.from(new Uint8Array(hash)).map(n=>n.toString(16).padStart(2,'0')).join('');
  },[kind,view,selected,legacy]);}
 const old=JSON.parse(fs.readFileSync('tests/fixtures/architecture-pixels.chromium.json','utf8')),
       changed={...JSON.parse(fs.readFileSync('tests/fixtures/recessed-floor-fix.chromium.json','utf8')),...JSON.parse(fs.readFileSync('tests/fixtures/corner-fascia-square.chromium.json','utf8'))},
       result={},bad=[];
 for(const c of cases){const key=c.join(':');result[key]=await capture(c);if(result[key] !== (changed[key]||old[key]))bad.push(key);}
 // それぞれ同じ直前のカメラ状態を再現し、旧描画と保存済み元基準を照合する。
 const legacyResults={};
 for(const index of [1,2,4,5]){
  await page.reload();await page.waitForTimeout(800);await page.evaluate(ADD_FN);
  for(const c of cases.slice(0,index))await capture(c,true);
  const c=cases[index],key=c.join(':'),hash=await capture(c,true);legacyResults[key]=hash===old[key];
  if(!legacyResults[key])bad.push(key+':legacy');
 }
 console.log(JSON.stringify({browser:browser.version(),cases:cases.length,legacyResults,bad,errors}));
 if(bad.length||errors.length)process.exitCode=1;else console.log('OK: 7元基準＋3修正後基準、修正3場面の旧方式も元基準に一致');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
