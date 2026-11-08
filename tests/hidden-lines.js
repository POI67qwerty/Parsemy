/* 棚の全アセットを同一視点で調べる粗い診断。
   over は9近傍の深度が全て線より手前（許容は6cmまたは深度の2%）なのに
   同じ画素に線があるサンプル。miss は面より手前の線が欠けたサンプル。
   画素の交差や補間の誤判定を含むため、結果は要調査であり正解画像ではない。
   使い方: tests/run.sh tests/hidden-lines.js [アセット名] */

const { open, ADD_FN, URL } = require("./lib");

// ページ側へ入れる計測コード。1本ずつ描いて attribution する版（重いが確実）。
const PROBE = `window.__hlInstall = () => {
    if (window.__hlReady) return;
    window.__hlReady = true;
    const orig = strokeWVisible;
    window.__hlIdx = new Map();
    window.__hlOnly = null;
    strokeWVisible = function (c, s) {
        if (window.__hlOnly !== null && window.__hlIdx.get(s) !== window.__hlOnly) return;
        return orig.apply(this, arguments);
    };
};
window.__hlSamples = (s) => {
    const out = [];
    for (let i = 1; i < s.p.length; i++) {
        const a = s.p[i - 1], b = s.p[i];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const n = Math.max(1, Math.min(60, Math.ceil(L / 0.12)));
        for (let k = 0; k < n; k++) {
            const t = k / n;
            out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
        }
    }
    out.push(s.p[s.p.length - 1]);
    return out;
};
// 線を1本ずつ描いて、隠れているのに出ている点／見えているのに消えている点を数える。
window.__hlScan = (tol) => {
    window.__noLineCache = true;
    window.__noDepthCache = true;
    window.__noDirtyDepth = true;
    // 1本ずつ描くので、線のキャッシュだけでなく線の描画も毎回やり直す。
    render();
    const cw = W, ch = H, tfl = [Z, 0, 0, Z, viewShift()[0], viewShift()[1]];
    const x = LC.getContext("2d");
    const over = [], miss = [];
    S.forEach((s, si) => {
        if (!s.ob || !objectVisible(s.ob) || !s.d3) return;
        // ベベルの縦線は「角ごとに輪郭の1本」だけを描く仕様（engine-render.js の
        // updateSeamPicks）。選ばれなかった相方は意図的に描かない線なので、
        // 隠れ線の判定から外す（外さないと「見えているのに描かれていない」と誤判定する）。
        if (s.seam !== undefined && s.seam !== null && !(seamPicks && seamPicks.has(s))) return;
        window.__hlIdx.set(s, si);
        window.__hlOnly = si;
        render();
        const img = x.getImageData(0, 0, cw, ch).data;
        let ov = 0, ms = 0, visN = 0, worst = 0, at = null;
        for (const p3 of window.__hlSamples(s)) {
            const p = projPoint(p3, tfl);
            if (!p || !p.ok) continue;
            const px = Math.round(p.x), py = Math.round(p.y);
            if (px < 2 || py < 2 || px >= cw - 2 || py >= ch - 2) continue;
            const z0 = depthBuffer[py * cw + px];
            if (!Number.isFinite(z0) || z0 > 1e6) continue;
            // 奥行きの許容は「6cm か、奥行きの2%」の大きいほう。
            // 稜線の画素では、手前の面（張り出した帯の上面など）が画素の半分だけ
            // 覆うことがあり、その差を「隠れている」と数えると正しい線まで
            // 誤検出になる（実測：帯の下端で 0.14 程度）。
            const otol = Math.max(tol, Math.abs(p.depth) * 0.02);
            let surround = 0, behind = 0;
            for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                    const z = depthBuffer[(py + dy) * cw + (px + dx)];
                    if (Number.isFinite(z) && z < 1e6) {
                        surround++;
                        if (z < p.depth - otol) behind++;
                    }
                }
            const painted = img[(py * cw + px) * 4 + 3] > 120;
            const gap = p.depth - z0;
            if (surround === 9 && behind === 9) {
                if (painted) {
                    ov++;
                    if (gap > worst) {
                        worst = gap;
                        at = p3.map((v) => +v.toFixed(2));
                    }
                }
            } else if (gap < -0.02) {
                visN++;
                if (!painted) ms++;
            }
        }
        window.__hlOnly = null;
        if (ov) over.push({ si, ov, worst: +worst.toFixed(2), at });
        if (visN >= 8 && ms / visN > 0.5) miss.push({ si, ms, visN });
        else if (ms >= 8) miss.push({ si, ms, visN });
    });
    return { over, miss, lines: S.length };
};`;

module.exports = { PROBE };

if (require.main === module) (async () => {
    const only = process.argv[2] || null;
    const { browser, page, errors } = await open({ width: 1200, height: 800 });
    await page.evaluate(ADD_FN);
    const kinds = await page.evaluate(() =>
        [...new Set([...document.querySelectorAll("[data-asset]")].map((e) => e.dataset.asset))].sort(),
    );
    await page.close();
    const list = only ? kinds.filter((k) => k === only) : kinds;
    if (!list.length) { console.error("対象アセットなし:", only); await browser.close(); process.exitCode = 1; return; }
    const rows = [];
    let bad = 0;
    // アセットごとにページを作り直す。前のアセットのカメラ・キャッシュ・選択状態を
    // 持ち越すと、同じアセットでも数値が変わって基準にできない（実測で確認）。
    for (const kind of list) {
        const p2 = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        const errs = [];
        p2.on("pageerror", (e) => errs.push(String(e)));
        await p2.goto(URL);
        await p2.waitForTimeout(500);
        await p2.evaluate(ADD_FN);
        await p2.evaluate(PROBE);
        const r = await p2.evaluate((k) => {
            window.__hlInstall();
            S.length = 0;
            sel = null;
            clearSelection();
            window.__add(k, 1);
            const objs = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()];
            // 地面に置いた状態（原点・回転なし）でそろえる。
            objs.forEach((o) => setOb(o.id, { ca: 0, cb: 0, lift: 0, rot: 0 }));
            regenObjects();
            sel = null;
            P.surfaceMode = true;
            window.cityStandardView("home");
            const res = window.__hlScan(0.06);
            return {
                over: res.over.reduce((a, b) => a + b.ov, 0),
                worst: res.over.reduce((a, b) => Math.max(a, b.worst), 0),
                miss: res.miss.reduce((a, b) => a + b.ms, 0),
                lines: res.lines,
                overLines: res.over.length,
            };
        }, kind);
        const nerr = errs.length;
        await p2.close();
        const limit = 0;
        const ok = r.over === 0 && r.miss === 0 && nerr === 0;
        if (!ok) bad++;
        rows.push({ kind, ...r, limit, ok, errs: nerr });
    }
    const w = (s, n) => String(s).padEnd(n);
    console.log(w("アセット", 26) + w("線", 6) + w("隠れ線", 8) + w("最大差", 8) + w("消え", 6) + "目標");
    rows.forEach((r) =>
        console.log(
            (r.ok ? "  " : "✗ ") + w(r.kind, 24) + w(r.lines, 6) + w(r.over, 8) + w(r.worst.toFixed(2), 8) + w(r.miss, 6) + r.limit,
        ),
    );
    const totalOver = rows.reduce((a, b) => a + b.over, 0);
    console.log(`対象 ${rows.length} 種／隠れているのに出た点 合計 ${totalOver}／基準超え ${bad} 種`);
    if (errors.length || rows.some(r => r.errs)) console.log("ページエラー:", errors, rows.filter(r => r.errs).map(r => [r.kind,r.errs]));
    if (bad || errors.length || rows.some(r => r.errs)) {
        console.log("=> 要調査（候補は誤検出の可能性あり）");
        process.exitCode = 1;
    } else console.log("=> OK（この条件で候補なし。正確性を保証するものではない）");
    await browser.close();
})();
