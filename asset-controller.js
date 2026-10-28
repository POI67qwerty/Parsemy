/* City Grid Studio asset controller.
   アセットの配置・接続・JSON入出力・棚UIを担当する。

   処理の流れ
   0. ASSETS               : asset.js の定義表（棚の並び順もここに従う）
   1. newAsset             : 初期位置、生成面、寸法、固有値を持つ定義を作る
   2. placeAsset           : 線画を生成してSへ登録し、選択状態を更新する
   3. placeLinkedAsset     : 建物とテント／看板などの親子接続を作る
   4. import / clipboard   : 定義だけを保存・複製し、新しいIDで再生成する
   5. 棚UI                 : ボタン入力を上記処理へ接続する

   線画の形状は asset.js、基本のオブジェクト編集は engine-core.js、
   ギズモ操作は engine-tools.js が担当する。 */
"use strict";

// studio-ui.jsから受け取ったDOM・状態ブリッジを使って、アセット操作を登録する。
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
    // ===== 1. 接地と配置位置 =====
    function groundAt(p) {
        const q = hit3(unscr(p), 1, -1, camPos());
        if (q && Number.isFinite(q[0]) && Number.isFinite(q[2])) return q;
        return [0, -1, 4];
    }
    // アセット配置に関する値を一か所へ集約する。
    // カメラから近すぎて画面外へ出ないよう、寸法・レンズ・画面サイズから
    // 必要距離を見積もり、入力された配置距離は「最小距離」として扱う。
    const ASSET_PLACEMENT = Object.freeze({
        minDepth: 1,
        maxDepth: 80,
        defaultDepth: 5,
        screenFill: 0.52,
        margin: 1.15,
        fanMin: 0.85,
        fanMax: 6,
    });
    function assetPlacementDepth(info = null) {
        const w = Math.abs(Number(info?.w) || 1),
            d = Math.abs(Number(info?.d) || 1),
            h = Math.abs(Number(info?.h) || 1),
            span = Math.max(w, d, h, 1),
            focal = (W * Math.max(14, Number(P.lens) || 50)) / 36,
            viewport = Math.max(240, Math.min(W, H)),
            fit = (focal * span * ASSET_PLACEMENT.margin) / (viewport * ASSET_PLACEMENT.screenFill),
            requested = Number(P.assetDepth);
        return Math.min(
            ASSET_PLACEMENT.maxDepth,
            Math.max(
                ASSET_PLACEMENT.minDepth,
                Number.isFinite(requested) ? requested : ASSET_PLACEMENT.defaultDepth,
                fit,
            ),
        );
    }
    function assetGroundPoint(info = null) {
        // アセットボタンは、ほぼ水平なレイとの遠い交点ではなく、
        // 画面内へ余白を残せる距離の地面へ配置する。
        const yaw = P.yaw * DG,
            depth = assetPlacementDepth(info),
            f = [-Math.sin(yaw), 0, Math.cos(yaw)];
        return [P.cx + f[0] * depth, -1, P.cz + f[2] * depth];
    }
    // アセット棚での1回の追加に対応する定義を作る。
    // 生成面（P.assetAxis）をkへ変換し、アセット固有の初期値もここで付ける。
    // ===== 2. アセットの初期値（形状・寸法・固有名） =====
    function newAsset(kind, p, worldPoint = null) {
        const info = ASSETS[kind],
            isDefault = !p && !worldPoint;
        p = p || { x: W * 0.5, y: H * 0.62 };
        let q = worldPoint || (isDefault ? assetGroundPoint(info) : groundAt(p));
        if (!q || !q.every(Number.isFinite)) q = assetGroundPoint(info);
        // Repeated clicks are fanned out slightly so a new object cannot hide exactly under the previous one.
        if (isDefault) {
            const n = sceneObjects().length,
                span = Math.max(
                    Math.abs(Number(info?.w) || 1),
                    Math.abs(Number(info?.d) || 1),
                    Math.abs(Number(info?.h) || 1),
                ),
                fan = clamp(span * 0.28, ASSET_PLACEMENT.fanMin, ASSET_PLACEMENT.fanMax);
            q = [q[0] + ((n % 4) - 1.5) * fan, q[1], q[2] + Math.floor(n / 4) * fan * 1.2];
        }
        // 生成方向は「その軸に立つ面」の法線。Y=地面、X/Z=壁面として配置する。
        const k = kind === "balcony" ? 1 : clamp(Math.round(Number(P.assetAxis ?? 1)), 0, 2),
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
        if (kind === "recessedStackedBuilding") {
            const floorCount = Math.max(1, Math.min(30, Math.round(Number(info.recessedFloorCount) || 4))),
                floorHeight = Math.max(0.5, Number(info.recessedFloorHeight) || 2.1),
                firstFloorExtra = Math.max(
                    0,
                    Number.isFinite(Number(info.recessedFirstFloorExtra)) ? Number(info.recessedFirstFloorExtra) : 0.35,
                ),
                floorGap = Math.max(0, Number.isFinite(Number(info.recessedFloorGap)) ? Number(info.recessedFloorGap) : 1.25),
                totalH = floorCount * floorHeight + firstFloorExtra + Math.max(0, floorCount - 1) * floorGap;
            return {
                ...base,
                type: "asset",
                asset: kind,
                assetId: "recessed-stacked-building",
                assetName: info.label,
                k: 1,
                d: -1,
                off: [q[0], 0, q[2]],
                ca: 0,
                cb: 0,
                ra: info.w / 2,
                rb: info.d / 2,
                h: totalH,
                recessedFloorCount: floorCount,
                recessedFloorHeight: floorHeight,
                recessedFirstFloorExtra: firstFloorExtra,
                recessedFloorGap: floorGap,
                recessedCornerBevel: info.recessedCornerBevel,
                recessedCornerBevelSegments: info.recessedCornerBevelSegments,
                recessedWindowW: info.recessedWindowW,
                recessedWindowCount: info.recessedWindowCount,
                recessedWindowH: info.recessedWindowH,
                recessedWindowDepth: info.recessedWindowDepth,
                recessedWindowBottom: info.recessedWindowBottom,
                recessedSillHeight: info.recessedSillHeight ?? info.recessedWindowBottom,
                recessedBeamHeight: info.recessedBeamHeight,
                recessedBeamProjection: info.recessedBeamProjection,
                recessedSideWindowW: info.recessedSideWindowW,
                recessedWindowMarginLeft: info.recessedWindowMarginLeft,
                recessedWindowMarginEnd: info.recessedWindowMarginEnd,
                recessedJunctionOffset: info.recessedJunctionOffset || 0,
                recessedSideWindows: info.recessedSideWindows !== false,
            };
        }
        if (kind === "stackedBuilding" || kind === "beveledStackedBuilding") {
            const beveled = kind === "beveledStackedBuilding",
                floorHeight = 2.2,
                floorGap = 0.06,
                floors = Array.from({ length: 4 }, (_, i) => ({
                    name: `${i + 1}F`,
                    x: 0,
                    y: 0,
                    z: i * (floorHeight + floorGap),
                    w: info.w,
                    d: info.d,
                    h: floorHeight,
                    rimHeight: 0.16,
                    rimOverhang: 0.18,
                    bevelOffset: beveled ? info.bevelOffset : undefined,
                    bevelSegments: beveled ? info.bevelSegments : undefined,
                }));
            return {
                ...base,
                type: "asset",
                asset: kind,
                assetId: beveled ? "beveled-stacked-building" : "stacked-building",
                assetName: info.label,
                k: 1,
                d: -1,
                off: [q[0], 0, q[2]],
                ca: 0,
                cb: 0,
                h: floors[floors.length - 1].z + floorHeight,
                ra: info.w / 2,
                rb: info.d / 2,
                floorCount: floors.length,
                floorHeight,
                floorGap,
                rimHeight: 0.16,
                rimOverhang: 0.18,
                bevelOffset: beveled ? info.bevelOffset : undefined,
                bevelSegments: beveled ? info.bevelSegments : undefined,
                openingEnabled: false,
                openingW: info.w * 0.56,
                openingH: floorHeight * 0.66,
                openingBack: info.d * 0.5 - 0.025,
                // 既定は1F編集を全階へ連動。旧JSONのsyncFirstは互換用に残す。
                syncFirst: true,
                individualEdit: false,
                activeFloor: 0,
                floors,
            };
        }
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
        if (kind === "box")
            return {
                ...base,
                type: "asset",
                asset: kind,
                assetId: "box",
                assetName: info.label,
                ra: info.w / 2,
                rb: info.d / 2,
                h: height,
                extrude: true,
            };
        if (kind === "beveledBox")
            return {
                ...base,
                type: "asset",
                asset: kind,
                assetId: "beveled-box",
                assetName: info.label,
                ra: info.w / 2,
                rb: info.d / 2,
                h: 0,
                extrude: false,
                bevelOffset: info.bevelOffset,
                bevelSegments: info.bevelSegments,
            };
        if (kind === "cornerCutBox")
            return {
                ...base,
                type: "asset",
                asset: kind,
                assetId: "corner-cut-box",
                assetName: info.label,
                ra: info.w / 2,
                rb: info.d / 2,
                h: Math.max(0.1, height),
                extrude: true,
                // 隅切り直方体は、現在の初期向きから垂直軸まわりに90度回した状態で生成する。
                rot: 90,
                cornerOffset: info.cornerOffset,
                cornerCutCorner: info.cornerCutCorner,
                cornerCutOpeningEnabled: false,
                cornerCutOpeningW: info.cornerCutOpeningW,
                cornerCutOpeningH: info.cornerCutOpeningH,
                cornerCutOpeningDepth: info.cornerCutOpeningDepth,
                cutColor: info.cutColor,
            };
        // 壁付け看板（単体）は、板を立てて地面に置き、取付金具を裏側へ出す。
        // 取付金具の本数・長さ・ベベル形状は配置後に画面と数値の両方から編集できる。
        if (kind === "wallSign")
            return {
                ...base,
                type: "asset",
                asset: kind,
                assetId: "wall-sign",
                assetName: info.label,
                k: 1,
                d: -1,
                off: [q[0], 0, q[2]],
                ca: 0,
                cb: 0,
                ra: info.w / 2,
                rb: info.d / 2,
                h: height,
                // 初期の向きは正面。回転はほかのアセットと同じく画面から変えられる。
                rot: 0,
                wallSignBracketCount: 3,
                wallSignBracketLength: 0.36,
                wallSignShape: "beveled",
                wallSignBevelOffset: 0.18,
                wallSignBevelSegments: 4,
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
            balconyFloorThickness: kind === "balcony" ? 0.16 : undefined,
            balconyRailHeight: kind === "balcony" ? Math.max(0.12, height - 0.16) : undefined,
            balconyRailThickness: kind === "balcony" ? 0.12 : undefined,
            balconyFrontRail: kind === "balcony" ? true : undefined,
            balconySideRail: kind === "balcony" ? true : undefined,
            balconyRailHeightEdited: kind === "balcony" ? false : undefined,
            path: kind === "pathPipe" ? pathPipeDefaultPoints() : undefined,
            pipeRadius: kind === "pathPipe" ? 0.18 : undefined,
            cornerRadius: kind === "pathPipe" ? 0.55 : undefined,
            cornerSteps: kind === "pathPipe" ? 6 : undefined,
            pipeSides: kind === "pathPipe" ? 10 : undefined,
            steps: kind === "stairs" ? Math.round(Number(el("stairsSteps")?.value) || 6) : undefined,
            handrail: kind === "stairs" ? !!el("stairsRail")?.checked : undefined,
            stripes: kind === "crosswalk" ? 7 : undefined,
        };
    }
    // 建物とテント／看板を親子として作る。
    // child.attachment が親の開口側へ追従するため、親の移動・回転・寸法変更に対応できる。
    // ===== 3. 連結パーツと配置（ベランダ・建物付属） =====
    function placeLinkedAsset(kind, p) {
        const childKind = kind === "buildingAwning" ? "awning" : "rect",
            q = p ? groundAt(p) : assetGroundPoint(ASSETS.building),
            parent = newAsset("building", null, q),
            child = newAsset(childKind, null, q),
            groupId = "linked-" + uid();
        // テント／看板付き建物は、親建物を必ずY面（地面に立つ向き）で作る。
        // assetAxisがX/Zでも親まで壁面向きにすると、parent.rbが高さ扱いになり、
        // 子テントの接着計算が建物の中央へ入り込むため、ここで座標系を固定する。
        if (kind === "buildingAwning" || kind === "buildingSign") {
            parent.k = 1;
            parent.d = -1;
            parent.ca = Number(q[0]) || 0;
            parent.cb = Number(q[2]) || 0;
            parent.lift = 0;
            parent.off = [0, 0, 0];
        }
        if (kind === "buildingAwning") {
            parent.ra = ASSETS.building.w / 2;
            parent.rb = ASSETS.building.d / 2;
            parent.h = ASSETS.building.h;
            parent.extrude = true;
            parent.openingEnabled = false;
            parent.accent = "#d98b68";
        } else {
            // 看板付き建物は従来どおり開口ありを初期状態にする。
            parent.openingEnabled = true;
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
    function selectedBalconyParent() {
        const parent = sel ? obOf(sel) : null;
        // 建物アセットを選択しているときは、その正面（ローカルYマイナス面）へ自動接着する。
        // 既存の建物接着と同じ親子同期経路を使うため、親の移動・寸法変更にも追従する。
        return parent &&
            parent.type === "asset" &&
            ["building", "stackedBuilding", "beveledStackedBuilding"].includes(parent.asset) &&
            parent.k === 1
            ? parent
            : null;
    }
    function newAttachedBalcony(parent) {
        const isStacked = isStackedBuildingAsset(parent),
            floors = Array.isArray(parent.floors) ? parent.floors : [],
            floorIndex = isStacked
                ? clamp(Math.round(Number(parent.activeFloor) || 1), 0, Math.max(0, floors.length - 1))
                : 0,
            floor = isStacked ? floors[floorIndex] : null,
            wallPoint = isStacked
                ? customPt(
                      parent,
                      Number(floor?.x) || 0,
                      (Number(floor?.y) || 0) - Math.abs(Number(floor?.d) || 3) * 0.5,
                      Number(floor?.z) || 0,
                  )
                : L2W(parent, 0, -Math.abs(Number(parent.rb) || 0.5), 0),
            child = newAsset("balcony", null, wallPoint);
        child.k = 1;
        child.d = -1;
        child.ca = 0;
        child.cb = 0;
        child.off = [0, 0, 0];
        child.lift = 0;
        child.rot = Number(parent.rot) || 0;
        child.attachment = {
            parentId: parent.id,
            side: -1,
            x: 0,
            ...(isStacked
                ? { stackedFloor: true, floorIndex, baseZ: Number(floor?.z) || 0 }
                : { baseRatio: 0.58, baseZ: Math.max(0.1, (Number(parent.h) || 3) * 0.58) }),
            offsetZ: 0,
            rotOffset: 0,
            verticalOnly: true,
        };
        return syncAttachedPart(child, parent);
    }
    function placeBalcony(p) {
        sanitizeScene();
        const before = S.slice(),
            wasFloor = !!window.cityFloorPlanActive;
        try {
            const parent = selectedBalconyParent(),
                o = parent ? newAttachedBalcony(parent) : newAsset("balcony", p),
                lines = genShape(o);
            if (!lines.length || lines.some((s) => !validStroke(s)))
                throw new Error("balcony geometry is empty or malformed");
            HU.push(S);
            RD = [];
            S = [...S, ...lines];
            setSelection(o.id, false);
            tool = "edit";
            setMode("draw");
            if (wasFloor) {
                fitFloorPlan();
                setMode("draw");
            }
            syncSel();
            render();
        } catch (err) {
            S = before;
            prev = null;
            clearSelection();
            console.error("City Grid balcony asset error", err);
            try {
                render();
            } catch (e) {}
            alert("ベランダを配置できませんでした。建物を選択してからもう一度クリックしてください。");
        }
    }
    // 通常アセット、ベランダ、接続アセットを入口で振り分ける配置関数。
    function placeAsset(kind, p) {
        if (kind === "buildingAwning" || kind === "buildingSign") return placeLinkedAssetInstance(kind, p);
        if (kind === "balcony") return placeBalcony(p);
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
    // 線画ではなく、選択中オブジェクトの定義をJSONとしてクリップボードへ保持する。
    // ===== 4. コピー・貼り付け・読み込み =====
    function copySelectedObjects() {
        const objects = selectedObjects();
        if (!objects.length) return false;
        objectClipboard = objects.map((o) => JSON.parse(JSON.stringify(o)));
        return true;
    }
    // コピーした定義へ新しいID・グループIDを付け、少しずらして再生成する。
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
        // 旧テント付きcompoundの親はrectで保存されているため、現在の建物アセットへ移行する。
        // これで新しい開口チェックボックスと、開口建物の線画・面表示を共通利用できる。
        if (kind === "buildingAwning") {
            p.type = "asset";
            p.asset = "building";
            p.assetId = "building-awning";
            p.assetName = ASSETS.buildingAwning.label;
            p.openingEnabled = false;
            p.openingW = Number(p.openingW) || Math.abs(Number(p.ra) || 2) * 2 * 0.56;
            p.openingH = Number(p.openingH) || Math.max(0.1, Number(p.h) || 3.6) * 0.66;
        } else {
            p.openingEnabled = p.openingEnabled !== false;
        }
        // 旧compound JSONにX/Z面の親が残っていても、接続建物は地面に立つY面へ戻す。
        // これにより、読み込み後のテント／看板も親の高さ・奥行き基準で接着できる。
        if (p.k !== 1) {
            const center = L2W(p, 0, 0, 0);
            p.k = 1;
            p.d = -1;
            p.ca = Number(center[0]) || 0;
            p.cb = Number(center[2]) || 0;
            p.lift = 0;
            p.off = [0, 0, 0];
        }
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
    // オブジェクトJSONを検証・正規化して、現在のシーンへ追加する。
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

    // 既存建物の左右の横壁へ、小型看板を任意で接着する。
    // 建物本体の種類を変えず、attachmentで親の移動・回転・寸法変更へ追従させる。
    // ===== 5. 横壁看板の取り付け =====
    function wallSideSignChildren(parentId) {
        return sceneObjects()
            .filter((o) => o?.attachment?.parentId === parentId && o.attachment.wallSideSign)
            .sort((a, b) => (Number(a.attachment.floorIndex) || 0) - (Number(b.attachment.floorIndex) || 0));
    }
    function wallSideSignParent(id) {
        const o = obOf(id),
            parent = o?.attachment?.parentId ? obOf(o.attachment.parentId) : o;
        return parent && parent.type === "asset" && (parent.asset === "building" || isStackedBuildingAsset(parent))
            ? parent
            : null;
    }
    function wallSideSignScopeOf(parent, children = wallSideSignChildren(parent?.id)) {
        if (!isStackedBuildingAsset(parent)) return "first";
        if (["first", "all", "individual"].includes(parent?.wallSideSignScope)) return parent.wallSideSignScope;
        if (children.length > 1 && children.length >= (parent.floors?.length || 0)) return "all";
        if (children.some((child) => Number(child.attachment?.floorIndex) > 0)) return "individual";
        return "first";
    }
    function wallSideSignFloorIndices(parent, scope, flags, children = wallSideSignChildren(parent?.id)) {
        if (!isStackedBuildingAsset(parent)) return [0];
        const count = Math.max(1, Array.isArray(parent.floors) ? parent.floors.length : 1),
            normalized = ["first", "all", "individual"].includes(scope) ? scope : wallSideSignScopeOf(parent, children);
        if (normalized === "all") return Array.from({ length: count }, (_, i) => i);
        if (normalized === "individual") {
            const source = Array.isArray(flags)
                    ? flags
                    : Array.isArray(parent.wallSideSignFloors)
                      ? parent.wallSideSignFloors
                      : null,
                selected = source
                    ? source.map((value, index) => (value ? index : -1)).filter((index) => index >= 0 && index < count)
                    : children
                          .map((child) => Number(child.attachment?.floorIndex) || 0)
                          .filter((index, i, all) => index >= 0 && index < count && all.indexOf(index) === i);
            return selected.length ? selected : [0];
        }
        return [0];
    }
    function newWallSideSign(parent, side = 1, floorIndexOverride = null, template = null) {
        const stacked = isStackedBuildingAsset(parent),
            floors = stacked && Array.isArray(parent.floors) ? parent.floors : [],
            floorIndex = stacked
                ? clamp(
                      Math.round(Number(floorIndexOverride ?? parent.activeFloor) || 0),
                      0,
                      Math.max(0, floors.length - 1),
                  )
                : 0,
            floor = stacked ? floors[floorIndex] || floors[0] : null,
            parentW = stacked ? Math.abs(Number(floor?.w) || 4) : Math.abs(Number(parent.ra) || 2) * 2,
            parentD = stacked ? Math.abs(Number(floor?.d) || 3) : Math.abs(Number(parent.rb) || 1.5) * 2,
            parentH = stacked ? Math.abs(Number(floor?.h) || 2.2) : Math.abs(Number(parent.h) || 3),
            width = template
                ? Math.max(0.05, Math.abs(Number(template.rb) || 0.75) * 2)
                : clamp(parentD * 0.3, 0.55, 1.5),
            height = template
                ? Math.max(0.05, Math.abs(Number(template.ra) || 0.9) * 2)
                : clamp(parentH * 0.28, 0.45, 1.25),
            thickness = template
                ? Math.max(0.02, Math.abs(Number(template.h) || 0.12))
                : clamp(Math.min(parentD, parentW) * 0.035, 0.08, 0.18),
            bracketCount = clamp(
                Math.round(Number(parent.wallSideSignBracketCount ?? template?.wallSideSignBracketCount ?? 3)),
                0,
                3,
            ),
            bracketLength = clamp(
                Math.abs(Number(parent.wallSideSignBracketLength ?? template?.wallSideSignBracketLength) || 0.36),
                0.05,
                5,
            ),
            shape =
                parent.wallSideSignShape === "beveled"
                    ? "beveled"
                    : template?.wallSideSignShape === "beveled"
                      ? "beveled"
                      : "box",
            bevelOffset = clamp(
                Number(parent.wallSideSignBevelOffset ?? template?.wallSideSignBevelOffset) || 0.06,
                0.01,
                1,
            ),
            sideValue = side < 0 ? -1 : 1,
            templateAttachment = template?.attachment,
            centerRatio = Number.isFinite(Number(templateAttachment?.centerRatio))
                ? Number(templateAttachment.centerRatio)
                : stacked
                  ? 0.58
                  : 0.68,
            depthOffset = Number.isFinite(Number(templateAttachment?.depthOffset))
                ? Number(templateAttachment.depthOffset)
                : 0,
            sign = {
                id: uid(),
                type: "asset",
                asset: "wallSideSign",
                assetId: "wall-side-sign",
                assetName: "横壁看板",
                k: 1,
                d: -1,
                off: [0, 0, 0],
                ca: 0,
                cb: 0,
                rot: Number(parent.rot) || 0,
                lift: 0,
                wf: true,
                c: template?.c || parent.c || "#222222",
                w: Math.max(1, Number(parent.w) || MASTER_W),
                // 横壁ではraを縦方向、rbを壁に沿う奥行方向、hを壁からの厚みに使う。
                ra: height / 2,
                rb: width / 2,
                h: thickness,
                extrude: true,
                wallSideSign: true,
                wallSideSignBracketCount: bracketCount,
                wallSideSignBracketLength: bracketLength,
                wallSideSignShape: shape,
                wallSideSignBevelOffset: bevelOffset,
                wallSideSignBevelSegments: 4,
                wallSideSignSide: sideValue,
            };
        sign.attachment = {
            parentId: parent.id,
            wallSideSign: true,
            wallSideSignSide: sideValue,
            ...(stacked ? { stackedFloor: true, floorIndex } : {}),
            side: sideValue,
            depthOffset,
            centerRatio,
            offsetZ: 0,
            rotOffset: 0,
            verticalOnly: true,
        };
        return syncAttachedPart(sign, parent);
    }
    function toggleWallSideSign(
        parentId,
        enabled,
        side = 1,
        bracketCount = 3,
        bracketLength = 0.36,
        shape = "box",
        bevelOffset = 0.06,
        scope = null,
        floorFlags = null,
    ) {
        const parent = wallSideSignParent(parentId);
        if (!parent) return false;
        const before = S.slice(),
            oldChildren = wallSideSignChildren(parent.id),
            oldIds = new Set(oldChildren.map((child) => child.id)),
            count = clamp(Math.round(Number(bracketCount) || 0), 0, 3),
            length = clamp(Math.abs(Number(bracketLength) || 0.36), 0.05, 5),
            form = shape === "beveled" ? "beveled" : "box",
            bevel = clamp(Number(bevelOffset) || 0.06, 0.01, 1),
            stacked = isStackedBuildingAsset(parent),
            scopeValue = stacked
                ? ["first", "all", "individual"].includes(scope)
                    ? scope
                    : wallSideSignScopeOf(parent, oldChildren)
                : "first",
            indices = wallSideSignFloorIndices(parent, scopeValue, floorFlags, oldChildren),
            floorCount = stacked ? Math.max(1, parent.floors?.length || 1) : 1,
            signFloors = Array.from({ length: floorCount }, (_, index) => indices.includes(index)),
            oldByFloor = new Map(oldChildren.map((child) => [Number(child.attachment?.floorIndex) || 0, child]));
        try {
            HU.push(S);
            RD = [];
            S = S.filter((s) => s?.ob?.id !== parent.id && !oldIds.has(s?.ob?.id));
            const nextParent = {
                ...parent,
                wallSideSignEnabled: !!enabled,
                wallSideSignSide: side < 0 ? -1 : 1,
                wallSideSignBracketCount: count,
                wallSideSignBracketLength: length,
                wallSideSignShape: form,
                wallSideSignBevelOffset: bevel,
                wallSideSignBevelSegments: 4,
                wallSideSignScope: scopeValue,
                wallSideSignFloors: signFloors,
            };
            S = [...S, ...genShape(nextParent)];
            if (enabled) {
                const fallbackTemplate = oldByFloor.get(0) || oldChildren[0] || null;
                indices.forEach((floorIndex) => {
                    const template = oldByFloor.get(floorIndex) || fallbackTemplate,
                        sign = newWallSideSign(nextParent, side, floorIndex, template);
                    S = [...S, ...genShape(sign)];
                });
            }
            regenObjects();
            setSelection(parent.id, false);
            tool = "edit";
            setMode("draw");
            render();
            return true;
        } catch (err) {
            S = before;
            console.error("City Grid wall-side sign error", err);
            render();
            return false;
        }
    }
    window.cityGridWallSideSignToggle = toggleWallSideSign;

    // ===== 6. アセット棚と配置方向 =====
    // 棚のボタンはplaceAsset()へ集約し、UIイベント内に形状生成ロジックを重複させない。
    const tray = document.createElement("div");
    tray.id = "assetTray";
    tray.innerHTML =
        '<div class="assetTrayInner"><div class="assetTrayTitle">シーンに追加</div><div class="assetTrayTools"><label>生成面<select id="assetAxisTray"><option value="1">Y：地面／上下</option><option value="0">X：左右の面</option><option value="2">Z：正面／背面</option></select></label></div><div class="assetClipboardTools"><button type="button" id="objectCopy">コピー</button><button type="button" id="objectPaste" disabled>貼り付け</button><button type="button" id="objectImportButton">JSON読込</button><input id="objectImportFile" type="file" accept="application/json,.json" hidden></div>' +
        // 通常の「看板」アセットは、建物へ接着する横壁看板へ統合したため棚から外す。
        // 既存JSONのasset=signはASSETS定義を残して読み込み・表示できるようにする。
        Object.entries(ASSETS)
            // 看板は「壁付け看板（単体）」へ統合した。
            // asset=sign と asset=wallSideSign（建物へ接着する専用形状）は
            // 既存JSONの読み込み・表示用に定義だけ残し、棚からは外す。
            .filter(([k]) => k !== "sign" && k !== "wallSideSign")
            .map(
                ([k, v]) =>
                    `<button class="assetCard" data-asset="${k}" title="${v.label}を追加${k === "balcony" ? "（建物選択中は壁へ接着）" : ""}"><span class="assetGlyph">${v.glyph}</span><span>${v.label}</span></button>`,
            )
            .join("") +
        '</div><div class="assetTrayNote">建物を選択して「壁付けベランダ」を押すと、正面壁の2階相当へ自動接着。未選択なら地面へ配置。パスパイプは選択後に画面上の制御点と半径ハンドルを編集できます。</div>';
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
    // ===== 7. オブジェクト情報のコピー =====
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

    // ===== 8. 4本指プリミティブクイックメニュー =====
    // 基本6種だけを小さなメニューから追加できる。実体の生成は通常のplaceAsset()へ委譲する。
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
