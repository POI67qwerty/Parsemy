/* 隅切りファサードの自由端は直角、回り込みの接続部は隙間なし。 */
const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);
 const r=await page.evaluate(()=>{
  S.length=0;clearSelection();window.__add('cornerCutBox',1);const base=obOf(sel),cases=[],corners=['front-left','front-right','back-left','back-right'],dims=[{ra:2,rb:1.5,h:4,cornerOffset:.8},{ra:.25,rb:.3,h:.55,cornerOffset:.15},{ra:3,rb:2,h:6,cornerOffset:1.2}],eps=1e-7;
  const near=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))<eps;
  for(const corner of corners)for(const side of [false,true])for(const d of dims)for(const projection of [.02,.2,2])for(const rot of [0,37,90]){
   const o=normalizedAsset({...base,...d,rot,cornerCutCorner:corner,facadeEnabled:true,facadeSides:side,facadeProjection:projection,facadeColor:'#1234ab',cornerCutOpeningEnabled:true}),f=cornerCutFasciaParts(o), tris=surfaceTriangles(o).filter(t=>t.surfaceColor==='#1234ab'),lines=genShape(o),bounds=obBounds(o),fail=[];let free=0,joined=0;
   for(let i=0;i<f.parts.length;i++){
    const [a,b,c,d]=f.parts[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
    for(const [p,q] of [[a,d],[b,c]]){
     const neighbor=f.parts.some((other,j)=>i!==j&&(near(p,other[0])||near(p,other[1])));
     if(neighbor){joined++;const match=f.parts.some((other,j)=>i!==j&&((near(p,other[0])&&near(q,other[3]))||(near(p,other[1])&&near(q,other[2]))));if(!match)fail.push('join');}
     else{free++;const v=[q[0]-p[0],q[1]-p[1]],vl=Math.hypot(...v);if(Math.abs(dx*v[0]+dy*v[1])>eps*len||Math.abs(vl-projection)>eps)fail.push('not-square');}
    }
    for(const v of [a,b,c,d])for(const h of [f.g.z0,f.g.z1]){
     const p=pt(o,v[0],v[1],h);
     if(!tris.some(t=>t.some(q=>near(p,q))))fail.push('surface');
     if(!lines.some(s=>s.p.some(q=>near(p,q))))fail.push('line');
     if(!p.every((x,j)=>x>=bounds.lo[j]-eps&&x<=bounds.hi[j]+eps))fail.push('bounds');
    }
   }
   if(f.parts.length!==(side?3:1)||free!==2||joined!==(side?4:0))fail.push('topology');
   cases.push({corner,side,rot,projection,free,joined,fail:[...new Set(fail)]});
  }
  // 隅切りがゼロのとき、回り込みの2辺の接合も離れない。
  const zero=normalizedAsset({...base,cornerOffset:0,facadeEnabled:true,facadeSides:true}),z=cornerCutFasciaParts(zero),zeroJoin=z.parts.length===2&&near(z.parts[0][0],z.parts[1][1])&&near(z.parts[0][3],z.parts[1][2]);
  return {count:cases.length,bad:cases.filter(c=>c.fail.length),zeroJoin};
 });
 console.log(JSON.stringify({result:r,errors}));if(r.count!==216||r.bad.length||!r.zeroJoin||errors.length)process.exitCode=1;else console.log('OK: 216条件、自由端が直角・接合部が一致・線と面と範囲が一致');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
