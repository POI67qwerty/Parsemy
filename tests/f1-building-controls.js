const assert=require('assert');
const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:850});
 await page.evaluate(ADD_FN);
 const result=await page.evaluate(()=>{
  S.length=0;clearSelection();__add('building',1);const id=sel;
  const sample=()=>{regenObjects();return {lines:S.filter(s=>s.ob?.id===id),faces:surfaceTriangles(obOf(id)).length};};
  const base=sample();setOb(id,{f1AwningEnabled:true});const awning=sample();
  setOb(id,{f1SignEnabled:true});const sign=sample();
  setOb(id,{bevelOffset:.08});const bevel=sample();
  setOb(id,{openingEnabled:false});const closed=sample();
  setOb(id,{openingEnabled:false,f1AwningEnabled:true,f1SignEnabled:true,wallSideSignEnabled:false,facadeEnabled:true,facadeSides:true,bevelOffset:0});
  const sideCheck=document.getElementById('wallSideSign');if(sideCheck){sideCheck.checked=true;sideCheck.dispatchEvent(new Event('change',{bubbles:true}));}
  render();
  const canvasUiKeys=[...document.querySelectorAll('#canvasAssetControl input[data-asset-toggle]')].map(e=>e.dataset.assetToggle);
  const clicked={opening:obOf(id).openingEnabled,awning:obOf(id).f1AwningEnabled,sign:obOf(id).f1SignEnabled,facade:obOf(id).facadeEnabled,sides:obOf(id).facadeSides,wallSide:obOf(id).wallSideSignEnabled,attached:[...new Map(S.filter(s=>s.ob?.attachment?.wallSideSign).map(s=>[s.ob.id,s.ob])).values()].length};
  const controls=ASSETS.building.controls;
  const tog=['openingEnabled','f1AwningEnabled','f1SignEnabled','wallSideSignEnabled','facadeEnabled','facadeSides'];
  const canvasToggleKeys=controls.filter(c=>c.canvasToggle).map(c=>c.key);
  const precision={};
  for(const kind of ['utilityCabinet','torii','utilityPole','ramenBowl']){
   S.length=0;clearSelection();__add(kind,1);const oid=sel,lines=S.filter(s=>s.ob?.id===oid);
   precision[kind]={total:lines.length,precise:lines.filter(s=>s.preciseTubeEdge).length,zSideCandidates:lines.filter(s=>s.preciseTubeEdge&&s.p.length>2).length};
  }
  return {label:ASSETS.building.label,base:{lines:base.lines.length,faces:base.faces},awning:{lines:awning.lines.length,faces:awning.faces},sign:{lines:sign.lines.length,faces:sign.faces},bevel:{lines:bevel.lines.length,faces:bevel.faces},closed:{lines:closed.lines.length,faces:closed.faces},canvasToggleKeys,canvasUiKeys,clicked,precision,oldCards:['buildingAwning','buildingAwningOpen','buildingSign'].some(k=>document.querySelector(`.assetCard[data-asset="${k}"]`)&&!document.querySelector(`.assetCard[data-asset="${k}"]`).hidden)};
 });
 await page.evaluate(()=>{S.length=0;clearSelection();__add('torii',1);render();});
 const toriiHeightSlider=page.locator('#canvasAssetControl input[data-asset-control="toriiPostHeight"]');
 const toriiSliderVisible=await toriiHeightSlider.count();
 const toriiBefore=await page.evaluate(()=>Number(obOf(sel).toriiPostHeight));
 if(toriiSliderVisible){await toriiHeightSlider.focus();await toriiHeightSlider.press('ArrowRight');}
 const toriiAfter=await page.evaluate(()=>Number(obOf(sel).toriiPostHeight));
 assert.strictEqual(result.label,'F1建物');
 assert.deepStrictEqual(result.canvasToggleKeys,[],'F1 feature checkboxes must be removed from the top canvas controls');
 assert.deepStrictEqual(result.canvasUiKeys,[],'F1 optional features must be controlled from their child rows, not the canvas checkbox strip');
 assert(result.awning.lines>result.base.lines&&result.awning.faces>result.base.faces,'awning checkbox did not add geometry');
 assert(result.sign.lines>result.awning.lines&&result.sign.faces>result.awning.faces,'sign checkbox did not add geometry');
 assert(result.bevel.lines>result.sign.lines&&result.bevel.faces>result.sign.faces,'building bevel did not add Z-edge geometry');
 assert(!result.oldCards,'legacy building variants remain in the palette');
 assert.deepStrictEqual(result.clicked,{opening:false,awning:true,sign:true,facade:true,sides:true,wallSide:true,attached:1},'canvas checkboxes did not apply F1 options');
 assert.strictEqual(toriiSliderVisible,1,'torii pillar height slider is not shown on the canvas');
 assert(toriiAfter>toriiBefore,'torii canvas height slider did not change the pillar');
 for(const kind of ['torii','utilityPole','ramenBowl'])assert(result.precision[kind].precise>0,`${kind}: no precise cylinder hidden-line edges`);
 assert.strictEqual(errors.length,0,JSON.stringify(errors));
 console.log(JSON.stringify(result));
 console.log('OK: F1 building options, bevel, and cylinder hidden-line candidates');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
