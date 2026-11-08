/* UIから5点・6点魚眼へ切り替え、通常透視へ戻す。 */
const{open,ADD_FN}=require('./lib');
(async()=>{const{browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);
 const rows=await page.evaluate(()=>{S.length=0;clearSelection();__add('box',1);sel=null;tool='view';P.surfaceMode=true;regenObjects();window.__noLineCache=true;const out=[];for(const mode of [5,6,2,5]){const input=document.getElementById('gt');input.value=String(mode);input.dispatchEvent(new Event('change',{bubbles:true}));render();const d=LC.getContext('2d').getImageData(0,0,W,H).data;let ink=0;for(let i=3;i<d.length;i+=4)if(d[i]>120)ink++;out.push({mode,T,fov:P.fov,ink,fishActive:!!fishLineOccluders,orth:orthView});}return out;});
 const bad=rows.filter(r=>!r.ink||r.orth||r.T!==(r.mode>=5?'f':'r')||r.fishActive!==(r.mode>=5)||r.mode===5&&r.fov!==180||r.mode===6&&r.fov!==270);console.log(JSON.stringify({rows,bad,errors}));if(bad.length||errors.length)process.exitCode=1;else console.log('OK: 5点・6点魚眼と通常透視の実UI切替');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
