/* 面ONのとき、線が不自然に途切れていないことを確かめる（画素の数え上げ）。
   - frag  : 8連結成分の小さな破片（60px 未満）の数。面ONの線画で「点線状の切れ端」が出ると増える。
   - 面ONの線の量が面OFFを超えないこと（隠すべき線が出ていないこと）。
   使い方: tests/run.sh tests/pixel-lines-continuous.js  */
const { open, ADD_FN } = require("./lib");

const SETUPS = [
    ["正面寄り", -25, 14, 1.6, 3, 26],
    ["見下ろし", -25, 14, 3.2, 10, 26],
    ["真横", 0, 16, 1.6, 2, 26],
    ["斜め", 25, 12, 1.6, 4, 24],
    ["逆側", 50, 14, 2.0, 6, 28],
    ["反対斜め", -50, 10, 1.5, 0, 22],
    ["近接", 20, 9, 1.7, 5, 20],
    ["俯瞰", -12, 20, 2.4, 8, 30],
];

(async () => {
    const { browser, page, errors } = await open({ width: 1000, height: 700 });
    await page.evaluate(ADD_FN);
    await page.evaluate(() => {
        const add = window.__add;
        S.length = 0;
        add("beveledStackedBuilding", 1); add("building", 1); add("stall", 1); add("wallSign", 1);
        const objs = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()];
        objs.forEach((o, i) => { o.ca = -4 + i * 3; o.cb = 0; });
        sel = null; tool = "view"; mode = "draw";
    });
    const r = await page.evaluate((SETUPS) => {
        const dark = (d, i) => d[i] + d[i + 1] * 256 + d[i + 2] * 65536 < 0x505050;
        const comps = (img) => {
            const w = img.width, h = img.height, d = img.data,
                seen = new Uint8Array(w * h), st = [], sizes = [];
            for (let i = 0; i < w * h; i++) {
                const x = i % w, y = (i / w) | 0;
                if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
                if (seen[i] || !dark(d, i * 4)) continue;
                let size = 0;
                st.push(i); seen[i] = 1;
                while (st.length) {
                    const j = st.pop(); size++;
                    const jx = j % w, jy = (j / w) | 0;
                    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                        if (!dx && !dy) continue;
                        const nx = jx + dx, ny = jy + dy;
                        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                        const k = ny * w + nx;
                        if (seen[k] || !dark(d, k * 4)) continue;
                        seen[k] = 1; st.push(k);
                    }
                }
                if (size >= 6) sizes.push(size);
            }
            return sizes;
        };
        const ink = (img) => { let n = 0; for (let i = 0; i < img.data.length; i += 4) if (dark(img.data, i)) n++; return n; };
        const res = [];
        for (const [name, yaw, back, ch, pitch, lens] of SETUPS) {
            const th = (yaw * Math.PI) / 180;
            setP("cx", Math.sin(th) * back); setP("cz", -Math.cos(th) * back); setP("ch", ch);
            setP("yaw", yaw); setP("pitch", pitch); P.lens = lens; Z = 1.4; ox = 0; oy = 0;
            P.surfaceMode = false; render();
            const off = ctx.getImageData(0, 0, innerWidth, innerHeight);
            P.surfaceMode = true; render();
            const on = ctx.getImageData(0, 0, innerWidth, innerHeight);
            const sizes = comps(on);
            res.push({ name, frag: sizes.filter((s) => s < 60).length, inkOn: ink(on), inkOff: ink(off) });
        }
        P.surfaceMode = true;
        return res;
    }, SETUPS);
    const frag = r.reduce((a, b) => a + b.frag, 0);
    const over = r.filter((x) => x.inkOn > x.inkOff);
    console.log(r.map((x) => x.name + ":frag=" + x.frag + ",ink=" + x.inkOn + "/" + x.inkOff).join("  "));
    console.log("frag計=" + frag + (over.length ? " 面ONが面OFFより多い場面=" + over.length : " 面ONが面OFFを超えた場面なし") + " エラー=" + JSON.stringify(errors));
    const ok = frag <= 60 && over.length === 0 && errors.length === 0;
    console.log(ok ? "=> OK（小さな破片は 60 個以下・隠す線は出ていない）" : "=> 要確認");
    await browser.close();
    process.exit(ok ? 0 : 1);
})();
