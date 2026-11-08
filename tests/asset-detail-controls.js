const assert=require('assert');
const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:850});await page.evaluate(ADD_FN);
 const result=await page.evaluate(()=>{
  const set=(o,id,next)=>{const item=CityCanvasControls.list(o).find(x=>x.id===id);if(!item)return false;return CityCanvasControls.apply(o,item,next);};
  S.length=0;clearSelection();__add('torii',1);let id=sel,o=obOf(id);
  const initialY=Math.max(...S.filter(s=>s.ob?.id===id).flatMap(s=>s.p||[]).map(p=>p[1])),initialPostH=o.toriiPostHeight;
  const plaqueControls=CityCanvasControls.list(o).map(x=>x.id).filter(x=>x.includes('toriiPlaque'));
  set(o,'param:toriiPostHeight',2.15);const movedY=Math.max(...S.filter(s=>s.ob?.id===id).flatMap(s=>s.p||[]).map(p=>p[1]));
  set(o,'param:toriiPlaqueWidth',.65);set(o,'param:toriiPlaqueHeight',.42);
  const torii={initialY,movedY,initialPostH,headOffsetBefore:initialY-initialPostH,headOffsetAfter:movedY-2.15,plaqueWidth:obOf(id).toriiPlaqueWidth,plaqueHeight:obOf(id).toriiPlaqueHeight,plaqueControls};
  S.length=0;clearSelection();__add('utilityPole',1);id=sel;o=obOf(id);
  const poleControls=CityCanvasControls.list(o).map(x=>x.id),transformerBefore=CityCanvasControls.list(o).find(x=>x.id==='param:transformerZ')?.value,transformerGizmo=specialGizmo(o)?.registeredHandles?.find(x=>x.paramKey==='transformerZ')?.gizmoMode;
  const transformerApplied=set(o,'param:transformerZ',o.h*.62);set(o,'param:poleDiameter',.27);
  const pole={transformerBefore,transformerZ:obOf(id).transformerZ,transformerApplied,transformerGizmo,poleDiameter:obOf(id).poleDiameter,controls:poleControls};
  S.length=0;clearSelection();__add('securityCamera',1);id=sel;o=obOf(id);
  const hoodControls=CityCanvasControls.list(o).map(x=>x.id),before=CityCanvasControls.list(o).find(x=>x.id==='param:cameraHoodTilt');
  const applied=['cameraHoodTilt','cameraHoodFrameLength','cameraHoodBrimLength','cameraHoodThickness'].map((key,i)=>{
    const item=CityCanvasControls.list(o).find(x=>x.id==='param:'+key);if(!item)return false;
    return CityCanvasControls.apply(o,item,Math.min(item.max,Math.max(item.min,item.value+(i%2?-.01:.01))));
  });
  const camera={controls:hoodControls,values:['cameraHoodTilt','cameraHoodFrameLength','cameraHoodBrimLength','cameraHoodThickness'].map(k=>obOf(id)[k]),applied};
  S.length=0;clearSelection();__add('corrugatedRoof',1);id=sel;o=obOf(id);
  const roofItems=CityCanvasControls.list(o),roofControls=roofItems.map(x=>x.id),roofApplied=['roofWaveCount','roofSheetThickness'].map((key,i)=>{const item=CityCanvasControls.list(obOf(id)).find(x=>x.id==='param:'+key);return !!item&&CityCanvasControls.apply(obOf(id),item,i===0?12:item.value+.01);});
  const roof={controls:roofControls,values:[obOf(id).roofWaveCount,obOf(id).roofSheetThickness],applied:roofApplied};
  S.length=0;clearSelection();__add('tLegTable',1);id=sel;o=obOf(id);
  const legItem=CityCanvasControls.list(o).find(x=>x.id==='param:tableLegHeight'),legGizmo=specialGizmo(o)?.registeredHandles?.find(x=>x.paramKey==='tableLegHeight')?.gizmoMode,legBefore=legItem?.value,legApplied=legItem&&CityCanvasControls.apply(o,legItem,Math.min(legItem.max,legBefore+.18)),legAfter=Number(obOf(id).tableLegHeight),heightAfter=obOf(id).h;
  const legGeometry=()=>JSON.stringify(S.filter(s=>s.ob?.id===id).slice(-12).map(s=>s.p)),legsBeforeWidth=legGeometry(),
      widthItem=CityCanvasControls.list(obOf(id)).find(x=>x.id==='param:tableTopWidth'),widthBefore=widthItem?.value,widthApplied=widthItem&&CityCanvasControls.apply(obOf(id),widthItem,3),widthAfter=2*obOf(id).ra,legsAfterWidth=legGeometry(),
      footItem=CityCanvasControls.list(obOf(id)).find(x=>x.id==='param:tableFootLength'),footApplied=footItem&&CityCanvasControls.apply(obOf(id),footItem,.42),footAfter=obOf(id).tableFootLength,
      edgeLengths=()=>S.filter(s=>s.ob?.id===id).flatMap(s=>s.p?.slice(1).map((p,i)=>Math.hypot(p[0]-s.p[i][0],p[1]-s.p[i][1],p[2]-s.p[i][2]))||[]),
      legThicknessPresent=edgeLengths().some(v=>Math.abs(v-.055)<.0002);
  const table={legBefore,legAfter,heightAfter,legApplied,legGizmo,widthBefore,widthAfter,widthApplied,legsFixed:legsBeforeWidth===legsAfterWidth,footApplied,footAfter,legThicknessPresent};
  return {torii,pole,camera,roof,table};
 });
 assert(result.torii.movedY<result.torii.initialY-.1,'torii upper ornaments did not follow a lowered post height');
 assert(Math.abs(result.torii.headOffsetAfter-result.torii.headOffsetBefore)<.03,'torii upper assembly was scaled instead of following the pillar top');
 assert(result.torii.plaqueControls.includes('param:toriiPlaqueWidth')&&result.torii.plaqueControls.includes('param:toriiPlaqueHeight'),'torii plaque dimensions are not editable');
 assert(result.torii.plaqueWidth>0&&result.torii.plaqueHeight>0,'torii plaque dimensions did not apply');
 assert(result.pole.controls.includes('param:transformerZ')&&result.pole.controls.includes('param:poleDiameter'),'utility pole controls missing');
 assert(result.pole.transformerApplied&&result.pole.transformerZ>result.pole.transformerBefore,'utility transformer vertical control did not move the transformer');
 assert.strictEqual(result.pole.transformerGizmo,'moveZ','transformer vertical control should use a move-gizmo arrow');
 assert(result.pole.poleDiameter>0,'utility pole diameter control did not apply');
 for(const key of ['param:cameraHoodTilt','param:cameraHoodFrameLength','param:cameraHoodBrimLength','param:cameraHoodThickness'])assert(result.camera.controls.includes(key),`camera hood control missing: ${key}`);
 assert(result.camera.applied.every(Boolean),'camera hood control did not apply');
 for(const key of ['param:roofWaveCount','param:roofSheetThickness'])assert(result.roof.controls.includes(key),`corrugated-roof canvas control missing: ${key}`);
 assert(result.roof.applied.every(Boolean),'corrugated roof canvas control did not apply');
 assert(result.table.legApplied&&result.table.legAfter>result.table.legBefore&&result.table.heightAfter>result.table.legAfter,'table leg-height control did not raise the table');
 assert.strictEqual(result.table.legGizmo,'moveZ','table leg-height should use the move-gizmo arrow');
 assert(result.table.widthApplied&&result.table.widthAfter>result.table.widthBefore&&result.table.legThicknessPresent,'table top width edit stretched the legs instead of keeping their cross-section');
 assert(result.table.legsFixed,'changing table top width moved or resized the leg assembly');
 assert(result.table.footApplied&&Math.abs(result.table.footAfter-.42)<1e-8,'table crossbar length adjustment did not apply');
 assert.strictEqual(errors.length,0,JSON.stringify(errors));
 console.log(JSON.stringify(result));console.log('OK: torii upper assembly/plaque, pole transformer/diameter, reusable camera hood and tin-roof controls');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
