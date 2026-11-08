/* ファサード看板・隅切り階層建物の幾何とUIの点検。 */
const { open, ADD_FN } = require('./lib');
(async()=>{
  const {browser,page,errors}=await open({width:1400,height:900});
  await page.evaluate(ADD_FN);
  const r=await page.evaluate(()=>{
    S.length=0;clearSelection();window.__add('building',1);
    const base=S.find(s=>s.ob?.asset==='building').ob;
    const b=normalizedAsset({...base,ca:0,cb:0,lift:0,rot:0,ra:2,rb:1.5,h:4});
    const on=normalizedAsset({...b,facadeEnabled:true,facadeHeight:.7,facadeProjection:.2});
    const g=buildingFasciaGeometry(on), resized=buildingFasciaGeometry({...on,ra:3,h:6});
    const wrapped={...on,facadeSides:true,facadeColor:'#1234ab'}, wrapFaces=surfaceTriangles(wrapped);
    const facade={offLines:genShape(b).length,onLines:genShape(on).length,offFaces:surfaceTriangles(b).length,onFaces:surfaceTriangles(on).length,wrapFaces:wrapFaces.length,colorCount:wrapFaces.filter(t=>t.surfaceColor==='#1234ab').length,wrapBounds:obBounds(wrapped),
      g,resized,bounds:obBounds(on),saved:buildingFasciaGeometry(normalizedAsset(JSON.parse(JSON.stringify(on))))};
    S.length=0;clearSelection();window.__add('cornerCutStackedBuilding',1);
    const placed=S.find(s=>s.ob?.asset==='cornerCutStackedBuilding').ob;
    const o=normalizedAsset({...placed,ca:0,cb:0,lift:0,rot:0}), opened=normalizedAsset({...o,openingEnabled:true});
    const offT=surfaceTriangles(o),onT=surfaceTriangles(opened), f=opened.floors[0], p=stackedOpeningParams(opened,f), cp=p.corner;
    const ray=(tris,z,model=opened)=>{
      const pt=customPt(model,cp.midpoint[0]+(f.x||0),cp.midpoint[1]+(f.y||0),z+(f.z||0)), inside=customPt(model,cp.inward[0],cp.inward[1],0), origin0=customPt(model,0,0,0),
            dir=inside.map((v,i)=>v-origin0[i]), org=pt.map((v,i)=>v-dir[i]*.5);
      const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
      const hits=[];for(const tr of tris){const e1=sub(tr[1],tr[0]),e2=sub(tr[2],tr[0]),h=cross(dir,e2),det=dot(e1,h);if(Math.abs(det)<1e-9)continue;const inv=1/det,a=sub(org,tr[0]),u=dot(a,h)*inv;if(u<0||u>1)continue;const q=cross(a,e1),v=dot(dir,q)*inv;if(v<0||u+v>1)continue;const t=dot(e2,q)*inv;if(t>0)hits.push(t);}return Math.min(...hits);
    };
    const upperZ=opened.floors[1].z+.5;
    const spins=[0,37,90].map(rot=>{const x={...opened,rot}, y={...o,rot};return {rot,off:ray(surfaceTriangles(y),.5,y),on:ray(surfaceTriangles(x),.5,x)};});
    const corner={floors:o.floors.length,offLines:genShape(o).length,onLines:genShape(opened).length,offFaces:offT.length,onFaces:onT.length,
      offRay:ray(offT,.5),onRay:ray(onT,.5),upperOffRay:ray(offT,upperZ),upperOnRay:ray(onT,upperZ),depth:p.openingBack,
      spins,heightHandle:!!stackedBuildingGizmo(opened)?.handles?.height,
      width:p.openingW,height:p.openingH, saved:stackedOpeningEnabled(normalizedAsset(JSON.parse(JSON.stringify(opened))))};
    return {facade,corner};
  });
  // ファサード設定は通常建物の選択パネルから操作できること。
  const ui=await page.evaluate(()=>{
    S.length=0;clearSelection();window.__add('building',1);const o=S.find(s=>s.ob?.asset==='building').ob;
    setOb(o.id,{ca:0,cb:0,lift:0});regenObjects();sel=o.id;tool='edit';setMode('draw');cityStandardView('home');render();
    return {panel:document.getElementById('buildingP').style.display,check:!!document.getElementById('buildingFacadeEnabled')};
  });
  await page.evaluate(()=>document.getElementById('buildingFacadeEnabled').click());
  ui.toggled=await page.evaluate(()=>{const o=S.find(s=>s.ob?.asset==='building').ob;return buildingFasciaGeometry(o).enabled;});
  await page.evaluate(()=>{document.getElementById('buildingFacadeSides').click();const c=document.getElementById('buildingFacadeColor');c.value='#1234ab';c.dispatchEvent(new Event('input',{bubbles:true}));});
  ui.sidesAndColor=await page.evaluate(()=>{const o=S.find(s=>s.ob?.asset==='building').ob,g=buildingFasciaGeometry(o);return g.side&&g.color==='#1234ab' && !!surfState?.entries.get(o.id)?.tris?.some(t=>t.color==='#1234ab');});
  ui.linked=await page.evaluate(()=>{
    const rows=[];
    for(const kind of ['buildingAwning','buildingAwningOpen','buildingSign']){
      S.length=0;clearSelection();window.__add(kind,1);
      const parent=S.find(s=>s.ob?.asset==='building'&&s.ob?.linkedRole==='parent')?.ob;
      if(!parent){rows.push({kind,ok:false});continue;}
      sel=parent.id;tool='edit';setMode('draw');render();
      const visible=document.getElementById('buildingP').style.display!=='none', check=document.getElementById('buildingFacadeEnabled'),
          rowVisible=document.getElementById('buildingFacadeRow').style.display!=='none',
          excluded=kind==='buildingAwningOpen'||kind==='buildingSign';
      if(excluded) {
        const old={...parent,facadeEnabled:true,facadeSides:true}, off={...parent,facadeEnabled:false};
        const sameLines=JSON.stringify(genShape(old).map(s=>s.p))===JSON.stringify(genShape(off).map(s=>s.p)),
              sameFaces=JSON.stringify(surfaceTriangles(old))===JSON.stringify(surfaceTriangles(off)),
              sameBounds=JSON.stringify(obBounds(old))===JSON.stringify(obBounds(off));
        rows.push({kind,ok:visible&&!rowVisible&&!buildingFasciaGeometry(old).enabled&&sameLines&&sameFaces&&sameBounds});
      } else {
        if(!check.checked) check.click();
        rows.push({kind,ok:visible&&rowVisible&&obOf(parent.id)?.facadeEnabled===true});
      }
    }
    return rows;
  });
  const cr=await page.evaluate(()=>{
    S.length=0;clearSelection();window.__add('cornerCutStackedBuilding',1);const o=S.find(s=>s.ob?.asset==='cornerCutStackedBuilding').ob;
    setOb(o.id,{ca:0,cb:0,lift:0});regenObjects();sel=o.id;tool='edit';setMode('draw');cityStandardView('home');render();
    const actual=obOf(o.id),h=stackedBuildingGizmo(actual)?.handles?.height,cv=document.querySelector('canvas'),rc=cv.getBoundingClientRect(),css=cv.width/rc.width;
    return {panel:document.getElementById('stackedP').style.display,corner:document.getElementById('stackCornerControls').style.display,
      h:h?.s?.ok?{x:rc.x+h.s.x/css,y:rc.y+h.s.y/css,dx:h.dir.x*20,dy:h.dir.y*20,hit:(hitGizmo({x:h.s.x,y:h.s.y})||{}).t}:null,before:o.floors[0].h};
  });
  await page.evaluate(()=>document.getElementById('stackOpening').click());
  cr.open=await page.evaluate(()=>stackedOpeningEnabled(S.find(s=>s.ob?.asset==='cornerCutStackedBuilding').ob));
  await page.evaluate(()=>document.getElementById('stackOpening').click());
  cr.closed=await page.evaluate(()=>!stackedOpeningEnabled(S.find(s=>s.ob?.asset==='cornerCutStackedBuilding').ob));
  if(cr.h){await page.mouse.move(cr.h.x,cr.h.y);await page.mouse.down();await page.mouse.move(cr.h.x+cr.h.dx,cr.h.y+cr.h.dy,{steps:4});await page.mouse.up();}
  cr.after=await page.evaluate(()=>S.find(s=>s.ob?.asset==='cornerCutStackedBuilding').ob.floors[0].h);
  console.log(JSON.stringify({r,ui,cr,errors}));
  const a=r.facade,c=r.corner;
  if(!(a.onLines>a.offLines&&a.onFaces===a.offFaces+12&&a.wrapFaces===a.offFaces+36&&a.colorCount===36&&a.wrapBounds.lo[0]<a.bounds.lo[0]&&a.g.enabled&&a.g.z1===4&&a.resized.w===6&&a.resized.z1===6&&a.saved.enabled&&ui.panel!=='none'&&ui.toggled&&ui.sidesAndColor&&ui.linked.every(x=>x.ok)&&c.floors===4&&c.onLines>c.offLines&&c.offRay<.51&&c.onRay>.51&&Math.abs(c.upperOffRay-c.upperOnRay)<1e-4&&c.spins.every(s=>s.off<.51&&s.on>.51)&&c.heightHandle&&c.saved&&cr.panel!=='none'&&cr.corner!=='none'&&cr.open&&cr.closed&&cr.h?.hit==='stacked-height'&&Math.abs(cr.after-cr.before)>.01&&!errors.length)){
    console.error('NG');process.exitCode=1;
  }else console.log('OK: facade toggle/shape; corner-cut opening only at first floor; height drag');
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
