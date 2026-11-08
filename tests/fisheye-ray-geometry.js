/* BVH による魚眼の遮蔽判定を、独立した全三角面の光線検査と比較。 */
const {open,ADD_FN}=require('./lib');
(async()=>{const{browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);
 const result=await page.evaluate(()=>{
  S.length=0;clearSelection();for(const spec of [{x:-2,z:1,lift:5,rot:25},{x:2,z:0,lift:9,rot:53},{x:0,z:4,lift:7,rot:0},{x:1,z:-3,lift:12,rot:68}]){__add('box',1);setOb(sel,{ca:spec.x,cb:spec.z,lift:spec.lift,ra:1.3,rb:.8,h:2.1,rot:spec.rot});}regenObjects();sel=null;P.surfaceMode=true;cityStandardView('home');T='f';
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function blocked(p,tris){const origin=camPos(),v=sub(p,origin),len=Math.hypot(...v),dir=v.map(n=>n/len),limit=len-Math.max(.008,len*.0002);for(const t of tris){const a=sub(t[1],t[0]),b=sub(t[2],t[0]),h=cross(dir,b),det=dot(a,h);if(Math.abs(det)<1e-10)continue;const inv=1/det,x=sub(origin,t[0]),u=dot(x,h)*inv;if(u< -1e-8||u>1+1e-8)continue;const q=cross(x,a),w=dot(dir,q)*inv;if(w< -1e-8||u+w>1+1e-8)continue;const d=dot(b,q)*inv;if(d>.0001&&d<limit)return true;}return false;}
  let seed=12431;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
  const rows=[];for(const fov of [90,150,240,360])for(const roll of [0,37])for(const moved of [false,true]){
   const ids=[...new Map(S.filter(s=>s.ob).map(s=>[s.ob.id,s.ob])).keys()];setOb(ids[0],{ca:moved?-1.2:-2,rot:moved?73:25});Object.assign(P,{cx:4.2,cz:-12,ch:1.5,yaw:20,pitch:35,roll,fov});CAMKEY=null;regenObjects();prepareFishLineOccluders();fishBlockedPixels=null;
   const objects=[...new Map(S.filter(s=>s.ob).map(s=>[s.ob.id,s.ob])).values()],tris=objects.flatMap(surfaceTriangles),tf=[1,0,0,1,0,0];let samples=0,blockedN=0,diff=0;
   for(let i=0;i<1500;i++){let p=[-5+rand()*10,2+rand()*15,-3+rand()*12],q=projPoint(p,tf);if(!q.ok)continue;const expected=blocked(p,tris),actual=fishPointOccluded(q);samples++;if(expected)blockedN++;if(expected!==actual)diff++;}
   // 面上の点と面から1cm／5cm奥の点も試す。
   for(const tr of tris.filter((_,i)=>i%7===0)){const a=tr[0],b=tr[1],c=tr[2],p=a.map((x,i)=>(x+b[i]+c[i])/3),camera=camPos(),dir=sub(p,camera),len=Math.hypot(...dir);for(const step of [-.05,0,.01,.05]){const v=p.map((x,i)=>x+dir[i]/len*step),q=projPoint(v,tf);if(!q.ok)continue;const expected=blocked(v,tris),actual=fishPointOccluded(q);samples++;if(expected)blockedN++;if(expected!==actual)diff++;}}
   rows.push({fov,roll,moved,samples,blocked:blockedN,diff});
  }return rows;
 });console.log(JSON.stringify({result,errors}));if(errors.length||result.some(x=>x.samples<200||x.blocked<20||x.diff))process.exitCode=1;else console.log('OK: 魚眼4画角×傾き2種×物体移動、BVH判定は全三角面の光線検査と一致');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
