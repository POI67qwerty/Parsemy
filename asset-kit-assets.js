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

// ===== 自販機（穴あけ・曲面・文字の3つを使う作例）=====
// ・胴は K.roundedBox（上下の縁と四隅を丸めた曲面）
// ・前面の窓・小銭入れ・取り出し口は K.box(..., { axis:"y", holes:[...] })（ブーリアン差）
// ・看板の文字は K.textPart（線のフォントを面に貼る）
ASSET_KIT.define(
    "vendingMachine",
    {
        label: "自販機",
        glyph: "▯",
        w: 1.0,
        d: 0.75,
        h: 1.83,
        accent: "#d94a4a",
        // 固有値（画面の数値欄・JSONにもそのまま載る）
        // 【割合の値】幅・高さに対する 0〜1 の割合。枠を広げると中の装飾も一緒に広がる。
        vmWindowWRatio: 0.62, // 商品の窓の幅（幅に対して）
        vmWindowHRatio: 0.35, // 商品の窓の高さ（高さに対して）
        vmWindowBottomRatio: 0.36, // 窓の下端（高さに対して）
        vmBandHeightRatio: 0.11, // 窓の上の看板の高さ（高さに対して）
        vmOutletWRatio: 0.46, // 取り出し口の幅（幅に対して）
        vmOutletHeightRatio: 0.11, // 取り出し口の高さ（高さに対して）
        vmOutletBottomRatio: 0.04, // 取り出し口の下端（高さに対して）
        vmCoinWRatio: 0.18, // 小銭入れの幅（幅に対して）
        // 【実寸（m）】丸みと板の厚みは、幅を変えても見た目が変わらないので実寸で持つ。
        vmBodyRadius: 0.05, // 上下の縁の丸み
        vmCornerRadius: 0.08, // 四隅（縦の稜線）の丸み
        vmCornerSeg: 2, // 四隅の分割数
        vmVertSeg: 2, // 上下の縁の分割数
        vmPanelProud: 0.015, // 前面の板を胴から出す量
        vmPanelThickness: 0.05,
    },
    (o, K) => {
        const W = Math.max(0.2, Math.abs(2 * o.ra)),
            D = Math.max(0.2, Math.abs(2 * o.rb)),
            H = Math.max(0.3, Math.abs(o.h)),
            // 割合の固有値を 0〜1 に収めてから幅・高さへ掛ける（枠を広げると中も広がる）。
            ratio = (key, dflt, lo, hi) => Math.max(lo, Math.min(hi, K.param(o, key, dflt))),
            bodyR = K.param(o, "vmBodyRadius", 0.05),
            cornerR = K.param(o, "vmCornerRadius", 0.08),
            cSeg = Math.round(K.param(o, "vmCornerSeg", 2)),
            vSeg = Math.round(K.param(o, "vmVertSeg", 2)),
            winW = W * ratio("vmWindowWRatio", 0.62, 0.2, 0.94),
            winH = H * ratio("vmWindowHRatio", 0.35, 0.08, 0.6),
            winBottom = H * ratio("vmWindowBottomRatio", 0.36, 0.05, 0.7),
            bandH = H * ratio("vmBandHeightRatio", 0.11, 0.03, 0.25),
            proud = Math.max(0.002, K.param(o, "vmPanelProud", 0.015)),
            panelT = Math.max(0.01, K.param(o, "vmPanelThickness", 0.05)),
            outW = W * ratio("vmOutletWRatio", 0.46, 0.2, 0.86),
            outH = H * ratio("vmOutletHeightRatio", 0.11, 0.04, 0.25),
            outBottom = H * ratio("vmOutletBottomRatio", 0.04, 0.005, 0.2),
            outCz = outBottom + outH / 2,
            front = -D / 2,
            parts = [],
            // 前面の板（axis:"y" で x-z 面に立てる）。outer は [幅, 高さ] と中心高さで作る。
            frontPanel = (pw, ph, cz, holes, cx = 0) =>
                K.box(K.rectPath(pw, ph, cx, cz), front - proud, front + panelT, { axis: "y", holes, holeSides: true });

        // 1) 胴（曲面）
        parts.push(K.roundedBox(W, D, H, bodyR, { cornerRadius: cornerR, seg: vSeg, cornerSeg: cSeg, z0: 0 }));
        // 2) 商品の窓（板に穴をあける）
        const winCz = winBottom + winH / 2,
            frameH = winH + Math.min(0.16, winH * 0.28);
        parts.push(frontPanel(winW + Math.min(0.16, winW * 0.22), frameH, winCz, [K.rectPath(winW, winH, 0, 0).map(([u, v]) => [u, winCz + v])]));
        // 3) 窓の中（商品の棚）。枠の穴の中に薄い棚を入れて、奥行きがあるように見せる。
        const shelfY = front - proud + Math.min(0.012, proud * 0.8);
        for (let i = 1; i <= 2; i++) {
            const sz = winBottom + (winH * i) / 3;
            parts.push(K.box(K.rectPath(winW * 0.94, 0.035, 0, sz), shelfY - 0.004, shelfY + 0.004, { axis: "y", sheet: true }));
        }
        parts.push(K.box(K.rectPath(winW * 0.94, 0.035, 0, winBottom + 0.02), shelfY - 0.004, shelfY + 0.004, { axis: "y", sheet: true }));
        // 4) 看板の板（窓の上）。文字は入れない（無地の板）。
        const bandBottom = winBottom + frameH + H * 0.02,
            bandTop = Math.min(H - H * 0.04, bandBottom + bandH);
        if (bandTop - bandBottom > 0.02)
            parts.push(frontPanel(winW + Math.min(0.16, winW * 0.22), bandTop - bandBottom, (bandBottom + bandTop) / 2, []));
        // 6) 小銭入れ（小さな板＋縦長の穴）。窓の右に入る幅が無いときは、窓の下の右へ置く。
        const frameW = winW + Math.min(0.16, winW * 0.22),
            sideGap = W / 2 - frameW / 2 - W * 0.03,
            coinW = Math.max(W * 0.08, Math.min(W * 0.24, W * ratio("vmCoinWRatio", 0.18, 0.08, 0.3))),
            coinH = Math.min(H * 0.2, frameH * 0.62);
        if (sideGap >= coinW + W * 0.02) {
            // 窓の右脇に、縦長の穴（小銭入れ）をあけた板
            const coinX = frameW / 2 + coinW / 2 + 0.02,
                cz = winCz + frameH * 0.12,
                slotH = Math.min(0.1, coinH * 0.4);
            parts.push(frontPanel(coinW, coinH, cz, [K.rectPath(coinW * 0.28, slotH, 0, cz + coinH * 0.18)], coinX));
            // 押しボタン（小さな四角を縦に3つ）
            for (let i = 0; i < 3; i++)
                parts.push(
                    K.box(
                        K.rectPath(coinW * 0.42, 0.045, coinX, cz - coinH * 0.1 - i * 0.075),
                        front - proud - 0.025,
                        front - proud,
                        { axis: "y" },
                    ),
                );
        } else {
            // 窓のすぐ下、右寄りに小さな操作パネル（窓の枠とも取り出し口とも重ねない）
            const gapTop = winCz - frameH / 2,
                gapBottom = outCz + outH / 2 + 0.05,
                gap = gapTop - gapBottom;
            if (gap > 0.14) {
                const ph = Math.min(0.12, gap - 0.04),
                    cz = (gapTop + gapBottom) / 2;
                parts.push(frontPanel(Math.min(0.34, W * 0.34), ph, cz, [K.rectPath(0.06, Math.min(0.06, ph * 0.5), 0.06, cz)], 0.1));
            }
        }
        // 7) 取り出し口（板に横長の穴）
        parts.push(frontPanel(Math.min(W * 0.86, winW + 0.14), outH + 0.1, outCz, [K.rectPath(outW, outH, 0, outCz)]));
        return parts;
    },
);

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
        wallSignBrackets(p).forEach((b) =>
            parts.push(
                K.box(
                    K.rectPath(b.x1 - b.x0, b.y1 - b.y0, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2),
                    b.z - b.h * 0.5,
                    b.z + b.h * 0.5,
                ),
            ),
        );
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
    { label: "手すり" },
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
                r.bars.forEach(([bx, by]) => parts.push(K.box(K.rectPath(g.barT, g.barT, bx, by), zBot1, zTop0))); // 縦棒
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
function signalPoleParts(K, g) {
    // 台座は「平たい底板＋すぼまる首」の2段。首を十分な高さにしないと、
    // 線画ではポールの下に小さな三角が付いただけに見えて形が読めない。
    const plateH = Math.max(0.02, g.baseH * 0.28),
        collarH = Math.max(0.05, g.baseH * 0.62),
        poleR = g.poleR,
        collarTop = plateH + collarH;
    return [
        // 底板：平たい円盤。縦線を2本入れて厚みを見せる。
        K.cylinder(g.baseR, 0, plateH, { seg: 14, verts: 2 }),
        // 首：底板からポールへすぼまる円錐台。
        // 回転体（loft）は verts を受け取らないので、縦線は verticals に
        // 向かい合う2点（14角の 0 と 7）を指定して出す。これが無いと
        // 「輪だけ」になって、線画では小さな椀にしか見えない。
        Object.assign(
            K.revolution(
                [
                    [g.baseR * 0.76, plateH],
                    [Math.max(poleR * 1.6, g.baseR * 0.3), collarTop],
                ],
                { seg: 14 },
            ),
            { verticals: [0, 7] },
        ),
        // ポール：首の中から頭のすぐ下まで。縦線は左右2本（断面12角の 0 と 6）に置くと、
        // どの向きから見ても「2本の輪郭線」になり、1本線の棒に見えない。
        K.cylinder(poleR, collarTop - 0.01, g.headBottom + 0.02, { seg: 12, verts: 2 }),
    ];
}

// 灯器の中の絵（止まれ／進め）。細い板を並べた人型で、灯（lamp）の大きさに対する割合で作る。
// 小さく描かれるので、腕は省いて「頭＋胴＋脚」だけにし、灯の内側 6 割に収める。
function signalWalkerParts(K, cx, cz, L, frontY, walking) {
    // 先に中心へ置いてから回す（原点のまま回すと位置が飛ぶ）
    const bar = (w, h, dx, dz, deg = 0) => {
            const u = cx + dx,
                v = cz + dz;
            // 灯の板より確実に手前へ出す（板の中に埋めると隠れ線として消える）
            return K.box(K.rotatePath(K.offsetPath(K.rectPath(w, h), u, v), deg, u, v), frontY, frontY + 0.01, { axis: "y" });
        },
        head = K.cylinder(L * 0.11, frontY, frontY + 0.01, { axis: "y", seg: 12, cx, cy: cz + L * 0.36 }),
        torso = bar(L * 0.2, L * 0.28, 0, L * 0.14, 0),
        legs = walking
            ? [bar(L * 0.16, L * 0.32, -L * 0.075, -L * 0.13, 20), bar(L * 0.16, L * 0.32, L * 0.07, -L * 0.12, -16)]
            : [bar(L * 0.15, L * 0.32, -L * 0.055, -L * 0.13, 0), bar(L * 0.15, L * 0.32, L * 0.055, -L * 0.13, 0)];
    return [head, torso, ...legs];
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
        spHeadH: 0.34, // 灯器（頭）の高さ
        spPoleR: 0.042, // ポールの半径
        spBaseR: 0.16, // 台座の半径
        spBaseH: 0.16, // 台座の高さ（底板＋首）
        tsLampR: 0.125, // 灯の半径
        tsHood: 0.1, // ひさし（フード）の長さ
    },
    (o, K) => {
        const g = signalGeometry(o),
            front = -g.headD / 2,
            lampR = Math.max(0.02, K.param(o, "tsLampR", 0.125)),
            hood = Math.max(0, K.param(o, "tsHood", 0.1)),
            parts = signalPoleParts(K, g);
        // 灯器：角を丸めた横長の箱
        parts.push(K.roundedBox(g.headW, g.headD, g.headH, Math.min(g.headH * 0.18, 0.055), { seg: 2, cornerSeg: 2, z0: g.headBottom }));
        // 灯（青・黄・赤）と、灯のまわりのひさし
        [-1, 0, 1].forEach((i) => {
            const x = i * g.headW * 0.3;
            parts.push(...K.moveParts([K.cylinder(lampR, front - 0.024, front - 0.008, { axis: "y", seg: 20 })], x, 0, g.headCz));
            if (hood > 0.01)
                parts.push(...K.moveParts([K.cylinder(lampR * 1.2, front - 0.01, front - 0.01 - hood, { axis: "y", seg: 16, caps: false })], x, 0, g.headCz));
        });
        return parts;
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
        spHeadH: 0.66,
        spPoleR: 0.038,
        spBaseR: 0.15,
        spBaseH: 0.15,
        psLamp: 0.25, // 灯（四角）の一辺
    },
    (o, K) => {
        const g = signalGeometry(o),
            front = -g.headD / 2,
            lamp = Math.min(Math.max(0.1, K.param(o, "psLamp", 0.25)), Math.min(g.headW - 0.06, g.headH * 0.45)),
            // 上=止まれ（赤）／下=進め（青）。灯の中心の高さ。
            topCz = g.headBottom + g.headH * 0.72,
            bottomCz = g.headBottom + g.headH * 0.27,
            parts = signalPoleParts(K, g),
            lens = (cz) => K.box(K.offsetPath(K.roundRectPath(lamp, lamp, Math.min(0.03, lamp * 0.16), 2), 0, cz), front - 0.022, front - 0.008, { axis: "y" });
        parts.push(K.roundedBox(g.headW, g.headD, g.headH, Math.min(g.headW * 0.18, 0.05), { seg: 2, cornerSeg: 2, z0: g.headBottom }));
        parts.push(lens(topCz), lens(bottomCz));
        // 絵：上は「止まれ」の立ち姿、下は「進め」の歩く姿
        parts.push(...signalWalkerParts(K, 0, topCz, lamp, front - 0.045, false));
        parts.push(...signalWalkerParts(K, 0, bottomCz, lamp, front - 0.045, true));
        return parts;
    },
);

// --- 3) 丸標識（地下鉄の丸い看板）---
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
        snRing: 0.72, // 内側の輪の半径（板の半径に対する割合）
        snBand: true, // 横に通る帯を出す
    },
    (o, K) => {
        const g = signalGeometry(o),
            R = Math.min(g.headW, g.headH) / 2,
            t = Math.max(0.02, g.headD),
            y0 = -t / 2,
            front = -t / 2,
            ring = Math.min(0.95, Math.max(0.3, K.param(o, "snRing", 0.72))),
            parts = signalPoleParts(K, g);
        // 板（円盤）。奥行きは丸標識の薄い板なので、面ハンドルで厚みも変えられる。
        parts.push(...K.moveParts([K.cylinder(R, y0, y0 + t, { axis: "y", seg: 28, verts: 2 })], 0, 0, g.headCz));
        // 内側の輪：少しだけ前に出した薄い円盤（筒だと輪の線が描かれない）
        parts.push(...K.moveParts([K.cylinder(R * ring, front - 0.02, front - 0.006, { axis: "y", seg: 24 })], 0, 0, g.headCz));
        // 横に通る帯
        if (o.snBand !== false)
            parts.push(
                K.box(K.offsetPath(K.rectPath(R * 1.72, Math.max(0.03, R * 0.3)), 0, g.headCz), front - 0.03, front - 0.014, { axis: "y" }),
            );
        return parts;
    },
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
            parts = signalPoleParts(K, g);
        // 下地の板
        parts.push(K.box(K.offsetPath(plate, 0, g.headCz), front + 0.005, front + g.headD, { axis: "y" }));
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
        // 1) 天板：薄い板（輪郭はそのまま）
        K.box(foot, g.H - g.topT, g.H),
        // 2) 土台：床から天板の裏まで、内側へ引いた箱
        K.box(base, 0, g.H - g.topT),
    ];
}

// --- 普通（まっすぐ）---
ASSET_KIT.define(
    "counter",
    {
        label: "カウンター",
        glyph: "▭",
        w: 2.0,
        d: 0.6,
        h: 1.0,
        accent: "#c9a97a",
        ctTopT: 0.06, // 天板の厚さ
        ctArm: 0.55, // L字・コの字の腕の幅（普通は未使用）
        ctOverhang: 0.06, // 天板の張り出し（土台を内側へ引く量）
    },
    counterParts,
);

// --- L字 ---
ASSET_KIT.define(
    "counterL",
    {
        label: "L字カウンター",
        glyph: "└",
        w: 1.8,
        d: 1.8,
        h: 1.0,
        accent: "#c9a97a",
        ctTopT: 0.06,
        ctArm: 0.55,
        ctOverhang: 0.06,
    },
    counterParts,
);

// --- コの字 ---
ASSET_KIT.define(
    "counterU",
    {
        label: "コの字カウンター",
        glyph: "⊔",
        w: 2.2,
        d: 1.6,
        h: 1.0,
        accent: "#c9a97a",
        ctTopT: 0.06,
        ctArm: 0.55,
        ctOverhang: 0.06,
    },
    counterParts,
);
