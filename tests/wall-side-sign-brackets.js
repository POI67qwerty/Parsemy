const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:800});
 await page.evaluate(ADD_FN);
 const result=await page.evaluate(()=>{
  S.length=0;clearSelection();__add('building',1);const id=sel;
  cityGridWallSideSignToggle(id,true,1,2,.36,'beveled',.2,'first',null,.1);
  const sign=sceneObjects().find(o=>o.asset==='wallSideSign');
  const beforeLines=S.filter(s=>s.ob?.id===sign.id).map(s=>s.p.map(p=>p.map(v=>+v.toFixed(5))));
  const panelInputs=['wallSideSignBracketLength','wallSideSignBracketThickness'].map(id=>({id,label:document.querySelector(`label:has(#${id}) span`)?.textContent}));
  document.getElementById('wallSideSignBracketLength').value='0.72';document.getElementById('wallSideSignBracketLength').dispatchEvent(new Event('change',{bubbles:true}));
  document.getElementById('wallSideSignBracketThickness').value='0.2';document.getElementById('wallSideSignBracketThickness').dispatchEvent(new Event('change',{bubbles:true}));
  const updated=sceneObjects().find(o=>o.asset==='wallSideSign');
  return {panelInputs,values:[updated.wallSideSignBracketLength,updated.wallSideSignBracketThickness],labelsOk:panelInputs.every(x=>x.label&&x.label.includes('金具')),expected:true};
 });
 console.log(JSON.stringify({result,errors}));
 if(errors.length||!result.labelsOk||result.values[0]<.719||result.values[1]<.199)process.exitCode=1;
 else console.log('OK: 横壁看板の金具に日本語の長さ・太さ設定があり、値を保存');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
