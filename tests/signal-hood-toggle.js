/* 信号機（trafficSignal）・歩行者信号機（pedSignal）の斜め「ひさし」形状、ON/OFF切替、
   「ひさしのつばの長さ」「ひさしの傾き（折れ点の高さ）」のスライダー・数値欄・3Dハンドル操作、
   Undo/Redo、リセット、保存読込、旧データ互換の検査。 */
const { open, ADD_FN } = require("./lib");

(async () => {
    const { browser, page, errors } = await open({ width: 1280, height: 820 });
    await page.evaluate(ADD_FN);

    const result = await page.evaluate(async () => {
        const waitFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const toLocal = (ob, p) => {
            const o0 = L2W(ob, 0, 0, 0),
                d = V.add(p, o0, 1, -1);
            return [
                V.dot(d, V.add(L2W(ob, 1, 0, 0), o0, 1, -1)),
                V.dot(d, V.add(L2W(ob, 0, 1, 0), o0, 1, -1)),
                V.dot(d, V.add(L2W(ob, 0, 0, 1), o0, 1, -1)),
            ];
        };
        const out = [];

        for (const kind of ["pedSignal", "trafficSignal"]) {
            const lenKey = kind === "pedSignal" ? "psHoodLength" : "tsHoodLength";
            const kneeKey = kind === "pedSignal" ? "psHoodKnee" : "tsHoodKnee";
            const legacyKey = kind === "pedSignal" ? "psHood" : "tsHood";

            S.length = 0;
            clearSelection();
            __add(kind, 1);
            const id = sel;
            setOb(id, { ca: 0, cb: 0, lift: 0, rot: 0 });
            setSelection(id, false);
            sync();
            regenObjects();
            render();

            const o = obOf(id);
            const g = signalGeometry(o);
            const front = -g.headD / 2;

            // 1. 既定状態（ひさし ON）：上が手前(local -Y)へ長く張り出し、下が斜めに引っ込む形状であることを確認
            const onStrokes = S.filter((s) => s.ob?.id === id);
            const onTris = surfaceTriangles(o);
            const localPts = onStrokes.flatMap((s) => s.p.map((p) => toLocal(o, p)));
            const visorPts = localPts.filter((p) => p[2] > g.headBottom + 0.01 && p[1] < front - 0.01);
            const topPts = visorPts.filter((p) => p[2] > g.headBottom + g.headH * 0.72);
            const botPts = visorPts.filter((p) => p[2] < g.headBottom + g.headH * 0.18);
            const minTopY = Math.min(...topPts.map((p) => p[1]));
            const minBotY = Math.min(...botPts.map((p) => p[1]));
            const angledVisorOk = minTopY < front - 0.08 && minBotY > minTopY + 0.04;

            // 2. 上部キャンバス調整バーと左パネルに「ひさし」「ひさしのつばの長さ」「ひさしの傾き（折れ点の高さ）」が存在すること
            const topToggle = document.querySelector('#canvasAssetControl input[data-asset-toggle="signalHood"]');
            const leftToggle = document.querySelector('#assetEditorFields input[data-asset-control="signalHood"]');
            const topLenSlider = document.querySelector(`#canvasAssetControl input[data-control-id="param:${lenKey}"]`);
            const topKneeSlider = document.querySelector(`#canvasAssetControl input[data-control-id="param:${kneeKey}"]`);
            const leftLenInput = document.querySelector(`#assetEditorFields input[data-asset-control="${lenKey}"]`);
            const leftKneeInput = document.querySelector(`#assetEditorFields input[data-asset-control="${kneeKey}"]`);
            const hasControls =
                !!topToggle &&
                !!leftToggle &&
                topToggle.checked === true &&
                leftToggle.checked === true &&
                !!topLenSlider &&
                !!topKneeSlider &&
                !!leftLenInput &&
                !!leftKneeInput;

            // 3. 「ひさしのつばの長さ」を変更すると、枠背面や下端は動かず上端の手前張り出し量だけが変わること
            const baseBrim = Number(leftLenInput.value);
            const targetBrim = +(baseBrim + 0.08).toFixed(3);
            leftLenInput.value = String(targetBrim);
            leftLenInput.dispatchEvent(new Event("input", { bubbles: true }));
            leftLenInput.dispatchEvent(new Event("change", { bubbles: true }));
            await waitFrame();
            const afterBrimPts = S.filter((s) => s.ob?.id === id).flatMap((s) => s.p.map((p) => toLocal(obOf(id), p)));
            const afterBrimTopY = Math.min(...afterBrimPts.filter((p) => p[2] > g.headBottom + g.headH * 0.72 && p[1] < front - 0.01).map((p) => p[1]));
            const afterBrimBotY = Math.min(...afterBrimPts.filter((p) => p[2] > g.headBottom + 0.01 && p[2] < g.headBottom + g.headH * 0.18 && p[1] < front - 0.01).map((p) => p[1]));
            const brimEditOk =
                Math.abs(obOf(id)[lenKey] - targetBrim) < 1e-6 &&
                Math.abs((minTopY - afterBrimTopY) - 0.08) < 0.005 &&
                Math.abs(afterBrimBotY - minBotY) < 0.002;
            undo();
            await waitFrame();

            // 4. 「ひさしの傾き（折れ点の高さ）」を変更すると、折れ点の高さと斜面の傾きが変わり、つば長や灯器寸法は変わらないこと
            const baseKnee = Number(leftKneeInput.value);
            const targetKnee = +(baseKnee + 0.05).toFixed(3);
            leftKneeInput.value = String(targetKnee);
            leftKneeInput.dispatchEvent(new Event("input", { bubbles: true }));
            leftKneeInput.dispatchEvent(new Event("change", { bubbles: true }));
            await waitFrame();
            const kneeChangedOk =
                Math.abs(obOf(id)[kneeKey] - targetKnee) < 1e-6 &&
                JSON.stringify(S.filter((s) => s.ob?.id === id).map((s) => s.p)) !== JSON.stringify(onStrokes.map((s) => s.p));
            undo();
            await waitFrame();

            // 5. 上部バーのチェックボックスで OFF に切替（OFF時はひさしのハンドルも非表示になること）
            topToggle.click();
            await waitFrame();
            const offStrokes = S.filter((s) => s.ob?.id === id);
            const offTris = surfaceTriangles(obOf(id));
            const offLocalPts = offStrokes.flatMap((s) => s.p.map((p) => toLocal(obOf(id), p)));
            const offHeadMinY = Math.min(...offLocalPts.filter((p) => p[2] > g.headBottom + 0.01).map((p) => p[1]));
            const offHandles = specialGizmo(obOf(id))?.registeredHandles || [];
            const toggledOffOk =
                obOf(id).signalHood === false &&
                offStrokes.length < onStrokes.length &&
                offTris.length < onTris.length &&
                offHeadMinY > minTopY + 0.05 &&
                !offHandles.some((h) => h.paramKey === lenKey || h.paramKey === kneeKey) &&
                document.querySelector('#assetEditorFields input[data-asset-control="signalHood"]')?.checked === false;

            // 6. Undo / Redo の確認
            undo();
            await waitFrame();
            const afterUndoOk =
                obOf(id).signalHood !== false &&
                S.filter((s) => s.ob?.id === id).length === onStrokes.length &&
                document.querySelector('#canvasAssetControl input[data-asset-toggle="signalHood"]')?.checked === true;

            redo();
            await waitFrame();
            const afterRedoOk =
                obOf(id).signalHood === false &&
                S.filter((s) => s.ob?.id === id).length === offStrokes.length &&
                document.querySelector('#canvasAssetControl input[data-asset-toggle="signalHood"]')?.checked === false;

            // 7. 保存・読込（OFF 状態の保持）
            const savedOff = JSON.parse(JSON.stringify(pack(true)));
            unpack(savedOff);
            setSelection(id, false);
            await waitFrame();
            const reloadOffOk =
                obOf(id).signalHood === false &&
                S.filter((s) => s.ob?.id === id).length === offStrokes.length;

            // 8. 「リセットする」ボタンで初期状態（ひさし ON・つば長・傾き既定値）に戻り、位置・回転は維持されること
            setOb(id, { ca: 1.25, cb: -0.75, rot: -32, [lenKey]: 0.25, [kneeKey]: 0.14 });
            regenObjects();
            render();
            document.querySelector("#canvasAssetControl .canvasReset").click();
            await waitFrame();
            const resetOb = obOf(id);
            const resetOk =
                resetOb.signalHood !== false &&
                resetOb[lenKey] === undefined &&
                resetOb[kneeKey] === undefined &&
                Math.abs(resetOb.ca - 1.25) < 1e-6 &&
                Math.abs(resetOb.cb - -0.75) < 1e-6 &&
                Math.abs(resetOb.rot - -32) < 1e-6 &&
                S.filter((s) => s.ob?.id === id).length === onStrokes.length;

            // 9. 旧データ互換（tsHood:0 / psHood:0 で OFF 扱いになり、チェック ON で既定長さに復帰）
            setOb(id, { [legacyKey]: 0, signalHood: true });
            sync();
            regenObjects();
            render();
            const legacyZeroOffOk =
                S.filter((s) => s.ob?.id === id).length === offStrokes.length &&
                document.querySelector('#canvasAssetControl input[data-asset-toggle="signalHood"]')?.checked === false;
            document.querySelector('#canvasAssetControl input[data-asset-toggle="signalHood"]').click();
            await waitFrame();
            const legacyRestoreOk =
                obOf(id).signalHood === true &&
                obOf(id)[legacyKey] > 0.01 &&
                S.filter((s) => s.ob?.id === id).length === onStrokes.length;

            out.push({
                kind,
                onLines: onStrokes.length,
                offLines: offStrokes.length,
                onTris: onTris.length,
                offTris: offTris.length,
                angledVisorOk,
                hasControls,
                brimEditOk,
                kneeChangedOk,
                toggledOffOk,
                afterUndoOk,
                afterRedoOk,
                reloadOffOk,
                resetOk,
                legacyZeroOffOk,
                legacyRestoreOk,
            });
        }
        return out;
    });

    // 10. 歩行者信号機・信号機の「ひさしのつばの長さ」「ひさしの傾き（折れ点の高さ）」3D菱形ハンドルの実マウスドラッグ検査
    const dragRows = [];
    for (const kind of ["pedSignal", "trafficSignal"]) {
        const keys = kind === "pedSignal" ? ["psHoodLength", "psHoodKnee"] : ["tsHoodLength", "tsHoodKnee"];
        for (const key of keys) {
            for (const view of ["home", "side"]) {
                const info = await page.evaluate(
                    ({ kind, key, view }) => {
                        S.length = 0;
                        clearSelection();
                        __add(kind, 1);
                        const id = sel;
                        setOb(id, { ca: 0, cb: 0, lift: 0, rot: 0 });
                        regenObjects();
                        tool = "edit";
                        cityStandardView(view);
                        render();
                        const o = obOf(id),
                            h = specialGizmo(o)?.registeredHandles?.find((x) => x.paramKey === key),
                            c = document.querySelector("canvas"),
                            rc = c.getBoundingClientRect(),
                            sc = c.width / rc.width;
                        const ctrl = assetEditorControls(o).find((c) => c.key === key);
                        return h?.s?.ok
                            ? {
                                  id,
                                  kind,
                                  key,
                                  view,
                                  x: rc.x + h.s.x / sc,
                                  y: rc.y + h.s.y / sc,
                                  dir: h.dir,
                                  hit: hitGizmo(h.s)?.t,
                                  before: assetControlValue(o, ctrl),
                                  dims: [o.ra, o.rb, o.h],
                              }
                            : { kind, key, view, missing: true };
                    },
                    { kind, key, view },
                );
                if (info.dir) {
                    await page.mouse.move(info.x, info.y);
                    await page.mouse.down();
                    await page.mouse.move(info.x + info.dir.x * 18, info.y + info.dir.y * 18, { steps: 4 });
                    await page.mouse.up();
                    info.after = await page.evaluate(({ id, key }) => {
                        const o = obOf(id),
                            ctrl = assetEditorControls(o).find((c) => c.key === key);
                        return { value: assetControlValue(o, ctrl), dims: [o.ra, o.rb, o.h] };
                    }, info);
                }
                info.ok =
                    !!info.after &&
                    info.hit === "asset-param-" + key &&
                    info.after.value > info.before + 0.002 &&
                    JSON.stringify(info.after.dims) === JSON.stringify(info.dims);
                dragRows.push(info);
            }
        }
    }

    console.log(JSON.stringify({ result, dragRows, errors }));
    const bad = result.filter(
        (r) =>
            !r.angledVisorOk ||
            !r.hasControls ||
            !r.brimEditOk ||
            !r.kneeChangedOk ||
            !r.toggledOffOk ||
            !r.afterUndoOk ||
            !r.afterRedoOk ||
            !r.reloadOffOk ||
            !r.resetOk ||
            !r.legacyZeroOffOk ||
            !r.legacyRestoreOk,
    );
    const badDrag = dragRows.filter((r) => !r.ok);
    if (bad.length || badDrag.length || errors.length) process.exitCode = 1;
    else console.log("OK: 信号機・歩行者信号機の斜めひさし形状、ON/OFF切替、つば長・傾き（折れ点）のスライダー＆3Dハンドル操作を確認");
    await browser.close();
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
