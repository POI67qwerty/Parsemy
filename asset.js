/* City Grid Studio asset module.
   Asset catalog, low-poly geometry generation and asset-specific normalization live here.
   The UI/controller layer stays in studio-ui.js. */
"use strict";
// ===== Low-poly asset library =====
// 基本プリミティブを先頭にまとめ、その後に街並み用アセットを並べる。
// 円柱は円の押し出しで作れるため、アセット棚からは外している。
const ASSETS = {
    rect: { label: "長方形", glyph: "□", w: 1.5, d: 1.0, h: 0, accent: "#66e3c8" },
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
    circle: { label: "円", glyph: "○", w: 1.25, d: 1.25, h: 0, accent: "#ad9cff" },
    cone: { label: "円錐", glyph: "△", w: 1.25, d: 1.25, h: 1.45, accent: "#ffb36f" },
    sphere: { label: "球体", glyph: "●", w: 1.3, d: 1.3, h: 1.3, accent: "#ad9cff" },
    triPrism: { label: "三角柱", glyph: "△", w: 1.4, d: 1.8, h: 1.25, accent: "#ffb36f" },
    triPyramid: { label: "三角錐", glyph: "▲", w: 1.5, d: 1.5, h: 1.45, accent: "#ff79ba" },
    sign: { label: "看板", glyph: "▤", w: 1.0, d: 0.2, h: 2.15, accent: "#76d9ff" },
    awning: { label: "店舗テント", glyph: "▱", w: 3.8, d: 1.35, h: 0.35, accent: "#d98b68" },
    balcony: { label: "壁付けベランダ", glyph: "▱", w: 3.2, d: 1.8, h: 1.25, accent: "#e6a36f" },
    pathPipe: { label: "パスパイプ", glyph: "◉", w: 4.8, d: 4.2, h: 1.5, accent: "#ff9f68" },
    person: { label: "人物", glyph: "♙", w: 0.46, d: 0.3, h: 1.7, accent: "#ad9cff" },
    stairs: { label: "階段", glyph: "▰", w: 1.45, d: 2.4, h: 0.78, accent: "#ffb36f" },
    building: { label: "開口のある建物", glyph: "▣", w: 4.2, d: 3.2, h: 3.6, accent: "#8ce6c2" },
    buildingAwning: { label: "テント付き建物", glyph: "▣", w: 4.2, d: 3.2, h: 3.6, accent: "#d98b68" },
    buildingSign: { label: "看板付き開口建物", glyph: "▣", w: 4.2, d: 3.2, h: 3.6, accent: "#76d9ff" },
    stackedBuilding: { label: "縁付き階層建物", glyph: "▥", w: 4, d: 3, h: 8.98, accent: "#8ce6c2" },
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

// Coordinate helpers. Local asset coordinates are x=width, y=depth, z=up.
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
const lineA = (o, pts, color = o.c || "#e7fff4", width = o.w || 2) => ({
    c: color,
    w: width,
    ob: o,
    d3: true,
    cs: sigNow(),
    p: dens3(pts.map((q) => pt(o, q[0], q[1], q[2]))),
});
const customLineA = (o, pts, color = o.c || "#e7fff4", width = o.w || 2) => ({
    c: color,
    w: width,
    ob: o,
    d3: true,
    cs: sigNow(),
    p: dens3(pts.map((q) => customPt(o, q[0], q[1], q[2]))),
});
const polyA = (o, pts, color, width) => lineA(o, [...pts, pts[0]], color, width);
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
// ベベル直方体の平面輪郭。四つの縦角を、オフセットを半径とする
// 1〜4分割の円弧で面取りする。segments=1なら一枚の平面面取り、
// segments=4なら各角を4枚の小面へ分割した丸みのあるベベルになる。
function beveledBoxSegments(value, legacyValue, fallback = 4) {
    const direct = Number(value),
        legacy = Number(legacyValue),
        n = Number.isFinite(direct) ? direct : Number.isFinite(legacy) ? legacy : fallback;
    return clamp(Math.round(n), 1, 4);
}
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
function beveledBoxParams(o) {
    const w = Math.max(0.01, Math.abs(Number(o?.ra) || 0.01) * 2),
        d = Math.max(0.01, Math.abs(Number(o?.rb) || 0.01) * 2),
        max = Math.max(0, Math.min(w, d) * 0.5 - 0.001),
        bevelOffset = clamp(Number(o?.bevelOffset) || 0, 0, max),
        bevelSegments = beveledBoxSegments(o?.bevelSegments, o?.bevelEdges);
    return { w, d, max, bevelOffset, bevelSegments };
}
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
function pathPipeDefaultPoints() {
    return [
        [-2.4, 0, 1.1],
        [0, 0, 1.1],
        [0, 2.2, 1.1],
    ];
}
function pathPipeControlPoints(o) {
    const source = Array.isArray(o?.path) ? o.path : pathPipeDefaultPoints();
    const points = source
        .map((v) => (Array.isArray(v) ? v.slice(0, 3).map(Number) : []))
        .filter((v) => v.length === 3 && v.every(Number.isFinite));
    return points.length >= 2 ? points : pathPipeDefaultPoints();
}
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
function ringA(o, rx, ry, z, n = 8, color = o.c || "#e7fff4") {
    const a = [];
    for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        a.push([rx * Math.cos(t), ry * Math.sin(t), z]);
    }
    return polyA(o, a, color);
}
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
function assetLines(o) {
    const kind = o.asset,
        w = o.ra * 2,
        d = o.rb * 2,
        h = o.h,
        c = o.c || "#222222",
        a = c,
        out = []; // アセットも線画と同じ色で描く
    if (kind === "custom") {
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
    } else if (kind === "beveledBox") {
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
    } else if (kind === "pathPipe") {
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
    } else if (kind === "stackedBuilding" || kind === "beveledStackedBuilding") {
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
        floors.forEach((f, i) => {
            const w = Math.max(0.05, Math.abs(Number(f.w) || Number(o.ra || 2) * 2)),
                d = Math.max(0.05, Math.abs(Number(f.d) || Number(o.rb || 1.5) * 2)),
                h = Math.max(0.05, Math.abs(Number(f.h) || 2.2)),
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
            // 1階だけは床側の本体辺を残す。
            if (kind === "beveledStackedBuilding") {
                addBeveledBox(f, w, d, 0, h, bevelOffset, bevelSegments, f.c || c, { bottom: i === 0, top: false });
                // 下側の縁は全階で作らず、各階の上側だけに縁を配置する。
                addBeveledBox(f, w + ro * 2, d + ro * 2, h - rh, rh, bevelOffset, bevelSegments, f.rimColor || a);
            } else {
                addBox(f, w, d, 0, h, f.c || c, { bottom: i === 0, top: false });
                // 下側の縁は全階で作らず、各階の上側だけに縁を配置する。
                addBox(f, w + ro * 2, d + ro * 2, h - rh, rh, f.rimColor || a);
            }
        });
    } else if (kind === "balcony") {
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
    } else if (kind === "stairs") {
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
    } else if (kind === "crosswalk") {
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
    } else if (kind === "cylinder") {
        // 円柱は上下の輪郭だけ。側面の縦エッジは描かない。
        out.push(ringA(o, w * 0.5, d * 0.5, 0, 12, c));
        out.push(ringA(o, w * 0.5, d * 0.5, h, 12, c));
    } else if (kind === "cone") {
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
    } else if (kind === "sphere") {
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
    } else if (kind === "triPrism") {
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
    } else if (kind === "triPyramid") {
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
    } else if (kind === "lantern") {
        const body0 = 0.22 * h,
            body1 = 0.7 * h,
            rx = w * 0.48,
            ry = d * 0.48;
        out.push(ringA(o, rx, ry, body0, 8, c));
        out.push(ringA(o, rx, ry, body1, 8, c));
        for (let i = 0; i < 8; i++) {
            const t = (i / 8) * Math.PI * 2;
            out.push(
                lineA(
                    o,
                    [
                        [rx * Math.cos(t), ry * Math.sin(t), body0],
                        [rx * Math.cos(t), ry * Math.sin(t), body1],
                    ],
                    c,
                ),
            );
        }
        out.push(ringA(o, rx * 0.82, ry * 0.82, 0.78 * h, 8, a));
        for (let i = 0; i < 8; i++) {
            const t = (i / 8) * Math.PI * 2;
            out.push(
                lineA(
                    o,
                    [
                        [rx * Math.cos(t), ry * Math.sin(t), body1],
                        [rx * 0.82 * Math.cos(t), ry * 0.82 * Math.sin(t), 0.78 * h],
                    ],
                    a,
                    0.9,
                ),
            );
        }
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
    } else if (kind === "sign") {
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
    } else if (kind === "person") {
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
        for (let i = 0; i < 8; i++) {
            const t = (i / 8) * Math.PI * 2;
            out.push(
                lineA(
                    o,
                    [
                        [headR * Math.cos(t), headY + headR * 0.9 * Math.sin(t), head0],
                        [headTopX + headR * 0.86 * Math.cos(t), headY + 0.02 * h + headR * 0.78 * Math.sin(t), head1],
                    ],
                    c,
                    0.85,
                ),
            );
        }
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
    } else if (kind === "building") {
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
    } else if (kind === "awning") {
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
    return out;
}
function normalizedAsset(o) {
    let q = o?.attachment ? syncAttachedPart(o) : o;
    if (q && q.asset === "beveledBox") {
        const width = Math.max(0.01, Math.abs(Number(q.ra) || 0.01) * 2),
            depth = Math.max(0.01, Math.abs(Number(q.rb) || 0.01) * 2),
            max = Math.max(0, Math.min(width, depth) * 0.5 - 0.001),
            bevelOffset = clamp(Number(q.bevelOffset) || 0, 0, max),
            bevelSegments = beveledBoxSegments(q.bevelSegments, q.bevelEdges);
        return { ...q, bevelOffset, bevelSegments, h: Math.max(0, Number(q.h) || 0) };
    }
    if (q && q.asset === "beveledStackedBuilding") {
        const source = Array.isArray(q.floors) && q.floors.length ? q.floors : [],
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
            bevelOffset: baseOffset,
            bevelSegments: baseSegments,
            floors,
            h: floors.reduce((max, f) => Math.max(max, (Number(f.z) || 0) + (Number(f.h) || 0)), 0),
        };
    }
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
function genAsset(o) {
    const q = normalizedAsset(o);
    return assetLines(q).map((s) => ({ ...s, ob: q, d3: true, cs: sigNow() }));
}

// Route the existing shape pipeline through the asset generator.
const baseGenShape = genShape;
genShape = function (o) {
    return o && o.type === "asset" ? genAsset(o) : baseGenShape(o);
};
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
    } else if (q.asset === "pathPipe") {
        const mesh = pathPipeMesh(q);
        mesh.rings.forEach((ring) =>
            ring.forEach((v) => pts.push(pt(q, Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0))),
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
// 既に自動保存されているオブジェクトも、今回の円柱・球・看板の新しい線画へ更新する。
regenObjects();
