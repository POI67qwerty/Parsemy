/* 既存の隅切り直方体にも専用ハンドルが引き続き機能するか確認。 */
const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open({width:1400,height:900});await page.evaluate(ADD_FN);
 const props={offset:'cornerOffset',left:'cornerCutOpeningW',right:'cornerCutOpeningW',height:'cornerCutOpeningH',depth:'cornerCutOpeningDepth'},rows=[];
 for(const view of ['home','front','side','top'])for(const name of Object.keys(props)){
  const a=await page.evaluate(([view,name])=>{
   S.length=0;clearSelection();window.__add('cornerCutBox',1);let o=S.find(s=>s.ob?.asset==='cornerCutBox').ob;
   setOb(o.id,{ca:0,cb:0,lift:0,cornerCutOpeningEnabled:true});regenObjects();sel=o.id;tool='edit';setMode('draw');cityStandardView(view);sync();CAMKEY=null;render();o=obOf(o.id);
   const sg=specialGizmo(o),h=name==='offset'?sg.handle:sg.opening?.handles[name],cv=document.querySelector('canvas'),rc=cv.getBoundingClientRect(),css=cv.width/rc.width;
   if(!h?.s?.ok)return null;
   return {facadeEnabled:buildingFasciaGeometry(o).enabled,x:rc.x+h.s.x/css,y:rc.y+h.s.y/css,dir:h.dir,hit:(hitGizmo({x:h.s.x,y:h.s.y})||{}).t,kind:h.kind,before:o[name==='offset'?'cornerOffset':name==='height'?'cornerCutOpeningH':name==='depth'?'cornerCutOpeningDepth':'cornerCutOpeningW']};
  },[view,name]);
  if(a){await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(a.x+a.dir.x*14,a.y+a.dir.y*14,{steps:4});await page.mouse.up();a.after=await page.evaluate(k=>obOf(sel)[k],props[name]);}
  rows.push({view,name,...a,changed:!!a && Math.abs(a.after-a.before)>.001});
 }
 const bad=rows.filter(r=>!r.kind||r.hit!==r.kind||!r.changed||!r.facadeEnabled);console.log(JSON.stringify(rows.map(({view,name,hit,kind,changed})=>({view,name,hit,kind,changed}))));
 if(bad.length||errors.length){console.error('NG',JSON.stringify({bad,errors}));process.exitCode=1;}else console.log('OK: corner box 5 handles × 4 views with facade ON');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
