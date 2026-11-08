/* 描画時間の実測（Playwright のヘッドレスなので、絶対値は実機より遅い。
   同じ条件どうしの比較に使う）。
   使い方: tests/run.sh tests/perf.js  */
const { open, ADD_FN } = require("./lib");

(async () => {
    const { browser, page, errors } = await open();
    await page.evaluate(ADD_FN);
    const r = await page.evaluate(() => {
        const add = window.__add;
        const flush = () => ctx.getImageData(0, 0, 1, 1); // GPU の処理を待たせる
        const med = (f) => {
            const a = [];
            for (let i = 0; i < 13; i++) {
                flush();
                const t0 = performance.now();
                f(i);
                flush();
                a.push(performance.now() - t0);
            }
            a.sort((x, y) => x - y);
            return +a[6].toFixed(1);
        };
        const out = {};
        S.length = 0;
        add("railing", 6);
        add("beveledStackedBuilding", 4);
        sel = null;
        tool = "view";
        mode = "draw";
        render();
        out.still = med(() => render());
        // 実際の編集と同じ setOb を使う。ob を直接変更すると線の点列が再生成されず、
        // 面と線が異なる状態を計測してしまうため、移動前後の線の座標も検査する。
        const dragId = S[0].ob.id,
            firstPoint = () => S.find((s) => s.ob?.id === dragId)?.p?.[0]?.slice(),
            beforePoint = firstPoint();
        out.drag = med((i) => {
            setOb(dragId, {off: [i * 0.05, 0, 0]});
            render();
        });
        const afterPoint = firstPoint();
        out.dragGeometryMoved = !!(beforePoint && afterPoint && Math.hypot(...beforePoint.map((n,j)=>n-afterPoint[j])) > .01);
        out.cam = med((i) => {
            setP("cx", i * 0.3);
            render();
        });
        out.noCache = med(() => {
            window.__noLineCache = true;
            window.__noSurfCache = true;
            render();
            window.__noLineCache = false;
            window.__noSurfCache = false;
        });
        const bin = $("bin");
        const was = bin.checked;
        bin.checked = false;
        out.binOff = med(() => render());
        bin.checked = was;
        out.points = S.reduce((n, s) => n + s.p.length, 0);
        return out;
    });
    console.log(JSON.stringify(r), JSON.stringify(errors));
    await browser.close();
    process.exit(errors.length === 0 && r.dragGeometryMoved ? 0 : 1);
})();
