/* Compare current BVH rays with the pre-optimization implementation, in the same browser. */
const {open,ADD_FN}=require('./lib');
const legacyOrthSource = require('./fixtures/legacy-orth-ray');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);
 const rows=await page.evaluate((oldSource)=>{
  const fastOrth=signalOrthOccluded, fastBox=boxCornerPoints;
  // 元々は線用・面用のそれぞれに同じ8頂点が書かれていた。
  const oldBox=(cx,cy,w,d,z0,z1)=>{const x=w/2,y=d/2;return [[cx-x,cy-y,z0],[cx+x,cy-y,z0],[cx+x,cy+y,z0],[cx-x,cy+y,z0],[cx-x,cy-y,z1],[cx+x,cy-y,z1],[cx+x,cy+y,z1],[cx-x,cy+y,z1]];};
  const boxCases=[[0,0,2,3,0,4],[1.2,-2.3,.25,7,-1,6],[-0,0,0,-0,-0,0],[-3,5,-2,-4,3,-1]];
  const boxesEqual=boxCases.every(args=>oldBox(...args).every((point,i)=>point.every((v,j)=>Object.is(v,fastBox(...args)[i][j]))));
  const legacyOrth=eval('('+oldSource+')'); let orthCalls=0;
  const oldOrth=(...args)=>{orthCalls++;return legacyOrth(...args);};
  const use=old=>{signalOrthOccluded=old?oldOrth:fastOrth;boxCornerPoints=old?oldBox:fastBox;};
  S.length=0;clearSelection();
  const types=['signPost','trafficSignal','building','box','beveledStackedBuilding','railing','displayShelf2'];
  types.forEach((kind,i)=>{__add(kind,1);setOb(sel,{ca:(i%3-1)*2.2,cb:Math.floor(i/3)*2.5,rot:i*13,arrayEnabled:kind==='railing',arrayCount:3,arraySpacing:1.7});});
  clearSelection();tool='view';P.surfaceMode=true;window.__noLineCache=true;window.__noSurfCache=true;window.__noSurfFull=true;
  const diff=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])n++;return n;};
  const snap=()=>{regenObjects();render();return {screen:new Uint8ClampedArray(ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height).data),exp:new Uint8ClampedArray(lineLayer(false,false,900,700,[.5,0,0,.5,0,0],true).getContext('2d').getImageData(0,0,900,700).data)};};
  const out=[];
  for(const view of ['home','front','back','left','right','top','bottom'])for(const step of [0,1,2]){
   cityStandardView(view);
   if(view==='home'){T=step===2?'f':'r';Object.assign(P,{cx:2+step,cz:-10+step,ch:2.8,yaw:-24+step*29,pitch:-12+step*9,roll:step*13,fov:step===2?220:90,lens:step===0?28:45});CAMKEY=null;}
   else {window.cityFloorPlanCenter=[step*.3,-step*.2];window.cityFloorPlanScale=65+step*8;}
   sync();regenObjects();
   use(true);const a=snap();const savedA=JSON.stringify(pack(true));use(false);const b=snap();const savedB=JSON.stringify(pack(true));
   out.push({view,step,screenDiff:diff(a.screen,b.screen),exportDiff:diff(a.exp,b.exp),savedEqual:savedA===savedB,exportInk:b.exp.reduce((n,v,i)=>n+(i%4===3&&v?1:0),0)});
  }
  use(false);return {out,orthCalls,boxesEqual};
 },legacyOrthSource);
 console.log(JSON.stringify({rows,errors}));if(errors.length||rows.out.length!==21||!rows.orthCalls||!rows.boxesEqual||rows.out.some(r=>r.screenDiff||r.exportDiff||!r.savedEqual||!r.exportInk))process.exitCode=1;else console.log('OK: 直方体頂点および21条件の画面・出力RGBAと保存状態が旧方式と一致');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
