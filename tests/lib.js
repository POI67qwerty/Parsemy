/* テスト共通の小さな道具（Playwright）。
   - open(): 単体HTMLを開いて、アセット棚を開いた状態にする
   - add(): アセットを n 個置く（棚のグループを切り替えながら探す）
   - 画素の比較・ベンチマークは各テストで書く（状態によって変わるため） */
const playwright = process.env.CITY_TEST_PLAYWRIGHT ? require(process.env.CITY_TEST_PLAYWRIGHT) : require("playwright");
const { chromium, webkit } = playwright;
const URL = "file://" + require("path").resolve(__dirname, "..", "cyberpunk-city-studio.html");

async function open(viewport = { width: 1400, height: 900 }) {
    // WebKit の回帰も同じ試験から実行できる（既定は従来どおり Chromium）。
    const engine = process.env.CITY_TEST_BROWSER === "webkit" ? webkit : chromium;
    const touch = process.env.CITY_TEST_TOUCH === "1";
    const browser = await engine.launch();
    const page = await browser.newPage({ viewport, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    // 「全部消しますか？」などの確認ダイアログは自動で OK する（操作を止めないため）。
    page.on("dialog", (d) => d.accept());
    await page.goto(URL);
    await page.waitForTimeout(800);
    return { browser, page, errors };
}

// ページの中で使う関数（アセットを置く）。文字列として評価する。
const ADD_FN = `window.__add = (k, n) => {
    const t = document.querySelector("#assetToggle");
    if (t && t.getAttribute("aria-expanded") !== "true") t.click();
    const groups = ["primitive", "building", "buildingParts", "street", "traffic", "streetObjects", "furniture", "person", "vehicle"];
    const card = document.querySelector('[data-asset="' + k + '"]');
    const targetGroup = card?.dataset.group;
    for (const g of groups) {
        if (g === targetGroup) {
            const elg = document.querySelector('[data-asset-group="' + g + '"]');
            if (elg) elg.click();
            break;
        }
    }
    for (let i = 0; i < (n || 1); i++) document.querySelector('[data-asset="' + k + '"]').click();
    return true;
};`;

module.exports = { open, ADD_FN, URL };
