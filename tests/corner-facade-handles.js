/* 隅切り看板の高さ・張り出しを、実マウスで操作する。 */
const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open({width:1400,height:900});await page.evaluate(ADD_FN);
 const rows=[];
 for(const corner of ['front-left','front-right','back-left','back-right'])
 for(const view of ['home','front','side','top'])
 for(const sides of [false,true])
 for(const name of ['height','projection']){
   const before=await page.evaluate(([corner,view,sides,name])=>{
     S.length=0;clearSelection();window.__add('cornerCutBox',1);const id=S.find(s=>s.ob?.asset==='cornerCutBox').ob.id;
     setOb(id,{ca:0,cb:0,lift:0,rot:corner.endsWith('right')?37:0,cornerCutCorner:corner,cornerCutOpeningEnabled:true,facadeEnabled:true,facadeHeight:.7,facadeProjection:.25,facadeSides:sides});regenObjects();sel=id;tool='edit';setMode('draw');cityStandardView(view);sync();CAMKEY=null;render();
     const o=obOf(id),sg=specialGizmo(o),h=sg.facade?.handles[name],cv=document.querySelector('canvas'),rc=cv.getBoundingClientRect(),css=cv.width/rc.width;
     if(!h?.s?.ok)return null;
     const op=cornerCutOpeningParams(o), f=cornerCutFasciaParts(o);
     return {x:rc.x+h.s.x/css,y:rc.y+h.s.y/css,dir:h.dir,hit:(hitGizmo({x:h.s.x,y:h.s.y})||{}).t,kind:h.kind,start:h.start,params:{ra:o.ra,rb:o.rb,h:o.h,ca:o.ca,cb:o.cb,lift:o.lift,rot:o.rot,cornerOffset:o.cornerOffset,opening:JSON.stringify(op),facadeHeight:buildingFasciaGeometry(o).height,facadeProjection:buildingFasciaGeometry(o).projection,top:f.g.z1},css};
   },[corner,view,sides,name]);
   if(before){
     const direction=sides?-1:1;
     await page.mouse.move(before.x,before.y);await page.mouse.down();await page.mouse.move(before.x+before.dir.x*14*direction,before.y+before.dir.y*14*direction,{steps:4});await page.mouse.up();
     before.after=await page.evaluate(()=>{const o=obOf(sel),g=buildingFasciaGeometry(o);return {ra:o.ra,rb:o.rb,h:o.h,ca:o.ca,cb:o.cb,lift:o.lift,rot:o.rot,cornerOffset:o.cornerOffset,opening:JSON.stringify(cornerCutOpeningParams(o)),facadeHeight:g.height,facadeProjection:g.projection,top:g.z1};});
   }
   const prop=name==='height'?'facadeHeight':'facadeProjection',other=name==='height'?'facadeProjection':'facadeHeight',after=before?.after;
   const stable=!!after&&Object.keys(before.params).filter(k=>k!==prop).every(k=>before.params[k]===after[k]),delta=after?after[prop]-before.params[prop]:0;
   rows.push({corner,view,sides,name,hit:before?.hit,kind:before?.kind,delta,stable,directionOk:sides?delta<-.001:delta>.001});
 }
 const undoRedo=await page.evaluate(()=>{const id=sel,changed=buildingFasciaGeometry(obOf(id)).projection;undo();const undone=buildingFasciaGeometry(obOf(id)).projection;redo();const redone=buildingFasciaGeometry(obOf(id)).projection;return {changed,undone,redone,ok:Math.abs(undone-.25)<1e-7&&Math.abs(redone-changed)<1e-7};});
 const off=await page.evaluate(()=>{let o=obOf(sel);setOb(o.id,{facadeEnabled:false});regenObjects();render();return !specialGizmo(obOf(o.id)).facade;});
 const bad=rows.filter(r=>r.hit!==r.kind||!r.kind||!r.stable||!r.directionOk);
 console.log(JSON.stringify({count:rows.length,bad,facadeOffNoHandles:off,undoRedo,errors}));
 if(bad.length||!off||!undoRedo.ok||errors.length){console.error('NG');process.exitCode=1;}
 else console.log('OK: facade height and projection actual drags 64 cases; opening, other dimensions and top stay fixed');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
