/* City Grid Studio asset controller.
   This file wires the asset generator to the shelf, JSON import, clipboard,
   and primitive quick menu. The geometry itself lives in asset.js. */
"use strict";

window.cityGridInstallAssetUI = function (bridge) {
    const {
        el,
        stage,
        setStudioWorkspace,
        validStroke,
        sanitizeScene,
        fitFloorPlan,
        syncFloorPlanDockLayout,
        sceneObjects,
    } = bridge;
    function groundAt(p) {
        const q = hit3(unscr(p), 1, -1, camPos());
        if (q && Number.isFinite(q[0]) && Number.isFinite(q[2])) return q;
        return [0, -1, 4];
    }
    function assetGroundPoint() {
        // Asset buttons place objects on the ground a short distance in front of the camera,
        // rather than at the far intersection of a nearly horizontal ray.
        const yaw = P.yaw * DG,
            depth = Math.max(1, Math.min(20, Number(P.assetDepth) || 5)),
            f = [-Math.sin(yaw), 0, Math.cos(yaw)];
        return [P.cx + f[0] * depth, -1, P.cz + f[2] * depth];
    }
    function newAsset(kind, p, worldPoint = null) {
        const info = ASSETS[kind],
            isDefault = !p && !worldPoint;
        p = p || { x: W * 0.5, y: H * 0.62 };
        let q = worldPoint || (isDefault ? assetGroundPoint() : groundAt(p));
        if (!q || !q.every(Number.isFinite)) q = assetGroundPoint();
        // Repeated clicks are fanned out slightly so a new object cannot hide exactly under the previous one.
        if (isDefault) {
            const n = sceneObjects().length;
            q = [q[0] + ((n % 4) - 1.5) * 0.85, q[1], q[2] + Math.floor(n / 4) * 1.05];
        }
        // 生成方向は「その軸に立つ面」の法線。Y=地面、X/Z=壁面として配置する。
        const k = clamp(Math.round(Number(P.assetAxis ?? 1)), 0, 2),
            d = -1,
            [iu, iv] = PL[k],
            off = [0, 0, 0];
        // L2Wの基準面は d=-1 なので、選んだ点へ基準面を平行移動する。
        off[k] = q[k] - d;
        const base = {
            id: uid(),
            k,
            d,
            off,
            ca: q[iu],
            cb: q[iv],
            rot: 0,
            lift: 0,
            wf: true,
            c: el("pc").value || "#222222",
            w: MASTER_W,
            accent: info.accent,
        };
        const height = kind === "person" ? Number(P.hm) || 1.7 : info.h;
        if (kind === "rect" || kind === "circle")
            return {
                ...base,
                type: kind === "circle" ? "circ" : "rect",
                asset: kind,
                ra: info.w / 2,
                rb: info.d / 2,
                h: 0,
                extrude: false,
            };
        return {
            ...base,
            type: "asset",
            asset: kind,
            ra: info.w / 2,
            rb: info.d / 2,
            h: height,
            pose: kind === "person" ? "stand" : undefined,
            bodyScale: kind === "person" ? 1 : undefined,
            shoulderScale: kind === "person" ? 1 : undefined,
            headScale: kind === "person" ? 1 : undefined,
            legSpread: kind === "person" ? 1 : undefined,
            faceW: kind === "sign" ? info.w * 0.7 : undefined,
            faceH: kind === "sign" ? info.h * 0.34 : undefined,
            openingW: kind === "building" ? info.w * 0.56 : undefined,
            openingH: kind === "building" ? info.h * 0.66 : undefined,
            awningEdgeZ: kind === "awning" ? height : undefined,
            awningEdgeY: kind === "awning" ? -info.d / 2 : undefined,
            awningThickness: kind === "awning" ? Math.max(0.05, height * 0.14) : undefined,
            awningFrontBottom: kind === "awning" ? 0 : undefined,
            awningBackBottom: kind === "awning" ? 0 : undefined,
            awningEdgeEdited: kind === "awning" ? false : undefined,
            steps: kind === "stairs" ? Math.round(Number(el("stairsSteps")?.value) || 6) : undefined,
            handrail: kind === "stairs" ? !!el("stairsRail")?.checked : undefined,
            stripes: kind === "crosswalk" ? 7 : undefined,
        };
    }
    function placeLinkedAsset(kind, p) {
        const childKind = kind === "buildingAwning" ? "awning" : "rect",
            q = p ? groundAt(p) : assetGroundPoint(),
            parent = newAsset(kind === "buildingAwning" ? "rect" : "building", null, q),
            child = newAsset(childKind, null, q),
            groupId = "linked-" + uid();
        if (kind === "buildingAwning") {
            parent.ra = ASSETS.building.w / 2;
            parent.rb = ASSETS.building.d / 2;
            parent.h = ASSETS.building.h;
            parent.extrude = true;
            parent.accent = "#d98b68";
        }
        parent.groupId = child.groupId = groupId;
        parent.linkedAsset = child.linkedAsset = kind;
        parent.linkedRole = "parent";
        child.linkedRole = "child";
        // 開口側（建物のローカルYマイナス面）へ接着する。
        // 反対側へ回り込まないよう、親の回転に追従するローカル面として保持する。
        child.attachment = {
            parentId: parent.id,
            side: -1,
            x: 0,
            baseZ: kind === "buildingAwning" ? parent.h * 0.52 : parent.h * 0.56,
            offsetZ: 0,
            rotOffset: 0,
            verticalOnly: true,
        };
        if (kind === "buildingSign") {
            child.ra = parent.ra * 0.72;
            child.rb = Math.max(0.12, parent.rb * 0.16);
            child.h = Math.max(0.35, parent.h * 0.23);
            child.extrude = true;
            child.accent = "#66e3c8";
        } else {
            child.ra = parent.ra * 0.46;
            child.rb = Math.max(0.18, parent.rb * 0.3);
            child.h = Math.max(0.28, parent.h * 0.2);
            child.awningEdgeZ = child.h;
            child.awningEdgeY = -child.rb;
            child.awningThickness = Math.max(0.04, child.h * 0.14);
            child.awningFrontBottom = 0;
            child.awningBackBottom = 0;
            child.awningEdgeEdited = false;
        }
        const attached = syncAttachedPart(child, parent);
        return { parent, child: attached };
    }
    function placeLinkedAssetInstance(kind, p) {
        sanitizeScene();
        const before = S.slice(),
            wasFloor = !!window.cityFloorPlanActive;
        try {
            const bundle = placeLinkedAsset(kind, p),
                lines = [...genShape(bundle.parent), ...genShape(bundle.child)];
            if (!lines.length || lines.some((s) => !validStroke(s)))
                throw new Error("linked asset geometry is empty or malformed");
            HU.push(S);
            RD = [];
            S = [...S, ...lines];
            // 接続アセットは、配置直後から看板／テントの編集ハンドルを表示する。
            setSelection(bundle.child.id, false);
            tool = "edit";
            setMode("draw");
            if (wasFloor) {
                fitFloorPlan();
                setMode("draw");
            } else if (kind === "buildingSign") setStudioWorkspace("perspective");
            syncSel();
            render();
        } catch (err) {
            S = before;
            prev = null;
            clearSelection();
            console.error("City Grid linked asset error", err);
            try {
                render();
            } catch (e) {}
            alert("接続アセットを配置できませんでした。もう一度クリックしてください。");
        }
    }
    function placeAsset(kind, p) {
        if (kind === "buildingAwning" || kind === "buildingSign") return placeLinkedAssetInstance(kind, p);
        sanitizeScene();
        const before = S.slice(),
            wasFloor = !!window.cityFloorPlanActive;
        try {
            const o = newAsset(kind, p),
                lines = genShape(o);
            if (!lines.length || lines.some((s) => !validStroke(s)))
                throw new Error("asset geometry is empty or malformed");
            HU.push(S);
            RD = [];
            S = [...S, ...lines];
            setSelection(o.id, false);
            tool = "edit";
            setMode("draw");
            // 間取りから追加したアセットは、そのまま間取りに留めて選択状態を保つ。
            if (wasFloor) {
                fitFloorPlan();
                setMode("draw");
            } else if (kind === "person") setStudioWorkspace("character");
            syncSel();
            render();
        } catch (err) {
            S = before;
            prev = null;
            clearSelection();
            console.error("City Grid asset error", err);
            try {
                render();
            } catch (e) {}
            alert("アセットを配置できませんでした。壊れた線は取り除きました。もう一度クリックしてください。");
        }
    }

    // オブジェクト用クリップボード。線画のクリップボードとは分けて、選択中の
    // 図形／アセット定義だけをコピーし、貼り付け時に新しいIDで再生成する。
    let objectClipboard = [];
    function copySelectedObjects() {
        const objects = selectedObjects();
        if (!objects.length) return false;
        objectClipboard = objects.map((o) => JSON.parse(JSON.stringify(o)));
        return true;
    }
    function pasteObjectClipboard() {
        if (!objectClipboard.length) return false;
        sanitizeScene();
        const before = S.slice(),
            added = [];
        try {
            const lines = [],
                groupMap = new Map(),
                idMap = new Map(objectClipboard.map((source) => [source.id, uid()]));
            objectClipboard.forEach((source, i) => {
                const n = JSON.parse(JSON.stringify(source));
                n.id = idMap.get(source.id);
                n.off = [...(n.off || [0, 0, 0])];
                if (source.attachment?.parentId && idMap.has(source.attachment.parentId))
                    n.attachment = { ...source.attachment, parentId: idMap.get(source.attachment.parentId) };
                if (source.groupId) {
                    if (!groupMap.has(source.groupId)) groupMap.set(source.groupId, "group-" + uid());
                    n.groupId = groupMap.get(source.groupId);
                }
                // 元の場所を保ちつつ、貼り付け先が見つけやすいようにca方向へ少しずらす。
                const shift = Math.max(0.35, Math.abs(Number(n.ra) || 0.25) * 2.4) + i * 0.18;
                if (n.type === "compound") Object.assign(n, moveBy(n, [shift, 0, 0]));
                else if (!n.attachment?.parentId) {
                    n.ca = Number(n.ca) || 0;
                    n.ca += shift;
                }
                const made = genShape(n);
                if (!made.length || made.some((s) => !validStroke(s)))
                    throw new Error("pasted object geometry is empty or malformed");
                lines.push(...made);
                added.push(n.id);
            });
            HU.push(S);
            RD = [];
            S = [...S, ...lines];
            regenObjects();
            setSelection(added[0], false);
            added.slice(1).forEach((id) => setSelection(id, true));
            tool = "edit";
            setMode("draw");
            if (window.cityFloorPlanActive) {
                fitFloorPlan();
                setMode("draw");
            }
            render();
            return true;
        } catch (err) {
            S = before;
            console.error("City Grid object paste error", err);
            render();
            return false;
        }
    }

    function linkedDefsFromImportedCompound(source) {
        if (source?.type !== "compound" || !Array.isArray(source.parts)) return null;
        const shift = [Number(source.tx) || 0, Number(source.ty) || 0, Number(source.tz) || 0],
            parts = source.parts.map((part) => translateDefinition(fixOb(part), shift));
        const awning = parts.find((part) => part.asset === "awning"),
            building = parts.find((part) => part.asset === "building"),
            rects = parts.filter((part) => part.type === "rect" && part.asset === "rect");
        const child = awning || (building && rects.length ? rects[0] : null),
            parent = awning
                ? parts.find((part) => part !== awning && (part.type === "rect" || part.asset === "building")) ||
                  parts[0]
                : building;
        if (!parent || !child) return null;
        const kind = awning ? "buildingAwning" : "buildingSign",
            groupId = "linked-" + uid(),
            p = { ...parent, id: uid(), groupId, linkedAsset: kind, linkedRole: "parent" },
            q = { ...child, id: uid(), groupId, linkedAsset: kind, linkedRole: "child" };
        const pb = L2W(p, 0, 0, 0),
            cb = L2W(q, 0, 0, 0),
            dx = cb[0] - pb[0],
            dz = cb[2] - pb[2],
            r = Number(p.rot || 0) * DG;
        // 添付データの現在位置ではなく、開口側のローカルYマイナス面へ補正する。
        q.attachment = {
            parentId: p.id,
            side: -1,
            x: dx * Math.cos(r) + dz * Math.sin(r),
            baseZ: cb[1] - pb[1],
            offsetZ: 0,
            rotOffset: 0,
            verticalOnly: true,
        };
        return [p, syncAttachedPart(q, p)];
    }
    function importObjectPayload(data) {
        const sources = Array.isArray(data?.objects) ? data.objects : data?.type === "compound" ? [data] : [];
        if (!sources.length) throw new Error("objects are missing");
        const defs = [];
        sources.forEach((source) => {
            const linked = linkedDefsFromImportedCompound(source);
            if (linked) defs.push(...linked);
            else if (source.type === "compound")
                defs.push({
                    ...source,
                    id: uid(),
                    parts: (source.parts || []).map((part) => ({ ...fixOb(part), id: uid() })),
                });
            else defs.push({ ...fixOb(source), id: uid() });
        });
        sanitizeScene();
        const lines = defs.flatMap((def) => genShape(def));
        if (!lines.length || lines.some((s) => !validStroke(s)))
            throw new Error("imported geometry is empty or malformed");
        HU.push(S);
        RD = [];
        S = [...S, ...lines];
        clearSelection();
        defs.forEach((def) => selIds.add(def.id));
        sel = (defs.find((def) => def.linkedRole === "child") || defs[0])?.id || null;
        normalizeSelection();
        tool = "edit";
        setMode("draw");
        if (window.cityFloorPlanActive) fitFloorPlan();
        syncSel();
        render();
    }

    // Rectangle/circle and the other primitives are created from the asset shelf.
    // ===== Asset shelf on the canvas =====
    const tray = document.createElement("div");
    tray.id = "assetTray";
    tray.innerHTML =
        '<div class="assetTrayInner"><div class="assetTrayTitle">シーンに追加</div><div class="assetTrayTools"><label>生成面<select id="assetAxisTray"><option value="1">Y：地面／上下</option><option value="0">X：左右の面</option><option value="2">Z：正面／背面</option></select></label></div><div class="assetClipboardTools"><button type="button" id="objectCopy">コピー</button><button type="button" id="objectPaste" disabled>貼り付け</button><button type="button" id="objectImportButton">JSON読込</button><input id="objectImportFile" type="file" accept="application/json,.json" hidden></div>' +
        Object.entries(ASSETS)
            .map(
                ([k, v]) =>
                    `<button class="assetCard" data-asset="${k}" title="${v.label}を追加"><span class="assetGlyph">${v.glyph}</span><span>${v.label}</span></button>`,
            )
            .join("") +
        "</div>";
    stage.appendChild(tray);
    const assetAxisTrayInput = el("assetAxisTray");
    window.cityGridAssetAxisTray = assetAxisTrayInput;
    const setAssetAxis = (value) => {
        P.assetAxis = clamp(Math.round(Number(value)), 0, 2);
        if (bridge.syncAssetAxis) bridge.syncAssetAxis();
        render();
    };
    assetAxisTrayInput.onchange = () => setAssetAxis(assetAxisTrayInput.value);
    if (bridge.syncAssetAxis) bridge.syncAssetAxis();
    tray.addEventListener("click", (e) => {
        const b = e.target.closest("[data-asset]");
        if (b) placeAsset(b.dataset.asset);
    });
    const objectCopyButton = el("objectCopy"),
        objectPasteButton = el("objectPaste"),
        objectImportButton = el("objectImportButton"),
        objectImportFile = el("objectImportFile");
    objectCopyButton.onclick = () => {
        if (!copySelectedObjects()) return;
        objectPasteButton.disabled = false;
        const label = objectCopyButton.textContent;
        objectCopyButton.textContent = "コピー済み";
        setTimeout(() => (objectCopyButton.textContent = label), 900);
    };
    objectPasteButton.onclick = () => {
        if (pasteObjectClipboard()) {
            objectPasteButton.disabled = false;
            const label = objectPasteButton.textContent;
            objectPasteButton.textContent = "貼り付け済み";
            setTimeout(() => (objectPasteButton.textContent = label), 900);
        }
    };
    objectImportButton.onclick = () => objectImportFile?.click();
    objectImportFile.onchange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        f.text()
            .then((text) => {
                const data = JSON.parse(text);
                if (data.app === "perspective-ruler-grid") unpack(data);
                else importObjectPayload(data);
            })
            .catch((err) => {
                console.error("City Grid object import error", err);
                alert("オブジェクトJSONを読み込めませんでした");
            });
        e.target.value = "";
    };
    // 選択中オブジェクトを、後から線画化できるテキストJSONとして取り出す。
    // 線そのものではなく定義を保存するので、寸法・向き・ポーズ・アセット固有値を保てる。
    const objectInfoCopyButton = el("objectInfoCopy"),
        objectInfoSaveButton = el("objectInfoSave");
    function objectInfoPayload() {
        const objects = selectedObjects().map((o) => {
            const q = JSON.parse(JSON.stringify(o));
            delete q.surface;
            delete q.surfaceColor;
            delete q.surfaceAlpha;
            if (q.asset === "sign") delete q.bevel;
            return q;
        });
        return {
            format: "city-grid-studio-object-v1",
            coordinateSystem: {
                local: "x=幅／左右, y=奥行／前後, z=高さ／上",
                planeAxis: "k=0:X面, k=1:Y面(地面), k=2:Z面",
                rotation: "rotは度",
                halfSize: "ra/rbは幅・奥行の半分",
            },
            renderMode: { surface: !!P.surfaceMode, backfaceRemoval: !!P.surfaceMode },
            objects,
        };
    }
    function objectInfoText() {
        return JSON.stringify(objectInfoPayload(), null, 2);
    }
    function writeTextToClipboard(text) {
        if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand("copy");
        } finally {
            ta.remove();
        }
        return Promise.resolve();
    }
    function flashObjectInfoButton(button, label) {
        if (!button) return;
        const before = button.textContent;
        button.textContent = label;
        setTimeout(() => (button.textContent = before), 900);
    }
    function syncObjectInfoActions() {
        const disabled = !selectedObjects().length;
        if (objectInfoCopyButton) objectInfoCopyButton.disabled = disabled;
        if (objectInfoSaveButton) objectInfoSaveButton.disabled = disabled;
        const sceneDeleteButton = el("sceneDeleteButton");
        if (sceneDeleteButton) sceneDeleteButton.disabled = disabled;
    }
    window.cityGridSyncObjectInfoActions = syncObjectInfoActions;
    if (objectInfoCopyButton)
        objectInfoCopyButton.onclick = () => {
            if (!selectedObjects().length) return;
            writeTextToClipboard(objectInfoText())
                .then(() => flashObjectInfoButton(objectInfoCopyButton, "コピー済み"))
                .catch(() => alert("オブジェクト情報をコピーできませんでした"));
        };
    if (objectInfoSaveButton)
        objectInfoSaveButton.onclick = () => {
            if (!selectedObjects().length) return;
            const a = document.createElement("a"),
                url = URL.createObjectURL(new Blob([objectInfoText()], { type: "application/json" }));
            a.href = url;
            a.download = "city-grid-object.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            flashObjectInfoButton(objectInfoSaveButton, "保存済み");
        };
    addEventListener("keydown", (e) => {
        if (!(e.ctrlKey || e.metaKey) || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
        if (e.key.toLowerCase() === "c" && selectedObjects().length) {
            e.preventDefault();
            objectCopyButton.click();
        } else if (e.key.toLowerCase() === "v" && objectClipboard.length) {
            e.preventDefault();
            objectPasteButton.click();
        }
    });
    el("assetToggle").onclick = () => {
        tray.style.display = tray.style.display === "block" ? "none" : "block";
        el("assetToggle").classList.toggle("on", tray.style.display === "block");
        tray.classList.toggle("floorAssetTray", !!window.cityFloorPlanActive && tray.style.display === "block");
        requestAnimationFrame(syncFloorPlanDockLayout);
    };

    // ===== iPad four-finger primitive quick menu =====
    // 4本指タップで開く、長方形・円・円錐・球体・三角柱・三角錐専用の小型メニュー。
    const primitiveKinds = ["rect", "circle", "cone", "sphere", "triPrism", "triPyramid"];
    const primitiveMenu = document.createElement("div");
    primitiveMenu.id = "primitiveQuickMenu";
    primitiveMenu.innerHTML =
        '<div class="primitiveMenuTitle">プリミティブを追加</div><div class="primitiveMenuGrid">' +
        primitiveKinds
            .map((k) => {
                const v = ASSETS[k];
                return `<button class="primitiveCard" data-primitive="${k}"><b>${v.glyph}</b><small>${v.label}</small></button>`;
            })
            .join("") +
        '</div><div class="primitiveMenuSub">4本指タップで開閉　・　選ぶと現在の生成方向へ配置</div>';
    stage.appendChild(primitiveMenu);
    function togglePrimitiveMenu() {
        primitiveMenu.classList.toggle("open");
    }
    function closePrimitiveMenu() {
        primitiveMenu.classList.remove("open");
    }
    window.cityPrimitiveMenuToggle = togglePrimitiveMenu;
    primitiveMenu.addEventListener("click", (e) => {
        const b = e.target.closest("[data-primitive]");
        if (!b) return;
        placeAsset(b.dataset.primitive);
        closePrimitiveMenu();
    });
    document.addEventListener("pointerdown", (e) => {
        if (!e.target.closest("#primitiveQuickMenu") && !e.target.closest("#cv")) closePrimitiveMenu();
    });
};
