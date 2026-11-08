/* 新規KITアセットをテスト用HTMLにだけ宣言し、登録・棚・設定・高さ編集を検証。 */
const fs=require('fs'),{chromium}=require('playwright');
(async()=>{
 const html=fs.readFileSync('cyberpunk-city-studio.html','utf8'),marker='/* City Grid Studio asset controller.';
 const declaration=`ASSET_KIT.define('contractTest',{label:'登録試験',glyph:'◧',w:1.4,d:1.1,h:2,group:'building',controls:[{key:'postLength',label:'柱の長さ',type:'number',default:.4,min:.1,max:1.2,step:.05,unit:'m',handle:(o,v)=>ASSET_KIT.axisHandle('z',[0,0,o.h],v)},{key:'withCap',label:'頭部',type:'boolean',default:true}]},(o,K)=>{const t=K.param(o,'postLength',.4);return [K.box(K.rectPath(1,1),0,o.h),K.box(K.rectPath(.12,.12),o.h,o.h+t)];});\n`;
 if(!html.includes(marker))throw Error('injection marker not found');
 const tmp='/tmp/city-asset-contract.html';fs.writeFileSync(tmp,html.replace(marker,declaration+marker));
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto('file://'+tmp);await page.waitForTimeout(800);
 const init=await page.evaluate(()=>{
   const grp=window.cityGridAssetGroups().find(g=>g.key==='building').kinds.includes('contractTest');document.querySelector('[data-asset="contractTest"]').click();
   let o=obOf(sel);setOb(o.id,{ca:0,cb:0,lift:0});regenObjects();cityStandardView('home');tool='edit';render();o=obOf(o.id);
   const initial=o.postLength,shape=JSON.stringify(genShape(o).map(s=>s.p));const f=document.querySelector('[data-asset-control="postLength"]'),check=document.querySelector('[data-asset-control="withCap"]');
   f.value='.8';f.dispatchEvent(new Event('input',{bubbles:true}));f.dispatchEvent(new Event('change',{bubbles:true}));
   const after=obOf(o.id),shapeChanged=shape!==JSON.stringify(genShape(after).map(s=>s.p));
   const rotated={...after,rot:37,rotX:12,rotZ:-8},bounds=obBounds(rotated),points=[...genShape(rotated).flatMap(s=>s.p),...surfaceTriangles(rotated).flat()];
   const boundsOk=points.length>0&&points.every(p=>p.every((v,i)=>v>=bounds.lo[i]-1e-7&&v<=bounds.hi[i]+1e-7));
   const edited=after.postLength;undo();const undone=obOf(o.id).postLength;redo();const redone=obOf(o.id).postLength;render();
   check.click();const bool=obOf(o.id).withCap===false;
   const g=gizmo(),h=g.faces.find(f=>f.id==='top'),cv=document.querySelector('canvas'),rc=cv.getBoundingClientRect(),css=cv.width/rc.width;
   return {boundsOk,group:grp,defaultBefore:initial,edited,undone,redone,bool,shapeChanged,panel:document.getElementById('assetEditorP').style.display,top:!!h,hit:h?(hitGizmo(h.s)||{}).t:null,x:h?rc.x+h.s.x/css:0,y:h?rc.y+h.s.y/css:0,height:obOf(o.id).h};
 });
 if(init.top){await page.mouse.move(init.x,init.y);await page.mouse.down();await page.mouse.move(init.x,init.y-25,{steps:5});await page.mouse.up();init.heightAfter=await page.evaluate(()=>obOf(sel).h);}
 const handleRows=[];
 for(const view of ['home','front','side','top']){
   const r=await page.evaluate(view=>{
      const id=sel;setOb(id,{postLength:.4,ca:0,cb:0,lift:0,h:2});regenObjects();cityStandardView(view);render();
      const o=obOf(id),h=specialGizmo(o)?.registeredHandles?.find(h=>h.paramKey==='postLength'),cv=document.querySelector('canvas'),rc=cv.getBoundingClientRect(),css=cv.width/rc.width;
      if(!h?.s?.ok)return {view};
      return {view,x:rc.x+h.s.x/css,y:rc.y+h.s.y/css,dir:h.dir,hit:(hitGizmo(h.s)||{}).t,kind:h.kind,before:{h:o.h,ra:o.ra,rb:o.rb,post:o.postLength}};
   },view);
   if(r.dir){await page.mouse.move(r.x,r.y);await page.mouse.down();await page.mouse.move(r.x+r.dir.x*16,r.y+r.dir.y*16,{steps:4});await page.mouse.up();r.after=await page.evaluate(()=>{const o=obOf(sel);return {h:o.h,ra:o.ra,rb:o.rb,post:o.postLength}});}
   r.ok=!!r.after&&r.hit===r.kind&&r.after.post>r.before.post+.001&&['h','ra','rb'].every(k=>r.before[k]===r.after[k]);handleRows.push(r);
 }
 const handlesOk=handleRows.every(r=>r.ok);
 const multiSelection=await page.evaluate(()=>{
   const first=sel,firstValue=obOf(first).postLength;
   document.querySelector('[data-asset="contractTest"]').click();const second=sel;
   const field=document.querySelector('[data-asset-control="postLength"]');field.focus();field.value='1.1';
   setSelection(first,false);render();const restored=document.querySelector('[data-asset-control="postLength"]');
   const saved=JSON.parse(JSON.stringify(obOf(first)));
   return {different:first!==second,display:Number(restored.value),expected:firstValue,saved:saved.postLength};
 });
 const multiOk=multiSelection.different&&Math.abs(multiSelection.display-multiSelection.expected)<.0001&&multiSelection.saved===multiSelection.expected;
 const ok=multiOk&&handlesOk&&init.boundsOk&&init.group&&init.defaultBefore===.4&&init.edited===.8&&init.undone===.4&&init.redone===.8&&init.bool&&init.shapeChanged&&init.panel!=='none'&&init.top&&init.hit==='face'&&Math.abs(init.heightAfter-init.height)>.001;
 console.log(JSON.stringify({init,handleRows,multiSelection,errors}));if(!ok||errors.length){console.error('NG');process.exitCode=1}else console.log('OK: new asset registration, group, fields, undo, generic height and declared pole handle × 4 views without per-kind code');
 await browser.close();fs.unlinkSync(tmp);
})().catch(e=>{console.error(e);process.exit(1)});
