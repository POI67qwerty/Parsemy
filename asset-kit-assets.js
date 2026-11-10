/* ===== asset-kit-assets.js : ASSET_KIT で作ったアセットの定義 =====
 *
 * ここに並ぶのは「形の記述だけ」。線画と面は ASSET_KIT が同じ記述から作る。
 * 追加したアセットは、ASSETS に載るのでアセット棚（街・パーツ）へ自動で並ぶ。
 * 寸法の初期値・固有値は meta に書き、画面から変えた値は o[key] が優先される。
 */

// ===== 電光看板（立て看板）=====
// 写真のとおり「丸めた長方形の板＋左右2本の脚＋小さな足」で作る。
// 板の前後には印刷面がわずかに出ていて、縁（フレーム）の段差が線として出る。
ASSET_KIT.define(
    "lightboxSign",
    {
        label: "電光看板",
        glyph: "▤",
        // 他の小物（自販機 1.0×1.83、屋台など）と並べて大きすぎたので、
        // 実物のA型看板に近い寸法へ縮めた（2026-11-03）。
        w: 0.72,
        d: 0.28,
        h: 0.92,
        accent: "#ff5a7a",
        // 固有値（画面の数値欄・JSONにもそのまま載る）
        lightboxFrame: 0.042, // 縁（フレーム）の幅
        lightboxPanelThickness: 0.13, // 板の厚み
        lightboxPanelBottom: 0.26, // 板の下端の高さ（脚が見える長さ）
        lightboxCorner: 0.038, // 板の角の丸み
        lightboxLegSize: 0.042, // 脚の太さ（正方形）
        lightboxFootHeight: 0.03, // 足の高さ
        lightboxFootLength: 0.16, // 足の前後の長さ
        lightboxRing: true, // 上の吊り輪を出す
    },
    (o, K) => {
        const W = Math.max(0.2, Math.abs(2 * o.ra)),
            D = Math.max(0.06, Math.abs(2 * o.rb)),
            H = Math.max(0.2, Math.abs(o.h)),
            frame = Math.max(0.005, K.param(o, "lightboxFrame", 0.042)),
            panelT = Math.max(0.02, K.param(o, "lightboxPanelThickness", 0.13)),
            bottom = Math.max(0, Math.min(H - 0.1, K.param(o, "lightboxPanelBottom", 0.26))),
            corner = Math.max(0, K.param(o, "lightboxCorner", 0.038)),
            legS = Math.max(0.01, K.param(o, "lightboxLegSize", 0.042)),
            footH = Math.max(0, K.param(o, "lightboxFootHeight", 0.03)),
            footL = Math.max(0.02, K.param(o, "lightboxFootLength", 0.16)),
            ring = K.param(o, "lightboxRing", 1) ? true : false,
            parts = [];

        // 1) 板（フレーム）: 丸めた長方形を押し出す
        parts.push(
            K.box(K.roundRectPath(W, panelT, corner, 2), bottom, H),
        );
        // 2) 印刷面: フレームの内側で、前後へわずかに出っ張らせる
        //    （段差があるので、縁の線が「面の内側の線」として消えない）
        const innerW = Math.max(0.05, W - frame * 2),
            innerH0 = Math.min(H - 0.01, bottom + frame),
            innerH1 = Math.max(innerH0 + 0.02, H - frame);
        if (innerW > 0.06 && innerH1 - innerH0 > 0.02)
            parts.push(
                K.box(K.roundRectPath(innerW, panelT + 0.014, Math.max(0.005, corner - frame * 0.5), 2), innerH0, innerH1),
            );
        // 3) 脚: 板の左右の外側。足の上から板の上端まで。
        const legX = W / 2 + legS / 2 - Math.min(0.01, legS * 0.2);
        for (const sx of [-1, 1])
            parts.push(K.box(K.rectPath(legS, legS, sx * legX, 0), footH, H));
        // 4) 足: 脚の下。前後へ長く出して、板が倒れない形にする。
        for (const sx of [-1, 1])
            parts.push(K.box(K.rectPath(Math.max(legS * 1.6, 0.08), Math.min(footL, D), sx * legX, 0), 0, footH));
        // 5) 上の吊り輪（小さな輪の代わりに、細い板で作る）
        if (ring) parts.push(K.box(K.rectPath(Math.min(0.11, W * 0.12), Math.min(0.05, panelT), 0, 0), H, H + 0.06));
        return parts;
    },
);

// 奥行き方向の稜線だけを丸める共通ハンドル（灯器と自販機の胴）。
function depthBevelControl(key, initial, signal=false) {
    const size=o=>signal?signalGeometry(o):{headW:Math.max(.2,2*Math.abs(o.ra)),headH:Math.max(.3,Math.abs(o.h)),headD:Math.max(.2,2*Math.abs(o.rb)),headBottom:0};
    return {key,label:"前後辺のベベル",default:initial,min:0,max:o=>{const g=size(o);return Math.max(0,Math.min(g.headW,g.headH)*.4999);},step:.005,unit:"m",
        handle:(o,v)=>{const g=size(o),x=(g.headX||0)+g.headW/2,y=-g.headD/2-.025,z=g.headBottom+g.headH;
            return {anchor:[x,y,z],sample:[x-v,y,z],probe:[x-v-1,y,z],fallback:{x:-1,y:0}};}};
}

// ===== 自販機：商品窓と取り出し口は画面ハンドルで編集可能 =====
const vendingControls = (windowPart) => {
    const prefix = windowPart ? "vmWindow" : "vmOutlet";
    const widthKey = prefix + "WRatio", heightKey = prefix + (windowPart ? "HRatio" : "HeightRatio");
    const bottomKey = prefix + "BottomRatio", xKey = prefix + "OffsetX";
    const widthDefault = windowPart ? .62 : .46, heightDefault = windowPart ? .35 : .11;
    const widthMin = windowPart ? .2 : .2, widthMax = windowPart ? .94 : .86;
    const heightMin = windowPart ? .08 : .04, heightMax = windowPart ? .6 : .25;
    const bottomDefault = windowPart ? .36 : .04, bottomMin = windowPart ? .05 : .005, bottomMax = windowPart ? .7 : .2;
    const front = o => -Math.max(.2,Math.abs(2*o.rb))/2;
    const width = o => Math.max(.2,Math.abs(2*o.ra))*Math.max(widthMin,Math.min(widthMax,Number(o[widthKey])||widthDefault));
    const height = o => Math.max(.3,Math.abs(o.h))*Math.max(heightMin,Math.min(heightMax,Number(o[heightKey])||heightDefault));
    const bottom = o => Math.max(.3,Math.abs(o.h))*Math.max(bottomMin,Math.min(bottomMax,Number(o[bottomKey])||bottomDefault));
    const cx = o => Number(o[xKey])||0;
    return [
      {key:widthKey,label:windowPart?"商品窓の横幅":"取り出し口の横幅",default:widthDefault,min:o=>Math.max(.2,Math.abs(2*o.ra))*widthMin,max:o=>Math.max(.2,Math.abs(2*o.ra))*widthMax,step:.01,unit:"m",handleOnly:true,
       get:width,patch:(o,v)=>{const old=width(o),W=Math.max(.2,Math.abs(2*o.ra));return {[widthKey]:v/W,[xKey]:cx(o)+(v-old)/2};},
       handle:(o,v)=>{const z=windowPart?bottom(o)+height(o)/2:bottom(o)+height(o)/2,x=cx(o)+v/2;return {anchor:[cx(o)+v/2,front(o)-.02,z],sample:[x,front(o)-.02,z],probe:[x+1,front(o)-.02,z],fallback:{x:1,y:0}};}},
      {key:heightKey,label:windowPart?"商品窓の高さ":"取り出し口の高さ",default:heightDefault,min:o=>Math.max(.3,Math.abs(o.h))*heightMin,max:o=>Math.max(.3,Math.abs(o.h))*heightMax,step:.01,unit:"m",handleOnly:true,
       get:height,patch:(o,v)=>({[heightKey]:v/Math.max(.3,Math.abs(o.h))}),
       handle:(o,v)=>{const z=bottom(o)+v,x=cx(o);return {anchor:[x,front(o)-.02,z],sample:[x,front(o)-.02,z],probe:[x,front(o)-.02,z+1],fallback:{x:0,y:-1}};}},
      {key:xKey,label:windowPart?"商品窓の左右位置":"取り出し口の左右位置",default:0,min:o=>-Math.max(.0,Math.abs(2*o.ra)/2-width(o)/2),max:o=>Math.max(.0,Math.abs(2*o.ra)/2-width(o)/2),step:.01,unit:"m",handleOnly:true,
       handle:(o,v)=>{const z=bottom(o)+height(o)/2;return {anchor:[v,front(o)-.02,z],sample:[v,front(o)-.02,z],probe:[v+1,front(o)-.02,z],fallback:{x:1,y:0}};}},
      {key:bottomKey,label:windowPart?"商品窓の上下位置":"取り出し口の上下位置",default:bottomDefault,min:o=>Math.max(.3,Math.abs(o.h))*bottomMin,max:o=>Math.max(.3,Math.abs(o.h))*bottomMax,step:.01,unit:"m",handleOnly:true,
       get:o=>Math.max(.3,Math.abs(o.h))*Math.max(bottomMin,Math.min(bottomMax,Number(o[bottomKey])||bottomDefault)),patch:(o,v)=>({[bottomKey]:v/Math.max(.3,Math.abs(o.h))}),
       handle:(o,v)=>{const z=v;return {anchor:[cx(o),front(o)-.02,z],sample:[cx(o),front(o)-.02,z],probe:[cx(o),front(o)-.02,z+1],fallback:{x:0,y:-1}};}}
    ];
};
ASSET_KIT.define("vendingMachine",{
 label:"自販機",glyph:"▯",w:1.0,d:.75,h:1.83,accent:"#d94a4a",geometryBounds:false,
 controls:[depthBevelControl("vmDepthBevel",.03),...vendingControls(true),...vendingControls(false)],
 vmWindowWRatio:.62,vmWindowHRatio:.35,vmWindowBottomRatio:.36,vmWindowOffsetX:0,
 vmOutletWRatio:.46,vmOutletHeightRatio:.11,vmOutletBottomRatio:.04,vmOutletOffsetX:0,
 vmPanelProud:.015,vmPanelThickness:.05
},(o,K)=>{
 const W=Math.max(.2,Math.abs(2*o.ra)),D=Math.max(.2,Math.abs(2*o.rb)),H=Math.max(.3,Math.abs(o.h)),
  ratio=(key,dflt,lo,hi)=>Math.max(lo,Math.min(hi,K.param(o,key,dflt))),
  // 外枠まで含めて胴体の幅・高さ内に必ず収める。
  winW=Math.min(W*.94,W*ratio("vmWindowWRatio",.62,.2,.94)),winH=Math.min(H*.8,H*ratio("vmWindowHRatio",.35,.08,.6)),
  winBottom=Math.min(H*.7,Math.max(0,Math.min(H,H*ratio("vmWindowBottomRatio",.36,.05,.7)))),
  proud=Math.max(.002,K.param(o,"vmPanelProud",.015)),panelT=Math.max(.01,K.param(o,"vmPanelThickness",.05)),
  outW=Math.min(W*.86,W*ratio("vmOutletWRatio",.46,.2,.86)),outH=Math.min(H*.25,H*ratio("vmOutletHeightRatio",.11,.04,.25)),
  outBottom=Math.max(0,Math.min(H,H*ratio("vmOutletBottomRatio",.04,.005,.2))),
  front=-D/2,parts=[],
  frontPanel=(pw,ph,cz,holes,cx=0)=>K.box(K.rectPath(pw,ph,cx,cz),front-proud,front+panelT,{axis:"y",holes,holeSides:true});
 parts.push(K.depthBeveledBox(W,D,H,K.param(o,"vmDepthBevel",.03),{seg:3,group:"vending-body",seamLines:true}));
 const frameH=Math.min(H,winH+Math.min(.16,winH*.28)),frameW=Math.min(W,winW+Math.min(.16,winW*.22)),
  windowBottom=Math.max(0,Math.min(winBottom,H-frameH)),winCz=windowBottom+winH/2,
  winX=Math.max(-(W-frameW)/2,Math.min((W-frameW)/2,Number(o.vmWindowOffsetX)||0));
 parts.push(frontPanel(frameW,frameH,winCz,[K.rectPath(winW,winH,winX,0).map(([u,v])=>[u,winCz+v])],winX));
 const shelfY=front-proud+Math.min(.012,proud*.8);
 for(let i=1;i<=2;i++){const z=windowBottom+winH*i/3;parts.push(K.box(K.rectPath(winW*.94,.035,winX,z),shelfY-.004,shelfY+.004,{axis:"y",sheet:true}));}
 parts.push(K.box(K.rectPath(winW*.94,.035,winX,windowBottom+.02),shelfY-.004,shelfY+.004,{axis:"y",sheet:true}));
 // 小銭投入口・操作ボタン群と上部看板板は設けない。
 const outFrameW=Math.min(W,Math.max(outW+.08,winW+.14)),outFrameH=Math.min(H,outH+.1),
  outletBottom=Math.max(0,Math.min(outBottom,H-outFrameH)),outCz=outletBottom+outH/2,
  outX=Math.max(-(W-outFrameW)/2,Math.min((W-outFrameW)/2,Number(o.vmOutletOffsetX)||0));
 parts.push(frontPanel(outFrameW,outFrameH,outCz,[K.rectPath(outW,outH,outX,outCz)],outX));
 return parts;
});

// ===== 卓上扇風機（線だけのワイヤーガード）=====
ASSET_KIT.define("deskFan",{
 label:"扇風機",glyph:"◉",group:"furniture",w:.62,d:.42,h:1.08,accent:"#74b989",
 geometryBounds:true,minHalfWidth:()=>.2,minHalfDepth:()=>.12,minHeight:()=>.55,
 fanBaseWidth:.55,fanBaseLength:.33,fanBaseThickness:.10,fanPoleHeight:.45,
 controls:[
  {key:"fanPoleHeight",label:"支柱の高さ",default:.45,min:o=>.16,max:o=>{const W=Math.max(.4,Math.abs(2*o.ra)),H=Math.max(.55,Math.abs(o.h)),R=Math.min(W*.42,H*.27,.29),b=Math.max(.05,Math.min(.24,Number(o.fanBaseThickness)||.10));return Math.max(.16,H-b-R*1.78);},step:.01,unit:"m",handleOnly:true,
   get:o=>Number(o.fanPoleHeight)||.45,
   handle:(o,v)=>{const b=Math.max(.05,Math.min(.24,Number(o.fanBaseThickness)||.10)),z=b+v;return {anchor:[0,-Math.abs(o.rb)-.03,z],sample:[0,-Math.abs(o.rb)-.03,z],probe:[0,-Math.abs(o.rb)-.03,z+1],fallback:{x:0,y:-1}};}},
  {key:"fanBaseWidth",label:"土台の幅",default:.55,min:.3,max:o=>Math.max(.3,Math.abs(2*o.ra)*1.35),step:.01,unit:"m",handleOnly:true,
   get:o=>Number(o.fanBaseWidth)||Math.abs(2*o.ra)*.88,
   handle:(o,v)=>({anchor:[v/2,-Math.abs(o.rb)-.025,.05],sample:[v/2,-Math.abs(o.rb)-.025,.05],probe:[v/2+1,-Math.abs(o.rb)-.025,.05],fallback:{x:1,y:0}})},
  {key:"fanBaseLength",label:"土台の長さ",default:.33,min:.18,max:o=>Math.max(.18,Math.abs(2*o.rb)*1.4),step:.01,unit:"m",handleOnly:true,
   get:o=>Number(o.fanBaseLength)||Math.abs(2*o.rb)*.79,
   handle:(o,v)=>({anchor:[0,-v/2,.05],sample:[0,-v/2,.05],probe:[0,-v/2-1,.05],fallback:{x:0,y:1}})},
  {key:"fanBaseThickness",label:"土台の厚さ",default:.10,min:.05,max:.24,step:.005,unit:"m",handleOnly:true,
   get:o=>Number(o.fanBaseThickness)||.10,
   handle:(o,v)=>({anchor:[0,-Math.abs(o.rb)-.03,v],sample:[0,-Math.abs(o.rb)-.03,v],probe:[0,-Math.abs(o.rb)-.03,v+1],fallback:{x:0,y:-1}})},
  {key:"fanBladeCount",label:"羽根の枚数",type:"range",default:5,min:3,max:7,step:2,integer:true,unit:"枚",get:o=>[3,5,7].includes(Number(o.fanBladeCount))?Number(o.fanBladeCount):5,
   patch:(o,v)=>({fanBladeCount:[3,5,7].reduce((best,n)=>Math.abs(n-v)<Math.abs(best-v)?n:best,3)}),
   handle:(o,v)=>({anchor:[0,-Math.abs(o.rb)-.025,Math.abs(o.h)*.86],sample:[0,-Math.abs(o.rb)-.025,Math.abs(o.h)*.86],probe:[1,-Math.abs(o.rb)-.025,Math.abs(o.h)*.86],fallback:{x:1,y:0},pixelsPerUnit:1})},
  {key:"fanGuardRibs",label:"カバーの辺の本数",type:"range",default:16,min:8,max:32,step:2,integer:true,unit:"本",get:o=>Math.max(8,Math.min(32,Math.round(Number(o.fanGuardRibs)||16))),
   patch:(o,v)=>({fanGuardRibs:Math.max(8,Math.min(32,Math.round(v/2)*2))}),
   handle:(o,v)=>({anchor:[0,-Math.abs(o.rb)-.025,Math.abs(o.h)*.78],sample:[0,-Math.abs(o.rb)-.025,Math.abs(o.h)*.78],probe:[1,-Math.abs(o.rb)-.025,Math.abs(o.h)*.78],fallback:{x:1,y:0},pixelsPerUnit:1})}
 ]
},(o,K)=>{
 const W=Math.max(.4,Math.abs(2*o.ra)),D=Math.max(.24,Math.abs(2*o.rb)),H=Math.max(.55,Math.abs(o.h)),
  R=Math.min(W*.42,H*.27,.29),baseW=Math.max(.3,Math.min(W*1.35,Number(o.fanBaseWidth)||W*.88)),
  baseD=Math.max(.18,Math.min(D*1.4,Number(o.fanBaseLength)||D*.79)),
  baseH=Math.max(.05,Math.min(.24,Number(o.fanBaseThickness)||.10)),
  poleHeight=Math.max(.16,Math.min(Number(o.fanPoleHeight)||.45,Math.max(.16,H-baseH-R*1.78))),
  headZ=baseH+poleHeight+R*.78,front=-D/2,rimY=front,
  backY=front+D*.30,bulge=R*.28,bladeY=front+bulge*.55,neckR=Math.min(W*.09,.055),
  bladeCount=[3,5,7].includes(Number(o.fanBladeCount))?Number(o.fanBladeCount):5,
  ribCount=Math.max(8,Math.min(32,Math.round((Number(o.fanGuardRibs)||16)/2)*2)),
  bevel=Math.min(.035,baseW*.09,baseD*.09,baseH*.28),parts=[],edges=[],N=32;
 // 直方体プリミティブと同じベベル線画・seam選別を使う台座。
 parts.push(beveledPrismPart(K,K.rectPath(baseW,baseD),0,baseH,bevel,3,{seamGroup:"desk-fan-base"}));
 // 支柱は立てた円柱。側面の縦線（verts）を明示し、線画でも形が読めるようにする。
 const poleTop=baseH+poleHeight;
 parts.push({...K.cylinder(neckR,baseH*.82,poleTop,{seg:16,verts:4}),preciseTubeEdge:true});
 // 後部モーターケースと小さな後カバー。円柱は必ずヘッド中心の高さへ移動し、
 // 台座下に紛れたように見える誤配置を防ぐ。
 parts.push(...K.moveParts([K.cylinder(R*.40,backY-.015,backY+D*.34,{axis:"y",seg:24,verts:8})],0,0,headZ));
 parts.push(...K.moveParts([K.cylinder(R*.31,backY+D*.34,backY+D*.40,{axis:"y",seg:20,verts:6})],0,0,headZ));
 // 羽根は3枚・5枚・7枚の三角形。ガードの内側に置く。
 const inner=R*.15,outer=R*.76,widthScale=5/bladeCount;
 for(let i=0;i<bladeCount;i++){
  const a=i*Math.PI*2/bladeCount+.12,radial=[Math.cos(a),Math.sin(a)],tang=[-Math.sin(a),Math.cos(a)],
   point=(r,t)=>[radial[0]*r+tang[0]*t,bladeY,headZ+radial[1]*r+tang[1]*t],
   tri=[point(inner,0),point(outer,-R*.17*widthScale),point(outer*.78,R*.20*widthScale)];
  parts.push(K.face3(tri,{onFace:true}));
 }
 // 前面の丸いハブはファン中心の高さに配置する。
 parts.push(...K.moveParts([K.cylinder(R*.19,front-bulge*.22,front+bulge*.08,{axis:"y",seg:24,verts:4})],0,0,headZ));
 // カバーの断面を前後に膨らませる。輪も放射線も厚みのない線分描写。
 const yFront=r=>rimY-bulge*(1-r/R),yBack=r=>backY+bulge*(1-r/R),
  ring=(r,yFn)=>{const pts=[];for(let j=0;j<=N;j++){const a=j*2*Math.PI/N;pts.push([Math.cos(a)*r,yFn(r),headZ+Math.sin(a)*r]);}edges.push(pts);};
 for(const r of [R*.30,R*.48,R*.72,R*.91,R]){ring(r,yFront);ring(r,yBack);}
 for(let i=0;i<ribCount;i++){
  const a=i*2*Math.PI/ribCount,x=Math.cos(a),z=Math.sin(a),frontPath=[],backPath=[];
  for(let j=0;j<=10;j++){const t=j/10,r=R*(.28+.72*t);frontPath.push([x*r,yFront(r),headZ+z*r]);backPath.push([x*r,yBack(r),headZ+z*r]);}
  edges.push(frontPath,backPath);
  edges.push([[x*R,yFront(R),headZ+z*R],[x*R,yBack(R),headZ+z*R]]);
 }
 parts.push({meshTriangles:[],meshEdges:edges,onFace:true,preciseTubeEdge:true});
 // 操作ボタンは土台の上面に並べる。
 for(let i=0;i<3;i++){const bw=Math.min(.065,baseW*.12),x=(i-1)*baseW*.2;parts.push(K.cylinder(bw*.42,baseH,baseH+bw*.32,{seg:12,cx:x,cy:-baseD*.12}));}
 return parts;
});

// ===== 既存アセットの移行（バッチ1）=====
// 既存の線画・面のコードをキットの「部品の一覧」へ置き換える。
// 形の計算（uWallGeometry / stallGeometry / balconyGeometry）はそのまま使うので、
// 画面のハンドル・数値パネルと形が食い違うことはない。

// コの字壁：コの字（∩の断面）を奥行きへ押し出した1つの立体。
// 線は断面の輪（手前・奥）と、角を通る奥行きの稜線。既存の線画と座標まで一致する。
// 面は1つの立体なので、屋根と側壁が重なる所の「二重塗り」が起きない。
ASSET_KIT.define(
    "uWall",
    { label: "コの字壁" },
    (o, K) => {
        const g = uWallGeometry(o),
            t = g.thickness,
            hw = g.w / 2,
            hd = g.d / 2,
            // 断面（XZ平面）の8点：左脚の底 → 左外側 → 屋根の上 → 右外側 →
            // 右脚の底 → 右内側 → 屋根の裏 → 左内側 → 左脚の底へ戻る。
            profile = [
                [-hw, 0],
                [-hw, g.h],
                [hw, g.h],
                [hw, 0],
                [hw - t, 0],
                [hw - t, g.h - t],
                [-hw + t, g.h - t],
                [-hw + t, 0],
            ];
        return [K.box(profile, -hd, hd, { axis: "y" })];
    },
    { replace: true },
);

// 屋台：奥の壁・左右の壁・カウンター・屋根の5つの箱（面だけキットへ）。
// 線は今の描き方（内側の稜線・床の縁まで手で選んでいる）をそのまま残す。
ASSET_KIT.define(
    "stall",
    { label: "屋台" },
    (o, K) => {
        const g = stallGeometry(o),
            hd = g.d / 2,
            sideD = g.d - g.t,
            sideY = (hd - g.t + -hd) / 2;
        return [
            K.box(K.rectPath(g.w, g.t, 0, hd - g.t / 2), 0, g.roofBottom), // 奥の壁
            K.box(K.rectPath(g.t, sideD, -g.w / 2 + g.t / 2, sideY), 0, g.roofBottom), // 左の壁
            K.box(K.rectPath(g.t, sideD, g.w / 2 - g.t / 2, sideY), 0, g.roofBottom), // 右の壁
            K.box(K.rectPath(g.w, g.cd, 0, -hd - g.cd / 2), 0, g.ch), // カウンター
            K.box(K.rectPath(g.w, g.d + g.ro, 0, -g.ro / 2), g.roofBottom, g.h), // 屋根
        ];
    },
    { replace: true, lines: false },
);

// 壁付けベランダ：床スラブ＋前面の腰壁＋左右の腰壁（面だけキットへ）。
// 線は今の描き方（腰壁の上面リング・床の見えている範囲・支持ブラケット）を残す。
ASSET_KIT.define(
    "balcony",
    { label: "壁付けベランダ" },
    (o, K) => {
        const g = balconyGeometry(o),
            t = g.thickness,
            parts = [K.box(K.rectPath(g.w, g.d), 0, t)]; // 床スラブ
        if (g.frontRail) parts.push(K.box(K.rectPath(g.w, t, 0, -g.d / 2 + t / 2), t, t + g.railH));
        if (g.sideRail) {
            // 左右の腰壁は前面の腰壁と角で重ならないよう、前面の後ろ側から詰める。
            const y0 = g.frontRail ? -g.d / 2 + t : -g.d / 2,
                sideD = g.d / 2 - y0,
                cy = (y0 + g.d / 2) / 2;
            parts.push(K.box(K.rectPath(t, sideD, -g.w / 2 + t / 2, cy), t, t + g.railH));
            parts.push(K.box(K.rectPath(t, sideD, g.w / 2 - t / 2, cy), t, t + g.railH));
        }
        return parts;
    },
    { replace: true, lines: false },
);

// 壁付け看板：表裏の輪郭（幅×高さ）を板厚方向（Y）へ押し出した板＋取付金具。
// 輪郭は wallSignFacePoints() を共有するので、ベベル（角を丸めた形）も同じ記述で出る。
// 金具は板の左側面から横へ伸びる直方体。
ASSET_KIT.define(
    "wallSign",
    { label: "壁付け看板" },
    (o, K) => {
        const p = wallSignParams(o),
            half = p.thickness * 0.5,
            parts = [K.box(wallSignFacePoints(p), -half, half, { axis: "y" })];
        wallSignBrackets(p).forEach((b) => {
            const bw=b.x1-b.x0,bd=b.y1-b.y0,bevel=Math.max(.003,Math.min(bw,bd)*.22),path=beveledBoxFootprint(bw,bd,bevel,2).map(([x,y])=>[x+(b.x0+b.x1)/2,y+(b.y0+b.y1)/2]);
            parts.push(K.box(path,b.z-b.h*.5,b.z+b.h*.5,{sideVerticals:path.map((_,i)=>i),seamMarks:[null,null,...path.map((_,i)=>beveledEdgeMark(i,bevel,2,'wall-sign-bracket'))]}));
        });
        return parts;
    },
    { replace: true },
);

// 丸椅子：座面・ポール・台座の3つの円柱。断面の角数は既存の面と同じ（20 / 12 / 16）。
// 線は今の描き方（視線に直角な位置の側面線＝シルエット）を残す。視線で決まる線は
// 部品の一覧からは作れないため。
ASSET_KIT.define(
    "stool",
    { label: "丸椅子" },
    (o, K) => {
        const g = stoolGeometry(o);
        return [
            K.cylinder(g.seatR, g.seatBottom, g.h, { seg: 20 }), // 座面
            K.cylinder(g.legR, g.baseTop, g.poleTop, { seg: 12 }), // ポール
            K.cylinder(g.baseR, 0, g.baseH, { seg: 16 }), // 台座
        ];
    },
    { replace: true, lines: false },
);

// 手すり：柱・足元の板・横桟・縦棒を、すべて直方体（箱）の一覧にする。
// 線は今の描き方（部材の選び方まで作り込んである）を残す。
ASSET_KIT.define(
    "railing",
    { label: "手すり", geometryBounds: () => !window.__legacyRailingBars }, 
    (o, K) => {
        const g = railingGeometry(o),
            zTop0 = Math.max(0, g.h - g.t),
            zBot1 = Math.min(g.h - g.t, g.bottom + g.t),
            footH = Math.min(g.h, Math.min(0.03, Math.max(0.012, g.bottom * 0.35))),
            footW = g.post * 1.5,
            railLen = (r) => Math.max(0.001, r.len - g.post), // 横桟は柱の間だけ
            parts = [];
        g.posts.forEach(({ x, y }) => {
            parts.push(K.box(K.rectPath(g.post, g.post, x, y), Math.min(footH, g.h), g.h)); // 柱
            parts.push(K.box(K.rectPath(footW, footW, x, y), 0, footH)); // 足元の板
        });
        g.runs.forEach((r) => {
            const cx = (r.a[0] + r.b[0]) / 2,
                cy = (r.a[1] + r.b[1]) / 2,
                len = railLen(r),
                bw = r.alongX ? len : g.t,
                bd = r.alongX ? g.t : len;
            parts.push(K.box(K.rectPath(bw, bd, cx, cy), zTop0, g.h)); // 上の横桟
            if (zBot1 > g.bottom) parts.push(K.box(K.rectPath(bw, bd, cx, cy), g.bottom, zBot1)); // 下の横桟
            if (zTop0 - zBot1 > 0.001)
                r.bars.forEach(([bx, by]) => parts.push(window.__legacyRailingBars ? K.box(K.rectPath(g.barT, g.barT, bx, by), zBot1, zTop0) : streetRoundPart(o,K,[[g.barT/2,g.barT/2,zBot1],[g.barT/2,g.barT/2,zTop0]],[],bx,by))); // 円柱の縦棒
        });
        return parts;
    },
    { replace: true, lines: false },
);

// ===== 店先（部品カタログの見本）=====
// 壁（穴あきの板）へ、窓・扉・日よけ・室外機・看板を「部品」として並べるだけ。
// 部品の中身（枠・ガラス・取っ手・ファン・文字）は asset-kit-parts.js が持っている。
ASSET_KIT.define(
    "shopFront",
    {
        label: "店先",
        glyph: "▥",
        w: 3.2,
        d: 1.6,
        h: 2.4,
        accent: "#e5c07b",
        shopWallThickness: 0.12,
        shopDoorWidth: 0.62,
        shopDoorHeight: 1.05,
        shopWindowWidth: 1.15,
        shopWindowHeight: 0.6,
    },
    (o, K) => {
        const W = Math.max(1.2, Math.abs(2 * o.ra)),
            H = Math.max(0.8, Math.abs(o.h)),
            T = Math.max(0.05, K.param(o, "shopWallThickness", 0.12)),
            dw = Math.max(0.3, K.param(o, "shopDoorWidth", 0.62)),
            dh = Math.min(H - 0.3, Math.max(0.5, K.param(o, "shopDoorHeight", 1.05))),
            ww = Math.max(0.3, K.param(o, "shopWindowWidth", 1.15)),
            wh = Math.max(0.25, K.param(o, "shopWindowHeight", 0.6)),
            doorX = -W * 0.28,
            winX = W * 0.2,
            winZ = Math.min(H - wh / 2 - 0.1, dh * 0.95 + wh / 2);
        return [
            // 壁：扉と窓の位置に穴をあける（部品はその穴へ入る）。
            K.box(K.offsetPath(K.rectPath(W, H), 0, H / 2), -T / 2, T / 2, {
                axis: "y",
                holes: [K.offsetPath(K.rectPath(dw, dh), doorX, dh / 2), K.offsetPath(K.rectPath(ww, wh), winX, winZ)],
                holeSides: true,
            }),
            ...K.part("door", { w: dw, h: dh, d: T * 1.2, at: [doorX, 0, dh / 2] }),
            ...K.part("window", { w: ww, h: wh, d: T, at: [winX, 0, winZ] }),
            ...K.part("awning", { w: dw + 0.7, d: 0.62, z: dh + 0.42, at: [doorX, -0.31, 0] }),
            ...K.part("acUnit", { at: [W * 0.36, -T / 2 - 0.16, 0.06] }), // 壁の手前へ出す
            ...K.part("signBoard", { w: Math.min(W * 0.5, 1.5), h: 0.3, text: "", at: [winX, -T / 2 - 0.04, H - 0.28] }), // 無地の看板
        ];
    },
);

// 店先と同じカタログ部品を単体でも置けるようにする。
// 店先そのものは旧JSON互換のため登録を残すが、棚には出さない。
// テント2は、手前上端を固定して垂れを下へ伸ばす。壁側の上端だけを動かせる。
// 古いデータには設定がないため、従来の形の寸法から初期値を求める。
// モニター用の四面枠。折れ点は左右連動し、背面と下の枠は傾けない。
function screenHoodParams(o) {
    const w=Math.max(.1,Math.abs(2*Number(o.ra)||1.1)), h=Math.max(.1,Math.abs(Number(o.h)||.8)),
        length=Math.max(.005,Math.abs(2*Number(o.rb)||.4)),
        value=(key,f)=>o[key]!=null && Number.isFinite(Number(o[key])) ? Number(o[key]) : f,
        frameDepth=Math.max(.005,Math.min(length,value('hoodFrameDepth',length*.25))),
        brimLength=Math.max(0,length-frameDepth),
        rawT=Math.max(.005,Math.min(w*.4,h*.28,value('hoodThickness',.04))),
        rawB=Math.max(0,Math.min(w*.45,h*.45,value('hoodBevel',.1))),
        pad=Math.max(rawT,rawB)+.001,
        knee=Math.max(pad,Math.min(h-pad,value('hoodKnee',h*.55))),
        maxT=Math.max(.005,Math.min(w*.4,h*.28,knee-.001,h-knee-.001)),
        maxB=Math.max(0,Math.min(w*.45,h*.45,knee-.001,h-knee-.001)),
        t=Math.max(.005,Math.min(maxT,rawT)), bevel=Math.max(0,Math.min(maxB,rawB));
    return {w,h,length,frameDepth,brimLength,t,bevel,knee,maxT,maxB,kneeMin:Math.max(t,bevel)+.001,kneeMax:h-Math.max(t,bevel)-.001};
}
ASSET_KIT.define('screenHood',{
    label:'ひさし',glyph:'▣',group:'primitive',w:1.1,d:.4,h:.8,accent:'#86aac0',
    minHalfWidth:o=>Math.max(.05,(Number(o.hoodThickness)||.04)/.8,(Number(o.hoodBevel)||0)/.9),
    minHalfDepth:o=>Math.max(.0025,screenHoodParams(o).frameDepth/2),
    minHeight:o=>{const g=screenHoodParams(o);return Math.max(.1,g.knee+Math.max(g.t,g.bevel)+.001);},
    // 旧データの枠は旧表示どおり全奥行きの1/4から始め、編集後は実寸を保持。
    constrainEdit:(next,old,patch)=>{const g=screenHoodParams(old),q={...next,
        hoodFrameDepth:next.hoodFrameDepth??g.frameDepth,hoodKnee:next.hoodKnee??g.knee,
        hoodThickness:next.hoodThickness??g.t,hoodBevel:next.hoodBevel??g.bevel},
        has=k=>Object.prototype.hasOwnProperty.call(patch,k);
        if(has('hoodFrameDepth')) {
            q.hoodFrameDepth=clamp(Number(q.hoodFrameDepth)||g.frameDepth,.005,5);
            // APIから枠の長さだけを変えた場合も、背面を固定してつばの実寸を維持。
            if(!has('rb')) {
                const rb=(q.hoodFrameDepth+g.brimLength)/2,
                    anchored=ASSET_KIT.keepAnchorPatch(old,{rb},[0,old.rb,old.h],[0,rb,old.h]);
                q.rb=rb;if(anchored.off)q.off=anchored.off;
            }
        }
        if(has('rb'))q.rb=Math.max(q.hoodFrameDepth/2,Number(q.rb)||0);
        if(has('hoodThickness'))q.hoodThickness=clamp(Number(q.hoodThickness)||g.t,.005,g.maxT);
        if(has('hoodBevel'))q.hoodBevel=clamp(Number(q.hoodBevel)||0,0,g.maxB);
        if(has('hoodKnee'))q.hoodKnee=clamp(Number(q.hoodKnee)||g.knee,g.kneeMin,g.kneeMax);
        if(has('h'))q.h=Math.max(Number(q.h)||0,Number(q.hoodKnee)+Math.max(Number(q.hoodThickness)||0,Number(q.hoodBevel)||0)+.001,
            (Number(q.hoodThickness)||0)/.28,(Number(q.hoodBevel)||0)/.45,.1);
        return q;},
    controls:[
        {key:'hoodLength',label:'ひさしのつばの長さ',min:0,max:5,step:.01,unit:'m',
            get:o=>screenHoodParams(o).brimLength,
            patch:(o,v)=>{const g=screenHoodParams(o),rb=(g.frameDepth+v)/2;
                return ASSET_KIT.keepAnchorPatch(o,{rb},[0,o.rb,o.h],[0,rb,o.h]);},
            handle:(o,v)=>{const g=screenHoodParams(o),x=-g.w*.2,base=g.length/2-g.frameDepth;
                return {anchor:[x,base,g.h+.08],sample:[x,base-v,g.h+.08],probe:[x,base-v-1,g.h+.08],fallback:{x:0,y:1}};}},
        {key:'hoodFrameDepth',label:'枠の長さ',default:.1,min:.005,max:5,step:.01,unit:'m',
            get:o=>screenHoodParams(o).frameDepth,
            patch:(o,v)=>{const g=screenHoodParams(o),rb=(v+g.brimLength)/2;
                return ASSET_KIT.keepAnchorPatch(o,{rb,hoodFrameDepth:v},[0,o.rb,o.h],[0,rb,o.h]);},
            handle:(o,v)=>{const g=screenHoodParams(o),x=g.w*.28,back=g.length/2,z=g.knee*.3;
                return {anchor:[x,back,z],sample:[x,back-v,z],probe:[x,back-v-1,z],fallback:{x:0,y:1}};}},
        {key:'hoodKnee',label:'ひさしの傾き（折れ点の高さ）',min:o=>screenHoodParams(o).kneeMin,max:o=>screenHoodParams(o).kneeMax,step:.01,unit:'m',
            get:o=>screenHoodParams(o).knee,
            handle:(o,v)=>{const g=screenHoodParams(o),x=g.w/2,y=g.length/2-g.frameDepth;
                return {anchor:[x,y,0],sample:[x,y,v],probe:[x,y,v+1],fallback:{x:0,y:-1}};}},
        {key:'hoodThickness',label:'ひさしの厚さ',default:.04,min:.005,max:o=>screenHoodParams(o).maxT,step:.005,unit:'m',
            handle:(o,v)=>{const g=screenHoodParams(o),x=-g.w/2,y=g.length/2-g.frameDepth,z=g.knee*.55;
                return {anchor:[x,y,z],sample:[x+v,y,z],probe:[x+v+1,y,z],fallback:{x:1,y:0}};}},
        {key:'hoodBevel',label:'上下の角のベベル',type:'range',default:.1,min:0,max:o=>screenHoodParams(o).maxB,step:.005,unit:'m',
            handle:(o,v)=>{const g=screenHoodParams(o),x=g.w/2,y=-g.length/2;
                return {anchor:[x,y,g.h+.1],sample:[x-v,y,g.h+.1],probe:[x-v-1,y,g.h+.1],fallback:{x:-1,y:0}};}}
    ]
},(o,K)=>{const g=screenHoodParams(o);return K.part('screenHood',{w:g.w,h:g.h,frameDepth:g.frameDepth,brimLength:g.brimLength,knee:g.knee,t:g.t,bevel:g.bevel});});

function shopAwningParams(o) {
    const w=Math.max(.1,Math.abs(2*Number(o.ra)||1.32)), d=Math.max(.06,Math.abs(2*Number(o.rb)||.66)),
        h=Math.max(.12,Math.abs(Number(o.h)||.42)),
        read=(key,fallback)=>o[key]!=null && Number.isFinite(Number(o[key])) ? Number(o[key]) : fallback,
        front=Math.max(.01,Math.min(h-.01,read('shopAwningFrontZ',h/3))),
        valance=Math.max(.005,Math.min(5,read('shopAwningValanceH',h/3))),
        t=Math.max(.005,Math.min(w*.4,d*.4,read('shopAwningThickness',Math.min(.04,w*.1,d*.18,h*(.04/.42)))));
    return {w,d,h,front,valance,t};
}
// 傾きの回転中心は全高の中央なので、上辺を動かすと中心も動く。
// オブジェクトのオフセットを変換基底から補正し、手前上端をワールド上で固定する。
function shopAwningKeepFront(next,old) {
    if (old.attachment || !(Number(old.rotX)||Number(old.rotZ))) return next;
    const p=[0,0,shopAwningParams(old).front], target=L2W(old,...p), base=L2W(next,...p),
        off=Array.isArray(next.off)?next.off.slice():[0,0,0],
        columns=[0,1,2].map(i=>{const q=off.slice();q[i]+=1;return L2W({...next,off:q},...p).map((v,j)=>v-base[j]);}),
        cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
        dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0), delta=target.map((v,i)=>v-base[i]),
        det=dot(columns[0],cross(columns[1],columns[2]));
    if (Math.abs(det)<1e-9) return next;
    const change=[dot(delta,cross(columns[1],columns[2]))/det,dot(delta,cross(columns[2],columns[0]))/det,dot(delta,cross(columns[0],columns[1]))/det];
    return {...next,off:off.map((v,i)=>v+change[i])};
}
ASSET_KIT.define('shopAwning', {
    label:'テント2', glyph:'▰', group:'buildingParts', w:1.32, d:.66, h:.42, accent:'#d98b68',
    minHalfWidth:o=>Math.max(.05,(Number(o.shopAwningThickness)||shopAwningParams(o).t)/.8),
    minHalfDepth:o=>Math.max(.03,(Number(o.shopAwningThickness)||shopAwningParams(o).t)/.8),
    minHeight:o=>Math.max(.12,(Number(o.shopAwningFrontZ)||shopAwningParams(o).front)+.01),
    // サイズを変えても、未編集だった垂れや手前上端が比率で動かないよう実寸を保存する。
    constrainEdit:(next,old,patch)=>{const g=shopAwningParams(old), q={...next,
        shopAwningFrontZ:next.shopAwningFrontZ ?? g.front,
        shopAwningValanceH:next.shopAwningValanceH ?? g.valance,
        shopAwningThickness:next.shopAwningThickness ?? g.t};
        if (Object.prototype.hasOwnProperty.call(patch,'h') && !['lift','off','rot','rotX','rotZ','ca','cb','k'].some(k=>Object.prototype.hasOwnProperty.call(patch,k))) {
            q.h=Math.max(.12,q.shopAwningFrontZ+.01,Number(q.h)||0);
            return shopAwningKeepFront(q,old);
        }
        return q;},
    controls:[
        {key:'shopAwningValanceH',label:'のれんの高さ',min:.005,max:5,step:.01,unit:'m',get:o=>shopAwningParams(o).valance,
            handle:(o,v)=>{const g=shopAwningParams(o),x=-g.w*.25,y=-g.d/2;
                return {anchor:[x,y,g.front],sample:[x,y,g.front-v],probe:[x,y,g.front-v-1],fallback:{x:0,y:1}};}},
        {key:'shopAwningTopZ',label:'斜面の上辺の高さ',min:o=>Math.max(.12,shopAwningParams(o).front+.01),max:5,step:.05,unit:'m',get:o=>shopAwningParams(o).h,
            patch:(o,v)=>({h:v}),
            handle:(o,v)=>{const g=shopAwningParams(o),x=g.w*.25,y=g.d/2;
                return {anchor:[x,y,g.front],sample:[x,y,v],probe:[x,y,v+1],fallback:{x:0,y:-1}};}}
    ]
}, (o,K)=>{
    const g=shopAwningParams(o);
    return K.part('awning', {w:g.w,d:g.d-g.t,z:g.h,drop:g.h-g.front,valanceH:g.valance,
        t:g.t,arms:false,at:[0,g.t/2,0]})
        .map(part=>({...part,onFace:true,preciseTubeEdge:true}));
});
ASSET_KIT.define('shopWindow', {
    label:'窓', glyph:'▣', group:'buildingParts', w:1.15, d:.12, h:.6, accent:'#9bbbc7',
    // ガラス面より中央桟を手前に保ち、窓を薄くした際に桟が消えないようにする。
    minHalfWidth:()=>.05, minHalfDepth:()=>.015, minHeight:()=>.1
}, (o,K)=>{
    const w=Math.max(.1,Math.abs(2*o.ra)), d=Math.max(.03,Math.abs(2*o.rb)), h=Math.max(.1,Math.abs(o.h));
    return K.part('window', {w,h,d,mullion:true,at:[0,0,h/2]})
        .map(part=>({...part,onFace:true,preciseTubeEdge:true}));
});

// ===== 室外機 =====
// 参考写真のとおり「箱の胴＋前面の大きな丸いファン（同心のガード）＋側面のルーバー＋脚」。
// 胴は角を丸めた箱を奥行きへ押し出し、前面に丸い穴をあけて、その中に羽根を入れる
// （穴の内側の壁も作るので、正面から見て「えぐれている」ように見える）。
ASSET_KIT.define(
    "outdoorUnit",
    {
        label: "室外機",
        glyph: "▤",
        w: 0.86,
        d: 0.34,
        h: 0.66,
        accent: "#b9c6cc",
        ouCorner: 0.045, // 胴の縦の角の丸み（m）
        ouFanRatio: 0.78, // ファンの直径 ÷ 胴の高さ
        ouFanX: -0.1, // ファンの中心の左右位置（m・実寸。幅を変えても動かない）
        ouBlades: 5, // 羽根の枚数
        ouRings: 3, // ガード（同心の輪）の本数
        ouLouvers: 8, // 側面のルーバーの枚数
        ouLegH: 0.12, // 脚（ブラケット）の高さ（m）
        ouPipes: true, // 奥の配管を出す
    },
    (o, K) => {
        // 寸法は outdoorUnitGeometry()（engine-gizmo.js）と共有する。
        // ハンドルで動かす値と形が食い違わないよう、計算は1か所だけに置く。
        const g = outdoorUnitGeometry(o),
            { W, D, H, legH, bodyH, bodyCz, fanR, fanX, corner } = g,
            blades = Math.max(2, Math.min(9, Math.round(K.param(o, "ouBlades", 5)))),
            rings = Math.max(0, Math.min(5, Math.round(K.param(o, "ouRings", 3)))),
            louvers = Math.max(0, Math.min(16, Math.round(K.param(o, "ouLouvers", 8)))),
            front = -D / 2,
            body = K.offsetPath(K.roundRectPath(W, bodyH, corner, 2), 0, bodyCz),
            holeC = [fanX, bodyCz],
            parts = [
                // 1) 胴（前面に丸い穴）＋奥の板（穴を裏から塞ぐ）
                K.box(body, front, D / 2, {
                    axis: "y",
                    holes: [K.offsetPath(K.circlePath(fanR, 30), holeC[0], holeC[1])],
                    holeSides: true,
                }),
                K.box(body, D / 2 - 0.014, D / 2, { axis: "y" }),
            ];
        // 2) 羽根（穴の中。少し奥へ入れて、ガードの後ろに見えるようにする）
        for (let i = 0; i < blades; i++) {
            const a = (i / blades) * 360,
                bw = fanR * 0.42, // 羽根は穴（円）からはみ出さない太さにする
                blade = K.rotatePath(
                    [
                        [fanR * 0.24, -bw * 0.3],
                        [fanR * 0.84, -bw * 0.5],
                        [fanR * 0.88, bw * 0.4],
                        [fanR * 0.32, bw * 0.46],
                    ],
                    a,
                );
            parts.push(...K.moveParts([K.box(blade, front + 0.05, front + 0.068, { axis: "y" })], fanX, 0, bodyCz));
        }
        // 3) ガード（同心の輪）と中心のハブ
        for (let i = 0; i < rings; i++) {
            const r = fanR * (0.42 + (0.52 * i) / Math.max(1, rings - 1));
            parts.push(...K.moveParts([K.cylinder(r, front - 0.006, front + 0.004, { axis: "y", seg: 30, caps: false })], fanX, 0, bodyCz));
        }
        parts.push(...K.moveParts([K.cylinder(fanR * 0.15, front - 0.02, front + 0.03, { axis: "y", seg: 16 })], fanX, 0, bodyCz));
        // 4) 側面のルーバー（右側。細い板を等間隔に並べる）
        if (louvers)
            parts.push(
                ...K.repeat(louvers, (i) => {
                    const t = louvers > 1 ? i / (louvers - 1) : 0.5,
                        z = legH + bodyH * (0.14 + 0.72 * t);
                    return K.box(K.rectPath(D * 0.74, 0.02, 0, z), W / 2 - 0.004, W / 2 + 0.005, { axis: "x" });
                }),
            );
        // 5) 脚（2本）と、奥へ出る配管（右の奥）
        [-W * 0.34, W * 0.34].forEach((x) => parts.push(...K.moveParts([K.box(K.rectPath(W * 0.13, D * 0.84), 0, legH)], x, 0, 0)));
        if (o.ouPipes !== false)
            [0, 1].forEach((i) =>
                parts.push(
                    ...K.moveParts(
                        [K.cylinder(0.014, 0.02, legH + bodyH * 0.6, { axis: "z", seg: 8 })],
                        W / 2 - 0.07 - i * 0.045,
                        D / 2 - 0.05, // 奥の面から立つ配管
                        0,
                    ),
                ),
            );
        return parts;
    },
);


// ===== 信号機・標識（ポールもの）=====
// 4種はどれも「台座＋ポール＋頭（信号機／標識板）」の同じ骨格で、違うのは頭の中身だけ。
// 寸法は signalGeometry()（engine-gizmo.js）と共有する。画面の「ポール」ハンドルが動かすのは
// アセットの高さ h そのものなので、ハンドルの値と描かれる形が食い違わない。
// 円筒・円錐台の見える側面と背面の境目を、実際の面と視点から選ぶ。
// 固定の0番・半周の縦線では横から見たときに2本が中央に重なり、輪郭が消える。
function signalPoleContour(part, o) {
    if (!o) return part;
    const rings = part.rings || [{path:part.path,w:part.z0},{path:part.path,w:part.z1}];
    if (rings.length < 2 || !rings[0].path || !rings[1].path) return part;
    const a=rings[0], b=rings[rings.length-1], n=Math.min(a.path.length,b.path.length);
    const sub=(x,y)=>x.map((v,i)=>v-y[i]), dot=(x,y)=>x.reduce((v,w,i)=>v+w*y[i],0),
        cross=(x,y)=>[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]],
        p=(r,i)=>L2W(o,r.path[i][0],r.path[i][1],r.w),
        center=L2W(o,0,0,a.w),
        toward=orthView ? orthBasis().depth.map(v=>-v) : null,
        faces=[];
    for(let i=0;i<n;i++) {
        const A=p(a,i),B=p(a,(i+1)%n),D=p(b,i),normal=cross(sub(B,A),sub(D,A)),
            radial=sub(A,center), direction=toward || sub(camPos(),A);
        if(dot(normal,radial)<0) for(let j=0;j<3;j++)normal[j]=-normal[j];
        faces.push(dot(normal,direction)>1e-12);
    }
    const edges=[];
    for(let i=0;i<n;i++)if(faces[(i+n-1)%n]!==faces[i])edges.push(i);
    part.verticals=edges.length===2 ? edges : [0,Math.floor(n/2)];
    return part;
}
// 灯器の丸角や円形標識は多角形で面を作っているが、分割ごとの縦線は
// 本来の縞模様ではない。前後の輪は維持し、奥行き方向は輪郭の2本だけ。
function signalSmoothSides(part, o, K) {
    if (!o || window.__legacySignalSmooth) return part;
    if (part?.circularHood && part.meshEdges?.length >= 3) {
        const frontLoop = part.meshEdges[0], backLoop = part.meshEdges[2],
            n = Math.min(frontLoop.length, backLoop.length) - 1;
        if (n > 4) {
            const sub = (a, b) => a.map((v, i) => v - b[i]),
                dot = (a, b) => a.reduce((v, w, i) => v + w * b[i], 0),
                origin = L2W(o, 0, 0, 0),
                u = sub(L2W(o, 1, 0, 0), origin),
                v = sub(L2W(o, 0, 0, 1), origin),
                eye = orthView ? orthBasis().depth.map((x) => -x) : sub(camPos(), origin),
                eu = dot(eye, u),
                ev = dot(eye, v),
                path = frontLoop.slice(0, n).map((p) => [p[0], p[2]]),
                winding = path.reduce((a, p, i) => a + p[0] * path[(i + 1) % n][1] - path[(i + 1) % n][0] * p[1], 0) >= 0 ? 1 : -1,
                faces = [];
            for (let i = 0; i < n; i++) {
                const a = path[i], b = path[(i + 1) % n], du = b[0] - a[0], dv = b[1] - a[1],
                    cu = orthView ? eu : eu - a[0], cv = orthView ? ev : ev - a[1];
                faces.push(winding * (dv * cu - du * cv) > 1e-12);
            }
            const idx = [];
            for (let i = 0; i < n; i++) if (faces[(i + n - 1) % n] !== faces[i]) idx.push(i);
            const picks = idx.length === 2 ? idx : [0, Math.floor(n / 2)],
                base = part.circularBaseEdges || 3;
            part.meshEdges.length = base;
            if (part.seamMarks) part.seamMarks.length = base;
            for (const i of picks) {
                part.meshEdges.push([frontLoop[i], backLoop[i]]);
                if (part.seamMarks) part.seamMarks.push(null);
            }
            part.signalSmoothSide = true;
        }
        return part;
    }
    if (!part?.path || part.path.length <= 4) return part;
    const axis=part.axis || "z", sub=(a,b)=>a.map((v,i)=>v-b[i]),
        dot=(a,b)=>a.reduce((v,w,i)=>v+w*b[i],0),
        // L2Wは回転・移動のアフィン変換なので、断面2軸だけを一度求める。
        // 断面の各点にL2Wを3回ずつ呼ぶと、標識を大量に置いた時に重くなる。
        origin=L2W(o,0,0,0),
        uv=axis === "y" ? [[1,0,0],[0,0,1]] : axis === "x" ? [[0,1,0],[0,0,1]] : [[1,0,0],[0,1,0]],
        u=sub(L2W(o,...uv[0]),origin),v=sub(L2W(o,...uv[1]),origin),
        eye=orthView ? orthBasis().depth.map(x=>-x) : sub(camPos(),origin),
        eu=dot(eye,u),ev=dot(eye,v);
    const contour=path=>{
        const n=path.length, faces=[],
            winding=path.reduce((a,p,i)=>a+p[0]*path[(i+1)%n][1]-path[(i+1)%n][0]*p[1],0) >= 0 ? 1 : -1;
        for(let i=0;i<n;i++){
            const a=path[i],b=path[(i+1)%n],du=b[0]-a[0],dv=b[1]-a[1],
                cu=orthView ? eu : eu-a[0],cv=orthView ? ev : ev-a[1];
            faces.push(winding*(dv*cu-du*cv)>1e-12);
        }
        const indices=[];for(let i=0;i<n;i++)if(faces[(i+n-1)%n]!==faces[i])indices.push(i);
        return indices.length===2 ? indices : [0,Math.floor(n/2)];
    };
    part.sideVerticals=contour(part.path);
    if(part.holeSides)part.holeSideVerticals=(part.holes||[]).map(h=>h.length>4 ? contour(h) : h.map((_,i)=>i));
    part.signalSmoothSide=true;
    return part;
}
function signalPoleParts(K, g, o) {
    // 台座は「平たい底板＋すぼまる首」の2段。首を十分な高さにしないと、
    // 線画ではポールの下に小さな三角が付いただけに見えて形が読めない。
    const plateH = Math.max(0.02, g.baseH * 0.28),
        collarH = Math.max(0.05, g.baseH * 0.62),
        poleR = g.poleR,
        collarTop = plateH + collarH;
    return [
        // 底板：平たい円盤。視点から見た輪郭2本で厚みを見せる。
        signalPoleContour(K.cylinder(g.baseR, 0, plateH, { seg: 14, verts: 2 }), o),
        // 首：底板からポールへすぼまる円錐台。
        // 首の両側は実際の円錐台の面と視点から輪郭を選ぶ。
        // 視点が正面で固定されていない場合も、輪だけの形にしない。
        signalPoleContour(Object.assign(
            K.revolution(
                [
                    [g.baseR * 0.76, plateH],
                    [Math.max(poleR * 1.6, g.baseR * 0.3), collarTop],
                ],
                { seg: 14 },
            ),
            { verticals: [0, 7] },
        ), o),
        // ポール：首の中から頭のすぐ下まで。視点から見た実際の左右の縁を使う。
        signalPoleContour(Object.assign(K.cylinder(poleR, collarTop - 0.01, g.poleTop, { seg: 12, verts: 2 }), {signalPoleTopRing:true}), o),
    ];
}

// 横腕の長さは灯器と支柱の隙間。灯器の寸法や高さは変えない。
function signalArmControl() { return {key:'signalArmGap',label:'横腕の長さ',default:.4,min:.05,max:4,step:.05,unit:'m',handle:(o,v)=>{const g=signalGeometry(o),x=g.headX;return {anchor:[0,0,g.H],sample:[x,0,g.H],probe:[x+1,0,g.H],fallback:{x:1,y:0}};}}; }
function trafficSignalHoodGeometry(o) {
    const g = signalGeometry(o),
        front = -g.headD / 2,
        lampR = Math.max(0.02, ASSET_KIT.param(o, "tsLampR", 0.125)),
        s = Math.min(lampR * 2.28, g.headW * 0.285, g.headH * 0.88),
        t = Math.max(0.007, Math.min(0.016, s * 0.055)),
        pad = t + Math.min(0.001, s * 0.02),
        kneeMin = +(pad + 0.001).toFixed(4),
        kneeMax = +Math.max(kneeMin + 0.01, s - pad - 0.001).toFixed(4),
        defaultBrim = 0.12,
        defaultKnee = +clamp(s * 0.25, kneeMin, kneeMax).toFixed(3),
        rawLegacy = o?.tsHood !== undefined ? Number(o.tsHood) : undefined,
        enabled = o?.signalHood !== false && !(rawLegacy !== undefined && rawLegacy <= 0.01 && o?.tsHoodLength === undefined),
        rawBrim = Number.isFinite(Number(o?.tsHoodLength))
            ? Number(o.tsHoodLength)
            : rawLegacy !== undefined && rawLegacy > 0.01
              ? Math.abs(rawLegacy - 0.1) < 1e-6
                  ? defaultBrim
                  : rawLegacy
              : defaultBrim,
        brimLength = clamp(rawBrim, 0, 0.6),
        frameDepth = 0.022,
        rawKnee = Number.isFinite(Number(o?.tsHoodKnee)) ? Number(o.tsHoodKnee) : defaultKnee,
        knee = clamp(rawKnee, kneeMin, kneeMax);
    return { g, front, lampR, s, t, pad, kneeMin, kneeMax, defaultBrim, defaultKnee, enabled, brimLength, frameDepth, knee };
}
function trafficSignalHoodControls() {
    return [
        {
            key: "signalHood",
            label: "ひさし",
            type: "boolean",
            default: true,
            canvasToggle: true,
            get: (o) => trafficSignalHoodGeometry(o).enabled,
            patch: (o, v) => ({
                signalHood: !!v,
                ...(v && Number(o?.tsHood) <= 0.01 ? { tsHood: 0.1 } : {}),
            }),
        },
        {
            key: "tsHoodLength",
            label: "ひさしのつばの長さ",
            min: 0,
            max: 0.6,
            step: 0.01,
            unit: "m",
            get: (o) => trafficSignalHoodGeometry(o).brimLength,
            patch: (o, v) => ({ tsHoodLength: clamp(Number(v) || 0, 0, 0.6) }),
            handle: (o, v) => {
                const p = trafficSignalHoodGeometry(o);
                if (!p.enabled) return null;
                const x = (p.g.suspended ? p.g.headX : 0) - p.g.headW * 0.3,
                    baseY = p.front - 0.0015 - p.frameDepth,
                    z = p.g.headCz + p.s / 2;
                return {
                    anchor: [x, baseY, z],
                    sample: [x, baseY - v, z],
                    probe: [x, baseY - v - 1, z],
                    fallback: { x: 0, y: 1 },
                };
            },
        },
        {
            key: "tsHoodKnee",
            label: "ひさしの傾き（折れ点の高さ）",
            min: (o) => trafficSignalHoodGeometry(o).kneeMin,
            max: (o) => trafficSignalHoodGeometry(o).kneeMax,
            step: 0.005,
            unit: "m",
            get: (o) => trafficSignalHoodGeometry(o).knee,
            patch: (o, v) => {
                const p = trafficSignalHoodGeometry(o);
                return { tsHoodKnee: clamp(Number(v) ?? p.knee, p.kneeMin, p.kneeMax) };
            },
            handle: (o, v) => {
                const p = trafficSignalHoodGeometry(o);
                if (!p.enabled) return null;
                const x = (p.g.suspended ? p.g.headX : 0) - p.g.headW * 0.3 - p.s / 2,
                    y = p.front - 0.0015 - p.frameDepth,
                    z0 = p.g.headCz - p.s / 2;
                return {
                    anchor: [x, y, z0],
                    sample: [x, y, z0 + v],
                    probe: [x, y, z0 + v + 1],
                    fallback: { x: 0, y: -1 },
                };
            },
        },
    ];
}
function signalLampHoodParts(K, cx, cz, front, w, h, hood, bevel, group, kneeRatio = 0.24, circular = false, explicitKnee = null, explicitFrameDepth = null) {
    const frameDepth = explicitFrameDepth !== null ? explicitFrameDepth : Math.max(0.018, Math.min(0.028, hood * 0.3)),
        brimLength = Math.max(0, hood),
        t = Math.max(0.007, Math.min(0.016, Math.min(w, h) * 0.055)),
        b = circular ? 0 : Math.max(0, Math.min(bevel, Math.min(w, h) * 0.38)),
        pad = Math.max(circular ? t : b, t) + Math.min(0.001, h * 0.02),
        knee = explicitKnee !== null ? clamp(explicitKnee, pad, Math.max(pad, h - pad)) : Math.max(pad + 0.001, h * kneeRatio),
        backY = front - 0.0015,
        hoodY = backY - (frameDepth + brimLength) / 2;
    return K.moveParts(
        K.part("screenHood", {
            w,
            h,
            frameDepth,
            brimLength,
            knee,
            t,
            bevel: b,
            circular,
            group,
            noBackInner: true,
            noInnerSeam: true,
        }),
        cx,
        hoodY,
        cz - h / 2,
    );
}
function pedSignalHoodGeometry(o) {
    const g = signalGeometry(o),
        front = -g.headD / 2,
        lamp = Math.min(Math.max(0.1, ASSET_KIT.param(o, "psLamp", 0.25)), Math.min(g.headW - 0.06, g.headH * 0.45)),
        topCz = g.headBottom + g.headH * 0.72,
        bottomCz = g.headBottom + g.headH * 0.27,
        w = Math.min(lamp * 1.18, g.headW - 0.02),
        h = Math.min(lamp * 1.18, g.headH * 0.43),
        t = Math.max(0.007, Math.min(0.016, Math.min(w, h) * 0.055)),
        bevel = Math.max(0, Math.min(Math.min(0.03, Math.min(w, h) * 0.16), Math.min(w, h) * 0.38)),
        pad = Math.max(t, bevel) + Math.min(0.001, h * 0.02),
        kneeMin = +(pad + 0.001).toFixed(4),
        kneeMax = +Math.max(kneeMin + 0.01, h - pad - 0.001).toFixed(4),
        defaultBrim = 0.09,
        defaultKnee = +clamp(h * 0.35, kneeMin, kneeMax).toFixed(3),
        rawLegacy = o?.psHood !== undefined ? Number(o.psHood) : undefined,
        enabled = o?.signalHood !== false && !(rawLegacy !== undefined && rawLegacy <= 0.01 && o?.psHoodLength === undefined),
        rawBrim = Number.isFinite(Number(o?.psHoodLength))
            ? Number(o.psHoodLength)
            : rawLegacy !== undefined && rawLegacy > 0.01
              ? Math.abs(rawLegacy - 0.06) < 1e-6
                  ? defaultBrim
                  : rawLegacy
              : defaultBrim,
        brimLength = clamp(rawBrim, 0, 0.6),
        frameDepth = 0.022,
        rawKnee = Number.isFinite(Number(o?.psHoodKnee)) ? Number(o.psHoodKnee) : defaultKnee,
        knee = clamp(rawKnee, kneeMin, kneeMax);
    return { g, front, lamp, topCz, bottomCz, w, h, t, bevel, pad, kneeMin, kneeMax, defaultBrim, defaultKnee, enabled, brimLength, frameDepth, knee };
}
function pedSignalHoodControls() {
    return [
        {
            key: "signalHood",
            label: "ひさし",
            type: "boolean",
            default: true,
            canvasToggle: true,
            get: (o) => pedSignalHoodGeometry(o).enabled,
            patch: (o, v) => ({
                signalHood: !!v,
                ...(v && Number(o?.psHood) <= 0.01 ? { psHood: 0.06 } : {}),
            }),
        },
        {
            key: "psHoodLength",
            label: "ひさしのつばの長さ",
            min: 0,
            max: 0.6,
            step: 0.01,
            unit: "m",
            get: (o) => pedSignalHoodGeometry(o).brimLength,
            patch: (o, v) => ({ psHoodLength: clamp(Number(v) || 0, 0, 0.6) }),
            handle: (o, v) => {
                const p = pedSignalHoodGeometry(o);
                if (!p.enabled) return null;
                const x = (p.g.suspended ? p.g.headX : 0) - p.w * 0.25,
                    baseY = p.front - 0.0015 - p.frameDepth,
                    z = p.topCz + p.h / 2;
                return {
                    anchor: [x, baseY, z],
                    sample: [x, baseY - v, z],
                    probe: [x, baseY - v - 1, z],
                    fallback: { x: 0, y: 1 },
                };
            },
        },
        {
            key: "psHoodKnee",
            label: "ひさしの傾き（折れ点の高さ）",
            min: (o) => pedSignalHoodGeometry(o).kneeMin,
            max: (o) => pedSignalHoodGeometry(o).kneeMax,
            step: 0.005,
            unit: "m",
            get: (o) => pedSignalHoodGeometry(o).knee,
            patch: (o, v) => {
                const p = pedSignalHoodGeometry(o);
                return { psHoodKnee: clamp(Number(v) ?? p.knee, p.kneeMin, p.kneeMax) };
            },
            handle: (o, v) => {
                const p = pedSignalHoodGeometry(o);
                if (!p.enabled) return null;
                const x = (p.g.suspended ? p.g.headX : 0) - p.w / 2,
                    y = p.front - 0.0015 - p.frameDepth,
                    z0 = p.bottomCz - p.h / 2;
                return {
                    anchor: [x, y, z0],
                    sample: [x, y, z0 + v],
                    probe: [x, y, z0 + v + 1],
                    fallback: { x: 0, y: -1 },
                };
            },
        },
    ];
}
function signalArmParts(o,K,g,headParts) {
    if(!g.suspended)return headParts;
    const moved=K.moveParts(headParts,g.headX,0,0).map(p=>p.signalSmoothSide?signalSmoothSides(p,o,K):p),
        arm=K.box(K.rectPath(g.headX+g.poleR*2,g.armThickness,g.headX/2,0),g.H-g.armThickness,g.H),
        lowerSupport=o.asset==="pedSignal"&&o.pedSignalLowerSupport===true
            ? K.box(K.rectPath(g.headX+g.poleR*2,g.armThickness*.7,g.headX/2,0),g.headBottom-.045,g.headBottom,{pedSignalLowerSupport:true})
            : null;
    return [arm,...(lowerSupport?[lowerSupport]:[]),...moved];
}
// --- 1) 車両用信号機（横3灯）---
ASSET_KIT.define(
    "trafficSignal",
    {
        label: "信号機",
        glyph: "◉",
        w: 1.05,
        d: 0.24,
        h: 2.8,
        accent: "#5c6b73",
        geometryBounds: true,
        controls: [...trafficSignalHoodControls(), depthBevelControl("spDepthBevel", 0.05, true), signalArmControl()],
        spHeadH: 0.34, // 灯器（頭）の高さ
        spPoleR: 0.042, // ポールの半径
        spBaseR: 0.16, // 台座の半径
        spBaseH: 0.16, // 台座の高さ（底板＋首）
        tsLampR: 0.125, // 灯の半径
        tsHood: 0.1, // ひさし（フード）の長さ
    },
    (o, K) => {
        const hp = trafficSignalHoodGeometry(o),
            { g, front, lampR, s: hoodS } = hp,
            pole = signalPoleParts(K, g, o), parts = [];
        // 灯器：角を丸めた横長の箱
        parts.push(signalSmoothSides(K.depthBeveledBox(g.headW, g.headD, g.headH, K.param(o, "spDepthBevel", 0.05), {seg: 3, z0: g.headBottom}), o, K));
        // 灯（青・黄・赤）と、灯のまわりの上が張り出す斜めひさし
        const lensFront = hp.enabled && !window.__legacySignalMount ? front - 0.005 : front - 0.024,
            lensBack = hp.enabled && !window.__legacySignalMount ? front - 0.0015 : front - 0.008;
        [-1, 0, 1].forEach((i) => {
            const x = i * g.headW * 0.3;
            parts.push(...K.moveParts([Object.assign(K.cylinder(lampR, lensFront, lensBack, { axis: "y", seg: 20 }), { preciseTubeEdge: true })], x, 0, g.headCz));
            if (hp.enabled) {
                if (window.__legacySignalMount) {
                    const legacyHood = Math.max(0.02, K.param(o, "tsHood", 0.1));
                    parts.push(
                        ...K.moveParts([K.cylinder(lampR * 1.26, front - 0.012 - legacyHood, front + 0.004, { axis: "y", caps: false, seg: 22 })], x, 0, g.headCz),
                    );
                } else
                    parts.push(
                        ...signalLampHoodParts(
                            K,
                            x,
                            g.headCz,
                            front,
                            hoodS,
                            hoodS,
                            hp.brimLength,
                            0,
                            "tsHood" + (i + 1),
                            0.25,
                            true,
                            hp.knee,
                            hp.frameDepth,
                        ).map((p) => signalSmoothSides(p, o, K)),
                    );
            }
        });
        return [...pole,...signalArmParts(o,K,g,parts)];
    },
);

// --- 2) 歩行者用信号機（縦2灯）---
ASSET_KIT.define(
    "pedSignal",
    {
        label: "歩行者信号",
        glyph: "◍",
        w: 0.36,
        d: 0.22,
        h: 2.4,
        accent: "#5c6b73",
        geometryBounds: true,
        controls: [...pedSignalHoodControls(), depthBevelControl("spDepthBevel", 0.05, true), signalArmControl(), {key:"pedSignalLowerSupport",label:"下側の支え",type:"boolean",default:false,canvasToggle:true}],
        spHeadH: 0.66,
        spPoleR: 0.038,
        spBaseR: 0.15,
        spBaseH: 0.15,
        psLamp: 0.25, // 灯（四角）の一辺
        psHood: 0.06, // ひさし（四角い枠）の張り出し
    },
    (o, K) => {
        const hp = pedSignalHoodGeometry(o),
            { g, front, lamp, topCz, bottomCz } = hp,
            // 上=止まれ（赤）／下=進め（青）。灯の中心の高さ。
            lensFront = hp.enabled && !window.__legacySignalMount ? front - 0.005 : front - 0.022,
            lensBack = hp.enabled && !window.__legacySignalMount ? front - 0.0015 : front - 0.008,
            pole = signalPoleParts(K, g, o), parts = [],
            lens = (cz) => signalSmoothSides(K.box(K.offsetPath(K.roundRectPath(lamp, lamp, Math.min(0.03, lamp * 0.16), 2), 0, cz), lensFront, lensBack, { axis: "y" }), o, K);
        parts.push(signalSmoothSides(K.depthBeveledBox(g.headW, g.headD, g.headH, K.param(o, "spDepthBevel", 0.05), {seg: 3, z0: g.headBottom}), o, K));
        parts.push(lens(topCz), lens(bottomCz));
        // ひさし：各灯のまわりに、上が長く手前へ張り出し下が斜めに引っ込むひさしを付ける。
        if (hp.enabled)
            [topCz, bottomCz].forEach((cz, idx) => {
                if (window.__legacySignalMount) {
                    const legacyHood = Math.max(0.02, K.param(o, "psHood", 0.06));
                    parts.push(
                        signalSmoothSides(K.box(
                            K.offsetPath(K.roundRectPath(lamp * 1.2, lamp * 1.2, Math.min(0.03, lamp * 0.16), 2), 0, cz),
                            front - 0.01 - legacyHood,
                            front + 0.004,
                            {
                                axis: "y",
                                holes: [K.offsetPath(K.roundRectPath(lamp * 1.02, lamp * 1.02, Math.min(0.02, lamp * 0.1), 2), 0, cz)],
                                holeSides: true,
                            },
                        ), o, K),
                    );
                } else
                    parts.push(
                        ...signalLampHoodParts(
                            K,
                            0,
                            cz,
                            front,
                            hp.w,
                            hp.h,
                            hp.brimLength,
                            hp.bevel,
                            "psHood" + idx,
                            0.35,
                            false,
                            hp.knee,
                            hp.frameDepth,
                        ),
                    );
            });
        return [...pole,...signalArmParts(o,K,g,parts)];
    },
);

// --- 3) 丸標識（地下鉄の丸い看板）＋ 形と枚数を選べる仲間 ---
// 標識の板は「形（丸・逆三角形・四角・ひし形）」×「枚数（1枚・2枚）」で作れる。
// 2枚のときは頭の高さを2枚で分け、上の板の形は signShape2 で別に選べる。
function signPlateParts(K, opts, o) {
    const { cx, cz, w, h, shape, t, ring, band } = opts,
        y0 = -t / 2,
        y1 = t / 2,
        front = -t / 2,
        // 板の輪郭（x, z）。中心は (cx, cz)。
        outline = (w2, h2) => {
            if (shape === "triangle")
                return [
                    [-w2 / 2, cz + h2 / 2],
                    [w2 / 2, cz + h2 / 2],
                    [0, cz - h2 / 2], // 逆三角形（下が頂点）
                ];
            if (shape === "diamond")
                return [
                    [cx, cz + h2 / 2],
                    [cx + w2 / 2, cz],
                    [cx, cz - h2 / 2],
                    [cx - w2 / 2, cz],
                ];
            if (shape === "rect") return K.offsetPath(K.roundRectPath(w2, h2, Math.min(w2, h2) * 0.12, 2), cx, cz);
            return K.circlePath(Math.min(w2, h2) / 2, 26, cx, cz);
        },
        parts = [];
    // 1) 板本体（薄い板）
    const plate = K.box(outline(w, h), y0, y1, { axis: "y" });
    parts.push(shape === "circle" || shape === "rect" ? signalSmoothSides(plate, o, K) : plate);
    // 2) 内側の縁：少し小さくして手前へ出す（縁の線が面の内側の線として消えない）
    const inset = K.box(outline(w * ring, h * ring), front - 0.02, front - 0.006, { axis: "y" });
    parts.push(shape === "circle" || shape === "rect" ? signalSmoothSides(inset, o, K) : inset);
    // 3) 丸標識だけ、横に通る帯を付ける
    if (band && shape === "circle")
        parts.push(
            K.box(K.offsetPath(K.rectPath(w * 0.86, Math.max(0.03, h * 0.16)), cx, cz), front - 0.03, front - 0.016, { axis: "y" }),
        );
    return parts;
}
// 標識の共通の作り。meta の signShape / signCount / signShape2 を初期値にして、
// 画面から変えた値（o.signShape など）があればそちらを使う。
function signParts(o, K) {
    const metaOf = (key, dflt) => {
            const v = o?.[key];
            if (v !== undefined && v !== null && v !== "") return v;
            const m = ASSETS?.[o?.asset]?.[key];
            return m !== undefined && m !== null ? m : dflt;
        },
        SHAPES = ["circle", "triangle", "rect", "diamond"],
        shapeOf = (key, dflt) => {
            const v = String(metaOf(key, dflt));
            return SHAPES.includes(v) ? v : dflt;
        },
        g = signalGeometry(o),
        t = Math.max(0.02, g.headD),
        ring = Math.min(0.95, Math.max(0.3, K.param(o, "snRing", 0.72))),
        band = metaOf("snBand", true) !== false,
        count = Math.max(1, Math.min(2, Math.round(Number(metaOf("signCount", 1)) || 1))),
        shape1 = shapeOf("signShape", "circle"),
        shape2 = shapeOf("signShape2", shape1),
        gap = count === 2 ? Math.max(0.02, g.headH * 0.06) : 0,
        plateH = count === 2 ? Math.max(0.08, (g.headH - gap) / 2) : g.headH,
        cz1 = g.headBottom + plateH / 2,
        cz2 = g.headBottom + plateH + gap + plateH / 2,
        parts = signalPoleParts(K, g, o);
    parts.push(...signPlateParts(K, { cx: 0, cz: cz1, w: g.headW, h: plateH, shape: shape1, t, ring, band }, o));
    if (count === 2) parts.push(...signPlateParts(K, { cx: 0, cz: cz2, w: g.headW, h: plateH, shape: shape2, t, ring, band }, o));
    return parts;
}

// 丸標識（1枚）
ASSET_KIT.define(
    "signPost",
    {
        label: "丸標識",
        glyph: "◎",
        w: 0.42,
        d: 0.06,
        h: 2.6,
        accent: "#e2534b",
        spHeadH: 0.42,
        spPoleR: 0.042,
        spBaseR: 0.16,
        spBaseH: 0.16,
        signShape: "circle", // 板の形（circle / triangle / rect / diamond）
        signCount: 1, // 板の枚数（1 か 2）
        signShape2: "circle", // 2枚のときの上の板の形
        snRing: 0.72, // 内側の縁の大きさ（板に対する割合）
        snBand: true, // 丸のときに横へ通る帯を出す
    },
    signParts,
);

// 丸標識（2枚：丸＋四角）
ASSET_KIT.define(
    "signPost2",
    {
        label: "標識2枚",
        glyph: "◉",
        w: 0.42,
        d: 0.06,
        h: 2.8,
        accent: "#e2534b",
        spHeadH: 0.86,
        spPoleR: 0.042,
        spBaseR: 0.16,
        spBaseH: 0.16,
        signShape: "circle",
        signCount: 2,
        signShape2: "rect",
        snRing: 0.7,
        snBand: true,
    },
    signParts,
);

// 逆三角形の標識
ASSET_KIT.define(
    "signTriangle",
    {
        label: "三角標識",
        glyph: "▽",
        w: 0.46,
        d: 0.05,
        h: 2.6,
        accent: "#e2534b",
        spHeadH: 0.44,
        spPoleR: 0.042,
        spBaseR: 0.16,
        spBaseH: 0.16,
        signShape: "triangle",
        signCount: 1,
        snRing: 0.58,
        snBand: false,
    },
    signParts,
);

// ひし形の標識
ASSET_KIT.define(
    "signDiamond",
    {
        label: "ひし形標識",
        glyph: "◇",
        w: 0.44,
        d: 0.05,
        h: 2.6,
        accent: "#f0c419",
        spHeadH: 0.44,
        spPoleR: 0.042,
        spBaseR: 0.16,
        spBaseH: 0.16,
        signShape: "diamond",
        signCount: 1,
        snRing: 0.56,
        snBand: false,
    },
    signParts,
);

// 逆三角形＋丸の2枚
ASSET_KIT.define(
    "signCombo",
    {
        label: "標識2枚（三角＋丸）",
        glyph: "▽",
        w: 0.46,
        d: 0.05,
        h: 2.9,
        accent: "#e2534b",
        spHeadH: 0.9,
        spPoleR: 0.042,
        spBaseR: 0.16,
        spBaseH: 0.16,
        signShape: "circle",
        signCount: 2,
        signShape2: "triangle",
        snRing: 0.6,
        snBand: false,
    },
    signParts,
);

// --- 4) 踏切の標識（黄黒のX）---
ASSET_KIT.define(
    "crossingSign",
    {
        label: "踏切標識",
        glyph: "✕",
        w: 0.5,
        d: 0.1,
        h: 2.6,
        accent: "#f0c419",
        spHeadH: 0.46,
        spPoleR: 0.042,
        spBaseR: 0.16,
        spBaseH: 0.16,
        csBar: 0.13, // X の帯の太さ
    },
    (o, K) => {
        const g = signalGeometry(o),
            front = -g.headD / 2,
            bar = Math.max(0.03, K.param(o, "csBar", 0.13)),
            // 板の対角いっぱいにすると角から飛び出すので、少し短くする
            len = Math.min(g.headW, g.headH) * 1.16,
            plate = K.roundRectPath(g.headW, g.headH, Math.min(0.06, g.headH * 0.14), 2),
            parts = signalPoleParts(K, g, o);
        // 下地の板
        parts.push(signalSmoothSides(K.box(K.offsetPath(plate, 0, g.headCz), front + 0.005, front + g.headD, { axis: "y" }), o, K));
        // X：細長い板を±45°に回して前に重ねる
        [45, -45].forEach((deg) =>
            parts.push(
                K.box(
                    // 先に標識の中心へ置いてから回す（原点のまま回すと位置が飛ぶ）
                    K.rotatePath(K.offsetPath(K.rectPath(len, bar), 0, g.headCz), deg, 0, g.headCz),
                    front - 0.022,
                    front + 0.002,
                    { axis: "y" },
                ),
            ),
        );
        // 下の2つの赤い灯（踏切の警報灯）
        [-1, 1].forEach((i) =>
            parts.push(
                ...K.moveParts(
                    [K.cylinder(bar * 0.34, front - 0.05, front - 0.02, { axis: "y", seg: 14 })],
                    i * g.headW * 0.26,
                    0,
                    g.headBottom + g.headH * 0.16,
                ),
            ),
        );
        return parts;
    },
);

// 直方体アセットと同じZ押し出しベベル。丸めた上下縁ではなく、XY断面の角だけを処理する。
function beveledPrismPart(K,path,z0,z1,amount,segments=4,extra={}) {
    const bevel=Math.max(0,Number(amount)||0);
    if(bevel<=1e-5)return K.box(path,z0,z1,extra);
    const xs=path.map(p=>p[0]),ys=path.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),
        rect=path.length===4&&path.every(p=>([x0,x1].some(x=>Math.abs(p[0]-x)<1e-5)&&[y0,y1].some(y=>Math.abs(p[1]-y)<1e-5))),
        rounded=rect?beveledBoxFootprint(x1-x0,y1-y0,bevel,segments).map(([x,y])=>[x+(x0+x1)/2,y+(y0+y1)/2]):bevelPolygonPath(path,bevel,segments),
        group=extra.seamGroup??0,
        marks=rect?K.bevelMarks(rounded,bevel,segments,group):[null,null,...(rounded._bevelMarks||[]).map(m=>m?{...m,key:`${group}:${m.key}`} : null)],
        {seamGroup,...partExtra}=extra;
    return K.box(rounded,z0,z1,{...partExtra,sideVerticals:rounded.map((_,i)=>i),seamMarks:marks});
}
function bevelPolygonPath(path,amount,segments=4) {
    const n=path.length,b=Math.max(0,Number(amount)||0),steps=Math.max(1,Math.min(4,Math.round(segments)||4));
    if(n<3||b<1e-5)return path.map(p=>p.slice());
    const area=path.reduce((s,p,i)=>{const q=path[(i+1)%n];return s+p[0]*q[1]-q[0]*p[1];},0),orient=Math.sign(area)||1,out=[],marks=[];
    for(let i=0;i<n;i++){
        const p=path[i],prev=path[(i+n-1)%n],next=path[(i+1)%n],
            e1=[prev[0]-p[0],prev[1]-p[1]],e2=[next[0]-p[0],next[1]-p[1]],
            l1=Math.hypot(...e1),l2=Math.hypot(...e2),u=e1.map(x=>x/(l1||1)),v=e2.map(x=>x/(l2||1)),
            cross=u[0]*v[1]-u[1]*v[0],dot=Math.max(-1,Math.min(1,u[0]*v[0]+u[1]*v[1])),theta=Math.acos(dot);
        // 凹角は尖ったまま残す。凸角だけを丸め、L/U字の内側角を崩さない。
        if(cross*orient>=-1e-6||theta<1e-4||Math.PI-theta<1e-4){out.push(p.slice());marks.push(null);continue;}
        const tangent=Math.min(b/Math.tan(theta/2),l1*.42,l2*.42),radius=tangent*Math.tan(theta/2),
            a=[p[0]+u[0]*tangent,p[1]+u[1]*tangent],c=[p[0]+v[0]*tangent,p[1]+v[1]*tangent],
            bis=[u[0]+v[0],u[1]+v[1]],bl=Math.hypot(...bis)||1,
            center=[p[0]+bis[0]/bl*radius/Math.sin(theta/2),p[1]+bis[1]/bl*radius/Math.sin(theta/2)],
            start=Math.atan2(a[1]-center[1],a[0]-center[0]),end=Math.atan2(c[1]-center[1],c[0]-center[0]),
            dir=cross<0?1:-1;
        let sweep=end-start;if(dir>0){while(sweep<0)sweep+=Math.PI*2;}else{while(sweep>0)sweep-=Math.PI*2;}
        const key=`corner:${i}`;
        for(let j=0;j<=steps;j++){const t=j/steps,ang=start+sweep*t;out.push([center[0]+radius*Math.cos(ang),center[1]+radius*Math.sin(ang)]);marks.push({key,apex:j===Math.round(steps/2)});}
    }
    Object.defineProperty(out,'_bevelMarks',{value:marks});return out;
}

// ===== カウンター（薄い天板＋どっしりした土台）=====
// 参考写真の「上は薄い板、下は厚い箱」のカウンター。普通／L字／コの字の3種は
// 足元の輪郭（footprint）だけが違うので、天板の多角形を作り、
// 土台はその多角形を内側へ縮めて（K.insetPath）作る。
// 天板の厚さ・土台の高さ・長さは、画面の専用ハンドルで変えられる。
function counterParts(o, K) {
    const g = counterFootprint(o),
        foot = g.foot,
        // 土台は天板より内側。張り出しの分だけ細くして、天板の縁が線として出るようにする。
        base = K.insetPath(foot, g.overhang);
    return [
        // 天板と土台は同じZ押し出しベベル方式。凹角は保持して外角だけ丸める。
        beveledPrismPart(K,foot,g.H-g.topT,g.H,Math.max(0,Number(o.ctBevel)||0),4),
        beveledPrismPart(K,base,0,g.H-g.topT,Math.max(0,Number(o.ctBevel)||0),4),
    ];
}

function counterBevelControl(){return {key:'ctBevel',label:'Z軸辺のベベル',type:'range',canvasSlider:true,default:0,min:0,max:o=>{const g=counterGeometry(o);return Math.max(0,Math.min(g.W,g.D,g.arm)*.22);},step:.005,unit:'m',handle:(o,v)=>{const g=counterGeometry(o);return {anchor:[g.W/2,-g.D/2,g.H],sample:[g.W/2-v,-g.D/2,g.H],probe:[g.W/2-v-1,-g.D/2,g.H],fallback:{x:-1,y:0}};}};}
// --- 普通（まっすぐ）---
ASSET_KIT.define(
    "counter",
    {
        label: "カウンター",
        glyph: "▭",
        group: "furniture",
        w: 2.0,
        d: 0.6,
        h: 1.0,
        accent: "#c9a97a",
        ctTopT: 0.06, // 天板の厚さ
        ctArm: 0.55, // L字・コの字の腕の幅（普通は未使用）
        ctOverhang: 0.06, // 天板の張り出し（土台を内側へ引く量）
        controls: [counterBevelControl()],
    },
    counterParts,
);

// --- L字 ---
ASSET_KIT.define(
    "counterL",
    {
        label: "L字カウンター",
        glyph: "└",
        group: "furniture",
        w: 1.8,
        d: 1.8,
        h: 1.0,
        accent: "#c9a97a",
        ctTopT: 0.06,
        ctArm: 0.55,
        ctOverhang: 0.06,
        controls: [counterBevelControl()],
    },
    counterParts,
);

// --- コの字 ---
ASSET_KIT.define(
    "counterU",
    {
        label: "コの字カウンター",
        glyph: "⊔",
        group: "furniture",
        w: 2.2,
        d: 1.6,
        h: 1.0,
        accent: "#c9a97a",
        ctTopT: 0.06,
        ctArm: 0.55,
        ctOverhang: 0.06,
        controls: [counterBevelControl()],
    },
    counterParts,
);

// --- 五角形の立体と車 ---
// 形はすべて pentaGeometry(o)（engine-gizmo.js）が決める。
// ここは「その値から部品を並べる」だけにして、ハンドルと同じ寸法を見るようにする。
function vehicleParts(o, K) {
    const g = pentaGeometry(o),
        // 断面（五角形・六角形・L字）は pentaGeometry が作る。面の向きをそろえるため、
        // 反時計回りに直してから左右へ押し出す。
        profile = K.area2(g.profile) < 0 ? g.profile.slice().reverse() : g.profile,
        parts = [K.box(profile, -g.W / 2, g.W / 2, { axis: "x" })];
    // 荷台（直方体）。キャブの後ろから車体の後ろまで。
    if (g.cfg.bed && g.bedL > 0.02)
        parts.push(...K.moveParts([K.box(K.rectPath(g.W, g.bedL), 0, g.bedH)], 0, g.yB - g.bedL / 2, 0));
    // タイヤ4つ。太さ（左右）・大きさ（半径）・前後の間隔・上下はすべて g から。
    if (g.cfg.wheels)
        g.wheels.forEach((w) =>
            parts.push(...K.part("tire", { r: g.tireR, t: g.tireW, x: w.x, axleY: w.y, z: g.tireZ })),
        );
    return parts;
}

// 五角形の立体（建物の塊）。上端を斜めに落とした箱で、車のキャブと同じ部品。
ASSET_KIT.define(
    "pentaBox",
    {
        label: "五角形の立体",
        glyph: "⬟",
        w: 2.4,
        d: 3.0,
        h: 2.6,
        accent: "#6c8fd6",
        vhFrontH: 1.45,
        vhNose: 0,
    },
    vehicleParts,
);

// 軽トラ（簡略化）：五角形のキャブ＋荷台＋タイヤ4つ。
ASSET_KIT.define(
    "keiTruck",
    {
        label: "軽トラ",
        glyph: "🛻",
        w: 1.48,
        d: 3.4,
        h: 1.8,
        accent: "#6c8fd6",
        vhFrontH: 0.98,
        vhNose: 0,
        vhBedL: 1.85,
        vhBedH: 0.95,
        vhTireR: 0.3,
        vhTireW: 0.16,
        vhTrack: 1.52,
        vhWb: 2.0,
    },
    vehicleParts,
);

// トラック2：プリミティブの五角形キャブ＋直方体の荷台＋4輪。
// 参考画像に合わせ、明るいキャブと赤橙色の荷台・側面帯で構成する。
function truck2Parts(o,K){
    const g=pentaGeometry(o),
        profile=K.area2(g.profile)<0?g.profile.slice().reverse():g.profile,
        // 構成は五角形の立体・後部の直方体コンテナ・タイヤだけ。窓や帯などは追加しない。
        parts=[
            K.box(profile,-g.W/2,g.W/2,{axis:"x",color:"#e7dfb1"}),
            K.box(K.rectPath(g.W,g.bedL,0,g.yB-g.bedL/2),0,g.bedH,{color:"#b6533d"}),
        ];
    if(g.cfg.wheels)g.wheels.forEach(wheel=>parts.push(...K.part("tire",{r:g.tireR,t:g.tireW,x:wheel.x,axleY:wheel.y,z:g.tireZ})));
    return parts;
}
ASSET_KIT.define("keiTruck2",{label:"トラック2",glyph:"🚚",group:"vehicle",w:1.72,d:4.4,h:2.25,accent:"#e7dfb1",
    vhFrontH:1.22,vhNose:.08,vhBedL:2.25,vhBedH:2.30,vhTireR:.34,vhTireW:.2,vhTrack:1.76,vhWb:2.55},truck2Parts);

// 軽バン：屋根まで高い五角形＋タイヤ。荷台は無し。
ASSET_KIT.define(
    "keiVan",
    {
        label: "軽バン",
        glyph: "🚐",
        w: 1.55,
        d: 3.5,
        h: 2.05,
        accent: "#7d9ed8",
        vhFrontH: 1.12,
        vhNose: 0.05,
        vhTireR: 0.3,
        vhTireW: 0.17,
        vhTrack: 1.59,
        vhWb: 2.3,
    },
    vehicleParts,
);

// 乗用車：低い屋根＋長い斜め（フロントガラス）。
ASSET_KIT.define(
    "sedan",
    {
        label: "乗用車",
        glyph: "🚗",
        w: 1.72,
        d: 4.2,
        h: 1.42,
        accent: "#8a7dd8",
        vhFrontH: 0.78,
        vhNose: 0.12,
        vhRearH: 0.72, // 後ろも斜めに落とす（六角形の断面）
        vhTireR: 0.31,
        vhTireW: 0.2,
        vhTrack: 1.76,
        vhWb: 2.6,
    },
    vehicleParts,
);

// 乗用車2：低い前の直方体＋高い後ろの直方体（L字の断面）＋タイヤ4本。
// 前の箱の高さ・前の面の前後・後ろの箱の高さ・後ろの面の前後を、画面上で別々に変えられる。
ASSET_KIT.define(
    "sedan2",
    {
        label: "乗用車2",
        glyph: "🚙",
        w: 1.8,
        d: 4.0,
        h: 1.9,
        accent: "#7f8ed8",
        vhFrontBoxH: 0.95,
        vhFrontH: 0.95,
        vhStep: 1.5, // 前の直方体の長さ（境目の位置）
        vhNose: 0,
        vhTail: 0,
        vhTireR: 0.34,
        vhTireW: 0.22,
        vhTrack: 1.84,
        vhWb: 2.3,
    },
    vehicleParts,
);

// トラック形：直線部と両端の半円。横幅と直線部は独立して調整できる。
function trackFootprint(o, inset = 0) {
    const r = Math.max(0.001, Math.abs(Number(o.rb) || .001) - inset),
        straight = Math.max(0, Math.abs(Number(o.ra) || 0) - Math.abs(Number(o.rb) || 0)),
        out = [], n = 12;
    for (let i=0;i<=n;i++) {const a=-Math.PI/2+Math.PI*i/n;out.push([straight+r*Math.cos(a),r*Math.sin(a)]);}
    for (let i=0;i<=n;i++) {const a=Math.PI/2+Math.PI*i/n;out.push([-straight+r*Math.cos(a),r*Math.sin(a)]);}
    return out;
}
ASSET_KIT.define("track", {
    label:"トラック型",glyph:"▱",group:"primitive",w:3,d:1,h:0,accent:"#85dfd0",
    controls:[
        {key:"trackStraight",label:"長方形の長さ",type:"number",min:0,max:1000,step:.05,unit:"m",
            get:o=>Math.max(0,2*(o.ra-o.rb)),patch:(o,v)=>({ra:(v+2*o.rb)/2}),
            handle:(o,v)=>({anchor:[0,-o.rb,o.h],sample:[v/2,-o.rb,o.h],probe:[(v+1)/2,-o.rb,o.h],fallback:{x:1,y:0}})},
        {key:"trackWidth",label:"長方形の幅",type:"number",min:.01,max:1000,step:.05,unit:"m",
            get:o=>2*o.rb,patch:(o,v)=>({rb:v/2,ra:Math.max(0,o.ra-o.rb)+v/2}),
            handle:(o,v)=>({anchor:[0,0,o.h],sample:[0,v/2,o.h],probe:[0,(v+1)/2,o.h],fallback:{x:0,y:1}})},
    ],
},(o,K)=> {
    const path=trackFootprint(o),h=Math.max(0,Number(o.h)||0);
    if(h<1e-6)return [K.face3(path.map(([x,y])=>[x,y,0]))];
    return [K.box(path,0,h,{smooth:true,verts:0})];
});

// 柱の蛇腹。ひとつの断面を同じ位置で広げ／狭めて積み上げる。
// 輪郭、線、三角面は全て同じリングから生成する。
(function(){
    const K=ASSET_KIT;
    function supported(o) {
        return !!o && (o.type==="rect" || o.type==="circ" || o.type==="cyl" ||
            (o.type==="asset" && ["box","beveledBox","cornerCutBox","triPrism","cylinder","track"].includes(o.asset)));
    }
    const num=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
    const limit=(x,a,b)=>Math.max(a,Math.min(b,x));
    // 画面上で3値を編集。溝深さは前面法線、厚さは段の上端、段数は柱の側方に置く。
    // 平面・OFF時は蛇腹の形が存在しないため、ハンドルを表示しない。
    function accordionHandle(o,key,value) {
        if (!active(o)) return null;
        const h=Math.max(.001,Number(o.h)), n=limit(Math.round(num(o.accordionCount,12)),1,48),
            duty=limit(num(o.accordionDuty,.6),.05,.95), pitch=h/(n-(1-duty)),
            i=Math.floor((n-1)/2), bandTop=(i+duty)*pitch, grooveZ=n>1?(i+duty+(1-duty)/2)*pitch:h/2,
            x=Math.abs(o.ra), y=-Math.abs(o.rb);
        if (key==="count") return {anchor:[-x,y,h*.8],sample:[-x,y,h*.8],probe:[-x,y,h*.8+1],fallback:{x:0,y:-1},pixelsPerUnit:16,color:"#ffbf69"};
        if (key==="duty") return {anchor:[x*.35,y,i*pitch],sample:[x*.35,y,bandTop],probe:[x*.35,y,bandTop+1],fallback:{x:0,y:-1},scaleFactor:pitch,color:"#86d4ff"};
        return {anchor:[-x*.35,y,grooveZ],sample:[-x*.35,y+value,grooveZ],probe:[-x*.35,y+value+1,grooveZ],fallback:{x:1,y:0},color:"#e49dff"};
    }
    window.accordionControls=o=>{
        if(!supported(o))return [];
        const list=[
            {key:"accordionEnabled",label:"蛇腹",type:"boolean",default:false},
            {key:"accordionCount",label:"蛇腹の段数",default:12,min:1,max:48,step:1,integer:true,unit:"段",handle:(o,v)=>accordionHandle(o,"count",v)},
            {key:"accordionDuty",label:"段の厚さ（割合）",default:.6,min:.05,max:.95,step:.05,handle:(o,v)=>accordionHandle(o,"duty",v)},
            {key:"accordionDepth",label:"溝の深さ",default:.04,min:0,max:maxRecess,step:.01,unit:"m",handle:(o,v)=>accordionHandle(o,"depth",v)},
        ];
        if(o.type==="rect" || (o.type==="asset" && ["box","beveledBox"].includes(o.asset)))list.push(
            {key:"accordionRadius",label:"蛇腹の角丸半径",default:0,min:0,max:q=>Math.max(0,Math.min(Math.abs(q.ra),Math.abs(q.rb))-.0001),step:.01,unit:"m",get:q=>num(q.accordionRadius,q.asset==="beveledBox"?num(q.bevelOffset,0):0)},
            {key:"accordionSegments",label:"角丸の分割数",default:4,min:1,max:12,step:1,integer:true},
            ...["左手前","右手前","右奥","左奥"].map((label,i)=>({key:"accordionCorner"+i,label:"角丸："+label,type:"boolean",default:true}))
        );
        return list;
    };
    function active(o){return supported(o)&&o.accordionEnabled===true&&Number(o.h)>1e-6;}
    function rectangular(o,inset) {
        const w=Math.max(.002,2*Math.abs(o.ra)-2*inset), d=Math.max(.002,2*Math.abs(o.rb)-2*inset),
            radius=limit(num(o.accordionRadius,o.asset==="beveledBox"?num(o.bevelOffset,0):0),0,Math.min(Math.abs(o.ra),Math.abs(o.rb))-.0001),
            seg=limit(Math.round(num(o.accordionSegments,o.asset==="beveledBox"?num(o.bevelSegments,4):4)),1,12),
            r=Math.min(Math.max(.00001,radius-inset),Math.min(w,d)/2-.00001),
            cs=[[-w/2+r,-d/2+r,Math.PI], [w/2-r,-d/2+r,1.5*Math.PI], [w/2-r,d/2-r,0],[-w/2+r,d/2-r,Math.PI/2]],
            sharp=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]],out=[];
        cs.forEach(([x,y,a],i)=>{if(radius<1e-8||o['accordionCorner'+i]===false)out.push(sharp[i]);else for(let j=0;j<=seg;j++){const t=a+Math.PI*j/(2*seg);out.push([x+r*Math.cos(t),y+r*Math.sin(t)]);}});
        return out;
    }
    function maxRecess(o) {
        let value=Math.max(0,Math.min(Math.abs(o.ra),Math.abs(o.rb))*.8);
        if(o.asset==="cornerCutBox") {const opening=cornerCutOpeningParams(o);if(opening.enabled)
            value=Math.min(value,opening.openingDepth*.45,Math.max(0,(opening.cutLength-opening.openingW-.005)/(Math.SQRT2*(2-Math.SQRT2))));}
        return value;
    }
    function params(o) {
        const h=Math.max(.001,Number(o.h)),count=limit(Math.round(num(o.accordionCount,12)),1,48),duty=limit(num(o.accordionDuty,.6),.05,.95),
            recess=limit(num(o.accordionDepth,.04),0,maxRecess(o)),opening=o.asset==="cornerCutBox"?cornerCutOpeningParams(o):null;
        return {h,count,duty,recess,opening};
    }
    function footprint(o,z,inset,q,notch) {
        const w=Math.max(.002,2*Math.abs(o.ra)-2*inset), d=Math.max(.002,2*Math.abs(o.rb)-2*inset);
        if(o.type==="circ"||o.type==="cyl"||o.asset==="cylinder")return Array.from({length:32},(_,i)=>[w/2*Math.cos(i*Math.PI/16),d/2*Math.sin(i*Math.PI/16)]);
        if(o.asset==="track")return trackFootprint(o,inset);
        if(o.asset==="triPrism") {
            // 既存の三角柱は左右に三角、前後へ押し出した向き。
            const rx=Math.max(.00001,Math.abs(o.ra)*(1-z/q.h)-inset),ry=Math.max(.001,Math.abs(o.rb)-inset);
            return [[-rx,-ry],[rx,-ry],[rx,ry],[-rx,ry]];
        }
        if(o.asset==="cornerCutBox") {
            const cut=q.opening, off=Math.max(0,cut.cornerOffset-(2-Math.SQRT2)*inset),poly=cornerCutFootprint(w,d,off,cut.cornerCutCorner);
            if(!notch)return poly;
            const mid=[(poly[0][0]+poly[poly.length-1][0])/2,(poly[0][1]+poly[poly.length-1][1])/2],
                t=Math.max(0,(mid[0]-cut.midpoint[0])*cut.inward[0]+(mid[1]-cut.midpoint[1])*cut.inward[1]),
                a=[cut.frontA[0]+cut.inward[0]*t,cut.frontA[1]+cut.inward[1]*t],
                b=[cut.frontB[0]+cut.inward[0]*t,cut.frontB[1]+cut.inward[1]*t];
            return [...poly,a,cut.backA,cut.backB,b];
        }
        return rectangular(o,inset);
    }
    // 断面に依存しない高さ方向の配置。新しい断面も同じ段配置を利用できる。
    K.accordionBands = function(height,count,duty,recess) {
        const h=Math.max(.001,num(height,1)),
            n=limit(Math.round(num(count,12)),1,48),ratio=limit(num(duty,.6),.05,.95),
            depth=Math.max(0,num(recess,.04)),pitch=h/(n-(1-ratio)),t=pitch*ratio,out=[];
        for(let i=0;i<n;i++){
            const a=i*pitch,b=Math.min(h,a+t);out.push({a,b,inset:0});
            if(i<n-1)out.push({a:b,b:(i+1)*pitch,inset:depth});
        }
        return out;
    };
    // profile(z,inset) が各高さの多角形を返せば、任意の柱断面から同じ蛇腹面を作れる。
    K.accordionLoft = function(profile, options={}) {
        const rings=[];
        for(const u of K.accordionBands(options.height,options.count,options.duty,options.depth)) {
            const a={path:profile(u.a,u.inset),w:u.a},b={path:profile(u.b,u.inset),w:u.b},prev=rings[rings.length-1];
            if(!prev||Math.abs(prev.w-a.w)>1e-8||JSON.stringify(prev.path)!==JSON.stringify(a.path))rings.push(a);
            rings.push(b);
        }
        return K.loft(rings,{ringLines:Array.from({length:Math.max(0,rings.length-2)},(_,i)=>i+1),verticals:options.verticals||[]});
    };
    function build(o) {
        const q=params(o), sections=[];
        // N個の段とN-1個の溝がちょうど指定の高さを埋める。
        const intervals=K.accordionBands(q.h,q.count,q.duty,q.recess);
        let rings=[],notch=null;
        const flush=(startCap,endCap)=>{if(rings.length>1){const n=rings[0].path.length;let verticals=Array.from({length:n},(_,i)=>i);
            if(o.type==="circ"||o.type==="cyl"||o.asset==="cylinder"||o.asset==="track"){
                // 曲面の縦線は画面上の左右輪郭だけにする。
                const z=q.h/2,tf=[Z,0,0,Z,...viewShift()],ss=rings[0].path.map(([x,y])=>projPoint(L2W(o,x,y,z),tf).x);
                verticals=[ss.indexOf(Math.min(...ss)),ss.indexOf(Math.max(...ss))];
            }
            sections.push(K.loft(rings,{capStart:startCap,capEnd:endCap,ringLines:Array.from({length:Math.max(0,rings.length-2)},(_,i)=>i+1),verticals}));}rings=[];};
        let initial=true;
        for(const unit of intervals){const cuts=[unit.a,unit.b];if(q.opening?.enabled&&q.opening.openingH>unit.a+1e-8&&q.opening.openingH<unit.b-1e-8)cuts.splice(1,0,q.opening.openingH);
            for(let j=0;j<cuts.length-1;j++){
                const a=cuts[j],b=cuts[j+1],isNotch=!!q.opening?.enabled&&(a+b)/2<q.opening.openingH;
                if(notch!==null&&notch!==isNotch){flush(initial,false);initial=false;}
                notch=isNotch;
                const p0=footprint(o,a,unit.inset,q,isNotch),p1=footprint(o,b,unit.inset,q,isNotch);
                if(!rings.length)rings.push({path:p0,w:a});else {const prev=rings[rings.length-1];if(Math.abs(prev.w-a)>1e-8||JSON.stringify(prev.path)!==JSON.stringify(p0))rings.push({path:p0,w:a});}
                rings.push({path:p1,w:b});
            }
        }
        flush(initial,true);
        if(q.opening?.enabled){
            const z=q.opening.openingH,unit=intervals.find(r=>r.a<=z+1e-8&&r.b>=z-1e-8)||intervals[0],p=footprint(o,z,unit.inset,q,true),n=p.length;
            sections.push(K.face3([p[n-4],p[n-3],p[n-2],p[n-1]].map(([x,y])=>[x,y,z])));
        }
        if(o.asset==="cornerCutBox") {const fascia=cornerCutFasciaParts(o);if(fascia.g.enabled)fascia.parts.forEach(p=>sections.push(K.box(p,fascia.g.z0,fascia.g.z1,{surfaceColor:fascia.g.color})));}
        return sections;
    }
    window.accordionParts=build;
    K.accordionParts=build;
    K.supportsAccordion=supported;
    const previousAsset=genAsset,previousCore=genShapeCore,previousSurface=exportSurfaceTriangles;
    function lines(o) {return build(o).flatMap(part=>{
        if(!part.rings)return K.partEdges(part).map(e=>lineA(o,e,part.color||o.c,o.w));
        const rings=part.rings,out=[];
        for(const r of rings)out.push(polyA(o,r.path.map(([x,y])=>[x,y,r.w]),part.color||o.c,o.w));
        for(const k of part.verticals||[])for(let i=0;i<rings.length-1;i++){
            const a=rings[i],b=rings[i+1];
            if(Math.abs(a.w-b.w)<1e-8)continue; // 水平な段面には放射状の内部線を描かない
            out.push(lineA(o,[[...a.path[k],a.w],[...b.path[k],b.w]],part.color||o.c,o.w));
        }
        return out;
    });}
    genAsset=function(o){return active(o)?lines(o):previousAsset(o);};
    genShapeCore=function(o){return active(o)?lines(o):previousCore(o);};
    exportSurfaceTriangles=function(o){return active(o)?build(o).flatMap(p=>K.partTris(p).map(t=>{const tri=t.map(v=>L2W(o,...v));if(p.surfaceColor)tri.surfaceColor=p.surfaceColor;return tri;})):previousSurface(o);};
})();

// 通常のトラック柱でも滑らかな両端のシルエット母線を表示する。
{
    const baseTrackLines=ASSET_LINE_BUILDERS.track;
    ASSET_LINE_BUILDERS.track=function(ctx){
        baseTrackLines(ctx);const {o,out,c}=ctx,h=Math.max(0,Number(o.h)||0);if(h<1e-6)return;
        const path=trackFootprint(o),tf=[Z,0,0,Z,...viewShift()],xs=path.map(([x,y])=>projPoint(L2W(o,x,y,h/2),tf).x);
        for(const i of new Set([xs.indexOf(Math.min(...xs)),xs.indexOf(Math.max(...xs))]))if(i>=0){const [x,y]=path[i];out.push(lineA(o,[[x,y,0],[x,y,h]],c));}
    };
}

// ===== 曲げ管の車止め（U字／中央脚付きM字） =====
// 半円状の断面を角で回す。直線長は両曲げの接点の間で、幅変更時も曲げ半径を維持する。
function guardPoleDiameter(o) { return Math.max(.02, Number(o?.guardDiameter) || .06); }
function guardPoleBend(o) { return guardPoleDiameter(o) * 1.2; }
// 下桟と両脚が離れないよう、曲げの下にパイプ1本ぶんの直線を確保。
function guardPoleMinHeight(o) { return guardPoleBend(o) + guardPoleDiameter(o) * 1.5 + .025; }
function guardPoleStraight(o) { return Math.max(.05, 2 * Math.abs(Number(o.ra) || 0) - 2 * guardPoleBend(o) - guardPoleDiameter(o)); }
function guardPoleMinHalfWidth(o) { return (0.05 + 2 * guardPoleBend(o) + guardPoleDiameter(o)) / 2; }
// 断面リングの三角面と視点ごとの外側2輪郭を同じデータから作る。
function guardTubePart(o, sections, radius, ringMarks=[]) {
    const N=16, rings=sections.map(s=>Array.from({length:N},(_,j)=>{
        const a=2*Math.PI*j/N,c=Math.cos(a)*radius;
        return [s.x+s.nx*c,Math.sin(a)*radius,s.z+s.nz*c];
    })), triangles=[],edges=[], world=rings.map(r=>r.map(p=>L2W(o,...p))),
        cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
        sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
        view=orthView?orthBasis().depth.map(v=>-v):null,camera=camPos();
    for(let i=0;i<rings.length-1;i++){
        const center=L2W(o,(sections[i].x+sections[i+1].x)/2,0,(sections[i].z+sections[i+1].z)/2), facing=[];
        for(let j=0;j<N;j++){
            const k=(j+1)%N,a=rings[i][j],b=rings[i][k],c=rings[i+1][k],d=rings[i+1][j];
            triangles.push([a,b,c],[a,c,d]);
            const A=world[i][j],B=world[i][k],D=world[i+1][j], normal=cross(sub(B,A),sub(D,A)), radial=sub(A,center);
            if(dot(normal,radial)<0)for(let q=0;q<3;q++)normal[q]=-normal[q];
            facing.push(dot(normal,view||sub(camera,A))>1e-12);
        }
        const idx=[];for(let j=0;j<N;j++)if(facing[(j+N-1)%N]!==facing[j])idx.push(j);
        for(const j of (idx.length===2?idx:[0,N/2]))edges.push([rings[i][j],rings[i+1][j]]);
    }
    for(const [idx,reverse] of [[0,true],[rings.length-1,false]]){
        const center=[sections[idx].x,0,sections[idx].z];
        for(let j=0;j<N;j++){const k=(j+1)%N;triangles.push(reverse?[center,rings[idx][k],rings[idx][j]]:[center,rings[idx][j],rings[idx][k]]);}
    }
    for(const i of ringMarks)if(rings[i])edges.push([...rings[i],rings[i][0]]);
    return {meshTriangles:triangles,meshEdges:edges,preciseTubeEdge:true};
}
function guardPoleBuild(o,K,midPost) {
    const d=guardPoleDiameter(o),r=d/2,b=guardPoleBend(o),L=guardPoleStraight(o),H=Math.max(guardPoleMinHeight(o),Number(o.h)||.6),
        x=L/2+b,top=H-r,zTop=top-b,foot=Math.min(.015,H*.08),sections=[],marks=[];
    const add=(px,pz,nx,nz,mark=false)=>{sections.push({x:px,z:pz,nx,nz});if(mark)marks.push(sections.length-1);};
    add(-x,foot,-1,0);add(-x,foot+(zTop-foot)*.32,-1,0,true);add(-x,foot+(zTop-foot)*.62,-1,0,true);
    for(let i=0;i<=8;i++){const a=Math.PI-i*Math.PI/16;add(-L/2+b*Math.cos(a),zTop+b*Math.sin(a),Math.cos(a),Math.sin(a));}
    for(const f of [-.32,-.12,.12,.32])add(L*f,top,0,1,true);
    for(let i=0;i<=8;i++){const a=Math.PI/2-i*Math.PI/16;add(L/2+b*Math.cos(a),zTop+b*Math.sin(a),Math.cos(a),Math.sin(a));}
    add(x,foot+(zTop-foot)*.62,1,0,true);add(x,foot+(zTop-foot)*.32,1,0,true);add(x,foot,1,0);
    const parts=[guardTubePart(o,sections,r,marks)];
    if(midPost){
        const s=[{x:0,z:foot,nx:1,nz:0},{x:0,z:foot+(top-foot)*.34,nx:1,nz:0},{x:0,z:foot+(top-foot)*.62,nx:1,nz:0},{x:0,z:top,nx:1,nz:0}];
        parts.push(guardTubePart(o,s,r,[1,2]));
    } else if(o.guardCrossbar!==false) {
        const z=Math.max(foot+r,Math.min(zTop-r,H*.46));
        const s=[-x+r*.6,-L*.32,-L*.12,L*.12,L*.32,x-r*.6].map(px=>({x:px,z,nx:0,nz:1}));
        parts.push(guardTubePart(o,s,r,[1,2,3,4]));
    }
    for(const px of (midPost?[-x,0,x]:[-x,x])) {
        const plate=[{x:px,z:0,nx:1,nz:0},{x:px,z:foot,nx:1,nz:0}];
        parts.push(guardTubePart(o,plate,d*.85,[0,1]));
    }
    return parts;
}
(function(){
    const controls=[
        {key:'guardStraight',label:'直線部分の長さ',min:.05,max:100,step:.05,unit:'m',get:guardPoleStraight,
            patch:(o,v)=>({ra:(v+2*guardPoleBend(o)+guardPoleDiameter(o))/2}),
            handle:(o,v)=>({anchor:[-v/2,0,o.h],sample:[v/2,0,o.h],probe:[(v+1)/2,0,o.h],fallback:{x:1,y:0}})},
        {key:'guardDiameter',label:'パイプの太さ',default:.06,min:.02,max:o=>Math.max(.02,Math.min(1,(Number(o.h)-.025)/2.7)),step:.005,unit:'m',
            patch:(o,v)=>({guardDiameter:v,ra:(guardPoleStraight(o)+2*v*1.2+v)/2,rb:Math.max(.025,v/2)}),
            handle:(o,v)=>({anchor:[0,0,o.h-v/2],sample:[0,-v/2,o.h-v/2],probe:[0,-(v+1)/2,o.h-v/2],fallback:{x:1,y:0}})},
    ];
    const maxDiameter=o=>Math.max(.02,Math.min(1,(Number(o.h)-.025)/2.7));
    const base={group:'street',w:1.3,d:.06,h:.6,accent:'#e7b626',minHeight:guardPoleMinHeight,minHalfWidth:guardPoleMinHalfWidth,
        minHalfDepth:()=>.01,maxHalfDepth:o=>maxDiameter(o)/2,
        // 共通の奥行き面ハンドル・数値欄も管の太さと連動させる。
        constrainEdit:(next,old,patch)=>{
            const has=(k)=>Object.prototype.hasOwnProperty.call(patch,k);
            if(!has('guardDiameter')&&!has('rb'))return next;
            const d=Math.max(.02,Math.min(maxDiameter(next),Number(has('guardDiameter')?next.guardDiameter:next.rb*2)||.06));
            next.guardDiameter=d;next.rb=d/2;
            if(!has('ra'))next.ra=(guardPoleStraight(old)+3.4*d)/2;
            return next;
        }};
    ASSET_KIT.define('guardPoleU',{...base,label:'U字車止めポール',glyph:'∩',controls:[...controls,{key:'guardCrossbar',label:'下の横桟',type:'boolean',default:true}]},(o,K)=>guardPoleBuild(o,K,false));
    ASSET_KIT.define('guardPoleM',{...base,label:'M字車止めポール',glyph:'♜',controls},(o,K)=>guardPoleBuild(o,K,true));
})();

// ===== 軽量な街小物（画像の文字や細かい模様は省略） =====
// 楕円断面を12分割。面と視点に応じた輪郭を同じ部品で持つ。
function streetRoundPart(o,K,profile,marks=[],cx=0,cy=0) {
    const N=12, rings=profile.map(([rx,ry,z])=>Array.from({length:N},(_,i)=>{const a=2*Math.PI*i/N;return [cx+rx*Math.cos(a),cy+ry*Math.sin(a),z];})),
        loft=K.loft(rings.map(r=>({path:r.map(p=>[p[0],p[1]]),w:r[0][2]}))),tris=K.partTris(loft),edges=[],world=rings.map(r=>r.map(p=>L2W(o,...p))),
        sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),
        view=orthView?orthBasis().depth.map(x=>-x):null,camera=camPos();
    for(let i=0;i<rings.length-1;i++){
        const faces=[];
        for(let j=0;j<N;j++){
            const a=world[i][j],b=world[i][(j+1)%N],c=world[i+1][j],normal=cross(sub(b,a),sub(c,a));
            faces.push(dot(normal,view||sub(camera,a))>0);
        }
        for(let j=0;j<N;j++)if(faces[(j+N-1)%N]!==faces[j])edges.push([rings[i][j],rings[i+1][j]]);
    }
    for(const i of [0,...marks,rings.length-1])if(rings[i])edges.push([...rings[i],rings[i][0]]);
    return {meshTriangles:tris,meshEdges:edges,preciseTubeEdge:true,onFace:true};
}
(function(){
 const size=o=>({w:Math.max(.05,Math.abs(o.ra)*2),d:Math.max(.05,Math.abs(o.rb)*2),h:Math.max(.001,Number(o.h)||.001)}),
       val=(o,k,v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(o[k]))?Number(o[k]):v)),
       vertical=(o,v,x,y,base=0)=>({anchor:[x,y,base],sample:[x,y,base+v],probe:[x,y,base+v+1],fallback:{x:0,y:-1}}),
       common={minHalfWidth:()=>.025,minHalfDepth:()=>.025};
 ASSET_KIT.define('streetCone',{...common,label:'交通コーン',glyph:'▲',group:'traffic',w:.42,d:.42,h:.7,accent:'#ed7845',minHeight:()=>.1,controls:[
   {key:'coneBaseThickness',label:'台座の厚さ',default:.05,min:.01,max:o=>Math.max(.01,o.h*.35),step:.01,unit:'m',handle:(o,v)=>vertical(o,v,-o.ra,-o.rb)}
 ]},(o,K)=>{const {w,d,h}=size(o),t=val(o,'coneBaseThickness',.05,.01,h*.35),z1=t+(h-t)*.35,z2=t+(h-t)*.67,rad=z=>.4*(1-.83*(z-t)/(h-t));return [K.box(K.rectPath(w,d),0,t),streetRoundPart(o,K,[[w*.4,d*.4,t],[w*rad(z1),d*rad(z1),z1],[w*rad(z2),d*rad(z2),z2],[w*.068,d*.068,h]],[1,2])];});
 // 舗道スラブ。上下面の外周線と、丸みの頂点だけを結ぶZ辺を出す。
 function pavementSlab(K,w,d,h,b,segments){const path=b>1e-6?K.ringPath(w,d,b,segments):K.rectPath(w,d),n=path.length,triangles=[],edges=[],p=(v,z)=>[v[0],v[1],z],
  tri=(a,c,e)=>triangles.push([a,c,e]),quad=(a,c,e,f)=>{tri(a,c,e);tri(a,e,f);};
  for(let i=1;i<n-1;i++){tri(p(path[0],0),p(path[i+1],0),p(path[i],0));tri(p(path[0],h),p(path[i],h),p(path[i+1],h));}
  for(let i=0;i<n;i++){const j=(i+1)%n;quad(p(path[i],0),p(path[j],0),p(path[j],h),p(path[i],h));}
  const loop=z=>{for(let i=0;i<n;i++)edges.push([p(path[i],z),p(path[(i+1)%n],z)]);};loop(0);loop(h);
  const ids=b>1e-6?Array.from({length:4},(_,i)=>i*(segments+1)+Math.round(segments/2)):Array.from({length:4},(_,i)=>i);
  ids.forEach(i=>edges.push([p(path[i],0),p(path[i],h)]));
  return{meshTriangles:triangles,meshEdges:edges,onFace:true,preciseTubeEdge:true};}
 // 舗道は動かさず、縁石をタイルの外側4辺へ配置する。
 const curbWidth=o=>val(o,'pavementCurbWidth',.18,.02,2),
       curbHeight=o=>val(o,'pavementCurbHeight',.06,.005,1),
       curbBevel=o=>val(o,'pavementCurbBevel',.04,0,curbWidth(o));
 function pavementCurbRing(w,d,cw,b,tileBevel,segments,z0,z1,tileTop) {
  // 外周の縁石と舗道本体の丸みを別々に保ち、内周はタイルのベベル輪郭へ正確に合わせる。
  const n=(b>1e-6||tileBevel>1e-6)?segments+1:1,
   repeatSharp=path=>path.flatMap(p=>Array.from({length:n},()=>p)),
   outer0=beveledBoxFootprint(w+2*cw,d+2*cw,b,segments),outer=b>1e-6?outer0:repeatSharp(outer0),
   inner0=beveledBoxFootprint(w,d,tileBevel,segments),inner=tileBevel>1e-6?inner0:repeatSharp(inner0),
   triangles=[],edges=[],marks=[],point=(p,z)=>[p[0],p[1],z];
  const tri=(a,c,e)=>{const u=c.map((v,i)=>v-a[i]),v=e.map((x,i)=>x-a[i]);
   if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-12)triangles.push([a,c,e]);},
   quad=(a,c,e,f)=>{tri(a,c,e);tri(a,e,f);},
   add=(p,mark=null)=>{edges.push(p);marks.push(mark);},
   loop=(p,z)=>[...p.map(v=>point(v,z)),point(p[0],z)];
  for(let i=0;i<outer.length;i++){
   const j=(i+1)%outer.length,a=outer[i],c=outer[j],u=inner[i],v=inner[j];
   quad(point(a,z0),point(c,z0),point(c,z1),point(a,z1));
   quad(point(u,z0),point(u,z1),point(v,z1),point(v,z0));
   quad(point(a,z1),point(c,z1),point(v,z1),point(u,z1));
   quad(point(a,z0),point(u,z0),point(v,z0),point(c,z0));
  }
  add(loop(outer,z0));add(loop(outer,z1));
  outer.forEach((p,i)=>{if(b>1e-6||i%(segments+1)===0)add([point(p,z0),point(p,z1)],beveledEdgeMark(i,b,segments,'pavementCurb'));});
  // 内側の境界はベベルしたタイルの外周に接し、タイル上面より上だけ縁石の内壁線を描く。
  add(loop(inner,z1));
  const innerApex=tileBevel>1e-6?Array.from({length:4},(_,i)=>i*(segments+1)+Math.round(segments/2)):Array.from({length:4},(_,i)=>i*n);
  innerApex.forEach(i=>add([point(inner[i],tileTop),point(inner[i],z1)]));
  return {meshTriangles:triangles,meshEdges:edges,seamMarks:marks,onFace:true,preciseTubeEdge:true};
 }
 ASSET_KIT.define('streetPavement',{...common,label:'タイル',glyph:'▦',group:'traffic',w:2.4,d:1.2,h:.12,accent:'#a3aaa7',minHeight:()=>.02,
  constrainEdit:(next,old,patch)=>{const q={...next},has=k=>Object.prototype.hasOwnProperty.call(patch,k);
   if(has('pavementCurbWidth'))q.pavementCurbWidth=clamp(Number(q.pavementCurbWidth)||.02,Math.max(.02,curbBevel(old)),2);
   if(has('pavementCurbHeight'))q.pavementCurbHeight=clamp(Number(q.pavementCurbHeight)||.005,.005,1);
   if(has('pavementCurbBevel'))q.pavementCurbBevel=clamp(Number(q.pavementCurbBevel)||0,0,curbWidth(q));
   return q;},controls:[
   {key:'pavementTileSize',label:'タイル間隔',default:.3,min:.08,max:2,step:.05,unit:'m',handle:(o,v)=>({anchor:[-o.ra,-o.rb,o.h+.001],sample:[-o.ra+v,-o.rb,o.h+.001],probe:[-o.ra+v+1,-o.rb,o.h+.001],fallback:{x:1,y:0}})},
   {key:'pavementBevelOffset',label:'Z軸辺のベベル',default:0,min:0,max:o=>Math.min(Math.abs(Number(o.ra)||1.2),Math.abs(Number(o.rb)||.6))*.4,step:.01,unit:'m',handle:(o,v)=>({anchor:[o.ra,-o.rb,o.h],sample:[o.ra-v,-o.rb,o.h],probe:[o.ra-v-1,-o.rb,o.h],fallback:{x:-1,y:0}})},
   {key:'pavementBevelSegments',label:'ベベル分割数',type:'range',default:4,min:1,max:4,step:1},
   {key:'pavementCurbEnabled',label:'縁石をつける',type:'boolean',default:false},
   {key:'pavementCurbWidth',label:'縁石の幅',default:.18,min:o=>Math.max(.02,curbBevel(o)),max:2,step:.01,unit:'m',
    handle:(o,v)=>{if(!o.pavementCurbEnabled)return null;const x=o.ra*.35,y=-o.rb,z=o.h+curbHeight(o)+.05;
     return {anchor:[x,y,z],sample:[x,y-v,z],probe:[x,y-v-1,z],fallback:{x:1,y:0}};}},
   {key:'pavementCurbHeight',label:'縁石の高さ',default:.06,min:.005,max:1,step:.01,unit:'m',
    handle:(o,v)=>{if(!o.pavementCurbEnabled)return null;const x=-o.ra*.4,y=-o.rb-curbWidth(o)*.5;
     return {anchor:[x,y,o.h],sample:[x,y,o.h+v],probe:[x,y,o.h+v+1],fallback:{x:0,y:-1}};}},
   {key:'pavementCurbBevel',label:'縁石の角のベベル',default:.04,min:0,max:curbWidth,step:.005,unit:'m',
    get:curbBevel,handle:(o,v)=>{if(!o.pavementCurbEnabled)return null;const w=curbWidth(o),x=o.ra+w,y=o.rb+w,z=o.h+curbHeight(o)+.30;
     return {anchor:[x,y,z],sample:[x-v,y,z],probe:[x-v-1,y,z],fallback:{x:-1,y:0}};}}
 ]},(o,K)=>{const {w,d,h}=size(o),step=val(o,'pavementTileSize',.3,.08,2),enabled=o.pavementCurbEnabled===true,
    cw=enabled?curbWidth(o):0,ch=enabled?curbHeight(o):0,b=enabled?curbBevel(o):0,bevel=val(o,'pavementBevelOffset',0,0,Math.min(w,d)*.2),bevelSegments=Math.max(1,Math.min(4,Math.round(val(o,'pavementBevelSegments',4,1,4)))),edges=[],curbEdges=[],
    dx=Math.max(step,w/32),dy=Math.max(step,d/32),z=h+.001,front=-d/2,back=d/2,left=-w/2,right=w/2,
    roundedY=x=>{const q=Math.abs(x)-(w/2-bevel);return bevel>1e-6&&q>0?d/2-bevel+Math.sqrt(Math.max(0,bevel*bevel-q*q)):d/2;},
    roundedX=y=>{const q=Math.abs(y)-(d/2-bevel);return bevel>1e-6&&q>0?w/2-bevel+Math.sqrt(Math.max(0,bevel*bevel-q*q)):w/2;};
  // タイル面はOFFのときと同じ。縁石の目地もタイル列に揃える。
  for(let i=1;i*dx<w-1e-8;i++){const x=left+i*dx,ym=roundedY(x);edges.push([[x,-ym,z],[x,ym,z]]);
   if(enabled)for(const sy of [-1,1]){const inner=sy*d/2,outer=sy*(d/2+cw);
    curbEdges.push([[x,outer+sy*.001,0],[x,outer+sy*.001,h+ch+.001],[x,inner,h+ch+.001],[x,inner,h]]);}}
  for(let i=1;i*dy<d-1e-8;i++){const y=front+i*dy,xm=roundedX(y);edges.push([[-xm,y,z],[xm,y,z]]);
   if(enabled)for(const sx of [-1,1]){const inner=sx*w/2,outer=sx*(w/2+cw);
    curbEdges.push([[outer+sx*.001,y,0],[outer+sx*.001,y,h+ch+.001],[inner,y,h+ch+.001],[inner,y,h]]);}}
  const parts=[pavementSlab(K,w,d,h,bevel,bevelSegments),{meshTriangles:[],meshEdges:edges,onFace:true,...(enabled||bevel>1e-6?{preciseTubeEdge:true}:{})}];
  if(enabled){parts.push(pavementCurbRing(w,d,cw,b,bevel,bevelSegments,0,h+ch,h));
   parts.push({meshTriangles:[],meshEdges:curbEdges,onFace:true,preciseTubeEdge:true});}
  return parts;});
 // 家具を配置するための部屋シェル。床＋四面の壁、家具・天井は含めない。
 ASSET_KIT.define('roomShell',{label:'部屋',glyph:'⌂',group:'furniture',w:3.6,d:3.6,h:3.6,accent:'#c9a982',minHeight:()=>1.5,controls:[]},(o,K)=>{
  const w=Math.max(.1,Math.abs(Number(o.ra)||1.8)*2),d=Math.max(.1,Math.abs(Number(o.rb)||1.8)*2),h=Math.max(1.5,Math.abs(Number(o.h)||3.6)),t=Math.min(.16,Math.max(.06,Math.min(w,d)*.01)),flags={onFace:true,color:'#c9a982'},parts=[];
  parts.push(K.box(K.rectPath(w,d),0,.04,{onFace:true,color:'#b9a88c',roomShellFloor:true}));
  parts.push(K.box(K.rectPath(w,d),h-.08,h,{...flags,roomShellCeiling:true}));
  parts.push(K.box(K.rectPath(w,t,0,-d/2+t/2),0,h,{...flags,roomShellWallSide:'front'}));
  parts.push(K.box(K.rectPath(w,t,0,d/2-t/2),0,h,{...flags,roomShellWallSide:'back'}));
  parts.push(K.box(K.rectPath(t,d,-w/2+t/2,0),0,h,{...flags,roomShellWallSide:'left'}));
  parts.push(K.box(K.rectPath(t,d,w/2-t/2,0),0,h,{...flags,roomShellWallSide:'right'}));
  return parts;
 });
 // 横断歩道の歩道切下げ。車道側から歩道側へ高さが上がる一体型スロープ。
 ASSET_KIT.define('streetCurbRamp',{...common,label:'歩道切下げスロープ',glyph:'▱',group:'traffic',w:1.8,d:1.0,h:.15,accent:'#a3aaa7',minHeight:()=>.02,controls:[
  {key:'curbRampRise',label:'歩道側の段差',default:.15,min:.02,max:1,step:.01,unit:'m',handle:(o,v)=>({anchor:[-o.ra,o.rb,0],sample:[-o.ra,o.rb,v],probe:[-o.ra,o.rb,v+1],fallback:{x:0,y:-1}})}
 ]},(o,K)=>{const {w,d}=size(o),h=val(o,'curbRampRise',o.h,.02,1),x=w/2,y0=-d/2,y1=d/2,
  a=[-x,y0,0],b=[x,y0,0],c=[x,y1,h],e=[-x,y1,h],a0=[-x,y0,0],b0=[x,y0,0],c0=[x,y1,0],e0=[-x,y1,0],
  triangles=[[a,b,c],[a,c,e],[a0,c0,b0],[a0,e0,c0],[a0,b0,b],[a0,b,a],[c0,e0,e],[c0,e,c],[a0,a,e],[a0,e,e0],[b0,c0,c],[b0,c,b]].filter(t=>{const u=t[1].map((v,i)=>v-t[0][i]),v=t[2].map((x,i)=>x-t[0][i]);return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-10;}),
  edges=[[a,b],[b,c],[c,e],[e,a],[a0,b0],[b0,c0],[c0,e0],[e0,a0],[a0,a],[b0,b],[c0,c],[e0,e]].filter(([p,q])=>Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2])>1e-10);
  return [{meshTriangles:triangles,meshEdges:edges,onFace:true,preciseTubeEdge:true}];});
 ASSET_KIT.define('streetParcel',{...common,label:'段ボール箱',glyph:'▣',group:'streetObjects',w:.62,d:.46,h:.44,accent:'#cba475',minHeight:()=>.05,controls:[
   {key:'parcelTapeWidth',label:'テープ幅',default:.09,min:.01,max:o=>Math.max(.01,Math.abs(o.ra)*1.7),step:.01,unit:'m',handle:(o,v)=>({anchor:[0,0,o.h+.001],sample:[v/2,0,o.h+.001],probe:[(v+1)/2,0,o.h+.001],fallback:{x:1,y:0}})},
   {key:'parcelOpen',label:'ふたの開き',type:'range',default:0,min:0,max:180,step:1,unit:'°',handle:(o,v)=>({anchor:[-o.ra,0,o.h+.1],sample:[-o.ra+.12+v*.002,0,o.h+.1],probe:[-o.ra+1.12+v*.002,0,o.h+.1],fallback:{x:1,y:0},pixelsPerUnit:1})}
 ]},(o,K)=>{const {w,d,h}=size(o),t=val(o,'parcelTapeWidth',.09,.01,w*.85),z=h+.001,angle=val(o,'parcelOpen',0,0,180);
 if(angle<.001)return [K.box(K.rectPath(w,d),0,h),K.face3([[-t/2,-d/2,z],[t/2,-d/2,z],[t/2,d/2,z],[-t/2,d/2,z]],{onFace:true})];
 const th=Math.min(.014,w*.08,d*.08,h*.12),a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),flags={onFace:true,preciseTubeEdge:true},out=[K.box(K.rectPath(w,d),0,th,flags),
 K.box(K.rectPath(th,d,-w/2+th/2,0),th,h,flags),K.box(K.rectPath(th,d,w/2-th/2,0),th,h,flags),
 K.box(K.rectPath(w-2*th,th,0,-d/2+th/2),th,h,flags),K.box(K.rectPath(w-2*th,th,0,d/2-th/2),th,h,flags)];
 for(const sign of [-1,1]){const x=sign*w/2,tip=sign*(w/2-c*w/2),tz=h+s*w/2;
  out.push(K.face3([[x,-d/2,h],[x,d/2,h],[tip,d/2,tz],[tip,-d/2,tz]],flags));
  const y=sign*d/2,ty=sign*(d/2-c*d/2),zz=h+s*d/2;
  out.push(K.face3([[-w/2,y,h],[w/2,y,h],[w/2,ty,zz],[-w/2,ty,zz]],flags));}
 return out;});
 ASSET_KIT.define('streetBin',{...common,label:'ふた付きごみ箱',glyph:'▤',group:'streetObjects',w:.55,d:.55,h:.78,accent:'#55a9c5',minHeight:()=>.15,controls:[
   {key:'binLidThickness',label:'ふたの厚さ',default:.07,min:.02,max:o=>Math.max(.02,o.h*.22),step:.01,unit:'m',handle:(o,v)=>{const z=o.h-Math.min(.08,o.h*.16),x=o.ra*.72;return {anchor:[x,0,z],sample:[x,0,z-v],probe:[x,0,z-v-1],fallback:{x:0,y:1}};}}
 ]},(o,K)=>{const {w,d,h}=size(o),t=val(o,'binLidThickness',.07,.02,h*.22),top=h-Math.min(.08,h*.16),z=top-t,handleTop=h,handleBottom=top,bar=Math.min(.035,h*.07),span=w*.35;
 return [streetRoundPart(o,K,[[w*.37,d*.37,0],[w*.43,d*.43,z]]),streetRoundPart(o,K,[[w*.48,d*.48,z],[w*.48,d*.48,top-t*.3],[w*.40,d*.40,top]],[1]),
 K.box(K.rectPath(bar,bar,-span/2,0),handleBottom,handleTop),K.box(K.rectPath(bar,bar,span/2,0),handleBottom,handleTop),K.box(K.rectPath(span+bar,bar),handleTop-bar,handleTop)];});
 ASSET_KIT.define('streetMailbox',{...common,label:'ポスト',glyph:'▣',group:'streetObjects',w:.5,d:.38,h:1.25,accent:'#d95c68',minHeight:o=>Math.max(.2,(Number(o.mailPostLength)||.42)+.16),controls:[
   {key:'mailPostLength',label:'ポールの長さ',default:.42,min:.05,max:2.5,step:.05,unit:'m',patch:(o,v)=>({mailPostLength:v,h:o.h+v-(Number(o.mailPostLength)||.42)}),handle:(o,v)=>vertical(o,v,0,-o.rb*.5)},
   {key:'mailPostDiameter',label:'ポールの太さ',default:.1,min:.02,max:o=>Math.max(.02,Math.min(o.ra,o.rb)*1.3),step:.01,unit:'m',handle:(o,v)=>({anchor:[0,0,(Number(o.mailPostLength)||.42)*.5],sample:[v/2,0,(Number(o.mailPostLength)||.42)*.5],probe:[(v+1)/2,0,(Number(o.mailPostLength)||.42)*.5],fallback:{x:1,y:0}})},
   {key:'mailSlotHeight',label:'投入口の高さ',min:.04,max:o=>Math.max(.04,o.h-(Number(o.mailPostLength)||.42)-.04),step:.01,unit:'m',get:o=>Math.max(.04,Math.min(o.h-(Number(o.mailPostLength)||.42)-.04,Number.isFinite(Number(o.mailSlotHeight))?Number(o.mailSlotHeight):(o.h-(Number(o.mailPostLength)||.42))*.625)),handle:(o,v)=>vertical(o,v,-o.ra*.7,-o.rb,(Number(o.mailPostLength)||.42))}
 ]},(o,K)=>{const {w,d,h}=size(o),p=val(o,'mailPostLength',.42,.05,Math.max(.05,h-.16)),pd=val(o,'mailPostDiameter',.1,.02,Math.min(w,d)*.65),bh=h-p,y=-d/2-.001,base=Math.min(.035,p*.15),slot=val(o,'mailSlotHeight',bh*.625,.04,Math.max(.04,bh-.04)),sh=Math.min(bh*.045,.03),flag={onFace:true,preciseTubeEdge:true};
 // 画像の角張った本体と短い台座。表面の詳細は横長の投入口だけ。
 return [K.box(K.rectPath(pd*1.6,pd*1.5),0,base),streetRoundPart(o,K,[[pd/2,pd/2,base],[pd/2,pd/2,p]]),
 K.depthBeveledBox(w,d,bh,Math.min(.025,w*.05,bh*.05),{z0:p,seg:2,group:"street-mailbox-body",seamLines:true}),
 K.face3([[-w*.31,y,p+slot-sh],[w*.31,y,p+slot-sh],[w*.31,y,p+slot+sh],[-w*.31,y,p+slot+sh]],{onFace:true}),
 K.face3([[-w*.26,y-.002,p+slot-sh/3],[w*.26,y-.002,p+slot-sh/3],[w*.26,y-.002,p+slot+sh/3],[-w*.26,y-.002,p+slot+sh/3]],flag)];});
 ASSET_KIT.define('streetPlant',{...common,label:'鉢植え',glyph:'♧',group:'streetObjects',w:.72,d:.72,h:.9,accent:'#79b974',minHeight:o=>Math.max(.15,(Number(o.plantPotHeight)||.25)+.12),controls:[
   {key:'plantPotHeight',label:'鉢の高さ',default:.25,min:.06,max:o=>Math.max(.06,o.h-.12),step:.01,unit:'m',handle:(o,v)=>vertical(o,v,o.ra*.48,0)}
 ]},(o,K)=>{const {w,d,h}=size(o),ph=val(o,'plantPotHeight',.25,.06,h-.12),out=[streetRoundPart(o,K,[[w*.19,d*.19,0],[w*.27,d*.27,ph*.86],[w*.29,d*.29,ph],[w*.24,d*.24,ph]],[1,2])];
 // 6枚の平面の葉でシルエットを出し、頂点・面数を抑える。
 for(let i=0;i<6;i++){const a=2*Math.PI*i/6,ux=Math.cos(a),uy=Math.sin(a),z0=ph,z1=ph+(h-ph)*(i%2?.80:1),cx=w*.26*ux,cy=d*.26*uy;
  out.push(K.face3([[w*.035*ux,d*.035*uy,z0],[cx-w*.105*uy,cy+d*.105*ux,(z0+z1)/2],[w*.45*ux,d*.45*uy,z1],[cx+w*.105*uy,cy-d*.105*ux,(z0+z1)/2]]));}
 return out;});
})();

// ===== 提灯（単体／3制御点の二次ベジェ紐） =====
const lanternBezier=ASSET_KIT.quadraticEditor('lantern');
function lanternPoint(o,i) { return lanternBezier.point(o,i); }
function lanternCurvePoint(o,t) { return lanternBezier.curve(o,t); }
function lanternBody(o,K,cx,cy,z0,w,d,h) {
    const profile=[[.30,.30,0],[.44,.44,.12],[.50,.50,.40],[.50,.50,.60],[.44,.44,.88],[.30,.30,1]].map(([rx,ry,z])=>[w*rx,d*ry,z0+h*z]);
    return streetRoundPart(o,K,profile,[1,2,3,4],cx,cy);
}
(function(){
    ASSET_KIT.define('paperLantern',{label:'提灯（単体）',glyph:'◉',group:'streetObjects',w:.34,d:.34,h:.48,accent:'#e0ad6d',minHeight:()=>.06,controls:[]},
        (o,K)=>[lanternBody(o,K,0,0,0,Math.max(.05,Math.abs(o.ra)*2),Math.max(.05,Math.abs(o.rb)*2),Math.max(.06,Number(o.h)||.48))]);
    const pointControls=lanternBezier.controls;
    const count={key:'lanternCount',label:'提灯の個数',default:6,min:1,max:16,step:1,integer:true,unit:'個',handle:(o,v)=>{const p=lanternCurvePoint(o,.5);return {anchor:p,sample:[p[0]+.25,p[1],p[2]+.25],probe:[p[0]+1.25,p[1],p[2]+.25],fallback:{x:1,y:0},pixelsPerUnit:24};}},
        sz={key:'lanternSize',label:'提灯の大きさ',default:.42,min:.1,max:1.5,step:.05,unit:'m',handle:(o,v)=>{const n=Math.max(1,Math.round(Number(o.lanternCount)||6)),p=lanternCurvePoint(o,1/(n+1));return {anchor:p,sample:[p[0],p[1],p[2]-.06-v],probe:[p[0],p[1],p[2]-.06-v-1],fallback:{x:0,y:1}};}};
    ASSET_KIT.define('lanternString',{label:'提灯の紐',glyph:'⌒',group:'streetObjects',w:4,d:.3,h:2.5,accent:'#e0ad6d',minHeight:()=>.1,
        controls:[...pointControls,count,sz],bezierEditor:lanternBezier,
        constrainEdit:lanternBezier.constrainWidth
    },(o,K)=>{const n=clamp(Math.round(Number(o.lanternCount)||6),1,16),h=clamp(Number(o.lanternSize)||.42,.1,1.5),curve=Array.from({length:25},(_,i)=>lanternCurvePoint(o,i/24)),edges=[curve],out=[];
        for(let i=0;i<n;i++){const p=lanternCurvePoint(o,(i+1)/(n+1));edges.push([p,[p[0],p[1],p[2]-.06]]);out.push(lanternBody(o,K,p[0],p[1],p[2]-.06-h,h*.72,h*.72,h));}
        return [{meshTriangles:[],meshEdges:edges},...out];
    });
})();

// ===== 暖簾：上辺はつながり、下側は指定枚数に分かれる =====
ASSET_KIT.define('shopNoren',{
    label:'暖簾',glyph:'▥',group:'streetObjects',w:1.5,d:.04,h:.48,accent:'#c25259',minHeight:()=>.08,
    minHalfWidth:o=>{const n=Math.max(1,Math.min(16,Math.round(Number(o.norenPanels)||4))),gap=Math.max(0,Number(o.norenGap)||0);return Math.max(.025,n*.045/2,n*gap*2.5);},minHalfDepth:()=>.005,
    controls:[
        {key:'norenPanels',label:'布の枚数',default:4,min:1,max:o=>{const w=Math.abs(o.ra)*2,gap=Math.max(0,Number(o.norenGap)||0);return Math.max(1,Math.min(16,Math.floor(w/.045+1e-9),gap>0?Math.floor(w/(gap*5)+1e-9):16));},step:1,integer:true,unit:'枚',
            handle:(o,v)=>({anchor:[0,0,o.h],sample:[0,0,o.h+.12],probe:[1,0,o.h+.12],fallback:{x:1,y:0},pixelsPerUnit:24})},
        {key:'norenGap',label:'切れ目の幅',default:.012,min:0,max:o=>Math.max(0,Math.abs(o.ra)*2*.2/Math.max(1,Math.round(Number(o.norenPanels)||4))),step:.005,unit:'m',
            handle:(o,v)=>({anchor:[-o.ra,0,o.h*.45],sample:[-o.ra+v,0,o.h*.45],probe:[-o.ra+v+1,0,o.h*.45],fallback:{x:1,y:0}})}
    ]
},(o,K)=>{
    const w=Math.max(.05,Math.abs(o.ra)*2),d=Math.max(.01,Math.abs(o.rb)*2),h=Math.max(.08,Number(o.h)||.48),
        n=Math.max(1,Math.min(16,Math.floor(w/.045),Math.round(Number(o.norenPanels)||4))),
        gap=Math.max(0,Math.min(w*.2/n,Number.isFinite(Number(o.norenGap))?Number(o.norenGap):.012)),
        header=Math.min(.045,h*.2),panelW=(w-gap*(n-1))/n,edgeFlags={onFace:true,preciseTubeEdge:true},parts=[K.box(K.rectPath(w,d),h-header,h,edgeFlags)];
    for(let i=0;i<n;i++){const x=-w/2+panelW/2+i*(panelW+gap);parts.push(K.box(K.rectPath(panelW,d,x,0),0,h-header,edgeFlags));}
    return parts;
});

// ===== 3点ベジェで編集できる丸断面のケーブル =====
const cableBezier=ASSET_KIT.quadraticEditor('cable',[[-1.5,0,0],[0,0,-.45],[1.5,0,0]]);
ASSET_KIT.define('bezierCable',{
    label:'ベジェケーブル',glyph:'⌒',group:'street',w:3,d:.3,h:1.5,accent:'#b8c7c6',minHeight:()=>.1,
    bezierEditor:cableBezier,constrainEdit:cableBezier.constrainWidth,
    controls:[...cableBezier.controls,
        {key:'cableDiameter',label:'ケーブルの太さ',default:.04,min:.005,max:1,step:.005,unit:'m',
            handle:(o,v)=>{const p=cableBezier.curve(o,.5);return {anchor:p,sample:[p[0],p[1],p[2]-v/2],probe:[p[0],p[1],p[2]-(v+1)/2],fallback:{x:0,y:1}};}}
    ]
},(o,K)=>[K.quadraticTube(o,cableBezier.points(o),Math.max(.0025,Math.min(.5,(Number(o.cableDiameter)||.04)/2)),{steps:24,sides:10})]);

// ===== 写真を基準にした追加小物 =====
(function(){
 const S=o=>({w:Math.max(.1,2*Math.abs(o.ra)),d:Math.max(.1,2*Math.abs(o.rb)),h:Math.max(.1,Number(o.h)||.1)}),
  V=(o,k,f,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(Number(o[k]))?Number(o[k]):f)),
  Z=(o,v,x=0,y=0)=>({anchor:[x,y,0],sample:[x,y,v],probe:[x,y,v+1],fallback:{x:0,y:-1}}),
  flags={onFace:true,preciseTubeEdge:true};
 ASSET_KIT.define('streetPlantBox',{label:'植栽2',glyph:'♧',group:'streetObjects',w:.9,d:.5,h:.3,accent:'#79b974',minHalfWidth:()=>.05,minHalfDepth:()=>.05,minHeight:()=>.06,controls:[]},(o,K)=>{
  const {w,d}=S(o),h=Math.max(.06,Number(o.h)||.3),t=Math.min(.025,w*.1,d*.1,h*.2),out=[K.box(K.rectPath(w,d),0,t,flags),
   K.box(K.rectPath(t,d,-w/2+t/2,0),t,h,flags),K.box(K.rectPath(t,d,w/2-t/2,0),t,h,flags),
   K.box(K.rectPath(w-2*t,t,0,-d/2+t/2),t,h,flags),K.box(K.rectPath(w-2*t,t,0,d/2-t/2),t,h,flags)];
  const edges=[];for(let i=1;i<8;i++){const x=-w/2+w*i/8;edges.push([[x,-d/2-.0001,0],[x,-d/2-.0001,h]]);}out.push({meshTriangles:[],meshEdges:edges,onFace:true});return out;
 });
 const chairBaseRaw=o=>V(o,'squareBaseHeight',.035,.01,Math.max(.01,o.h-.05)),
  chairSeat=o=>V(o,'squareSeatThickness',.06,.02,Math.max(.02,o.h-chairBaseRaw(o)-.03)),
  chairBase=o=>V(o,'squareBaseHeight',.035,.01,Math.max(.01,o.h-chairSeat(o)-.03)),
  chairBaseRadius=o=>V(o,'squareBaseRadius',.124,.01,2),
  chairPoleRadius=o=>V(o,'squarePoleRadius',.04,.005,2),
  chairLeg=o=>Math.max(.03,o.h-chairSeat(o)-chairBase(o));
 ASSET_KIT.define('squareStool',{label:'四角椅子',glyph:'▣',group:'streetObjects',w:.45,d:.4,h:.48,accent:'#c9a27a',geometryBounds:true,minHalfWidth:()=>.06,minHalfDepth:()=>.06,minHeight:o=>Math.max(.15,(Number(o.squareSeatThickness)||.06)+(Number(o.squareBaseHeight)||.035)+.03),controls:[
  {key:'squareSeatWidth',label:'座面の横幅',min:.12,max:8,step:.05,unit:'m',get:o=>2*o.ra,patch:(o,v)=>({ra:v/2}),
   handle:(o,v)=>({anchor:[0,0,o.h],sample:[v/2,0,o.h],probe:[(v+1)/2,0,o.h],fallback:{x:1,y:0}})},
  {key:'squareSeatDepth',label:'座面の縦幅',min:.12,max:8,step:.05,unit:'m',get:o=>2*o.rb,patch:(o,v)=>({rb:v/2}),
   handle:(o,v)=>({anchor:[0,0,o.h],sample:[0,v/2,o.h],probe:[0,(v+1)/2,o.h],fallback:{x:1,y:0}})},
  {key:'squareSeatThickness',label:'座面の高さ',default:.06,min:.02,max:o=>Math.max(.02,o.h-chairBase(o)-.03),step:.01,unit:'m',
   handle:(o,v)=>({anchor:[o.ra*.85,-o.rb*.85,o.h],sample:[o.ra*.85,-o.rb*.85,o.h-v],probe:[o.ra*.85,-o.rb*.85,o.h-v-1],fallback:{x:0,y:1}})},
  {key:'squareLegLength',label:'支柱の長さ',min:.03,max:3,step:.05,unit:'m',get:chairLeg,patch:(o,v)=>({h:v+chairSeat(o)+chairBase(o)}),
   handle:(o,v)=>({anchor:[-o.ra*.7,-o.rb*.7,chairBase(o)],sample:[-o.ra*.7,-o.rb*.7,chairBase(o)+v],probe:[-o.ra*.7,-o.rb*.7,chairBase(o)+v+1],fallback:{x:0,y:-1}})},
  {key:'squareBaseHeight',label:'台座の高さ',default:.035,min:.01,max:o=>Math.max(.01,o.h-chairSeat(o)-.03),step:.01,unit:'m',
   handle:(o,v)=>Z(o,v,-o.ra*.75,o.rb*.75)},
  {key:'squarePoleRadius',label:'支柱の半径',default:.04,min:.005,max:2,step:.005,unit:'m',
   handle:(o,v)=>({anchor:[0,0,o.h*.5],sample:[v,0,o.h*.5],probe:[v+1,0,o.h*.5],fallback:{x:1,y:0}})},
  {key:'squareBaseRadius',label:'台座の半径',min:.01,max:2,step:.01,unit:'m',get:chairBaseRadius,
   handle:(o,v)=>({anchor:[0,0,chairBase(o)],sample:[v,0,chairBase(o)],probe:[v+1,0,chairBase(o)],fallback:{x:1,y:0}})},
  {key:'squareSeatBevel',label:'座面のベベル',type:'range',canvasSlider:true,default:0,min:0,max:o=>Math.min(o.ra,o.rb)*.45,step:.01,unit:'m',handle:(o,v)=>({anchor:[o.ra,-o.rb,o.h],sample:[o.ra-v,-o.rb,o.h],probe:[o.ra-v-1,-o.rb,o.h],fallback:{x:-1,y:0}})}
 ]},(o,K)=>{const {w,d,h}=S(o),seat=chairSeat(o),bh=chairBase(o),br=chairBaseRadius(o),r=chairPoleRadius(o),bevel=Math.max(0,Math.min(Number(o.squareSeatBevel)||0,Math.min(w,d)*.45));return [beveledPrismPart(K,K.rectPath(w,d),h-seat,h,bevel,4,flags),streetRoundPart(o,K,[[r,r,bh],[r,r,h-seat]]),streetRoundPart(o,K,[[br,br,0],[br,br,bh]])];});
 const wardrobeRows=o=>Math.round(V(o,'wardrobeRows',2,1,8)),
  wardrobeSplit=o=>V(o,'wardrobeSplit',48,15,85)/100,
  wardrobeBoardMax=(o,full)=>{const {w,d,h}=S(o),n=wardrobeRows(o),r=wardrobeSplit(o),cell=full?1/n:Math.min(r/n,1-r);return Math.max(.004,Math.min(w*.12,d*.2,h*cell*.3));},
  wardrobeBoard=(o,full)=>V(o,'wardrobeBoard',.035,.004,wardrobeBoardMax(o,full)),
  wardrobeRecess=(o,full)=>V(o,'wardrobeRecess',.12,.01,Math.max(.01,2*o.rb-2*wardrobeBoard(o,full)));
 function wardrobeControls(full){return [
  {key:'wardrobeRows',label:'引き出しの段数',default:2,min:1,max:8,step:1,integer:true,unit:'段',handle:(o,v)=>({anchor:[-o.ra,-o.rb,o.h*.8],sample:[-o.ra+.18+v*.03,-o.rb,o.h*.8],probe:[.82-o.ra+v*.03,-o.rb,o.h*.8],fallback:{x:1,y:0},pixelsPerUnit:24})},
  ...(!full?[{key:'wardrobeSplit',label:'上段の高さの割合',type:'range',default:48,min:15,max:85,step:1,unit:'%',handle:(o,v)=>({anchor:[-o.ra,-o.rb,0],sample:[-o.ra,-o.rb,o.h*(1-v/100)],probe:[-o.ra,-o.rb,o.h*(1-v/100)-1],fallback:{x:0,y:1},pixelsPerUnit:1.2})}]:[]),
  {key:'wardrobeBoard',label:'板の幅',type:'range',default:.035,min:.004,max:o=>wardrobeBoardMax(o,full),step:.001,unit:'m',handle:(o,v)=>({anchor:[-o.ra,-o.rb,o.h*.48],sample:[-o.ra+v,-o.rb,o.h*.48],probe:[1-o.ra+v,-o.rb,o.h*.48],fallback:{x:1,y:0}})},
  {key:'wardrobeRecess',label:'開口の奥行き',type:'range',default:.12,min:.01,max:o=>Math.max(.01,2*o.rb-2*wardrobeBoard(o,full)),step:.01,unit:'m',handle:(o,v)=>({anchor:[o.ra*.35,-o.rb,o.h*.68],sample:[o.ra*.35,-o.rb+v,o.h*.68],probe:[o.ra*.35,1-o.rb+v,o.h*.68],fallback:{x:1,y:0}})}
 ];}
 function wardrobeParts(o,K,full){const {w,d,h}=S(o),n=wardrobeRows(o),t=wardrobeBoard(o,full),recess=wardrobeRecess(o,full),y=-d/2,
  lo=t,hi=h-t,split=lo+(hi-lo)*(1-wardrobeSplit(o)),inner=w-2*t,back=Math.min(d-t*.5,recess),out=[];
  // 前面は実際に穴を空け、側面・棚板と奥面を独立した実体にする。
  out.push(K.box(K.rectPath(t,d,-w/2+t/2,0),0,h,flags),K.box(K.rectPath(t,d,w/2-t/2,0),0,h,flags),
   K.box(K.rectPath(inner,d),0,t,flags),K.box(K.rectPath(inner,d),h-t,h,flags),
   K.box(K.rectPath(inner,t,0,y+back+t/2),lo,hi,flags),K.box(K.rectPath(inner,t,0,d/2-t/2),lo,hi,flags));
  const beam=z=>out.push(K.box(K.rectPath(inner,d),z-t/2,z+t/2,flags)),vertical=(a,b)=>out.push(K.box(K.rectPath(t,d),a,b,flags));
  if(full){vertical(lo,hi);for(let i=1;i<n;i++)beam(lo+(hi-lo)*i/n);}
  else {beam(split);vertical(lo,split-t/2);for(let i=1;i<n;i++)beam(split+(hi-split)*i/n);}
  return out;
 }
 ASSET_KIT.define('shopWardrobe',{label:'タンス',glyph:'▤',group:'streetObjects',w:1.1,d:.5,h:1.55,accent:'#8d624a',minHalfWidth:()=>.1,minHalfDepth:()=>.06,minHeight:()=>.25,controls:wardrobeControls(false)},(o,K)=>wardrobeParts(o,K,false));
 ASSET_KIT.define('shopWardrobe2',{label:'タンス2',glyph:'▦',group:'streetObjects',w:1.1,d:.5,h:1.55,accent:'#8d624a',minHalfWidth:()=>.1,minHalfDepth:()=>.06,minHeight:()=>.25,controls:wardrobeControls(true)},(o,K)=>wardrobeParts(o,K,true));

 // 店の陳列棚：前面が開いた本体と、独立した横板。中身の商品は作らない。
 // h = 台座 + 上部パネル + 段数 × (空間の高さ + 棚板の厚さ)。
 const shelfBase=.07, shelfHeader=.18, shelfMinClear=.08,
  shelfRows=o=>Math.round(V(o,'shelfRows',2,1,8)),
  shelfPitch=o=>(Math.max(shelfBase+shelfHeader,Number(o.h)||1.21)-shelfBase-shelfHeader)/shelfRows(o),
  shelfBoard=o=>V(o,'shelfBoard',.035,.005,Math.max(.005,Math.min(.12,shelfPitch(o)-shelfMinClear))),
  shelfClear=o=>Math.max(shelfMinClear,shelfPitch(o)-shelfBoard(o)),
  shelfHeight=(n,clear,board)=>shelfBase+shelfHeader+n*(clear+board);
 ASSET_KIT.define('displayShelf',{
  label:'棚',glyph:'▤',group:'streetObjects',w:1.4,d:.55,h:1.21,accent:'#9b8866',
  minHalfWidth:()=>.12,minHalfDepth:()=>.07,
  minHeight:o=>shelfHeight(shelfRows(o),shelfMinClear,Math.max(.005,Number(o.shelfBoard)||.035)),
  controls:[
   {key:'shelfRows',label:'段数',default:2,min:1,max:8,step:1,integer:true,unit:'段',
    patch:(o,v)=>({shelfRows:v,h:shelfHeight(v,shelfClear(o),shelfBoard(o))}),
    handle:(o,v)=>({anchor:[-o.ra,-o.rb,o.h-.13],sample:[-o.ra-.12,-o.rb,o.h-.13],probe:[-o.ra+.88,-o.rb,o.h-.13],fallback:{x:1,y:0},pixelsPerUnit:24})},
   {key:'shelfClearHeight',label:'1段の高さ',min:o=>shelfMinClear+shelfBoard(o),max:3,step:.05,unit:'m',get:shelfPitch,
    patch:(o,v)=>({h:shelfHeight(shelfRows(o),v-shelfBoard(o),shelfBoard(o))}),
    handle:(o,v)=>({anchor:[o.ra*.65,-o.rb,shelfBase],sample:[o.ra*.65,-o.rb,shelfBase+v],probe:[o.ra*.65,-o.rb,shelfBase+v+1],fallback:{x:0,y:-1}})},
   {key:'shelfBoard',label:'棚板の厚さ',default:.035,min:.005,max:o=>Math.max(.005,Math.min(.12,shelfPitch(o)-shelfMinClear)),step:.005,unit:'m',
    handle:(o,v)=>({anchor:[-o.ra*.55,-o.rb,shelfBase],sample:[-o.ra*.55,-o.rb,shelfBase+v],probe:[-o.ra*.55,-o.rb,shelfBase+v+1],fallback:{x:0,y:-1}})}
  ]
 },(o,K)=>{
  const {w,d,h}=S(o),n=shelfRows(o),t=shelfBoard(o),pitch=shelfPitch(o),side=.035,back=.025,
   openTop=h-shelfHeader,inner=w-2*side,bodyDepth=d-back,out=[
    K.box(K.rectPath(w,d),0,shelfBase,flags),
    K.box(K.rectPath(w,d),openTop,h,flags),
    K.box(K.rectPath(side,d,-w/2+side/2,0),shelfBase,openTop,flags),
    K.box(K.rectPath(side,d,w/2-side/2,0),shelfBase,openTop,flags),
    K.box(K.rectPath(inner,back,0,d/2-back/2),shelfBase,openTop,flags)
   ];
  for(let i=0;i<n;i++)out.push(K.box(K.rectPath(inner,bodyDepth,0,-back/2),shelfBase+i*pitch,shelfBase+i*pitch+t,flags));
  // 空白の上部パネルに細い縁。正面を塞ぐ扉は作らない。
  const x=w/2-.025,y=-d/2-.001,z0=openTop+.025,z1=h-.025;
  if(x>0 && z1>z0)out.push({meshTriangles:[],meshEdges:[[[ -x,y,z0],[x,y,z0],[x,y,z1],[-x,y,z1],[-x,y,z0]]],...flags});
  return out;
 });

 // 棚2：前が開いたコの字の壁と、Z軸方向の四隅を面取りした独立した薄い棚板。
 // 幅は壁幅と別値。板の下端位置を基準にするので、板厚変更で他の板がずれない。
 const shelf2N=o=>Math.round(V(o,'shelf2Count',3,1,8)),
  shelf2T=o=>V(o,'shelf2BoardT',.04,.02,.18),
  shelf2Wall=o=>V(o,'shelf2WallT',.04,.01,Math.max(.01,Math.min(.35,Math.abs(o.ra)*.9,Math.abs(o.rb)*.9))),
  shelf2Width=o=>V(o,'shelf2BoardW',1.4,.1,6),
  shelf2BevelMax=o=>Math.max(0,Math.min(shelf2Width(o),2*Math.abs(o.rb)+.04)*.49),
  shelf2Bevel=o=>V(o,'shelf2Bevel',.04,0,shelf2BevelMax(o)),
  shelf2Gap=o=>Math.max(shelf2T(o)+.04,(Math.max(.1,Number(o.h)||1.2)-shelf2T(o))/Math.max(1,shelf2N(o)-1)),
  shelf2Height=(n,g,t)=>Math.max(1,n-1)*g+t;
 ASSET_KIT.define('displayShelf2',{
  label:'棚2',glyph:'▥',group:'furniture',w:1.4,d:.55,h:1.2,accent:'#aa986c',
  minHalfWidth:o=>Math.max(.1,(Number(o.shelf2WallT)||.04)/.9+.005),
  minHalfDepth:o=>Math.max(.07,(Number(o.shelf2WallT)||.04)/.9+.005),
  minHeight:o=>shelf2Height(shelf2N(o),shelf2T(o)+.04,shelf2T(o)),
  controls:[
   {key:'shelf2Count',label:'棚板の数',default:3,min:1,max:8,step:1,integer:true,unit:'枚',
    patch:(o,v)=>({shelf2Count:v,h:shelf2Height(v,shelf2Gap(o),shelf2T(o))}),
    handle:(o,v)=>({anchor:[-o.ra,-o.rb,o.h*.75],sample:[-o.ra-.15,-o.rb,o.h*.75],probe:[.85-o.ra,-o.rb,o.h*.75],fallback:{x:1,y:0},pixelsPerUnit:24})},
   {key:'shelf2BoardW',label:'棚板の横幅',default:1.4,min:.1,max:6,step:.05,unit:'m',
    handle:(o,v)=>({anchor:[0,-o.rb-.24,o.h],sample:[v/2,-o.rb-.24,o.h],probe:[(v+1)/2,-o.rb-.24,o.h],fallback:{x:1,y:0}})},
   {key:'shelf2BoardT',label:'棚板の厚さ',default:.04,min:.02,max:o=>Math.max(.02,Math.min(.18,shelf2Gap(o)-.04)),step:.005,unit:'m',
    patch:(o,v)=>({shelf2BoardT:v,h:shelf2Height(shelf2N(o),shelf2Gap(o),v)}),
    handle:(o,v)=>{const z=shelf2N(o)===1?o.h-shelf2T(o):0;return {anchor:[-shelf2Width(o)*.3,-o.rb-.04,z],sample:[-shelf2Width(o)*.3,-o.rb-.04,z+v],probe:[-shelf2Width(o)*.3,-o.rb-.04,z+v+1],fallback:{x:0,y:-1}};}}, 
   {key:'shelf2Bevel',label:'棚板の角のベベル',type:'range',default:.04,min:0,max:shelf2BevelMax,step:.005,unit:'m',
    handle:(o,v)=>({anchor:[shelf2Width(o)/2,-o.rb-.12,o.h],sample:[shelf2Width(o)/2-v,-o.rb-.12,o.h],probe:[shelf2Width(o)/2-v-1,-o.rb-.12,o.h],fallback:{x:-1,y:0}})},
   {key:'shelf2WallT',label:'コの字の壁の厚さ',default:.04,min:.01,max:o=>Math.max(.01,Math.min(.35,Math.abs(o.ra)*.9,Math.abs(o.rb)*.9)),step:.005,unit:'m',
    handle:(o,v)=>({anchor:[-o.ra,-o.rb,o.h*.35],sample:[-o.ra+v,-o.rb,o.h*.35],probe:[1-o.ra+v,-o.rb,o.h*.35],fallback:{x:1,y:0}})},
   {key:'shelf2Spacing',label:'棚板の間隔',min:o=>shelf2T(o)+.04,max:3,step:.05,unit:'m',get:shelf2Gap,
    patch:(o,v)=>({h:shelf2Height(shelf2N(o),v,shelf2T(o))}),
    handle:(o,v)=>({anchor:[o.ra*.6,-o.rb-.04,0],sample:[o.ra*.6,-o.rb-.04,v],probe:[o.ra*.6,-o.rb-.04,v+1],fallback:{x:0,y:-1}})}
  ]
 },(o,K)=>{
  const w=Math.max(.2,2*Math.abs(o.ra)),d=Math.max(.14,2*Math.abs(o.rb)),h=Math.max(.1,Number(o.h)||1.2),
   t=shelf2Wall(o),n=shelf2N(o),bt=shelf2T(o),bw=shelf2Width(o),gap=shelf2Gap(o),
   x=w/2,y=d/2,wall=[[-x,-y],[x*-1,y],[x,y],[x,-y],[x-t,-y],[x-t,y-t],[-x+t,y-t],[-x+t,-y]],
   out=[K.box(wall,0,h,flags)], bd=d+.04, cy=-.02;
  for(let i=0;i<n;i++){
   const z=n===1?h-bt:i*gap, b=shelf2Bevel(o), bx=bw/2, front=cy-bd/2, back=cy+bd/2,
    segments=4, path=beveledBoxFootprint(bw,bd,b,segments).map(([px,py])=>[px,py+cy]),
    seamMarks=[null,null,...path.map((_,index)=>beveledEdgeMark(index,b,segments,'shelf2-'+i))];
   // ベベル直方体と同じ四分割の輪郭・上下の輪・縦のシルエット候補。
   // 各棚板を別グループにし、どの視点でも角の候補が板間で競合しないようにする。
   out.push(K.box(path,z,z+bt,{...flags,seamMarks}));
   // 棚板は壁厚を変えても移動させない。壁と重なる奥端には、実際の
   // 交線を壁の内面に置く。板の埋まった奥端を無理に透かして描かない。
   // 四分割ベベルの輪郭と壁内面の正確な交点（円弧ではなく実際の直線分）。
   const wallFront=y-t, crossX=(()=>{
    const hits=[];
    for(let j=0;j<path.length;j++){
     const a=path[j],c=path[(j+1)%path.length];
     if(Math.abs(a[1]-c[1])<1e-10){if(Math.abs(wallFront-a[1])<1e-9)hits.push(a[0],c[0]);continue;}
     const q=(wallFront-a[1])/(c[1]-a[1]);if(q>=-1e-9&&q<=1+1e-9)hits.push(a[0]+q*(c[0]-a[0]));
    }
    return hits.length?Math.max(...hits):0;
   })(), half=Math.min(x-t,crossX);
   if(wallFront>front+1e-8 && wallFront<back-1e-8 && half>1e-8)
    out.push({meshTriangles:[],meshEdges:[ [[-half,wallFront,z],[half,wallFront,z]], [[-half,wallFront,z+bt],[half,wallFront,z+bt]] ],...flags});
  }
  return out;
 });
 ASSET_KIT.define('pictureStairs',{label:'階段2',glyph:'▰',group:'street',w:1.4,d:2.1,h:1.2,accent:'#c5a768',geometryBounds:true,minHalfWidth:()=>.12,minHalfDepth:()=>.12,minHeight:()=>.15,controls:[
  {key:'pictureStairCount',label:'段数',default:7,min:2,max:20,step:1,integer:true,unit:'段',handle:(o,v)=>({anchor:[-o.ra,-o.rb,o.h*.4],sample:[-o.ra+.15+v*.025,-o.rb,o.h*.4],probe:[.85-o.ra+v*.025,-o.rb,o.h*.4],fallback:{x:1,y:0},pixelsPerUnit:24})},
  {key:'stairSideWidth',label:'両脇枠の幅',default:.07,min:.01,max:o=>Math.max(.01,Math.min(.5,o.ra*.7)),step:.01,unit:'m',handle:(o,v)=>({anchor:[-o.ra,-o.rb,o.h*.18],sample:[-o.ra+v,-o.rb,o.h*.18],probe:[1-o.ra+v,-o.rb,o.h*.18],fallback:{x:1,y:0}})},
  {key:'stairSideHeight',label:'両脇枠の追加高さ',default:0,min:0,max:3,step:.05,unit:'m',handle:(o,v)=>({anchor:[-o.ra,o.rb,o.h],sample:[-o.ra,o.rb,o.h+v],probe:[-o.ra,o.rb,o.h+v+1],fallback:{x:0,y:-1}})}
 ]},(o,K)=>{const {w,d,h}=S(o),n=Math.round(V(o,'pictureStairCount',7,2,20)),edge=V(o,'stairSideWidth',.07,.01,Math.min(.5,w*.35)),extra=V(o,'stairSideHeight',0,0,3),inner=w-2*edge,landing=d*.18,run=(d-landing)/n,out=[];
  for(let i=0;i<n;i++){const y=-d/2+(i+.5)*run;out.push(K.box(K.rectPath(inner,run,0,y),0,h*(i+1)/n,flags));}
  out.push(K.box(K.rectPath(inner,landing,0,d/2-landing/2),0,h,flags));
  const profile=[[-d/2,0],[d/2,0],[d/2,h+extra],[-d/2,Math.min(h*.15,.12)+extra]];
  out.push(K.box(profile,-w/2,-w/2+edge,{axis:'x',...flags}),K.box(profile,w/2-edge,w/2,{axis:'x',...flags}));return out;});
})();

// 片側支柱と二段ループの車止め。左右反転はローカルXの符号を変え、回転では代用しない。
ASSET_KIT.define('guardPoleHalf',{
 label:'片側車止めポール',glyph:'♧',group:'traffic',w:.65,d:.22,h:.65,accent:'#e7b626',
 minHalfWidth:()=>.08,minHalfDepth:()=>.05,minHeight:()=>.18,controls:[
  {key:'halfPoleLength',label:'ポールの長さ',min:.18,max:4,step:.05,unit:'m',get:o=>o.h,patch:(o,v)=>({h:v}),
   handle:(o,v)=>({anchor:[-o.ra*.72,-o.rb*.7,0],sample:[-o.ra*.72,-o.rb*.7,v],probe:[-o.ra*.72,-o.rb*.7,v+1],fallback:{x:0,y:-1}})},
  {key:'halfPoleDiameter',label:'ポールの太さ',default:.05,min:.02,max:o=>Math.max(.02,Math.min(.18,o.ra*.45,o.rb*.8,o.h*.2)),step:.005,unit:'m',
   handle:(o,v)=>({anchor:[o.ra*.65,0,o.h*.3],sample:[o.ra*.65+v/2,0,o.h*.3],probe:[o.ra*.65+(v+1)/2,0,o.h*.3],fallback:{x:1,y:0}})},
  {key:'halfPoleMirror',label:'左右を鏡反転',type:'boolean',default:false}
 ]
},(o,K)=>{
 const w=Math.max(.16,2*Math.abs(o.ra)),d=Math.max(.1,2*Math.abs(o.rb)),h=Math.max(.18,Number(o.h)||.65),
 diam=Math.max(.02,Math.min(Number(o.halfPoleDiameter)||.05,.18,w*.225,d*.4,h*.2)),r=diam/2,sign=o.halfPoleMirror?-1:1,
 xp=sign*(w/2-r),xl=-sign*(w/2-r*1.4),span=Math.max(.005,d/2-r*1.2),top=h-r,mid=Math.max(r*2,h*.5),
 out=[streetRoundPart(o,K,[[r,r,0],[r,r,top]],[],xp,0)];
 for(const z of [top,mid]){
   const a=[xp,0,z],b=[xl,-span,z],c=[xl,span,z],q=(p,v,t)=>p.map((x,i)=>x*(1-t)+v[i]*t);
   // 三つの短いベジェ管で、丸い先端と二本の腕を持つ水平ループを作る。
   for(const pts of [[a,q(a,b,.55),b],[b,[xl-sign*r*.2,0,z],c],[c,q(c,a,.45),a]])out.push(K.quadraticTube(o,pts,r,{steps:4,sides:8}));
 }
 return out;
});

// ===== 屋根板・監視カメラ・飲料コンテナ =====
(function(){
 const v=(o,k,d,lo,hi)=>clamp(o[k]!=null&&Number.isFinite(Number(o[k]))?Number(o[k]):d,lo,hi),
       flag={onFace:true,preciseTubeEdge:true};
 // 山を連続した一枚の断面から押し出す。表面と裏面は同じ波形。
 ASSET_KIT.define('corrugatedRoof',{label:'トタン屋根の板',glyph:'▰',group:'buildingParts',w:1,d:1.4,h:.08,accent:'#a8aaa4',
  minHalfWidth:()=>.05,minHalfDepth:()=>.05,minHeight:()=>.02,controls:[
   {key:'roofWaveCount',label:'蛇腹（波）の数',type:'range',canvasSlider:true,default:8,min:1,max:24,step:1,integer:true,unit:'山',
    handle:(o,v)=>{const step=2*Math.abs(o.ra)/24,x=-Math.abs(o.ra)+v*step;return {anchor:[-Math.abs(o.ra),-Math.abs(o.rb),o.h],sample:[x,-Math.abs(o.rb),o.h],probe:[x+step,-Math.abs(o.rb),o.h],fallback:{x:1,y:0}};}},
   {key:'roofSheetThickness',label:'板の厚さ',type:'range',canvasSlider:true,default:.01,min:.003,max:o=>Math.max(.003,Math.min(.08,o.h*.45)),step:.005,unit:'m',
    handle:(o,x)=>({anchor:[-o.ra,-o.rb,0],sample:[-o.ra,-o.rb,x],probe:[-o.ra,-o.rb,x+1],fallback:{x:0,y:-1}})}
  ]},(o,K)=>{
   const w=Math.max(.1,2*Math.abs(o.ra)),d=Math.max(.1,2*Math.abs(o.rb)),h=Math.max(.02,o.h),
    n=K.count(o.roofWaveCount,8,1,24),t=v(o,'roofSheetThickness',.01,.003,Math.min(.08,h*.45)),steps=n*4,top=[];
   for(let i=0;i<=steps;i++){const x=-w/2+w*i/steps,z=t+(h-t)*(1-Math.cos(i*Math.PI/2))/2;top.push([x,z]);}
   const bottom=top.map(([x,z])=>[x,z-t]).reverse();
   return [K.box([...top,...bottom],-d/2,d/2,{axis:'y',...flag})];
  });
 // 4面ひさし部品。傾き・枠の奥行き・つばの長さ・厚さを親アセットからも編集できる。
 const stem=o=>v(o,'cameraStemHeight',.12,.04,2),
  securityCameraHoodParams=o=>{
   const w=Math.max(.14,Math.abs(o.ra)*2),d=Math.max(.2,Math.abs(o.rb)*2),h=Math.max(stem(o)+.22,o.h),base=.10+stem(o),hh=h-base,hoodH=hh*.92,
    maxT=Math.max(.005,Math.min(w*.4,hoodH*.28)),frame=Math.max(.005,Math.min(.035,d*.08)),brim=Math.max(.01,d*.26),t=v(o,'cameraHoodThickness',Math.max(.005,Math.min(w,hh)*.055),.005,maxT),
    frameDepth=v(o,'cameraHoodFrameLength',frame,.005,Math.max(.01,d*.8)),brimLength=v(o,'cameraHoodBrimLength',brim,0,Math.max(.01,d*1.5)),
    knee=v(o,'cameraHoodTilt',hoodH*.55,t+.001,hoodH-t-.001);
   return {w,d,h,base,hh,hoodH,t,frameDepth,brimLength,length:frameDepth+brimLength,knee,maxT,kneeMin:t+.001,kneeMax:hoodH-t-.001};
  };
 ASSET_KIT.define('securityCamera',{label:'監視カメラ',glyph:'◉',group:'street',w:.34,d:.55,h:.50,accent:'#a3aba8',
  minHalfWidth:()=>.07,minHalfDepth:()=>.1,minHeight:o=>stem(o)+.22,controls:[
   {key:'cameraStemHeight',label:'支柱の長さ',default:.12,min:.04,max:2,step:.01,unit:'m',patch:(o,x)=>({cameraStemHeight:x,h:o.h+x-stem(o)}),handle:(o,x)=>({anchor:[0,0,.10],sample:[0,0,.10+x],probe:[0,0,1.10+x],fallback:{x:0,y:-1}})},
   ...ASSET_KIT.hoodControls('cameraHood',securityCameraHoodParams,{frameMax:(o)=>Math.max(.01,Math.abs(o.rb)*1.6),brimMax:(o)=>Math.max(.01,Math.abs(o.rb)*3)})
  ]},(o,K)=>{
   const w=Math.max(.14,Math.abs(o.ra)*2),d=Math.max(.2,Math.abs(o.rb)*2),h=Math.max(stem(o)+.22,o.h),
    base=.10+stem(o),hh=h-base,front=-d*.32,back=d*.45,headD=back-front,headY=(front+back)/2,
    lensR=Math.min(w*.27,hh*.30),hoodW=w,hoodH=hh*.92,hoodBase=base+hh*.04,
    hood=securityCameraHoodParams(o),frame=hood.frameDepth,brim=hood.brimLength,hoodY=front+frame/2-brim/2,
    t=hood.t,b=Math.min(w,hh)*.12;
   const parts=[
    K.box(K.rectPath(w*.68,.025,0,d*.48),0,Math.max(.16,base*.78),flag),
    K.box(K.rectPath(w*.58,d*.46,0,d*.20),.07,.095,flag),
    K.cylinder(Math.min(w*.13,.045),.095,base,{seg:12,verts:4,...flag}),
    K.box(K.rectPath(w*.80,headD,0,headY),base,h-hh*.06,flag),
    ...K.moveParts(K.part('screenHood',{w:hoodW,h:hoodH,frameDepth:frame,brimLength:brim,knee:hood.knee,t,bevel:b}),0,hoodY,hoodBase),
    ...K.moveParts([K.cylinder(lensR*1.15,front-.035,front+.005,{axis:'y',seg:20,verts:4,...flag}),
                    K.cylinder(lensR*.78,front-.048,front-.036,{axis:'y',seg:20,verts:4,...flag})],0,0,base+hh*.52)
   ];return parts;
  });
 // 写真のような上面が開いた樹脂ケース。横の持ち手は実際に空いた開口。
 ASSET_KIT.define('bottleCrate',{label:'飲料コンテナ',glyph:'▣',group:'streetObjects',w:.55,d:.38,h:.32,accent:'#d89c27',
  minHalfWidth:()=>.06,minHalfDepth:()=>.06,minHeight:()=>.08,controls:[
   {key:'crateCount',label:'重ねる個数',type:'range',canvasSlider:true,default:1,min:1,max:8,step:1,integer:true,unit:'個'}
  ]},(o,K)=>{
   const w=Math.max(.12,2*Math.abs(o.ra)),d=Math.max(.12,2*Math.abs(o.rb)),h=Math.max(.08,o.h),
    t=Math.min(.018,w*.08,d*.08,h*.09),rim=Math.min(.03,h*.1),mid0=h*.50,mid1=h*.75,
    parts=[],box=(x,y,ww,dd,z0,z1)=>parts.push(K.box(K.rectPath(ww,dd,x,y),z0,z1,flag));
   // 底・前後左右の板。持ち手部分は中央を空けて四角い開口を残す。
   box(0,0,w-2*t,d-2*t,0,t);
   for(const sy of [-1,1]){const y=sy*(d/2-t/2);box(0,y,w,t,t,mid0);box(0,y,w,t,mid1,h-rim);
    for(const sx of [-1,1])box(sx*w*.375,y,w*.25,t,mid0,mid1);}
   for(const sx of [-1,1]){const x=sx*(w/2-t/2);box(x,0,t,d-2*t,t,mid0);box(x,0,t,d-2*t,mid1,h-rim);
    for(const sy of [-1,1])box(x,sy*(d-2*t)*.375,t,(d-2*t)*.25,mid0,mid1);}
   // ケース端の張り出し縁。4つの帯で上面開口をふさがない。
   for(const z of [0,h-rim]){
    for(const sy of [-1,1])box(0,sy*(d/2-t*.4),w+2*t,t*1.8,z,z+rim);
    for(const sx of [-1,1])box(sx*(w/2-t*.4),0,t*1.8,d-2*t,z,z+rim);
   }
   return K.repeatParts(parts,{axis:'z',spacing:h,count:K.count(o.crateCount,1,1,8)});
  });
})();

// ===== 電車の内装（部品を個別に組み合わせる） =====
(function(){
 const flag={onFace:true,preciseTubeEdge:true};
 const value=(o,k,d,lo,hi)=>clamp(Number.isFinite(Number(o[k]))?Number(o[k]):d,lo,Math.max(lo,hi));
 const box=(K,w,d,x,y,z0,z1)=>K.box(K.rectPath(w,d,x,y),z0,z1,flag);
 const cylinder=(K,r,z0,z1,opt={})=>({...K.cylinder(r,z0,z1,{seg:12,verts:4,...opt}),...flag});
 const ring=(K,w,h,x,z,y0,y1,t)=>{
  // 面の中央は実際に穴を開ける。外周と内周を同じ角数で結んで環状面を作り、
  // 扇状分割で中央が塞がらないようにする。分割線は描かず輪郭だけを線にする。
  const r=Math.min(w,h)*.20,outer=K.roundRectPath(w,h,r,2,x,z),inner=K.roundRectPath(w-2*t,h-2*t,Math.max(.002,r-t),2,x,z),tris=[],edges=[];
  const pt=(a,y)=>[a[0],y,a[1]],quad=(a,b,c,d)=>tris.push([a,b,c],[a,c,d]);
  for(let i=0;i<outer.length;i++){const j=(i+1)%outer.length,a=outer[i],b=outer[j],c=inner[i],e=inner[j];
   quad(pt(a,y0),pt(b,y0),pt(e,y0),pt(c,y0));quad(pt(a,y1),pt(c,y1),pt(e,y1),pt(b,y1));
   quad(pt(a,y0),pt(a,y1),pt(b,y1),pt(b,y0));quad(pt(c,y0),pt(e,y0),pt(e,y1),pt(c,y1));}
  for(const y of [y0,y1])for(const path of [outer,inner])edges.push([...path.map(p=>pt(p,y)),pt(path[0],y)]);
  for(const i of [0,3,6,9])edges.push([pt(outer[i],y0),pt(outer[i],y1)]);
  return {meshTriangles:tris,meshEdges:edges,...flag};
 };
 // 電車窓・扉窓の外周は、ベベル直方体と同じ4分割の点列を共有する。
 // 小さな窓でも既存の0.01m下限で形が膨らまないよう、比例拡大してから戻す。
 // 参考画像風の電車1両：深緑の車体、黄土色の帯、連続窓・片開き扉、屋根機器。
 ASSET_KIT.define('trainCar',{label:'電車車両',glyph:'🚆',group:'train',w:2.8,d:12,h:3.35,accent:'#547b43',
  geometryBounds:true,minHalfWidth:()=>.7,minHalfDepth:()=>1,minHeight:()=>1.2,
  controls:[{key:'trainCarWindowCount',label:'側面窓の数',type:'range',default:6,min:3,max:10,step:1,integer:true,unit:'枚'}]},(o,K)=>{
  const w=Math.max(1.4,2*Math.abs(o.ra)),len=Math.max(2,2*Math.abs(o.rb)),h=Math.max(1.2,Number(o.h)||3.35),
   count=Math.max(3,Math.min(10,Math.round(Number(o.trainCarWindowCount)||6))),sideT=.035,
   lower=.34,bandZ=.92,topZ=1.35,roofZ=h*.88,out=[];
  const panel=(side,y0,y1,z0,z1,color,extra={})=>{
   const x0=side<0?-w/2-sideT:w/2-sideT,x1=side<0?-w/2+sideT:w/2+sideT;
   out.push(K.box(K.rectPath(y1-y0,z1-z0,(y0+y1)/2,(z0+z1)/2),x0,x1,{axis:'x',color,...extra}));
  };
  // 車体本体・下回り・側面帯。
  out.push(K.box(K.rectPath(w,len),0,h,{color:'#547b43'}));
  out.push(K.box(K.rectPath(w*1.04,len*.98),.12,.48,{color:'#51484a'}));
  for(const side of [-1,1]){
   panel(side,-len/2,len/2,.48,bandZ,'#a98224');
   panel(side,-len/2,len/2,bandZ,topZ,'#c6b05a');
   // 窓は端部に余白を残して均等配置。枠＋濃色ガラスの二層。
   const doorY=len*.30,usable=len*.78,step=usable/count,winW=step*.72,winH=Math.min(.78,h*.27),winZ=h*.66;
   for(let i=0;i<count;i++){
    const cy=-len*.39+(i+.5)*step;
    if(Math.abs(cy-doorY)<.68)continue;
    panel(side,cy-winW/2,cy+winW/2,winZ-winH/2,winZ+winH/2,'#473e4b');
    panel(side,cy-winW/2+.055,cy+winW/2-.055,winZ-winH/2+.055,winZ+winH/2-.055,'#384650');
   }
   // 乗降扉と上窓。
   panel(side,doorY-.44,doorY+.44,.55,2.30,'#594b4a');
   panel(side,doorY-.31,doorY+.31,1.62,2.20,'#51676a');
   panel(side,doorY-.27,doorY+.27,1.66,2.16,'#94b5ae');
   panel(side,doorY+.31,doorY+.35,.85,1.02,'#d3bd6d');
   // 手すりと車体下の細い横桟。
   panel(side,-len/2,len/2,lower,lower+.045,'#d3bd6d');
   panel(side,-len/2,len/2,.20,.25,'#81705a');
  }
  // 前後の運転台窓・灯火。
  for(const end of [-1,1]){
   const y0=end<0?-len/2-.008:len/2-.008,y1=end<0?-len/2+.008:len/2+.008;
   out.push(K.box(K.rectPath(w*.55,.85,0,h*.68),y0,y1,{axis:'y',color:'#4b424b'}));
   out.push(K.box(K.rectPath(w*.49,.72,0,h*.68),y0+end*.01,y1+end*.01,{axis:'y',color:'#657c7b'}));
   for(const sx of [-1,1])out.push(K.box(K.rectPath(.14,.18,sx*w*.34,h*.39),y0,y1,{axis:'y',color:'#db762a'}));
  }
  // 屋根の空調・換気箱とパンタグラフ風の架線機器。
  for(const y of [-len*.25,len*.05])out.push(K.box(K.rectPath(w*.34,len*.10,0,y),roofZ,roofZ+.28,{color:'#625954'}));
  for(const yy of [len*.22,len*.35])out.push(K.box(K.rectPath(.055,.48,0,yy),roofZ+.28,roofZ+.78,{color:'#554b4d'}));
  out.push(K.box(K.rectPath(.75,.055,0,len*.285),roofZ+.72,roofZ+.79,{color:'#554b4d'}));
  // 台車・車輪（各側2軸）。
  for(const side of [-1,1])for(const y of [-len*.31,len*.31]){
   const x=side*(w*.39);
   out.push(K.box(K.rectPath(.72,1.55,x,y),.28,.55,{color:'#625a54'}));
   for(const yy of [y-.48,y+.48])out.push(...K.part('tire',{r:.34,t:.16,x:side*(w*.48),axleY:yy,z:0}));
  }
  return out;
 });

 const trainFramePath=(K,w,h,r,x,z)=>{
  const scale=Math.max(1,.02/Math.min(w,h));
  return beveledBoxFootprint(w*scale,h*scale,r*scale,4).map(([u,v])=>[x+u/scale,z+v/scale]);
 };
 const trainHoleWall=(K,outer,y0,y1,hole,r,group)=>{
  // 表裏2輪、穴の表裏2輪、外側4辺の後に穴の押出方向の線が並ぶ。
  const seamMarks=[null,null,null,null,null,null,null,null,
   ...hole.map((_,i)=>beveledEdgeMark(i,r,4,group))];
  return K.box(outer,y0,y1,{axis:'y',holes:[hole],holeSides:true,seamMarks,...flag});
 };
 const trainWindowRing=(K,w,h,x,z,y0,y1,t,r,group)=>{
  const outer=trainFramePath(K,w,h,r,x,z),inner=trainFramePath(K,w-2*t,h-2*t,Math.max(.000001,r-t),x,z),
   tris=[],edges=[],marks=[],pt=(a,y)=>[a[0],y,a[1]],
   quad=(a,b,c,d)=>tris.push([a,b,c],[a,c,d]),add=(line,mark=null)=>{edges.push(line);marks.push(mark)},
   loop=(path,y)=>[...path.map(p=>pt(p,y)),pt(path[0],y)];
  for(let i=0;i<outer.length;i++){const j=(i+1)%outer.length,a=outer[i],b=outer[j],c=inner[i],e=inner[j];
   quad(pt(a,y0),pt(b,y0),pt(e,y0),pt(c,y0));quad(pt(a,y1),pt(c,y1),pt(e,y1),pt(b,y1));
   quad(pt(a,y0),pt(a,y1),pt(b,y1),pt(b,y0));quad(pt(c,y0),pt(e,y0),pt(e,y1),pt(c,y1));}
  // 壁の穴と接する外周後端は壁側が同一線を持つため二重に追加しない。
  add(loop(outer,y0));add(loop(inner,y0));add(loop(inner,y1));
  outer.forEach((p,i)=>add([pt(p,y0),pt(p,y1)],beveledEdgeMark(i,r,4,group+'-outer')));
  const ir=Math.max(.000001,r-t);
  inner.forEach((p,i)=>add([pt(p,y0),pt(p,y1)],beveledEdgeMark(i,ir,4,group+'-inner')));
  return {meshTriangles:tris,meshEdges:edges,seamMarks:marks,...flag};
 };
 const seatHeight={key:'trainSeatHeight',label:'座面の高さ',default:.43,min:.16,max:o=>Math.max(.16,o.h*.74),step:.01,unit:'m',
  handle:(o,v)=>({anchor:[-o.ra,-o.rb,0],sample:[-o.ra,-o.rb,v],probe:[-o.ra,-o.rb,v+1],fallback:{x:0,y:-1}})};
 const seatCount=o=>{const n=Number(o.trainSeatCount ?? 4);return Math.max(1,Math.min(12,Number.isFinite(n)?Math.round(n):4));};
 const countControl={key:'trainSeatCount',label:'席数',type:'range',canvasSlider:true,default:4,min:1,max:12,step:1,integer:true,unit:'席'};
 const quietRounded=(K,w,d,h,r,opt)=>({...K.roundedBox(w,d,h,r,opt),ringLines:[],verticals:[]});
 function seat(kind,label,w,divided,single){
  ASSET_KIT.define(kind,{label,glyph:divided?'▥':'▰',group:'train',w,d:.68,h:.98,accent:'#3d5273',minHalfWidth:o=>divided&&!single?.005*seatCount(o):.12,minHalfDepth:()=>.12,minHeight:()=>.3,
   // 席数だけを編集したとき、中心を固定し、1席幅を維持したまま左右へ増減。
   // raを同時に指定した読み込み・リセット等はそのまま尊重する。
   constrainEdit:(next,old,patch)=>divided&&!single && Object.prototype.hasOwnProperty.call(patch,'trainSeatCount') && !Object.prototype.hasOwnProperty.call(patch,'ra')
     ? {...next,ra:Math.abs(old.ra)*seatCount(next)/seatCount(old)} : next,
   controls:[seatHeight,...(divided&&!single?[countControl]:[]),{key:'trainSeatArms',label:'両端の手すり',type:'boolean',default:!(divided&&single)}]},(o,K)=>{
   const w=Math.max(divided&&!single?.01*seatCount(o):.24,2*Math.abs(o.ra)),d=Math.max(.24,2*Math.abs(o.rb)),h=Math.max(.3,o.h),
    sh=value(o,'trainSeatHeight',.43,.16,h*.74),n=divided&&!single?K.count(o.trainSeatCount,4,1,12):1,
    frame=Math.min(.045,w*.07,d*.10),cush=Math.min(.10,sh*.24),backD=Math.min(d*.20,.13),out=[];
   // 箱型台座と前面の点検用パネル。座面は台座より前へ張り出す。
   if(!divided){out.push(box(K,w*.96,d*.82,0,d*.07,0,Math.max(.05,sh-cush)));
    if(w>.45&&sh>.28){const z0=sh*.19,z1=sh*.66;out.push(box(K,w*.76,.008,0,-d*.347,z0,z1));
     for(let i=1;i<4;i++)out.push(box(K,w*.68,.010,0,-d*.355,z0+(z1-z0)*i/4,z0+(z1-z0)*i/4+.008));}}
   else{ // 区切り席は写真のように床下を空け、横桟と細い脚で支える。
    const leg=Math.min(.025,w*.06,d*.06),top=Math.max(.06,sh-cush);
    out.push({...box(K,w*.91,Math.min(d*.25,.10),0,0,Math.max(.03,top-.06),top),preciseTinyGaps:true});
    for(const x of [-w*.37,w*.37])out.push({...cylinder(K,leg,0,top,{cx:x,cy:0})});}
   // 横に連続するタイプと、1席ごとの座面・背もたれを共通部品で作る。
   const gap=divided&&!single?Math.min(.018,w/(n*8)):0,cell=w/n;
   for(let i=0;i<n;i++){const x=-w/2+cell*(i+.5),cw=Math.max(.002,cell-gap);
    if(divided){
     // 写真の一体成形座席。座面を少し窪ませ、腰から背へ曲線で立ち上げる。
     // 側面の断面を横へ押し出すので表面は連続し、座面と背に継ぎ目を作らない。
     const rise=h-sh,t=Math.min(.065,sh*.22,rise*.20),top=[
      [-.45*d,sh],[-.35*d,sh-t*.20],[-.22*d,sh-t*.42],[-.07*d,sh-t*.50],
      [.07*d,sh-t*.38],[.15*d,sh-t*.08],[.21*d,sh+rise*.08],[.25*d,sh+rise*.20],
      [.29*d,sh+rise*.40],[.34*d,sh+rise*.68],[.39*d,h-t*.35]],
     bottom=[[.48*d,h-t*.35],[.43*d,sh+rise*.68],[.38*d,sh+rise*.38],[.34*d,sh+rise*.15],
      [.29*d,sh+rise*.02],[.23*d,sh-t*.65],[.10*d,sh-t*1.3],[-.08*d,sh-t*1.45],[-.24*d,sh-t*1.35],[-.45*d,sh-t]];
     const profile=[...top,...bottom],xs=[x-cw/2,x+cw/2],p=(u,v)=>[u,v[0],v[1]],meshTriangles=[],meshEdges=[];
     for(const [a,b,c] of K.triangulate(profile)){meshTriangles.push([p(xs[0],a),p(xs[0],c),p(xs[0],b)],[p(xs[1],a),p(xs[1],b),p(xs[1],c)]);}
     for(let j=0;j<profile.length;j++){const k=(j+1)%profile.length,a=p(xs[0],profile[j]),b=p(xs[1],profile[j]),c=p(xs[1],profile[k]),d=p(xs[0],profile[k]);meshTriangles.push([a,b,c],[a,c,d]);}
     // 曲面の稜線や厚み方向のベベル線は省き、見分けに必要な座面の外形・区切りだけ残す。
     // 隣り合う席では区切り線を片側に集約して、二重線にならないようにする。
     meshEdges.push(top.map(v=>p(xs[0],v)));
     if(i===n-1)meshEdges.push(top.map(v=>p(xs[1],v)));
     for(const j of [0,top.length-1])meshEdges.push([p(xs[0],top[j]),p(xs[1],top[j])]);
     out.push({meshTriangles,meshEdges,...flag});
    } else {
     out.push(quietRounded(K,cw,d*.91,cush,Math.min(.035,cush*.32),{cx:x,cy:-d*.025,z0:sh-cush,seg:2,cornerSeg:1,extra:flag}));
     out.push(quietRounded(K,cw,backD,Math.max(.05,h-sh),Math.min(.03,backD*.3),{cx:x,cy:d/2-backD/2,z0:sh,seg:2,cornerSeg:1,extra:flag}));
    }
   }
   if(o.trainSeatArms!==false && (!(divided&&single)||o.trainSeatArms===true)){const r=Math.min(.018,w*.035,d*.04),z=Math.min(h*.86,sh+.25),yf=-d*.38,yb=d*.38;
    for(const s of [-1,1]){const x=s*(w/2-r);out.push({...K.quadraticTube(o,[[x,yf,sh],[x,yf,z],[x,(yf+yb)/2,z]],r,{steps:4,sides:8}),...flag});
     out.push({...K.quadraticTube(o,[[x,(yf+yb)/2,z],[x,yb,z],[x,yb,sh]],r,{steps:4,sides:8}),...flag});}}
   return out;
  });
 }
 seat('trainBench','電車の長椅子',2.4,false,false);
 seat('trainSeat','電車の椅子（長座面）',.58,false,true);
 seat('trainDividedBench','電車の区切り長椅子',2.4,true,false);
 seat('trainDividedSeat','電車の椅子（区切り）',.58,true,true);
 const horizontalPoleLength={key:'trainRailLength',label:'ポールの長さ',min:.2,max:10,step:.05,unit:'m',get:o=>2*Math.abs(o.ra),patch:(o,v)=>({ra:v/2}),
  handle:(o,v)=>({anchor:[0,-o.rb-.16,o.h],sample:[v/2,-o.rb-.16,o.h],probe:[v/2+1,-o.rb-.16,o.h],fallback:{x:1,y:0}})};
 ASSET_KIT.define('trainStraps',{label:'つり革',glyph:'♧',group:'train',w:1.5,d:.12,h:.45,accent:'#bfc3c6',geometryBounds:true,minHalfWidth:()=>.10,minHalfDepth:()=>.025,minHeight:()=>.20,controls:[
  {key:'trainStrapCount',label:'つり革の数',type:'range',canvasSlider:true,default:4,min:1,max:12,step:1,integer:true,unit:'個'},horizontalPoleLength
 ]},(o,K)=>{const w=Math.max(.2,2*Math.abs(o.ra)),d=Math.max(.05,2*Math.abs(o.rb)),h=Math.max(.2,o.h),n=K.count(o.trainStrapCount,4,1,12),r=Math.min(.016,d*.22,h*.05),out=[cylinder(K,r,-w/2,w/2,{axis:'x',cx:0,cy:h-r})];
  const cell=w/n,rw=Math.min(.16,cell*.72,h*.36),rh=Math.min(.19,h*.42),t=Math.min(.018,rw*.14,rh*.14);
  for(let i=0;i<n;i++){const x=-w/2+(i+.5)*cell,top=h-r*2;out.push(box(K,Math.max(.01,rw*.20),Math.min(d*.42,.025),x,0,rh,top));out.push(ring(K,rw,rh,x,rh/2,-Math.min(d*.4,.016),Math.min(d*.4,.016),t));}return out;
 });
 const poleLength={key:'trainPoleLength',label:'ポールの長さ',min:.2,max:5,step:.05,unit:'m',get:o=>o.h,patch:(o,v)=>({h:v}),
  handle:(o,v)=>({anchor:[.22,0,0],sample:[.22,0,v],probe:[.22,0,v+1],fallback:{x:0,y:-1}})};
 ASSET_KIT.define('trainPole',{label:'車内の縦ポール',glyph:'│',group:'train',w:.08,d:.08,h:2.2,accent:'#bfc3c6',minHalfWidth:()=>.012,minHalfDepth:()=>.012,minHeight:()=>.2,controls:[poleLength]},(o,K)=>{
  const w=Math.max(.024,Math.abs(o.ra)*2),d=Math.max(.024,Math.abs(o.rb)*2),h=Math.max(.2,o.h),r=Math.min(w,d)*.36;return [cylinder(K,r,0,h),cylinder(K,Math.min(w,d)*.5,0,Math.min(.04,h*.1)),cylinder(K,Math.min(w,d)*.5,h-Math.min(.04,h*.1),h)];});
 ASSET_KIT.define('trainHandrail',{label:'車内の横手すり',glyph:'┰',group:'train',w:1.8,d:.18,h:.12,accent:'#bfc3c6',geometryBounds:true,minHalfWidth:()=>.10,minHalfDepth:()=>.025,minHeight:()=>.04,controls:[horizontalPoleLength]},(o,K)=>{
  const w=Math.max(.2,2*Math.abs(o.ra)),d=Math.max(.05,2*Math.abs(o.rb)),h=Math.max(.04,o.h),r=Math.min(.022,d*.16,h*.20),out=[cylinder(K,r,-w/2,w/2,{axis:'x',cx:-d*.25,cy:h*.5})];
  for(const x of [-w*.42,w*.42]){const rail=cylinder(K,r,-d*.25,d*.48,{axis:'y',cx:x,cy:h*.5});out.push(rail,box(K,r*4,Math.min(.02,d*.12),x,d*.46,h*.5-r*2,h*.5+r*2));}return out;
 });
 ASSET_KIT.define('trainWindowWall',{label:'窓付き車内壁',glyph:'▣',group:'train',w:2,d:.12,h:2.35,accent:'#9babae',geometryBounds:true,minHalfWidth:()=>.25,minHalfDepth:()=>.025,minHeight:()=>.6,controls:[
  {key:'trainWindowWidth',label:'窓の幅',default:1.35,min:.2,max:o=>Math.max(.2,2*o.ra-.16),step:.05,unit:'m',handle:(o,v)=>({anchor:[0,-o.rb,o.h*.65],sample:[v/2,-o.rb,o.h*.65],probe:[v/2+1,-o.rb,o.h*.65],fallback:{x:1,y:0}})},
  {key:'trainWindowHeight',label:'窓の高さ',default:.9,min:.2,max:o=>Math.max(.2,o.h-value(o,'trainWindowBottom',1,.08,o.h-value(o,'trainWindowHeight',.9,.2,o.h-.16)-.08)-.08),step:.05,unit:'m',handle:(o,v)=>{const z=value(o,'trainWindowBottom',1,.08,o.h-v-.08);return {anchor:[0,-o.rb,z],sample:[0,-o.rb,z+v],probe:[0,-o.rb,z+v+1],fallback:{x:0,y:-1}}}},
  {key:'trainWindowBottom',label:'窓の下端',default:1.0,min:.08,max:o=>Math.max(.08,o.h-value(o,'trainWindowHeight',.9,.2,o.h-.16)-.08),step:.05,unit:'m',handle:(o,v)=>({anchor:[-o.ra,-o.rb,0],sample:[-o.ra,-o.rb,v],probe:[-o.ra,-o.rb,v+1],fallback:{x:0,y:-1}})}
 ]},(o,K)=>{const w=Math.max(.5,2*Math.abs(o.ra)),d=Math.max(.05,2*Math.abs(o.rb)),h=Math.max(.6,o.h),ww=value(o,'trainWindowWidth',1.35,.2,w-.16),wh=value(o,'trainWindowHeight',.9,.2,h-.16),z=value(o,'trainWindowBottom',1,.08,h-wh-.08),t=Math.min(.035,ww*.08,wh*.08),zc=z+wh/2;
  const r=Math.min(.09,ww*.15,wh*.15),hole=trainFramePath(K,ww,wh,r,0,zc);
  return [trainHoleWall(K,K.rectPath(w,h,0,h/2),-d/2,d/2,hole,r,'train-wall-hole'),trainWindowRing(K,ww,wh,0,zc,-d/2-.012,-d/2,t,r,'train-wall-frame')];
 });
 // 両開きドアは1組の窓寸法を持ち、左右の扉へ同じ値を使う。
 // 未設定の旧データは従来どおり各扉幅・高さに比例する寸法で表示する。
 const doorGeom=o=>{
  const w=Math.max(.5,2*Math.abs(o.ra)),d=Math.max(.05,2*Math.abs(o.rb)),h=Math.max(.7,o.h),
   f=Math.min(.08,w*.1,h*.1),gap=value(o,'trainDoorGap',0,0,w-2*f-.02),inner=w-2*f,leaf=(inner-gap)/2,
   zc=h*.57,maxW=Math.max(.002,leaf*.88),maxH=Math.max(.04,2*Math.min(zc-.03,h-f-.03-zc)),
   ww=value(o,'trainDoorWindowWidth',leaf*.64,.002,maxW),wh=value(o,'trainDoorWindowHeight',h*.48,.04,maxH);
  return {w,d,h,f,gap,inner,leaf,zc,maxW,maxH,ww,wh,dy:d*.32,x:-(gap/2+leaf/2)};
 };
 ASSET_KIT.define('trainSlidingDoor',{label:'電車の両開きドア',glyph:'▯',group:'train',w:1.65,d:.12,h:2.2,accent:'#a6b1b4',minHalfWidth:()=>.25,minHalfDepth:()=>.025,minHeight:()=>.7,controls:[
  {key:'trainDoorGap',label:'扉の開き幅',type:'range',canvasSlider:true,default:0,min:0,max:o=>Math.max(0,2*o.ra-.2),step:.05,unit:'m'},
  {key:'trainDoorWindowWidth',label:'扉窓の幅（左右連動）',canvasSlider:true,min:.002,max:o=>doorGeom(o).maxW,step:.01,unit:'m',get:o=>doorGeom(o).ww,
   handle:(o,v)=>{const g=doorGeom(o),y=-g.dy-.045;return {anchor:[g.x,y,g.zc],sample:[g.x+v/2,y,g.zc],probe:[g.x+v/2+1,y,g.zc],fallback:{x:1,y:0}}}},
  {key:'trainDoorWindowHeight',label:'扉窓の高さ（左右連動）',canvasSlider:true,min:.04,max:o=>doorGeom(o).maxH,step:.01,unit:'m',get:o=>doorGeom(o).wh,
   handle:(o,v)=>{const g=doorGeom(o),y=-g.dy-.045;return {anchor:[g.x,y,g.zc],sample:[g.x,y,g.zc+v/2],probe:[g.x,y,g.zc+v/2+1],fallback:{x:0,y:-1}}}}
 ]},(o,K)=>{const {w,d,h,f,gap,inner,leaf,ww,wh,zc,dy}=doorGeom(o),out=[];
  for(const s of [-1,1])out.push(box(K,f,d,s*(w/2-f/2),0,0,h));out.push(box(K,inner,d,0,0,h-f,h),box(K,inner,d,0,0,0,Math.min(f*.3,.02)));
  for(const s of [-1,1]){const x=s*(gap/2+leaf/2);
   const r=Math.min(.07,ww*.18,wh*.18),hole=trainFramePath(K,ww,wh,r,x,zc),group=s<0?'train-door-left':'train-door-right';
   out.push(trainHoleWall(K,K.rectPath(leaf,h-f,x,(h-f)/2),-dy,dy,hole,r,group+'-hole'));
   const t=Math.min(.025,ww*.10,wh*.10);out.push(trainWindowRing(K,ww,wh,x,zc,-dy-.008,-dy,t,r,group+'-frame'));}
  return out;
 });
})();

// ===== 金網フェンス（上角ベベルのパイプ外枠＋伸縮しても歪まないひし形網目） =====
function chainFenceMaxDiameter(o) {
    return Math.max(.02, Math.min(.5, (Math.max(.3, Number(o?.h) || 1.4) - .08) / 3.4));
}
function chainFenceDiameter(o) {
    const v = Number(o?.fenceDiameter);
    return Math.max(.02, Math.min(chainFenceMaxDiameter(o), Number.isFinite(v) ? v : .06));
}
function chainFenceBend(o) {
    return chainFenceDiameter(o) * 1.2;
}
function chainFenceMinHeight(o) {
    return chainFenceDiameter(o) * 3.4 + .08;
}
function chainFenceStraight(o) {
    return Math.max(.1, 2 * Math.abs(Number(o?.ra) || 0) - 2 * chainFenceBend(o) - chainFenceDiameter(o));
}
function chainFenceMinHalfWidth(o) {
    return (.1 + 2 * chainFenceBend(o) + chainFenceDiameter(o)) / 2;
}
function chainFenceMeshPitch(o) {
    const v = Number(o?.fenceMeshPitch);
    return Math.max(.04, Math.min(.8, Number.isFinite(v) ? v : .14));
}
function chainFenceCount(o) {
    const v = Math.round(Number(o?.fenceCount));
    return Math.max(1, Math.min(20, Number.isFinite(v) ? v : 1));
}
function chainFenceGap(o) {
    const v = Number(o?.fenceGap);
    return Math.max(0, Math.min(2, Number.isFinite(v) ? v : 0));
}
function chainFenceMaxBottomHeight(o) {
    const d = chainFenceDiameter(o),
        r = d / 2,
        b = chainFenceBend(o),
        H = Math.max(chainFenceMinHeight(o), Number(o?.h) || 1.4);
    return Math.max(r, H - d - b - .08);
}
function chainFenceBottomHeight(o) {
    const r = chainFenceDiameter(o) / 2,
        v = Number(o?.fenceBottomHeight);
    return Math.max(r, Math.min(chainFenceMaxBottomHeight(o), Number.isFinite(v) ? v : Math.max(r, .12)));
}
function chainFenceTubePart(o, sections, radius, ringMarks = [], opts = {}) {
    const N = 16,
        capStart = opts.capStart !== false,
        capEnd = opts.capEnd !== false,
        rings = sections.map((s) =>
            s.ring ||
            Array.from({ length: N }, (_, j) => {
                const a = (2 * Math.PI * j) / N,
                    c = Math.cos(a) * radius;
                return [s.x + s.nx * c, Math.sin(a) * radius, s.z + s.nz * c];
            }),
        ),
        triangles = [],
        edges = [],
        world = rings.map((r) => r.map((p) => L2W(o, ...p))),
        cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
        sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
        dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
        view = orthView ? orthBasis().depth.map((v) => -v) : null,
        camera = camPos(),
        allFacing = [];
    for (let i = 0; i < rings.length - 1; i++) {
        const center = L2W(o, (sections[i].x + sections[i + 1].x) / 2, 0, (sections[i].z + sections[i + 1].z) / 2),
            facing = [];
        for (let j = 0; j < N; j++) {
            const k = (j + 1) % N,
                a = rings[i][j],
                b = rings[i][k],
                c = rings[i + 1][k],
                d = rings[i + 1][j];
            triangles.push([a, b, c], [a, c, d]);
            const A = world[i][j],
                B = world[i][k],
                D = world[i + 1][j],
                normal = cross(sub(B, A), sub(D, A)),
                radial = sub(A, center);
            if (dot(normal, radial) < 0) for (let q = 0; q < 3; q++) normal[q] = -normal[q];
            facing.push(dot(normal, view || sub(camera, A)) > 1e-12);
        }
        allFacing.push(facing);
        const idx = [];
        for (let j = 0; j < N; j++) if (facing[(j + N - 1) % N] !== facing[j]) idx.push(j);
        sections[i]._sil = idx.filter((j) => !(sections[i].skipInner && Math.cos((2 * Math.PI * j) / N) < -0.5));
    }
    for (let j = 0; j < N; j++) {
        let run = null;
        for (let i = 0; i < rings.length - 1; i++) {
            if (sections[i]._sil?.includes(j)) {
                if (!run) run = [rings[i][j]];
                run.push(rings[i + 1][j]);
            } else if (run) {
                edges.push(run);
                run = null;
            }
        }
        if (run) edges.push(run);
    }
    const capFacing = (idx, reverse) => {
        const center = [sections[idx].x, 0, sections[idx].z];
        for (let j = 0; j < N; j++) {
            const k = (j + 1) % N;
            triangles.push(reverse ? [center, rings[idx][k], rings[idx][j]] : [center, rings[idx][j], rings[idx][k]]);
        }
        const C = L2W(o, ...center),
            A = world[idx][0],
            B = world[idx][Math.floor(N / 4)],
            normal = reverse ? cross(sub(B, C), sub(A, C)) : cross(sub(A, C), sub(B, C));
        return dot(normal, view || sub(camera, C)) > 1e-12;
    };
    const startVis = capStart ? capFacing(0, true) : false,
        endVis = capEnd ? capFacing(rings.length - 1, false) : false,
        marks = new Set([...(capStart ? [0] : []), ...ringMarks, ...(capEnd ? [rings.length - 1] : [])]);
    for (const i of marks) {
        if (!rings[i]) continue;
        const vis = Array.from({ length: N }, (_, j) =>
            i === 0
                ? allFacing[0]?.[j] || startVis
                : i === rings.length - 1
                  ? allFacing[rings.length - 2]?.[j] || endVis
                  : allFacing[i - 1]?.[j] || allFacing[i]?.[j],
        );
        if (vis.every(Boolean)) {
            edges.push([...rings[i], rings[i][0]]);
            continue;
        }
        if (!vis.some(Boolean)) continue;
        const start = vis.findIndex((v, j) => v && !vis[(j + N - 1) % N]);
        let run = null;
        for (let k = 0; k < N; k++) {
            const j = (start + k) % N;
            if (vis[j]) {
                if (!run) run = [rings[i][j]];
                run.push(rings[i][(j + 1) % N]);
            } else if (run) {
                edges.push(run);
                run = null;
            }
        }
        if (run) edges.push(run);
    }
    return { meshTriangles: triangles, meshEdges: edges, preciseTubeEdge: true, onFace: true };
}
function chainFencePanelParts(o, xOff = 0) {
    const d = chainFenceDiameter(o),
        r = d / 2,
        b = chainFenceBend(o),
        L = chainFenceStraight(o),
        H = Math.max(chainFenceMinHeight(o), Number(o?.h) || 1.4),
        xPost = L / 2 + b,
        top = H - r,
        zArc = top - b,
        bottomBar = o?.fenceBottomBar !== false,
        zBot = chainFenceBottomHeight(o),
        zBotLow = Math.max(0, zBot - r),
        zBotHigh = zBot + r,
        sections = [],
        marks = [];
    const add = (px, pz, nx, nz, mark = false, extra = {}) => {
        sections.push({ x: xOff + px, z: pz, nx, nz, ...extra });
        if (mark) marks.push(sections.length - 1);
    };
    const zStart = bottomBar ? zBotHigh : Math.min(d * 1.1, zArc * 0.15),
        postSpan = Math.max(0.02, zArc - zStart),
        bands = Math.max(1, Math.min(24, Math.round(postSpan / 0.34))),
        lowBands = bottomBar && zBotLow > d * 1.6 ? Math.max(1, Math.min(12, Math.round(zBotLow / 0.34))) : 1;
    if (bottomBar) {
        if (zBotLow > 1e-4) {
            add(-xPost, 0, -1, 0);
            for (let k = 1; k < lowBands; k++) add(-xPost, (k / lowBands) * zBotLow, -1, 0, true);
            add(-xPost, zBotLow, -1, 0, false, { skipInner: true });
            add(-xPost, zBotHigh, -1, 0);
        } else {
            add(-xPost, 0, -1, 0, false, { skipInner: true });
            add(-xPost, zBotHigh, -1, 0);
        }
    } else {
        add(-xPost, 0, -1, 0);
        add(-xPost, zStart, -1, 0, true);
    }
    for (let k = 1; k < bands; k++) add(-xPost, zStart + (k / bands) * postSpan, -1, 0, true);
    for (let i = 0; i <= 8; i++) {
        const a = Math.PI - (i * Math.PI) / 16;
        add(-L / 2 + b * Math.cos(a), zArc + b * Math.sin(a), Math.cos(a), Math.sin(a), i === 0 || i === 8);
    }
    for (let i = 0; i <= 8; i++) {
        const a = Math.PI / 2 - (i * Math.PI) / 16;
        add(L / 2 + b * Math.cos(a), zArc + b * Math.sin(a), Math.cos(a), Math.sin(a), i === 0 || i === 8);
    }
    for (let k = bands - 1; k >= 1; k--) add(xPost, zStart + (k / bands) * postSpan, 1, 0, true);
    if (bottomBar) {
        add(xPost, zBotHigh, 1, 0, false, { skipInner: true });
        if (zBotLow > 1e-4) {
            add(xPost, zBotLow, 1, 0);
            for (let k = lowBands - 1; k >= 1; k--) add(xPost, (k / lowBands) * zBotLow, 1, 0, true);
            add(xPost, 0, 1, 0);
        } else {
            add(xPost, 0, 1, 0);
        }
    } else {
        add(xPost, zStart, 1, 0, true);
        add(xPost, 0, 1, 0);
    }
    const parts = [chainFenceTubePart(o, sections, r, marks)];
    if (bottomBar) {
        const N = 16,
            weldRing = (sign) =>
                Array.from({ length: N }, (_, j) => {
                    const a = (2 * Math.PI * j) / N;
                    return [xOff + sign * (xPost - r * Math.abs(Math.cos(a))), Math.sin(a) * r, zBot + Math.cos(a) * r];
                });
        const barSections = [
            { x: xOff - (xPost - r), z: zBot, nx: 0, nz: 1, ring: weldRing(-1) },
            { x: xOff + (xPost - r), z: zBot, nx: 0, nz: 1, ring: weldRing(1) },
        ];
        parts.push(chainFenceTubePart(o, barSections, r, [0, 1], { capStart: false, capEnd: false }));
    }
    // ひし形金網（線画のみ・面なし）。幅や高さを変えても45°正方形ピッチを保ち、網目数が増減する。
    const xIn = xPost - r - 0.0008,
        zMax = top - r - 0.0008,
        zMin = bottomBar ? zBotHigh + 0.0008 : 0,
        rIn = Math.max(0, (b - r) * Math.cos(Math.PI / 16) - 0.0008),
        pitch = chainFenceMeshPitch(o),
        step = Math.max(pitch, (chainFenceCount(o) * (2 * xIn + Math.max(0, zMax - zMin))) / 360),
        meshEdges = [];
    if (xIn > 0.005 && zMax - zMin > 0.005) {
        const K = Math.ceil((xIn + (zMax - zMin)) / step) + 1,
            cxAbs = Math.max(0, xIn - rIn),
            cz = zMax - rIn;
        for (const s of [-1, 1]) {
            for (let k = -K; k <= K; k++) {
                const xk = k * step;
                let x0 = s === 1 ? Math.max(-xIn, xk - (zMax - zMin)) : Math.max(-xIn, xk),
                    x1 = s === 1 ? Math.min(xIn, xk) : Math.min(xIn, xk + (zMax - zMin));
                if (x1 - x0 <= 1e-3) continue;
                let rejected = false;
                if (rIn > 1e-5) {
                    for (const cornerSign of [-1, 1]) {
                        const cx = cornerSign * cxAbs,
                            zAt = (x) => zMax + s * (x - xk),
                            inQuad = (x) => cornerSign * (x - cx) > 1e-7 && zAt(x) - cz > 1e-7,
                            outArc = (x) => inQuad(x) && (x - cx) ** 2 + (zAt(x) - cz) ** 2 > rIn * rIn;
                        if (inQuad(x0) || inQuad(x1) || inQuad((x0 + x1) * 0.5)) {
                            const d0 = zMax - cz + s * (cx - xk),
                                disc = 2 * rIn * rIn - d0 * d0;
                            if (disc <= 1e-12) {
                                if (outArc(x0) || outArc(x1) || outArc((x0 + x1) * 0.5)) {
                                    rejected = true;
                                    break;
                                }
                            } else {
                                const root = Math.sqrt(disc),
                                    u0 = (-s * d0 - root) / 2,
                                    u1 = (-s * d0 + root) / 2;
                                if (outArc(x0)) x0 = Math.max(x0, cx + u0);
                                if (outArc(x1)) x1 = Math.min(x1, cx + u1);
                            }
                        }
                    }
                }
                if (rejected || x1 - x0 <= 2e-3) continue;
                const z0 = zMax + s * (x0 - xk),
                    z1 = zMax + s * (x1 - xk),
                    len = Math.hypot(x1 - x0, z1 - z0),
                    ts = [0];
                for (const d of [r * 0.45, r * 1.0]) if (d * 2.2 < len) ts.push(d / len);
                for (const d of [r * 1.0, r * 0.45]) if (d * 2.2 < len) ts.push(1 - d / len);
                ts.push(1);
                meshEdges.push(ts.map((t) => [xOff + x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t]));
            }
        }
    }
    if (meshEdges.length) parts.push({ meshTriangles: [], meshEdges, preciseTubeEdge: true, onFace: true });
    return parts;
}
function chainFenceBuild(o) {
    const count = chainFenceCount(o),
        unitWidth = chainFenceStraight(o) + 2 * chainFenceBend(o) + chainFenceDiameter(o),
        stepX = unitWidth + chainFenceGap(o),
        out = [];
    for (let i = 0; i < count; i++) out.push(...chainFencePanelParts(o, i * stepX));
    return out;
}
(function () {
    const controls = [
        {
            key: 'fenceStraight',
            label: '直線部分の長さ',
            canvasSlider: true,
            min: .1,
            max: 100,
            step: .05,
            unit: 'm',
            get: chainFenceStraight,
            patch: (o, v) => ({ ra: (v + 2 * chainFenceBend(o) + chainFenceDiameter(o)) / 2 }),
            handle: (o, v) => ({ anchor: [-v / 2, 0, o.h], sample: [v / 2, 0, o.h], probe: [(v + 1) / 2, 0, o.h], fallback: { x: 1, y: 0 } }),
        },
        {
            key: 'fenceDiameter',
            label: '鉄棒の太さ',
            canvasSlider: true,
            default: .06,
            min: .02,
            max: chainFenceMaxDiameter,
            step: .005,
            unit: 'm',
            get: chainFenceDiameter,
            patch: (o, v) => ({ fenceDiameter: v, ra: (chainFenceStraight(o) + 3.4 * v) / 2, rb: Math.max(.01, v / 2) }),
            handle: (o, v) => {
                const x = -chainFenceStraight(o) * .25;
                return { anchor: [x, 0, o.h - v / 2], sample: [x, -v / 2, o.h - v / 2], probe: [x, -(v + 1) / 2, o.h - v / 2], fallback: { x: 1, y: 0 } };
            },
        },
        {
            key: 'fenceMeshPitch',
            label: '網目の大きさ',
            canvasSlider: true,
            default: .14,
            min: .04,
            max: .8,
            step: .01,
            unit: 'm',
            get: chainFenceMeshPitch,
            handle: (o, v) => {
                const y = -chainFenceDiameter(o) / 2 - .02,
                    z0 = Math.max(.1, (Number(o.h) || 1.4) * .58 - v / 2);
                return { anchor: [0, y, z0], sample: [v, y, z0 + v], probe: [v + 1, y, z0 + v + 1], fallback: { x: 1, y: -1 } };
            },
        },
        {
            key: 'fenceBottomHeight',
            label: '下パイプの高さ',
            canvasSlider: true,
            default: .12,
            min: (o) => chainFenceDiameter(o) / 2,
            max: chainFenceMaxBottomHeight,
            step: .01,
            unit: 'm',
            when: (o) => o?.fenceBottomBar !== false,
            get: chainFenceBottomHeight,
            handle: (o, v) => {
                const x = -chainFenceStraight(o) * .28,
                    r = chainFenceDiameter(o) / 2;
                return { anchor: [x, -r, 0], sample: [x, -r, v], probe: [x, -r, v + 1], fallback: { x: 0, y: -1 } };
            },
        },
        {
            key: 'fenceCount',
            label: '横に並べる数',
            type: 'range',
            canvasSlider: true,
            default: 1,
            min: 1,
            max: 20,
            step: 1,
            integer: true,
            unit: '枚',
            get: chainFenceCount,
            handle: (o, v) => {
                const r = chainFenceDiameter(o) / 2,
                    x = Math.abs(Number(o.ra) || .9),
                    z = (Number(o.h) || 1.4) * .78;
                return { anchor: [x - .15, -r, z], sample: [x + .04, -r, z], probe: [x + 1.04, -r, z], fallback: { x: 1, y: 0 }, pixelsPerUnit: 26 };
            },
        },
        { key: 'fenceGap', label: '並べる間隔', type: 'range', canvasSlider: true, default: 0, min: 0, max: 2, step: .02, unit: 'm' },
        { key: 'fenceBottomBar', label: '下の横パイプ', type: 'boolean', default: true },
    ];
    ASSET_KIT.define(
        'chainFence',
        {
            label: '金網フェンス',
            glyph: '▦',
            group: 'street',
            w: 1.8,
            d: .06,
            h: 1.4,
            accent: '#b87648',
            minHeight: chainFenceMinHeight,
            minHalfWidth: chainFenceMinHalfWidth,
            minHalfDepth: () => .01,
            maxHalfDepth: (o) => chainFenceMaxDiameter(o) / 2,
            constrainEdit: (next, old, patch) => {
                const has = (k) => Object.prototype.hasOwnProperty.call(patch, k);
                if (!has('fenceDiameter') && !has('rb')) return next;
                const d = Math.max(.02, Math.min(chainFenceMaxDiameter(next), Number(has('fenceDiameter') ? next.fenceDiameter : next.rb * 2) || .06));
                next.fenceDiameter = d;
                next.rb = d / 2;
                if (!has('ra')) next.ra = (chainFenceStraight(old) + 3.4 * d) / 2;
                return next;
            },
            controls,
        },
        (o) => chainFenceBuild(o),
    );
})();

// ===== UFOキャッチャー・ガチャ（上に積み重ね・横連結対応） =====
// ベベル直方体（beveledBoxFootprint + beveledEdgeMark）を部品として生成する共通ヘルパー
function arcadeBeveledBox(K, w, d, b, z0, z1, cx = 0, cy = 0, group = 'arc-bev') {
    const seg = 4,
        path = beveledBoxFootprint(w, d, b, seg).map(([px, py]) => [px + cx, py + cy]),
        seamMarks = [null, null, ...path.map((_, i) => beveledEdgeMark(i, b, seg, group))];
    return K.box(path, z0, z1, { onFace: true, preciseTubeEdge: true, seamMarks });
}

// UFOキャッチャーの下部キャビネット：
// ・四隅は beveledBoxFootprint と同じ4分割ベベル（beveledEdgeMark 付き）
// ・左前方は斜めに下がるボタン操作台（余分なボタン突起なし）
// ・右側は幅・高さを調整できる景品取り出し口の実凹み開口
function ufoLowerCabinetPart(g, K) {
    const { w, d, baseH, bevel: b, consoleW, consoleProj, consoleFrontZ, chuteX0, chuteX1, chuteZ0, chuteZ1, chuteDepth } = g,
        front = -d / 2,
        seg = 4,
        fp = beveledBoxFootprint(w, d, b, seg),
        n = seg + 1,
        cx0 = fp[n - 1][0],
        cx1 = cx0 + consoleW,
        yh = Math.min(d / 2 - .02, front + chuteDepth),
        yCon = front - consoleProj,
        tris = [],
        edges = [],
        marks = [],
        quad = (p0, p1, p2, p3) => tris.push([p0, p1, p2], [p0, p2, p3]),
        addEdge = (pts, mark = null) => {
            edges.push(pts);
            marks.push(mark);
        };
    // 平面の底面・上面輪郭：左前方の操作台張り出しを含めた閉ループ
    const topPoly2 = [[cx0, yCon], [cx1, yCon], [cx1, front], ...fp.slice(n)],
        botPoly2 = topPoly2.slice().reverse();
    for (const tri of K.triangulate(botPoly2)) tris.push(tri.map(([x, y]) => [x, y, 0]));
    // 上面は本体部分（y >= front）を水平面（z = baseH）とし、操作台部分（y < front）は斜め面にする
    const mainTop2 = [[cx0, front], ...fp.slice(n)];
    for (const tri of K.triangulate(mainTop2)) tris.push(tri.map(([x, y]) => [x, y, baseH]));
    // 操作台の斜め上面・前面・左右側面
    quad([cx0, yCon, consoleFrontZ], [cx1, yCon, consoleFrontZ], [cx1, front, baseH], [cx0, front, baseH]);
    quad([cx0, yCon, 0], [cx1, yCon, 0], [cx1, yCon, consoleFrontZ], [cx0, yCon, consoleFrontZ]);
    quad([cx0, front, 0], [cx0, yCon, 0], [cx0, yCon, consoleFrontZ], [cx0, front, baseH]);
    quad([cx0, front, 0], [cx0, front, consoleFrontZ], [cx0, front, baseH], [cx0, front, 0]);
    quad([cx1, yCon, 0], [cx1, front, 0], [cx1, front, baseH], [cx1, yCon, consoleFrontZ]);
    // 外周のベベル角と右・奥・左の壁面（fp[n] から fp[0..n-1] まで）
    for (let i = n; i < fp.length; i++) {
        const j = (i + 1) % fp.length,
            [x0, y0] = fp[i],
            [x1, y1] = fp[j];
        quad([x0, y0, 0], [x1, y1, 0], [x1, y1, baseH], [x0, y0, baseH]);
    }
    for (let i = 0; i < n - 1; i++) {
        const [x0, y0] = fp[i],
            [x1, y1] = fp[i + 1];
        quad([x0, y0, 0], [x1, y1, 0], [x1, y1, baseH], [x0, y0, baseH]);
    }
    // 正面右側の壁（x: cx1 〜 rx1, y = front）と景品取り出し口の凹み5面
    const rx1 = fp[n][0];
    quad([cx1, front, 0], [rx1, front, 0], [rx1, front, chuteZ0], [cx1, front, chuteZ0]);
    quad([cx1, front, chuteZ1], [rx1, front, chuteZ1], [rx1, front, baseH], [cx1, front, baseH]);
    quad([cx1, front, chuteZ0], [chuteX0, front, chuteZ0], [chuteX0, front, chuteZ1], [cx1, front, chuteZ1]);
    quad([chuteX1, front, chuteZ0], [rx1, front, chuteZ0], [rx1, front, chuteZ1], [chuteX1, front, chuteZ1]);
    quad([chuteX0, yh, chuteZ0], [chuteX1, yh, chuteZ0], [chuteX1, yh, chuteZ1], [chuteX0, yh, chuteZ1]);
    quad([chuteX0, front, chuteZ0], [chuteX0, yh, chuteZ0], [chuteX0, yh, chuteZ1], [chuteX0, front, chuteZ1]);
    quad([chuteX1, yh, chuteZ0], [chuteX1, front, chuteZ0], [chuteX1, front, chuteZ1], [chuteX1, yh, chuteZ1]);
    quad([chuteX0, front, chuteZ0], [chuteX1, front, chuteZ0], [chuteX1, yh, chuteZ0], [chuteX0, yh, chuteZ0]);
    quad([chuteX0, yh, chuteZ1], [chuteX1, yh, chuteZ1], [chuteX1, front, chuteZ1], [chuteX0, front, chuteZ1]);

    // 稜線（上下のベベル輪郭＋操作台の斜め稜線＋取り出し口＋ベベル角の縦シルエット候補）
    const outerBot = [[cx0, yCon, 0], [cx1, yCon, 0], [cx1, front, 0], ...fp.slice(n).map(([x, y]) => [x, y, 0]), ...fp.slice(0, n).map(([x, y]) => [x, y, 0]), [cx0, yCon, 0]];
    addEdge(outerBot);
    const outerTop = [[cx0, front, baseH], ...fp.slice(n).map(([x, y]) => [x, y, baseH]), ...fp.slice(0, n).map(([x, y]) => [x, y, baseH])];
    addEdge(outerTop);
    // 上縁のステージ帯ラインと下縁のベース帯ライン（参考画像の上下ベベル帯）
    const rimZ = Math.max(chuteZ1 + .02, baseH - Math.min(.055, baseH * .09));
    if (baseH - rimZ > .018) {
        addEdge([[cx1, front, rimZ], ...fp.slice(n).map(([x, y]) => [x, y, rimZ]), ...fp.slice(0, n).map(([x, y]) => [x, y, rimZ])]);
    }
    const plinthZ = Math.min(chuteZ0 - .02, Math.min(.055, baseH * .09));
    if (plinthZ > .018) {
        addEdge([[cx0, yCon, plinthZ], [cx1, yCon, plinthZ], [cx1, front, plinthZ], ...fp.slice(n).map(([x, y]) => [x, y, plinthZ]), ...fp.slice(0, n).map(([x, y]) => [x, y, plinthZ])]);
    }
    // 操作台の輪郭線（斜め天板と前面）
    addEdge([[cx0, front, baseH], [cx0, yCon, consoleFrontZ], [cx1, yCon, consoleFrontZ], [cx1, front, baseH]]);
    addEdge([[cx0, yCon, 0], [cx0, yCon, consoleFrontZ]]);
    addEdge([[cx1, yCon, 0], [cx1, yCon, consoleFrontZ]]);
    addEdge([[cx1, front, 0], [cx1, front, baseH]]);
    // 四隅ベベルの縦線（seamMarks でシルエットの1本のみ描画）
    fp.forEach(([x, y], idx) => {
        addEdge([[x, y, 0], [x, y, baseH]], beveledEdgeMark(idx, b, seg, 'ufo-base'));
    });
    // 景品取り出し口（角丸ベベルなしの明瞭な凹み開口枠）
    addEdge([[chuteX0, front, chuteZ0], [chuteX1, front, chuteZ0], [chuteX1, front, chuteZ1], [chuteX0, front, chuteZ1], [chuteX0, front, chuteZ0]]);
    addEdge([[chuteX0, yh, chuteZ0], [chuteX1, yh, chuteZ0], [chuteX1, yh, chuteZ1], [chuteX0, yh, chuteZ1], [chuteX0, yh, chuteZ0]]);
    for (const [x, z] of [[chuteX0, chuteZ0], [chuteX1, chuteZ0], [chuteX1, chuteZ1], [chuteX0, chuteZ1]]) {
        addEdge([[x, front, z], [x, yh, z]]);
    }
    return { meshTriangles: tris, meshEdges: edges, seamMarks: marks, onFace: true, preciseTubeEdge: true };
}

// ショーケースの柱（前方はベベル内側に収まる角柱、後方は参考画像の斜めガセット一体のL字柱）
function ufoShowcasePosts(g, K) {
    const { w, d, baseH, roofBottom, showcaseH, bevel } = g,
        flag = { onFace: true, preciseTubeEdge: true },
        front = -d / 2,
        back = d / 2,
        postW = Math.max(.036, Math.min(.050, w * .052)),
        postD = Math.max(.036, Math.min(.050, d * .052)),
        insetX = Math.max(.014, bevel - postW),
        insetY = Math.max(.014, bevel * .42),
        px = w / 2 - insetX - postW / 2,
        frontPy = front + insetY + postD / 2,
        backY1 = back - insetY,
        backY0 = backY1 - postD,
        gussetD = Math.min(d * .22, (d - 2 * insetY - 2 * postD) * .38),
        gussetH = Math.min(.20, showcaseH * .25),
        parts = [];
    // 前方左右の柱（内側面が x = ∓(w/2 - bevel) に揃い、操作台左端と干渉しない）
    for (const sx of [-1, 1]) {
        parts.push(K.box(K.rectPath(postW, postD, sx * px, frontPy), baseH, roofBottom, flag));
    }
    // 後方左右の柱（下部が前方へ斜めに広がるガセット一体型）
    const rearProfileYZ =
            gussetD > .04 && gussetH > .04
                ? [
                      [backY0 - gussetD, baseH],
                      [backY0, baseH + gussetH],
                      [backY0, roofBottom],
                      [backY1, roofBottom],
                      [backY1, baseH],
                  ]
                : [
                      [backY0, baseH],
                      [backY0, roofBottom],
                      [backY1, roofBottom],
                      [backY1, baseH],
                  ],
        rearPath = K.area2(rearProfileYZ) < 0 ? rearProfileYZ.slice().reverse() : rearProfileYZ;
    for (const sx of [-1, 1]) {
        parts.push(K.box(rearPath, sx * px - postW / 2, sx * px + postW / 2, { axis: 'x', ...flag }));
    }
    return parts;
}

function ufoCatcherGeom(o) {
    const w = Math.max(.42, 2 * Math.abs(Number(o?.ra) || .45)),
        d = Math.max(.40, 2 * Math.abs(Number(o?.rb) || .425)),
        h = Math.max(.90, Number(o?.h) || 1.85),
        maxBase = Math.max(.30, h * .54),
        baseH = clamp(Number.isFinite(Number(o?.ufoBaseHeight)) ? Number(o.ufoBaseHeight) : .68, .26, maxBase),
        maxBevel = Math.max(.02, Math.min(w, d) * .20),
        bevel = clamp(Number.isFinite(Number(o?.ufoBevel)) ? Number(o.ufoBevel) : .070, .01, maxBevel),
        flatW = Math.max(.26, w - 2 * bevel),
        minConsoleW = .10,
        maxConsoleW = Math.max(.14, flatW - .16),
        defaultConsoleW = clamp(Math.min(w * .24, flatW * .32), minConsoleW, maxConsoleW),
        consoleW = clamp(Number.isFinite(Number(o?.ufoConsoleWidth)) ? Number(o.ufoConsoleWidth) : defaultConsoleW, minConsoleW, maxConsoleW),
        consoleProj = Math.max(.08, d * .13),
        consoleSlant = Math.max(.08, baseH * .18),
        consoleFrontZ = Math.max(.14, baseH - consoleSlant),
        cx0 = -w / 2 + bevel,
        cx1 = cx0 + consoleW,
        rx1 = w / 2 - bevel,
        availW = Math.max(.10, rx1 - cx1 - .04),
        maxChuteW = availW,
        chuteW = clamp(Number.isFinite(Number(o?.ufoChuteWidth)) ? Number(o.ufoChuteWidth) : .28, .10, maxChuteW),
        defaultChuteMidX = (cx1 + rx1) / 2,
        maxChuteOffX = Math.max(0, (availW - chuteW) / 2),
        chuteOffX = clamp(Number.isFinite(Number(o?.ufoChuteX)) ? Number(o.ufoChuteX) : 0, -maxChuteOffX, maxChuteOffX),
        chuteMidX = defaultChuteMidX + chuteOffX,
        chuteX0 = chuteMidX - chuteW / 2,
        chuteX1 = chuteMidX + chuteW / 2,
        minChuteZ = .05,
        maxChuteTopZ = Math.max(minChuteZ + .10, baseH - .06),
        maxChuteH = Math.max(.08, maxChuteTopZ - minChuteZ),
        chuteH = clamp(Number.isFinite(Number(o?.ufoChuteHeight)) ? Number(o.ufoChuteHeight) : .22, .08, maxChuteH),
        defaultChuteMidZ = clamp(baseH * .44, minChuteZ + chuteH / 2, maxChuteTopZ - chuteH / 2),
        minChuteOffZ = minChuteZ + chuteH / 2 - defaultChuteMidZ,
        maxChuteOffZ = maxChuteTopZ - chuteH / 2 - defaultChuteMidZ,
        chuteOffZ = clamp(Number.isFinite(Number(o?.ufoChuteZ)) ? Number(o.ufoChuteZ) : 0, minChuteOffZ, maxChuteOffZ),
        chuteMidZ = defaultChuteMidZ + chuteOffZ,
        chuteZ0 = chuteMidZ - chuteH / 2,
        chuteZ1 = chuteMidZ + chuteH / 2,
        chuteDepth = Math.min(.16, d * .24),
        topSign = o?.ufoTopSign !== false,
        signRise = topSign ? Math.min(.045, h * .025) : 0,
        canopyTop = h - signRise,
        canopyH = Math.max(.15, Math.min(.25, (canopyTop - baseH) * .22)),
        roofBottom = canopyTop - canopyH,
        showcaseH = Math.max(.28, roofBottom - baseH),
        maxClawX = Math.max(.05, w * .28),
        clawX = clamp(Number.isFinite(Number(o?.ufoClawX)) ? Number(o.ufoClawX) : 0, -maxClawX, maxClawX),
        maxDrop = Math.max(.12, showcaseH * .58),
        clawDrop = clamp(Number.isFinite(Number(o?.ufoClawDrop)) ? Number(o.ufoClawDrop) : .30, .10, maxDrop),
        count = clamp(Math.round(Number(o?.ufoCount) || 1), 1, 10),
        gap = clamp(Number.isFinite(Number(o?.ufoGap)) ? Number(o.ufoGap) : 0, 0, 1);
    return {
        w, d, h, maxBase, baseH, maxBevel, bevel,
        minConsoleW, maxConsoleW, consoleW, consoleProj, consoleSlant, consoleFrontZ, cx0, cx1, rx1,
        maxChuteW, chuteW, defaultChuteMidX, maxChuteOffX, chuteOffX, chuteMidX, chuteX0, chuteX1,
        maxChuteH, chuteH, defaultChuteMidZ, minChuteOffZ, maxChuteOffZ, chuteOffZ, chuteMidZ, chuteZ0, chuteZ1, chuteDepth,
        topSign, signRise, canopyTop, canopyH, roofBottom, showcaseH,
        maxClawX, clawX, maxDrop, clawDrop, count, gap,
    };
}

function ufoCatcherUnitParts(o, K) {
    const g = ufoCatcherGeom(o),
        { w, d, h, baseH, bevel, topSign, canopyTop, canopyH, roofBottom, showcaseH, clawX, clawDrop } = g,
        flag = { onFace: true, preciseTubeEdge: true },
        front = -d / 2,
        parts = [];
    // 1) 下部キャビネット本体（四隅ベベル＋上下ベベル帯＋左下の斜め操作台＋幅・高さ可変の景品取り出し口）
    parts.push(ufoLowerCabinetPart(g, K));
    // 2) ショーケース四隅の柱（後方は下部斜めガセット一体型）
    parts.push(...ufoShowcasePosts(g, K));
    // 3) 上部キャノピー（四隅ベベル＋上下ベベル帯ライン＋正面の角丸看板プレート）
    const canopyOver = Math.max(.028, d * .045),
        canopyD = d + canopyOver,
        canopyCy = -canopyOver / 2;
    parts.push(arcadeBeveledBox(K, w, canopyD, bevel, roofBottom, canopyTop, 0, canopyCy, 'ufo-canopy'));
    const cFp = beveledBoxFootprint(w, canopyD, bevel, 4).map(([px, py]) => [px, py + canopyCy]),
        cBand = Math.min(.032, canopyH * .17),
        signW = Math.max(.24, (w - 2 * bevel) * .90),
        signY1 = front - canopyOver,
        cLowerLoop = [...cFp.map(([x, y]) => [x, y, roofBottom + cBand]), [cFp[0][0], cFp[0][1], roofBottom + cBand]],
        cUpperLoop = topSign
            ? [
                  [signW / 2, signY1, canopyTop - cBand],
                  ...cFp.slice(5).map(([x, y]) => [x, y, canopyTop - cBand]),
                  ...cFp.slice(0, 5).map(([x, y]) => [x, y, canopyTop - cBand]),
                  [-signW / 2, signY1, canopyTop - cBand],
              ]
            : [...cFp.map(([x, y]) => [x, y, canopyTop - cBand]), [cFp[0][0], cFp[0][1], canopyTop - cBand]];
    if (cBand > .014) {
        parts.push(K.wire([cLowerLoop, cUpperLoop], flag));
    }
    if (topSign) {
        const signZ0 = roofBottom + cBand + .008,
            signZ1 = h,
            signY0 = signY1 - .032,
            signR = Math.min(.038, (signZ1 - signZ0) * .24),
            signPath = K.roundRectPath(signW, signZ1 - signZ0, signR, 3, 0, (signZ0 + signZ1) / 2),
            signMarks = [null, null, ...signPath.map((_, i) => beveledEdgeMark(i, signR, 3, 'ufo-sign'))];
        parts.push(K.box(signPath, signY0, signY1, { axis: 'y', seamMarks: signMarks, ...flag }));
    }
    // 4) クレーン機構（ベベル付き天井キャリッジ＋シャフト＋丸型UFOヘッド＋湾曲2本爪アーム）
    const carrH = Math.min(.065, showcaseH * .11),
        carrW = Math.min(.18, w * .20),
        carrD = Math.min(.15, d * .19),
        clawY = -d * .04,
        headD = Math.min(.125, w * .145),
        headH = headD * .72,
        headTopZ = Math.max(baseH + .22, roofBottom - carrH - clawDrop),
        headBotZ = headTopZ - headH,
        shaftD = Math.max(.032, headD * .32);
    parts.push(arcadeBeveledBox(K, carrW, carrD, Math.min(.03, carrW * .22), roofBottom - carrH, roofBottom, clawX, clawY, 'ufo-carr'));
    if (roofBottom - carrH - headTopZ > .01) {
        parts.push(arcadeBeveledBox(K, shaftD, shaftD, shaftD * .42, headTopZ, roofBottom - carrH, clawX, clawY, 'ufo-shaft'));
    }
    parts.push(arcadeBeveledBox(K, headD, headD, headD * .44, headBotZ, headTopZ, clawX, clawY, 'ufo-head'));
    // 左右の湾曲C字型クレーン爪アーム
    const armReach = Math.min(.115, w * .135),
        armDrop = Math.min(.135, Math.max(.06, headBotZ - baseH - .05)),
        armT = Math.max(.020, headD * .18),
        armD = Math.max(.026, headD * .24);
    for (const s of [-1, 1]) {
        const x0 = clawX + s * (headD * .28),
            x1 = clawX + s * (armReach * .92),
            x2 = clawX + s * armReach,
            x3 = clawX + s * (armReach * .46),
            z0 = headBotZ + .005,
            z1 = headBotZ - armDrop * .34,
            z2 = headBotZ - armDrop * .70,
            z3 = headBotZ - armDrop,
            outer = [
                [x0 + s * armT * .5, z0],
                [x1 + s * armT * .5, z1],
                [x2 + s * armT * .45, z2],
                [x3 + s * armT * .25, z3 - armT * .35],
                [x3 - s * armT * .45, z3 + armT * .25],
                [x2 - s * armT * .5, z2 + armT * .08],
                [x1 - s * armT * .5, z1],
                [x0 - s * armT * .5, z0],
            ],
            poly = K.area2(outer) < 0 ? outer.slice().reverse() : outer;
        parts.push(K.box(poly, clawY - armD / 2, clawY + armD / 2, { axis: 'y', ...flag }));
    }
    return parts;
}

function ufoCatcherBuild(o, K = ASSET_KIT) {
    const g = ufoCatcherGeom(o),
        unit = ufoCatcherUnitParts(o, K),
        pitch = g.w + g.gap,
        xStart = -((g.count - 1) * pitch) / 2;
    return K.repeatParts(K.moveParts(unit, xStart, 0, 0), { axis: 'x', spacing: pitch, count: g.count, group: 'ufo-col' });
}

function gachaMachineGeom(o) {
    const w = Math.max(.22, 2 * Math.abs(Number(o?.ra) || .19)),
        d = Math.max(.24, 2 * Math.abs(Number(o?.rb) || .22)),
        h = Math.max(.36, Number(o?.h) || .68),
        bevel = Math.min(.032, Math.min(w, d) * .11),
        waistRatio = clamp(Number.isFinite(Number(o?.gachaWaistRatio)) ? Number(o.gachaWaistRatio) : .47, .36, .60),
        baseH = h * .18,
        waistZ = h * waistRatio,
        maxChuteW = Math.max(.08, w - 2 * bevel - .04),
        chuteW = clamp(Number.isFinite(Number(o?.gachaChuteWidth)) ? Number(o.gachaChuteWidth) : .17, .08, maxChuteW),
        maxChuteOffX = Math.max(0, (maxChuteW - chuteW) / 2),
        chuteOffX = clamp(Number.isFinite(Number(o?.gachaChuteX)) ? Number(o.gachaChuteX) : 0, -maxChuteOffX, maxChuteOffX),
        chuteMidX = chuteOffX,
        chuteX0 = chuteMidX - chuteW / 2,
        chuteX1 = chuteMidX + chuteW / 2,
        minFloorZ = .012,
        maxTopZ = Math.max(baseH + .05, waistZ * .62),
        maxChuteH = Math.max(.06, maxTopZ - minFloorZ - .01),
        chuteH = clamp(Number.isFinite(Number(o?.gachaChuteHeight)) ? Number(o.gachaChuteHeight) : .11, .05, maxChuteH),
        defaultFloorZ = clamp(baseH * .22, minFloorZ, maxTopZ - chuteH),
        minChuteOffZ = minFloorZ - defaultFloorZ,
        maxChuteOffZ = maxTopZ - chuteH - defaultFloorZ,
        chuteOffZ = clamp(Number.isFinite(Number(o?.gachaChuteZ)) ? Number(o.gachaChuteZ) : 0, minChuteOffZ, maxChuteOffZ),
        chuteFloorZ = defaultFloorZ + chuteOffZ,
        chuteTopZ = chuteFloorZ + chuteH,
        chuteMidZ = (chuteFloorZ + chuteTopZ) / 2,
        stack = clamp(Math.round(Number(o?.gachaStack) || 1), 1, 6),
        count = clamp(Math.round(Number(o?.gachaCount) || 1), 1, 10);
    return {
        w, d, h, bevel, waistRatio, baseH, waistZ,
        maxChuteW, chuteW, maxChuteOffX, chuteOffX, chuteMidX, chuteX0, chuteX1,
        minFloorZ, maxTopZ, defaultFloorZ, minChuteOffZ, maxChuteOffZ, chuteOffZ, chuteFloorZ, maxChuteH, chuteH, chuteTopZ, chuteMidZ,
        stack, count,
    };
}

// ガチャの下部ベース＋一体型外装シェル（0 〜 topZ：斜め前方ベース・取り出し口凹み・継ぎ目のないC字切り欠き側面・上部額を一体構成）
function gachaLowerBodyPart(g, topZ, winTopZ, sideT, cCurve, yDrumAtX) {
    const { w, d, baseH, waistZ, chuteX0: hx0, chuteX1: hx1, chuteFloorZ: z0, chuteTopZ: z1 } = g,
        front = -d / 2,
        back = d / 2,
        baseProj = Math.max(.034, d * .10),
        yToe = front - baseProj,
        yh = Math.min(back - .03, front + Math.max(.07, d * .22)),
        lx0 = -w / 2,
        rx1 = w / 2,
        ix0 = lx0 + sideT,
        ix1 = rx1 - sideT,
        yAt = (z) => (z < baseH ? yToe + (front - yToe) * (z / baseH) : front),
        y0 = yAt(z0),
        y1 = yAt(z1),
        straddle = z0 < baseH - 1e-4 && z1 > baseH + 1e-4,
        tris = [],
        edges = [],
        quad = (p0, p1, p2, p3) => tris.push([p0, p1, p2], [p0, p2, p3]);

    // 底面（z = 0）と外装上面（z = topZ）
    quad([lx0, back, 0], [rx1, back, 0], [rx1, yToe, 0], [lx0, yToe, 0]);
    quad([lx0, front, topZ], [rx1, front, topZ], [rx1, back, topZ], [lx0, back, topZ]);
    // 背面壁（0 〜 topZ 一体）と下部ベース左右壁（0 〜 waistZ）・ベース前方張り出し三角側面
    quad([rx1, back, 0], [lx0, back, 0], [lx0, back, topZ], [rx1, back, topZ]);
    quad([lx0, back, 0], [lx0, front, 0], [lx0, front, waistZ], [lx0, back, waistZ]);
    quad([rx1, front, 0], [rx1, back, 0], [rx1, back, waistZ], [rx1, front, waistZ]);
    tris.push([[lx0, front, 0], [lx0, yToe, 0], [lx0, front, baseH]]);
    tris.push([[rx1, yToe, 0], [rx1, front, 0], [rx1, front, baseH]]);

    // 左右外装壁の上部（waistZ 〜 topZ：水平棚＋真円に近い半円C字窓切り欠き付きの連続1枚パネル＋厚みリボン）
    quad([lx0, back, winTopZ], [lx0, front, winTopZ], [lx0, front, topZ], [lx0, back, topZ]);
    quad([rx1, front, winTopZ], [rx1, back, winTopZ], [rx1, back, topZ], [rx1, front, topZ]);
    for (let k = 0; k < cCurve.length - 1; k++) {
        const a = cCurve[k],
            b = cCurve[k + 1];
        if (Math.abs(a[1] - b[1]) > 1e-5) {
            quad([lx0, back, a[1]], [lx0, a[0], a[1]], [lx0, b[0], b[1]], [lx0, back, b[1]]);
            quad([rx1, a[0], a[1]], [rx1, back, a[1]], [rx1, back, b[1]], [rx1, b[0], b[1]]);
            quad([ix0, a[0], a[1]], [ix0, back, a[1]], [ix0, back, b[1]], [ix0, b[0], b[1]]);
            quad([ix1, back, a[1]], [ix1, a[0], a[1]], [ix1, b[0], b[1]], [ix1, back, b[1]]);
        }
        quad([lx0, a[0], a[1]], [ix0, a[0], a[1]], [ix0, b[0], b[1]], [lx0, b[0], b[1]]);
        quad([ix1, a[0], a[1]], [rx1, a[0], a[1]], [rx1, b[0], b[1]], [ix1, b[0], b[1]]);
    }

    // 下胴上端の水平レッジ（z = waistZ）と上部額の前面・下面（winTopZ 〜 topZ）
    const yLedgeBack = cCurve[1][0];
    quad([lx0, front, waistZ], [rx1, front, waistZ], [rx1, yLedgeBack, waistZ], [lx0, yLedgeBack, waistZ]);
    quad([lx0, front, winTopZ], [rx1, front, winTopZ], [rx1, front, topZ], [lx0, front, topZ]);
    quad([lx0, yLedgeBack, winTopZ], [rx1, yLedgeBack, winTopZ], [rx1, front, winTopZ], [lx0, front, winTopZ]);

    // 1) 黒い下部ベースの前方斜面（z: 0 〜 baseH）
    if (z0 >= baseH - 1e-4) {
        quad([lx0, yToe, 0], [rx1, yToe, 0], [rx1, front, baseH], [lx0, front, baseH]);
    } else {
        const zb = Math.min(baseH, z1),
            yb = yAt(zb);
        if (z0 > 1e-4) quad([lx0, yToe, 0], [rx1, yToe, 0], [rx1, y0, z0], [lx0, y0, z0]);
        quad([lx0, y0, z0], [hx0, y0, z0], [hx0, yb, zb], [lx0, yb, zb]);
        quad([hx1, y0, z0], [rx1, y0, z0], [rx1, yb, zb], [hx1, yb, zb]);
        if (zb < baseH - 1e-4) quad([lx0, yb, zb], [rx1, yb, zb], [rx1, front, baseH], [lx0, front, baseH]);
    }

    // 2) 下胴前面（y = front, z: baseH 〜 waistZ）
    if (z1 <= baseH + 1e-4) {
        quad([lx0, front, baseH], [rx1, front, baseH], [rx1, front, waistZ], [lx0, front, waistZ]);
    } else {
        const za = Math.max(baseH, z0);
        if (za > baseH + 1e-4) quad([lx0, front, baseH], [rx1, front, baseH], [rx1, front, za], [lx0, front, za]);
        quad([lx0, front, za], [hx0, front, za], [hx0, front, z1], [lx0, front, z1]);
        quad([hx1, front, za], [rx1, front, za], [rx1, front, z1], [hx1, front, z1]);
        if (z1 < waistZ - 1e-4) quad([lx0, front, z1], [rx1, front, z1], [rx1, front, waistZ], [lx0, front, waistZ]);
    }

    // 3) カプセル取り出し口凹み内部（床・天井・奥壁・左右内壁）
    quad([hx0, y0, z0], [hx1, y0, z0], [hx1, yh, z0], [hx0, yh, z0]);
    quad([hx0, yh, z1], [hx1, yh, z1], [hx1, y1, z1], [hx0, y1, z1]);
    quad([hx0, yh, z0], [hx1, yh, z0], [hx1, yh, z1], [hx0, yh, z1]);
    if (straddle) {
        quad([hx0, y0, z0], [hx0, yh, z0], [hx0, yh, baseH], [hx0, front, baseH]);
        quad([hx0, front, baseH], [hx0, yh, baseH], [hx0, yh, z1], [hx0, front, z1]);
        quad([hx1, yh, z0], [hx1, y0, z0], [hx1, front, baseH], [hx1, yh, baseH]);
        quad([hx1, yh, baseH], [hx1, front, baseH], [hx1, front, z1], [hx1, yh, z1]);
    } else {
        quad([hx0, y0, z0], [hx0, yh, z0], [hx0, yh, z1], [hx0, y1, z1]);
        quad([hx1, yh, z0], [hx1, y0, z0], [hx1, y1, z1], [hx1, yh, z1]);
    }

    // 4) 輪郭線（側面・背面に不要な水平分割線を出さない一体型輪郭＋C字切り欠きの内縁厚みライン）
    edges.push([[lx0, yToe, 0], [rx1, yToe, 0], [rx1, back, 0], [lx0, back, 0], [lx0, yToe, 0]]);
    edges.push([[lx0, yToe, 0], [lx0, front, baseH], [lx0, front, waistZ]]);
    edges.push([[rx1, yToe, 0], [rx1, front, baseH], [rx1, front, waistZ]]);
    edges.push([[lx0, back, 0], [lx0, back, topZ]]);
    edges.push([[rx1, back, 0], [rx1, back, topZ]]);
    edges.push([[lx0, front, winTopZ], [lx0, front, topZ]]);
    edges.push([[rx1, front, winTopZ], [rx1, front, topZ]]);
    edges.push(cCurve.map(([y, z]) => [lx0, y, z]));
    edges.push(cCurve.map(([y, z]) => [rx1, y, z]));
    // C字切り欠き内縁の厚みライン（カプセル容器の前面曲面より奥の角丸コの字アーク部分）
    const cArcOnly = cCurve.slice(1, -1);
    edges.push([
        [ix0, yDrumAtX(ix0, 1), winTopZ],
        ...cArcOnly.map(([y, z]) => [ix0, y, z]),
        [ix0, yDrumAtX(ix0, 0), waistZ],
    ]);
    edges.push([
        [ix1, yDrumAtX(ix1, 1), winTopZ],
        ...cArcOnly.map(([y, z]) => [ix1, y, z]),
        [ix1, yDrumAtX(ix1, 0), waistZ],
    ]);
    edges.push([[lx0, front, waistZ], [rx1, front, waistZ]]);
    edges.push([[lx0, front, winTopZ], [rx1, front, winTopZ]]);
    edges.push([[lx0, front, topZ], [rx1, front, topZ], [rx1, back, topZ], [lx0, back, topZ], [lx0, front, topZ]]);
    if (z0 <= baseH + 1e-4 && z1 >= baseH - 1e-4) {
        edges.push([[hx1, front, baseH], [rx1, front, baseH], [rx1, back, baseH], [lx0, back, baseH], [lx0, front, baseH], [hx0, front, baseH]]);
    } else {
        edges.push([[lx0, front, baseH], [rx1, front, baseH], [rx1, back, baseH], [lx0, back, baseH], [lx0, front, baseH]]);
    }
    // 取り出し口の枠線と内壁線
    edges.push([[hx0, y0, z0], [hx1, y0, z0]]);
    if (straddle) {
        edges.push([[hx0, y0, z0], [hx0, front, baseH], [hx0, front, z1], [hx1, front, z1], [hx1, front, baseH], [hx1, y0, z0]]);
    } else {
        edges.push([[hx0, y0, z0], [hx0, y1, z1], [hx1, y1, z1], [hx1, y0, z0]]);
    }
    edges.push([[hx0, yh, z0], [hx1, yh, z0], [hx1, yh, z1], [hx0, yh, z1], [hx0, yh, z0]]);
    edges.push([[hx0, y0, z0], [hx0, yh, z0]]);
    edges.push([[hx1, y0, z0], [hx1, yh, z0]]);
    edges.push([[hx0, y1, z1], [hx0, yh, z1]]);
    edges.push([[hx1, y1, z1], [hx1, yh, z1]]);
    return { meshTriangles: tris, meshEdges: edges, onFace: true, preciseTubeEdge: true };
}

function gachaMachineUnitParts(o, K) {
    const g = gachaMachineGeom(o),
        { w, d, h, baseH, waistZ, chuteX0: hx0, chuteX1: hx1, chuteTopZ } = g,
        flag = { onFace: true, preciseTubeEdge: true },
        front = -d / 2,
        back = d / 2,
        capH = Math.max(.036, h * .070),
        topZ = h - capH,
        foreheadH = Math.max(.042, h * .086),
        winTopZ = topZ - foreheadH,
        winSpan = Math.max(.08, winTopZ - waistZ),
        sideT = Math.max(.024, w * .068),
        innerW = w - 2 * sideT,
        ix1 = innerW / 2,
        ix0 = -ix1,
        dx1 = w / 2 - .003,
        dx0 = -dx1,
        // C字切り欠き：参考画像通りの「角が丸いコの字（水平上辺→上奥角丸→垂直奥辺→下奥角丸→水平下辺）」
        cutDepthY = front + d * .52,
        rCut = Math.min(winSpan * .32, (cutDepthY - front) * .46),
        yCorner = cutDepthY - rCut,
        cCurve = [[front, winTopZ], [yCorner, winTopZ]];
    for (let i = 1; i <= 6; i++) {
        const ang = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
        cCurve.push([yCorner + rCut * Math.cos(ang), winTopZ - rCut - rCut * Math.sin(ang)]);
    }
    for (let i = 0; i <= 6; i++) {
        const ang = (i / 6) * (Math.PI / 2);
        cCurve.push([yCorner + rCut * Math.cos(ang), waistZ + rCut - rCut * Math.sin(ang)]);
    }
    cCurve.push([front, waistZ]);

    // 内部カプセル容器（ガチャが入ってるところ）の3D曲面関数 yDrumAtX(x, t)：
    // ・縦方向（t: 0→1）は下端（waistZ）が白い台座の奥へ入り込み、中央上部で手前（-Y）へ大きく張り出し、上端（winTopZ）で額の下へ収まるカーブ
    // ・横方向（x: dx0→dx1）も中央が手前へ緩やかに膨らむ3Dドーム曲面
    const yDrumBase = (t) =>
            front + d * (.105 * Math.pow(1 - t, 1.45) + .026 * t - .112 * Math.sin(Math.PI * Math.pow(t, .76))),
        yDrumAtX = (x, t) => {
            const u = x / Math.max(1e-4, dx1),
                xBow = -d * .018 * (1 - u * u) * (.30 + .70 * Math.sin(Math.PI * t));
            return yDrumBase(t) + xBow;
        },
        parts = [];

    // 1) 斜め前方ベース＋取り出し口＋C字切り欠き一体型外装シェル（0 〜 topZ）
    parts.push(gachaLowerBodyPart(g, topZ, winTopZ, sideT, cCurve, yDrumAtX));

    // 上部額（winTopZ 〜 topZ）正面の角丸タイトルバッジ枠
    const badgeW = w * .38,
        badgeH = foreheadH * .42,
        badgeCz = (winTopZ + topZ) * .5,
        by = front - .0015,
        badgePts = K.roundRectPath(badgeW, badgeH, Math.min(.006, badgeH * .35), 2, 0, badgeCz).map(([x, z]) => [x, by, z]);
    badgePts.push(badgePts[0]);
    parts.push(K.wire([badgePts], flag));

    // 2) 中央上端（waistZ）から垂れ下がる白いU字シールド型ハンドル台座＋円盤ダイヤル＋横長回転つまみ
    const mountW = w * .36,
        mountH = Math.max(.09, (waistZ - baseH) * .68),
        mountBotZ = Math.max(chuteTopZ + .020, waistZ - mountH),
        mountR = Math.min(mountW * .42, (waistZ - mountBotZ) * .45),
        mountProj = Math.max(.025, d * .058),
        mountFront = front - mountProj,
        uShieldXZ = [[-mountW / 2, waistZ], [mountW / 2, waistZ]];
    for (let i = 0; i <= 5; i++) {
        const a = (i / 5) * (Math.PI / 2);
        uShieldXZ.push([mountW / 2 - mountR + mountR * Math.cos(a), mountBotZ + mountR - mountR * Math.sin(a)]);
    }
    for (let i = 0; i <= 5; i++) {
        const a = Math.PI / 2 + (i / 5) * (Math.PI / 2);
        uShieldXZ.push([-mountW / 2 + mountR + mountR * Math.cos(a), mountBotZ + mountR - mountR * Math.sin(a)]);
    }
    const shieldRev = K.area2(uShieldXZ) < 0,
        shieldPoly = shieldRev ? uShieldXZ.slice().reverse() : uShieldXZ,
        shieldMarks = [
            null,
            null,
            ...shieldPoly.map((p) => (p[1] > waistZ - 1e-4 ? null : p[0] < 0 ? 'gacha-shield:L' : 'gacha-shield:R')),
        ];
    parts.push(K.box(shieldPoly, mountFront, front, { axis: 'y', seamMarks: shieldMarks, ...flag }));
    // 白い台座の上面が waistZ レッジの奥（カプセル容器下端）へ回り込むライン
    parts.push(
        K.wire(
            [
                [[-mountW / 2, front, waistZ + .0015], [-mountW / 2, yDrumAtX(-mountW / 2, 0), waistZ + .0015]],
                [[mountW / 2, front, waistZ + .0015], [mountW / 2, yDrumAtX(mountW / 2, 0), waistZ + .0015]],
            ],
            flag,
        ),
    );

    // 取り出し口上部のアーチ型ステップライン（参考画像の下胴正面下部のアーチ段差）
    const flapTopZ = Math.min(mountBotZ - .008, Math.max(chuteTopZ, baseH) + (waistZ - baseH) * .20),
        flapBotZ = Math.max(baseH, chuteTopZ);
    if (flapTopZ > flapBotZ + .012) {
        const fR = Math.min((hx1 - hx0) * .28, flapTopZ - flapBotZ),
            fy = front - .0015,
            flapPts = [[hx0, fy, flapBotZ]];
        for (let i = 0; i <= 4; i++) {
            const a = Math.PI - (i / 4) * (Math.PI / 2);
            flapPts.push([hx0 + fR + fR * Math.cos(a), fy, flapTopZ - fR + fR * Math.sin(a)]);
        }
        for (let i = 0; i <= 4; i++) {
            const a = Math.PI / 2 - (i / 4) * (Math.PI / 2);
            flapPts.push([hx1 - fR + fR * Math.cos(a), fy, flapTopZ - fR + fR * Math.sin(a)]);
        }
        flapPts.push([hx1, fy, flapBotZ]);
        parts.push(K.wire([flapPts], flag));
    }

    const dialCz = (waistZ + mountBotZ) * .5 - .004,
        dialD = Math.min(mountW * .72, (waistZ - mountBotZ) * .70),
        dialR = dialD * .47,
        dialFront = mountFront - .025,
        dialPath = K.roundRectPath(dialD, dialD, dialR, 4, 0, dialCz),
        dialMarks = K.bevelMarks(dialPath, dialR, 4, 'gacha-dial');
    parts.push(K.box(dialPath, dialFront, mountFront, { axis: 'y', seamMarks: dialMarks, ...flag }));

    const barH = Math.max(.024, dialD * .30),
        barR = .006,
        barPath = K.roundRectPath(dialD * .92, barH, barR, 2, 0, dialCz),
        barMarks = K.bevelMarks(barPath, barR, 2, 'gacha-bar');
    parts.push(K.box(barPath, dialFront - .025, dialFront, { axis: 'y', seamMarks: barMarks, ...flag }));

    // ダイヤル円盤内側の凹みリム弧（回転つまみの上下）
    const inDialR = dialR * .74,
        dy = dialFront - .0015,
        angMin = Math.asin(Math.min(.85, (barH * .5 + .004) / inDialR)),
        upperArc = [],
        lowerArc = [];
    for (let i = 0; i <= 8; i++) {
        const a1 = angMin + (i / 8) * (Math.PI - 2 * angMin),
            a2 = -angMin - (i / 8) * (Math.PI - 2 * angMin);
        upperArc.push([inDialR * Math.cos(a1), dy, dialCz + inDialR * Math.sin(a1)]);
        lowerArc.push([inDialR * Math.cos(a2), dy, dialCz + inDialR * Math.sin(a2)]);
    }
    parts.push(K.wire([upperArc, lowerArc], flag));

    // 3) 右側のコイン投入口（上）と上丸アーチ型の返却・価格プレート（下）
    const coinX = w * .31,
        slotW = w * .105,
        slotH = (waistZ - baseH) * .20,
        slotCz = waistZ - (waistZ - baseH) * .18,
        slotFront = front - .025;
    parts.push(K.box(K.rectPath(slotW, slotH, coinX, slotCz), slotFront, front, { axis: 'y', ...flag }));
    parts.push(
        K.wire([[[coinX, slotFront - .0015, slotCz - slotH * .28], [coinX, slotFront - .0015, slotCz + slotH * .28]]], flag),
    );
    const archW = w * .165,
        archTopZ = waistZ - (waistZ - baseH) * .33,
        archBotZ = Math.min(archTopZ - .04, Math.max(baseH + (waistZ - baseH) * .12, chuteTopZ + .014)),
        archH = Math.max(.04, archTopZ - archBotZ),
        archR = Math.min(archW / 2, archH * .48),
        archXZ = [[coinX - archW / 2, archBotZ], [coinX + archW / 2, archBotZ]];
    for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI;
        archXZ.push([coinX + archR * Math.cos(a), archBotZ + archH - archR + archR * Math.sin(a)]);
    }
    const archPoly = K.area2(archXZ) < 0 ? archXZ.slice().reverse() : archXZ,
        archMarks = [
            null,
            null,
            ...archPoly.map((p) => (p[1] <= archBotZ + 1e-4 ? null : p[0] < coinX ? 'gacha-arch:L' : 'gacha-arch:R')),
        ];
    parts.push(K.box(archPoly, slotFront, front, { axis: 'y', seamMarks: archMarks, ...flag }));
    // アーチプレート内のラベル枠線
    const inW = archW * .72,
        inZ0 = archBotZ + archH * .14,
        inZ1 = archBotZ + archH * .68,
        ay = slotFront - .0015;
    parts.push(
        K.wire([
            [
                [coinX - inW / 2, ay, inZ0],
                [coinX + inW / 2, ay, inZ0],
                [coinX + inW / 2, ay, inZ1],
                [coinX - inW / 2, ay, inZ1],
                [coinX - inW / 2, ay, inZ0],
            ],
        ], flag),
    );

    // 4) 上部カプセルケース（ガチャが入ってるところ：縦にも横にも滑らかにカーブする3D透明ドーム＋湾曲ディスプレイ台紙）
    const yBackDrum = cutDepthY + d * .04,
        drumSteps = 14,
        xSteps = 8,
        xNodes = [dx0];
    for (let j = 0; j <= xSteps; j++) xNodes.push(ix0 + (ix1 - ix0) * (j / xSteps));
    xNodes.push(dx1);
    const drumTris = [],
        drumLeftEdge = [],
        drumRightEdge = [],
        drumBotEdge = [],
        drumTopEdge = [],
        dQuad = (p0, p1, p2, p3) => drumTris.push([p0, p1, p2], [p0, p2, p3]);
    for (const x of xNodes) {
        drumBotEdge.push([x, yDrumAtX(x, 0), waistZ]);
        drumTopEdge.push([x, yDrumAtX(x, 1), winTopZ]);
    }
    for (let i = 0; i <= drumSteps; i++) {
        const t = i / drumSteps,
            z = waistZ + t * winSpan,
            yfL = yDrumAtX(dx0, t),
            yfR = yDrumAtX(dx1, t);
        drumLeftEdge.push([dx0, yfL, z]);
        drumRightEdge.push([dx1, yfR, z]);
        if (i < drumSteps) {
            const t1 = (i + 1) / drumSteps,
                zNext = waistZ + t1 * winSpan;
            for (let j = 0; j < xNodes.length - 1; j++) {
                const xA = xNodes[j],
                    xB = xNodes[j + 1];
                dQuad(
                    [xA, yDrumAtX(xA, t), z],
                    [xB, yDrumAtX(xB, t), z],
                    [xB, yDrumAtX(xB, t1), zNext],
                    [xA, yDrumAtX(xA, t1), zNext],
                );
            }
            // C字切り欠き内面（x = ix0, ix1）から奥へ続くカプセルドラム側面
            dQuad([ix0, yBackDrum, z], [ix0, yDrumAtX(ix0, t), z], [ix0, yDrumAtX(ix0, t1), zNext], [ix0, yBackDrum, zNext]);
            dQuad([ix1, yDrumAtX(ix1, t), z], [ix1, yBackDrum, z], [ix1, yBackDrum, zNext], [ix1, yDrumAtX(ix1, t1), zNext]);
            // 外縁（dx0, dx1）と内縁（ix0, ix1）をつなぐ側面閉じストリップ
            dQuad([dx0, yDrumAtX(ix0, t), z], [dx0, yfL, z], [dx0, yDrumAtX(dx0, t1), zNext], [dx0, yDrumAtX(ix0, t1), zNext]);
            dQuad([dx1, yfR, z], [dx1, yDrumAtX(ix1, t), z], [dx1, yDrumAtX(ix1, t1), zNext], [dx1, yDrumAtX(dx1, t1), zNext]);
        }
    }
    dQuad([ix1, yBackDrum, waistZ], [ix0, yBackDrum, waistZ], [ix0, yBackDrum, winTopZ], [ix1, yBackDrum, winTopZ]);
    for (let j = 0; j < xNodes.length - 1; j++) {
        const xA = xNodes[j],
            xB = xNodes[j + 1],
            yBackA = xA < ix0 - 1e-5 || xB > ix1 + 1e-5 ? yDrumAtX(xA < 0 ? ix0 : ix1, 0) : yBackDrum,
            yBackB = xA < ix0 - 1e-5 || xB > ix1 + 1e-5 ? yDrumAtX(xA < 0 ? ix0 : ix1, 1) : yBackDrum;
        dQuad([xA, yBackA, waistZ], [xB, yBackA, waistZ], [xB, yDrumAtX(xB, 0), waistZ], [xA, yDrumAtX(xA, 0), waistZ]);
        dQuad([xA, yDrumAtX(xA, 1), winTopZ], [xB, yDrumAtX(xB, 1), winTopZ], [xB, yBackB, winTopZ], [xA, yBackB, winTopZ]);
    }
    parts.push({
        meshTriangles: drumTris,
        meshEdges: [drumLeftEdge, drumRightEdge, drumBotEdge, drumTopEdge],
        ...flag,
    });

    // カプセル容器の3D曲面に沿って湾曲する商品見本台紙（外枠・ヘッダー帯・中央イラスト枠・下部バーコード帯）
    const cardX = (w - 2 * sideT) * .44,
        inCardX = cardX * .82,
        tBot = .04,
        tBar = .18,
        tIn0 = .28,
        tIn1 = .73,
        tHead = .80,
        tTop = .94,
        ptCard = (x, t) => [x, yDrumAtX(x, t) - .002, waistZ + t * winSpan],
        spanX = (x0, x1, t, n = 8) => {
            const arr = [];
            for (let i = 0; i <= n; i++) arr.push(ptCard(x0 + (x1 - x0) * (i / n), t));
            return arr;
        },
        spanT = (x, t0, t1, n = 10) => {
            const arr = [];
            for (let i = 0; i <= n; i++) arr.push(ptCard(x, t0 + (t1 - t0) * (i / n)));
            return arr;
        };
    parts.push(
        K.wire([
            [
                ...spanT(-cardX, tBot, tTop, 12),
                ...spanX(-cardX, cardX, tTop, 8).slice(1),
                ...spanT(cardX, tTop, tBot, 12).slice(1),
                ...spanX(cardX, -cardX, tBot, 8).slice(1),
            ],
            spanX(-cardX, cardX, tHead, 8),
            spanX(-cardX, cardX, tBar, 8),
            [
                ...spanT(-inCardX, tIn0, tIn1, 8),
                ...spanX(-inCardX, inCardX, tIn1, 6).slice(1),
                ...spanT(inCardX, tIn1, tIn0, 8).slice(1),
                ...spanX(inCardX, -inCardX, tIn0, 6).slice(1),
            ],
        ], flag),
    );

    // 5) 黒い天板キャップ（topZ 〜 h）：下部は外壁と面一で立ち上がり、上端（crownH）が45°に面取りされたベベルキャップ
    const crownH = Math.min(.014, capH * .36),
        crownInset = Math.min(.012, w * .034),
        zBev = h - crownH,
        lx0 = -w / 2,
        rx1 = w / 2,
        cx0 = lx0 + crownInset,
        cx1 = rx1 - crownInset,
        cf = front + crownInset,
        cb = back - crownInset,
        capTris = [],
        cQuad = (p0, p1, p2, p3) => capTris.push([p0, p1, p2], [p0, p2, p3]);
    cQuad([lx0, back, topZ], [rx1, back, topZ], [rx1, front, topZ], [lx0, front, topZ]);
    cQuad([lx0, front, topZ], [rx1, front, topZ], [rx1, front, zBev], [lx0, front, zBev]);
    cQuad([rx1, front, topZ], [rx1, back, topZ], [rx1, back, zBev], [rx1, front, zBev]);
    cQuad([rx1, back, topZ], [lx0, back, topZ], [lx0, back, zBev], [rx1, back, zBev]);
    cQuad([lx0, back, topZ], [lx0, front, topZ], [lx0, front, zBev], [lx0, back, zBev]);
    cQuad([lx0, front, zBev], [rx1, front, zBev], [cx1, cf, h], [cx0, cf, h]);
    cQuad([rx1, front, zBev], [rx1, back, zBev], [cx1, cb, h], [cx1, cf, h]);
    cQuad([rx1, back, zBev], [lx0, back, zBev], [cx0, cb, h], [cx1, cb, h]);
    cQuad([lx0, back, zBev], [lx0, front, zBev], [cx0, cf, h], [cx0, cb, h]);
    cQuad([cx0, cf, h], [cx1, cf, h], [cx1, cb, h], [cx0, cb, h]);
    parts.push({
        meshTriangles: capTris,
        meshEdges: [
            [[lx0, front, zBev], [rx1, front, zBev], [rx1, back, zBev], [lx0, back, zBev], [lx0, front, zBev]],
            [[cx0, cf, h], [cx1, cf, h], [cx1, cb, h], [cx0, cb, h], [cx0, cf, h]],
            [[lx0, front, topZ], [lx0, front, zBev], [cx0, cf, h]],
            [[rx1, front, topZ], [rx1, front, zBev], [cx1, cf, h]],
            [[rx1, back, topZ], [rx1, back, zBev], [cx1, cb, h]],
            [[lx0, back, topZ], [lx0, back, zBev], [cx0, cb, h]],
        ],
        ...flag,
    });
    return parts;
}

function gachaMachineBuild(o, K = ASSET_KIT) {
    const g = gachaMachineGeom(o),
        unit = gachaMachineUnitParts(o, K),
        stacked = K.repeatParts(unit, { axis: 'z', spacing: g.h, count: g.stack, group: 'gacha-stack' }),
        xStart = -((g.count - 1) * g.w) / 2;
    return K.repeatParts(K.moveParts(stacked, xStart, 0, 0), { axis: 'x', spacing: g.w, count: g.count, group: 'gacha-col' });
}

(function () {
    ASSET_KIT.define(
        'ufoCatcher',
        {
            label: 'UFOキャッチャー',
            glyph: '⌅',
            group: 'street',
            w: .90,
            d: .85,
            h: 1.85,
            accent: '#36d6a8',
            minHalfWidth: () => .21,
            minHalfDepth: () => .20,
            minHeight: () => .90,
            controls: [
                {
                    key: 'ufoBaseHeight',
                    label: '土台の高さ',
                    canvasSlider: true,
                    default: .68,
                    min: .26,
                    max: (o) => ufoCatcherGeom(o).maxBase,
                    step: .02,
                    unit: 'm',
                    get: (o) => ufoCatcherGeom(o).baseH,
                    handle: (o, v) => {
                        const g = ufoCatcherGeom(o);
                        return { anchor: [g.w * .22, -g.d / 2, 0], sample: [g.w * .22, -g.d / 2, v], probe: [g.w * .22, -g.d / 2, v + 1], fallback: { x: 0, y: -1 } };
                    },
                },
                {
                    key: 'ufoBevel',
                    label: '角のベベル',
                    type: 'range',
                    canvasSlider: true,
                    default: .070,
                    min: .01,
                    max: (o) => ufoCatcherGeom(o).maxBevel,
                    step: .005,
                    unit: 'm',
                    get: (o) => ufoCatcherGeom(o).bevel,
                    handle: (o, v) => {
                        const g = ufoCatcherGeom(o);
                        return { anchor: [g.w / 2, -g.d / 2, g.baseH * .82], sample: [g.w / 2 - v, -g.d / 2, g.baseH * .82], probe: [g.w / 2 - v - 1, -g.d / 2, g.baseH * .82], fallback: { x: -1, y: 0 } };
                    },
                },
                {
                    key: 'ufoConsoleWidth',
                    label: 'ボタン操作台の幅',
                    canvasSlider: true,
                    default: .22,
                    min: .10,
                    max: (o) => ufoCatcherGeom(o).maxConsoleW,
                    step: .01,
                    unit: 'm',
                    get: (o) => ufoCatcherGeom(o).consoleW,
                    handle: (o, v) => {
                        const g = ufoCatcherGeom(o),
                            y = -g.d / 2 - g.consoleProj,
                            z = g.consoleFrontZ * .62;
                        return { anchor: [g.cx0, y, z], sample: [g.cx0 + v, y, z], probe: [g.cx0 + v + 1, y, z], fallback: { x: 1, y: 0 } };
                    },
                },
                {
                    key: 'ufoChuteWidth',
                    label: '取り出し口の幅',
                    canvasSlider: true,
                    default: .28,
                    min: .10,
                    max: (o) => ufoCatcherGeom(o).maxChuteW,
                    step: .01,
                    unit: 'm',
                    get: (o) => ufoCatcherGeom(o).chuteW,
                    handle: (o, v) => {
                        const g = ufoCatcherGeom(o),
                            z = (g.chuteZ0 + g.chuteZ1) / 2;
                        return { anchor: [g.chuteMidX, -g.d / 2, z], sample: [g.chuteMidX + v / 2, -g.d / 2, z], probe: [g.chuteMidX + (v + 1) / 2, -g.d / 2, z], fallback: { x: 1, y: 0 } };
                    },
                },
                {
                    key: 'ufoChuteHeight',
                    label: '取り出し口の高さ',
                    canvasSlider: true,
                    default: .22,
                    min: .08,
                    max: (o) => ufoCatcherGeom(o).maxChuteH,
                    step: .01,
                    unit: 'm',
                    get: (o) => ufoCatcherGeom(o).chuteH,
                    handle: (o, v) => {
                        const g = ufoCatcherGeom(o);
                        return { anchor: [g.chuteMidX, -g.d / 2, g.chuteZ0], sample: [g.chuteMidX, -g.d / 2, g.chuteZ0 + v], probe: [g.chuteMidX, -g.d / 2, g.chuteZ0 + v + 1], fallback: { x: 0, y: -1 } };
                    },
                },
                {
                    key: 'ufoChuteX',
                    label: '取り出し口の左右位置',
                    canvasSlider: true,
                    default: 0,
                    min: (o) => -ufoCatcherGeom(o).maxChuteOffX,
                    max: (o) => ufoCatcherGeom(o).maxChuteOffX,
                    step: .01,
                    unit: 'm',
                    get: (o) => ufoCatcherGeom(o).chuteOffX,
                    handle: (o, v) => {
                        const g = ufoCatcherGeom(o),
                            z = g.chuteZ0;
                        return { anchor: [g.defaultChuteMidX, -g.d / 2, z], sample: [g.defaultChuteMidX + v, -g.d / 2, z], probe: [g.defaultChuteMidX + v + 1, -g.d / 2, z], fallback: { x: 1, y: 0 } };
                    },
                },
                {
                    key: 'ufoChuteZ',
                    label: '取り出し口の上下位置',
                    canvasSlider: true,
                    default: 0,
                    min: (o) => ufoCatcherGeom(o).minChuteOffZ,
                    max: (o) => ufoCatcherGeom(o).maxChuteOffZ,
                    step: .01,
                    unit: 'm',
                    get: (o) => ufoCatcherGeom(o).chuteOffZ,
                    handle: (o, v) => {
                        const g = ufoCatcherGeom(o),
                            x = g.chuteX0;
                        return { anchor: [x, -g.d / 2, g.defaultChuteMidZ], sample: [x, -g.d / 2, g.defaultChuteMidZ + v], probe: [x, -g.d / 2, g.defaultChuteMidZ + v + 1], fallback: { x: 0, y: -1 } };
                    },
                },
                {
                    key: 'ufoClawX',
                    label: 'クレーンの左右位置',
                    canvasSlider: true,
                    default: 0,
                    min: (o) => -ufoCatcherGeom(o).maxClawX,
                    max: (o) => ufoCatcherGeom(o).maxClawX,
                    step: .02,
                    unit: 'm',
                    get: (o) => ufoCatcherGeom(o).clawX,
                    handle: (o, v) => {
                        const g = ufoCatcherGeom(o),
                            z = g.roofBottom - g.clawDrop - .04;
                        return { anchor: [0, -g.d * .04, z], sample: [v, -g.d * .04, z], probe: [v + 1, -g.d * .04, z], fallback: { x: 1, y: 0 } };
                    },
                },
                {
                    key: 'ufoClawDrop',
                    label: 'クレーンの下がり量',
                    canvasSlider: true,
                    default: .30,
                    min: .10,
                    max: (o) => ufoCatcherGeom(o).maxDrop,
                    step: .02,
                    unit: 'm',
                    get: (o) => ufoCatcherGeom(o).clawDrop,
                    handle: (o, v) => {
                        const g = ufoCatcherGeom(o),
                            top = g.roofBottom - .04;
                        return { anchor: [g.clawX, -g.d * .04, top], sample: [g.clawX, -g.d * .04, top - v], probe: [g.clawX, -g.d * .04, top - v - 1], fallback: { x: 0, y: 1 } };
                    },
                },
                {
                    key: 'ufoCount',
                    label: '横に並べる数',
                    type: 'range',
                    canvasSlider: true,
                    default: 1,
                    min: 1,
                    max: 10,
                    step: 1,
                    integer: true,
                    unit: '台',
                    get: (o) => ufoCatcherGeom(o).count,
                    handle: (o, v) => {
                        const g = ufoCatcherGeom(o),
                            x = g.w / 2,
                            z = g.h * .55;
                        return { anchor: [x - .12, -g.d / 2, z], sample: [x + .05, -g.d / 2, z], probe: [x + 1.05, -g.d / 2, z], fallback: { x: 1, y: 0 }, pixelsPerUnit: 26 };
                    },
                },
                { key: 'ufoGap', label: '並べる間隔', type: 'range', canvasSlider: true, default: 0, min: 0, max: 1, step: .02, unit: 'm' },
                { key: 'ufoTopSign', label: '上の看板プレート', type: 'boolean', default: true },
            ],
        },
        (o, K) => ufoCatcherBuild(o, K),
    );

    ASSET_KIT.define(
        'gachaMachine',
        {
            label: 'ガチャ',
            glyph: '◓',
            group: 'street',
            w: .38,
            d: .44,
            h: .68,
            accent: '#e0568b',
            minHalfWidth: () => .11,
            minHalfDepth: () => .12,
            minHeight: () => .36,
            controls: [
                {
                    key: 'gachaStack',
                    label: '上に積む段数',
                    type: 'range',
                    canvasSlider: true,
                    default: 1,
                    min: 1,
                    max: 6,
                    step: 1,
                    integer: true,
                    unit: '段',
                    get: (o) => gachaMachineGeom(o).stack,
                    handle: (o, v) => {
                        const g = gachaMachineGeom(o),
                            x = -g.w * .28,
                            z = g.h;
                        return { anchor: [x, -g.d / 2, z - .10], sample: [x, -g.d / 2, z + .05], probe: [x, -g.d / 2, z + 1.05], fallback: { x: 0, y: -1 }, pixelsPerUnit: 28 };
                    },
                },
                {
                    key: 'gachaCount',
                    label: '横に並べる数',
                    type: 'range',
                    canvasSlider: true,
                    default: 1,
                    min: 1,
                    max: 10,
                    step: 1,
                    integer: true,
                    unit: '台',
                    get: (o) => gachaMachineGeom(o).count,
                    handle: (o, v) => {
                        const g = gachaMachineGeom(o),
                            x = g.w / 2,
                            z = g.h * .55;
                        return { anchor: [x - .08, -g.d / 2, z], sample: [x + .04, -g.d / 2, z], probe: [x + 1.04, -g.d / 2, z], fallback: { x: 1, y: 0 }, pixelsPerUnit: 28 };
                    },
                },
                {
                    key: 'gachaChuteWidth',
                    label: '取り出し口の幅',
                    canvasSlider: true,
                    default: .17,
                    min: .08,
                    max: (o) => gachaMachineGeom(o).maxChuteW,
                    step: .01,
                    unit: 'm',
                    get: (o) => gachaMachineGeom(o).chuteW,
                    handle: (o, v) => {
                        const g = gachaMachineGeom(o),
                            z = g.chuteMidZ;
                        return { anchor: [g.chuteMidX, -g.d / 2, z], sample: [g.chuteMidX + v / 2, -g.d / 2, z], probe: [g.chuteMidX + (v + 1) / 2, -g.d / 2, z], fallback: { x: 1, y: 0 } };
                    },
                },
                {
                    key: 'gachaChuteHeight',
                    label: '取り出し口の高さ',
                    canvasSlider: true,
                    default: .11,
                    min: .05,
                    max: (o) => gachaMachineGeom(o).maxChuteH,
                    step: .01,
                    unit: 'm',
                    get: (o) => gachaMachineGeom(o).chuteH,
                    handle: (o, v) => {
                        const g = gachaMachineGeom(o);
                        return { anchor: [g.chuteMidX, -g.d / 2, g.chuteFloorZ], sample: [g.chuteMidX, -g.d / 2, g.chuteFloorZ + v], probe: [g.chuteMidX, -g.d / 2, g.chuteFloorZ + v + 1], fallback: { x: 0, y: -1 } };
                    },
                },
                {
                    key: 'gachaChuteX',
                    label: '取り出し口の左右位置',
                    canvasSlider: true,
                    default: 0,
                    min: (o) => -gachaMachineGeom(o).maxChuteOffX,
                    max: (o) => gachaMachineGeom(o).maxChuteOffX,
                    step: .005,
                    unit: 'm',
                    get: (o) => gachaMachineGeom(o).chuteOffX,
                    handle: (o, v) => {
                        const g = gachaMachineGeom(o),
                            z = g.chuteFloorZ;
                        return { anchor: [0, -g.d / 2, z], sample: [v, -g.d / 2, z], probe: [v + 1, -g.d / 2, z], fallback: { x: 1, y: 0 } };
                    },
                },
                {
                    key: 'gachaChuteZ',
                    label: '取り出し口の上下位置',
                    canvasSlider: true,
                    default: 0,
                    min: (o) => gachaMachineGeom(o).minChuteOffZ,
                    max: (o) => gachaMachineGeom(o).maxChuteOffZ,
                    step: .005,
                    unit: 'm',
                    get: (o) => gachaMachineGeom(o).chuteOffZ,
                    handle: (o, v) => {
                        const g = gachaMachineGeom(o),
                            x = g.chuteX0,
                            z0 = g.defaultFloorZ + g.chuteH / 2;
                        return { anchor: [x, -g.d / 2, z0], sample: [x, -g.d / 2, z0 + v], probe: [x, -g.d / 2, z0 + v + 1], fallback: { x: 0, y: -1 } };
                    },
                },
                {
                    key: 'gachaWaistRatio',
                    label: '下胴の高さ割合',
                    canvasSlider: true,
                    default: .47,
                    min: .36,
                    max: .60,
                    step: .02,
                    get: (o) => gachaMachineGeom(o).waistRatio,
                    handle: (o, v) => {
                        const g = gachaMachineGeom(o),
                            x = -g.w * .24;
                        return { anchor: [x, -g.d / 2, 0], sample: [x, -g.d / 2, g.h * v], probe: [x, -g.d / 2, g.h * (v + 1)], fallback: { x: 0, y: -1 } };
                    },
                },
            ],
        },
        (o, K) => gachaMachineBuild(o, K),
    );
})();


// ===== リクエスト追加家具・街設備（2026-11）=====
(function(){
 const V=(o,k,d)=>Number.isFinite(Number(o?.[k]))?Number(o[k]):d,
       box=(K,w,d,z0,z1,x=0,y=0,extra={})=>K.box(K.rectPath(w,d,x,y),z0,z1,extra);
 // 参照写真の路上用変圧器。二枚扉・換気スリット・注意プレートを少数の線で表す。
 const transformerGeom=o=>{const w=2*Math.abs(o.ra),d=2*Math.abs(o.rb),h=o.h,
  pw=Math.max(.12,Math.min(w*.44,V(o,'transformerPanelWidth',w*.37))),
  ph=Math.max(.12,Math.min(h*.68,V(o,'transformerPanelHeight',h*.62))),
  px=Math.max(-w*.12,Math.min(w*.12,V(o,'transformerPanelX',0))),
  pz=Math.max(ph/2+.12,Math.min(h-ph/2-.11,V(o,'transformerPanelZ',h*.53))),
  b=Math.max(0,Math.min(V(o,'transformerBevel',.035),Math.min(w,d)*.22));
  return {w,d,h,pw,ph,px,pz,b,front:-d/2-.012};};
 const transformerControls=[
  {key:'transformerBevel',label:'Z軸辺のベベル',type:'range',canvasSlider:true,default:.035,min:0,max:o=>Math.min(Math.abs(o.ra),Math.abs(o.rb))*.22,step:.005,unit:'m',get:o=>transformerGeom(o).b,handle:(o,v)=>{const g=transformerGeom(o);return{anchor:[g.w/2,-g.d/2,g.h],sample:[g.w/2-v,-g.d/2,g.h],probe:[g.w/2-v-1,-g.d/2,g.h],fallback:{x:-1,y:0}};}},
  {key:'transformerPanelWidth',label:'内側の四角の幅',type:'range',canvasSlider:true,default:.33,min:.12,max:o=>Math.max(.12,2*Math.abs(o.ra)*.44),step:.01,unit:'m',get:o=>transformerGeom(o).pw,handle:(o,v)=>{const g=transformerGeom(o);return{anchor:[g.px,g.front,g.pz],sample:[g.px+v/2,g.front,g.pz],probe:[g.px+v/2+1,g.front,g.pz],fallback:{x:1,y:0}};}},
  {key:'transformerPanelHeight',label:'内側の四角の高さ',type:'range',canvasSlider:true,default:.65,min:.12,max:o=>Math.max(.12,o.h*.68),step:.01,unit:'m',get:o=>transformerGeom(o).ph,handle:(o,v)=>{const g=transformerGeom(o);return{anchor:[g.px,g.front,g.pz-v/2],sample:[g.px,g.front,g.pz+v/2],probe:[g.px,g.front,g.pz+v/2+1],fallback:{x:0,y:-1}};}},
  {key:'transformerPanelX',label:'内側の四角の左右位置',type:'range',canvasSlider:true,default:0,min:o=>-Math.abs(o.ra)*.1,max:o=>Math.abs(o.ra)*.1,step:.01,unit:'m',get:o=>transformerGeom(o).px,handle:(o,v)=>{const g=transformerGeom(o);return{anchor:[0,g.front,g.pz],sample:[v,g.front,g.pz],probe:[v+1,g.front,g.pz],fallback:{x:1,y:0}};}},
  {key:'transformerPanelZ',label:'内側の四角の上下位置',type:'range',canvasSlider:true,default:.55,min:o=>.18,max:o=>o.h-.18,step:.01,unit:'m',get:o=>transformerGeom(o).pz,handle:(o,v)=>{const g=transformerGeom(o);return{anchor:[g.px,g.front,0],sample:[g.px,g.front,v],probe:[g.px,g.front,v+1],fallback:{x:0,y:-1}};}}
 ];
 ASSET_KIT.define('utilityCabinet',{label:'変圧器',glyph:'▣',group:'street',w:.9,d:.58,h:1.05,accent:'#b9b7a7',minHalfWidth:()=>.12,minHalfDepth:()=>.1,minHeight:()=>.3,controls:transformerControls},(o,K)=>{
  const g=transformerGeom(o),{w,d,h,pw,ph,px,pz,b,front}=g,out=[],t=.055,cap=.075;
  out.push(beveledPrismPart(K,K.rectPath(w,d),0,h-cap,b,4,{seamGroup:'transformer-body'}));
  // 上の薄い張り出し蓋と下の台輪（大きな箱を重ねず、接合線だけを残す）
  out.push(beveledPrismPart(K,K.rectPath(w+.035,d+.035),h-cap,h,b,4,{seamGroup:'transformer-cap'}));
  out.push(box(K,w+.025,d+.025,0,t));
  const doorGap=.018,doorCx=pw/2+doorGap/2;
  for(const sx of [-1,1]){
   const cx=px+sx*doorCx;
   out.push(box(K,pw,.014,pz-ph/2,pz+ph/2,cx,front));
   // 四本の短い換気スリットをそれぞれの扉上部へ
   for(let i=0;i<4;i++)out.push(box(K,pw*.46,.008,pz+ph*.23+i*.023,pz+ph*.245+i*.023,cx,front-.012));
   out.push(box(K,.016,.025,pz-ph*.08,pz+ph*.08,cx-sx*(pw*.38),front-.024));
  }
  // 左扉の注意表示（細い三角枠と中央の警告線）。文字のような細線は増やさない。
  const warnW=Math.min(pw*.5,.14),warnH=Math.min(ph*.23,.17),wx=px-doorCx, wz=pz-ph*.18;
  out.push(K.box([[wx-warnW*.5,wz-warnH*.45],[wx+warnW*.5,wz-warnH*.45],[wx,wz+warnH*.55]],front-.025,front-.018,{axis:'y',width:2,noSides:true}));
  // 三角の外形だけにして中央の細い警告線を省き、線画の欠けと細密化を避ける。
  return out;
 });
 // 参考画像に寄せた木造鳥居：円柱状の控えめな柱、反りのある笠木、島木、貫、額束。
 ASSET_KIT.define('torii',{label:'鳥居',glyph:'⛩',group:'street',w:3.4,d:.42,h:3.2,toriiPostHeight:2.56,toriiPostThickness:.235,accent:'#8b4d34',minHalfWidth:()=>.5,minHalfDepth:()=>.08,minHeight:()=>1,controls:[
  {key:'toriiPostHeight',label:'柱の高さ',type:'range',canvasSlider:true,default:2.56,min:1,max:o=>Math.max(1,o.h*.94),step:.01,unit:'m',get:o=>V(o,'toriiPostHeight',o.h*.8),handle:(o,v)=>({anchor:[-o.ra*.32,0,0],sample:[-o.ra*.32,0,v],probe:[-o.ra*.32,0,v+1],fallback:{x:0,y:-1}})},
  {key:'toriiPostThickness',label:'柱の太さ',type:'range',canvasSlider:true,default:.235,min:.08,max:o=>Math.max(.08,Math.min(o.rb*1.5,o.ra*.3)),step:.005,unit:'m',get:o=>V(o,'toriiPostThickness',Math.min(o.ra*.11,o.rb*.56)*2),handle:(o,v)=>({anchor:[-o.ra*.32,-o.rb*.28,V(o,'toriiPostHeight',o.h*.8)],sample:[-o.ra*.32+v/2,-o.rb*.28,V(o,'toriiPostHeight',o.h*.8)],probe:[-o.ra*.32+v/2+1,-o.rb*.28,V(o,'toriiPostHeight',o.h*.8)],fallback:{x:1,y:0}})},
  {key:'toriiPlaqueWidth',label:'中央額の幅',type:'range',canvasSlider:true,min:.1,max:o=>Math.max(.1,o.ra*1.2),step:.01,unit:'m',get:o=>V(o,'toriiPlaqueWidth',Math.abs(o.ra)*.54),handle:(o,v)=>{const p=V(o,'toriiPostHeight',o.h*.8),z=o.h*.765+(p-2.56);return {anchor:[0,-o.rb*.55,z],sample:[v/2,-o.rb*.55,z],probe:[v/2+1,-o.rb*.55,z],fallback:{x:1,y:0}};}},
  {key:'toriiPlaqueHeight',label:'中央額の高さ',type:'range',canvasSlider:true,min:.08,max:o=>Math.max(.08,o.h*.3),step:.01,unit:'m',get:o=>V(o,'toriiPlaqueHeight',.42),handle:(o,v)=>{const p=V(o,'toriiPostHeight',o.h*.8),z=o.h*.70+(p-2.56);return {anchor:[0,-o.rb*.55,z],sample:[0,-o.rb*.55,z+v],probe:[0,-o.rb*.55,z+v+1],fallback:{x:0,y:-1}};}}
 ]},(o,K)=>{
  const w=2*Math.abs(o.ra),d=2*Math.abs(o.rb),h=o.h,postH=Math.min(h*.94,V(o,'toriiPostHeight',h*.8)),topShift=postH-2.56,topH=Math.max(.2,Number(o.toriiHeadHeight)||h),plaqueW=clamp(V(o,'toriiPlaqueWidth',w*.27),.1,w*.6),plaqueH=clamp(V(o,'toriiPlaqueHeight',.42),.08,topH*.3),r=Math.min(V(o,'toriiPostThickness',Math.min(w*.055,d*.28)*2)/2,d*.38),px=w*.32,out=[];
  const postCylinder=(radius,z0,z1,cx)=>({...K.cylinder(radius,z0,z1,{seg:24,verts:2,cx}),preciseTubeEdge:true,onFace:true});
  for(const x of [-px,px]){
   out.push(postCylinder(r,0,postH,x),postCylinder(r*1.28,0,Math.min(postH*.2,r*.75),x),
    postCylinder(r*1.08,postH*.84,postH*.89,x),postCylinder(r*1.08,postH*.96,postH,x));
  }
  // 笠木は中央がわずかに高く、両端が反り上がる長い板として押し出す。
  const beamPath=(width,zTop,thick)=>{const a=width/2;return [[-a,zTop-.04],[-a*.92,zTop-.015],[-a*.72,zTop+.025],[-a*.4,zTop+.045],[0,zTop+.05],[a*.4,zTop+.045],[a*.72,zTop+.025],[a*.92,zTop-.015],[a,zTop-.04],[a*.98,zTop-thick],[a*.65,zTop-thick+.012],[0,zTop-thick+.018],[-a*.65,zTop-thick+.012],[-a*.98,zTop-thick]];};
  out.push(K.box(beamPath(w*1.16,topShift+topH*.96,topH*.12),-d*.58,d*.58,{axis:'y'}));
  // 柱高を変えても上部部品の寸法は変えず、柱頭にまとまったまま追従する。
  out.push(K.box(beamPath(w*.98,topShift+topH*.82,topH*.075),-d*.52,d*.52,{axis:'y'}));
  out.push(box(K,w*.76,d*.82,topShift+topH*.61,topShift+topH*.68,0,0));
  // 中央の額束と額（額の幅・高さは独立調整）。
  out.push(box(K,w*.075,d*.82,topShift+topH*.69,topShift+topH*.83,0,0),box(K,plaqueW,d*.11,topShift+topH*.70,topShift+topH*.70+plaqueH,0,-d*.52));
  return out;
 });
 // コンクリート電柱：頭部キャップ、金属バンド、腕金・碍子、側面の柱上変圧器を追加。
 ASSET_KIT.define('utilityPole',{label:'電柱',glyph:'⚡',group:'street',w:.42,d:.42,h:5.5,accent:'#77766e',minHalfWidth:()=>.08,minHalfDepth:()=>.08,minHeight:()=>1,controls:[
  {key:'poleArms',label:'腕金の段数',type:'range',canvasSlider:true,default:2,min:1,max:4,step:1,integer:true,unit:'段'},
  {key:'transformerZ',label:'変圧器の上下位置',type:'range',canvasSlider:true,gizmoMode:'moveZ',min:o=>Math.max(.1,o.h*.1),max:o=>Math.max(.1,o.h*.9),step:.02,unit:'m',get:o=>V(o,'transformerZ',o.h*.47),handle:(o,v)=>({anchor:[o.ra*.35,-o.rb*.4,v],sample:[o.ra*.35,-o.rb*.4,v],probe:[o.ra*.35,-o.rb*.4,v+1],fallback:{x:0,y:-1}})},
  {key:'poleDiameter',label:'電柱の太さ',type:'range',canvasSlider:true,min:.08,max:o=>Math.max(.08,Math.min(o.ra,o.rb)*1.9),step:.005,unit:'m',get:o=>V(o,'poleDiameter',Math.min(o.ra,o.rb)*1.64),handle:(o,v)=>({anchor:[0,-o.rb*.4,o.h*.55],sample:[v/2,-o.rb*.4,o.h*.55],probe:[v/2+1,-o.rb*.4,o.h*.55],fallback:{x:1,y:0}})}
 ]},(o,K)=>{
  const h=o.h,poleDiameter=clamp(V(o,'poleDiameter',Math.min(Math.abs(o.ra),Math.abs(o.rb))*1.64),.08,Math.min(Math.abs(o.ra),Math.abs(o.rb))*1.9),r=poleDiameter/1.64,n=Math.round(V(o,'poleArms',2)),span=r*7.2,out=[];
  const tube=(radius,z0,z1,opt={})=>({...K.cylinder(radius,z0,z1,{seg:24,...opt}),preciseTubeEdge:true,onFace:true});
  out.push(tube(r*.82,0,h*.99,{verts:2}),tube(r*.96,0,h*.045),tube(r*.7,h*.98,h));
  // バンドは装飾線を増やしすぎず、実物の接合位置にだけ入れる。
  for(const f of [.28,.51,.76])out.push(tube(r*1.015,h*f,h*f+.025));
  for(let i=0;i<n;i++){
   const z=h*(.74+i*.055),armD=r*.52;
   out.push(box(K,span,armD,z,z+r*.20),box(K,r*.34,armD*1.4,z-r*.04,z+r*.06,-span*.36),box(K,r*.34,armD*1.4,z-r*.04,z+r*.06,span*.36));
   for(const x of [-span*.34,0,span*.34]){
    out.push(tube(r*.20,z+r*.18,z+r*.28,{seg:16,verts:2,cx:x}),tube(r*.11,z+r*.28,z+r*.42,{seg:16,verts:2,cx:x}));
    const wireSpan=Math.max(r*9,.75),edgeZ=z+r*.43,midZ=z+r*.22;
    // 細い実体のある電線として掃引し、円柱と同じカメラ方向の輪郭稜線を出す。
    // 二次ベジェ制御点を合わせ、元の中央が垂れる線形状を維持する。
    out.push(K.quadraticTube(o,[[x,-wireSpan/2,edgeZ],[x,0,2*midZ-edgeZ],[x,wireSpan/2,edgeZ]],Math.max(.003,r*.055),{sides:10,steps:20}));
   }
  }
  // 柱上変圧器の円筒タンクと2本の取付バンド
  const tx=r*1.55,tr=r*1.02,th=h*.16,tz=clamp(V(o,'transformerZ',h*.47),th/2,h-th/2);
  out.push(box(K,r*1.65,r*.7,tz-.07,tz+.07,tx,-r*.24),tube(tr,tz-th/2,tz+th/2,{verts:2,cx:tx,cy:-r*.4}));
  out.push(tube(tr*1.04,tz-th*.32,tz-th*.27,{cx:tx,cy:-r*.4}),tube(tr*1.04,tz+th*.27,tz+th*.32,{cx:tx,cy:-r*.4}));
  return out;
 });
 // 空のラーメン鉢。回転断面で内側のくぼみを表現、中身なし。
 ASSET_KIT.define('ramenBowl',{label:'ラーメン鉢（空）',glyph:'◉',group:'furniture',w:.28,d:.28,h:.11,accent:'#5b4237',minHalfWidth:()=>.05,minHalfDepth:()=>.05,minHeight:()=>.035,controls:[]},(o,K)=>{
  const r=Math.min(Math.abs(o.ra),Math.abs(o.rb)),h=o.h;
  // 外側の丸い椀形、厚い口縁、内側の底面までを一続きの断面で回転。中身は置かない。
  return [K.revolution([[r*.52,0],[r*.60,h*.045],[r*.69,h*.14],[r*.86,h*.40],[r*.98,h*.82],[r,h*.92],[r*.92,h],[r*.83,h*.965],[r*.77,h*.84],[r*.69,h*.55],[r*.55,h*.30],[0,h*.26]],{seg:32,rings:[1,4,5,6,9],verts:2,preciseTubeEdge:true,onFace:true,capEnd:false})];
 });
 // T脚机。天板は四角・円・racetrack、四角天板は丸み量（ベベル）を調整可能。
 ASSET_KIT.define('tLegTable',{label:'T字脚テーブル',glyph:'▱',group:'furniture',w:1.5,d:.8,h:.74,accent:'#9d7350',minHalfWidth:()=>.25,minHalfDepth:()=>.2,minHeight:()=>.35,controls:[
  {key:'tableTopShape',label:'天板形状',type:'select',default:'square',options:[{value:'square',label:'四角'},{value:'circle',label:'円'},{value:'racetrack',label:'トラック（racetrack）'}]},
  {key:'tableTopBevel',label:'四角天板のベベル',type:'range',canvasSlider:true,default:0,min:0,max:o=>o.tableTopShape==='square'?Math.min(o.ra,o.rb)*.45:0,step:.01,unit:'m',handle:(o,v)=>({anchor:[o.ra,-o.rb,o.h],sample:[o.ra-v,-o.rb,o.h],probe:[o.ra-v-1,-o.rb,o.h],fallback:{x:-1,y:0}})},
  {key:'tableTopWidth',label:'天板の横幅',type:'range',canvasSlider:true,min:.4,max:8,step:.05,unit:'m',get:o=>2*Math.abs(o.ra),patch:(o,v)=>({ra:v/2}),handle:(o,v)=>({anchor:[0,0,o.h],sample:[v/2,0,o.h],probe:[v/2+1,0,o.h],fallback:{x:1,y:0}})},
  {key:'tableTopDepth',label:'天板の縦幅',type:'range',canvasSlider:true,min:.4,max:8,step:.05,unit:'m',get:o=>2*Math.abs(o.rb),patch:(o,v)=>({rb:v/2}),handle:(o,v)=>({anchor:[0,0,o.h],sample:[0,v/2,o.h],probe:[0,v/2+1,o.h],fallback:{x:0,y:1}})},
  {key:'tableLegHeight',label:'脚の高さ',type:'range',canvasSlider:true,gizmoMode:'moveZ',default:.67,min:.2,max:o=>Math.max(3,o.h-.025),step:.01,unit:'m',get:o=>V(o,'tableLegHeight',Math.max(.2,o.h-V(o,'tableTopThickness',.07))),patch:(o,v)=>({tableLegHeight:v,h:v+V(o,'tableTopThickness',.07)}),handle:(o,v)=>({anchor:[-o.ra*.35,0,0],sample:[-o.ra*.35,0,v],probe:[-o.ra*.35,0,v+1],fallback:{x:0,y:-1}})},
  {key:'tableFootLength',label:'脚の横棒の長さ',type:'range',canvasSlider:true,default:.58,min:.1,max:o=>Math.max(.1,2*Math.abs(o.rb)),step:.01,unit:'m',get:o=>V(o,'tableFootLength',Math.max(.1,2*Math.abs(o.rb)*.72)),patch:(o,v)=>({tableFootLength:v}),handle:(o,v)=>({anchor:[-Math.abs(o.ra)*.35,0,.06],sample:[-Math.abs(o.ra)*.35,v/2,.06],probe:[-Math.abs(o.ra)*.35,v/2+1,.06],fallback:{x:0,y:1}})},
  {key:'tableTopThickness',label:'天板厚さ',type:'range',canvasSlider:true,default:.07,min:.025,max:o=>Math.max(.025,o.h*.45),step:.005,unit:'m',get:o=>V(o,'tableTopThickness',.07),patch:(o,v)=>{const leg=V(o,'tableLegHeight',Math.max(.2,o.h-V(o,'tableTopThickness',.07)));return {tableTopThickness:v,h:leg+v};},handle:(o,v)=>({anchor:[o.ra*.35,-o.rb*.3,o.h],sample:[o.ra*.35,-o.rb*.3,o.h-v],probe:[o.ra*.35,-o.rb*.3,o.h-v-1],fallback:{x:0,y:1}})}
]},(o,K)=>{
  const w=2*Math.abs(o.ra),d=2*Math.abs(o.rb),t=Math.max(.025,V(o,'tableTopThickness',.07)),legH=Math.max(.2,V(o,'tableLegHeight',Math.max(.2,o.h-t))),h=legH+t,shape=o.tableTopShape||'square',bevel=V(o,'tableTopBevel',0),z=legH,out=[];
  let path=shape==='circle'?K.circlePath(Math.min(w,d)/2,28):shape==='racetrack'?K.roundRectPath(w,d,Math.min(d/2,w/2),8):K.rectPath(w,d);
  if(shape==='circle') out.push(K.cylinder(Math.min(w,d)/2,z,h,{seg:28}));
  else if(shape==='racetrack') out.push(K.box(path,z,h,{sideVerticals:[0,8,9,17,18,26,27,35]}));
  else out.push(beveledPrismPart(K,K.rectPath(w,d),z,h,bevel,4));
  // two end frames: upright stem and transverse T foot
  const postW=.055, footW=.075, footL=Math.max(.1,Math.min(Math.max(.1,d),V(o,'tableFootLength',.576))), legSpacing=Math.max(.4,Math.min(Math.max(.4,w-.1),V(o,'tableLegSpacing',1.05)));
  for(const x of [-legSpacing/2,legSpacing/2]){out.push(box(K,postW,postW,.07,z,x,0),box(K,footW,footL,0,.07,x,0));}
  return out;
 });
})();
