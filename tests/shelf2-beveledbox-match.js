/* 同じ寸法のベベル直方体と、棚2の1枚の点列・候補・線画画素を比較。 */
const{open,ADD_FN}=require('./lib');
(async()=>{
 const{browser,page,errors}=await open();await page.evaluate(ADD_FN);
 const rows=await page.evaluate(()=>{
  let out=[];
  for(const b of [0,.04,.14])for(const view of ['home','front','top']){
   S.length=0;clearSelection();__add('displayShelf2',1);const id=sel;
   setOb(id,{ca:0,cb:0,lift:0,rot:0,shelf2Count:3,shelf2BoardW:1.4,shelf2Bevel:b});
   const o=obOf(id),box={...o,id:'compare-box',asset:'beveledBox',ra:o.shelf2BoardW/2,rb:o.rb+.02,h:o.shelf2BoardT,cb:o.cb-.02,bevelOffset:b,bevelSegments:4},expected=[];
   linesBeveledBox({o:box,h:box.h,c:o.c,out:expected});
   const count=expected.length,actual=S.filter(s=>s.ob?.id===id).slice(10,10+count),eq=(a,c)=>Math.abs(a-c)<1e-7;
   const geom=actual.length===count&&actual.every((s,i)=>{
    const e=expected[i],points=s.p.length===e.p.length&&s.p.every((p,j)=>p.every((x,k)=>eq(x,e.p[j][k])));
    const seam=(s.seam==null&&e.seam==null)||(s.seam?.split(':').at(-1)===e.seam?.split(':').at(-1)&&!!s.seamApex===!!e.seamApex);
    return points&&seam;
   });
   clearSelection();tool='view';cityStandardView(view);P.surfaceMode=false;window.__noLineCache=true;
   const draw=lines=>{S=lines;for(const s of S){s.cs=sigNow();if(s.preciseTubeEdge)s.tubeContourView=orthView||'3d';}render();return LC.getContext('2d').getImageData(0,0,W,H).data;};
   const a=new Uint8ClampedArray(draw(actual)),c=draw(expected);let diff=0,ink=0;
   for(let i=3;i<a.length;i+=4){if(a[i]!==c[i])diff++;if(a[i])ink++;}
   out.push({b,view,count,geom,diff,ink,ok:geom&&diff===0&&ink>0});
  }return out;
 });
 console.log(JSON.stringify({rows,errors}));if(errors.length||rows.some(x=>!x.ok))process.exitCode=1;
 else console.log('OK: ベベル直方体と点列・輪郭候補・線画画素が一致');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
