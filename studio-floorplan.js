/* City Grid Studio studio-floorplan — 間取りモード（正面・横・上の選択、移動・回転・寸法編集）。

   もとは studio-ui.js の「5. 間取りモードの選択・移動・編集」セクション（2,718行）で、
   中身はそのまま移した。studio-ui.js とやり取りする名前だけ `window.CityGridStudio` を通す。

   外から使うもの（studio-ui.js 側で使う）
   - FLOOR_CAMERA_RAY / floorPlanDock / floorPlanDrag
   - syncFloorPlanDockLayout / syncFloorPlanSelection
   - floorPlanWorldAt / floorPlanSideWorldAt / floorPlanFrontWorldAt

   外から借りるもの
   - el / side / capturePointer / orthHandleGap（studio-lib.js）
   - quick / sceneObjects / fitFloorPlan（studio-ui.js。読み込み順に依らないよう
     呼ぶときに引く） */
(function () {
    "use strict";
    const SH = (window.CityGridStudio = window.CityGridStudio || {});
    const el = SH.el,
        side = SH.side,
        capturePointer = SH.capturePointer,
        orthHandleGap = SH.orthHandleGap;
    // studio-ui.js 側の関数は、どちらが先に読み込まれても呼べるようにする。
    const sceneObjects = (...a) => SH.sceneObjects(...a);
    const fitFloorPlan = (...a) => SH.fitFloorPlan(...a);

    // ===== 5. 間取りモードの選択・移動・編集 =====
    // 間取り上の操作対象。オブジェクトの前側の丸、カメラ本体、カメラ先端の丸を
    // 3Dビューのギズモとは別に描き、参考サイトと同じ操作感にする。
    const FLOOR_CAMERA_RAY = 3;
    let floorPlanDrag = null,
        floorPlanPanMode = false;
    // 間取りでは既存のキャンバス捕捉が先に動くため、2本／3本指タップをここで明示的に数える。
    const floorTouchIds = new Map();
    let floorTouchT0 = 0,
        floorTouchMax = 0,
        floorTouchMoved = false,
        floorTouchPan = null;
    const FLOOR_TOUCH_MIN_SCALE = 12,
        FLOOR_TOUCH_MAX_SCALE = 640;

    function floorTouchCanvasPoint(x, y) {
        const r = cv.getBoundingClientRect(),
            sx = r.width > 0 ? W / r.width : 1,
            sy = r.height > 0 ? H / r.height : 1;
        return { x: (x - r.left) * sx, y: (y - r.top) * sy };
    }
    function floorTouchDistance(a, b) {
        return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    }
    function floorTouchDown(e) {
        if (e.pointerType !== "touch") return false;
        if (!floorTouchIds.size) {
            floorTouchT0 = Date.now();
            floorTouchMax = 0;
            floorTouchMoved = false;
            floorTouchPan = null;
        }
        floorTouchIds.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
        floorTouchMax = Math.max(floorTouchMax, floorTouchIds.size);
        if (floorTouchIds.size >= 2) {
            // 1本目は通常の編集経路へ渡るため、2本目が入った時点で
            // 通常編集のポインタ状態を完全に捨てる。これをしないと、
            // 2本指タップ後もTC/ptrが残り、undo/redo結果が画面へ反映されない。
            cancelBoxPending();
            boxSelect = null;
            floorPlanDrag = null;
            snapHit = null;
            TC.clear();
            mg = null;
            ptr = null;
            ptrType = null;
            drag = null;
            cur = null;
            er = null;
            prev = null;
            bd = false;
            ed = null;
            const pts = [...floorTouchIds.values()],
                mx = pts.reduce((a, t) => a + t.x, 0) / pts.length,
                my = pts.reduce((a, t) => a + t.y, 0) / pts.length;
            if (!Array.isArray(window.cityFloorPlanCenter)) fitFloorPlan();
            const center0 = [...(window.cityFloorPlanCenter || [0, 0])],
                scale0 = clamp(
                    Number(window.cityFloorPlanScale) || Number(orthScale()) || 1,
                    FLOOR_TOUCH_MIN_SCALE,
                    FLOOR_TOUCH_MAX_SCALE,
                ),
                mid0 = floorTouchCanvasPoint(mx, my),
                shift = viewShift(),
                anchor0 = orthWorldAt({ x: (mid0.x - shift[0]) / Z, y: (mid0.y - shift[1]) / Z });
            // 2本指の中心を基準に、同じワールド位置が指の間に残るようにする。
            // これでピンチ中の表示移動とズームが自然につながる。
            floorTouchPan = {
                mx0: mx,
                my0: my,
                center0,
                anchor0,
                dist0: floorTouchDistance(pts[0], pts[1]),
                scale0,
            };
            e.preventDefault();
            e.stopImmediatePropagation();
            capturePointer(e.pointerId);
            return true;
        }
        return false;
    }
    function floorTouchMove(e) {
        const s = floorTouchIds.get(e.pointerId);
        if (!s) return false;
        if (Math.hypot(e.clientX - s.sx, e.clientY - s.sy) > 12) floorTouchMoved = true;
        s.x = e.clientX;
        s.y = e.clientY;
        if (floorTouchMax >= 2 && floorTouchPan && floorTouchIds.size >= 2) {
            const pts = [...floorTouchIds.values()],
                mx = pts.reduce((a, t) => a + t.x, 0) / pts.length,
                my = pts.reduce((a, t) => a + t.y, 0) / pts.length,
                dist = floorTouchDistance(pts[0], pts[1]),
                scale = clamp(
                    floorTouchPan.scale0 * (dist / floorTouchPan.dist0),
                    FLOOR_TOUCH_MIN_SCALE,
                    FLOOR_TOUCH_MAX_SCALE,
                ),
                mid = floorTouchCanvasPoint(mx, my);
            // ピンチアウト＝scaleを大きくしてズームイン、ピンチイン＝ズームアウト。
            // 初期の指間にあったワールド座標を現在の指の中心へ固定する。
            window.cityFloorPlanScale = scale;
            window.cityFloorPlanCenter = [...floorTouchPan.center0];
            const projected = projPoint(floorTouchPan.anchor0, [Z, 0, 0, Z, ...viewShift()]);
            // 投影と同じ変換を使って補正する。ホイール後のZ/パンやカメラ位置を含む。
            window.cityFloorPlanCenter = [
                floorTouchPan.center0[0] + (projected.x - mid.x) / scale,
                floorTouchPan.center0[1] - (projected.y - mid.y) / scale,
            ];
            floorTouchMoved = true;
            render();
        }
        return floorTouchMax >= 2;
    }
    function floorTouchUp(e) {
        if (e.pointerType !== "touch" || !floorTouchIds.has(e.pointerId)) return false;
        const s = floorTouchIds.get(e.pointerId);
        if (Math.hypot(e.clientX - s.sx, e.clientY - s.sy) > 12) floorTouchMoved = true;
        floorTouchIds.delete(e.pointerId);
        if (floorTouchIds.size) return floorTouchMax >= 2;
        const count = floorTouchMax,
            moved = floorTouchMoved,
            quick = Date.now() - floorTouchT0 < 650;
        floorTouchMax = 0;
        floorTouchMoved = false;
        floorTouchT0 = 0;
        floorTouchPan = null;
        if (e.type === "pointerup" && quick && !moved) {
            if (count === 2) undo();
            else if (count === 3) redo();
            else if (count >= 4 && window.cityPrimitiveMenuToggle) window.cityPrimitiveMenuToggle();
        }
        return count >= 2;
    }
    // Safariで画面遷移やサイドパネル操作がpointerupを欠落させても、
    // 次の指操作を古い本数として扱わない。
    const resetFloorTouch = () => {
        floorTouchIds.clear();
        floorTouchMax = 0;
        floorTouchMoved = false;
        floorTouchT0 = 0;
        floorTouchPan = null;
    };
    addEventListener("blur", resetFloorTouch);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) resetFloorTouch();
    });
    const floorPlanDock = document.createElement("div");
    floorPlanDock.id = "floorPlanDock";
    floorPlanDock.innerHTML =
        '<div class="floorPlanDockInner"><div class="floorPlanDockHeader"><div id="floorPlanDockStatus" class="floorPlanDockStatus">オブジェクトを選択すると、移動・回転・サイズ変更ができます。<small>カメラ本体：位置　／　先端の丸：向き</small></div><div class="floorHistoryButtons"><button type="button" id="floorUndo" class="floorHistoryButton" title="間取りの操作を元に戻す">↶ 元に戻す</button><button type="button" id="floorRedo" class="floorHistoryButton" title="間取りの操作をやり直す">↷ やり直す</button></div><button type="button" class="dockCollapse" data-floor-dock-action="collapse" title="操作バーを折りたたむ">−</button></div><button type="button" data-floor-dock-action="left">↺ 15°</button><button type="button" data-floor-dock-action="right">↻ 15°</button><button type="button" data-floor-dock-action="rot30">30°</button><button type="button" data-floor-dock-action="rot45">45°</button><button type="button" data-floor-dock-action="90">90°回す</button><label class="floorLensTools">レンズ <input id="floorLensInput" type="number" min="14" max="200" step="1"> mm</label><div class="floorPlanPanTools"><span>表示移動</span><button type="button" data-floor-dock-action="pan-up" title="表示を上へ">↑</button><button type="button" data-floor-dock-action="pan-down" title="表示を下へ">↓</button><button type="button" data-floor-dock-action="pan-left" title="表示を左へ">←</button><button type="button" data-floor-dock-action="pan-right" title="表示を右へ">→</button></div><button type="button" data-floor-dock-action="assets">＋アセット</button><button type="button" data-floor-dock-action="delete">片付ける</button><span class="dockHint">中／右ドラッグ：表示移動　・　表示移動ボタン／Alt＋矢印／WASD：キャンバス移動　・　2本指ピンチ：ズームイン／ズームアウト（正面・横・上のまま）　・　磁石ON：家具移動と幅／奥行の面編集をエッジへ吸着　・　2本指タップ：元に戻す／3本指タップ：やり直す</span></div>';
    stage.appendChild(floorPlanDock);
    // アセット棚を開いたときは、間取り操作バーを棚の上へ逃がす。棚と操作バーを重ねないためのレイアウト調整。
    function syncFloorPlanDockLayout() {
        const tray = el("assetTray");
        if (!tray) return;
        // 操作バーは右上に固定し、下部のアセット棚と重ならない配置にする。
        floorPlanDock.style.bottom = "";
        floorPlanDock.dataset.assetTrayOpen =
            !!window.cityFloorPlanActive && getComputedStyle(tray).display !== "none" ? "1" : "0";
    }
    addEventListener("resize", () => requestAnimationFrame(syncFloorPlanDockLayout));
    const angle360 = (a) => (((Number(a) || 0) % 360) + 360) % 360;
    const floorPlanObject = () => sel && obOf(sel);
    function floorPlanWorldAt(p) {
        const q = pickOnPlane(p, 1, -1, [0, 0, 0]);
        return q && Number.isFinite(q[0]) && Number.isFinite(q[2]) ? { x: q[0], z: q[2] } : null;
    }
    // 真横ビューは画面の左右がZ、上下がYなので、床面との交差ではなく
    // 正投影の表示中心・倍率から直接ワールドのZ/Yへ戻す。
    function floorPlanSideWorldAt(p) {
        if (orthPlane() !== "side") return null;
        const q=orthWorldAt(p, [0,0,0]);
        return {z:q[2],y:q[1]};
    }
    function floorPlanFrontWorldAt(p) {
        if (orthPlane() !== "front") return null;
        const q=orthWorldAt(p, [0,0,0]);
        return {x:q[0],y:q[1]};
    }
    function floorPlanVerticalWorldAt(p) {
        return orthPlane() === "side" ? floorPlanSideWorldAt(p) : orthPlane() === "front" ? floorPlanFrontWorldAt(p) : null;
    }
    function floorPlanObjectZRange(o) {
        const h = Math.max(0, Number(o?.h) || 0);
        // 看板の黒い外枠は、アセット全高の上下にある余白を除いた板部分。
        // 間取りの選択枠・高さハンドルも、この実際の外枠へ合わせる。
        return o?.type === "asset" && o?.asset === "sign" ? [h * 0.08, h * 0.82] : [0, h];
    }
    function floorPlanHandles() {
        const o = floorPlanObject(),
            out = { object: null, camera: null };
        if (o) {
            if (o.type === "compound") {
                const b = obBounds(o),
                    base = objectAnchorWorld(o),
                    dist = Math.max(b.hi[0] - b.lo[0], b.hi[2] - b.lo[2], 0.6) * 0.5 + 0.42;
                out.object = { o, base, center: scrW(base), world: { x: base[0], z: base[2] + dist } };
                out.object.s =
                    orthPlane() === "front"
                        ? scrW([base[0] + dist, base[1], base[2]])
                        : scrW([base[0], orthPlane() === "side" ? base[1] : -1, base[2] + dist]);
            } else {
                const [z0, z1] = floorPlanObjectZRange(o),
                    bounds = obBounds(o),
                    boundsCenter = [
                        (bounds.lo[0] + bounds.hi[0]) / 2,
                        (bounds.lo[1] + bounds.hi[1]) / 2,
                        (bounds.lo[2] + bounds.hi[2]) / 2,
                    ],
                    pathObject = o.type === "asset" && o.asset === "pathPipe",
                    base = pathObject || o.k !== 1 ? boundsCenter : L2W(o, 0, 0, z0),
                    mid = pathObject || o.k !== 1 ? boundsCenter : L2W(o, 0, 0, (z0 + z1) / 2),
                    a = (Number(o.rot) || 0) * DG,
                    dist =
                        pathObject || o.k !== 1
                            ? Math.max(bounds.hi[0] - bounds.lo[0], bounds.hi[2] - bounds.lo[2], 0.6) * 0.5 + 0.62
                            : Math.max(Math.abs(Number(o.ra) || 0.3), Math.abs(Number(o.rb) || 0.3)) + 0.42;
                out.object = {
                    o,
                    base,
                    center: scrW(mid),
                    world: { x: base[0] - Math.sin(a) * dist, z: base[2] + Math.cos(a) * dist },
                };
                out.object.s =
                    orthPlane() === "front"
                        ? scrW([base[0] + Math.cos(a) * dist, base[1], base[2]])
                        : scrW([out.object.world.x, orthPlane() === "side" ? base[1] : -1, out.object.world.z]);
            }
        }
        const yaw = Number(P.yaw || 0) * DG,
            pitch = Number(P.pitch || 0) * DG,
            body = { x: P.cx, z: P.cz },
            cameraY = orthPlane() === "side" || orthPlane() === "front" ? P.ch - 1 : -1,
            horiz = Math.cos(pitch),
            target = {
                x: P.cx - Math.sin(yaw) * FLOOR_CAMERA_RAY * horiz,
                z: P.cz + Math.cos(yaw) * FLOOR_CAMERA_RAY * horiz,
            },
            targetY =
                orthPlane() === "side" || orthPlane() === "front" ? cameraY + Math.sin(pitch) * FLOOR_CAMERA_RAY : cameraY,
            half = Math.atan(18 / Math.max(12, Number(P.lens) || 38)),
            lensWorld =
                orthPlane() === "top"
                    ? [
                          P.cx - Math.sin(yaw - half) * FLOOR_CAMERA_RAY * horiz,
                          cameraY,
                          P.cz + Math.cos(yaw - half) * FLOOR_CAMERA_RAY * horiz,
                      ]
                    : null;
        out.camera = {
            body,
            target,
            targetY,
            sBody: scrW([body.x, cameraY, body.z]),
            sTarget: scrW([target.x, targetY, target.z]),
            sLens: lensWorld ? scrW(lensWorld) : null,
            lensWorld,
            yaw,
            pitch,
        };
        return out;
    }
    function floorPlanItemAt(w) {
        if (!w) return null;
        return (
            sceneObjects()
                .slice()
                .reverse()
                .find((o) => {
                    if (!o || !objectVisible(o)) return false;
                    const b = obBounds(o);
                    // パスパイプは折れ線＋半径で外接範囲が決まるため、
                    // ra/rbの初期矩形ではなく実メッシュの範囲でヒット判定する。
                    if (
                        o.type === "compound" ||
                        o.k !== 1 ||
                        (o.type === "asset" && o.asset === "pathPipe") ||
                        o.attachment?.wallSideSign
                    )
                        return (
                            w.x >= b.lo[0] - 0.08 &&
                            w.x <= b.hi[0] + 0.08 &&
                            w.z >= b.lo[2] - 0.08 &&
                            w.z <= b.hi[2] + 0.08
                        );
                    const base = L2W(o, 0, 0, 0),
                        dx = w.x - base[0],
                        dz = w.z - base[2],
                        a = (Number(o.rot) || 0) * DG,
                        cx = dx * Math.cos(a) + dz * Math.sin(a),
                        cz = -dx * Math.sin(a) + dz * Math.cos(a);
                    return (
                        Math.abs(cx) <= Math.abs(Number(o.ra) || 0.25) + 0.08 &&
                        Math.abs(cz) <= Math.abs(Number(o.rb) || 0.25) + 0.08
                    );
                }) || null
        );
    }
    // 正面／横ビューの画面点から、外接箱に入るオブジェクトを探す。
    function floorPlanItemAtSide(p) {
        if (!p) return null;
        return (
            sceneObjects()
                .slice()
                .reverse()
                .find((o) => {
                    if (!o || !objectVisible(o)) return false;
                    const b = obBounds(o),
                        pts = [];
                    for (const x of [b.lo[0], b.hi[0]])
                        for (const y of [b.lo[1], b.hi[1]])
                            for (const z of [b.lo[2], b.hi[2]]) {
                                const q = scrW([x, y, z]);
                                if (q.ok) pts.push(q);
                            }
                    if (!pts.length) return false;
                    const x0 = Math.min(...pts.map((q) => q.x)) - 14 / Z,
                        x1 = Math.max(...pts.map((q) => q.x)) + 14 / Z,
                        y0 = Math.min(...pts.map((q) => q.y)) - 14 / Z,
                        y1 = Math.max(...pts.map((q) => q.y)) + 14 / Z;
                    return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
                }) || null
        );
    }
    // 真横／正面では高さ0の地面オブジェクトが細い1本線になるため、
    // 外枠判定に加えて中心アンカーも許容する。これで線上のクリックを確実に家具移動へ渡す。
    function floorPlanAnchorAtSide(p) {
        if (!p) return null;
        return (
            sceneObjects()
                .slice()
                .reverse()
                .find((o) => {
                    if (!o || !objectVisible(o)) return false;
                    const q = scrW(objectAnchorWorld(o));
                    return q.ok && Math.hypot(q.x - p.x, q.y - p.y) <= 28 / Z;
                }) || null
        );
    }
    function floorCompoundEditHandles(o) {
        const b = obBounds(o),
            centerWorld = [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2],
            center = scrW(centerWorld),
            handles = [];
        const add = (kind, label, point, probe, start, min = 0.01, side = 1) => {
            const s = scrW(point),
                q = scrW(probe);
            if (!s.ok || !q.ok) return;
            const dx = q.x - s.x,
                dy = q.y - s.y,
                px = Math.hypot(dx, dy);
            if (px < 0.01) return;
            handles.push({ kind, label, s, dir: { x: dx / px, y: dy / px }, scale: px / 0.1, start, min, side });
        };
        const addScreen = (kind, label, point, dir, start, min = 0) =>
            handles.push({
                kind,
                label,
                s: point,
                dir,
                scale: Math.max(1, orthScale()),
                start,
                min,
                side: 1,
                screen: true,
            });
        if (orthPlane() === "top") {
            add(
                "w",
                "幅＋",
                [b.hi[0], centerWorld[1], centerWorld[2]],
                [b.hi[0] + 0.1, centerWorld[1], centerWorld[2]],
                b.hi[0] - b.lo[0],
                0.01,
                1,
            );
            add(
                "w",
                "幅−",
                [b.lo[0], centerWorld[1], centerWorld[2]],
                [b.lo[0] - 0.1, centerWorld[1], centerWorld[2]],
                b.hi[0] - b.lo[0],
                0.01,
                -1,
            );
            add(
                "d",
                "奥行＋",
                [centerWorld[0], centerWorld[1], b.hi[2]],
                [centerWorld[0], centerWorld[1], b.hi[2] + 0.1],
                b.hi[2] - b.lo[2],
                0.01,
                1,
            );
            add(
                "d",
                "奥行−",
                [centerWorld[0], centerWorld[1], b.lo[2]],
                [centerWorld[0], centerWorld[1], b.lo[2] - 0.1],
                b.hi[2] - b.lo[2],
                0.01,
                -1,
            );
            const gap = orthHandleGap(Math.max(b.hi[0] - b.lo[0], b.hi[2] - b.lo[2], 0.6));
            addScreen(
                "h",
                "高さ",
                { x: center.x, y: center.y + gap, ok: true },
                { x: 0, y: 1 },
                Math.max(0, b.hi[1] - b.lo[1]),
            );
        } else if (orthPlane() === "side") {
            add(
                "d",
                "奥行＋",
                [centerWorld[0], centerWorld[1], b.hi[2]],
                [centerWorld[0], centerWorld[1], b.hi[2] + 0.1],
                b.hi[2] - b.lo[2],
                0.01,
                1,
            );
            add(
                "d",
                "奥行−",
                [centerWorld[0], centerWorld[1], b.lo[2]],
                [centerWorld[0], centerWorld[1], b.lo[2] - 0.1],
                b.hi[2] - b.lo[2],
                0.01,
                -1,
            );
            const height = b.hi[1] - b.lo[1];
            if (height > 0.01) {
                add(
                    "h",
                    "上端",
                    [centerWorld[0], b.hi[1], centerWorld[2]],
                    [centerWorld[0], b.hi[1] + 0.1, centerWorld[2]],
                    height,
                    0,
                    1,
                );
                add(
                    "h",
                    "下端",
                    [centerWorld[0], b.lo[1], centerWorld[2]],
                    [centerWorld[0], b.lo[1] - 0.1, centerWorld[2]],
                    height,
                    0,
                    -1,
                );
            } else addScreen("h", "高さ", { x: center.x, y: center.y - 52 / Z, ok: true }, { x: 0, y: -1 }, 0);
        } else if (orthPlane() === "front") {
            add(
                "w",
                "幅＋",
                [b.hi[0], centerWorld[1], centerWorld[2]],
                [b.hi[0] + 0.1, centerWorld[1], centerWorld[2]],
                b.hi[0] - b.lo[0],
                0.01,
                1,
            );
            add(
                "w",
                "幅−",
                [b.lo[0], centerWorld[1], centerWorld[2]],
                [b.lo[0] - 0.1, centerWorld[1], centerWorld[2]],
                b.hi[0] - b.lo[0],
                0.01,
                -1,
            );
            const height = b.hi[1] - b.lo[1];
            if (height > 0.01) {
                add(
                    "h",
                    "上端",
                    [centerWorld[0], b.hi[1], centerWorld[2]],
                    [centerWorld[0], b.hi[1] + 0.1, centerWorld[2]],
                    height,
                    0,
                    1,
                );
                add(
                    "h",
                    "下端",
                    [centerWorld[0], b.lo[1], centerWorld[2]],
                    [centerWorld[0], b.lo[1] - 0.1, centerWorld[2]],
                    height,
                    0,
                    -1,
                );
            } else addScreen("h", "高さ", { x: center.x, y: center.y - 52 / Z, ok: true }, { x: 0, y: -1 }, 0);
            const gap = orthHandleGap(Math.max(b.hi[0] - b.lo[0], 0.6));
            addScreen(
                "d",
                "奥行き",
                { x: center.x + gap, y: center.y, ok: true },
                { x: 1, y: 0 },
                b.hi[2] - b.lo[2],
                0.01,
            );
        }
        return { o, base: centerWorld, center, handles };
    }
    function floorAwningEdgeHandle(o) {
        const g = awningGeometry(o),
            // 手前上辺の中央は「上端／下端」の白い四角と同じ位置になり、
            // 掴むたびに別のハンドルが当たっていた。前縁の点は手前上辺の左端へ寄せ、
            // 上端・下端と重ならないようにする（辺の上なので意味は変わらない）。
            hx = -g.w / 2,
            point = L2W(o, hx, g.edgeY, g.edgeZ),
            s = scrW(point);
        if (!s.ok) return [];
        const out = [],
            // 手前上辺は「屋根の高さ」「建物の手前面」まで届かせる（直方体にできる）。
            // さらに一番下（0）まで下げると手前の上辺が下端に重なり、
            // 一番奥（d/2）まで寄せると奥の上辺に重なって、どちらも三角柱になる。
            zMin = 0,
            zMax = Math.max(0, g.h),
            yMin = -g.d / 2,
            yMax = g.d / 2;
        if (orthPlane() === "top") {
            const gap = orthHandleGap(Math.max(g.w, g.d, 0.6));
            out.push({
                kind: "awningEdgeZ",
                label: "前縁Y",
                s: { x: s.x, y: s.y - gap, ok: true },
                dir: { x: 0, y: -1 },
                scale: orthScale(),
                start: g.edgeZ,
                min: zMin,
                max: zMax,
                frontBottom: g.frontBottom,
                inner: true,
                screen: true,
            });
        } else {
            const qz = scrW(L2W(o, hx, g.edgeY, g.edgeZ + 0.1));
            if (qz.ok) {
                const dx = qz.x - s.x,
                    dy = qz.y - s.y,
                    px = Math.hypot(dx, dy);
                if (px > 0.01)
                    out.push({
                        kind: "awningEdgeZ",
                        label: "前縁Y",
                        s,
                        dir: { x: dx / px, y: dy / px },
                        scale: px / 0.1,
                        start: g.edgeZ,
                        min: zMin,
                        max: zMax,
                        frontBottom: g.frontBottom,
                        inner: true,
                    });
            }
        }
        // 前縁（手前の上辺）は上下だけでなく手前奥へも動かせる。
        // 2本目の軸を同じハンドルへ持たせ、斜めに引いても両方いっぺんに変わる。
        // 上から見た図では上下（高さ）が見えないので、2軸目は出さない。
        if (orthPlane() === "front") {
            // 正面図では手前奥が画面に出ない（真横から見ているため）。
            // 「前後」ハンドルと同じ約束で、画面の横方向を手前奥へ割り当てる。
            const edgeZHandle = out.find((q) => q.kind === "awningEdgeZ");
            if (edgeZHandle) {
                edgeZHandle.dir2 = { x: 1, y: 0 };
                edgeZHandle.scale2 = orthScale();
                edgeZHandle.start2 = g.edgeY;
                edgeZHandle.min2 = yMin;
                edgeZHandle.max2 = yMax;
            }
        } else if (orthPlane() !== "top") {
            const qy2 = scrW(L2W(o, hx, g.edgeY + 0.1, g.edgeZ)),
                edgeZHandle = out.find((q) => q.kind === "awningEdgeZ");
            if (qy2.ok && edgeZHandle) {
                const dx2 = qy2.x - s.x,
                    dy2 = qy2.y - s.y,
                    px2 = Math.hypot(dx2, dy2);
                if (px2 > 0.01) {
                    // 2軸目（手前奥）は1軸目（上下）と直交させる。
                    // 直交させないと、上下に引いただけで手前奥も動いてしまい、
                    // 前縁を下げ切っても三角柱にならない。
                    const ux = edgeZHandle.dir.x,
                        uy = edgeZHandle.dir.y,
                        dot12 = dx2 / px2 * ux + dy2 / px2 * uy,
                        ox = dx2 / px2 - ux * dot12,
                        oy = dy2 / px2 - uy * dot12,
                        opx = Math.hypot(ox, oy);
                    if (opx > 0.05) {
                        edgeZHandle.dir2 = { x: ox / opx, y: oy / opx };
                        edgeZHandle.scale2 = (opx * px2) / 0.1;
                    } else {
                        edgeZHandle.dir2 = { x: dx2 / px2, y: dy2 / px2 };
                        edgeZHandle.scale2 = px2 / 0.1;
                    }
                    edgeZHandle.start2 = g.edgeY;
                    edgeZHandle.min2 = yMin;
                    edgeZHandle.max2 = yMax;
                }
            }
        }
        // 「前後」ハンドルは廃止した。手前奥は上の2軸目（前縁Yを斜めに引く）で動かせる。
        return out;
    }
    function floorBuildingBackPanel(o) {
        const g = buildingGeometry(o),
            panelY = g.backY;
        return {
            panelY,
            side: panelY >= 0 ? 1 : -1,
            points: [
                scrW(L2W(o, -g.openingW / 2, panelY, 0)),
                scrW(L2W(o, -g.openingW / 2, panelY, g.openingH)),
                scrW(L2W(o, g.openingW / 2, panelY, g.openingH)),
                scrW(L2W(o, g.openingW / 2, panelY, 0)),
            ],
            center: scrW(L2W(o, 0, panelY, g.openingH * 0.5)),
        };
    }
    function floorBuildingInnerHandles(o) {
        if (o?.openingEnabled === false) return [];
        const g = buildingGeometry(o),
            handles = [],
            near = buildingFaceDepth(o),
            far = -near,
            back = floorBuildingBackPanel(o);
        const add = (
            kind,
            label,
            point,
            probe,
            start,
            factor = 1,
            side = 1,
            minOverride = null,
            maxOverride = null,
        ) => {
            const s = scrW(point),
                q = scrW(probe);
            if (!s.ok || !q.ok) return;
            const dx = q.x - s.x,
                dy = q.y - s.y,
                px = Math.hypot(dx, dy);
            if (px < 0.01) return;
            handles.push({
                kind,
                label,
                s,
                dir: { x: dx / px, y: dy / px },
                scale: px / 0.1,
                start,
                min: minOverride ?? 0.1,
                max:
                    maxOverride ??
                    (kind === "buildingOpeningW"
                        ? Math.max(0.1, g.w - 0.1)
                        : kind === "buildingBackFace"
                          ? 20
                          : Math.max(0.1, g.h - 0.1)),
                factor,
                side,
                inner: true,
            });
        };
        if (orthPlane() === "top") {
            [near, far].forEach((yy, idx) => {
                add(
                    "buildingOpeningW",
                    "開口W" + (idx ? "（奥）" : ""),
                    L2W(o, -g.openingW / 2, yy, 0),
                    L2W(o, -g.openingW / 2 - 0.1, yy, 0),
                    g.openingW,
                    2,
                );
                add(
                    "buildingOpeningW",
                    "開口W＋" + (idx ? "（奥）" : ""),
                    L2W(o, g.openingW / 2, yy, 0),
                    L2W(o, g.openingW / 2 + 0.1, yy, 0),
                    g.openingW,
                    2,
                );
            });
            add(
                "buildingBackFace",
                "奥の面",
                L2W(o, 0, back.panelY, g.openingH * 0.5),
                L2W(o, 0, back.panelY + back.side * 0.1, g.openingH * 0.5),
                back.panelY,
                1,
                back.side,
                -g.d / 2 + 0.025,
                g.d / 2 - 0.025,
            );
        } else if (orthPlane() === "front") {
            add(
                "buildingOpeningW",
                "開口W",
                L2W(o, -g.openingW / 2, near, g.openingH / 2),
                L2W(o, -g.openingW / 2 - 0.1, near, g.openingH / 2),
                g.openingW,
                2,
            );
            add(
                "buildingOpeningW",
                "開口W＋",
                L2W(o, g.openingW / 2, near, g.openingH / 2),
                L2W(o, g.openingW / 2 + 0.1, near, g.openingH / 2),
                g.openingW,
                2,
            );
            add(
                "buildingOpeningH",
                "開口H",
                L2W(o, 0, near, g.openingH),
                L2W(o, 0, near, g.openingH + 0.1),
                g.openingH,
            );
            if (back.center && back.center.ok)
                handles.push({
                    kind: "buildingBackFace",
                    label: "奥の面",
                    s: back.center,
                    dir: { x: 1, y: 0 },
                    scale: orthScale(),
                    start: back.panelY,
                    min: -g.d / 2 + 0.025,
                    max: g.d / 2 - 0.025,
                    factor: 1,
                    side: back.side,
                    inner: true,
                    screen: true,
                });
        } else if (orthPlane() === "side") {
            [near, far].forEach((yy, idx) =>
                add(
                    "buildingOpeningH",
                    "開口H" + (idx ? "（奥）" : ""),
                    L2W(o, 0, yy, g.openingH),
                    L2W(o, 0, yy, g.openingH + 0.1),
                    g.openingH,
                ),
            );
            add(
                "buildingBackFace",
                "奥の面",
                L2W(o, 0, back.panelY, g.openingH * 0.5),
                L2W(o, 0, back.panelY + back.side * 0.1, g.openingH * 0.5),
                back.panelY,
                1,
                back.side,
                -g.d / 2 + 0.025,
                g.d / 2 - 0.025,
            );
        }
        return handles;
    }
    // X／Z生成面はローカルの幅・奥行・高さが、前／横／上ビューの
    // 画面軸と一致しない。従来のL2Wハンドルだけだと、正面では幅、
    // 横では厚み、上では高さのハンドルが投影上つぶれて編集不能になるため、
    // ローカル3軸を投影して見えるハンドルへ組み直す。
    // X/Z生成面ではローカルra/rb/hが画面の幅・高さ・厚みと一致しないため、
    // 画面ハンドルの編集量をローカル寸法へ戻す。
    function floorWallDimensionPatch(o, param, value, side = 1) {
        const v = Math.max(param === "h" ? 0 : 0.01, Number(value));
        if (!Number.isFinite(v)) return null;
        const a = (Number(o.rot) || 0) * DG,
            cs = Math.cos(a),
            sn = Math.sin(a),
            old =
                param === "ra"
                    ? Math.abs(Number(o.ra) || 0) * 2
                    : param === "rb"
                      ? Math.abs(Number(o.rb) || 0) * 2
                      : Math.max(0, Number(o.h) || 0),
            delta = (v - old) / 2,
            patch = {};
        if (param === "ra") {
            patch.ca = (Number(o.ca) || 0) + side * delta * cs;
            patch.cb = (Number(o.cb) || 0) + side * delta * sn;
            patch.ra = Math.max(0.005, v / 2);
            if (o.asset === "sphere" || o.type === "cyl") patch.rb = patch.ra;
            if (o.asset === "sphere") patch.h = patch.ra * 2;
            return patch;
        }
        if (param === "rb") {
            patch.ca = (Number(o.ca) || 0) - side * delta * sn;
            patch.cb = (Number(o.cb) || 0) + side * delta * cs;
            patch.rb = Math.max(0.005, v / 2);
            if (o.asset === "sphere" || o.type === "cyl") patch.ra = patch.rb;
            if (o.asset === "sphere") patch.h = patch.rb * 2;
            return patch;
        }
        if (param === "h") {
            patch.h = v;
            if (side === -1) patch.lift = Number(o.lift || 0) + old - v;
            return patch;
        }
        return null;
    }
    function floorWallEditHandles(o) {
        const ra = Math.abs(Number(o.ra) || 0.25),
            rb = Math.abs(Number(o.rb) || 0.25),
            h = Math.max(0, Number(o.h) || 0),
            b = obBounds(o),
            centerWorld = [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2],
            center = scrW(centerWorld),
            handles = [],
            add = (param, label, point, probe, start, side) => {
                const s = scrW(L2W(o, point[0], point[1], point[2])),
                    q = scrW(L2W(o, probe[0], probe[1], probe[2]));
                if (!s.ok || !q.ok) return;
                const dx = q.x - s.x,
                    dy = q.y - s.y,
                    px = Math.hypot(dx, dy);
                if (px < 0.01) return;
                handles.push({
                    kind: "wall",
                    param,
                    label,
                    s,
                    dir: { x: dx / px, y: dy / px },
                    scale: px / 0.1,
                    start,
                    min: param === "h" ? 0 : 0.01,
                    side,
                });
            },
            addScreen = (param, label, point, dir, start) =>
                handles.push({
                    kind: "wall",
                    param,
                    label,
                    s: { x: point.x, y: point.y, ok: true },
                    dir,
                    scale: Math.max(1, Number(orthScale()) || 1),
                    start,
                    min: param === "h" ? 0 : 0.01,
                    side: 1,
                    screen: true,
                });
        // local x = 面内の幅、local y = 面内の高さ、local z = 面の厚み。
        add("ra", "幅＋", [ra, 0, h / 2], [ra + 0.1, 0, h / 2], ra * 2, 1);
        add("ra", "幅−", [-ra, 0, h / 2], [-ra - 0.1, 0, h / 2], ra * 2, -1);
        add("rb", "高さ＋", [0, rb, h / 2], [0, rb + 0.1, h / 2], rb * 2, 1);
        add("rb", "高さ−", [0, -rb, h / 2], [0, -rb - 0.1, h / 2], rb * 2, -1);
        if (h > 0.000001) {
            add("h", "厚み＋", [0, 0, h], [0, 0, h + 0.1], h, 1);
            add("h", "厚み−", [0, 0, 0], [0, 0, -0.1], h, -1);
        }
        const gap = Math.max(
            52 / Z,
            Math.min(96 / Z, Math.max(ra, rb, h, 0.6) * Math.max(1, Number(orthScale()) || 1) * 0.6),
        );
        const fallback =
            {
                top: {
                    ra: { x: center.x + gap, y: center.y },
                    rb: { x: center.x, y: center.y - gap },
                    h: { x: center.x - gap, y: center.y },
                },
                side: {
                    ra: { x: center.x, y: center.y + gap },
                    rb: { x: center.x, y: center.y - gap },
                    h: { x: center.x + gap, y: center.y },
                },
                front: {
                    ra: { x: center.x + gap, y: center.y },
                    rb: { x: center.x, y: center.y - gap },
                    h: { x: center.x - gap, y: center.y },
                },
            }[orthPlane()] || {};
        [
            ["ra", "幅"],
            ["rb", "高さ"],
            ["h", "厚み"],
        ].forEach(([param, label]) => {
            if (!handles.some((q) => q.param === param)) {
                const p = fallback[param] || { x: center.x + gap, y: center.y },
                    dir =
                        p.x !== center.x ? { x: p.x > center.x ? 1 : -1, y: 0 } : { x: 0, y: p.y > center.y ? 1 : -1 };
                addScreen(param, label, p, dir, param === "ra" ? ra * 2 : param === "rb" ? rb * 2 : h);
            }
        });
        if (o.type === "asset" && o.asset === "cornerCutBox" && typeof cornerCutGizmo === "function") {
            const special = cornerCutGizmo(o),
                h = special?.handle;
            if (h?.s?.ok) handles.push({ ...h, kind: "cornerCut-offset", label: "隅切り" });
            if (special?.opening)
                Object.values(special.opening.handles).forEach((openingHandle) => {
                    if (openingHandle?.s?.ok)
                        handles.push({ ...openingHandle, kind: openingHandle.kind, opening: true });
                });
        }
        if (o.type === "asset" && o.asset === "recessedStackedBuilding" && typeof recessedStackedGizmo === "function") {
            const special = recessedStackedGizmo(o);
            Object.values(special?.handles || {}).forEach((h) => {
                if (h?.s?.ok) handles.push({ ...h, opening: true });
            });
        }
        if (o.type === "asset" && o.asset === "building") handles.push(...floorBuildingInnerHandles(o));
        if (o.type === "asset" && o.asset === "awning") {
            const edge = floorAwningEdgeHandle(o);
            if (edge.length) handles.push(...edge);
        }
        // 壁付けベランダの「壁の厚さ」「床の厚さ」も間取りから編集できるようにする。
        // 3Dと同じ balconyGizmo() の位置を使うので、ビューで能力差が出ない。
        if (
            o.type === "asset" &&
            (o.asset === "balcony" || o.asset === "uWall") &&
            typeof specialGizmo === "function"
        ) {
            const special = specialGizmo(o);
            Object.values(special?.handles || {}).forEach((h) => {
                if (h?.s?.ok) handles.push({ ...h, inner: true });
            });
        }
        return { o, base: centerWorld, center, handles };
    }
    // 選択オブジェクトの寸法ハンドルを生成する。
    // Y生成面は従来の面ハンドル、X/Z生成面はfloorWallEditHandlesを使う。
    function floorPlanEditHandles() {
        const o = floorPlanObject();
        if (!o) return null;
        if (o.type === "compound") return floorCompoundEditHandles(o);
        const [z0, z1] = floorPlanObjectZRange(o),
            base = L2W(o, 0, 0, z0),
            zc = (z0 + z1) / 2,
            center = scrW(L2W(o, 0, 0, zc)),
            handles = [],
            panel =
                o.type === "asset" && o.asset === "building" && o.openingEnabled !== false
                    ? floorBuildingBackPanel(o)
                    : null,
            // 積層建物とパスパイプは、単一のra/rb/hではなく floors/path[] を
            // 持つため、間取り用の汎用ハンドルを出すと別の古い寸法を編集してしまう。
            // 専用ギズモを同じ座標へ描き、pointerdownも通常のギズモ経路へ渡す。
            customEdit =
                o.type === "asset" &&
                (isStackedBuildingAsset(o) || o.asset === "pathPipe" || o.asset === "wallSideSign");
        if (customEdit) return { o, base, center, handles, panel: null, special: true };
        if (o.k !== 1) return floorWallEditHandles(o);
        const add = (kind, label, point, probe, start, min = 0.01, side = 1) => {
            const s = scrW(point),
                q = scrW(probe);
            if (!s.ok || !q.ok) return;
            const dx = q.x - s.x,
                dy = q.y - s.y,
                px = Math.hypot(dx, dy);
            if (px < 0.01) return;
            handles.push({ kind, label, s, dir: { x: dx / px, y: dy / px }, scale: px / 0.1, start, min, side });
        };
        if (orthPlane() === "top") {
            // 幅・奥行はプラス側とマイナス側の両面にハンドルを出す。
            add("w", "幅＋", L2W(o, o.ra, 0, 0), L2W(o, o.ra + 0.1, 0, 0), Math.abs(o.ra) * 2, 0.01, 1);
            add("w", "幅−", L2W(o, -o.ra, 0, 0), L2W(o, -o.ra - 0.1, 0, 0), Math.abs(o.ra) * 2, 0.01, -1);
            add("d", "奥行＋", L2W(o, 0, o.rb, 0), L2W(o, 0, o.rb + 0.1, 0), Math.abs(o.rb) * 2, 0.01, 1);
            add("d", "奥行−", L2W(o, 0, -o.rb, 0), L2W(o, 0, -o.rb - 0.1, 0), Math.abs(o.rb) * 2, 0.01, -1);
            // 真上では高さ方向が投影されないため、画面上へ逃がして表示する。
            // 以前は真下（center の 48px 下）へ置いていたため「奥行−」の白い四角と
            // ほぼ同じ位置になり、押しても高さが変わらなかった。
            // 右下の角の外側へ斜めに逃がし、他のハンドルと重ならない位置にする。
            const corner = scrW(
                    L2W(o, Math.abs(Number(o.ra) || 0.3), -Math.abs(Number(o.rb) || 0.3), 0),
                ),
                out = 24 / Z,
                gap = orthHandleGap(Math.max(Math.abs(Number(o.ra) || 0.5), Math.abs(Number(o.rb) || 0.5)), 0.65);
            handles.push({
                kind: "h",
                label: "高さ",
                s: corner.ok
                    ? { x: corner.x + out, y: corner.y + out, ok: true }
                    : { x: center.x + gap, y: center.y + gap, ok: true },
                dir: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
                scale: orthScale() * Math.SQRT1_2,
                start: Math.max(0, Number(o.h) || 0),
                min: 0,
                screen: true,
            });
        } else if (orthPlane() === "side") {
            add("d", "奥行＋", L2W(o, 0, o.rb, zc), L2W(o, 0, o.rb + 0.1, zc), Math.abs(o.rb) * 2, 0.01, 1);
            add("d", "奥行−", L2W(o, 0, -o.rb, zc), L2W(o, 0, -o.rb - 0.1, zc), Math.abs(o.rb) * 2, 0.01, -1);
            // 真横ビューは黒い外枠の上端・下端へ高さハンドルを置く。
            // 看板の内部余白を含む全高 h の外側へは逃がさない。
            // ベベル直方体は初期状態が厚み0の面なので、下端と上端が
            // 同じ位置に重なって移動を奪わないよう、高さハンドルを上へ逃がす。
            if (Math.max(0, Number(o.h) || 0) <= 1e-6) {
                const gap = orthHandleGap(Math.max(Math.abs(Number(o.ra) || 0.5), Math.abs(Number(o.rb) || 0.5)), 0.65);
                handles.push({
                    kind: "h",
                    label: "高さ",
                    s: { x: center.x, y: center.y - gap, ok: true },
                    dir: { x: 0, y: -1 },
                    scale: orthScale(),
                    start: 0,
                    min: 0,
                    screen: true,
                });
            } else {
                add("h", "上端", L2W(o, 0, 0, z1), L2W(o, 0, 0, z1 + 0.1), Math.max(0, Number(o.h) || 0), 0, 1);
                add("h", "下端", L2W(o, 0, 0, z0), L2W(o, 0, 0, z0 - 0.1), Math.max(0, Number(o.h) || 0), 0, -1);
            }
        } else if (orthPlane() === "front") {
            // 正面では幅と高さを直接編集し、見えない奥行きは画面上へ逃がしたハンドルで編集する。
            // 正面の幅ハンドルも、看板では黒い外枠の下端へ置く。
            // 全高の底面 z=0 に置くと、看板の外枠から下へ浮いてしまう。
            add("w", "幅＋", L2W(o, o.ra, 0, z0), L2W(o, o.ra + 0.1, 0, z0), Math.abs(o.ra) * 2, 0.01, 1);
            add("w", "幅−", L2W(o, -o.ra, 0, z0), L2W(o, -o.ra - 0.1, 0, z0), Math.abs(o.ra) * 2, 0.01, -1);
            // 初期の厚み0では上下端が同じ画面点になり、クリックが高さ編集へ
            // 吸われる。高さハンドルを上へ逃がして面の移動を残す。
            if (Math.max(0, Number(o.h) || 0) <= 1e-6) {
                const gap = orthHandleGap(Math.max(Math.abs(Number(o.ra) || 0.5), Math.abs(Number(o.rb) || 0.5)), 0.65);
                handles.push({
                    kind: "h",
                    label: "高さ",
                    s: { x: center.x, y: center.y - gap, ok: true },
                    dir: { x: 0, y: -1 },
                    scale: orthScale(),
                    start: 0,
                    min: 0,
                    screen: true,
                });
            } else {
                add("h", "上端", L2W(o, 0, 0, z1), L2W(o, 0, 0, z1 + 0.1), Math.max(0, Number(o.h) || 0), 0, 1);
                add("h", "下端", L2W(o, 0, 0, z0), L2W(o, 0, 0, z0 - 0.1), Math.max(0, Number(o.h) || 0), 0, -1);
            }
            // 奥行き（画面に投影されない軸）は、右上の角の外側へ斜めに逃がす。
            // 以前は中心の真横（+60px）へ置いていたため「幅＋」の白い四角と重なり、
            // 押しても幅の変更として処理されていた。
            const corner = scrW(L2W(o, Math.abs(Number(o.ra) || 0.3), 0, z1)),
                out = 26 / Z,
                gap = orthHandleGap(Math.max(Math.abs(Number(o.ra) || 0.5), Math.abs(Number(o.h) || 0.6)), 0.65);
            handles.push({
                kind: "d",
                label: "奥行き",
                s: corner.ok
                    ? { x: corner.x + out, y: corner.y - out, ok: true }
                    : { x: center.x + gap, y: center.y - gap, ok: true },
                dir: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
                scale: orthScale() * Math.SQRT1_2,
                start: Math.abs(o.rb) * 2,
                min: 0.01,
                side: 1,
                screen: true,
            });
        }
        if (o.type === "asset" && o.asset === "cornerCutBox" && typeof cornerCutGizmo === "function") {
            const special = cornerCutGizmo(o),
                h = special?.handle;
            if (h?.s?.ok) handles.push({ ...h, kind: "cornerCut-offset", label: "隅切り" });
            if (special?.opening)
                Object.values(special.opening.handles).forEach((openingHandle) => {
                    if (openingHandle?.s?.ok)
                        handles.push({ ...openingHandle, kind: openingHandle.kind, opening: true });
                });
        }
        if (o.type === "asset" && o.asset === "recessedStackedBuilding" && typeof recessedStackedGizmo === "function") {
            const special = recessedStackedGizmo(o);
            Object.values(special?.handles || {}).forEach((h) => {
                if (h?.s?.ok) handles.push({ ...h, opening: true });
            });
        }
        if (o.type === "asset" && o.asset === "building") handles.push(...floorBuildingInnerHandles(o));
        if (o.type === "asset" && o.asset === "awning") {
            const edge = floorAwningEdgeHandle(o);
            if (edge.length) handles.push(...edge);
        }
        if (o.type === "asset" && o.asset === "balcony" && typeof balconyGizmo === "function") {
            const special = balconyGizmo(o);
            Object.values(special?.handles || {}).forEach((h) => {
                if (h?.s?.ok) handles.push({ ...h, inner: true });
            });
        }
        return { o, base, center, handles, panel };
    }
    // 間取りの白い四角／オレンジ菱形を、近い順に拾う。
    // ここを通らず家具移動へ落ちると、サイズ変更ではなく移動になってしまう。
    function floorPlanEditHandleAt(p) {
        const g = floorPlanEditHandles();
        if (!g?.handles?.length) return null;
        const lim = 20 / Z,
            // 重なったハンドルは「押した位置に近い方」を掴む。
            // 同じくらいの距離なら、テントの前縁など専用ハンドル（inner）を優先する。
            // 以前は配列の順で先に来たもの（多くは白い四角）が必ず勝っていたため、
            // 意図したハンドルと違うものを掴んでいた。
            hit = g.handles
                .map((h) => ({ h, d: Math.hypot(h.s.x - p.x, h.s.y - p.y) }))
                .filter((q) => q.d < lim)
                .sort((a, b) => a.d - (a.h.inner ? 1.2 : 0) - (b.d - (b.h.inner ? 1.2 : 0)))[0];
        return hit ? { g, h: hit.h } : null;
    }
    function floorMoveGizmo(o) {
        if (!o) return null;
        const b = obBounds(o),
            centerWorld = [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2],
            center = scrW(centerWorld),
            sc = Math.max(1, Number(orthScale()) || 1),
            // 矢印の長さは、寸法ハンドル（幅＋−／奥行＋−／高さ）へ届かない長さにする。
            // 以前は 64px 固定で、外側の白い四角や回転リングの丸と重なり、
            // 矢印を掴んでも寸法変更や回転として処理されていた。
            halfPx = Math.max(
                6,
                Math.min(Math.abs(b.hi[0] - b.lo[0]), Math.abs(b.hi[2] - b.lo[2])) * sc * 0.5,
            ),
            screenLen = Math.max(20, Math.min(46, halfPx * 0.85)) / Z,
            worldLen = Math.max(0.45, Math.min(2.4, screenLen / sc));
        // 軸の表示名と色は3Dギズモと同じ約束へ揃える。
        // 左右＝X（橙）／手前奥＝Y（緑）／上下＝Z（青）。
        // 正投影で画面へ投影されない軸は、真横へ潰すと他の軸と重なるため、
        // 斜め右下へ逃がして必ず掴めるようにする。
        const diag = { x: Math.SQRT1_2, y: Math.SQRT1_2 },
            defs =
                orthPlane() === "top"
                    ? [
                          { vec: [1, 0, 0], name: "X", col: "#e8743d" },
                          { vec: [0, 0, 1], name: "Y", col: "#3aa76a" },
                          { vec: [0, 1, 0], name: "Z", col: "#4a7be8", screenDir: diag },
                      ]
                    : orthPlane() === "side"
                      ? [
                            { vec: [0, 0, 1], name: "Y", col: "#3aa76a" },
                            { vec: [0, 1, 0], name: "Z", col: "#4a7be8" },
                            { vec: [1, 0, 0], name: "X", col: "#e8743d", screenDir: diag },
                        ]
                      : [
                            { vec: [1, 0, 0], name: "X", col: "#e8743d" },
                            { vec: [0, 1, 0], name: "Z", col: "#4a7be8" },
                            { vec: [0, 0, 1], name: "Y", col: "#3aa76a", screenDir: diag },
                        ];
        const axes = defs
            .map((d) => {
                const q = scrW(V.add(centerWorld, d.vec, 1, worldLen)),
                    dx = q.x - center.x,
                    dy = q.y - center.y,
                    px = Math.hypot(dx, dy);
                if (d.screenDir)
                    return {
                        ...d,
                        sT: {
                            x: center.x + d.screenDir.x * screenLen,
                            y: center.y + d.screenDir.y * screenLen,
                            ok: true,
                        },
                        screen: true,
                        scale: sc,
                    };
                if (!q.ok || px < 4) return null;
                return { ...d, sT: q, screen: false, scale: px / worldLen || 1 };
            })
            .filter(Boolean);
        return { centerWorld, center, axes };
    }
    // 移動の矢印は「根元〜先端」ではなく外側だけを掴めるようにする。
    // 中心から先端までの線分全体を当たり判定にすると、図形の内側を通る線が
    // 面・寸法ハンドルを奪ってしまう（3D側の AXIS_GRAB_FROM と同じ考え方）。
    function floorMoveHandleAt(p) {
        const o = floorPlanObject(),
            g = floorMoveGizmo(o);
        if (!g) return null;
        const lim = 14 / Z;
        let best = null;
        for (const a of g.axes) {
            const from = {
                x: g.center.x + (a.sT.x - g.center.x) * 0.45,
                y: g.center.y + (a.sT.y - g.center.y) * 0.45,
            };
            const d = segd(p, from, a.sT);
            if (d < lim && (!best || d < best.d)) best = { g, a, d };
        }
        return best;
    }
    function drawFloorMoveGizmo(c, o) {
        const g = floorMoveGizmo(o);
        if (!g) return;
        const h = 8 / Z;
        c.save();
        c.lineCap = "round";
        c.lineJoin = "round";
        c.font = `bold ${12 / Z}px system-ui`;
        g.axes.forEach((a) => {
            const dx = a.sT.x - g.center.x,
                dy = a.sT.y - g.center.y,
                l = Math.hypot(dx, dy) || 1,
                ux = dx / l,
                uy = dy / l;
            c.strokeStyle = a.col;
            c.fillStyle = a.col;
            c.lineWidth = 3 / Z;
            c.beginPath();
            c.moveTo(g.center.x, g.center.y);
            c.lineTo(a.sT.x, a.sT.y);
            c.stroke();
            c.beginPath();
            c.moveTo(a.sT.x + ux * h, a.sT.y + uy * h);
            c.lineTo(a.sT.x - ux * h - uy * h * 0.65, a.sT.y - uy * h + ux * h * 0.65);
            c.lineTo(a.sT.x - ux * h + uy * h * 0.65, a.sT.y - uy * h - ux * h * 0.65);
            c.closePath();
            c.fill();
            gzLabel(c, a.name, a.sT.x + ux * h + 4 / Z, a.sT.y + uy * h + 4 / Z, "#ff9f68", 12);
        });
        c.fillStyle = "#fff";
        c.strokeStyle = "#102027";
        c.lineWidth = 1.3 / Z;
        c.beginPath();
        c.arc(g.center.x, g.center.y, 5 / Z, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.restore();
    }
    function drawFloorPlanEditHandles(c) {
        const g = floorPlanEditHandles();
        if (!g) return;
        c.save();
        c.lineCap = "round";
        c.lineJoin = "round";
        c.font = `bold ${11 / Z}px system-ui`;
        if (g.panel && g.panel.points && g.panel.points.every((q) => q && q.ok)) {
            c.fillStyle = "rgba(255,179,111,.18)";
            c.strokeStyle = "#ffb36f";
            c.lineWidth = 1.7 / Z;
            c.beginPath();
            g.panel.points.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
            c.closePath();
            c.fill();
            c.stroke();
        }
        g.handles.forEach((h) => {
            const opening = !!h.opening,
                orange =
                    opening ||
                    h.kind === "buildingBackFace" ||
                    h.kind === "awningEdgeZ" ||
                    h.kind === "awningEdgeY" ||
                    h.kind === "cornerCut-offset",
                col = opening ? h.color || "#ffd34d" : orange ? "#ffb36f" : "#66e3c8",
                fill = opening ? "#fff0b0" : orange ? "#ffd0a8" : "#d9fff6";
            c.strokeStyle = opening ? `${col}dd` : orange ? "rgba(255,179,111,.88)" : "rgba(102,227,200,.85)";
            c.fillStyle = col;
            c.lineWidth = 1.2 / Z;
            c.setLineDash([4 / Z, 3 / Z]);
            c.beginPath();
            const lineAnchor = opening && h.anchor?.ok ? h.anchor : g.center;
            c.moveTo(lineAnchor.x, lineAnchor.y);
            c.lineTo(h.s.x, h.s.y);
            c.stroke();
            c.setLineDash([]);
            c.fillStyle = "#fff";
            c.strokeStyle = col;
            c.beginPath();
            if (orange) {
                c.moveTo(h.s.x, h.s.y - 7 / Z);
                c.lineTo(h.s.x + 7 / Z, h.s.y);
                c.lineTo(h.s.x, h.s.y + 7 / Z);
                c.lineTo(h.s.x - 7 / Z, h.s.y);
            } else c.rect(h.s.x - 6 / Z, h.s.y - 6 / Z, 12 / Z, 12 / Z);
            c.closePath();
            c.fill();
            c.stroke();
            const handleLabel = h.kind === "recessed-window-count" ? `${h.label} ${Math.round(h.start)}枚` : h.kind === "recessed-floor-gap" ? `${h.label} ${Number(h.start).toFixed(2)}m` : h.label;
            gzLabel(c, handleLabel, h.s.x + 8 / Z, h.s.y - 7 / Z, fill, 12);
        });
        c.restore();
    }
    function drawFloorPlanOverlay(c) {
        if (orthPlane() !== "top" && orthPlane() !== "side" && orthPlane() !== "front") return;
        const h = floorPlanHandles(),
            r = 9 / Z;
        c.save();
        c.lineCap = "round";
        c.lineJoin = "round";
        // 選択中オブジェクト：前側の回転ハンドルと薄い外枠
        if (h.object) {
            const o = h.object.o,
                [z0, z1] = floorPlanObjectZRange(o),
                pathBounds = o.type === "asset" && o.asset === "pathPipe" ? obBounds(o) : null,
                boundsCenter = pathBounds
                    ? [
                          (pathBounds.lo[0] + pathBounds.hi[0]) / 2,
                          (pathBounds.lo[1] + pathBounds.hi[1]) / 2,
                          (pathBounds.lo[2] + pathBounds.hi[2]) / 2,
                      ]
                    : null,
                corners = pathBounds
                    ? orthPlane() === "top"
                        ? [
                              [pathBounds.lo[0], boundsCenter[1], pathBounds.lo[2]],
                              [pathBounds.hi[0], boundsCenter[1], pathBounds.lo[2]],
                              [pathBounds.hi[0], boundsCenter[1], pathBounds.hi[2]],
                              [pathBounds.lo[0], boundsCenter[1], pathBounds.hi[2]],
                              [pathBounds.lo[0], boundsCenter[1], pathBounds.lo[2]],
                          ]
                        : orthPlane() === "side"
                          ? [
                                [boundsCenter[0], pathBounds.lo[1], pathBounds.lo[2]],
                                [boundsCenter[0], pathBounds.lo[1], pathBounds.hi[2]],
                                [boundsCenter[0], pathBounds.hi[1], pathBounds.hi[2]],
                                [boundsCenter[0], pathBounds.hi[1], pathBounds.lo[2]],
                                [boundsCenter[0], pathBounds.lo[1], pathBounds.lo[2]],
                            ]
                          : [
                                [pathBounds.lo[0], pathBounds.lo[1], boundsCenter[2]],
                                [pathBounds.hi[0], pathBounds.lo[1], boundsCenter[2]],
                                [pathBounds.hi[0], pathBounds.hi[1], boundsCenter[2]],
                                [pathBounds.lo[0], pathBounds.hi[1], boundsCenter[2]],
                                [pathBounds.lo[0], pathBounds.lo[1], boundsCenter[2]],
                            ]
                    : o.type === "asset" && o.asset === "cornerCutBox" && typeof cornerCutBoxParams === "function"
                      ? (() => {
                            const q = cornerCutBoxParams(o),
                                footprint = cornerCutFootprint(q.w, q.d, q.cornerOffset, q.cornerCutCorner);
                            return [...footprint, footprint[0]];
                        })()
                      : [
                            [-o.ra, -o.rb],
                            [o.ra, -o.rb],
                            [o.ra, o.rb],
                            [-o.ra, o.rb],
                            [-o.ra, -o.rb],
                        ];
            c.strokeStyle = "rgba(255,159,104,.9)";
            c.lineWidth = 1.5 / Z;
            c.setLineDash([6 / Z, 4 / Z]);
            c.beginPath();
            corners.forEach((v, i) => {
                const p = pathBounds ? v : L2W(o, v[0], v[1], z0),
                    q = scrW(p);
                i ? (q.ok ? c.lineTo(q.x, q.y) : null) : c.moveTo(q.x, q.y);
            });
            c.stroke();
            c.setLineDash([]);
            if (orthPlane() === "side" && z1 > z0 && !pathBounds) {
                const baseCorners = [
                    [-o.ra, -o.rb],
                    [o.ra, -o.rb],
                    [o.ra, o.rb],
                    [-o.ra, o.rb],
                ];
                c.strokeStyle = "rgba(255,159,104,.75)";
                c.lineWidth = 1.2 / Z;
                c.beginPath();
                baseCorners.forEach(([x, y], i) => {
                    const q = scrW(L2W(o, x, y, z1));
                    i ? (q.ok ? c.lineTo(q.x, q.y) : null) : c.moveTo(q.x, q.y);
                });
                c.closePath();
                baseCorners.forEach(([x, y]) => {
                    const a = scrW(L2W(o, x, y, z0)),
                        b = scrW(L2W(o, x, y, z1));
                    if (a.ok && b.ok) {
                        c.moveTo(a.x, a.y);
                        c.lineTo(b.x, b.y);
                    }
                });
                c.stroke();
            } else if (orthPlane() === "front" && !pathBounds) {
                const frontCorners =
                    o.type === "asset" && o.asset === "sign"
                        ? [L2W(o, -o.ra, 0, z0), L2W(o, o.ra, 0, z0), L2W(o, o.ra, 0, z1), L2W(o, -o.ra, 0, z1)]
                        : (() => {
                              const b = obBounds(o),
                                  z = (b.lo[2] + b.hi[2]) / 2;
                              return [
                                  [b.lo[0], b.lo[1], z],
                                  [b.hi[0], b.lo[1], z],
                                  [b.hi[0], b.hi[1], z],
                                  [b.lo[0], b.hi[1], z],
                              ];
                          })();
                c.strokeStyle = "rgba(255,159,104,.75)";
                c.lineWidth = 1.2 / Z;
                c.beginPath();
                frontCorners.forEach((v, i) => {
                    const q = scrW(v);
                    i ? (q.ok ? c.lineTo(q.x, q.y) : null) : c.moveTo(q.x, q.y);
                });
                c.closePath();
                c.stroke();
            }
            c.strokeStyle = "#ff9f68";
            c.lineWidth = 1.5 / Z;
            c.beginPath();
            c.moveTo(h.object.center.x, h.object.center.y);
            c.lineTo(h.object.s.x, h.object.s.y);
            c.stroke();
            c.fillStyle = "#fff";
            c.strokeStyle = "#ff9f68";
            c.lineWidth = 2 / Z;
            c.beginPath();
            c.arc(h.object.s.x, h.object.s.y, r, 0, Math.PI * 2);
            c.fill();
            c.stroke();
            c.beginPath();
            c.arc(h.object.s.x, h.object.s.y, r * 0.52, -Math.PI * 0.15, Math.PI * 1.3);
            c.stroke();
            drawFloorMoveGizmo(c, h.object.o);
            const editHandles = floorPlanEditHandles();
            if (editHandles?.special) {
                // 専用ギズモを持つアセット（積層建物・パスパイプなど）は
                // 幅／奥行／高さの汎用ハンドルを出さない。
            } else {
                drawFloorPlanEditHandles(c);
            }
            // アセット専用ハンドル（窓の幅・高さの青い菱形、人物の関節の丸、
            // 金具・ベベルなど）は、間取りの汎用ハンドルの有無に関わらず
            // どのビューでも同じように描く。
            // 以前は「専用ギズモを持つアセット」と「ベベル直方体・壁付け看板」だけを
            // ここで描いていたため、人物や窓グリッドは 3D でしか見えず、
            // 前／横／上では「編集できるのにハンドルが無い」状態だった。
            // 壁横看板だけは engine-gizmo.js 側の drawGizmo が担当するので二重に描かない。
            // ツールが「編集」以外でも、選択中なら3Dビューと同じように専用ハンドルを描く。
            // 3D側（engine-gizmo.js の drawGizmo）はツールに関係なく描画するため、
            // ここで tool === "edit" を条件にすると「3Dでは出るが前／横／上では出ない」
            // という差が生まれる（実際にその状態になっていた）。
            if (h.object.o?.asset !== "wallSideSign") drawSpecialGizmo(c, h.object.o);
        }
        // カメラ：本体をドラッグして位置、先端の丸をドラッグして向き
        const k = h.camera,
            half = Math.atan(18 / Math.max(12, Number(P.lens) || 38)),
            body = k.sBody,
            target = k.sTarget,
            cameraY = orthPlane() === "side" || orthPlane() === "front" ? P.ch - 1 : -1,
            horiz = Math.cos(k.pitch),
            coneY =
                orthPlane() === "side" || orthPlane() === "front" ? cameraY + Math.sin(k.pitch) * FLOOR_CAMERA_RAY : cameraY,
            left = scrW([
                P.cx - Math.sin(k.yaw - half) * FLOOR_CAMERA_RAY * horiz,
                coneY,
                P.cz + Math.cos(k.yaw - half) * FLOOR_CAMERA_RAY * horiz,
            ]),
            right = scrW([
                P.cx - Math.sin(k.yaw + half) * FLOOR_CAMERA_RAY * horiz,
                coneY,
                P.cz + Math.cos(k.yaw + half) * FLOOR_CAMERA_RAY * horiz,
            ]);
        c.fillStyle = "rgba(102,227,200,.16)";
        c.strokeStyle = "#66e3c8";
        c.lineWidth = 1.2 / Z;
        c.beginPath();
        c.moveTo(body.x, body.y);
        c.lineTo(left.x, left.y);
        c.lineTo(right.x, right.y);
        c.closePath();
        c.fill();
        c.stroke();
        c.beginPath();
        c.moveTo(body.x, body.y);
        c.lineTo(target.x, target.y);
        c.stroke();
        c.fillStyle = "#66e3c8";
        c.strokeStyle = "#164c4b";
        c.lineWidth = 1.5 / Z;
        c.beginPath();
        c.arc(body.x, body.y, r, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.fillStyle = "#fff";
        c.strokeStyle = "#66e3c8";
        c.beginPath();
        c.arc(target.x, target.y, r * 0.82, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        if (k.sLens && k.sLens.ok) {
            const q = k.sLens,
                s = 6 / Z;
            c.fillStyle = "#fff";
            c.strokeStyle = "#ffd34d";
            c.lineWidth = 1.5 / Z;
            c.beginPath();
            c.moveTo(q.x, q.y - s);
            c.lineTo(q.x + s, q.y);
            c.lineTo(q.x, q.y + s);
            c.lineTo(q.x - s, q.y);
            c.closePath();
            c.fill();
            c.stroke();
            gzLabel(c, "レンズ", q.x + 8 / Z, q.y - 7 / Z, "#ffe6a1", 10);
        }
        c.restore();
    }
    window.cityFloorPlanOverlay = drawFloorPlanOverlay;
    function syncFloorPlanSelection() {
        const o = floorPlanObject(),
            canRotate = !!(o && !o.attachment?.verticalOnly),
            label = o ? (o.type === "asset" ? assetLabel(o) || "アセット" : "図形") : "オブジェクト";
        const text = o
            ? `${label} を選択中（向き ${Math.round(angle360(o.rot))}°）`
            : "オブジェクトを選択すると、移動・回転できます。";
        const status = el("floorPlanSelectionStatus");
        if (status) status.textContent = text;
        const dockStatus = el("floorPlanDockStatus");
        if (dockStatus) {
            const cameraHint =
                orthPlane() === "side"
                    ? "真横：カメラ本体＝位置・高さ　／　先端の丸＝上下の傾き"
                    : orthPlane() === "front"
                      ? "正面：カメラ本体＝X位置・高さ　／　先端の丸＝上下の傾き"
                      : "カメラ本体：位置　／　先端の丸＝向き";
            dockStatus.innerHTML = `${text}<small>幅・奥行ハンドルは反対側の面を固定　／　${cameraHint}</small>`;
        }
        [
            ["floorRotateLeft", canRotate],
            ["floorRotateRight", canRotate],
            ["floorRotate90", canRotate],
            ["floorDelete", !!o],
        ].forEach(([id, on]) => {
            const b = el(id);
            if (b) b.disabled = !on;
        });
        floorPlanDock.querySelectorAll("[data-floor-dock-action]").forEach((b) => {
            const a = b.dataset.floorDockAction;
            b.disabled =
                a === "delete" ? !o : ["left", "right", "rot30", "rot45", "90"].includes(a) ? !canRotate : false;
        });
        const undoButton = el("floorUndo"),
            redoButton = el("floorRedo");
        if (undoButton) undoButton.disabled = !HU.length;
        if (redoButton) redoButton.disabled = !RD.length;
        const lensInput = el("floorLensInput");
        if (lensInput && document.activeElement !== lensInput) lensInput.value = Number(P.lens || 35).toFixed(0);
    }
    // Y生成面の幅・奥行き・高さハンドルを、オブジェクト定義の差分へ変換する。
    // X/Z生成面は上のfloorWallDimensionPatchへ分岐する。
    function floorDimensionPatch(o, name, value, side = 1) {
        const v = Math.max(name === "h" ? 0 : 0.01, Number(value));
        if (!Number.isFinite(v)) return null;
        if (o.type === "asset" && o.asset === "recessedStackedBuilding" && typeof recessedStackedBuildingParams === "function") {
            const q = recessedStackedBuildingParams(o),
                cs = Math.cos(Number(o.rot || 0) * DG),
                sn = Math.sin(Number(o.rot || 0) * DG),
                patch = {};
            if (name === "w" || name === "d") {
                const old = name === "w" ? q.w : q.d,
                    delta = (v - old) / 2;
                if (name === "w") {
                    patch.ca = (Number(o.ca) || 0) + side * delta * cs;
                    patch.cb = (Number(o.cb) || 0) + side * delta * sn;
                    patch.ra = Math.max(0.25, v / 2);
                } else {
                    patch.ca = (Number(o.ca) || 0) - side * delta * sn;
                    patch.cb = (Number(o.cb) || 0) + side * delta * cs;
                    patch.rb = Math.max(0.25, v / 2);
                }
                return patch;
            }
            if (name === "h") {
                const nextFloorHeight = clamp(
                    (v - q.firstFloorExtra - Math.max(0, q.floorCount - 1) * q.floorGap) / q.floorCount,
                    0.5,
                    30,
                );
                return { floorHeight: nextFloorHeight, h: v };
            }
        }
        if (o.type === "compound") {
            const b = obBounds(o),
                axis = { w: 0, d: 2, h: 1 }[name];
            if (axis === undefined) return null;
            const oldSpan = Math.max(0.005, b.hi[axis] - b.lo[axis]),
                pivot = [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2],
                fixed = side < 0 ? b.hi[axis] : b.lo[axis],
                scale = [1, 1, 1];
            pivot[axis] = fixed;
            scale[axis] = Math.max(0.005, v) / oldSpan;
            return scaleCompoundDefinition(o, pivot, scale);
        }
        if (o.type === "asset" && o.asset === "building") {
            const g = buildingGeometry(o);
            if (name === "w") {
                const delta = (v - g.w) / 2,
                    cs = Math.cos(Number(o.rot || 0) * DG),
                    sn = Math.sin(Number(o.rot || 0) * DG);
                return {
                    ca: o.ca + side * delta * cs,
                    cb: o.cb + side * delta * sn,
                    ra: Math.max(0.05, v / 2),
                    openingW: clamp(g.openingW, 0.1, Math.max(0.1, v - 0.1)),
                };
            }
            if (name === "d") {
                const delta = (v - g.d) / 2,
                    cs = Math.cos(Number(o.rot || 0) * DG),
                    sn = Math.sin(Number(o.rot || 0) * DG),
                    patch = { ca: o.ca - side * delta * sn, cb: o.cb + side * delta * cs, rb: Math.max(0.025, v / 2) };
                if (Number.isFinite(Number(o.openingBack)))
                    patch.openingBack = clamp(Number(o.openingBack), -v / 2 + 0.025, v / 2 - 0.025);
                return patch;
            }
            if (name === "h") {
                const patch = { h: Math.max(0.1, v), openingH: clamp(g.openingH, 0.1, Math.max(0.1, v - 0.1)) };
                if (side === -1) patch.lift = Number(o.lift || 0) + g.h - v;
                return patch;
            }
        }
        if (name === "w" || name === "d") {
            const oldW = Math.max(0.01, Number(o.ra || 0) * 2),
                oldD = Math.max(0.01, Number(o.rb || 0) * 2),
                r = Math.max(0.005, v / 2),
                patch = {};
            // 幅／奥行ハンドルは手前側の面を動かす。反対側の面を固定するため、
            // 中点をそのままにせず、中心(ca/cb)も半分の差分だけ同じ面側へ移動する。
            const delta = (v - (name === "w" ? oldW : oldD)) / 2,
                cs = Math.cos(Number(o.rot || 0) * DG),
                sn = Math.sin(Number(o.rot || 0) * DG);
            if (name === "w") {
                patch.ca = o.ca + side * delta * cs;
                patch.cb = o.cb + side * delta * sn;
            } else {
                patch.ca = o.ca - side * delta * sn;
                patch.cb = o.cb + side * delta * cs;
            }
            if (o.asset === "sphere" || o.type === "cyl") {
                patch.ra = r;
                patch.rb = r;
                if (o.asset === "sphere") patch.h = r * 2;
            } else patch[name === "w" ? "ra" : "rb"] = r;
            return patch;
        }
        const patch = { h: v };
        // 真横ビューの下端ハンドルは、上面を固定したまま下側の面だけを動かす。
        // k=1,d=-1の床では、下端を下げるほどliftが減り、上端は変わらない。
        if (name === "h" && side === -1) patch.lift = Number(o.lift || 0) + Math.max(0, Number(o.h) || 0) - v;
        if (o.type === "rect" || o.type === "circ") patch.extrude = v > 1e-6;
        return patch;
    }
    // 間取りの幅／奥行ハンドル用スナップ。動かしている面の法線上で、
    // 他オブジェクトの外周エッジ／角の投影へ近づいたときだけ補正する。
    // 通常ビューの面スナップと同じく、隣接している対象だけを候補にする。
    function floorFootprintXZ(o) {
        if (!o) return [];
        // 地面オブジェクトは回転後の実際の四隅を使う。壁・天井の図形は
        // L2W(o, ..., ..., 0)だけだと床面上の外周が退化するため、3D外周箱を
        // X/Zへ投影して、間取り上で隣接判定できるようにする。
        if (o.type === "asset" && o.asset === "cornerCutBox" && typeof cornerCutBoxParams === "function") {
            const q = cornerCutBoxParams(o),
                footprint = cornerCutFootprint(q.w, q.d, q.cornerOffset, q.cornerCutCorner);
            return footprint.map(([x, y]) => {
                const p = L2W(o, x, y, 0);
                return { x: p[0], z: p[2] };
            });
        }
        if (o.k === 1) {
            const out = [];
            for (const x of [-Math.abs(Number(o.ra) || 0), Math.abs(Number(o.ra) || 0)])
                for (const y of [-Math.abs(Number(o.rb) || 0), Math.abs(Number(o.rb) || 0)]) {
                    const p = L2W(o, x, y, 0);
                    out.push({ x: p[0], z: p[2] });
                }
            return out;
        }
        const b = obBounds(o),
            out = [];
        for (const x of [b.lo[0], b.hi[0]]) for (const z of [b.lo[2], b.hi[2]]) out.push({ x, z });
        return out;
    }
    function floorHeightSnap(o, patch, h, value) {
        const q = { ...o, ...patch },
            base = L2W(q, 0, 0, 0),
            height = Math.max(0, Number(q.h) || 0),
            topY = base[1] - Number(q.d || -1) * height,
            side = Number(h?.side) === -1 ? -1 : 1,
            movingY = side === -1 ? base[1] : topY,
            fp = floorFootprintXZ(q);
        if (fp.length < 4) return patch;
        const x0 = Math.min(...fp.map((p) => p.x)),
            x1 = Math.max(...fp.map((p) => p.x)),
            z0 = Math.min(...fp.map((p) => p.z)),
            z1 = Math.max(...fp.map((p) => p.z));
        const scale = Math.max(24, Number(orthScale()) || 24),
            tau = Math.max(0.04, (Number(P.sn) || 14) / scale),
            tolerance = Math.max(0.01, tau * 0.25);
        let best = null;
        targetsOf(o.id).forEach((t) => {
            const to = obOf(t.id),
                tf = floorFootprintXZ(to);
            if (tf.length < 4) return;
            const tx0 = Math.min(...tf.map((p) => p.x)),
                tx1 = Math.max(...tf.map((p) => p.x)),
                tz0 = Math.min(...tf.map((p) => p.z)),
                tz1 = Math.max(...tf.map((p) => p.z));
            if (
                Math.min(x1, tx1) - Math.max(x0, tx0) < -tolerance ||
                Math.min(z1, tz1) - Math.max(z0, tz0) < -tolerance
            )
                return;
            const b = t.b;
            [b.lo[1], b.hi[1]].forEach((targetY) => {
                const gap = targetY - movingY;
                if (Math.abs(gap) <= tau && (!best || Math.abs(gap) < Math.abs(best.gap))) best = { gap, id: t.id };
            });
        });
        if (!best) return patch;
        snapHit = new Set([best.id]);
        // 下端は高さ変更量と面の移動方向が逆なのでsideを掛ける。
        return floorDimensionPatch(o, "h", Math.max(0, Number(value) + side * best.gap), side);
    }
    function floorResizeSnap(o, patch, h, value) {
        if (o.type === "compound") return patch;
        if (o.type === "asset" && o.asset === "building" && h && ["w", "d", "h"].includes(h.kind)) {
            const g = buildingGeometry(o),
                axis = h.kind === "w" ? 0 : h.kind === "d" ? 2 : 1,
                old = axis === 0 ? g.w : axis === 2 ? g.d : g.h,
                opening = h.kind === "w" ? g.openingW : h.kind === "h" ? g.openingH : null;
            if (opening != null) {
                if (h.kind === "w")
                    patch.openingW = clamp(opening, 0.1, Math.max(0.1, Number(patch.ra || o.ra) * 2 - 0.1));
                else patch.openingH = clamp(opening, 0.1, Math.max(0.1, Number(patch.h || o.h) - 0.1));
            }
        }
        if (!$("snp")?.checked || !h || !["w", "d", "h"].includes(h.kind)) return patch;
        if (h.kind === "h") return floorHeightSnap(o, patch, h, value);
        const q = { ...o, ...patch },
            a = Number(q.rot || 0) * DG;
        // sideは「＋側／−側」の面そのもの。0や未設定を＋側へ丸めるが、
        // −1は絶対に失わない。間取り9の下辺はここで−1になる。
        const side = Number(h.side) === -1 ? -1 : 1;
        const nx = h.kind === "w" ? Math.cos(a) : -Math.sin(a),
            nz = h.kind === "w" ? Math.sin(a) : Math.cos(a),
            tx = -nz,
            tz = nx;
        const face = h.kind === "w" ? L2W(q, side * q.ra, 0, 0) : L2W(q, 0, side * q.rb, 0),
            at = face[0] * nx + face[2] * nz,
            tAt = face[0] * tx + face[2] * tz;
        const halfT = h.kind === "w" ? Math.abs(q.rb) : Math.abs(q.ra),
            faceMin = tAt - halfT,
            faceMax = tAt + halfT;
        // P.snは通常ビューと同じ画面上の吸着距離。正投影ではorthScaleがpx／world。
        const scale = Math.max(24, Number(orthScale()) || 24),
            tau = Math.max(0.04, (Number(P.sn) || 14) / scale);
        let best = null;
        targetsOf(o.id).forEach((t) => {
            const to = obOf(t.id),
                fp = floorFootprintXZ(to);
            if (fp.length < 4) return;
            const pts = fp.map((p) => ({ n: p.x * nx + p.z * nz, t: p.x * tx + p.z * tz }));
            const nMin = Math.min(...pts.map((p) => p.n)),
                nMax = Math.max(...pts.map((p) => p.n)),
                tMin = Math.min(...pts.map((p) => p.t)),
                tMax = Math.max(...pts.map((p) => p.t));
            // 面の長さ方向が重なる、または辺／角が吸着距離以内にある対象だけを候補にする。
            // 真上の間取りでは、辺同士がちょうど接するケースも許可する。
            const tangentGap = Math.max(faceMin - tMax, tMin - faceMax, 0);
            if (tangentGap > tau) return;
            [nMin, nMax].forEach((targetN) => {
                const gap = targetN - at;
                if (Math.abs(gap) <= tau && (!best || Math.abs(gap) < Math.abs(best.gap))) best = { gap, id: t.id };
            });
        });
        if (!best) return patch;
        snapHit = new Set([best.id]);
        // スナップ補正も反対側の面を固定したまま行う。オブジェクト全体を移動させない。
        // マイナス側の辺は、幅／奥行を増やすと逆方向へ動く。
        // そのため、面の補正量にsideを掛けて反対側の面を固定する。
        const next = Math.max(Number(h.min) || 0.01, Number(value) + side * best.gap);
        return floorDimensionPatch(o, h.kind, next, side);
    }
    // 間取りドック・ショートカットから選択対象を回転する。
    function rotateFloorSelected(deg) {
        const o = floorPlanObject();
        if (!o || o.attachment?.verticalOnly) return;
        HU.push(S);
        RD = [];
        setOb(o.id, { rot: angle360((Number(o.rot) || 0) + deg) });
        render();
    }
    // キーボードやドックの移動量を、表示中の面（前・横・上）の軸へ変換する。
    function moveFloorSelected(dx, dz) {
        const selected = selectedObjects(),
            o = selected.find((q) => q.id === sel) || selected[0],
            objects = o?.attachment?.verticalOnly ? [o] : selected;
        if (!o || !objects.length) return;
        HU.push(S);
        RD = [];
        snapHit = null;
        // 矢印は画面の方向に対応。裏／左／下では各ワールド軸の符号が逆になる。
        const basis=orthBasis(), delta=basis.right.map((v,i)=>v*dx-basis.up[i]*dz),
            axes=basis.right.map((v,i)=>(Math.abs(v)+Math.abs(basis.up[i])>1e-9)?i:-1).filter(i=>i>=0);
        const setup = snapSetupGroup(objects, objectAnchorWorld(o)),
            q = $("snp")?.checked
                ? snapShift(setup.bb, delta, axes, setup.targets, setup.tau)
                : { d: delta, hit: new Set() };
        snapHit = q.hit.size ? q.hit : null;
        /* 上はX/Z、横はZ/Y、前はX/Yの表示面内を移動する。 */
        const ids = new Set(objects.map((g) => g.id));
        objects.forEach((g) =>
            setOb(g.id, moveBy(g, q.d, !!(g.attachment?.parentId && ids.has(g.attachment.parentId)))),
        );
        render();
    }
    // カメラではなく、間取りキャンバスの表示中心だけを移動する。
    // dx/dyは画面上の移動量(px)。オブジェクトやP.cx/P.czは変更しない。
    function panFloorPlan(dx, dy) {
        if (!window.cityFloorPlanActive) return;
        if (!Array.isArray(window.cityFloorPlanCenter)) fitFloorPlan();
        const sc = Math.max(1, Number(orthScale()) || 1),
            c = window.cityFloorPlanCenter || [0, 0];
        window.cityFloorPlanCenter = [c[0] - dx / sc, c[1] + dy / sc];
        render();
    }
    el("floorUndo").onclick = () => {
        floorPlanDrag = null;
        undo();
    };
    el("floorRedo").onclick = () => {
        floorPlanDrag = null;
        redo();
    };
    const floorLensInput = el("floorLensInput");
    floorLensInput.oninput = () => {
        const v = Number(floorLensInput.value);
        if (Number.isFinite(v)) {
            P.lens = clamp(v, 14, 200);
            sync();
            render();
        }
    };
    floorLensInput.onchange = () => {
        floorLensInput.value = Number(P.lens || 35).toFixed(0);
    };
    floorPlanDock.querySelector('[data-floor-dock-action="pan-up"]').onclick = () => panFloorPlan(0, -80);
    floorPlanDock.querySelector('[data-floor-dock-action="pan-down"]').onclick = () => panFloorPlan(0, 80);
    floorPlanDock.querySelector('[data-floor-dock-action="pan-left"]').onclick = () => panFloorPlan(-80, 0);
    floorPlanDock.querySelector('[data-floor-dock-action="pan-right"]').onclick = () => panFloorPlan(80, 0);
    el("floorRotateLeft").onclick = () => rotateFloorSelected(15);
    el("floorRotateRight").onclick = () => rotateFloorSelected(-15);
    el("floorRotate90").onclick = () => rotateFloorSelected(90);
    el("floorDelete").onclick = () => el("obDel").click();
    floorPlanDock.querySelector('[data-floor-dock-action="left"]').onclick = () => rotateFloorSelected(15);
    floorPlanDock.querySelector('[data-floor-dock-action="right"]').onclick = () => rotateFloorSelected(-15);
    floorPlanDock.querySelector('[data-floor-dock-action="rot30"]').onclick = () => rotateFloorSelected(30);
    floorPlanDock.querySelector('[data-floor-dock-action="rot45"]').onclick = () => rotateFloorSelected(45);
    floorPlanDock.querySelector('[data-floor-dock-action="90"]').onclick = () => rotateFloorSelected(90);
    floorPlanDock.querySelector('[data-floor-dock-action="assets"]').onclick = () => {
        const tray = el("assetTray");
        if (!tray) return;
        tray.classList.add("floorAssetTray");
        if (getComputedStyle(tray).display !== "block") el("assetToggle")?.click();
        requestAnimationFrame(syncFloorPlanDockLayout);
    };
    floorPlanDock.querySelector('[data-floor-dock-action="delete"]').onclick = () => el("obDel").click();
    const floorDockCollapse = floorPlanDock.querySelector('[data-floor-dock-action="collapse"]');
    floorPlanDock.classList.add("collapsed");
    floorDockCollapse.textContent = "＋ 操作";
    floorDockCollapse.title = "操作バーを開く";
    floorDockCollapse.onclick = () => {
        const collapsed = floorPlanDock.classList.toggle("collapsed");
        floorDockCollapse.textContent = collapsed ? "＋ 操作" : "−";
        floorDockCollapse.title = collapsed ? "操作バーを開く" : "操作バーを折りたたむ";
    };
    // カメラ／回転ハンドルだけを先に受け取り、それ以外のドラッグは既存の家具移動へ渡す。
    function beginFloorPan(e, p, tapClear = false) {
        if (!Array.isArray(window.cityFloorPlanCenter)) fitFloorPlan();
        e.preventDefault();
        e.stopImmediatePropagation();
        floorPlanDrag = {
            kind: "pan",
            pointerId: e.pointerId,
            p0: p,
            raw0: rawOf(e.clientX, e.clientY),
            center0: [...(window.cityFloorPlanCenter || [0, 0])],
            tapClear,
            moved: false,
        };
        capturePointer(e.pointerId);
    }
    function beginFloorBoxPending(e, p) {
        if (!Array.isArray(window.cityFloorPlanCenter)) fitFloorPlan();
        e.preventDefault();
        e.stopImmediatePropagation();
        floorPlanDrag = { kind: "boxPending", pointerId: e.pointerId };
        armBoxPending(p, e.pointerId, "floor", {
            raw0: rawOf(e.clientX, e.clientY),
            center0: [...(window.cityFloorPlanCenter || [0, 0])],
            tapClear: true,
        });
        capturePointer(e.pointerId);
    }
    cv.addEventListener(
        "contextmenu",
        (e) => {
            if (window.cityFloorPlanActive) e.preventDefault();
        },
        true,
    );
    // canvasのIDLイベントハンドラ（engine-input.js）がstudio-uiの後付け
    // listenerより先に呼ばれるブラウザでも、間取りの専用経路を優先する。
    document.addEventListener(
        "pointerdown",
        (e) => {
            if (!(window.cityFloorPlanActive && e.target === cv)) return;
            // タッチはギズモの判定より先に全指を登録する。先に回転リングが指を
            // 奪うと2本目まで別々の経路に入り、ピンチを認識できない。
            if (floorTouchDown(e)) return;
            // 回転ギズモ（Blender 風の輪）を掴んだときは、間取りの操作より先に
            // ギズモの回転を優先する。間取りビューでも3Dと同じように回せるようにするため
            // （ビューによって編集できる項目が変わらない、という決めごと）。
            let gizmoRing = false;
            try {
                const hit =
                    typeof hitGizmo === "function" && tool === "edit" && mode === "draw"
                        ? hitGizmo(pos(e))
                        : null;
                gizmoRing = !!hit && (hit.t === "ring" || hit.t === "tiltring");
            } catch (err) {
                gizmoRing = false;
            }
            if (gizmoRing) {
                e.__cityGizmoTakes = true;
                return; // プリエンプトしない＝engine-input.js がギズモのドラッグを始める
            }
            e.__cityFloorPlanPreempt = true;
        },
        true,
    );
    cv.addEventListener(
        "pointerdown",
        (e) => {
            if (!window.cityFloorPlanActive) return;
            // 回転ギズモを掴んだ操作は engine-input.js 側で処理する（ここでは何もしない）。
            if (e.__cityGizmoTakes) return;
            const p = pos(e),
                panGesture = e.button === 1 || e.button === 2 || e.altKey || floorPlanPanMode;
            if (panGesture && (orthPlane() === "top" || orthPlane() === "side" || orthPlane() === "front")) {
                beginFloorPan(e, p);
                return;
            }
            // 看板の絵枠ハンドルは通常の3Dギズモと同じ編集経路へ渡す。
            // これを家具の間取り判定より後にすると、横／上ビューで本体移動として処理される。
            if (sel) {
                // アセット専用の寸法ハンドル（窓の大きさ・人物の関節・ベベル・
                // 金具・階の高さなど）は、3Dビューと同じ beginGizmo 経路へ渡す。
                // 以前はアセット名を1つずつ並べた表で振り分けていたため、
                // 表に無い新しいハンドル（人物の関節・窓グリッドなど）が
                // 前／横／上ビューでだけ効かなかった。
                // 面・軸・回転リングだけは間取り側の専用ハンドルが受け持つので除く。
                const special = hitGizmo(p),
                    specialT = special?.t || "",
                    specialAsset = special?.g?.o?.asset,
                    // 看板（sign）だけは絵枠と同じ扱いで、面ハンドルも3D経路へ渡す。
                    // 回転リングも3D経路へ渡す。以前は「間取り側の専用ハンドルが
                    // 受け持つ」として除外していたが、3Dで描かれているリングを
                    // 前／横／上で押すと何も起きず、「3Dでしか回せない」状態だった。
                    // dragEdit 側は正投影でもリングを回せる（ringPlaneUV）。
                    signScreenGizmo = !!obOf(sel)?.attachment?.wallSideSign,
                    // 間取りビュー（前／横／上）では、3Dの汎用ギズモ（回転の輪・軸・面）は
                    // 描画されていない。描かれていない輪の当たり判定だけが残っていると、
                    // 見えないリングが寸法ハンドルを奪い、「幅＋−を押すと回転する」
                    // 「押しても何も動かない」状態になる。看板だけは engine-gizmo.js 側が
                    // 前／横／上でもギズモを描くので除外する。
                    genericGizmo =
                        (specialT === "face" && specialAsset !== "sign") ||
                        specialT === "axis" ||
                        specialT === "mv" ||
                        (specialT === "ring" && !signScreenGizmo),
                    customFloorGizmo = !!special && !genericGizmo;
                const activeFloorObject = sel && obOf(sel),
                    wallPlaneSelection = !!(activeFloorObject && activeFloorObject.k !== 1),
                    signBounds = wallPlaneSelection ? obBounds(activeFloorObject) : null,
                    signCenter = signBounds
                        ? scrW([
                              (signBounds.lo[0] + signBounds.hi[0]) / 2,
                              (signBounds.lo[1] + signBounds.hi[1]) / 2,
                              (signBounds.lo[2] + signBounds.hi[2]) / 2,
                          ])
                        : null,
                    signBodyCenterHit = !!signCenter && Math.hypot(signCenter.x - p.x, signCenter.y - p.y) <= 10 / Z,
                    signHandleClose =
                        !wallPlaneSelection ||
                        !special?.t?.startsWith("sign-") ||
                        (!special?.sign?.fallback &&
                            !signBodyCenterHit &&
                            special?.sign?.s?.ok &&
                            Math.hypot(special.sign.s.x - p.x, special.sign.s.y - p.y) <= 12 / Z);
                // アセット専用ハンドル（奥の扉・開口など）と、間取りの寸法ハンドル
                // （幅＋−・奥行＋−・高さの白い四角）は、図形の縁で重なりやすい。
                // 白い四角の中心をしっかり押したときは寸法変更を優先し、
                // それ以外はアセット専用ハンドルへ渡す。
                const resizeTight = (() => {
                    const r = floorPlanEditHandleAt(p);
                    return !!r && Math.hypot(r.h.s.x - p.x, r.h.s.y - p.y) <= 7 / Z;
                })();
                if (customFloorGizmo && signHandleClose && !resizeTight) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    ptr = e.pointerId;
                    ptrType = e.pointerType;
                    beginGizmo(special, p);
                    capturePointer(e.pointerId);
                    syncSel();
                    render();
                    return;
                }
            }
            // 正面／横ビューにも、上面と同じ回転ハンドルを用意する。
            // これまではこの2ビューだけ先に高さ／移動判定へ落ち、回転丸を
            // 押しても通常の面編集として扱われていた。
            // ただし寸法ハンドル（白い四角）や移動矢印の方が押した点に近いときは
            // そちらを優先する。以前は必ず回転が勝つ順序だったため、
            // 幅＋−を押すと回転してしまい、寸法が変えられなかった。
            if (sel && (orthPlane() === "front" || orthPlane() === "side")) {
                const turn = floorPlanHandles(),
                    turnLimit = 24 / Z,
                    turnDist = turn.object?.s?.ok
                        ? Math.hypot(turn.object.s.x - p.x, turn.object.s.y - p.y)
                        : Infinity,
                    resizePre = floorPlanEditHandleAt(p),
                    resizeDist = resizePre ? Math.hypot(resizePre.h.s.x - p.x, resizePre.h.s.y - p.y) : Infinity,
                    movePre = floorMoveHandleAt(p),
                    moveDist = movePre ? movePre.d : Infinity;
                // 同距離のときは寸法ハンドルを優先する（白い四角の方が狙いが狭いため）。
                // 判定は 2px の余裕を持たせる。押した座標は数px ずれるので、
                // 完全一致で比べると「矢印と四角が一直線に並ぶ」場面で結果が安定しない。
                if (turnDist < turnLimit && turnDist + 2 / Z < resizeDist && turnDist <= moveDist) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    floorPlanDrag = {
                        kind: "turnScreen",
                        pointerId: e.pointerId,
                        id: turn.object.o.id,
                        center: turn.object.center,
                        angle0: Math.atan2(-(p.y - turn.object.center.y), p.x - turn.object.center.x),
                        rot0: Number(turn.object.o.rot) || 0,
                        p0: p,
                        started: false,
                    };
                    capturePointer(e.pointerId);
                    return;
                }
            }
            const resize = floorPlanEditHandleAt(p),
                moveNear = floorMoveHandleAt(p),
                // 幅／奥行／高さの白い四角と移動矢印が重なるときは、近い方を採用する。
                // 以前は必ず寸法が勝っていたため、矢印の先端を押しても移動できなかった。
                // 移動矢印と白い四角が一直線に並ぶ（例：テントの前後ハンドルと Y 矢印）ときは
                // 必ず寸法ハンドルを優先する。押した座標は数px ずれるため、
                // 完全一致ではなく 2px の余裕を持たせて比べる。
                resizeWins =
                    !!resize &&
                    (!moveNear || Math.hypot(resize.h.s.x - p.x, resize.h.s.y - p.y) <= moveNear.d + 2 / Z);
            // 7 前も9 上・8 横と同じ面編集ハンドルを先に受け取る。
            // ここから漏れると、ハンドルを押してもオブジェクト移動として処理される。
            if (resizeWins && (orthPlane() === "top" || orthPlane() === "side" || orthPlane() === "front")) {
                e.preventDefault();
                e.stopImmediatePropagation();
                floorPlanDrag = {
                    kind: "resize",
                    pointerId: e.pointerId,
                    id: resize.g.o.id,
                    o0: { ...resize.g.o, off: [...(resize.g.o.off || [0, 0, 0])] },
                    handle: resize.h,
                    p0: p,
                    started: false,
                };
                capturePointer(e.pointerId);
                return;
            }
            const moveHandle = floorMoveHandleAt(p),
                moveObject = floorPlanObject();
            if (moveHandle && moveObject && (orthPlane() === "top" || orthPlane() === "side" || orthPlane() === "front")) {
                const base = objectAnchorWorld(moveObject),
                    group = moveObject.attachment?.verticalOnly ? [moveObject] : selectedObjects(),
                    snap = snapSetupGroup(group, base);
                e.preventDefault();
                e.stopImmediatePropagation();
                floorPlanDrag = {
                    kind: "moveGizmo",
                    pointerId: e.pointerId,
                    id: moveObject.id,
                    o0: { ...moveObject, off: [...(moveObject.off || [0, 0, 0])] },
                    group,
                    base0: base,
                    bb: snap.bb,
                    targets: snap.targets,
                    tau: snap.tau,
                    axis: moveHandle.a,
                    p0: p,
                    started: false,
                };
                capturePointer(e.pointerId);
                return;
            }
            if (orthPlane() === "side" || orthPlane() === "front") {
                const verticalHandles = floorPlanHandles(),
                    verticalLim = 22 / Z,
                    verticalAxis = orthPlane() === "side" ? "side" : "front";
                if (
                    verticalHandles.camera &&
                    Math.hypot(verticalHandles.camera.sTarget.x - p.x, verticalHandles.camera.sTarget.y - p.y) <
                        verticalLim
                ) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    floorPlanDrag = { kind: "aimSide", axis: verticalAxis, pointerId: e.pointerId };
                    capturePointer(e.pointerId);
                    return;
                }
                if (
                    verticalHandles.camera &&
                    Math.hypot(verticalHandles.camera.sBody.x - p.x, verticalHandles.camera.sBody.y - p.y) < verticalLim
                ) {
                    const w = floorPlanVerticalWorldAt(p);
                    if (!w) return;
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    floorPlanDrag = {
                        kind: "cameraSide",
                        axis: verticalAxis,
                        pointerId: e.pointerId,
                        dx: orthPlane() === "front" ? P.cx - w.x : 0,
                        dz: orthPlane() === "side" ? P.cz - w.z : 0,
                        dy: P.ch - 1 - w.y,
                    };
                    capturePointer(e.pointerId);
                    return;
                }
            }
            if (orthPlane() === "side" || orthPlane() === "front") {
                const hit = floorPlanItemAtSide(p) || floorPlanAnchorAtSide(p);
                if (hit) {
                    const multi = e.shiftKey || e.metaKey || e.ctrlKey,
                        wasSelected = selIds.has(hit.id);
                    if (multi) setSelection(hit.id, true);
                    else if (!wasSelected || selIds.size <= 1) setSelection(hit.id, false);
                    if (!selIds.has(hit.id)) {
                        syncSel();
                        render();
                        return;
                    }
                    const w = floorPlanVerticalWorldAt(p),
                        base = objectAnchorWorld(hit),
                        group = hit.attachment?.verticalOnly ? [hit] : selectedObjects(),
                        snap = snapSetupGroup(group, base);
                    if (!w) {
                        syncSel();
                        render();
                        return;
                    }
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    floorPlanDrag = {
                        kind: "itemVertical",
                        axis: orthPlane() === "side" ? "side" : "front",
                        pointerId: e.pointerId,
                        id: hit.id,
                        o0: { ...hit, off: [...(hit.off || [0, 0, 0])] },
                        group,
                        base0: base,
                        bb: snap.bb,
                        targets: snap.targets,
                        tau: snap.tau,
                        dx: orthPlane() === "front" ? base[0] - w.x : 0,
                        dz: orthPlane() === "side" ? base[2] - w.z : 0,
                        dy: base[1] - w.y,
                        started: false,
                    };
                    capturePointer(e.pointerId);
                    syncSel();
                    render();
                } else if (e.shiftKey) beginFloorPan(e, p);
                else beginFloorBoxPending(e, p);
                return;
            }
            const h = floorPlanHandles(),
                lim = 22 / Z;
            if (h.object && h.object.s && Math.hypot(h.object.s.x - p.x, h.object.s.y - p.y) < lim) {
                e.preventDefault();
                e.stopImmediatePropagation();
                const center = objectAnchorWorld(h.object.o),
                    angle0 = Math.atan2(h.object.world.x - center[0], h.object.world.z - center[2]);
                floorPlanDrag = {
                    kind: "turn",
                    pointerId: e.pointerId,
                    id: h.object.o.id,
                    o0: h.object.o.type === "compound" ? JSON.parse(JSON.stringify(h.object.o)) : null,
                    center,
                    angle0,
                    started: false,
                };
                capturePointer(e.pointerId);
                return;
            }
            if (h.camera && Math.hypot(h.camera.sTarget.x - p.x, h.camera.sTarget.y - p.y) < lim) {
                e.preventDefault();
                e.stopImmediatePropagation();
                floorPlanDrag = { kind: "aim", pointerId: e.pointerId };
                capturePointer(e.pointerId);
                return;
            }
            if (h.camera && Math.hypot(h.camera.sBody.x - p.x, h.camera.sBody.y - p.y) < lim) {
                const w = floorPlanWorldAt(p);
                if (!w) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                floorPlanDrag = { kind: "camera", pointerId: e.pointerId, dx: P.cx - w.x, dz: P.cz - w.z };
                capturePointer(e.pointerId);
                return;
            }
            if (
                orthPlane() === "top" &&
                h.camera &&
                h.camera.sLens &&
                Math.hypot(h.camera.sLens.x - p.x, h.camera.sLens.y - p.y) < lim
            ) {
                e.preventDefault();
                e.stopImmediatePropagation();
                floorPlanDrag = {
                    kind: "lens",
                    pointerId: e.pointerId,
                    p0: p,
                    lens0: Number(P.lens) || 35,
                    started: false,
                };
                capturePointer(e.pointerId);
                return;
            }
            const w = floorPlanWorldAt(p),
                hit = floorPlanItemAt(w);
            if (!hit && e.shiftKey) {
                beginFloorPan(e, p);
                return;
            }
            e.preventDefault();
            e.stopImmediatePropagation();
            if (hit) {
                const multi = e.shiftKey || e.metaKey || e.ctrlKey,
                    wasSelected = selIds.has(hit.id);
                if (multi) setSelection(hit.id, true);
                else if (!wasSelected || selIds.size <= 1) setSelection(hit.id, false);
                if (!selIds.has(hit.id)) {
                    floorPlanDrag = null;
                    syncSel();
                    render();
                    return;
                }
                const base = objectAnchorWorld(hit),
                    group = hit.attachment?.verticalOnly ? [hit] : selectedObjects(),
                    snap = snapSetupGroup(group, base);
                // 選択済みオブジェクトをドラッグした場合は、選択中の地面オブジェクトを同じ量だけ動かす。
                floorPlanDrag = {
                    kind: "item",
                    pointerId: e.pointerId,
                    id: hit.id,
                    o0: { ...hit, off: [...(hit.off || [0, 0, 0])] },
                    group,
                    base0: base,
                    bb: snap.bb,
                    targets: snap.targets,
                    tau: snap.tau,
                    dx: base[0] - w.x,
                    dz: base[2] - w.z,
                    started: false,
                };
                capturePointer(e.pointerId);
                syncSel();
                render();
            } else beginFloorBoxPending(e, p);
        },
        true,
    );
    cv.addEventListener(
        "pointermove",
        (e) => {
            if (floorTouchMove(e)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }
            // 3Dギズモへ渡した看板・パイプ等はfloorPlanDragを作らず、
            // ここで通常のdragEditを確実に継続する。正面／横／上ビューの
            // capture listenerが通常のcanvas pointermoveを先取りするための分岐。
            if (ed && ptr === e.pointerId && !floorPlanDrag) {
                e.preventDefault();
                e.stopImmediatePropagation();
                dragEdit(pos(e), !!e.shiftKey);
                return;
            }
            const boxPendingState = updateBoxPending(pos(e), e.pointerId);
            if (boxSelect && boxSelect.pointerId === e.pointerId) {
                boxSelect.end = pos(e);
                e.preventDefault();
                e.stopImmediatePropagation();
                render();
                return;
            }
            if (boxPendingState === "pending" || boxPendingState === "cancel") {
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }
            if (!floorPlanDrag || e.pointerId !== floorPlanDrag.pointerId) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            if (floorPlanDrag.kind === "pan") {
                const p = rawOf(e.clientX, e.clientY),
                    sc = Math.max(1, Number(orthScale()) || 1),
                    dx = p.x - floorPlanDrag.raw0.x,
                    dy = p.y - floorPlanDrag.raw0.y;
                if (Math.hypot(dx, dy) > 2) floorPlanDrag.moved = true;
                window.cityFloorPlanCenter = [floorPlanDrag.center0[0] - dx / sc, floorPlanDrag.center0[1] + dy / sc];
                render();
                return;
            }
            if (floorPlanDrag.kind === "resize") {
                const o = floorPlanDrag.o0,
                    h = floorPlanDrag.handle,
                    p = pos(e),
                    amount =
                        ((p.x - floorPlanDrag.p0.x) * h.dir.x + (p.y - floorPlanDrag.p0.y) * h.dir.y) / (h.scale || 1),
                    value = clamp(h.start + (h.factor || 1) * amount, h.min, h.max ?? 20);
                snapHit = null;
                // 2軸ハンドル（テントの前縁など）は、斜めへ引くと上下と手前奥が同時に変わる。
                const second = h.dir2
                        ? clamp(
                              h.start2 +
                                  ((p.x - floorPlanDrag.p0.x) * h.dir2.x +
                                      (p.y - floorPlanDrag.p0.y) * h.dir2.y) /
                                      (h.scale2 || 1),
                              h.min2,
                              h.max2 ?? 20,
                          )
                        : null,
                    secondSnap =
                        second == null
                            ? null
                            : snapAwningEdge(snapAwningEdge(second, h.min2), h.max2);
                // 凹窓階層建物のハンドルは、3Dドラッグと同じ変換を共有する。
                const recessedPatch = typeof recessedHandlePatch === "function"
                        ? recessedHandlePatch(o, h.kind, value)
                        : null,
                    patch = recessedPatch
                        ? recessedPatch
                        : h.kind === "cornerCut-offset"
                        ? { cornerOffset: value }
                        : h.kind === "wall-sign-bracket-length"
                          ? { wallSignBracketLength: value }
                          : h.kind === "wall-sign-bevel"
                            ? { wallSignBevelOffset: value }
                          : h.kind === "cornerCut-opening-width-left" || h.kind === "cornerCut-opening-width-right"
                          ? { cornerCutOpeningW: value }
                          : h.kind === "cornerCut-opening-height"
                            ? { cornerCutOpeningH: value }
                            : h.kind === "cornerCut-opening-depth"
                              ? { cornerCutOpeningDepth: value }
                              : h.inner
                                ? h.kind === "buildingOpeningH"
                                    ? { openingH: value }
                                    : h.kind === "buildingBackFace"
                                      ? { openingBack: value }
                                      : h.kind === "awningEdgeZ"
                                        ? {
                                              // 上辺が水平（＝直方体）と、一番下（＝三角柱）へ吸着
                                              awningEdgeZ: snapAwningEdge(
                                                  snapAwningEdge(value, h.max),
                                                  h.min,
                                              ),
                                              awningFrontBottom: h.frontBottom,
                                              awningEdgeEdited: true,
                                          }
                                        : h.kind === "balcony-thickness"
                                          ? {
                                                // 床と壁で共通の厚さ。全体の高さも同じだけ伸びる。
                                                balconyThickness: value,
                                                h: value + balconyGeometry(o).railH,
                                            }
                                          : h.kind === "uWall-thickness"
                                            ? { uWallThickness: value }
                                            : h.kind === "awningEdgeY"
                                          ? {
                                                // 前面が垂直（＝直方体）と、一番奥（＝三角柱）へ吸着
                                                awningEdgeY: snapAwningEdge(
                                                    snapAwningEdge(value, h.min),
                                                    h.max,
                                                ),
                                                awningEdgeEdited: true,
                                            }
                                          : { openingW: value }
                                : h.param
                                  ? floorWallDimensionPatch(o, h.param, value, h.side || 1)
                                  : floorResizeSnap(o, floorDimensionPatch(o, h.kind, value, h.side || 1), h, value);
                // 前縁ハンドルで手前奥も動かす（テントの前縁は2軸で動く）。
                // patch は const なので、そのまま渡す直前に1つにまとめる。
                const applied =
                    patch && secondSnap != null && h.kind === "awningEdgeZ"
                        ? { ...patch, awningEdgeY: secondSnap }
                        : patch;
                if (applied) {
                    if (!floorPlanDrag.started) {
                        HU.push(S);
                        RD = [];
                        floorPlanDrag.started = true;
                    }
                    setOb(o.id, applied);
                }
                render();
                return;
            }
            if (floorPlanDrag.kind === "moveGizmo") {
                const a = floorPlanDrag.axis,
                    p = pos(e),
                    dx = p.x - floorPlanDrag.p0.x,
                    dy = p.y - floorPlanDrag.p0.y,
                    al =
                        Math.hypot(
                            a.sT.x - floorMoveGizmo(floorPlanDrag.o0).center.x,
                            a.sT.y - floorMoveGizmo(floorPlanDrag.o0).center.y,
                        ) || 1,
                    ux = (a.sT.x - floorMoveGizmo(floorPlanDrag.o0).center.x) / al,
                    uy = (a.sT.y - floorMoveGizmo(floorPlanDrag.o0).center.y) / al,
                    amount = (dx * ux + dy * uy) / (a.scale || 1),
                    delta = [a.vec[0] * amount, a.vec[1] * amount, a.vec[2] * amount];
                if (!floorPlanDrag.started) {
                    HU.push(S);
                    RD = [];
                    floorPlanDrag.started = true;
                }
                const axes = a.vec.map((v, i) => (Math.abs(v) > 0.5 ? i : -1)).filter((i) => i >= 0),
                    q = $("snp")?.checked
                        ? snapShift(floorPlanDrag.bb, delta, axes, floorPlanDrag.targets, floorPlanDrag.tau)
                        : { d: delta, hit: new Set() };
                snapHit = q.hit.size ? q.hit : null;
                const ids = new Set((floorPlanDrag.group || []).map((o) => o.id));
                (floorPlanDrag.group || [floorPlanDrag.o0]).forEach((g) => {
                    const keep = !!(g.attachment?.parentId && ids.has(g.attachment.parentId));
                    setOb(g.id, moveBy(g, q.d, keep));
                });
                render();
                return;
            }
            if (floorPlanDrag.kind === "lens") {
                const w = floorPlanWorldAt(pos(e));
                if (w) {
                    const yaw = Number(P.yaw || 0) * DG,
                        dx = w.x - P.cx,
                        dz = w.z - P.cz,
                        len = Math.hypot(dx, dz);
                    if (len > 0.05) {
                        const forwardX = -Math.sin(yaw),
                            forwardZ = Math.cos(yaw),
                            dot = forwardX * dx + forwardZ * dz,
                            cross = forwardX * dz - forwardZ * dx,
                            half = Math.max(0.02, Math.min(1.45, Math.abs(Math.atan2(cross, dot)))),
                            lens = clamp(18 / Math.tan(half), 14, 200);
                        P.lens = +lens.toFixed(1);
                        sync();
                    }
                }
                render();
                return;
            }
            if (floorPlanDrag.kind === "cameraSide" || floorPlanDrag.kind === "aimSide") {
                const w = floorPlanVerticalWorldAt(pos(e));
                if (!w) return;
                if (floorPlanDrag.kind === "cameraSide") {
                    if (floorPlanDrag.axis === "front") P.cx = +(w.x + floorPlanDrag.dx).toFixed(3);
                    else P.cz = +(w.z + floorPlanDrag.dz).toFixed(3);
                    P.ch = +Math.max(0.3, w.y + floorPlanDrag.dy + 1).toFixed(3);
                } else {
                    const cameraY = Number(P.ch || 1.6) - 1;
                    P.pitch = +clamp(
                        Math.asin(clamp((w.y - cameraY) / Math.max(1, FLOOR_CAMERA_RAY), -0.985, 0.985)) / DG,
                        -60,
                        60,
                    ).toFixed(2);
                    if (floorPlanDrag.axis === "front") {
                        const horiz = Math.max(0.1, FLOOR_CAMERA_RAY * Math.cos(P.pitch * DG));
                        P.yaw = +clamp(Math.asin(clamp(-(w.x - P.cx) / horiz, -0.985, 0.985)) / DG, -60, 60).toFixed(2);
                    }
                }
                sync();
                render();
                return;
            }
            if (floorPlanDrag.kind === "itemVertical") {
                const w = floorPlanVerticalWorldAt(pos(e));
                if (!w) return;
                const o = floorPlanDrag.o0;
                if (o) {
                    if (!floorPlanDrag.started) {
                        HU.push(S);
                        RD = [];
                        floorPlanDrag.started = true;
                    }
                    const delta =
                        floorPlanDrag.axis === "front"
                            ? [
                                  w.x + floorPlanDrag.dx - floorPlanDrag.base0[0],
                                  w.y + floorPlanDrag.dy - floorPlanDrag.base0[1],
                                  0,
                              ]
                            : [
                                  0,
                                  w.y + floorPlanDrag.dy - floorPlanDrag.base0[1],
                                  w.z + floorPlanDrag.dz - floorPlanDrag.base0[2],
                              ];
                    const axes = floorPlanDrag.axis === "front" ? [0, 1] : [1, 2];
                    const q = $("snp")?.checked
                        ? snapShift(floorPlanDrag.bb, delta, axes, floorPlanDrag.targets, floorPlanDrag.tau)
                        : { d: delta, hit: new Set() };
                    snapHit = q.hit.size ? q.hit : null;
                    const ids = new Set((floorPlanDrag.group || [o]).map((g) => g.id));
                    (floorPlanDrag.group || [o]).forEach((g) =>
                        setOb(g.id, moveBy(g, q.d, !!(g.attachment?.parentId && ids.has(g.attachment.parentId)))),
                    );
                }
                render();
                return;
            }
            if (floorPlanDrag.kind === "turnScreen") {
                const o = obOf(floorPlanDrag.id),
                    p = pos(e),
                    dx = p.x - floorPlanDrag.center.x,
                    dy = p.y - floorPlanDrag.center.y;
                if (o && Math.hypot(dx, dy) > 1) {
                    let angle = (Math.atan2(-dy, dx) - floorPlanDrag.angle0) / DG + floorPlanDrag.rot0;
                    if (!e.shiftKey) angle = Math.round(angle / 15) * 15;
                    if (!floorPlanDrag.started) {
                        HU.push(S);
                        RD = [];
                        floorPlanDrag.started = true;
                    }
                    setOb(o.id, { rot: angle360(angle) });
                }
                render();
                return;
            }
            const w = floorPlanWorldAt(pos(e));
            if (!w) return;
            if (floorPlanDrag.kind === "turn") {
                const o = obOf(floorPlanDrag.id);
                if (o) {
                    if (o.type === "compound") {
                        let delta =
                            (Math.atan2(w.x - floorPlanDrag.center[0], w.z - floorPlanDrag.center[2]) -
                                floorPlanDrag.angle0) /
                            DG;
                        if (!e.shiftKey) delta = Math.round(delta / 15) * 15;
                        if (!floorPlanDrag.started) {
                            HU.push(S);
                            RD = [];
                            floorPlanDrag.started = true;
                        }
                        setOb(o.id, rotateCompoundBy(floorPlanDrag.o0 || o, delta));
                    } else {
                        let a = Math.atan2(w.x - L2W(o, 0, 0, 0)[0], w.z - L2W(o, 0, 0, 0)[2]) / DG;
                        if (!e.shiftKey) a = Math.round(a / 15) * 15;
                        if (!floorPlanDrag.started) {
                            HU.push(S);
                            RD = [];
                            floorPlanDrag.started = true;
                        }
                        setOb(o.id, { rot: angle360(a) });
                    }
                }
            } else if (floorPlanDrag.kind === "item") {
                const o = floorPlanDrag.o0;
                if (o) {
                    if (!floorPlanDrag.started) {
                        HU.push(S);
                        RD = [];
                        floorPlanDrag.started = true;
                    }
                    /* 家具本体の間取り移動はX/Zだけ。磁石ONなら選択全体の外周を他オブジェクトへ吸着する。 */
                    const delta = [
                        w.x + floorPlanDrag.dx - floorPlanDrag.base0[0],
                        0,
                        w.z + floorPlanDrag.dz - floorPlanDrag.base0[2],
                    ];
                    const q = $("snp")?.checked
                        ? snapShift(floorPlanDrag.bb, delta, [0, 2], floorPlanDrag.targets, floorPlanDrag.tau)
                        : { d: delta, hit: new Set() };
                    snapHit = q.hit.size ? q.hit : null;
                    const ids = new Set((floorPlanDrag.group || [o]).map((g) => g.id));
                    (floorPlanDrag.group || [o]).forEach((g) =>
                        setOb(g.id, moveBy(g, q.d, !!(g.attachment?.parentId && ids.has(g.attachment.parentId)))),
                    );
                }
            } else if (floorPlanDrag.kind === "camera") {
                P.cx = +(w.x + floorPlanDrag.dx).toFixed(3);
                P.cz = +(w.z + floorPlanDrag.dz).toFixed(3);
                sync();
            } else if (floorPlanDrag.kind === "aim") {
                // 3Dカメラの前方は[-sin(yaw), 0, cos(yaw)]なので、先端をその向きへ合わせる。
                P.yaw = +(((Math.atan2(-(w.x - P.cx), w.z - P.cz) / DG + 540) % 360) - 180).toFixed(2);
                sync();
            }
            render();
        },
        true,
    );
    cv.addEventListener(
        "pointerup",
        (e) => {
            const tracked = floorTouchUp(e);
            if (boxSelect && boxSelect.pointerId === e.pointerId) {
                e.preventDefault();
                e.stopImmediatePropagation();
                finishBoxSelection(boxPoint(e));
                floorPlanDrag = null;
                return;
            }
            if (boxPending && boxPending.pointerId === e.pointerId) {
                const pending = cancelBoxPending();
                e.preventDefault();
                e.stopImmediatePropagation();
                floorPlanDrag = null;
                if (pending?.tapClear) setSelection(null, false);
                render();
                return;
            }
            if (tracked) {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (!floorPlanDrag || e.pointerId !== floorPlanDrag.pointerId) return;
            }
            if (!floorPlanDrag || e.pointerId !== floorPlanDrag.pointerId) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            const tapClear = floorPlanDrag.kind === "pan" && floorPlanDrag.tapClear && !floorPlanDrag.moved;
            floorPlanDrag = null;
            snapHit = null;
            if (tapClear) setSelection(null, false);
            render();
        },
        true,
    );
    cv.addEventListener(
        "pointercancel",
        (e) => {
            const tracked = floorTouchUp(e);
            if (boxSelect && boxSelect.pointerId === e.pointerId) {
                e.preventDefault();
                e.stopImmediatePropagation();
                boxSelect = null;
                floorPlanDrag = null;
                cancelBoxPending();
                render();
                return;
            }
            if (boxPending && boxPending.pointerId === e.pointerId) {
                cancelBoxPending();
                e.preventDefault();
                e.stopImmediatePropagation();
                floorPlanDrag = null;
                render();
                return;
            }
            if (tracked) {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (!floorPlanDrag || e.pointerId !== floorPlanDrag.pointerId) return;
            }
            if (!floorPlanDrag || e.pointerId !== floorPlanDrag.pointerId) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            floorPlanDrag = null;
            snapHit = null;
            render();
        },
        true,
    );
    addEventListener("keydown", (e) => {
        if (!window.cityFloorPlanActive || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
        if (e.code === "Space") {
            e.preventDefault();
            floorPlanPanMode = true;
            return;
        }
        if (e.altKey && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
            e.preventDefault();
            const panStep = 80;
            if (e.key === "ArrowLeft") panFloorPlan(-panStep, 0);
            else if (e.key === "ArrowRight") panFloorPlan(panStep, 0);
            else if (e.key === "ArrowUp") panFloorPlan(0, -panStep);
            else panFloorPlan(0, panStep);
            return;
        }
        const panKey = e.key.toLowerCase();
        if (["w", "a", "s", "d"].includes(panKey)) {
            e.preventDefault();
            const panStep = 80;
            if (panKey === "a") panFloorPlan(-panStep, 0);
            else if (panKey === "d") panFloorPlan(panStep, 0);
            else if (panKey === "w") panFloorPlan(0, -panStep);
            else panFloorPlan(0, panStep);
            return;
        }
        const step = e.shiftKey ? 0.5 : 0.1;
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            moveFloorSelected(-step, 0);
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            moveFloorSelected(step, 0);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            moveFloorSelected(0, -step);
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            moveFloorSelected(0, step);
        } else if (e.key === "q" || e.key === "Q") {
            e.preventDefault();
            rotateFloorSelected(15);
        } else if (e.key === "e" || e.key === "E") {
            e.preventDefault();
            rotateFloorSelected(-15);
        } else if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            if (floorPlanObject()) el("obDel").click();
        }
    });
    addEventListener("keyup", (e) => {
        if (e.code === "Space") floorPlanPanMode = false;
    });
    addEventListener("blur", () => (floorPlanPanMode = false));


    // ===== 外（studio-ui.js）から使うもの =====
    SH.FLOOR_CAMERA_RAY = FLOOR_CAMERA_RAY;
    SH.floorPlanDock = floorPlanDock;
    SH.syncFloorPlanDockLayout = syncFloorPlanDockLayout;
    SH.floorPlanWorldAt = floorPlanWorldAt;
    SH.floorPlanSideWorldAt = floorPlanSideWorldAt;
    SH.floorPlanFrontWorldAt = floorPlanFrontWorldAt;
    SH.syncFloorPlanSelection = syncFloorPlanSelection;
    // floorPlanDrag は studio-ui.js 側からも書き換えるので、値ではなく入れ物を見せる。
    Object.defineProperty(SH, "floorPlanDrag", {
        get: () => floorPlanDrag,
        set: (value) => {
            floorPlanDrag = value;
        },
        configurable: true,
    });
})();
