/* City Grid Studio engine core.
   アプリ全体で共有する状態・座標計算・投影・基本図形・選択を担当する。

   主な流れ
   1. P / S にカメラ設定と線画・オブジェクト定義を保持する
   2. cam / scr / orthPoint でワールド座標を画面へ投影する
   3. genShape で基本図形の線画を生成する
   4. setOb / regenObjects で定義変更と線画再生成を行う
   5. 保存・読込は末尾のpack / unpack系から呼び出す

   アセット固有の線画は asset.js、ギズモ・ドラッグ・描画は engine-tools.js、
   パネルと間取りUIは studio-ui.js に分離している。 */
const $ = (id) => document.getElementById(id);
function isStackedBuildingAsset(o) {
    return o?.type === "asset" && ["stackedBuilding", "beveledStackedBuilding"].includes(o.asset);
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

// ===== パラメータ（初期値の水平回転は参考サイトのy=39.912） =====
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
    ch: 1,
    cx: 0,
    cz: 0,
    sn: 14,
    gs: 1,
    gn: 30,
    dp: 8,
    surfaceMode: false,
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

// ===== 操作パネルの組み立て =====
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
<div id=objP style="display:none">
<h3>選択中のオブジェクト</h3>
${RO("rot", "回転", -180, 180, 0.1, "°")}
<label><span>幅</span><input type=number class=nv id=ov_w step=0.05 style="width:100px"></label>
<label><span>奥行き</span><input type=number class=nv id=ov_dp step=0.05 style="width:100px"></label>
<label><span>高さ</span><input type=number class=nv id=ov_h step=0.05 style="width:100px"></label>
<label><span>位置 X(赤)</span><input type=number class=nv id=ov_px step=0.05 style="width:100px"></label>
<label><span>位置 Y(高さ)</span><input type=number class=nv id=ov_py step=0.05 style="width:100px"></label>
<label><span>位置 Z(緑)</span><input type=number class=nv id=ov_pz step=0.05 style="width:100px"></label>
<div id=signP style="display:none"><h3>看板の内側</h3>
<label><span>絵枠の幅</span><input type=number class=nv id=ov_faceW step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>絵枠の高さ</span><input type=number class=nv id=ov_faceH step=0.01 style="width:100px"><span class=un>m</span></label>
</div>
<div id=buildingP style="display:none"><h3>建物の開口</h3>
<label id=linkedBuildingOpeningRow style="display:none"><input type=checkbox id=linkedBuildingOpening> 開口をつける</label>
<label><span>開口の幅</span><input type=number class=nv id=ov_openingW step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>開口の高さ</span><input type=number class=nv id=ov_openingH step=0.05 style="width:100px"><span class=un>m</span></label>
<div class="note">建物の外形は軸・回転に加え、3Dの白い外側面ハンドルでも幅・奥行き・高さを編集できます。緑のハンドルで開口の幅・高さ、オレンジの「奥の面」で閉じた内壁の奥行きを編集できます。</div>
</div>
<div id=balconyP style="display:none"><h3>壁付けベランダ</h3>
<label><span>手すり／腰壁の高さ</span><input type=number class=nv id=balconyRailHeight min=0.12 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>床スラブの厚さ</span><input type=number class=nv id=balconyFloorThickness min=0.04 step=0.02 style="width:100px"><span class=un>m</span></label>
<label><span>壁の厚さ</span><input type=number class=nv id=balconyRailThickness min=0.035 step=0.02 style="width:100px"><span class=un>m</span></label>
<label><input type=checkbox id=balconyFrontRail checked> 前面の腰壁を表示</label>
<label><input type=checkbox id=balconySideRail checked> 左右の側壁を表示</label>
<div class="note">建物を選択して棚の「壁付けベランダ」を押すと、建物の正面壁へ2階相当の高さで接着します。接着後は親建物の移動・幅・奥行き・高さに追従し、ベランダ単体の幅・奥行き・手すり高さを編集できます。</div>
</div>
<div id=pathPipeP style="display:none"><h3>パスパイプ</h3>
<label><span>パイプ半径</span><input type=number class=nv id=pathPipeRadius min=0.02 step=0.02 style="width:100px"><span class=un>m</span></label>
<label><span>曲がり半径</span><input type=number class=nv id=pathPipeCornerRadius min=0 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>円周分割</span><input type=number class=nv id=pathPipeSides min=6 max=24 step=1 style="width:100px"></label>
<label class=full><span>パス点（x,y,z）</span><textarea id=pathPipePoints rows=4 placeholder="-2,0,1.1; 0,0,1.1; 0,2.2,1.1"></textarea></label>
<div class="note">キャンバス上の各パス点にあるX／Y／Zハンドルをドラッグすると経路を編集できます。オレンジの「半径」ハンドルで太さを変更できます。曲がり半径を0にすると角が直線になります。</div>
</div>
<div id=beveledBoxP style="display:none"><h3>ベベル直方体</h3>
<label><span>ベベルオフセット</span><input type=number class=nv id=beveledBoxOffset min=0 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>ベベルセグメント数</span><input type=number class=nv id=beveledBoxSegments min=1 max=4 step=1 style="width:100px"><span class=un>分割</span></label>
<div class="note">四つの縦角を面取りします。オフセットは面取り幅、セグメント数は角の丸みを分割する数です。1は一枚面、4は4分割です。オフセットはキャンバス上のオレンジのベベルハンドルからも変更できます。幅・奥行き・高さは共通の面ハンドルまたは上の数値欄で編集できます。初期状態は面で、上面を押し出すと高さができます。</div>
</div>
<div id=stackedP style="display:none"><h3 id=stackedPanelTitle>縁付き階層建物</h3>
<label><span>階数</span><input type=number class=nv id=stackFloorCount min=1 max=30 step=1 style="width:100px"></label>
<label><input type=checkbox id=stackIndividualEdit> 各階を個別編集（チェック時のみ）</label>
<label><input type=checkbox id=stackOpening> 1Fに開口をつける</label>
<div id=stackOpeningControls style="display:none">
<label><span>1F開口の幅</span><input type=number class=nv id=stackOpeningW min=0.1 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>1F開口の高さ</span><input type=number class=nv id=stackOpeningH min=0.1 step=0.05 style="width:100px"><span class=un>m</span></label>
<label><span>1F開口の奥面</span><input type=number class=nv id=stackOpeningBack step=0.05 style="width:100px"><span class=un>m</span></label>
<div class="note">開口は1Fだけに作成します。開口幅・高さ・奥面は建物アセットと同じように、設定欄またはキャンバス上の開口ハンドルから編集できます。奥面は建物中心からの位置です。</div>
</div>
<label><span>階間</span><input type=number class=nv id=stackFloorGap min=0 step=0.01 style="width:100px"><span class=un>m</span></label>
<div id=stackBevelControls style="display:none">
<label><span>ベベルオフセット</span><input type=number class=nv id=stackBevelOffset min=0 step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>ベベルセグメント数</span><input type=number class=nv id=stackBevelSegments min=1 max=4 step=1 style="width:100px"><span class=un>分割</span></label>
<div class="note">通常モードでは1Fのベベル設定を全階へ連動します。個別編集を有効にすると、選択中の階だけを変更できます。</div>
</div>
<label><button id=stackAlign class="primary">上方向へ整列</button><button id=stackCopyFirst>1F寸法をコピー</button></label>
<div class="note">通常は1Fのハンドルと数値だけを編集し、幅・奥行・高さ・縁が全階へ自動連動します。チェックを入れると、選択した階を個別に編集できます。</div>
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
<h3>参考写真</h3>
<label><input type=file id=ph accept="image/*"></label>
${R("pa", "写真の濃さ", 0, 1, 0.05)}
<label><button id=phx>写真を外す</button></label>
<div class="note">貼り付け(Ctrl+V)・ドロップも可</div>
<h3>保存</h3>
<div class="note">上の「保存」で今の状態（視点・設定・線画・写真）をファイルに保存し、「開く」で続きから再開できます。<br>このブラウザには3秒ごとに自動保存され、次に開いたとき自動で復元されます。</div>
<label><button id=rst>自動保存を消して初期化</button></label>
<h3>読み取り</h3><div id=info class="note"></div>`;

// ===== 見出しごとに折りたためるようにする（開閉の状態は覚える） =====
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
            "参考写真",
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
// ===== 値の同期 =====
// 画面上の入力欄からPへ値を反映し、表示を更新する共通入口。
function sync() {
    for (const k in P) {
        const el = $("v_" + k);
        if (el && document.activeElement !== el && typeof P[k] === "number") el.value = +(+P[k]).toFixed(3);
    }
    syncSurfaceToggle();
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
    if (orthView === "top" && changedKey !== "pitch") {
        P.pitch = -75;
        const pitchInput = $("pitch");
        if (pitchInput) pitchInput.value = -75;
    }
    orthView = null;
}
function setP(k, v) {
    leaveOrthView(k);
    P[k] = v;
    const input = $(k);
    if (input) input.value = v;
}
for (const k in P) {
    const el = $(k);
    if (!el) continue;
    el.value = P[k];
    el.oninput = () => {
        leaveOrthView(k);
        P[k] = +el.value;
        sync();
        render();
    };
    const nv = $("v_" + k); // 数値の直接入力（スライダーの範囲内に収める。本数だけは3000まで）
    nv.oninput = () => {
        let v = parseFloat(nv.value);
        if (isNaN(v)) return;
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

// ===== 画面サイズに合わせて表示 =====
function fit() {
    const st = $("stage"),
        s = Math.min((st.clientWidth - 12) / W, (st.clientHeight - 12) / H);
    cv.style.width = W * s + "px";
    cv.style.height = H * s + "px";
    render();
}
addEventListener("resize", fit);

// ===== 消失点の計算（カメラ→VP） =====
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

// ===== 魚眼（5点・6点）：視線の球面上で考える。直線は「大円」＝画面では曲線になる =====
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
    sigNow = () => P.ch + "," + P.cx + "," + P.cz + "," + P.yaw + "," + P.pitch + "," + P.roll + "," + T; // カメラの位置／ワールド→カメラからの相対への足し算
// ワールドのベクトル→カメラ座標（水平回転→上下→ロール）
function cam(v) {
    const th = P.yaw * DG,
        ph = P.pitch * DG,
        ro = (T === "f" ? P.roll : 0) * DG;
    const x1 = v[0] * Math.cos(th) + v[2] * Math.sin(th),
        z1 = -v[0] * Math.sin(th) + v[2] * Math.cos(th);
    const y2 = v[1] * Math.cos(ph) - z1 * Math.sin(ph),
        z2 = v[1] * Math.sin(ph) + z1 * Math.cos(ph);
    return [x1 * Math.cos(ro) - y2 * Math.sin(ro), x1 * Math.sin(ro) + y2 * Math.cos(ro), z2];
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

// ===== 線画の保存と再投影：画面の点→ワールドの向き(単位ベクトル)で持つので、視点を変えても追従する =====
// カメラ座標→ワールド（camの逆変換）
function wld(v) {
    const th = P.yaw * DG,
        ph = P.pitch * DG,
        ro = (T === "f" ? P.roll : 0) * DG;
    const x1 = v[0] * Math.cos(ro) + v[1] * Math.sin(ro),
        y2 = -v[0] * Math.sin(ro) + v[1] * Math.cos(ro);
    const y1 = y2 * Math.cos(ph) + v[2] * Math.sin(ph),
        z1 = -y2 * Math.sin(ph) + v[2] * Math.cos(ph);
    return [x1 * Math.cos(th) - z1 * Math.sin(th), y1, x1 * Math.sin(th) + z1 * Math.cos(th)];
}
// Blender風の正投影ビュー。正面=X/Y、真横=Z/Y、真上=X/Zを画面へ置く。
// depthはカメラから遠いほど大きくなり、書き出し時の隠れ線判定にも使う。
function orthBasis() {
    if (orthView === "side") return { right: [0, 0, 1], up: [0, 1, 0], depth: [-1, 0, 0] };
    if (orthView === "top") return { right: [1, 0, 0], up: [0, 0, 1], depth: [0, -1, 0] };
    return { right: [1, 0, 0], up: [0, 1, 0], depth: [0, 0, 1] };
}
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// 間取りモードだけ、オブジェクト群を画面中央へ自動フィットする。
// 通常の9=真上は従来どおり原点中心の正投影を維持する。
const orthPlanCenter = () =>
    window.cityFloorPlanActive && Array.isArray(window.cityFloorPlanCenter) ? window.cityFloorPlanCenter : [0, 0];
const orthScale = () =>
    window.cityFloorPlanActive && Number.isFinite(Number(window.cityFloorPlanScale))
        ? Number(window.cityFloorPlanScale)
        : Math.min(W, H) / 7.2;
// 正面／横／上の間取りビュー専用の正投影。
// right / up / depth の基底を変えるだけで3方向を同じ処理で描画する。
function orthPoint(v) {
    const b = orthBasis(),
        sc = orthScale(),
        pc =
            window.cityFloorPlanActive && (orthView === "top" || orthView === "side" || orthView === "front")
                ? orthPlanCenter()
                : [0, 0];
    let rx = dot3(v, b.right),
        ry = dot3(v, b.up);
    // scrW() は先にカメラ原点へ移すため、正投影では表示軸だけワールド原点へ戻す。
    if (window.cityFloorPlanActive && orthView === "top") {
        rx += P.cx;
        ry += P.cz;
    } else if (window.cityFloorPlanActive && orthView === "side") {
        rx += P.cz;
        ry += P.ch - 1;
    } else if (window.cityFloorPlanActive && orthView === "front") {
        rx += P.cx;
        ry += P.ch - 1;
    }
    return { x: W / 2 + (rx - pc[0]) * sc, y: H / 2 - (ry - pc[1]) * sc, depth: dot3(v, b.depth), ok: true };
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
        const b = orthBasis(),
            sc = orthScale(),
            x = (p.x - W / 2) / sc,
            y = -(p.y - H / 2) / sc,
            pc =
                window.cityFloorPlanActive && (orthView === "top" || orthView === "side" || orthView === "front")
                    ? orthPlanCenter()
                    : [0, 0],
            q = [
                b.right[0] * x + b.up[0] * y + b.depth[0],
                b.right[1] * x + b.up[1] * y + b.depth[1],
                b.right[2] * x + b.up[2] * y + b.depth[2],
            ];
        if (orthView === "top") {
            q[0] += pc[0];
            q[2] += pc[1];
        } else if (window.cityFloorPlanActive && orthView === "side") {
            q[2] += pc[0];
            q[1] += pc[1];
        } else if (window.cityFloorPlanActive && orthView === "front") {
            q[0] += pc[0];
            q[1] += pc[1];
        }
        return V.nrm(q);
    }
    if (T === "f") return wld(bf(p));
    const f = (W * P.lens) / 36;
    return wld(V.nrm([(p.x - W / 2) / f, -(p.y - (H * P.hz) / 100) / f, 1]));
}
// 保存済みの線を今の視点で描く（点の間は球面上で補間するので魚眼でも曲線になる）
// d3=trueの線は3D座標の点（図形）、そうでなければ視線の向き（ペンで描いた線）
function effectiveLineWidth(s) {
    const base = Number(s && s.w);
    return Math.max(0.1, ((Number.isFinite(base) ? base : MASTER_W) * (Number(P.pw) || MASTER_W)) / MASTER_W);
}
function strokeW(c, s) {
    c.strokeStyle = s.c;
    c.lineWidth = effectiveLineWidth(s);
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
    s.p.forEach((v, i) => {
        if (i) {
            const a = s.p[i - 1],
                n = Math.ceil(Math.acos(Math.max(-1, Math.min(1, V.dot(V.nrm(rl(a)), V.nrm(rl(v)))))) / 0.03);
            for (let j = 1; j < n; j++) put(co ? V.add(a, v, 1 - j / n, j / n) : V.nrm(V.add(a, v, 1 - j / n, j / n)));
        }
        put(v);
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

// ===== 図形：パースに沿った 長方形・円・立方体・円柱（3Dで作って視線の向きの線にする） =====
const PL = { 0: [2, 1], 1: [0, 2], 2: [0, 1] }; // 面の法線k → 面内の2軸 (0=X,1=Y,2=Z)
// 複数の定義を「結合」した複合オブジェクト用の座標変換。
// 子パーツは元の定義を保持し、複合オブジェクトのtx/ty/tzだけを動かす。
function translateDefinition(o, vec) {
    if (!o) return o;
    if (o.type === "compound")
        return {
            ...o,
            tx: (Number(o.tx) || 0) + vec[0],
            ty: (Number(o.ty) || 0) + vec[1],
            tz: (Number(o.tz) || 0) + vec[2],
        };
    const q = { ...o, off: [...(o.off || [0, 0, 0])] };
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
function compoundPartsAt(o) {
    const d = [Number(o?.tx) || 0, Number(o?.ty) || 0, Number(o?.tz) || 0];
    return (o?.parts || []).map((part) => translateDefinition(part, d));
}
function genCompoundShape(ob) {
    const out = [];
    compoundPartsAt(ob).forEach((part) =>
        genShape(part).forEach((s) => out.push({ ...s, ob, c: s.c || ob.c, w: s.w || ob.w })),
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
function genShape(ob) {
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
        return [v[0] + off[0], v[1] + off[1], v[2] + off[2]];
    }; // 面内(a,b)を中心まわりに回転＋法線方向の3D点
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
// ===== 図形の編集（選択・移動・回転・大きさ・浮かせる） =====
const obOf = (id) => {
    const s = S.find((s) => s.ob && s.ob.id === id);
    return s && s.ob;
};
const objectVisible = (o) => !o || o.visible !== false;
// 親オブジェクトの面に接続した子を、親の寸法・回転に追従させる。
// attachment.verticalOnly の子は、移動時にこの接続面から離れない。
function syncAttachedPart(o, parentOverride = null) {
    const a = o?.attachment;
    if (!a?.parentId) return o;
    const parent = parentOverride || obOf(a.parentId);
    if (!parent) return o;
    const side = Number(a.side) === -1 ? -1 : 1,
        px = Number(a.x) || 0;
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
        rot = Number(parent.rot || 0) + Number(a.rotOffset || 0);
    return {
        ...o,
        attachment: linkedFace ? { ...a, side: -1 } : { ...a, side },
        k: 1,
        d: -1,
        rot,
        ca: p[0],
        cb: p[2],
        lift: p[1] + 1,
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
        if (!obOf(id)) selIds.delete(id);
    });
    // グループは常に一体選択。行・キャンバスのどのメンバーを選んでも全員を選ぶ。
    [...selIds].forEach((id) => groupMemberIds(id).forEach((member) => selIds.add(member)));
    if (sel && !obOf(sel)) sel = null;
    if (!sel && selIds.size) sel = [...selIds][selIds.size - 1];
    if (sel && !selIds.has(sel)) selIds.add(sel);
}
function setSelection(id, add = false) {
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
}
function clearSelection() {
    sel = null;
    selIds.clear();
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
    let next = { ...o, ...patch };
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
                r = Number(parent.rot || 0) * DG;
            next.attachment = { ...next.attachment, x: dx * Math.cos(r) + dz * Math.sin(r) };
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
            next.attachment = { ...next.attachment, offsetZ: rawBase - parentBase - baseZ };
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
function pickOb(p) {
    let best = null,
        bd = 24 / Z,
        bestAttached = false;
    S.forEach((s) => {
        if (!s.ob || !objectVisible(s.ob)) return;
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
function L2W(o, x, y, z) {
    if (o?.attachment) o = syncAttachedPart(o);
    const [iu, iv] = PL[o.k],
        cs = Math.cos(o.rot * DG),
        sn = Math.sin(o.rot * DG),
        v = [0, 0, 0];
    v[o.k] = o.d - o.d * o.lift - o.d * z;
    v[iu] = o.ca + x * cs - y * sn;
    const f = o.off || [0, 0, 0];
    v[iv] = o.cb + x * sn + y * cs;
    return [v[0] + f[0], v[1] + f[1], v[2] + f[2]];
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
    if (n?.asset === "sign") delete n.bevel;
    return n.off ? n : { ...n, off: [0, 0, 0] };
}
// 選択中の図形の数値を、パネルに表示
function syncSel() {
    normalizeSelection();
    const o = sel && obOf(sel);
    if (sel && !o) sel = null;
    $("objP").style.display = o ? "" : "none";
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
        return o.type === "rect" || o.type === "circ" || (o.type === "asset" && o.asset === "beveledBox")
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
    if (!o || !(o.type === "rect" || o.type === "circ" || (o.type === "asset" && o.asset === "beveledBox"))) return;
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
$("obDup").onclick = () => {
    const objects = selectedObjects();
    if (!objects.length) return;
    const lead = objects.find((o) => o.id === sel) || objects[0],
        newGroup = objects.length > 1 && objects.some((o) => o.groupId) ? "group-" + uid() : null,
        shift = Number(lead.ra || 0.5) * 2.4;
    const idMap = new Map(objects.map((o) => [o.id, uid()]));
    const clones = objects.map((o) => {
        let n = { ...o, id: idMap.get(o.id), off: [...(o.off || [0, 0, 0])] };
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
    render();
};
$("obDel").onclick = () => {
    const objects = selectedObjects(),
        ids = new Set(objects.map((o) => o.id));
    if (!ids.size) return;
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
    HU.push(S);
    S = S.filter((s) => !(s.ob && ids.has(s.ob.id)));
    RD = [];
    clearSelection();
    render();
};
$("obOff").onclick = () => {
    clearSelection();
    render();
};

/* City Grid Studio engine tools.
   選択・ギズモ・スナップ・描画・書き出し・ポインター操作を担当する。

   主な流れ
   1. gizmo / specialGizmo で表示中の操作ハンドルを作る
   2. hitGizmo でクリック対象を決める
   3. beginGizmo / dragEdit でドラッグ量を寸法・位置へ変換する
   4. render で面・線・補助UIを再描画する
   5. 保存・書き出し・タッチ操作を末尾のイベント処理へ接続する

   アセット形状は asset.js、棚・パネル・間取り専用操作は
   asset-controller.js / studio-ui.js が担当する。 */
// ===== ブレンダー風ギズモ：矢印(XYZ軸の移動)・白い四角(面の押し引き)・点線の輪(回転) =====
// 3Dビューでは透視／魚眼、間取りでは正投影へ自動的に振り分ける。
const scr3 = (p) => (orthView ? scr(p) : scr(V.nrm(p)));
const scrW = (p) => scr3(V.add(p, CO())); // ワールド座標の点の画面位置
const cloc = (o) => V.add(camPos(), o.off || [0, 0, 0], 1, -1); // 図形の座標系で見たカメラ位置
const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const segd = (p, a, b) => {
    const dx = b.x - a.x,
        dy = b.y - a.y,
        l = dx * dx + dy * dy || 1e-9,
        t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l));
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
// 視線rと「点Cを通る向きaの直線」の最も近い点の、直線上の位置t（軸に沿った移動量を求める）
function lineParam(r, C, a) {
    const b = V.dot(r, a),
        dd = V.dot(r, C),
        e = V.dot(a, C),
        den = 1 - b * b;
    return den < 1e-6 ? null : (dd * b - e) / den;
}
// 面ハンドルは、3Dの最近接計算だけでなく「画面上で見えている向き」も使う。
// 面の法線が視線に近いと、最近接計算は分母が小さくなり、少しのドラッグで
// 反対方向へ跳ねることがあるため、表示されたハンドルの向きに投影して量を求める。
function faceScreenGuide(face) {
    if (!face?.P3 || !face?.n) return null;
    const base = scrW(face.P3);
    if (!base?.ok) return null;
    // 遠景でも十分な画面差が得られるよう、短いサンプルを段階的に試す。
    for (const step of [0.05, 0.1, 0.2, 0.4, 0.8]) {
        const probe = scrW(V.add(face.P3, face.n, 1, step));
        if (!probe?.ok) continue;
        const dx = probe.x - base.x,
            dy = probe.y - base.y,
            px = Math.hypot(dx, dy);
        if (px >= 0.35)
            return {
                dir: { x: dx / px, y: dy / px },
                scale: px / step,
            };
    }
    // 真正面の奥行き面など、画面上で法線方向が完全につぶれる場合は、
    // 不定な拡縮を起こさず「このビューでは動かない」として扱う。
    return { hidden: true, dir: { x: 0, y: 0 }, scale: Infinity };
}
// ワールド軸の移動量を、オブジェクト定義のca/cb/liftへ戻す。
// 親子接続中は、必要に応じて接着オフセットも保つ。
function moveBy(o, vec, keepAttachedOffset = false) {
    const v = [Number(vec?.[0]) || 0, Number(vec?.[1]) || 0, Number(vec?.[2]) || 0];
    if (o?.type === "compound")
        return { tx: (Number(o.tx) || 0) + v[0], ty: (Number(o.ty) || 0) + v[1], tz: (Number(o.tz) || 0) + v[2] };
    if (o?.attachment?.verticalOnly) {
        v[0] = 0;
        v[2] = 0;
        const patch = { lift: (Number(o.lift) || 0) - o.d * v[1] };
        if (!keepAttachedOffset)
            patch.attachment = { ...o.attachment, offsetZ: (Number(o.attachment.offsetZ) || 0) + v[1] };
        return patch;
    }
    const [iu, iv] = PL[o.k];
    return { ca: o.ca + v[iu], cb: o.cb + v[iv], lift: o.lift - o.d * v[o.k] };
}
// 間取りの回転ハンドルで、地面上の複合オブジェクトを一体回転する。
// 子パーツの定義を壊さず、現在位置をいったんワールド座標へ展開してから戻す。
function rotateCompoundBy(o, deg) {
    if (o?.type !== "compound") return { rot: wrap180((Number(o?.rot) || 0) + deg) };
    const pivot = objectAnchorWorld(o),
        a = Number(deg || 0) * DG,
        cs = Math.cos(a),
        sn = Math.sin(a),
        parts = compoundPartsAt(o).map((part) => {
            const q = { ...part, off: [...(part.off || [0, 0, 0])] };
            if (q.k === 1) {
                const base = L2W(q, 0, 0, 0),
                    dx = base[0] - pivot[0],
                    dz = base[2] - pivot[2],
                    rx = pivot[0] + dx * cs + dz * sn,
                    rz = pivot[2] - dx * sn + dz * cs;
                q.ca = rx - q.off[0];
                q.cb = rz - q.off[2];
                q.rot = wrap180((Number(q.rot) || 0) + Number(deg || 0));
            }
            return q;
        });
    return {
        parts,
        tx: 0,
        ty: 0,
        tz: 0,
        rot: 0,
        compoundRot: (Number(o.compoundRot) || 0) + Number(deg || 0),
        ca: pivot[0],
        cb: pivot[2],
    };
}
// 面を動かしたときの変更内容（反対側の面は動かさない）
function facePatch(o, fid, dl) {
    const cs = Math.cos(o.rot * DG),
        sn = Math.sin(o.rot * DG),
        m = 0.005;
    if (fid === "top") {
        if (o.type === "asset" && o.asset === "sign") {
            // 看板の実外周は0.08h〜0.82h。上端を動かすと下端を固定する。
            const dh = dl / 0.74,
                h = Math.max(m, o.h + dh);
            return { h, extrude: true, lift: o.lift - 0.08 * (h - o.h) };
        }
        return { h: Math.max(m, o.h + dl), extrude: true };
    }
    if (fid === "base") {
        if (o.type === "asset" && o.asset === "sign") {
            // 下端を動かすと上端を固定する。dlは下向き面の移動量。
            const dh = dl / 0.74,
                h = Math.max(m, o.h + dh);
            return { h, extrude: true, lift: o.lift - 0.82 * (h - o.h) };
        }
        const h = Math.max(m, o.h + dl);
        return { h, extrude: true, lift: o.lift - (h - o.h) };
    }
    const sg = fid[1] === "+" ? 1 : -1,
        isU = fid[0] === "u",
        r0 = isU ? o.ra : o.rb,
        r1 = Math.max(m, r0 + dl / 2),
        dr = r1 - r0,
        ex = isU ? [cs, sn] : [-sn, cs];
    const q = { ca: o.ca + sg * dr * ex[0], cb: o.cb + sg * dr * ex[1] };
    if (o.type === "cyl") {
        q.ra = r1;
        q.rb = r1;
    } else if (o.type === "asset" && o.asset === "sphere") {
        q.ra = r1;
        q.rb = r1;
        q.h = r1 * 2;
    } else q[isU ? "ra" : "rb"] = r1;
    return q;
}
function buildingOuterFacePatch(o, fid, dl) {
    const q = facePatch(o, fid, dl),
        w = Math.max(0.1, Math.abs(Number(q.ra ?? o.ra) || 1) * 2),
        d = Math.max(0.05, Math.abs(Number(q.rb ?? o.rb) || 0.5) * 2),
        h = Math.max(0.1, Number(q.h ?? o.h) || 1),
        openingW = clamp(Number(o.openingW) || w * 0.56, 0.1, Math.max(0.1, w - 0.1)),
        openingH = clamp(Number(o.openingH) || h * 0.66, 0.1, Math.max(0.1, h - 0.1)),
        patch = {
            ...q,
            openingW: Math.min(openingW, Math.max(0.1, w - 0.1)),
            openingH: Math.min(openingH, Math.max(0.1, h - 0.1)),
        };
    if (Number.isFinite(Number(o.openingBack)))
        patch.openingBack = clamp(Number(o.openingBack), -d / 2 + 0.025, d / 2 - 0.025);
    return patch;
}
// 看板の黒い外枠を構成する実高さ。全高の上下余白は外形ハンドルの対象にしない。
function outerZRange(o) {
    const h = Math.max(0, Number(o?.h) || 0);
    return o?.type === "asset" && o?.asset === "sign" ? [h * 0.08, h * 0.82] : [0, h];
}
// 看板の絵枠は常にカメラ側の面へ出す。反対側へ回り込んだ3D視点でも、
// 編集ハンドルが看板の裏へ隠れず、実際に見えている面を編集できるようにする。
function signFaceDepth(o, gap = 0.018) {
    const [iu, iv] = PL[o.k],
        cs = Math.cos(Number(o.rot || 0) * DG),
        sn = Math.sin(Number(o.rot || 0) * DG),
        ev = [0, 0, 0];
    ev[iu] = -sn;
    ev[iv] = cs;
    const base = L2W(o, 0, 0, 0),
        rel = V.add(camPos(), base, 1, -1),
        side = V.dot(rel, ev) >= 0 ? 1 : -1,
        depth = Math.max(0.02, Math.abs(Number(o.rb) || 0.1));
    return side * (depth + gap);
}
// 看板専用のビュー内ハンドル。内側の絵枠の幅・高さを、
// 左の数値欄だけでなくキャンバス上のハンドルをドラッグして編集できる。
function signGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "sign") return null;
    const w = Math.max(0.08, o.ra * 2),
        d = Math.max(0.04, o.rb * 2),
        h = Math.max(0.08, o.h || 1),
        fy = signFaceDepth(o);
    const board0 = 0.08 * h,
        board1 = 0.82 * h;
    const maxW = w * 0.9,
        maxH = (board1 - board0) * 0.84;
    const faceW = clamp(Number(o.faceW) || w * 0.7, 0.08, maxW),
        faceH = clamp(Number(o.faceH) || h * 0.34, 0.08, maxH);
    const pr = (x, y, z) => scrW(L2W(o, x, y, z));
    const iz0 = (board0 + board1 - faceH) / 2,
        iz1 = iz0 + faceH,
        zm = (iz0 + iz1) / 2;
    const center = pr(0, fy, zm),
        right = pr(faceW / 2, fy, zm),
        top = pr(0, fy, iz1),
        frame = [pr(-faceW / 2, fy, iz0), pr(faceW / 2, fy, iz0), pr(faceW / 2, fy, iz1), pr(-faceW / 2, fy, iz1)];
    const make = (kind, anchor, probe, base, min, max, fallbackAxis = null) => {
        const dx = probe.x - anchor.x,
            dy = probe.y - anchor.y,
            step = Math.max(0.0001, Number(probe._step) || 0.05),
            px = Math.hypot(dx, dy);
        // 真横では絵枠の幅(X)が投影上つぶれ、真上では高さ(Y)がつぶれる。
        // 投影が縮退しても、緑の四角は絵枠の実際の辺から離さない。
        // ドラッグ方向だけを画面軸へ固定し、見た目のアンカーは常に元の点に置く。
        if (fallbackAxis && (!anchor?.ok || !probe?.ok || px < 6 / Z)) {
            const dir = fallbackAxis === "x" ? { x: 1, y: 0 } : { x: 0, y: -1 };
            return {
                kind,
                s: anchor,
                dir,
                scale: orthView ? Math.max(1, orthScale()) : Math.max(24, px / step || 1),
                start: base,
                min,
                max,
                fallback: true,
            };
        }
        return {
            kind,
            s: anchor,
            dir: { x: dx / (px || 1), y: dy / (px || 1) },
            scale: px / step || 1,
            start: base,
            min,
            max,
        };
    };
    // _step is kept on the temporary projected point so the screen scale can be measured.
    const pw = Math.max(0.05, w * 0.12),
        ph = Math.max(0.05, h * 0.1);
    const rw = pr(faceW / 2 + pw, fy, zm);
    rw._step = pw;
    const ht = pr(0, fy, iz1 + ph);
    ht._step = ph;
    const handles = {
        faceW: make("faceW", right, rw, faceW, 0.08, maxW, "x"),
        faceH: make("faceH", top, ht, faceH, 0.08, maxH, "y"),
    };
    return { o, C3: L2W(o, 0, 0, (board0 + board1) / 2), center, frame, handles };
}
function coneGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "cone") return null;
    const h = Math.max(0.02, o.h || 1),
        base = L2W(o, 0, 0, 0),
        apex = L2W(o, 0, 0, h),
        bp = scrW(base),
        ap = scrW(apex),
        step = Math.max(0.08, h * 0.12),
        probe = scrW(L2W(o, 0, 0, h + step));
    const dx = probe.x - ap.x,
        dy = probe.y - ap.y,
        sc = Math.hypot(dx, dy) / step;
    return {
        o,
        C3: L2W(o, 0, 0, h / 2),
        base: bp,
        apex: ap,
        handle: {
            kind: "height",
            s: ap,
            dir: { x: dx / (Math.hypot(dx, dy) || 1), y: dy / (Math.hypot(dx, dy) || 1) },
            scale: sc || 1,
            start: h,
            min: 0.02,
            max: 20,
        },
    };
}
function sphereGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "sphere") return null;
    const r = Math.min(2 * o.ra, 2 * o.rb, o.h) * 0.5,
        center = L2W(o, 0, 0, o.h * 0.5),
        right = V.nrm(wld([1, 0, 0])),
        cp = scrW(center),
        edge = scrW(V.add(center, right, r)),
        probe = scrW(V.add(center, right, r + 0.1));
    const dx = probe.x - edge.x,
        dy = probe.y - edge.y,
        sc = Math.hypot(dx, dy) / 0.1;
    return {
        o,
        C3: center,
        center: cp,
        edge,
        handle: {
            kind: "radius",
            s: edge,
            dir: { x: dx / (Math.hypot(dx, dy) || 1), y: dy / (Math.hypot(dx, dy) || 1) },
            scale: sc || 1,
            start: r,
            min: 0.02,
            max: 20,
        },
    };
}
function buildingBackY(o, d) {
    const half = Math.max(0.025, d * 0.5),
        stored = Number(o?.openingBack);
    if (Number.isFinite(stored)) return clamp(stored, -half + 0.025, half - 0.025);
    const far = -buildingFaceDepth(o);
    return far >= 0 ? half - 0.025 : -half + 0.025;
}
function buildingGeometry(o) {
    const w = Math.max(0.1, Math.abs(Number(o.ra) || 1) * 2),
        d = Math.max(0.05, Math.abs(Number(o.rb) || 0.5) * 2),
        h = Math.max(0.1, Number(o.h) || 1),
        openingW = clamp(Number(o.openingW) || w * 0.56, 0.1, Math.max(0.1, w - 0.1)),
        openingH = clamp(Number(o.openingH) || h * 0.66, 0.1, Math.max(0.1, h - 0.1)),
        backY = buildingBackY(o, d);
    return { w, d, h, openingW, openingH, backY };
}
function buildingFaceDepth(o) {
    const base = L2W(o, 0, 0, 0),
        edge = L2W(o, 0, 1, 0),
        axis = V.nrm(V.add(edge, base, 1, -1)),
        rel = V.add(camPos(), base, 1, -1),
        half = Math.abs(Number(o.rb) || 0.1);
    return (V.dot(rel, axis) >= 0 ? 1 : -1) * (half + 0.025);
}
function buildingGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "building" || o.openingEnabled === false) return null;
    const g = buildingGeometry(o),
        half = Math.abs(Number(o.rb) || 0.1),
        near = buildingFaceDepth(o) >= 0 ? half : -half,
        far = -near,
        pr = (x, y, z) => scrW(L2W(o, x, y, z)),
        stepW = Math.max(0.05, g.w * 0.06),
        stepH = Math.max(0.05, g.h * 0.06),
        mk = (kind, s, q, start, min, max, factor = 1) => {
            const dx = q.x - s.x,
                dy = q.y - s.y,
                px = Math.hypot(dx, dy) || 1;
            return {
                kind,
                s,
                dir: { x: dx / px, y: dy / px },
                scale: px / (kind.includes("openingH") ? stepH : stepW) || 1,
                start,
                min,
                max,
                factor,
            };
        };
    const makeFace = (prefix, y) => {
        const center = pr(0, y, g.openingH * 0.5),
            left = pr(-g.openingW * 0.5, y, g.openingH * 0.5),
            right = pr(g.openingW * 0.5, y, g.openingH * 0.5),
            top = pr(0, y, g.openingH),
            lw = pr(-g.openingW * 0.5 - stepW, y, g.openingH * 0.5),
            rw = pr(g.openingW * 0.5 + stepW, y, g.openingH * 0.5),
            th = pr(0, y, g.openingH + stepH),
            tag = prefix === "front" ? "" : "Back";
        return {
            center,
            frame: [
                pr(-g.openingW * 0.5, y, 0),
                pr(-g.openingW * 0.5, y, g.openingH),
                pr(g.openingW * 0.5, y, g.openingH),
                pr(g.openingW * 0.5, y, 0),
            ],
            handles: {
                [prefix + "OpeningWLeft"]: mk(
                    prefix + "OpeningWLeft",
                    left,
                    lw,
                    g.openingW,
                    0.1,
                    Math.max(0.1, g.w - 0.1),
                    2,
                ),
                [prefix + "OpeningWRight"]: mk(
                    prefix + "OpeningWRight",
                    right,
                    rw,
                    g.openingW,
                    0.1,
                    Math.max(0.1, g.w - 0.1),
                    2,
                ),
                [prefix + "OpeningH"]: mk(prefix + "OpeningH", top, th, g.openingH, 0.1, Math.max(0.1, g.h - 0.1)),
            },
            tag,
        };
    };
    const front = makeFace("front", near),
        back = makeFace("back", far),
        panelY = g.backY,
        panelFrame = [
            pr(-g.openingW * 0.5, panelY, 0),
            pr(-g.openingW * 0.5, panelY, g.openingH),
            pr(g.openingW * 0.5, panelY, g.openingH),
            pr(g.openingW * 0.5, panelY, 0),
        ],
        panelCenter = pr(0, panelY, g.openingH * 0.5),
        panelProbe = pr(0, panelY + (panelY >= 0 ? 0.1 : -0.1), g.openingH * 0.5),
        pdx = panelProbe.x - panelCenter.x,
        pdy = panelProbe.y - panelCenter.y,
        ppx = Math.hypot(pdx, pdy),
        backFace = {
            kind: "backFace",
            s: panelCenter,
            dir: { x: pdx / (ppx || 1), y: pdy / (ppx || 1) },
            scale: ppx / 0.1 || 1,
            start: panelY,
            min: -half + 0.025,
            max: half - 0.025,
            factor: 1,
            side: panelY >= 0 ? 1 : -1,
            face: true,
        };
    return {
        o,
        C3: L2W(o, 0, 0, g.h * 0.5),
        center: front.center,
        backCenter: back.center,
        frame: front.frame,
        backFrame: back.frame,
        panelFrame,
        panelCenter,
        handles: { ...front.handles, ...back.handles, backFace },
    };
}
function awningGeometry(o) {
    const w = Math.max(0.1, Math.abs(Number(o.ra) || 1) * 2),
        d = Math.max(0.05, Math.abs(Number(o.rb) || 0.5) * 2),
        h = Math.max(0.1, Number(o.h) || 1),
        half = d / 2,
        edgeY = clamp(
            Number.isFinite(Number(o.awningEdgeY)) ? Number(o.awningEdgeY) : -half,
            -half + 0.025,
            half - 0.025,
        ),
        edgeZ = clamp(
            Number.isFinite(Number(o.awningEdgeZ)) ? Number(o.awningEdgeZ) : h,
            0.05,
            Math.max(0.05, h - 0.02),
        ),
        thickness = clamp(Number(o.awningThickness) || Math.max(0.05, h * 0.14), 0.03, Math.max(0.03, h * 0.45)),
        frontBottom = clamp(
            Number.isFinite(Number(o.awningFrontBottom)) ? Number(o.awningFrontBottom) : 0,
            0,
            Math.max(0, edgeZ - 0.03),
        ),
        backBottom = clamp(
            Number.isFinite(Number(o.awningBackBottom)) ? Number(o.awningBackBottom) : 0,
            0,
            Math.max(0, h - 0.03),
        );
    return { w, d, h, half, baseFrontY: -half, edgeY, edgeZ, thickness, frontBottom, backBottom };
}
function awningGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "awning") return null;
    const g = awningGeometry(o),
        edgeY = g.edgeY,
        pr = (x, y, z) => scrW(L2W(o, x, y, z)),
        s = pr(0, edgeY, g.edgeZ),
        qz = pr(0, edgeY, g.edgeZ + 0.1),
        qy = pr(0, edgeY + 0.1, g.edgeZ),
        zdx = qz.x - s.x,
        zdy = qz.y - s.y,
        zpx = Math.hypot(zdx, zdy) || 1,
        ydx = qy.x - s.x,
        ydy = qy.y - s.y,
        ypx = Math.hypot(ydx, ydy) || 1;
    const handles = {
        edgeZ: {
            kind: "edgeZ",
            s,
            dir: { x: zdx / zpx, y: zdy / zpx },
            scale: zpx / 0.1 || 1,
            start: g.edgeZ,
            min: 0.05,
            max: g.h - 0.02,
            frontBottom: g.frontBottom,
        },
    };
    if (!o.attachment?.verticalOnly)
        handles.edgeY = {
            kind: "edgeY",
            s: qy,
            dir: { x: ydx / ypx, y: ydy / ypx },
            scale: ypx / 0.1 || 1,
            start: g.edgeY,
            min: -g.d / 2 + 0.025,
            max: g.d / 2 - 0.025,
        };
    return {
        o,
        C3: L2W(o, 0, 0, (g.edgeZ + g.h) * 0.5),
        edge: s,
        frame: [
            pr(-g.w / 2, edgeY, g.edgeZ),
            pr(g.w / 2, edgeY, g.edgeZ),
            pr(g.w / 2, g.d / 2, g.h),
            pr(-g.w / 2, g.d / 2, g.h),
        ],
        handles,
        handle: null,
    };
}
function stackedIndividualEdit(o) {
    // 新形式はindividualEditを優先し、旧JSONのsyncFirst=falseも個別編集として読む。
    return o?.individualEdit === true || (o?.individualEdit == null && o?.syncFirst === false);
}
function stackedBevelHandle(o, f, index) {
    if (!isBeveledStackedBuildingAsset(o) || !f) return null;
    const w = Math.max(0.08, Math.abs(Number(f.w) || 4)),
        d = Math.max(0.08, Math.abs(Number(f.d) || 3)),
        h = Math.max(0.08, Math.abs(Number(f.h) || 2.2)),
        x = Number(f.x) || 0,
        y = Number(f.y) || 0,
        z = Number(f.z) || 0,
        max = Math.max(0, Math.min(w, d) * 0.5 - 0.001),
        start = clamp(
            Number.isFinite(Number(f.bevelOffset)) ? Number(f.bevelOffset) : Number(o.bevelOffset) || 0.28,
            0,
            max,
        ),
        pr = (px, py, pz) => scrW(customPt(o, px, py, pz)),
        anchor = pr(x + w * 0.5, y + d * 0.5, z + h),
        step = Math.max(0.05, Math.min(max || 0.25, Math.min(w, d) * 0.08)),
        sample = (b) => pr(x + w * 0.5 - b * 0.5, y + d * 0.5 - b * 0.5, z + h),
        raw = sample(start),
        probe = sample(Math.min(max, start + step)),
        dx = (probe?.x || 0) - (raw?.x || 0),
        dy = (probe?.y || 0) - (raw?.y || 0),
        length = Math.hypot(dx, dy),
        projected = !!raw?.ok && !!probe?.ok && Number.isFinite(length),
        hidden = projected && length <= 0.5 / Z,
        fallback = orthView === "top" ? { x: -Math.SQRT1_2, y: -Math.SQRT1_2 } : { x: -1, y: -0.35 };
    return {
        kind: "stacked-bevel-offset",
        s: !raw?.ok
            ? raw
            : hidden
              ? {
                    x: raw.x + fallback.x * Math.max(30 / Z, 42 / Z),
                    y: raw.y + fallback.y * Math.max(30 / Z, 42 / Z),
                    ok: true,
                }
              : raw,
        anchor,
        dir: projected && length > 0.0001 ? { x: dx / length, y: dy / length } : fallback,
        scale:
            projected && length > 0.0001
                ? length / Math.max(0.0001, Math.min(step, max - start || step))
                : Math.max(24, orthView ? orthScale() : 24),
        start,
        min: 0,
        max,
        floorIndex: index,
        label: "ベベル",
    };
}
function stackedOpeningGizmo(o) {
    if (!isStackedBuildingAsset(o) || !stackedOpeningEnabled(o)) return null;
    const floors = Array.isArray(o.floors) && o.floors.length ? o.floors : [];
    if (!floors.length || typeof stackedOpeningParams !== "function") return null;
    const f = floors[0],
        g = stackedOpeningParams(o, f),
        fx = Number(f.x) || 0,
        fy = Number(f.y) || 0,
        fz = Number(f.z) || 0,
        near = -g.d * 0.5,
        far = g.d * 0.5,
        pr = (x, y, z) => scrW(customPt(o, fx + x, fy + y, fz + z)),
        stepW = Math.max(0.05, g.w * 0.06),
        stepH = Math.max(0.05, g.h * 0.06),
        mk = (kind, s, q, start, min, max, step, factor = 1) => {
            const dx = q.x - s.x,
                dy = q.y - s.y,
                length = Math.hypot(dx, dy),
                hidden = !Number.isFinite(length) || length <= 0.5 / Z,
                fallback =
                    kind === "stacked-opening-h"
                        ? { x: 0, y: -1 }
                        : kind.endsWith("left")
                          ? { x: -1, y: 0 }
                          : { x: 1, y: 0 },
                gap = Math.max(30 / Z, Math.min(54 / Z, 0.34 * Math.max(1, Number(orthScale()) || 1))),
                display = hidden ? { ...s, x: s.x + fallback.x * gap, y: s.y + fallback.y * gap, ok: true } : s;
            return {
                kind,
                s: display,
                dir: hidden ? fallback : { x: dx / length, y: dy / length },
                scale: hidden ? Math.max(24, orthView ? orthScale() : 24) : length / step || 1,
                start,
                min,
                max,
                factor,
            };
        },
        left = pr(-g.openingW * 0.5, near, g.openingH * 0.5),
        right = pr(g.openingW * 0.5, near, g.openingH * 0.5),
        top = pr(0, near, g.openingH),
        backCenter = pr(0, g.openingBack, g.openingH * 0.5),
        front = {
            center: pr(0, near, g.openingH * 0.5),
            frame: [
                pr(-g.openingW * 0.5, near, 0),
                pr(-g.openingW * 0.5, near, g.openingH),
                pr(g.openingW * 0.5, near, g.openingH),
                pr(g.openingW * 0.5, near, 0),
            ],
            handles: {
                left: mk(
                    "stacked-opening-w-left",
                    left,
                    pr(-g.openingW * 0.5 - stepW, near, g.openingH * 0.5),
                    g.openingW,
                    0.1,
                    Math.max(0.1, g.w - 0.1),
                    stepW,
                    2,
                ),
                right: mk(
                    "stacked-opening-w-right",
                    right,
                    pr(g.openingW * 0.5 + stepW, near, g.openingH * 0.5),
                    g.openingW,
                    0.1,
                    Math.max(0.1, g.w - 0.1),
                    stepW,
                    2,
                ),
                height: mk(
                    "stacked-opening-h",
                    top,
                    pr(0, near, g.openingH + stepH),
                    g.openingH,
                    0.1,
                    Math.max(0.1, g.h - g.rimHeight - 0.01),
                    stepH,
                ),
            },
        },
        backFrame = [
            pr(-g.openingW * 0.5, far, 0),
            pr(-g.openingW * 0.5, far, g.openingH),
            pr(g.openingW * 0.5, far, g.openingH),
            pr(g.openingW * 0.5, far, 0),
        ],
        panelFrame = [
            pr(-g.openingW * 0.5, g.openingBack, 0),
            pr(-g.openingW * 0.5, g.openingBack, g.openingH),
            pr(g.openingW * 0.5, g.openingBack, g.openingH),
            pr(g.openingW * 0.5, g.openingBack, 0),
        ],
        panelProbe = pr(0, g.openingBack + (g.openingBack >= 0 ? 0.1 : -0.1), g.openingH * 0.5),
        pdx = panelProbe.x - backCenter.x,
        pdy = panelProbe.y - backCenter.y,
        ppx = Math.hypot(pdx, pdy),
        panelProjected = Number.isFinite(ppx) && ppx > 0.5 / Z,
        panelDir = panelProjected ? { x: pdx / ppx, y: pdy / ppx } : { x: 1, y: 0 },
        panelScale = panelProjected ? ppx / 0.1 : Math.max(24, orthView ? orthScale() : 24);
    return {
        o,
        opening: g,
        front,
        backFrame,
        panelFrame,
        panelCenter: backCenter,
        handles: {
            ...front.handles,
            backFace: {
                kind: "stacked-opening-back",
                s: backCenter,
                dir: panelDir,
                scale: panelScale,
                start: g.openingBack,
                min: -g.d * 0.5 + 0.025,
                max: g.d * 0.5 - 0.025,
                factor: 1,
                side: g.openingBack >= 0 ? 1 : -1,
            },
        },
        C3: customPt(o, fx, fy, fz + g.h * 0.5),
    };
}
function stackedBuildingGizmo(o) {
    if (!isStackedBuildingAsset(o)) return null;
    const floors = Array.isArray(o.floors) && o.floors.length ? o.floors : [];
    if (!floors.length) return null;
    const index = stackedIndividualEdit(o) ? clamp(Math.round(Number(o.activeFloor) || 0), 0, floors.length - 1) : 0,
        f = floors[index],
        w = Math.max(0.08, Math.abs(Number(f.w) || 4)),
        d = Math.max(0.08, Math.abs(Number(f.d) || 3)),
        h = Math.max(0.08, Math.abs(Number(f.h) || 2.2)),
        x = Number(f.x) || 0,
        y = Number(f.y) || 0,
        z = Number(f.z) || 0,
        p3 = (px, py, pz) => customPt(o, px, py, pz),
        pr = (px, py, pz) => scrW(p3(px, py, pz)),
        center = pr(x, y, z + h * 0.5),
        make = (kind, px, py, pz, axis, sign, label) => {
            const s = pr(px, py, pz),
                step = axis === "h" ? Math.max(0.05, h * 0.08) : Math.max(0.05, (axis === "w" ? w : d) * 0.08),
                q =
                    axis === "w"
                        ? pr(px + step * sign, py, pz)
                        : axis === "d"
                          ? pr(px, py + step * sign, pz)
                          : pr(px, py, pz + step),
                dx = q.x - s.x,
                dy = q.y - s.y,
                pxLen = Math.hypot(dx, dy),
                hidden = pxLen <= 0.5 / Z,
                fallback = axis === "h" ? { x: 0, y: -1 } : { x: 1, y: 0 },
                displayGap = Math.max(30 / Z, Math.min(54 / Z, 0.34 * Math.max(1, Number(orthScale()) || 1))),
                display = hidden ? { x: s.x + fallback.x * displayGap, y: s.y + fallback.y * displayGap, ok: true } : s;
            return {
                kind,
                s: display,
                dir: hidden ? fallback : { x: dx / pxLen, y: dy / pxLen },
                scale: hidden ? Math.max(24, orthView ? orthScale() : 24) : pxLen / step,
                start: axis === "w" ? w : axis === "d" ? d : h,
                min: 0.08,
                max: 30,
                axis,
                sign,
                floorIndex: index,
                label,
            };
        },
        handles = {
            widthLeft: make("stacked-width", x - w * 0.5, y, z + h * 0.5, "w", -1, "幅"),
            widthRight: make("stacked-width", x + w * 0.5, y, z + h * 0.5, "w", 1, "幅"),
            depthLeft: make("stacked-depth", x, y - d * 0.5, z + h * 0.5, "d", -1, "奥行"),
            depthRight: make("stacked-depth", x, y + d * 0.5, z + h * 0.5, "d", 1, "奥行"),
            height: make("stacked-height", x, y, z + h, "h", 1, "高さ"),
        },
        frame = [pr(x - w / 2, y, z), pr(x - w / 2, y, z + h), pr(x + w / 2, y, z + h), pr(x + w / 2, y, z)],
        bevelHandle = stackedBevelHandle(o, f, index),
        opening = stackedOpeningGizmo(o);
    return { o, C3: p3(x, y, z + h * 0.5), center, frame, handles, bevelHandle, opening, floorIndex: index };
}
function pathPipeGizmo(o) {
    if (
        !o ||
        o.type !== "asset" ||
        o.asset !== "pathPipe" ||
        typeof pathPipeControlPoints !== "function" ||
        typeof pathPipeMesh !== "function" ||
        typeof pt !== "function"
    )
        return null;
    const points = pathPipeControlPoints(o),
        pr = (v) => scrW(pt(o, v[0], v[1], v[2])),
        controlPoints = points.map((v) => pr(v)),
        pathHandles = [],
        axisNames = ["X", "Y", "Z"],
        axisColors = ["#e8743d", "#4a7be8", "#2fb5a5"],
        // 正面／横ビューでは、経路の別の点が投影上で同じ場所になることがある
        // （例：奥行きだけが違う2点）。同じ画面座標へ全ハンドルを重ねると
        // hitGizmoが常に先頭の点を返すため、重なった点の操作列を扇状に分ける。
        pointFan = controlPoints.map((anchor, index) => {
            const peers = controlPoints
                .map((q, i) => (q?.ok && anchor?.ok && Math.hypot(q.x - anchor.x, q.y - anchor.y) < 12 / Z ? i : -1))
                .filter((i) => i >= 0);
            if (peers.length < 2) return { x: 0, y: 0 };
            const rank = peers.indexOf(index),
                lane = rank - (peers.length - 1) * 0.5,
                gap = Math.max(44 / Z, Math.min(64 / Z, 0.42 * Math.max(1, Number(orthScale()) || 1))),
                d = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
            return { x: d.x * lane * gap, y: d.y * lane * gap };
        });
    points.forEach((v, index) => {
        const rawAnchor = pr(v),
            fan = pointFan[index] || { x: 0, y: 0 },
            anchor = rawAnchor?.ok ? { ...rawAnchor, x: rawAnchor.x + fan.x, y: rawAnchor.y + fan.y } : rawAnchor;
        [0, 1, 2].forEach((axis) => {
            const step = Math.max(0.18, (Number(o.pipeRadius) || 0.18) * 2.4),
                probePoint = [...v];
            probePoint[axis] += step;
            const probe = pr(probePoint),
                dx = probe.x - rawAnchor.x,
                dy = probe.y - rawAnchor.y,
                length = Math.hypot(dx, dy),
                fallback = axis === 2 ? { x: 0, y: -1 } : { x: 1, y: 0 },
                projected = !!probe?.ok && Number.isFinite(dx) && Number.isFinite(dy) && Number.isFinite(length),
                hidden = !projected || length <= 0.5 / Z,
                // 正面／横／上では奥行きまたは高さの軸が画面へつぶれる。
                // そのまま中心点へ重ねると、制御点を押しても別軸を拾ったり、
                // 「押せるハンドルがない」ように見えるため、画面上へ逃がす。
                displayGap = Math.max(30 / Z, Math.min(54 / Z, 0.34 * Math.max(1, Number(orthScale()) || 1))),
                display = hidden
                    ? { x: anchor.x + fallback.x * displayGap, y: anchor.y + fallback.y * displayGap, ok: true }
                    : { ...probe, x: probe.x + fan.x, y: probe.y + fan.y };
            pathHandles.push({
                kind: `path-point-${index}-${axis}`,
                index,
                axis,
                s: display,
                anchor,
                dir: hidden ? fallback : { x: dx / length, y: dy / length },
                scale: hidden ? Math.max(24, orthView ? orthScale() : 24) : length / step,
                start: Number(v[axis]) || 0,
                min: -50,
                max: 50,
                label: axisNames[axis],
                color: axisColors[axis],
            });
        });
    });
    const mesh = pathPipeMesh(o),
        radius = Math.max(0.02, Number(o.pipeRadius) || 0.18),
        radiusAnchor = controlPoints[0],
        radiusPoint = mesh.rings[0]?.[0] ? pr(mesh.rings[0][0]) : radiusAnchor,
        rdx = radiusPoint.x - radiusAnchor.x,
        rdy = radiusPoint.y - radiusAnchor.y,
        rLength = Math.hypot(rdx, rdy),
        radiusProjected =
            !!radiusPoint?.ok &&
            !!radiusAnchor?.ok &&
            Number.isFinite(rdx) &&
            Number.isFinite(rdy) &&
            Number.isFinite(rLength),
        radiusHidden = !radiusProjected || rLength <= 0.5 / Z,
        radiusFallback = orthView === "top" ? { x: 0, y: 1 } : { x: -1, y: 0 },
        radiusGap = Math.max(34 / Z, Math.min(58 / Z, 0.38 * Math.max(1, Number(orthScale()) || 1))),
        radiusDisplay = radiusHidden
            ? {
                  x: radiusAnchor.x + radiusFallback.x * radiusGap,
                  y: radiusAnchor.y + radiusFallback.y * radiusGap,
                  ok: true,
              }
            : radiusPoint;
    return {
        o,
        C3: L2W(o, points[0][0], points[0][1], points[0][2]),
        controlPoints,
        pathHandles,
        radiusHandle: {
            kind: "path-radius",
            s: radiusDisplay,
            anchor: radiusAnchor,
            dir: radiusHidden ? radiusFallback : { x: rdx / rLength, y: rdy / rLength },
            scale: radiusHidden ? Math.max(24, orthView ? orthScale() : 24) : rLength / radius,
            start: radius,
            min: 0.02,
            max: 5,
        },
    };
}
function beveledBoxGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "beveledBox" || typeof beveledBoxParams !== "function") return null;
    const q = beveledBoxParams(o),
        z = Math.max(0, Number(o.h) || 0),
        x = q.w * 0.5,
        y = q.d * 0.5,
        pr = (px, py, pz) => scrW(pt(o, px, py, pz)),
        anchor = pr(x, y, z),
        step = Math.max(0.05, Math.min(q.max || 0.25, Math.min(q.w, q.d) * 0.08)),
        sample = (b) => pr(x - b * 0.5, y - b * 0.5, z),
        raw = sample(q.bevelOffset),
        probe = sample(Math.min(q.max, q.bevelOffset + step)),
        dx = (probe?.x || 0) - (raw?.x || 0),
        dy = (probe?.y || 0) - (raw?.y || 0),
        length = Math.hypot(dx, dy),
        projected = !!raw?.ok && !!probe?.ok && Number.isFinite(length),
        hidden = projected && length <= 0.5 / Z,
        fallback = orthView === "top" ? { x: -Math.SQRT1_2, y: -Math.SQRT1_2 } : { x: -1, y: -0.35 },
        visibleDir = hidden ? fallback : { x: dx / length, y: dy / length },
        // 断面の実点は外周線のすぐ内側にあるため、そこへハンドルを置くと
        // 面／移動ギズモと重なって「移動できない」ように見える。表示だけを
        // 外側へ逃がし、編集量の方向とスケールは実点の投影から保つ。
        displayGap = Math.max(48 / Z, 56 / Z),
        displayS = !raw?.ok
            ? raw
            : hidden
              ? {
                    x: raw.x + fallback.x * Math.max(30 / Z, 42 / Z),
                    y: raw.y + fallback.y * Math.max(30 / Z, 42 / Z),
                    ok: true,
                }
              : {
                    x: raw.x - visibleDir.x * displayGap,
                    y: raw.y - visibleDir.y * displayGap,
                    ok: true,
                },
        handle = {
            kind: "beveled-offset",
            s: displayS,
            anchor,
            dir: visibleDir,
            scale: hidden
                ? Math.max(24, orthView ? orthScale() : 24)
                : length / Math.max(0.0001, Math.min(step, q.max - q.bevelOffset || step)),
            start: q.bevelOffset,
            min: 0,
            max: q.max,
            label: "ベベル",
        };
    return { o, C3: L2W(o, 0, 0, z * 0.5), center: scrW(L2W(o, 0, 0, z * 0.5)), handle };
}
function specialGizmo(o) {
    return o && o.type === "asset" && o.asset === "beveledBox"
        ? beveledBoxGizmo(o)
        : o && o.type === "asset" && o.asset === "pathPipe"
          ? pathPipeGizmo(o)
          : isStackedBuildingAsset(o)
            ? stackedBuildingGizmo(o)
            : o && o.type === "asset" && o.asset === "building"
              ? buildingGizmo(o)
              : o && o.type === "asset" && o.asset === "awning"
                ? awningGizmo(o)
                : o && o.type === "asset" && o.asset === "sign"
                  ? signGizmo(o)
                  : o && o.type === "asset" && o.asset === "cone"
                    ? coneGizmo(o)
                    : o && o.type === "asset" && o.asset === "sphere"
                      ? sphereGizmo(o)
                      : null;
}
function drawSpecialGizmo(c, o) {
    const sg = specialGizmo(o);
    if (!sg) return;
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";
    const sq = (q, col, diamond = false) => {
        if (!q || !q.ok) return;
        c.fillStyle = col;
        c.strokeStyle = "#102027";
        c.lineWidth = 1.4 / Z;
        c.beginPath();
        if (diamond) {
            c.moveTo(q.x, q.y - 7 / Z);
            c.lineTo(q.x + 7 / Z, q.y);
            c.lineTo(q.x, q.y + 7 / Z);
            c.lineTo(q.x - 7 / Z, q.y);
        } else c.rect(q.x - 6 / Z, q.y - 6 / Z, 12 / Z, 12 / Z);
        c.closePath();
        c.fill();
        c.stroke();
    };
    if (sg.o.asset === "beveledBox") {
        const h = sg.handle;
        if (h?.s?.ok && h?.anchor?.ok) {
            c.setLineDash([5 / Z, 4 / Z]);
            c.strokeStyle = "rgba(255,159,104,.95)";
            c.lineWidth = 1.5 / Z;
            c.beginPath();
            c.moveTo(h.anchor.x, h.anchor.y);
            c.lineTo(h.s.x, h.s.y);
            c.stroke();
            c.setLineDash([]);
            sq(h.s, "#ff9f68", true);
            c.fillStyle = "#ffd0a8";
            c.font = `bold ${12 / Z}px system-ui`;
            c.fillText(`ベベル ${Number(h.start || 0).toFixed(2)}`, h.s.x + 9 / Z, h.s.y - 8 / Z);
        }
    } else if (sg.o.asset === "pathPipe") {
        const h = sg.radiusHandle;
        c.setLineDash([5 / Z, 4 / Z]);
        c.strokeStyle = "rgba(255,159,104,.9)";
        c.lineWidth = 1.2 / Z;
        if (sg.controlPoints.length > 1) {
            c.beginPath();
            sg.controlPoints.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
            c.stroke();
        }
        sg.pathHandles.forEach((handle) => {
            if (!handle.s?.ok || !handle.anchor?.ok) return;
            c.strokeStyle = handle.color;
            c.beginPath();
            c.moveTo(handle.anchor.x, handle.anchor.y);
            c.lineTo(handle.s.x, handle.s.y);
            c.stroke();
            sq(handle.s, handle.color, true);
        });
        c.setLineDash([]);
        sg.controlPoints.forEach((q) => {
            if (!q?.ok) return;
            c.fillStyle = "#fff";
            c.strokeStyle = "#ff9f68";
            c.lineWidth = 1.5 / Z;
            c.beginPath();
            c.arc(q.x, q.y, 5 / Z, 0, Math.PI * 2);
            c.fill();
            c.stroke();
        });
        if (h?.s?.ok && h?.anchor?.ok) {
            c.setLineDash([4 / Z, 3 / Z]);
            c.strokeStyle = "#ff9f68";
            c.beginPath();
            c.moveTo(h.anchor.x, h.anchor.y);
            c.lineTo(h.s.x, h.s.y);
            c.stroke();
            c.setLineDash([]);
            sq(h.s, "#ff9f68", true);
            c.fillStyle = "#ffd0a8";
            c.font = `bold ${12 / Z}px system-ui`;
            c.fillText("半径", h.s.x + 9 / Z, h.s.y - 8 / Z);
        }
    } else if (isStackedBuildingAsset(sg.o)) {
        const h = sg.handles,
            usable = Object.values(h).filter((handle) => Math.hypot(handle.dir.x, handle.dir.y) > 0.15);
        c.setLineDash([5 / Z, 4 / Z]);
        c.strokeStyle = "rgba(255,179,111,.9)";
        c.lineWidth = 1.4 / Z;
        if (sg.frame && sg.frame.every((q) => q && q.ok)) {
            c.beginPath();
            sg.frame.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
            c.closePath();
            c.stroke();
        }
        usable.forEach((handle) => {
            c.beginPath();
            c.moveTo(sg.center.x, sg.center.y);
            c.lineTo(handle.s.x, handle.s.y);
            c.stroke();
        });
        c.setLineDash([]);
        usable.forEach((handle) => sq(handle.s, "#ffb36f", handle.kind === "stacked-height"));
        c.fillStyle = "#ffd0a8";
        c.font = `bold ${12 / Z}px system-ui`;
        c.fillText(`${sg.floorIndex + 1}F 幅/奥行/高さ`, sg.center.x + 8 / Z, sg.center.y - 8 / Z);
        const opening = sg.opening;
        if (opening) {
            const drawFrame = (frame, color = "#8ce6c2") => {
                if (!frame?.every((q) => q && q.ok)) return;
                c.strokeStyle = color;
                c.lineWidth = 1.25 / Z;
                c.beginPath();
                frame.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
                c.closePath();
                c.stroke();
            };
            drawFrame(opening.front.frame, "#8ce6c2");
            drawFrame(opening.panelFrame, "#ffd37a");
            c.strokeStyle = "#8ce6c2";
            c.beginPath();
            [opening.handles.left, opening.handles.right, opening.handles.height].forEach((h) => {
                if (h?.s?.ok) {
                    c.moveTo(opening.front.center.x, opening.front.center.y);
                    c.lineTo(h.s.x, h.s.y);
                }
            });
            c.stroke();
            [opening.handles.left, opening.handles.right, opening.handles.height].forEach((h) => sq(h.s, "#8ce6c2"));
            if (opening.handles.backFace?.s?.ok) {
                c.strokeStyle = "#ffd37a";
                c.beginPath();
                c.moveTo(opening.panelCenter.x, opening.panelCenter.y);
                c.lineTo(opening.handles.backFace.s.x, opening.handles.backFace.s.y);
                c.stroke();
                sq(opening.handles.backFace.s, "#ffd37a", true);
            }
            c.fillStyle = "#d8fff0";
            c.fillText("1F 開口 W/H", opening.front.center.x + 8 / Z, opening.front.center.y - 8 / Z);
        }
        if (sg.bevelHandle?.s?.ok && sg.bevelHandle?.anchor?.ok) {
            const bh = sg.bevelHandle;
            c.setLineDash([4 / Z, 3 / Z]);
            c.strokeStyle = "#ff9f68";
            c.beginPath();
            c.moveTo(bh.anchor.x, bh.anchor.y);
            c.lineTo(bh.s.x, bh.s.y);
            c.stroke();
            c.setLineDash([]);
            sq(bh.s, "#ff9f68", true);
            c.fillStyle = "#ffd0a8";
            c.fillText(`ベベル ${Number(bh.start || 0).toFixed(2)}`, bh.s.x + 9 / Z, bh.s.y - 8 / Z);
        }
    } else if (sg.o.asset === "building") {
        const h = sg.handles,
            front = ["frontOpeningWLeft", "frontOpeningWRight", "frontOpeningH"],
            back = ["backOpeningWLeft", "backOpeningWRight", "backOpeningH"];
        c.setLineDash([5 / Z, 4 / Z]);
        c.lineWidth = 1.2 / Z;
        [
            ["front", front, sg.frame, sg.center, "#8ce6c2"],
            ["back", back, sg.backFrame, sg.backCenter, "#ffd37a"],
        ].forEach(([label, keys, frame, center, col]) => {
            if (frame && frame.every((q) => q && q.ok)) {
                c.strokeStyle = col;
                c.beginPath();
                frame.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
                c.stroke();
            }
            c.strokeStyle = col;
            c.beginPath();
            keys.forEach((k) => {
                c.moveTo(center.x, center.y);
                c.lineTo(h[k].s.x, h[k].s.y);
            });
            c.stroke();
            keys.forEach((k) => sq(h[k].s, col));
            c.fillStyle = col;
            c.font = `bold ${12 / Z}px system-ui`;
            c.fillText(label === "front" ? "開口W/H" : "奥の開口", h[keys[1]].s.x + 8 / Z, h[keys[1]].s.y - 7 / Z);
        });
        if (sg.panelFrame && sg.panelFrame.every((q) => q && q.ok)) {
            c.fillStyle = "rgba(255,179,111,.18)";
            c.strokeStyle = "#ffb36f";
            c.lineWidth = 1.8 / Z;
            c.beginPath();
            sg.panelFrame.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
            c.closePath();
            c.fill();
            c.stroke();
            c.strokeStyle = "rgba(255,179,111,.82)";
            c.setLineDash([3 / Z, 3 / Z]);
            c.beginPath();
            c.moveTo(sg.panelCenter.x, sg.panelCenter.y);
            c.lineTo(h.backFace.s.x, h.backFace.s.y);
            c.stroke();
            c.setLineDash([]);
            sq(h.backFace.s, "#ffb36f", true);
            c.fillStyle = "#ffd0a8";
            c.font = `bold ${12 / Z}px system-ui`;
            c.fillText("奥の面", h.backFace.s.x + 9 / Z, h.backFace.s.y - 8 / Z);
        }
        c.setLineDash([]);
    } else if (sg.o.asset === "awning") {
        const hz = sg.handles.edgeZ,
            hy = sg.handles.edgeY;
        c.setLineDash([5 / Z, 4 / Z]);
        c.strokeStyle = "rgba(255,179,111,.9)";
        c.lineWidth = 1.5 / Z;
        if (sg.frame && sg.frame.every((q) => q && q.ok)) {
            c.beginPath();
            sg.frame.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
            c.closePath();
            c.stroke();
        }
        c.beginPath();
        c.moveTo(hz.s.x, hz.s.y);
        if (hy) c.lineTo(hy.s.x, hy.s.y);
        c.stroke();
        c.setLineDash([]);
        sq(hz.s, "#ffb36f", true);
        if (hy) sq(hy.s, "#ffb36f");
        c.fillStyle = "#ffd0a8";
        c.font = `bold ${12 / Z}px system-ui`;
        c.fillText("前縁Y", hz.s.x + 9 / Z, hz.s.y - 8 / Z);
        if (hy) c.fillText("前後", hy.s.x + 9 / Z, hy.s.y - 8 / Z);
    } else if (sg.o.asset === "sign") {
        const h = sg.handles;
        c.setLineDash([5 / Z, 4 / Z]);
        c.lineWidth = 1.2 / Z;
        if (sg.frame && sg.frame.length === 4 && sg.frame.every((q) => q && q.ok)) {
            c.strokeStyle = "rgba(102,227,200,.58)";
            c.beginPath();
            sg.frame.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
            c.closePath();
            c.stroke();
        }
        c.strokeStyle = "rgba(102,227,200,.9)";
        c.beginPath();
        c.moveTo(sg.center.x, sg.center.y);
        c.lineTo(h.faceW.s.x, h.faceW.s.y);
        c.moveTo(sg.center.x, sg.center.y);
        c.lineTo(h.faceH.s.x, h.faceH.s.y);
        c.stroke();
        c.setLineDash([]);
        sq(h.faceW.s, "#66e3c8");
        sq(h.faceH.s, "#66e3c8");
        c.fillStyle = "#66e3c8";
        c.font = `bold ${12 / Z}px system-ui`;
        c.fillText("絵枠W", h.faceW.s.x + 8 / Z, h.faceW.s.y - 7 / Z);
        c.fillText("絵枠H", h.faceH.s.x + 8 / Z, h.faceH.s.y - 7 / Z);
    } else if (sg.o.asset === "cone") {
        c.strokeStyle = "rgba(255,179,111,.95)";
        c.lineWidth = 1.5 / Z;
        c.beginPath();
        c.moveTo(sg.base.x, sg.base.y);
        c.lineTo(sg.apex.x, sg.apex.y);
        c.stroke();
        sq(sg.handle.s, "#ffb36f");
        c.fillStyle = "#ffcf9f";
        c.font = `bold ${12 / Z}px system-ui`;
        c.fillText("高さ", sg.handle.s.x + 9 / Z, sg.handle.s.y - 8 / Z);
    } else {
        c.strokeStyle = "rgba(173,156,255,.95)";
        c.lineWidth = 1.4 / Z;
        c.setLineDash([5 / Z, 4 / Z]);
        c.beginPath();
        c.moveTo(sg.center.x, sg.center.y);
        c.lineTo(sg.handle.s.x, sg.handle.s.y);
        c.stroke();
        c.setLineDash([]);
        sq(sg.handle.s, "#ad9cff");
        c.fillStyle = "#d5ccff";
        c.font = `bold ${12 / Z}px system-ui`;
        c.fillText("半径", sg.handle.s.x + 9 / Z, sg.handle.s.y - 8 / Z);
    }
    c.restore();
}

// 複合オブジェクトをワールド軸方向へ拡縮する。子パーツの相対配置と定義を
// 保持したまま、各パーツを同じアフィン変換で作り直す。
function scaleCompoundPart(part, pivot, scale) {
    const q = { ...part, off: [...(part.off || [0, 0, 0])] };
    if (!PL[q.k]) return q;
    const base = L2W(q, 0, 0, 0),
        nb = base.map((v, j) => pivot[j] + (v - pivot[j]) * (Number(scale[j]) || 1)),
        [iu, iv] = PL[q.k],
        d = Number(q.d) || 1;
    q.ca = nb[iu] - q.off[iu];
    q.cb = nb[iv] - q.off[iv];
    q.lift = (d + q.off[q.k] - nb[q.k]) / d;
    const rot = Number(q.rot) || 0,
        cs = Math.cos(rot * DG),
        sn = Math.sin(rot * DG),
        su = Math.hypot(scale[iu] * cs, scale[iv] * sn),
        sv = Math.hypot(scale[iu] * sn, scale[iv] * cs);
    q.ra = Math.max(0.002, Math.abs(Number(q.ra) || 0.002) * Math.max(0.002, su));
    q.rb = Math.max(0.002, Math.abs(Number(q.rb) || 0.002) * Math.max(0.002, sv));
    if (su > 0.0001) q.rot = wrap180(Math.atan2(scale[iv] * sn, scale[iu] * cs) / DG);
    if (Number(q.h) > 0) q.h = Math.max(0.002, Number(q.h) * Math.abs(Number(scale[q.k]) || 1));
    return q;
}
function scaleCompoundDefinition(o, pivot, scale) {
    const parts = compoundPartsAt(o).map((part) => scaleCompoundPart(part, pivot, scale)),
        b = groupBounds(parts),
        center = [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2];
    return {
        parts,
        tx: 0,
        ty: 0,
        tz: 0,
        ca: center[0],
        cb: center[2],
        ra: Math.max(0.005, (b.hi[0] - b.lo[0]) / 2),
        rb: Math.max(0.005, (b.hi[2] - b.lo[2]) / 2),
        h: Math.max(0, b.hi[1] - b.lo[1]),
    };
}
function compoundFacePatch(o, fid, dl) {
    const b = obBounds(o),
        map = { "x+": [0, 1], "x-": [0, -1], "y+": [1, 1], "y-": [1, -1], "z+": [2, 1], "z-": [2, -1] },
        spec = map[fid];
    if (!spec) return {};
    const axis = spec[0],
        side = spec[1],
        span = Math.max(0.005, b.hi[axis] - b.lo[axis]),
        pivot = [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2],
        fixed = side > 0 ? b.lo[axis] : b.hi[axis],
        // マイナス側の面の法線は−方向。法線へ正に動かしたときは、
        // 下限をさらに小さくして同じ面から外へ広げる。
        edge = side > 0 ? b.hi[axis] + dl : b.lo[axis] - dl,
        newSpan = Math.max(0.005, side > 0 ? edge - b.lo[axis] : b.hi[axis] - edge),
        scale = [1, 1, 1];
    pivot[axis] = fixed;
    scale[axis] = newSpan / span;
    return scaleCompoundDefinition(o, pivot, scale);
}
function compoundGizmo(o) {
    const b = obBounds(o),
        C3 = [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2],
        sC = scrW(C3);
    if (!sC.ok) return null;
    const g = { o, C3, sC, axes: [], faces: [], ring: [], compound: true, bounds: b },
        nC = Math.hypot(...V.add(C3, CO()));
    [
        [1, 0, 0, "#e8743d", "X"],
        [0, 1, 0, "#4a7be8", "Y"],
        [0, 0, 1, "#2fb5a5", "Z"],
    ].forEach(([x, y, z, col, nm]) => {
        const a = [x, y, z],
            eps = 0.01 * Math.max(0.1, nC),
            s1 = scrW(V.add(C3, a, 1, eps));
        if (!s1.ok) return;
        const pu = Math.hypot(s1.x - sC.x, s1.y - sC.y) / eps;
        if (pu < 1e-6) return;
        const L = Math.min(90 / Z / pu, 3 * nC + 1),
            sT = scrW(V.add(C3, a, 1, L));
        if (sT.ok) g.axes.push({ a, col, nm, sT });
    });
    const center = [...C3],
        neg = (v) => v.map((t) => -t),
        face = (id, p, n) => g.faces.push({ id, n, P3: p, s: scrW(p) });
    face("x+", [b.hi[0], center[1], center[2]], [1, 0, 0]);
    face("x-", [b.lo[0], center[1], center[2]], [-1, 0, 0]);
    face("y+", [center[0], b.hi[1], center[2]], [0, 1, 0]);
    face("y-", [center[0], b.lo[1], center[2]], [0, -1, 0]);
    face("z+", [center[0], center[1], b.hi[2]], [0, 0, 1]);
    face("z-", [center[0], center[1], b.lo[2]], [0, 0, -1]);
    const R = Math.max(b.hi[0] - b.lo[0], b.hi[2] - b.lo[2], 0.25) * 0.7;
    for (let i = 0; i <= 72; i++) {
        const t = (i / 72) * 2 * Math.PI;
        g.ring.push(scrW([C3[0] + R * Math.cos(t), C3[1], C3[2] + R * Math.sin(t)]));
    }
    return g;
}
// 選択中の図形のギズモの位置（画面座標つき）
// 選択オブジェクトの中心、XYZ矢印、6面ハンドル、回転リングを作る。
// 描画とヒット判定の両方が同じ座標を使うため、見た目と操作がずれにくい。
function gizmo() {
    const o = sel && obOf(sel);
    if (!o) return null;
    if (o.type === "compound") return compoundGizmo(o);
    // 積層建物も3Dの移動・回転ギズモは表示する。ただし、
    // ra/rb/hへ書き込む汎用の面ハンドルは使わず、寸法編集は階別ギズモへ渡す。
    const stacked = isStackedBuildingAsset(o),
        [iu, iv] = PL[o.k],
        cs = Math.cos(o.rot * DG),
        sn = Math.sin(o.rot * DG),
        solid =
            o.type === "box" ||
            o.type === "cyl" ||
            o.type === "rect" ||
            o.type === "circ" ||
            o.type === "triPrism" ||
            o.type === "triPyramid" ||
            (o.type === "asset" &&
                (o.asset === "triPrism" ||
                    o.asset === "triPyramid" ||
                    o.asset === "sign" ||
                    o.asset === "stairs" ||
                    o.asset === "building" ||
                    o.asset === "awning" ||
                    o.asset === "balcony" ||
                    o.asset === "pathPipe" ||
                    o.asset === "beveledBox" ||
                    isStackedBuildingAsset(o))),
        [z0, z1] = outerZRange(o),
        zc = solid ? (z0 + z1) / 2 : 0;
    const C3 = L2W(o, 0, 0, zc),
        sC = scrW(C3);
    if (!sC.ok) return null;
    const g = { o, C3, sC, axes: [], faces: [], ring: [] },
        nC = Math.hypot(...V.add(C3, CO()));
    [
        [1, 0, 0, "#e8743d", "X"],
        [0, 1, 0, "#4a7be8", "Y"],
        [0, 0, 1, "#2fb5a5", "Z"],
    ].forEach(([x, y, z, col, nm]) => {
        // 画面で約90pxになる長さの矢印
        const a = [x, y, z],
            eps = 0.01 * Math.max(0.1, nC),
            s1 = scrW(V.add(C3, a, 1, eps));
        if (!s1.ok) return;
        const pu = Math.hypot(s1.x - sC.x, s1.y - sC.y) / eps;
        if (pu < 1e-6) return;
        const L = Math.min(90 / Z / pu, 3 * nC + 1),
            sT = scrW(V.add(C3, a, 1, L));
        if (sT.ok) g.axes.push({ a, col, nm, sT });
    });
    if (o.attachment?.verticalOnly) g.axes = g.axes.filter((a) => Math.abs(a.a[1]) > 0.9);
    const en = [0, 0, 0],
        eu = [0, 0, 0],
        ev = [0, 0, 0];
    en[o.k] = -o.d;
    eu[iu] = cs;
    eu[iv] = sn;
    ev[iu] = -sn;
    ev[iv] = cs; // 高さ方向・幅方向・奥行き方向の単位ベクトル
    const F = (id, x, y, z, n) => {
            const P3 = L2W(o, x, y, z),
                s = scrW(P3);
            g.faces.push({ id, n, P3, s });
        },
        neg = (v) => v.map((t) => -t);
    // 外形の6面は、開口のある建物でも編集対象にする。
    // 積層建物だけはfloors[]を持つため、汎用面ハンドルを出さない。
    if (!stacked) {
        F("u+", o.ra, 0, zc, eu);
        F("u-", -o.ra, 0, zc, neg(eu));
        F("v+", 0, o.rb, zc, ev);
        F("v-", 0, -o.rb, zc, neg(ev));
        if (solid) {
            F("top", 0, 0, z1, en);
            F("base", 0, 0, z0, neg(en));
        }
    }
    const R = Math.max(o.ra, o.rb) * 1.4;
    for (let i = 0; i <= 72; i++) {
        const t = (i / 72) * 2 * Math.PI;
        g.ring.push(scrW(L2W(o, R * Math.cos(t), R * Math.sin(t), solid ? z0 : 0)));
    }
    return g;
}
function drawGizmo(c) {
    const g = gizmo();
    if (!g) {
        const o = sel && obOf(sel);
        if (o) drawSpecialGizmo(c, o);
        return;
    }
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = "rgba(255,170,0,.85)";
    c.lineWidth = 1.6 / Z;
    c.setLineDash([7 / Z, 5 / Z]);
    c.beginPath();
    let on = false; // 回転の輪
    g.ring.forEach((q) => {
        if (!q.ok) {
            on = false;
            return;
        }
        on ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y);
        on = true;
    });
    c.stroke();
    c.setLineDash([]);
    g.axes.forEach((a) => {
        const dx = a.sT.x - g.sC.x,
            dy = a.sT.y - g.sC.y,
            l = Math.hypot(dx, dy) || 1,
            ux = dx / l,
            uy = dy / l,
            h = 11 / Z; // 軸の矢印
        c.strokeStyle = a.col;
        c.fillStyle = a.col;
        c.lineWidth = 3.2 / Z;
        c.beginPath();
        c.moveTo(g.sC.x, g.sC.y);
        c.lineTo(a.sT.x, a.sT.y);
        c.stroke();
        c.beginPath();
        c.moveTo(a.sT.x + ux * h, a.sT.y + uy * h);
        c.lineTo(a.sT.x - ux * h * 0.2 - uy * h * 0.6, a.sT.y - uy * h * 0.2 + ux * h * 0.6);
        c.lineTo(a.sT.x - ux * h * 0.2 + uy * h * 0.6, a.sT.y - uy * h * 0.2 - ux * h * 0.6);
        c.fill();
        c.font = `bold ${15 / Z}px system-ui`;
        c.fillText(a.nm, a.sT.x + ux * h + 4 / Z, a.sT.y + uy * h + 4 / Z);
    });
    c.fillStyle = "#fff";
    c.strokeStyle = "#222";
    c.lineWidth = 1.4 / Z; // 面のハンドル（白い四角）
    g.faces.forEach((f) => {
        if (!f.s.ok) return;
        const r = 6.5 / Z;
        c.beginPath();
        c.rect(f.s.x - r, f.s.y - r, 2 * r, 2 * r);
        c.fill();
        c.stroke();
    });
    c.beginPath();
    c.arc(g.sC.x, g.sC.y, 5 / Z, 0, 7);
    c.fill();
    c.stroke();
    drawSpecialGizmo(c, g.o);
    c.restore();
}
function stackedFloorScreen(o, index) {
    const f = o?.floors?.[index];
    if (!f) return null;
    const w = Math.max(0.08, Math.abs(Number(f.w) || 4)),
        d = Math.max(0.08, Math.abs(Number(f.d) || 3)),
        h = Math.max(0.08, Math.abs(Number(f.h) || 2.2)),
        x = Number(f.x) || 0,
        y = Number(f.y) || 0,
        z = Number(f.z) || 0,
        p3 = (px, py, pz) => customPt(o, px, py, pz),
        pr = (px, py, pz) => scrW(p3(px, py, pz)),
        center = pr(x, y, z + h * 0.5),
        top = [
            pr(x - w / 2, y - d / 2, z + h),
            pr(x + w / 2, y - d / 2, z + h),
            pr(x + w / 2, y + d / 2, z + h),
            pr(x - w / 2, y + d / 2, z + h),
        ],
        corners = [
            pr(x - w / 2, y - d / 2, z),
            pr(x + w / 2, y - d / 2, z),
            pr(x + w / 2, y + d / 2, z),
            pr(x - w / 2, y + d / 2, z),
            ...top,
        ];
    return { f, center, top, corners, index };
}
function stackedFloorHit(o, p) {
    if (!isStackedBuildingAsset(o) || !Array.isArray(o.floors)) return null;
    let best = null;
    o.floors.forEach((f, index) => {
        const q = stackedFloorScreen(o, index),
            valid = q && q.center?.ok && q.corners.every((v) => v && v.ok);
        if (!valid) return;
        const xs = q.corners.map((v) => v.x),
            ys = q.corners.map((v) => v.y),
            inside = insidePoly2D(
                p,
                q.top.filter((v) => v && v.ok),
            ),
            inBox =
                p.x >= Math.min(...xs) - 12 / Z &&
                p.x <= Math.max(...xs) + 12 / Z &&
                p.y >= Math.min(...ys) - 12 / Z &&
                p.y <= Math.max(...ys) + 12 / Z,
            distance = Math.hypot(p.x - q.center.x, p.y - q.center.y);
        if ((inside || inBox) && (!best || distance < best.distance)) best = { ...q, distance };
    });
    return best;
}
function insidePoly2D(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i],
            b = poly[j],
            cross = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || 1e-9) + a.x;
        if (cross) inside = !inside;
    }
    return inside;
}
// タッチした位置にあるハンドルを調べる（アセット専用→面→軸の矢印→回転の輪）
// 画面上のクリックを、特殊アセット用→面→軸→回転リングの順で判定する。
// 看板・階層建物・パスパイプなどはここで専用ハンドルへ分岐する。
function hitGizmo(p) {
    const active = sel && obOf(sel),
        special = active && specialGizmo(active),
        R = 20 / Z;
    if (special) {
        if (active.asset === "beveledBox") {
            const h = special.handle;
            if (h?.s?.ok && Math.hypot(h.s.x - p.x, h.s.y - p.y) < R)
                return { t: "beveled-offset", sign: h, g: { o: active, C3: special.C3 } };
        }
        if (active.asset === "pathPipe") {
            // 扇状に分けた隣接点のハンドルが許容半径へ少し重なることがある。
            // 配列の先頭ではなく、押した位置に最も近いハンドルを返して
            // 奥側の制御点を手前の点へ誤配分しない。
            const pathHits = special.pathHandles
                .filter((h) => h.s?.ok)
                .map((h) => ({ h, d: Math.hypot(h.s.x - p.x, h.s.y - p.y), t: h.kind }))
                .filter((q) => q.d < R);
            const radius = special.radiusHandle;
            if (radius?.s?.ok) {
                const d = Math.hypot(radius.s.x - p.x, radius.s.y - p.y);
                if (d < R) pathHits.push({ h: radius, d, t: "path-radius" });
            }
            pathHits.sort((a, b) => a.d - b.d);
            if (pathHits.length) {
                const q = pathHits[0];
                return { t: q.t, sign: q.h, g: { o: active, C3: special.C3 } };
            }
        }
        if (isStackedBuildingAsset(active)) {
            const opening = special.opening;
            if (opening) {
                for (const h of [
                    opening.handles.left,
                    opening.handles.right,
                    opening.handles.height,
                    opening.handles.backFace,
                ])
                    if (h?.s?.ok && Math.hypot(h.s.x - p.x, h.s.y - p.y) < R)
                        return { t: h.kind, sign: h, g: { o: active, C3: opening.C3 } };
                if (opening.panelFrame?.every((q) => q && q.ok) && insidePoly2D(p, opening.panelFrame))
                    return {
                        t: "stacked-opening-back",
                        sign: opening.handles.backFace,
                        g: { o: active, C3: opening.C3 },
                    };
            }
            if (
                special.bevelHandle?.s?.ok &&
                Math.hypot(special.bevelHandle.s.x - p.x, special.bevelHandle.s.y - p.y) < R
            )
                return { t: "stacked-bevel-offset", sign: special.bevelHandle, g: { o: active, C3: special.C3 } };
            for (const h of Object.values(special.handles))
                if (Math.hypot(h.dir.x, h.dir.y) > 0.15 && Math.hypot(h.s.x - p.x, h.s.y - p.y) < R)
                    return { t: h.kind, sign: h, g: { o: active, C3: special.C3 } };
            // X／Y／Z移動矢印は階の外形判定より先に拾う。
            // 矢印の先端が階の箱の中に見える3D視点でも、1Fだけの移動へ落とさない。
            const moveG = gizmo();
            if (moveG && Math.hypot(moveG.sC.x - p.x, moveG.sC.y - p.y) > R * 0.8)
                for (const a of moveG.axes) if (segd(p, moveG.sC, a.sT) < R * 0.7) return { t: "axis", a, g: moveG };
            const floor = stackedFloorHit(active, p);
            if (floor) return { t: "stack-floor", floorIndex: floor.index, floor, g: { o: active, C3: special.C3 } };
        }
        if (active.asset === "building") {
            for (const h of Object.values(special.handles))
                if (Math.hypot(h.s.x - p.x, h.s.y - p.y) < R)
                    return { t: "building-" + h.kind, sign: h, g: { o: active, C3: special.C3 } };
            if (special.panelFrame && special.panelFrame.every((q) => q && q.ok) && insidePoly2D(p, special.panelFrame))
                return { t: "building-backFace", sign: special.handles.backFace, g: { o: active, C3: special.C3 } };
        }
        if (active.asset === "awning") {
            for (const h of Object.values(special.handles))
                if (Math.hypot(h.s.x - p.x, h.s.y - p.y) < R)
                    return { t: "awning-" + h.kind, sign: h, g: { o: active, C3: special.C3 } };
            if (
                special.frame &&
                special.frame[0]?.ok &&
                special.frame[1]?.ok &&
                segd(p, special.frame[0], special.frame[1]) < R * 0.8
            )
                return { t: "awning-edgeZ", sign: special.handles.edgeZ, g: { o: active, C3: special.C3 } };
        }
        if (active.asset === "sign")
            for (const h of Object.values(special.handles))
                if (Math.hypot(h.s.x - p.x, h.s.y - p.y) < R)
                    return { t: "sign-" + h.kind, sign: h, g: { o: active, C3: special.C3 } };
        if (active.asset === "cone" && Math.hypot(special.handle.s.x - p.x, special.handle.s.y - p.y) < R)
            return { t: "cone-height", sign: special.handle, g: { o: active, C3: special.C3 } };
        if (active.asset === "sphere" && Math.hypot(special.handle.s.x - p.x, special.handle.s.y - p.y) < R)
            return { t: "sphere-radius", sign: special.handle, g: { o: active, C3: special.C3 } };
    }
    const g = gizmo();
    if (!g) return null;
    const Rg = 20 / Z,
        faceHits = g.faces
            .filter((f) => f.s.ok)
            .map((f) => ({ f, d: Math.hypot(f.s.x - p.x, f.s.y - p.y) }))
            .filter((q) => q.d < Rg);
    if (faceHits.length) {
        // 表裏の面ハンドルが重なるときは、画面に近い面を優先する。
        // 配列の先頭順だけで選ぶと、裏面の法線を拾ってドラッグ方向が反転する。
        faceHits.sort((a, b) => {
            if (Math.abs(a.d - b.d) > 0.5 / Z) return a.d - b.d;
            const da = Math.hypot(...V.add(a.f.P3, camPos(), 1, -1)),
                db = Math.hypot(...V.add(b.f.P3, camPos(), 1, -1));
            return da - db;
        });
        return { t: "face", f: faceHits[0].f, g };
    }
    if (Math.hypot(g.sC.x - p.x, g.sC.y - p.y) > R * 0.8)
        for (const a of g.axes) if (segd(p, g.sC, a.sT) < R * 0.7) return { t: "axis", a, g };
    for (let i = 1; i < g.ring.length; i++) {
        const a = g.ring[i - 1],
            b = g.ring[i];
        if (a.ok && b.ok && segd(p, a, b) < R * 0.7) return { t: "ring", g };
    }
    return null;
}
function compoundBounds(o) {
    const parts = compoundPartsAt(o);
    if (!parts.length) return { lo: [0, 0, 0], hi: [0, 0, 0] };
    return groupBounds(parts);
}
function objectAnchorWorld(o) {
    if (o?.type === "compound") {
        const b = compoundBounds(o);
        return [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2];
    }
    return L2W(o, 0, 0, 0);
}
// 図形の外枠（ワールド軸に沿った箱）。スナップや接地に使う
function stackedObjectCorners(o) {
    if (!isStackedBuildingAsset(o)) return [];
    const floors =
        Array.isArray(o.floors) && o.floors.length
            ? o.floors
            : [{ x: 0, y: 0, z: 0, w: Number(o.ra || 4) * 2, d: Number(o.rb || 3) * 2, h: Number(o.h || 2.2) }];
    const out = [];
    floors.forEach((f) => {
        const w = Math.max(0.05, Math.abs(Number(f.w) || 4)),
            d = Math.max(0.05, Math.abs(Number(f.d) || 3)),
            z = Number(f.z) || 0,
            h = Math.max(0.05, Math.abs(Number(f.h) || 2.2)),
            x = Number(f.x) || 0,
            y = Number(f.y) || 0,
            rimH = clamp(Math.abs(Number(f.rimHeight) || Number(o.rimHeight) || 0.16), 0.01, h),
            over = Math.max(0, Math.abs(Number(f.rimOverhang) || Number(o.rimOverhang) || 0.18));
        const addBox = (fw, fd, z0, z1) => {
            for (const xx of [-fw / 2, fw / 2])
                for (const yy of [-fd / 2, fd / 2]) {
                    out.push(L2W(o, x + xx, y + yy, z0));
                    out.push(L2W(o, x + xx, y + yy, z1));
                }
        };
        addBox(w, d, z, z + h);
        // 上側の縁だけを外形へ含める。下側の縁は生成しない仕様と一致させる。
        addBox(w + over * 2, d + over * 2, z + h - rimH, z + h);
    });
    return out;
}
// オブジェクトのワールド軸外接箱を返す。
// 選択・ボックス選択・間取りヒット判定・スナップで共通利用する重要な関数。
function obBounds(o) {
    if (o?.attachment) o = syncAttachedPart(o);
    if (o?.type === "compound") return compoundBounds(o);
    if (isStackedBuildingAsset(o)) {
        const pts = stackedObjectCorners(o),
            lo = [1e9, 1e9, 1e9],
            hi = [-1e9, -1e9, -1e9];
        pts.forEach((p) =>
            p.forEach((v, j) => {
                lo[j] = Math.min(lo[j], v);
                hi[j] = Math.max(hi[j], v);
            }),
        );
        return { lo, hi };
    }
    const sign = o.type === "asset" && o.asset === "sign",
        pts = [],
        solid =
            o.type === "box" ||
            o.type === "cyl" ||
            o.type === "triPrism" ||
            o.type === "triPyramid" ||
            ((o.type === "rect" || o.type === "circ") && o.extrude) ||
            sign,
        hs = solid ? (sign ? outerZRange(o) : [0, o.h]) : [0];
    if (o.type === "rect" || o.type === "box" || o.type === "triPrism" || o.type === "triPyramid" || sign)
        hs.forEach((z) =>
            [
                [-1, -1],
                [1, -1],
                [1, 1],
                [-1, 1],
            ].forEach(([a, b]) => pts.push(L2W(o, a * o.ra, b * o.rb, z))),
        );
    else
        for (let i = 0; i < 48; i++) {
            const t = (i / 48) * Math.PI * 2;
            hs.forEach((z) => pts.push(L2W(o, o.ra * Math.cos(t), o.rb * Math.sin(t), z)));
        }
    const lo = [1e9, 1e9, 1e9],
        hi = [-1e9, -1e9, -1e9];
    pts.forEach((v) => {
        for (let j = 0; j < 3; j++) {
            lo[j] = Math.min(lo[j], v[j]);
            hi[j] = Math.max(hi[j], v[j]);
        }
    });
    return { lo, hi };
}
// 動かしている図形以外の、くっつき先
function targetsOf(id) {
    const seen = new Set(),
        out = [];
    S.forEach((s) => {
        if (s.ob && objectVisible(s.ob) && s.ob.id !== id && !seen.has(s.ob.id)) {
            seen.add(s.ob.id);
            out.push({ id: s.ob.id, b: obBounds(s.ob) });
        }
    });
    return out;
}
// 複数選択を一体として動かすときの外周と吸着先。選択中同士は吸着候補から外す。
function groupBounds(objects) {
    const lo = [1e9, 1e9, 1e9],
        hi = [-1e9, -1e9, -1e9];
    objects.forEach((o) => {
        const b = obBounds(o);
        for (let j = 0; j < 3; j++) {
            lo[j] = Math.min(lo[j], b.lo[j]);
            hi[j] = Math.max(hi[j], b.hi[j]);
        }
    });
    return { lo, hi };
}
function targetsOfSet(ids) {
    const seen = new Set(),
        out = [];
    S.forEach((s) => {
        if (s.ob && objectVisible(s.ob) && !ids.has(s.ob.id) && !seen.has(s.ob.id)) {
            seen.add(s.ob.id);
            out.push({ id: s.ob.id, b: obBounds(s.ob) });
        }
    });
    return out;
}
function snapSetupGroup(objects, C3) {
    const ids = new Set(objects.map((o) => o.id));
    return { bb: groupBounds(objects), targets: targetsOfSet(ids), tau: tauOf(C3) };
}
// 画面上の吸着距離(px)を、その図形の位置でのワールドの長さにする
function tauOf(C3) {
    // 正投影ではカメラ距離を使うと吸着幅が極端に小さくなる。
    // orthScaleはpx／worldなので、表示上の磁石距離をそのままワールドへ直す。
    if (orthView) return Math.max(1, Number(P.sn) || 14) / Z / Math.max(1, Number(orthScale()) || 1);
    const rel = Math.max(0.05, Math.hypot(...V.add(C3, CO()))),
        f = T === "f" ? H / 2 / ((P.fov * DG) / 2) : (W * P.lens) / 36;
    return ((P.sn / Z) * rel) / f;
}
const snapSetup = (o, C3) => ({ bb: obBounds(o), targets: targetsOf(o.id), tau: tauOf(C3) });
// 移動量deltaを、他の図形の面や地面に近ければぴったりくっつくよう補正（軸ごと）
// 移動量deltaを、近くの外周面・角へ吸着させる。
// 対象軸だけ補正し、他軸の移動や親子接続を壊さない。
function snapShift(bb, delta, axes, targets, tau) {
    const d = [...delta],
        hit = new Set();
    axes.forEach((j) => {
        let best = null;
        const lo = bb.lo[j] + d[j],
            hi = bb.hi[j] + d[j],
            cand = [];
        targets.forEach((t) => {
            cand.push([t.b.lo[j], t.id, 1], [t.b.hi[j], t.id, 1]);
        });
        if (j === 1) cand.push([-1, "ground", 0]); // 地面(y=-1)には底だけ
        cand.forEach(([v, id, both]) =>
            (both ? [v - lo, v - hi] : [v - lo]).forEach((sft) => {
                if (Math.abs(sft) <= tau && (!best || Math.abs(sft) < Math.abs(best.s))) best = { s: sft, id };
            }),
        );
        if (best) {
            d[j] += best.s;
            hit.add(best.id);
        }
    });
    return { d, hit };
}
// オブジェクトの実際の外周を、面スナップ用の投影点として返す。
// 軸に平行なobBoundsだけに頼らないので、回転した図形でも辺を拾える。
function snapObjectCorners(o) {
    if (!o) return [];
    if (o.type === "compound") return compoundPartsAt(o).flatMap((part) => snapObjectCorners(part));
    if (isStackedBuildingAsset(o)) return stackedObjectCorners(o);
    const sign = o.type === "asset" && o.asset === "sign",
        solid =
            o.type === "box" ||
            o.type === "cyl" ||
            o.type === "triPrism" ||
            o.type === "triPyramid" ||
            ((o.type === "rect" || o.type === "circ") && o.extrude) ||
            o.type === "asset";
    const hs = solid ? (sign ? outerZRange(o) : [0, Math.max(0, Number(o.h) || 0)]) : [0],
        out = [];
    for (const x of [-Math.abs(Number(o.ra) || 0), Math.abs(Number(o.ra) || 0)])
        for (const y of [-Math.abs(Number(o.rb) || 0), Math.abs(Number(o.rb) || 0)])
            for (const z of hs) out.push(L2W(o, x, y, z));
    return out;
}
// 面の押し引きのスナップ。編集面の法線方向と、面内の辺の重なりを確認し、
// 隣接している対象の外周だけへ吸着する。ed.nはワールド単位ベクトルなので、
// 斜めに回転した図形にも同じ処理を適用できる。
function faceSnap(dl) {
    if (!$("snp")?.checked || !ed?.o0 || !ed?.n || !ed?.Fa) return dl;
    const o = ed.o0,
        n = V.nrm(ed.n),
        [iu, iv] = PL[o.k],
        cs = Math.cos(Number(o.rot || 0) * DG),
        sn = Math.sin(Number(o.rot || 0) * DG),
        eu = [0, 0, 0],
        ev = [0, 0, 0],
        en = [0, 0, 0];
    eu[iu] = cs;
    eu[iv] = sn;
    ev[iu] = -sn;
    ev[iv] = cs;
    en[o.k] = -o.d;
    const fid = String(ed.fid || ""),
        isU = fid[0] === "u",
        isV = fid[0] === "v",
        plus = fid === "top" || fid.endsWith("+");
    const tangents = isU ? [ev, en] : isV ? [eu, en] : [eu, ev],
        outerH = outerZRange(o)[1] - outerZRange(o)[0];
    const halves = isU
        ? [Math.abs(o.rb), outerH / 2]
        : isV
          ? [Math.abs(o.ra), outerH / 2]
          : [Math.abs(o.ra), Math.abs(o.rb)];
    const faceN0 = dot3(ed.Fa, n),
        faceN = faceN0 + dl,
        faceT = tangents.map((t) => dot3(ed.Fa, t)),
        tau = Math.max(0.04, Number(ed.tau) || 0.04),
        tol = Math.max(0.01, tau * 0.25);
    let best = null;
    ed.targets.forEach((t) => {
        const to = obOf(t.id),
            pts = snapObjectCorners(to);
        if (pts.length < 2) return;
        const proj = pts.map((p) => ({ n: dot3(p, n), t: tangents.map((a) => dot3(p, a)) }));
        const nMin = Math.min(...proj.map((p) => p.n)),
            nMax = Math.max(...proj.map((p) => p.n));
        for (let k = 0; k < 2; k++) {
            const tMin = Math.min(...proj.map((p) => p.t[k])),
                tMax = Math.max(...proj.map((p) => p.t[k])),
                fMin = faceT[k] - halves[k],
                fMax = faceT[k] + halves[k];
            if (Math.min(fMax, tMax) - Math.max(fMin, tMin) < -tol) return;
        }
        // 対象の下端・上端の両方を候補にする。面の接線方向が重なり、
        // かつ吸着距離内にある辺だけを通すので、遠い対象へは飛ばない。
        const candidates = [nMin, nMax];
        candidates.forEach((targetN) => {
            const gap = targetN - faceN;
            if (Math.abs(gap) <= tau && (!best || Math.abs(gap) < Math.abs(best.gap)))
                best = { gap, id: t.id, targetN };
        });
    });
    if (!best) return dl;
    snapHit = new Set([best.id]);
    // dlは編集面そのものの移動量なので、対象面との差を加えるだけでよい。
    return dl + (best.targetN - faceN);
}

function beginGizmo(h, p) {
    const o = h.g.o,
        r = unscr(p),
        co = CO(),
        group = o.attachment?.verticalOnly ? [o] : selectedObjects(),
        base = {
            id: o.id,
            o0: o.type === "compound" ? JSON.parse(JSON.stringify(o)) : { ...o },
            group: group.map((q) => ({ ...q, off: [...(q.off || [0, 0, 0])] })),
            started: false,
            ...(group.length > 1 ? snapSetupGroup(group, h.g.C3) : snapSetup(o, h.g.C3)),
        };
    if (h.t === "stack-floor") {
        const index = stackedIndividualEdit(o)
                ? clamp(Math.round(Number(h.floorIndex) || 0), 0, Math.max(0, (o.floors || []).length - 1))
                : 0,
            f = o.floors?.[index],
            q = stackedFloorScreen(o, index);
        if (f && q) {
            const zmid = (Number(f.z) || 0) + (Number(f.h) || 2.2) * 0.5,
                c = scrW(customPt(o, Number(f.x) || 0, Number(f.y) || 0, zmid)),
                bx = scrW(customPt(o, (Number(f.x) || 0) + 1, Number(f.y) || 0, zmid)),
                by = scrW(customPt(o, Number(f.x) || 0, (Number(f.y) || 0) + 1, zmid));
            setOb(o.id, { activeFloor: index });
            ed = {
                ...base,
                o0: { ...o, floors: (o.floors || []).map((floor) => ({ ...floor })) },
                t: "stack-floor-mv",
                floorIndex: index,
                p0: p,
                stackMove: {
                    x: Number(f.x) || 0,
                    y: Number(f.y) || 0,
                    bx: { x: (bx?.x || c.x) - c.x, y: (bx?.y || c.y) - c.y },
                    by: { x: (by?.x || c.x) - c.x, y: (by?.y || c.y) - c.y },
                },
            };
        }
    } else if (
        h.t.startsWith("sign-") ||
        h.t.startsWith("building-") ||
        h.t.startsWith("awning-") ||
        h.t.startsWith("stacked-") ||
        h.t === "stacked-bevel-offset" ||
        h.t.startsWith("path-point-") ||
        h.t === "path-radius" ||
        h.t === "beveled-offset" ||
        h.t === "cone-height" ||
        h.t === "sphere-radius"
    )
        ed = { ...base, t: h.t, sign: h.sign, p0: p };
    else if (h.t === "axis") {
        const C0 = V.add(h.g.C3, co),
            t0 = lineParam(r, C0, h.a.a),
            axisGuide = faceScreenGuide({ P3: h.g.C3, n: h.a.a });
        if (t0 != null || axisGuide)
            ed = { ...base, t: "axis", a: h.a.a, aj: h.a.a.indexOf(1), C0, t0, axisGuide, p0: p };
    } else if (h.t === "face") {
        const F0 = V.add(h.f.P3, co),
            t0 = lineParam(r, F0, h.f.n),
            faceGuide = faceScreenGuide(h.f);
        // 画面方向を基準にすると、ドラッグした側と反対へ拡大する跳ね返りを防げる。
        // guideがつぶれるビューでは、t0だけで不安定に動かさない。
        if (t0 != null || faceGuide) {
            const fj = [0, 1, 2].find((j) => Math.abs(h.f.n[j]) > 0.999);
            ed = {
                ...base,
                t: "face",
                fid: h.f.id,
                n: h.f.n,
                F0,
                Fa: h.f.P3,
                fj: fj === undefined ? -1 : fj,
                t0,
                faceGuide,
                p0: p,
            };
        }
    } else if (o.type === "compound")
        ed = { ...base, t: "ring", sC: h.g.sC, ang0: Math.atan2(p.y - h.g.sC.y, p.x - h.g.sC.x) };
    else {
        const dd = o.d - o.d * o.lift,
            P1 = hit3(r, o.k, dd, cloc(o)),
            [iu, iv] = PL[o.k];
        if (P1) ed = { ...base, t: "ring", dd, ang0: Math.atan2(P1[iv] - o.cb, P1[iu] - o.ca) };
    }
}
// キャンバス上のドラッグで編集（ed=いまの編集操作）。磁石スナップがONなら他の図形・地面にくっつく
function dragEdit(p, freeRotation = false) {
    const o = ed.o0,
        [iu, iv] = PL[o.k],
        r = unscr(p),
        on = $("snp").checked;
    let patch = null;
    snapHit = null;
    const snap = (delta, axes) => {
        if (!on) return delta;
        const q = snapShift(ed.bb, delta, axes, ed.targets, ed.tau);
        if (q.hit.size) snapHit = q.hit;
        return q.d;
    };
    if (ed.t.startsWith("path-point-")) {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            amount = (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1),
            path = pathPipeControlPoints(o).map((point) => [...point]);
        if (path[h.index]) {
            path[h.index][h.axis] = clamp(h.start + amount, h.min, h.max);
            patch = { path };
        }
    } else if (ed.t === "path-radius") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            radius = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = { pipeRadius: radius };
    } else if (ed.t === "beveled-offset") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            offset = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = { bevelOffset: offset };
    } else if (ed.t.startsWith("building-")) {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            amount = (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1);
        if (ed.t === "building-backFace")
            patch = { openingBack: clamp(h.start + (h.factor || 1) * amount, h.min, h.max) };
        else if (ed.t.includes("OpeningH")) patch = { openingH: clamp(h.start + amount, h.min, h.max) };
        else patch = { openingW: clamp(h.start + (h.factor || 1) * amount, h.min, h.max) };
    } else if (ed.t === "stack-floor-mv") {
        const h = ed.stackMove,
            dx = p.x - ed.p0.x,
            dy = p.y - ed.p0.y,
            det = h.bx.x * h.by.y - h.bx.y * h.by.x;
        let mx = 0,
            my = 0;
        if (Math.abs(det) > 1e-6) {
            mx = (dx * h.by.y - dy * h.by.x) / det;
            my = (h.bx.x * dy - h.bx.y * dx) / det;
        } else if (Math.hypot(h.bx.x, h.bx.y) >= Math.hypot(h.by.x, h.by.y)) {
            const n = Math.hypot(h.bx.x, h.bx.y) || 1;
            mx = (dx * h.bx.x + dy * h.bx.y) / (n * n);
        } else {
            const n = Math.hypot(h.by.x, h.by.y) || 1;
            my = (dx * h.by.x + dy * h.by.y) / (n * n);
        }
        const floors = Array.isArray(o.floors) ? o.floors.map((f) => ({ ...f })) : [],
            floor = floors[ed.floorIndex],
            individual = stackedIndividualEdit(o);
        if (floor) {
            let nextX = h.x + mx,
                nextY = h.y + my;
            if (!individual && $("snp")?.checked) {
                // ローカル階座標をワールドX/Zの移動量へ変換してから吸着する。
                // そのまま画面量だけを補正すると、回転した建物では別方向へずれる。
                const a = Number(o.rot || 0) * DG,
                    cs = Math.cos(a),
                    sn = Math.sin(a),
                    raw = [
                        (nextX - (Number(floor.x) || 0)) * cs - (nextY - (Number(floor.y) || 0)) * sn,
                        0,
                        (nextX - (Number(floor.x) || 0)) * sn + (nextY - (Number(floor.y) || 0)) * cs,
                    ],
                    q = snapShift(ed.bb, raw, [0, 2], ed.targets, ed.tau);
                snapHit = q.hit.size ? q.hit : null;
                nextX = (Number(floor.x) || 0) + q.d[0] * cs + q.d[2] * sn;
                nextY = (Number(floor.y) || 0) - q.d[0] * sn + q.d[2] * cs;
            }
            if (individual) {
                floor.x = nextX;
                floor.y = nextY;
                patch = {
                    floors,
                    activeFloor: ed.floorIndex,
                    h: (Number(floors[floors.length - 1]?.z) || 0) + (Number(floors[floors.length - 1]?.h) || 0),
                };
            } else {
                // 通常モードの1F移動は階のx/yではなく建物本体を移動する。
                // これで全階が同じ量だけ動き、3Dの回転リングも移動後の
                // 建物中心へ追従する。
                const dx = nextX - (Number(floor.x) || 0),
                    dy = nextY - (Number(floor.y) || 0),
                    a = Number(o.rot || 0) * DG,
                    cs = Math.cos(a),
                    sn = Math.sin(a);
                patch = {
                    ca: (Number(o.ca) || 0) + dx * cs - dy * sn,
                    cb: (Number(o.cb) || 0) + dx * sn + dy * cs,
                    activeFloor: 0,
                    h: (Number(floors[floors.length - 1]?.z) || 0) + (Number(floors[floors.length - 1]?.h) || 0),
                };
            }
        }
    } else if (ed.t === "stacked-bevel-offset") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            floors = Array.isArray(o.floors) ? o.floors.map((f) => ({ ...f })) : [],
            floor = floors[h.floorIndex],
            offset = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        if (floor) {
            floor.bevelOffset = offset;
            if (!stackedIndividualEdit(o) && h.floorIndex === 0) floors.forEach((f) => (f.bevelOffset = offset));
            const last = floors[floors.length - 1];
            patch = {
                floors,
                bevelOffset: offset,
                floorCount: floors.length,
                h: (Number(last?.z) || 0) + (Number(last?.h) || 0),
            };
        }
    } else if (ed.t.startsWith("stacked-opening-")) {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            amount = (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1),
            value = clamp(h.start + (h.factor || 1) * amount, h.min, h.max);
        patch =
            ed.t === "stacked-opening-w-left" || ed.t === "stacked-opening-w-right"
                ? { openingW: value }
                : ed.t === "stacked-opening-h"
                  ? { openingH: value }
                  : { openingBack: value };
    } else if (ed.t.startsWith("stacked-")) {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            amount = (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1),
            floors = Array.isArray(o.floors) ? o.floors.map((f) => ({ ...f })) : [],
            floor = floors[h.floorIndex];
        if (floor) {
            const key = h.axis === "w" ? "w" : h.axis === "d" ? "d" : "h";
            floor[key] = clamp(h.start + amount, h.min, h.max);
            if (!stackedIndividualEdit(o) && h.floorIndex === 0 && ["w", "d", "h"].includes(key))
                floors.forEach((f) => (f[key] = floor[key]));
            const last = floors[floors.length - 1];
            patch = { floors, floorCount: floors.length, h: (Number(last?.z) || 0) + (Number(last?.h) || 0) };
        }
    } else if (ed.t === "awning-edgeZ") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            amount = (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1);
        patch = {
            awningEdgeZ: clamp(h.start + amount, h.min, h.max),
            awningFrontBottom: h.frontBottom,
            awningEdgeEdited: true,
        };
    } else if (ed.t === "awning-edgeY") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            amount = (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1);
        patch = { awningEdgeY: clamp(h.start + amount, h.min, h.max), awningEdgeEdited: true };
    } else if (ed.t === "sign-faceW" || ed.t === "sign-faceH") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            amount = (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1);
        const min = h.min,
            max = h.max,
            v = clamp(h.start + amount, min, max);
        patch = { [ed.t === "sign-faceW" ? "faceW" : "faceH"]: v };
    } else if (ed.t === "cone-height") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            v = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = { h: v };
    } else if (ed.t === "sphere-radius") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            radius = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = { ra: radius, rb: radius, h: radius * 2 };
    } else if (ed.t === "mv") {
        // 間取りモードは表示面内を移動させる。高さ・接地状態は専用の
        // 正面／横ギズモで編集し、生成面がX/Zでも位置移動を止めない。
        const floorMove = !!window.cityFloorPlanActive,
            plane = floorMove && o.k === 1 ? -1 : o.d - o.d * o.lift;
        const P1 = hit3(r, o.k, plane, cloc(o)); // 線をドラッグ＝面の上で移動
        if (P1 && ed.P0) {
            const dl = [0, 0, 0];
            dl[iu] = P1[iu] - ed.P0[iu];
            dl[iv] = P1[iv] - ed.P0[iv];
            const q = snap(dl, [iu, iv]);
            // 複数選択時は主役のドラッグ量をワールド移動量として全員へ同じように適用する。
            if (ed.group && ed.group.length > 1) {
                ed.moveDelta = [q[0], q[1], q[2]];
                patch = moveBy(o, ed.moveDelta);
            } else patch = moveBy(o, q); /* 間取りではca/cbだけを変え、Y方向のliftとoffは保持する。 */
        }
    } else if (ed.t === "axis") {
        let amount = null;
        if (ed.axisGuide?.hidden) amount = 0;
        else if (ed.axisGuide) {
            const dx = p.x - ed.p0.x,
                dy = p.y - ed.p0.y;
            amount = (dx * ed.axisGuide.dir.x + dy * ed.axisGuide.dir.y) / (ed.axisGuide.scale || 1);
        } else {
            const t = lineParam(r, ed.C0, ed.a);
            if (t != null && ed.t0 != null) amount = t - ed.t0;
        }
        if (amount != null) {
            ed.moveDelta = snap(
                ed.a.map((x) => x * amount),
                [ed.aj],
            );
            patch = moveBy(o, ed.moveDelta);
        }
    } // 矢印＝その軸に沿って移動
    else if (ed.t === "face") {
        let dl = null;
        if (ed.faceGuide?.hidden) dl = 0;
        else if (ed.faceGuide) {
            const dx = p.x - ed.p0.x,
                dy = p.y - ed.p0.y;
            dl = (dx * ed.faceGuide.dir.x + dy * ed.faceGuide.dir.y) / (ed.faceGuide.scale || 1);
        } else {
            const t = lineParam(r, ed.F0, ed.n);
            if (t != null && ed.t0 != null) dl = t - ed.t0;
        }
        if (dl != null) {
            const moved = o.type === "compound" ? dl : faceSnap(dl);
            patch =
                o.type === "compound"
                    ? compoundFacePatch(o, ed.fid, moved)
                    : o.type === "asset" && o.asset === "building"
                      ? buildingOuterFacePatch(o, ed.fid, moved)
                      : facePatch(o, ed.fid, moved);
        }
    } // 白い四角＝面の押し引き
    else if (ed.t === "ring") {
        if (o.type === "compound") {
            const raw = wrap180((Math.atan2(p.y - ed.sC.y, p.x - ed.sC.x) - ed.ang0) / DG),
                base = Number(o.compoundRot) || 0,
                target = freeRotation ? base + raw : Math.round((base + raw) / 15) * 15;
            patch = rotateCompoundBy(ed.o0 || o, target - base);
        } else {
            const P1 = hit3(r, o.k, ed.dd, cloc(o));
            if (P1) {
                const raw = (Math.atan2(P1[iv] - o.cb, P1[iu] - o.ca) - ed.ang0) / DG,
                    target = freeRotation ? Number(o.rot || 0) + raw : Math.round((Number(o.rot || 0) + raw) / 15) * 15;
                patch = { rot: wrap180(target) };
            }
        }
    } // 輪＝回転（通常15°吸着、Shiftで自由回転）
    if (!patch) return;
    if (!ed.started) {
        HU.push(S);
        RD = [];
        ed.started = true;
    }
    if ((ed.t === "mv" || ed.t === "axis") && ed.group && ed.group.length > 1 && ed.moveDelta) {
        // 初期スナップショットから再生成するので、ポインタ移動のたびに位置が累積しない。
        const ids = new Set(ed.group.map((g) => g.id));
        ed.group.forEach((g) => {
            const q = moveBy(g, ed.moveDelta, !!(g.attachment?.parentId && ids.has(g.attachment.parentId)));
            setOb(g.id, q);
        });
    } else setOb(ed.id, patch);
    render();
}

// ===== 書き出し範囲（ブレンダーのレンダー範囲のような枠） =====
function crect() {
    return {
        x: Math.min(CR.x0, CR.x1),
        y: Math.min(CR.y0, CR.y1),
        w: Math.abs(CR.x1 - CR.x0),
        h: Math.abs(CR.y1 - CR.y0),
    };
}
function overlay(c) {
    // 範囲の外を暗くして枠を表示（画面だけ。書き出しには入らない）
    if (!CR) return;
    const r = crect();
    c.save();
    c.fillStyle = "rgba(0,0,0,.45)";
    c.beginPath();
    c.rect(0, 0, W, H);
    c.rect(r.x, r.y, r.w, r.h);
    c.fill("evenodd");
    c.strokeStyle = "#ffd34d";
    c.lineWidth = 2 / Z;
    c.strokeRect(r.x, r.y, r.w, r.h);
    c.fillStyle = "#ffd34d";
    c.font = `${16 / Z}px system-ui`;
    c.fillText(Math.round(r.w) + "×" + Math.round(r.h), r.x + 4 / Z, r.y > 24 / Z ? r.y - 6 / Z : r.y + 18 / Z);
    c.restore();
}
$("crC").onclick = () => {
    CR = null;
    render();
};
$("crF").onclick = () => {
    let x0 = 1e9,
        y0 = 1e9,
        x1 = -1e9,
        y1 = -1e9; // 描いた線がちょうど入る範囲にする
    S.forEach((s) =>
        s.p.forEach((v) => {
            const q = sp(s, v);
            if (!q.ok) return;
            x0 = Math.min(x0, q.x);
            x1 = Math.max(x1, q.x);
            y0 = Math.min(y0, q.y);
            y1 = Math.max(y1, q.y);
        }),
    );
    if (x0 > x1) return;
    const m = 20;
    CR = { x0: clamp(x0 - m, 0, W), y0: clamp(y0 - m, 0, H), x1: clamp(x1 + m, 0, W), y1: clamp(y1 + m, 0, H) };
    render();
};

// ===== ツール切り替え（消しゴム・図形・範囲）と設定パネルの開閉 =====
function syncInteractionButtons() {
    // 視点／鉛筆と、編集／消しゴム／図形／範囲を同じ「ON」表示にしない。
    // 視点中はツールボタンをすべてOFF、描画中は選択した1ツールだけをONにする。
    $("mV").classList.toggle("on", mode === "view");
    $("mD").classList.toggle("on", mode === "draw" && tool === "pen");
    [
        ["tE", "erase"],
        ["tB", "border"],
        ["tM", "edit"],
    ].forEach(([id, n]) => $(id).classList.toggle("on", mode === "draw" && tool === n));
}
function setTool(t) {
    tool = t;
    setMode("draw");
    const HT = {
        border: "書き出し範囲：ドラッグで枠を指定。範囲指定はPNG保存・コピーに反映されます",
        erase: "消しゴム：なぞったところを消します",
        edit: "図形編集：線にさわって選択。空白を長押ししてドラッグするとボックス選択。Shift/Ctrl/⌘クリックでも複数選択でき、選択済みの線をドラッグするとまとめて移動。iPadは指またはApple Pencilで長押しドラッグ。矢印＝軸に沿って移動／白い四角＝面を押し引き／点線の輪＝回転／線をドラッグ＝面の上で移動。看板は絵枠W・絵枠Hと外形の面ハンドル、建物は開口W/H・奥面と外側面、円錐は高さ、球体は半径ハンドルをドラッグできます",
    };
    if (HT[tool]) $("hint").textContent = HT[tool] + " ／ ⌘(Ctrl)+ドラッグ＝視点移動";
}
$("tE").onclick = () => setTool("erase");
// 「範囲」は同じボタンをもう一度押すとOFFに戻せるトグルにする。
// 指定済みの書き出し範囲(CR)自体は消さず、範囲ドラッグだけを終了する。
$("tB").onclick = () => {
    if (mode === "draw" && tool === "border") setMode("view");
    else setTool("border");
};
$("tM").onclick = () => setTool("edit");
const edge = document.createElement("button");
edge.id = "edgeTab";
edge.title = "設定パネルを開閉";
document.body.appendChild(edge); // パネルの端にいつも出るタブ
function setSide(h) {
    const sd = $("side");
    sd.classList.toggle("hide", h);
    $("tg").textContent = h ? "設定を開く" : "設定を隠す";
    edge.textContent = h ? "▶" : "◀";
    edge.style.left = h ? "env(safe-area-inset-left,0px)" : sd.getBoundingClientRect().right + "px";
    try {
        localStorage.setItem("pgrid-side", h ? "1" : "0");
    } catch (e) {}
}
$("tg").onclick = () => {
    setSide(!$("side").classList.contains("hide"));
    fit();
};
edge.onclick = $("tg").onclick;
addEventListener("resize", () => setSide($("side").classList.contains("hide")));

// ===== 書き出し用の隠れ線除去 =====
// オブジェクトの面を簡易Zバッファへ rasterize し、ビューから遮られる線分だけを切る。
// 通常表示は従来どおり全線を描き、PNGの「背面線除去」項目だけでこの処理を使う。
function addExportBoxFaces(out, o, w, d, z0, z1) {
    const x = w / 2,
        y = d / 2,
        v = [
            [-x, -y, z0],
            [x, -y, z0],
            [x, y, z0],
            [-x, y, z0],
            [-x, -y, z1],
            [x, -y, z1],
            [x, y, z1],
            [-x, y, z1],
        ];
    const f = [
        [0, 1, 2, 3],
        [4, 7, 6, 5],
        [0, 4, 5, 1],
        [1, 5, 6, 2],
        [2, 6, 7, 3],
        [3, 7, 4, 0],
    ];
    f.forEach((q) => {
        const a = q.map((i) => L2W(o, ...v[i]));
        out.push([a[0], a[1], a[2]], [a[0], a[2], a[3]]);
    });
}
function exportSurfaceTriangles(o) {
    const out = [];
    if (o?.type === "compound") {
        compoundPartsAt(o).forEach((part) => out.push(...exportSurfaceTriangles(part)));
        return out;
    }
    const w = Math.abs(2 * Number(o.ra) || 1),
        d = Math.abs(2 * Number(o.rb) || 1),
        h = Math.max(0.01, Math.abs(Number(o.h) || 0.01));
    const L = (x, y, z) => L2W(o, x, y, z),
        tri = (a, b, c) => out.push([L(...a), L(...b), L(...c)]),
        quad = (a, b, c, d) => {
            tri(a, b, c);
            tri(a, c, d);
        };
    const disk = (z, n = 24) => {
        const c = [0, 0, z];
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2,
                b = ((i + 1) / n) * Math.PI * 2;
            tri(
                c,
                [(w / 2) * Math.cos(a), (d / 2) * Math.sin(a), z],
                [(w / 2) * Math.cos(b), (d / 2) * Math.sin(b), z],
            );
        }
    };
    const cylinder = (z0, z1, n = 24) => {
        disk(z0, n);
        disk(z1, n);
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2,
                b = ((i + 1) / n) * Math.PI * 2,
                A = [(w / 2) * Math.cos(a), (d / 2) * Math.sin(a), z0],
                B = [(w / 2) * Math.cos(b), (d / 2) * Math.sin(b), z0],
                C = [(w / 2) * Math.cos(b), (d / 2) * Math.sin(b), z1],
                D = [(w / 2) * Math.cos(a), (d / 2) * Math.sin(a), z1];
            quad(A, B, C, D);
        }
    };
    const boxAt = (cx, cy, bw, bd, z0, z1) => {
        const x = bw / 2,
            y = bd / 2,
            v = [
                [cx - x, cy - y, z0],
                [cx + x, cy - y, z0],
                [cx + x, cy + y, z0],
                [cx - x, cy + y, z0],
                [cx - x, cy - y, z1],
                [cx + x, cy - y, z1],
                [cx + x, cy + y, z1],
                [cx - x, cy + y, z1],
            ],
            f = [
                [0, 1, 2, 3],
                [4, 7, 6, 5],
                [0, 4, 5, 1],
                [1, 5, 6, 2],
                [2, 6, 7, 3],
                [3, 7, 4, 0],
            ];
        f.forEach((q) => quad(v[q[0]], v[q[1]], v[q[2]], v[q[3]]));
    };
    const beveledAt = (cx, cy, bw, bd, z0, z1, offset, segments) => {
        const footprint = beveledBoxFootprint(bw, bd, offset, segments),
            center0 = [cx, cy, z0],
            center1 = [cx, cy, z1];
        for (let i = 0; i < footprint.length; i++) {
            const j = (i + 1) % footprint.length,
                a = [cx + footprint[i][0], cy + footprint[i][1], z0],
                b = [cx + footprint[j][0], cy + footprint[j][1], z0],
                c = [cx + footprint[j][0], cy + footprint[j][1], z1],
                d0 = [cx + footprint[i][0], cy + footprint[i][1], z1];
            tri(center0, b, a);
            tri(center1, d0, c);
            quad(a, b, c, d0);
        }
    };
    const openingBoxAt = (cx, cy, bw, bd, z0, z1, opening) => {
        const x = bw / 2,
            y = bd / 2,
            ow = clamp(Number(opening.openingW) || bw * 0.56, 0.1, Math.max(0.1, bw - 0.1)),
            oh = clamp(Number(opening.openingH) || (z1 - z0) * 0.66, 0.1, Math.max(0.1, z1 - z0 - 0.01)),
            panelY = clamp(Number(opening.openingBack), -y + 0.025, y - 0.025),
            q = (a, b, c, d) => quad(a, b, c, d);
        q([-x, -y, z0], [x, -y, z0], [x, y, z0], [-x, y, z0]);
        q([-x, -y, z1], [-x, y, z1], [x, y, z1], [x, -y, z1]);
        q([-x, -y, z0], [-x, -y, z1], [-x, y, z1], [-x, y, z0]);
        q([x, -y, z0], [x, y, z0], [x, y, z1], [x, -y, z1]);
        q([-x, y, z0], [-x, y, z1], [x, y, z1], [x, y, z0]);
        q([-x, -y, z0], [-ow / 2, -y, z0], [-ow / 2, -y, z1], [-x, -y, z1]);
        q([ow / 2, -y, z0], [x, -y, z0], [x, -y, z1], [ow / 2, -y, z1]);
        q([-ow / 2, -y, oh + z0], [ow / 2, -y, oh + z0], [ow / 2, -y, z1], [-ow / 2, -y, z1]);
        q([-ow / 2, -y, z0], [-ow / 2, panelY, z0], [-ow / 2, panelY, oh + z0], [-ow / 2, -y, oh + z0]);
        q([ow / 2, -y, z0], [ow / 2, -y, oh + z0], [ow / 2, panelY, oh + z0], [ow / 2, panelY, z0]);
        q([-ow / 2, -y, oh + z0], [-ow / 2, panelY, oh + z0], [ow / 2, panelY, oh + z0], [ow / 2, -y, oh + z0]);
        q([-ow / 2, panelY, z0], [ow / 2, panelY, z0], [ow / 2, panelY, oh + z0], [-ow / 2, panelY, oh + z0]);
    };
    const beveledOpeningAt = (cx, cy, bw, bd, z0, z1, offset, segments, opening) => {
        const footprint = beveledBoxFootprint(bw, bd, offset, segments),
            x = bw / 2,
            y = bd / 2,
            ow = clamp(Number(opening.openingW) || bw * 0.56, 0.1, Math.max(0.1, bw - 0.1)),
            oh = clamp(Number(opening.openingH) || (z1 - z0) * 0.66, 0.1, Math.max(0.1, z1 - z0 - 0.01)),
            panelY = clamp(Number(opening.openingBack), -y + 0.025, y - 0.025),
            bottom = [cx, cy, z0],
            top = [cx, cy, z1];
        for (let i = 0; i < footprint.length; i++) {
            const j = (i + 1) % footprint.length,
                a = [cx + footprint[i][0], cy + footprint[i][1], z0],
                b = [cx + footprint[j][0], cy + footprint[j][1], z0],
                c = [cx + footprint[j][0], cy + footprint[j][1], z1],
                d0 = [cx + footprint[i][0], cy + footprint[i][1], z1],
                near = Math.abs(footprint[i][1] + y) < 1e-4 && Math.abs(footprint[j][1] + y) < 1e-4;
            tri(bottom, b, a);
            tri(top, d0, c);
            if (!near) quad(a, b, c, d0);
            else {
                const lo = Math.min(footprint[i][0], footprint[j][0]) + cx,
                    hi = Math.max(footprint[i][0], footprint[j][0]) + cx,
                    wall = (xa, xb, za, zb) => {
                        const l = Math.max(lo, xa + cx),
                            r = Math.min(hi, xb + cx);
                        if (r > l + 1e-5) quad([l, cy - y, za], [r, cy - y, za], [r, cy - y, zb], [l, cy - y, zb]);
                    };
                wall(-x, -ow / 2, z0, z1);
                wall(ow / 2, x, z0, z1);
                wall(-ow / 2, ow / 2, oh + z0, z1);
            }
        }
        quad(
            [cx - ow / 2, cy - y, z0],
            [cx - ow / 2, cy + panelY, z0],
            [cx - ow / 2, cy + panelY, oh + z0],
            [cx - ow / 2, cy - y, oh + z0],
        );
        quad(
            [cx + ow / 2, cy - y, z0],
            [cx + ow / 2, cy - y, oh + z0],
            [cx + ow / 2, cy + panelY, oh + z0],
            [cx + ow / 2, cy + panelY, z0],
        );
        quad(
            [cx - ow / 2, cy - y, oh + z0],
            [cx - ow / 2, cy + panelY, oh + z0],
            [cx + ow / 2, cy + panelY, oh + z0],
            [cx + ow / 2, cy - y, oh + z0],
        );
        quad(
            [cx - ow / 2, cy + panelY, z0],
            [cx + ow / 2, cy + panelY, z0],
            [cx + ow / 2, cy + panelY, oh + z0],
            [cx - ow / 2, cy + panelY, oh + z0],
        );
    };
    const ellipsoid = (cx, cy, cz, rx, ry, rz, lat = 8, lon = 12) => {
        for (let j = 0; j < lat; j++) {
            const p0 = -Math.PI / 2 + (j * Math.PI) / lat,
                p1 = -Math.PI / 2 + ((j + 1) * Math.PI) / lat;
            for (let i = 0; i < lon; i++) {
                const a = (i * 2 * Math.PI) / lon,
                    b = ((i + 1) * 2 * Math.PI) / lon,
                    q = (p, t) => [
                        cx + rx * Math.cos(p) * Math.cos(t),
                        cy + ry * Math.cos(p) * Math.sin(t),
                        cz + rz * Math.sin(p),
                    ],
                    A = q(p0, a),
                    B = q(p0, b),
                    C = q(p1, b),
                    D = q(p1, a);
                tri(A, B, C);
                tri(A, C, D);
            }
        }
    };
    const segment = (a, b, r, n = 6) => {
        const sub = (u, v) => u.map((x, i) => x - v[i]),
            add = (u, v) => u.map((x, i) => x + v[i]),
            mul = (u, s) => u.map((x) => x * s),
            dotL = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2],
            crossL = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]],
            unit = (u) => {
                const q = Math.hypot(...u) || 1;
                return u.map((x) => x / q);
            },
            axis = unit(sub(b, a)),
            ref = Math.abs(axis[2]) < 0.85 ? [0, 0, 1] : [0, 1, 0],
            u = unit(crossL(axis, ref)),
            v = unit(crossL(axis, u)),
            ra = [],
            rb = [];
        for (let i = 0; i < n; i++) {
            const t = (i / n) * Math.PI * 2,
                off = add(mul(u, Math.cos(t) * r), mul(v, Math.sin(t) * r));
            ra.push(add(a, off));
            rb.push(add(b, off));
        }
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            quad(ra[i], ra[j], rb[j], rb[i]);
            tri(a, ra[j], ra[i]);
            tri(b, rb[i], rb[j]);
        }
    };
    const kind = o.asset || o.type;
    if (kind === "beveledBox" && typeof beveledBoxFootprint === "function") {
        const q = beveledBoxParams(o),
            footprint = beveledBoxFootprint(q.w, q.d, q.bevelOffset, q.bevelSegments),
            z0 = 0,
            z1 = Math.max(0.01, Number(o.h) || 0.01),
            center0 = [0, 0, z0],
            center1 = [0, 0, z1];
        // 面取りした凸多角形を上下面のファンと側面の四角形へ分解する。
        for (let i = 0; i < footprint.length; i++) {
            const j = (i + 1) % footprint.length,
                a = [footprint[i][0], footprint[i][1], z0],
                b = [footprint[j][0], footprint[j][1], z0],
                c = [footprint[j][0], footprint[j][1], z1],
                d0 = [footprint[i][0], footprint[i][1], z1];
            tri(center0, b, a);
            tri(center1, d0, c);
            quad(a, b, c, d0);
        }
        return out;
    }
    if (kind === "pathPipe" && typeof pathPipeMesh === "function") {
        const mesh = pathPipeMesh(o);
        mesh.triangles.forEach((triangle) => out.push(triangle.map((v) => L(...v))));
        return out;
    }
    if (kind === "stackedBuilding" || kind === "beveledStackedBuilding") {
        const floors =
            Array.isArray(o.floors) && o.floors.length
                ? o.floors
                : [{ x: 0, y: 0, z: 0, w, d, h, rimHeight: 0.16, rimOverhang: 0.18 }];
        floors.forEach((f, i) => {
            const fw = Math.max(0.05, Math.abs(Number(f.w) || w)),
                fd = Math.max(0.05, Math.abs(Number(f.d) || d)),
                fh = Math.max(0.05, Math.abs(Number(f.h) || h)),
                fz = Number(f.z) || 0,
                fx = Number(f.x) || 0,
                fy = Number(f.y) || 0,
                rh = clamp(Math.abs(Number(f.rimHeight) || Number(o.rimHeight) || 0.16), 0.01, fh),
                ro = Math.max(0, Math.abs(Number(f.rimOverhang) || Number(o.rimOverhang) || 0.18)),
                bevelOffset = Number.isFinite(Number(f.bevelOffset))
                    ? Number(f.bevelOffset)
                    : Number(o.bevelOffset) || 0.28,
                bevelSegments = beveledBoxSegments(
                    f.bevelSegments,
                    f.bevelEdges,
                    beveledBoxSegments(o.bevelSegments, o.bevelEdges),
                ),
                opening = i === 0 && stackedOpeningEnabled(o) ? stackedOpeningParams(o, f) : null;
            if (kind === "beveledStackedBuilding") {
                if (opening) beveledOpeningAt(fx, fy, fw, fd, fz, fz + fh, bevelOffset, bevelSegments, opening);
                else beveledAt(fx, fy, fw, fd, fz, fz + fh, bevelOffset, bevelSegments);
                // 下側の縁は全階で作らず、各階の上側だけに縁を配置する。
                beveledAt(fx, fy, fw + ro * 2, fd + ro * 2, fz + fh - rh, fz + fh, bevelOffset, bevelSegments);
            } else {
                if (opening) openingBoxAt(fx, fy, fw, fd, fz, fz + fh, opening);
                else boxAt(fx, fy, fw, fd, fz, fz + fh);
                // 下側の縁は全階で作らず、各階の上側だけに縁を配置する。
                boxAt(fx, fy, fw + ro * 2, fd + ro * 2, fz + fh - rh, fz + fh);
            }
        });
        return out;
    }
    if (kind === "balcony") {
        const floorT = clamp(Number(o.balconyFloorThickness) || 0.16, 0.04, Math.max(0.05, h * 0.7)),
            railH = clamp(Number(o.balconyRailHeight) || Math.max(0.18, h - floorT), 0.12, Math.max(0.12, h - 0.01)),
            railT = clamp(Number(o.balconyRailThickness) || 0.12, 0.035, Math.min(w, d) * 0.35);
        boxAt(0, 0, w, d, 0, floorT);
        if (o.balconyFrontRail !== false) boxAt(0, -d / 2 + railT / 2, w, railT, floorT, floorT + railH);
        if (o.balconySideRail !== false) {
            boxAt(-w / 2 + railT / 2, 0, railT, d, floorT, floorT + railH);
            boxAt(w / 2 - railT / 2, 0, railT, d, floorT, floorT + railH);
        }
        return out;
    }
    if (kind === "awning") {
        const g = awningGeometry(o),
            x = g.w / 2,
            baseY = g.baseFrontY,
            edgeY = g.edgeY,
            backY = g.d / 2;
        quad([-x, edgeY, g.edgeZ], [x, edgeY, g.edgeZ], [x, backY, g.h], [-x, backY, g.h]);
        quad(
            [-x, baseY, g.frontBottom],
            [x, baseY, g.frontBottom],
            [x, backY, g.backBottom],
            [-x, backY, g.backBottom],
        );
        quad([-x, baseY, g.frontBottom], [x, baseY, g.frontBottom], [x, edgeY, g.edgeZ], [-x, edgeY, g.edgeZ]);
        quad([-x, backY, g.backBottom], [x, backY, g.backBottom], [x, backY, g.h], [-x, backY, g.h]);
        quad([-x, baseY, g.frontBottom], [-x, backY, g.backBottom], [-x, backY, g.h], [-x, edgeY, g.edgeZ]);
        quad([x, baseY, g.frontBottom], [x, edgeY, g.edgeZ], [x, backY, g.h], [x, backY, g.backBottom]);
        return out;
    }
    if (kind === "building") {
        // 開口OFFでは面表示も通常の閉じた直方体へ戻す。
        if (o.openingEnabled === false) {
            boxAt(0, 0, w, d, 0, h);
            return out;
        }
        const g = buildingGeometry(o),
            side = Math.max(0.05, (g.w - g.openingW) / 2),
            cx = (g.openingW + side) / 2,
            panelY = g.backY;
        boxAt(-cx, 0, side, g.d, 0, g.h);
        boxAt(cx, 0, side, g.d, 0, g.h);
        boxAt(0, 0, g.w, g.d, g.openingH, g.h);
        // 開口はトンネルではなく、奥側に閉じた内壁を持つ。外側の奥行きと同じ位置へ置く。
        quad(
            [-g.openingW / 2, panelY, 0],
            [g.openingW / 2, panelY, 0],
            [g.openingW / 2, panelY, g.openingH],
            [-g.openingW / 2, panelY, g.openingH],
        );
        return out;
    }
    if ((o.type === "rect" || kind === "rect") && !o.extrude) {
        quad([-w / 2, -d / 2, 0], [w / 2, -d / 2, 0], [w / 2, d / 2, 0], [-w / 2, d / 2, 0]);
        return out;
    }
    if (o.type === "rect" || kind === "box" || kind === "sign") {
        addExportBoxFaces(out, o, w, d, kind === "sign" ? h * 0.08 : 0, kind === "sign" ? h * 0.82 : h);
        return out;
    }
    if (o.type === "circ" || kind === "cylinder" || kind === "lantern") {
        cylinder(kind === "lantern" ? h * 0.22 : 0, kind === "lantern" ? h * 0.7 : h, kind === "lantern" ? 12 : 32);
        return out;
    }
    if (kind === "crosswalk") {
        quad([-w / 2, -d / 2, 0.01], [w / 2, -d / 2, 0.01], [w / 2, d / 2, 0.01], [-w / 2, d / 2, 0.01]);
        return out;
    }
    if (kind === "cone") {
        // 底面は中心からの三角形、側面は隣り合う外周頂点と頂点の一枚だけ。
        // 各区間を二重に登録しないので、面ONでも重複・交差する三角面にならない。
        disk(0, 32);
        const apex = [0, 0, h],
            n = 32;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2,
                b = ((i + 1) / n) * Math.PI * 2;
            tri(
                [(w / 2) * Math.cos(a), (d / 2) * Math.sin(a), 0],
                [(w / 2) * Math.cos(b), (d / 2) * Math.sin(b), 0],
                apex,
            );
        }
        return out;
    }
    if (kind === "triPrism") {
        const x = w / 2,
            y = d / 2,
            A = [
                [-x, -y, 0],
                [x, -y, 0],
                [0, -y, h],
            ],
            B = [
                [-x, y, 0],
                [x, y, 0],
                [0, y, h],
            ];
        quad(A[0], A[1], A[2], A[2]);
        quad(B[2], B[1], B[0], B[0]);
        for (let i = 0; i < 3; i++) quad(A[i], B[i], B[(i + 1) % 3], A[(i + 1) % 3]);
        return out;
    }
    if (kind === "triPyramid") {
        const x = w / 2,
            y = d / 2,
            A = [
                [-x, -y, 0],
                [x, -y, 0],
                [0, y, 0],
            ],
            ap = [0, 0, h];
        quad(A[0], A[1], A[2], A[2]);
        for (let i = 0; i < 3; i++) tri(A[i], A[(i + 1) % 3], ap);
        return out;
    }
    if (kind === "sphere") {
        const lat = 12,
            lon = 24;
        for (let j = 0; j < lat; j++) {
            const p0 = -Math.PI / 2 + (j * Math.PI) / lat,
                p1 = -Math.PI / 2 + ((j + 1) * Math.PI) / lat;
            for (let i = 0; i < lon; i++) {
                const a = (i * 2 * Math.PI) / lon,
                    b = ((i + 1) * 2 * Math.PI) / lon;
                const q = (p, t) => [
                    (w / 2) * Math.cos(p) * Math.cos(t),
                    (d / 2) * Math.cos(p) * Math.sin(t),
                    h / 2 + (h / 2) * Math.sin(p),
                ];
                const A = q(p0, a),
                    B = q(p0, b),
                    C = q(p1, b),
                    D = q(p1, a);
                tri(A, B, C);
                tri(A, C, D);
            }
        }
        return out;
    }
    if (kind === "person") {
        // 人物は包絡箱ではなく、線画と同じ胴体・脚・頭の形へ面を付ける。
        // これで面ON時に人物全体が大きな直方体で塗りつぶされない。
        const bodyScale = clamp(Number(o.bodyScale) || 1, 0.6, 1.8),
            shoulderScale = clamp(Number(o.shoulderScale) || 1, 0.6, 1.6),
            headScale = clamp(Number(o.headScale) || 1, 0.7, 1.5),
            legSpread = clamp(Number(o.legSpread) || 1, 0.6, 1.8),
            pose = o.pose || "stand";
        const defaults = { stand: [0, 0, 0], walk: [0.22, 0, 0], crouch: [0.04, 0.65, 0], sit: [0.1, 0.35, 0] },
            def = defaults[pose] || defaults.stand;
        const stride = clamp(Number.isFinite(Number(o.poseStride)) ? Number(o.poseStride) : def[0], 0, 0.5),
            crouch = clamp(Number.isFinite(Number(o.poseCrouch)) ? Number(o.poseCrouch) : def[1], 0, 1),
            lean = clamp(Number.isFinite(Number(o.poseLean)) ? Number(o.poseLean) : def[2], -0.35, 0.35),
            headTilt = clamp(Number(o.headTilt) || 0, -25, 25);
        const bw = 0.28 * h * bodyScale * shoulderScale,
            bd = 0.16 * h * bodyScale,
            leg = 0.055 * h * bodyScale,
            headR = 0.095 * h * headScale;
        const legTop = (0.47 - 0.16 * crouch) * h,
            torso0 = (0.44 - 0.16 * crouch) * h,
            torso1 = (0.78 - 0.18 * crouch) * h,
            head0 = (0.84 - 0.18 * crouch) * h,
            head1 = (0.99 - 0.18 * crouch) * h,
            footY = [-stride, stride],
            kneeY = [-0.02 * h, 0.02 * h],
            kneeX = [-0.09 * h * legSpread, 0.09 * h * legSpread],
            bodyY = lean * 0.18,
            headY = lean * 0.42,
            headTopX = Math.sin(headTilt * DG) * 0.06 * h;
        const torsoR = Math.max(0.012, Math.min(leg * 0.72, bd * 0.22));
        boxAt(0, 0, leg * 1.5, bd * 0.85, 0, 0.08 * h);
        if (pose === "sit") {
            segment([-0.09 * h * legSpread, bodyY, 0.32 * h], [kneeX[0], kneeY[0], 0.3 * h], torsoR);
            segment([kneeX[0], kneeY[0], 0.3 * h], [kneeX[0], footY[0], 0], torsoR);
            segment([0.09 * h * legSpread, bodyY, 0.32 * h], [kneeX[1], kneeY[1], 0.3 * h], torsoR);
            segment([kneeX[1], kneeY[1], 0.3 * h], [kneeX[1], footY[1], 0], torsoR);
        } else {
            segment([kneeX[0], footY[0], 0], [kneeX[0], kneeY[0], legTop], torsoR);
            segment([kneeX[1], footY[1], 0], [kneeX[1], kneeY[1], legTop], torsoR);
        }
        boxAt(0, 0, bw, bd, torso0, torso1);
        ellipsoid(headTopX / 2, headY + 0.01 * h, (head0 + head1) / 2, headR, headR * 0.9, (head1 - head0) / 2, 8, 12);
        return out;
    }
    if (kind === "stairs") {
        // 階段は段板・蹴上げ・左右側面・底面・最奥面で閉じた実形状にする。
        // 各段の側面を区間ごとの長方形に分けることで、重複面や斜めの包絡箱を作らない。
        const n = Math.max(2, Math.min(24, Math.round(o.steps || 6))),
            sd = d / n,
            sh = h / n,
            x = w / 2;
        for (let i = 0; i < n; i++) {
            const y0 = -d / 2 + i * sd,
                y1 = y0 + sd,
                z = (i + 1) * sh,
                z0 = i * sh;
            // 段板（水平）
            quad([-x, y0, z], [x, y0, z], [x, y1, z], [-x, y1, z]);
            // 蹴上げ（垂直）
            quad([-x, y0, z0], [x, y0, z0], [x, y0, z], [-x, y0, z]);
            // 左右の側面。各区間の下面から段板までを一枚で閉じる。
            quad([-x, y0, 0], [-x, y1, 0], [-x, y1, z], [-x, y0, z]);
            quad([x, y1, 0], [x, y0, 0], [x, y0, z], [x, y1, z]);
        }
        // 底面と最奥の立ち上がり面。
        quad([-x, -d / 2, 0], [x, -d / 2, 0], [x, d / 2, 0], [-x, d / 2, 0]);
        quad([-x, d / 2, 0], [x, d / 2, 0], [x, d / 2, h], [-x, d / 2, h]);
        return out;
    }
    // 人物以外の細分化された線画は、全体の包絡箱で背面線を落とす安全側の近似。
    addExportBoxFaces(out, o, w, d, h * 0.02, h);
    return out;
}
function exportPoint(v, tf) {
    const rel = V.add(v, CO()),
        q = scr3(rel);
    if (!q.ok) return null;
    const depth = orthView
        ? dot3(rel, orthBasis().depth)
        : T === "f"
          ? Math.hypot(rel[0], rel[1], rel[2])
          : cam(rel)[2];
    return { x: q.x * tf[0] + tf[4], y: q.y * tf[3] + tf[5], depth };
}
function buildExportDepth(cw, ch, tf) {
    const depth = new Float32Array(cw * ch);
    depth.fill(Infinity);
    const tris = [],
        seen = new Set();
    S.forEach((s) => {
        if (s.ob && objectVisible(s.ob) && !seen.has(s.ob.id)) {
            seen.add(s.ob.id);
            tris.push(...exportSurfaceTriangles(s.ob));
        }
    });
    const putTri = (tr) => {
        const p = tr.map((v) => exportPoint(v, tf));
        if (p.some((q) => !q || !Number.isFinite(q.depth) || q.depth < -0.001)) return;
        const area = (p[1].x - p[0].x) * (p[2].y - p[0].y) - (p[1].y - p[0].y) * (p[2].x - p[0].x);
        if (Math.abs(area) < 0.001) return;
        const x0 = Math.max(0, Math.floor(Math.min(p[0].x, p[1].x, p[2].x))),
            x1 = Math.min(cw - 1, Math.ceil(Math.max(p[0].x, p[1].x, p[2].x))),
            y0 = Math.max(0, Math.floor(Math.min(p[0].y, p[1].y, p[2].y))),
            y1 = Math.min(ch - 1, Math.ceil(Math.max(p[0].y, p[1].y, p[2].y)));
        for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++) {
                const px = x + 0.5,
                    py = y + 0.5,
                    w0 = ((p[1].x - p[0].x) * (py - p[0].y) - (p[1].y - p[0].y) * (px - p[0].x)) / area,
                    w1 = ((p[2].x - p[1].x) * (py - p[1].y) - (p[2].y - p[1].y) * (px - p[1].x)) / area,
                    w2 = ((p[0].x - p[2].x) * (py - p[2].y) - (p[0].y - p[2].y) * (px - p[2].x)) / area;
                if ((w0 >= -1e-5 && w1 >= -1e-5 && w2 >= -1e-5) || (w0 <= 1e-5 && w1 <= 1e-5 && w2 <= 1e-5)) {
                    const z = p[0].depth * w1 + p[1].depth * w2 + p[2].depth * w0,
                        idx = y * cw + x;
                    if (z < depth[idx]) depth[idx] = z;
                }
            }
    };
    tris.forEach(putTri);
    return depth;
}
function strokeWVisible(c, s, depth, cw, ch, tf) {
    if (!s.ob || !s.d3) {
        strokeW(c, s);
        return;
    }
    c.strokeStyle = s.c;
    c.lineWidth = effectiveLineWidth(s);
    c.lineCap = c.lineJoin = "round";
    c.beginPath();
    let on = false;
    const put = (v) => {
        const rel = V.add(v, CO()),
            q = scr3(rel),
            e = exportPoint(v, tf);
        if (!e || !q.ok) {
            on = false;
            return;
        }
        const x = Math.round(e.x),
            y = Math.round(e.y);
        if (x < 0 || x >= cw || y < 0 || y >= ch) {
            on = false;
            return;
        }
        const z = depth[y * cw + x],
            eps = Math.max(0.025, Math.abs(e.depth) * 0.00015);
        if (e.depth > z + eps) {
            on = false;
            return;
        }
        on ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y);
        on = true;
    };
    s.p.forEach((v, i) => {
        if (i) {
            const a = s.p[i - 1],
                n = Math.max(1, Math.ceil(Math.hypot(v[0] - a[0], v[1] - a[1], v[2] - a[2]) * 10));
            for (let j = 1; j < n; j++) put(V.add(a, v, 1 - j / n, j / n));
        }
        put(v);
    });
    c.stroke();
}

// ===== 線画レイヤー：線だけ別キャンバスに描き、アンチエイリアスを消して二値化する =====
let LC = null;
// 書き出し用の線だけを別キャンバスへ描く。
// hidden=trueでは面の深度情報を使って、背面に隠れる線を除去する。
function lineLayer(view, withCur, cw = W, ch = H, tf = null, hidden = false) {
    // tf=書き出し用の変換 [拡大,0,0,拡大,ずれx,ずれy]
    if (!LC || LC.width !== cw || LC.height !== ch) {
        LC = document.createElement("canvas");
        LC.width = cw;
        LC.height = ch;
    }
    const x = LC.getContext("2d", { willReadFrequently: true });
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, cw, ch);
    if (tf) x.setTransform(...tf);
    else if (view) x.setTransform(Z, 0, 0, Z, ox, oy); // 画面表示用はズーム・移動つき
    const hiddenDepth = hidden ? buildExportDepth(cw, ch, tf || [1, 0, 0, 1, 0, 0]) : null;
    S.forEach((s) => {
        if (s.ob && !objectVisible(s.ob)) return;
        hidden ? strokeWVisible(x, s, hiddenDepth, cw, ch, tf || [1, 0, 0, 1, 0, 0]) : strokeW(x, s);
    });
    if (withCur) drawCur(x);
    if (withCur && prev) prev.forEach((s) => strokeW(x, s));
    if ($("bin").checked) {
        // 二値化：しきい値以上の画素だけ完全に不透明にする
        x.setTransform(1, 0, 0, 1, 0, 0);
        const im = x.getImageData(0, 0, cw, ch),
            d = im.data,
            t = P.bt;
        for (let i = 3; i < d.length; i += 4) d[i] = d[i] < t ? 0 : 255;
        x.putImageData(im, 0, 0);
    }
    return LC;
}

// ===== 地面のグリッド：床(y=-1)の格子。カメラの高さ・位置・向きを変えるとちゃんと見え方が変わる =====
function floorGrid(c) {
    const n = Math.round(P.gn),
        cell = P.gs,
        ext = n * cell,
        co = CO(),
        steps = Math.min(400, n * 8);
    c.save();
    c.lineJoin = "round";
    const line = (a, b) => {
        let on = false; // 線を細かく区切って投影する（魚眼でも曲がって見える）
        for (let i = 0; i <= steps; i++) {
            const t = i / steps,
                q = scr3(V.add([a[0] + (b[0] - a[0]) * t, -1, a[2] + (b[2] - a[2]) * t], co));
            if (!q.ok) {
                on = false;
                continue;
            }
            on ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y);
            on = true;
        }
    };
    const pass = (sel, col, alpha, w) => {
        c.strokeStyle = col;
        c.globalAlpha = alpha;
        c.lineWidth = w;
        c.beginPath();
        for (let k = -n; k <= n; k++)
            if (sel(k)) {
                line([k * cell, -1, -ext], [k * cell, -1, ext]);
                line([-ext, -1, k * cell], [ext, -1, k * cell]);
            }
        c.stroke();
    };
    pass((k) => k % 5 !== 0, "#7d8279", P.ga * 0.55, P.gw); // ふつうの線
    pass((k) => k % 5 === 0 && k !== 0, "#7d8279", Math.min(1, P.ga * 1.1), P.gw * 1.6); // 5マスごとの太い線
    c.lineWidth = P.gw * 2.4;
    c.globalAlpha = Math.min(1, P.ga * 1.3); // 原点を通る線（X=橙・Z=緑）
    c.strokeStyle = "#e8743d";
    c.beginPath();
    line([-ext, -1, 0], [ext, -1, 0]);
    c.stroke();
    c.strokeStyle = "#2fb5a5";
    c.beginPath();
    line([0, -1, -ext], [0, -1, ext]);
    c.stroke();
    c.restore();
}

// 正投影ビューの補助線。消失点はなく、軸に沿った水平・垂直線として表示する。
function orthGuides(c) {
    const sc = orthScale(),
        col = ["#e8743d", "#2fb5a5", "#4a7be8"];
    c.save();
    c.globalAlpha = P.ga;
    c.lineWidth = P.gw;
    c.setLineDash([]);
    const draw = (x0, y0, x1, y1, color) => {
        c.strokeStyle = color;
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x1, y1);
        c.stroke();
    };
    const b = orthBasis();
    if (orthView === "top") {
        for (let i = -20; i <= 20; i++) {
            const x = W / 2 + i * sc;
            draw(x, 0, x, H, col[0]);
            const y = H / 2 + i * sc;
            draw(0, y, W, y, col[2]);
        }
    } else {
        for (let i = -20; i <= 20; i++) {
            const x = W / 2 + i * sc;
            draw(x, 0, x, H, col[orthView === "front" ? 0 : 1]);
            const y = H / 2 + i * sc;
            draw(0, y, W, y, col[2]);
        }
    }
    c.restore();
}

// ===== 補助線（キャンバスに入る角度範囲にだけ本数を割り振る＝密に出来る） =====
function guides(c) {
    const col = ["#e8743d", "#2fb5a5", "#4a7be8"],
        diag = Math.hypot(W, H),
        n = P.n;
    AX.forEach((A, i) => {
        if (!show[i]) return;
        c.strokeStyle = col[i];
        c.globalAlpha = P.ga;
        c.lineWidth = P.gw;
        c.beginPath();
        if (A.vp) {
            const { x, y } = A.vp,
                inside = x >= 0 && x <= W && y >= 0 && y <= H,
                L = Math.hypot(x - W / 2, y - H / 2) + diag;
            let base = 0,
                lo = 0,
                hi = 0;
            if (!inside) {
                // 4隅への角度の最小〜最大を求める
                base = Math.atan2(H / 2 - y, W / 2 - x);
                lo = 1e9;
                hi = -1e9;
                for (const [px, py] of [
                    [0, 0],
                    [W, 0],
                    [0, H],
                    [W, H],
                ]) {
                    let d = Math.atan2(py - y, px - x) - base;
                    d = Math.atan2(Math.sin(d), Math.cos(d));
                    lo = Math.min(lo, d);
                    hi = Math.max(hi, d);
                }
            }
            for (let k = 0; k < n; k++) {
                const t = inside ? (2 * Math.PI * k) / n : base + lo + ((hi - lo) * k) / (n - 1);
                c.moveTo(x, y);
                c.lineTo(x + L * Math.cos(t), y + L * Math.sin(t));
            }
        } else {
            // 平行線（水平・垂直）
            const u = A.dir,
                nx = -u.y,
                ny = u.x;
            let lo = 1e9,
                hi = -1e9;
            for (const [px, py] of [
                [0, 0],
                [W, 0],
                [0, H],
                [W, H],
            ]) {
                const s = px * nx + py * ny;
                lo = Math.min(lo, s);
                hi = Math.max(hi, s);
            }
            for (let k = 0; k < n; k++) {
                const s = lo + ((hi - lo) * k) / (n - 1),
                    px = nx * s,
                    py = ny * s;
                c.moveTo(px - u.x * 2 * diag, py - u.y * 2 * diag);
                c.lineTo(px + u.x * 2 * diag, py + u.y * 2 * diag);
            }
        }
        c.stroke();
    });
    c.globalAlpha = 1;
}

// ===== 描画 =====
function stroke(c, s) {
    c.strokeStyle = s.c;
    c.lineWidth = effectiveLineWidth(s);
    c.lineCap = c.lineJoin = "round";
    c.beginPath();
    c.moveTo(s.p[0].x, s.p[0].y);
    for (let i = 1; i < s.p.length; i++) c.lineTo(s.p[i].x, s.p[i].y);
    c.stroke();
}
// 画像全体の面表示。surfaceMode=trueのとき、すべてのオブジェクトを半透明で塗る。
// 面の三角形は既存の背面線除去用メッシュ定義を共有するので、線画と形状がずれない。
function surfaceColor(o) {
    return o.surfaceColor || o.accent || "#66e3c8";
}
function surfaceAlpha(o) {
    const v = Number(o.surfaceAlpha);
    return Number.isFinite(v) ? clamp(v, 0.04, 0.9) : 0.22;
}
function drawObjectSurfaces(c) {
    if (!P.surfaceMode) return;
    const tris = [],
        seen = new Set();
    S.forEach((s) => {
        const o = s && s.ob;
        if (!o || !objectVisible(o) || seen.has(o.id)) return;
        seen.add(o.id);
        exportSurfaceTriangles(o).forEach((tr) => {
            const p = tr.map((v) => exportPoint(v, [1, 0, 0, 1, 0, 0]));
            if (p.some((q) => !q || !Number.isFinite(q.x) || !Number.isFinite(q.y) || !Number.isFinite(q.depth)))
                return;
            const area = (p[1].x - p[0].x) * (p[2].y - p[0].y) - (p[1].y - p[0].y) * (p[2].x - p[0].x);
            if (Math.abs(area) < 0.001) return;
            tris.push({ o, p, depth: (p[0].depth + p[1].depth + p[2].depth) / 3 });
        });
    });
    // 遠い面から描く簡易ペインター法。半透明の面でもオブジェクト同士の重なりが自然になる。
    tris.sort((a, b) => b.depth - a.depth);
    c.save();
    c.lineJoin = "round";
    tris.forEach(({ o, p }) => {
        c.globalAlpha = surfaceAlpha(o);
        c.fillStyle = surfaceColor(o);
        c.beginPath();
        c.moveTo(p[0].x, p[0].y);
        c.lineTo(p[1].x, p[1].y);
        c.lineTo(p[2].x, p[2].y);
        c.closePath();
        c.fill();
    });
    c.restore();
}
function render() {
    dirty = true;
    // sigNow()は描画1回につき一度だけ計算する。以前は線ごとに再計算していたため、
    // アセットや線が多いシーンほど不要な文字列計算が増えていた。
    const currentSignature = sigNow();
    if (S.some((s) => s.ob && s.cs !== currentSignature)) regenObjects();
    syncSel();
    T === "f" ? calcF() : calc();
    const c = ctx;
    c.clearRect(0, 0, W, H);
    c.fillStyle = $("bgw").checked ? "#fff" : "#23251f";
    c.fillRect(0, 0, W, H);
    c.save();
    c.setTransform(Z, 0, 0, Z, ox, oy); // 以降はズーム/移動つき
    if (IMG) {
        const s = Math.min(W / IMG.width, H / IMG.height),
            w = IMG.width * s,
            h = IMG.height * s;
        c.globalAlpha = P.pa;
        c.drawImage(IMG, (W - w) / 2, (H - h) / 2, w, h);
        c.globalAlpha = 1;
    }
    if (window.cityFloorTint && $("floorTint")?.checked) window.cityFloorTint(c);
    if ($("gg").checked) floorGrid(c);
    drawObjectSurfaces(c);
    if ($("gon").checked) {
        if (orthView) orthGuides(c);
        else T === "f" ? guidesF(c) : guides(c);
    }
    if ($("hzl").checked && !orthView) {
        c.strokeStyle = "#e8a33d";
        c.lineWidth = 1.2;
        c.setLineDash([10, 8]);
        c.beginPath();
        if (T === "f") circ(c, AXC[0], AXC[1]);
        else {
            c.moveTo(0, AX.hy);
            c.lineTo(W, AX.hy);
        }
        c.stroke();
        c.setLineDash([]);
    }
    if (P.surfaceMode) {
        // 面表示中は面を深度バッファに使い、面の裏側に隠れるエッジを表示しない。
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.drawImage(lineLayer(true, true, W, H, null, true), 0, 0);
        c.restore();
    } else if ($("bin").checked) {
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.drawImage(lineLayer(true, true), 0, 0);
        c.restore();
    } else {
        S.forEach((s) => {
            if (!s.ob || objectVisible(s.ob)) strokeW(c, s);
        });
        drawCur(c);
        if (prev) prev.forEach((s) => strokeW(c, s));
    }
    // 選択中の線を橙色に塗り替えない。線画は常に設定した線色で表示し、選択状態はギズモだけで示す。
    if (snapHit)
        S.forEach((s) => {
            if (s.ob && objectVisible(s.ob) && snapHit.has(s.ob.id)) {
                c.save();
                c.globalAlpha = 0.75;
                strokeW(c, { ...s, c: "#ff3df2", w: s.w + 3 / Z });
                c.restore();
            }
        }); // くっつき先は桃色
    if (tool === "edit" && selIds.size > 1) drawSelectionFeedback(c);
    if (sel && tool === "edit" && !window.cityFloorPlanActive) drawGizmo(c); // 3D視点の移動の矢印・面のハンドル・回転の輪
    if (window.cityFloorPlanOverlay && window.cityFloorPlanActive) window.cityFloorPlanOverlay(c);
    if (boxSelect) drawBoxSelection(c);
    if (er) {
        c.strokeStyle = "#e84a4a";
        c.lineWidth = 1.5 / Z;
        c.beginPath();
        c.arc(er.last.x, er.last.y, P.ew, 0, 7);
        c.stroke();
    }
    if (T === "f") {
        markF(c);
        overlay(c);
        c.restore();
        return;
    }
    // VPの目印（画面外なら端に寄せて表示）
    ["VP1", "VP2", "VP3"].forEach((nm, i) => {
        const A = AX[i];
        if (!A.vp || !show[i]) return;
        let dx = A.vp.x - W / 2,
            dy = A.vp.y - H / 2;
        const t = Math.min(1, (W / 2 - 14) / (Math.abs(dx) || 1e-9), (H / 2 - 14) / (Math.abs(dy) || 1e-9));
        const px = W / 2 + dx * t,
            py = H / 2 + dy * t;
        c.fillStyle = ["#e8743d", "#2fb5a5", "#4a7be8"][i];
        c.beginPath();
        c.arc(px, py, 7, 0, 7);
        c.fill();
        c.font = "bold 18px system-ui";
        c.fillText(nm + (t < 1 ? " →" : ""), Math.min(px + 10, W - 70), Math.max(py - 10, 20));
    });
    overlay(c);
    c.restore();
    const q = (v) => (v ? `(${((v.x / W) * 100).toFixed(0)}%, ${((v.y / H) * 100).toFixed(0)}%)` : "無限遠(平行)");
    $("info").innerHTML =
        `画角 ${((2 * Math.atan(18 / P.lens) * 180) / Math.PI).toFixed(1)}°<br>VP1 ${q(AX[0].vp)}<br>VP2 ${q(AX[1].vp)}<br>垂直 ${AX[2].vp ? "VP3 " + q(AX[2].vp) : "平行（垂直）"}<br>地平線 ${((AX.hy / H) * 100).toFixed(1)}%`;
}

// ===== マウス/タッチ操作 =====
let ptr = null,
    lastPen = 0; // 操作中のポインタID／最後にペンを離した時刻（手のひら誤タッチ対策）
const rawOf = (cx, cy) => {
    const r = cv.getBoundingClientRect();
    return { x: ((cx - r.left) * W) / r.width, y: ((cy - r.top) * H) / r.height };
}; // 画面→キャンバス(ズーム前)
const pos = (e) => {
    const r = rawOf(e.clientX, e.clientY);
    return { x: (r.x - ox) / Z, y: (r.y - oy) / Z };
}; // ズーム・移動を戻した描画座標
const TC = new Map(); // いま触れている指(touch)
function clampView() {
    Z = clamp(Z, 1, 10);
    ox = clamp(ox, W - W * Z, 0);
    oy = clamp(oy, H - H * Z, 0);
}
function updZ() {
    $("zr").textContent = Math.round(Z * 100) + "%";
}
$("zr").onclick = () => {
    Z = 1;
    ox = oy = 0;
    updZ();
    render();
};
cv.addEventListener(
    "wheel",
    (e) => {
        e.preventDefault();
        if (mode === "view") {
            P.lens = clamp(P.lens * Math.exp(-e.deltaY * 0.0012), 14, 200);
            sync();
            render();
            return;
        }
        const r = rawOf(e.clientX, e.clientY),
            q = { x: (r.x - ox) / Z, y: (r.y - oy) / Z };
        Z = clamp(Z * Math.exp(-e.deltaY * 0.0015), 1, 10);
        ox = r.x - q.x * Z;
        oy = r.y - q.y * Z;
        clampView();
        updZ();
        render();
    },
    { passive: false },
); // ビューではレンズ、描画ではキャンバスズーム

// ===== 二本指/三本指：ピンチでズーム・移動、タップで元に戻す/やり直し =====
function multiStart() {
    cancelBoxPending();
    boxSelect = null;
    if (drag) {
        setP("yaw", drag.yaw);
        setP("pitch", drag.pitch);
        setP("cx", drag.cx);
        setP("cz", drag.cz);
        setP("ch", drag.ch);
        sync();
    } // 1本目で動いた分は戻す
    drag = null;
    cur = null;
    er = null;
    prev = null;
    bd = false;
    ed = null;
    ptr = null;
    ptrType = null;
    if (!mg) mg = { t0: Date.now(), n: 0, moved: false, x0: null, y0: null, x1: null, y1: null };
    const pts = [...TC.values()];
    mg.n = Math.max(mg.n, pts.length);
    mg.view = mode === "view";
    const cx = pts.reduce((a, t) => a + t.x, 0) / Math.max(1, pts.length),
        cy = pts.reduce((a, t) => a + t.y, 0) / Math.max(1, pts.length);
    if (mg.x0 == null) {
        mg.x0 = cx;
        mg.y0 = cy;
    }
    mg.x1 = cx;
    mg.y1 = cy;
    pts.forEach((t) => {
        t.sx = t.x;
        t.sy = t.y;
    });
    if (pts.length === 2) {
        const rc = rawOf((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
        mg.d0 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        mg.z0 = Z;
        mg.q0 = { x: (rc.x - ox) / Z, y: (rc.y - oy) / Z };
        mg.cx0 = P.cx;
        mg.cz0 = P.cz;
        mg.ch0 = P.ch;
        mg.lens0 = P.lens;
        mg.mx0 = (pts[0].x + pts[1].x) / 2;
        mg.my0 = (pts[0].y + pts[1].y) / 2;
    } // 指の中心を基準にする
}
function multiMove(tc) {
    if (Math.hypot(tc.x - tc.sx, tc.y - tc.sy) > 14) mg.moved = true; // 14px以上動いたらタップではない
    const pts = [...TC.values()];
    if (pts.length) {
        mg.x1 = pts.reduce((a, t) => a + t.x, 0) / pts.length;
        mg.y1 = pts.reduce((a, t) => a + t.y, 0) / pts.length;
    }
    if (mg.moved && pts.length === 2 && mg.d0 > 0) {
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
            mx = (pts[0].x + pts[1].x) / 2,
            my = (pts[0].y + pts[1].y) / 2;
        if (mg.view) {
            const k = W / cv.getBoundingClientRect().width,
                worldPerPx = ((Math.max(0.15, P.ch) * 2) / H) * k,
                dx = mx - mg.mx0,
                dy = my - mg.my0,
                th = P.yaw * DG;
            setP("cx", mg.cx0 - dx * worldPerPx * Math.cos(th));
            setP("cz", mg.cz0 - dx * worldPerPx * Math.sin(th));
            setP("ch", clamp(mg.ch0 + dy * worldPerPx, 0.05, 30));
            P.lens = clamp((mg.lens0 * d) / mg.d0, 14, 200);
            sync();
            render();
        } else {
            const rc = rawOf(mx, my);
            Z = clamp((mg.z0 * d) / mg.d0, 1, 10);
            ox = rc.x - mg.q0.x * Z;
            oy = rc.y - mg.q0.y * Z;
            clampView();
            updZ();
            render();
        }
    }
}

// ===== 消しゴム（線は向きの点列で持っているので、点を消して線を分割する） =====
// 点列を細かくする（部分消しの精度のため）
function dens(a) {
    const o = [a[0]];
    for (let i = 1; i < a.length; i++) {
        const u = a[i - 1],
            v = a[i],
            n = Math.ceil(Math.acos(Math.max(-1, Math.min(1, V.dot(u, v)))) / 0.004);
        for (let j = 1; j <= n; j++) o.push(j === n ? v : V.nrm(V.add(u, v, 1 - j / n, j / n)));
    }
    return o;
}
function dens3(a) {
    const o = [a[0]],
        co = CO();
    for (let i = 1; i < a.length; i++) {
        const u = a[i - 1],
            v = a[i],
            n = Math.ceil(
                Math.acos(Math.max(-1, Math.min(1, V.dot(V.nrm(V.add(u, co)), V.nrm(V.add(v, co)))))) / 0.004,
            );
        for (let j = 1; j <= n; j++) o.push(j === n ? v : V.add(u, v, 1 - j / n, j / n));
    }
    return o;
}
function eraseAt(p) {
    const r2 = P.ew * P.ew,
        all = $("em").value === "all",
        res = [],
        det = new Set();
    let ch = false;
    for (const s of S) {
        const hit = s.p.map((v) => {
            const q = sp(s, v);
            return q.ok && (q.x - p.x) ** 2 + (q.y - p.y) ** 2 <= r2;
        });
        if (!hit.some(Boolean)) {
            res.push(s);
            continue;
        }
        ch = true;
        if (s.ob) det.add(s.ob.id);
        if (all) continue; // 線ごと消す
        let seg = [];
        s.p.forEach((v, i) => {
            if (hit[i]) {
                if (seg.length > 1) res.push({ c: s.c, w: s.w, d3: s.d3, p: seg });
                seg = [];
            } else seg.push(v);
        });
        if (seg.length > 1) res.push({ c: s.c, w: s.w, d3: s.d3, p: seg });
    }
    if (ch) {
        S = det.size ? res.map((s) => (s.ob && det.has(s.ob.id) ? { ...s, ob: undefined } : s)) : res;
        if (sel && det.has(sel)) clearSelection();
    }
}
// aからbまでなぞった間も取りこぼさず消す
function stepErase(a, b) {
    const d = Math.hypot(b.x - a.x, b.y - a.y),
        n = Math.max(1, Math.ceil(d / (P.ew / 2)));
    for (let i = 1; i <= n; i++) eraseAt({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// 間取りのドラッグ状態はstudio-ui.jsのIIFE内で管理する。
// 分割読み込みでは別スコープになるため、window経由の小さな橋を使う。
const getCityFloorPlanDrag = () => window.cityFloorPlanGetDrag?.() || null;
const setCityFloorPlanDrag = (value) => window.cityFloorPlanSetDrag?.(value);
const fitCityFloorPlan = () => window.cityFloorPlanFit?.();
// 長押し＋ドラッグのボックス選択。空白から始めたときだけ起動し、
// 通常のオブジェクトドラッグやiPadの視点操作とは競合しないようにする。
let boxSelect = null,
    boxPending = null,
    boxTimer = null;
function cancelBoxPending() {
    if (boxTimer) {
        clearTimeout(boxTimer);
        boxTimer = null;
    }
    const p = boxPending;
    boxPending = null;
    return p;
}
function armBoxPending(start, pointerId, source = "canvas", meta = {}) {
    cancelBoxPending();
    const pending = { start: { ...start }, pointerId, source, ...meta };
    boxPending = pending;
    boxTimer = setTimeout(() => {
        if (boxPending !== pending) return;
        boxPending = null;
        boxTimer = null;
        if (source === "floor") setCityFloorPlanDrag(null);
        boxSelect = { pointerId, start: { ...pending.start }, end: { ...pending.start }, source };
        clearSelection();
        render();
    }, 360);
}
// 戻り値: pending / cancel / floorPan。floorPanのときだけ従来の表示パンへ引き継ぐ。
function updateBoxPending(p, pointerId) {
    const pending = boxPending;
    if (!pending || pending.pointerId !== pointerId) return null;
    if (Math.hypot(p.x - pending.start.x, p.y - pending.start.y) <= 8) return "pending";
    cancelBoxPending();
    if (pending.source === "floor") {
        if (!Array.isArray(window.cityFloorPlanCenter)) fitCityFloorPlan();
        setCityFloorPlanDrag({
            kind: "pan",
            pointerId,
            p0: { ...pending.start },
            center0: [...(pending.center0 || window.cityFloorPlanCenter || [0, 0])],
            tapClear: true,
            moved: true,
        });
        return "floorPan";
    }
    return "cancel";
}
function boxScreenBounds(o) {
    const b = obBounds(o),
        pts = [];
    for (const x of [b.lo[0], b.hi[0]])
        for (const y of [b.lo[1], b.hi[1]])
            for (const z of [b.lo[2], b.hi[2]]) {
                const q = scrW([x, y, z]);
                if (q && q.ok && Number.isFinite(q.x) && Number.isFinite(q.y)) pts.push(q);
            }
    if (!pts.length) return null;
    return {
        x0: Math.min(...pts.map((q) => q.x)),
        y0: Math.min(...pts.map((q) => q.y)),
        x1: Math.max(...pts.map((q) => q.x)),
        y1: Math.max(...pts.map((q) => q.y)),
    };
}
// アセット側のIIFE内にあるsceneObjects()へ依存せず、単一版・分割版の
// どちらでもボックス選択から直接参照できるオブジェクト一覧を作る。
function boxSceneObjects() {
    const out = [],
        seen = new Set();
    S.forEach((s) => {
        const o = s && s.ob;
        if (o && objectVisible(o) && !seen.has(o.id)) {
            seen.add(o.id);
            out.push(o);
        }
    });
    return out;
}
function finishBoxSelection(end) {
    if (!boxSelect) return;
    const a = boxSelect.start,
        b = end || boxSelect.end,
        x0 = Math.min(a.x, b.x),
        x1 = Math.max(a.x, b.x),
        y0 = Math.min(a.y, b.y),
        y1 = Math.max(a.y, b.y),
        chosen = [];
    boxSceneObjects().forEach((o) => {
        const q = boxScreenBounds(o);
        if (!q) return;
        const cx = (q.x0 + q.x1) / 2,
            cy = (q.y0 + q.y1) / 2;
        if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) chosen.push(o);
    });
    clearSelection();
    chosen.forEach((o) => selIds.add(o.id));
    sel = chosen.length ? chosen[chosen.length - 1].id : null;
    normalizeSelection();
    boxSelect = null;
    tool = "edit";
    setMode("draw");
    syncSel();
    render();
}
function drawBoxSelection(c) {
    if (!boxSelect) return;
    const a = boxSelect.start,
        b = boxSelect.end,
        x = Math.min(a.x, b.x),
        y = Math.min(a.y, b.y),
        w = Math.abs(b.x - a.x),
        h = Math.abs(b.y - a.y);
    c.save();
    c.fillStyle = "rgba(102,227,200,.12)";
    c.strokeStyle = "#66e3c8";
    c.lineWidth = 1.5 / Z;
    c.setLineDash([7 / Z, 4 / Z]);
    c.fillRect(x, y, w, h);
    c.strokeRect(x, y, w, h);
    c.restore();
}
// 複数選択時は主役のギズモだけでなく、選択中の全オブジェクトを枠で示す。
// 線色そのものは変えず、通常の編集表示を壊さないよう補助枠だけを描く。
function drawSelectionFeedback(c) {
    const chosen = boxSceneObjects().filter((o) => selIds.has(o.id));
    if (!chosen.length) return;
    c.save();
    c.lineWidth = 1.6 / Z;
    c.setLineDash([6 / Z, 4 / Z]);
    c.globalAlpha = 0.92;
    chosen.forEach((o) => {
        const q = boxScreenBounds(o);
        if (!q) return;
        const pad = 5 / Z;
        c.strokeStyle = o.id === sel ? "#ffd34d" : "#66e3c8";
        c.fillStyle = o.id === sel ? "#ffd34d" : "#66e3c8";
        c.strokeRect(q.x0 - pad, q.y0 - pad, Math.max(1, q.x1 - q.x0 + pad * 2), Math.max(1, q.y1 - q.y0 + pad * 2));
        c.setLineDash([]);
        c.beginPath();
        c.arc((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, 3.5 / Z, 0, Math.PI * 2);
        c.fill();
        c.setLineDash([6 / Z, 4 / Z]);
    });
    c.restore();
}
// ポインタがキャンバスから黒いUIへ移動しても、ボックス選択を必ず解放する。
// キャンバスのPointer Captureだけに依存せず、windowのcaptureフェーズでも監視する。
function boxPointerIsActive(pointerId) {
    return !!((boxSelect && boxSelect.pointerId === pointerId) || (boxPending && boxPending.pointerId === pointerId));
}
function boxPoint(e) {
    const p = pos(e);
    return { x: clamp(p.x, 0, W), y: clamp(p.y, 0, H) };
}
function boxPointInsideCanvas(e) {
    const r = cv.getBoundingClientRect();
    if (!(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)) return false;
    // キャンバス上に重なった黒いツールバー／ドックも「キャンバス外」として扱う。
    const top = document.elementFromPoint(e.clientX, e.clientY);
    return top === cv;
}
function endBoxPointer(e, commit) {
    const pointerId = e && e.pointerId;
    if (pointerId == null || !boxPointerIsActive(pointerId)) return false;
    const pending = boxPending && boxPending.pointerId === pointerId;
    const selecting = boxSelect && boxSelect.pointerId === pointerId;
    if (selecting) {
        if (commit) finishBoxSelection(e && Number.isFinite(e.clientX) ? boxPoint(e) : boxSelect.end);
        else boxSelect = null;
    }
    if (pending) {
        const p = cancelBoxPending();
        if (p?.tapClear) setSelection(null, false);
    } else cancelBoxPending();
    const floorDrag = getCityFloorPlanDrag();
    if (floorDrag && floorDrag.pointerId === pointerId) setCityFloorPlanDrag(null);
    if (ptr === pointerId) {
        ptr = null;
        ptrType = null;
    }
    if (typeof TC !== "undefined") TC.delete(pointerId);
    if (e?.pointerType === "pen") lastPen = Date.now();
    try {
        if (cv.hasPointerCapture?.(pointerId)) cv.releasePointerCapture(pointerId);
    } catch (err) {}
    if (!commit) render();
    return true;
}
function abortAllBoxPointers() {
    const ids = new Set();
    if (boxSelect) ids.add(boxSelect.pointerId);
    if (boxPending) ids.add(boxPending.pointerId);
    ids.forEach((pointerId) => endBoxPointer({ pointerId }, false));
}
// 押したままキャンバス外へ出た時点で確定して終了する。これにより、
// サイドパネル／上部バー上でpointerupを受け損なうブラウザでも残像を残さない。
addEventListener(
    "pointermove",
    (e) => {
        if (!boxPointerIsActive(e.pointerId)) return;
        const released = e.pointerType !== "touch" && e.buttons === 0;
        if (!released && !boxPointInsideCanvas(e)) {
            e.preventDefault();
            e.stopPropagation();
            endBoxPointer(e, !!(boxSelect && boxSelect.pointerId === e.pointerId));
        } else if (released) {
            e.preventDefault();
            e.stopPropagation();
            endBoxPointer(e, true);
        }
    },
    true,
);
addEventListener(
    "pointerup",
    (e) => {
        if (!boxPointerIsActive(e.pointerId)) return;
        e.preventDefault();
        e.stopPropagation();
        endBoxPointer(e, true);
    },
    true,
);
addEventListener(
    "pointercancel",
    (e) => {
        if (!boxPointerIsActive(e.pointerId)) return;
        e.preventDefault();
        e.stopPropagation();
        endBoxPointer(e, false);
    },
    true,
);
// Pointer Captureが途中で失われた場合も、矩形を残さずキャンセルする。
cv.addEventListener(
    "lostpointercapture",
    (e) => {
        if (boxPointerIsActive(e.pointerId)) endBoxPointer(e, false);
    },
    true,
);
// UIへフォーカスが移った／画面が隠れた場合の最後の保険。
addEventListener("blur", abortAllBoxPointers);
document.addEventListener("visibilitychange", () => {
    if (document.hidden) abortAllBoxPointers();
});
addEventListener("pagehide", abortAllBoxPointers);
// 最初の数pxの向きから、一番近い軸を選ぶ
function pick(a, p) {
    const l = Math.hypot(p.x - a.x, p.y - a.y),
        m = { x: (p.x - a.x) / l, y: (p.y - a.y) / l };
    let b = 0,
        bs = 9;
    [0, 1, 2].forEach((i) => {
        const u = dirAt(a, i),
            s = Math.abs(m.x * u.y - m.y * u.x);
        if (s < bs) {
            bs = s;
            b = i;
        }
    });
    return b;
}
// 通常の3Dキャンバス操作の入口。
// 間取りモードではstudio-ui.jsの専用pointerdownが先に処理し、
// __cityFloorPlanPreempt が付いたイベントはここで通常処理をスキップする。
cv.onpointerdown = (e) => {
    // 間取りのポインター処理はstudio-ui.jsが正面／横／上の専用ギズモを
    // 先に判定する。先行するtargetハンドラが通常編集へ入らないようにする。
    if (e.__cityFloorPlanPreempt) return;
    const touch = e.pointerType === "touch";
    if (touch && ptrType === "pen") return; // ペンで描いている間の手のひらは無視
    if (touch) {
        // 指の本数を数える（2本以上→ピンチ/タップ判定）
        TC.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
        cv.setPointerCapture(e.pointerId);
        if (TC.size >= 2) {
            multiStart();
            return;
        }
        if (mg || Date.now() - lastPen < 600) return; // ペン直後の1本指(手のひら)は視点を動かさない。2本以上のジェスチャーは受け付ける
    } else if (e.pointerType === "pen" && ptrType !== "pen") {
        drag = null;
        cur = null;
        er = null;
        prev = null;
        bd = false;
        ed = null;
        ptr = null;
        mg = null;
        TC.clear();
    } // ペンは指より優先
    // iPadでpointerupを取りこぼした古いポインタが残っても、次の編集操作を止めない。
    if (ptr != null && ptr !== e.pointerId && e.pointerType !== "mouse" && !TC.has(ptr)) {
        ptr = null;
        ptrType = null;
        ed = null;
        drag = null;
        cur = null;
        mg = null;
    }
    // 「視点」ボタンで3Dを操作中は、編集ツールが残っていてもタッチ／ペンを
    // 自動的に描画へ切り替えない。編集はmode='draw'のときだけ受け取る。
    if (ptr != null) return;
    ptr = e.pointerId;
    ptrType = e.pointerType;
    cv.setPointerCapture(e.pointerId);
    const p = pos(e);
    const pn = $("pn").checked,
        mod = e.pointerType === "mouse" && (e.metaKey || e.ctrlKey),
        selectGesture =
            tool === "edit" &&
            mode === "draw" &&
            e.pointerType === "mouse" &&
            e.button === 0 &&
            (e.shiftKey || e.metaKey || e.ctrlKey),
        nav =
            e.pointerType === "mouse" &&
            (e.button === 1 || e.button === 2 || e.altKey || ((e.shiftKey || mod) && !selectGesture)),
        touchTool = pn && e.pointerType === "touch" && tool !== "edit" && tool !== "erase",
        editPointer = tool === "edit" && mode === "draw" && (e.pointerType === "touch" || e.pointerType === "pen"),
        act =
            nav || (!selectGesture && mod)
                ? "view"
                : editPointer
                  ? "draw"
                  : pn && e.pointerType === "pen" && mode === "draw"
                    ? "draw"
                    : touchTool
                      ? "view"
                      : mode; // 視点モードでは、残っている編集ツールよりもカメラ操作を優先する。
    if (act === "view") {
        const pan = e.shiftKey || e.altKey || e.button === 2;
        drag = {
            kind: pan ? "pan" : "orbit",
            x: e.clientX,
            y: e.clientY,
            yaw: P.yaw,
            hz: P.hz,
            pitch: P.pitch,
            cx: P.cx,
            cz: P.cz,
            ch: P.ch,
        };
        return;
    }
    if (act === "draw" && tool === "edit") {
        const hg = sel ? hitGizmo(p) : null;
        if (hg)
            beginGizmo(hg, p); // 矢印・白い四角・輪をつかんだ
        else {
            const id = pickOb(p),
                multi = e.shiftKey || e.metaKey || e.ctrlKey,
                wasSelected = !!(id && selIds.has(id));
            // Shift/Ctrl/⌘クリックで追加・解除。選択済みのオブジェクトをそのままドラッグしたときは、選択中全体を動かす。
            if (multi) setSelection(id, true);
            else if (!wasSelected || selIds.size <= 1) setSelection(id, false);
            if (id && selIds.has(id)) {
                const o = obOf(id),
                    group = o?.attachment?.verticalOnly
                        ? [{ ...o, off: [...(o.off || [0, 0, 0])] }]
                        : selectedObjects().map((q) => ({ ...q, off: [...(q.off || [0, 0, 0])] }));
                ed = {
                    t: "mv",
                    id,
                    o0: { ...o },
                    group,
                    p0: p,
                    P0: hit3(unscr(p), o.k, o.d - o.d * o.lift, cloc(o)),
                    started: false,
                    ...snapSetupGroup(group, objectAnchorWorld(o)),
                };
            } else armBoxPending(p, e.pointerId, "canvas");
        }
        syncSel();
        render();
        return;
    }
    if (act === "draw" && tool === "border") {
        bd = true;
        CR = { x0: clamp(p.x, 0, W), y0: clamp(p.y, 0, H), x1: clamp(p.x, 0, W), y1: clamp(p.y, 0, H) };
        render();
        return;
    }
    if (act === "draw" && tool === "erase") {
        er = { base: S, last: p };
        stepErase(p, p);
        render();
        return;
    } // 消しゴム
    const sn = $("snap").value;
    cur = { a: p, p: [p], ax: sn === "free" ? -2 : sn === "auto" ? -1 : +sn, c: $("pc").value, w: MASTER_W, al: null };
    if (true) {
        const r0 = unscr(p);
        let t0 = r0[1] < -1e-4 ? -P.ch / r0[1] : Infinity;
        if (!(t0 < 500)) t0 = P.dp; // 床に当たれば床の位置、当たらなければ奥行き(空)
        cur.D = t0;
        cur.P0 = V.add(camPos(), r0, 1, t0);
        cur.pv = { c: cur.c, w: cur.w, d3: true, p: [cur.P0] };
    }
};
cv.onpointermove = (e) => {
    const tc = TC.get(e.pointerId);
    if (tc) {
        tc.x = e.clientX;
        tc.y = e.clientY;
        if (mg) {
            multiMove(tc);
            return;
        }
    }
    const boxPendingState = updateBoxPending(pos(e), e.pointerId);
    if (boxSelect && boxSelect.pointerId === e.pointerId) {
        boxSelect.end = pos(e);
        render();
        return;
    }
    if (boxPendingState === "pending" || boxPendingState === "cancel") return;
    if (e.pointerId !== ptr) return;
    const k = W / cv.getBoundingClientRect().width;
    if (drag) {
        const dx = e.clientX - drag.x,
            dy = e.clientY - drag.y;
        if (drag.kind === "pan") {
            const worldPerPx = ((Math.max(0.15, P.ch) * 2) / H) * k;
            const th = P.yaw * DG;
            setP("cx", drag.cx - dx * worldPerPx * Math.cos(th));
            setP("cz", drag.cz - dx * worldPerPx * Math.sin(th));
            setP("ch", clamp(drag.ch + dy * worldPerPx, 0.05, 30));
        } else {
            const yawLimit = T === "f" ? 180 : 180;
            setP("yaw", +clamp(drag.yaw + dx * k * 0.1, -yawLimit, yawLimit).toFixed(3));
            setP("pitch", +clamp(drag.pitch - dy * k * 0.1, -89, 89).toFixed(2));
        }
        sync();
        render();
        return;
    }
    if (ed) {
        dragEdit(pos(e), !!e.shiftKey);
        return;
    }
    if (bd) {
        const p = pos(e);
        CR.x1 = clamp(p.x, 0, W);
        CR.y1 = clamp(p.y, 0, H);
        render();
        return;
    }
    if (er) {
        const p = pos(e);
        stepErase(er.last, p);
        er.last = p;
        render();
        return;
    }
    if (!cur) return;
    const p = pos(e),
        a = cur.a;
    if (cur.ax === -1 && Math.hypot(p.x - a.x, p.y - a.y) >= 6) cur.ax = pick(a, p);
    if (cur.ax === -2) {
        cur.p.push(p);
        if (cur.P0) cur.pv.p.push(V.add(camPos(), unscr(p), 1, cur.D));
    } // フリーハンド
    else if (cur.ax >= 0) {
        if (cur.P0) {
            // 定規：3Dの直線（軸に沿う）。ペンの位置を、画面上の定規の線へ垂直に落とした点まで引く
            let E;
            if (T === "f") {
                const q = curveF(a, p, cur.ax);
                E = q[q.length - 1];
            } else {
                const u = dirAt(a, cur.ax),
                    tt = (p.x - a.x) * u.x + (p.y - a.y) * u.y;
                E = { x: a.x + u.x * tt, y: a.y + u.y * tt };
            }
            const a3 = AXW[cur.ax],
                t = lineParam(unscr(E), V.add(cur.P0, CO()), a3);
            if (t != null) cur.pv.p = dens3([cur.P0, V.add(cur.P0, a3, 1, t)]);
        } else if (T === "f")
            cur.p = curveF(a, p, cur.ax); // 魚眼：大円の曲線に投影
        else {
            const u = dirAt(a, cur.ax),
                t = (p.x - a.x) * u.x + (p.y - a.y) * u.y;
            cur.p = [a, { x: a.x + u.x * t, y: a.y + u.y * t }];
        } // 定規の線上に投影
    }
    render();
};
cv.onpointerup = cv.onpointercancel = (e) => {
    if (e.pointerType === "touch") {
        const had = TC.delete(e.pointerId);
        if (mg) {
            if (!TC.size) {
                // 指が全部離れた：2本タップ=元に戻す、3本タップ=やり直し、4本タップ=プリミティブメニュー
                if (e.type === "pointerup" && !mg.moved && Date.now() - mg.t0 < 450) {
                    if (mg.n === 2) undo();
                    else if (mg.n === 3) redo();
                    else if (mg.n >= 4 && window.cityPrimitiveMenuToggle) window.cityPrimitiveMenuToggle();
                } else if (e.type === "pointerup" && mg.moved && mg.n === 3 && window.cityThreeFingerSelect) {
                    window.cityThreeFingerSelect(mg.x1 - mg.x0, mg.y1 - mg.y0, mg.x1, mg.y1);
                }
                mg = null;
            }
            return;
        }
        if (!had) return;
    }
    if (boxSelect && boxSelect.pointerId === e.pointerId) {
        if (e.type === "pointerup") finishBoxSelection(boxPoint(e));
        else boxSelect = null;
        cancelBoxPending();
        ptr = null;
        ptrType = null;
        if (e.pointerType === "pen") lastPen = Date.now();
        return;
    }
    if (boxPending && boxPending.pointerId === e.pointerId) {
        cancelBoxPending();
        ptr = null;
        ptrType = null;
        if (e.pointerType === "pen") lastPen = Date.now();
        return;
    }
    if (e.pointerId !== ptr) return;
    ptr = null;
    ptrType = null;
    if (e.pointerType === "pen") lastPen = Date.now();
    if (er) {
        if (S !== er.base) {
            HU.push(er.base);
            RD = [];
        }
        er = null;
    }
    if (bd) {
        bd = false;
        const r = crect();
        if (r.w < 8 || r.h < 8) CR = null;
    }
    ed = null;
    snapHit = null;
    drag = null;
    if (cur && cur.pv) {
        if (cur.pv.p.length > 1) {
            HU.push(S);
            S = [...S, { c: cur.c, w: cur.w, d3: true, p: dens3(cur.pv.p) }];
            RD = [];
        }
    } // 3Dの線として保存
    else if (cur && cur.p.length > 1) {
        HU.push(S);
        S = [...S, { c: cur.c, w: cur.w, p: dens(cur.p.map(unscr)) }];
        RD = [];
    }
    cur = null;
    render();
}; // 向きに変換して保存

// iPad Safariでキャンバス外へ指／ペンを離した場合の一般操作用保険。
// ボックス選択以外の編集でも、古いpointerIdが次の操作をブロックしないようにする。
function releaseInputState(e) {
    if (e?.pointerType === "touch") {
        TC.delete(e.pointerId);
        if (!TC.size) mg = null;
    }
    if (e?.pointerType === "pen") lastPen = Date.now();
    if (ptr === e?.pointerId) {
        ptr = null;
        ptrType = null;
        ed = null;
        drag = null;
        cur = null;
        bd = false;
        er = null;
        snapHit = null;
    }
}
addEventListener("pointerup", releaseInputState, false);
addEventListener("pointercancel", releaseInputState, false);
addEventListener("blur", () => {
    if (!boxSelect && !boxPending) {
        ptr = null;
        ptrType = null;
        ed = null;
        drag = null;
        cur = null;
        bd = false;
        er = null;
        TC.clear();
        mg = null;
    }
});

// ===== モード・ボタン =====
function setMode(m) {
    mode = m;
    syncInteractionButtons();
    cv.style.cursor = m === "view" ? "move" : "crosshair";
    $("hint").textContent =
        ($("pn").checked ? "【指＝視点／ペン＝描画】" : "") +
        (m === "view"
            ? T === "f"
                ? "ドラッグ：視点を回転／Shiftまたは右ドラッグ：水平移動／ホイール：ズーム"
                : "ドラッグ：視点を回転／Shiftまたは右ドラッグ：水平移動／ホイール：ズーム（矢印キーでも可）"
            : "線を引くと、向かっているVPへ自動で吸着します。Ctrl/⌘+Zで元に戻す") +
        " ／ 中ドラッグ：回転・Shift+ドラッグ：パン";
}
$("mV").onclick = () => setMode("view");
$("mD").onclick = () => setTool("pen");
const undo = () => {
        if (HU.length) {
            RD.push(S);
            S = HU.pop();
            render();
        }
    },
    redo = () => {
        if (RD.length) {
            HU.push(S);
            S = RD.pop();
            render();
        }
    };
$("undo").onclick = undo;
$("redo").onclick = redo;
$("clr").onclick = () => {
    if (S.length && confirm("全部消しますか？")) {
        HU.push(S);
        S = [];
        RD = [];
        render();
    }
};
addEventListener("keydown", (e) => {
    const m = e.ctrlKey || e.metaKey;
    if (m && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
    }
    if (m && e.key.toLowerCase() === "y") {
        redo();
        return;
    }
    if (e.key === "e" && !window.cityFloorPlanActive && !/INPUT|SELECT/.test(e.target.tagName)) {
        $("tE").click();
        return;
    }
    if (!m && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) {
        if (e.key === "1") {
            if (typeof setSide === "function") {
                setSide(!$("side").classList.contains("hide"));
                fit();
            }
            return;
        }
        if (e.key === "2") {
            setMode("view");
            return;
        }
        if (e.key === "3") {
            tool = "pen";
            setTool("pen");
            setMode("draw");
            return;
        }
        if (e.key === "4") {
            tool = "pen";
            setTool("edit");
            return;
        }
        if (e.key === "5") {
            document.getElementById("assetToggle")?.click();
            return;
        }
        if (e.key === "7") {
            window.cityFloorPlanView?.("front");
            return;
        }
        if (e.key === "8") {
            window.cityFloorPlanView?.("side");
            return;
        }
        if (e.key === "9") {
            window.cityFloorPlanView?.("top");
            return;
        }
        if (e.key === "0") {
            if (window.cityFloorPlanActive) window.cityFloorPlanExit?.(true);
            else window.cityStandardView?.("home");
            return;
        }
    }
    if (mode !== "view" || /INPUT|SELECT/.test(e.target.tagName)) return;
    const d = e.shiftKey ? 5 : 0.5;
    const L = 180;
    if (e.key === "ArrowLeft") setP("yaw", clamp(P.yaw - d, -L, L));
    else if (e.key === "ArrowRight") setP("yaw", clamp(P.yaw + d, -L, L));
    else if (e.key === "ArrowUp") setP("pitch", clamp(P.pitch + d, -89, 89));
    else if (e.key === "ArrowDown") setP("pitch", clamp(P.pitch - d, -89, 89));
    else return;
    sync();
    render();
});

// 書き出しメニューは上部バーの横スクロール領域に隠れないよう、body直下へ移動して表示する。
// addon側のUIが読み込めない場合でも、ここでメニューだけは開けるようにする。
const exportToggle = $("exportToggle"),
    exportMenu = $("exportMenu");
if (exportMenu && exportMenu.parentElement !== document.body) document.body.appendChild(exportMenu);
function setExportOpen(open) {
    if (!exportMenu) return;
    exportMenu.classList.toggle("open", !!open);
    exportMenu.style.display = open ? "grid" : "none";
}
exportToggle.onclick = (e) => {
    e.stopPropagation();
    setExportOpen(!exportMenu.classList.contains("open"));
};
// ===== 書き出し（透過PNG） =====
// m: 'line'=描画のみ / 'guide'=補助線のみ / 'both'=補助線＋描画（どれも背景透過・写真なし）
// 面表示がONなら、PNGにも面と背面処理を反映する。
function out(m, hidden = false) {
    // 書き出す範囲：ズーム中は「画面に見えている範囲」、範囲指定があればその枠との重なり。拡大率のまま出力する
    const fit = $("zf").checked && Z > 1;
    let r = fit ? { x: -ox / Z, y: -oy / Z, w: W / Z, h: H / Z } : { x: 0, y: 0, w: W, h: H };
    if (CR) {
        const b = crect();
        if (b.w >= 8 && b.h >= 8) {
            const x0 = Math.max(r.x, b.x),
                y0 = Math.max(r.y, b.y),
                x1 = Math.min(r.x + r.w, b.x + b.w),
                y1 = Math.min(r.y + r.h, b.y + b.h);
            if (x1 - x0 >= 1 && y1 - y0 >= 1) r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        }
    }
    const sc = fit ? Z : 1,
        cw = Math.max(1, Math.round(r.w * sc)),
        ch = Math.max(1, Math.round(r.h * sc)),
        tf = [sc, 0, 0, sc, -r.x * sc, -r.y * sc];
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const x = c.getContext("2d");
    if (P.surfaceMode && m !== "guide") {
        x.setTransform(...tf);
        drawObjectSurfaces(x);
        x.setTransform(1, 0, 0, 1, 0, 0);
    }
    if (m !== "line") {
        x.setTransform(...tf);
        T === "f" ? calcF() : calc();
        if (window.cityFloorTint && $("floorTint")?.checked) window.cityFloorTint(x);
        if ($("gg").checked) floorGrid(x);
        orthView ? orthGuides(x) : T === "f" ? guidesF(x) : guides(x);
        if ($("hzl").checked && !orthView) {
            x.strokeStyle = "#e8a33d";
            x.lineWidth = 1.2;
            x.setLineDash([10, 8]);
            x.beginPath();
            if (T === "f") circ(x, AXC[0], AXC[1]);
            else {
                x.moveTo(0, AX.hy);
                x.lineTo(W, AX.hy);
            }
            x.stroke();
            x.setLineDash([]);
        }
        x.setTransform(1, 0, 0, 1, 0, 0);
    }
    if (m !== "guide") x.drawImage(lineLayer(false, false, cw, ch, tf, hidden || P.surfaceMode), 0, 0); // 線画／背面処理（二値化つき）
    return c;
}
function closeExportMenu() {
    setExportOpen(false);
}
function save(m, name, hidden = false) {
    try {
        const canvas = out(m, hidden);
        canvas.toBlob((b) => {
            if (!b) {
                alert("PNGを作成できませんでした。");
                return;
            }
            const a = document.createElement("a");
            a.href = URL.createObjectURL(b);
            a.download = name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            closeExportMenu();
        }, "image/png");
    } catch (e) {
        console.error("City Grid export error", e);
        alert("書き出しに失敗しました。もう一度お試しください。");
    }
}
$("pngL").onclick = () => save("line", "perspective-line.png");
$("pngG").onclick = () => save("guide", "perspective-guide.png");
$("pngB").onclick = () => save("both", "perspective-guide-line.png");
$("pngBH").onclick = () => save("both", "perspective-guide-line-visible.png", true);
$("pngLH").onclick = () => save("line", "perspective-line-visible.png", true);
$("pngGH").onclick = () => save("guide", "perspective-guide-visible.png", true);
// 線画・補助線・合成画像を、いずれも透過PNGとしてクリップボードへコピーする。
// 未対応ブラウザでは各ボタンに状態を表示する。
async function copyExportToClipboard(kind, id, label) {
    const button = $(id);
    if (!button) return;
    try {
        if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")
            throw new Error("Clipboard image API is unavailable");
        const blob = await new Promise((resolve) => out(kind).toBlob(resolve, "image/png"));
        if (!blob) throw new Error("PNG blob was not created");
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        button.textContent = "コピー済み";
        closeExportMenu();
    } catch (e) {
        console.error("City Grid clipboard export error", e);
        button.textContent = "コピー不可";
    }
    setTimeout(() => (button.textContent = label), 1500);
}
$("cpyL").onclick = () => copyExportToClipboard("line", "cpyL", "線画（透過）をクリップボードにコピー");
$("cpyG").onclick = () => copyExportToClipboard("guide", "cpyG", "補助線（透過）をクリップボードにコピー");
$("cpyB").onclick = () => copyExportToClipboard("both", "cpyB", "描画＋補助線（透過）をクリップボードにコピー");

// ===== 参考写真 =====
let IMGsrc = null,
    dirty = false; // IMGsrc=保存用の写真データ(dataURL)
function loadImg(f) {
    const o = new Image();
    o.onload = () => {
        const k = Math.min(1, 2000 / Math.max(o.width, o.height)),
            c = document.createElement("canvas");
        c.width = o.width * k;
        c.height = o.height * k;
        c.getContext("2d").drawImage(o, 0, 0, c.width, c.height);
        IMGsrc = f.type === "image/png" ? c.toDataURL() : c.toDataURL("image/jpeg", 0.88);
        const im = new Image();
        im.onload = () => {
            IMG = im;
            render();
        };
        im.src = IMGsrc;
    };
    o.src = URL.createObjectURL(f);
}
$("ph").onchange = (e) => e.target.files[0] && loadImg(e.target.files[0]);
$("phx").onclick = () => {
    IMG = null;
    IMGsrc = null;
    render();
};
addEventListener("paste", (e) => {
    const f = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    f && loadImg(f);
});
cv.ondragover = (e) => e.preventDefault();
cv.ondrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    f && f.type.startsWith("image/") && loadImg(f);
};

// ===== グリッド種類の切り替え（1/2/3点は通常の透視、5/6点は魚眼） =====
function applyType(v) {
    v = +v;
    T = v >= 5 ? "f" : "r";
    const f = T === "f",
        L = 180,
        Lp = 90;
    $("yaw").min = -L;
    $("yaw").max = L;
    $("pitch").min = -Lp;
    $("pitch").max = Lp;
    document.querySelectorAll(".gr").forEach((e) => (e.style.display = f ? "none" : ""));
    document.querySelectorAll(".gf").forEach((e) => (e.style.display = f ? "" : "none"));
    const y = P.yaw !== 0 && Math.abs(P.yaw) <= 89 ? P.yaw : 39.912,
        set = (o) => {
            for (const k in o) setP(k, o[k]);
        };
    if (v === 1) set({ yaw: 0, pitch: 0 });
    if (v === 2) set({ yaw: y, pitch: 0 });
    if (v === 3) set({ yaw: y, pitch: Math.abs(P.pitch) < 5 ? 30 : clamp(P.pitch, -60, 60) });
    if (v === 5) set({ yaw: 0, pitch: 0, roll: 0, fov: 180 });
    if (v === 6) set({ yaw: 45, pitch: 0, roll: 0, fov: 270 });
    sync();
    setMode(mode);
    render();
}
$("gt").onchange = (e) => {
    orthView = null;
    applyType(e.target.value);
};
$("pn").onchange = () => setMode(mode);

// ===== 状態の保存・読み込み（プロジェクト） =====
const AK = "pgrid-autosave-v1";
// 今の状態をまとめる（線は向きのベクトルなので、視点ごと再現できる）
function pack(withPhoto) {
    const d = {
        app: "perspective-ruler-grid",
        v: 1,
        P: { ...P },
        gt: $("gt").value,
        orthView,
        ar: $("ar").value,
        show: [...show],
        gon: $("gon").checked,
        hzl: $("hzl").checked,
        bgw: $("bgw").checked,
        bin: $("bin").checked,
        zf: $("zf").checked,
        gg: $("gg").checked,
        p3: $("p3").checked,
        cr: CR,
        snap: $("snap").value,
        em: $("em").value,
        pc: $("pc").value,
        S: S.map((s) => ({ c: s.c, w: s.w, ob: s.ob, d3: s.d3, p: s.p.map((v) => v.map((x) => +x.toFixed(5))) })),
    };
    if (withPhoto && IMGsrc) d.photo = IMGsrc;
    return d;
}
// 保存した状態を戻す
function unpack(d) {
    if (!d || d.app !== "perspective-ruler-grid" || !Array.isArray(d.S)) throw new Error("形式が違います");
    $("ar").value = d.ar;
    $("ar").onchange(); // 画面比率
    $("gt").value = d.gt;
    applyType(d.gt); // 種類（プリセットで値が変わるので直後に上書き）
    for (const k in P) if (d.P && d.P[k] != null) setP(k, d.P[k]);
    d.show.forEach((v, i) => {
        show[i] = v;
        document.querySelector('[data-i="' + i + '"]').checked = v;
    });
    ["gon", "hzl", "bgw", "bin", "zf", "gg", "p3"].forEach((k) => {
        if (d[k] !== undefined) $(k).checked = d[k];
    });
    $("snap").value = d.snap;
    $("em").value = d.em;
    $("pc").value = d.pc;
    {
        const st = d.S.map((s) => (s.ob ? { ...s, ob: fixOb(s.ob) } : s)),
            seen = new Set(),
            gen = []; // 前の版の図形（向きで保存）は、3Dで作り直す
        st.forEach((s) => {
            if (s.ob && !s.d3 && !seen.has(s.ob.id)) {
                seen.add(s.ob.id);
                gen.push(...genShape(s.ob));
            }
        });
        S = [...st.filter((s) => !(s.ob && !s.d3)), ...gen];
    }
    CR = d.cr || null;
    HU = [];
    RD = [];
    cur = null;
    er = null;
    prev = null;
    clearSelection();
    ed = null;
    Z = 1;
    ox = oy = 0;
    updZ();
    if (d.photo) {
        const im = new Image();
        im.onload = () => {
            IMG = im;
            IMGsrc = d.photo;
            render();
        };
        im.src = d.photo;
    } else {
        IMG = null;
        IMGsrc = null;
    }
    orthView = d.orthView || null;
    sync();
    render();
}
$("svP").onclick = () => {
    const z = (n) => String(n).padStart(2, "0"),
        t = new Date(),
        a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(pack(true))], { type: "application/json" }));
    a.download = `perspective-${t.getFullYear()}${z(t.getMonth() + 1)}${z(t.getDate())}-${z(t.getHours())}${z(t.getMinutes())}.json`;
    a.click();
};
$("opP").onclick = () => $("opF").click();
$("opF").onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    f.text()
        .then((t) => unpack(JSON.parse(t)))
        .catch(() => alert("このファイルは読み込めませんでした"));
    e.target.value = "";
};
// 自動保存：変更があれば3秒ごとにこのブラウザへ保存（写真は容量のためファイル保存のみ）
setInterval(() => {
    if (!dirty) return;
    dirty = false;
    try {
        localStorage.setItem(AK, JSON.stringify(pack(false)));
    } catch (e) {}
}, 3000);
$("rst").onclick = () => {
    if (confirm("自動保存を消して初期化します。よろしいですか？")) {
        try {
            localStorage.removeItem(AK);
        } catch (e) {}
        location.reload();
    }
};

// ⌘/Ctrlを押している間は、カーソルを視点移動の形にする
const curs = () => {
    cv.style.cursor = mode === "view" ? "move" : "crosshair";
};
addEventListener("keydown", (e) => {
    if (e.key === "Meta" || e.key === "Control") cv.style.cursor = "move";
});
addEventListener("keyup", (e) => {
    if (e.key === "Meta" || e.key === "Control") curs();
});
addEventListener("blur", curs);
cv.oncontextmenu = (e) => e.preventDefault();

// ===== 起動 =====
cv.width = W;
cv.height = H;
sync();
syncSurfaceToggle();
applyType(2);
try {
    const sideState = localStorage.getItem("pgrid-side");
    setSide(sideState === null ? true : sideState === "1");
} catch (e) {
    setSide(true);
}
fit();
try {
    const t = localStorage.getItem(AK);
    if (t) unpack(JSON.parse(t));
} catch (e) {} // 前回の自動保存があれば復元
