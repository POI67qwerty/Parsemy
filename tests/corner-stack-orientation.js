/* 既定回転・既存データ互換・階の移動と専用ハンドル位置。 */
const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open();await page.evaluate(ADD_FN);
 const r=await page.evaluate(()=>{
  S.length=0;clearSelection();window.__add('cornerCutStackedBuilding',1);let a=S.find(s=>s.ob?.asset==='cornerCutStackedBuilding').ob;
  setOb(a.id,{ca:0,cb:0,lift:0,openingEnabled:true});regenObjects();sel=a.id;tool='edit';setMode('draw');cityStandardView('top');sync();render();a=obOf(a.id);
  const screenVec=o=>{const p=orthPoint(customPt(o,0,0,0)),q=orthPoint(customPt(o,1,0,0));return {x:q.x-p.x,y:q.y-p.y}};
  const original=normalizedAsset(JSON.parse(JSON.stringify({...a,rot:0}))),v0=screenVec(original),v90=screenVec(a), baseRot=a.rot;
  const floors=a.floors.map(f=>({...f}));floors[0].x=.4;floors[0].y=-.25;floors[2].x=-.6;floors[2].y=.8;
  setOb(a.id,{floors,individualEdit:true,activeFloor:2});render();a=obOf(a.id);
  const sg=specialGizmo(a),f=a.floors[2],q=cornerCutBoxParams({...a,ra:f.w/2,rb:f.d/2}),shape=cornerCutFootprint(q.w,q.d,q.cornerOffset,q.cornerCutCorner),
    xy=[(shape[0][0]+shape.at(-1)[0])/2,(shape[0][1]+shape.at(-1)[1])/2],
    expect=scrW(customPt(a,xy[0]+f.x,xy[1]+f.y,f.z+f.h/2)),
    gap=Math.hypot(expect.x-sg.cornerHandle.anchor.x,expect.y-sg.cornerHandle.anchor.y),
    f0=a.floors[0],op=stackedOpeningParams(a,f0).corner,
    expectedFront=scrW(customPt(a,op.frontA[0]+f0.x,op.frontA[1]+f0.y,f0.z)),
    gotFront=sg.cornerOpening.panelFrame[0],
    openingGap=Math.hypot(expectedFront.x-gotFront.x,expectedFront.y-gotFront.y),
    offsetFloor=sg.floorIndex,openingInitial=!!sg.cornerOpening;
  setOb(a.id,{openingEnabled:false});render();a=obOf(a.id);const closed=specialGizmo(a);
  return {baseRot,v0,v90,oldRot:original.rot,gap,openingGap,offsetFloor,openingInitial,closedOpening:closed.cornerOpening===null,closedHandle:!!closed.cornerHandle};
 });
 console.log(JSON.stringify({r,errors}));
 if(!(r.baseRot===90 && r.oldRot===0 && r.v0.x>1 && Math.abs(r.v0.y)<1e-6 && Math.abs(r.v90.x)<1e-6 && r.v90.y< -1 && r.gap<1e-6 && r.openingGap<1e-6 && r.offsetFloor===2 && r.openingInitial && r.closedOpening && r.closedHandle && !errors.length)){
  console.error('NG');process.exitCode=1;
 }else console.log('OK: top-view counterclockwise 90, old rotation retained, handles follow edited floor and first-floor opening');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
