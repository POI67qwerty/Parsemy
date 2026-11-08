/* 隅切り階層の各画面ハンドルを実マウスで検査（3D・正面・横・上）。 */
const {open,ADD_FN}=require('./lib');
(async()=>{
  const {browser,page,errors}=await open({width:1400,height:900});await page.evaluate(ADD_FN);
  const rows=[];
  const wanted={offset:'cornerCut-offset',left:'cornerCut-opening-width-left',right:'cornerCut-opening-width-right',height:'cornerCut-opening-height',depth:'cornerCut-opening-depth'};
  const properties={offset:'cornerOffset',left:'openingW',right:'openingW',height:'openingH',depth:'openingBack'};
  for(const view of ['home','front','side','top']) for(const name of Object.keys(wanted)){
    const p=await page.evaluate(([view,name])=>{
      S.length=0;clearSelection();window.__add('cornerCutStackedBuilding',1);
      let o=S.find(s=>s.ob?.asset==='cornerCutStackedBuilding').ob;
      setOb(o.id,{ca:0,cb:0,lift:0,openingEnabled:true});regenObjects();sel=o.id;tool='edit';setMode('draw');
      cityStandardView(view);sync();CAMKEY=null;render();o=obOf(o.id);
      const sg=specialGizmo(o),h=name==='offset'?sg.cornerHandle:sg.cornerOpening?.handles[name];
      const cv=document.querySelector('canvas'),r=cv.getBoundingClientRect(),css=cv.width/r.width;
      if(!h?.s?.ok)return {missing:true};
      return {x:r.x+h.s.x/css,y:r.y+h.s.y/css,dir:h.dir,scale:h.scale,css,hit:(hitGizmo({x:h.s.x,y:h.s.y})||{}).t,
        rot:o.rot,rotX:o.rotX||0,rotZ:o.rotZ||0,before:{cornerOffset:o.cornerOffset,openingW:o.openingW,openingH:o.openingH,openingBack:o.openingBack},
        floors:o.floors.map(f=>({x:f.x,y:f.y,z:f.z,w:f.w,d:f.d,h:f.h})),start:h.start,max:h.max,min:h.min};
    },[view,name]);
    if(!p.missing){
      const step=(p.start>=p.max-0.02?-1:1)*18;
      await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+step*p.dir.x,p.y+step*p.dir.y,{steps:4});await page.mouse.up();
      p.after=await page.evaluate(()=>{const o=obOf(sel);return {cornerOffset:o.cornerOffset,openingW:o.openingW,openingH:o.openingH,openingBack:o.openingBack,floors:o.floors.map(f=>({x:f.x,y:f.y,z:f.z,w:f.w,d:f.d,h:f.h}))};});
      p.changed=Math.abs(p.after[properties[name]]-p.before[properties[name]])>0.001;
      p.otherStable=Object.keys(p.before).filter(k=>k!==properties[name]).every(k=>Math.abs(p.after[k]-p.before[k])<1e-7);
      p.floorsStable=JSON.stringify(p.floors)===JSON.stringify(p.after.floors);
    }
    rows.push({view,name,...p});
  }
  const bad=rows.filter(r=>r.missing||r.hit!==wanted[r.name]||!r.changed||!r.otherStable||!r.floorsStable||r.rot!==90||r.rotX||r.rotZ);
  console.log(JSON.stringify(rows));
  if(bad.length||errors.length){console.error('NG',JSON.stringify({bad,errors}));process.exitCode=1;} else console.log('OK: 5 handles × 4 views, real drag; default rotation 90; other dimensions stable');
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
