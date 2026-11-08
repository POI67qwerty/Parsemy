/* 非表示の親を動かした時も、可視の接着部品のBVHが更新される。 */
const{open,ADD_FN}=require('./lib');
(async()=>{const{browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);
 const r=await page.evaluate(()=>{
  S.length=0;clearSelection();__add('building',1);const parent=obOf(sel);parent.visible=false;
  const child={id:'fish-attached-test',type:'asset',asset:'wallSideSign',k:1,d:-1,off:[0,0,0],ca:0,cb:0,lift:0,rot:0,wf:true,c:'#222',w:1.5,ra:.5,rb:.25,h:1,wallSideSign:true,wallSideSignBracketCount:2,wallSideSignBracketLength:.2,attachment:{parentId:parent.id,wallSideSign:true,wallSideSignSide:1,side:1,depthOffset:0,centerRatio:.5},visible:true};
  S.push({ob:child,d3:true,p:[[0,0,0],[1,1,1]],c:'#222',w:1.5});T='f';prepareFishLineOccluders();const first=syncAttachedPart(child).ca,root=fishBvhCache.root,a=fishBvhCache.records.find(r=>r.owner===child.id)?.a.slice();parent.ca+=2;prepareFishLineOccluders();const next=syncAttachedPart(child).ca,b=fishBvhCache.records.find(r=>r.owner===child.id)?.a.slice();return {first,next,dx:b?.[0]-a?.[0],rebuilt:root!==fishBvhCache.root,records:fishBvhCache.records.length};
 });console.log(JSON.stringify({r,errors}));if(errors.length||!r.rebuilt||r.records<1||Math.abs(r.next-r.first-2)>1e-8||Math.abs(r.dx-2)>1e-8)process.exitCode=1;else console.log('OK: 非表示の親の移動後、接着部品の面BVHを再生成');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
