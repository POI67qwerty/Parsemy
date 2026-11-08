/* 端の変更が、旧新ファサード投影範囲以外のキャンバス画素を変えないか。 */
const {open,ADD_FN}=require('./lib');
(async()=>{const{browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);const rows=await page.evaluate(()=>{
 S.length=0;clearSelection();window.__add('cornerCutBox',1);const id=sel;setOb(id,{ca:0,cb:0,lift:0,rot:0,cornerOffset:.8,facadeProjection:.4,facadeHeight:.7,facadeEnabled:true});sel=null;tool='view';P.surfaceMode=true;window.__noLineCache=true;window.__noDepthCache=true;window.__noSurfCache=true;window.__noSurfFull=true;
 const out=[];for(const view of ['home','top'])for(const side of [false,true]){
  setOb(id,{facadeSides:side});cityStandardView(view);sync();
  function capture(legacy){window.__legacyCornerFascia=legacy;setOb(id,{__facadePixelComparison:legacy});regenObjects();render();const o=obOf(id),f=cornerCutFasciaParts(o),tf=[Z,0,0,Z,...viewShift()],pts=f.parts.flatMap(part=>part.flatMap(([x,y])=>[projPoint(pt(o,x,y,f.g.z0),tf),projPoint(pt(o,x,y,f.g.z1),tf)])).filter(p=>p.ok);return {pixels:new Uint8ClampedArray(ctx.getImageData(0,0,W,H).data),pts};}
  const a=capture(true),b=capture(false),pts=[...a.pts,...b.pts],box={x0:Math.min(...pts.map(p=>p.x))-8,x1:Math.max(...pts.map(p=>p.x))+8,y0:Math.min(...pts.map(p=>p.y))-8,y1:Math.max(...pts.map(p=>p.y))+8};let changed=0,outside=0;
  for(let p=0;p<W*H;p++){let diff=false;for(let k=0;k<4;k++)if(a.pixels[4*p+k]!==b.pixels[4*p+k])diff=true;if(diff){changed++;const x=p%W,y=Math.floor(p/W);if(x<box.x0||x>box.x1||y<box.y0||y>box.y1)outside++;}}
  out.push({view,side,changed,outside});
 }window.__legacyCornerFascia=false;return out;
 });console.log(JSON.stringify({rows,errors}));if(errors.length||rows.some(x=>!x.changed||x.outside))process.exitCode=1;else console.log('OK: 4場面の差分はファサード投影範囲内');await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
