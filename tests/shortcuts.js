/* キーボード操作の点検。いまは Shift+D（その場に複製）を見る。

   Shift+D は「選択中のオブジェクトを、ずらさず同じ位置にもう1つ」作る。
   位置が同じなので見た目では分からないため、次の3つで確かめる。

     1. 数が増える（選択中のぶんだけ増え、複製が選ばれる）
     2. 位置と形が元と完全に同じ（ca と線の点列が一致）
     3. 何も選んでいないときは増えない（ブラウザのブックマークも止めない）

   グループ・専用ハンドル付き（カウンター）・正面ビューでも同じように動くこと、
   元に戻す（⌘Z）で1つ前に戻ることも見る。

   修飾キー付き（⌘/Ctrl+D）では複製しないこと（ブラウザのブックマークと取り合わないため）も見る。

   使い方: bash tests/run.sh tests/shortcuts.js
*/
const { open, ADD_FN } = require("./lib");

(async () => {
    const KEY = "Shift+d";
    const { browser, page, errors } = await open({ width: 1300, height: 860 });
    await page.evaluate(ADD_FN);
    const bad = [];
    const state = () =>
        page.evaluate(() => {
            const os = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()],
                pts = (o) => JSON.stringify(genShape(o).flatMap((p) => (p.pts || p.p || []).slice(0, 8)));
            return {
                n: os.length,
                sel: [...selIds],
                ca: os.map((o) => +o.ca),
                pts: os.map(pts),
                groups: [...new Set(os.map((o) => o.groupId).filter(Boolean))],
                hint: document.getElementById("hint")?.textContent || "",
                ids: os.map((o) => o.id),
            };
        });
    const place = (kind, n) =>
        page.evaluate(
            ([k, c]) => {
                S.length = 0;
                window.__add(k, c);
                const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()];
                sel = o[0].id;
                clearSelection();
                o.forEach((q) => selIds.add(q.id));
                sel = o[0].id;
                tool = "edit";
                setMode("draw");
                render();
            },
            [kind, n],
        );

    // 1) 1個 → その場に複製
    await place("building", 1);
    const a = await state();
    await page.keyboard.press(KEY);
    const b = await state();
    if (b.n !== a.n + 1) bad.push(`1個の複製で数が増えない（${a.n} → ${b.n}）`);
    if (b.ca[1] !== a.ca[0]) bad.push(`その場で複製されていない（ca ${a.ca[0]} → ${b.ca[1]}）`);
    if (b.pts[1] !== a.pts[0]) bad.push("複製の形（線の点列）が元と違う");
    if (!b.sel.includes(b.ids[1])) bad.push("複製した方が選ばれていない");
    if (!/複製しました/.test(b.hint)) bad.push(`操作したことが分からない（ヒント「${b.hint}」）`);
    // 2) 続けてもう1個 → 3個
    await page.keyboard.press(KEY);
    const c = await state();
    if (c.n !== a.n + 2) bad.push(`2回目の複製で増えない（${c.n}）`);
    // 3) 元に戻す → 1つ前に戻る
    await page.keyboard.press("Control+z");
    const d = await state();
    if (d.n !== c.n - 1) bad.push(`複製が元に戻らない（${c.n} → ${d.n}）`);

    // 3.5) 修飾キー付き（⌘/Ctrl+D）では複製しない
    await page.keyboard.press("Control+d");
    const mod = await state();
    if (mod.n !== d.n) bad.push(`Ctrl+D でも複製された（${d.n} → ${mod.n}）`);

    // 4) 何も選んでいないときは増えない
    await page.evaluate(() => {
        clearSelection();
        sel = null;
        render();
    });
    const e0 = await state();
    await page.keyboard.press(KEY);
    const e1 = await state();
    if (e1.n !== e0.n) bad.push(`未選択なのに複製された（${e0.n} → ${e1.n}）`);

    // 5) グループ（2個まとめて）→ 4個・位置そのまま・複製は新しいグループで1つにまとまる
    await page.evaluate(() => {
        S.length = 0;
        window.__add("building", 2);
        const os = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()];
        os.forEach((o) => (o.groupId = "g-test"));
        sel = os[0].id;
        clearSelection();
        os.forEach((o) => selIds.add(o.id));
        sel = os[0].id;
        tool = "edit";
        setMode("draw");
        render();
    });
    const f0 = await state();
    await page.keyboard.press(KEY);
    const f1 = await state();
    if (f1.n !== f0.n * 2) bad.push(`グループが2個ぶん増えない（${f0.n} → ${f1.n}）`);
    if (JSON.stringify(f1.ca) !== JSON.stringify([...f0.ca, ...f0.ca])) bad.push(`グループの複製が同じ位置に無い ${f1.ca}`);
    if (f1.groups.length !== 2) bad.push(`複製が元のグループに混ざった（${f1.groups}）`);

    // 6) 専用ハンドル付き（カウンターL字）でも複製できる
    await place("counterL", 1);
    const g0 = await state();
    await page.keyboard.press(KEY);
    const g1 = await state();
    if (g1.n !== g0.n + 1) bad.push(`カウンターが複製できない（${g0.n} → ${g1.n}）`);
    if (g1.ca[1] !== g0.ca[0]) bad.push("カウンターがその場で複製されていない");

    // 7) 正面ビュー（間取り）でも同じ
    await place("stool", 1);
    await page.evaluate(() => window.cityFloorPlanView?.("front"));
    await page.waitForTimeout(300);
    const h0 = await state();
    await page.keyboard.press(KEY);
    await page.waitForTimeout(200);
    const h1 = await state();
    if (h1.n !== h0.n + 1) bad.push(`正面ビューで複製できない（${h0.n} → ${h1.n}）`);
    if (h1.ca[1] !== h0.ca[0]) bad.push("正面ビューでその場に複製されていない");

    if (errors.length) bad.push("ページエラー: " + errors.join(" / "));
    console.log(JSON.stringify({ key: KEY, plain: [a.n, b.n, c.n, d.n], ctrlD: mod.n, empty: [e0.n, e1.n], group: [f0.n, f1.n, f1.groups.length], counter: [g0.n, g1.n], floor: [h0.n, h1.n] }));
    console.log(bad.length ? "NG\n  " + bad.join("\n  ") : `OK（Shift+D でその場に複製。1→2→3→戻す2、Ctrl+D は変化なし、未選択は変化なし、グループ2→4、カウンター1→2、正面1→2）`);
    await browser.close();
    process.exit(bad.length ? 1 : 0);
})();
