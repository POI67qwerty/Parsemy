/* 透視の頂点投影を旧実装と厳密に比較。深度・面ID・実画素も照合する。 */
const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);
 const result=await page.evaluate(()=>{
  const fast=exportPoint;
  function old(v,tf){const rel=V.add(v,CO()),q=scr3(rel);if(!q.ok)return null;const depth=orthView?dot3(rel,orthBasis().depth):T==='f'?Math.hypot(rel[0],rel[1],rel[2]):cam(rel)[2];return {x:q.x*tf[0]+tf[4],y:q.y*tf[3]+tf[5],depth};}
  const cmp=(a,b)=>{let n=0;for(let i=0;i<a.length;i++)if(!Object.is(a[i],b[i]))n++;return n;};
  let numerical=0,points=0;
  cityStandardView('home');T='r';
  for(const yaw of [-179,-60,0,42,179])for(const pitch of [-70,-12,0,35,80]){
   Object.assign(P,{yaw,pitch,cx:3.2,cz:-7.4,ch:1.6});CAMKEY=null;
   for(let i=0;i<600;i++){
    const v=[Math.sin(i*4.123)*48,Math.cos(i*1.393)*24,Math.sin(i*.811)*52],tf=[1.2,0,0,.7,-4,9];
    const a=old(v,tf),b=fast(v,tf);points++;
    if((!a)!==(!b)||(a&&['x','y','depth'].some(k=>!Object.is(a[k],b[k]))))numerical++;
   }
  }
  S.length=0;clearSelection();let ids=[];for(const [kind,x,z] of [['building',-3,3],['beveledStackedBuilding',2,5],['railing',-4,1],['signPost',1,0],['trafficSignal',3,2],['box',0,2]]){__add(kind,1);ids.push(sel);setOb(sel,{ca:x,cb:z,rot:22});}
  clearSelection();tool='view';P.surfaceMode=true;window.__noLineCache=true;window.__noDepthCache=true;window.__noSurfCache=true;window.__noSurfFull=true;
  const snap=()=>{
   render();const screen=new Uint8ClampedArray(ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height).data);
   const exp=lineLayer(false,false,900,700,[.5,0,0,.5,0,0],true).getContext('2d').getImageData(0,0,900,700).data;
   return {screen,exp:new Uint8ClampedArray(exp),depth:new Float32Array(depthBuffer),owner:new Int32Array(depthOwner),face:new Int32Array(depthFace)};
  };
  let rows=[];for(const view of ['home','front','top'])for(let step=0;step<2;step++){
   cityStandardView(view);if(view==='home'){T=step?'f':'r';Object.assign(P,{cx:2,cz:-12,ch:3,yaw:step?25:-18,pitch:step?24:-9,roll:15,fov:160});CAMKEY=null;}
   setOb(ids[1],{ca:step?2.6:2,rot:step?51:22});sync();regenObjects();
   exportPoint=old;const a=snap();exportPoint=fast;const b=snap();
   rows.push({view,step,screen:cmp(a.screen,b.screen),export:cmp(a.exp,b.exp),depth:cmp(a.depth,b.depth),owner:cmp(a.owner,b.owner),face:cmp(a.face,b.face)});
  }
  exportPoint=fast;return {points,numerical,rows};
 });console.log(JSON.stringify({result,errors}));if(errors.length||result.numerical||result.points!==15000||result.rows.some(r=>r.screen||r.export||r.depth||r.owner||r.face))process.exitCode=1;else console.log('OK: 15,000点の厳密一致、6条件の画面・出力・深度・オーナー・面ID一致');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
