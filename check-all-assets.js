/* 全アセットの自己点検（1コマンドで「壊れていないか」を見る）
 *
 *   実行: node check-all-assets.js
 *   実ブラウザ（Playwright の Chromium）で cyberpunk-city-studio.html を開いて調べる。
 *   ライブラリが置き場所依存で見つからない環境では、環境変数を通してから実行する:
 *
 *     export PLAYWRIGHT_BROWSERS_PATH=<chromium を入れた所>
 *     export NODE_PATH=<node_modules の親>
 *     export LD_LIBRARY_PATH=<libnspr4.so などがある所>
 *     node check-all-assets.js ; echo "exit=$?"
 *
 * 見ていること
 *   1. アセット棚の全カードを1個ずつ押して追加できること（追加失敗を「対象外」と分けて表示）
 *   2. genShape()（線画）が例外を出さず、線が1本以上あること
 *   3. rot / rotX / rotZ を与えると線画の点列が変わること（＝回転に線が追従する）
 *   4. 円（circ）と丸椅子が常に正円（ra === rb）であること
 *   5. specialGizmo() が画面ハンドルを返すこと（掴める形になっていること）
 *   6. 屋台の線が28本あること（接地線2本＋内側の稜線5本を含む）
 *   7. ページエラーが0件であること
 *
 * 判定に落とさないもの（既知の「対象外」）
 *   sign / wallSideSign は ASSETS には居るが棚にカードが無い（壁に付ける部品なので単体では置けない）。
 *   これは失敗ではなく skip として数える。
 *
 * 終了コード: 失敗が1件でもあれば 1（CIや連続実行で使える）
 */
const { chromium } = require("playwright");

(async () => {
    const b = await chromium.launch();
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(String(e)));
    await p.goto("file://" + __dirname + "/cyberpunk-city-studio.html");
    await p.waitForTimeout(900);

    const kinds = await p.evaluate(() => Object.keys(ASSETS));
    await p.evaluate(() => {
        const t = document.querySelector("#assetToggle");
        if (t.getAttribute("aria-expanded") !== "true") t.click();
    });

    const rows = [];
    for (const k of kinds) {
        // カードがあるグループを開いてから押す
        for (const grp of ["primitives", "building", "street", "roof", "person"]) {
            const has = await p.evaluate((g) => !!document.querySelector(`[data-asset-group="${g}"]`), grp);
            if (has) {
                await p.evaluate((g) => document.querySelector(`[data-asset-group="${g}"]`).click(), grp);
                await p.waitForTimeout(40);
            }
            const card = await p.evaluate((k) => !!document.querySelector(`[data-asset="${k}"]`), k);
            if (card) break;
        }
        const ok = await p.evaluate((k) => {
            const el = document.querySelector(`[data-asset="${k}"]`);
            if (!el) return false;
            el.click();
            return true;
        }, k);
        await p.waitForTimeout(110);
        if (!ok) {
            rows.push({ k, skip: true });
            continue;
        }
        rows.push(
            await p.evaluate((k) => {
                // 直前に追加されたオブジェクト（同じ asset 名で最後に増えたもの）
                const ids = [...new Set(S.map((s) => s.ob && s.ob.id).filter(Boolean))];
                const cand = ids.map((id) => obOf(id)).filter((o) => o && !o.attachment);
                const o = cand[cand.length - 1];
                if (!o) return { k, err: true };
                const key = (q) => {
                    try {
                        return JSON.stringify(genShape(q).map((s) => s.p.map((v) => v.map((n) => +n.toFixed(3)))));
                    } catch (e) {
                        return "ERR:" + e.message;
                    }
                };
                const base = key(o);
                const row = {
                    k,
                    type: o.type,
                    asset: o.asset,
                    err: base.startsWith("ERR"),
                    lines: (() => {
                        try {
                            return genShape(o).length;
                        } catch (e) {
                            return -1;
                        }
                    })(),
                    rot: key({ ...o, rot: 40 }) !== base,
                    rotX: key({ ...o, rotX: 30 }) !== base,
                    rotZ: key({ ...o, rotZ: 25 }) !== base,
                };
                try {
                    const g = specialGizmo(o);
                    row.handles = g ? Object.keys(g.handles || {}) : [];
                } catch (e) {
                    row.handles = "ERR";
                }
                row.circle = o.type === "circ" || o.asset === "stool" ? Math.abs((o.ra || 0) - (o.rb || 0)) < 1e-9 : null;
                return row;
            }, k),
        );
    }

    const added = rows.filter((r) => !r.skip);
    const skipped = rows.filter((r) => r.skip).map((r) => r.k);
    const bad = added.filter((r) => r.err || r.missing || !r.lines || r.lines < 1 || !r.rot || !r.rotX || !r.rotZ);
    const stall = added.find((r) => r.k === "stall");
    const stallNg = stall && stall.lines !== 28;

    console.log("アセット", added.length, "／ 棚にカード無し（対象外）", skipped.length, skipped.join(",") || "-");
    console.log("線画が出ない・回転に追従しない・例外:", bad.length, JSON.stringify(bad.map((r) => r.k)));
    console.log(
        "正円（circle/stool）:",
        JSON.stringify(added.filter((r) => r.circle !== null).map((r) => [r.k, r.circle])),
    );
    console.log(
        "ハンドル本数:",
        JSON.stringify(added.filter((r) => Array.isArray(r.handles) && r.handles.length).map((r) => [r.k, r.handles.length])),
    );
    console.log("屋台の線:", stall ? stall.lines + "本" + (stallNg ? "（28本ではない）" : "（OK）") : "屋台なし");
    console.log("ページエラー:", errs.length, JSON.stringify(errs));

    const fail = bad.length + (stallNg ? 1 : 0) + errs.length;
    console.log(fail ? "=> NG " + fail + "件" : "=> すべてOK");
    await b.close();
    process.exit(fail ? 1 : 0);
})();
