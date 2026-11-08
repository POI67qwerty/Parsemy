const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open();await page.evaluate(ADD_FN);
 const r=await page.evaluate(()=>{
  const near=(a,b)=>Math.abs(a-b)<1e-7, dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
  S.length=0;clearSelection();__add('streetPavement',1);const id=sel;
  setOb(id,{ca:0,cb:0,lift:0,k:1,rot:0});let o=obOf(id),off=genShape(o).map(s=>s.p),offTris=surfaceTriangles(o).length,offBounds=obBounds(o),offHandles=(specialGizmo(o)?.registeredHandles||[]).map(x=>x.paramKey);
  const rows=[];
  for(const test of [{w:.18,b:0,ra:1.2,rb:.6},{w:.18,b:.04,ra:1.2,rb:.6},{w:.18,b:.18,ra:1.2,rb:.6},{w:2,b:2,ra:.025,rb:.025},{w:.02,b:.02,ra:.025,rb:.025}]){
   setOb(id,{pavementCurbBevel:0});setOb(id,{pavementCurbWidth:test.w,ra:test.ra,rb:test.rb,pavementCurbEnabled:false});const offCount=genShape(obOf(id)).length;setOb(id,{pavementCurbEnabled:true,pavementCurbBevel:test.b});o=obOf(id);
   const lines=genShape(o),tris=surfaceTriangles(o),ring=tris.slice(12),box=obBounds(o),h=o.h,ch=o.pavementCurbHeight??.06;
   const triangleArea=t=>{const a=t[0],u=t[1].map((x,i)=>x-a[i]),v=t[2].map((x,i)=>x-a[i]);return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);};
   const above=ring.filter(t=>t.every(p=>near(p[1],-1+h+ch)));
   const inside=(x,y,t)=>{let p=t.map(q=>[q[0],q[2]]),cross=(a,b)=>a[0]*b[1]-a[1]*b[0],u=p[1].map((v,i)=>v-p[0][i]),v=p[2].map((v,i)=>v-p[0][i]),q=[x-p[0][0],y-p[0][1]],d=cross(u,v);if(Math.abs(d)<1e-12)return false;let a=cross(q,v)/d,b=cross(u,q)/d;return a>=-1e-9&&b>=-1e-9&&a+b<=1+1e-9;};
   const centerClear=!above.some(t=>inside(0,0,t)),sides=[[o.ra+test.w/2,0],[-o.ra-test.w/2,0],[0,o.rb+test.w/2],[0,-o.rb-test.w/2]].every(([x,y])=>above.some(t=>inside(x,y,t)));
   const outside=ring.every(t=>{let c=t.reduce((a,p)=>a.map((v,i)=>v+p[i]/3),[0,0,0]);return Math.abs(c[0])>=o.ra-1e-7||Math.abs(c[2])>=o.rb-1e-7;});
   const expected=[],reference={...o,ra:o.ra+test.w,rb:o.rb+test.w,h:h+ch,bevelOffset:test.b,bevelSegments:4};
   linesBeveledBox({o:reference,h:reference.h,c:o.c,out:expected});
   const outer=lines.slice(offCount,offCount+expected.length);
   const boxLike=outer.length===expected.length&&outer.every((s,i)=>s.p.length===expected[i].p.length&&s.p.every((p,j)=>dist(p,expected[i].p[j])<1e-7)&&(!!s.seam===!!expected[i].seam)&&s.seamApex===expected[i].seamApex);
   rows.push({test,faces:tris.length,centerClear,sides,outside,nondegenerate:ring.every(t=>triangleArea(t)>1e-10),boxLike,bounds:Math.abs(box.lo[0]+o.ra+test.w)<.0011&&Math.abs(box.hi[0]-o.ra-test.w)<.0011&&Math.abs(box.lo[2]+o.rb+test.w)<.0011&&Math.abs(box.hi[2]-o.rb-test.w)<.0011&&Math.abs(box.hi[1]-(-1+h+ch))<.0011});
  }
  setOb(id,{pavementCurbBevel:0,pavementCurbWidth:.18,ra:1.2,rb:.6});setOb(id,{pavementCurbBevel:.04});o=obOf(id);const on=genShape(o),baseSame=JSON.stringify(on.slice(0,off.length).map(s=>s.p))===JSON.stringify(off);
  const dims={ra:o.ra,rb:o.rb,h:o.h,ca:o.ca,cb:o.cb,lift:o.lift};setOb(id,{pavementCurbWidth:.31});setOb(id,{pavementCurbHeight:.17});setOb(id,{pavementCurbBevel:.12});o=obOf(id);
  const independent=Object.keys(dims).every(k=>o[k]===dims[k])&&near(o.pavementCurbWidth,.31)&&near(o.pavementCurbHeight,.17)&&near(o.pavementCurbBevel,.12),conditions=[];
  for(const k of [0,1,2])for(const rot of [0,37])for(const tilt of [0,24]){setOb(id,{k,rot,rotX:tilt,rotZ:tilt/2});o=obOf(id);const b=obBounds(o),p=surfaceTriangles(o).flat().concat(genShape(o).flatMap(s=>s.p));conditions.push(p.every(q=>q.every((v,i)=>Number.isFinite(v)&&v>=b.lo[i]-1e-7&&v<=b.hi[i]+1e-7)));}
  setOb(id,{k:1,rot:0,rotX:0,rotZ:0,arrayEnabled:true,arrayCount:3,arraySpacing:3,arrayAxis:'x'});o=obOf(id);const copies=surfaceTriangles(o).length,save=JSON.parse(JSON.stringify(pack(true)));unpack(save);o=obOf(id);const saved={enabled:o.pavementCurbEnabled,width:o.pavementCurbWidth,height:o.pavementCurbHeight,bevel:o.pavementCurbBevel,copies:surfaceTriangles(o).length,precise:S.filter(s=>s.ob?.id===id&&s.preciseTubeEdge).length};
  setOb(id,{arrayEnabled:false,pavementCurbEnabled:false});o=obOf(id);const offAgain=JSON.stringify(genShape(o).map(s=>s.p))===JSON.stringify(off),remember=near(o.pavementCurbWidth,.31)&&near(o.pavementCurbHeight,.17)&&near(o.pavementCurbBevel,.12);
  return {offTris,offHandles,rows,baseSame,independent,conditions,copies,saved,offAgain,remember};
 });
 const ok=r.offTris===12&&!r.offHandles.some(x=>['pavementCurbWidth','pavementCurbHeight','pavementCurbBevel'].includes(x))&&r.rows.every(q=>q.centerClear&&q.sides&&q.outside&&q.nondegenerate&&q.boxLike&&q.bounds)&&r.baseSame&&r.independent&&r.conditions.every(Boolean)&&r.saved.enabled&&r.saved.width===.31&&r.saved.height===.17&&r.saved.bevel===.12&&r.saved.copies===r.copies&&r.saved.precise>0&&r.offAgain&&r.remember;
 console.log(JSON.stringify({r,errors}));if(!ok||errors.length)process.exitCode=1;else console.log('OK: 四辺の外側リング・タイル露出・ベベル直方体方式・寸法・配列・保存');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
