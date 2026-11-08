/* 魚眼のBVH高速化と、全三角面を走査する基準方式の全線画素を比較。 */
const {open,ADD_FN}=require('./lib');
(async()=>{const{browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);
 const rows=await page.evaluate(()=>{
  S.length=0;clearSelection();for(const [kind,x,z,lift] of [['box',-3,0,6],['balcony',2,1,8],['building',0,3,4],['railing',-1,-2,7]]){__add(kind,1);setOb(sel,{ca:x,cb:z,lift,rot:25});}regenObjects();sel=null;tool='view';P.surfaceMode=true;cityStandardView('home');T='f';Object.assign(P,{cx:5,cz:-14,ch:1.5,yaw:20,pitch:30});CAMKEY=null;sync();regenObjects();window.__noLineCache=true;
  const original=prepareFishLineOccluders;prepareFishLineOccluders=function(){original();if(window.__testFishBrute&&fishBvhCache?.records.length)fishLineOccluders.root={lo:[-Infinity,-Infinity,-Infinity],hi:[Infinity,Infinity,Infinity],items:fishBvhCache.records};};
  const results=[];for(const fov of [110,270])for(const roll of [0,35])for(const bin of [true,false]){
   Object.assign(P,{fov,roll});CAMKEY=null;document.getElementById('bin').checked=bin;sync();regenObjects();
   const compare=(tf,cw,ch)=>{window.__testFishBrute=false;let fast=lineLayer(false,false,cw,ch,tf,true).getContext('2d').getImageData(0,0,cw,ch).data,copy=new Uint8ClampedArray(fast);window.__testFishBrute=true;let slow=lineLayer(false,false,cw,ch,tf,true).getContext('2d').getImageData(0,0,cw,ch).data;let diff=0,ink=0;for(let i=0;i<slow.length;i+=4){if(slow[i+3])ink++;if(copy[i]!==slow[i]||copy[i+1]!==slow[i+1]||copy[i+2]!==slow[i+2]||copy[i+3]!==slow[i+3])diff++;}return {diff,ink};};
   results.push({fov,roll,bin,screen:compare([Z,0,0,Z,...viewShift()],W,H),export:compare([0.5,0,0,0.5,0,0],900,700)});
  }window.__testFishBrute=false;prepareFishLineOccluders=original;return results;
 });console.log(JSON.stringify({rows,errors}));if(errors.length||rows.length!==8||rows.some(r=>r.screen.diff||r.export.diff||!r.screen.ink||!r.export.ink))process.exitCode=1;else console.log('OK: BVHと全三角面走査のRGBA一致、魚眼8設定×画面／出力');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
