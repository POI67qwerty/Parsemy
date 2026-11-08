/* 正面・横・上（正投影）のビューが、3Dと同じシーンを正しく描けているかを画素で確かめる。
   これまで実際に起きていた不具合を、そのまま検査項目にしている。
     1. 向きを取り違えない   … 正面→横→上で同じ絵が返らない（キャッシュのキー漏れ）
     2. 拡大・移動で消えない … 拡大率・移動を変えても線が1本も消えない（奥行きバッファの変換ずれ）
     3. 画面からはみ出さない … どの向きでもシーン全体が画面に入る（表示中心の自動フィット）
     4. 同じ状態なら同じ絵   … 同じビューへ戻すと画素が完全に一致する
     5. 隠線が増えていない   … 面ONの線の量が面OFFを超えない
   使い方: tests/run.sh tests/pixel-ortho-views.js  */

const { open, ADD_FN } = require("./lib");

(async () => {
    const { browser, page, errors } = await open({ width: 1000, height: 700 });
    await page.evaluate(ADD_FN);
    const r = await page.evaluate(() => {
        const add = window.__add;
        S.length = 0;
        add("railing", 1);
        add("beveledStackedBuilding", 1);
        add("stall", 1);
        add("stool", 1);
        sel = null;
        tool = "view";
        mode = "draw";
        // 線の層（オブジェクトの線だけ）を読む。背景の床グリッドは含めない。
        // 正面・横・上では床グリッドが真横から見えて1本の水平線になるため、
        // 画面全体を見ると「オブジェクトの位置」を判断できない。
        const layer = (hidden) => {
            window.__noLineCache = true;
            const c = lineLayer(true, false, W, H, null, hidden);
            return c.getContext("2d").getImageData(0, 0, W, H).data;
        };
        const dark = (d, i) => d[i] + d[i + 1] * 256 + d[i + 2] * 65536 < 0x606060 && d[i + 3] > 20;
        const stat = (d) => {
            let n = 0,
                x0 = 1e9,
                y0 = 1e9,
                x1 = -1e9,
                y1 = -1e9;
            for (let i = 0; i < d.length; i += 4) {
                if (!dark(d, i)) continue;
                n++;
                const px = (i / 4) % W,
                    py = Math.floor(i / 4 / W);
                if (px < x0) x0 = px;
                if (px > x1) x1 = px;
                if (py < y0) y0 = py;
                if (py > y1) y1 = py;
            }
            return { n, x0, y0, x1, y1 };
        };
        const diff = (A, B) => {
            let n = 0;
            for (let i = 0; i < A.length; i += 4) if (A[i + 3] > 20 || B[i + 3] > 20) if (A[i] !== B[i] || A[i + 3] !== B[i + 3]) n++;
            return n;
        };
        const res = { distinct: {}, zoom: {}, fit: {}, same: {}, hide: {} };
        const to = (v) => {
            cityStandardView(v);
            render();
        };
        const setZ = (z, dx, dy) => {
            Z = z;
            ox = dx;
            oy = dy;
        };
        // 1. 向きごとに絵が違う（＝キャッシュが向きを区別している）
        const imgs = {};
        for (const v of ["front", "side", "top"]) {
            to(v);
            setZ(1, 0, 0);
            const d = layer(false);
            res.distinct[v] = stat(d);
            imgs[v] = d;
        }
        res.distinct.same_ft = diff(imgs.front, imgs.top);
        res.distinct.same_fs = diff(imgs.front, imgs.side);
        // 2. 拡大・移動しても線が消えない（拡大で画面外に出る分だけ減るのは正しい）
        for (const v of ["front", "side", "top"]) {
            to(v);
            setZ(1, 0, 0);
            const base = stat(layer(false)).n;
            const vals = [];
            for (const [z, dx, dy] of [
                [1.5, 0, 0],
                [1.5, -60, 30],
                [2.2, 40, -40],
            ]) {
                setZ(z, dx, dy);
                vals.push(Math.round((stat(layer(false)).n / Math.max(1, base)) * 100) / 100);
            }
            res.zoom[v] = vals;
        }
        // 3. 画面からはみ出さない（＝自動フィットが効いている）
        for (const v of ["front", "side", "top"]) {
            to(v);
            setZ(1, 0, 0);
            const q = stat(layer(false));
            res.fit[v] = {
                inside: q.n > 0 && q.x0 >= 2 && q.y0 >= 2 && q.x1 <= W - 3 && q.y1 <= H - 3,
                box: [q.x0, q.y0, q.x1, q.y1].map(Math.round),
            };
        }
        // 4. 行って戻ると同じ絵
        //    「ホーム」は3Dのカメラを寄せ直す（全体が入るように）ので、
        //    カメラ値を一時退避して戻す。ここで見たいのは「向きの切り替えで
        //    絵が混ざらないこと」であり、カメラの移動そのものではない。
        to("front");
        const A = layer(false),
            camKeep = { cx: P.cx, cz: P.cz, ch: P.ch, pitch: P.pitch, yaw: P.yaw, lens: P.lens };
        to("home");
        layer(false);
        Object.assign(P, camKeep);
        to("front");
        res.same.back = diff(A, layer(false));
        // 5. 面ONの線が面OFFを超えない
        for (const v of ["front", "side", "top"]) {
            to(v);
            setZ(1, 0, 0);
            const off = stat(layer(false)).n;
            const on = stat(layer(true)).n;
            res.hide[v] = [on, off];
        }
        return res;
    });
    const bad = [];
    for (const k of ["same_ft", "same_fs"]) if (r.distinct[k] === 0) bad.push(`${k} が同一（向きを取り違えている）`);
    for (const [v, n] of Object.entries(r.distinct)) {
        if (typeof n !== "number") continue;
        if (n < 200) bad.push(`${v} の線がほぼ出ていない (${n}px)`);
    }
    for (const [v, vals] of Object.entries(r.zoom))
        vals.forEach((q) => {
            if (q < 0.25) bad.push(`${v} は拡大・移動で線が消える (${q})`);
        });
    for (const [v, q] of Object.entries(r.fit)) if (!q.inside) bad.push(`${v} が画面からはみ出す ${JSON.stringify(q.box)}`);
    if (r.same.back !== 0) bad.push(`正面へ戻すと絵が違う (${r.same.back}px)`);
    // 面ONは「見えている区間」ごとに線を引くため、区間の端の丸めで数%増える。
    // 隠れるはずの線が出ていれば桁違いに増えるので、そこだけを見る。
    for (const [v, [on, off]] of Object.entries(r.hide))
        if (on > off * 1.25 + 200) bad.push(`${v} は面ONのほうが線が多い (${on} > ${off})`);
    console.log(JSON.stringify(r, null, 0));
    console.log(`エラー=${JSON.stringify(errors)}`);
    if (errors.length) bad.push("ページエラー");
    if (bad.length) {
        bad.forEach((b) => console.log("NG: " + b));
        console.log("=> 失敗");
        process.exitCode = 1;
    } else console.log("=> OK（正面・横・上で絵が対応し、拡大・移動・フィットも保たれている）");
    await browser.close();
})();
