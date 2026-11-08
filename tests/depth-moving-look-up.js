/* 移動した物体の残留深度で、見上げ時の別物体の線が消えないこと。 */
const {open,ADD_FN}=require('./lib');
(async()=>{const{browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);
 const rows=await page.evaluate(()=>{
  window.__noLineCache=true;window.__noEarlyZ=true;
  function resetDepth(){if(depthBuffer){depthBuffer.fill(Infinity);depthOwner.fill(0);depthFace.fill(0);}depthUsedY0=Infinity;depthUsedY1=-Infinity;depthLast=null;depthKey=null;depthStatic=null;depthMovingRect=null;}
  function fresh(){const objs=[...new Map(S.filter(s=>s.ob&&objectVisible(s.ob)).map(s=>[s.ob.id,s.ob])).values()],owners=new Map(objs.map((o,i)=>[o.id,i+1])),n=W*H,d=new Float32Array(n),ow=new Int32Array(n),face=new Int32Array(n),used={x0:Infinity,x1:-Infinity,y0:Infinity,y1:-Infinity},tf=[Z,0,0,Z,...viewShift()];d.fill(Infinity);rasterizeDepthInto(d,ow,owners,objs,W,H,tf,used,face);let depthDiff=0,ownerDiff=0,faceDiff=0;for(let i=0;i<n;i++){if(d[i]!==depthBuffer[i]&&!(Number.isFinite(d[i])&&Number.isFinite(depthBuffer[i])&&Math.abs(d[i]-depthBuffer[i])<1e-4))depthDiff++;if(ow[i]!==depthOwner[i])ownerDiff++;if(face[i]!==depthFace[i])faceDiff++;}return {depthDiff,ownerDiff,faceDiff};}
  const results=[];for(const earlyZ of [true,false])for(const spec of [{name:'look-up-disjoint',pitch:25,tilt:40,static:true},{name:'look-down-disjoint',pitch:-10,tilt:8,static:true},{name:'no-static',pitch:25,tilt:40,static:false},{name:'opposite-sweep',pitch:40,tilt:25,static:true}]){
   window.__noEarlyZ=!earlyZ;S.length=0;clearSelection();if(spec.static){__add('box',1);setOb(sel,{ca:-2,cb:0,lift:4,ra:1,rb:1,h:2});__add('box',1);setOb(sel,{ca:2,cb:1,lift:18,ra:1,rb:1,h:2});}
   __add('box',1);const id=sel;setOb(id,{ca:2,cb:0,lift:11,ra:1,rb:1,h:2});regenObjects();sel=null;tool='view';P.surfaceMode=true;cityStandardView('home');Object.assign(P,{cx:0,cz:-14,ch:1.5,yaw:0,pitch:spec.pitch,lens:30});sync();resetDepth();window.__noDirtyDepth=false;render();let steps=[];
   for(const [lift,rot] of [[8,0],[6,25],[12,45],[8,0]]){setOb(id,{lift,rot});render();steps.push({path:window.__depthPath,...fresh()});}
   P.pitch=spec.tilt;sync();regenObjects();render();const afterTilt=fresh(),normalPixels=new Uint8ClampedArray(LC.getContext('2d').getImageData(0,0,W,H).data);
   window.__noDirtyDepth=true;resetDepth();render();const ref=LC.getContext('2d').getImageData(0,0,W,H).data;let pixelDiff=0;for(let i=0;i<ref.length;i+=4)if(ref[i]!==normalPixels[i]||ref[i+1]!==normalPixels[i+1]||ref[i+2]!==normalPixels[i+2]||ref[i+3]!==normalPixels[i+3])pixelDiff++;
   results.push({name:spec.name,earlyZ,steps,afterTilt,pixelDiff});
  }window.__noDirtyDepth=false;window.__noEarlyZ=false;return results;
 });
 console.log(JSON.stringify({rows,errors}));if(errors.length||rows.some(r=>r.pixelDiff||Object.values(r.afterTilt).some(n=>n)||r.steps.some(s=>s.path!=='dirty'||s.depthDiff||s.ownerDiff||s.faceDiff)))process.exitCode=1;else console.log('OK: 移動後の深度・所有者・面ID、見上げ／見下ろし後の全線画素が全再計算と一致');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
