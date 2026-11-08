// 金網フェンスの書き出し（lineLayer）における可視線・遮蔽線と、網目越しの透過確認
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
  const out=[];
  for(const bottomBar of [false,true])for(const type of ['r','front']){
   S.length=0;clearSelection();__add('chainFence',1);const id=sel;
   setOb(id,{ca:-.9,cb:0,lift:0,rot:12,ra:.9,h:1.4,fenceCount:2,fenceBottomBar:bottomBar,fenceBottomHeight:.24,fenceMeshPitch:.2});
   // 手前に遮蔽用の直方体、奥に網目越しに見える直方体を配置
   __add('box',1);const frontBoxId=sel;setOb(frontBoxId,{ca:-.25,cb:-.55,lift:0,ra:.22,rb:.18,h:.9});
   __add('box',1);const backBoxId=sel;setOb(backBoxId,{ca:.28,cb:.65,lift:0,ra:.22,rb:.18,h:.95});
   clearSelection();tool='view';P.surfaceMode=true;cityStandardView('home');
   Object.assign(P,{cx:5*Math.sin(-32*Math.PI/180),cz:-5*Math.cos(-32*Math.PI/180),ch:1.7,yaw:-32,pitch:-15,lens:35,fov:120,roll:0});
   T='r';CAMKEY=null;sync();if(type!=='r')cityStandardView(type);render();
   const tris=[...new Map(S.filter(s=>s.ob).map(s=>[s.ob.id,s.ob])).values()].flatMap(o=>surfaceTriangles(o)),
    cw=900,ch=700,tf=[.5,0,0,.5,0,0];
   let visible=0,missing=0,hidden=0,leaks=0,details=[],globalNear=[];
   __hlOnly=null;lineLayer(false,false,cw,ch,tf,true);
   for(const s of S.filter(s=>s.ob&&(s.seam==null||(seamPicks&&seamPicks.has(s)))))
    for(let i=1;i<s.p.length;i++)for(const t of [.2,.5,.8]){
     const a=s.p[i-1],b=s.p[i],p=a.map((v,j)=>v+(b[j]-v)*t),q=projPoint(p,tf);
     if(q.ok&&ray(p,tris)<.001)globalNear.push([q.x,q.y]);
    }
   __hlOnly=null;
   const full=new Uint8ClampedArray(lineLayer(false,false,cw,ch,tf,true).getContext('2d').getImageData(0,0,cw,ch).data);
   const lines=S.filter(s=>s.ob?.id===id&&(s.seam==null||(seamPicks&&seamPicks.has(s))));
   for(const s of lines){
    const si=S.indexOf(s);__hlIdx.set(s,si);__hlOnly=si;
    const im=lineLayer(false,false,cw,ch,tf,true).getContext('2d').getImageData(0,0,cw,ch).data,cand=[];
    let sv=0,sm=0,sh=0;
    for(let i=1;i<s.p.length;i++){
     const a=s.p[i-1],b=s.p[i];
     for(const t of [.2,.5,.8]){
      const p=a.map((v,j)=>v+(b[j]-v)*t),q=projPoint(p,tf),x=Math.round(q.x),y=Math.round(q.y);
      if(!q.ok||x<3||y<3||x>=cw-3||y>=ch-3)continue;
      const d=ray(p,tris);let ink=false;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(full[((y+dy)*cw+x+dx)*4+3]>120)ink=true;
      if(t!==.5)continue;
      if(d<.001){visible++;sv++;if(!ink){missing++;sm++;}}
      else if(d>.04){hidden++;sh++;if(im[(y*cw+x)*4+3]>120)cand.push([x,y]);}
     }
    }
    const leak=cand.filter(([x,y])=>!globalNear.some(p=>Math.hypot(p[0]-x,p[1]-y)<3)).length;
    leaks+=leak;if(sm||leak)details.push({si,sv,sm,sh,leak});
   }
   __hlOnly=null;
   // 奥の直方体がフェンスの網目部分で面遮蔽されずに見えていることを確認
   const fenceTris=surfaceTriangles(obOf(id));
   const seeThrough=ray([.28,-.65,.5],fenceTris)===0;
   out.push({bottomBar,type,visible,missing,hidden,leaks,seeThrough,details});
  }
  return out;
 });
 const bad=res.filter(r=>r.missing||r.leaks||!r.visible||!r.hidden||!r.seeThrough);
 console.log(JSON.stringify({cases:res.length,totals:Object.fromEntries(['visible','missing','hidden','leaks'].map(k=>[k,res.reduce((n,r)=>n+r[k],0)])),bad,errors}));
 if(bad.length||errors.length)process.exitCode=1;else console.log('OK: 金網フェンスの出力線と網目越しの透過');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
