// 金網フェンスの幾何・角ベベル不変・45°正方形ひし形ピッチ維持・網目数増減・下パイプ高さ・横連結の検証
const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:800});
 await page.evaluate(ADD_FN);
 const res=await page.evaluate(()=>{
  const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;
  const planeRows=[];
  for(const k of [0,1,2])for(const rot of [0,37])for(const bottomBar of [false,true]){
   S.length=0;clearSelection();__add('chainFence',1);const id=sel;
   setOb(id,{ca:0,cb:0,lift:0,k,rot,fenceBottomBar:bottomBar,fenceBottomHeight:.22});
   const o=obOf(id),parts=chainFenceBuild(o),meshPart=parts[parts.length-1],
    tris=surfaceTriangles(o),lines=genShape(o),bb=obBounds(o),
    finite=tris.flat(2).every(Number.isFinite)&&lines.flatMap(s=>s.p.flat()).every(Number.isFinite),
    inBounds=[...tris.flat(),...lines.flatMap(s=>s.p)].every(p=>p.every((v,i)=>v>=bb.lo[i]-1e-5&&v<=bb.hi[i]+1e-5));
   planeRows.push({k,rot,bottomBar,parts:parts.length,meshTris:meshPart.meshTriangles.length,meshLines:meshPart.meshEdges.length,finite,inBounds,
    ok:parts.length===(bottomBar?3:2)&&meshPart.meshTriangles.length===0&&meshPart.meshEdges.length>20&&finite&&inBounds});
  }
  S.length=0;clearSelection();__add('chainFence',1);const id=sel;
  setOb(id,{ca:0,cb:0,lift:0,k:1,rot:0,fenceBottomBar:false});
  const inspectMesh=(o)=>{
   const parts=chainFenceBuild(o),mesh=parts[parts.length-1].meshEdges,
    d=chainFenceDiameter(o),r=d/2,b=chainFenceBend(o),L=chainFenceStraight(o),H=o.h,
    bottomOn=o.fenceBottomBar!==false,zBot=chainFenceBottomHeight(o),
    xIn=L/2+b-r,zMax=H-d,zMin=bottomOn?zBot+r:0,rIn=Math.max(0,(b-r)*Math.cos(Math.PI/16)),
    cxAbs=xIn-rIn,cz=zMax-rIn,pitch=chainFenceMeshPitch(o);
   let all45=true,allInside=true,interceptsPos=[],interceptsNeg=[];
   for(const seg of mesh){
    const a=seg[0],c=seg[seg.length-1],dx=c[0]-a[0],dz=c[2]-a[2],s=dz>=0?1:-1;
    if(!near(Math.abs(dx),Math.abs(dz),1e-6)||!near(a[1],0,1e-8)||!near(c[1],0,1e-8))all45=false;
    for(const p of [a,c]){
     if(Math.abs(p[0])>xIn+1e-4||p[2]<zMin-1e-4||p[2]>zMax+1e-4)allInside=false;
     for(const sign of [-1,1]){
      const cx=sign*cxAbs;
      if(sign*(p[0]-cx)>1e-4&&p[2]-cz>1e-4&&(p[0]-cx)**2+(p[2]-cz)**2>(rIn+1e-3)**2)allInside=false;
     }
    }
    const xk=a[0]-s*(a[2]-zMax);
    (s===1?interceptsPos:interceptsNeg).push(xk);
   }
   interceptsPos.sort((x,y)=>x-y);interceptsNeg.sort((x,y)=>x-y);
   const stepOk=[interceptsPos,interceptsNeg].every(arr=>arr.length>2&&arr.slice(1).every((v,i)=>near(v-arr[i],pitch,1e-5)));
   return {count:mesh.length,all45,allInside,stepOk,bend:b,diam:d,straight:L,pitch,zBot,minZ:Math.min(...mesh.flat().map(p=>p[2]))};
  };
  const base=inspectMesh(obOf(id));
  const straightCtl=assetEditorControls(obOf(id)).find(c=>c.key==='fenceStraight');
  setOb(id,straightCtl.patch(obOf(id),2.8));
  const wider=inspectMesh(obOf(id));
  setOb(id,{h:2.2});
  const taller=inspectMesh(obOf(id));
  setOb(id,{fenceMeshPitch:.09});
  const finer=inspectMesh(obOf(id));
  const beforeStraight=chainFenceStraight(obOf(id));
  const diamCtl=assetEditorControls(obOf(id)).find(c=>c.key==='fenceDiameter');
  setOb(id,diamCtl.patch(obOf(id),.1));
  const thicker=inspectMesh(obOf(id)),thickerRb=obOf(id).rb;
  // 下の横パイプON＆高さ変更：網目の下端が zBot + r に追従し、上げた分だけ網目数が減る
  setOb(id,{fenceBottomBar:true,fenceBottomHeight:.15});
  const withBottomLow=inspectMesh(obOf(id));
  setOb(id,{fenceBottomHeight:.55});
  const withBottomHigh=inspectMesh(obOf(id));
  // 横に並べる数（fenceCount）・並べる間隔（fenceGap）の検証
  S.length=0;clearSelection();__add('chainFence',1);const id2=sel;
  setOb(id2,{ca:0,cb:0,lift:0,k:1,rot:0});
  const o1=obOf(id2),tri1=surfaceTriangles(o1).length,parts1=chainFenceBuild(o1).length,b1=obBounds(o1),unitW=b1.hi[0]-b1.lo[0];
  setOb(id2,{fenceCount:3});
  const o3=obOf(id2),tri3=surfaceTriangles(o3).length,parts3=chainFenceBuild(o3).length,b3=obBounds(o3);
  setOb(id2,{fenceGap:.25});
  const o3g=obOf(id2),b3g=obBounds(o3g);
  const rowOk=parts3===3*parts1&&tri3===3*tri1&&near(b3.hi[0]-b3.lo[0],3*unitW,1e-5)&&near(b3g.hi[0]-b3g.lo[0],3*unitW+2*.25,1e-5);
  return {
   planeRows,base,wider,taller,finer,thicker,withBottomLow,withBottomHigh,rowOk,
   checks:{
    planesOk:planeRows.every(r=>r.ok),
    baseOk:base.all45&&base.allInside&&base.stepOk,
    widerOk:wider.all45&&wider.allInside&&wider.stepOk&&near(wider.straight,2.8)&&near(wider.bend,base.bend)&&near(wider.diam,base.diam)&&wider.count>base.count+10,
    tallerOk:taller.all45&&taller.allInside&&taller.stepOk&&near(taller.straight,2.8)&&near(taller.bend,base.bend)&&taller.count>wider.count+8,
    finerOk:finer.all45&&finer.allInside&&finer.stepOk&&near(finer.pitch,.09)&&finer.count>taller.count+20,
    thickerOk:thicker.all45&&thicker.allInside&&near(thicker.diam,.1)&&near(thicker.bend,.12)&&near(thicker.straight,beforeStraight)&&near(thickerRb,.05),
    bottomLowOk:withBottomLow.all45&&withBottomLow.allInside&&near(withBottomLow.minZ,.20,.05)&&withBottomLow.minZ>thicker.minZ+.12,
    bottomHighOk:withBottomHigh.all45&&withBottomHigh.allInside&&near(withBottomHigh.minZ,.60,.05)&&withBottomHigh.minZ>withBottomLow.minZ+.35&&withBottomHigh.count<withBottomLow.count-4,
    rowOk
   }
  };
 });
 console.log(JSON.stringify({checks:res.checks,errors}));
 if(errors.length||Object.values(res.checks).some(v=>!v)){console.error(JSON.stringify(res,null,2));process.exitCode=1;}
 else console.log('OK: 金網フェンスの3生成面・回転・角ベベル不変・45°網目増減・太さ・下パイプ高さ・横連結');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
