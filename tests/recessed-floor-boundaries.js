/* 同一平面上の階境界は表示し、反対側や前景の後ろにある線は隠す。 */
const {open,ADD_FN}=require('./lib');const {PROBE}=require('./hidden-lines');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);await page.evaluate(PROBE);
 const r=await page.evaluate(()=>{
  window.__hlInstall();window.__noLineCache=true;S.length=0;clearSelection();window.__add('recessedStackedBuilding',1);const id=sel;setOb(id,{ca:0,cb:0,lift:0,rot:0});regenObjects();sel=null;tool='view';P.surfaceMode=true;cityStandardView('home');P.cx+=1;sync();
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function ray(p){const origin=camPos(),dir=sub(p,origin),len=Math.hypot(...dir);let mx=0;for(const tri of surfaceTriangles(obOf(id))){const e1=sub(tri[1],tri[0]),e2=sub(tri[2],tri[0]),h=cross(dir,e2),det=dot(e1,h);if(Math.abs(det)<1e-9)continue;const inv=1/det,a=sub(origin,tri[0]),u=dot(a,h)*inv;if(u< -1e-7||u>1+1e-7)continue;const q=cross(a,e1),v=dot(dir,q)*inv;if(v< -1e-7||u+v>1+1e-7)continue;const k=dot(e2,q)*inv;if(k>0&&k<1)mx=Math.max(mx,(1-k)*len);}return mx;}
  function image(legacy,only){window.__legacyRecessedCaps=legacy;regenObjects();window.__hlOnly=null;if(only!==null){window.__hlIdx.set(S[only],only);window.__hlOnly=only;}render();return new Uint8ClampedArray(LC.getContext('2d').getImageData(0,0,W,H).data);}
  function ink(im,p,rad=1){const tf=[Z,0,0,Z,...viewShift()],q=projPoint(p,tf),x=Math.round(q.x),y=Math.round(q.y);if(!q.ok||x<rad||y<rad||x>=W-rad||y>=H-rad)return false;for(let dy=-rad;dy<=rad;dy++)for(let dx=-rad;dx<=rad;dx++)if(im[((y+dy)*W+x+dx)*4+3]>120)return true;return false;}
  const points=[[2.5,1.45,1.2375],[2.5,1.45,1.35],[2.5,1.45,1.575]],old=image(true,1),now=image(false,1),focus=points.map(p=>({distance:ray(p),old:ink(old,p),now:ink(now,p)}));
  // 全線の旧新差分が、変更対象の階境界線のみの画素の範囲内か検査。
  const fullOld=image(true,null),fullNew=image(false,null),mask=new Uint8Array(W*H),capIndices=S.map((s,i)=>s.recessedFloorBoundary?i:-1).filter(i=>i>=0);
  for(const legacy of [true,false])for(const i of capIndices){const d=image(legacy,i);for(let p=0;p<mask.length;p++)if(d[p*4+3])mask[p]=1;}
  let changed=0,outside=0;for(let p=0;p<mask.length;p++){let different=false;for(let k=0;k<4;k++)if(fullOld[p*4+k]!==fullNew[p*4+k])different=true;if(different){changed++;if(!mask[p]){let near=false;const x=p%W,y=Math.floor(p/W);for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)if(x+dx>=0&&x+dx<W&&y+dy>=0&&y+dy<H&&mask[(y+dy)*W+x+dx])near=true;if(!near)outside++;}}}
  const origin={cx:P.cx,cz:P.cz,ch:P.ch,yaw:P.yaw,pitch:P.pitch};
  const views=[['move-right',{}],['home',{cx:origin.cx-1}],['back',{yaw:220,cx:-25,cz:30}],['below',{yaw:40,pitch:15,cx:25,cz:-30,ch:-10}]],rows=[];
  for(const [name,setting] of views){Object.assign(P,origin,setting);sync();const im=image(false,1),s=S[1];let visible=0,painted=0,hidden=0,leaked=0;
   for(let i=1;i<s.p.length;i++){const a=s.p[i-1],b=s.p[i];if(Math.hypot(...sub(a,b))<.05)continue;for(let j=1;j<10;j++){const p=a.map((v,k)=>v+(b[k]-v)*j/10),d=ray(p),drawn=ink(im,p);if(d<.005){visible++;if(drawn)painted++;}else if(d>.25){hidden++;if(drawn)leaked++;}}}
   rows.push({name,visible,painted,hidden,leaked});
  }
  // 別の直方体を線の中央の手前に置き、中央だけ隠れ両端が残るか検査。
  Object.assign(P,origin);sync();window.__hlOnly=null;const camera=camPos(),target=[2.5,1.45,1.35],v=camera.map((c,i)=>c-target[i]),len=Math.hypot(...v),center=target.map((p,i)=>p+v[i]/len*2);
  function samples(){regenObjects();const si=S.findIndex(s=>s.ob?.id===id&&s.recessedFloorBoundary&&s.p[0][1]>1.4&&s.p[0][1]<1.5);window.__hlIdx.set(S[si],si);window.__hlOnly=si;render();const im=LC.getContext('2d').getImageData(0,0,W,H).data;return [1.1,1.2,1.3,1.35,1.4,1.5,1.6,1.7].map(z=>ink(im,[2.5,1.45,z]));}
  const beforeBlock=samples();window.__hlOnly=null;window.__add('box',1);const blocker=sel;setOb(blocker,{ca:center[0],cb:center[2],lift:center[1]+1-.08,ra:.08,rb:.08,h:.16,rot:0});sel=null;const afterBlock=samples();
  window.__hlOnly=null;return {focus,changed,outside,caps:capIndices.length,rows,beforeBlock,afterBlock};
 });
 console.log(JSON.stringify({result:r,errors}));
 if(errors.length||r.focus.some(p=>p.distance>.005||p.old||!p.now)||!r.changed||r.outside||r.caps!==8||r.rows.some(q=>!q.visible||!q.hidden||q.painted<q.visible*.98||q.leaked)||r.beforeBlock.some(v=>!v)||!r.afterBlock[0]||r.afterBlock[3]||!r.afterBlock[7])process.exitCode=1;
 else console.log('OK: 階境界の欠落・背面の遮蔽・変更画素の範囲');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
