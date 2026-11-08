/* 線の層のキャッシュ（同じ絵なら作り直さない）が、古い絵を返さないことを確かめる。
   キャッシュあり（通常）と無し（__noLineCache）で画素が一致すればよい。
   面ON／面OFF、二値化ON／OFF、移動・回転・寸法・選択・表示切替・カメラを一通り。
   使い方: tests/run.sh tests/pixel-line-cache.js  */
const { open, ADD_FN } = require("./lib");

(async () => {
    const { browser, page, errors } = await open();
    await page.evaluate(ADD_FN);
    const r = await page.evaluate(() => {
        const add = window.__add;
        const cnt = (X, Y) => {
            let n = 0,
                mx = 0;
            for (let i = 0; i < X.length; i += 4) {
                const d = Math.abs(X[i] - Y[i]) + Math.abs(X[i + 1] - Y[i + 1]) + Math.abs(X[i + 2] - Y[i + 2]);
                if (d) {
                    n++;
                    if (d > mx) mx = d;
                }
            }
            return [n, mx];
        };
        const snap = (noCache) => {
            window.__noLineCache = !!noCache;
            render();
            const d = ctx.getImageData(0, 0, innerWidth, innerHeight).data;
            window.__noLineCache = false;
            return d;
        };
        const cmp = () => cnt(snap(false), snap(true));
        const res = {};
        const bin = $("bin");
        const setup = () => {
            S.length = 0;
            add("railing", 3);
            add("beveledStackedBuilding", 2);
            sel = null;
            tool = "view";
            mode = "draw";
            render();
        };
        const cases = {
            move: () => {
                S[0].ob.off = [1.5, 0, 0];
                render();
            },
            rot: () => {
                S[1].ob.rot = 35;
                render();
            },
            resize: () => {
                S[2].ob.h = 1.4;
                render();
            },
            select: () => {
                sel = S[4].ob.id;
                render();
            },
            hide: () => {
                const o = S[3].ob;
                o.hidden = true;
                render();
            },
            cam: () => {
                setP("cx", 3);
                setP("cy", 2);
                render();
            },
            zoom: () => {
                Z = 1.6;
                ox = -40;
                render();
            },
            view: () => {
                cityStandardView("top");
                render();
            },
        };
        ["faceOn", "faceOff"].forEach((faceKey) => {
            [true, false].forEach((b) => {
                P.surfaceMode = faceKey === "faceOn";
                bin.checked = b;
                setup();
                const tag = faceKey + (b ? "_binOn" : "_binOff");
                res[tag] = {};
                for (const k in cases) {
                    cases[k]();
                    res[tag][k] = cmp();
                }
            });
        });
        P.surfaceMode = true;
        bin.checked = true;
        return res;
    });
    const bad = [];
    Object.entries(r).forEach(([tag, m]) =>
        Object.entries(m).forEach(([k, v]) => {
            if (v[0] !== 0) bad.push(tag + "." + k + "=" + JSON.stringify(v));
        }),
    );
    console.log(JSON.stringify(r));
    console.log(bad.length === 0 && errors.length === 0 ? "=> すべて画素差 0" : "=> ちがう: " + bad.join(" / ") + " " + JSON.stringify(errors));
    await browser.close();
    process.exit(bad.length === 0 && errors.length === 0 ? 0 : 1);
})();
