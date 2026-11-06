/* City Grid Studio engine core.
   アプリ全体で共有する状態・座標計算・投影・基本図形・選択を担当する。

   主な流れ
   1. P / S にカメラ設定と線画・オブジェクト定義を保持する
   2. cam / scr / orthPoint でワールド座標を画面へ投影する
   3. genShape で基本図形の線画を生成する
   4. setOb / regenObjects で定義変更と線画再生成を行う
   5. 保存・読込は末尾のpack / unpack系から呼び出す

   アセット固有の線画は asset.js、ギズモ・ドラッグは engine-gizmo.js、描画は engine-render.js、
   パネルと間取りUIは studio-ui.js に分離している。 */
const $ = (id) => document.getElementById(id);
function isStackedBuildingAsset(o) {
    return o?.type === "asset" && ["stackedBuilding", "beveledStackedBuilding", "cornerCutStackedBuilding"].includes(o.asset);
}
function isBeveledStackedBuildingAsset(o) {
    return o?.type === "asset" && o.asset === "beveledStackedBuilding";
}
function stackedOpeningEnabled(o) {
    return !!(o && isStackedBuildingAsset(o) && (o.openingEnabled === true || o.opening === true));
}
const cv = $("cv"),
    ctx = cv.getContext("2d");
let W = 1600,
    H = 900; // キャンバスの内部サイズ（比率変更でHが変わる）

// ===== 1. パラメータ（初期値の水平回転は参考サイトのy=39.912） =====
const MASTER_W = 1.5;
// P: カメラ、投影、描画設定をまとめたアプリ全体のパラメータ。
// UIから変更された値は sync() でHTMLの入力欄と同期する。
const P = {
    lens: 50,
    yaw: 39.912,
    hz: 50,
    pitch: 0,
    fov: 180,
    roll: 0,
    n: 48,
    ga: 0.45,
    gw: 0.7,
    pw: MASTER_W,
    pa: 0.5,
    ew: 24,
    bt: 128,
    // 初期カメラは原点へ戻し、アセット側で十分な配置距離を自動計算する。
    ch: 1,
    cx: 0,
    cz: 0,
    sn: 14,
    gs: 1,
    gn: 30,
    dp: 8,
    // 面表示は初期状態からONにして、配置した立体を確認しやすくする。
    surfaceMode: true,
};
const show = [true, true, true]; // 軸ごとの補助線表示
// Sは線画とオブジェクト定義の保存場所。RD/HUはやり直し・元に戻す履歴。
// Z/ox/oyは表示倍率とキャンバス移動、sel/selIdsは選択状態を持つ。
let S = [],
    RD = [],
    HU = [],
    Z = 1,
    ox = 0,
    oy = 0,
    mg = null,
    ptrType = null,
    er = null,
    tool = "pen",
    prev = null,
    CR = null,
    bd = false,
    snapHit = null,
    sel = null,
    selIds = new Set(),
    ed = null,
    cur = null,
    drag = null,
    IMG = null,
    mode = "view",
    AX = [],
    AXC = [],
    T = "r"; // T: 'r'=通常の透視 / 'f'=魚眼
// orthViewが設定されると、透視投影ではなく正面・横・上の正投影になる。
let orthView = null,
    standardApplying = false; // Blender風の正面・真横・真上では正投影を使う

// ===== 2. 操作パネルの組み立て =====
const R = (k, t, min, max, st, u = "") =>
    `<label><span>${t}</span><input type=range id=${k} min=${min} max=${max} step=${st}><input type=number class=nv id=v_${k} step=${st}><span class=un>${u}</span></label>`; // スライダー＋数値入力
const RO = (k, t, min, max, st, u = "") =>
    `<label><span>${t}</span><input type=range id=or_${k} min=${min} max=${max} step=${st}><input type=number class=nv id=ov_${k} step=${st}><span class=un>${u}</span></label>`; // 選択中の図形用
$("side").innerHTML = `
<h3>グリッドの種類</h3>
<label><select id=gt style="flex:1"><option value=1>1点透視<option value=2 selected>2点透視<option value=3>3点透視<option value=5>魚眼 5点<option value=6>魚眼 6点</select></label>
<h3>カメラ（視点）</h3>
<div class=gr>${R("lens", "レンズ", 14, 200, 1, "mm")}</div>
<div class=gf>${R("fov", "魚眼の画角", 90, 360, 1, "°")}${R("roll", "ロール(傾け)", -180, 180, 0.1, "°")}</div>
${R("yaw", "水平回転", -90, 90, 0.001, "°")}
<div class=gr>${R("hz", "地平線の高さ", -50, 150, 0.1, "%")}</div>
${R("pitch", "上下の傾き", -60, 60, 0.1, "°")}
${R("ch", "カメラの高さ", 0.05, 30, 0.01)}
${R("cx", "カメラ位置 X", -30, 30, 0.01)}
${R("cz", "カメラ位置 Z", -30, 30, 0.01)}
<div class="note">カメラの高さは地面からの高さ（初期値1）。カメラを動かすと、図形（3D）は見え方が変わります。ペンで描いた線は「空に描いたもの」なので動きません</div>
<div class="note gr">3点透視：傾きを0以外にすると垂直もVP3に集まります</div>
<div class="note gf">魚眼：線は曲線（大円）になります。5点＝光軸がZ軸、6点＝軸を回して6点とも見せます</div>
<label><span>画面比率</span><select id=ar><option value=1.7778>16:9<option value=1.3333>4:3<option value=1.5>3:2<option value=1>1:1<option value=0.8>4:5<option value=0.5625>9:16</select></label>
<h3>補助線（細かくできます）</h3>
${R("n", "本数（各VP）", 2, 400, 1, "本")}
${R("ga", "補助線の透過度", 0.05, 1, 0.01)}
${R("gw", "線の太さ", 0.2, 3, 0.1, "px")}
<label><span>表示する軸</span>
 <span><input type=checkbox data-i=0 checked>VP1 <input type=checkbox data-i=1 checked>VP2 <input type=checkbox data-i=2 checked>垂直</span></label>
<label><input type=checkbox id=gg checked> 地面のグリッド（カメラの高さ・位置で見え方が変わる）</label>
${R("gs", "マスの大きさ", 0.1, 10, 0.05)}
${R("gn", "マスの数（片側）", 2, 60, 1)}
<label><input type=checkbox id=gon checked> 補助線を表示</label>
<label><input type=checkbox id=hzl checked> 地平線を表示</label>
<label><input type=checkbox id=bgw checked> 背景を白にする</label>
<h3>ペン</h3>
<label><input type=checkbox id=pn checked> iPad：指＝視点／ペン＝描画</label>
<div class="note">二本指タップ＝元に戻す／三本指タップ＝やり直し／二本指ピンチ＝ズーム・移動<br>オフだと上の①②ボタンのモードで全部の入力を扱います</div>
<label><span>スナップ</span><select id=snap><option value=auto>自動（向きで判定）<option value=0>VP1に固定<option value=1>VP2に固定<option value=2>垂直(VP3)に固定<option value=free>フリーハンド</select></label>
<label><input type=checkbox id=p3 checked> 線を3D空間に固定（視点移動に追従）</label>
${R("dp", "奥行き", 1, 100, 0.5)}
<div class="note">描画した線は3D空間に固定されます。視点を回転・水平移動すると、線画の見え方も変わります。</div>
${R("pw", "線の太さ（全体）", 0.5, 20, 0.5, "px")}
<div class="note">描画線・図形・アセットを含む全ての線画に反映されます。</div>
<label><span>色</span><input type=color id=pc value="#222222"></label>
<label><input type=checkbox id=bin checked> 線画のアンチエイリアスをオフ（二値）</label>
${R("bt", "しきい値", 16, 240, 1)}
<div class="note">値を下げると線が太く、上げると細くなります。細い線(1px未満)は消えやすいので、太さは1px以上がおすすめ</div>
<h3>編集・スナップ</h3>
<label><input type=checkbox id=snp checked> 磁石でスナップ（他の図形・地面にくっつく）</label>
${R("sn", "吸着する距離", 4, 60, 1, "px")}
<div class="note">編集モードで線を選択できます。色つきの矢印＝軸移動、白い四角＝面の押し引き、点線の輪＝回転。選択中の線をドラッグすると移動し、間取りでは専用ハンドルで寸法を調整できます。</div>
<div id=objLockedNotice class="note" style="display:none">ロック中：選択・表示切替はできますが、編集するにはロックを解除してください。</div>
<div id=objP style="display:none">
<h3>選択中のオブジェクト</h3>
${RO("rot", "回転", -180, 180, 0.1, "°")}
<label><span>幅</span><input type=number class=nv id=ov_w step=0.05 style="width:100px"></label>
<label><span>奥行き</span><input type=number class=nv id=ov_dp step=0.05 style="width:100px"></label>
<label><span>高さ</span><input type=number class=nv id=ov_h step=0.05 style="width:100px"></label>
<label><span>位置 X(赤)</span><input type=number class=nv id=ov_px step=0.05 style="width:100px"></label>
<label><span>位置 Y(高さ)</span><input type=number class=nv id=ov_py step=0.05 style="width:100px"></label>
<label><span>位置 Z(緑)</span><input type=number class=nv id=ov_pz step=0.05 style="width:100px"></label>
<div id=arrayModifierP>
<h3>配列</h3>
<label><input type=checkbox id=arrayEnabled> 配列を適用</label>
<div id=arrayModifierFields style="display:none">
<label><span>個数（元を含む）</span><input type=range id=arrayCountSlider min=1 max=100 step=1 value=3><input type=number id=arrayCount min=1 max=100 step=1 value=3 style="width:70px"></label>
<label><span>間隔</span><input type=number id=arraySpacing min=-100 max=100 step=0.1 value=1.5 style="width:100px"><span class=un>m</span></label>
<label><span>方向</span><select id=arrayAxis><option value=x>X（左右）</option><option value=y>Y（地面の奥行き）</option><option value=z>Z（高さ）</option></select></label>
<div class=note>間隔は中心から中心までの距離。マイナスで反対方向に並びます。方向はギズモと同じワールド軸です（位置欄のY・Zとは表記が異なります）。複数選択した場合は全てに適用します。複雑な形状や多数のコピーは表示が重くなる場合があります。</div>
</div></div>
<div id=buildingDoorP style="display:none"><h3>開口の扉</h3>
<label id=buildingOpeningPositionRow><span>開口の左右</span><input type=number id=buildingOpeningOffset step=0.05 style="width:100px"><span class=un>m</span></label>
<button id=buildingDoorCenter type=button>扉を中央へ</button>
<label><input type=checkbox id=buildingDoorEnabled> 扉をつける</label>
<label id=buildingDoorTypeRow style="display:none"><span>扉の種類</span><select id=buildingDoorType><option value=shutter>ガレージシャッター</option><option value=double>両開きドア</option><option value=convenience>コンビニ風のガラスドア</option></select></label>
<div id=buildingDoorNote class=note>扉は閉じた状態で、開口の幅・高さに合わせて作られます。</div>
</div>
<div id=stairsP style="display:none"><h3>階段1</h3>
<label><span>段数</span><input type=number id=stairsSteps min=2 max=24 step=1 value=6 style="width:100px"><span class=un>段</span></label>
<label><input id=stairsRail type=checkbox> 手すりをつける</label>
</div>
<div id=signShapeP style="display:none"><h3>標識の形</h3>
<label><span>板の枚数</span><select id=signCountSel><option value="1">1枚</option><option value="2">2枚</option></select></label>
<label><span>板の形</span><select id=signShapeSel><option value="circle">丸</option><option value="triangle">逆三角形</option><option value="rect">四角</option><option value="diamond">ひし形</option></select></label>
<label id=signShape2Row><span>2枚目の形</span><select id=signShape2Sel><option value="circle">丸</option><option value="triangle">逆三角形</option><option value="rect">四角</option><option value="diamond">ひし形</option></select></label>
<div class="note">板の枚数と形は、丸標識・標識2枚・三角標識・ひし形標識・標識2枚（三角＋丸）で切り替えられます（下の板＝「板の形」、上の板＝「2枚目の形」）。踏切標識は専用の形です。</div>
</div>
<div id=signP style="display:none"><h3>看板の内側</h3>
<label><span>絵枠の幅</span><input type=number class=nv id=ov_faceW step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>絵枠の高さ</span><input type=number class=nv id=ov_faceH step=0.01 style="width:100px"><span class=un>m</span></label>
</div>
<div id=buildingP style="display:none"><h3>建物の開口</h3>
<label id=linkedBuildingOpeningRow style="display:none"><input type=checkbox id=linkedBuildingOpening> 開口をつける</label>
<label id=buildingFacadeRow><input type=checkbox id=buildingFacadeEnabled> ファサード看板をつける</label>
<div id=buildingFacadeControls style="display:none">
<label><input type=checkbox id=buildingFacadeSides> 左右の側面にも回す</label>
<label><span>看板の色</span><input type=color id=buildingFacadeColor value="#2f73bc"></label>
<label><span>看板の高さ</span><input type=number class=nv id=buildingFacadeHeight min=0.05 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>看板の張り出し</span><input type=number class=nv id=buildingFacadeProjection min=0.02 max=2 step=0.01 style="width:100px"><span class=un>m</span></label>
<div class="note">正面上部を横長に押し出した看板です。建物の幅・高さに追従します。文字・ロゴは含みません。</div></div>
<label><span>開口の幅</span><input type=number class=nv id=ov_openingW step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>開口の高さ</span><input type=number class=nv id=ov_openingH step=0.05 style="width:100px"><span class=un>m</span></label>
<div class="note">建物の外形は軸・回転に加え、3Dの白い外側面ハンドルでも幅・奥行き・高さを編集できます。緑のハンドルで開口の幅・高さ、オレンジの「奥の面」で閉じた内壁の奥行きを編集できます。</div>
</div>
<div id=wallSideSignP style="display:none"><h3>壁横の看板</h3>
<label><input type=checkbox id=wallSideSign> 壁横に看板を付ける</label>
<label><span>取付側</span><select id=wallSideSignSide><option value="-1">左側の横壁</option><option value="1">右側の横壁</option></select></label>
<label><input type=checkbox id=wallSideSignBrace checked> 取付金具を付ける</label>
<label><span>取付金具の本数</span><select id=wallSideSignBrackets><option value="0">なし</option><option value="1">1本</option><option value="2">2本</option><option value="3" selected>3本</option></select></label>
<label><span>看板・金具形状</span><select id=wallSideSignShape><option value="box">普通の直方体</option><option value="beveled">ベベル直方体</option></select></label>
<label id=wallSideSignScopeRow style="display:none"><span>階層看板</span><select id=wallSideSignScope><option value="first">1Fだけ</option><option value="all">全部の階</option><option value="individual">階ごとに選択</option></select></label>
<div id=wallSideSignFloorSelect style="display:none"></div>
<label><span>ベベル幅</span><input type=number class=nv id=wallSideSignBevelOffset min=0 max=1 step=0.01 style="width:100px"><span class=un>m</span></label>
<div class="note">開口建物・テント付き建物・看板付き開口建物・ベベル階層・縁付き階層の横壁へ外付けします。取付金具は面のある普通の直方体です。金具はなし／1〜3本、看板本体は普通／ベベルを変更できます。階層建物は1Fだけ／全部の階／階ごとに選択を切り替えられます。看板を選択すると、黄色の「金具」ハンドルで長さ、白い面ハンドルで寸法、オレンジ菱形で看板のベベル幅を画面上から編集できます。</div>
</div>
<div id=balconyP style="display:none"><h3>壁付けベランダ</h3>
<label><span>手すり／腰壁の高さ</span><input type=number class=nv id=balconyRailHeight min=0.12 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>厚さ（床・壁）</span><input type=number class=nv id=balconyThickness min=0.035 step=0.02 style="width:100px"><span class=un>m</span></label>
<label><input type=checkbox id=balconyFrontRail checked> 前面の腰壁を表示</label>
<label><input type=checkbox id=balconySideRail checked> 左右の側壁を表示</label>
<div class="note">建物を選択して棚の「壁付けベランダ」を押すと、建物の正面壁へ2階相当の高さで接着します。接着後は親建物の移動・幅・奥行き・高さに追従し、ベランダ単体の幅・奥行き・手すり高さを編集できます。</div>
</div>
<div id=uWallP style="display:none"><h3>コの字壁</h3>
<label><span>厚さ（屋根・壁）</span><input type=number class=nv id=uWallThickness min=0.035 step=0.02 style="width:100px"><span class=un>m</span></label>
<div class="note">コの字（断面）を奥行き方向へ押し出した形で、上＝屋根板、左右＝側壁の3枚が同じ厚さでつながります。正面・背面・下面は開いています。厚さは数値欄と、屋根の手前角にあるオレンジの四角（3D・間取りの両方）のどちらからでも変えられます。幅・奥行き・高さは寸法ハンドルで編集します。</div>
</div>
<div id=stallP style="display:none"><h3>屋台</h3>
<label><span>壁の厚さ</span><input type=number class=nv id=stallWallThickness min=0.03 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>カウンターの高さ</span><input type=number class=nv id=stallCounterHeight min=0.1 step=0.02 style="width:100px"><span class=un>m</span></label>
<label><span>カウンターの奥行き</span><input type=number class=nv id=stallCounterDepth min=0.05 step=0.02 style="width:100px"><span class=un>m</span></label>
<label><span>屋根の厚さ</span><input type=number class=nv id=stallRoofThickness min=0.04 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>屋根の張り出し</span><input type=number class=nv id=stallRoofOverhang min=0 step=0.02 style="width:100px"><span class=un>m</span></label>
<div class="note">コの字の壁（奥＋左右）の手前下へカウンター箱、真上へ屋根箱を載せた売店です。カウンターの奥行きは手前の面だけが動き、奥の面はコの字に付いたままです。カウンターの高さは上の面だけが動きます（床は動きません）。屋根の張り出しは手前の面だけ、屋根の厚さは下の面だけが動きます（屋根の上面＝全体の高さは動きません）。幅・奥行き・全体の高さは寸法ハンドルで編集します。</div>
</div>
<div id=stoolP style="display:none"><h3>丸椅子</h3>
<label><span>座面の半径</span><input type=number class=nv id=stoolSeatRadius min=0.02 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>座面の高さ（厚み）</span><input type=number class=nv id=stoolSeatThickness min=0.02 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>ポールの半径</span><input type=number class=nv id=stoolLegRadius min=0.005 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>ポールの高さ</span><input type=number class=nv id=stoolLegHeight min=0.02 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>台座の半径</span><input type=number class=nv id=stoolBaseRadius min=0.01 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>台座の高さ</span><input type=number class=nv id=stoolBaseHeight min=0.01 step=0.01 style="width:100px"><span class=un>m</span></label>
<div class="note">台座・ポール・座面の3つの円柱でできた丸椅子です。半径はどれも正円なので1つの値で決まります（幅と奥行きは別々に変わりません）。半径3本は外向き、高さ3本は上下の四角で、画面上から直接編集できます。屋台のカウンター（高さ約1.05m）に合わせて、座面の高さ0.45m・半径0.18mを初期値にしています。</div>
</div>
<div id=railingP style="display:none"><h3>手すり</h3>
<label><span>形</span><select id=railingShape style="width:150px"><option value="u">コの字（3方向）</option><option value="l">L字（2方向）</option><option value="line">直線</option></select></label>
<label><span>手すりの本数</span><button type=button id=railingCountMinus title="1本減らす">−</button><input type=number class=nv id=railingCount min=1 max=40 step=1 style="width:74px"><button type=button id=railingCountPlus title="1本増やす">＋</button><span class=un>本</span></label>
<label><span>角材の太さ</span><input type=number class=nv id=railingThickness min=0.012 step=0.005 style="width:100px"><span class=un>m</span></label>
<label><span>柱の太さ</span><input type=number class=nv id=railingPostSize min=0.012 step=0.005 style="width:100px"><span class=un>m</span></label>
<label><span>下の横桟の高さ</span><input type=number class=nv id=railingBottomGap min=0.02 step=0.01 style="width:100px"><span class=un>m</span></label>
<div class="note">床に立つ柱＋上下の横桟＋縦の棒の手すりです。形はコの字（手前＋左右）・L字（手前＋左）・直線の3種類で、切り替えても手前の横桟の位置は動きません。縦の棒の本数は区間の長さに比例して配分されるので、コの字にしても片側だけ詰まりません。幅・奥行き・高さは白い面ハンドル（3D・前・横・上）または数値欄、角材の太さと下の横桟の高さはオレンジの四角から変更できます。</div>
</div>
<div id=pathPipeP style="display:none"><h3>パスパイプ</h3>
<label><span>パターン</span><select id=pathPipePreset style="width:150px"><option value="custom">手動入力</option><option value="straight">真っ直ぐ</option><option value="l">L字</option><option value="u">U字</option><option value="z">Z字</option><option value="step3d">立体折れ</option></select><button type=button id=pathPipeApplyPreset>適用</button></label>
<label><span>パイプ半径</span><input type=number class=nv id=pathPipeRadius min=0.02 step=0.02 style="width:100px"><span class=un>m</span></label>
<label><span>曲がり半径</span><input type=number class=nv id=pathPipeCornerRadius min=0 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>円周分割</span><input type=number class=nv id=pathPipeSides min=6 max=24 step=1 style="width:100px"></label>
<label class=full><span>パス点（x,y,z）</span><textarea id=pathPipePoints rows=4 placeholder="-2,0,1.1; 0,0,1.1; 0,2.2,1.1"></textarea></label>
<div class="note">キャンバス上の各パス点にあるX／Y／Zハンドルをドラッグすると経路を編集できます。オレンジの「半径」ハンドルで太さを変更できます。曲がり半径を0にすると角が直線になります。</div>
</div>
<div id=wallSignP style="display:none"><h3>壁付け看板（単体）</h3>
<label><input type=checkbox id=wallSignBrace checked> 取付金具を付ける</label>
<label><span>取付金具の本数</span><select id=wallSignBrackets><option value="1">1本</option><option value="2">2本</option><option value="3" selected>3本</option></select></label>
<label><span>取付金具の長さ</span><input type=number class=nv id=wallSignBracketLength min=0.05 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>看板の形状</span><select id=wallSignShape><option value="box">普通の直方体</option><option value="beveled">ベベル（角丸）</option></select></label>
<label><span>ベベル幅</span><input type=number class=nv id=wallSignBevelOffset min=0 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>ベベル分割数</span><input type=number class=nv id=wallSignBevelSegments min=1 max=4 step=1 style="width:100px"><span class="un">分割</span></label>
<div class="note">看板は板を立てた形状で、取付金具は裏側の壁へ向かって出ます。幅・奥行き（板厚）・高さは共通の面ハンドルまたは数値欄で編集できます。金具の長さとベベル幅は画面上のハンドルからも変更できます。</div>
</div>
<div id=roofP style="display:none"><h3>屋根</h3>
<label><span>軒の出</span><input type=number class=nv id=roofOverhang min=0 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>板の厚さ</span><input type=number class=nv id=roofThickness min=0.02 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>棟の向き</span><select id=roofRidgeAxis style="width:120px"><option value="x">幅方向（左右）</option><option value="y">奥行方向（前後）</option></select></label>
<label><span>低い側の高さ</span><input type=number class=nv id=roofLowZ min=0 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><button type=button id=roofFitHost class=primary>下の建物に合わせる</button></label>
<div class="note">幅・奥行き・高さは共通の面ハンドルまたは数値欄で編集できます。軒の出は外形の広がり、板の厚さは屋根板の厚みです。棟の向きは切妻屋根だけに効きます。</div>
</div>
<div id=rampP style="display:none"><h3>スロープ</h3>
<label><input type=checkbox id=rampHandrail> 手すりを付ける</label>
<label><span>手すりの高さ</span><input type=number class=nv id=rampRailHeight min=0.12 step=0.02 style="width:100px"><span class=un>m</span></label>
<div class="note">高さは奥側の立ち上がり、奥行きは勾配の長さです。手すりは左右の立ち上がりへ支柱付きで描きます。</div>
</div>
<div id=windowGridP style="display:none"><h3>窓グリッド</h3>
<label><span>行</span><input type=number class=nv id=windowRows min=0 max=20 step=1 style="width:100px"></label>
<label><span>列</span><input type=number class=nv id=windowCols min=0 max=20 step=1 style="width:100px"></label>
<label><span>窓の幅</span><input type=number class=nv id=windowW min=0 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>窓の高さ</span><input type=number class=nv id=windowH min=0 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>左右の余白</span><input type=number class=nv id=windowMarginX min=0 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>窓台の高さ</span><input type=number class=nv id=windowSill min=0 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>上部の余白</span><input type=number class=nv id=windowHead min=0 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>横の間隔</span><input type=number class=nv id=windowGapX min=0 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>縦の間隔</span><input type=number class=nv id=windowGapZ min=0 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><input type=checkbox id=windowBack> 裏側にも窓を描く</label>
<label><input type=checkbox id=windowSides> 左右の側面にも窓を描く</label>
<div class="note">行×列で窓を並べます。窓の幅・高さは各セルの中央へ置かれ、0にするとセルいっぱいまで自動で広がります。余白と間隔は壁の大きさに対する上限で自動的に収まります。同じ設定は直方体と建物にも使えます（行・列が0のときは窓を描きません）。</div>
</div>
<div id=beveledBoxP style="display:none"><h3>ベベル直方体</h3>
<label><span>ベベルオフセット</span><input type=number class=nv id=beveledBoxOffset min=0 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>ベベルセグメント数</span><input type=number class=nv id=beveledBoxSegments min=1 max=4 step=1 style="width:100px"><span class=un>分割</span></label>
<div class="note">四つの縦角を面取りします。オフセットは面取り幅、セグメント数は角の丸みを分割する数です。1は一枚面、4は4分割です。オフセットはキャンバス上のオレンジのベベルハンドルからも変更できます。幅・奥行き・高さは共通の面ハンドルまたは上の数値欄で編集できます。初期状態は面で、上面を押し出すと高さができます。</div>
</div>
<div id=assetEditorP style="display:none"><h3>アセット設定</h3><div id=assetEditorFields></div></div>
<div id=cornerCutP style="display:none"><h3>隅切り直方体</h3>
<label><span>隅切りオフセット</span><input type=number class=nv id=cornerCutOffset min=0 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><input type=checkbox id=cornerFacadeEnabled> ファサード看板をつける</label>
<div id=cornerFacadeControls style="display:none">
<label><input type=checkbox id=cornerFacadeSides> 隅切り両端の辺にも回す</label>
<label><span>看板の色</span><input type=color id=cornerFacadeColor value="#2f73bc"></label>
<label><span>看板の高さ</span><input type=number class=nv id=cornerFacadeHeight min=0.01 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>看板の張り出し</span><input type=number class=nv id=cornerFacadeProjection min=0.02 max=2 step=0.01 style="width:100px"><span class=un>m</span></label>
<div class="note">隅切り面に付く立体の看板です。両端の辺へ回すこともできます。文字・ロゴは含みません。</div></div>
<label><input type=checkbox id=cornerCutOpeningEnabled> 赤い隅切り面に開口</label>
<div id=cornerCutOpeningControls style="display:none">
<label><span>開口の幅</span><input type=number class=nv id=cornerCutOpeningW min=0.1 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>開口の高さ</span><input type=number class=nv id=cornerCutOpeningH min=0.1 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>開口の奥行き</span><input type=number class=nv id=cornerCutOpeningDepth min=0.025 step=0.05 style="width:100px"><span class=un>m</span></label>
<div class="note">開口は赤い斜め隅切り面を分割し、内部の左右側面・上面・奥壁を持つ形状として描画します。幅・高さ・奥行きは数値欄または画面上のハンドルで、3D・正面・横・上ビューから編集できます。</div>
</div>
<div class="note">赤い切り口のオレンジ菱形ハンドルを、3D・正面・横・上ビューでドラッグして編集できます。</div>
</div>
<div id=recessedStackedP style="display:none"><h3>凹窓階層建物</h3>
<label><button id=recessedAlign class="primary">上方向へ整列</button></label>
<label><span>階数</span><input type=number class=nv id=recessedFloorCount min=1 max=30 step=1 style="width:100px"></label>
<label><span>階高（上階）</span><input type=number class=nv id=recessedFloorHeight min=0.5 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>1階の高さ</span><input type=number class=nv id=recessedFirstFloorExtra min=0.5 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>階接合部の高さ</span><input type=number class=nv id=recessedFloorGap min=0 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>前右角のベベル</span><input type=number class=nv id=recessedCornerBevel min=0 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>ベベル分割数</span><input type=number class=nv id=recessedCornerBevelSegments min=1 max=8 step=1 style="width:100px"><span class=un>分割</span></label>
<label><span>窓枚数（各階）</span><input type=number class=nv id=recessedWindowCount min=1 max=12 step=1 style="width:100px"><span class=un>枚</span></label>
<label><span>窓端の壁幅（左手前）</span><input type=number class=nv id=recessedWindowMarginLeft min=0 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>窓の凹み奥行き</span><input type=number class=nv id=recessedWindowDepth min=0.025 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>窓端の壁幅（右奥）</span><input type=number class=nv id=recessedWindowMarginEnd min=0 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><input type=checkbox id=recessedSideWindows checked> 右側面にも窓を作る</label>
<div class="note">各階に同じ窓帯を反復します。1Fだけ追加高さを持たせ、前右角を初期4分割のベベルにして、正面から右側面まで凹みを連続させます。窓帯は階と階の接合部に配置され、接合部の高さと窓の高さは常に同じです。窓帯の幅は建物全体の寸法に追従し、編集するのは両端の壁幅（左手前・右奥）だけです。画面上の「階高」「1階の高さ」「階接合部の高さ」「端の壁幅」ハンドルは、3D・正面・横・上ビューのどこからでもドラッグできます。</div>
</div>
<div id=stackedP style="display:none"><h3 id=stackedPanelTitle>縁付き階層建物</h3>
<label><span>階数</span><input type=number class=nv id=stackFloorCount min=1 max=30 step=1 style="width:100px"></label>
<label><input type=checkbox id=stackIndividualEdit> 各階を個別編集（チェック時のみ）</label>
<label><input type=checkbox id=stackOpening> 1Fに開口をつける</label>
<div id=stackOpeningControls style="display:none">
<label><span>1F開口の幅</span><input type=number class=nv id=stackOpeningW min=0.1 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>1F開口の高さ</span><input type=number class=nv id=stackOpeningH min=0.1 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span id=stackOpeningBackLabel>1F開口の奥面</span><input type=number class=nv id=stackOpeningBack step=0.05 style="width:100px"><span class=un>m</span></label>
<div id=stackOpeningNote class="note">開口は1Fだけに作成します。開口幅・高さ・奥面は設定欄または画面上のハンドルから編集できます。奥面は建物中心からの位置です。</div>
</div>
<div id=stackCornerControls style="display:none">
<label><span>隅切りオフセット</span><input type=number class=nv id=stackCornerOffset min=0.05 step=0.05 style="width:100px"><span class=un>m</span></label>
<div class="note">各階の同じ角を隅切りします。赤いハンドルでも隅切り幅を変えられます。1Fの開口は隅切り面に作ります。</div></div>
<label><span>階間</span><input type=number class=nv id=stackFloorGap min=0 step=0.01 style="width:100px"><span class=un>m</span></label>
<div id=stackBevelControls style="display:none">
<label><span>ベベルオフセット</span><input type=number class=nv id=stackBevelOffset min=0 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>ベベルセグメント数</span><input type=number class=nv id=stackBevelSegments min=1 max=4 step=1 style="width:100px"><span class=un>分割</span></label>
<div class="note">通常モードでは1Fのベベル設定を全階へ連動します。個別編集を有効にすると、選択中の階だけを変更できます。</div>
</div>
<label><button id=stackAlign class="primary">上方向へ整列</button><button id=stackCopyFirst>1F寸法をコピー（看板はなし）</button><button id=stackCopyFirstWithSigns>1F寸法をコピー（看板も）</button></label>
<div class="note">通常は1Fのハンドルと数値だけを編集し、幅・奥行・高さ・縁が全階へ自動連動します。1F寸法コピーは建物だけ、または看板も含めて選べます。チェックを入れると、選択した階を個別に編集できます。</div>
<div id=stackFloorRows></div>
<div class="note">正面・横・上ビューでは、選択中の階にオレンジの面ハンドルが表示されます。1階の幅・奥行き・高さ・縁を変更すると、同期ONの間は全階へ反映されます。下側の縁は全階で作らず、各階の上側だけに配置します。</div>
</div>
<label><button id=obExtrude>押し出しを有効</button><button id=obGnd>地面につける</button><button id=obDup>複製</button><button id=obDel>消去</button><button id=obOff>選択解除</button></label>
<label><button id=objectInfoCopy aria-label="JSONコピー" title="選択中オブジェクトの定義JSONをコピー" disabled>JSONコピー</button><button id=objectInfoSave aria-label="JSON保存" title="選択中オブジェクトの定義JSONを保存" disabled>JSON保存</button></label>
<div class="note">JSON保存は寸法・位置・向き・アセット固有設定をテキストで書き出します。後から線画化できる定義形式です。</div>
<div class="note">位置は底面の中心です。Yは地面からの高さ（0で地面につく）、X・Zは床の方向（VP1・VP2側）です</div>
</div>
<h3>書き出し範囲（上の「範囲」ボタン）</h3>
<label><input type=checkbox id=zf checked> ズーム中は画面に見えている範囲だけ保存</label>
<label><button id=crF>線画に合わせる</button><button id=crC>範囲を解除</button></label>
<div class="note">範囲を指定すると、PNG保存・コピーはその範囲だけ切り取られます（補助線・線画とも）</div>
<h3>消しゴム（上の「消しゴム」ボタンでON/OFF）</h3>
<label><span>方式</span><select id=em><option value=part>部分消し<option value=all>線ごと消す</select></label>
${R("ew", "大きさ", 4, 150, 1, "px")}
<h3>保存</h3>
<div class="note">上の「保存」で今の状態（視点・設定・線画・写真）をファイルに保存し、「開く」で続きから再開できます。<br>このブラウザには3秒ごとに自動保存され、次に開いたとき自動で復元されます。</div>
<label><button id=rst>自動保存を消して初期化</button></label>
<h3>読み取り</h3><div id=info class="note"></div>`;

// ===== 3. 見出しごとに折りたためるようにする（開閉の状態は覚える） =====
(function () {
    const side = $("side"),
        kids = [...side.children],
        closedDef = [
            "グリッドの種類",
            "カメラ",
            "補助線",
            "ペン",
            "編集・スナップ",
            "書き出し範囲",
            "消しゴム",
            "保存",
            "読み取り",
        ];
    let st = {},
        det = null;
    try {
        if (localStorage.getItem("city-grid-ui-compact-v1") !== "1") {
            localStorage.removeItem("pgrid-sec");
            localStorage.setItem("city-grid-ui-compact-v1", "1");
        }
        st = JSON.parse(localStorage.getItem("pgrid-sec") || "{}");
    } catch (e) {}
    side.innerHTML =
        '<div class="secbar"><button id=secC>すべて閉じる</button><button id=secO>すべて開く</button></div>';
    kids.forEach((k) => {
        if (k.tagName === "H3") {
            const name = k.textContent.replace(/（.*）/, ""),
                d = document.createElement("details"),
                sm = document.createElement("summary"); // かっこ書きは除いた名前で状態を覚える
            d.open = name in st ? st[name] : !closedDef.includes(name);
            sm.textContent = k.textContent;
            d.appendChild(sm);
            side.appendChild(d);
            d.ontoggle = () => {
                st[name] = d.open;
                try {
                    localStorage.setItem("pgrid-sec", JSON.stringify(st));
                } catch (e) {}
            };
            det = d;
        } else if (det) det.appendChild(k);
        else side.appendChild(k);
    });
    $("secC").onclick = () => side.querySelectorAll("details").forEach((d) => (d.open = false));
    $("secO").onclick = () => side.querySelectorAll("details").forEach((d) => (d.open = true));
})();
// ===== 4. 値の同期 =====
// 画面上の入力欄からPへ値を反映し、表示を更新する共通入口。
function sync() {
    for (const k in P) {
        const el = $("v_" + k);
        if (el && document.activeElement !== el && typeof P[k] === "number") el.value = +(+P[k]).toFixed(3);
        const sl = $(k);
        if (sl && document.activeElement !== sl && typeof P[k] === "number") sl.value = P[k];
    }
    syncSurfaceToggle();
    if (typeof syncExportLineWidth === "function") syncExportLineWidth();
    if (typeof mode !== "undefined" && mode === "view") window.CityCanvasControls?.sync?.();
} // 入力中の欄は上書きしない
function syncSurfaceToggle() {
    const b = $("surfaceToggle");
    if (!b) return;
    b.textContent = P.surfaceMode ? "面 ON" : "面 OFF";
    b.classList.toggle("on", !!P.surfaceMode);
    b.title = P.surfaceMode
        ? "画像全体：面表示ON／背面処理ON（クリックでOFF）"
        : "画像全体：面表示OFF（クリックで面表示＋背面処理）";
}
$("surfaceToggle").onclick = () => {
    P.surfaceMode = !P.surfaceMode;
    syncSurfaceToggle();
    render();
};
function leaveOrthView(changedKey) {
    if (standardApplying) return;
    // 間取り中は左パネルのカメラ値を変更しても正投影を解除しない。
    // 0=3Dで現在の魚眼画角・レンズ・位置・高さ・回転・傾きをそのまま引き継ぐ。
    if (window.cityFloorPlanActive) return;
    if (orthPlane() === "top" && changedKey !== "pitch") {
        P.pitch = -75;
        const pitchInput = $("pitch");
        if (pitchInput) pitchInput.value = -75;
    }
    orthView = null;
}
function setP(k, v, force = false) {
    // カメラロック中は視点の値を書き換えない（左パネル・標準ビュー・矢印キーなど共通）。
    // force=true は保存データの読み込みなど、内部でどうしても必要なときだけ使う。
    if (!force && cameraLock && CAMERA_KEYS.has(k)) {
        if (typeof window.flashHint === "function") window.flashHint("カメラ固定中：視点は動きません（L で解除）");
        return false;
    }
    leaveOrthView(k);
    P[k] = v;
    const input = $(k);
    if (input) input.value = v;
    return true;
}
for (const k in P) {
    const el = $(k);
    if (!el) continue;
    el.value = P[k];
    el.oninput = () => {
        if (cameraLock && CAMERA_KEYS.has(k)) {
            el.value = P[k]; // つまみを元の位置へ戻す
            if (typeof window.flashHint === "function") window.flashHint("カメラ固定中：視点は動きません（L で解除）");
            return;
        }
        leaveOrthView(k);
        P[k] = +el.value;
        sync();
        render();
    };
    const nv = $("v_" + k); // 数値の直接入力（スライダーの範囲内に収める。本数だけは3000まで）
    nv.oninput = () => {
        let v = parseFloat(nv.value);
        if (isNaN(v)) return;
        if (cameraLock && CAMERA_KEYS.has(k)) {
            nv.value = +P[k].toFixed(3);
            if (typeof window.flashHint === "function") window.flashHint("カメラ固定中：視点は動きません（L で解除）");
            return;
        }
        leaveOrthView(k);
        v = Math.max(+el.min, Math.min(k === "n" ? 3000 : +el.max, v));
        P[k] = v;
        if (v >= +el.min && v <= +el.max) el.value = v;
        render();
    };
    nv.onchange = () => {
        nv.value = +P[k].toFixed(3);
    };
}
document.querySelectorAll("[data-i]").forEach(
    (el) =>
        (el.onchange = () => {
            show[el.dataset.i] = el.checked;
            render();
        }),
);
["gon", "hzl", "bgw", "snap", "bin", "gg"].forEach((k) => ($(k).onchange = () => render()));
$("ar").onchange = () => {
    H = Math.round(W / +$("ar").value);
    cv.width = W;
    cv.height = H;
    fit();
};

// ===== 5. 画面サイズに合わせて表示 =====
function fitCanvasDisplay() {
    const st = $("stage"),
        s = Math.min((st.clientWidth - 12) / W, (st.clientHeight - 12) / H);
    cv.style.width = W * s + "px";
    cv.style.height = H * s + "px";
}
function fit() {
    fitCanvasDisplay();
    render();
}
addEventListener("resize", fit);
// 上部の編集バーや下部の棚の開閉でもキャンバスを新しい領域へ収める。
if (typeof ResizeObserver !== "undefined") {
    let fitQueued=false;
    new ResizeObserver(()=>{if(!fitQueued){fitQueued=true;requestAnimationFrame(()=>{fitQueued=false;fit();});}}).observe($("stage"));
}

// ===== 6. 消失点の計算（カメラ→VP） =====
// 軸: 0=X方向, 1=Z方向, 2=垂直。VPが無限遠なら dir(平行線の向き) を返す
// 通常の透視投影で、現在のカメラから消失点と補助軸を計算する。
function calc() {
    const f = (W * P.lens) / 36,
        th = (P.yaw * Math.PI) / 180,
        ph = (P.pitch * Math.PI) / 180,
        cx = W / 2,
        cy = (H * P.hz) / 100;
    AX = [
        [1, 0, 0],
        [0, 0, 1],
        [0, 1, 0],
    ].map((v) => {
        const x1 = v[0] * Math.cos(th) + v[2] * Math.sin(th),
            z1 = -v[0] * Math.sin(th) + v[2] * Math.cos(th);
        const y2 = v[1] * Math.cos(ph) - z1 * Math.sin(ph),
            z2 = v[1] * Math.sin(ph) + z1 * Math.cos(ph);
        if (Math.abs(z2) < 2e-3) {
            const l = Math.hypot(x1, y2) || 1;
            return { dir: { x: x1 / l, y: -y2 / l } };
        }
        return { vp: { x: cx + (f * x1) / z2, y: cy - (f * y2) / z2 } };
    });
    AX.f = f;
    AX.hy = cy + f * Math.tan(ph); // hy=地平線のy
}
// 点aでの軸iの向き（単位ベクトル）
function dirAt(a, i) {
    if (T === "f") return dirF(a, i);
    const A = AX[i];
    if (A.dir) return A.dir;
    const dx = A.vp.x - a.x,
        dy = A.vp.y - a.y,
        l = Math.hypot(dx, dy);
    return l < 1e-6 ? { x: 1, y: 0 } : { x: dx / l, y: dy / l };
}

// ===== 7. 魚眼（5点・6点）：視線の球面上で考える。直線は「大円」＝画面では曲線になる =====
const V = {
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    crs: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    nrm: (a) => {
        const l = Math.hypot(a[0], a[1], a[2]) || 1;
        return [a[0] / l, a[1] / l, a[2] / l];
    },
    add: (a, b, s = 1, t = 1) => [a[0] * s + b[0] * t, a[1] * s + b[1] * t, a[2] * s + b[2] * t],
};
const DG = Math.PI / 180;
const camPos = () => [P.cx, P.ch - 1, P.cz],
    CO = () => [-P.cx, 1 - P.ch, -P.cz],
    sigNow = () => P.ch + "," + P.cx + "," + P.cz + "," + (orthView || "3d"); // 3D形状生成が依存するカメラ位置＋正投影種別
// ワールドのベクトル→カメラ座標（水平回転→上下→ロール）
// カメラの回転（ワールド→視点）を行列にして使い回す。
// 以前は点1つごとに sin/cos を6回呼んでいたため、線や面の点数が多いほど
// 三角関数の呼び出しだけで時間を使っていた（1フレームで数万回）。
// 行列はヨー・ピッチ・ロール・視点の種類が変わったときだけ作り直す。
let CAMM = null,
    CAMKEY = null;
function camMatrix() {
    const y = P.yaw,
        p = P.pitch,
        r = T === "f" ? P.roll : 0;
    if (CAMKEY && CAMKEY[0] === y && CAMKEY[1] === p && CAMKEY[2] === r && CAMKEY[3] === T) return CAMM;
    const th = y * DG,
        ph = p * DG,
        ro = r * DG,
        ct = Math.cos(th),
        st = Math.sin(th),
        cp = Math.cos(ph),
        sp = Math.sin(ph),
        cr = Math.cos(ro),
        sr = Math.sin(ro);
    // ヨー → ピッチ → ロールの順（元の式と同じ）。3x3 を1本の配列で持つ。
    CAMM = [
        cr * ct - sr * sp * st,
        -sr * cp,
        cr * st + sr * sp * ct,
        sr * ct + cr * sp * st,
        cr * cp,
        sr * st - cr * sp * ct,
        -cp * st,
        sp,
        cp * ct,
    ];
    CAMKEY = [y, p, r, T];
    return CAMM;
}
function cam(v) {
    const m = camMatrix(),
        x = v[0],
        y = v[1],
        z = v[2];
    return [
        m[0] * x + m[1] * y + m[2] * z,
        m[3] * x + m[4] * y + m[5] * z,
        m[6] * x + m[7] * y + m[8] * z,
    ];
}
// 魚眼投影（等距離射影）：単位ベクトル→画面。okは画角内かどうか
function pf(v) {
    const half = (P.fov * DG) / 2,
        th = Math.acos(Math.max(-1, Math.min(1, v[2]))),
        r = ((th / half) * H) / 2,
        rho = Math.hypot(v[0], v[1]);
    return {
        x: W / 2 + (rho < 1e-9 ? 0 : (r * v[0]) / rho),
        y: H / 2 - (rho < 1e-9 ? 0 : (r * v[1]) / rho),
        ok: th <= half + 1e-9,
    };
}
// 画面の点→視線ベクトル（pfの逆）
function bf(p) {
    const half = (P.fov * DG) / 2,
        dx = p.x - W / 2,
        dy = -(p.y - H / 2),
        r = Math.hypot(dx, dy),
        th = Math.min((r / (H / 2)) * half, Math.PI);
    return r < 1e-9 ? [0, 0, 1] : [(Math.sin(th) * dx) / r, (Math.sin(th) * dy) / r, Math.cos(th)];
}
function calcF() {
    AXC = [
        [1, 0, 0],
        [0, 0, 1],
        [0, 1, 0],
    ].map(cam);
} // 軸0=X,1=Z,2=垂直(Y)
// 大円を現在のパスに追加（cos t・a + sin t・b）。画角の外は途切れさせる
function circ(c, a, b) {
    let on = false;
    for (let j = 0; j <= 240; j++) {
        const t = (j / 240) * 2 * Math.PI,
            q = pf(V.add(a, b, Math.cos(t), Math.sin(t)));
        if (!q.ok) {
            on = false;
            continue;
        }
        on ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y);
        on = true;
    }
}
// 補助線：各軸(±VP)を通る大円を本数ぶん回転させて描く
function guidesF(c) {
    const col = ["#e8743d", "#2fb5a5", "#4a7be8"];
    AXC.forEach((d, i) => {
        if (!show[i]) return;
        c.strokeStyle = col[i];
        c.globalAlpha = P.ga;
        c.lineWidth = P.gw;
        c.beginPath();
        const e1 = V.nrm(V.crs(Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], d)),
            e2 = V.crs(d, e1);
        for (let k = 0; k < P.n; k++) {
            const f = (Math.PI * k) / P.n;
            circ(c, d, V.add(e1, e2, Math.cos(f), Math.sin(f)));
        }
        c.stroke();
    });
    c.globalAlpha = 1;
}
// 点aでの軸iの向き（画面上の接線）
function dirF(a, i) {
    const v0 = bf(a),
        d = AXC[i],
        t = V.add(d, v0, 1, -V.dot(d, v0));
    if (Math.hypot(t[0], t[1], t[2]) < 1e-6) return { x: 1, y: 0 };
    const q = pf(V.nrm(V.add(v0, V.nrm(t), 1, 0.01))),
        b = pf(v0),
        dx = q.x - b.x,
        dy = q.y - b.y,
        l = Math.hypot(dx, dy);
    return l < 1e-9 ? { x: 1, y: 0 } : { x: dx / l, y: dy / l };
}
// 定規：開始点aと軸iが作る大円の上に、ペンの位置pを投影して曲線にする
function curveF(a, p, i) {
    const v0 = bf(a),
        d = AXC[i],
        n0 = V.crs(v0, d);
    if (Math.hypot(n0[0], n0[1], n0[2]) < 1e-6) return [a];
    const n = V.nrm(n0),
        vp = bf(p),
        w = V.add(vp, n, 1, -V.dot(vp, n));
    if (Math.hypot(w[0], w[1], w[2]) < 1e-9) return [a];
    const v1 = V.nrm(w),
        tn = V.crs(n, v0);
    let al = Math.atan2(V.dot(v1, tn), V.dot(v1, v0));
    if (cur.al != null) al += 2 * Math.PI * Math.round((cur.al - al) / (2 * Math.PI));
    cur.al = al; // 角度の飛びを防ぐ
    const out = [a],
        N = Math.max(2, Math.ceil(Math.abs(al) / 0.02));
    for (let j = 1; j <= N; j++) {
        const t = (al * j) / N,
            q = pf(V.add(v0, tn, Math.cos(t), Math.sin(t)));
        if (!q.ok) break;
        out.push(q);
    }
    return out;
}
// 魚眼の円とVP目印（±それぞれ。画角内のものだけ）
function markF(c) {
    c.strokeStyle = "#888";
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(W / 2, H / 2, H / 2, 0, 7);
    c.stroke();
    const col = ["#e8743d", "#2fb5a5", "#4a7be8"];
    let n = 0;
    AXC.forEach((d, i) => {
        if (!show[i]) return;
        [1, -1].forEach((s) => {
            const q = pf([d[0] * s, d[1] * s, d[2] * s]);
            if (!q.ok) return;
            n++;
            c.fillStyle = col[i];
            c.beginPath();
            c.arc(q.x, q.y, 7, 0, 7);
            c.fill();
            c.font = "bold 18px system-ui";
            c.fillText("VP" + (i + 1) + (s < 0 ? "'" : ""), q.x + 10, q.y - 10);
        });
    });
    $("info").innerHTML = `魚眼 画角 ${P.fov}°<br>表示中のVP ${n}個（軸ごとに＋と−）<br>円の半径＝画角の半分`;
}

// ===== 8. 線画の保存と再投影：画面の点→ワールドの向き(単位ベクトル)で持つので、視点を変えても追従する =====
// カメラ座標→ワールド（camの逆変換）
// 視線の逆変換は魚眼の隠面判定で数万回呼ばれる。同じカメラ角では三角関数を共有する。
let wldAngles = null, wldTrig = null;
function wld(v) {
    const yaw = P.yaw, pitch = P.pitch, roll = T === "f" ? P.roll : 0;
    if (!wldAngles || !Object.is(wldAngles[0], yaw) || !Object.is(wldAngles[1], pitch) || !Object.is(wldAngles[2], roll)) {
        const th = yaw * DG, ph = pitch * DG, ro = roll * DG;
        wldAngles = [yaw, pitch, roll];
        wldTrig = [Math.cos(th), Math.sin(th), Math.cos(ph), Math.sin(ph), Math.cos(ro), Math.sin(ro)];
    }
    const ct=wldTrig[0], st=wldTrig[1], cp=wldTrig[2], sp=wldTrig[3], cr=wldTrig[4], sr=wldTrig[5];
    const x1 = v[0] * cr + v[1] * sr,
        y2 = -v[0] * sr + v[1] * cr;
    const y1 = y2 * cp + v[2] * sp,
        z1 = -y2 * sp + v[2] * cp;
    return [x1 * ct - z1 * st, y1, x1 * st + z1 * ct];
}
// Blender風の正投影ビュー。正面=X/Y、真横=Z/Y、真上=X/Zを画面へ置く。
// depthはカメラから遠いほど大きくなり、書き出し時の隠れ線判定にも使う。
// 互換の side は「右」から見る正投影。反対側は視線と画面左右を反転。
function orthPlane() {
    return orthView === "top" || orthView === "bottom" ? "top" :
        orthView === "side" || orthView === "right" || orthView === "left" ? "side" :
        orthView === "front" || orthView === "back" ? "front" : null;
}
function orthBasis() {
    if (orthView === "side" || orthView === "right") return { right: [0, 0, 1], up: [0, 1, 0], depth: [-1, 0, 0] };
    if (orthView === "left") return { right: [0, 0, -1], up: [0, 1, 0], depth: [1, 0, 0] };
    if (orthView === "top") return { right: [1, 0, 0], up: [0, 0, 1], depth: [0, -1, 0] };
    if (orthView === "bottom") return { right: [1, 0, 0], up: [0, 0, -1], depth: [0, 1, 0] };
    if (orthView === "back") return { right: [-1, 0, 0], up: [0, 1, 0], depth: [0, 0, -1] };
    return { right: [1, 0, 0], up: [0, 1, 0], depth: [0, 0, 1] };
}
const ZERO2 = [0, 0];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// 間取りモードだけ、オブジェクト群を画面中央へ自動フィットする。
// 通常の9=真上は従来どおり原点中心の正投影を維持する。
// 正投影の「表示中心」と「倍率」。以前は間取りモードのときだけ自動フィットの値を使い、
// それ以外（3Dから正面・横・上へ切り替えたとき）は原点＝カメラ位置を中心にしていた。
// そのため、カメラから離れた所に置いたオブジェクトが画面の外へ出て、
// 「正面・横・上が真っ白／別の絵」になっていた（実測：線の画素がシーンの1/50）。
// いまは正面・横・上へ切り替えるたびにシーン全体が入るよう中心と倍率を作り直す。
const orthPlanCenter = () => (Array.isArray(window.cityFloorPlanCenter) ? window.cityFloorPlanCenter : [0, 0]);
// 正投影のときだけ自動フィットの倍率を使う。3D（透視）のときは今までどおりの値。
// 透視の側でも orthScale() を参照している箇所があり、値を変えるとハンドルの間隔が
// 変わって見た目が変わってしまうため、条件を明示しておく。
const orthScale = () =>
    orthView && Number.isFinite(Number(window.cityFloorPlanScale)) && Number(window.cityFloorPlanScale) > 0
        ? Number(window.cityFloorPlanScale)
        : Math.min(W, H) / 7.2;
// 正面／横／上の間取りビュー専用の正投影。
// right / up / depth の基底を変えるだけで3方向を同じ処理で描画する。
//
// 投影の係数（基底・倍率・画面上の原点）は、ビュー・倍率・中心・カメラが
// 変わらない間ずっと同じ。以前は点1つごとに orthBasis() / orthScale() /
// orthPlanCenter() を呼び、配列を3つずつ作っていたので、線の点数が多いほど
// 無駄が増えていた。ここでは署名が同じ間だけ計算結果を使い回す。
let orthSetupKey = null,
    orthSetupVal = null;
function orthSetup() {
    const sc = orthScale(),
        active = true, // 自動フィットの中心・倍率は間取りモード以外でも使う
        pc = orthPlanCenter();
    // 点ごとに文字列を連結せず、実際の入力だけ比較する。
    const k = orthSetupKey;
    if (orthSetupVal && k && k[0] === orthView && k[1] === sc && k[2] === W && k[3] === H &&
        k[4] === pc[0] && k[5] === pc[1] && k[6] === P.cx && k[7] === P.cz && k[8] === P.ch) return orthSetupVal;
    const b = orthBasis();
    // scrW() は先にカメラ原点へ移すため、正投影では表示軸だけワールド原点へ戻す。
    const camera = [P.cx, P.ch - 1, P.cz],
        sx = active ? dot3(camera, b.right) : 0,
        sy = active ? dot3(camera, b.up) : 0;
    // x = ax + dot(v,right)*sc / y = ay - dot(v,up)*sc
    orthSetupVal = {
        right: b.right,
        up: b.up,
        depth: b.depth,
        sc,
        ax: W / 2 + (sx - pc[0]) * sc,
        ay: H / 2 - (sy - pc[1]) * sc,
    };
    orthSetupKey = [orthView, sc, W, H, pc[0], pc[1], P.cx, P.cz, P.ch];
    return orthSetupVal;
}
function orthPoint(v) {
    const s = orthSetup(),
        rx = v[0] * s.right[0] + v[1] * s.right[1] + v[2] * s.right[2],
        ry = v[0] * s.up[0] + v[1] * s.up[1] + v[2] * s.up[2];
    return {
        x: s.ax + rx * s.sc,
        y: s.ay - ry * s.sc,
        depth: v[0] * s.depth[0] + v[1] * s.depth[1] + v[2] * s.depth[2],
        ok: true,
    };
}
// ワールドの向き→画面（今のグリッド種類の投影）。okがfalseなら画角の外/カメラの後ろ
function scr(v) {
    if (orthView) return orthPoint(v);
    const q = cam(v);
    if (T === "f") return pf(q);
    if (q[2] <= 0.02) return { ok: false };
    const f = (W * P.lens) / 36;
    return { x: W / 2 + (f * q[0]) / q[2], y: (H * P.hz) / 100 - (f * q[1]) / q[2], ok: true };
}
// 画面の点→ワールドの向き
function unscr(p) {
    if (orthView) {
        // 正投影の「画面の点 → 向き」。表示中心（自動フィット）を基準に戻す。
        // 以前は画面中央 (W/2, H/2) 基準だったため、フィットで中心がずれると
        // クリックした場所と実際に選ばれる場所が食い違っていた。
        const b = orthBasis(),
            st = orthSetup(),
            sc = Math.max(1e-6, st.sc),
            x = (p.x - st.ax) / sc,
            y = -(p.y - st.ay) / sc;
        return V.nrm([
            b.right[0] * x + b.up[0] * y + b.depth[0],
            b.right[1] * x + b.up[1] * y + b.depth[1],
            b.right[2] * x + b.up[2] * y + b.depth[2],
        ]);
    }
    if (T === "f") return wld(bf(p));
    const f = (W * P.lens) / 36;
    return wld(V.nrm([(p.x - W / 2) / f, -(p.y - (H * P.hz) / 100) / f, 1]));
}
// 正投影（正面・横・上）で、画面の点 p に対応するワールド座標。
// 平行投影なので奥行き（視線方向）の座標は画面から決まらない。
// base（省略時はカメラ位置）を通り、視線に垂直な面上の点を返す。
// 透視の unscr()（カメラから出る向き）に相当するもので、
// 「クリックした場所へアセットを置く」「ドラッグで面を動かす」に使う。
function orthWorldAt(p, base) {
    const st = orthSetup(),
        b = orthBasis(),
        sc = Math.max(1e-6, st.sc),
        c = Array.isArray(base) && base.length === 3 ? base : camPos(),
        rel = [c[0] - camPos()[0], c[1] - camPos()[1], c[2] - camPos()[2]],
        u = (p.x - st.ax) / sc - dot3(rel, b.right),
        v = -(p.y - st.ay) / sc - dot3(rel, b.up);
    return [
        c[0] + b.right[0] * u + b.up[0] * v,
        c[1] + b.right[1] * u + b.up[1] * v,
        c[2] + b.right[2] * u + b.up[2] * v,
    ];
}
// 画面の点 p を、面（k座標=d）の上のワールド座標へ移す。
// 透視はカメラからの視線と面の交点。正投影は画面の2軸だけで位置が決まるので、
// 面の軸の値だけを d に置き換える（＝どのビューでも同じ場所を掴める）。
function pickOnPlane(p, k, d, c) {
    if (!orthView) return hit3(unscr(p), k, d, c || camPos());
    const q = orthWorldAt(p, c);
    q[k] = d;
    return q.every(Number.isFinite) ? q : null;
}
// 保存済みの線を今の視点で描く（点の間は球面上で補間するので魚眼でも曲線になる）
// d3=trueの線は3D座標の点（図形）、そうでなければ視線の向き（ペンで描いた線）
function effectiveLineWidth(s) {
    const base = Number(s && s.w);
    return Math.max(0.1, ((Number.isFinite(base) ? base : MASTER_W) * (Number(P.pw) || MASTER_W)) / MASTER_W);
}
function strokeW(c, s) {
    // ベベルの縦線は線だけ表示では「角ごとに1本」だけ描く（全部描くと角が黒く潰れる）。
    if (s.seam !== undefined && s.seam !== null && !s.seamApex) return;
    c.strokeStyle = s.c;
    // 二値化する層では、線が最小限の太さを持つようにする（lineLayer が設定する）。
    c.lineWidth = typeof layerLineWidth === "function" ? layerLineWidth(s) : effectiveLineWidth(s);
    c.lineCap = c.lineJoin = "round";
    c.beginPath();
    let on = false;
    const co = s.d3 ? CO() : null,
        rl = (v) => (co ? V.add(v, co) : v); // 3D点はカメラからの相対位置にする
    const put = (v) => {
        const q = scr3(rl(v));
        if (!q.ok) {
            on = false;
            return;
        }
        on ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y);
        on = true;
    };
    // 正投影ビューでは投影が線形なので、点の間を球面上で補間する必要がない。
    // （以前は全ビューで角度分割していたため、1本の線が最大200点に増えていた）
    const subdivide = !orthView;
    // 直前の点の正規化ベクトルを次の区間で使い回す（以前は区間ごとに2点とも正規化し直していた）。
    let pna = null;
    s.p.forEach((v, i) => {
        const pnv = subdivide ? V.nrm(rl(v)) : null;
        // 同じ線分を2回描かない（印は genShape が付けている）。
        // 間引いた区間は線を切るだけなので、見た目は1本ぶんになる。
        if (i && s.dup && s.dup[i - 1]) on = false;
        else if (i && subdivide && pna) {
            const a = s.p[i - 1],
                n = Math.ceil(Math.acos(Math.max(-1, Math.min(1, V.dot(pna, pnv)))) / 0.03);
            for (let j = 1; j < n; j++) put(co ? V.add(a, v, 1 - j / n, j / n) : V.nrm(V.add(a, v, 1 - j / n, j / n)));
        }
        put(v);
        pna = pnv;
    });
    c.stroke();
}
const AXW = [
    [1, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
]; // ワールドのX・Z・垂直(Y)の向き（VP1・VP2・垂直）
function drawCur(x) {
    if (!cur) return;
    if (cur.pv) {
        if (cur.pv.p.length > 1) strokeW(x, cur.pv);
    } else if (cur.p.length > 1) stroke(x, cur);
} // 描いている途中の線
const sp = (s, v) => scr3(s.d3 ? V.add(v, CO()) : v); // 線の点の画面位置

// ===== 9. 図形：パースに沿った 長方形・円・立方体・円柱（3Dで作って視線の向きの線にする） =====
const PL = { 0: [2, 1], 1: [0, 2], 2: [0, 1] }; // 面の法線k → 面内の2軸 (0=X,1=Y,2=Z)
// 複数の定義を「結合」した複合オブジェクト用の座標変換。
// 子パーツは元の定義を保持し、複合オブジェクトのtx/ty/tzだけを動かす。
// ===== 9b. パーツごとの「ワールド上下軸まわりの回転（ヨー）」 =====
// 図形の定義は「面(k)＋面内の回転(rot)＋押し出し(h)」でできているため、
// 縦の面（k=0/2）は rot でヨーを表せない（rot は面の中の回転になってしまう）。
// そこで、どの面でも使える“外側の回転”を spin として持たせる。
//   spin      … ワールドY軸まわりの角度（度）
//   spinPivot … その回転中心（ワールド座標 [x,y,z]）
// 結合体を回すとき、全パーツが同じ spinPivot を共有すれば剛体として回る。
const wrapSpin = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
function partSpinDeg(o) {
    const a = Number(o?.spin);
    return Number.isFinite(a) && a % 360 !== 0 ? a : 0;
}
// 1点 v にスピン（ヨー）を掛ける。
function applyPartSpin(o, v) {
    const d = partSpinDeg(o),
        p = o?.spinPivot;
    if (!d || !p || !Number.isFinite(p[0]) || !Number.isFinite(p[2])) return v;
    const a = d * DG,
        cs = Math.cos(a),
        sn = Math.sin(a),
        dx = v[0] - p[0],
        dz = v[2] - p[2];
    return [p[0] + dx * cs + dz * sn, v[1], p[2] - dx * sn + dz * cs];
}
// ヨーの合成。いまスピン(s度・中心Ps)で回っているパーツへ、
// さらに deg度・中心P の回転を掛けると、結果は「(s+deg)度・中心P2」の
// 1回転で表せる。P2 は
//     P2 − R·P2 = P + Rdeg(Ps − P) − R·Ps      （R = s+deg の回転行列）
// を解いて求める（2x2。合計角が0/360のときは半径0の回転なので P を使う）。
function spinComposePivot(Ps, spinS, P, deg) {
    const u = (spinS + deg) * DG,
        cu = Math.cos(u),
        su = Math.sin(u),
        det = (1 - cu) * (1 - cu) + su * su;
    if (Math.abs(det) < 1e-9) return [P[0], Ps[1], P[2]];
    const dd = deg * DG,
        cd = Math.cos(dd),
        sd = Math.sin(dd),
        px = Ps[0] - P[0],
        pz = Ps[2] - P[2],
        // P + Rdeg(Ps − P) − R·Ps
        bx = P[0] + (px * cd + pz * sd) - (Ps[0] * cu + Ps[2] * su),
        bz = P[2] - (px * sd - pz * cd) - (-Ps[0] * su + Ps[2] * cu);
    return [((1 - cu) * bx + su * bz) / det, Ps[1], (-su * bx + (1 - cu) * bz) / det];
}
// 水平面(k=1)のスピンを定義そのものへ焼き込む（rot・中心へ移す）。
// k=1 は面内の2軸がワールドのX・Zなので、ヨーは面内回転として表せる。
function bakePartSpin(o) {
    const s = partSpinDeg(o);
    if (!s || Number(o?.k) !== 1 || o?.wallSideBasis) return o;
    const P = o.spinPivot || [0, 0, 0],
        q = { ...o, off: [...(o.off || [0, 0, 0])] },
        a = s * DG,
        c = Math.cos(a),
        n = Math.sin(a),
        cx = (Number(q.ca) || 0) + q.off[0],
        cz = (Number(q.cb) || 0) + q.off[2],
        dx = cx - P[0],
        dz = cz - P[2];
    q.ca = P[0] + dx * c + dz * n - q.off[0];
    q.cb = P[2] - dx * n + dz * c - q.off[2];
    // rot は中心移動と逆向きの回転の決まりなので、焼き込むときも“引く”。
    q.rot = wrapSpin((Number(q.rot) || 0) - s);
    q.spin = 0;
    delete q.spinPivot;
    return q;
}
function translateDefinition(o, vec) {
    if (!o) return o;
    if (o.type === "compound") {
        const sp = o.spinPivot;
        return {
            ...o,
            tx: (Number(o.tx) || 0) + vec[0],
            ty: (Number(o.ty) || 0) + vec[1],
            tz: (Number(o.tz) || 0) + vec[2],
            ...(sp && Number.isFinite(sp[0])
                ? { spinPivot: [sp[0] + vec[0], sp[1] + vec[1], sp[2] + vec[2]] }
                : {}),
        };
    }
    const q = { ...o, off: [...(o.off || [0, 0, 0])] };
    if (o.wallSideBasis?.origin) q.wallSideBasis = { ...o.wallSideBasis, origin: o.wallSideBasis.origin.map((v, i) => v + vec[i]) };
    // 回転中心も同じ量だけ動かす（形と中心が一緒に動くので、回しても軸がずれない）。
    const sp = o.spinPivot;
    if (sp && Number.isFinite(sp[0])) q.spinPivot = [sp[0] + vec[0], sp[1] + vec[1], sp[2] + vec[2]];
    if (!PL[q.k]) return q;
    const [iu, iv] = PL[q.k];
    q.ca = Number(q.ca) || 0;
    q.cb = Number(q.cb) || 0;
    q.lift = Number(q.lift) || 0;
    q.ca += vec[iu];
    q.cb += vec[iv];
    q.lift -= vec[q.k] / (Number(q.d) || 1);
    return q;
}
// 結合体の子パーツは、外の親へ接着させない。
// 接着情報が残っていると、結合体を回しても看板などが元の壁へ吸い戻されて
// 「回すと位置がずれる」原因になる。位置は結合した時点で ca/cb/lift に入って
// いるので、ここで外しても見た目は変わらない（分離したときは元のデータが残る）。
function detachPart(part) {
    if (!part || !part.attachment) return part;
    const q = { ...part };
    delete q.attachment;
    return q;
}
function compoundPartsAt(o) {
    const d = [Number(o?.tx) || 0, Number(o?.ty) || 0, Number(o?.tz) || 0];
    return (o?.parts || []).map((part) => detachPart(translateDefinition(part, d)));
}
// 結合体の部品1つぶんの線を作る。
// アセット（type:"asset"）は asset.js が genShape を差し替えて genAsset へ振り分けるため、
// ここでも同じ入口を通す。以前は genShapeCore を直接呼んでいたため、
// アセットの部品だけ線が出ず、アセットだけの結合体は丸ごと消えていた（旧JSONで発生）。
// 重複よけの印は、部品をまたいで付けたいので呼び出し元の genShape でまとめて行う。
// 配列は、元を含む個数と隣同士の実寸間隔で指定する。軸はBlenderに合わせ
// X=左右、Y=地面上の奥行き、Z=高さ（内部座標ではYとZが入れ替わる）。
function arrayModifierSpec(o) {
    if (!o || o.arrayEnabled !== true) return null;
    const count = clamp(Math.round(Number.isFinite(Number(o.arrayCount)) ? Number(o.arrayCount) : 3), 1, 100),
        spacing = clamp(Number.isFinite(Number(o.arraySpacing)) ? Number(o.arraySpacing) : 1.5, -100, 100),
        axis = ["x", "y", "z"].includes(o.arrayAxis) ? o.arrayAxis : "x",
        vector = axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 0, 1] : [0, 1, 0];
    return { count, spacing, axis, vector };
}
function arrayModifierShift(spec, index) {
    return spec.vector.map(v => v * spec.spacing * index);
}
// 各コピーはカメラに対する輪郭をそれぞれ生成する（元の画面線の単純平行移動ではない）。
// 定義IDは元に揃え、どのコピーを選んでも一つの編集可能な配列として扱う。
function arrayModifierLines(o, generate) {
    const source = o?.attachment ? syncAttachedPart(o) : o,
        base = generate(source), spec = arrayModifierSpec(source);
    if (!spec || spec.count < 2 || !base.length) return base;
    const seamKey = (line, i) => `${o.id || "part"}#${i}/${line.arraySeamKey || ""}`,
        out = base.map(line => ({ ...line, arrayGeometry: true, arraySeamKey: seamKey(line, 0) })), master = base[0].ob || o;
    for (let i = 1; i < spec.count; i++) {
        const shifted = detachPart(translateDefinition(source, arrayModifierShift(spec, i)));
        shifted.arrayEnabled = false;
        for (const line of generate(shifted)) out.push({ ...line, ob: master, arrayGeometry: true, arrayCopyIndex: i, arraySeamKey: seamKey(line, i) });
    }
    return out;
}
function partShape(part) {
    return arrayModifierLines(part, p => p && p.type === "asset" && typeof genAsset === "function" ? genAsset(p) : genShapeCore(p));
}
function genCompoundShape(ob) {
    const out = [];
    compoundPartsAt(ob).forEach((part) =>
        partShape(part).forEach((s) => out.push({ ...s, ob, c: s.c || ob.c, w: s.w || ob.w })),
    );
    return out;
}
const hit3 = (r, k, d, c = [0, 0, 0]) => {
    const den = r[k];
    if (!Number.isFinite(den) || Math.abs(den) < 1e-7) return null;
    const t = (d - c[k]) / den,
        q = [c[0] + r[0] * t, c[1] + r[1] * t, c[2] + r[2] * t];
    return t > 0 && q.every(Number.isFinite) ? q : null;
}; // 視線rが面(k座標=d)と交わる3D点（cはカメラ位置）
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// 図形の定義 ob（面の向きk・中心・半径・回転・大きさ・浮かせ量…）から線を作る。ob を直せば作り直せる＝移動・回転ができる
// 線の重複の印（.dup）を付けてから返す。
// 同じ稜線を2本持つアセット（屋台271本・建物254本など）でも、描画は1本ぶんになる。
// 計算は「形が変わったとき」の1回だけ（毎フレームやると描画が重くなる）。
function genShape(ob) {
    return CG.lineDedup.mark(genShapeCore(ob));
}
function genShapeCore(ob) {
    if (ob?.type === "compound") return genCompoundShape(ob);
    const { type, k, d, ca, cb, wf } = ob,
        off = ob.off || [0, 0, 0],
        co = CO(),
        [iu, iv] = PL[k],
        ra = ob.ra,
        rb = ob.rb,
        cs = Math.cos(ob.rot * DG),
        sn = Math.sin(ob.rot * DG);
    const q = (a, b, ee = 0) => {
        const x = a - ca,
            y = b - cb,
            v = [0, 0, 0];
        v[k] = d - d * ob.lift + ee;
        v[iu] = ca + x * cs - y * sn;
        v[iv] = cb + x * sn + y * cs;
        const out3 = [v[0] + off[0], v[1] + off[1], v[2] + off[2]];
        // ここで作る座標は L2W を通らない（面内の式を直接書いている）ので、
        // オブジェクトの傾き（rotX / rotZ）をこの1か所で掛ける。掛けないと
        // 傾けたときに面（塗り）だけが傾いて、線画が元の向きに取り残される。
        // 傾きが0のときは applyObjectTilt がそのまま返すので費用はほぼ掛からない。
        // パーツごとのヨー（spin）を先に掛け、そのあとオブジェクトの傾きを掛ける。
        // L2W と同じ順番（spin → tilt）にそろえてあるので、線画と当たり判定がずれない。
        const spun = partSpinDeg(ob) ? applyPartSpin(ob, out3) : out3;
        return typeof applyObjectTilt === "function" ? applyObjectTilt(ob, spun) : spun;
    }; // 面内(a,b)を中心まわりに回転＋法線方向の3D点（＋オブジェクトの傾き）
    const e = -d * ob.h,
        L = []; // eは押し出し量（カメラ側へ）
    const ring = (ee, t0 = 0, t1 = 2 * Math.PI) => {
        const o = [],
            n = Math.max(8, Math.ceil((160 * (t1 - t0)) / (2 * Math.PI)));
        for (let i = 0; i <= n; i++) {
            const t = t0 + ((t1 - t0) * i) / n;
            o.push(q(ca + ra * Math.cos(t), cb + rb * Math.sin(t), ee));
        }
        return o;
    };
    const corners = (ee = 0) => [
        q(ca - ra, cb - rb, ee),
        q(ca + ra, cb - rb, ee),
        q(ca + ra, cb + rb, ee),
        q(ca - ra, cb + rb, ee),
    ];
    const extruded = ob.extrude === true && Math.abs(ob.h) > 1e-4;
    if (type === "rect") {
        const c0 = corners(0);
        L.push([...c0, c0[0]]);
        if (extruded) {
            const c1 = corners(e);
            L.push([...c1, c1[0]]);
            for (let i = 0; i < 4; i++) L.push([c0[i], c1[i]]);
        }
    } else if (type === "circ") {
        const r0 = ring(0);
        L.push(r0);
        // 円を押し出した円柱は、上下輪郭に加えて「現在の視点から見える
        // 左右のシルエット母線」だけを描く。全周の縦線ではないので、
        // どの視点でも外周エッジだけが残る。
        if (extruded) {
            const r1 = ring(e);
            L.push(r1);
            const cen = q(ca, cb, 0),
                rel = V.add(camPos(), cen, 1, -1),
                eu = [0, 0, 0],
                ev = [0, 0, 0];
            eu[iu] = cs;
            eu[iv] = sn;
            ev[iu] = -sn;
            ev[iv] = cs;
            const vx = V.dot(rel, eu),
                vy = V.dot(rel, ev),
                ph = Math.atan2(vy, vx),
                t0 = ph + Math.PI / 2,
                t1 = ph - Math.PI / 2;
            [t0, t1].forEach((t) =>
                L.push([
                    q(ca + ra * Math.cos(t), cb + rb * Math.sin(t), 0),
                    q(ca + ra * Math.cos(t), cb + rb * Math.sin(t), e),
                ]),
            );
        }
    } else if (type === "triPyramid") {
        const b0 = q(ca - ra, cb - rb, 0),
            b1 = q(ca + ra, cb - rb, 0),
            b2 = q(ca, cb + rb, 0),
            ap = q(ca, cb, e);
        L.push([b0, b1, b2, b0], [b0, ap], [b1, ap], [b2, ap]);
    } else if (type === "triPrism") {
        const f0 = q(ca - ra, cb - rb, 0),
            f1 = q(ca + ra, cb - rb, 0),
            f2 = q(ca, cb - rb, e);
        const b0 = q(ca - ra, cb + rb, 0),
            b1 = q(ca + ra, cb + rb, 0),
            b2 = q(ca, cb + rb, e);
        L.push([f0, f1, f2, f0], [b0, b1, b2, b0], [f0, b0], [f1, b1], [f2, b2]);
    } else if (type === "box") {
        const c = corners(),
            t = c.map((v) => {
                const w = [...v];
                w[k] += e;
                return w;
            }),
            V8 = [...c, ...t];
        const F = [[0, 1, 2, 3], [4, 5, 6, 7], ...[0, 1, 2, 3].map((i) => [i, (i + 1) % 4, 4 + ((i + 1) % 4), 4 + i])]; // 面：底・上・側面4つ
        const cm = V8.reduce((s, v) => V.add(s, v), [0, 0, 0]).map((x) => x / 8);
        const vis = F.map((f) => {
            const fc = f.reduce((s, i) => V.add(s, V8[i]), [0, 0, 0]).map((x) => x / 4); // 面がカメラから見えるか
            let n = V.crs(V.add(V8[f[1]], V8[f[0]], 1, -1), V.add(V8[f[2]], V8[f[0]], 1, -1));
            if (V.dot(n, V.add(fc, cm, 1, -1)) < 0) n = n.map((x) => -x);
            return V.dot(n, V.add(fc, co)) < 0;
        });
        for (let i = 0; i < 4; i++) {
            const j = (i + 1) % 4; // 辺：隣り合う面のどちらかが見えていれば描く
            [
                [
                    [i, j],
                    [0, 2 + i],
                ],
                [
                    [4 + i, 4 + j],
                    [1, 2 + i],
                ],
                [
                    [i, 4 + i],
                    [2 + i, 2 + ((i + 3) % 4)],
                ],
            ].forEach(([[a, b], [f1, f2]]) => {
                if (wf || vis[f1] || vis[f2]) L.push([V8[a], V8[b]]);
            });
        }
    } else if (type === "cyl") {
        const r = ra,
            cl = V.add(camPos(), off, 1, -1),
            xc = ca - cl[iu],
            yc = cb - cl[iv],
            Ac = Math.hypot(xc, yc),
            ph = Math.atan2(yc, xc),
            far = Ac > r,
            ang = far ? Math.acos(-r / Ac) : 0,
            ez = [0, 0, 0];
        ez[k] = -d;
        [
            [0, V.dot(ez, V.add(q(ca, cb, 0), co)) > 0],
            [e, V.dot(ez, V.add(q(ca, cb, e), co)) < 0],
        ].forEach(([ee, v]) => {
            // 上下の円：見えていれば全周、見えなければ手前の弧だけ
            if (v || wf || !far) L.push(ring(ee));
            else L.push(ring(ee, ph + ang, ph + 2 * Math.PI - ang));
        });
        // 円柱の側面の縦エッジは描かない。上下輪郭だけで表現する。
    }
    return L.map((pl) => ({ c: ob.c, w: ob.w, ob, d3: true, cs: sigNow(), p: dens3(pl) }));
}
// ===== 10. 図形の編集（選択・移動・回転・大きさ・浮かせる） =====
let _obCacheS = null,
    _obCacheLen = -1,
    _obCacheFirst = null,
    _obCacheLast = null,
    _obCacheFirstOb = null,
    _obCacheLastOb = null,
    _obCacheMap = new Map(),
    _obCacheList = [];
function _ensureObIndex() {
    const len = S.length,
        first = len ? S[0] : null,
        last = len ? S[len - 1] : null,
        firstOb = first && first.ob,
        lastOb = last && last.ob;
    if (
        _obCacheS === S &&
        _obCacheLen === len &&
        _obCacheFirst === first &&
        _obCacheLast === last &&
        _obCacheFirstOb === firstOb &&
        _obCacheLastOb === lastOb
    ) {
        return _obCacheMap;
    }
    _obCacheS = S;
    _obCacheLen = len;
    _obCacheFirst = first;
    _obCacheLast = last;
    _obCacheFirstOb = firstOb;
    _obCacheLastOb = lastOb;
    _obCacheMap.clear();
    _obCacheList = [];
    for (let i = 0; i < len; i++) {
        const o = S[i] && S[i].ob;
        if (o && o.id && !_obCacheMap.has(o.id)) {
            _obCacheMap.set(o.id, o);
            _obCacheList.push(o);
        }
    }
    return _obCacheMap;
}
const obOf = (id) => {
    if (!id) return null;
    const hit = _ensureObIndex().get(id);
    if (hit && S.some((s) => s.ob === hit)) return hit;
    const s = S.find((s) => s.ob && s.ob.id === id);
    if (s && s.ob) _obCacheMap.set(id, s.ob);
    return s && s.ob;
};
const sceneObjects = () => {
    _ensureObIndex();
    return _obCacheList;
};
const objectVisible = (o) => !o || o.visible !== false;

// ===== 10.1 ロック（2026-10-30 追加） =====
// 2種類ある。どちらも「保存データの形を変えずに済む」ように作っている。
//  1) オブジェクトロック … 図形の定義に locked:true を持たせる（JSON保存にそのまま乗る）
//  2) カメラロック       … 視点（位置・向き・画角・ズーム）を固定する。保存はしない
const LOCK_ADMIN_KEYS = new Set(["locked", "visible"]); // ロック中でも変更してよい項目
// カメラ（視点）を構成する値。これらが変わると「視点が動いた」とみなす。
const CAMERA_KEYS = new Set(["cx", "cz", "ch", "yaw", "pitch", "roll", "lens", "hz", "fov"]);
const obLocked = (o) => !!(o && o.locked === true);
let cameraLock = false,
    cameraLockSnap = null,
    last3DDisplay = null;
// 正投影で表示を操作しても、ロック時に保存するのは最後の3D表示。
function remember3DDisplay() {
    if (!orthView) last3DDisplay = { Z, ox, oy };
}
// 今の視点を記録する。カメラロック中は、この値へ常に戻す。
function cameraSnapshotNow() {
    const display = orthView && last3DDisplay ? last3DDisplay : { Z, ox, oy };
    const snap = { ...display };
    CAMERA_KEYS.forEach((k) => (snap[k] = Number(P[k]) || 0));
    return snap;
}
function setCameraLock(on) {
    cameraLock = !!on;
    cameraLockSnap = cameraLock ? cameraSnapshotNow() : null;
    // 3Dカメラ操作の途中だけ止める。正投影の表示操作はカメラ固定の対象外。
    if (cameraLock && !orthView) {
        drag = null;
        mg = null;
    }
    if (typeof window.syncLockButtons === "function") window.syncLockButtons();
    window.CityCanvasControls?.sync?.();
    if (typeof window.flashHint === "function")
        window.flashHint(cameraLock ? "カメラを固定しました（L で解除）" : "カメラの固定を解除しました");
    render();
    return cameraLock;
}
// カメラロック中に視点が変わっていたら、記録した値へ戻す。
// マウス・ホイール・ピンチ・矢印キー・左パネル・間取りのカメラ操作など、
// 視点を動かす入口がいくつもあるため、最後に必ずここで1回そろえる。
function enforceCameraLock() {
    if (!cameraLock || !cameraLockSnap) return false;
    const snap = cameraLockSnap;
    let changed = false;
    CAMERA_KEYS.forEach((k) => {
        if (Number(P[k]) !== snap[k]) {
            P[k] = snap[k];
            changed = true;
        }
    });
    // Z / ox / oy は3Dと正投影で一時的に共有される。正投影の表示操作は
    // 戻さず、3Dへ復帰するときだけロックした3D表示に戻す。
    if (!orthView) {
        if (Z !== snap.Z) {
            Z = snap.Z;
            changed = true;
        }
        if (ox !== snap.ox) {
            ox = snap.ox;
            changed = true;
        }
        if (oy !== snap.oy) {
            oy = snap.oy;
            changed = true;
        }
    }
    if (changed) {
        sync();
        if (typeof updZ === "function") updZ();
    }
    return changed;
}
// 選択中のオブジェクトをまとめてロック／解除する。接続パーツは親子でそろえる。
function setObjectLock(id, locked) {
    const o = obOf(id);
    if (!o) return false;
    const ids = new Set([id]);
    // 接続している子（看板・テントなど）は、親と一緒にロックする。
    S.forEach((s) => {
        const q = s && s.ob;
        if (q && q.attachment?.parentId === id) ids.add(q.id);
    });
    // グループは見た目も操作も一体なので、同じロック状態へそろえる。
    groupMemberIds(id).forEach((member) => ids.add(member));
    if (locked) {
        HU.push(S);
        RD = [];
    }
    ids.forEach((member) => {
        const def = obOf(member);
        if (def) setOb(member, { locked: !!locked });
    });
    return true;
}
function unlockAllObjects() {
    const ids = new Set();
    S.forEach((s) => {
        const q = s && s.ob;
        if (obLocked(q)) ids.add(q.id);
    });
    if (!ids.size) return 0;
    HU.push(S);
    RD = [];
    ids.forEach((id) => setOb(id, { locked: false }));
    return ids.size;
}
const lockedObjectCount = () => {
    const ids = new Set();
    S.forEach((s) => {
        const q = s && s.ob;
        if (obLocked(q)) ids.add(q.id);
    });
    return ids.size;
};
// 親オブジェクトの面に接続した子を、親の寸法・回転に追従させる。
// attachment.verticalOnly の子は、移動時にこの接続面から離れない。
function syncAttachedPart(o, parentOverride = null) {
    const a = o?.attachment;
    if (!a?.parentId) return o;
    const parent = parentOverride || obOf(a.parentId);
    if (!parent) return o;
    const side = Number(a.side) === -1 ? -1 : 1,
        px = Number(a.x) || 0;
    // 横壁看板は、親のローカルX側面へ縦長の板として接着する。
    // 通常のL2Wはk軸まわりの回転しか扱えないため、横壁だけは
    // 「上方向・親の奥行方向・親の横壁法線」の基底を明示して追従させる。
    if (a.wallSideSign) {
        const signSide = Number(a.wallSideSignSide ?? a.side) === -1 ? -1 : 1,
            r = Number(parent.rot || 0) * DG,
            cs = Math.cos(r),
            sn = Math.sin(r),
            localX = [cs, 0, sn],
            localY = [-sn, 0, cs],
            up = [0, 1, 0],
            normal = localX.map((value) => value * signSide),
            stacked = isStackedBuildingAsset(parent),
            floors = stacked && Array.isArray(parent.floors) ? parent.floors : [],
            index = stacked ? clamp(Math.round(Number(a.floorIndex) || 0), 0, Math.max(0, floors.length - 1)) : 0,
            floor = stacked ? floors[index] || floors[0] : null;
        if (stacked && (!floor || typeof customPt !== "function")) return o;
        const parentW = stacked ? Math.abs(Number(floor?.w) || 4) : Math.abs(Number(parent.ra) || 2) * 2,
            parentD = stacked ? Math.abs(Number(floor?.d) || 3) : Math.abs(Number(parent.rb) || 1.5) * 2,
            bracketCount = clamp(Math.round(Number(o.wallSideSignBracketCount ?? 3)), 0, 3),
            bracketLength = clamp(Math.abs(Number(o.wallSideSignBracketLength) || 0.36), 0.05, 5),
            effectiveBracketLength = bracketCount > 0 ? bracketLength : 0,
            boardHalfWidth = Math.abs(Number(o.rb) || 0.5),
            // 看板面を壁に対して垂直にし、看板の半幅＋金具の長さぶん外へ出す。
            // 0.025は壁面とのクリアランスで、看板が壁へめり込むのを防ぐ。
            wallOffset = parentW * 0.5 + 0.025 + effectiveBracketLength + boardHalfWidth,
            depthOffset = clamp(
                Number(a.depthOffset ?? a.x) || 0,
                -parentD * 0.5 + Math.abs(Number(o.rb) || 0.1),
                parentD * 0.5 - Math.abs(Number(o.rb) || 0.1),
            ),
            verticalRatio = clamp(Number(a.centerRatio) || 0.68, 0.06, 0.94),
            verticalCenter = stacked
                ? (Number(floor?.z) || 0) + Math.abs(Number(floor?.h) || 2.2) * verticalRatio
                : Math.abs(Number(parent.h) || 1) * verticalRatio,
            origin = stacked
                ? customPt(
                      parent,
                      Number(floor?.x) + signSide * wallOffset,
                      Number(floor?.y) + depthOffset,
                      verticalCenter,
                  )
                : L2W(parent, signSide * wallOffset, depthOffset, verticalCenter);
        return {
            ...o,
            attachment: { ...a, side: signSide, floorIndex: index, wallSideSignSide: signSide },
            // 形状編集UIとの互換のためk/dは残すが、描画座標はwallSideBasisを優先する。
            k: 1,
            d: -1,
            rot: Number(parent.rot || 0),
            // u=高さ、v=壁から外へ出る看板幅、n=壁に沿う板厚。
            // これで看板面は横壁へ垂直になり、外形の奥行きが細長く表示される。
            wallSideBasis: { origin, u: up, v: normal, n: localY },
            ca: origin[0],
            cb: origin[2],
            lift: origin[1] + 1,
            off: [0, 0, 0],
        };
    }
    // 積層建物はgeometryがcustomPt（階ごとのx/y/z）で保持されるため、
    // 標準建物のL2Wとは別に、指定階の壁面へベランダを同期する。
    if (isStackedBuildingAsset(parent) && a.stackedFloor) {
        const floors = Array.isArray(parent.floors) ? parent.floors : [],
            index = clamp(Math.round(Number(a.floorIndex) || 0), 0, Math.max(0, floors.length - 1)),
            f = floors[index];
        if (!f || typeof customPt !== "function") return o;
        const fd = Math.max(0.05, Math.abs(Number(f.d) || 3)),
            attachedNormal = Math.abs(Number(o.rb) || 0.1) + 0.008,
            floorZ = Number(f.z) || 0,
            floorOffset = Number(a.offsetZ) || 0,
            p = customPt(
                parent,
                (Number(f.x) || 0) + px,
                (Number(f.y) || 0) + side * (fd * 0.5 + attachedNormal),
                floorZ + floorOffset,
            ),
            rot = Number(parent.rot || 0) + Number(a.rotOffset || 0);
        return {
            ...o,
            attachment: { ...a, side, floorIndex: index },
            k: 1,
            d: -1,
            rot,
            ca: p[0],
            cb: p[2],
            lift: p[1] + 1,
            off: [0, 0, 0],
        };
    }
    const linkedFace = !!o.linkedAsset,
        parentH = Math.max(0.1, Number(parent.h) || 1),
        baseZ = Number.isFinite(Number(a.baseRatio))
            ? parentH * clamp(Number(a.baseRatio), 0.02, 0.98)
            : Number.isFinite(Number(a.baseZ))
              ? Number(a.baseZ)
              : parentH * 0.5,
        offsetZ = Number(a.offsetZ) || 0,
        z = clamp(baseZ + offsetZ, 0.02, Math.max(0.02, parentH - 0.02));
    // 看板の直方体・テントの奥側の面を、親の開口側の面へぴったり合わせる。
    // k=1ではrbがローカルY（建物の奥行き／壁面法線方向）の半径で、hは上下の高さ。
    const attachedNormal = Math.abs(Number(o.rb) || 0.1) + 0.008;
    const faceY = side * (Math.abs(Number(parent.rb) || 0.5) + attachedNormal),
        p = L2W(parent, px, faceY, z),
        rot = Number(parent.rot || 0) + Number(a.rotOffset || 0),
        // 子は親と同じ生成面（k）に載せる。以前は必ず k=1 にしていたため、
        // 親の生成面を X／Z にすると子だけ元の向きに残って壁から浮いていた。
        // 同じ k にそろえると、親を傾けても同じ面の上に貼り付いたまま追従する。
        pk = Number.isFinite(Number(parent.k)) ? Number(parent.k) : 1,
        [piu, piv] = PL[pk];
    return {
        ...o,
        attachment: linkedFace ? { ...a, side: -1 } : { ...a, side },
        k: pk,
        d: -1,
        rot,
        ca: p[piu],
        cb: p[piv],
        lift: p[pk] + 1,
        off: [0, 0, 0],
    };
}
// 選択状態は「操作対象の主役 sel」と、複数選択用の selIds を分けて持つ。
// 旧データや既存の操作経路が sel だけを書き換えても壊れないよう、ここで同期する。
function groupMemberIds(id) {
    const o = obOf(id);
    if (!o) return [];
    // 接続アセットは「親＋子を常に同時選択するグループ」ではない。
    // 親建物と看板／テントを個別に選び、それぞれのギズモを使えるようにする。
    if (o.linkedAsset || o.attachment?.parentId) return [id];
    if (!o.groupId) return [id];
    const ids = [];
    S.forEach((s) => {
        const q = s && s.ob;
        if (q && q.groupId === o.groupId && !ids.includes(q.id)) ids.push(q.id);
    });
    return ids.length ? ids : [id];
}
function normalizeSelection() {
    if (sel && !selIds.has(sel)) selIds.add(sel);
    [...selIds].forEach((id) => {
        if (!obOf(id) || !objectVisible(obOf(id))) selIds.delete(id);
    });
    // グループは常に一体選択。行・キャンバスのどのメンバーを選んでも全員を選ぶ。
    [...selIds].forEach((id) =>
        groupMemberIds(id).forEach((member) => {
            if (objectVisible(obOf(member))) selIds.add(member);
        }),
    );
    if (sel && (!obOf(sel) || !objectVisible(obOf(sel)))) sel = null;
    if (!sel && selIds.size) sel = [...selIds][selIds.size - 1];
    if (sel && !selIds.has(sel)) selIds.add(sel);
}
function setSelection(id, add = false, allowLocked = false) {
    // 一覧からはロック中も選択できる。キャンバス上では従来どおり誤選択を防ぐ。
    if (id && obLocked(obOf(id)) && !allowLocked) {
        if (typeof window.flashHint === "function") window.flashHint("ロック中のオブジェクトです（一覧の鍵で解除）");
        return false;
    }
    if (id && !objectVisible(obOf(id))) return false;
    const members = id ? groupMemberIds(id) : [];
    if (!add) selIds.clear();
    if (id) {
        const selected = members.some((member) => selIds.has(member));
        if (add && selected) members.forEach((member) => selIds.delete(member));
        else members.forEach((member) => selIds.add(member));
        sel = selIds.has(id) ? id : [...selIds][selIds.size - 1] || null;
    } else if (!add) {
        sel = null;
    }
    normalizeSelection();
    if (typeof window.cityGridObjectSelection === "function") window.cityGridObjectSelection(sel, !!id && !!sel);
}
function clearSelection() {
    sel = null;
    selIds.clear();
    if (typeof window.cityGridObjectSelection === "function") window.cityGridObjectSelection(null);
}
function selectedObjects() {
    normalizeSelection();
    const ids = selIds.size ? selIds : sel ? new Set([sel]) : new Set(),
        out = [];
    ids.forEach((id) => {
        const o = obOf(id);
        if (o) out.push(o);
    });
    return out;
}
// 図形の定義を更新して、その図形の線だけ作り直す
// カメラ位置が変わったら、図形の線（隠れ線の判定つき）を作り直す
// 定義からオブジェクト線画を再生成する。
// 同じオブジェクトに属する複数の線は、最初の1回だけ生成して重複を避ける。
function regenObjects() {
    const done = new Set(),
        out = [];
    S.forEach((s) => {
        if (!s.ob) out.push(s);
        else if (!done.has(s.ob.id)) {
            done.add(s.ob.id);
            out.push(...genShape(syncAttachedPart(s.ob)));
        }
    });
    S = out;
} // 描く順番(重なり)は変えない
// オブジェクト定義を部分更新する中心関数。
// 更新後は対象線を作り直し、親を変更した場合は接続パーツも追従させる。
function setOb(id, patch) {
    const o = obOf(id);
    if (!o) return;
    // ロック中のオブジェクトは、ギズモ・数値パネル・整列などどこから来た変更でも受け付けない。
    // locked / visible（一覧の鍵・目のボタン）だけは例外にして、解除できなくならないようにする。
    if (obLocked(o) && patch && Object.keys(patch).some((k) => !LOCK_ADMIN_KEYS.has(k))) {
        if (typeof window.flashHint === "function") window.flashHint("ロック中のオブジェクトは編集できません");
        return false;
    }
    // 扉のONでは、未保存だった奥壁の現在位置を保存してから扉へ置き換える。
    if (patch?.doorEnabled === true && patch.openingBack == null && o.asset === "building" && o.openingBack == null && typeof buildingGeometry === "function")
        patch = { ...patch, openingBack: buildingGeometry(o).backY };
    let next = { ...o, ...patch };
    // 開口幅の編集では、すでに動かした開口の中心を可能な限り固定する。
    if (typeof buildingOpeningEditConstraint === "function") next = buildingOpeningEditConstraint(next, o, patch || {});
    // 登録アセットが寸法の安全範囲を宣言した場合、数値欄とギズモの双方で守る。
    const assetMeta = next.type === "asset" && typeof ASSETS !== "undefined" ? ASSETS[next.asset] : null;
    if (typeof assetMeta?.constrainEdit === "function" && !(obLocked(o) && patch && Object.keys(patch).every(k => LOCK_ADMIN_KEYS.has(k)))) next = assetMeta.constrainEdit(next, o, patch || {}) || next;
    if (typeof assetMeta?.minHeight === "function" && patch && Object.prototype.hasOwnProperty.call(patch, "h"))
        next.h = Math.max(Number(assetMeta.minHeight(next)) || 0.005, Number(next.h) || 0);
    if (typeof assetMeta?.minHalfWidth === "function" && patch && Object.prototype.hasOwnProperty.call(patch, "ra"))
        next.ra = Math.max(Number(assetMeta.minHalfWidth(next)) || 0.005, Number(next.ra) || 0);
    if (typeof assetMeta?.minHalfDepth === "function" && patch && Object.prototype.hasOwnProperty.call(patch, "rb"))
        next.rb = Math.max(Number(assetMeta.minHalfDepth(next)) || 0.005, Number(next.rb) || 0);
    // トラック型の奥行き変更は直線部の長さを維持する。
    if (o.type === "asset" && o.asset === "track") {
        if (patch && Object.prototype.hasOwnProperty.call(patch,"rb") && !Object.prototype.hasOwnProperty.call(patch,"ra"))
            next.ra = Math.max(next.rb, o.ra + next.rb - o.rb);
        next.ra = Math.max(next.rb, next.ra);
    }
    // 接続子の幅・横方向の面ハンドルは、反対側の面を固定したまま編集する。
    // syncAttachedPartで接着面へ戻す前に、移動後の中心を親ローカルXへ記録する。
    if (
        o.attachment &&
        ((patch && Object.prototype.hasOwnProperty.call(patch, "ca")) ||
            (patch && Object.prototype.hasOwnProperty.call(patch, "cb")))
    ) {
        const parent = obOf(o.attachment.parentId);
        if (parent) {
            const pb = L2W(parent, 0, 0, 0),
                wx = (Number(next.ca) || 0) + (next.off?.[0] || 0),
                wz = (Number(next.cb) || 0) + (next.off?.[2] || 0),
                dx = wx - pb[0],
                dz = wz - pb[2],
                r = Number(parent.rot || 0) * DG,
                localX = dx * Math.cos(r) + dz * Math.sin(r),
                localY = -dx * Math.sin(r) + dz * Math.cos(r);
            next.attachment = next.attachment.wallSideSign
                ? { ...next.attachment, depthOffset: localY }
                : { ...next.attachment, x: localX };
        }
    }
    if (o.attachment && patch && Object.prototype.hasOwnProperty.call(patch, "lift")) {
        const parent = obOf(o.attachment.parentId);
        if (parent) {
            const parentBase = L2W(parent, 0, 0, 0)[1],
                rawBase =
                    (Number(next.d) || -1) - (Number(next.d) || -1) * (Number(next.lift) || 0) + (next.off?.[1] || 0),
                baseZ = Number.isFinite(Number(next.attachment.baseRatio))
                    ? (Number(parent.h) || 1) * clamp(Number(next.attachment.baseRatio), 0.02, 0.98)
                    : Number(next.attachment.baseZ) || 0;
            if (next.attachment.wallSideSign) {
                const floors = isStackedBuildingAsset(parent) && Array.isArray(parent.floors) ? parent.floors : [],
                    index = clamp(
                        Math.round(Number(next.attachment.floorIndex) || 0),
                        0,
                        Math.max(0, floors.length - 1),
                    ),
                    floor = floors[index],
                    floorBase = floor ? Number(floor.z) || 0 : 0,
                    floorHeight = floor
                        ? Math.max(0.05, Math.abs(Number(floor.h) || 2.2))
                        : Math.max(0.1, Number(parent.h) || 1),
                    ratio = (rawBase - parentBase - floorBase) / floorHeight;
                next.attachment = {
                    ...next.attachment,
                    floorIndex: index,
                    centerRatio: clamp(Number.isFinite(ratio) ? ratio : 0.68, 0.06, 0.94),
                    offsetZ: 0,
                };
            } else next.attachment = { ...next.attachment, offsetZ: rawBase - parentBase - baseZ };
        }
    }
    const replace = (def) => {
        S = [...S.filter((s) => !(s.ob && s.ob.id === def.id)), ...genShape(syncAttachedPart(def))];
    };
    replace(next);
    // 親の面を編集したときは、接続している子も同時に再配置する。
    const childIds = [...new Set(S.filter((s) => s.ob && s.ob.attachment?.parentId === id).map((s) => s.ob.id))];
    childIds.forEach((childId) => {
        const child = obOf(childId);
        if (child) replace(child);
    });
}
// 近くにある図形の線を探す（24px以内）
function pickOb(p, includeLocked = false) {
    let best = null,
        bd = 24 / Z,
        bestAttached = false;
    S.forEach((s) => {
        // ロック中のオブジェクトは通常のクリックでは選ばない。
        // includeLocked=true は「押した場所がロック中だった」と知らせるためだけに使う。
        if (!s.ob || !objectVisible(s.ob) || (!includeLocked && obLocked(s.ob))) return;
        for (const v of s.p) {
            const q = sp(s, v);
            if (!q.ok) continue;
            const dd = Math.hypot(q.x - p.x, q.y - p.y),
                attached = !!s.ob.attachment,
                childHit = attached && dd < 9 / Z;
            if (childHit && !bestAttached) {
                bd = dd;
                best = s.ob.id;
                bestAttached = true;
            } else if ((!bestAttached && dd < bd) || (bestAttached && attached && dd < bd)) {
                bd = dd;
                best = s.ob.id;
            }
        }
    });
    return best;
}
// 図形のローカル座標(x=幅方向,y=奥行き方向,z=高さ方向)→ワールドの3D点
// オブジェクト固有のローカル座標をワールド座標へ変換する。
// x=幅、y=面内の奥行き、z=法線方向の押し出しとして、k/rot/d/liftを反映する。
// 画面の回転ギズモで作る「傾き」の回転行列。
// rotX / rotZ はワールド軸まわりの角度（度）。Y軸（上下）まわりは従来の rot が
// そのまま担当するので、ここでは扱わない（既存データの見た目を変えないため）。
// 回転の中心はオブジェクトのローカル原点（底面の中心）で、地面に接したまま傾く。
function objectTiltMatrix(o) {
    const ax = (Number(o?.rotX) || 0) * DG,
        az = (Number(o?.rotZ) || 0) * DG;
    if (!ax && !az) return null;
    const cx = Math.cos(ax),
        sx = Math.sin(ax),
        cz = Math.cos(az),
        sz = Math.sin(az);
    // R = Rz(az) · Rx(ax)
    return [
        [cz, -sz * cx, sz * sx],
        [sz, cz * cx, -cz * sx],
        [0, sx, cx],
    ];
}
// 傾きの回転を、ローカル原点を中心に1点へ適用する。
function applyObjectTilt(o, v, base) {
    const M = objectTiltMatrix(o);
    if (!M) return v;
    // 回転の中心はオブジェクトの高さの真ん中。底面基準にすると、傾けたときに
    // 下の角が地面へ潜り込んで「倒れた」ように見えるため、その場で回す。
    const h = Math.max(0, Number(o?.h) || 0);
    const b = base || l2wRaw(o, 0, 0, h * 0.5),
        dx = v[0] - b[0],
        dy = v[1] - b[1],
        dz = v[2] - b[2];
    return [
        b[0] + M[0][0] * dx + M[0][1] * dy + M[0][2] * dz,
        b[1] + M[1][0] * dx + M[1][1] * dy + M[1][2] * dz,
        b[2] + M[2][0] * dx + M[2][1] * dy + M[2][2] * dz,
    ];
}
// 傾きを掛ける前の座標（従来の L2W と同じ計算）。傾きの中心を出すのにも使う。
function l2wRaw(o, x, y, z) {
    const [iu, iv] = PL[o.k],
        cs = Math.cos(o.rot * DG),
        sn = Math.sin(o.rot * DG),
        v = [0, 0, 0];
    v[o.k] = o.d - o.d * o.lift - o.d * z;
    v[iu] = o.ca + x * cs - y * sn;
    const f = o.off || [0, 0, 0];
    v[iv] = o.cb + x * sn + y * cs;
    // パーツごとのヨー（spin）。傾き(tilt)の内側で掛けるので、
    // genShape 側の点も同じ順番（spin → tilt）で掛ける。
    return applyPartSpin(o, [v[0] + f[0], v[1] + f[1], v[2] + f[2]]);
}
function L2W(o, x, y, z) {
    if (o?.attachment) o = syncAttachedPart(o);
    // 横壁看板は、通常の「水平面＋上下押し出し」だけでは表せないため、
    // 親のローカル横壁に沿う直交基底を使って3D座標へ変換する。
    // wallSideBasisはsyncAttachedPart()が親の移動・回転・寸法変更ごとに更新する。
    const wb = o?.wallSideBasis;
    if (wb?.origin && wb?.u && wb?.v && wb?.n) {
        const add = (base, axis, scale) => base.map((value, i) => value + axis[i] * scale),
            p = add(wb.origin, wb.u, Number(x) || 0),
            q = add(p, wb.v, Number(y) || 0),
            w = add(q, wb.n, Number(z) || 0),
            // 壁沿いの基底で作った点にも、パーツのヨー(spin)を最後に掛ける。
            // 掛けないと、結合した横壁看板だけが回転に付いてこない。
            spun = partSpinDeg(o) ? applyPartSpin(o, w) : w;
        return applyObjectTilt(o, spun, wb.origin);
    }
    return applyObjectTilt(o, l2wRaw(o, x, y, z));
}
// 古い保存データ（大きさ%・高さ%）を、幅・奥行き・高さの形に直す
function fixOb(o) {
    let n = o;
    if (o.h === undefined) {
        const f = (o.sc || 100) / 100,
            ra = o.ra * f,
            rb = o.rb * f;
        n = { ...o, ra, rb, h: (Math.min(ra, rb) * 2 * (o.hr || 100)) / 100, sc: undefined, hr: undefined };
    }
    // 旧保存データの接続建物も、現在の建物アセットとY面基準へ移行する。
    // 以前はテント付き建物の親がrectのまま保存され、開口設定と接着計算を共有できなかった。
    if (n?.linkedAsset === "buildingAwning" && (n.type === "rect" || n.asset === "rect")) {
        n = {
            ...n,
            type: "asset",
            asset: "building",
            assetId: "building-awning",
            assetName: "テント付き建物",
            openingEnabled: false,
            openingW: Number(n.openingW) || Math.abs(Number(n.ra) || 2) * 2 * 0.56,
            openingH: Number(n.openingH) || Math.max(0.1, Number(n.h) || 3.6) * 0.66,
        };
    } else if (n?.linkedAsset === "buildingSign" && n.asset === "building" && n.openingEnabled == null) {
        n = { ...n, openingEnabled: true };
    }
    // 初期実装の横壁看板は、正面Y面のra/rb/hへ寸法を保存していた。
    // 保存済みデータを新しい横壁基底へ移すときだけ、縦・横・厚みの順へ読み替える。
    if (n?.wallSideSign && n?.attachment?.wallSideSign && n.attachment.centerRatio == null) {
        const oldHeight = Math.max(0.05, Math.abs(Number(n.h) || 0.8)),
            oldWidth = Math.max(0.05, Math.abs(Number(n.ra) || 0.6) * 2),
            oldThickness = Math.max(0.04, Math.abs(Number(n.rb) || 0.08) * 2);
        n = {
            ...n,
            type: "asset",
            asset: "wallSideSign",
            assetId: "wall-side-sign",
            assetName: "横壁看板",
            ra: oldHeight * 0.5,
            rb: oldWidth * 0.5,
            h: oldThickness,
            wallSideSignBracketCount: 3,
            wallSideSignBracketLength: 0.36,
            wallSideSignShape: "box",
            wallSideSignBevelOffset: 0.06,
            wallSideSignBevelSegments: 4,
            attachment: {
                ...n.attachment,
                wallSideSignSide: Number(n.attachment.wallSideSignSide ?? n.attachment.side) < 0 ? -1 : 1,
                depthOffset: 0,
                centerRatio: 0.68,
            },
        };
    }
    if (
        n?.linkedRole === "parent" &&
        ["buildingAwning", "buildingSign"].includes(n.linkedAsset) &&
        Number(n.k) !== 1 &&
        PL[n.k]
    ) {
        const center = L2W(n, 0, 0, 0);
        n = { ...n, k: 1, d: -1, ca: center[0], cb: center[2], lift: 0, off: [0, 0, 0] };
    }
    if (n?.asset === "awning" && !n.awningEdgeEdited) {
        const hh = Math.max(0.1, Number(n.h) || 1),
            old = Number(n.awningEdgeZ);
        if (!Number.isFinite(old) || Math.abs(old - hh * 0.68) < 0.001)
            n = {
                ...n,
                awningEdgeZ: hh,
                awningEdgeY: -Math.abs(Number(n.rb) || 0.5),
                awningFrontBottom: 0,
                awningBackBottom: 0,
            };
    }
    // 旧小物の部品の実寸を固定し、寸法変更で投入口や椅子の台座が勝手に動かないようにする。
    if (n?.asset === "streetMailbox" && n.mailSlotHeight == null)
        n = { ...n, mailSlotHeight: Math.max(.04, (Number(n.h) - (Number(n.mailPostLength) || .42)) * .625) };
    if (n?.asset === "squareStool" && n.squareBaseRadius == null)
        n = { ...n, squareBaseRadius: Math.min(Math.abs(n.ra), Math.abs(n.rb)) * .62,
            squarePoleRadius: Math.min(Math.abs(n.ra), Math.abs(n.rb)) * .2 };
    // 葉を除去した植栽2は、旧データの鉢自体の高さを引き継ぐ。
    if (n?.asset === "streetPlantBox" && n.plantPotHeight != null && !n.plantBoxOnly)
        n = { ...n, h: Math.max(.06, Math.min(Number(n.h) || .3, Number(n.plantPotHeight) || .3)), plantBoxOnly: true };
    if (n?.asset === "sign") delete n.bevel;
    return n.off ? n : { ...n, off: [0, 0, 0] };
}
// 選択中の図形の数値を、パネルに表示
function syncSel() {
    normalizeSelection();
    // 選択が変わるとロックボタンの文言（ロック／解除）も変わる。
    if (typeof window.syncLockButtons === "function") window.syncLockButtons();
    const o = sel && obOf(sel);
    if (sel && !o) sel = null;
    if (typeof window.cityGridObjectSelection === "function") window.cityGridObjectSelection(o ? sel : null);
    $("objP").style.display = o ? "" : "none";
    $("objP").inert = !!o && obLocked(o);
    $("objLockedNotice").style.display = o && obLocked(o) ? "" : "none";
    if (!o) return;
    if (sel !== lastSel) {
        lastSel = sel;
        const d = $("objP").closest("details");
        if (d) d.open = true;
    }
    const compound = o.type === "compound",
        b = compound ? obBounds(o) : null,
        P3 = compound ? [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2] : L2W(o, 0, 0, 0);
    const values = compound
        ? [
              ["rot", Number(o.compoundRot) || 0],
              ["w", b.hi[0] - b.lo[0]],
              ["dp", b.hi[2] - b.lo[2]],
              ["h", b.hi[1] - b.lo[1]],
              ["px", P3[0]],
              ["py", P3[1] + 1],
              ["pz", P3[2]],
          ]
        : [
              ["rot", o.rot],
              ["w", 2 * o.ra],
              ["dp", 2 * o.rb],
              ["h", o.h],
              ["px", P3[0]],
              ["py", P3[1] + 1],
              ["pz", P3[2]],
          ];
    values.forEach(([k, v]) => {
        const n = $("ov_" + k),
            r = $("or_" + k);
        if (n && document.activeElement !== n) n.value = +(+v).toFixed(3);
        if (r && document.activeElement !== r) r.value = v;
    });
    const enabled = o.arrayEnabled === true;
    $("arrayEnabled").checked = enabled;
    $("arrayModifierFields").style.display = enabled ? "" : "none";
    const cfg = arrayModifierSpec({ ...o, arrayEnabled: true });
    for (const [id, value] of [["arrayCount", cfg.count], ["arrayCountSlider", cfg.count], ["arraySpacing", cfg.spacing], ["arrayAxis", cfg.axis]])
        if (document.activeElement !== $(id)) $(id).value = String(value);
}
let arrayEditSession = false;
function applyArrayModifier(patch, continuous = false) {
    const objects = selectedObjects();
    if (!objects.length) return;
    if (!continuous || !arrayEditSession) { HU.push(S); RD = []; }
    arrayEditSession = continuous;
    objects.forEach(o => setOb(o.id, patch));
    render();
}
$("arrayEnabled").onchange = e => { arrayEditSession = false; applyArrayModifier({ arrayEnabled: e.target.checked }); };
$("arrayAxis").onchange = e => { arrayEditSession = false; applyArrayModifier({ arrayAxis: e.target.value }); };
for (const [id, key, lo, hi, integer] of [["arrayCount", "arrayCount", 1, 100, true], ["arrayCountSlider", "arrayCount", 1, 100, true], ["arraySpacing", "arraySpacing", -100, 100, false]]) {
    const input = $(id);
    input.oninput = () => {
        if (input.value.trim() === "" || !Number.isFinite(Number(input.value))) return;
        const n = Number(input.value), value = clamp(integer ? Math.round(n) : n, lo, hi);
        applyArrayModifier({ [key]: value }, true);
    };
    input.onchange = () => { arrayEditSession = false; syncSel(); };
    input.onblur = () => { arrayEditSession = false; };
}
// パネルの数値 → 図形の変更内容
// 左パネルの幅・奥行き・高さ・回転などを、オブジェクト別の差分へ変換する。
// アセット固有の追加項目は asset-controller.js / studio-ui.js 側で処理する。
function fieldPatch(o, name, v) {
    if (o.attachment?.verticalOnly && ["px", "pz"].includes(name)) return {};
    if (o.attachment?.verticalOnly && name === "py") {
        const base = L2W(o, 0, 0, 0),
            delta = Number(v) - 1 - base[1];
        return moveBy(o, [0, delta, 0]);
    }
    if (o.type === "compound") {
        if (["px", "py", "pz"].includes(name)) {
            const j = { px: 0, py: 1, pz: 2 }[name],
                anchor = objectAnchorWorld(o),
                target = name === "py" ? v - 1 : v,
                delta = [0, 0, 0];
            delta[j] = target - anchor[j];
            return moveBy(o, delta);
        }
        if (name === "rot") return rotateCompoundBy(o, v - (Number(o.compoundRot) || 0));
        if (["w", "dp", "h"].includes(name)) {
            const b = obBounds(o),
                axis = { w: 0, dp: 2, h: 1 }[name],
                old = Math.max(0.005, b.hi[axis] - b.lo[axis]),
                pivot = [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2];
            if (name === "h") pivot[1] = b.lo[1];
            return scaleCompoundDefinition(o, pivot, [
                axis === 0 ? Math.max(0.005, v) / old : 1,
                axis === 1 ? Math.max(0.005, v) / old : 1,
                axis === 2 ? Math.max(0.005, v) / old : 1,
            ]);
        }
        return {};
    }
    if (
        o.type === "asset" &&
        o.asset === "recessedStackedBuilding" &&
        ["w", "dp", "h"].includes(name) &&
        typeof recessedStackedBuildingParams === "function"
    ) {
        const q = recessedStackedBuildingParams(o),
            value = Number(v);
        if (!Number.isFinite(value)) return {};
        if (name === "w") return { ra: Math.max(0.25, value * 0.5) };
        if (name === "dp") return { rb: Math.max(0.25, value * 0.5) };
        const upperCount = Math.max(0, q.floorCount - 1);
        if (upperCount > 0) {
            const nextFloorH = clamp(
                (Math.max(0.5, value) - q.firstFloorHeight - upperCount * q.floorGap) / upperCount,
                0.5,
                30,
            );
            return {
                recessedFloorHeight: nextFloorH,
                recessedFirstFloorHeight: q.firstFloorHeight,
                recessedFirstFloorExtra: q.firstFloorHeight - nextFloorH,
                h: q.firstFloorHeight + upperCount * (nextFloorH + q.floorGap),
            };
        }
        const nextFirstH = clamp(Math.max(0.5, value), 0.5, 30);
        return {
            recessedFirstFloorHeight: nextFirstH,
            recessedFirstFloorExtra: nextFirstH - q.floorHeight,
            h: nextFirstH,
        };
    }
    if (o.type === "asset" && o.asset === "building" && ["w", "dp", "h"].includes(name)) {
        const g = buildingGeometry(o);
        if (name === "w")
            return { ra: Math.max(0.05, v / 2), openingW: clamp(g.openingW, 0.1, Math.max(0.1, v - 0.1)) };
        if (name === "dp") {
            const patch = { rb: Math.max(0.025, v / 2) };
            if (Number.isFinite(Number(o.openingBack)))
                patch.openingBack = clamp(Number(o.openingBack), -v / 2 + 0.025, v / 2 - 0.025);
            return patch;
        }
        return { h: Math.max(0.1, v), openingH: clamp(g.openingH, 0.1, Math.max(0.1, v - 0.1)) };
    }
    const [iu, iv] = PL[o.k];
    if (name === "rot") return { rot: v };
    if (name === "w" || name === "dp") {
        const r = Math.max(0.005, v / 2);
        if (o.type === "asset" && o.asset === "sphere") return { ra: r, rb: r, h: r * 2 };
        return o.type === "cyl" ? { ra: r, rb: r } : { [name === "w" ? "ra" : "rb"]: r };
    }
    if (name === "h") {
        if (o.type === "asset" && o.asset === "sphere") {
            const r = Math.max(0.005, v / 2);
            return { ra: r, rb: r, h: r * 2 };
        }
        return o.type === "rect" || o.type === "circ" || (o.type === "asset" && (o.asset === "beveledBox" || o.asset === "track"))
            ? { h: Math.max(0, v), extrude: v > 0 }
            : { h: Math.max(0.005, v) };
    }
    const j = { px: 0, py: 1, pz: 2 }[name],
        vv = (name === "py" ? v - 1 : v) - (o.off ? o.off[j] : 0); // Yは地面からの高さ。図形の座標系に直す
    if (j === iu) return { ca: vv };
    if (j === iv) return { cb: vv };
    return { lift: 1 - vv * o.d };
} // 面に垂直な方向は「浮かせ量」
// パネルの数値を変えたとき（1回の入力ごとに元に戻す履歴を1つだけ作る）
let obS = false,
    lastSel = null;
function applyOb(name, v) {
    const o = sel && obOf(sel);
    if (!o) return;
    if (!obS) {
        HU.push(S);
        RD = [];
        obS = true;
    }
    setOb(sel, fieldPatch(o, name, v));
    render();
}
{
    const r = $("or_rot"),
        n = $("ov_rot");
    r.oninput = () => applyOb("rot", +r.value);
    n.oninput = () => {
        const v = parseFloat(n.value);
        if (!isNaN(v)) applyOb("rot", v);
    };
    r.onchange = n.onchange = () => {
        obS = false;
    };
}
["w", "dp", "h", "px", "py", "pz"].forEach((k) => {
    const n = $("ov_" + k);
    n.oninput = () => {
        const v = parseFloat(n.value);
        if (!isNaN(v)) applyOb(k, v);
    };
    n.onchange = () => {
        obS = false;
    };
});
$("obExtrude").onclick = () => {
    const o = obOf(sel);
    if (!o || !(o.type === "rect" || o.type === "circ" || (o.type === "asset" && (o.asset === "beveledBox" || o.asset === "track")))) return;
    HU.push(S);
    RD = [];
    setOb(sel, { h: Math.max(0.12, Math.min(o.ra, o.rb) * 0.8), extrude: true });
    render();
};
$("obGnd").onclick = () => {
    const objects = selectedObjects();
    if (!objects.length) return;
    const bb = groupBounds(objects),
        dy = -1 - bb.lo[1]; // 一番低い点を地面(y=-1)に合わせる
    HU.push(S);
    RD = [];
    const ids = new Set(objects.map((o) => o.id));
    objects.forEach((o) =>
        setOb(o.id, moveBy(o, [0, dy, 0], !!(o.attachment?.parentId && ids.has(o.attachment.parentId)))),
    );
    render();
};
// 選択中のオブジェクトを複製する。
//   mode = "inplace" … その場（同じ位置）に重ねて複製（Shift+D）。
//   mode = "shift"   … 少し横へずらして複製（パネルの「複製」ボタン。従来の動き）。
// ずらす量以外は共通で、ID・グループ・接続（看板などの親子）を付け替えて再生成する。
function duplicateSelected(mode) {
    const objects = selectedObjects().filter(o => !obLocked(o));
    if (!objects.length) return 0;
    const lead = objects.find((o) => o.id === sel) || objects[0],
        newGroup = objects.length > 1 && objects.some((o) => o.groupId) ? "group-" + uid() : null,
        shift = mode === "inplace" ? 0 : Number(lead.ra || 0.5) * 2.4;
    const idMap = new Map(objects.map((o) => [o.id, uid()]));
    const clones = objects.map((o) => {
        let n = { ...o, id: idMap.get(o.id), off: [...(o.off || [0, 0, 0])] };
        delete n._cityIsolationBefore; // 表示切替中に作った複製は新規物体
        if (o.attachment?.parentId && idMap.has(o.attachment.parentId))
            n.attachment = { ...o.attachment, parentId: idMap.get(o.attachment.parentId) };
        if (o.type === "compound") n = { ...n, ...moveBy(o, [shift, 0, 0]) };
        else if (!o.attachment?.parentId || !idMap.has(o.attachment.parentId)) n.ca = o.ca + shift;
        if (newGroup) n.groupId = newGroup;
        return n;
    });
    HU.push(S);
    S = [...S, ...clones.flatMap((n) => genShape(n))];
    RD = [];
    clearSelection();
    clones.forEach((n) => selIds.add(n.id));
    sel = clones[0].id;
    normalizeSelection();
    // その場に重ねたときは、見た目が変わらないので操作したことが分かるように知らせる。
    if (mode === "inplace" && typeof window.flashHint === "function")
        window.flashHint(`複製しました（${clones.length}個・同じ位置。そのままドラッグで動かせます）`);
    render();
    return clones.length;
}
window.cityGridDuplicateSelected = duplicateSelected;
$("obDup").onclick = () => duplicateSelected("shift");
function deleteSelectedObjects() {
    const objects = selectedObjects(),
        ids = new Set(objects.map((o) => o.id));
    if (!ids.size) return false;
    // 接続アセットの親を消すときは子も、子を消すときは親も一緒に消す。
    S.forEach((s) => {
        const q = s && s.ob;
        if (!q) return;
        if (q.attachment?.parentId && ids.has(q.attachment.parentId)) ids.add(q.id);
        if ([...ids].some((id) => q.id === id) && q.linkedAsset) {
            S.forEach((t) => {
                const n = t && t.ob;
                if (n && n.linkedAsset === q.linkedAsset && n.groupId === q.groupId) ids.add(n.id);
            });
        }
    });
    // ロック中のオブジェクトは消さない。親を残す場合は接続している子も残す
    // （子だけ消えると宙に浮いて、あとから位置を直せなくなるため）。
    [...ids].forEach((id) => {
        if (obLocked(obOf(id))) ids.delete(id);
    });
    let dropped = true;
    while (dropped) {
        dropped = false;
        [...ids].forEach((id) => {
            const q = obOf(id),
                parentId = q?.attachment?.parentId;
            if (parentId && !ids.has(parentId)) {
                ids.delete(id);
                dropped = true;
            }
        });
    }
    if (!ids.size) {
        if (typeof window.flashHint === "function") window.flashHint("ロック中のオブジェクトは削除されません");
        return false;
    }
    HU.push(S);
    S = S.filter((s) => !(s.ob && ids.has(s.ob.id)));
    RD = [];
    clearSelection();
    syncSel();
    render();
    return true;
}
// キーボード操作からも同じ削除処理を呼べるよう、分割版／単体HTML版の両方へ公開する。
window.cityGridDeleteSelected = deleteSelectedObjects;
$("obDel").onclick = deleteSelectedObjects;
$("obOff").onclick = () => {
    clearSelection();
    render();
};
