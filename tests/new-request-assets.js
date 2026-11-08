const assert=require('assert');
const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:850});
 await page.evaluate(ADD_FN);
 const rows=await page.evaluate(()=>{
  const out=[];
  for(const kind of ['utilityCabinet','torii','utilityPole','ramenBowl','tLegTable','squareStool','box','counter','counterL','counterU','ufoCatcher','gachaMachine']){
   S.length=0;clearSelection();__add(kind,1);const id=sel,o=obOf(id),base={lines:S.filter(s=>s.ob?.id===id).length,faces:surfaceTriangles(o).length};
   if(kind==='tLegTable'){
    const shapes=['square','circle','racetrack'];
    base.shapes=shapes.map(tableTopShape=>{setOb(id,{tableTopShape,tableTopBevel:.08});regenObjects();return {shape:tableTopShape,lines:S.filter(s=>s.ob?.id===id).length,faces:surfaceTriangles(obOf(id)).length};});
   }
   if(kind==='squareStool'){
    setOb(id,{squareSeatBevel:.05});regenObjects();base.beveled={lines:S.filter(s=>s.ob?.id===id).length,faces:surfaceTriangles(obOf(id)).length,bevel:obOf(id).squareSeatBevel};
   }
   if(['counter','counterL','counterU'].includes(kind)){
    setOb(id,{ctBevel:.045});regenObjects();base.beveled={lines:S.filter(s=>s.ob?.id===id).length,faces:surfaceTriangles(obOf(id)).length,bevel:obOf(id).ctBevel};
   }
   if(kind==='box'){
    setOb(id,{bevelOffset:.18});regenObjects();base.beveled={lines:S.filter(s=>s.ob?.id===id).length,faces:surfaceTriangles(obOf(id)).length,bevel:obOf(id).bevelOffset};
   }
   base.asset=o.asset;out.push(base);
  }
  const table=ASSETS.tLegTable,chair=ASSETS.squareStool,cabinet=ASSETS.utilityCabinet,building=ASSETS.building,torii=ASSETS.torii;
  return {out,tableOptions:table.controls.find(c=>c.key==='tableTopShape')?.options,tableAdjustments:['tableTopWidth','tableTopDepth','tableLegHeight','tableTopThickness'].every(k=>table.controls.some(c=>c.key===k)),chairBevel:chair.controls.some(c=>c.key==='squareSeatBevel'),counterBevel:['counter','counterL','counterU'].every(k=>ASSETS[k].controls.some(c=>c.key==='ctBevel')),transformerLabel:cabinet.label,transformerPanelControls:['transformerPanelWidth','transformerPanelHeight','transformerPanelX','transformerPanelZ'].every(k=>cabinet.controls.some(c=>c.key===k)),f1Label:building.label,f1Toggles:['openingEnabled','f1AwningEnabled','f1SignEnabled','wallSideSignEnabled','facadeEnabled'].every(k=>building.controls.some(c=>c.key===k)&&!building.controls.find(c=>c.key===k)?.canvasToggle),facadeSidesCanvasToggle:building.controls.some(c=>c.key==='facadeSides'&&c.canvasToggle===true),cornerBoxBevel:ASSETS.cornerCutBox.controls.some(c=>c.key==='bevelOffset'&&c.canvasSlider===true),cornerBoxFacadeToggle:ASSETS.cornerCutBox.controls.some(c=>c.key==='facadeSides'&&c.canvasToggle===true),f1Bevel:building.controls.some(c=>c.key==='bevelOffset'&&c.canvasSlider===true),toriiControls:['toriiPostHeight','toriiPostThickness','toriiPlaqueWidth','toriiPlaqueHeight'].every(k=>torii.controls.some(c=>c.key===k&&c.canvasSlider===true)),oldBuildingCardsHidden:!['buildingAwning','buildingAwningOpen','buildingSign'].some(k=>document.querySelector(`.assetCard[data-asset="${k}"]`)&&!document.querySelector(`.assetCard[data-asset="${k}"]`).hidden),bevelBuilding:ASSETS.stackedBuilding.controls.some(c=>c.key==='bevelOffset'),legacyOldGroup:(()=>{const gs=window.cityGridAssetGroups();return gs.at(-1)?.key==='old'&&['beveledStackedBuilding','beveledBox'].every(k=>gs.at(-1).kinds.includes(k));})()};
 });
 for(const row of rows.out){assert(row.lines>0,`${row.asset} lines missing`);assert(row.faces>0,`${row.asset} faces missing`);}
 const table=rows.out.find(x=>x.asset==='tLegTable');
 assert.deepStrictEqual(table.shapes.map(x=>x.shape),['square','circle','racetrack']);
 assert(table.shapes.every(x=>x.lines>0&&x.faces>0),'table shape failed');
 assert.deepStrictEqual(rows.tableOptions.map(o=>o.value),['square','circle','racetrack']);
 assert(rows.chairBevel,'square chair bevel control missing');
 assert(rows.tableAdjustments,'T-table adjustable controls missing');
 assert(rows.counterBevel,'counter bevel controls missing');
 assert.strictEqual(rows.transformerLabel,'変圧器');
 assert(rows.transformerPanelControls,'transformer inner-panel controls missing');
 assert.strictEqual(rows.f1Label,'F1建物');
 assert(rows.f1Toggles,'F1 optional feature controls must be routed through child objects, not canvas toggles');
 assert(rows.facadeSidesCanvasToggle&&rows.cornerBoxFacadeToggle,'facade side checkbox should also be available in the upper canvas UI');
 assert(rows.cornerBoxBevel,'corner-cut box Z-edge bevel control missing');
 assert(rows.f1Bevel,'F1 Z-edge bevel slider missing');
 assert(rows.toriiControls,'torii post height/thickness canvas controls missing');
 assert(rows.oldBuildingCardsHidden,'legacy building variants remain in the asset tray');
 for(const kind of ['counter','counterL','counterU'])assert(rows.out.find(x=>x.asset===kind).beveled.faces>0,`${kind} bevel geometry missing`);
 assert(rows.bevelBuilding,'unified stacked-building bevel control missing');
 assert(rows.legacyOldGroup,'legacy bevel variants should be kept together in the final 旧 category');
 assert.strictEqual(errors.length,0,JSON.stringify(errors));
 console.log(JSON.stringify(rows));
 console.log('OK: requested assets, furniture placement, table shapes, bevel controls');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
