const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);const rows=[];
 for(const key of ['hoodLength','hoodFrameDepth','hoodKnee','hoodThickness','hoodBevel'])for(const view of ['home','front','side','top']){
  const q=await page.evaluate(({key,view})=>{S.length=0;clearSelection();__add('screenHood',1);const id=sel;setOb(id,{ca:0,cb:0,lift:0});cityStandardView(view);tool='edit';setMode('draw');render();const o=obOf(id),ctl=assetEditorControls(o).find(c=>c.key===key),handle=specialGizmo(o)?.registeredHandles?.find(x=>x.paramKey===key),r=cv.getBoundingClientRect(),v=viewShift();if(!handle||!ctl)return{key,view,id,ok:false};return {key,view,id,hit:hitGizmo(handle.s)?.t,x:r.x+(handle.s.x*Z+v[0])*r.width/W,y:r.y+(handle.s.y*Z+v[1])*r.height/H,dir:handle.dir,before:assetControlValue(o,ctl),h:o.h,ra:o.ra,rb:o.rb}},{key,view});
  if(q.dir){await page.mouse.move(q.x,q.y);await page.mouse.down();await page.mouse.move(q.x+q.dir.x*30,q.y+q.dir.y*30,{steps:7});await page.mouse.up();q.after=await page.evaluate(({id,key})=>{const o=obOf(id),c=assetEditorControls(o).find(c=>c.key===key);return{value:assetControlValue(o,c),h:o.h,ra:o.ra,rb:o.rb}},{id:q.id,key});q.ok=q.hit==='asset-param-'+key&&q.after.value>q.before+.0001&&q.after.h===q.h&&q.after.ra===q.ra&&(['hoodLength','hoodFrameDepth'].includes(key)||q.after.rb===q.rb);}
  rows.push(q);
 }
 console.log(JSON.stringify({rows,errors}));if(errors.length||rows.some(r=>!r.ok))process.exitCode=1;else console.log('OK: 5項目×4ビューの実ハンドルドラッグ');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
