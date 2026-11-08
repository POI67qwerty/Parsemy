/* カメラ変更・形状編集時の魚眼BVHと実際の面三角形の一致。 */
const{open,ADD_FN}=require('./lib');
(async()=>{const{browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);
 const rows=await page.evaluate(()=>{
  S.length=0;clearSelection();const ids=[];for(const [kind,x] of [['cone',-3],['sphere',0],['stool',3],['building',5]]){__add(kind,1);ids.push(sel);setOb(sel,{ca:x,cb:0,lift:3});}regenObjects();sel=null;tool='view';cityStandardView('home');T='f';P.surfaceMode=true;const out=[];let oldRoot=null;
  for(const [idx,yaw,pitch,roll,fov] of [[0,0,0,0,90],[1,30,40,25,180],[2,-65,-35,57,270],[3,120,20,-30,360],[4,0,0,0,90]]){
   Object.assign(P,{yaw,pitch,roll,fov});CAMKEY=null;if(idx===4)setOb(ids[1],{ra:1.1,rb:.8,h:2,ca:1.25});sync();regenObjects();prepareFishLineOccluders();let diff=0,count=0;
   for(const id of ids){const ob=obOf(id),direct=exportSurfaceTriangles(ob),records=fishBvhCache.records.filter(r=>r.owner===id);if(direct.length!==records.length){diff++;continue;}for(let k=0;k<direct.length;k++){const t=direct[k],r=records[k],actual=[r.a,V.add(r.a,r.e1),V.add(r.a,r.e2)];for(let i=0;i<3;i++)for(let j=0;j<3;j++){count++;if(Math.abs(actual[i][j]-t[i][j])>1e-8)diff++;}}}
   out.push({idx,yaw,pitch,roll,fov,count,diff,reused:oldRoot===fishBvhCache.root});oldRoot=fishBvhCache.root;
  }return out;
 });console.log(JSON.stringify({rows,errors}));if(errors.length||rows.length!==5||rows.some(r=>r.diff||r.count<100)||!rows.slice(1,4).every(r=>r.reused)||rows[4].reused)process.exitCode=1;else console.log('OK: 円錐・球・丸椅子・建物の三角面、カメラ変更再利用と形状編集時の再構築');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
