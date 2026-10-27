/* City Grid Studio asset module.
   Asset catalog, low-poly geometry generation and asset-specific normalization live here.
   The UI/controller layer stays in studio-ui.js. */
"use strict";
// ===== Low-poly asset library =====
// 基本プリミティブを先頭にまとめ、その後に街並み用アセットを並べる。
// 円柱は円の押し出しで作れるため、アセット棚からは外している。
const ASSETS = {
    rect: { label: "長方形", glyph: "□", w: 1.5, d: 1.0, h: 0, accent: "#66e3c8" },
    circle: { label: "円", glyph: "○", w: 1.25, d: 1.25, h: 0, accent: "#ad9cff" },
    cone: { label: "円錐", glyph: "△", w: 1.25, d: 1.25, h: 1.45, accent: "#ffb36f" },
    sphere: { label: "球体", glyph: "●", w: 1.3, d: 1.3, h: 1.3, accent: "#ad9cff" },
    triPrism: { label: "三角柱", glyph: "△", w: 1.4, d: 1.8, h: 1.25, accent: "#ffb36f" },
    triPyramid: { label: "三角錐", glyph: "▲", w: 1.5, d: 1.5, h: 1.45, accent: "#ff79ba" },
    sign: { label: "看板", glyph: "▤", w: 1.0, d: 0.2, h: 2.15, accent: "#76d9ff" },
    awning: { label: "店舗テント", glyph: "▱", w: 3.8, d: 1.35, h: 0.35, accent: "#d98b68" },
    person: { label: "人物", glyph: "♙", w: 0.46, d: 0.3, h: 1.7, accent: "#ad9cff" },
    stairs: { label: "階段", glyph: "▰", w: 1.45, d: 2.4, h: 0.78, accent: "#ffb36f" },
    building: { label: "開口のある建物", glyph: "▣", w: 4.2, d: 3.2, h: 3.6, accent: "#8ce6c2" },
    buildingAwning: { label: "テント付き建物", glyph: "▣", w: 4.2, d: 3.2, h: 3.6, accent: "#d98b68" },
    buildingSign: { label: "看板付き開口建物", glyph: "▣", w: 4.2, d: 3.2, h: 3.6, accent: "#76d9ff" },
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
                    ? ASSETS[o.asset]?.label || (o.asset === "cylinder" ? "円柱" : "アセット")
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
            ? ASSETS[o.asset]?.glyph || (o.asset === "cylinder" ? "◉" : "◆")
            : o.type === "rect"
                ? "□"
                : o.type === "circ"
                    ? "○"
                    : "◇";

// Coordinate helpers. Local asset coordinates are x=width, y=depth, z=up.
const pt = (o, x, y, z) => L2W(o, x, y, z);
const lineA = (o, pts, color = o.c || "#e7fff4", width = o.w || 2) => ({
    c: color,
    w: width,
    ob: o,
    d3: true,
    cs: sigNow(),
    p: dens3(pts.map((q) => pt(o, q[0], q[1], q[2]))),
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
    if (kind === "stairs") {
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
    const hs = [0, q.h],
        xs = [-q.ra, q.ra],
        ys = [-q.rb, q.rb];
    hs.forEach((z) => xs.forEach((x) => ys.forEach((y) => pts.push(pt(q, x, y, z)))));
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
