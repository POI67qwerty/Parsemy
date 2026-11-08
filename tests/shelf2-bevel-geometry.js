/* 棚板の実面と線がベベル直方体の輪郭・角の候補と一致する。 */
const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open(); await page.evaluate(ADD_FN);
 const rows=await page.evaluate(()=>{
  const out=[],near=(a,b)=>Math.abs(a-b)<1e-7,eq=(a,b)=>a.every((v,i)=>near(v,b[i]));
  for(const b of [0,.02,.1,.24])for(const t of [.02,.12,.22]){
   S.length=0;clearSelection();__add('displayShelf2',1);const id=sel;
   setOb(id,{ca:0,cb:0,lift:0,rot:0,shelf2Count:3,shelf2BoardW:1.0,shelf2WallT:t,shelf2Bevel:b});
   const o=obOf(id),tri=surfaceTriangles(o).flat(),pitch=(o.h-o.shelf2BoardT)/2,bd=o.rb*2+.04,
    zs=[0,pitch,2*pitch],path=beveledBoxFootprint(1,bd,b,4).map(([x,y])=>[x,y-.02]),
    has=p=>tri.some(q=>eq(p,q)),lines=S.filter(s=>s.ob?.id===id),
    seg=(a,c)=>lines.find(s=>(eq(s.p[0],a)&&eq(s.p.at(-1),c))||(eq(s.p[0],c)&&eq(s.p.at(-1),a)));
   const vertices=zs.every(z=>[z,z+o.shelf2BoardT].every(zz=>path.every(([px,py])=>has(L2W(o,px,py,zz)))));
   const verticals=zs.every((z,i)=>path.every(([px,py],j)=>{
     const s=seg(L2W(o,px,py,z),L2W(o,px,py,z+o.shelf2BoardT)),mark=beveledEdgeMark(j,b,4,'shelf2-'+i);
     return s&&(!mark?s.seam==null:s.seam===mark.key&&!!s.seamApex===!!mark.apex);
   }));
   const rings=zs.every(z=>[z,z+o.shelf2BoardT].every(zz=>lines.some(s=>
     eq(s.p[0],L2W(o,path[0][0],path[0][1],zz))&&eq(s.p.at(-1),s.p[0])&&
     path.every(([px,py])=>s.p.some(q=>eq(q,L2W(o,px,py,zz))))
   )));
   const wallFront=o.rb-t,hits=[];
   path.forEach((a,j)=>{const c=path[(j+1)%path.length];
     if(Math.abs(a[1]-c[1])<1e-10){if(near(wallFront,a[1]))hits.push(a[0],c[0]);return;}
     const q=(wallFront-a[1])/(c[1]-a[1]);if(q>=-1e-9&&q<=1+1e-9)hits.push(a[0]+q*(c[0]-a[0]));
   });
   const half=Math.min(o.ra-t,Math.max(...hits)),rear=zs.every(z=>[z,z+o.shelf2BoardT].every(zz=>
     !!seg(L2W(o,-half,wallFront,zz),L2W(o,half,wallFront,zz))));
   const seams=lines.filter(s=>s.seam!=null).length;
   out.push({b,t,vertices,verticals,rings,rear,seams,ok:vertices&&verticals&&rings&&rear&&seams===(b===0?0:60)});
  }return out;
 });
 console.log(JSON.stringify({rows,errors}));
 if(errors.length||rows.some(r=>!r.ok))process.exitCode=1;
 else console.log('OK: ベベル直方体と同じ4隅・輪郭・角ごとの候補と実際の奥交線');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
