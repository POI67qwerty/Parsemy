/* 線画のきまりを確かめる（再発防止）。
     1. 外形の線は描く        … ベベルの縦線は「見えている1本」を選び、実際に線が出る
                                 （過去の不具合：隠れている線が選ばれ、角の縦線が丸ごと消えた）
     2. 面の内側の線は描かない … 1枚の面の内側だけを通る線は省く
                                 （過去の不具合：庇板の内部の斜め線が残った）
   1 は「選び方」と「実際の画素」、2 は判定関数そのものを検査する。
   1 の本命は、その不具合が出た場面を抜き出した tests/fixtures/bevel-corner.json で見る。
   使い方: tests/run.sh tests/visible-edges.js  */

const { open, ADD_FN } = require("./lib");
const fs = require("fs");
const path = require("path");
// 不具合が出た場面（ユーザーの保存データ）から、関係する11オブジェクトだけを抜き出したもの。
// 角（seam）の選別と、隠れている線を選んでしまう角が、元の場面と同じになることを確認済み。
const SCENE = path.resolve(__dirname, "fixtures", "bevel-corner.json");

// ベベルの縦線（seam）を、角ごとに1本だけ選ぶ処理を検査する。
const CHECK_SEAM = `(() => {
    const tf = [1, 0, 0, 1, 0, 0], dep = buildExportDepth(W, H, tf);
    updateSeamPicks(dep, W, H, tf);
    const groups = new Map();
    for (const s of S) {
        if (s.seam === undefined || s.seam === null || !s.p || !s.ob) continue;
        const a = exportPoint(s.p[0], tf), b = exportPoint(s.p[s.p.length - 1], tf);
        if (!a || !b) continue;
        const sc = seamEdgeScore(a, b, dep, W, H), key = (s.ob.id || "") + ":" + s.seam;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ s, vis: sc.vis, edge: sc.edge, score: sc.edge * 0.6 + sc.vis * 0.4, a, b });
    }
    // 角ごとに「いちばん見えている線」が選ばれているか
    let groupsN = 0, hiddenPicked = 0, noPick = 0;
    const picked = [];
    groups.forEach((list) => {
        groupsN++;
        const best = list.reduce((m, q) => (q.score > m.score ? q : m), list[0]),
            chosen = list.find((q) => seamPicks && seamPicks.has(q.s)) || null;
        if (!chosen) noPick++;
        else {
            picked.push(chosen);
            if (chosen.vis < best.vis - 1e-9) hiddenPicked++;
        }
    });
    // 選んだ線が実際に画素として出ているか
    window.__noLineCache = true;
    const layer = lineLayer(true, false, W, H, null, false),
        d = layer.getContext("2d").getImageData(0, 0, W, H).data,
        ink = new Uint8Array(W * H);
    for (let i = 0, p = 0; i < d.length; i += 4, p++)
        // 線の層は「透明な地＋不透明な線」。色は線ごとに違うので、濃さでは絞らない。
        ink[p] = d[i + 3] > 20 ? 1 : 0;
    window.__noLineCache = false;
    const nearInk = (x, y, rad) => {
        for (let dy = -rad; dy <= rad; dy++)
            for (let dx = -rad; dx <= rad; dx++) {
                const xx = Math.round(x + dx), yy = Math.round(y + dy);
                if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
                if (ink[yy * W + xx]) return true;
            }
        return false;
    };
    let missing = 0;
    // 線が丸ごと消えていないか（一部だけ欠けるのは、手前の物に隠れる等で正常）。
    // 輪郭らしさ（edge）が弱い線は、面の内側と紙一重なので対象外にする。
    for (const q of picked) {
        if (q.edge < 0.6) continue;
        let hit = 0;
        for (const t of [0.15, 0.3, 0.5, 0.7, 0.85]) {
            const x = q.a.x + (q.b.x - q.a.x) * t, y = q.a.y + (q.b.y - q.a.y) * t;
            if (nearInk(x, y, 3)) hit++;
        }
        if (hit < 2) missing++;
    }
    return { groups: groupsN, picked: picked.length, noPick, hiddenPicked, missing };
})()`;

// 面の内側の判定を、組み立てた奥行きバッファで直接検査する。
const CHECK_INTERIOR = `(() => {
    const keepFace = depthFace, keepOwner = depthOwner, cw = 64, ch = 64,
        F = new Int32Array(cw * ch), O = new Int32Array(cw * ch);
    for (let y = 10; y < 60; y++)
        for (let x = 10; x < 60; x++) { F[y * cw + x] = 7; O[y * cw + x] = 3; }
    depthFace = F;
    depthOwner = O;
    const res = {
        inside: interiorOfFace(cw, ch, 30, 30, 2, 3),      // 面の真ん中
        atEdge: interiorOfFace(cw, ch, 11, 30, 2, 3),      // 面の縁
        otherOwner: interiorOfFace(cw, ch, 30, 30, 2, 9),  // 別のオブジェクト
        inHole: (() => {                                   // 面の中の別の面
            F[30 * cw + 30] = 8;
            const v = interiorOfFace(cw, ch, 30, 30, 2, 3);
            F[30 * cw + 30] = 7;
            return v;
        })(),
    };
    depthFace = keepFace;
    depthOwner = keepOwner;
    return res;
})()`;

(async () => {
    const { browser, page, errors } = await open({ width: 1200, height: 800 });
    await page.evaluate(ADD_FN);
    const res = {};
    // 1) 棚から置いたベベル付きの立体
    await page.evaluate(() => {
        S.length = 0;
        window.__add("beveledStackedBuilding", 1);
        window.__add("beveledBox", 1);
        window.__add("building", 1);
        sel = null;
        tool = "view";
        mode = "draw";
        P.surfaceMode = true;
        window.cityStandardView("home");
        render();
    });
    res.placed = await page.evaluate(CHECK_SEAM);
    res.interior = await page.evaluate(CHECK_INTERIOR);
    // 2) 実際に不具合が出た場面
    if (fs.existsSync(SCENE)) {
        const j = JSON.parse(fs.readFileSync(SCENE, "utf8"));
        await page.evaluate((d) => unpack(d), j);
        await page.evaluate(() => render());
        res.scene = await page.evaluate(CHECK_SEAM);
    } else res.scene = null;

    const bad = [];
    const seamChecks = (label, v) => {
        if (!v.groups) bad.push(`${label}: ベベルの角（seam 線）が1つも無い`);
        if (v.hiddenPicked) bad.push(`${label}: 隠れている線を選んでいる角 ${v.hiddenPicked} か所`);
        if (v.missing) bad.push(`${label}: 選んだのに線が出ていない角 ${v.missing} か所`);
    };
    seamChecks("棚の立体", res.placed);
    if (res.scene) {
        seamChecks("抜き出した場面", res.scene);
        if (!res.scene.picked) bad.push("抜き出した場面: 描く線が1本も選ばれていない");
    }
    if (res.interior.inside !== true) bad.push("面の内側を「内側」と判定できていない");
    if (res.interior.atEdge !== false) bad.push("面の縁を「内側」と誤判定している");
    if (res.interior.otherOwner !== false) bad.push("別のオブジェクトを「同じ面」と誤判定している");
    if (res.interior.inHole !== false) bad.push("面の中の別の面を「内側」と誤判定している");
    console.log(JSON.stringify(res, null, 1));
    if (!fs.existsSync(SCENE)) console.log("（fixtures/bevel-corner.json が無いので、その検査は省きました）");
    if (errors.length) bad.push("ページエラー: " + errors.join(" / "));
    console.log(bad.length ? "NG\n  " + bad.join("\n  ") : "OK");
    await browser.close();
    process.exit(bad.length ? 1 : 0);
})();
