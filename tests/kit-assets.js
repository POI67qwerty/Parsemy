/* ASSET_KIT（asset-kit.js）で作ったアセットの点検。
   キットは「部品の一覧」から線と面の両方を作るので、次を確かめる。

     1. 登録されている       … ASSET_KIT.kinds() と ASSETS の両方にある
     2. 棚に出ている         … アセット棚にカードがあり、押すと置ける
     3. 線と面が出ている     … 線が1本以上／面が箱（12三角形）より多い
     4. 面ONで線が消えすぎない … 外形の線が残っている（インクが減りすぎない）
     5. 固有値に反応する     … キットの固有値を変えると形（面の数か座標）が変わる
     6. 回転に追従する       … rot を変えると線の点列が変わる
     7. 保存・読み込みで壊れない … JSON 経由でも同じ線になる
     8. ページエラーが0

   使い方: bash tests/run.sh tests/kit-assets.js  */

const { open, ADD_FN } = require("./lib");

(async () => {
    const { browser, page, errors } = await open({ width: 1200, height: 800 });
    await page.evaluate(ADD_FN);
    // 店先と片側車止めは旧保存の表示用に登録を残すが、意図的に棚から外している。
    const kinds = await page.evaluate(() => (typeof ASSET_KIT === "undefined" ? [] : ASSET_KIT.kinds().filter(k => k !== 'shopFront' && k !== 'guardPoleHalf')));
    const res = { kinds, items: {} };
    if (!kinds.length) {
        console.log(JSON.stringify(res, null, 1));
        console.log("NG\n  ASSET_KIT で作ったアセットが1つもありません");
        await browser.close();
        process.exit(1);
    }
    for (const kind of kinds) {
        const r = await page.evaluate((k) => {
            S.length = 0;
            const card = document.querySelector('[data-asset="' + k + '"]');
            if (card) card.click();
            const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find(
                (q) => q && q.asset === k,
            );
            if (!o) return { placed: false };
            sel = null;
            tool = "view";
            mode = "draw";
            P.surfaceMode = true;
            window.cityStandardView("home");
            render();
            const sig = (q) =>
                genShape(q)
                    .map((l) => (l.p || []).map((v) => v.map((x) => x.toFixed(3)).join(",")).join(";"))
                    .join("|");
            // 面ONの線の量（外形が残っているか）
            const inkOf = () => {
                window.__noLineCache = true;
                const c = lineLayer(true, false, W, H, null, false),
                    d = c.getContext("2d").getImageData(0, 0, W, H).data;
                window.__noLineCache = false;
                let n = 0;
                for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 20) n++;
                return n;
            };
            const inkOn = inkOf(); // 面ON（隠れ線を消した状態）
            // 「面の内側の線も描く」従来の描き方と比べ、外形の線が残っているか。
            window.__noInterior = true;
            const inkAll = inkOf();
            window.__noInterior = false;
            const inkOff = inkAll;
            // 固有値（形を決める数値）を変えたら形が変わるか。
            // キット製の新しいアセットは ASSETS の meta に、既存から移したアセットは
            // オブジェクト自身（o）に固有値が載るので、両方から候補を集める。
            const skip = new Set([
                "w", "d", "h", "accent", "label", "glyph", "k", "ca", "cb", "rot", "lift",
                "ra", "rb", "rotX", "rotZ", "wf", "c", "off", "tx", "ty", "tz", "extrude",
                "visible", "locked", "floorIndex", "sleep", "spin",
            ]);
            const numericKeys = [...new Set([...Object.keys(ASSETS[k] || {}), ...Object.keys(o)])].filter(
                (key) => !skip.has(key) && Number.isFinite(Number(ASSETS[k]?.[key] ?? o[key])) && Number(ASSETS[k]?.[key] ?? o[key]) > 0,
            );
            const baseSig = sig(o);
            let paramReacts = null;
            for (const key of numericKeys) {
                const v = Number(ASSETS[k]?.[key] ?? o[key]);
                if (!(v > 0)) continue;
                if (sig({ ...o, [key]: v * 1.6 + 0.02 }) !== baseSig) {
                    paramReacts = key;
                    break;
                }
            }
            // 算出値型の登録コントロールは patch で基礎寸法を書き換える。
            if (!paramReacts) for (const control of assetEditorControls(o)) {
                if (typeof control.patch !== "function" || (control.type || "number") !== "number") continue;
                const v = assetControlValue(o,control), patch=control.patch(o,v*1.6+.02);
                if (sig({...o,...patch}) !== baseSig) { paramReacts=control.key; break; }
            }
            if (!paramReacts && sig({ ...o, h: o.h * 1.3 }) !== baseSig) paramReacts = "h";
            // 保存・読み込み（JSON化して戻しても同じ線）
            const round = JSON.parse(JSON.stringify({ ...o }));
            const jsonSame = sig(round) === baseSig;
            return {
                placed: true,
                lines: genShape(o).length,
                tris: surfaceTriangles(o).length,
                inkOn,
                inkOff,
                dims: [o.ra * 2, o.rb * 2, o.h],
                rotFollows: sig({ ...o, rot: (Number(o.rot) || 0) + 37 }) !== baseSig,
                paramReacts,
                jsonSame,
            };
        }, kind);
        res.items[kind] = r;
    }

    // キットの3つの道具（穴あけ／曲面／文字）を、アセットを通さずに直接確かめる。
    // 3Dで高さを編集できるか（上下の面ハンドルが出て、h が変わるか）。
    // 新しいアセットを足したときに「縦に編集できない」状態を防ぐための検査。
    res.vertical = await page.evaluate(
        (ks) =>
            ks.map((k) => {
                S.length = 0;
                window.__add(k, 1);
                const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k);
                if (!o) return [k, false, null];
                sel = o.id;
                const g = typeof gizmo === "function" ? gizmo() : null,
                    ids = ((g && g.faces) || []).map((f) => f.id),
                    patch = ids.includes("top") ? facePatch(o, "top", 0.2) : null;
                sel = null;
                return [k, ids.includes("top") && ids.includes("base"), patch ? +(patch.h - o.h).toFixed(3) : null];
            }),
        kinds,
    );
    res.tools = await page.evaluate(() => {
        const K = ASSET_KIT,
            area = (t) =>
                Math.abs((t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (t[1][1] - t[0][1])) / 2;
        // 1) 穴あけ：外 1.0×0.6 から 0.4×0.2 の穴を引く
        const outer = K.rectPath(1.0, 0.6),
            hole = K.rectPath(0.4, 0.2),
            tris = K.triangulate(outer, [hole]),
            holes = {
                area: +tris.reduce((q, t) => q + area(t), 0).toFixed(4),
                expect: +(1.0 * 0.6 - 0.4 * 0.2).toFixed(4),
                // 穴の中を覆う三角形が無いこと
                covered: tris.filter((t) => {
                    const cx = (t[0][0] + t[1][0] + t[2][0]) / 3,
                        cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
                    return Math.abs(cx) < 0.19 && Math.abs(cy) < 0.09;
                }).length,
            };
        // 2) 押し出す向き：axis:"y" は正面を向いた板（厚みが y、面が x-z）
        const panel = K.box(K.rectPath(1.0, 1.4), -0.05, 0.05, { axis: "y" }),
            pTris = K.partTris(panel),
            flat = pTris.flat(),
            range = (i) => [Math.min(...flat.map((q) => q[i])), Math.max(...flat.map((q) => q[i]))],
            p2 = { y: range(1), x: range(0), z: range(2) };
        // 3) 曲面：角を丸めた直方体は、上下の縁が何段にも分かれる
        const rb = K.roundedBox(1.2, 0.8, 1.6, 0.12, { seg: 3, cornerSeg: 2 }),
            rbTris = K.partTris(rb),
            zs = [...new Set(rbTris.flat().map((q) => +q[2].toFixed(3)))].sort((a, b) => a - b);
        // 4) 文字：折れ線が作れて、面に貼ると板になる
        const strokes = K.textStrokes("FROZEN", { height: 0.1 }),
            letters = K.textPart("FROZEN", { face: "front", plane: -0.2, u: 0, v: 1.0, height: 0.1 });
        // 5) 円柱：断面 n 角形の柱。円の面は中心から扇状に分割する。
        const cyl = K.cylinder(0.3, 0, 0.2, { seg: 20 }),
            cylTris = K.partTris(cyl),
            cylEdges = K.partEdges(cyl),
            cylFlat = cylTris.flat(),
            cylRange = (i) => [Math.min(...cylFlat.map((q) => q[i])), Math.max(...cylFlat.map((q) => q[i]))],
            // axis:"y" は寝かせた柱（丸い断面が x-z、長さが y）
            cylY = K.partTris(K.cylinder(0.3, -0.5, 0.5, { seg: 8, axis: "y" })).flat(),
            cylYRange = (i) => [Math.min(...cylY.map((q) => q[i])), Math.max(...cylY.map((q) => q[i]))],
            cylNoCap = K.cylinder(0.3, 0, 0.2, { seg: 20, caps: false }),
            cylVerts = K.cylinder(0.3, 0, 0.2, { seg: 20, verts: 2 }),
            cylinder = {
                tris: cylTris.length,
                edges: cylEdges.length,
                x: cylRange(0),
                z: cylRange(2),
                // 寝かせた柱：長さ 1.0 が y、断面 0.6 が x と z
                y: cylYRange(1),
                yx: cylYRange(0),
                noCapTris: K.partTris(cylNoCap).length,
                noCapEdges: K.partEdges(cylNoCap).length,
                vertEdges: K.partEdges(cylVerts).length,
            };
        // 6) 並べる道具：count（本数）・repeat（等間隔）・grid（格子）
        const seq = [];
        K.repeat(3, (i, t) => seq.push(+t.toFixed(3)));
        const repeating = {
            parts: K.repeat(4, () => K.box(K.rectPath(0.1, 0.1), 0, 0.2)).length,
            tris: K.partTris(K.box(K.rectPath(0.1, 0.1), 0, 0.2)) ? K.repeat(4, () => K.box(K.rectPath(0.1, 0.1), 0, 0.2)).reduce((n, q) => n + K.partTris(q).length, 0) : 0,
            grid: K.grid(3, 2, () => K.box(K.rectPath(0.1, 0.1), 0, 0.2)).length,
            one: K.repeat(1, () => K.box(K.rectPath(0.1, 0.1), 0, 0.2)).length,
            zero: K.repeat(0, () => K.box(K.rectPath(0.1, 0.1), 0, 0.2)).length,
            ts: seq,
            counts: [K.count(6.4), K.count(0, 6, 2, 24), K.count("7"), K.count(99, 6, 2, 24), K.count(undefined, 5)],
        };
        // 7) 回転体：断面を回して円錐・球を作る
        const cone = K.revolution([[0.5, 0], [0, 1]], { seg: 12 }),
            coneTris = K.partTris(cone),
            coneFlat = coneTris.flat(),
            coneR = Math.max(...coneFlat.map((q) => Math.hypot(q[0], q[1]))),
            sphere = K.revolution([[0, 0], [0.5, 0.5], [0, 1]], { seg: 16, rings: [1] }),
            revolution = {
                tris: coneTris.length,
                edges: K.partEdges(cone).length,
                radius: +coneR.toFixed(3),
                z: [Math.min(...coneFlat.map((q) => q[2])), Math.max(...coneFlat.map((q) => q[2]))],
                sphereTris: K.partTris(sphere).length,
                sphereEdges: K.partEdges(sphere).length,
            };
        // 8) 部品カタログ：登録されている部品が、置けて・動かせて・面と線を出す
        const names = K.partNames();
            catalog = {};
        names.forEach((name) => {
            const parts = K.part(name),
                moved = K.part(name, { at: [1, 2, 3] }),
                    center = (list) => {
                    const all = list.flatMap((p) => K.partTris(p)).flat();
                    return all.length ? [0, 1, 2].map((i) => all.reduce((a, q) => a + q[i], 0) / all.length) : [0, 0, 0];
                };
            const c0 = center(parts),
                c1 = center(moved);
            catalog[name] = {
                parts: parts.length,
                tris: parts.reduce((n, p) => n + K.partTris(p).length, 0),
                edges: parts.reduce((n, p) => n + K.partEdges(p).length, 0),
                // at:[1,2,3] で重心がその分だけ動くか
                shifted: c0.map((v, i) => +(c1[i] - v).toFixed(2)),
            };
        });
        return {
            holes,
            catalog,
            repeating,
            revolution,
            cylinder,
            direction: { y: p2.y, x: p2.x, z: p2.z, tris: pTris.length },
            rounded: { tris: rbTris.length, zs: zs.length, height: +Math.max(...zs).toFixed(3), width: +p2.x[1] },
            text: { strokes: strokes.length, width: +strokes.maxWidth.toFixed(3), parts: letters.length },
        };
    });

    // 室外機：ファン（丸い穴）の左右ハンドル。
    // ・幅を変えてもファンの中心（実寸 m）が動かないこと
    // ・専用ハンドルを左右に引くと ouFanX が変わり、円が胴からはみ出さないこと
    res.fan = await page.evaluate(() => {
        S.length = 0;
        window.__add("outdoorUnit", 1);
        const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find(
            (q) => q && q.asset === "outdoorUnit",
        );
        if (!o) return { placed: false };
        window.__noHomeFit = true;
        window.cityStandardView("front");
        sel = o.id;
        tool = "edit";
        setMode("draw");
        render();
        // 幅を変えてもファンの中心（m）が動かないこと。
        // ただし胴からはみ出すほど細くしたときだけは、円を内側へ寄せる（はみ出させない）。
        const widths = [0.6, 0.86, 1.0, 1.4];
        const across = widths.map((w) => {
            o.ra = w / 2;
            const g = outdoorUnitGeometry(o);
            return {
                w,
                fanX: +g.fanX.toFixed(3),
                // 円が胴の内側に収まっているか（中心＋半径が半幅以内）
                inside: Math.abs(g.fanX) + g.fanR <= g.W / 2 + 1e-6,
            };
        });
        o.ra = 0.43;
        sel = o.id;
        render();
        const h = (specialGizmo(o) || {}).handles?.fanX,
            cv = document.querySelector("canvas"),
            rc = cv.getBoundingClientRect(),
            sc = cv.width / rc.width;
        return {
            placed: true,
            kind: h?.kind || null,
            start: h ? +Number(h.start).toFixed(3) : null,
            range: h ? [+Number(h.min).toFixed(3), +Number(h.max).toFixed(3)] : null,
            across,
            px: h ? h.s.x / sc + rc.x : null,
            py: h ? h.s.y / sc + rc.y : null,
        };
    });
    if (res.fan.placed) {
        await page.mouse.move(res.fan.px, res.fan.py);
        await page.mouse.down();
        await page.mouse.move(res.fan.px + 55, res.fan.py, { steps: 3 });
        await page.mouse.up();
        res.fan.after = await page.evaluate(() => {
            const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find(
                (q) => q && q.asset === "outdoorUnit",
            );
            return o && Number.isFinite(Number(o.ouFanX)) ? +Number(o.ouFanX).toFixed(3) : null;
        });
    }

    // 信号機・標識（ポールもの）4種：専用の「ポール」ハンドルで高さ（＝ポールの長さ）を変えられるか。
    // ハンドルは頭の横に出て、引いた量だけ頭ごと上下する。値を h に書き戻すので、
    // 上下の面ハンドル・数値欄・保存と食い違わない。
    res.pole = {};
    for (const kind of ["trafficSignal", "pedSignal", "signPost", "signPost2", "signTriangle", "signDiamond", "signCombo", "crossingSign"]) {
        const info = await page.evaluate((k) => {
            S.length = 0;
            window.__add(k, 1);
            const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k);
            if (!o) return { placed: false };
            window.__noHomeFit = true;
            window.cityStandardView("front");
            sel = o.id;
            tool = "edit";
            setMode("draw");
            render();
            const h = (specialGizmo(o) || {}).handles?.poleH,
                cv = document.querySelector("canvas"),
                rc = cv.getBoundingClientRect(),
                sc = cv.width / rc.width,
                g0 = signalGeometry(o);
            return {
                placed: true,
                kind: h?.kind || null,
                headKinds: Object.keys(specialGizmo(o)?.handles || {}).map((kk) => ({
                    poleH: "signal-pole-h",
                    headW: "signal-head-w",
                    headD: "signal-head-d",
                })[kk]).filter(Boolean),
                start: h ? +Number(h.start).toFixed(3) : null,
                scale: h ? Math.round(h.scale) : null,
                // 画面の 1m あたりの画素数（ハンドル）と、canvas と CSS の倍率
                ppu: h ? Math.round(h.scale) : null,
                cssScale: +(cv.width / rc.width).toFixed(4),
                range: h ? [+Number(h.min).toFixed(2), +Number(h.max).toFixed(2)] : null,
                h0: +o.h.toFixed(3),
                headBottom0: +g0.headBottom.toFixed(3),
                px: h ? h.s.x / sc + rc.x : null,
                py: h ? h.s.y / sc + rc.y : null,
            };
        }, kind);
        if (!info.placed) {
            res.pole[kind] = info;
            continue;
        }
        await page.mouse.move(info.px, info.py);
        await page.mouse.down();
        await page.mouse.move(info.px, info.py - 40, { steps: 3 });
        await page.mouse.up();
        // 頭の幅（左右）と奥行き（前後）。高さだけ動かせて幅が動かない、を防ぐ検査。
        const headAt = async (h) =>
            page.evaluate(
                ([k, name]) => {
                    const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k),
                        sg = specialGizmo(o) || {},
                        cv = document.querySelector("canvas"),
                        rc = cv.getBoundingClientRect(),
                        css = cv.width / rc.width,
                        hd = (sg.handles || {})[name];
                    if (!hd) return null;
                    const g = signalGeometry(o);
                    return {
                        x: hd.s.x / css + rc.x,
                        y: hd.s.y / css + rc.y,
                        ppu: hd.scale,
                        css,
                        start: +Number(hd.start).toFixed(4),
                        ra: +o.ra.toFixed(3),
                        rb: +o.rb.toFixed(3),
                        headW: +g.headW.toFixed(3),
                        headD: +g.headD.toFixed(3),
                    };
                },
                [kind, h],
            );
        const dragHead = async (name, dx, dy) => {
            const at = await headAt(name);
            if (!at) return null;
            await page.mouse.move(at.x, at.y);
            await page.mouse.down();
            await page.mouse.move(at.x + dx, at.y + dy, { steps: 3 });
            await page.mouse.up();
            return at;
        };
        const readHead = () =>
            page.evaluate((k) => {
                const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k),
                    g = signalGeometry(o);
                return { headW: +g.headW.toFixed(3), headD: +g.headD.toFixed(3), ra: +o.ra.toFixed(3), rb: +o.rb.toFixed(3), h: +o.h.toFixed(3) };
            }, kind);
        const hw = await dragHead("headW", 40, 0);
        info.headAfterW = await readHead();
        const hd = await dragHead("headD", 0, 40);
        info.head = await page.evaluate((k) => {
            const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k),
                g = signalGeometry(o);
            return { headW: +g.headW.toFixed(3), headD: +g.headD.toFixed(3), ra: +o.ra.toFixed(3), rb: +o.rb.toFixed(3) };
        }, kind);
        info.headWant = {
            w: hw ? +((40 * hw.css) / Math.max(1, hw.ppu)).toFixed(3) : null,
            d: hd ? +((40 * hd.css) / Math.max(1, hd.ppu)).toFixed(3) : null,
            w0: hw ? hw.headW : null,
            d0: hd ? hd.headD : null,
        };
        info.after = await page.evaluate((k) => {
            const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k),
                g = signalGeometry(o);
            return { h: +o.h.toFixed(3), headBottom: +g.headBottom.toFixed(3) };
        }, kind);
        res.pole[kind] = info;
    }

    // 標識の形・枚数：選択中にパネルから「枚数（1/2）」と「板の形（丸・逆三角形・四角・ひし形）」を
    // 切り替えられ、どの組み合わせでも線と面が出るか。枚数を変えてもポールの高さ・板の幅は保つ。
    res.signShape = {};
    for (const kind of ["signPost", "signPost2", "signTriangle", "signDiamond", "signCombo", "trafficSignal", "pedSignal", "crossingSign"]) {
        res.signShape[kind] = await page.evaluate(
            ([k, SHAPES]) => {
                const vis = (id) => {
                        const n = document.getElementById(id);
                        return !!n && getComputedStyle(n).display !== "none";
                    },
                    read = () => {
                        const o = [...new Map(S.filter((q) => q.ob).map((q) => [q.ob.id, q.ob])).values()].find((q) => q && q.asset === k),
                            g = signalGeometry(o);
                        return {
                            count: Number(o.signCount ?? ASSETS[k].signCount ?? 1),
                            shape: String(o.signShape ?? ASSETS[k].signShape ?? ""),
                            shape2: String(o.signShape2 ?? ASSETS[k].signShape2 ?? ""),
                            lines: genShape(o).length,
                            tris: surfaceTriangles(o).length,
                            poleTop: +g.headCz.toFixed(4),
                            headW: +g.headW.toFixed(4),
                            h: +o.h.toFixed(4),
                        };
                    },
                    set = (id, v) => {
                        const n = document.getElementById(id);
                        n.value = v;
                        n.onchange && n.onchange();
                    };
                S.length = 0;
                window.__add(k, 1);
                const o = [...new Map(S.filter((q) => q.ob).map((q) => [q.ob.id, q.ob])).values()].find((q) => q && q.asset === k);
                if (!o) return { placed: false };
                sel = o.id;
                tool = "edit";
                setMode("draw");
                render();
                const panel = vis("signShapeP"),
                    row2Before = vis("signShape2Row");
                if (!panel) return { placed: true, panel };
                const base = read(),
                    rows = {};
                for (const count of [1, 2]) {
                    set("signCountSel", String(count));
                    for (const a of SHAPES) {
                        set("signShapeSel", a);
                        for (const b of SHAPES) {
                            set("signShape2Sel", b);
                            const r = read();
                            rows[`${count}/${a}+${b}`] = { lines: r.lines, tris: r.tris, headW: r.headW, count: r.count, shape: r.shape, shape2: r.shape2 };
                        }
                    }
                }
                const two = (set("signCountSel", "2"), set("signShapeSel", "circle"), set("signShape2Sel", "rect"), read()),
                    back = (set("signCountSel", "1"), read());
                return { placed: true, panel, row2Before, row2At2: (set("signCountSel", "2"), vis("signShape2Row")), base, two, back, rows };
            },
            [kind, ["circle", "triangle", "rect", "diamond"]],
        );
    }

    // カウンター（普通／L字／コの字）：長さ・天板の厚さ・土台の高さのハンドルが効くか。
    // 3本とも実マウスでドラッグする。ハンドルは編集のたびに位置が動くので、
    // 1本引くごとに置き場所を取り直す。
    const counterHandleAt = (kind, handle) =>
        page.evaluate(
            ([k, h]) => {
                const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k),
                    sg = specialGizmo(o) || {},
                    cv = document.querySelector("canvas"),
                    rc = cv.getBoundingClientRect(),
                    css = cv.width / rc.width,
                    hd = (sg.handles || {})[h];
                if (!hd) return null;
                return { x: hd.s.x / css + rc.x, y: hd.s.y / css + rc.y, ppu: hd.scale, css, start: +Number(hd.start).toFixed(4) };
            },
            [kind, handle],
        );
    const dragCounterHandle = async (kind, handle, dx, dy) => {
        const at = await counterHandleAt(kind, handle);
        if (!at) return null;
        await page.mouse.move(at.x, at.y);
        await page.mouse.down();
        await page.mouse.move(at.x + dx, at.y + dy, { steps: 3 });
        await page.mouse.up();
        return at;
    };
    res.counter = {};
    for (const kind of ["counter", "counterL", "counterU"]) {
        const before = await page.evaluate((k) => {
            S.length = 0;
            window.__add(k, 1);
            const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k);
            if (!o) return { placed: false };
            window.__noHomeFit = true;
            window.cityStandardView("front");
            sel = o.id;
            tool = "edit";
            setMode("draw");
            render();
            const sg = specialGizmo(o) || {},
                g = counterGeometry(o);
            return {
                placed: true,
                kinds: Object.values(sg.handles || {}).map((h) => h.kind),
                h: +o.h.toFixed(3),
                ra: +o.ra.toFixed(3),
                d0: +o.rb.toFixed(3),
                topT: +g.topT.toFixed(3),
                baseH: +g.baseH.toFixed(3),
                lines: genShape(o).length,
                tris: surfaceTriangles(o).length,
            };
        }, kind);
        if (!before.placed) {
            res.counter[kind] = before;
            continue;
        }
        const after = {};
        // 0) 奥行き（手前へ 40px）→ rb が増える（L字・コの字の腕の長さもこれで決まる）
        const hd = await dragCounterHandle(kind, "depth", 0, 40);
        after.depth = await page.evaluate((k) => {
            const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k),
                g = counterGeometry(o);
            return { D: +g.D.toFixed(3), ra: +o.ra.toFixed(3), arm: +g.arm.toFixed(3) };
        }, kind);
        // 1) 長さ（右へ 40px）→ 幅 ra が増える
        const hl = await dragCounterHandle(kind, "length", 40, 0);
        after.length = await page.evaluate((k) => {
            const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k);
            return { ra: +o.ra.toFixed(3), h: +o.h.toFixed(3), topT: +counterGeometry(o).topT.toFixed(3) };
        }, kind);
        // 2) 天板の厚さ（上へ 30px）→ 天板が厚くなり、全体の高さは変わらない
        const ht = await dragCounterHandle(kind, "topT", 0, -30);
        after.topT = await page.evaluate((k) => {
            const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k);
            const g = counterGeometry(o);
            return { h: +o.h.toFixed(3), topT: +g.topT.toFixed(3), baseH: +g.baseH.toFixed(3) };
        }, kind);
        // 3) 土台の高さ（上へ 30px）→ 土台が高くなり、全体の高さも同じだけ上がる
        const hb = await dragCounterHandle(kind, "baseH", 0, -30);
        after.baseH = await page.evaluate((k) => {
            const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k);
            const g = counterGeometry(o);
            return { h: +o.h.toFixed(3), topT: +g.topT.toFixed(3), baseH: +g.baseH.toFixed(3) };
        }, kind);
        // 4) 腕の太さ（L字・コの字だけ。上へ 30px）→ コの字の棒が太くなる
        const ha = await counterHandleAt(kind, "arm");
        if (ha) {
            await page.mouse.move(ha.x, ha.y);
            await page.mouse.down();
            await page.mouse.move(ha.x, ha.y - 30, { steps: 3 });
            await page.mouse.up();
            after.arm = await page.evaluate((k) => {
                const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k),
                    g = counterFootprint(o),
                    area = (p) => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2,
                    expect = g.shape === "l" ? g.W * g.arm + (g.D - g.arm) * g.arm : g.W * g.arm + 2 * (g.D - g.arm) * g.arm;
                return {
                    arm: +g.arm.toFixed(3),
                    W: +g.W.toFixed(3),
                    D: +g.D.toFixed(3),
                    area: +area(g.foot).toFixed(3),
                    expect: +expect.toFixed(3),
                    h: +o.h.toFixed(3),
                    lines: genShape(o).length,
                };
            }, kind);
        }
        const per = (at, px) => (at ? (px * at.css) / Math.max(1, at.ppu) : 0);
        res.counter[kind] = {
            ...before,
            after,
            armAt: ha,
            want: {
                arm: +per(ha, 30).toFixed(3),
                depth: +per(hd, 40).toFixed(3),
                length: +per(hl, 40).toFixed(3),
                topT: +per(ht, 30).toFixed(3),
                baseH: +per(hb, 30).toFixed(3),
            },
        };
    }

    // カウンター：極端な縦横比でも「L」「コ」の形が壊れないか。
    // 腕の幅を幅・奥行きの 62% で頭打ちにしているので、長く伸ばしても凹みが消えない。
    res.counterShapes = await page.evaluate(() => {
        const K = ASSET_KIT,
            area = (p) => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
        window.__noHomeFit = true;
        const out = {};
        ["counterL", "counterU"].forEach((k) => {
            S.length = 0;
            window.__add(k, 1);
            const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k),
                rows = [];
            [[6, 0.6], [0.6, 6], [8, 8]].forEach(([w, d]) => {
                o.ra = w / 2;
                o.rb = d / 2;
                const g = counterFootprint(o),
                    // L字＝W*arm + (D-arm)*arm ／ コの字＝W*arm + 2*(D-arm)*arm
                    expect = g.shape === "l" ? g.W * g.arm + (g.D - g.arm) * g.arm : g.W * g.arm + 2 * (g.D - g.arm) * g.arm,
                    base = K.insetPath(g.foot, g.overhang);
                rows.push({
                    w: +g.W.toFixed(2),
                    d: +g.D.toFixed(2),
                    arm: +g.arm.toFixed(3),
                    area: +area(g.foot).toFixed(3),
                    expect: +expect.toFixed(3),
                    // 土台の面が作れている（三角形が数えられる）か
                    tris: K.triangulate(base).length,
                    pts: g.foot.length,
                });
            });
            out[k] = rows;
        });
        // 家具グループへ入っているか
        const t = document.querySelector("#assetToggle");
        if (t && t.getAttribute("aria-expanded") !== "true") t.click();
        document.querySelector('[data-asset-group="furniture"]').click();
        out.groups = ["counter", "counterL", "counterU"].map((k) => {
            const c = document.querySelector(`[data-asset="${k}"]`);
            return [k, c ? c.dataset.group : null];
        });
        // 街パーツに残っていないこと（カードは1グループにしか属さない）
        out.streetLeft = [...document.querySelectorAll('[data-group="street"][data-asset]')].filter((c) =>
            /^counter/.test(c.dataset.asset),
        ).length;
        return out;
    });

    // カウンター：5本のハンドルが、どのビューでも「別のハンドル」を掴まないこと。
    // 腕の太さ（L字・コの字）は奥行きのハンドルと近いので、取り違えると
    // 「奥行きを動かしたら太さが変わる」ような事故になる。
    res.counterHits = await page.evaluate(() => {
        const out = {};
        window.__noHomeFit = true;
        ["counter", "counterL", "counterU"].forEach((k) => {
            S.length = 0;
            window.__add(k, 1);
            const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k);
            sel = o.id;
            tool = "edit";
            setMode("draw");
            render();
            const views = {};
            ["home", "front", "top", "side"].forEach((v) => {
                window.cityStandardView(v);
                render();
                const hits = {};
                Object.entries(specialGizmo(o)?.handles || {}).forEach(([name, h]) => {
                    const hit = hitGizmo({ x: h.s.x, y: h.s.y });
                    hits[name] = hit ? hit.t : null;
                });
                views[v] = hits;
            });
            sel = null;
            out[k] = views;
        });
        return out;
    });

    // 五角形の立体・車（軽トラ・軽バン・乗用車）：専用ハンドルが9本／7本／3本そろい、
    // 実マウスで「狙った寸法だけ」が変わるか。ハンドルは画面の向き（dir）へ引くので、
    // どのビューでも同じ量だけ動く（ドラッグ量 = 40px / 1m あたりの画素数）。
    res.vehicle = {};
    // key は pentaGeometry() が返す形の値の名前（readVeh の項目名と同じ）。
    const VEH_HANDLES = {
        roofH: { key: "h", label: "上の面" },
        frontH: { key: "edgeH", label: "下がってる線" },
        rearH: { key: "rearH", label: "後ろの下がってる線" },
        nose: { key: "nose", label: "前の面" },
        tail: { key: "tail", label: "後ろの面" },
        frontBoxH: { key: "frontBoxH", label: "前の箱の高さ" },
        rearBoxH: { key: "h", label: "後ろの箱の高さ" },
        bedH: { key: "bedH", label: "荷台の高さ" },
        bedL: { key: "bedL", label: "荷台の長さ" },
        tireR: { key: "tireR", label: "タイヤの大きさ" },
        tireW: { key: "tireW", label: "タイヤの太さ" },
        wb: { key: "wb", label: "タイヤの前後" },
        tireZ: { key: "tireZ", label: "タイヤの上下" },
    };
    // ハンドルの名前 → hitGizmo が返す t（取り違えの検査に使う）
    const WANT_NAME = {
        roofH: "vh-roof-h",
        frontH: "vh-front-h",
        rearH: "vh-rear-h",
        nose: "vh-nose",
        tail: "vh-tail",
        frontBoxH: "vh-front-box-h",
        rearBoxH: "vh-rear-box-h",
        bedH: "vh-bed-h",
        bedL: "vh-bed-l",
        tireR: "vh-tire-r",
        tireW: "vh-tire-w",
        wb: "vh-base",
        tireZ: "vh-tire-z",
    };
    const vehHandleAt = (kind, handle) =>
        page.evaluate(
            ([k, h]) => {
                const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k),
                    sg = specialGizmo(o) || {},
                    cv = document.querySelector("canvas"),
                    rc = cv.getBoundingClientRect(),
                    css = cv.width / rc.width,
                    hd = (sg.handles || {})[h];
                if (!hd || !hd.s) return null;
                return {
                    x: hd.s.x / css + rc.x,
                    y: hd.s.y / css + rc.y,
                    dir: { x: hd.dir.x, y: hd.dir.y },
                    ppu: hd.scale,
                    css,
                    start: +Number(hd.start).toFixed(4),
                    min: +Number(hd.min).toFixed(4),
                    max: +Number(hd.max).toFixed(4),
                    label: hd.label,
                    hit: (hitGizmo({ x: hd.s.x, y: hd.s.y }) || {}).t || null,
                };
            },
            [kind, handle],
        );
    const readVeh = (kind) =>
        page.evaluate((k) => {
            const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k),
                g = pentaGeometry(o);
            return {
                h: +g.H.toFixed(4),
                W: +g.W.toFixed(4),
                L: +g.L.toFixed(4),
                ra: +o.ra.toFixed(4),
                rb: +o.rb.toFixed(4),
                edgeH: +g.edgeH.toFixed(4),
                nose: +g.nose.toFixed(4),
                bedH: +g.bedH.toFixed(4),
                bedL: +g.bedL.toFixed(4),
                tireR: +g.tireR.toFixed(4),
                tireW: +g.tireW.toFixed(4),
                track: +g.track.toFixed(4),
                wb: +g.wb.toFixed(4),
                tireZ: +g.tireZ.toFixed(4),
                wheelMid: +g.wheelMid.toFixed(4),
                rearH: +g.rearH.toFixed(4),
                tail: +g.tail.toFixed(4),
                frontBoxH: +g.frontBoxH.toFixed(4),
                backY: +g.backY.toFixed(4),
                frontA: +g.frontA.toFixed(4),
                rearA: +g.rearA.toFixed(4),
                wheels: g.wheels.map((w) => [+w.x.toFixed(3), +w.y.toFixed(3), +w.z.toFixed(3)]),
                lines: genShape(o).length,
                tris: surfaceTriangles(o).length,
                // 画面から触って保存された値（undefined＝比率の既定値で、高さに追従する）
                raw: {
                    vhNose: o.vhNose,
                    vhBedH: o.vhBedH,
                    vhBedL: o.vhBedL,
                    vhTireR: o.vhTireR,
                    vhTireW: o.vhTireW,
                    vhTrack: o.vhTrack,
                    vhWb: o.vhWb,
                    vhTireZ: o.vhTireZ,
                    vhTail: o.vhTail,
                    vhRearH: o.vhRearH,
                    vhFrontBoxH: o.vhFrontBoxH,
                    vhFrontH: o.vhFrontH,
                },
            };
        }, kind);
    for (const kind of ["pentaBox", "keiTruck", "keiVan", "sedan", "sedan2"]) {
        const setup = await page.evaluate((k) => {
            S.length = 0;
            window.__add(k, 1);
            const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k);
            if (!o) return { placed: false };
            window.__noHomeFit = true;
            sel = o.id;
            tool = "edit";
            setMode("draw");
            // 正面（正投影）はカメラが動かないので、ハンドルの位置が測ったとおりになる。
            window.cityStandardView("front");
            CAMKEY = null;
            render();
            return { placed: true, kinds: Object.keys(specialGizmo(o)?.handles || {}) };
        }, kind);
        if (!setup.placed) {
            res.vehicle[kind] = setup;
            continue;
        }
        const base = await readVeh(kind),
            rows = {};
        for (const [name, meta] of Object.entries(VEH_HANDLES)) {
            if (!setup.kinds.includes(name)) continue;
            const at = await vehHandleAt(kind, name);
            if (!at) {
                rows[name] = { missing: true };
                continue;
            }
            const before = await readVeh(kind),
                // 端（上限）に近い値は、引くと止まってしまうので内側へ引く（動く向きを確かめる検査なので）。
                step = Number(at.start) + (40 * at.css) / Math.max(1, at.ppu) > at.max ? -40 : 40,
                dx = at.dir.x * step,
                dy = at.dir.y * step;
            if (at.hit !== WANT_NAME[name]) rows[name] = { missing: true, hit: at.hit };
            await page.mouse.move(at.x, at.y);
            await page.mouse.down();
            await page.mouse.move(at.x + dx, at.y + dy, { steps: 3 });
            await page.mouse.up();
            const after = await readVeh(kind),
                want = (step * at.css) / Math.max(1, at.ppu);
            rows[name] = {
                key: meta.key,
                want: +want.toFixed(3),
                from: +Number(at.start).toFixed(3),
                min: at.min,
                max: at.max,
                got: after,
                before,
            };
        }
        res.vehicle[kind] = { placed: true, kinds: setup.kinds, base, rows };
    }

    // 車のハンドルが、どのビューでも別のハンドルを掴まないこと（4ビュー × 最大9本）。
    res.vehicleHits = await page.evaluate(() => {
        const out = {};
        window.__noHomeFit = true;
        ["pentaBox", "keiTruck", "keiVan", "sedan", "sedan2"].forEach((k) => {
            S.length = 0;
            window.__add(k, 1);
            const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k);
            sel = o.id;
            tool = "edit";
            setMode("draw");
            render();
            const views = {};
            ["home", "front", "top", "side"].forEach((v) => {
                window.cityStandardView(v);
                render();
                const hits = {};
                Object.entries(specialGizmo(o)?.handles || {}).forEach(([name, h]) => {
                    const hit = hitGizmo({ x: h.s.x, y: h.s.y });
                    hits[name] = hit ? hit.t : null;
                });
                views[v] = hits;
            });
            sel = null;
            out[k] = views;
        });
        return out;
    });

    // 車は「人物の隣」の専用グループに入り、街パーツには残っていないこと。
    res.vehicleGroup = await page.evaluate(() => {
        const t = document.querySelector("#assetToggle");
        if (t && t.getAttribute("aria-expanded") !== "true") t.click();
        const tabs = [...document.querySelectorAll("[data-asset-group]")].map((b) => b.dataset.assetGroup);
        document.querySelector('[data-asset-group="vehicle"]').click();
        const inVehicle = [...document.querySelectorAll('[data-group="vehicle"][data-asset]')].map((c) => c.dataset.asset);
        const streetCars = [...document.querySelectorAll('[data-group="street"][data-asset]')]
            .map((c) => c.dataset.asset)
            .filter((k) => /^(keiTruck|keiVan|sedan)$/.test(k));
        return { tabs, inVehicle, streetCars, adjacent: tabs.indexOf("vehicle") - tabs.indexOf("person") };
    });

    // 五角形の立体：キャブの輪郭が5点で閉じ、屋根の高さを変えても下の形（前端の高さ・前の面）は動かない。
    // 乗用車は六角形（前も後ろも斜め）、乗用車2 はL字（低い前の箱＋高い後ろの箱）の断面か。
    res.profiles = await page.evaluate(() => {
        const out = {};
        [["pentaBox", 5, "penta"], ["sedan", 6, "hex"], ["sedan2", 6, "step"]].forEach(([k, n, kind]) => {
            S.length = 0;
            window.__add(k, 1);
            const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === k),
                g = pentaGeometry(o),
                ys = g.profile.map((p) => p[0]),
                zs = g.profile.map((p) => p[1]);
            out[k] = {
                pts: g.profile.length,
                expect: n,
                yMin: +Math.min(...ys).toFixed(3),
                yMax: +Math.max(...ys).toFixed(3),
                zMax: +Math.max(...zs).toFixed(3),
                H: +g.H.toFixed(3),
                rearH: +g.rearH.toFixed(3),
                frontBoxH: +g.frontBoxH.toFixed(3),
                stepY: +g.stepY.toFixed(3),
                closed: zs.filter((z) => Math.abs(z) < 1e-9).length >= 2,
            };
        });
        return out;
    });

    res.penta = await page.evaluate(() => {
        S.length = 0;
        window.__add("pentaBox", 1);
        const o = [...new Map(S.filter((s) => s.ob).map((s) => [s.ob.id, s.ob])).values()].find((q) => q && q.asset === "pentaBox");
        const g0 = pentaGeometry(o),
            p0 = g0.profile.map((p) => [+p[0].toFixed(3), +p[1].toFixed(3)]),
            roof = p0.filter((p) => Math.abs(p[1] - g0.H) < 1e-6).length;
        setOb(o.id, { h: g0.H + 0.8 });
        const g1 = pentaGeometry(o),
            p1 = g1.profile.map((p) => [+p[0].toFixed(3), +p[1].toFixed(3)]);
        return {
            pts: p0.length,
            roofEdge: roof, // 上面は2点（前と後ろ）でできる
            closed: p0[0][1] === 0 && p0[p0.length - 1][1] === 0,
            yF: g0.yF,
            afterH: g1.H,
            sameFront: Math.abs(g1.edgeH - g0.edgeH) < 1e-6,
            sameYF: Math.abs(g1.yF - g0.yF) < 1e-6,
            p1,
        };
    });

    const bad = [];
    if (Math.abs(res.tools.holes.area - res.tools.holes.expect) > 1e-3) bad.push("穴あけ: 面積が合わない（穴が抜けていない）");
    if (res.tools.holes.covered) bad.push("穴あけ: 穴の中が面で埋まっている");
    if (!(res.tools.direction.y[1] - res.tools.direction.y[0] > 0.05 && res.tools.direction.y[1] - res.tools.direction.y[0] < 0.11))
        bad.push(`向き(axis:"y"): 厚みが y になっていない ${JSON.stringify(res.tools.direction.y)}`);
    if (!(res.tools.direction.z[1] - res.tools.direction.z[0] > 1.3)) bad.push("向き(axis:\"y\"): 高さが z になっていない");
    if (!(res.tools.rounded.zs >= 6)) bad.push(`曲面: 上下の縁が丸まっていない（段 ${res.tools.rounded.zs}）`);
    if (Math.abs(res.tools.rounded.height - 1.6) > 0.02) bad.push("曲面: 高さが合わない");
    if (!(res.tools.text.strokes >= 6)) bad.push("文字: 折れ線が作れていない");
    if (!(res.tools.text.parts > 10)) bad.push("文字: 面に貼れていない");
    for (const [k, hasFaces, dh] of res.vertical) {
        if (!hasFaces) bad.push(`${k}: 3Dで上下の面ハンドルが出ない（縦に編集できない）`);
        else if (Math.abs(dh - 0.2) > 0.001) bad.push(`${k}: 上を 0.2 動かしても高さが ${dh} しか変わらない`);
    }
    const want = ["window", "door", "acUnit", "bench", "awning", "wheel", "pipeRun", "signBoard"];
    const cat = res.tools.catalog;
    for (const name of want) {
        const c = cat[name];
        if (!c) {
            bad.push(`部品: ${name} が登録されていない`);
            continue;
        }
        if (!(c.parts >= 1)) bad.push(`部品 ${name}: 部品が出ない`);
        if (!(c.tris >= 2)) bad.push(`部品 ${name}: 面が出ない（${c.tris}）`);
        if (!(c.edges >= 1)) bad.push(`部品 ${name}: 線が出ない（${c.edges}）`);
        if (JSON.stringify(c.shifted) !== "[1,2,3]") bad.push(`部品 ${name}: at で動かない ${JSON.stringify(c.shifted)}`);
    }
    const rp = res.tools.repeating;
    if (rp.parts !== 4 || rp.tris !== 48) bad.push(`並べる: 4個になっていない ${rp.parts}/${rp.tris}`);
    if (rp.grid !== 6) bad.push(`格子: 3×2 が 6個になっていない ${rp.grid}`);
    if (rp.one !== 1 || rp.zero !== 0) bad.push(`並べる: 1個/0個の扱いが違う ${rp.one}/${rp.zero}`);
    if (JSON.stringify(rp.ts) !== "[0,0.5,1]") bad.push(`並べる: 進み具合 t が違う ${JSON.stringify(rp.ts)}`);
    if (JSON.stringify(rp.counts) !== "[6,2,7,24,5]") bad.push(`count: 丸めが違う ${JSON.stringify(rp.counts)}`);
    const rv = res.tools.revolution;
    if (rv.tris !== 34) bad.push(`回転体: 円錐の三角形が ${rv.tris}（期待 34＝側面24＋底面10）`);
    if (rv.edges !== 2) bad.push(`回転体: 輪が ${rv.edges} 本（期待 2）`);
    if (Math.abs(rv.radius - 0.5) > 0.002) bad.push(`回転体: 半径が合わない ${rv.radius}`);
    if (Math.abs(rv.z[1] - 1) > 0.001) bad.push(`回転体: 高さが合わない ${JSON.stringify(rv.z)}`);
    if (!(rv.sphereTris > 60)) bad.push(`回転体: 球の面が足りない ${rv.sphereTris}`);
    if (rv.sphereEdges !== 3) bad.push(`回転体(rings:[1]): 輪が3本でない ${rv.sphereEdges}`);
    const cy = res.tools.cylinder;
    // 20角形：側面 40 ＋ 上下の扇 40 ＝ 80三角形。輪は上下2本。
    if (cy.tris !== 80) bad.push(`円柱: 三角形が ${cy.tris}（期待 80）`);
    if (cy.edges !== 2) bad.push(`円柱: 輪が ${cy.edges} 本（期待 2＝上下だけ）`);
    if (Math.abs(cy.x[1] - 0.3) > 0.01 || Math.abs(cy.x[0] + 0.3) > 0.01) bad.push(`円柱: 半径が合わない ${JSON.stringify(cy.x)}`);
    if (Math.abs(cy.z[1] - 0.2) > 0.001) bad.push(`円柱: 高さが合わない ${JSON.stringify(cy.z)}`);
    if (Math.abs(cy.y[1] - 0.5) > 0.001 || Math.abs(cy.y[0] + 0.5) > 0.001) bad.push(`円柱(axis:"y"): 長さが y になっていない ${JSON.stringify(cy.y)}`);
    if (!(cy.yx[1] - cy.yx[0] > 0.5)) bad.push(`円柱(axis:"y"): 断面が x-z になっていない ${JSON.stringify(cy.yx)}`);
    if (cy.noCapTris !== 40) bad.push(`円柱(caps:false): 側面だけになっていない ${cy.noCapTris}`);
    if (cy.noCapEdges !== 0) bad.push(`円柱(caps:false): 線が出ている ${cy.noCapEdges}`);
    if (cy.vertEdges !== 4) bad.push(`円柱(verts:2): 縦線が2本入っていない ${cy.vertEdges}`);
    const fan = res.fan;
    if (!fan.placed) bad.push("室外機: 置けない");
    else {
        if (fan.kind !== "outdoor-fan-x") bad.push(`室外機: ファンの左右ハンドルが出ない（${fan.kind}）`);
        const fits = fan.across.filter((r) => r.w >= 0.86).map((r) => r.fanX);
        if (Math.max(...fits) - Math.min(...fits) > 1e-6)
            bad.push(`室外機: 幅を変えるとファンが動く ${JSON.stringify(fan.across)}`);
        fan.across.forEach((r) => {
            if (!r.inside) bad.push(`室外機: 幅 ${r.w} でファンが胴からはみ出す`);
        });
        if (fan.range && !(fan.range[0] < fan.start && fan.start < fan.range[1]))
            bad.push(`室外機: ハンドルの範囲が現在値を含まない ${JSON.stringify(fan.range)}`);
        if (!(fan.after !== null && Math.abs(fan.after - fan.start) > 0.02))
            bad.push(`室外機: 左右ハンドルを引いても ouFanX が変わらない（${fan.start} → ${fan.after}）`);
        else if (fan.range && (fan.after < fan.range[0] - 1e-6 || fan.after > fan.range[1] + 1e-6))
            bad.push(`室外機: ハンドルが範囲外へ出る ${fan.after}`);
    }
    for (const [kind, info] of Object.entries(res.pole)) {
        if (!info.placed) {
            bad.push(`${kind}: 置けない`);
            continue;
        }
        if (info.kind !== "signal-pole-h") bad.push(`${kind}: ポールの高さハンドルが出ない（${info.kind}）`);
        if (!(info.after && info.after.h > info.h0 + 0.01))
            bad.push(`${kind}: ポールのハンドルを上へ引いても高くならない（${info.h0} → ${info.after?.h}）`);
        // 引いた量ぶん伸びているか。マウスの 40px は canvas の座標では 40×cssScale px になる。
        const want = (40 * info.cssScale) / Math.max(1, info.ppu);
        if (info.after && Math.abs(info.after.h - info.h0 - want) > 0.08)
            bad.push(`${kind}: ポールの伸びが引いた量と合わない（+${(info.after.h - info.h0).toFixed(2)}m / 期待 +${want.toFixed(2)}m）`);
        // 頭の幅・奥行きのハンドル（高さだけ動かせて幅が動かない状態を防ぐ）
        if (!info.headKinds || !info.headKinds.includes("signal-head-d") || (["trafficSignal","pedSignal"].includes(kind) ? !info.headKinds.includes("signal-head-w") : info.headKinds.includes("signal-head-w")))
            bad.push(`${kind}: 頭の幅・奥行きのハンドルが出ない`);
        if (["trafficSignal","pedSignal"].includes(kind) && !(info.head && Math.abs(info.head.headW - info.headWant.w0 - info.headWant.w) < 0.05))
            bad.push(`${kind}: 頭の幅のハンドルで幅が変わらない（${info.headWant.w0} → ${info.head?.headW}）`);
        if (!(info.head && Math.abs(info.head.headD - info.headWant.d0 - info.headWant.d) < 0.03))
            bad.push(`${kind}: 奥行きのハンドルで奥行きが変わらない（${info.headWant.d0} → ${info.head?.headD}）`);
        // 幅を変えても奥行きは変わらない（headD は直径どうしで比べる）
        if (!(Math.abs(info.headAfterW.headD - info.headWant.d0) < 1e-6))
            bad.push(`${kind}: 頭の幅を変えたら奥行きまで変わった（${info.headWant.d0} → ${info.headAfterW.headD}）`);
        // 頭はポールの上に載っている（ポールを伸ばすと頭も上がる）
        if (info.after && Math.abs(info.after.headBottom - info.headBottom0 - (info.after.h - info.h0)) > 1e-6)
            bad.push(`${kind}: ポールを伸ばしても頭が付いてこない`);
    }
    // 五角形の立体・車の判定
    for (const [kind, r] of Object.entries(res.vehicle || {})) {
        if (!r.placed) {
            bad.push(`${kind}: 置けない`);
            continue;
        }
        const want =
            kind === "pentaBox"
                ? ["roofH", "frontH", "nose"]
                : kind === "sedan"
                  ? ["roofH", "frontH", "rearH", "nose", "tireR", "tireW", "wb", "tireZ"] // 六角形
                  : kind === "sedan2"
                    ? ["frontBoxH", "nose", "rearBoxH", "tail", "tireR", "tireW", "wb", "tireZ"] // L字
                    : ["roofH", "frontH", "nose", "tireR", "tireW", "wb", "tireZ"];
        // 「タイヤの左右（間隔）」のハンドルは廃止し、「タイヤの上下」に置き換えた。
        if (r.kinds.includes("track")) bad.push(`${kind}: 廃止した「タイヤの左右」のハンドルが残っている`);
        want.forEach((name) => {
            if (!r.kinds.includes(name)) bad.push(`${kind}: ハンドル ${name} が出ない`);
        });
        if (kind !== "keiTruck" && (r.kinds.includes("bedH") || r.kinds.includes("bedL")))
            bad.push(`${kind}: 荷台の無い種類に荷台のハンドルが出ている`);
        if (kind === "keiTruck" && (!r.kinds.includes("bedH") || !r.kinds.includes("bedL")))
            bad.push(`${kind}: 荷台のハンドルが出ない`);
        // 実マウスで引いた結果：狙った値だけが「引いた量」だけ変わる。
        // 端（最小・最大）に当たったときは、上限・下限で止まるのが正しい動き。
        const clampTo = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        for (const [name, row] of Object.entries(r.rows || {})) {
            if (row.missing) {
                bad.push(`${kind}: ${name} のハンドルが無い`);
                continue;
            }
            const key = row.key,
                got = row.got[key],
                wantVal = clampTo(row.from + row.want, row.min, row.max);
            if (!(Math.abs(got - wantVal) < 0.05 + Math.abs(row.want) * 0.05))
                bad.push(`${kind}: 「${VEH_HANDLES[name].label}」を引いても ${key} が変わらない（${row.from} → ${got} / 期待 ${wantVal.toFixed(2)}）`);
            // 保存されている（＝画面から触った）ほかの値は動かないこと。
            // 触っていない値は比率の既定値なので、高さを変えれば一緒に変わるのが正しい。
            const RAW_OF = {
                nose: "vhNose",
                bedH: "vhBedH",
                bedL: "vhBedL",
                tireR: "vhTireR",
                tireW: "vhTireW",
                track: "vhTrack",
                wb: "vhWb",
                edgeH: "vhFrontH",
            };
            Object.entries(RAW_OF).forEach(([kk, rawKey]) => {
                if (kk === key) return;
                const b = row.before?.raw?.[rawKey],
                    a = row.got?.raw?.[rawKey];
                if (b === undefined || a === undefined) return; // 比率の既定値（保存していない）
                if (Math.abs(Number(a) - Number(b)) > 1e-9)
                    bad.push(`${kind}: 「${VEH_HANDLES[name].label}」を引いたら ${rawKey} まで動いた（${b} → ${a}）`);
            });
            // 幅・奥行きは、どのハンドルでも動かない（左右の面ハンドルの担当）。
            if (name !== "roofH" && Math.abs(Number(row.got.W) - Number(row.before.W)) > 1e-9)
                bad.push(`${kind}: 「${VEH_HANDLES[name].label}」を引いたら幅まで動いた`);
            if (Math.abs(Number(row.got.rb) - Number(row.before.rb)) > 1e-9)
                bad.push(`${kind}: 「${VEH_HANDLES[name].label}」を引いたら奥行きまで動いた`);
        }
        // 「タイヤの前後」は前と後ろの距離が縮まる（前のタイヤは後ろへ・後ろのタイヤは前へ）。
        // 真ん中の位置は動かない＝左右対称に寄る。
        const wbRow = r.rows?.wb;
        if (wbRow?.before && wbRow.got) {
            const b = wbRow.before,
                a = wbRow.got;
            if (Math.abs(a.wheelMid - b.wheelMid) > 1e-6)
                bad.push(`${kind}: タイヤの前後を動かしたら真ん中まで動いた（${b.wheelMid} → ${a.wheelMid}）`);
            if (Math.abs(a.wb - b.wb) < 0.02) bad.push(`${kind}: タイヤの前後を引いても間隔が変わらない（${b.wb} → ${a.wb}）`);
            // 前のタイヤと後ろのタイヤは「必ず反対向き」に同じ量だけ動く（近づく／離れる）。
            const dFront = a.frontA - b.frontA,
                dRear = a.rearA - b.rearA;
            if (Math.abs(dFront + dRear) > 1e-6)
                bad.push(`${kind}: 前と後ろのタイヤが反対向きに動かない（前 ${dFront} / 後ろ ${dRear}）`);
            if (Math.abs(dFront) < 1e-3) bad.push(`${kind}: タイヤが動いていない`);
            // 間隔を縮めたら前は後ろへ・後ろは前へ、広げたらその逆
            if (a.wb < b.wb && !(dFront > 0 && dRear < 0))
                bad.push(`${kind}: 間隔を縮めたのに前のタイヤが後ろへ寄らない（${b.frontA} → ${a.frontA}）`);
            if (a.wb > b.wb && !(dFront < 0 && dRear > 0))
                bad.push(`${kind}: 間隔を広げたのにタイヤが外へ出ない（${b.frontA} → ${a.frontA}）`);
            // 真ん中からの距離が前後で同じ（左右対称）
            if (Math.abs(Math.abs(a.frontA - a.wheelMid) - Math.abs(a.rearA - a.wheelMid)) > 1e-6)
                bad.push(`${kind}: タイヤの前後が真ん中に対して対称でない`);
        }
        // 「タイヤの上下」は4本とも同じだけ上下し、前後・左右は動かない
        const tzRow = r.rows?.tireZ;
        if (tzRow?.before && tzRow.got) {
            const b = tzRow.before.wheels,
                a = tzRow.got.wheels;
            if (!(tzRow.got.tireZ > tzRow.before.tireZ + 0.02))
                bad.push(`${kind}: 「タイヤの上下」を上へ引いても上がらない（${tzRow.before.tireZ} → ${tzRow.got.tireZ}）`);
            if (b.length !== a.length) bad.push(`${kind}: タイヤの本数が変わった`);
            b.forEach((w, i) => {
                if (Math.abs(w[0] - a[i][0]) > 1e-6 || Math.abs(w[1] - a[i][1]) > 1e-6)
                    bad.push(`${kind}: タイヤを上下させたら左右・前後まで動いた`);
                if (!(a[i][2] > w[2] + 0.02)) bad.push(`${kind}: タイヤ${i + 1} が上がっていない`);
            });
        }
        // 屋根を上げても「下がってる線」「前の面」は動かない（形が崩れない）
        const rh = r.rows?.roofH;
        if (rh && rh.got && rh.before && Math.abs(rh.got.h - rh.before.h) > 0.01) {
            if (Math.abs(rh.got.edgeH - rh.before.edgeH) > 1e-6) bad.push(`${kind}: 屋根を上げたら「下がってる線」まで動いた`);
            if (Math.abs(rh.got.nose - rh.before.nose) > 1e-6) bad.push(`${kind}: 屋根を上げたら前の面まで動いた`);
        }
        // タイヤの太さ・左右を変えても車体の幅は変わらない
        const tw = r.rows?.tireW,
            tr = r.rows?.track;
        if (tw && tw.got && tw.before && Math.abs(tw.got.W - tw.before.W) > 1e-6) bad.push(`${kind}: タイヤの太さを変えたら車体の幅まで変わった`);
        if (tr && tr.got && tr.before && Math.abs(tr.got.W - tr.before.W) > 1e-6) bad.push(`${kind}: タイヤの左右を変えたら車体の幅まで変わった`);
        // タイヤは4つ、前後の位置は前輪 < 後輪、左右は ±で対称
        const wh = r.base.wheels;
        if (wh.length !== 4) bad.push(`${kind}: タイヤが4つでない（${wh.length}）`);
        else {
            const xs = [...new Set(wh.map((w) => w[0]))].sort((a, b) => a - b),
                ys = [...new Set(wh.map((w) => w[1]))].sort((a, b) => a - b);
            if (Math.abs(xs[0] + xs[1]) > 1e-6) bad.push(`${kind}: タイヤの左右が対称でない ${xs}`);
            if (!(ys[0] < ys[1])) bad.push(`${kind}: 前輪と後輪の前後が逆 ${ys}`);
        }
        // 線と面が出ている
        if (!(r.base.lines >= 6)) bad.push(`${kind}: 線が足りない（${r.base.lines}本）`);
        if (!(r.base.tris >= 14)) bad.push(`${kind}: 面が足りない（${r.base.tris}三角形）`);
    }
    {
        for (const [kind, views] of Object.entries(res.vehicleHits || {})) {
            Object.entries(views).forEach(([view, hits]) => {
                Object.entries(hits).forEach(([name, got]) => {
                    if (got !== WANT_NAME[name])
                        bad.push(`${kind}(${view}): ${name} のハンドルが ${got} を掴む（別の寸法が動く）`);
                    if (!got) bad.push(`${kind}(${view}): ${name} のハンドルが掴めない`);
                });
            });
        }
    }
    {
        const vg = res.vehicleGroup || {};
        if (!(vg.inVehicle || []).includes("keiTruck") || !(vg.inVehicle || []).includes("keiVan") || !(vg.inVehicle || []).includes("sedan"))
            bad.push(`車グループに軽トラ・軽バン・乗用車がそろっていない（${vg.inVehicle}）`);
        if ((vg.streetCars || []).length) bad.push(`車が街パーツにも残っている（${vg.streetCars}）`);
        if (vg.adjacent !== 1) bad.push(`「車」が人物の隣にない（${vg.tabs}）`);
        const pt2 = res.penta || {};
        if (pt2.pts !== 5) bad.push(`五角形の立体: 断面が5点でない（${pt2.pts}）`);
        if (pt2.roofEdge !== 2) bad.push(`五角形の立体: 上面が2点でない（${pt2.roofEdge}）`);
        if (!pt2.closed) bad.push("五角形の立体: 断面が閉じていない");
        if (!(pt2.afterH > pt2.yF * 0 + 0.5)) bad.push("五角形の立体: 屋根の高さが変わらない");
        if (!pt2.sameFront) bad.push("五角形の立体: 屋根を上げたら「下がってる線」まで動いた");
        if (!pt2.sameYF) bad.push("五角形の立体: 屋根を上げたら前の面まで動いた");
    }
    for (const [k, r] of Object.entries(res.profiles || {})) {
        if (r.pts !== r.expect) bad.push(`${k}: 断面が ${r.expect}点でない（${r.pts}）`);
        if (!r.closed) bad.push(`${k}: 断面が床で閉じていない`);
        if (Math.abs(r.zMax - r.H) > 1e-6) bad.push(`${k}: 上面の高さが h と違う（${r.zMax} / ${r.H}）`);
        if (k === "sedan" && !(r.rearH > 0.05 && r.rearH < r.H - 0.05))
            bad.push(`sedan: 後ろの下がってる線が無い（${r.rearH}）`);
        if (k === "sedan2" && !(r.frontBoxH < r.H - 0.05 && r.stepY > r.yMin + 0.1 && r.stepY < r.yMax - 0.1))
            bad.push(`sedan2: 前の箱と後ろの箱に分かれていない（前 ${r.frontBoxH} / 後ろ ${r.H} / 境目 ${r.stepY}）`);
        if (k === "pentaBox" && r.rearH > 0) bad.push("pentaBox: 後ろが斜めになっている（五角形でなくなった）");
    }
    for (const [kind, r] of Object.entries(res.signShape)) {
        if (!r.placed) {
            bad.push(`${kind}: 置けない`);
            continue;
        }
        const isSign = ["signPost", "signPost2", "signTriangle", "signDiamond", "signCombo"].includes(kind);
        if (!isSign) {
            // 信号機・踏切標識は専用の形。標識パネルは出さない。
            if (r.panel) bad.push(`${kind}: 標識パネルが出ている`);
            continue;
        }
        if (!r.panel) bad.push(`${kind}: 標識の形パネルが出ない`);
        // 既定が2枚の標識（標識2枚・標識2枚（三角＋丸））は、最初から「2枚目の形」が出ていてよい。
        if (r.row2Before !== (r.base.count === 2)) bad.push(`${kind}: 「2枚目の形」の出方が枚数と合わない`);
        if (!r.row2At2) bad.push(`${kind}: 2枚にしても「2枚目の形」が出ない`);
        // 1枚×2枚 × 4形×4形 = 32通り。どれも線と面が出て、枚数・形が指定どおりになる。
        for (const [key, v] of Object.entries(r.rows || {})) {
            const [count, pair] = key.split("/"),
                [a, b] = pair.split("+");
            if (v.count !== Number(count)) bad.push(`${kind} ${key}: 枚数が入っていない（${v.count}）`);
            if (v.shape !== a) bad.push(`${kind} ${key}: 板の形が入っていない（${v.shape}）`);
            if (Number(count) === 2 && v.shape2 !== b) bad.push(`${kind} ${key}: 2枚目の形が入っていない（${v.shape2}）`);
            if (!(v.lines >= 12)) bad.push(`${kind} ${key}: 線が足りない（${v.lines}本）`);
            if (!(v.tris >= 24)) bad.push(`${kind} ${key}: 面が足りない（${v.tris}三角形）`);
            // 板の幅とポールの高さは形を変えても動かない
            if (Math.abs(v.headW - r.base.headW) > 1e-6) bad.push(`${kind} ${key}: 形を変えたら板の幅が変わった`);
        }
        // 枚数を変えても板の幅・ポールの高さは変わらない
        if (Math.abs(r.two.headW - r.base.headW) > 1e-6) bad.push(`${kind}: 2枚にしたら板の幅が変わった`);
        if (Math.abs(r.two.h - r.base.h) > 1e-6) bad.push(`${kind}: 2枚にしたら全体の高さが変わった`);
        if (Math.abs(r.back.headW - r.base.headW) > 1e-6) bad.push(`${kind}: 1枚に戻したら板の幅が変わった`);
        // 1枚と2枚で見た目が変わる（線の数が同じなら板が増えていない）
        if (r.rows && r.rows["1/circle+circle"].lines === r.rows["2/circle+circle"].lines)
            bad.push(`${kind}: 1枚と2枚で線の数が同じ（板が増えていない）`);
    }
    for (const [kind, rows] of Object.entries(res.counterShapes)) {
        if (kind === "groups" || kind === "streetLeft") continue;
        if (!Array.isArray(rows)) continue;
        rows.forEach((r) => {
            if (Math.abs(r.area - r.expect) > 0.02)
                bad.push(`${kind}(${r.w}×${r.d}): 形が L字/コの字になっていない（面積 ${r.area} / 期待 ${r.expect}）`);
            if (!(r.arm <= Math.min(r.w, r.d) * 0.63))
                bad.push(`${kind}(${r.w}×${r.d}): 腕が太すぎて凹みが消える（腕 ${r.arm}）`);
            if (!(r.tris >= 4)) bad.push(`${kind}(${r.w}×${r.d}): 土台の面が作れない`);
        });
    }
    (res.counterShapes.groups || []).forEach(([k, group]) => {
        if (group !== "furniture") bad.push(`${k}: 家具グループに入っていない（${group}）`);
    });
    if (res.counterShapes.streetLeft) bad.push(`街パーツにカウンターが残っている（${res.counterShapes.streetLeft}枚）`);
    const WANT_HIT = {
        length: "counter-length",
        depth: "counter-depth",
        topT: "counter-top-t",
        baseH: "counter-base-h",
        arm: "counter-arm",
    };
    for (const [kind, views] of Object.entries(res.counterHits)) {
        Object.entries(views).forEach(([view, hits]) => {
            Object.entries(hits).forEach(([name, got]) => {
                if (got !== WANT_HIT[name])
                    bad.push(`${kind}(${view}): ${name} のハンドルが ${got} を掴む（別の寸法が動く）`);
            });
            // まっすぐなカウンターには腕のハンドルが無い
            if (kind === "counter" && hits.arm)
                bad.push(`counter(${view}): まっすぐなカウンターに腕のハンドルが出ている`);
        });
    }
    for (const [kind, r] of Object.entries(res.counter)) {
        if (!r.placed) {
            bad.push(`${kind}: 置けない`);
            continue;
        }
        ["counter-length", "counter-depth", "counter-top-t", "counter-base-h"].forEach((k) => {
            if (!r.kinds.includes(k)) bad.push(`${kind}: ハンドル ${k} が出ない`);
        });
        const a = r.after;
        if (!(Math.abs(a.depth.D - 2 * r.d0 - r.want.depth) < 0.06))
            bad.push(`${kind}: 奥行きのハンドルで縦の長さが変わらない（${2 * r.d0} → ${a.depth.D}）`);
        if (!(Math.abs(a.length.ra - r.ra - r.want.length / 2) < 0.05))
            bad.push(`${kind}: 長さのハンドルで幅が変わらない（${r.ra} → ${a.length.ra}）`);
        // 長さを変えても天板の厚さは変わらない
        if (!(Math.abs(a.length.topT - r.topT) < 1e-6)) bad.push(`${kind}: 長さを変えたら天板の厚さまで変わった`);
        if (!(Math.abs(a.topT.topT - r.topT - r.want.topT) < 0.02))
            bad.push(`${kind}: 天板の厚さが変わらない（${r.topT} → ${a.topT.topT}）`);
        // 天板を厚くしても全体の高さは変わらない（上端はそのまま・土台が縮む）
        if (!(Math.abs(a.topT.h - r.h) < 1e-6)) bad.push(`${kind}: 天板の厚さを変えたら全体の高さまで変わった`);
        // 土台の高さを上げると、全体の高さも同じだけ上がる（天板は土台の上に載る）
        if (!(a.baseH.h > a.topT.h + r.want.baseH * 0.5))
            bad.push(`${kind}: 土台のハンドルで高さが上がらない（${a.topT.h} → ${a.baseH.h}）`);
        if (!(Math.abs(a.baseH.h - a.topT.h - (a.baseH.baseH - a.topT.baseH)) < 1e-6))
            bad.push(`${kind}: 土台を上げた分と全体の高さの増分が合わない`);
        // 腕の太さ（コの字の棒の太さ）。L字・コの字には出て、普通のカウンターには出ない。
        if (kind === "counter") {
            if (r.armAt) bad.push("counter: まっすぐなカウンターに腕のハンドルが出ている");
        } else {
            if (!r.armAt) bad.push(`${kind}: 腕の太さのハンドルが出ない`);
            else if (!(Math.abs(r.after.arm.arm - 0.55 - r.want.arm) < 0.03))
                bad.push(`${kind}: 腕の太さが変わらない（0.55 → ${r.after.arm.arm}）`);
            if (r.after.arm && Math.abs(r.after.arm.area - r.after.arm.expect) > 0.02)
                bad.push(`${kind}: 腕を太くしたら形が崩れた（面積 ${r.after.arm.area} / 期待 ${r.after.arm.expect}）`);
            // 腕を太くしても高さ・幅・奥行きは変わらない
            if (r.after.arm && (Math.abs(r.after.arm.h - r.after.baseH.h) > 1e-6 || Math.abs(r.after.arm.W - 2 * r.after.length.ra) > 1e-6))
                bad.push(`${kind}: 腕を太くしたら高さ・幅まで変わった`);
        }
        // 凹んだ形（L字・コの字）でも面と線が出ている
        if (!(r.tris >= 24)) bad.push(`${kind}: 面が足りない（${r.tris}三角形）`);
        if (!(r.lines >= 12)) bad.push(`${kind}: 線が足りない（${r.lines}本）`);
    }
    for (const [k, v] of Object.entries(res.items)) {
        if (!v.placed) {
            bad.push(`${k}: 棚から置けない`);
            continue;
        }
        if (!(v.lines > 0)) bad.push(`${k}: 線が出ていない`);
        // 舗道は意図的に箱1個＋面を増やさないタイル線で軽量化している。
        if (k === "streetPavement") {
            if (v.tris !== 12 || v.lines <= 6) bad.push(`${k}: 床12三角形とタイル線を確認できない（${v.tris}面、${v.lines}線）`);
        } else if (!(v.tris > 12)) bad.push(`${k}: 面が箱だけ（${v.tris}三角形）`);
        if (!(v.inkOn > 0)) bad.push(`${k}: 面ONで線が全部消えている`);
        if (v.inkOn < v.inkOff * 0.3) bad.push(`${k}: 面ONで線が消えすぎ（${v.inkOn}/${v.inkOff}）`);
        if (!v.rotFollows) bad.push(`${k}: 回転に線が追従しない`);
        // 単体提灯は基本の幅・奥行き・高さのみで形が決まる。
        if (!["paperLantern", "shopAwning", "shopWindow", "squareStool"].includes(k) && !v.paramReacts) bad.push(`${k}: 固有値を変えても形が変わらない（param を読んでいない）`);
        if (!v.jsonSame) bad.push(`${k}: JSON 経由で線が変わる`);
    }
    console.log(JSON.stringify(res, null, 1));
    if (errors.length) bad.push("ページエラー: " + errors.join(" / "));
    console.log(bad.length ? "NG\n  " + bad.join("\n  ") : `OK（キット製アセット ${kinds.length} 種）`);
    await browser.close();
    process.exit(bad.length ? 1 : 0);
})();
