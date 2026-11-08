const assert=require('assert');const{open,ADD_FN}=require('./lib');
(async()=>{const{browser,page,errors}=await open({width:1280,height:900});await page.evaluate(ADD_FN);const ids=await page.evaluate(()=>{document.getElementById('side').classList.remove('hide');S.length=0;clearSelection();__add('box',1);const a=sel;__add('sphere',1);const b=sel;render();return{a,b};});
const row=id=>page.locator(`#objectList [data-object="${id}"]`);
await row(ids.b).dragTo(row(ids.a));
await page.waitForTimeout(100);
let attached=await page.evaluate(id=>{const o=obOf(id);return o?.attachment?.sceneParent===true&&o?.attachment?.parentId===window.__testParent;},ids.b);
// Use a target marker for the parent in page context; app IDs are closed over, so compare explicitly.
attached=await page.evaluate(({a,b})=>obOf(b)?.attachment?.sceneParent===true&&obOf(b)?.attachment?.parentId===a,ids);
assert(attached,'drag onto row should parent child');
const parent=await row(ids.a).boundingBox();const list=await page.locator('#objectList').boundingBox();
await row(ids.b).dragTo(page.locator('#objectList'),{targetPosition:{x:Math.max(2,list.width-8),y:Math.max(2,list.height-5)}});
await page.waitForTimeout(100);
const detached=await page.evaluate(({b})=>!obOf(b)?.attachment?.sceneParent,ids);
assert(detached,'drop on empty outliner area should unparent');
assert.strictEqual(errors.length,0);await browser.close();console.log('OK: outliner drag-and-drop parent and unparent');})().catch(e=>{console.error(e);process.exit(1)});
