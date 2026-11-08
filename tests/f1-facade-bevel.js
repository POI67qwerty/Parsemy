const assert=require('assert');
const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open();await page.evaluate(ADD_FN);
 const result=await page.evaluate(()=>{
  S.length=0;clearSelection();__add('building',1);const id=sel;
  setOb(id,{facadeEnabled:true,bevelOffset:0});regenObjects();
  const flat=S.filter(s=>s.ob?.id===id&&s.f1Feature==='facade').length;
  setOb(id,{bevelOffset:.12});regenObjects();
  const fascia=S.filter(s=>s.ob?.id===id&&s.f1Feature==='facade');
  return {flat,beveled:fascia.length,seams:fascia.filter(s=>s.seam).length,bevel:obOf(id).bevelOffset};
 });
 assert(result.flat>0,'facade line geometry missing');
 assert(result.seams>0&&result.beveled>result.flat,'building bevel was not applied to facade');
 assert.strictEqual(errors.length,0,JSON.stringify(errors));
 console.log(JSON.stringify(result));console.log('OK: building bevel is also applied to the facade fascia');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
