// ============================================================
// 部品カタログ（asset-kit-parts.js）
// ------------------------------------------------------------
// 「よく使う小物」を部品として登録しておき、アセットはそれを並べて作る。
//
//   ASSET_KIT.define("shopFront", { label: "店先" }, (o, K) => [
//       ...K.part("window", { w: 0.9, h: 0.6, at: [-0.6, 0, 1.05] }),
//       ...K.part("door",   { w: 0.55, h: 1.0, at: [0.3, 0, 0.5] }),
//   ]);
//
// 決まりごと
//   ・部品は原点を中心に、正面を -Y に向けて作る（アセットの向きに合わせる）
//   ・at: [x, y, z] でその場へ置ける（省略時は原点）
//   ・寸法は m。迷ったら w（幅）・h（高さ）・d（奥行き）・t（板厚）
//
// 部品を足すときは registerPart を1つ増やすだけでよい。
// 並べる道具（K.repeat / K.grid）と組み合わせると、窓の列も数行で書ける。
// ============================================================
(function () {
    const K = typeof ASSET_KIT === "undefined" ? null : ASSET_KIT;
    if (!K || typeof K.registerPart !== "function") return;

    // 0 は「未指定」として扱う（寸法に 0 が来ることはない）。
    const num = (v, dflt) => (Number.isFinite(Number(v)) && Number(v) !== 0 ? Number(v) : dflt);

    // ---- 窓：枠（穴あきの板）＋ガラス＋縦の桟 ----
    // axis は「枠を置く壁の向き」。既定の "y" は正面（-Y）を向いた壁。
    K.registerPart("window", (o) => {
        const w = num(o.w, 0.9),
            h = num(o.h, 0.7),
            t = num(o.frame, Math.min(w, h) * 0.07),
            d = num(o.d, 0.08),
            axis = o.axis || "y",
            hole = K.rectPath(Math.max(0.02, w - 2 * t), Math.max(0.02, h - 2 * t)),
            parts = [K.box(K.rectPath(w, h), -d / 2, d / 2, { axis, holes: [hole], holeSides: true })];
        if (o.glass !== false) parts.push(K.sheet(hole, -0.006, 0.006, { axis, color: o.glassColor, width: o.width }));
        // 幅があるときは縦の桟を1本入れる（ガラスが1枚板に見えないように）。
        if (o.mullion !== false && w - 2 * t > 0.45) parts.push(K.box(K.rectPath(0.03, h - 2 * t), -d / 4, d / 4, { axis }));
        return parts;
    });

    // ---- 扉：枠＋扉板＋取っ手 ----
    K.registerPart("door", (o) => {
        const w = num(o.w, 0.55),
            h = num(o.h, 1.0),
            t = num(o.frame, 0.05),
            d = num(o.d, 0.08),
            axis = o.axis || "y",
            hole = K.rectPath(Math.max(0.02, w - 2 * t), Math.max(0.02, h - 2 * t)),
            parts = [
                K.box(K.rectPath(w, h), -d / 2, d / 2, { axis, holes: [hole], holeSides: true }), // 枠
                K.box(hole, -d / 2 + 0.012, d / 2 - 0.012, { axis }), // 扉板
            ];
        if (o.handle !== false) {
            // 取っ手は扉の右寄りに、手前（-Y）へ突き出す短い円柱。
            const hx = (w - 2 * t) * 0.34,
                hz = o.handleZ === undefined ? 0 : Number(o.handleZ);
            parts.push(...K.moveParts([K.cylinder(0.018, -d / 2 - 0.07, -d / 2 - 0.01, { axis: "y", seg: 10 })], hx, 0, hz));
        }
        return parts;
    });

    // ---- 室外機：本体＋ファン＋ガラリ＋脚 ----
    K.registerPart("acUnit", (o) => {
        const w = num(o.w, 0.78),
            h = num(o.h, 0.56),
            d = num(o.d, 0.3),
            fan = Math.min(w, h) * 0.3,
            fy = -d / 2, // 正面（-Y）の位置
            fx = -w * 0.16, // ファンの中心（左寄り）
            fz = h * 0.58,
            parts = [K.box(K.rectPath(w, d), 0, h)]; // 本体（箱）
        // ファン（正面の円い凹み）と羽根の十字。
        parts.push(...K.moveParts([K.cylinder(fan, fy - 0.02, fy + 0.02, { axis: "y", seg: 18 })], fx, 0, fz));
        parts.push(...K.moveParts([K.box(K.rectPath(0.04, fan * 1.7), fy - 0.03, fy - 0.02, { axis: "y" })], fx, 0, fz));
        parts.push(...K.moveParts([K.box(K.rectPath(fan * 1.7, 0.04), fy - 0.03, fy - 0.02, { axis: "y" })], fx, 0, fz));
        // ガラリ（右側の横桟3本）。
        for (let i = 0; i < 3; i++)
            parts.push(
                ...K.moveParts(
                    [K.box(K.rectPath(w * 0.3, 0.022), fy - 0.015, fy + 0.005, { axis: "y" })],
                    w * 0.22,
                    0,
                    h * (0.74 - i * 0.16),
                ),
            );
        // 脚（2本。本体の下へ少しだけ出す）。
        [-w * 0.34, w * 0.34].forEach((x) => parts.push(...K.moveParts([K.box(K.rectPath(0.09, d * 0.85), -0.06, 0.005)], x, 0, 0)));
        return parts;
    });

    // ---- ベンチ：座面＋背もたれ＋脚 ----
    K.registerPart("bench", (o) => {
        const w = num(o.w, 1.6),
            h = num(o.h, 0.45),
            d = num(o.d, 0.42),
            t = num(o.t, 0.05),
            parts = [K.box(K.rectPath(w, d), h - t, h)]; // 座面
        [-w * 0.4, w * 0.4].forEach((x) =>
            parts.push(...K.moveParts([K.box(K.rectPath(t * 1.4, d * 0.8), 0, h - t)], x, 0, 0)),
        );
        if (o.back !== false) {
            const bh = num(o.backH, h * 1.1);
            parts.push(...K.moveParts([K.box(K.rectPath(w, t), h, h + bh)], 0, d / 2 - t / 2, 0));
        }
        return parts;
    });

    // ---- 日よけ（オーニング）：斜めの幕＋手前の垂れ＋腕 ----
    // 断面（Y-Z）を左右（X）へ押し出すので、勾配がそのまま立体になる。
    K.registerPart("awning", (o) => {
        const w = num(o.w, 2.2),
            d = num(o.d, 0.7),
            drop = num(o.drop, 0.28), // 手前へ行くほど下がる量
            t = num(o.t, 0.04),
            zBack = num(o.z, 0), // 壁側の上端の高さ
            zFront = zBack - drop,
            canopy = [
                [-d / 2, zFront],
                [d / 2, zBack],
                [d / 2, zBack - t],
                [-d / 2, zFront - t],
            ],
            parts = [K.box(canopy, -w / 2, w / 2, { axis: "x" })];
        // 手前の垂れ（幕）。板厚のぶんだけ手前へ出す。
        parts.push(K.box(K.offsetPath(K.rectPath(w, 0.14), 0, zFront - 0.07), -d / 2 - t, -d / 2, { axis: "y" }));
        // 腕（下からの支え）。
        [-w * 0.42, w * 0.42].forEach((x) =>
            parts.push(...K.moveParts([K.box(K.rectPath(t, d), zFront - 0.055, zFront + 0.01)], x, 0, 0)),
        );
        return parts;
    });

    // ---- 車輪：タイヤ＋ハブ＋スポーク ----
    K.registerPart("wheel", (o) => {
        const r = num(o.r, 0.3),
            t = num(o.t, 0.16),
            hub = r * 0.3,
            parts = [K.cylinder(r, -t / 2, t / 2, { axis: "y", seg: 20 })];
        parts.push(K.cylinder(hub, -t / 2 - 0.02, t / 2 + 0.02, { axis: "y", seg: 10 }));
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI,
                c = Math.cos(a),
                s = Math.sin(a),
                w = 0.03;
            parts.push(
                K.box(
                    [
                        [c * hub, s * hub],
                        [c * r * 0.9, s * r * 0.9],
                        [c * r * 0.9 - s * w, s * r * 0.9 + c * w],
                        [c * hub - s * w, s * hub + c * w],
                    ],
                    -t / 2 - 0.005,
                    t / 2 + 0.005,
                    { axis: "y" },
                ),
            );
        }
        return parts;
    });

    // ---- 配管：管＋フランジ2枚 ----
    K.registerPart("pipeRun", (o) => {
        const len = num(o.len, 1.2),
            r = num(o.r, 0.05),
            axis = o.axis || "x",
            at = (s) => [axis === "x" ? s : 0, axis === "y" ? s : 0, axis === "z" ? s : 0],
            parts = [K.cylinder(r, -len / 2, len / 2, { axis, seg: 14 })];
        [-len * 0.42, len * 0.42].forEach((s) =>
            parts.push(...K.moveParts([K.cylinder(r * 1.5, -0.02, 0.02, { axis, seg: 14 })], ...at(s))),
        );
        return parts;
    });

    // ---- 看板：板＋文字 ----
    K.registerPart("signBoard", (o) => {
        const w = num(o.w, 1.2),
            h = num(o.h, 0.35),
            t = num(o.t, 0.06),
            text = String(o.text || "SHOP"),
            parts = [K.box(K.rectPath(w, h), -t / 2, t / 2, { axis: "y" })];
        // 文字は板の手前（-Y）から少し出して貼る（板に隠されないように）。
        // text が空なら板だけ（無地の看板）になる。
        if (text.trim())
            parts.push(...K.textPart(text, { face: "front", plane: -t / 2, height: h * num(o.textScale, 0.5), stroke: h * 0.07, proud: 0.012 }));
        return parts;
    });
})();
