/* 新タブへの実画面選択、既存編集設定の移動と手動切替の保持。 */
const{open,ADD_FN}=require('./lib');
(async()=>{let results=[],errorsAll=[];for(const width of [1200,390]){
 const{browser,page,errors}=await open({width,height:800});await page.evaluate(ADD_FN);
 const state=()=>page.evaluate(()=>({tab:document.querySelector('[data-workspace-tab].active')?.dataset.workspaceTab,sel,plan:!!window.cityFloorPlanActive,view:orthView}));
 const initial=await page.evaluate(()=>({tabs:[...document.querySelectorAll('[data-workspace-tab]')].map(x=>x.dataset.workspaceTab),edit:document.querySelector('#snp').closest('[data-workspace-screen]')?.dataset.workspaceScreen,list:document.querySelector('#objectList').closest('[data-workspace-screen]')?.dataset.workspaceScreen,selected:document.querySelector('#objP').closest('[data-workspace-screen]')?.dataset.workspaceScreen,duplicate:document.querySelectorAll('#snp').length}));
 await page.evaluate(()=>setSide(false));await page.locator('[data-workspace-tab="object"]').click();
 if(!await page.locator('#objectEditSectionSlot > details').evaluate(e=>e.open))await page.locator('#objectEditSectionSlot > details > summary').click();await page.locator('#snp').scrollIntoViewIfNeeded();await page.locator('#snp').uncheck();
 let bounds=await page.evaluate(()=>[...document.querySelectorAll('.workspaceTab')].map(b=>{let r=b.getBoundingClientRect();return{l:r.left,r:r.right}}));
 const snap=await page.evaluate(()=>({checked:document.querySelector('#snp').checked,range:!!document.querySelector('#sn'),count:document.querySelectorAll('#snp').length}));
 const ids=await page.evaluate(()=>{S.length=0;clearSelection();__add('box',1);const a=sel;setOb(a,{ca:0,cb:0,lift:0,ra:1,rb:.8,h:1.5});__add('person',1);const p=sel;setOb(p,{ca:2,cb:0,lift:0});render();return{a,p}});
 let placed=await state();await page.locator('[data-workspace-tab="character"]').click();await page.evaluate(()=>render());let manual=await state();
 const personRow=page.locator(`[data-object="${ids.p}"] .objectName`);await page.locator('[data-workspace-tab="object"]').click();await personRow.scrollIntoViewIfNeeded();await personRow.click();let list=await state();
 await page.locator('[data-workspace-tab="perspective"]').click();await page.evaluate(()=>{render();});let keep=await state();
 const q=await page.evaluate(id=>{clearSelection();cityStandardView('home');setSide(true);fit();tool='edit';setMode('draw');render();const r=cv.getBoundingClientRect(),vs=viewShift();for(const s of S.filter(x=>x.ob?.id===id))for(let i=0;i<s.p.length;i+=Math.max(1,Math.floor(s.p.length/12))){const p=scrW(s.p[i]);if(p?.ok&&pickOb(p)===id){const x=r.x+(p.x*Z+vs[0])*r.width/W,y=r.y+(p.y*Z+vs[1])*r.height/H;if(x>r.x+5&&x<r.right-5&&y>r.y+5&&y<r.bottom-5)return{x,y};}}return null},ids.a);
 await page.waitForTimeout(400);if(q)q.target=await page.evaluate(q=>{let e=document.elementFromPoint(q.x,q.y);return e?{tag:e.tagName,id:e.id,cls:e.className}:null},q);if(q)await page.mouse.click(q.x,q.y);let canvas=await state();
 await page.evaluate(id=>{clearSelection();cityFloorPlanEnter('front');tool='edit';setMode('draw');render();cityStudioWorkspace('character')},ids.a);
 const plan=await page.evaluate(id=>{let o=obOf(id),b=obBounds(o),c=b.lo.map((v,i)=>(v+b.hi[i])/2),p=projPoint(c,[Z,0,0,Z,...viewShift()]),r=cv.getBoundingClientRect();return{x:r.left+(p.x+17)*r.width/W,y:r.top+(p.y+17)*r.height/H}},ids.a);
 await page.mouse.click(plan.x,plan.y);let floor=await state();
 const ok=JSON.stringify(initial.tabs)==='["character","perspective","object"]'&&initial.edit==='object'&&initial.list==='object'&&initial.selected==='object'&&initial.duplicate===1&&!snap.checked&&snap.range&&placed.tab==='object'&&manual.tab==='character'&&list.tab==='object'&&list.sel===ids.p&&keep.tab==='perspective'&&q&&canvas.tab==='object'&&canvas.sel===ids.a&&floor.plan&&floor.view==='front'&&floor.tab==='object'&&floor.sel===ids.a&&bounds.every(b=>b.l>=0&&b.r<=width);
 results.push({width,initial,snap,placed,manual,list,keep,q,canvas,floor,bounds,ok});errorsAll.push(...errors);await browser.close();
 }console.log(JSON.stringify({results,errors:errorsAll}));if(errorsAll.length||results.some(r=>!r.ok))process.exitCode=1;else console.log('OK: オブジェクトタブの移動・自動切替・手動維持・3Dと間取り実クリック');
})().catch(e=>{console.error(e);process.exit(1)});
