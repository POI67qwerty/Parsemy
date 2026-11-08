/* 表示中央へ：前横上で選択中心だけを画面へ寄せ、カメラ・オブジェクトは不変。 */
const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open({width:1400,height:900});await page.evaluate(ADD_FN);
 const id=await page.evaluate(()=>{S.length=0;clearSelection();__add('box',1);const id=sel;setOb(id,{ca:12,cb:-7,lift:4,ra:1.8,rb:1.1,h:3,rot:37});P.cx=5;P.cz=-4;P.ch=3.5;P.yaw=22;P.pitch=17;sync();regenObjects();return id;});
 const results=[];
 for(const [view,button] of [['front','#viewFloorFront'],['side','#viewFloorSide'],['top','#viewFloorTop']])for(const [zoom,x,y] of [[1,0,0],[1.7,93,-57],[.75,-44,61]]){
  await page.locator(button).click();
  const before=await page.evaluate(([id,zoom,x,y])=>{setSelection(id);Z=zoom;ox=x;oy=y;sync();render();const b=groupBounds(selectedObjects()),c=b.lo.map((v,i)=>(v+b.hi[i])/2),p=projPoint(c,[Z,0,0,Z,...viewShift()]);return {p:[p.x,p.y],camera:JSON.stringify(P),objects:JSON.stringify([...new Map(S.filter(s=>s.ob).map(s=>[s.ob.id,s.ob])).values()]),zoom:Z,pan:[ox,oy],scale:orthScale(),history:HU.length};},[id,zoom,x,y]);
  await page.locator('#floorViewCenter').click();
  const after=await page.evaluate(()=>{const b=groupBounds(selectedObjects()),c=b.lo.map((v,i)=>(v+b.hi[i])/2),p=projPoint(c,[Z,0,0,Z,...viewShift()]);return {p:[p.x,p.y],center:[W/2,H/2],camera:JSON.stringify(P),objects:JSON.stringify([...new Map(S.filter(s=>s.ob).map(s=>[s.ob.id,s.ob])).values()]),zoom:Z,pan:[ox,oy],scale:orthScale(),history:HU.length,view:orthView};});
  results.push({view,zoom,offset:Math.hypot(before.p[0]-after.center[0],before.p[1]-after.center[1]),err:Math.hypot(after.p[0]-after.center[0],after.p[1]-after.center[1]),unchanged:before.camera===after.camera&&before.objects===after.objects&&before.zoom===after.zoom&&JSON.stringify(before.pan)===JSON.stringify(after.pan)&&before.scale===after.scale&&before.history===after.history,correctView:after.view===view});
 }
 // 複数選択は選択範囲全体、接続した子だけの選択は子自身へ寄せる。
 const extra=await page.evaluate(()=>{
  __add('box',1);const second=sel;setOb(second,{ca:-8,cb:8,lift:1,h:2});setSelection([...new Map(S.filter(s=>s.ob).map(s=>[s.ob.id,s.ob])).values()].find(o=>o.id!==second).id);setSelection(second,true);Z=1.3;ox=33;oy=-17;render();const cam=JSON.stringify(P),ob=JSON.stringify(selectedObjects()),b=groupBounds(selectedObjects()),c=b.lo.map((v,i)=>(v+b.hi[i])/2);document.getElementById('floorViewCenter').click();let q=projPoint(c,[Z,0,0,Z,...viewShift()]);const multi={count:selectedObjects().length,err:Math.hypot(q.x-W/2,q.y-H/2),unchanged:cam===JSON.stringify(P)&&ob===JSON.stringify(selectedObjects())};
  S.length=0;clearSelection();__add('buildingSign',1);const all=[...new Map(S.filter(s=>s.ob).map(s=>[s.ob.id,s.ob])).values()],child=all.find(o=>o.linkedRole==='child');setSelection(child.id);render();const b2=groupBounds(selectedObjects()),c2=b2.lo.map((v,i)=>(v+b2.hi[i])/2),oldCam=JSON.stringify(P),oldOb=JSON.stringify(child);document.getElementById('floorViewCenter').click();q=projPoint(c2,[Z,0,0,Z,...viewShift()]);const attachment={count:selectedObjects().length,selected:sel===child.id,err:Math.hypot(q.x-W/2,q.y-H/2),unchanged:oldCam===JSON.stringify(P)&&oldOb===JSON.stringify(obOf(child.id))};
  clearSelection();const pc=JSON.stringify(window.cityFloorPlanCenter),noCamera=JSON.stringify(P);document.getElementById('floorViewCenter').click();const noSelection=pc===JSON.stringify(window.cityFloorPlanCenter)&&noCamera===JSON.stringify(P);
  const before3d=JSON.stringify(P);document.getElementById('viewHome').click();const back3d=orthView===null&&JSON.stringify(P)===before3d;
  cityStandardView('front');setSelection(child.id);const b3=groupBounds(selectedObjects()),c3=b3.lo.map((v,i)=>(v+b3.hi[i])/2),cam3=JSON.stringify(P);document.getElementById('floorViewCenter').click();q=projPoint(c3,[Z,0,0,Z,...viewShift()]);const normalOrtho={active:window.cityFloorPlanActive,err:Math.hypot(q.x-W/2,q.y-H/2),cameraSame:cam3===JSON.stringify(P)};
  return {multi,attachment,noSelection,back3d,normalOrtho};
 });
 console.log(JSON.stringify({results,extra,errors}));if(results.some(r=>r.err>.01||!r.unchanged||!r.correctView)||extra.multi.count!==2||extra.multi.err>.01||!extra.multi.unchanged||extra.attachment.count!==1||!extra.attachment.selected||extra.attachment.err>.01||!extra.attachment.unchanged||!extra.noSelection||!extra.back3d||extra.normalOrtho.active||extra.normalOrtho.err>.01||!extra.normalOrtho.cameraSame||errors.length)process.exitCode=1;else console.log('OK: 前横上×3ズーム・パン、複数選択、接続子、3Dカメラ保持');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
