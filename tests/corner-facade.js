/* 隅切り直方体のファサード・棚・旧データ・接続建物の除外。 */
const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open({width:1400,height:900});await page.evaluate(ADD_FN);
 const r=await page.evaluate(()=>{
   const groups=window.cityGridAssetGroups(),inBuilding=groups.find(g=>g.key==='building').kinds.includes('cornerCutBox'),inPrimitive=groups.find(g=>g.key==='primitive').kinds.includes('cornerCutBox');
   S.length=0;clearSelection();window.__add('cornerCutBox',1);let original=S.find(s=>s.ob?.asset==='cornerCutBox').ob;
   setOb(original.id,{ca:0,cb:0,lift:0,rot:0,cornerCutOpeningEnabled:true});regenObjects();sel=original.id;tool='edit';setMode('draw');cityStandardView('home');sync();render();original=obOf(original.id);
   const flags={inBuilding,inPrimitive,enabled:buildingFasciaGeometry(original).enabled,panel:document.getElementById('cornerCutP').style.display,controls:document.getElementById('cornerFacadeControls').style.display};
   const cases=[];
   for(const corner of ['front-left','front-right','back-left','back-right'])for(const rot of [0,45,90])for(const side of [false,true]){
      const dims=rot===0?{ra:2,rb:1.5,h:4,cornerOffset:.8}:rot===45?{ra:.25,rb:.3,h:.55,cornerOffset:.15}:{ra:3,rb:2,h:6,cornerOffset:1.2},
        o=normalizedAsset({...original,...dims,rot,cornerCutCorner:corner,facadeEnabled:true,facadeSides:side,facadeProjection:.2,facadeHeight:.7,facadeColor:'#1234ab'}),
        off={...o,facadeEnabled:false}, f=cornerCutFasciaParts(o), onT=surfaceTriangles(o),offT=surfaceTriangles(off),
        distances=f.parts.map(([a,b,c,d])=>{
           const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),dist=p=>Math.abs(dx*(p[1]-a[1])-dy*(p[0]-a[0]))/len;
           return [dist(c),dist(d)];
        }),
        openOn=cornerCutOpeningParams(o),openOff=cornerCutOpeningParams(off),
        sameOpening=JSON.stringify(openOn)===JSON.stringify(openOff),
        sameLocalSize=f.g.w===2*o.ra&&f.g.d===2*o.rb&&f.g.z1===o.h,
        colors=onT.filter(t=>t.surfaceColor==='#1234ab').length,
        lineExtra=genShape(o).length-genShape(off).length,
        bounds=obBounds(o), pts=onT.flat(),insideBounds=pts.every(v=>v.every((n,i)=>n>=bounds.lo[i]-1e-7&&n<=bounds.hi[i]+1e-7));
      const indices=f.parts.map(part=>f.inner.findIndex(a=>a===part[0]));
      cases.push({corner,rot,side,parts:f.parts.length,indices,distances,sameOpening,sameLocalSize,colors,lineExtra,faceExtra:onT.length-offT.length,insideBounds});
   }
   // 旧データに未設定なら勝手に外観を変更しない。
   const old={...original};delete old.facadeEnabled;const saved=normalizedAsset(JSON.parse(JSON.stringify(old)));
   return {flags,cases,legacyOff:!buildingFasciaGeometry(saved).enabled};
 });
 // 数値・色・左右の回り込み・チェックボックスを実際に切り替える。
 const ui=await page.evaluate(()=>{
   const before=obOf(sel),p=cornerCutOpeningParams(before);
   document.getElementById('cornerFacadeSides').click();
   const color=document.getElementById('cornerFacadeColor');color.value='#1234ab';color.dispatchEvent(new Event('input',{bubbles:true}));
   const height=document.getElementById('cornerFacadeHeight');height.value='0.9';height.dispatchEvent(new Event('input',{bubbles:true}));height.dispatchEvent(new Event('change',{bubbles:true}));
   const out=obOf(sel),g=buildingFasciaGeometry(out),q=cornerCutOpeningParams(out),visibleColor=surfaceTriangles(out).some(t=>t.surfaceColor==='#1234ab'),restored=buildingFasciaGeometry(normalizedAsset(JSON.parse(JSON.stringify(out)))),saved=restored.enabled&&restored.side&&restored.color==='#1234ab'&&Math.abs(restored.height-.9)<1e-8;
   const openingSame=JSON.stringify(p)===JSON.stringify(q);
   document.getElementById('cornerFacadeEnabled').click();const off=!buildingFasciaGeometry(obOf(sel)).enabled;
   document.getElementById('cornerFacadeEnabled').click();const on=buildingFasciaGeometry(obOf(sel)).enabled;
   return {side:g.side,color:g.color,height:g.height,visibleColor,saved,openingSame,off,on};
 });
 const bad=r.cases.filter(x=>x.parts!==(x.side?3:1)||JSON.stringify(x.indices)!==JSON.stringify(x.side?[0,3,4]:[4])||x.distances.some(pair=>pair.some(v=>Math.abs(v-.2)>1e-6))||!x.sameOpening||!x.sameLocalSize||x.colors!==x.parts*12||x.faceExtra!==x.parts*12||x.lineExtra!==x.parts*6||!x.insideBounds);
 console.log(JSON.stringify({flags:r.flags,legacyOff:r.legacyOff,cases:r.cases.length,bad,ui,errors}));
 if(!r.flags.inBuilding||r.flags.inPrimitive||!r.flags.enabled||r.flags.panel==='none'||r.flags.controls==='none'||!r.legacyOff||bad.length||!ui.side||ui.color!=='#1234ab'||Math.abs(ui.height-.9)>1e-8||!ui.visibleColor||!ui.saved||!ui.openingSame||!ui.off||!ui.on||errors.length){console.error('NG');process.exitCode=1;}
 else console.log('OK: corner facade aligned in 24 cases, selectable settings, opening unchanged, shelf and old data');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
