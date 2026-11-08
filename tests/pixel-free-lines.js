/* ペンで描いた線（オブジェクトに属さない線）が、線の層のキャッシュで
   古い絵のまま残らないことを確かめる（キャッシュあり／無しで画素が一致）。
   実際のポインター操作でペン描きする。
   使い方: tests/run.sh tests/pixel-free-lines.js  */
const { open, ADD_FN } = require("./lib");

(async () => {
    const { browser, page, errors } = await open();
    await page.evaluate(ADD_FN);
    await page.evaluate(() => {
        window.__add("railing", 1);
        sel = null;
        tool = "pen";
        mode = "draw";
        P.surfaceMode = false;
        render();
    });
    // ペンで2本描く（2本目が1本目のあとに正しく出るか）
    const stroke = async (x0, y0, x1, y1) => {
        await page.mouse.move(x0, y0);
        await page.mouse.down();
        for (let i = 1; i <= 6; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / 6, y0 + ((y1 - y0) * i) / 6);
        await page.mouse.up();
        await page.waitForTimeout(60);
    };
    await stroke(300, 300, 600, 420);
    await stroke(320, 520, 640, 380);
    const r = await page.evaluate(() => {
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
        const out = {};
        out.afterTwo = cnt(snap(false), snap(true));
        out.lines = S.length;
        out.free = S.filter((s) => !s.ob).length;
        // 消しゴムで消す（線の層が古いままだと残ってしまう）
        tool = "erase";
        eraseAt({ x: 450, y: 360 });
        render();
        out.afterErase = cnt(snap(false), snap(true));
        return out;
    });
    const bad = r.afterTwo[0] !== 0 || r.afterErase[0] !== 0;
    console.log(JSON.stringify(r));
    console.log(!bad && errors.length === 0 ? "=> すべて画素差 0" : "=> ちがう " + JSON.stringify(errors));
    await browser.close();
    process.exit(!bad && errors.length === 0 ? 0 : 1);
})();
