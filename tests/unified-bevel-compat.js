const assert=require('assert');const{open,ADD_FN}=require('./lib');
(async()=>{const{browser,page,errors}=await open();await page.evaluate(ADD_FN);
 const result=await page.evaluate(()=>{
  const snap=id=>{const o=obOf(id);return {lines:genShape(o).map(s=>s.p),faces:surfaceTriangles(o),bounds:obBounds(o)};};
  const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b), diff=(a,b)=>({lineCounts:[a.lines.length,b.lines.length],faceCounts:[a.faces.length,b.faces.length],lines:eq(a.lines,b.lines),faces:eq(a.faces,b.faces),bounds:eq(a.bounds,b.bounds)});
  S.length=0;clearSelection();__add('box',1);const boxId=sel,box=obOf(boxId);setOb(boxId,{ca:0,cb:0,lift:0,rot:0,h:1.8,bevelOffset:.24});const unifiedBox=snap(boxId);
  clearSelection();__add('beveledBox',1);const oldBoxId=sel;setOb(oldBoxId,{ca:0,cb:0,lift:0,rot:0,ra:box.ra,rb:box.rb,h:1.8,bevelOffset:.24,bevelSegments:4});const legacyBox=snap(oldBoxId);
  clearSelection();__add('stackedBuilding',1);const stackId=sel,stack=obOf(stackId);setOb(stackId,{ca:0,cb:0,lift:0,rot:0,bevelOffset:.28,floors:stack.floors.map(f=>({...f,bevelOffset:.28}))});const unifiedStack=snap(stackId);
  clearSelection();__add('beveledStackedBuilding',1);const oldStackId=sel;setOb(oldStackId,{ca:0,cb:0,lift:0,rot:0,bevelOffset:.28});const legacyStack=snap(oldStackId);
  return {boxSame:eq(unifiedBox.lines,legacyBox.lines)&&eq(unifiedBox.faces,legacyBox.faces)&&eq(unifiedBox.bounds,legacyBox.bounds),stackSame:eq(unifiedStack.lines,legacyStack.lines)&&eq(unifiedStack.faces,legacyStack.faces)&&eq(unifiedStack.bounds,legacyStack.bounds),boxDiff:diff(unifiedBox,legacyBox),stackDiff:diff(unifiedStack,legacyStack),boxLines:genShape(obOf(boxId)).length,stackLines:genShape(obOf(stackId)).length};
 });
 assert(result.boxSame,'unified bevel box differs from legacy bevel box');assert(result.stackSame,'unified bevel stacked building differs from legacy');assert(result.boxLines>0&&result.stackLines>0);assert.strictEqual(errors.length,0,JSON.stringify(errors));
 console.log(JSON.stringify(result));console.log('OK: unified beveled assets match legacy geometry exactly');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
