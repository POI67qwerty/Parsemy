/* ベランダの底面とスラブ内部線を、投影画素と実三角面への光線で検査。 */
const {open,ADD_FN}=require('./lib');const {PROBE}=require('./hidden-lines');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:800}); await page.evaluate(ADD_FN);await page.evaluate(PROBE);
 const result=await page.evaluate(()=>{
  window.__hlInstall();window.__noLineCache=true;S.length=0;clearSelection();window.__add('balcony',1);const id=sel;
  sel=null;tool='view';P.surfaceMode=true;cityStandardView('home');
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function ray(p,tris){const origin=camPos(),dir=sub(p,origin),len=Math.hypot(...dir);let mx=0;for(const tri of tris){const e1=sub(tri[1],tri[0]),e2=sub(tri[2],tri[0]),h=cross(dir,e2),det=dot(e1,h);if(Math.abs(det)<1e-9)continue;const inv=1/det,a=sub(origin,tri[0]),u=dot(a,h)*inv;if(u< -1e-7||u>1+1e-7)continue;const q=cross(a,e1),v=dot(dir,q)*inv;if(v< -1e-7||u+v>1+1e-7)continue;const k=dot(e2,q)*inv;if(k>0&&k<1)mx=Math.max(mx,(1-k)*len);}return mx;}
  let cases=0,visible=0,paintedVisible=0,hidden=0,paintedHidden=0,embedded=0,embeddedInk=0,oldLeaks=0,wrongFlags=0;
  for(const rot of [0,90])for(const front of [false,true])for(const side of [false,true])for(const thick of [.035,.32]){
   setOb(id,{ca:0,cb:0,lift:3,rot,balconyFrontRail:front,balconySideRail:side,balconyThickness:thick});regenObjects();const o=obOf(id),g=balconyGeometry(o),tris=surfaceTriangles(o),xy=[[-g.w/2,-g.d/2],[g.w/2,-g.d/2],[g.w/2,g.d/2],[-g.w/2,g.d/2]];
   for(const yaw of [0,90,180,270])for(const level of ['below','above']){
    const rr=8,camY=level==='below'?.7:6,rad=yaw*Math.PI/180;Object.assign(P,{yaw,pitch:Math.atan2(2.6-camY,rr)*180/Math.PI,cx:rr*Math.sin(rad),cz:-rr*Math.cos(rad),ch:camY+1});sync();regenObjects();
    const tf=[Z,0,0,Z,...viewShift()],bottom=S.findIndex(s=>s.ob?.id===id && !s.balconyEmbeddedSupport),supports=S.map((s,i)=>s.ob?.id===id&&s.balconyEmbeddedSupport?i:-1).filter(i=>i>=0);if(supports.length!==2){wrongFlags++;continue;}
    const draw=(si,legacy=false)=>{window.__showBalconyEmbedded=legacy;window.__hlIdx.set(S[si],si);window.__hlOnly=si;render();return LC.getContext('2d').getImageData(0,0,W,H).data;};
    const isInk=(im,p)=>{const q=projPoint(p,tf),x=Math.round(q.x),y=Math.round(q.y);if(!q.ok||x<2||y<2||x>=W-2||y>=H-2)return null;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(im[((y+dy)*W+x+dx)*4+3]>120)return true;return false;};
    let im=draw(bottom);for(let i=0;i<4;i++){const a=pt(o,...xy[i],0),b=pt(o,...xy[(i+1)%4],0);for(let j=2;j<=18;j+=2){const p=a.map((v,k)=>v+(b[k]-v)*j/20),d=ray(p,tris),ink=isInk(im,p);if(ink===null)continue;if(d<.005){visible++;if(ink)paintedVisible++;}else if(d>.12){hidden++;if(ink)paintedHidden++;}}}
    for(const si of supports){const imNew=draw(si),imOld=draw(si,true),s=S[si];for(let j=2;j<=18;j+=2){const a=s.p[0],b=s.p[s.p.length-1],p=a.map((v,k)=>v+(b[k]-v)*j/20),ink=isInk(imNew,p),old=isInk(imOld,p);if(ink===null)continue;embedded++;if(ink)embeddedInk++;if(ray(p,tris)>.05 && old)oldLeaks++;}}
    cases++;
   }
  }
  window.__showBalconyEmbedded=false;window.__hlOnly=null;
  // 線画だけの表示では補助線は維持される（面の有無で切替）。
  setOb(id,{ca:0,cb:0,lift:3,rot:0,balconyThickness:.14,balconyFrontRail:true,balconySideRail:true});regenObjects();Object.assign(P,{yaw:45,pitch:10,cx:5.65,cz:-5.65,ch:1.7,surfaceMode:false});sync();render();
  const image=LC.getContext('2d').getImageData(0,0,W,H).data,tf=[Z,0,0,Z,...viewShift()];let wireHits=0;
  for(const s of S.filter(s=>s.ob?.id===id&&s.balconyEmbeddedSupport))for(let j=2;j<=8;j++){const a=s.p[0],b=s.p[s.p.length-1],p=a.map((v,k)=>v+(b[k]-v)*j/10),q=projPoint(p,tf),x=Math.round(q.x),y=Math.round(q.y);if(q.ok&&x>=1&&y>=1&&x<W-1&&y<H-1&&image[(y*W+x)*4+3]>100)wireHits++;}
  // 別オブジェクトで底辺中央を隠す。中央だけが切れ、左右は残ること。
  P.surfaceMode=true;Object.assign(P,{yaw:0,pitch:Math.atan2(1.9,8)*180/Math.PI,cx:0,cz:-8,ch:1.7});sync();
  const bottomSamples=()=>{regenObjects();const si=S.findIndex(s=>s.ob?.id===id),o=obOf(id),g=balconyGeometry(o);window.__hlIdx.set(S[si],si);window.__hlOnly=si;render();const im=LC.getContext('2d').getImageData(0,0,W,H).data,tf=[Z,0,0,Z,...viewShift()];return [-1.2,-.9,-.6,-.3,0,.3,.6,.9,1.2].map(x=>{const q=projPoint(pt(o,x,-g.d/2,0),tf),px=Math.round(q.x),py=Math.round(q.y);let n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(im[((py+dy)*W+px+dx)*4+3]>120)n++;return n;});};
  const beforeBlock=bottomSamples();window.__hlOnly=null;window.__add('box',1);const blocker=sel;setOb(blocker,{ca:0,cb:-3.5,lift:2,ra:.2,rb:.2,h:1,rot:0});sel=null;const afterBlock=bottomSamples();window.__hlOnly=null;
  return {cases,visible,paintedVisible,hidden,paintedHidden,embedded,embeddedInk,oldLeaks,wrongFlags,wireHits,beforeBlock,afterBlock};
 });
 console.log(JSON.stringify({result,errors}));const r=result;
 // 同一ポリラインの角の投影重なりは許す。内部補助線のみ描いた層は完全に透明でなければならない。
 if(errors.length||r.cases!==128||r.wrongFlags||r.paintedVisible<r.visible*.97||r.paintedHidden>r.hidden*.08||r.embeddedInk||!r.oldLeaks||r.wireHits<4||r.beforeBlock.some(n=>!n)||r.afterBlock.slice(0,3).some(n=>!n)||r.afterBlock.slice(3,6).some(n=>n)||r.afterBlock.slice(6).some(n=>!n))process.exitCode=1;
 else console.log('OK: 回転・手すりON/OFF・厚み・上下視点、内部線の非表示と線画表示');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
