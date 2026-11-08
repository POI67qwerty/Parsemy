const assert=require('assert');
const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open();await page.evaluate(ADD_FN);
 const result=await page.evaluate(()=>{
  S.length=0;clearSelection();__add('building',1);const id=sel;render();
  const opening=document.getElementById('buildingOpeningEnabled'),awning=document.getElementById('buildingF1AwningEnabled'),type=document.getElementById('buildingF1AwningType'),sign=document.getElementById('buildingF1SignEnabled');
  opening.checked=false;opening.dispatchEvent(new Event('change',{bubbles:true}));
  awning.checked=true;awning.dispatchEvent(new Event('change',{bubbles:true}));
  type.value='corrugated';type.dispatchEvent(new Event('change',{bubbles:true}));
  sign.checked=true;sign.dispatchEvent(new Event('change',{bubbles:true}));
  const children=sceneObjects().filter(o=>o.attachment?.parentId===id);
  return {opening:obOf(id).openingEnabled,awning:obOf(id).f1AwningEnabled,type:obOf(id).f1AwningType,sign:obOf(id).f1SignEnabled,awningChild:children.find(o=>o.f1Feature==='awning')?.visible,signChild:children.find(o=>o.f1Feature==='sign')?.visible,order:!!(opening.closest('label').compareDocumentPosition(document.getElementById('buildingDoorP'))&Node.DOCUMENT_POSITION_FOLLOWING),has:[!!opening,!!awning,!!type,!!sign]};
 });
 assert.deepStrictEqual(result.has,[true,true,true,true]);
 assert.strictEqual(result.order,true,'opening option should be above the door panel');
 assert.deepStrictEqual([result.opening,result.awning,result.type,result.sign,result.awningChild,result.signChild],[false,true,'corrugated',true,true,true]);
 assert.strictEqual(errors.length,0,JSON.stringify(errors));
 console.log(JSON.stringify(result));console.log('OK: F1 settings toggles, awning material selector, and opening control order');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
