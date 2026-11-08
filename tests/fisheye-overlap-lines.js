/* 遮蔽された背後線の二値化マスクが、同じ位置の手前の可視線を消さないこと。 */
const{open}=require('./lib');
(async()=>{const{browser,page,errors}=await open({width:1200,height:800});
 const rows=await page.evaluate(()=>{
  const original=surfaceTriangles,front={id:'front',visible:true},rear={id:'rear',visible:true},a=[-5,-5,5],b=[5,-5,5],c=[5,5,5],d=[-5,5,5];surfaceTriangles=o=>o.id==='front'?[[a,b,c],[a,c,d]]:o.id==='rear'?[]:original(o);
  S.length=0;clearSelection();sel=null;tool='view';cityStandardView('home');orthView=null;T='f';P.surfaceMode=true;Object.assign(P,{cx:0,cz:0,ch:1,yaw:0,pitch:0,fov:180});CAMKEY=null;sync();window.__noLineCache=true;document.getElementById('bin').checked=true;
  const results=[];for(const roll of [0,13,37])for(const slope of [.1,.45,1])for(const offset of [0,.017,.039]){
   P.roll=roll;CAMKEY=null;const p=[[-1,-slope+offset,10],[1,slope+offset,10]],f=p.map(v=>v.map(n=>n*.49));const fg={ob:front,d3:true,onFace:true,p:f,c:'#000',w:1},bg={ob:rear,d3:true,p,c:'#000',w:1};front.token=roll+':'+slope+':'+offset;const tf=[1,0,0,1,0,0];
   S.length=0;S.push(fg);let im=lineLayer(false,false,W,H,tf,true).getContext('2d').getImageData(0,0,W,H).data,base=new Uint8ClampedArray(im);S.push(bg);im=lineLayer(false,false,W,H,tf,true).getContext('2d').getImageData(0,0,W,H).data;let lost=0,added=0,ink=0;for(let i=3;i<im.length;i+=4){if(base[i])ink++;if(base[i]&&!im[i])lost++;if(!base[i]&&im[i])added++;}results.push({roll,slope,offset,lost,added,ink});
  }surfaceTriangles=original;return results;
 });const bad=rows.filter(r=>r.lost||r.added||!r.ink);console.log(JSON.stringify({cases:rows.length,bad,errors}));if(bad.length||errors.length)process.exitCode=1;else console.log('OK: 被遮蔽線と重なる手前線の全画素一致、27条件');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
