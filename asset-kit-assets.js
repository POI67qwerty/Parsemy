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

// ===== 自販機（前後辺だけを丸めた胴と穴あき前面）=====
// ・胴は前後方向に沿う4辺だけを丸める。
// ・前面の窓・小銭入れ・取り出し口は K.box(..., { axis:"y", holes:[...] })。
// ・看板の板は無地。
ASSET_KIT.define(
    "vendingMachine",
    {
        label: "自販機",
        glyph: "▯",
        w: 1.0,
        d: 0.75,
        h: 1.83,
        accent: "#d94a4a",
        geometryBounds: false,
        controls: [depthBevelControl("vmDepthBevel", 0.03)],
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
        // 【実寸（m）】前面板の位置と厚み。
        vmPanelProud: 0.015, // 前面の板を胴から出す量
        vmPanelThickness: 0.05,
    },
    (o, K) => {
        const W = Math.max(0.2, Math.abs(2 * o.ra)),
            D = Math.max(0.2, Math.abs(2 * o.rb)),
            H = Math.max(0.3, Math.abs(o.h)),
            // 割合の固有値を 0〜1 に収めてから幅・高さへ掛ける（枠を広げると中も広がる）。
            ratio = (key, dflt, lo, hi) => Math.max(lo, Math.min(hi, K.param(o, key, dflt))),
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

        // 1) 前後方向の稜線だけを丸める。旧丸胴値は使用しない。
        parts.push(K.depthBeveledBox(W, D, H, K.param(o, "vmDepthBevel", 0.03), {seg: 3}));
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
    if (!o || window.__legacySignalSmooth || !part?.path || part.path.length <= 4) return part;
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
function signalArmParts(o,K,g,headParts) {
    if(!g.suspended)return headParts;
    const moved=K.moveParts(headParts,g.headX,0,0).map(p=>p.signalSmoothSide?signalSmoothSides(p,o,K):p),
        arm=K.box(K.rectPath(g.headX+g.poleR*2,g.armThickness,g.headX/2,0),g.H-g.armThickness,g.H);
    return [arm,...moved];
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
        controls: [depthBevelControl("spDepthBevel", 0.05, true),signalArmControl()],
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
            pole = signalPoleParts(K, g, o), parts = [];
        // 灯器：角を丸めた横長の箱
        parts.push(signalSmoothSides(K.depthBeveledBox(g.headW, g.headD, g.headH, K.param(o, "spDepthBevel", 0.05), {seg: 3, z0: g.headBottom}), o, K));
        // 灯（青・黄・赤）と、灯のまわりのひさし
        [-1, 0, 1].forEach((i) => {
            const x = i * g.headW * 0.3;
            parts.push(...K.moveParts([K.cylinder(lampR, front - 0.024, front - 0.008, { axis: "y", seg: 20 })], x, 0, g.headCz));
            // ひさし（フード）：灯のまわりの筒を手前へ張り出す（依頼50で輪の板に変えたが、
            // 見た目が意図と違うため元の筒へ戻した）。
            if (hood > 0.01)
                parts.push(
                    ...K.moveParts([K.cylinder(lampR * 1.26, front - 0.012 - hood, front + 0.004, { axis: "y", caps: false, seg: 22 })], x, 0, g.headCz),
                );
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
        controls: [depthBevelControl("spDepthBevel", 0.05, true),signalArmControl()],
        spHeadH: 0.66,
        spPoleR: 0.038,
        spBaseR: 0.15,
        spBaseH: 0.15,
        psLamp: 0.25, // 灯（四角）の一辺
        psHood: 0.06, // ひさし（四角い枠）の張り出し
    },
    (o, K) => {
        const g = signalGeometry(o),
            front = -g.headD / 2,
            lamp = Math.min(Math.max(0.1, K.param(o, "psLamp", 0.25)), Math.min(g.headW - 0.06, g.headH * 0.45)),
            // 上=止まれ（赤）／下=進め（青）。灯の中心の高さ。
            topCz = g.headBottom + g.headH * 0.72,
            bottomCz = g.headBottom + g.headH * 0.27,
            pole = signalPoleParts(K, g, o), parts = [],
            lens = (cz) => signalSmoothSides(K.box(K.offsetPath(K.roundRectPath(lamp, lamp, Math.min(0.03, lamp * 0.16), 2), 0, cz), front - 0.022, front - 0.008, { axis: "y" }), o, K);
        parts.push(signalSmoothSides(K.depthBeveledBox(g.headW, g.headD, g.headH, K.param(o, "spDepthBevel", 0.05), {seg: 3, z0: g.headBottom}), o, K));
        parts.push(lens(topCz), lens(bottomCz));
        // ひさし（四角い枠）：灯のまわりの帯を手前へ張り出す。
        // 車両用と同じく「外側の枠＋内側の穴」にして、線画でも枠として見えるようにする。
        const hood = Math.max(0, K.param(o, "psHood", 0.06));
        if (hood > 0.01)
            [topCz, bottomCz].forEach((cz) =>
                parts.push(
                    signalSmoothSides(K.box(
                        K.offsetPath(K.roundRectPath(lamp * 1.2, lamp * 1.2, Math.min(0.03, lamp * 0.16), 2), 0, cz),
                        front - 0.01 - hood,
                        front + 0.004,
                        {
                            axis: "y",
                            holes: [K.offsetPath(K.roundRectPath(lamp * 1.02, lamp * 1.02, Math.min(0.02, lamp * 0.1), 2), 0, cz)],
                            holeSides: true,
                        },
                    ), o, K),
                ),
            );
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
 // 舗道は動かさず、縁石をタイルの外側4辺へ配置する。
 const curbWidth=o=>val(o,'pavementCurbWidth',.18,.02,2),
       curbHeight=o=>val(o,'pavementCurbHeight',.06,.005,1),
       curbBevel=o=>val(o,'pavementCurbBevel',.04,0,curbWidth(o));
 function pavementCurbRing(w,d,cw,b,z0,z1,tileTop) {
  // 外側はベベル直方体の断面・輪郭候補と同じ。内側は元のタイルの長方形。
  const outer=beveledBoxFootprint(w+2*cw,d+2*cw,b,4),n=b>1e-6?5:1,
   corners=beveledBoxFootprint(w,d,0,4),inner=corners.flatMap(p=>Array.from({length:n},()=>p)),
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
  outer.forEach((p,i)=>add([point(p,z0),point(p,z1)],beveledEdgeMark(i,b,4,'pavementCurb')));
  // 内側の境界は元のタイルの外周に接する。タイル上面より上の線だけを追加。
  add(loop(corners,z1));corners.forEach(p=>add([point(p,tileTop),point(p,z1)]));
  return {meshTriangles:triangles,meshEdges:edges,seamMarks:marks,onFace:true,preciseTubeEdge:true};
 }
 ASSET_KIT.define('streetPavement',{...common,label:'タイル舗道',glyph:'▦',group:'traffic',w:2.4,d:1.2,h:.12,accent:'#a3aaa7',minHeight:()=>.02,
  constrainEdit:(next,old,patch)=>{const q={...next},has=k=>Object.prototype.hasOwnProperty.call(patch,k);
   if(has('pavementCurbWidth'))q.pavementCurbWidth=clamp(Number(q.pavementCurbWidth)||.02,Math.max(.02,curbBevel(old)),2);
   if(has('pavementCurbHeight'))q.pavementCurbHeight=clamp(Number(q.pavementCurbHeight)||.005,.005,1);
   if(has('pavementCurbBevel'))q.pavementCurbBevel=clamp(Number(q.pavementCurbBevel)||0,0,curbWidth(q));
   return q;},controls:[
   {key:'pavementTileSize',label:'タイル間隔',default:.3,min:.08,max:2,step:.05,unit:'m',handle:(o,v)=>({anchor:[-o.ra,-o.rb,o.h+.001],sample:[-o.ra+v,-o.rb,o.h+.001],probe:[-o.ra+v+1,-o.rb,o.h+.001],fallback:{x:1,y:0}})},
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
    cw=enabled?curbWidth(o):0,ch=enabled?curbHeight(o):0,b=enabled?curbBevel(o):0,edges=[],curbEdges=[],
    dx=Math.max(step,w/32),dy=Math.max(step,d/32),z=h+.001,front=-d/2,back=d/2,left=-w/2,right=w/2;
  // タイル面はOFFのときと同じ。縁石の目地もタイル列に揃える。
  for(let i=1;i*dx<w-1e-8;i++){const x=left+i*dx;edges.push([[x,front,z],[x,back,z]]);
   if(enabled)for(const sy of [-1,1]){const inner=sy*d/2,outer=sy*(d/2+cw);
    curbEdges.push([[x,outer+sy*.001,0],[x,outer+sy*.001,h+ch+.001],[x,inner,h+ch+.001],[x,inner,h]]);}}
  for(let i=1;i*dy<d-1e-8;i++){const y=front+i*dy;edges.push([[left,y,z],[right,y,z]]);
   if(enabled)for(const sx of [-1,1]){const inner=sx*w/2,outer=sx*(w/2+cw);
    curbEdges.push([[outer+sx*.001,y,0],[outer+sx*.001,y,h+ch+.001],[inner,y,h+ch+.001],[inner,y,h]]);}}
  const parts=[K.box(K.rectPath(w,d),0,h,enabled?{preciseTubeEdge:true,onFace:true}:{}),{meshTriangles:[],meshEdges:edges,onFace:true,...(enabled?{preciseTubeEdge:true}:{})}];
  if(enabled){parts.push(pavementCurbRing(w,d,cw,b,0,h+ch,h));
   parts.push({meshTriangles:[],meshEdges:curbEdges,onFace:true,preciseTubeEdge:true});}
  return parts;});
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
 K.depthBeveledBox(w,d,bh,Math.min(.025,w*.05,bh*.05),{z0:p,seg:2}),
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
   handle:(o,v)=>({anchor:[0,0,chairBase(o)],sample:[v,0,chairBase(o)],probe:[v+1,0,chairBase(o)],fallback:{x:1,y:0}})}
 ]},(o,K)=>{const {w,d,h}=S(o),seat=chairSeat(o),bh=chairBase(o),br=chairBaseRadius(o),r=chairPoleRadius(o);return [K.box(K.rectPath(w,d),h-seat,h,flags),streetRoundPart(o,K,[[r,r,bh],[r,r,h-seat]]),streetRoundPart(o,K,[[br,br,0],[br,br,bh]])];});
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
   {key:'roofWaveCount',label:'蛇腹（波）の数',type:'range',default:8,min:1,max:24,step:1,integer:true,unit:'山'},
   {key:'roofSheetThickness',label:'板の厚さ',default:.01,min:.003,max:o=>Math.max(.003,Math.min(.08,o.h*.45)),step:.005,unit:'m',
    handle:(o,x)=>({anchor:[-o.ra,-o.rb,0],sample:[-o.ra,-o.rb,x],probe:[-o.ra,-o.rb,x+1],fallback:{x:0,y:-1}})}
  ]},(o,K)=>{
   const w=Math.max(.1,2*Math.abs(o.ra)),d=Math.max(.1,2*Math.abs(o.rb)),h=Math.max(.02,o.h),
    n=K.count(o.roofWaveCount,8,1,24),t=v(o,'roofSheetThickness',.01,.003,Math.min(.08,h*.45)),steps=n*4,top=[];
   for(let i=0;i<=steps;i++){const x=-w/2+w*i/steps,z=t+(h-t)*(1-Math.cos(i*Math.PI/2))/2;top.push([x,z]);}
   const bottom=top.map(([x,z])=>[x,z-t]).reverse();
   return [K.box([...top,...bottom],-d/2,d/2,{axis:'y',...flag})];
  });
 // 4面ひさし部品をそのまま使い、前方の円形レンズと壁取り付け脚を組む。
 const stem=o=>v(o,'cameraStemHeight',.12,.04,2);
 ASSET_KIT.define('securityCamera',{label:'監視カメラ',glyph:'◉',group:'street',w:.34,d:.55,h:.50,accent:'#a3aba8',
  minHalfWidth:()=>.07,minHalfDepth:()=>.1,minHeight:o=>stem(o)+.22,controls:[
   {key:'cameraStemHeight',label:'支柱の長さ',default:.12,min:.04,max:2,step:.01,unit:'m',
    patch:(o,x)=>({cameraStemHeight:x,h:o.h+x-stem(o)}),
    handle:(o,x)=>({anchor:[0,0,.10],sample:[0,0,.10+x],probe:[0,0,1.10+x],fallback:{x:0,y:-1}})}
  ]},(o,K)=>{
   const w=Math.max(.14,Math.abs(o.ra)*2),d=Math.max(.2,Math.abs(o.rb)*2),h=Math.max(stem(o)+.22,o.h),
    base=.10+stem(o),hh=h-base,front=-d*.32,back=d*.45,headD=back-front,headY=(front+back)/2,
    lensR=Math.min(w*.27,hh*.30),hoodW=w,hoodH=hh*.92,hoodBase=base+hh*.04,
    frame=Math.max(.005,Math.min(.035,d*.08)),brim=Math.max(.01,d*.26),hoodY=front+frame/2-brim/2,
    t=Math.max(.005,Math.min(w,hh)*.055),b=Math.min(w,hh)*.12;
   const parts=[
    K.box(K.rectPath(w*.68,.025,0,d*.48),0,Math.max(.16,base*.78),flag),
    K.box(K.rectPath(w*.58,d*.46,0,d*.20),.07,.095,flag),
    K.cylinder(Math.min(w*.13,.045),.095,base,{seg:12,verts:4,...flag}),
    K.box(K.rectPath(w*.80,headD,0,headY),base,h-hh*.06,flag),
    ...K.moveParts(K.part('screenHood',{w:hoodW,h:hoodH,frameDepth:frame,brimLength:brim,knee:hoodH*.55,t,bevel:b}),0,hoodY,hoodBase),
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
 ASSET_KIT.define('trainStraps',{label:'つり革',glyph:'♧',group:'train',w:1.5,d:.12,h:.45,accent:'#bfc3c6',minHalfWidth:()=>.10,minHalfDepth:()=>.025,minHeight:()=>.20,controls:[
  {key:'trainStrapCount',label:'つり革の数',type:'range',canvasSlider:true,default:4,min:1,max:12,step:1,integer:true,unit:'個'},horizontalPoleLength
 ]},(o,K)=>{const w=Math.max(.2,2*Math.abs(o.ra)),d=Math.max(.05,2*Math.abs(o.rb)),h=Math.max(.2,o.h),n=K.count(o.trainStrapCount,4,1,12),r=Math.min(.016,d*.22,h*.05),out=[cylinder(K,r,-w/2,w/2,{axis:'x',cx:0,cy:h-r})];
  const cell=w/n,rw=Math.min(.16,cell*.72,h*.36),rh=Math.min(.19,h*.42),t=Math.min(.018,rw*.14,rh*.14);
  for(let i=0;i<n;i++){const x=-w/2+(i+.5)*cell,top=h-r*2;out.push(box(K,Math.max(.01,rw*.20),Math.min(d*.42,.025),x,0,rh,top));out.push(ring(K,rw,rh,x,rh/2,-Math.min(d*.4,.016),Math.min(d*.4,.016),t));}return out;
 });
 const poleLength={key:'trainPoleLength',label:'ポールの長さ',min:.2,max:5,step:.05,unit:'m',get:o=>o.h,patch:(o,v)=>({h:v}),
  handle:(o,v)=>({anchor:[.22,0,0],sample:[.22,0,v],probe:[.22,0,v+1],fallback:{x:0,y:-1}})};
 ASSET_KIT.define('trainPole',{label:'車内の縦ポール',glyph:'│',group:'train',w:.08,d:.08,h:2.2,accent:'#bfc3c6',minHalfWidth:()=>.012,minHalfDepth:()=>.012,minHeight:()=>.2,controls:[poleLength]},(o,K)=>{
  const w=Math.max(.024,Math.abs(o.ra)*2),d=Math.max(.024,Math.abs(o.rb)*2),h=Math.max(.2,o.h),r=Math.min(w,d)*.36;return [cylinder(K,r,0,h),cylinder(K,Math.min(w,d)*.5,0,Math.min(.04,h*.1)),cylinder(K,Math.min(w,d)*.5,h-Math.min(.04,h*.1),h)];});
 ASSET_KIT.define('trainHandrail',{label:'車内の横手すり',glyph:'┰',group:'train',w:1.8,d:.18,h:.12,accent:'#bfc3c6',minHalfWidth:()=>.10,minHalfDepth:()=>.025,minHeight:()=>.04,controls:[horizontalPoleLength]},(o,K)=>{
  const w=Math.max(.2,2*Math.abs(o.ra)),d=Math.max(.05,2*Math.abs(o.rb)),h=Math.max(.04,o.h),r=Math.min(.022,d*.16,h*.20),out=[cylinder(K,r,-w/2,w/2,{axis:'x',cx:-d*.25,cy:h*.5})];
  for(const x of [-w*.42,w*.42]){const rail=cylinder(K,r,-d*.25,d*.48,{axis:'y',cx:x,cy:h*.5});out.push(rail,box(K,r*4,Math.min(.02,d*.12),x,d*.46,h*.5-r*2,h*.5+r*2));}return out;
 });
 ASSET_KIT.define('trainWindowWall',{label:'窓付き車内壁',glyph:'▣',group:'train',w:2,d:.12,h:2.35,accent:'#9babae',minHalfWidth:()=>.25,minHalfDepth:()=>.025,minHeight:()=>.6,controls:[
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
