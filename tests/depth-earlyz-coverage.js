/* 粗い格子の間の穴を見落とさず、早期Z無効の全走査と一致する。 */
const {open,ADD_FN}=require('./lib');
(async()=>{const{browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);
const result=await page.evaluate(()=>{
 const savedExport=exportPoint,savedTriangles=surfaceTriangles;
 const cmp=(a,b)=>{let n=0;for(let i=0;i<a.length;i++)if(!Object.is(a[i],b[i]))n++;return n;};
 let failures=[],synthetic=0;
 try{
  cityStandardView('home');T='r';
  for(let n=0;n<160;n++){
   const tr=[[0,0,5+(n%4)],[99,0,7+(n%5)],[0,99,6+(n%3)]];
   exportPoint=v=>({x:v[0],y:v[1],depth:v[2]});surfaceTriangles=()=>[tr];
   const run=slow=>{
    window.__noEarlyZ=slow;const b=new Float32Array(10000).fill(1),o=new Int32Array(10000).fill(7),f=new Int32Array(10000).fill(77);
    if(n<100){const x=1+(n*7)%39,y=1+(n*13)%39;b[y*100+x]=n%2?Infinity:9;}
    if(n>=120)for(let k=0;k<18;k++){const x=(n*13+k*17)%99,y=(n*5+k*11)%99;b[y*100+x]=Infinity;}
    rasterizeDepthInto(b,o,new Map([['synthetic',1]]),[{id:'synthetic'}],100,100,[1,0,0,1,0,0],{x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity},f);
    return {b,o,f};
   };
   const a=run(true),b=run(false),diff=cmp(a.b,b.b)+cmp(a.o,b.o)+cmp(a.f,b.f);
   if(diff)failures.push({n,diff});synthetic++;
  }
 }finally{exportPoint=savedExport;surfaceTriangles=savedTriangles;window.__noEarlyZ=false;}
 S.length=0;clearSelection();let ids=[];for(const [kind,x,z] of [['building',-3,3],['beveledStackedBuilding',2,5],['signPost',1,0],['box',0,2],['railing',-4,1]]){__add(kind,1);ids.push(sel);setOb(sel,{ca:x,cb:z,rot:22});}
 clearSelection();tool='view';P.surfaceMode=true;window.__noLineCache=true;window.__noDepthCache=true;window.__noSurfCache=true;window.__noSurfFull=true;
 const snap=(slow)=>{window.__noEarlyZ=slow;render();const screen=new Uint8ClampedArray(ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height).data);const exp=lineLayer(false,false,900,700,[.5,0,0,.5,0,0],true).getContext('2d').getImageData(0,0,900,700).data;return {screen,exp:new Uint8ClampedArray(exp),depth:new Float32Array(depthBuffer),owner:new Int32Array(depthOwner),face:new Int32Array(depthFace)};};
 let scenes=[];for(const view of ['home','front','top'])for(let step=0;step<2;step++){
  cityStandardView(view);if(view==='home'){T=step?'f':'r';Object.assign(P,{cx:2,cz:-12,ch:3,yaw:step?25:-18,pitch:step?24:-9,roll:15,fov:160});CAMKEY=null;}
  setOb(ids[1],{ca:step?2.6:2,rot:step?51:22});sync();regenObjects();const a=snap(true),b=snap(false);scenes.push({view,step,screen:cmp(a.screen,b.screen),export:cmp(a.exp,b.exp),depth:cmp(a.depth,b.depth),owner:cmp(a.owner,b.owner),face:cmp(a.face,b.face)});
 }
 window.__noEarlyZ=false;return {synthetic,failures,scenes};
});console.log(JSON.stringify({result,errors}));if(errors.length||result.synthetic!==160||result.failures.length||result.scenes.some(r=>r.screen||r.export||r.depth||r.owner||r.face))process.exitCode=1;else console.log('OK: 格子間の穴・160パターンと実シーン6条件で早期Z無効と深度・実画素が一致');await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
