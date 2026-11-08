// UFOキャッチャー・ガチャ（2段積み×2列）の各視点および書き出し（lineLayer）での可視線・遮蔽線検証
const {open,ADD_FN}=require('./lib');
const {PROBE}=require('./hidden-lines');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:800});
 await page.evaluate(ADD_FN);
 await page.evaluate(PROBE);
 const res=await page.evaluate(()=>{
  __hlInstall();window.__noLineCache=true;
  function prepTris(tris){
   return tris.map(t=>({
    a0:t[0][0],a1:t[0][1],a2:t[0][2],
    e10:t[1][0]-t[0][0],e11:t[1][1]-t[0][1],e12:t[1][2]-t[0][2],
    e20:t[2][0]-t[0][0],e21:t[2][1]-t[0][1],e22:t[2][2]-t[0][2]
   }));
  }
  function ray(p,ptris){
   const b=orthView?orthBasis().depth:null,c=b?null:camPos(),
    ox=b?p[0]-100*b[0]:c[0],oy=b?p[1]-100*b[1]:c[1],oz=b?p[2]-100*b[2]:c[2],
    dx=p[0]-ox,dy=p[1]-oy,dz=p[2]-oz,len=Math.hypot(dx,dy,dz);
   let mx=0;
   for(let i=0;i<ptris.length;i++){
    const t=ptris[i],
     h0=dy*t.e22-dz*t.e21,h1=dz*t.e20-dx*t.e22,h2=dx*t.e21-dy*t.e20,
     det=t.e10*h0+t.e11*h1+t.e12*h2;
    if(det>-1e-9&&det<1e-9)continue;
    const inv=1/det,ax=ox-t.a0,ay=oy-t.a1,az=oz-t.a2,u=(ax*h0+ay*h1+az*h2)*inv;
    if(u<-1e-8||u>1+1e-8)continue;
    const q0=ay*t.e12-az*t.e11,q1=az*t.e10-ax*t.e12,q2=ax*t.e11-ay*t.e10,v=(dx*q0+dy*q1+dz*q2)*inv;
    if(v<-1e-8||u+v>1+1e-8)continue;
    const k=(t.e20*q0+t.e21*q1+t.e22*q2)*inv;
    if(k>0&&k<1){const d=(1-k)*len;if(d>mx)mx=d;}
   }
   return mx;
  }
  const screenRows=[],exportRows=[];
  for(const [kind,patch] of [['ufoCatcher',{ufoConsoleWidth:.26,ufoChuteX:-.03,ufoChuteZ:.06,ufoClawX:.12,ufoClawDrop:.38}],['gachaMachine',{gachaChuteX:.02,gachaChuteZ:.02,gachaStack:2,gachaCount:2}]])for(const view of ['r','front','back','side','top']){
   S.length=0;clearSelection();__add(kind,1);const id=sel;
   setOb(id,{ca:0,cb:0,lift:0,rot:15,...patch});
   clearSelection();tool='view';P.surfaceMode=true;cityStandardView('home');
   Object.assign(P,{cx:5*Math.sin(-32*Math.PI/180),cz:-5*Math.cos(-32*Math.PI/180),ch:1.8,yaw:-32,pitch:-18,lens:35,fov:120,roll:0});
   T='r';CAMKEY=null;sync();if(view!=='r')cityStandardView(view);regenObjects();__hlOnly=null;render();
   const tris=prepTris(surfaceTriangles(obOf(id))),tf=[Z,0,0,Z,...viewShift()],lines=S.filter(s=>s.ob?.id===id&&(s.seam==null||(seamPicks&&seamPicks.has(s))));
   let visible=0,missing=0,hidden=0,leaks=0,globalNear=[];
   for(const s of lines)for(let i=1;i<s.p.length;i++)for(const t of [.2,.5,.8]){
    const a=s.p[i-1],b=s.p[i],p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],q=projPoint(p,tf);
    if(q.ok&&ray(p,tris)<.001)globalNear.push([q.x,q.y]);
   }
   const full=LC.getContext('2d').getImageData(0,0,W,H).data;
   for(const s of lines){
    const pot=[],st=Math.max(1,Math.floor((s.p.length-1)/16));
    for(let i=1;i<s.p.length;i+=st){
     const a=s.p[i-1],b=s.p[i],p=[(a[0]+b[0])*.5,(a[1]+b[1])*.5,(a[2]+b[2])*.5],q=projPoint(p,tf),x=Math.round(q.x),y=Math.round(q.y);
     if(!q.ok||x<3||y<3||x>=W-3||y>=H-3)continue;
     const d=ray(p,tris);let ink=false;
     for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(full[((y+dy)*W+x+dx)*4+3]>120)ink=true;
     if(d<.001){visible++;if(!ink)missing++;}
     else if(d>.04){hidden++;if(full[(y*W+x)*4+3]>120&&!globalNear.some(g=>Math.hypot(g[0]-x,g[1]-y)<3))pot.push([x,y]);}
    }
    if(pot.length){
     const si=S.indexOf(s);__hlIdx.set(s,si);__hlOnly=si;render();
     const im=LC.getContext('2d').getImageData(0,0,W,H).data;
     leaks+=pot.filter(([x,y])=>im[(y*W+x)*4+3]>120).length;
    }
   }
   __hlOnly=null;
   screenRows.push({kind,view,visible,missing,hidden,leaks});
  }
  for(const [kind,patch] of [['ufoCatcher',{}],['gachaMachine',{gachaStack:2}]]){
   S.length=0;clearSelection();__add(kind,1);const id=sel;
   setOb(id,{ca:0,cb:0,lift:0,rot:14,...patch});
   __add('box',1);setOb(sel,{ca:-.18,cb:-.55,lift:0,ra:.18,rb:.15,h:.75});
   clearSelection();tool='view';P.surfaceMode=true;cityStandardView('home');
   Object.assign(P,{cx:5*Math.sin(-30*Math.PI/180),cz:-5*Math.cos(-30*Math.PI/180),ch:1.7,yaw:-30,pitch:-16,lens:35,fov:120,roll:0});
   T='r';CAMKEY=null;sync();regenObjects();render();
   const tris=prepTris([...new Map(S.filter(s=>s.ob).map(s=>[s.ob.id,s.ob])).values()].flatMap(o=>surfaceTriangles(o))),
    cw=900,ch=700,tf=[.5,0,0,.5,0,0];
   let visible=0,missing=0,hidden=0,leaks=0,globalNear=[];
   __hlOnly=null;
   const full=new Uint8ClampedArray(lineLayer(false,false,cw,ch,tf,true).getContext('2d').getImageData(0,0,cw,ch).data),
    lines=S.filter(s=>s.ob?.id===id&&(s.seam==null||(seamPicks&&seamPicks.has(s))));
   for(const s of S.filter(s=>s.ob&&(s.seam==null||(seamPicks&&seamPicks.has(s)))))for(let i=1;i<s.p.length;i++)for(const t of [.2,.5,.8]){
    const a=s.p[i-1],b=s.p[i],p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],q=projPoint(p,tf);
    if(q.ok&&ray(p,tris)<.001)globalNear.push([q.x,q.y]);
   }
   for(const s of lines){
    const pot=[],st=Math.max(1,Math.floor((s.p.length-1)/16));
    for(let i=1;i<s.p.length;i+=st){
     const a=s.p[i-1],b=s.p[i],p=[(a[0]+b[0])*.5,(a[1]+b[1])*.5,(a[2]+b[2])*.5],q=projPoint(p,tf),x=Math.round(q.x),y=Math.round(q.y);
     if(!q.ok||x<3||y<3||x>=cw-3||y>=ch-3)continue;
     const d=ray(p,tris);let ink=false;
     for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(full[((y+dy)*cw+x+dx)*4+3]>120)ink=true;
     if(d<.001){visible++;if(!ink)missing++;}
     else if(d>.04){hidden++;if(full[(y*cw+x)*4+3]>120&&!globalNear.some(g=>Math.hypot(g[0]-x,g[1]-y)<3))pot.push([x,y]);}
    }
    if(pot.length){
     const si=S.indexOf(s);__hlIdx.set(s,si);__hlOnly=si;
     const im=lineLayer(false,false,cw,ch,tf,true).getContext('2d').getImageData(0,0,cw,ch).data;
     leaks+=pot.filter(([x,y])=>im[(y*cw+x)*4+3]>120).length;
    }
   }
   __hlOnly=null;
   exportRows.push({kind,visible,missing,hidden,leaks});
  }
  return {screenRows,exportRows};
 });
 const badS=res.screenRows.filter(r=>r.missing||r.leaks||!r.visible),
  badE=res.exportRows.filter(r=>r.missing||r.leaks||!r.visible);
 console.log(JSON.stringify({screenCases:res.screenRows.length,exportCases:res.exportRows.length,badS,badE,errors}));
 if(badS.length||badE.length||errors.length)process.exitCode=1;
 else console.log('OK: UFOキャッチャー・ガチャ（2段×2列）の可視線・遮蔽線・書き出し');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
