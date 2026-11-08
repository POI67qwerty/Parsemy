/* 隅切り階層の幅・奥行き・高さを開口ONのまま画面ドラッグ。 */
const {open,ADD_FN}=require('./lib');
(async()=>{
  const {browser,page,errors}=await open({width:1400,height:900});await page.evaluate(ADD_FN);
  const names=['widthLeft','widthRight','depthLeft','depthRight','height'], rows=[];
  for(const view of ['home','front','side','top']) for(const name of names){
    const r=await page.evaluate(([view,name])=>{
      S.length=0;clearSelection();window.__add('cornerCutStackedBuilding',1);let o=S.find(s=>s.ob?.asset==='cornerCutStackedBuilding').ob;
      setOb(o.id,{ca:0,cb:0,lift:0,openingEnabled:true});regenObjects();sel=o.id;tool='edit';setMode('draw');cityStandardView(view);sync();CAMKEY=null;render();o=obOf(o.id);
      const sg=specialGizmo(o),h=sg.handles[name],c=document.querySelector('canvas'),rect=c.getBoundingClientRect(),css=c.width/rect.width;
      if(!h?.s?.ok)return {missing:true};
      return {x:rect.x+h.s.x/css,y:rect.y+h.s.y/css,dir:h.dir,hit:(hitGizmo({x:h.s.x,y:h.s.y})||{}).t,
        before:o.floors.map(f=>({x:f.x,y:f.y,z:f.z,w:f.w,d:f.d,h:f.h})),props:{cornerOffset:o.cornerOffset,openingW:o.openingW,openingH:o.openingH,openingBack:o.openingBack}};
    },[view,name]);
    if(!r.missing){
      await page.mouse.move(r.x,r.y);await page.mouse.down();await page.mouse.move(r.x+r.dir.x*16,r.y+r.dir.y*16,{steps:4});await page.mouse.up();
      r.after=await page.evaluate(()=>{const o=obOf(sel);return {floors:o.floors.map(f=>({x:f.x,y:f.y,z:f.z,w:f.w,d:f.d,h:f.h})),props:{cornerOffset:o.cornerOffset,openingW:o.openingW,openingH:o.openingH,openingBack:o.openingBack}}});
      const key=name.startsWith('width')?'w':name.startsWith('depth')?'d':'h';
      const gap=(a,i)=>a[i].z-a[i-1].z-a[i-1].h;
      r.changed=r.after.floors.every((f,i)=>Math.abs(f[key]-r.before[i][key])>.001);
      r.positionsStable=r.after.floors.every((f,i)=>f.x===r.before[i].x&&f.y===r.before[i].y);
      r.otherDimsStable=r.after.floors.every((f,i)=>['w','d','h'].filter(k=>k!==key).every(k=>Math.abs(f[k]-r.before[i][k])<1e-7));
      r.gapsStable=r.after.floors.slice(1).every((f,j)=>Math.abs(gap(r.after.floors,j+1)-gap(r.before,j+1))<1e-7);
      r.propsStable=JSON.stringify(r.after.props)===JSON.stringify(r.props);
      r.expected=name.startsWith('width')?'stacked-width':name.startsWith('depth')?'stacked-depth':'stacked-height';
    }
    rows.push({view,name,...r});
  }
  const bad=rows.filter(r=>r.missing||r.hit!==r.expected||!r.changed||!r.positionsStable||!r.otherDimsStable||!r.gapsStable||!r.propsStable);
  console.log(JSON.stringify(rows.map(({view,name,hit,changed,positionsStable,otherDimsStable,gapsStable,propsStable})=>({view,name,hit,changed,positionsStable,otherDimsStable,gapsStable,propsStable}))));
  if(bad.length||errors.length){console.error('NG',JSON.stringify({bad,errors}));process.exitCode=1;}
  else console.log('OK: 5 size handles × 4 views; floor positions, gap and opening settings preserved');
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
