// 電車の窓・左右扉窓について、開口と枠の輪郭、ベベル直方体の線候補、重複を確認。
const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open();await page.evaluate(ADD_FN);
 const rows=await page.evaluate(()=>{
  const near=(a,b)=>Math.abs(a-b)<1e-7;
  const eq=(a,b)=>a.length===b.length&&a.every((p,i)=>p.every((v,j)=>near(v,b[i][j])));
  const path=(w,h,r,x,z)=>{const s=Math.max(1,.02/Math.min(w,h));return beveledBoxFootprint(w*s,h*s,r*s,4).map(([u,v])=>[x+u/s,z+v/s]);};
  const result=[];
  for(const kind of ['trainWindowWall','trainSlidingDoor'])for(const cfg of [0,1,2])for(const k of [0,1,2])for(const rot of [0,37]){
   S.length=0;clearSelection();__add(kind,1);const id=sel;
   let patch={ca:0,cb:0,lift:0,k,rot};
   if(kind==='trainWindowWall'&&cfg===1)Object.assign(patch,{trainWindowWidth:.43,trainWindowHeight:.31,trainWindowBottom:.4});
   if(kind==='trainWindowWall'&&cfg===2)Object.assign(patch,{ra:1.6,h:3,trainWindowWidth:2.5,trainWindowHeight:1.8,trainWindowBottom:.4});
   if(kind==='trainSlidingDoor'&&cfg===1)Object.assign(patch,{trainDoorWindowWidth:.32,trainDoorWindowHeight:.7,trainDoorGap:.3});
   if(kind==='trainSlidingDoor'&&cfg===2)Object.assign(patch,{trainDoorWindowWidth:.002,trainDoorWindowHeight:.04,trainDoorGap:1.1});
   setOb(id,patch);const o=obOf(id),lines=[];ASSET_LINE_BUILDERS[kind]({o,c:o.c,out:lines});
   const loop=(p,y)=>lineA(o,[...p,p[0]].map(([x,z])=>[x,y,z])).p,
    seg=(p,a,b)=>lineA(o,[[p[0],a,p[1]],[p[0],b,p[1]]]).p,
    exact=(p)=>lines.filter(l=>!l.seam&&eq(l.p,p)).length;
   let windows=[];
   if(kind==='trainWindowWall'){
    const w=Math.max(.5,2*Math.abs(o.ra)),d=Math.max(.05,2*Math.abs(o.rb)),h=Math.max(.6,o.h),v=(key,def,lo,hi)=>clamp(o[key]!=null&&Number.isFinite(Number(o[key]))?Number(o[key]):def,lo,Math.max(lo,hi)),ww=v('trainWindowWidth',1.35,.2,w-.16),wh=v('trainWindowHeight',.9,.2,h-.16),z=v('trainWindowBottom',1,.08,h-wh-.08),t=Math.min(.035,ww*.08,wh*.08),r=Math.min(.09,ww*.15,wh*.15);
    windows.push({w:ww,h:wh,x:0,z:z+wh/2,t,r,y:-d/2,back:d/2,front:-d/2-.012,group:'train-wall'});
   }else{
    const w=Math.max(.5,2*Math.abs(o.ra)),h=Math.max(.7,o.h),d=Math.max(.05,2*Math.abs(o.rb)),f=Math.min(.08,w*.1,h*.1),gap=clamp(Number(o.trainDoorGap)||0,0,w-2*f-.02),leaf=(w-2*f-gap)/2,ctrl=assetEditorControls(o),ww=assetControlValue(o,ctrl.find(c=>c.key==='trainDoorWindowWidth')),wh=assetControlValue(o,ctrl.find(c=>c.key==='trainDoorWindowHeight')),dy=d*.32,r=Math.min(.07,ww*.18,wh*.18),t=Math.min(.025,ww*.10,wh*.10);
    for(const s of [-1,1])windows.push({w:ww,h:wh,x:s*(gap/2+leaf/2),z:h*.57,t,r,y:-dy,back:dy,front:-dy-.008,group:s<0?'train-door-left':'train-door-right'});
   }
   let checks=[];
   for(const q of windows){
    const outer=path(q.w,q.h,q.r,q.x,q.z),ir=Math.max(.000001,q.r-q.t),inner=path(q.w-2*q.t,q.h-2*q.t,ir,q.x,q.z);
    // 各輪郭は1本ずつ。枠の後端外周は壁の穴と同一のため別途追加しない。
    const loops=[exact(loop(outer,q.y)),exact(loop(outer,q.back)),exact(loop(outer,q.front)),exact(loop(inner,q.front)),exact(loop(inner,q.y))];
    const sets=[[q.group+'-hole',outer,q.r,q.y,q.back],[q.group+'-frame-outer',outer,q.r,q.front,q.y],[q.group+'-frame-inner',inner,ir,q.front,q.y]];
    let seams=sets.map(([name,p,r,a,b])=>{
     const candidates=lines.filter(l=>typeof l.seam==='string'&&l.seam.startsWith(name+':'));
     return candidates.length===20&&p.every((v,i)=>{const mark=beveledEdgeMark(i,r,4,name),found=candidates.filter(l=>eq(l.p,seg(v,a,b)));return found.length===1&&found[0].seam===mark.key&&found[0].seamApex===mark.apex;})&&candidates.filter(l=>l.seamApex).length===4;
    });
    checks.push({loops,seams,ok:loops.every(n=>n===1)&&seams.every(Boolean)});
   }
   result.push({kind,cfg,k,rot,checks,ok:checks.every(c=>c.ok)});
  }return result;
 });
 const bad=rows.filter(x=>!x.ok);console.log(JSON.stringify({cases:rows.length,bad,errors}));
 if(bad.length||errors.length)process.exitCode=1;else console.log('OK: 開口と枠の輪郭が一致し、重複なし・ベベル直方体と同じ線候補');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
