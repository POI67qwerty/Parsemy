// UFOキャッチャー・ガチャの画面菱形ハンドル実ドラッグ・上部スライダー・Undo/Redo・保存復元・リセット・モバイル操作検証
const {open,ADD_FN,URL}=require('./lib');
const {chromium}=require('playwright');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:800});
 await page.evaluate(ADD_FN);
 const dragRows=[];
 // 1) UFOキャッチャーの10種菱形ハンドル実ドラッグ
 for(const view of ['home','front'])for(const key of ['ufoBaseHeight','ufoBevel','ufoConsoleWidth','ufoChuteWidth','ufoChuteHeight','ufoChuteX','ufoChuteZ','ufoClawX','ufoClawDrop','ufoCount']){
  const q=await page.evaluate(({view,key})=>{
   S.length=0;clearSelection();__add('ufoCatcher',1);const id=sel;
   setOb(id,{ca:0,cb:0,lift:0});regenObjects();cityStandardView(view);tool='edit';setMode('draw');render();
   const o=obOf(id),h=specialGizmo(o)?.registeredHandles?.find(x=>x.paramKey===key),rc=cv.getBoundingClientRect(),v=viewShift();
   return h?{view,key,id,hit:hitGizmo(h.s)?.t,x:rc.x+(h.s.x*Z+v[0])*rc.width/W,y:rc.y+(h.s.y*Z+v[1])*rc.height/H,dir:h.dir,before:ufoCatcherGeom(o)}:null;
  },{view,key});
  if(q){
   const dist=key==='ufoCount'?64:28;
   await page.mouse.move(q.x,q.y);await page.mouse.down();
   await page.mouse.move(q.x+q.dir.x*dist,q.y+q.dir.y*dist,{steps:5});await page.mouse.up();
   q.after=await page.evaluate(id=>ufoCatcherGeom(obOf(id)),q.id);
   q.ok=q.hit==='asset-param-'+key&&(
    key==='ufoBaseHeight'?q.after.baseH>q.before.baseH+.01:
    key==='ufoBevel'?q.after.bevel>q.before.bevel+.005:
    key==='ufoConsoleWidth'?q.after.consoleW>q.before.consoleW+.01:
    key==='ufoChuteWidth'?q.after.chuteW>q.before.chuteW+.01:
    key==='ufoChuteHeight'?q.after.chuteH>q.before.chuteH+.01:
    key==='ufoChuteX'?q.after.chuteOffX>q.before.chuteOffX+.005:
    key==='ufoChuteZ'?q.after.chuteOffZ>q.before.chuteOffZ+.005:
    key==='ufoClawX'?q.after.clawX>q.before.clawX+.01:
    key==='ufoClawDrop'?q.after.clawDrop>q.before.clawDrop+.01:
    q.after.count>=2
   );
  }
  dragRows.push(q||{view,key,ok:false});
 }
 // 2) ガチャの7種菱形ハンドル（上に積む段数・横に並べる数・取り出し口の幅/高さ/左右/上下・下胴の高さ割合）実ドラッグ
 for(const view of ['home','front'])for(const key of ['gachaStack','gachaCount','gachaChuteWidth','gachaChuteHeight','gachaChuteX','gachaChuteZ','gachaWaistRatio']){
  const q=await page.evaluate(({view,key})=>{
   S.length=0;clearSelection();__add('gachaMachine',1);const id=sel;
   setOb(id,{ca:0,cb:0,lift:0});regenObjects();cityStandardView(view);tool='edit';setMode('draw');render();
   const o=obOf(id),h=specialGizmo(o)?.registeredHandles?.find(x=>x.paramKey===key),rc=cv.getBoundingClientRect(),v=viewShift();
   return h?{view,key,id,hit:hitGizmo(h.s)?.t,x:rc.x+(h.s.x*Z+v[0])*rc.width/W,y:rc.y+(h.s.y*Z+v[1])*rc.height/H,dir:h.dir,before:gachaMachineGeom(o)}:null;
  },{view,key});
  if(q){
   const dist=(key==='gachaStack'||key==='gachaCount')?68:24;
   await page.mouse.move(q.x,q.y);await page.mouse.down();
   await page.mouse.move(q.x+q.dir.x*dist,q.y+q.dir.y*dist,{steps:5});await page.mouse.up();
   q.after=await page.evaluate(id=>gachaMachineGeom(obOf(id)),q.id);
   q.ok=q.hit==='asset-param-'+key&&(
    key==='gachaStack'?q.after.stack>=2:
    key==='gachaCount'?q.after.count>=2:
    key==='gachaChuteWidth'?q.after.chuteW>q.before.chuteW+.005:
    key==='gachaChuteHeight'?q.after.chuteH>q.before.chuteH+.005:
    key==='gachaChuteX'?q.after.chuteOffX>q.before.chuteOffX+.003:
    key==='gachaChuteZ'?q.after.chuteOffZ>q.before.chuteOffZ+.003:
    q.after.waistRatio>q.before.waistRatio+.01
   );
  }
  dragRows.push(q||{view,key,ok:false});
 }
 // 3) ガチャの上部スライダー・Undo/Redo・保存復元・リセット
 const gid=await page.evaluate(()=>{
  S.length=0;clearSelection();__add('gachaMachine',1);const id=sel;
  setOb(id,{ca:0,cb:0,lift:0});tool='edit';setMode('draw');setSide(false);render();return id;
 });
 const setSlider=async(cid,val)=>{
  await page.locator(`#canvasAssetControl input[data-control-id="${cid}"]`).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},val);
 };
 await setSlider('param:gachaStack',3);
 await setSlider('param:gachaCount',2);
 await setSlider('param:gachaWaistRatio',0.54);
 const edited=await page.evaluate(id=>gachaMachineGeom(obOf(id)),gid);
 await page.evaluate(()=>document.activeElement?.blur());
 await page.keyboard.press('Control+z');
 await page.waitForTimeout(60);
 const undone=await page.evaluate(id=>gachaMachineGeom(obOf(id)).waistRatio,gid);
 await page.keyboard.press('Control+Shift+z');
 await page.waitForTimeout(60);
 const redone=await page.evaluate(id=>gachaMachineGeom(obOf(id)).waistRatio,gid);
 const saved=await page.evaluate(id=>{
  const data=JSON.parse(JSON.stringify(pack(true)));unpack(data);setSelection(id);tool='edit';setMode('draw');render();
  return gachaMachineGeom(obOf(id));
 },gid);
 await page.locator('#canvasAssetControl .canvasReset').click();
 const afterReset=await page.evaluate(id=>gachaMachineGeom(obOf(id)),gid);
 await browser.close();

 // 4) モバイル390pxタッチで棚からUFOキャッチャーとガチャを配置＆段積み変更
 const mb=await chromium.launch(),mc=await mb.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),mp=await mc.newPage();
 mp.on('pageerror',e=>errors.push(String(e)));
 await mp.goto(URL);await mp.waitForTimeout(400);
 if(!await mp.locator('#assetTray').isVisible())await mp.locator('#assetToggle').tap();
 const tab=mp.locator('[data-asset-group="street"]');await tab.scrollIntoViewIfNeeded();await tab.tap();
 const ufoCard=mp.locator('[data-asset="ufoCatcher"]');await ufoCard.scrollIntoViewIfNeeded();await ufoCard.tap();
 const ufoPlaced=await mp.evaluate(()=>obOf(sel)?.asset==='ufoCatcher');
 const gachaCard=mp.locator('[data-asset="gachaMachine"]');await gachaCard.scrollIntoViewIfNeeded();await gachaCard.tap();
 await mp.locator('#canvasAssetControl input[data-control-id="param:gachaStack"]').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
 const mobileRes=await mp.evaluate(()=>({kind:obOf(sel)?.asset,stack:gachaMachineGeom(obOf(sel)).stack,scroll:document.documentElement.scrollWidth<=innerWidth}));
 mobileRes.ufoPlaced=ufoPlaced;
 await mb.close();

 const ok=dragRows.every(r=>r.ok)&&edited.stack===3&&edited.count===2&&Math.abs(edited.waistRatio-.54)<1e-6&&Math.abs(undone-.47)<1e-6&&Math.abs(redone-.54)<1e-6&&saved.stack===3&&saved.count===2&&Math.abs(saved.waistRatio-.54)<1e-6&&afterReset.stack===1&&afterReset.count===1&&Math.abs(afterReset.waistRatio-.47)<1e-6&&ufoPlaced&&mobileRes.kind==='gachaMachine'&&mobileRes.stack===2&&mobileRes.scroll&&!errors.length;
 console.log(JSON.stringify({drags:dragRows.length,edited,undone,redone,saved,afterReset,mobileRes,errors}));
 if(!ok){console.error(JSON.stringify(dragRows.filter(r=>!r.ok)));process.exitCode=1;}
 else console.log('OK: UFOキャッチャー・ガチャの菱形ハンドル実ドラッグ・UI・段積み・Undo/Redo・保存・リセット・モバイル');
})().catch(e=>{console.error(e);process.exit(1)});
