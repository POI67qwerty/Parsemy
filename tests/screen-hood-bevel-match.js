const {open,ADD_FN}=require('./lib');
(async()=>{const {browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);const r=await page.evaluate(()=>{
 const cases=[];for(const bevel of [.02,.08,.18])for(const view of ['home','front','side','top']){
  S.length=0;clearSelection();__add('screenHood',1);const id=sel;setOb(id,{hoodKnee:.4,hoodBevel:bevel,hoodThickness:.04,rot:17});clearSelection();cityStandardView(view);P.surfaceMode=true;render();const o=obOf(id),g=screenHoodParams(o),part=ASSET_KIT.part('screenHood',{w:g.w,h:g.h,length:g.length,t:g.t,knee:g.knee,bevel:g.bevel})[0],expected=beveledBoxFootprint(g.w,g.h,bevel,4),lines=part.meshEdges,marks=part.seamMarks;
  const correct=expected.every(([x,z],i)=>{const j=lines.findIndex((e,k)=>marks[k]?.key==='hoodOuter:'+Math.floor(i/5)&&marks[k]?.apex=== (i%5===2)&&e.length===2&&Math.abs(e[0][0]-x)<1e-8&&Math.abs(e[0][2]-(z+g.h/2))<1e-8&&Math.abs(e[1][0]-x)<1e-8&&Math.abs(e[1][2]-(z+g.h/2))<1e-8);return j>=0;});
  const candidates=S.filter(s=>s.ob?.id===id&&s.seam?.startsWith('hoodOuter:')),groups=[...new Set(candidates.map(s=>s.seam))],perGroup=groups.map(k=>candidates.filter(s=>s.seam===k).length),apex=groups.map(k=>candidates.filter(s=>s.seam===k&&s.seamApex).length),picked=[...(seamPicks||[])].filter(s=>s.ob?.id===id&&s.seam?.startsWith('hoodOuter:'));
  const byGroup=new Map();for(const s of picked)byGroup.set(s.seam,(byGroup.get(s.seam)||0)+1);
  cases.push({bevel,view,correct,groups:groups.length,perGroup,apex,picked:picked.length,conflicts:[...byGroup.values()].filter(x=>x>1).length,ok:correct&&groups.length===4&&perGroup.every(x=>x===5)&&apex.every(x=>x===1)&&[...byGroup.values()].every(x=>x===1)});
 }
 return cases;});console.log(JSON.stringify({cases:r,bad:r.filter(x=>!x.ok),errors}));if(errors.length||r.some(x=>!x.ok))process.exitCode=1;else console.log('OK: 3量×4ビュー、ベベル直方体の四隅点列・候補・輪郭の方式一致');await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
