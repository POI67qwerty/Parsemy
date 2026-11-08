/* 画面上の操作をひととおり押して、ページエラーが出ないことを確かめる。
   （棚のアセット・パネルのボタン・スライダー・チェックボックス・標準ビュー）
   使い方: tests/run.sh tests/ui-sweep.js  */
const { open, ADD_FN } = require("./lib");

(async () => {
    const { browser, page, errors } = await open();
    await page.evaluate(ADD_FN);
    const count = await page.evaluate(async () => {
        const add = window.__add;
        add("railing", 1);
        add("beveledStackedBuilding", 1);
        render();
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        let ops = 0;
        const clickAll = async (sel) => {
            const list = [...document.querySelectorAll(sel)];
            for (const el of list) {
                if (el.offsetParent === null) continue;
                el.click();
                ops++;
                if (ops % 40 === 0) await sleep(0);
            }
        };
        // 棚のアセットをすべて置く
        const groups = [...document.querySelectorAll("[data-asset-group]")];
        for (const g of groups) {
            g.click();
            await sleep(0);
            await clickAll('[data-asset]');
        }
        // パネルの操作（ボタン・チェック・スライダー・数値）
        await clickAll("#side button");
        await clickAll("#side input[type=checkbox]");
        const sliders = [...document.querySelectorAll("#side input[type=range]")];
        for (const s of sliders) {
            const min = Number(s.min || 0),
                max = Number(s.max || 100);
            s.value = String(min + (max - min) * 0.4);
            s.dispatchEvent(new Event("input", { bubbles: true }));
            s.dispatchEvent(new Event("change", { bubbles: true }));
            ops++;
        }
        // 標準ビュー
        for (const k of ["home", "top", "front", "side"]) {
            cityStandardView(k);
            await sleep(0);
            ops++;
        }
        // 取り消し／やり直し
        const undoBtn = [...document.querySelectorAll("#side button")].find((b) => /取り消|元に戻/.test(b.textContent));
        if (undoBtn) {
            undoBtn.click();
            ops++;
        }
        render();
        return { ops, objects: S.length };
    });
    console.log(JSON.stringify(count));
    console.log(errors.length === 0 ? "=> ページエラー 0" : "=> エラー: " + JSON.stringify(errors));
    await browser.close();
    process.exit(errors.length === 0 ? 0 : 1);
})();
