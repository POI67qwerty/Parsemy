const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);
 const r=await page.evaluate(()=>{
  const original=drawGizmo;let count=0;window.drawGizmo=(c)=>{count++;return original(c)};
  S.length=0;clearSelection();__add('box',1);const id=sel;setOb(id,{ca:0,cb:0,lift:0});
  const views=['front','top','side'];
  const result=views.map(v=>{cityFloorPlanEnter(v);render();return{view:v,active:!!window.cityFloorPlanActive,gizmoCalls:count,gizmo:gizmo()!=null};});
  return result;
 });
 console.log(JSON.stringify({r,errors}));
 if(errors.length||r.some(x=>!x.gizmo||x.gizmoCalls===0))process.exitCode=1;
 else console.log('OK: 正面・上面・横ビューでもCanvasギズモを描画');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
