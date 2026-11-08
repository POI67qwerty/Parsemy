const {open,ADD_FN}=require('./lib');
(async()=>{const {browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);
const result=await page.evaluate(()=>{
 const K=ASSET_KIT,eq=(a,b)=>Math.abs(a-b)<1e-8,sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 function ray(origin,dir,tris){let hits=0;for(const [a,b,c] of tris){const e1=sub(b,a),e2=sub(c,a),p=cross(dir,e2),det=dot(e1,p);if(Math.abs(det)<1e-10)continue;const f=1/det,s=sub(origin,a),u=f*dot(s,p),q=cross(s,e1),v=f*dot(dir,q),d=f*dot(e2,q);if(u>=-1e-9&&v>=-1e-9&&u+v<=1+1e-9&&d>1e-7)hits++;}return hits;}
 let cases=[];
 for(const knee of [.2,.4,.6])for(const length of [.04,.4,1.3])for(const t of [.005,.04,.12])for(const b of [0,.04,.15]){
  const w=1.1,h=.8,part=K.part('screenHood',{w,h,length,t,bevel:b,knee})[0],tris=K.partTris(part),edges=K.partEdges(part),loop=edges[0],frontY=length/4;
  const finite=tris.flat(2).every(Number.isFinite),valid=tris.every(([a,c,d])=>Math.hypot(...cross(sub(c,a),sub(d,a)))>1e-11);
  const hole=ray([0,length, h/2],[0,-1,0],tris),left=ray([-w/2+t/2,length,h/2],[0,-1,0],tris),right=ray([w/2-t/2,length,h/2],[0,-1,0],tris),top=ray([0,length,h-t/2],[0,-1,0],tris),bottom=ray([0,length,t/2],[0,-1,0],tris);
  const knees=[-1,1].map(sign=>loop.some(p=>eq(p[0],sign*w/2)&&eq(p[1],frontY)&&eq(p[2],knee)));
  const expected=beveledBoxFootprint(w,h,b,4),back=edges[2],match=expected.every(([x,z])=>back.some(p=>eq(p[0],x)&&eq(p[1],length/2)&&eq(p[2],z+h/2)));
  const groupMarks=[...new Set(part.seamMarks.filter(Boolean).map(m=>m.key))];
  const moved=K.part('screenHood',{w,h,length,t,bevel:b,knee,at:[2,3,4],color:'#123456',width:3})[0],p0=edges[0][0],p1=K.partEdges(moved)[0][0],placed=p0.every((v,i)=>eq(p1[i]-v,[2,3,4][i]))&&moved.color==='#123456'&&moved.width===3;
  cases.push({knee,length,t,b,finite,valid,hole,left,right,top,bottom,knees,match,groups:groupMarks.length,placed,ok:finite&&valid&&!hole&&left>0&&right>0&&top>0&&bottom>0&&knees.every(Boolean)&&match&&placed&&(b===0||groupMarks.length>=4)});
 }
 let anchors=[];
 for(const k of [1,0,2])for(const rot of [0,37])for(const tilt of [0,22]){
  S.length=0;clearSelection();__add('screenHood',1);const id=sel;setOb(id,{ca:.2,cb:-.3,lift:.4,k,rot,rotX:tilt,rotZ:tilt/2,hoodKnee:.45});let o=obOf(id),g=screenHoodParams(o),ctl=assetEditorControls(o).find(c=>c.key==='hoodLength');
  const back=[[-o.ra,o.rb,0],[o.ra,o.rb,o.h],[0,o.rb,o.h/2]].map(p=>L2W(o,...p)),front=L2W(o,0,-o.rb,o.h),patch=ctl.patch(o,.9);setOb(id,patch);o=obOf(id);const q=screenHoodParams(o),after=[[-o.ra,o.rb,0],[o.ra,o.rb,o.h],[0,o.rb,o.h/2]].map(p=>L2W(o,...p)),front2=L2W(o,0,-o.rb,o.h);
  const drift=Math.max(...back.map((p,i)=>Math.hypot(...sub(p,after[i])))),move=Math.hypot(...sub(front,front2));const bb=obBounds(o),points=surfaceTriangles(o).flat().concat(genShape(o).flatMap(s=>s.p)),inside=points.every(p=>p.every((v,i)=>v>=bb.lo[i]-1e-6&&v<=bb.hi[i]+1e-6));
  anchors.push({k,rot,tilt,drift,move,inside,length:q.length,brim:q.brimLength,frame:q.frameDepth,knee:q.knee,ok:drift<1e-7&&move>.4&&inside&&eq(q.brimLength,.9)&&eq(q.frameDepth,.1)&&eq(q.knee,.45)});
 }
 let linked=[];
 for(const knee of [.2,.4,.6]){S.length=0;clearSelection();__add('screenHood',1);let id=sel;setOb(id,{hoodKnee:knee,hoodBevel:.08});let o=obOf(id),g=screenHoodParams(o),e=K.part('screenHood',{w:g.w,h:g.h,length:g.length,t:g.t,bevel:g.bevel,knee:g.knee})[0].meshEdges[0];linked.push({knee,ok:[-1,1].every(s=>e.some(p=>eq(p[0],s*g.w/2)&&eq(p[1],g.length/4)&&eq(p[2],knee)))});}
 return {cases,anchors,linked};});
const bad=result.cases.filter(x=>!x.ok),badAnchors=result.anchors.filter(x=>!x.ok),badLinked=result.linked.filter(x=>!x.ok);console.log(JSON.stringify({cases:result.cases.length,bad,anchors:result.anchors.length,badAnchors,badLinked,errors}));if(errors.length||bad.length||badAnchors.length||badLinked.length)process.exitCode=1;else console.log('OK: 四面・開口・4角の直方体式ベベル81条件、折れ点連動・取付面固定');await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
