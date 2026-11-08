/* タッチ対応のモバイルWebKitで合成PointerEventによる6方向ピンチを確認する。
   OSからの実タッチやiPad実機Safariの代替ではない。 */
const {open,ADD_FN}=require('./lib');
(async()=>{const{browser,page,errors}=await open({width:1024,height:768});await page.evaluate(ADD_FN);
const rows=[];for(const view of ['front','back','top','bottom','side','left']){
 const r=await page.evaluate(view=>{
  S.length=0;clearSelection();__add('box',1);const id=sel;setOb(id,{ca:0,cb:0,lift:0,h:2});regenObjects();clearSelection();cityFloorPlanEnter(view);setCameraLock(true);tool='view';render();
  const rc=cv.getBoundingClientRect(),x=rc.left+rc.width*.54,y=rc.top+rc.height*.40;
  const before={object:JSON.stringify(obOf(id)),camera:JSON.stringify(P),history:HU.length,scale:window.cityFloorPlanScale};
  const raw=rawOf(x,y+70),v=viewShift(),anchor=orthWorldAt({x:(raw.x-v[0])/Z,y:(raw.y-v[1])/Z});
  const fire=(type,pid,px,py)=>cv.dispatchEvent(new PointerEvent(type,{pointerId:pid,pointerType:'touch',clientX:px,clientY:py,bubbles:true,cancelable:true,button:0,buttons:type==='pointerup'?0:1}));
  fire('pointerdown',71,x-30,y+70);fire('pointerdown',72,x+30,y+70);fire('pointermove',71,x-55,y+75);fire('pointermove',72,x+75,y+85);fire('pointerup',71,x-55,y+75);fire('pointerup',72,x+75,y+85);
  const p=projPoint(anchor,[Z,0,0,Z,...viewShift()]),at=rawOf(x+10,y+80),after={object:JSON.stringify(obOf(id)),camera:JSON.stringify(P),history:HU.length,scale:window.cityFloorPlanScale,ptr,tc:TC.size};
  return {view,target:document.elementFromPoint(x,y+70)===cv,scaleRatio:after.scale/before.scale,anchorError:Math.hypot(p.x-at.x,p.y-at.y),unchanged:before.object===after.object&&before.camera===after.camera&&before.history===after.history,ptr:after.ptr,tc:after.tc};
 },view);r.ok=r.target&&r.scaleRatio>1.5&&r.anchorError<.05&&r.unchanged&&r.ptr===null&&r.tc===0;rows.push(r);
}console.log(JSON.stringify({rows,errors}));if(errors.length||rows.some(r=>!r.ok))process.exitCode=1;else console.log('OK: モバイルWebKit、合成2指イベントによる6方向ピンチ');await browser.close()})().catch(e=>{console.error(e);process.exit(1)});
