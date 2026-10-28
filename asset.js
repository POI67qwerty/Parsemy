/* City Grid Studio asset module.
   このファイルは「アセットの見た目」と「アセットの寸法の正規化」を担当する。

   読み方の目安
   1. ASSETS                 : アセット棚に表示する名前・初期サイズ・色
   2. 座標／線画ヘルパー     : ローカル座標をワールド座標の線へ変換
   3. assetLines             : アセットごとの線画を作る本体
   4. normalizedAsset         : 古い保存データや入力値を安全な値へ整える
   5. genAsset / obBounds     : 既存エンジンの描画・選択処理へ接続する橋

   UIのボタンや編集イベントは studio-ui.js、3Dギズモと移動処理は
   engine-tools.js が担当する。このファイルでは主に「何を描くか」を決める。 */
"use strict";
// ===== 1. アセットのカタログ =====
// ここは棚に並ぶアセットの「定義表」。実際の線画を描く場所ではない。
// w=幅、d=奥行き、h=高さの初期値。作成時に asset-controller.js が
// これを読み取り、ra/rb/h などのオブジェクト値へ変換する。
// 基本プリミティブを先頭にまとめ、その後に街並み用アセットを並べる。
// 円柱は円の押し出しで作れるため、アセット棚からは外している。
const ASSETS = {
    rect: { label: "長方形", glyph: "□", w: 1.5, d: 1.0, h: 0, accent: "#66e3c8" },
    box: { label: "直方体", glyph: "▣", w: 3.2, d: 2.4, h: 1.8, accent: "#7dd8ff" },
    beveledBox: {
        label: "ベベル直方体",
        glyph: "⬡",
        w: 3.2,
        d: 2.4,
        h: 0,
        bevelOffset: 0.28,
        bevelSegments: 4,
        accent: "#ff9f68",
    },
    cornerCutBox: {
        label: "隅切り直方体",
        glyph: "⬟",
        w: 4.2,
        d: 3.6,
        h: 3.6,
        cornerOffset: 0.8,
        cornerCutCorner: "front-left",
        cornerCutOpeningW: 0.7,
        cornerCutOpeningH: 2.2,
        cornerCutOpeningDepth: 0.8,
        cutColor: "#e24b4b",
        accent: "#8ed7e8",
    },
    circle: { label: "円", glyph: "○", w: 1.25, d: 1.25, h: 0, accent: "#ad9cff" },
    cone: { label: "円錐", glyph: "△", w: 1.25, d: 1.25, h: 1.45, accent: "#ffb36f" },
    sphere: { label: "球体", glyph: "●", w: 1.3, d: 1.3, h: 1.3, accent: "#ad9cff" },
    triPrism: { label: "三角柱", glyph: "△", w: 1.4, d: 1.8, h: 1.25, accent: "#ffb36f" },
    triPyramid: { label: "三角錐", glyph: "▲", w: 1.5, d: 1.5, h: 1.45, accent: "#ff79ba" },
    sign: { label: "看板", glyph: "▤", w: 1.0, d: 0.2, h: 2.15, accent: "#76d9ff" },
    // 単体で置ける壁付け看板。取付金具・ベベル形状を画面と数値の両方から編集できる。
    wallSign: { label: "壁付け看板（単体）", glyph: "▤", w: 1.6, d: 0.26, h: 1.8, accent: "#76d9ff" },
    // 棚には表示しないが、建物横壁へ接着する専用看板の描画・JSON互換用定義。
    wallSideSign: { label: "横壁看板", glyph: "▥", w: 1.5, d: 0.16, h: 1.8, accent: "#76d9ff" },
    awning: { label: "店舗テント", glyph: "▱", w: 3.8, d: 1.35, h: 0.35, accent: "#d98b68" },
    balcony: { label: "壁付けベランダ", glyph: "▱", w: 3.2, d: 1.8, h: 1.25, accent: "#e6a36f" },
    pathPipe: { label: "パスパイプ", glyph: "◉", w: 4.8, d: 4.2, h: 1.5, accent: "#ff9f68" },
    person: { label: "人物", glyph: "♙", w: 0.46, d: 0.3, h: 1.7, accent: "#ad9cff" },
    stairs: { label: "階段", glyph: "▰", w: 1.45, d: 2.4, h: 0.78, accent: "#ffb36f" },
    building: { label: "開口のある建物", glyph: "▣", w: 4.2, d: 3.2, h: 3.6, accent: "#8ce6c2" },
    buildingAwning: { label: "テント付き建物", glyph: "▣", w: 4.2, d: 3.2, h: 3.6, accent: "#d98b68" },
    buildingSign: { label: "看板付き開口建物", glyph: "▣", w: 4.2, d: 3.2, h: 3.6, accent: "#76d9ff" },
    stackedBuilding: { label: "縁付き階層建物", glyph: "▥", w: 4, d: 3, h: 8.98, accent: "#8ce6c2" },
    recessedStackedBuilding: {
        label: "凹窓階層建物",
        glyph: "▤",
        w: 5,
        d: 3.6,
        h: 9.11,
        recessedFloorCount: 4,
        recessedFloorHeight: 2.1,
        recessedFirstFloorExtra: 0.35,
        recessedFloorGap: 1.25,
        recessedCornerBevel: 0.45,
        recessedCornerBevelSegments: 4,
        recessedWindowW: 3.7,
        recessedWindowCount: 5,
        recessedWindowH: 1.25,
        recessedWindowDepth: 0.32,
        recessedWindowBottom: 0.48,
        recessedSillHeight: 0.48,
        recessedBeamHeight: 0.12,
        recessedBeamProjection: 0.1,
        recessedSideWindowW: 2.4,
        recessedWindowMarginLeft: 0.85,
        recessedWindowMarginEnd: 0.75,
        recessedJunctionOffset: 0,
        recessedSideWindows: true,
        accent: "#b6d9d5",
    },
    beveledStackedBuilding: {
        label: "ベベル直方体の縁付き階層建物",
        glyph: "▥",
        w: 4,
        d: 3,
        h: 8.98,
        bevelOffset: 0.28,
        bevelSegments: 4,
        accent: "#ff9f68",
    },
    crosswalk: { label: "横断歩道", glyph: "▥", w: 3.2, d: 4.2, h: 0.02, accent: "#668cff" },
};
// ===== 2. 棚・選択パネルに表示する名前とアイコン =====
// 接続パーツや結合オブジェクトは、元アセット名ではなく役割名を返す。
const assetLabel = (o) =>
    o.linkedAsset === "buildingAwning"
        ? o.linkedRole === "parent" || o.asset === "building"
            ? "テント付き建物"
            : "接続テント"
        : o.linkedAsset === "buildingSign"
          ? o.linkedRole === "parent" || o.asset === "building"
              ? "看板付き開口建物"
              : "接続看板"
          : o.type === "compound"
            ? "結合オブジェクト"
            : o.type === "asset"
              ? o.assetName || ASSETS[o.asset]?.label || (o.asset === "cylinder" ? "円柱" : "アセット")
              : o.type === "rect"
                ? "長方形"
                : o.type === "circ"
                  ? "円"
                  : o.type === "box"
                    ? "箱"
                    : o.type === "cyl"
                      ? "円柱"
                      : "図形";
const assetGlyph = (o) =>
    o.type === "compound"
        ? "◆"
        : o.type === "asset"
          ? ASSETS[o.asset]?.glyph || (o.asset === "custom" ? "⬡" : o.asset === "cylinder" ? "◉" : "◆")
          : o.type === "rect"
            ? "□"
            : o.type === "circ"
              ? "○"
              : "◇";

// ===== 3. 座標変換と線画の共通ヘルパー =====
// 通常アセットのローカル座標は x=幅、y=奥行き、z=高さ。
// pt() は既存の面座標系 k/PL を使い、通常アセットをワールドへ変換する。
const pt = (o, x, y, z) => L2W(o, x, y, z);
// customアセットだけは、作成サイトと同じ x=左右／y=奥行き／z=高さの
// ワールド座標で保持する。既存アセットの面座標系（k/PL）は変更しない。
const customPt = (o, x, y, z) => {
    const a = (Number(o.rot) || 0) * DG,
        cs = Math.cos(a),
        sn = Math.sin(a),
        rx = x * cs - y * sn,
        ry = x * sn + y * cs,
        off = o.off || [0, 0, 0],
        // custom geometry is still an asset object, so normal object movement is stored
        // in ca/cb/lift. Include those values here or the line mesh stays behind while
        // the generic surface mesh (L2W) moves with the object.
        baseX = Number(o.ca) || 0,
        baseZ = Number(o.cb) || 0,
        baseY = (Number(o.d) || -1) - (Number(o.d) || -1) * (Number(o.lift) || 0);
    return [rx + baseX + (Number(off[0]) || 0), baseY + z + (Number(off[1]) || 0), ry + baseZ + (Number(off[2]) || 0)];
};
// 3Dの折れ線を1本の線画オブジェクトへ包む。
// genShape() が返す形式に合わせることで、既存の描画エンジンへ渡せる。
const lineA = (o, pts, color = o.c || "#e7fff4", width = o.w || 2) => ({
    c: color,
    w: width,
    ob: o,
    d3: true,
    cs: sigNow(),
    p: dens3(pts.map((q) => pt(o, q[0], q[1], q[2]))),
});
// customアセット用の線画。customPt()で作成サイト側の座標系を使う。
const customLineA = (o, pts, color = o.c || "#e7fff4", width = o.w || 2) => ({
    c: color,
    w: width,
    ob: o,
    d3: true,
    cs: sigNow(),
    p: dens3(pts.map((q) => customPt(o, q[0], q[1], q[2]))),
});
const polyA = (o, pts, color, width) => lineA(o, [...pts, pts[0]], color, width);
// 直方体の底面・上面・4本の縦辺をまとめて作る。
// 看板、人物の胴体、ベランダなどの部品を描くための共通部品。
function boxA(o, w, d, z0, z1, color = o.c || "#e7fff4") {
    const x = w / 2,
        y = d / 2,
        out = [];
    out.push(
        polyA(
            o,
            [
                [-x, -y, z0],
                [x, -y, z0],
                [x, y, z0],
                [-x, y, z0],
            ],
            color,
        ),
    );
    out.push(
        polyA(
            o,
            [
                [-x, -y, z1],
                [x, -y, z1],
                [x, y, z1],
                [-x, y, z1],
            ],
            color,
        ),
    );
    [
        [-x, -y],
        [x, -y],
        [x, y],
        [-x, y],
    ].forEach(([a, b]) =>
        out.push(
            lineA(
                o,
                [
                    [a, b, z0],
                    [a, b, z1],
                ],
                color,
            ),
        ),
    );
    return out;
}
// ベベル直方体を線画として描く。壁横看板の本体と取付金具で共有する。
function beveledWireBoxA(o, cx, cy, w, d, z0, z1, offset = 0.06, segments = 3, color = o.c || "#e7fff4") {
    const footprint = beveledBoxFootprint(w, d, offset, segments),
        out = [
            polyA(
                o,
                footprint.map(([x, y]) => [x + cx, y + cy, z0]),
                color,
            ),
        ];
    out.push(
        polyA(
            o,
            footprint.map(([x, y]) => [x + cx, y + cy, z1]),
            color,
        ),
    );
    footprint.forEach(([x, y]) =>
        out.push(
            lineA(
                o,
                [
                    [x + cx, y + cy, z0],
                    [x + cx, y + cy, z1],
                ],
                color,
            ),
        ),
    );
    return out;
}
// 隅切り直方体の底面・上面と縦辺を描く。切り口の辺だけを赤くして、
// 図面上でも「どこを隅切りしているか」とオフセット方向を読み取りやすくする。
function cornerCutWireBoxA(o, w, d, z0, z1, offset, corner, color = o.c || "#e7fff4", cutColor = "#e24b4b") {
    const footprint = cornerCutFootprint(w, d, offset, corner),
        out = [],
        cutStart = footprint.length - 1,
        edgeColor = (index) => (index === cutStart ? cutColor : color);
    for (let i = 0; i < footprint.length; i++) {
        const j = (i + 1) % footprint.length;
        out.push(
            lineA(
                o,
                [
                    [footprint[i][0], footprint[i][1], z0],
                    [footprint[j][0], footprint[j][1], z0],
                ],
                edgeColor(i),
            ),
            lineA(
                o,
                [
                    [footprint[i][0], footprint[i][1], z1],
                    [footprint[j][0], footprint[j][1], z1],
                ],
                edgeColor(i),
            ),
        );
    }
    footprint.forEach(([x, y], index) =>
        out.push(
            lineA(
                o,
                [
                    [x, y, z0],
                    [x, y, z1],
                ],
                index === 0 || index === cutStart ? cutColor : color,
            ),
        ),
    );
    return out;
}
// 隅切り面の開口を線画で描く。切り口を分割し、開口内部の側面・上面・奥壁を追加する。
function cornerCutOpeningWireBoxA(o, opening, z1, color = o.c || "#e7fff4", cutColor = "#e24b4b") {
    const { footprint, cutA, cutB, frontA, frontB, backA, backB, openingH } = opening,
        out = [],
        cutIndex = footprint.length - 1,
        line = (a, b, col = color) => out.push(lineA(o, [a, b], col)),
        point = (xy, z) => [xy[0], xy[1], z],
        openingColor = "#ff8b8b";
    for (let i = 0; i < footprint.length; i++) {
        const j = (i + 1) % footprint.length;
        if (i === cutIndex) continue;
        line(point(footprint[i], 0), point(footprint[j], 0), color);
        line(point(footprint[i], z1), point(footprint[j], z1), color);
    }
    footprint.forEach(([x, y], index) =>
        line([x, y, 0], [x, y, z1], index === 0 || index === cutIndex ? cutColor : color),
    );
    // 切り口外周の底辺は開口部分だけ途切れさせ、上辺は建物の上端として残す。
    line(point(cutA, 0), point(frontA, 0), cutColor);
    line(point(frontB, 0), point(cutB, 0), cutColor);
    line(point(cutA, z1), point(cutB, z1), cutColor);
    // 開口の手前枠と、内部の左右側面・上面・奥壁。
    line(point(frontA, 0), point(frontA, openingH), openingColor);
    line(point(frontB, 0), point(frontB, openingH), openingColor);
    line(point(frontA, openingH), point(frontB, openingH), openingColor);
    line(point(frontA, 0), point(backA, 0), openingColor);
    line(point(frontA, openingH), point(backA, openingH), openingColor);
    line(point(frontB, 0), point(backB, 0), openingColor);
    line(point(frontB, openingH), point(backB, openingH), openingColor);
    line(point(backA, 0), point(backA, openingH), openingColor);
    line(point(backB, 0), point(backB, openingH), openingColor);
    line(point(backA, openingH), point(backB, openingH), openingColor);
    line(point(backA, 0), point(backB, 0), openingColor);
    return out;
}
// ベベル直方体の平面輪郭。四つの縦角を、オフセットを半径とする
// 1〜4分割の円弧で面取りする。segments=1なら一枚の平面面取り、
// segments=4なら各角を4枚の小面へ分割した丸みのあるベベルになる。
// ベベル分割数を1〜4へ制限する。古い保存データの bevelEdges も受け付ける。
function beveledBoxSegments(value, legacyValue, fallback = 4) {
    const direct = Number(value),
        legacy = Number(legacyValue),
        n = Number.isFinite(direct) ? direct : Number.isFinite(legacy) ? legacy : fallback;
    return clamp(Math.round(n), 1, 4);
}
// ベベル直方体を上から見た輪郭点を作る。
// この点列を底面・上面・縦辺の描画と外接範囲計算で共用する。
function beveledBoxFootprint(width, depth, offset, segmentCount) {
    const w = Math.max(0.01, Math.abs(Number(width) || 0.01)),
        d = Math.max(0.01, Math.abs(Number(depth) || 0.01)),
        hw = w * 0.5,
        hd = d * 0.5,
        b = clamp(Number(offset) || 0, 0, Math.max(0, Math.min(hw, hd) - 0.001)),
        segments = beveledBoxSegments(segmentCount),
        corners = [
            [-hw + b, -hd + b, Math.PI],
            [hw - b, -hd + b, (Math.PI * 3) / 2],
            [hw - b, hd - b, 0],
            [-hw + b, hd - b, Math.PI / 2],
        ],
        out = [];
    if (b <= 0.000001) return corners.map(([x, y]) => [x, y]);
    corners.forEach(([cx, cy, start]) => {
        for (let i = 0; i <= segments; i++) {
            const angle = start + (i / segments) * (Math.PI / 2);
            out.push([cx + b * Math.cos(angle), cy + b * Math.sin(angle)]);
        }
    });
    return out;
}
// ===== 壁付け看板（単体）=====
// 看板は板を立てた形状で、ローカル座標は x=板の幅、y=板厚、z=高さ。
// 取付金具は板の裏側（+y）へ張り出し、先端の取付板で壁へ当たる形にする。
// 座標系を通常アセットと同じ向きにしているため、幅・奥行き・高さの
// 標準ハンドルをそのまま使える。
function wallSignParams(o) {
    const width = Math.max(0.1, Math.abs(Number(o?.ra) || 0.8) * 2),
        height = Math.max(0.1, Math.abs(Number(o?.h) || 1.8)),
        thickness = clamp(Math.abs(Number(o?.rb) || 0.13) * 2, 0.02, 2),
        bracketCount = clamp(Math.round(Number(o?.wallSignBracketCount ?? 3)), 0, 3),
        bracketLength = clamp(Math.abs(Number(o?.wallSignBracketLength) || 0.36), 0.05, 5),
        bracketArm = clamp(Math.min(width, height) * 0.07, 0.04, 0.16),
        plateThickness = 0.03,
        beveled = o?.wallSignShape === "beveled",
        // ベベルは板の表裏の輪郭（幅×高さ）の4隅へ付ける。
        // 輪郭を丸めた多角形を板厚方向へ押し出した形になる。
        bevelMax = Math.max(0, Math.min(width, height) * 0.45 - 0.001),
        bevelOffset = clamp(
            Number.isFinite(Number(o?.wallSignBevelOffset))
                ? Number(o.wallSignBevelOffset)
                : Math.min(width, height) * 0.4,
            0,
            bevelMax,
        ),
        bevelSegments = beveledBoxSegments(o?.wallSignBevelSegments, null, 4);
    return {
        width,
        height,
        thickness,
        bracketCount,
        bracketLength,
        bracketArm,
        plateThickness,
        beveled,
        bevelOffset,
        bevelMax,
        bevelSegments,
    };
}
// 看板の表裏の輪郭（幅×高さ）。ベベル時は4隅を丸めた多角形になる。
// 表裏・側面・面メッシュ・外接範囲のすべてでこの点列を共有する。
function wallSignFacePoints(params) {
    const offset = params.beveled ? params.bevelOffset : 0;
    return beveledBoxFootprint(params.width, params.height, offset, params.bevelSegments);
}
// 取付金具1本ぶんの箱を返す。金具は板の左側面（-x）から横へまっすぐ
// 伸びる単純な直方体だけにし、板の手前・奥へは何も出さない。
// 板の厚み方向をz軸回りに90度回した向きで、板の幅方向（-x）へ張り出す。
function wallSignBrackets(params) {
    const half = params.thickness * 0.5,
        edge = -params.width * 0.5,
        armH = clamp(params.height * 0.05, 0.06, 0.14),
        count = params.bracketCount,
        out = [];
    for (let i = 0; i < count; i++) {
        // 板の高さは中心基準なので、金具も中心から上下へ振り分ける。
        const z = (params.height * (i + 1)) / (count + 1) - params.height * 0.5;
        // x1が板の左側面、x0が壁側の先端。太さは板厚に収めて面からはみ出させない。
        out.push({ x0: edge - params.bracketLength, x1: edge, y0: -half, y1: half, z, h: armH });
    }
    return out;
}
function beveledBoxParams(o) {
    const w = Math.max(0.01, Math.abs(Number(o?.ra) || 0.01) * 2),
        d = Math.max(0.01, Math.abs(Number(o?.rb) || 0.01) * 2),
        max = Math.max(0, Math.min(w, d) * 0.5 - 0.001),
        bevelOffset = clamp(Number(o?.bevelOffset) || 0, 0, max),
        bevelSegments = beveledBoxSegments(o?.bevelSegments, o?.bevelEdges);
    return { w, d, max, bevelOffset, bevelSegments };
}
// 隅切り直方体の平面輪郭。front-leftの角を基準に、隣り合う2辺から
// 同じ距離だけ内側へ切り込み、5辺の凸多角形へする。回転とは別に
// cornerCutCornerを保持するため、将来ほかの角や複数角へ拡張できる。
function cornerCutFootprint(width, depth, offset, corner = "front-left") {
    const w = Math.max(0.01, Math.abs(Number(width) || 0.01)),
        d = Math.max(0.01, Math.abs(Number(depth) || 0.01)),
        hw = w * 0.5,
        hd = d * 0.5,
        max = Math.max(0, Math.min(w, d) * 0.5 - 0.001),
        b = clamp(Number(offset) || 0, 0, max),
        base = [
            [-hw + b, -hd],
            [hw, -hd],
            [hw, hd],
            [-hw, hd],
            [-hw, -hd + b],
        ],
        key = ["front-left", "front-right", "back-right", "back-left"].includes(corner) ? corner : "front-left";
    return base.map(([x, y]) => {
        if (key === "front-right") return [-x, y];
        if (key === "back-right") return [-x, -y];
        if (key === "back-left") return [x, -y];
        return [x, y];
    });
}
function cornerCutBoxParams(o) {
    const w = Math.max(0.01, Math.abs(Number(o?.ra) || 0.01) * 2),
        d = Math.max(0.01, Math.abs(Number(o?.rb) || 0.01) * 2),
        max = Math.max(0, Math.min(w, d) * 0.5 - 0.001),
        cornerOffset = clamp(Number(o?.cornerOffset) || 0, 0, max),
        cornerCutCorner = ["front-left", "front-right", "back-right", "back-left"].includes(o?.cornerCutCorner)
            ? o.cornerCutCorner
            : "front-left";
    return { w, d, max, cornerOffset, cornerCutCorner };
}
function cornerCutOpeningRayDistance(origin, direction, polygon) {
    const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
    let best = Infinity;
    for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i],
            b = polygon[(i + 1) % polygon.length],
            edge = [b[0] - a[0], b[1] - a[1]],
            den = cross(direction, edge);
        if (Math.abs(den) < 1e-8) continue;
        const from = [a[0] - origin[0], a[1] - origin[1]],
            t = cross(from, edge) / den,
            u = cross(from, direction) / den;
        if (t > 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.min(best, t);
    }
    return Number.isFinite(best)
        ? best
        : Math.max(0.05, Math.min(2, Math.min(Math.abs(polygon[0][0]), Math.abs(polygon[0][1]))));
}
// 隅切り面の開口を、切り口に沿う幅・上下高さ・内側への奥行きへ正規化する。
// 開口は切り口の中央を基準にした矩形で、奥壁は切り口と平行な面になる。
function cornerCutOpeningParams(o) {
    const box = cornerCutBoxParams(o),
        footprint = cornerCutFootprint(box.w, box.d, box.cornerOffset, box.cornerCutCorner),
        cutA = footprint[footprint.length - 1],
        cutB = footprint[0],
        cutDx = cutB[0] - cutA[0],
        cutDy = cutB[1] - cutA[1],
        cutLength = Math.max(0.05, Math.hypot(cutDx, cutDy)),
        tangent = [cutDx / cutLength, cutDy / cutLength],
        midpoint = [(cutA[0] + cutB[0]) * 0.5, (cutA[1] + cutB[1]) * 0.5],
        centroid = footprint
            .reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
            .map((value) => value / footprint.length),
        toInside = [centroid[0] - midpoint[0], centroid[1] - midpoint[1]],
        // 赤い隅切り面の法線を使い、開口の押し出し方向を面へ必ず直交させる。
        normalA = [-tangent[1], tangent[0]],
        normalB = [tangent[1], -tangent[0]],
        inward = normalA[0] * toInside[0] + normalA[1] * toInside[1] >= 0 ? normalA : normalB,
        maxWidth = Math.max(0.1, cutLength - 0.08),
        height = Math.max(0.1, Math.abs(Number(o?.h) || 0.1)),
        maxHeight = Math.max(0.1, height - 0.1),
        openingW = clamp(
            Number.isFinite(Number(o?.cornerCutOpeningW))
                ? Number(o.cornerCutOpeningW)
                : Math.min(maxWidth, cutLength * 0.62),
            0.1,
            maxWidth,
        ),
        openingH = clamp(
            Number.isFinite(Number(o?.cornerCutOpeningH)) ? Number(o.cornerCutOpeningH) : height * 0.66,
            0.1,
            maxHeight,
        ),
        maxDepth = Math.max(0.025, cornerCutOpeningRayDistance(midpoint, inward, footprint) - 0.025),
        openingDepth = clamp(
            Number.isFinite(Number(o?.cornerCutOpeningDepth))
                ? Number(o.cornerCutOpeningDepth)
                : Math.min(0.8, maxDepth * 0.45),
            0.025,
            maxDepth,
        ),
        frontA = [midpoint[0] - tangent[0] * openingW * 0.5, midpoint[1] - tangent[1] * openingW * 0.5],
        frontB = [midpoint[0] + tangent[0] * openingW * 0.5, midpoint[1] + tangent[1] * openingW * 0.5],
        backA = [frontA[0] + inward[0] * openingDepth, frontA[1] + inward[1] * openingDepth],
        backB = [frontB[0] + inward[0] * openingDepth, frontB[1] + inward[1] * openingDepth];
    return {
        ...box,
        footprint,
        cutA,
        cutB,
        cutLength,
        tangent,
        midpoint,
        inward,
        maxWidth,
        maxHeight,
        maxDepth,
        openingW,
        openingH,
        openingDepth,
        frontA,
        frontB,
        backA,
        backB,
        enabled: o?.cornerCutOpeningEnabled === true,
    };
}
// 階層建物の1F開口の初期値・上限値を計算する。
// 開口はここで値を決めるだけで、実際の線画はassetLines()内で描く。
function stackedOpeningParams(o, f = o?.floors?.[0]) {
    const w = Math.max(0.05, Math.abs(Number(f?.w) || Number(o?.ra || 2) * 2)),
        d = Math.max(0.05, Math.abs(Number(f?.d) || Number(o?.rb || 1.5) * 2)),
        h = Math.max(0.05, Math.abs(Number(f?.h) || 2.2)),
        rimHeight = clamp(Math.abs(Number(f?.rimHeight) || Number(o?.rimHeight) || 0.16), 0.01, h),
        maxW = Math.max(0.1, w - 0.1),
        maxH = Math.max(0.1, h - rimHeight - 0.01),
        openingW = clamp(Number(o?.openingW) || w * 0.56, 0.1, maxW),
        openingH = clamp(Number(o?.openingH) || h * 0.66, 0.1, maxH),
        openingBack = clamp(
            Number.isFinite(Number(o?.openingBack)) ? Number(o.openingBack) : d * 0.5 - 0.025,
            -d * 0.5 + 0.025,
            d * 0.5 - 0.025,
        );
    return { w, d, h, rimHeight, openingW, openingH, openingBack };
}
// 凹窓階層建物の共通パラメータ。各階へ同じ窓帯を反復し、
// 正面からベベルを経て右側面へ連続する凹みとして扱う。
// 凹窓階層建物で共通に使う上限値。ベベル・窓の凹み奥行きは
// 同じ「短辺の45%」を上限にしており、3か所で式を書き分けない。
function recessedMaxInset(width, depth) {
    return Math.max(0, Math.min(Math.abs(width), Math.abs(depth)) * 0.45);
}
function recessedStackedBuildingParams(o) {
    const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback),
        w = Math.max(0.5, Math.abs(finite(o?.ra, 2.5)) * 2),
        d = Math.max(0.5, Math.abs(finite(o?.rb, 1.8)) * 2),
        floorCount = clamp(Math.round(finite(o?.recessedFloorCount, 4)), 1, 30),
        floorHeight = clamp(finite(o?.recessedFloorHeight, 2.1), 0.5, 30),
        firstFloorExtra = clamp(finite(o?.recessedFirstFloorExtra, 0.35), 0, 5),
        firstFloorHeight = clamp(floorHeight + firstFloorExtra, 0.5, 30),
        floorGap = clamp(finite(o?.recessedFloorGap, 0.12), 0, 5),
        insetMax = recessedMaxInset(w, d),
        cornerBevel = clamp(finite(o?.recessedCornerBevel, 0.45), 0, insetMax),
        cornerBevelSegments = clamp(Math.round(finite(o?.recessedCornerBevelSegments, 4)), 1, 8),
        totalH = firstFloorHeight + Math.max(0, floorCount - 1) * (floorHeight + floorGap),
        frontWindowMax = Math.max(0.2, w - cornerBevel - 0.3),
        sideWindowMax = Math.max(0.2, d - cornerBevel - 0.3),
        // 窓帯は建物全体の寸法に追従させ、編集するのは両端の壁幅だけにする。
        // 古いデータ（窓の幅・側面窓の幅）からは端の幅を逆算して引き継ぐ。
        marginLeft = clamp(
            finite(o?.recessedWindowMarginLeft, w - cornerBevel - clamp(finite(o?.recessedWindowW, w * 0.74), 0.2, frontWindowMax)),
            0,
            Math.max(0, w - cornerBevel - 0.2),
        ),
        marginEnd = clamp(
            finite(o?.recessedWindowMarginEnd, d - cornerBevel - clamp(finite(o?.recessedSideWindowW, d * 0.66), 0.2, sideWindowMax)),
            0,
            Math.max(0, d - cornerBevel - 0.2),
        ),
        windowW = clamp(w - cornerBevel - marginLeft, 0.2, frontWindowMax),
        windowCount = clamp(Math.round(finite(o?.recessedWindowCount, 5)), 1, 12),
        // 窓の高さは階接合部の高さと常に一致する（旧データは接合部の高さを優先）。
        windowH = Math.max(0.05, floorGap),
        windowDepth = clamp(finite(o?.recessedWindowDepth, 0.32), 0.025, Math.max(0.025, insetMax)),
        sillHeight = clamp(
            finite(o?.recessedSillHeight, finite(o?.recessedWindowBottom, floorHeight * 0.22)),
            0.05,
            Math.max(0.05, floorHeight - windowH - 0.05),
        ),
        windowBottom = sillHeight,
        // 接合部の高さと窓の高さは常に同じ。窓は接合部の中に収まる。
        junctionHeight = Math.max(0.05, floorGap),
        // 窓は接合部いっぱいに収まるため、上下のずれは持たない。
        junctionOffset = 0,
        beamHeight = clamp(finite(o?.recessedBeamHeight, 0.12), 0, Math.min(0.6, floorHeight * 0.35)),
        beamProjection = clamp(
            finite(o?.recessedBeamProjection, 0.1),
            0,
            Math.max(0, Math.min(w - cornerBevel, d) * 0.25),
        ),
        sideWindowW = clamp(d - cornerBevel - marginEnd, 0.2, sideWindowMax);
    return {
        w,
        d,
        floorCount,
        floorHeight,
        firstFloorExtra,
        firstFloorHeight,
        floorGap,
        cornerBevel,
        cornerBevelSegments,
        totalH,
        windowW,
        windowCount,
        windowH,
        windowDepth,
        windowBottom,
        marginLeft,
        marginEnd,
        junctionHeight,
        junctionOffset,
        sillHeight,
        beamHeight,
        beamProjection,
        sideWindowW,
        sideWindows: o?.recessedSideWindows !== false,
    };
}
function recessedStackedBuildingFloors(o, params = recessedStackedBuildingParams(o)) {
    let z = 0;
    return Array.from({ length: params.floorCount }, (_, index) => {
        const h = index === 0 ? params.firstFloorHeight : params.floorHeight,
            floor = { index, z, h };
        z += h;
        if (index < params.floorCount - 1) z += params.floorGap;
        return floor;
    });
}
// 凹窓階層建物のハンドル種別を、オブジェクト定義の差分へ変換する。
// 3Dドラッグと直交ビューのドラッグで同じ対応を使い、片方だけ更新が
// 抜ける（ハンドルによっては反応しない）状態を防ぐ。
function recessedHandlePatch(o, kind, value) {
    const q = recessedStackedBuildingParams(o);
    if (!Number.isFinite(value)) return null;
    switch (kind) {
        case "recessed-window-count":
            return { recessedWindowCount: Math.round(value) };
        case "recessed-window-margin-left":
            return { recessedWindowMarginLeft: value };
        case "recessed-window-margin-end":
            return { recessedWindowMarginEnd: value };
        case "recessed-window-depth":
            return { recessedWindowDepth: value };
        case "recessed-corner-bevel":
            return { recessedCornerBevel: value };
        case "recessed-floor-height":
            return { recessedFloorHeight: value };
        case "recessed-floor-gap":
            // 接合部の高さ＝窓の高さなので、ここだけで両方が決まる。
            return { recessedFloorGap: value };
        case "recessed-first-floor-height":
            // ハンドルは1Fの実寸。差分だけを格納する。
            return { recessedFirstFloorExtra: Math.max(0, value - q.floorHeight) };
        default:
            return null;
    }
}
// 各階の接合部の中央に窓帯を置く。最上階上には開口を作らない。
function recessedStackedBuildingJunctionWindows(o, params = recessedStackedBuildingParams(o)) {
    // 窓の高さは接合部の高さと同じ。接合部の中に窓帯を収める。
    // 「接合部窓の上下ずれ」で接合部内の位置だけを微調整できる。
    const floors = recessedStackedBuildingFloors(o, params),
        band = (bottom) => ({ center: bottom + params.windowH * 0.5, bottom, top: bottom + params.windowH });
    // 階が1つだけのときは接合部が無いため、最上階の上端（屋根の直下）に置く。
    if (floors.length === 1) return [band(floors[0].z + floors[0].h - params.windowH)];
    return floors.slice(0, -1).map((floor) => band(floor.z + floor.h + params.junctionOffset));
}
function recessedStackedBuildingFootprint(params) {
    const x = params.w * 0.5,
        y = params.d * 0.5,
        b = params.cornerBevel,
        segments = params.cornerBevelSegments;
    if (b <= 0.0001) return [[-x, -y], [x, -y], [x, y], [-x, y]];
    const center = [x - b, -y + b],
        points = [[-x, -y], [x - b, -y]];
    for (let i = 1; i <= segments; i++) {
        const angle = -Math.PI * 0.5 + (Math.PI * 0.5 * i) / segments;
        points.push([center[0] + b * Math.cos(angle), center[1] + b * Math.sin(angle)]);
    }
    points.push([x, y], [-x, y]);
    return points;
}
// 凹んだ多角形（窓の切り欠き付きの床面など）を正しく三角形分割する。
// 重心からの扇状分割では凹みをまたいで図形の外へはみ出し、上ビューで
// 輪郭から飛び出した尖りに見えるため、耳切り法で分割する。
function polygonEarClip(points) {
    const n = points.length,
        area = points.reduce((sum, point, index) => {
            const next = points[(index + 1) % n];
            return sum + point[0] * next[1] - next[0] * point[1];
        }, 0);
    const order = points.map((_, index) => index);
    if (area < 0) order.reverse();
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
        inside = (a, b, c, p) =>
            cross(a, b, p) >= -1e-9 && cross(b, c, p) >= -1e-9 && cross(c, a, p) >= -1e-9,
        tris = [];
    let guard = 0;
    while (order.length > 3 && guard++ < 4000) {
        let clipped = false;
        for (let i = 0; i < order.length; i++) {
            const a = points[order[(i + order.length - 1) % order.length]],
                b = points[order[i]],
                c = points[order[(i + 1) % order.length]];
            if (cross(a, b, c) <= 1e-9) continue;
            const blocked = order.some((index) => {
                const p = points[index];
                if (p === a || p === b || p === c) return false;
                return inside(a, b, c, p);
            });
            if (blocked) continue;
            tris.push([a, b, c]);
            order.splice(i, 1);
            clipped = true;
            break;
        }
        if (!clipped) break;
    }
    if (order.length === 3) tris.push(order.map((index) => points[index]));
    return tris;
}
// 窓帯が階の接合部をまたぐとき、上下の面（スラブ）の輪郭から
// 窓の幅だけを切り欠いた多角形を返す。切り欠きが無ければ外周をそのまま返す。
function recessedStackedBuildingCapPath(params, notch) {
    const footprint = recessedStackedBuildingFootprint(params);
    if (!notch) return footprint;
    // 切り欠きは窓帯の外周と奥壁の間の帯だけを取り除く。
    // 隅のベベル弧を外周側の折れ線としてそのまま使い、角を尖らせない。
    const paths = recessedStackedBuildingWindowPaths(params),
        outer = params.sideWindows ? paths.outer : paths.outer.slice(0, 2),
        inner = params.sideWindows ? paths.inner : paths.inner.slice(0, 2),
        points = [...outer, ...[...inner].reverse()].map((point) => [point[0], point[1]]);
    return points;
}
function recessedStackedBuildingBeamFootprint(params) {
    const x = params.w * 0.5,
        y = params.d * 0.5,
        b = params.cornerBevel,
        p = params.beamProjection,
        segments = params.cornerBevelSegments;
    if (b <= 0.0001) return [[-x, -y - p], [x, -y - p], [x + p, -y], [x + p, y], [-x, y]];
    const center = [x - b, -y + b],
        radius = b + p,
        points = [[-x, -y - p], [x - b, -y - p]];
    for (let i = 1; i <= segments; i++) {
        const angle = -Math.PI * 0.5 + (Math.PI * 0.5 * i) / segments;
        points.push([center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)]);
    }
    points.push([x + p, y], [-x, y]);
    return points;
}
function recessedStackedBuildingWindowPaths(params) {
    const x = params.w * 0.5,
        y = params.d * 0.5,
        b = params.cornerBevel,
        depth = params.windowDepth,
        segments = params.cornerBevelSegments,
        frontRight = x - b,
        sideStart = -y + b,
        sideEnd = sideStart + params.sideWindowW,
        frontStart = frontRight - params.windowW,
        outer = [[frontStart, -y], [frontRight, -y]],
        inner = [[frontStart, -y + depth], [frontRight, -y + depth]];
    if (b > 0.0001) {
        const center = [frontRight, sideStart],
            innerRadius = Math.max(0.025, b - depth);
        for (let i = 1; i <= segments; i++) {
            const angle = -Math.PI * 0.5 + (Math.PI * 0.5 * i) / segments;
            outer.push([center[0] + b * Math.cos(angle), center[1] + b * Math.sin(angle)]);
            inner.push([center[0] + innerRadius * Math.cos(angle), center[1] + innerRadius * Math.sin(angle)]);
        }
        outer.push([x, sideEnd]);
        inner.push([x - depth, sideEnd]);
    } else {
        // ベベル0では角が直角になる。奥壁も直角に折れ、正面の奥壁と
        // 側面の奥壁が斜めの線でつながらないよう頂点数を外周と揃える。
        outer.push([x, sideEnd]);
        inner[1] = [x - depth, -y + depth];
        inner.push([x - depth, sideEnd]);
    }
    return { outer, inner, frontStart, frontRight, sideStart, sideEnd };
}
function recessedStackedBuildingWindowMullionPoints(params) {
    const paths = recessedStackedBuildingWindowPaths(params),
        outer = params.sideWindows ? paths.outer : paths.outer.slice(0, 2),
        inner = params.sideWindows ? paths.inner : paths.inner.slice(0, 2),
        lengths = [],
        total = outer.slice(0, -1).reduce((sum, point, index) => {
            const next = outer[index + 1],
                length = Math.hypot(next[0] - point[0], next[1] - point[1]);
            lengths.push(length);
            return sum + length;
        }, 0),
        out = [];
    for (let n = 1; n < params.windowCount; n++) {
        let distance = (total * n) / params.windowCount,
            segment = 0;
        while (segment < lengths.length - 1 && distance > lengths[segment]) {
            distance -= lengths[segment++];
        }
        const a = outer[segment],
            b = outer[segment + 1],
            ia = inner[segment],
            ib = inner[segment + 1],
            t = lengths[segment] > 1e-6 ? distance / lengths[segment] : 0;
        out.push({
            outer: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
            inner: [ia[0] + (ib[0] - ia[0]) * t, ia[1] + (ib[1] - ia[1]) * t],
        });
    }
    return out;
}
// 凹窓階層建物の線画。窓の手前枠・左右の側面・上面・奥枠を
// 同じローカル座標から作るため、3Dと直交ビューで奥行きがずれない。
function recessedStackedBuildingLines(o) {
    const q = recessedStackedBuildingParams(o),
        out = [],
        c = o.c || "#222222",
        frame = "#8aaeb5",
        dark = "#42616b",
        detailWidth = Math.max(1.7, (Number(o.w) || 1.5) * 1.15),
        line = (points, color = c, width = o.w || 2) => out.push(customLineA(o, points, color, width)),
        closed = (points, color = c, width = o.w || 2) => line([...points, points[0]], color, width),
        x = q.w * 0.5,
        y = q.d * 0.5,
        footprint = recessedStackedBuildingFootprint(q),
        beamFootprint = recessedStackedBuildingBeamFootprint(q),
        drawOpening = (band) => {
            const paths = recessedStackedBuildingWindowPaths(q),
                outer = q.sideWindows ? paths.outer : paths.outer.slice(0, 2),
                inner = q.sideWindows ? paths.inner : paths.inner.slice(0, 2),
                zA = band.bottom,
                zB = band.top,
                to3 = (point, z) => [point[0], point[1], z];
            // 正面からベベルを経て右側面へ連続する凹みの輪郭。
            line(outer.map((point) => to3(point, zA)), frame, detailWidth);
            line(outer.map((point) => to3(point, zB)), frame, detailWidth);
            line(inner.map((point) => to3(point, zA)), dark, detailWidth);
            line(inner.map((point) => to3(point, zB)), dark, detailWidth);
            [0, outer.length - 1].forEach((index) => {
                line([to3(outer[index], zA), to3(inner[index], zA)], frame, detailWidth);
                line([to3(outer[index], zB), to3(inner[index], zB)], frame, detailWidth);
                line([to3(outer[index], zA), to3(outer[index], zB)], frame, detailWidth);
                line([to3(inner[index], zA), to3(inner[index], zB)], dark, detailWidth);
            });
            recessedStackedBuildingWindowMullionPoints(q).forEach(({ inner: back }) => {
                line([to3(back, zA), to3(back, zB)], dark, detailWidth);
            });
        },
        drawBeam = (z1) => {
            if (q.beamHeight <= 0 || q.beamProjection <= 0) return;
            const z0 = z1 - q.beamHeight;
            closed(beamFootprint.map(([px, py]) => [px, py, z0]), frame, detailWidth);
            closed(beamFootprint.map(([px, py]) => [px, py, z1]), frame, detailWidth);
        };
    const junctions = recessedStackedBuildingJunctionWindows(o, q);
    recessedStackedBuildingFloors(o, q).forEach(({ index, z, h }) => {
        const z1 = z + h,
            band = junctions[index],
            // 窓帯が床面をまたぐときは、スラブの輪郭を切り欠いて窓を塞がない。
            lowerCap = band && band.bottom < z + 0.0001 && band.top > z + 0.0001,
            upperCap = band && band.bottom < z1 - 0.0001 && band.top > z1 - 0.0001;
        closed(recessedStackedBuildingCapPath(q, lowerCap).map(([px, py]) => [px, py, z]));
        closed(recessedStackedBuildingCapPath(q, upperCap).map(([px, py]) => [px, py, z1]));
        footprint.forEach(([px, py], index) => {
            const inBevelArc = q.cornerBevel > 0.0001 && index >= 1 && index <= q.cornerBevelSegments + 1;
            if (!inBevelArc) line([[px, py, z], [px, py, z1]]);
        });
        // 窓帯は各階の接合部の中央へ置き、最上階の上には開口を作らない。
        if (band) {
            drawOpening(band);
            drawBeam(band.top);
        } else {
            // 屋根になる最上階には梁／庇を上端へ描く。
            drawBeam(z1);
        }
    });
    return out;
}
// ベランダや小部品用の「ワイヤー直方体」。
// 中心(cx,cy)をずらして、1つのアセット内に複数部品を配置する。
function wireBoxA(o, cx, cy, w, d, z0, z1, color = o.c || "#e7fff4") {
    const x = w / 2,
        y = d / 2,
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
        out = [
            polyA(o, [v[0], v[1], v[2], v[3]], color),
            polyA(o, [v[4], v[5], v[6], v[7]], color),
            lineA(o, [v[0], v[4]], color),
            lineA(o, [v[1], v[5]], color),
            lineA(o, [v[2], v[6]], color),
            lineA(o, [v[3], v[7]], color),
        ];
    return out;
}
// ===== 4. パスパイプ用のベクトル計算 =====
// パスパイプは制御点を丸めて中心線を作り、その周囲に円形断面を並べる。
// 以下の小さな関数群は、その中心線・接線・法線を計算するためのもの。
function pathVecSub(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function pathVecAdd(a, b, scale = 1) {
    return [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale];
}
function pathVecScale(a, scale) {
    return [a[0] * scale, a[1] * scale, a[2] * scale];
}
function pathVecDot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function pathVecCross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function pathVecLength(a) {
    return Math.hypot(a[0], a[1], a[2]);
}
function pathVecUnit(a, fallback = [1, 0, 0]) {
    const n = pathVecLength(a);
    return n > 1e-7 ? pathVecScale(a, 1 / n) : [...fallback];
}
function pathRotateAroundAxis(v, axis, angle) {
    const c = Math.cos(angle),
        s = Math.sin(angle),
        dot = pathVecDot(axis, v),
        cross = pathVecCross(axis, v);
    return [
        v[0] * c + cross[0] * s + axis[0] * dot * (1 - c),
        v[1] * c + cross[1] * s + axis[1] * dot * (1 - c),
        v[2] * c + cross[2] * s + axis[2] * dot * (1 - c),
    ];
}
// パスが未設定、または壊れている場合に使う初期制御点。
function pathPipeDefaultPoints() {
    return [
        [-2.4, 0, 1.1],
        [0, 0, 1.1],
        [0, 2.2, 1.1],
    ];
}
// 保存データから有効な3D制御点だけを取り出す。最低2点ない場合は初期値へ戻す。
function pathPipeControlPoints(o) {
    const source = Array.isArray(o?.path) ? o.path : pathPipeDefaultPoints();
    const points = source
        .map((v) => (Array.isArray(v) ? v.slice(0, 3).map(Number) : []))
        .filter((v) => v.length === 3 && v.every(Number.isFinite));
    return points.length >= 2 ? points : pathPipeDefaultPoints();
}
// 制御点の折れ線を、角丸半径に応じた円弧付き中心線へ変換する。
function pathPipeRoundedPath(o) {
    const points = pathPipeControlPoints(o),
        cornerRadius = Math.max(0, Number(o?.cornerRadius) || 0),
        arcSteps = clamp(Math.round(Number(o?.cornerSteps) || 6), 2, 16),
        out = [],
        add = (p) => {
            const last = out[out.length - 1];
            if (!last || pathVecLength(pathVecSub(p, last)) > 1e-5) out.push(p);
        };
    add(points[0]);
    for (let i = 1; i < points.length - 1; i++) {
        const p = points[i],
            prev = points[i - 1],
            next = points[i + 1],
            toPrev = pathVecUnit(pathVecSub(prev, p)),
            toNext = pathVecUnit(pathVecSub(next, p)),
            lenPrev = pathVecLength(pathVecSub(p, prev)),
            lenNext = pathVecLength(pathVecSub(next, p)),
            alpha = Math.acos(clamp(pathVecDot(toPrev, toNext), -1, 1)),
            turn = Math.PI - alpha,
            bisector = pathVecUnit(pathVecAdd(toPrev, toNext));
        if (
            cornerRadius <= 1e-5 ||
            turn <= 0.01 ||
            !Number.isFinite(alpha) ||
            pathVecLength(pathVecAdd(toPrev, toNext)) < 1e-5
        ) {
            add(p);
            continue;
        }
        const tanHalf = Math.tan(turn * 0.5),
            cut = Math.min(cornerRadius * tanHalf, lenPrev * 0.45, lenNext * 0.45),
            radius = cut / Math.max(1e-5, tanHalf),
            entry = pathVecAdd(p, toPrev, cut),
            exit = pathVecAdd(p, toNext, cut),
            normal = pathVecUnit(pathVecCross(toPrev, toNext), [0, 0, 1]),
            centerDistance = radius / Math.max(1e-5, Math.sin(alpha * 0.5)),
            center = pathVecAdd(p, bisector, centerDistance),
            start = pathVecSub(entry, center),
            finish = pathVecSub(exit, center),
            angle = Math.atan2(pathVecDot(normal, pathVecCross(start, finish)), pathVecDot(start, finish));
        add(entry);
        if (!Number.isFinite(angle) || pathVecLength(pathVecCross(start, finish)) < 1e-5) {
            add(exit);
            continue;
        }
        for (let j = 1; j <= arcSteps; j++)
            add(pathVecAdd(center, pathRotateAroundAxis(start, normal, (angle * j) / arcSteps)));
    }
    add(points[points.length - 1]);
    return out;
}
// 中心線の各点に円形リングを置き、隣り合うリングを三角形でつなぐ。
// ここで作ったメッシュは線画の輪郭・外接範囲・ギズモ計算に使われる。
function pathPipeMesh(o) {
    const centerline = pathPipeRoundedPath(o),
        radius = clamp(Math.abs(Number(o?.pipeRadius) || 0.18), 0.02, 20),
        sides = clamp(Math.round(Number(o?.pipeSides) || 10), 6, 24),
        rings = [],
        triangles = [];
    centerline.forEach((center, i) => {
        const before = centerline[Math.max(0, i - 1)],
            after = centerline[Math.min(centerline.length - 1, i + 1)],
            tangent = pathVecUnit(pathVecSub(after, before)),
            reference = Math.abs(tangent[2]) > 0.92 ? [0, 1, 0] : [0, 0, 1],
            side = pathVecUnit(pathVecCross(tangent, reference), [1, 0, 0]),
            binormal = pathVecUnit(pathVecCross(tangent, side), [0, 1, 0]);
        rings.push(
            Array.from({ length: sides }, (_, j) => {
                const angle = (j / sides) * Math.PI * 2,
                    radial = pathVecAdd(
                        pathVecScale(side, Math.cos(angle) * radius),
                        pathVecScale(binormal, Math.sin(angle) * radius),
                    );
                return pathVecAdd(center, radial);
            }),
        );
    });
    for (let i = 0; i < rings.length - 1; i++)
        for (let j = 0; j < sides; j++) {
            const next = (j + 1) % sides,
                a = rings[i][j],
                b = rings[i][next],
                c = rings[i + 1][next],
                d = rings[i + 1][j];
            triangles.push([a, b, c], [a, c, d]);
        }
    if (rings.length) {
        const startCenter = centerline[0],
            endCenter = centerline[centerline.length - 1];
        for (let j = 0; j < sides; j++) {
            const next = (j + 1) % sides;
            triangles.push(
                [startCenter, rings[0][next], rings[0][j]],
                [endCenter, rings[rings.length - 1][j], rings[rings.length - 1][next]],
            );
        }
    }
    return { centerline, rings, triangles, radius, sides };
}
// 楕円リングを作る。円柱・円錐・ランタンの輪郭に使う。
// 楕円リング2つの対応する頂点を結ぶ縦の補助線。半径・中心・高さは
// それぞれ違ってよいので、円柱の胴・テーパー部・頭部の縦線に使える。
function spokesA(o, c0, r0, z0, c1, r1, z1, n = 8, color = o.c, width = o.w || 1) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2,
            cos = Math.cos(t),
            sin = Math.sin(t);
        out.push(
            lineA(
                o,
                [
                    [c0[0] + r0[0] * cos, c0[1] + r0[1] * sin, z0],
                    [c1[0] + r1[0] * cos, c1[1] + r1[1] * sin, z1],
                ],
                color,
                width,
            ),
        );
    }
    return out;
}
function ringA(o, rx, ry, z, n = 8, color = o.c || "#e7fff4") {
    const a = [];
    for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        a.push([rx * Math.cos(t), ry * Math.sin(t), z]);
    }
    return polyA(o, a, color);
}
// 開口建物の寸法を、描画に使いやすい形へまとめる。
function buildingParams(o) {
    const g = buildingGeometry(o),
        w = g.w,
        d = g.d,
        h = g.h,
        openingW = g.openingW,
        openingH = g.openingH;
    return {
        w,
        d,
        h,
        openingW,
        openingH,
        backY: g.backY,
        sideT: Math.max(0.05, (w - openingW) / 2),
        topT: Math.max(0.05, h - openingH),
    };
}
// 開口OFF時の建物を、通常の閉じた箱として線画化する。
// openingEnabledが未指定の通常建物は従来どおり開口ありとして扱う。
function closedBuildingLines(o, w, d, h, color = o.c || "#222222") {
    const x = w / 2,
        y = d / 2,
        front = [
            [-x, -y, 0],
            [x, -y, 0],
            [x, -y, h],
            [-x, -y, h],
        ],
        back = [
            [-x, y, 0],
            [x, y, 0],
            [x, y, h],
            [-x, y, h],
        ];
    return [
        polyA(o, [...front, front[0]], color),
        polyA(o, [...back, back[0]], color),
        lineA(o, [front[0], back[0]], color),
        lineA(o, [front[1], back[1]], color),
        lineA(o, [front[2], back[2]], color),
        lineA(o, [front[3], back[3]], color),
    ];
}
// 形ごとの処理は ASSET_LINE_BUILDERS の表から呼び出す。1形状=1関数にして、
// 追加・修正するときに触る範囲をその形の中だけに閉じ込める。
function assetLines(o) {
    const kind = o.asset,
        w = o.ra * 2,
        d = o.rb * 2,
        h = o.h,
        c = o.c || "#222222",
        // a はアセットも線画と同じ色で描くための別名。
        ctx = { o, kind, w, d, h, c, a: c, out: [] };
    const build = ASSET_LINE_BUILDERS[kind];
    if (build) build(ctx);
    return ctx.out;
}
const ASSET_LINE_BUILDERS = {
    custom: linesCustom,
    box: linesBox,
    wallSign: linesWallSign,
    cornerCutBox: linesCornerCutBox,
    wallSideSign: linesWallSideSign,
    beveledBox: linesBeveledBox,
    pathPipe: linesPathPipe,
    recessedStackedBuilding: linesRecessedStackedBuilding,
    stackedBuilding: linesStackedBuilding,
    beveledStackedBuilding: linesStackedBuilding,
    balcony: linesBalcony,
    stairs: linesStairs,
    crosswalk: linesCrosswalk,
    cylinder: linesCylinder,
    cone: linesCone,
    sphere: linesSphere,
    triPrism: linesTriPrism,
    triPyramid: linesTriPyramid,
    lantern: linesLantern,
    sign: linesSign,
    person: linesPerson,
    building: linesBuilding,
    awning: linesAwning,
};

    // --- 作成サイトから読み込んだ任意形状 ---
// geometry.vertices / edges / loops を、そのまま3D線画へ変換する。
function linesCustom(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    // アセット作成サイトから読み込んだ任意形状。頂点と辺／ループを
    // 3D線画へ変換する。頂点はx=幅、y=奥行、z=高さのローカル座標。
    const g = o.geometry || {},
        vertices = Array.isArray(g.vertices) ? g.vertices : [],
        edges = Array.isArray(g.edges) ? g.edges : [],
        loops = Array.isArray(g.loops) ? g.loops : [],
        edgeStyles = Array.isArray(g.edgeStyles) ? g.edgeStyles : [],
        loopStyles = Array.isArray(g.loopStyles) ? g.loopStyles : [],
        width = Number(o.w) || MASTER_W;
    const customLine = (points, color = c, lineWidth = width) =>
            out.push({
                c: color,
                w: lineWidth,
                ob: o,
                d3: true,
                cs: sigNow(),
                p: dens3(points.map((q) => customPt(o, q[0], q[1], q[2]))),
            }),
        addEdge = (ia, ib, color = c, lineWidth = width) => {
            const u = vertices[ia],
                v = vertices[ib];
            if (!Array.isArray(u) || !Array.isArray(v) || u.length < 3 || v.length < 3) return;
            const a3 = u.slice(0, 3).map(Number),
                b3 = v.slice(0, 3).map(Number);
            if (!a3.every(Number.isFinite) || !b3.every(Number.isFinite)) return;
            customLine([a3, b3], color, lineWidth);
        };
    edges.forEach((e, i) => {
        if (!Array.isArray(e) || e.length < 2) return;
        const style = edgeStyles[i] || {};
        addEdge(Number(e[0]), Number(e[1]), style.color || c, Number(style.width) || width);
    });
    loops.forEach((loop, li) => {
        if (!Array.isArray(loop) || loop.length < 2) return;
        const style = loopStyles[li] || {};
        for (let i = 0; i < loop.length; i++)
            addEdge(
                Number(loop[i]),
                Number(loop[(i + 1) % loop.length]),
                style.color || c,
                Number(style.width) || width,
            );
    });
    // --- 直方体 ---
    // ベベルなしの基準形状。ベベル直方体とは別アセットとして選べる。
}


function linesBox(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    out.push(...wireBoxA(o, 0, 0, w, d, 0, Math.max(0.01, h), c));
    // --- 壁付け看板（単体）---
    // 板の表裏の輪郭を同じ点列から作り、対応する頂点を結んで板厚を出す。
    // 取付金具は板の左側面から横へ伸びる直方体として並べる。
}


function linesWallSign(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    const params = wallSignParams(o),
        face = wallSignFacePoints(params),
        half = params.thickness * 0.5,
        front = face.map(([x, z]) => [x, -half, z]),
        back = face.map(([x, z]) => [x, half, z]);
    out.push(polyA(o, front, c), polyA(o, back, c));
    face.forEach(([x, z]) => out.push(lineA(o, [[x, -half, z], [x, half, z]], c)));
    wallSignBrackets(params).forEach((bracket) =>
        out.push(
            ...wireBoxA(
                o,
                (bracket.x0 + bracket.x1) * 0.5,
                (bracket.y0 + bracket.y1) * 0.5,
                bracket.x1 - bracket.x0,
                bracket.y1 - bracket.y0,
                bracket.z - bracket.h * 0.5,
                bracket.z + bracket.h * 0.5,
                c,
            ),
        ),
    );
}


function linesCornerCutBox(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    const q = cornerCutOpeningParams(o),
        z1 = Math.max(0.01, Math.abs(Number(h) || 0.01));
    if (q.enabled) out.push(...cornerCutOpeningWireBoxA(o, q, z1, c, o.cutColor || "#e24b4b"));
    else
        out.push(
            ...cornerCutWireBoxA(o, q.w, q.d, 0, z1, q.cornerOffset, q.cornerCutCorner, c, o.cutColor || "#e24b4b"),
        );
    // --- 横壁看板 ---
    // 看板本体を縦長の箱として描き、必要なら壁からの
    // 面のある取付金具を0〜3本、看板の裏側へ追加する。
}


function linesWallSideSign(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    const boardH = Math.max(0.05, Math.abs(Number(o.ra) || 0.9) * 2),
        boardW = Math.max(0.05, Math.abs(Number(o.rb) || 0.75) * 2),
        thickness = Math.max(0.02, Math.abs(Number(o.h) || 0.12)),
        bracketCount = clamp(Math.round(Number(o.wallSideSignBracketCount) || 0), 0, 3),
        bracketLength = clamp(Math.abs(Number(o.wallSideSignBracketLength) || 0.36), 0.05, 5),
        clearance = 0.025,
        bracketV = Math.max(0.06, Math.min(0.18, boardH * 0.1)),
        bracketSpan = bracketLength + clearance,
        bracketCenter = -(boardW * 0.5 + bracketSpan * 0.5),
        beveled = o.wallSideSignShape === "beveled",
        bevelOffset = clamp(
            Number(o.wallSideSignBevelOffset) || 0.06,
            0.01,
            Math.max(0.01, Math.min(boardH, boardW) * 0.45),
        ),
        bevelSegments = 4,
        boardBox = (cx, cy, w0, d0, z0, z1) =>
            beveled
                ? beveledWireBoxA(o, cx, cy, w0, d0, z0, z1, bevelOffset, bevelSegments, c)
                : wireBoxA(o, cx, cy, w0, d0, z0, z1, c);
    // 看板本体は壁に対して垂直。boardW方向が壁から外へ出る幅、
    // thickness方向が壁に沿う薄い板厚になる。
    out.push(...boardBox(0, 0, boardH, boardW, -thickness * 0.5, thickness * 0.5));
    for (let i = 0; i < bracketCount; i++) {
        const t = (i + 1) / (bracketCount + 1),
            x = -boardH * 0.5 + boardH * t;
        // ベベルは看板本体だけに適用し、取付金具は普通の直方体で描く。
        out.push(...wireBoxA(o, x, bracketCenter, bracketV, bracketSpan, -thickness * 0.5, thickness * 0.5, c));
    }
    // --- ベベル直方体 ---
    // footprintを底面・上面へ複製し、押し出し後だけ縦辺を追加する。
}


function linesBeveledBox(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    const q = beveledBoxParams(o),
        footprint = beveledBoxFootprint(q.w, q.d, q.bevelOffset, q.bevelSegments),
        z0 = 0,
        z1 = Math.max(0, Number(h) || 0);
    // 初期状態は長方形と同じく一枚の面。押し出し後は面取りした
    // 底面・上面と、各頂点をつなぐ縦辺を線画にする。
    out.push(
        polyA(
            o,
            footprint.map(([x, y]) => [x, y, z0]),
            c,
        ),
    );
    if (z1 > 0.000001) {
        out.push(
            polyA(
                o,
                footprint.map(([x, y]) => [x, y, z1]),
                c,
            ),
        );
        footprint.forEach(([x, y]) =>
            out.push(
                lineA(
                    o,
                    [
                        [x, y, z0],
                        [x, y, z1],
                    ],
                    c,
                ),
            ),
        );
    }
    // --- パスパイプ ---
    // 丸めた中心線のリングを描き、リング間の縦線でパイプらしさを出す。
}


function linesPathPipe(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    const mesh = pathPipeMesh(o);
    mesh.rings.forEach((ring) => out.push(polyA(o, ring, c, 0.95)));
    for (let j = 0; j < mesh.sides; j++)
        out.push(
            lineA(
                o,
                mesh.rings.map((ring) => ring[j]),
                c,
                0.85,
            ),
        );
    // --- 凹窓階層建物 ---
    // 各階に同じ矩形凹窓を反復し、正面・右側面のファサードを描く。
}


function linesRecessedStackedBuilding(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    out.push(...recessedStackedBuildingLines(o));
    // --- 階層建物／ベベル階層建物 ---
    // floors配列を階ごとに描く。開口はopeningEnabledがtrueの1Fだけへ追加する。
}


function linesStackedBuilding(ctx) {
    const { o, w, d, h, c, a, out, kind } = ctx;
    const floors =
        Array.isArray(o.floors) && o.floors.length
            ? o.floors
            : [
                  {
                      x: 0,
                      y: 0,
                      z: 0,
                      w: o.ra * 2 || 4,
                      d: o.rb * 2 || 3,
                      h: o.h || 2.2,
                      rimHeight: 0.16,
                      rimOverhang: 0.18,
                  },
              ];
    const addBox = (f, w, d, z, h, color = c, caps = { bottom: true, top: true }) => {
        const x = w / 2,
            y = d / 2,
            ox = Number(f.x || 0),
            oy = Number(f.y || 0),
            oz = Number(f.z || 0),
            v = [
                [-x, -y, z],
                [x, -y, z],
                [x, y, z],
                [-x, y, z],
                [-x, -y, z + h],
                [x, -y, z + h],
                [x, y, z + h],
                [-x, y, z + h],
            ],
            toWorld = (q) => [q[0] + ox, q[1] + oy, q[2] + oz];
        // 面ごとに輪郭を足すと共有辺が2回描かれるため、箱の12辺を一度だけ描く。
        [
            ...(caps.bottom ? [[0, 1, 2, 3, 0]] : []),
            ...(caps.top ? [[4, 5, 6, 7, 4]] : []),
            [0, 4],
            [1, 5],
            [2, 6],
            [3, 7],
        ].forEach((edge) =>
            out.push(
                customLineA(
                    o,
                    edge.map((i) => toWorld(v[i])),
                    color,
                ),
            ),
        );
    };
    const addBeveledBox = (
        f,
        w,
        d,
        z,
        h,
        bevelOffset,
        bevelSegments,
        color = c,
        caps = { bottom: true, top: true },
    ) => {
        const footprint = beveledBoxFootprint(w, d, bevelOffset, bevelSegments),
            ox = Number(f.x || 0),
            oy = Number(f.y || 0),
            oz = Number(f.z || 0),
            bottom = footprint.map(([x, y]) => [x + ox, y + oy, z + oz]),
            top = footprint.map(([x, y]) => [x + ox, y + oy, z + h + oz]);
        if (caps.bottom) out.push(customLineA(o, [...bottom, bottom[0]], color));
        if (caps.top) out.push(customLineA(o, [...top, top[0]], color));
        footprint.forEach(([x, y]) =>
            out.push(
                customLineA(
                    o,
                    [
                        [x + ox, y + oy, z + oz],
                        [x + ox, y + oy, z + h + oz],
                    ],
                    color,
                ),
            ),
        );
    };
    // 開口ON/OFFの判定はここで一度だけ行う。OFFなら通常の閉じた建物になる。
    const openingEnabled = stackedOpeningEnabled(o);
    const addOpeningWire = (f, w, d, h, opening) => {
        const ox = Number(f.x || 0),
            oy = Number(f.y || 0),
            oz = Number(f.z || 0),
            near = -d * 0.5,
            far = d * 0.5,
            panelY = opening.openingBack,
            ow = opening.openingW,
            oh = opening.openingH,
            toWorld = (p) => [p[0] + ox, p[1] + oy, p[2] + oz],
            line = (points, color = a, width = 1.1) => out.push(customLineA(o, points.map(toWorld), color, width));
        // 開口を持つ1Fの外周・開口枠・内側底辺／奥面を、既存の開口建物と同じ順で描く。
        line([
            [-w / 2, near, h],
            [w / 2, near, h],
        ]);
        line([
            [-w / 2, far, h],
            [w / 2, far, h],
        ]);
        line([
            [-ow / 2, near, 0],
            [-ow / 2, near, oh],
            [ow / 2, near, oh],
            [ow / 2, near, 0],
        ]);
        line([
            [-ow / 2, far, 0],
            [-ow / 2, far, oh],
            [ow / 2, far, oh],
            [ow / 2, far, 0],
        ]);
        if (Math.abs(panelY - far) > 0.01)
            line([
                [-ow / 2, panelY, 0],
                [-ow / 2, panelY, oh],
                [ow / 2, panelY, oh],
                [ow / 2, panelY, 0],
            ]);
        // 開口の床面／奥面の下辺は省略しない。正面側と閉じた内壁側の両方へ描く。
        line(
            [
                [-ow / 2, near, 0.012],
                [ow / 2, near, 0.012],
            ],
            a,
            1.05,
        );
        line(
            [
                [-ow / 2, panelY, 0.012],
                [ow / 2, panelY, 0.012],
            ],
            a,
            1.15,
        );
        line(
            [
                [-ow / 2, near, 0],
                [-ow / 2, panelY, 0],
                [-ow / 2, panelY, oh],
                [-ow / 2, near, oh],
                [-ow / 2, near, 0],
            ],
            a,
            1.0,
        );
        line(
            [
                [ow / 2, near, 0],
                [ow / 2, near, oh],
                [ow / 2, panelY, oh],
                [ow / 2, panelY, 0],
                [ow / 2, near, 0],
            ],
            a,
            1.0,
        );
        line(
            [
                [-ow / 2, near, oh],
                [ow / 2, near, oh],
                [ow / 2, panelY, oh],
                [-ow / 2, panelY, oh],
                [-ow / 2, near, oh],
            ],
            a,
            1.0,
        );
    };
    floors.forEach((f, i) => {
        const w = Math.max(0.05, Math.abs(Number(f.w) || Number(o.ra || 2) * 2)),
            d = Math.max(0.05, Math.abs(Number(f.d) || Number(o.rb || 1.5) * 2)),
            h = Math.max(0.05, Math.abs(Number(f.h) || 2.2)),
            opening = i === 0 && openingEnabled ? stackedOpeningParams(o, f) : null,
            rh = clamp(Math.abs(Number(f.rimHeight) || Number(o.rimHeight) || 0.16), 0.01, h),
            ro = Math.max(0, Math.abs(Number(f.rimOverhang) || Number(o.rimOverhang) || 0.18)),
            bevelOffset = Number.isFinite(Number(f.bevelOffset))
                ? Number(f.bevelOffset)
                : Number(o.bevelOffset) || 0.28,
            bevelSegments = beveledBoxSegments(
                f.bevelSegments,
                f.bevelEdges,
                beveledBoxSegments(o.bevelSegments, o.bevelEdges),
            );
        // 本体の上辺は上側の縁に隠れるため描かず、下側の縁は全階で作らない。
        // 開口をONにした場合だけ、1F本体へ開口枠・内側面を追加する。
        if (kind === "beveledStackedBuilding") {
            addBeveledBox(f, w, d, 0, h, bevelOffset, bevelSegments, f.c || c, { bottom: i === 0, top: false });
            if (opening) addOpeningWire(f, w, d, h, opening);
            // 下側の縁は全階で作らず、各階の上側だけに縁を配置する。
            addBeveledBox(f, w + ro * 2, d + ro * 2, h - rh, rh, bevelOffset, bevelSegments, f.rimColor || a);
        } else {
            addBox(f, w, d, 0, h, f.c || c, { bottom: i === 0, top: false });
            if (opening) addOpeningWire(f, w, d, h, opening);
            // 下側の縁は全階で作らず、各階の上側だけに縁を配置する。
            addBox(f, w + ro * 2, d + ro * 2, h - rh, rh, f.rimColor || a);
        }
    });
    // --- 壁付けベランダ ---
    // 床スラブ、前面の腰壁、左右の腰壁、支持ブラケットを別々に描く。
}


function linesBalcony(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    // 壁側（+Y）を建物外壁へ合わせ、床を外側（-Y）へ張り出すU字型のベランダ。
    // 床スラブ＋左右の腰壁＋前面の腰壁を別箱として描くため、面編集後も形状が崩れない。
    const floorT = clamp(Number(o.balconyFloorThickness) || 0.16, 0.04, Math.max(0.05, h * 0.7)),
        railH = clamp(Number(o.balconyRailHeight) || Math.max(0.18, h - floorT), 0.12, Math.max(0.12, h - 0.01)),
        railT = clamp(Number(o.balconyRailThickness) || 0.12, 0.035, Math.min(w, d) * 0.35),
        frontRail = o.balconyFrontRail !== false,
        sideRail = o.balconySideRail !== false;
    out.push(...wireBoxA(o, 0, 0, w, d, 0, floorT, c));
    if (frontRail) out.push(...wireBoxA(o, 0, -d / 2 + railT / 2, w, railT, floorT, floorT + railH, c));
    if (sideRail) {
        out.push(...wireBoxA(o, -w / 2 + railT / 2, 0, railT, d, floorT, floorT + railH, c));
        out.push(...wireBoxA(o, w / 2 - railT / 2, 0, railT, d, floorT, floorT + railH, c));
    }
    // 壁付け面の床下に短い支持ブラケットを入れ、正面／3D線画で張り出し方向を読み取りやすくする。
    const bracketZ = Math.max(0.02, floorT * 0.18),
        wallY = d / 2 - railT * 0.5,
        frontY = -d / 2 + railT * 0.5;
    [-w * 0.34, w * 0.34].forEach((x) =>
        out.push(
            lineA(
                o,
                [
                    [x, wallY, bracketZ],
                    [x, frontY, 0],
                ],
                c,
                0.85,
            ),
        ),
    );
    // --- 階段 ---
    // stepsの数だけ段板と蹴上げを作り、必要なら手すりも追加する。
}


function linesStairs(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    const n = Math.max(2, Math.min(24, Math.round(o.steps || 6))),
        sd = d / n,
        sh = h / n;
    // 段板・蹴上げ・左右側面の輪郭を、実際の階段断面に沿って描く。
    for (let i = 0; i < n; i++) {
        const y0 = -d / 2 + i * sd,
            y1 = y0 + sd,
            z = (i + 1) * sh,
            z0 = i * sh;
        out.push(
            polyA(
                o,
                [
                    [-w / 2, y0, z],
                    [w / 2, y0, z],
                    [w / 2, y1, z],
                    [-w / 2, y1, z],
                ],
                c,
            ),
        );
        out.push(
            lineA(
                o,
                [
                    [-w / 2, y0, z0],
                    [-w / 2, y0, z],
                    [w / 2, y0, z],
                ],
                a,
                0.9,
            ),
        );
        out.push(
            lineA(
                o,
                [
                    [w / 2, y0, z0],
                    [w / 2, y0, z],
                ],
                a,
                0.9,
            ),
        );
        out.push(
            lineA(
                o,
                [
                    [-w / 2, y0, z],
                    [-w / 2, y1, z],
                ],
                a,
                0.9,
            ),
        );
        out.push(
            lineA(
                o,
                [
                    [w / 2, y0, z],
                    [w / 2, y1, z],
                ],
                a,
                0.9,
            ),
        );
    }
    out.push(
        polyA(
            o,
            [
                [-w / 2, -d / 2, 0],
                [w / 2, -d / 2, 0],
                [w / 2, d / 2, 0],
                [-w / 2, d / 2, 0],
            ],
            a,
            0.9,
        ),
    );
    out.push(
        lineA(
            o,
            [
                [-w / 2, d / 2, 0],
                [w / 2, d / 2, 0],
                [w / 2, d / 2, h],
                [-w / 2, d / 2, h],
                [-w / 2, d / 2, 0],
            ],
            a,
            1.1,
        ),
    );
    // Rail posts and handrail. The quick setting can hide the whole rail.
    if (o.handrail === true)
        [-w / 2, w / 2].forEach((x) => {
            const p1 = [x, -d / 2, 0.48 * h],
                p2 = [x, d / 2, h + 0.35];
            out.push(lineA(o, [p1, p2], a, 1.1));
            for (let i = 0; i <= 3; i++) {
                const t = i / 3;
                out.push(
                    lineA(
                        o,
                        [
                            [x, -d / 2 + d * t, 0.48 * h + (h + 0.35 - 0.48 * h) * t],
                            [x, -d / 2 + d * t, 0.48 * h + (h + 0.35 - 0.48 * h) * t + 0.22],
                        ],
                        a,
                        0.8,
                    ),
                );
            }
        });
    // --- 横断歩道 ---
    // 道路の面へ白いストライプを並べる。
}


function linesCrosswalk(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    const n = Math.max(3, Math.min(16, Math.round(o.stripes || 7))),
        gap = d / (n + 1),
        stripeD = gap * 0.6;
    for (let i = 0; i < n; i++) {
        const y = -d / 2 + gap * (i + 1);
        out.push(
            polyA(
                o,
                [
                    [-w / 2, y - stripeD / 2, 0.012],
                    [w / 2, y - stripeD / 2, 0.012],
                    [w / 2, y + stripeD / 2, 0.012],
                    [-w / 2, y + stripeD / 2, 0.012],
                ],
                c,
                1.1,
            ),
        );
    }
    out.push(
        lineA(
            o,
            [
                [-w / 2, -d / 2, 0.014],
                [w / 2, -d / 2, 0.014],
            ],
            a,
            0.9,
        ),
    );
    out.push(
        lineA(
            o,
            [
                [-w / 2, d / 2, 0.014],
                [w / 2, d / 2, 0.014],
            ],
            a,
            0.9,
        ),
    );
    // --- 円柱・円錐・球 ---
    // 円柱は上下輪郭、円錐は底面とシルエット、球は正面向きの円だけを描く。
}


function linesCylinder(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    // 円柱は上下の輪郭だけ。側面の縦エッジは描かない。
    out.push(ringA(o, w * 0.5, d * 0.5, 0, 12, c));
    out.push(ringA(o, w * 0.5, d * 0.5, h, 12, c));
}


function linesCone(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    // 円錐も円柱と同じく、底面の輪郭と現在の視点から見える
    // 左右2本のシルエット母線だけを描く。全周の放射線は描かない。
    const rx = w * 0.5,
        ry = d * 0.5,
        base = [];
    for (let i = 0; i < 16; i++) {
        const t = (i / 16) * Math.PI * 2;
        base.push([rx * Math.cos(t), ry * Math.sin(t), 0]);
    }
    out.push(polyA(o, base, c));
    const cen = L2W(o, 0, 0, 0),
        rel = V.add(camPos(), cen, 1, -1),
        [iu, iv] = PL[o.k],
        cs = Math.cos(o.rot * DG),
        sn = Math.sin(o.rot * DG),
        eu = [0, 0, 0],
        ev = [0, 0, 0];
    eu[iu] = cs;
    eu[iv] = sn;
    ev[iu] = -sn;
    ev[iv] = cs;
    const ph = Math.atan2(V.dot(rel, ev), V.dot(rel, eu));
    [ph + Math.PI / 2, ph - Math.PI / 2].forEach((t) =>
        out.push(
            lineA(
                o,
                [
                    [rx * Math.cos(t), ry * Math.sin(t), 0],
                    [0, 0, h],
                ],
                a,
                1.0,
            ),
        ),
    );
}


function linesSphere(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    // 球は緯度線・経線を描かず、円形の外周輪郭だけを描く。
    // 視点方向に合わせた「正面向きの円」を3D線として置くため、
    // カメラを回転・パンしても画面上の輪郭はつぶれず、常に円のままになる。
    const r = Math.min(w, d, h) * 0.5,
        zc = h * 0.5,
        center = L2W(o, 0, 0, zc),
        eu = [0, 0, 0],
        ev = [0, 0, 0],
        ez = [0, 0, 0];
    const [iu, iv] = PL[o.k],
        cs = Math.cos(o.rot * DG),
        sn = Math.sin(o.rot * DG);
    eu[iu] = cs;
    eu[iv] = sn;
    ev[iu] = -sn;
    ev[iv] = cs;
    ez[o.k] = -o.d;
    const right = V.nrm(wld([1, 0, 0])),
        up = V.nrm(wld([0, 1, 0])),
        pts = [],
        toLocal = (world) => {
            const rel = V.add(world, center, 1, -1);
            return [V.dot(rel, eu), V.dot(rel, ev), zc + V.dot(rel, ez)];
        };
    for (let i = 0; i <= 48; i++) {
        const t = (i / 48) * Math.PI * 2,
            co = Math.cos(t),
            si = Math.sin(t);
        pts.push(toLocal(V.add(center, V.add(right, up, r * co, r * si))));
    }
    out.push(lineA(o, pts, c, 1.1));
}


function linesTriPrism(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    const x = w / 2,
        y = d / 2,
        front = [
            [-x, -y, 0],
            [x, -y, 0],
            [0, -y, h],
        ],
        back = [
            [-x, y, 0],
            [x, y, 0],
            [0, y, h],
        ];
    out.push(polyA(o, front, c));
    out.push(polyA(o, back, c));
    for (let i = 0; i < 3; i++) out.push(lineA(o, [front[i], back[i]], a, 1.1));
}


function linesTriPyramid(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    const x = w / 2,
        y = d / 2,
        base = [
            [-x, -y, 0],
            [x, -y, 0],
            [0, y, 0],
        ],
        apex = [0, 0, h];
    out.push(polyA(o, base, c));
    base.forEach((v) => out.push(lineA(o, [v, apex], a, 1.1)));
}


function linesLantern(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    const body0 = 0.22 * h,
        body1 = 0.7 * h,
        rx = w * 0.48,
        ry = d * 0.48;
    out.push(ringA(o, rx, ry, body0, 8, c));
    out.push(ringA(o, rx, ry, body1, 8, c));
    out.push(...spokesA(o, [0, 0], [rx, ry], body0, [0, 0], [rx, ry], body1, 8, c));
    out.push(ringA(o, rx * 0.82, ry * 0.82, 0.78 * h, 8, a));
    out.push(...spokesA(o, [0, 0], [rx, ry], body1, [0, 0], [rx * 0.82, ry * 0.82], 0.78 * h, 8, a, 0.9));
    out.push(
        lineA(
            o,
            [
                [0, 0, 0.78 * h],
                [0, 0, 0.94 * h],
            ],
            a,
            1.3,
        ),
    );
    out.push(
        lineA(
            o,
            [
                [0, 0, 0.94 * h],
                [-0.1 * w, 0, h],
                [0.1 * w, 0, h],
                [0, 0, 0.94 * h],
            ],
            a,
            1.1,
        ),
    );
    // Two inner bands suggest a glowing paper lantern without requiring a texture.
    [0.36, 0.56].forEach((z) => out.push(ringA(o, rx * 1.02, ry * 1.02, z * h, 8, a, 0.8)));
    // --- 看板 ---
    // 外枠と、faceW / faceHで編集できる内側の絵枠を描く。
}


function linesSign(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    // 看板外側は通常の直方体。内側の絵枠だけを追加編集できる。
    const board0 = 0.08 * h,
        board1 = 0.82 * h,
        fy = signFaceDepth(o, 0.009);
    const faceW = Math.max(0.08, Math.min(Number(o.faceW) || w * 0.7, w * 0.9));
    const faceH = Math.max(0.08, Math.min(Number(o.faceH) || h * 0.34, (board1 - board0) * 0.84));
    out.push(...boxA(o, w, d, board0, board1, c));
    // adjustable inner illustration frame; no lettering strokes inside.
    const ix = faceW / 2,
        iz0 = (board0 + board1 - faceH) / 2,
        iz1 = iz0 + faceH;
    const q = [
        [-ix, fy, iz0],
        [ix, fy, iz0],
        [ix, fy, iz1],
        [-ix, fy, iz1],
    ];
    out.push(polyA(o, q, a, 1.1));
    // --- 人物 ---
    // 身長・体格・頭身・脚の開き・簡易ポーズを線画へ反映する。
}


function linesPerson(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    // 人物は配置後も高さ・体格・頭身・脚の開き・簡易ポーズを編集できる。
    // 腕は既存仕様どおり描かず、立体感は胴体・脚・頭の線だけで表現する。
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
    let legTop = (0.47 - 0.16 * crouch) * h,
        torso0 = (0.44 - 0.16 * crouch) * h,
        torso1 = (0.78 - 0.18 * crouch) * h,
        head0 = (0.84 - 0.18 * crouch) * h,
        head1 = (0.99 - 0.18 * crouch) * h,
        footY = [-stride, stride],
        kneeY = [-0.02 * h, 0.02 * h],
        kneeX = [-0.09 * h * legSpread, 0.09 * h * legSpread],
        poseTop = (1 - 0.18 * crouch) * h;
    const bodyY = lean * 0.18,
        headY = lean * 0.42,
        headTopX = Math.sin(headTilt * DG) * 0.06 * h;
    if (pose === "walk") {
        kneeY = [-0.05 * h, 0.06 * h];
        kneeX = [-0.07 * h * legSpread, 0.08 * h * legSpread];
    }
    if (pose === "crouch") {
        kneeY = [-0.06 * h, 0.06 * h];
        kneeX = [-0.1 * h * legSpread, 0.1 * h * legSpread];
    }
    if (pose === "sit") {
        kneeY = [0.2 * h, 0.26 * h];
        kneeX = [-0.11 * h * legSpread, 0.11 * h * legSpread];
    }
    // 足元の小さな台座と脚。歩幅・しゃがみ量・脚の開きを連続的に反映する。
    out.push(...boxA(o, leg * 1.5, bd * 0.85, 0, 0.08 * h, c));
    if (pose === "sit") {
        out.push(
            lineA(
                o,
                [
                    [-0.09 * h * legSpread, bodyY, 0.32 * h],
                    [kneeX[0], kneeY[0], 0.3 * h],
                    [kneeX[0], footY[0], 0],
                ],
                c,
                1.4,
            ),
        );
        out.push(
            lineA(
                o,
                [
                    [0.09 * h * legSpread, bodyY, 0.32 * h],
                    [kneeX[1], kneeY[1], 0.3 * h],
                    [kneeX[1], footY[1], 0],
                ],
                c,
                1.4,
            ),
        );
    } else {
        out.push(
            lineA(
                o,
                [
                    [kneeX[0], footY[0], 0],
                    [kneeX[0], kneeY[0], legTop],
                ],
                c,
                1.4,
            ),
        );
        out.push(
            lineA(
                o,
                [
                    [kneeX[1], footY[1], 0],
                    [kneeX[1], kneeY[1], legTop],
                ],
                c,
                1.4,
            ),
        );
    }
    // Torso and shoulders. leanは肩・首・頭の位置へ反映する。
    out.push(...boxA(o, bw, bd, torso0, torso1, c));
    out.push(
        lineA(
            o,
            [
                [-bw * 0.48, bodyY, torso1 - 0.02 * h],
                [bw * 0.48, bodyY, torso1 - 0.02 * h],
            ],
            a,
            1,
        ),
    );
    // 腕は省略。小さな人物シルエットとして使えるよう胴体と脚だけ残す。
    // Head rings are shifted/tilted without adding arms.
    const ringAt = (rx, ry, x0, y0, z, n, color) => {
        const pts = [];
        for (let i = 0; i < n; i++) {
            const t = (i / n) * Math.PI * 2;
            pts.push([x0 + rx * Math.cos(t), y0 + ry * Math.sin(t), z]);
        }
        return polyA(o, pts, color);
    };
    out.push(
        lineA(
            o,
            [
                [0, bodyY, torso1],
                [headTopX, headY, head0],
            ],
            c,
            1.1,
        ),
    );
    out.push(ringAt(headR, headR * 0.9, 0, headY, head0, 8, c));
    out.push(ringAt(headR * 0.86, headR * 0.78, headTopX, headY + 0.02 * h, head1, 8, c));
    out.push(
        ...spokesA(
            o,
            [0, headY],
            [headR, headR * 0.9],
            head0,
            [headTopX, headY + 0.02 * h],
            [headR * 0.86, headR * 0.78],
            head1,
            8,
            c,
            0.85,
        ),
    );
    // A small measurement tick makes the current pose height reference visible.
    const mx = 0.42 * h;
    out.push(
        lineA(
            o,
            [
                [mx, 0, 0],
                [mx, 0, poseTop],
            ],
            a,
            0.75,
        ),
    );
    out.push(
        lineA(
            o,
            [
                [mx - 0.045 * h, 0, 0],
                [mx + 0.045 * h, 0, 0],
            ],
            a,
            0.75,
        ),
    );
    out.push(
        lineA(
            o,
            [
                [mx - 0.045 * h, 0, poseTop],
                [mx + 0.045 * h, 0, poseTop],
            ],
            a,
            0.75,
        ),
    );
    // --- 開口のある建物 ---
    // 外枠に加え、開口の左右柱・上梁・内側面・奥面を描く。
}


function linesBuilding(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    // チェックを外したリンク建物は、開口のない通常の閉じた箱へ戻す。
    if (o.openingEnabled === false) {
        // 閉じた箱は形が別なので、専用の関数の結果をそのまま返す。
        out.push(...closedBuildingLines(o, w, d, h, c));
        return;
    }
    // 外側は直方体の輪郭を保ちながら、正面から背面まで抜ける開口を作る。
    // 左右の柱＋上梁として分けて描くので、開口の左右・上面・奥行きも編集対象になる。
    const bp = buildingParams(o),
        ow = bp.openingW,
        oh = bp.openingH,
        backY = bp.backY,
        side = bp.sideT,
        centerX = (ow + side) / 2;
    const outerFront = [
            [-w / 2, -d / 2, 0],
            [w / 2, -d / 2, 0],
            [w / 2, -d / 2, h],
            [-w / 2, -d / 2, h],
        ],
        outerBack = [
            [-w / 2, d / 2, 0],
            [w / 2, d / 2, 0],
            [w / 2, d / 2, h],
            [-w / 2, d / 2, h],
        ];
    out.push(polyA(o, outerFront, c));
    out.push(polyA(o, outerBack, c));
    const innerFront = [
            [-ow / 2, -d / 2, 0],
            [-ow / 2, -d / 2, oh],
            [ow / 2, -d / 2, oh],
            [ow / 2, -d / 2, 0],
        ],
        innerBack = [
            [-ow / 2, d / 2, 0],
            [-ow / 2, d / 2, oh],
            [ow / 2, d / 2, oh],
            [ow / 2, d / 2, 0],
        ],
        innerPanel = [
            [-ow / 2, backY, 0],
            [-ow / 2, backY, oh],
            [ow / 2, backY, oh],
            [ow / 2, backY, 0],
        ];
    out.push(lineA(o, innerFront, a, 1.1));
    out.push(lineA(o, innerBack, a, 1.1));
    if (Math.abs(Math.abs(backY) - d / 2) > 0.01) out.push(lineA(o, innerPanel, a, 1.1));
    // オレンジの奥面の下辺だけを、面から少し浮かせて線画として表示する。
    out.push(
        lineA(
            o,
            [
                [-ow / 2, backY, 0.012],
                [ow / 2, backY, 0.012],
            ],
            a,
            1.15,
        ),
    );
    [
        [-w / 2, -d / 2, 0],
        [-w / 2, d / 2, 0],
        [w / 2, -d / 2, 0],
        [w / 2, d / 2, 0],
        [-w / 2, -d / 2, h],
        [-w / 2, d / 2, h],
        [w / 2, -d / 2, h],
        [w / 2, d / 2, h],
        [-ow / 2, -d / 2, 0],
        [-ow / 2, d / 2, 0],
        [ow / 2, -d / 2, 0],
        [ow / 2, d / 2, 0],
        [-ow / 2, -d / 2, oh],
        [-ow / 2, d / 2, oh],
        [ow / 2, -d / 2, oh],
        [ow / 2, d / 2, oh],
    ].forEach((p, i, arr) => {
        if (i % 2 === 0) out.push(lineA(o, [p, arr[i + 1]], a, 1.0));
    });
    // 開口の内側面（左右・上）を明示して、面表示時にも空洞が見えるようにする。
    out.push(
        polyA(
            o,
            [
                [-ow / 2, -d / 2, 0],
                [-ow / 2, d / 2, 0],
                [-ow / 2, d / 2, oh],
                [-ow / 2, -d / 2, oh],
            ],
            a,
            1.0,
        ),
    );
    out.push(
        polyA(
            o,
            [
                [ow / 2, -d / 2, 0],
                [ow / 2, -d / 2, oh],
                [ow / 2, d / 2, oh],
                [ow / 2, d / 2, 0],
            ],
            a,
            1.0,
        ),
    );
    out.push(
        polyA(
            o,
            [
                [-ow / 2, -d / 2, oh],
                [ow / 2, -d / 2, oh],
                [ow / 2, d / 2, oh],
                [-ow / 2, d / 2, oh],
            ],
            a,
            1.0,
        ),
    );
    // --- 店舗テント ---
    // awningGeometry()が返す手前上辺・奥側・底辺をつないでテントを描く。
}


function linesAwning(ctx) {
    const { o, w, d, h, c, a, out } = ctx;
    // 店舗テント：初期状態は直方体。手前上辺だけを高さ・奥行き方向へ動かせる。
    const g = awningGeometry(o),
        x = g.w / 2,
        baseY = g.baseFrontY,
        edgeY = g.edgeY,
        backY = g.d / 2,
        frontTop = g.edgeZ,
        backTop = g.h,
        frontBottom = g.frontBottom,
        backBottom = g.backBottom;
    out.push(
        polyA(
            o,
            [
                [-x, edgeY, frontTop],
                [x, edgeY, frontTop],
                [x, backY, backTop],
                [-x, backY, backTop],
            ],
            c,
            1.1,
        ),
    );
    out.push(
        polyA(
            o,
            [
                [-x, baseY, frontBottom],
                [x, baseY, frontBottom],
                [x, backY, backBottom],
                [-x, backY, backBottom],
            ],
            a,
            1.0,
        ),
    );
    out.push(
        polyA(
            o,
            [
                [-x, baseY, frontBottom],
                [x, baseY, frontBottom],
                [x, edgeY, frontTop],
                [-x, edgeY, frontTop],
            ],
            a,
            1.0,
        ),
    );
    out.push(
        polyA(
            o,
            [
                [-x, backY, backBottom],
                [x, backY, backBottom],
                [x, backY, backTop],
                [-x, backY, backTop],
            ],
            a,
            1.0,
        ),
    );
    out.push(
        polyA(
            o,
            [
                [-x, baseY, frontBottom],
                [-x, backY, backBottom],
                [-x, backY, backTop],
                [-x, edgeY, frontTop],
            ],
            a,
            1.0,
        ),
    );
    out.push(
        polyA(
            o,
            [
                [x, baseY, frontBottom],
                [x, edgeY, frontTop],
                [x, backY, backTop],
                [x, backY, backBottom],
            ],
            a,
            1.0,
        ),
    );
}

// ===== 6. 保存データ・入力値の正規化 =====
// 描画前に、寸法の下限・ベベル値・階数・パス値などを整える。
// ここでは見た目を作らず、後段のassetLines()が安全に読める形へ変換する。
function normalizedAsset(o) {
    let q = o?.attachment ? syncAttachedPart(o) : o;
    if (q && q.asset === "cornerCutBox") {
        const params = cornerCutOpeningParams(q);
        return {
            ...q,
            cornerOffset: params.cornerOffset,
            cornerCutCorner: params.cornerCutCorner,
            cornerCutOpeningEnabled: q.cornerCutOpeningEnabled === true,
            cornerCutOpeningW: params.openingW,
            cornerCutOpeningH: params.openingH,
            cornerCutOpeningDepth: params.openingDepth,
            h: Math.max(0.01, Math.abs(Number(q.h) || 0.01)),
        };
    }
    if (q && q.asset === "beveledBox") {
        const width = Math.max(0.01, Math.abs(Number(q.ra) || 0.01) * 2),
            depth = Math.max(0.01, Math.abs(Number(q.rb) || 0.01) * 2),
            max = Math.max(0, Math.min(width, depth) * 0.5 - 0.001),
            bevelOffset = clamp(Number(q.bevelOffset) || 0, 0, max),
            bevelSegments = beveledBoxSegments(q.bevelSegments, q.bevelEdges);
        return { ...q, bevelOffset, bevelSegments, h: Math.max(0, Number(q.h) || 0) };
    }
    if (q && q.asset === "wallSign") {
        const params = wallSignParams(q);
        return {
            ...q,
            ra: params.width * 0.5,
            rb: params.thickness * 0.5,
            h: params.height,
            wallSignBracketCount: params.bracketCount,
            wallSignBracketLength: params.bracketLength,
            wallSignShape: params.beveled ? "beveled" : "box",
            wallSignBevelOffset: params.bevelOffset,
            wallSignBevelSegments: params.bevelSegments,
        };
    }
    if (q && q.asset === "recessedStackedBuilding") {
        const params = recessedStackedBuildingParams(q);
        return {
            ...q,
            ra: params.w * 0.5,
            rb: params.d * 0.5,
            h: params.totalH,
            recessedFloorCount: params.floorCount,
            recessedFloorHeight: params.floorHeight,
            recessedFirstFloorExtra: params.firstFloorExtra,
            recessedFloorGap: params.floorGap,
            recessedCornerBevel: params.cornerBevel,
            recessedCornerBevelSegments: params.cornerBevelSegments,
            recessedWindowW: params.windowW,
            recessedWindowMarginLeft: params.marginLeft,
            recessedWindowMarginEnd: params.marginEnd,
            recessedJunctionOffset: params.junctionOffset,
            recessedWindowCount: params.windowCount,
            recessedWindowH: params.windowH,
            recessedWindowDepth: params.windowDepth,
            recessedWindowBottom: params.windowBottom,
            recessedSillHeight: params.sillHeight,
            recessedBeamHeight: params.beamHeight,
            recessedBeamProjection: params.beamProjection,
            recessedSideWindowW: params.sideWindowW,
            recessedSideWindows: params.sideWindows,
        };
    }
    if (q && isStackedBuildingAsset(q)) {
        const source = Array.isArray(q.floors) && q.floors.length ? q.floors : [],
            first = source[0] || { w: Number(q.ra) * 2 || 4, d: Number(q.rb) * 2 || 3, h: 2.2, rimHeight: 0.16 },
            opening = stackedOpeningParams(q, first),
            baseOffset = Number.isFinite(Number(q.bevelOffset)) ? Number(q.bevelOffset) : 0.28,
            baseSegments = beveledBoxSegments(q.bevelSegments, q.bevelEdges),
            floors = source.map((f) => {
                const w = Math.max(0.01, Math.abs(Number(f.w) || Number(q.ra) * 2 || 4)),
                    d = Math.max(0.01, Math.abs(Number(f.d) || Number(q.rb) * 2 || 3)),
                    max = Math.max(0, Math.min(w, d) * 0.5 - 0.001),
                    offset = clamp(Number.isFinite(Number(f.bevelOffset)) ? Number(f.bevelOffset) : baseOffset, 0, max),
                    segments = beveledBoxSegments(f.bevelSegments, f.bevelEdges, baseSegments);
                return { ...f, bevelOffset: offset, bevelSegments: segments };
            });
        return {
            ...q,
            ...(q.asset === "beveledStackedBuilding" ? { bevelOffset: baseOffset, bevelSegments: baseSegments } : {}),
            openingEnabled: stackedOpeningEnabled(q),
            openingW: opening.openingW,
            openingH: opening.openingH,
            openingBack: opening.openingBack,
            floors,
            h: floors.reduce((max, f) => Math.max(max, (Number(f.z) || 0) + (Number(f.h) || 0)), 0),
        };
    }
    // パスパイプは制御点からra/rb/h（外接範囲）も再計算する。
    if (q && q.asset === "pathPipe") {
        const path = pathPipeControlPoints(q),
            radius = clamp(Number.isFinite(Number(q.pipeRadius)) ? Math.abs(Number(q.pipeRadius)) : 0.18, 0.02, 20),
            cornerRadius = clamp(
                Number.isFinite(Number(q.cornerRadius)) ? Math.abs(Number(q.cornerRadius)) : 0.55,
                0,
                20,
            ),
            pipeSides = clamp(Math.round(Number(q.pipeSides) || 10), 6, 24),
            cornerSteps = clamp(Math.round(Number(q.cornerSteps) || 6), 2, 16),
            xs = path.map((v) => v[0]),
            ys = path.map((v) => v[1]),
            zs = path.map((v) => v[2]);
        q = {
            ...q,
            path,
            pipeRadius: radius,
            cornerRadius,
            pipeSides,
            cornerSteps,
            ra: Math.max(0.1, (Math.max(...xs) - Math.min(...xs)) * 0.5 + radius),
            rb: Math.max(0.1, (Math.max(...ys) - Math.min(...ys)) * 0.5 + radius),
            h: Math.max(0.1, Math.max(...zs) - Math.min(...zs) + radius * 2),
        };
    }
    // ベランダの床厚・手すり厚・手すり高さを正規化する。
    if (q && q.asset === "balcony") {
        const floorT = clamp(Number(q.balconyFloorThickness) || 0.16, 0.04, 10),
            railT = clamp(Number(q.balconyRailThickness) || 0.12, 0.035, 10),
            railH = q.balconyRailHeightEdited
                ? clamp(Number(q.balconyRailHeight) || 0.9, 0.12, 30)
                : Math.max(0.12, (Number(q.h) || 1.25) - floorT);
        q = {
            ...q,
            balconyFloorThickness: floorT,
            balconyRailThickness: railT,
            balconyRailHeight: railH,
            h: floorT + railH,
        };
    }
    // 球は3方向の半径をそろえ、必ず真球として扱う。
    if (q && q.asset === "sphere") {
        const r = Math.max(
            0.005,
            Math.min(
                Math.abs(Number(q.ra) || 0.65),
                Math.abs(Number(q.rb) || 0.65),
                Math.abs(Number(q.h) || 1.3) * 0.5,
            ),
        );
        return { ...q, ra: r, rb: r, h: r * 2 };
    }
    // テントの編集済み手前辺を再計算し、描画とギズモで同じ値を使う。
    if (q && q.asset === "awning") {
        const g = awningGeometry(q);
        return {
            ...q,
            awningEdgeZ: g.edgeZ,
            awningEdgeY: g.edgeY,
            awningThickness: g.thickness,
            awningFrontBottom: g.frontBottom,
            awningBackBottom: g.backBottom,
        };
    }
    // 開口幅・開口高さ・奥面位置を建物本体の範囲内へ収める。
    if (q && q.asset === "building") {
        const w = Math.max(0.1, Math.abs(Number(q.ra) || 2) * 2),
            d = Math.max(0.05, Math.abs(Number(q.rb) || 0.5) * 2),
            h = Math.max(0.1, Number(q.h) || 3),
            openingW = clamp(Number(q.openingW) || w * 0.56, 0.1, Math.max(0.1, w - 0.1)),
            openingH = clamp(Number(q.openingH) || h * 0.66, 0.1, Math.max(0.1, h - 0.1)),
            n = { ...q, openingW, openingH };
        if (Number.isFinite(Number(q.openingBack)))
            n.openingBack = clamp(Number(q.openingBack), -d / 2 + 0.025, d / 2 - 0.025);
        return n;
    }
    return q;
}
// 正規化済みアセットを線画へ変換する入口。
function genAsset(o) {
    const q = normalizedAsset(o);
    return assetLines(q).map((s) => ({ ...s, ob: q, d3: true, cs: sigNow() }));
}

// ===== 7. 既存エンジンへの接続 =====
// engine-core.jsのgenShapeを置き換えず、元の関数を退避してから
// assetだけをgenAssetへ振り分ける。通常のrect/box/circは従来処理のまま。
const baseGenShape = genShape;
genShape = function (o) {
    return o && o.type === "asset" ? genAsset(o) : baseGenShape(o);
};
// アセットの外接範囲もここで計算する。
// 選択枠、間取りのヒット判定、ボックス選択、移動ギズモが同じ範囲を使う。
const baseObBounds = obBounds;
obBounds = function (o) {
    if (!o || o.type !== "asset") return baseObBounds(o);
    const q = syncAttachedPart(o),
        pts = [];
    if (q.asset === "custom" && Array.isArray(q.geometry?.vertices) && q.geometry.vertices.length) {
        q.geometry.vertices.forEach((v) => {
            if (Array.isArray(v) && v.length >= 3)
                pts.push(customPt(q, Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0));
        });
    } else if (q.asset === "cornerCutBox") {
        const params = cornerCutOpeningParams(q),
            footprint = params.footprint,
            h = Math.max(0.01, Math.abs(Number(q.h) || 0.01));
        footprint.forEach(([x, y]) => {
            pts.push(pt(q, x, y, 0));
            pts.push(pt(q, x, y, h));
        });
        if (params.enabled)
            [params.frontA, params.frontB, params.backA, params.backB].forEach((xy) => {
                pts.push(pt(q, xy[0], xy[1], 0));
                pts.push(pt(q, xy[0], xy[1], params.openingH));
            });
    } else if (q.asset === "wallSign") {
        const params = wallSignParams(q),
            half = params.thickness * 0.5,
            reach = -params.width * 0.5 - (params.bracketCount > 0 ? params.bracketLength : 0),
            face = wallSignFacePoints(params);
        face.forEach(([x, z]) => {
            [-half, half].forEach((y) => pts.push(pt(q, x, y, z)));
            pts.push(pt(q, reach, 0, z));
        });
    } else if (q.asset === "wallSideSign") {
        const bracketLength = clamp(Math.abs(Number(q.wallSideSignBracketLength) || 0.36), 0.05, 5),
            clearance = 0.025,
            bracketCount = clamp(Math.round(Number(q.wallSideSignBracketCount) || 0), 0, 3),
            boardHalfHeight = Math.abs(Number(q.ra) || 0.5),
            boardHalfWidth = Math.abs(Number(q.rb) || 0.5),
            thickness = Math.max(0.02, Math.abs(Number(q.h) || 0.12)),
            y0 = bracketCount > 0 ? -boardHalfWidth - bracketLength - clearance : -boardHalfWidth,
            y1 = boardHalfWidth,
            z0 = -thickness * 0.5,
            z1 = thickness * 0.5;
        [y0, y1].forEach((y) =>
            [-boardHalfHeight, boardHalfHeight].forEach((x) => [z0, z1].forEach((z) => pts.push(pt(q, x, y, z)))),
        );
    } else if (q.asset === "pathPipe") {
        const mesh = pathPipeMesh(q);
        mesh.rings.forEach((ring) =>
            ring.forEach((v) => pts.push(pt(q, Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0))),
        );
    } else if (q.asset === "recessedStackedBuilding") {
        const params = recessedStackedBuildingParams(q),
            h = params.totalH,
            xValues = [-params.w / 2, params.w / 2, params.w / 2 + params.beamProjection],
            yValues = [-params.d / 2 - params.beamProjection, -params.d / 2, params.d / 2],
            beamBottom = Math.max(0, h - params.beamHeight);
        xValues.forEach((x) =>
            yValues.forEach((y) => {
                pts.push(customPt(q, x, y, 0));
                pts.push(customPt(q, x, y, h));
                pts.push(customPt(q, x, y, beamBottom));
            }),
        );
    } else if (isStackedBuildingAsset(q)) {
        const floors =
            Array.isArray(q.floors) && q.floors.length
                ? q.floors
                : [{ x: 0, y: 0, z: 0, w: q.ra * 2 || 4, d: q.rb * 2 || 3, h: q.h || 2.2 }];
        floors.forEach((f) => {
            const w = Math.abs(Number(f.w) || 4),
                d = Math.abs(Number(f.d) || 3),
                h = Math.abs(Number(f.h) || 2.2),
                rh = Math.min(h, Math.max(0.01, Math.abs(Number(f.rimHeight) || q.rimHeight || 0.16))),
                ro = Math.max(0, Math.abs(Number(f.rimOverhang) || q.rimOverhang || 0.18)),
                add = (ww, dd, z0, z1) => {
                    [-ww / 2, ww / 2].forEach((x) =>
                        [-dd / 2, dd / 2].forEach((y) =>
                            [z0, z1].forEach((z) =>
                                pts.push(customPt(q, x + Number(f.x || 0), y + Number(f.y || 0), z + Number(f.z || 0))),
                            ),
                        ),
                    );
                };
            add(w, d, 0, h);
            add(w + ro * 2, d + ro * 2, h - rh, h);
        });
    } else {
        const hs = [0, q.h],
            xs = [-q.ra, q.ra],
            ys = [-q.rb, q.rb];
        hs.forEach((z) => xs.forEach((x) => ys.forEach((y) => pts.push(pt(q, x, y, z)))));
    }
    const lo = [Infinity, Infinity, Infinity],
        hi = [-Infinity, -Infinity, -Infinity];
    pts.forEach((v) =>
        v.forEach((n, i) => {
            lo[i] = Math.min(lo[i], n);
            hi[i] = Math.max(hi[i], n);
        }),
    );
    return { lo, hi };
};
// ===== 8. 初期化 =====
// すでに自動保存されているオブジェクトも、今回の円柱・球・看板の新しい線画へ更新する。
regenObjects();
