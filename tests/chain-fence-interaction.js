// 金網フェンスの5種菱形ハンドル（直線長・太さ・網目・下パイプ高さ・並べる数）実ドラッグ・UI・Undo/Redo・保存・リセット・モバイル操作
const {open,ADD_FN,URL}=require('./lib');
const {chromium}=require('playwright');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:800});
 await page.evaluate(ADD_FN);
 const dragRows=[];
 // 1. 5つの菱形ハンドルを各ビューで実ドラッグ
 for(const view of ['home','front','side','top'])for(const key of ['fenceStraight','fenceDiameter','fenceMeshPitch','fenceBottomHeight','fenceCount']){
  if(view==='side'&&(key==='fenceStraight'||key==='fenceCount'))continue;
  if(view==='top'&&(key==='fenceMeshPitch'||key==='fenceBottomHeight'))continue;
  const q=await page.evaluate(({view,key})=>{
   S.length=0;clearSelection();__add('chainFence',1);const id=sel;
   setOb(id,{ca:0,cb:0,lift:0,h:1.4,fenceDiameter:.06,fenceMeshPitch:.14,fenceBottomBar:true,fenceBottomHeight:.15,fenceCount:1});
   regenObjects();cityStandardView(view);tool='edit';setMode('draw');render();
   const o=obOf(id),h=specialGizmo(o)?.registeredHandles?.find(x=>x.paramKey===key),rc=cv.getBoundingClientRect(),v=viewShift();
   return h?{view,key,id,hit:hitGizmo(h.s)?.t,x:rc.x+(h.s.x*Z+v[0])*rc.width/W,y:rc.y+(h.s.y*Z+v[1])*rc.height/H,dir:h.dir,
    before:{h:o.h,L:chainFenceStraight(o),diam:chainFenceDiameter(o),bend:chainFenceBend(o),pitch:chainFenceMeshPitch(o),botH:chainFenceBottomHeight(o),count:chainFenceCount(o)}}:null;
  },{view,key});
  if(q){
   const dist=key==='fenceCount'?62:28;
   await page.mouse.move(q.x,q.y);await page.mouse.down();
   await page.mouse.move(q.x+q.dir.x*dist,q.y+q.dir.y*dist,{steps:5});await page.mouse.up();
   q.after=await page.evaluate(id=>{const o=obOf(id);return {h:o.h,L:chainFenceStraight(o),diam:chainFenceDiameter(o),bend:chainFenceBend(o),pitch:chainFenceMeshPitch(o),botH:chainFenceBottomHeight(o),count:chainFenceCount(o)};},q.id);
   q.ok=q.hit==='asset-param-'+key&&(
    key==='fenceStraight'?q.after.L>q.before.L+.01&&q.after.diam===q.before.diam&&q.after.bend===q.before.bend&&q.after.pitch===q.before.pitch:
    key==='fenceDiameter'?q.after.diam>q.before.diam+.001&&Math.abs(q.after.L-q.before.L)<1e-8&&q.after.h===q.before.h:
    key==='fenceMeshPitch'?q.after.pitch>q.before.pitch+.002&&Math.abs(q.after.L-q.before.L)<1e-8&&q.after.diam===q.before.diam:
    key==='fenceBottomHeight'?q.after.botH>q.before.botH+.01&&Math.abs(q.after.L-q.before.L)<1e-8&&q.after.h===q.before.h:
    q.after.count>=2&&Math.abs(q.after.L-q.before.L)<1e-8&&q.after.h===q.before.h
   );
  }
  dragRows.push(q||{view,key,ok:false});
 }
 // 2. 白い面ハンドル（top=高さ、u+=幅）の実ドラッグ
 for(const view of ['home','front'])for(const faceId of ['top','u+']){
  const q=await page.evaluate(({view,faceId})=>{
   S.length=0;clearSelection();__add('chainFence',1);const id=sel;
   setOb(id,{ca:0,cb:0,lift:0});regenObjects();cityStandardView(view);tool='edit';setMode('draw');render();
   const o=obOf(id),f=gizmo()?.faces?.find(x=>x.id===faceId),guide=f?faceScreenGuide(f):null,rc=cv.getBoundingClientRect(),v=viewShift();
   return f&&guide?{view,faceId,id,hit:hitGizmo(f.s)?.t,x:rc.x+(f.s.x*Z+v[0])*rc.width/W,y:rc.y+(f.s.y*Z+v[1])*rc.height/H,dir:guide.dir,
    before:{h:o.h,L:chainFenceStraight(o),bend:chainFenceBend(o),pitch:chainFenceMeshPitch(o)}}:null;
  },{view,faceId});
  if(q){
   await page.mouse.move(q.x,q.y);await page.mouse.down();
   await page.mouse.move(q.x+q.dir.x*26,q.y+q.dir.y*26,{steps:5});await page.mouse.up();
   q.after=await page.evaluate(id=>{const o=obOf(id);return {h:o.h,L:chainFenceStraight(o),bend:chainFenceBend(o),pitch:chainFenceMeshPitch(o)};},q.id);
   q.ok=q.hit==='face'&&Math.abs(q.after.bend-q.before.bend)<1e-8&&q.after.pitch===q.before.pitch&&(faceId==='top'?q.after.h>q.before.h+.01&&Math.abs(q.after.L-q.before.L)<1e-8:q.after.L>q.before.L+.01&&Math.abs(q.after.h-q.before.h)<1e-8);
  }
  dragRows.push(q||{view,faceId,ok:false});
 }
 // 3. 上部スライダー・左パネル（下の横パイプON/OFF）・Undo/Redo・保存・リセット
 const id=await page.evaluate(()=>{
  S.length=0;clearSelection();__add('chainFence',1);const id=sel;
  setOb(id,{ca:0,cb:0,lift:0});tool='edit';setMode('draw');setSide(false);
  document.querySelector('#objP').closest('details').open=true;render();return id;
 });
 const setSlider=async(cid,val)=>{
  await page.locator(`#canvasAssetControl input[data-control-id="${cid}"]`).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},val);
 };
 await setSlider('param:fenceStraight',2.4);
 await setSlider('param:fenceDiameter',0.08);
 await setSlider('param:fenceMeshPitch',0.18);
 await setSlider('param:fenceBottomHeight',0.32);
 await setSlider('param:fenceCount',3);
 await setSlider('param:fenceGap',0.12);
 const bottomChk=page.locator('#objP label:has-text("下の横パイプ") input[type="checkbox"]');
 await bottomChk.scrollIntoViewIfNeeded();
 await bottomChk.uncheck();
 const edited=await page.evaluate(id=>{
  const o=obOf(id);
  return {L:chainFenceStraight(o),diam:chainFenceDiameter(o),pitch:chainFenceMeshPitch(o),botH:chainFenceBottomHeight(o),count:chainFenceCount(o),gap:chainFenceGap(o),bottom:o.fenceBottomBar!==false,parts:chainFenceBuild(o).length};
 },id);
 await page.evaluate(()=>document.activeElement?.blur());
 await page.keyboard.press('Control+z');
 await page.waitForTimeout(60);
 const undone=await page.evaluate(id=>obOf(id).fenceBottomBar!==false,id);
 await page.keyboard.press('Control+Shift+z');
 await page.waitForTimeout(60);
 const redone=await page.evaluate(id=>obOf(id).fenceBottomBar!==false,id);
 const saved=await page.evaluate(id=>{
  const data=JSON.parse(JSON.stringify(pack(true)));unpack(data);setSelection(id);tool='edit';setMode('draw');render();
  const o=obOf(id);
  return {exists:!!o,L:chainFenceStraight(o),diam:chainFenceDiameter(o),pitch:chainFenceMeshPitch(o),botH:chainFenceBottomHeight(o),count:chainFenceCount(o),gap:chainFenceGap(o),bottom:o.fenceBottomBar!==false};
 },id);
 await page.locator('#canvasAssetControl .canvasReset').click();
 const afterReset=await page.evaluate(id=>{
  const o=obOf(id);
  return {w:Math.abs(o.ra)*2,h:o.h,diam:chainFenceDiameter(o),pitch:chainFenceMeshPitch(o),botH:chainFenceBottomHeight(o),count:chainFenceCount(o),gap:chainFenceGap(o),bottom:o.fenceBottomBar!==false};
 },id);
 await browser.close();

 // 4. モバイル390pxタッチ確認
 const mb=await chromium.launch(),mc=await mb.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),mp=await mc.newPage();
 mp.on('pageerror',e=>errors.push(String(e)));
 await mp.goto(URL);await mp.waitForTimeout(400);
 if(!await mp.locator('#assetTray').isVisible())await mp.locator('#assetToggle').tap();
 const tab=mp.locator('[data-asset-group="street"]');await tab.scrollIntoViewIfNeeded();await tab.tap();
 const card=mp.locator('[data-asset="chainFence"]');await card.scrollIntoViewIfNeeded();await card.tap();
 await mp.locator('#canvasAssetControl input[data-control-id="param:fenceBottomHeight"]').evaluate(el=>{el.value='0.28';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
 await mp.locator('#canvasAssetControl input[data-control-id="param:fenceCount"]').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
 const mobileRes=await mp.evaluate(()=>({kind:obOf(sel)?.asset,botH:chainFenceBottomHeight(obOf(sel)),count:chainFenceCount(obOf(sel)),scroll:document.documentElement.scrollWidth<=innerWidth}));
 await mb.close();

 const ok=dragRows.every(r=>r.ok)&&Math.abs(edited.L-2.4)<1e-6&&Math.abs(edited.diam-.08)<1e-6&&Math.abs(edited.pitch-.18)<1e-6&&Math.abs(edited.botH-.32)<1e-6&&edited.count===3&&Math.abs(edited.gap-.12)<1e-6&&!edited.bottom&&edited.parts===6&&undone&&!redone&&saved.exists&&Math.abs(saved.L-2.4)<1e-6&&Math.abs(saved.botH-.32)<1e-6&&saved.count===3&&Math.abs(saved.gap-.12)<1e-6&&!saved.bottom&&Math.abs(afterReset.w-1.8)<1e-6&&Math.abs(afterReset.h-1.4)<1e-6&&Math.abs(afterReset.diam-.06)<1e-6&&Math.abs(afterReset.pitch-.14)<1e-6&&Math.abs(afterReset.botH-.12)<1e-6&&afterReset.count===1&&afterReset.gap===0&&afterReset.bottom&&mobileRes.kind==='chainFence'&&Math.abs(mobileRes.botH-.28)<1e-6&&mobileRes.count===2&&mobileRes.scroll&&!errors.length;
 console.log(JSON.stringify({drags:dragRows.length,edited,undone,redone,saved,afterReset,mobileRes,errors}));
 if(!ok){console.error(JSON.stringify(dragRows.filter(r=>!r.ok)));process.exitCode=1;}
 else console.log('OK: 金網フェンスの5種菱形ハンドル実ドラッグ・UI・下パイプ高さ・並べる数・Undo/Redo・保存・リセット・モバイル');
})().catch(e=>{console.error(e);process.exit(1)});
