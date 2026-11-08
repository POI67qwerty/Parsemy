/* 個別編集時、選択した階の高さと隅切りハンドルがその階に追従する。 */
const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open({width:1400,height:900});await page.evaluate(ADD_FN);
 const r=await page.evaluate(()=>{
  S.length=0;clearSelection();window.__add('cornerCutStackedBuilding',1);let o=S.find(s=>s.ob?.asset==='cornerCutStackedBuilding').ob;
  let floors=o.floors.map(f=>({...f}));floors[2].x=.4;floors[2].y=-.3;
  setOb(o.id,{ca:0,cb:0,lift:0,floors,individualEdit:true,activeFloor:2,openingEnabled:true});regenObjects();sel=o.id;tool='edit';setMode('draw');cityStandardView('home');sync();CAMKEY=null;render();o=obOf(o.id);
  const sg=specialGizmo(o),h=sg.handles.height,cv=document.querySelector('canvas'),rc=cv.getBoundingClientRect(),css=cv.width/rc.width;
  return {x:rc.x+h.s.x/css,y:rc.y+h.s.y/css,dir:h.dir,hit:(hitGizmo({x:h.s.x,y:h.s.y})||{}).t,index:sg.floorIndex,corner:!!sg.cornerHandle,opening:!!sg.cornerOpening,before:o.floors.map(f=>({x:f.x,y:f.y,z:f.z,w:f.w,d:f.d,h:f.h}))};
 });
 await page.mouse.move(r.x,r.y);await page.mouse.down();await page.mouse.move(r.x+r.dir.x*15,r.y+r.dir.y*15,{steps:4});await page.mouse.up();
 r.after=await page.evaluate(()=>obOf(sel).floors.map(f=>({x:f.x,y:f.y,z:f.z,w:f.w,d:f.d,h:f.h})));
 const beforeGap=r.before[3].z-r.before[2].z-r.before[2].h, afterGap=r.after[3].z-r.after[2].z-r.after[2].h;
 const stable=r.after.every((f,i)=>f.x===r.before[i].x&&f.y===r.before[i].y&&f.w===r.before[i].w&&f.d===r.before[i].d&&(i===2||f.h===r.before[i].h)) && r.after[0].z===r.before[0].z&&r.after[1].z===r.before[1].z&&r.after[2].z===r.before[2].z;
 console.log(JSON.stringify({r,beforeGap,afterGap,stable,errors}));
 if(!(r.hit==='stacked-height'&&r.index===2&&r.corner&&r.opening&&r.after[2].h>r.before[2].h&&Math.abs(beforeGap-afterGap)<1e-7&&stable&&!errors.length)){console.error('NG');process.exitCode=1;}
 else console.log('OK: individual 3F height, positions and gap preserved');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
