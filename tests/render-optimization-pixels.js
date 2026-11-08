/* 投影・BVHの一時確保削減前後を同一環境で直接比較する。 */
const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:800}); await page.evaluate(ADD_FN);
 const rows=await page.evaluate(()=>{
  const fastWld=wld,fastOrth=orthSetup,fastFish=fishPointOccluded;
  function oldWld(v) {
   const th=P.yaw*DG,ph=P.pitch*DG,ro=(T==='f'?P.roll:0)*DG;
   const x1=v[0]*Math.cos(ro)+v[1]*Math.sin(ro),y2=-v[0]*Math.sin(ro)+v[1]*Math.cos(ro);
   const y1=y2*Math.cos(ph)+v[2]*Math.sin(ph),z1=-y2*Math.sin(ph)+v[2]*Math.cos(ph);
   return [x1*Math.cos(th)-z1*Math.sin(th),y1,x1*Math.sin(th)+z1*Math.cos(th)];
  }
  let oldKey='',oldVal=null;
  function oldOrth(){
   const sc=orthScale(),pc=orthPlanCenter(),key=orthView+'|'+sc+'|'+W+'|'+H+'|1|'+pc[0]+'|'+pc[1]+'|'+P.cx+'|'+P.cz+'|'+P.ch;
   if(oldVal&&key===oldKey)return oldVal;
   const b=orthBasis(),camera=[P.cx,P.ch-1,P.cz],sx=dot3(camera,b.right),sy=dot3(camera,b.up);
   oldVal={right:b.right,up:b.up,depth:b.depth,sc,ax:W/2+(sx-pc[0])*sc,ay:H/2-(sy-pc[1])*sc};oldKey=key;return oldVal;
  }
  // 旧版は各視線で方向配列と逆方向配列を新規に作る。交差判定自体は同じ。
  const fishSource=fastFish.toString().replace(/inv=fishRayInverse, cam=set\.cam;[\s\S]*?fishBvhStack\.length=0;/,
   'ds=[dx,dy,dz], inv=ds.map(v=>Math.abs(v)<1e-14?Infinity:1/v), cam=set.cam; fishBvhStack.length=0;');
  if(fishSource===fastFish.toString())throw Error('旧BVH方式の再現に失敗');
  const oldFish=eval('('+fishSource+')');
  // 角度キャッシュも旧計算と符号付きゼロを含めて同一にする。
  for(const yaw of [-180,-13,0,-0,42]) for(const pitch of [-37,0,-0,90]) for(const roll of [-31,0,-0,66]) {
   T='f';Object.assign(P,{yaw,pitch,roll});
   for(const v of [[0,0,1],[-0,0,-1],[.23,-.79,.52]]) {
    const a=oldWld(v),b=fastWld(v);if(a.some((x,i)=>!Object.is(x,b[i])))throw Error('逆変換の数値差');
   }
  }
  S.length=0;clearSelection();const ids=[];
  for(const [kind,x,z,h] of [['signPost',-2,0,0],['trafficSignal',1,1,0],['building',-1,4,0],['box',2,2,0],['beveledStackedBuilding',4,4,0],['railing',-4,3,0]]){
   __add(kind,1);ids.push(sel);setOb(sel,{ca:x,cb:z,lift:h,rot:17});
  }
  clearSelection();tool='view';P.surfaceMode=true;window.__noLineCache=true;window.__noSurfCache=true;window.__noSurfFull=true;
  const cmp=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])n++;return n;};
  const use=(old)=>{wld=old?oldWld:fastWld;orthSetup=old?oldOrth:fastOrth;fishPointOccluded=old?oldFish:fastFish;};
  const snap=()=>{
   render();const screen=new Uint8ClampedArray(ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height).data);
   const exp=lineLayer(false,false,900,700,[.5,0,0,.5,0,0],true).getContext('2d').getImageData(0,0,900,700).data;
   return {screen,exp:new Uint8ClampedArray(exp)};
  };
  const results=[];
  for(const view of ['home','front','back','left','right','top','bottom'])for(const step of [0,1]){
   cityStandardView(view);if(view==='home'){T=step?'f':'r';Object.assign(P,{cx:4+step,cz:-12,ch:2.8,yaw:step?38:-22,pitch:step?19:-12,roll:step?31:0,fov:step?220:90});CAMKEY=null;}
   else {window.cityFloorPlanCenter=[step*.3,-step*.2];window.cityFloorPlanScale=70+step*8;}
   if(step)setOb(ids[0],{ca:-1.5,rot:39,h:4});else setOb(ids[0],{ca:-2,rot:17,h:3});
   sync();regenObjects();
   use(true);const old=snap();use(false);const now=snap();
   results.push({view,step,screenDiff:cmp(old.screen,now.screen),exportDiff:cmp(old.exp,now.exp),screenInk:now.screen.reduce((n,v,i)=>n+(i%4===3&&v?1:0),0),exportInk:now.exp.reduce((n,v,i)=>n+(i%4===3&&v?1:0),0)});
  }
  use(false);return results;
 });
 console.log(JSON.stringify({rows,errors}));if(errors.length||rows.length!==14||rows.some(r=>r.screenDiff||r.exportDiff||!r.exportInk))process.exitCode=1;else console.log('OK: 最適化前後14条件の画面・出力RGBA一致');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
