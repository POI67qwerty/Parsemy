/* 自販機本体の縁線を個別に描き、実面と光線で可視・遮蔽を検査。 */
const {open,ADD_FN}=require('./lib');const{PROBE}=require('./hidden-lines');
(async()=>{const{browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);await page.evaluate(PROBE);
 const rows=await page.evaluate(()=>{
  __hlInstall();window.__noLineCache=true;
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function ray(p,tris){const origin=camPos(),dir=sub(p,origin),len=Math.hypot(...dir);let mx=0;for(const tri of tris){const e1=sub(tri[1],tri[0]),e2=sub(tri[2],tri[0]),h=cross(dir,e2),det=dot(e1,h);if(Math.abs(det)<1e-9)continue;const inv=1/det,a=sub(origin,tri[0]),u=dot(a,h)*inv;if(u< -1e-8||u>1+1e-8)continue;const q=cross(a,e1),v=dot(dir,q)*inv;if(v< -1e-8||u+v>1+1e-8)continue;const k=dot(e2,q)*inv;if(k>0&&k<1)mx=Math.max(mx,(1-k)*len);}return mx;}
  const out=[];for(const type of ['r','f'])for(const yaw of [-40,0,35])for(const pitch of [15,30]){
   S.length=0;clearSelection();__add('vendingMachine',1);const id=sel,o=obOf(id),dist=6,camY=.5,target=camY+dist*Math.tan(pitch*Math.PI/180);setOb(id,{ca:0,cb:0,lift:target-o.h/2+1,rot:0,vmDepthBevel:0});regenObjects();sel=null;tool='view';P.surfaceMode=true;cityStandardView('home');const rad=yaw*Math.PI/180;Object.assign(P,{cx:dist*Math.sin(rad),cz:-dist*Math.cos(rad),ch:camY+1,yaw,pitch,lens:35,fov:120,roll:0});T=type;CAMKEY=null;sync();regenObjects();render();
   const tris=surfaceTriangles(obOf(id)),tf=[Z,0,0,Z,...viewShift()];let visible=0,missing=0,hidden=0,leaked=0;
   for(let si=0;si<6;si++){const s=S[si];if(!s||s.ob?.id!==id)throw Error('body line missing');__hlIdx.set(s,si);__hlOnly=si;render();const im=LC.getContext('2d').getImageData(0,0,W,H).data,nearVisible=[],hiddenCandidates=[];
    for(let i=1;i<s.p.length;i++){const a=s.p[i-1],b=s.p[i];for(const t of [.25,.5,.75]){const p=a.map((v,j)=>v+(b[j]-v)*t),q=projPoint(p,tf),x=Math.round(q.x),y=Math.round(q.y);if(!q.ok||x<3||y<3||x>=W-3||y>=H-3)continue;let ink=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(im[((y+dy)*W+x+dx)*4+3]>120)ink=true;const d=ray(p,tris);if(d<.01)nearVisible.push([q.x,q.y]);if(d<.005){visible++;if(!ink)missing++;}else if(d>.25){hidden++;if(im[(y*W+x)*4+3]>120)hiddenCandidates.push([x,y]);}}}
    for(const [x,y] of hiddenCandidates)if(!nearVisible.some(p=>Math.hypot(p[0]-x,p[1]-y)<3))leaked++;
   }__hlOnly=null;out.push({type,yaw,pitch,visible,missing,hidden,leaked});
  }return out;
 });const totals=rows.reduce((a,r)=>({visible:a.visible+r.visible,missing:a.missing+r.missing,hidden:a.hidden+r.hidden,leaked:a.leaked+r.leaked}),{visible:0,missing:0,hidden:0,leaked:0});const bad=rows.filter(x=>!x.visible||!x.hidden||x.missing||x.leaked);console.log(JSON.stringify({rows,totals,bad,errors}));if(bad.length||errors.length||rows.length!==12)process.exitCode=1;else console.log('OK: 直角の自販機の縁を通常透視・魚眼で個別に検査');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
