/* 魚眼の見上げ角度で線画と独立した三角面光線検査を比較。
   同じ線の重なりや画素端を含むため、サンプル数は実際の漏れ画素数ではない。 */
/* 高い位置の物体を見上げ、可視／遮蔽を三角面への光線と線画画素で照合。 */
const {open,ADD_FN}=require('./lib');const {PROBE}=require('./hidden-lines');
(async()=>{const{browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);await page.evaluate(PROBE);
 const rows=await page.evaluate(()=>{
  __hlInstall();window.__noLineCache=true;
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function ray(p,tris){const origin=camPos(),dir=sub(p,origin),len=Math.hypot(...dir);let mx=0;for(const tri of tris){const e1=sub(tri[1],tri[0]),e2=sub(tri[2],tri[0]),h=cross(dir,e2),det=dot(e1,h);if(Math.abs(det)<1e-9)continue;const inv=1/det,a=sub(origin,tri[0]),u=dot(a,h)*inv;if(u< -1e-8||u>1+1e-8)continue;const q=cross(a,e1),v=dot(dir,q)*inv;if(v< -1e-8||u+v>1+1e-8)continue;const k=dot(e2,q)*inv;if(k>0&&k<1)mx=Math.max(mx,(1-k)*len);}return mx;}
  const out=[];for(const wallT of [.02,.12,.22])for(const kind of ['displayShelf2'])for(const yaw of [0,35])for(const pitch of [25,40,55]){
   S.length=0;clearSelection();__add(kind,1);const id=sel,o=obOf(id),dist=14,camY=.5,target=camY+dist*Math.tan(pitch*Math.PI/180),h=o.h||1;setOb(id,{ca:0,cb:0,lift:target-h/2+1,rot:17,shelf2Count:3,shelf2BoardT:.06,shelf2WallT:wallT,shelf2BoardW:1.8,h:1.3,wardrobeRows:4,wardrobeSplit:70,wardrobeBoard:.04,wardrobeRecess:.2,stairSideWidth:.18,stairSideHeight:.4});regenObjects();sel=null;tool='view';P.surfaceMode=true;cityStandardView('home');const rad=yaw*Math.PI/180;Object.assign(P,{cx:dist*Math.sin(rad),cz:-dist*Math.cos(rad),ch:camY+1,yaw,pitch,lens:35});T='f';P.fov=120;CAMKEY=null;sync();regenObjects();render();
   const tris=surfaceTriangles(obOf(id)),tf=[Z,0,0,Z,...viewShift()];let visible=0,missing=0,hidden=0,leaked=0,missDetails=[];
   for(let si=0;si<S.length;si++){const s=S[si];if(!s.ob||s.ob.id!==id||s.balconyEmbeddedSupport||s.seam!==undefined&&!seamPicks?.has(s))continue;__hlIdx.set(s,si);__hlOnly=si;render();const im=LC.getContext('2d').getImageData(0,0,W,H).data,visiblePoints=[],hiddenCandidates=[];
    for(let i=1;i<s.p.length;i++){const a=s.p[i-1],b=s.p[i];if(s.dup?.[i-1]||Math.hypot(...sub(a,b))<.05)continue;for(const t of [.25,.5,.75]){const p=a.map((v,j)=>v+(b[j]-v)*t),q=projPoint(p,tf),x=Math.round(q.x),y=Math.round(q.y);if(!q.ok||x<3||y<3||x>=W-3||y>=H-3)continue;let ink=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(im[((y+dy)*W+x+dx)*4+3]>120)ink=true;const d=ray(p,tris);if(d<=Math.max(.008,q.depth*.0002))visiblePoints.push([q.x,q.y]);if(d<.005){visible++;if(!ink){missing++;if(missDetails.length<10)missDetails.push({si,p,screen:[x,y],onFace:s.onFace,seam:s.seam,first:s.p[0],last:s.p.at(-1)});}}else if(d>.25){hidden++;if(im[(y*W+x)*4+3]>120)hiddenCandidates.push([x,y]);}}}
    for(const [x,y] of hiddenCandidates)if(!visiblePoints.some(v=>Math.hypot(v[0]-x,v[1]-y)<3))leaked++;
   }__hlOnly=null;out.push({wallT,kind,yaw,pitch,visible,missing,hidden,leaked,missDetails});
  }return out;
 });
 const bad=rows.filter(r=>r.visible<50||!r.hidden||r.missing>Math.max(2,r.visible*.01)||r.leaked>Math.max(6,r.hidden*.05));console.log(JSON.stringify({rows,cases:rows.length,totals:rows.reduce((a,r)=>({visible:a.visible+r.visible,missing:a.missing+r.missing,hidden:a.hidden+r.hidden,leaked:a.leaked+r.leaked}),{visible:0,missing:0,hidden:0,leaked:0}),bad,errors}));
 if(rows.length!==18||rows.some(r=>r.missing||r.leaked)||errors.length){console.log('要調査: 魚眼の遮蔽候補（交差・画素端の誤検出を含む）');process.exitCode=1;}else console.log('OK: 可視サンプル欠落0・条件付き遮蔽候補0');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
