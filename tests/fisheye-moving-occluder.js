/* 魚眼の見上げ・前景遮蔽物・投影キャッシュ再利用・出力変換の回帰。 */
const{open,ADD_FN}=require('./lib');const{PROBE}=require('./hidden-lines');
(async()=>{const{browser,page,errors}=await open({width:1200,height:800});await page.evaluate(ADD_FN);await page.evaluate(PROBE);
 const rows=await page.evaluate(()=>{
  __hlInstall();window.__noLineCache=true;S.length=0;clearSelection();__add('box',1);const target=sel;setOb(target,{ca:0,cb:0,lift:11,ra:2,rb:1,h:3});__add('box',1);const block=sel;setOb(block,{ca:10,cb:-5,lift:5,ra:.2,rb:.2,h:.8});regenObjects();sel=null;tool='view';P.surfaceMode=true;cityStandardView('home');Object.assign(P,{cx:0,cz:-12,ch:1.5,yaw:0,pitch:40,fov:110});T='f';CAMKEY=null;sync();regenObjects();
  const o=obOf(target),points=[-1.5,-1,-.5,0,.5,1,1.5].map(x=>pt(o,x,-1,0)),p=points[3],cam=camPos(),center=p.map((v,i)=>v+(cam[i]-v)*.4),results=[];
  for(const bin of [true,false])for(const zoom of [1,1.5])for(const halfWidth of [.14,.23,.32]){
   document.getElementById('bin').checked=bin;Z=zoom;ox=zoom===1?0:45;oy=zoom===1?0:-31;setOb(block,{ca:10,ra:halfWidth,rb:.23});render();
   const s=S.find(s=>s.ob?.id===target),tf=[Z,0,0,Z,...viewShift()];
   function snap(exporting=false){const si=S.indexOf(s);__hlIdx.set(s,si);__hlOnly=si;render();let canvas=LC,trans=tf;if(exporting){trans=[1.3,0,0,1.3,-120,-50];canvas=lineLayer(false,false,W,H,trans,true);}const im=canvas.getContext('2d').getImageData(0,0,W,H).data;return points.map(p=>{const q=projPoint(p,trans),x=Math.round(q.x),y=Math.round(q.y);let ink=false;if(q.ok&&x>=1&&y>=1&&x<W-1&&y<H-1)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(im[((y+dy)*W+x+dx)*4+3]>100)ink=true;return ink;});}
   const before=snap(),projected=projPtsFor(s,tf)[0];setOb(block,{ca:center[0],cb:center[2],lift:center[1]+1-.4,ra:halfWidth,rb:.23,h:.8});const after=snap(),sameLine=S.includes(s),sameProjection=projPtsFor(s,tf)[0]===projected,exported=snap(true);setOb(block,{visible:false});const hidden=snap();setOb(block,{visible:true});const shown=snap();setOb(block,{ca:10});const restored=snap();__hlOnly=null;
   results.push({bin,zoom,halfWidth,before,after,hidden,shown,restored,exported,sameLine,sameProjection});
  }return results;
 });const bad=rows.filter(r=>r.before.some(v=>!v)||r.after[3]||!r.after[0]||!r.after[6]||r.restored.some(v=>!v)||r.hidden.some(v=>!v)||r.shown[3]||r.exported[3]||!r.exported[0]||!r.exported[6]||!r.sameLine||!r.sameProjection);
 console.log(JSON.stringify({cases:rows.length,bad,errors}));if(rows.length!==12||bad.length||errors.length)process.exitCode=1;else console.log('OK: 前景遮蔽の移動・復帰、投影キャッシュ、二値ON/OFF・ズーム・出力変換');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
