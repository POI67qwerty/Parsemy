const assert=require('assert');
const{open,ADD_FN}=require('./lib');
(async()=>{
 const{browser,page,errors}=await open();
 await page.evaluate(ADD_FN);
 const centered=await page.evaluate(()=>{
  S.length=0;clearSelection();__add('building',1);const id=sel;
  setOb(id,{f1AwningEnabled:true,f1SignEnabled:true,f1AwningOffsetX:.7,f1SignOffsetX:-.6});
  const awningButton=document.getElementById('buildingF1CenterAwning'),signButton=document.getElementById('buildingF1CenterSign');
  awningButton?.click();let a=obOf(id).f1AwningOffsetX;
  signButton?.click();let s=obOf(id).f1SignOffsetX;
  return{awningButton:!!awningButton,signButton:!!signButton,awningOffset:a,signOffset:s,id};
 });
 assert(centered.awningButton&&centered.signButton,'F1 center actions missing');
 assert.strictEqual(centered.awningOffset,0,'tent/tin center action failed');
 assert.strictEqual(centered.signOffset,0,'front sign center action failed');
 const deletion=await page.evaluate(id=>{
  const children=sceneObjects().filter(o=>o.attachment?.parentId===id);
  children.forEach(o=>setOb(o.id,{visible:false}));
  setSelection(id,false);
  const button=document.getElementById('sceneDeleteButton');button?.click();
  return{button:!!button,before:children.map(o=>o.id),after:sceneObjects().map(o=>({id:o.id,parent:o.attachment?.parentId}))};
 },centered.id);
 assert(deletion.button,'scene delete button missing');
 assert(deletion.before.length>=4,'F1 hidden child regression setup incomplete');
 assert.strictEqual(deletion.after.length,0,'deleting an F1 parent through the scene button left hidden children behind');
 assert.strictEqual(errors.length,0,JSON.stringify(errors));
 console.log(JSON.stringify({centered,deletion}));console.log('OK: F1 center actions and deletion of hidden attached children');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
