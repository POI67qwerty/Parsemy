/* 選択ギズモのフォントによる画素差を、ラベル領域に限って検査する。 */
const {open,ADD_FN}=require('./lib');
(async()=>{const{browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);
const rows=await page.evaluate(()=>{
 const original=gzLabel,source=original.toString();
 const alternative=eval('('+source.replace('px system-ui','px Noto Serif CJK JP')+')');
 const out=[];for(const [kind,view] of [['cornerCutBox','home'],['cornerCutBox','top'],['railing','home'],['sedan','side'],['sphere','home'],['stall','home']]){
  S.length=0;clearSelection();__add(kind,1);const id=sel;setOb(id,{ca:0,cb:0,lift:0});regenObjects();sel=id;tool='edit';setMode('draw');P.surfaceMode=true;cityStandardView(view);sync();CAMKEY=null;
  const snap=(fn)=>{gzLabel=fn;render();return {data:new Uint8ClampedArray(ctx.getImageData(0,0,W,H).data),rects:gzLabelRects.map(r=>({...r}))};};
  const a=snap(original),b=snap(alternative),rects=[...a.rects,...b.rects];let diff=0,outside=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;if(a.data[i]!==b.data[i]||a.data[i+1]!==b.data[i+1]||a.data[i+2]!==b.data[i+2]||a.data[i+3]!==b.data[i+3]){diff++;if(!rects.some(r=>x>=r.x-8&&x<=r.x+r.w+8&&y>=r.y-8&&y<=r.y+r.h+8))outside++;}}
  out.push({kind,view,diff,outside,labels:a.rects.length});
 }gzLabel=original;return out;
});console.log(JSON.stringify({rows,errors}));if(errors.length||rows.length!==6||rows.some(r=>!r.diff||r.outside||!r.labels))process.exitCode=1;else console.log('OK: フォント変更の画素差は6場面すべてギズモラベル領域内');await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
