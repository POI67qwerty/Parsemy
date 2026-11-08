// UFOキャッチャー・ガチャの幾何、取り出し口凹み、クレーン移動、段積み・横並び、および棚の並び順の検証
const {open,ADD_FN}=require('./lib');
(async()=>{
 const {browser,page,errors}=await open({width:1200,height:800});
 await page.evaluate(ADD_FN);
 const res=await page.evaluate(()=>{
  const near=(a,b,e=1e-5)=>Math.abs(a-b)<e;
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function firstHitY(orig,dir,tris){
   let best=Infinity;
   for(const tri of tris){
    let e1=sub(tri[1],tri[0]),e2=sub(tri[2],tri[0]),h=cross(dir,e2),det=dot(e1,h);
    if(Math.abs(det)<1e-9)continue;
    let inv=1/det,a=sub(orig,tri[0]),u=dot(a,h)*inv;if(u<-1e-8||u>1+1e-8)continue;
    let q=cross(a,e1),v=dot(dir,q)*inv;if(v<-1e-8||u+v>1+1e-8)continue;
    let k=dot(e2,q)*inv;if(k>1e-6&&k<best)best=k;
   }
   return best;
  }
  const planeRows=[];
  for(const kind of ['ufoCatcher','gachaMachine'])for(const k of [0,1,2])for(const rot of [0,37]){
   S.length=0;clearSelection();__add(kind,1);const id=sel;
   setOb(id,{ca:0,cb:0,lift:0,k,rot});
   const o=obOf(id),tris=surfaceTriangles(o),lines=genShape(o),bb=obBounds(o),
    finite=tris.flat(2).every(Number.isFinite)&&lines.flatMap(s=>s.p.flat()).every(Number.isFinite),
    inBounds=[...tris.flat(),...lines.flatMap(s=>s.p)].every(p=>p.every((v,i)=>v>=bb.lo[i]-1e-5&&v<=bb.hi[i]+1e-5));
   planeRows.push({kind,k,rot,tris:tris.length,lines:lines.length,finite,inBounds,ok:tris.length>40&&lines.length>20&&finite&&inBounds});
  }
  // UFOキャッチャー：斜め操作台・下部ボタン突起なし・ベベル・取り出し口幅/高さ可変凹み・クレーン位置・横連結
  S.length=0;clearSelection();__add('ufoCatcher',1);const ufoId=sel;
  setOb(ufoId,{ca:0,cb:0,lift:0,k:1,rot:0});
  const ufo1=obOf(ufoId),ufoG1=ufoCatcherGeom(ufo1),ufoTris1=surfaceTriangles(ufo1),ufoB1=obBounds(ufo1),ufoW1=ufoB1.hi[0]-ufoB1.lo[0];
  // 正面(z=-2)から+Z方向へレイを撃ち、取り出し口中央は前面壁(z=-0.425)より奥(recess)で当たること
  const hitWall=firstHitY([.35,-1+.55,-2],[0,0,1],ufoTris1),hitChute=firstHitY([ufoG1.chuteMidX,-1+(ufoG1.chuteZ0+ufoG1.chuteZ1)*.5,-2],[0,0,1],ufoTris1);
  // 左下操作台は前面壁(-0.425)より手前へ張り出し、上端が斜めに下がっていること。右半分には前面壁より手前への不要な突起が無いこと
  const hitConsoleBot=firstHitY([(ufoG1.cx0+ufoG1.cx1)*.5,-1+.10,-2],[0,0,1],ufoTris1),
   hitConsoleSlope=firstHitY([(ufoG1.cx0+ufoG1.cx1)*.5,-1+ufoG1.baseH-.04,-2],[0,0,1],ufoTris1),
   rightMinZ=Math.min(...ufoTris1.flat().filter(p=>p[0]>0&&p[1]<-1+ufoG1.baseH+.05).map(p=>p[2]));
  const ufoRecessOk=hitChute>hitWall+.05&&hitConsoleBot<hitWall-.06&&hitConsoleSlope>hitConsoleBot+.02&&hitConsoleSlope<hitWall-.01&&near(rightMinZ,-ufoG1.d/2,1e-4);
  // ベベル・ボタン操作台の幅・取り出し口の幅/高さ/左右/上下移動が実ジオメトリに反映されること
  const edgeX=ufoG1.chuteMidX+.15,edgeY=-1+(ufoG1.chuteZ0+ufoG1.chuteZ1)*.5;
  const hitBeforeExpand=firstHitY([edgeX,edgeY,-2],[0,0,1],ufoTris1);
  const hitConBefore=firstHitY([ufoG1.cx0+.28,-1+.20,-2],[0,0,1],ufoTris1);
  setOb(ufoId,{ufoBevel:.06,ufoConsoleWidth:.30,ufoChuteWidth:.22,ufoChuteHeight:.18,ufoChuteX:.05,ufoChuteZ:.08,ufoClawX:.18,ufoClawDrop:.48,ufoBaseHeight:.78,ufoTopSign:false});
  const ufoEdited=ufoCatcherGeom(obOf(ufoId)),ufoTrisEdited=surfaceTriangles(obOf(ufoId));
  const hitConAfter=firstHitY([ufoEdited.cx0+.28,-1+.20,-2],[0,0,1],ufoTrisEdited);
  const hitShiftedChute=firstHitY([ufoEdited.chuteMidX,-1+ufoEdited.chuteMidZ,-2],[0,0,1],ufoTrisEdited);
  const hitBelowShiftedChute=firstHitY([ufoEdited.chuteMidX,-1+ufoEdited.chuteZ0-.04,-2],[0,0,1],ufoTrisEdited);
  setOb(ufoId,{ufoBevel:.10,ufoConsoleWidth:.22,ufoChuteWidth:.34,ufoChuteHeight:.28,ufoChuteX:0,ufoChuteZ:0});
  const ufoExpanded=ufoCatcherGeom(obOf(ufoId)),ufoTrisExpanded=surfaceTriangles(obOf(ufoId));
  const hitAfterExpand=firstHitY([ufoExpanded.chuteMidX+.15,-1+(ufoExpanded.chuteZ0+ufoExpanded.chuteZ1)*.5,-2],[0,0,1],ufoTrisExpanded);
  const ufoEditOk=near(ufoEdited.consoleW,.30)&&near(ufoEdited.chuteOffX,.05)&&near(ufoEdited.chuteOffZ,.08)&&hitConAfter<hitConBefore-.05&&hitShiftedChute>hitBelowShiftedChute+.05&&near(ufoExpanded.bevel,.10)&&near(ufoExpanded.chuteW,.34)&&near(ufoExpanded.chuteH,.28)&&near(ufoEdited.clawX,.18)&&near(ufoEdited.clawDrop,.48)&&near(ufoEdited.baseH,.78)&&!ufoEdited.topSign&&hitAfterExpand>hitBeforeExpand+.05;
  setOb(ufoId,{ufoBevel:.070,ufoConsoleWidth:.22,ufoChuteWidth:.28,ufoChuteHeight:.22,ufoChuteX:0,ufoChuteZ:0,ufoClawX:0,ufoClawDrop:.30,ufoBaseHeight:.68,ufoTopSign:true,ufoCount:3,ufoGap:.15});
  const ufo3=obOf(ufoId),ufoB3=obBounds(ufo3);
  const ufoRowOk=surfaceTriangles(ufo3).length===3*ufoTris1.length&&near(ufoB3.hi[0]-ufoB3.lo[0],3*ufoW1+2*.15,1e-4);

  // ガチャ：取り出し口の幅/高さ/左右/上下可変凹み、上に積む段数（gachaStack）、横に並べる数（gachaCount）
  S.length=0;clearSelection();__add('gachaMachine',1);const gachaId=sel;
  setOb(gachaId,{ca:0,cb:0,lift:0,k:1,rot:0});
  const g1=obOf(gachaId),gTris1=surfaceTriangles(g1),gB1=obBounds(g1),gW1=gB1.hi[0]-gB1.lo[0],gH1=gB1.hi[1]-gB1.lo[1];
  const gHitWall=firstHitY([.14,-.92,-2],[0,0,1],gTris1),gHitChute=firstHitY([0,-.92,-2],[0,0,1],gTris1);
  const gHitEdgeBefore=firstHitY([.10,-.92,-2],[0,0,1],gTris1);
  setOb(gachaId,{gachaChuteWidth:.23,gachaChuteHeight:.14});
  const gEdited=gachaMachineGeom(obOf(gachaId)),gTrisEdited=surfaceTriangles(obOf(gachaId));
  const gHitEdgeAfter=firstHitY([.10,-.92,-2],[0,0,1],gTrisEdited);
  setOb(gachaId,{gachaChuteWidth:.14,gachaChuteHeight:.09,gachaChuteX:.04,gachaChuteZ:.05});
  const gMoved=gachaMachineGeom(obOf(gachaId)),gTrisMoved=surfaceTriangles(obOf(gachaId));
  const gHitMovedIn=firstHitY([gMoved.chuteMidX,-1+gMoved.chuteMidZ,-2],[0,0,1],gTrisMoved),
   gHitMovedOut=firstHitY([-0.08,-1+gMoved.chuteMidZ,-2],[0,0,1],gTrisMoved);
  // ガチャが入ってるところ（上部カプセル容器）が曲面に膨らんでいること（窓中央が上下端より手前 -Y 側にある）
  const gCapH=Math.max(.036,g1.h*.070),gTopZ=g1.h-gCapH,gWinTopZ=gTopZ-Math.max(.042,g1.h*.086),gMidWinZ=(gEdited.waistZ+gWinTopZ)*.5;
  const gHitWinBot=firstHitY([0,-1+gEdited.waistZ+.015,-2],[0,0,1],gTris1),
   gHitWinMid=firstHitY([0,-1+gMidWinZ,-2],[0,0,1],gTris1),
   gHitWinTop=firstHitY([0,-1+gWinTopZ-.015,-2],[0,0,1],gTris1);
  const gachaCurveOk=gHitWinMid<gHitWinBot-.02&&gHitWinMid<gHitWinTop-.015;
  const gachaRecessOk=gachaCurveOk&&gHitChute>gHitWall+.04&&near(gEdited.chuteW,.23)&&near(gEdited.chuteH,.14)&&gHitEdgeAfter>gHitEdgeBefore+.03&&near(gMoved.chuteOffX,.04)&&near(gMoved.chuteOffZ,.05)&&gHitMovedIn>gHitMovedOut+.04;
  setOb(gachaId,{gachaChuteWidth:.17,gachaChuteHeight:.11,gachaChuteX:0,gachaChuteZ:0,gachaStack:3});
  const gStack3=obOf(gachaId),gBStack3=obBounds(gStack3);
  const gachaStackOk=surfaceTriangles(gStack3).length===3*gTris1.length&&near(gBStack3.hi[1]-gBStack3.lo[1],3*gH1,1e-4)&&near(gBStack3.hi[0]-gBStack3.lo[0],gW1,1e-4);
  setOb(gachaId,{gachaStack:2,gachaCount:3});
  const g2x3=obOf(gachaId),gB2x3=obBounds(g2x3);
  const gachaGridOk=surfaceTriangles(g2x3).length===6*gTris1.length&&near(gB2x3.hi[1]-gB2x3.lo[1],2*gH1,1e-4)&&near(gB2x3.hi[0]-gB2x3.lo[0],3*gW1,1e-4);

  // 棚のグループ整理の検証（カウンター系3種が「家具」に移動していることを含む）
  const groups=Object.fromEntries(cityGridAssetGroups().map(g=>[g.key,g.kinds]));
  const trayOrderOk=
   groups.primitive.indexOf('track')===1&&
   !groups.building.includes('counter')&&
   !groups.building.includes('counterL')&&
   !groups.building.includes('counterU')&&
   groups.buildingParts.indexOf('corrugatedRoof')===2&&
   groups.street.indexOf('pictureStairs')===groups.street.indexOf('stairs')+1&&
   groups.street.slice(-3).join(',')==='vendingMachine,ufoCatcher,gachaMachine'&&
   groups.traffic.indexOf('streetPavement')===1&&
   groups.streetObjects.indexOf('bottleCrate')===1&&
   groups.streetObjects.indexOf('streetPlantBox')===groups.streetObjects.indexOf('streetPlant')+1&&
   groups.furniture.indexOf('squareStool')===groups.furniture.indexOf('stool')+1&&
   groups.furniture.includes('counter')&&
   groups.furniture.includes('counterL')&&
   groups.furniture.includes('counterU')&&
   groups.furniture.indexOf('shopWardrobe2')===groups.furniture.indexOf('shopWardrobe')+1;

  return {
   checks:{
    planesOk:planeRows.every(r=>r.ok),
    ufoRecessOk,
    ufoEditOk,
    ufoRowOk,
    gachaRecessOk,
    gachaStackOk,
    gachaGridOk,
    trayOrderOk
   },
   groups
  };
 });
 console.log(JSON.stringify({checks:res.checks,errors}));
 if(errors.length||Object.values(res.checks).some(v=>!v)){console.error(JSON.stringify(res,null,2));process.exitCode=1;}
 else console.log('OK: UFOキャッチャー・ガチャの幾何・凹み・クレーン・段積み・横連結・棚の整理順');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
