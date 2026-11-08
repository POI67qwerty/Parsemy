// パスパイプの不要線除去（内部リング・非シルエット母線なし）と各視点・書き出しの可視線／遮蔽線検証
const {open,ADD_FN}=require('./lib');
const {PROBE}=require('./hidden-lines');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:800});
 await page.evaluate(ADD_FN);
 await page.evaluate(PROBE);
 const res=await page.evaluate(()=>{
  __hlInstall();window.__noLineCache=true;
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function ray(p,tris){
   let orig=orthView?p.map((v,i)=>v-100*orthBasis().depth[i]):camPos(),dir=sub(p,orig),len=Math.hypot(...dir),mx=0;
   for(const tri of tris){
    let e1=sub(tri[1],tri[0]),e2=sub(tri[2],tri[0]),h=cross(dir,e2),det=dot(e1,h);
    if(Math.abs(det)<1e-9)continue;
    let inv=1/det,a=sub(orig,tri[0]),u=dot(a,h)*inv;if(u<-1e-8||u>1+1e-8)continue;
    let q=cross(a,e1),v=dot(dir,q)*inv;if(v<-1e-8||u+v>1+1e-8)continue;
    let k=dot(e2,q)*inv;if(k>0&&k<1)mx=Math.max(mx,(1-k)*len);
   }
   return mx;
  }
  const presets={
   l:[[-2.4,0,1.1],[0,0,1.1],[0,2.2,1.1]],
   u:[[-2.2,2,1.1],[-2.2,0,1.1],[2.2,0,1.1],[2.2,2,1.1]],
   z:[[-2.2,-1.4,1.1],[0,-1.4,1.1],[0,1.4,1.1],[2.2,1.4,1.1]],
   step3d:[[-2.2,-1.2,.4],[-.4,-1.2,.4],[-.4,.8,1.8],[1.8,.8,1.8]]
  };
  const screenRows=[],exportRows=[];
  for(const [pname,path] of Object.entries(presets))for(const cr of [.55,0])for(const view of ['r','front','side','top']){
   if(cr===0&&pname!=='l')continue;
   S.length=0;clearSelection();__add('pathPipe',1);const id=sel;
   setOb(id,{ca:0,cb:0,lift:0,path,cornerRadius:cr});
   clearSelection();tool='view';P.surfaceMode=true;cityStandardView('home');
   Object.assign(P,{cx:6*Math.sin(-32*Math.PI/180),cz:-6*Math.cos(-32*Math.PI/180),ch:2.4,yaw:-32,pitch:-18,lens:35,fov:120,roll:0});
   T='r';CAMKEY=null;sync();if(view!=='r')cityStandardView(view);regenObjects();render();
   const tris=surfaceTriangles(obOf(id)),tf=[Z,0,0,Z,...viewShift()],lines=S.filter(s=>s.ob?.id===id);
   let visible=0,missing=0,hidden=0,leaks=0,globalNear=[];
   for(const s of lines)for(let i=1;i<s.p.length;i++)for(const t of [.2,.5,.8]){
    const a=s.p[i-1],b=s.p[i],p=a.map((v,j)=>v+(b[j]-v)*t),q=projPoint(p,tf);
    if(q.ok&&ray(p,tris)<.001)globalNear.push([q.x,q.y]);
   }
   __hlOnly=null;render();
   const full=LC.getContext('2d').getImageData(0,0,W,H).data;
   for(const s of lines){
    const si=S.indexOf(s);__hlIdx.set(s,si);__hlOnly=si;render();
    const im=LC.getContext('2d').getImageData(0,0,W,H).data,cand=[];
    for(let i=1;i<s.p.length;i++){
     const a=s.p[i-1],b=s.p[i],p=a.map((v,j)=>v+(b[j]-v)*.5),q=projPoint(p,tf),x=Math.round(q.x),y=Math.round(q.y);
     if(!q.ok||x<3||y<3||x>=W-3||y>=H-3)continue;
     const d=ray(p,tris);let ink=false;
     for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(full[((y+dy)*W+x+dx)*4+3]>120)ink=true;
     if(d<.001){visible++;if(!ink)missing++;}
     else if(d>.02){hidden++;if(im[(y*W+x)*4+3]>120)cand.push([x,y]);}
    }
    leaks+=cand.filter(([x,y])=>!globalNear.some(p=>Math.hypot(p[0]-x,p[1]-y)<3)).length;
   }
   __hlOnly=null;
   screenRows.push({pname,cr,view,lines:lines.length,visible,missing,hidden,leaks});
  }
  for(const type of ['r','front']){
   S.length=0;clearSelection();__add('pathPipe',1);const id=sel;
   setOb(id,{ca:0,cb:0,lift:0,path:presets.u,cornerRadius:.55});
   __add('box',1);setOb(sel,{ca:-.6,cb:-.7,lift:0,ra:.35,rb:.25,h:1.5});
   clearSelection();tool='view';P.surfaceMode=true;cityStandardView('home');
   Object.assign(P,{cx:6*Math.sin(-30*Math.PI/180),cz:-6*Math.cos(-30*Math.PI/180),ch:2.3,yaw:-30,pitch:-16,lens:35,fov:120,roll:0});
   T='r';CAMKEY=null;sync();if(type!=='r')cityStandardView(type);regenObjects();render();
   const tris=[...new Map(S.filter(s=>s.ob).map(s=>[s.ob.id,s.ob])).values()].flatMap(o=>surfaceTriangles(o)),
    cw=900,ch=700,tf=[.5,0,0,.5,0,0],lines=S.filter(s=>s.ob?.id===id);
   let visible=0,missing=0,hidden=0,leaks=0,globalNear=[];
   __hlOnly=null;lineLayer(false,false,cw,ch,tf,true);
   for(const s of S.filter(s=>s.ob))for(let i=1;i<s.p.length;i++)for(const t of [.2,.5,.8]){
    const a=s.p[i-1],b=s.p[i],p=a.map((v,j)=>v+(b[j]-v)*t),q=projPoint(p,tf);
    if(q.ok&&ray(p,tris)<.001)globalNear.push([q.x,q.y]);
   }
   const full=new Uint8ClampedArray(lineLayer(false,false,cw,ch,tf,true).getContext('2d').getImageData(0,0,cw,ch).data);
   for(const s of lines){
    const si=S.indexOf(s);__hlIdx.set(s,si);__hlOnly=si;
    const im=lineLayer(false,false,cw,ch,tf,true).getContext('2d').getImageData(0,0,cw,ch).data,cand=[];
    for(let i=1;i<s.p.length;i++){
     const a=s.p[i-1],b=s.p[i],p=a.map((v,j)=>v+(b[j]-v)*.5),q=projPoint(p,tf),x=Math.round(q.x),y=Math.round(q.y);
     if(!q.ok||x<3||y<3||x>=cw-3||y>=ch-3)continue;
     const d=ray(p,tris);let ink=false;
     for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(full[((y+dy)*cw+x+dx)*4+3]>120)ink=true;
     if(d<.001){visible++;if(!ink)missing++;}
     else if(d>.02){hidden++;if(im[(y*cw+x)*4+3]>120)cand.push([x,y]);}
    }
    leaks+=cand.filter(([x,y])=>!globalNear.some(p=>Math.hypot(p[0]-x,p[1]-y)<3)).length;
   }
   __hlOnly=null;
   exportRows.push({type,visible,missing,hidden,leaks});
  }
  return {screenRows,exportRows};
 });
 const badScreen=res.screenRows.filter(r=>r.missing||r.leaks||!r.visible||(r.cr>0&&(r.view==='r'||r.view==='top')&&r.lines>4)),
  badExport=res.exportRows.filter(r=>r.missing||r.leaks||!r.visible);
 console.log(JSON.stringify({screenCases:res.screenRows.length,exportCases:res.exportRows.length,badScreen,badExport,errors}));
 if(badScreen.length||badExport.length||errors.length)process.exitCode=1;
 else console.log('OK: パスパイプの不要線除去と各視点・書き出しの可視線・遮蔽線');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
