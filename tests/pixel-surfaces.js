/* 面（塗り）の層を「動いた1台の範囲だけ塗り直す」方式が、
   毎回すべて塗り直す方式と 1px も違わないことを確かめる。
   使い方: tests/run.sh tests/pixel-surfaces.js  */
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
        // 線の層は毎回作り直して、面の層の違いだけを見る。
        const snap = () => {
            window.__noLineCache = true;
            render();
            const d = ctx.getImageData(0, 0, innerWidth, innerHeight).data;
            window.__noLineCache = false;
            return d;
        };
        const incVsFull = () => {
            const A = snap();
            window.__noSurfCache = true;
            window.__noSurfFull = true;
            const B = snap();
            window.__noSurfCache = false;
            window.__noSurfFull = false;
            return cnt(A, B);
        };
        const res = {};
        S.length = 0;
        add("railing", 3);
        add("beveledStackedBuilding", 2);
        sel = null;
        tool = "view";
        mode = "draw";
        P.surfaceMode = true;
        render();
        res.move = (() => {
            for (let i = 0; i < 10; i++) {
                S[0].p[0] = -6 + i * 0.4;
                render();
            }
            return incVsFull();
        })();
        res.rot = (() => {
            for (let i = 0; i < 8; i++) {
                S[1].r = [0, 0, i * 11];
                render();
            }
            return incVsFull();
        })();
        res.resize = (() => {
            for (let i = 0; i < 6; i++) {
                S[2].w = 2 + i * 0.3;
                render();
            }
            return incVsFull();
        })();
        res.multi = (() => {
            for (let i = 0; i < 6; i++) {
                S[0].p[1] = -1 + i * 0.2;
                S[3].r = [0, 0, i * 15];
                render();
            }
            return incVsFull();
        })();
        res.addObj = (() => {
            add("stall", 1);
            render();
            add("stool", 1);
            render();
            return incVsFull();
        })();
        res.cam = (() => {
            for (let i = 0; i < 5; i++) {
                setP("cx", i * 0.5);
                render();
            }
            return incVsFull();
        })();
        res.zoom = (() => {
            for (let i = 0; i < 3; i++) {
                Z = 1.2 + i * 0.3;
                ox = -30 * i;
                render();
            }
            return incVsFull();
        })();
        res.views = (() => {
            cityStandardView("top");
            render();
            cityStandardView("front");
            render();
            cityStandardView("home");
            render();
            return incVsFull();
        })();
        res.deleted = (() => {
            S.pop();
            render();
            S.pop();
            render();
            return incVsFull();
        })();
        res.faceToggle = (() => {
            P.surfaceMode = false;
            render();
            P.surfaceMode = true;
            render();
            return incVsFull();
        })();
        res.farMove = (() => {
            for (let i = 0; i < 12; i++) {
                S[0].p[0] = 30 + i * 6;
                render();
            }
            return incVsFull();
        })();
        res.afterFar = (() => {
            for (let i = 0; i < 12; i++) {
                S[0].p[0] = -30;
                render();
            }
            return incVsFull();
        })();
        return res;
    });
    const bad = Object.entries(r).filter(([, v]) => v[0] !== 0);
    console.log(JSON.stringify(r));
    console.log(bad.length === 0 && errors.length === 0 ? "=> すべて画素差 0" : "=> ちがう: " + JSON.stringify(bad) + " エラー:" + JSON.stringify(errors));
    await browser.close();
    process.exit(bad.length === 0 && errors.length === 0 ? 0 : 1);
})();
