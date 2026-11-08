/* 同一ブラウザ・同一シーンで旧版と新版を交互に計測する。
 * ヘッドレス Chromium の値は実機性能ではなく、同じ条件の比較専用。
 * 実行: bash tests/run.sh tests/occlusion-optimization-perf.js
 */
const { open, ADD_FN } = require('./lib');
const oldSource = require('./fixtures/legacy-orth-ray');

(async () => {
    const { browser, page, errors } = await open({ width: 1200, height: 800 });
    await page.evaluate(ADD_FN);
    const result = await page.evaluate((source) => {
        const fastOrth = signalOrthOccluded;
        const oldOrth = eval('(' + source + ')');
        S.length = 0;
        clearSelection();
        for (let i = 0; i < 6; i++) __add('railing', 1);
        for (let i = 0; i < 4; i++) __add('beveledStackedBuilding', 1);
        clearSelection();
        tool = 'view';
        setMode('draw');
        window.__noLineCache = true;
        const choose = (old) => { signalOrthOccluded = old ? oldOrth : fastOrth; };
        const run = () => {
            cityStandardView('front');
            window.cityFloorPlanScale = 70;
            sync();
            regenObjects();
            for (let i = 0; i < 3; i++) { choose(i % 2 === 0); render(); }
            const old = [], fast = [];
            // 表示中心を動かし、順序を反転してキャッシュや実行順の偏りを抑える。
            for (let i = 0; i < 10; i++) {
                for (const isOld of (i % 2 ? [false, true] : [true, false])) {
                    choose(isOld);
                    window.cityFloorPlanCenter = [(i % 5) * 0.12, 0];
                    const start = performance.now();
                    render();
                    ctx.getImageData(0, 0, 1, 1);
                    (isOld ? old : fast).push(performance.now() - start);
                }
            }
            const median = (values) => {
                const sorted = values.slice().sort((a, b) => a - b);
                return (sorted[4] + sorted[5]) / 2;
            };
            return {
                view: 'front',
                old: old.map((x) => +x.toFixed(1)),
                fast: fast.map((x) => +x.toFixed(1)),
                oldMedian: +median(old).toFixed(1),
                fastMedian: +median(fast).toFixed(1),
            };
        };
        const results = [run(), run(), run()];
        choose(false);
        return results;
    }, oldSource);
    console.log(JSON.stringify({ result, errors }));
    if (errors.length) process.exitCode = 1;
    await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
