/* City Grid Studio: 入力（分割モジュール3/4）
   マウス／タッチ・ピンチ・消しゴム・モードとボタンの接続。 */
// ===== 9. マウス/タッチ操作 =====
let ptr = null,
    lastPen = 0, // 操作中のポインタID／最後にペンを離した時刻（手のひら誤タッチ対策）
    // いまのポインタ位置（描画座標）。回転中の角度表示に使う。
    lastPtr = null;
const rawOf = (cx, cy) => {
    const r = cv.getBoundingClientRect();
    return { x: ((cx - r.left) * W) / r.width, y: ((cy - r.top) * H) / r.height };
}; // 画面→キャンバス(ズーム前)
const pos = (e) => {
    const r = rawOf(e.clientX, e.clientY),
        // 画面の拡大・移動の「移動ぶん」はビューによって違う（正投影は基準点を中心に拡大する）。
        // 描画とまったく同じ値で戻さないと、クリックした場所と選ばれる場所がずれる。
        vs = viewShift();
    return { x: (r.x - vs[0]) / Z, y: (r.y - vs[1]) / Z };
}; // ズーム・移動を戻した描画座標
const TC = new Map(); // いま触れている指(touch)
function clampView() {
    Z = clamp(Z, 1, 10);
    // 正投影の原点は画面中央ではなく orthSetup の ax/ay。通常透視の枠で
    // ox/oyを制限すると、ホイールの基準点が飛び、正の移動もできなくなる。
    if (orthView) return;
    ox = clamp(ox, W - W * Z, 0);
    oy = clamp(oy, H - H * Z, 0);
}
function updZ() {
    $("zr").textContent = Math.round(Z * 100) + "%";
}
$("zr").onclick = () => {
    Z = 1;
    ox = oy = 0;
    updZ();
    renderSoon();
};
cv.addEventListener(
    "wheel",
    (e) => {
        e.preventDefault();
        if (cameraLock && !orthView) {
            flashHint("カメラ固定中：3D視点は動きません（L で解除）");
            return;
        }
        if (mode === "view" && !orthView) {
            P.lens = clamp(P.lens * Math.exp(-e.deltaY * 0.0012), 14, 200);
            sync();
            render();
            return;
        }
        const r = rawOf(e.clientX, e.clientY),
            shift = viewShift(),
            q = { x: (r.x - shift[0]) / Z, y: (r.y - shift[1]) / Z };
        Z = clamp(Z * Math.exp(-e.deltaY * 0.0015), 1, 10);
        const anchor = orthView ? orthSetup() : { ax: 0, ay: 0 };
        ox = r.x - q.x * Z - anchor.ax * (1 - Z);
        oy = r.y - q.y * Z - anchor.ay * (1 - Z);
        clampView();
        updZ();
        render();
    },
    { passive: false },
); // ビューではレンズ、描画ではキャンバスズーム

// ===== 10. 二本指/三本指：ピンチでズーム・移動、タップで元に戻す/やり直し =====
function multiStart() {
    cancelBoxPending();
    boxSelect = null;
    if (drag?.kind === "orthPan") {
        // 正投影の1本指パンには3Dカメラ値がない。カメラをundefinedで
        // 上書きせず、2本目までに動いた表示中心だけを戻す。
        window.cityFloorPlanCenter = [...drag.center];
    } else if (drag) {
        setP("yaw", drag.yaw);
        setP("pitch", drag.pitch);
        setP("cx", drag.cx);
        setP("cz", drag.cz);
        setP("ch", drag.ch);
        sync();
    } // 1本目で動いた分は戻す
    drag = null;
    cur = null;
    er = null;
    prev = null;
    bd = false;
    ed = null;
    ptr = null;
    ptrType = null;
    if (!mg) mg = { t0: Date.now(), n: 0, moved: false, x0: null, y0: null, x1: null, y1: null };
    const pts = [...TC.values()];
    mg.n = Math.max(mg.n, pts.length);
    mg.view = mode === "view" && !orthView;
    const cx = pts.reduce((a, t) => a + t.x, 0) / Math.max(1, pts.length),
        cy = pts.reduce((a, t) => a + t.y, 0) / Math.max(1, pts.length);
    if (mg.x0 == null) {
        mg.x0 = cx;
        mg.y0 = cy;
    }
    mg.x1 = cx;
    mg.y1 = cy;
    pts.forEach((t) => {
        t.sx = t.x;
        t.sy = t.y;
    });
    if (pts.length === 2) {
        const rc = rawOf((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
        mg.d0 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        mg.z0 = Z;
        const shift = viewShift();
        mg.q0 = { x: (rc.x - shift[0]) / Z, y: (rc.y - shift[1]) / Z };
        mg.cx0 = P.cx;
        mg.cz0 = P.cz;
        mg.ch0 = P.ch;
        mg.lens0 = P.lens;
        mg.mx0 = (pts[0].x + pts[1].x) / 2;
        mg.my0 = (pts[0].y + pts[1].y) / 2;
    } // 指の中心を基準にする
}
function multiMove(tc) {
    if (Math.hypot(tc.x - tc.sx, tc.y - tc.sy) > 14) mg.moved = true; // 14px以上動いたらタップではない
    const pts = [...TC.values()];
    if (pts.length) {
        mg.x1 = pts.reduce((a, t) => a + t.x, 0) / pts.length;
        mg.y1 = pts.reduce((a, t) => a + t.y, 0) / pts.length;
    }
    if (mg.moved && pts.length === 2 && mg.d0 > 0) {
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
            mx = (pts[0].x + pts[1].x) / 2,
            my = (pts[0].y + pts[1].y) / 2;
        if (mg.view && cameraLock) {
            // カメラ固定中のピンチは、視点を動かさない（指を離すまで何もしない）。
            enforceCameraLock();
        } else if (mg.view) {
            const k = W / cv.getBoundingClientRect().width,
                worldPerPx = ((Math.max(0.15, P.ch) * 2) / H) * k,
                dx = mx - mg.mx0,
                dy = my - mg.my0,
                th = P.yaw * DG;
            setP("cx", mg.cx0 - dx * worldPerPx * Math.cos(th));
            setP("cz", mg.cz0 - dx * worldPerPx * Math.sin(th));
            setP("ch", clamp(mg.ch0 + dy * worldPerPx, 0.05, 30));
            P.lens = clamp((mg.lens0 * d) / mg.d0, 14, 200);
            sync();
            render();
        } else {
            const rc = rawOf(mx, my);
            Z = clamp((mg.z0 * d) / mg.d0, 1, 10);
            const anchor = orthView ? orthSetup() : { ax: 0, ay: 0 };
            ox = rc.x - mg.q0.x * Z - anchor.ax * (1 - Z);
            oy = rc.y - mg.q0.y * Z - anchor.ay * (1 - Z);
            clampView();
            updZ();
            render();
        }
    }
}

// ===== 11. 消しゴム（線は向きの点列で持っているので、点を消して線を分割する） =====
// 点列を細かくする（部分消しの精度のため）
function dens(a) {
    const o = [a[0]];
    for (let i = 1; i < a.length; i++) {
        const u = a[i - 1],
            v = a[i],
            n = Math.ceil(Math.acos(Math.max(-1, Math.min(1, V.dot(u, v)))) / 0.004);
        for (let j = 1; j <= n; j++) o.push(j === n ? v : V.nrm(V.add(u, v, 1 - j / n, j / n)));
    }
    return o;
}
function dens3(a) {
    const o = [a[0]],
        co = CO();
    for (let i = 1; i < a.length; i++) {
        const u = a[i - 1],
            v = a[i],
            n = Math.ceil(
                Math.acos(Math.max(-1, Math.min(1, V.dot(V.nrm(V.add(u, co)), V.nrm(V.add(v, co)))))) / 0.004,
            );
        for (let j = 1; j <= n; j++) o.push(j === n ? v : V.add(u, v, 1 - j / n, j / n));
    }
    return o;
}
function eraseAt(p) {
    const r2 = P.ew * P.ew,
        all = $("em").value === "all",
        res = [],
        det = new Set();
    let ch = false;
    for (const s of S) {
        // 消しゴムでもロックされたオブジェクトは変更しない。
        if (s.ob && (obLocked(s.ob) || !objectVisible(s.ob))) { res.push(s); continue; }
        const hit = s.p.map((v) => {
            const q = sp(s, v);
            return q.ok && (q.x - p.x) ** 2 + (q.y - p.y) ** 2 <= r2;
        });
        if (!hit.some(Boolean)) {
            res.push(s);
            continue;
        }
        ch = true;
        if (s.ob) det.add(s.ob.id);
        if (all) continue; // 線ごと消す
        let seg = [];
        s.p.forEach((v, i) => {
            if (hit[i]) {
                if (seg.length > 1) res.push({ c: s.c, w: s.w, d3: s.d3, p: seg });
                seg = [];
            } else seg.push(v);
        });
        if (seg.length > 1) res.push({ c: s.c, w: s.w, d3: s.d3, p: seg });
    }
    if (ch) {
        S = det.size ? res.map((s) => (s.ob && det.has(s.ob.id) ? { ...s, ob: undefined } : s)) : res;
        if (sel && det.has(sel)) clearSelection();
    }
}
// aからbまでなぞった間も取りこぼさず消す
function stepErase(a, b) {
    const d = Math.hypot(b.x - a.x, b.y - a.y),
        n = Math.max(1, Math.ceil(d / (P.ew / 2)));
    for (let i = 1; i <= n; i++) eraseAt({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
}
// clamp() は engine-lib.js の共通ライブラリにある（CG.clamp と同じもの）。
// 間取りのドラッグ状態はstudio-ui.jsのIIFE内で管理する。
// 分割読み込みでは別スコープになるため、window経由の小さな橋を使う。
const getCityFloorPlanDrag = () => window.cityFloorPlanGetDrag?.() || null;
const setCityFloorPlanDrag = (value) => window.cityFloorPlanSetDrag?.(value);
const fitCityFloorPlan = () => window.cityFloorPlanFit?.();
// 長押し＋ドラッグのボックス選択。空白から始めたときだけ起動し、
// 通常のオブジェクトドラッグやiPadの視点操作とは競合しないようにする。
let boxSelect = null,
    boxPending = null,
    boxTimer = null;
function cancelBoxPending() {
    if (boxTimer) {
        clearTimeout(boxTimer);
        boxTimer = null;
    }
    const p = boxPending;
    boxPending = null;
    return p;
}
function armBoxPending(start, pointerId, source = "canvas", meta = {}) {
    cancelBoxPending();
    const pending = { start: { ...start }, pointerId, source, ...meta };
    boxPending = pending;
    boxTimer = setTimeout(() => {
        if (boxPending !== pending) return;
        boxPending = null;
        boxTimer = null;
        if (source === "floor") setCityFloorPlanDrag(null);
        boxSelect = { pointerId, start: { ...pending.start }, end: { ...pending.start }, source };
        clearSelection();
        renderSoon();
    }, 360);
}
// 戻り値: pending / cancel / floorPan。floorPanのときだけ従来の表示パンへ引き継ぐ。
function updateBoxPending(p, pointerId) {
    const pending = boxPending;
    if (!pending || pending.pointerId !== pointerId) return null;
    if (Math.hypot(p.x - pending.start.x, p.y - pending.start.y) <= 8) return "pending";
    cancelBoxPending();
    if (pending.source === "floor") {
        if (!Array.isArray(window.cityFloorPlanCenter)) fitCityFloorPlan();
        setCityFloorPlanDrag({
            kind: "pan",
            pointerId,
            p0: { ...pending.start },
            raw0: pending.raw0 || { x: pending.start.x * Z + viewShift()[0], y: pending.start.y * Z + viewShift()[1] },
            center0: [...(pending.center0 || window.cityFloorPlanCenter || [0, 0])],
            tapClear: true,
            moved: true,
        });
        return "floorPan";
    }
    return "cancel";
}
function boxScreenBounds(o) {
    const b = obBounds(o),
        pts = [];
    for (const x of [b.lo[0], b.hi[0]])
        for (const y of [b.lo[1], b.hi[1]])
            for (const z of [b.lo[2], b.hi[2]]) {
                const q = scrW([x, y, z]);
                if (q && q.ok && Number.isFinite(q.x) && Number.isFinite(q.y)) pts.push(q);
            }
    if (!pts.length) return null;
    return {
        x0: Math.min(...pts.map((q) => q.x)),
        y0: Math.min(...pts.map((q) => q.y)),
        x1: Math.max(...pts.map((q) => q.x)),
        y1: Math.max(...pts.map((q) => q.y)),
    };
}
// アセット側のIIFE内にあるsceneObjects()へ依存せず、単一版・分割版の
// どちらでもボックス選択から直接参照できるオブジェクト一覧を作る。
function boxSceneObjects() {
    const out = [],
        seen = new Set();
    S.forEach((s) => {
        const o = s && s.ob;
        if (o && objectVisible(o) && !seen.has(o.id)) {
            seen.add(o.id);
            out.push(o);
        }
    });
    return out;
}
function finishBoxSelection(end) {
    if (!boxSelect) return;
    const a = boxSelect.start,
        b = end || boxSelect.end,
        x0 = Math.min(a.x, b.x),
        x1 = Math.max(a.x, b.x),
        y0 = Math.min(a.y, b.y),
        y1 = Math.max(a.y, b.y),
        chosen = [];
    boxSceneObjects().forEach((o) => {
        if (obLocked(o)) return; // ロック中は箱選択でも選ばない
        const q = boxScreenBounds(o);
        if (!q) return;
        const cx = (q.x0 + q.x1) / 2,
            cy = (q.y0 + q.y1) / 2;
        if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) chosen.push(o);
    });
    clearSelection();
    chosen.forEach((o) => selIds.add(o.id));
    sel = chosen.length ? chosen[chosen.length - 1].id : null;
    normalizeSelection();
    boxSelect = null;
    tool = "edit";
    setMode("draw");
    syncSel();
    renderSoon();
}
function drawBoxSelection(c) {
    if (!boxSelect) return;
    const a = boxSelect.start,
        b = boxSelect.end,
        x = Math.min(a.x, b.x),
        y = Math.min(a.y, b.y),
        w = Math.abs(b.x - a.x),
        h = Math.abs(b.y - a.y);
    c.save();
    c.fillStyle = "rgba(102,227,200,.12)";
    c.strokeStyle = "#66e3c8";
    c.lineWidth = 1.5 / Z;
    c.setLineDash([7 / Z, 4 / Z]);
    c.fillRect(x, y, w, h);
    c.strokeRect(x, y, w, h);
    c.restore();
}
// 複数選択時は主役のギズモだけでなく、選択中の全オブジェクトを枠で示す。
// 線色そのものは変えず、通常の編集表示を壊さないよう補助枠だけを描く。
function drawSelectionFeedback(c) {
    const chosen = boxSceneObjects().filter((o) => selIds.has(o.id));
    if (!chosen.length) return;
    c.save();
    c.lineWidth = 1.6 / Z;
    c.setLineDash([6 / Z, 4 / Z]);
    c.globalAlpha = 0.92;
    chosen.forEach((o) => {
        const q = boxScreenBounds(o);
        if (!q) return;
        const pad = 5 / Z;
        c.strokeStyle = o.id === sel ? "#ffd34d" : "#66e3c8";
        c.fillStyle = o.id === sel ? "#ffd34d" : "#66e3c8";
        c.strokeRect(q.x0 - pad, q.y0 - pad, Math.max(1, q.x1 - q.x0 + pad * 2), Math.max(1, q.y1 - q.y0 + pad * 2));
        c.setLineDash([]);
        c.beginPath();
        c.arc((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, 3.5 / Z, 0, Math.PI * 2);
        c.fill();
        c.setLineDash([6 / Z, 4 / Z]);
    });
    c.restore();
}
// ポインタがキャンバスから黒いUIへ移動しても、ボックス選択を必ず解放する。
// キャンバスのPointer Captureだけに依存せず、windowのcaptureフェーズでも監視する。
function boxPointerIsActive(pointerId) {
    return !!((boxSelect && boxSelect.pointerId === pointerId) || (boxPending && boxPending.pointerId === pointerId));
}
function boxPoint(e) {
    const p = pos(e);
    return { x: clamp(p.x, 0, W), y: clamp(p.y, 0, H) };
}
function boxPointInsideCanvas(e) {
    const r = cv.getBoundingClientRect();
    if (!(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)) return false;
    // キャンバス上に重なった黒いツールバー／ドックも「キャンバス外」として扱う。
    const top = document.elementFromPoint(e.clientX, e.clientY);
    return top === cv;
}
function endBoxPointer(e, commit) {
    const pointerId = e && e.pointerId;
    if (pointerId == null || !boxPointerIsActive(pointerId)) return false;
    const pending = boxPending && boxPending.pointerId === pointerId;
    const selecting = boxSelect && boxSelect.pointerId === pointerId;
    if (selecting) {
        if (commit) finishBoxSelection(e && Number.isFinite(e.clientX) ? boxPoint(e) : boxSelect.end);
        else boxSelect = null;
    }
    if (pending) {
        const p = cancelBoxPending();
        if (p?.tapClear) setSelection(null, false);
    } else cancelBoxPending();
    const floorDrag = getCityFloorPlanDrag();
    if (floorDrag && floorDrag.pointerId === pointerId) setCityFloorPlanDrag(null);
    if (ptr === pointerId) {
        ptr = null;
        ptrType = null;
    }
    if (typeof TC !== "undefined") TC.delete(pointerId);
    if (e?.pointerType === "pen") lastPen = Date.now();
    try {
        if (cv.hasPointerCapture?.(pointerId)) cv.releasePointerCapture(pointerId);
    } catch (err) {}
    if (!commit) renderSoon();
    return true;
}
function abortAllBoxPointers() {
    const ids = new Set();
    if (boxSelect) ids.add(boxSelect.pointerId);
    if (boxPending) ids.add(boxPending.pointerId);
    ids.forEach((pointerId) => endBoxPointer({ pointerId }, false));
}
// 押したままキャンバス外へ出た時点で確定して終了する。これにより、
// サイドパネル／上部バー上でpointerupを受け損なうブラウザでも残像を残さない。
addEventListener(
    "pointermove",
    (e) => {
        if (!boxPointerIsActive(e.pointerId)) return;
        const released = e.pointerType !== "touch" && e.buttons === 0;
        if (!released && !boxPointInsideCanvas(e)) {
            e.preventDefault();
            e.stopPropagation();
            endBoxPointer(e, !!(boxSelect && boxSelect.pointerId === e.pointerId));
        } else if (released) {
            e.preventDefault();
            e.stopPropagation();
            endBoxPointer(e, true);
        }
    },
    true,
);
addEventListener(
    "pointerup",
    (e) => {
        if (!boxPointerIsActive(e.pointerId)) return;
        e.preventDefault();
        e.stopPropagation();
        endBoxPointer(e, true);
    },
    true,
);
addEventListener(
    "pointercancel",
    (e) => {
        if (!boxPointerIsActive(e.pointerId)) return;
        e.preventDefault();
        e.stopPropagation();
        endBoxPointer(e, false);
    },
    true,
);
// Pointer Captureが途中で失われた場合も、矩形を残さずキャンセルする。
cv.addEventListener(
    "lostpointercapture",
    (e) => {
        if (boxPointerIsActive(e.pointerId)) endBoxPointer(e, false);
    },
    true,
);
// UIへフォーカスが移った／画面が隠れた場合の最後の保険。
addEventListener("blur", abortAllBoxPointers);
document.addEventListener("visibilitychange", () => {
    if (document.hidden) abortAllBoxPointers();
});
addEventListener("pagehide", abortAllBoxPointers);
// 最初の数pxの向きから、一番近い軸を選ぶ
function pick(a, p) {
    const l = Math.hypot(p.x - a.x, p.y - a.y),
        m = { x: (p.x - a.x) / l, y: (p.y - a.y) / l };
    let b = 0,
        bs = 9;
    [0, 1, 2].forEach((i) => {
        const u = dirAt(a, i),
            s = Math.abs(m.x * u.y - m.y * u.x);
        if (s < bs) {
            bs = s;
            b = i;
        }
    });
    return b;
}
// 通常の3Dキャンバス操作の入口。
// 間取りモードではstudio-ui.jsの専用pointerdownが先に処理し、
// __cityFloorPlanPreempt が付いたイベントはここで通常処理をスキップする。
cv.onpointerdown = (e) => {
    // 間取りのポインター処理はstudio-ui.jsが正面／横／上の専用ギズモを
    // 先に判定する。先行するtargetハンドラが通常編集へ入らないようにする。
    if (e.__cityFloorPlanPreempt) return;
    const touch = e.pointerType === "touch";
    if (touch && ptrType === "pen") return; // ペンで描いている間の手のひらは無視
    if (touch) {
        // 指の本数を数える（2本以上→ピンチ/タップ判定）
        TC.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
        cv.setPointerCapture(e.pointerId);
        if (TC.size >= 2) {
            multiStart();
            return;
        }
        if (mg || Date.now() - lastPen < 600) return; // ペン直後の1本指(手のひら)は視点を動かさない。2本以上のジェスチャーは受け付ける
    } else if (e.pointerType === "pen" && ptrType !== "pen") {
        drag = null;
        cur = null;
        er = null;
        prev = null;
        bd = false;
        ed = null;
        ptr = null;
        mg = null;
        TC.clear();
    } // ペンは指より優先
    // iPadでpointerupを取りこぼした古いポインタが残っても、次の編集操作を止めない。
    if (ptr != null && ptr !== e.pointerId && e.pointerType !== "mouse" && !TC.has(ptr)) {
        ptr = null;
        ptrType = null;
        ed = null;
        drag = null;
        cur = null;
        mg = null;
    }
    // 「視点」ボタンで3Dを操作中は、編集ツールが残っていてもタッチ／ペンを
    // 自動的に描画へ切り替えない。編集はmode='draw'のときだけ受け取る。
    if (ptr != null) return;
    ptr = e.pointerId;
    ptrType = e.pointerType;
    cv.setPointerCapture(e.pointerId);
    const p = pos(e);
    lastPtr = p;
    const pn = $("pn").checked,
        mod = e.pointerType === "mouse" && (e.metaKey || e.ctrlKey),
        selectGesture =
            tool === "edit" &&
            mode === "draw" &&
            e.pointerType === "mouse" &&
            e.button === 0 &&
            (e.shiftKey || e.metaKey || e.ctrlKey),
        nav =
            e.pointerType === "mouse" &&
            (e.button === 1 || e.button === 2 || e.altKey || ((e.shiftKey || mod) && !selectGesture)),
        touchTool = pn && e.pointerType === "touch" && tool !== "edit" && tool !== "erase",
        editPointer = tool === "edit" && mode === "draw" && (e.pointerType === "touch" || e.pointerType === "pen"),
        act =
            nav || (!selectGesture && mod)
                ? "view"
                : editPointer
                  ? "draw"
                  : pn && e.pointerType === "pen" && mode === "draw"
                    ? "draw"
                    : touchTool
                      ? "view"
                      : mode; // 視点モードでは、残っている編集ツールよりもカメラ操作を優先する。
    if (act === "view") {
        if (orthView) {
            const r = rawOf(e.clientX, e.clientY);
            drag = { kind: "orthPan", x: r.x, y: r.y, center: [...orthPlanCenter()] };
            return;
        }
        if (cameraLock) {
            // カメラ固定中は視点操作そのものを開始しない（オブジェクト編集は妨げない）。
            flashHint("カメラ固定中：視点は動きません（L で解除）");
            return;
        }
        const pan = e.shiftKey || e.altKey || e.button === 2;
        drag = {
            kind: pan ? "pan" : "orbit",
            x: e.clientX,
            y: e.clientY,
            yaw: P.yaw,
            hz: P.hz,
            pitch: P.pitch,
            cx: P.cx,
            cz: P.cz,
            ch: P.ch,
        };
        return;
    }
    if (act === "draw" && tool === "edit") {
        const hg = sel ? hitGizmo(p) : null;
        if (hg)
            beginGizmo(hg, p); // 矢印・白い四角・輪をつかんだ
        else {
            const id = pickOb(p),
                multi = e.shiftKey || e.metaKey || e.ctrlKey,
                wasSelected = !!(id && selIds.has(id));
            // 何も選べなかった場所がロック中のオブジェクトだったときは、その旨を伝える
            // （ロックは「選べない」ので、理由が分からないまま無反応に見えるのを防ぐ）。
            if (!id) {
                const lockedId = pickOb(p, true);
                if (lockedId && obLocked(obOf(lockedId))) flashHint("ロック中のオブジェクトです（一覧の鍵で解除）");
            }
            // Shift/Ctrl/⌘クリックで追加・解除。選択済みのオブジェクトをそのままドラッグしたときは、選択中全体を動かす。
            if (multi) setSelection(id, true);
            else if (!wasSelected || selIds.size <= 1) setSelection(id, false);
            if (id && selIds.has(id)) {
                const o = obOf(id),
                    group = o?.attachment?.verticalOnly
                        ? [{ ...o, off: [...(o.off || [0, 0, 0])] }]
                        : selectedObjects().filter(q => !obLocked(q)).map((q) => ({ ...q, off: [...(q.off || [0, 0, 0])] }));
                ed = {
                    t: "mv",
                    id,
                    o0: { ...o },
                    group,
                    p0: p,
                    P0: pickOnPlane(p, o.k, o.d - o.d * o.lift, cloc(o)),
                    started: false,
                    ...snapSetupGroup(group, objectAnchorWorld(o)),
                };
            } else armBoxPending(p, e.pointerId, "canvas");
        }
        syncSel();
        renderSoon();
        return;
    }
    if (act === "draw" && tool === "border") {
        bd = true;
        CR = { x0: clamp(p.x, 0, W), y0: clamp(p.y, 0, H), x1: clamp(p.x, 0, W), y1: clamp(p.y, 0, H) };
        renderSoon();
        return;
    }
    if (act === "draw" && tool === "erase") {
        er = { base: S, last: p };
        stepErase(p, p);
        renderSoon();
        return;
    } // 消しゴム
    const sn = $("snap").value;
    cur = { a: p, p: [p], ax: sn === "free" ? -2 : sn === "auto" ? -1 : +sn, c: $("pc").value, w: MASTER_W, al: null };
    if (true) {
        const r0 = unscr(p);
        let t0 = r0[1] < -1e-4 ? -P.ch / r0[1] : Infinity;
        if (!(t0 < 500)) t0 = P.dp; // 床に当たれば床の位置、当たらなければ奥行き(空)
        cur.D = t0;
        cur.P0 = V.add(camPos(), r0, 1, t0);
        cur.pv = { c: cur.c, w: cur.w, d3: true, p: [cur.P0] };
    }
};
cv.onpointermove = (e) => {
    lastPtr = pos(e); // 回転中の角度表示用
    const tc = TC.get(e.pointerId);
    if (tc) {
        tc.x = e.clientX;
        tc.y = e.clientY;
        if (mg) {
            multiMove(tc);
            return;
        }
    }
    const boxPendingState = updateBoxPending(pos(e), e.pointerId);
    if (boxSelect && boxSelect.pointerId === e.pointerId) {
        boxSelect.end = pos(e);
        renderSoon();
        return;
    }
    if (boxPendingState === "pending" || boxPendingState === "cancel") return;
    if (e.pointerId !== ptr) return;
    const k = W / cv.getBoundingClientRect().width;
    if (drag && cameraLock && drag.kind !== "orthPan") {
        // 途中でロックした場合も、視点は記録した位置へ戻す。
        drag = null;
        enforceCameraLock();
        renderSoon();
        return;
    }
    if (drag) {
        if (drag.kind === "orthPan") {
            const r = rawOf(e.clientX, e.clientY), sc = Math.max(1e-6, orthScale());
            window.cityFloorPlanCenter = [drag.center[0] - (r.x - drag.x) / sc, drag.center[1] + (r.y - drag.y) / sc];
            renderSoon();
            return;
        }
        const dx = e.clientX - drag.x,
            dy = e.clientY - drag.y;
        if (drag.kind === "pan") {
            const worldPerPx = ((Math.max(0.15, P.ch) * 2) / H) * k;
            const th = P.yaw * DG;
            setP("cx", drag.cx - dx * worldPerPx * Math.cos(th));
            setP("cz", drag.cz - dx * worldPerPx * Math.sin(th));
            setP("ch", clamp(drag.ch + dy * worldPerPx, 0.05, 30));
        } else {
            const yawLimit = T === "f" ? 180 : 180;
            setP("yaw", +clamp(drag.yaw + dx * k * 0.1, -yawLimit, yawLimit).toFixed(3));
            setP("pitch", +clamp(drag.pitch - dy * k * 0.1, -89, 89).toFixed(2));
        }
        sync();
        renderSoon();
        return;
    }
    if (ed) {
        dragEdit(pos(e), !!e.shiftKey);
        return;
    }
    if (bd) {
        const p = pos(e);
        CR.x1 = clamp(p.x, 0, W);
        CR.y1 = clamp(p.y, 0, H);
        renderSoon();
        return;
    }
    if (er) {
        const p = pos(e);
        stepErase(er.last, p);
        er.last = p;
        renderSoon();
        return;
    }
    if (!cur) return;
    const p = pos(e),
        a = cur.a;
    if (cur.ax === -1 && Math.hypot(p.x - a.x, p.y - a.y) >= 6) cur.ax = pick(a, p);
    if (cur.ax === -2) {
        cur.p.push(p);
        if (cur.P0)
            // 正投影は平行投影なので、画面の点から直接ワールド座標を作る
            // （カメラからの向き×奥行きでは、マウスを動かすたびに点が大きく飛ぶ）。
            cur.pv.p.push(orthView ? orthWorldAt(p) : V.add(camPos(), unscr(p), 1, cur.D));
    } // フリーハンド
    else if (cur.ax >= 0) {
        if (cur.P0) {
            // 定規：3Dの直線（軸に沿う）。ペンの位置を、画面上の定規の線へ垂直に落とした点まで引く
            let E;
            if (T === "f") {
                const q = curveF(a, p, cur.ax);
                E = q[q.length - 1];
            } else {
                const u = dirAt(a, cur.ax),
                    tt = (p.x - a.x) * u.x + (p.y - a.y) * u.y;
                E = { x: a.x + u.x * tt, y: a.y + u.y * tt };
            }
            const a3 = AXW[cur.ax];
            // 定規：画面上の軸の向きに投影して、軸に沿った長さ t を出す。
            // 正投影では「カメラからの視線」が平行なので、線分との最近接では求まらない。
            let t = null;
            if (orthView) {
                const s0 = scr(cur.P0),
                    s1 = scr(V.add(cur.P0, a3, 1, 1));
                if (s0.ok && s1.ok) {
                    const dx = s1.x - s0.x,
                        dy = s1.y - s0.y,
                        l2 = dx * dx + dy * dy;
                    if (l2 > 1e-6) t = ((E.x - s0.x) * dx + (E.y - s0.y) * dy) / l2;
                }
            } else t = lineParam(unscr(E), V.add(cur.P0, CO()), a3);
            if (t != null) cur.pv.p = dens3([cur.P0, V.add(cur.P0, a3, 1, t)]);
        } else if (T === "f")
            cur.p = curveF(a, p, cur.ax); // 魚眼：大円の曲線に投影
        else {
            const u = dirAt(a, cur.ax),
                t = (p.x - a.x) * u.x + (p.y - a.y) * u.y;
            cur.p = [a, { x: a.x + u.x * t, y: a.y + u.y * t }];
        } // 定規の線上に投影
    }
    renderSoon();
};
cv.onpointerup = cv.onpointercancel = (e) => {
    if (e.pointerType === "touch") {
        const had = TC.delete(e.pointerId);
        if (mg) {
            if (!TC.size) {
                // 指が全部離れた：2本タップ=元に戻す、3本タップ=やり直し、4本タップ=プリミティブメニュー
                if (e.type === "pointerup" && !mg.moved && Date.now() - mg.t0 < 450) {
                    if (mg.n === 2) undo();
                    else if (mg.n === 3) redo();
                    else if (mg.n >= 4 && window.cityPrimitiveMenuToggle) window.cityPrimitiveMenuToggle();
                } else if (e.type === "pointerup" && mg.moved && mg.n === 3 && window.cityThreeFingerSelect) {
                    window.cityThreeFingerSelect(mg.x1 - mg.x0, mg.y1 - mg.y0, mg.x1, mg.y1);
                }
                mg = null;
            }
            return;
        }
        if (!had) return;
    }
    if (boxSelect && boxSelect.pointerId === e.pointerId) {
        if (e.type === "pointerup") finishBoxSelection(boxPoint(e));
        else boxSelect = null;
        cancelBoxPending();
        ptr = null;
        ptrType = null;
        if (e.pointerType === "pen") lastPen = Date.now();
        return;
    }
    if (boxPending && boxPending.pointerId === e.pointerId) {
        cancelBoxPending();
        ptr = null;
        ptrType = null;
        if (e.pointerType === "pen") lastPen = Date.now();
        return;
    }
    if (e.pointerId !== ptr) return;
    ptr = null;
    ptrType = null;
    if (e.pointerType === "pen") lastPen = Date.now();
    if (er) {
        if (S !== er.base) {
            HU.push(er.base);
            RD = [];
        }
        er = null;
    }
    if (bd) {
        bd = false;
        const r = crect();
        if (r.w < 8 || r.h < 8) CR = null;
    }
    ed = null;
    snapHit = null;
    drag = null;
    if (cur && cur.pv) {
        if (cur.pv.p.length > 1) {
            HU.push(S);
            S = [...S, { c: cur.c, w: cur.w, d3: true, p: dens3(cur.pv.p) }];
            RD = [];
        }
    } // 3Dの線として保存
    else if (cur && cur.p.length > 1) {
        HU.push(S);
        S = [...S, { c: cur.c, w: cur.w, p: dens(cur.p.map(unscr)) }];
        RD = [];
    }
    cur = null;
    renderSoon();
}; // 向きに変換して保存

// iPad Safariでキャンバス外へ指／ペンを離した場合の一般操作用保険。
// ボックス選択以外の編集でも、古いpointerIdが次の操作をブロックしないようにする。
function releaseInputState(e) {
    if (e?.pointerType === "touch") {
        TC.delete(e.pointerId);
        if (!TC.size) mg = null;
    }
    if (e?.pointerType === "pen") lastPen = Date.now();
    if (ptr === e?.pointerId) {
        ptr = null;
        ptrType = null;
        ed = null;
        drag = null;
        cur = null;
        bd = false;
        er = null;
        snapHit = null;
    }
}
addEventListener("pointerup", releaseInputState, false);
addEventListener("pointercancel", releaseInputState, false);
addEventListener("blur", () => {
    if (!boxSelect && !boxPending) {
        ptr = null;
        ptrType = null;
        ed = null;
        drag = null;
        cur = null;
        bd = false;
        er = null;
        TC.clear();
        mg = null;
    }
});

// ===== 12. モード・ボタン =====
function setMode(m) {
    mode = m;
    syncInteractionButtons();
    cv.style.cursor = m === "view" ? "move" : "crosshair";
    $("hint").textContent =
        ($("pn").checked ? "【指＝視点／ペン＝描画】" : "") +
        (m === "view"
            ? T === "f"
                ? "ドラッグ：視点を回転／Shiftまたは右ドラッグ：水平移動／ホイール：ズーム"
                : "ドラッグ：視点を回転／Shiftまたは右ドラッグ：水平移動／ホイール：ズーム（矢印キーでも可）"
            : "線を引くと、向かっているVPへ自動で吸着します。Ctrl/⌘+Zで元に戻す") +
        " ／ 中ドラッグ：回転・Shift+ドラッグ：パン";
}
$("mV").onclick = () => setMode("view");
$("mD").onclick = () => setTool("pen");
const undo = () => {
        if (HU.length) {
            RD.push(S);
            S = HU.pop();
            renderSoon();
        }
    },
    redo = () => {
        if (RD.length) {
            HU.push(S);
            S = RD.pop();
            renderSoon();
        }
    };
$("undo").onclick = undo;
$("redo").onclick = redo;
$("clr").onclick = () => {
    const lockedLines = S.filter((s) => obLocked(s && s.ob));
    if (S.length && confirm("全部消しますか？" + (lockedLines.length ? "\n（ロック中のオブジェクトは残ります）" : ""))) {
        HU.push(S);
        // ロック中の線は残す（解除しない限り消えない、という約束を守る）。
        S = lockedLines;
        RD = [];
        renderSoon();
    }
};
addEventListener("keydown", (e) => {
    const m = e.ctrlKey || e.metaKey;
    if (m && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
    }
    if (m && e.key.toLowerCase() === "y") {
        redo();
        return;
    }
    if (!m && e.shiftKey && e.key.toLowerCase() === "d" && !/INPUT|SELECT|TEXTAREA/.test(String(e.target?.tagName || ""))) {
        // Shift+D = 選択中をその場に複製（ずらさない）。
        // ずらしたいときはパネルの「複製」ボタン（従来どおり横へ）。
        // 修飾キー付き（⌘/Ctrl+D）は使わない。ブラウザの「ブックマークに追加」と取り合わないため。
        const dup = window.cityGridDuplicateSelected || (typeof duplicateSelected === "function" ? duplicateSelected : null);
        const made = dup ? dup("inplace") : 0;
        if (made) {
            e.preventDefault();
            e.stopPropagation();
        }
        return;
    }
    const key = String(e.key || "").toLowerCase(),
        tag = String(e.target?.tagName || "");
    if (key === "x" && !/INPUT|SELECT|TEXTAREA/.test(tag)) {
        // Xは3D／前／横／上の全表示モードで、選択中オブジェクトを削除する。
        // floor-plan側のモードガードを置かないことで、正投影中の選択も消せる。
        e.preventDefault();
        e.stopPropagation();
        if (window.cityGridDeleteSelected) window.cityGridDeleteSelected();
        else if (typeof deleteSelectedObjects === "function") deleteSelectedObjects();
        return;
    }
    if (key === "l" && !/INPUT|SELECT|TEXTAREA/.test(tag)) {
        // L = カメラ固定／解除、⌘/Ctrl+L = 選択オブジェクトのロック／解除。
        // L 単独は「カメラ」、修飾キー付きは「オブジェクト」と覚える。
        e.preventDefault();
        if (m) toggleSelectionLock();
        else toggleCameraLock();
        return;
    }
    if (key === "e" && !window.cityFloorPlanActive && !/INPUT|SELECT|TEXTAREA/.test(tag)) {
        // Eは従来どおり、線の一部を消す消しゴムを起動する。
        $("tE").click();
        return;
    }
    if (!m && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) {
        if (e.key === "1") {
            if (typeof setSide === "function") {
                setSide(!$("side").classList.contains("hide"));
                fit();
            }
            return;
        }
        if (e.key === "2") {
            setMode("view");
            return;
        }
        if (e.key === "3") {
            tool = "pen";
            setTool("pen");
            setMode("draw");
            return;
        }
        if (e.key === "4") {
            tool = "pen";
            setTool("edit");
            return;
        }
        if (e.key === "5") {
            document.getElementById("assetToggle")?.click();
            return;
        }
        if (e.key === "7") {
            window.cityFloorPlanView?.("front");
            return;
        }
        if (e.key === "8") {
            window.cityFloorPlanView?.("side");
            return;
        }
        if (e.key === "9") {
            window.cityFloorPlanView?.("top");
            return;
        }
        if (e.key === "0") {
            if (window.cityFloorPlanActive) window.cityFloorPlanExit?.(true);
            else window.cityStandardView?.("home");
            return;
        }
    }
    if (mode !== "view" || /INPUT|SELECT/.test(e.target.tagName)) return;
    if (cameraLock && /^Arrow/.test(e.key)) {
        // カメラ固定中は矢印キーでも視点を回さない。
        e.preventDefault();
        flashHint("カメラ固定中：視点は動きません（L で解除）");
        return;
    }
    const d = e.shiftKey ? 5 : 0.5;
    const L = 180;
    if (e.key === "ArrowLeft") setP("yaw", clamp(P.yaw - d, -L, L));
    else if (e.key === "ArrowRight") setP("yaw", clamp(P.yaw + d, -L, L));
    else if (e.key === "ArrowUp") setP("pitch", clamp(P.pitch + d, -89, 89));
    else if (e.key === "ArrowDown") setP("pitch", clamp(P.pitch - d, -89, 89));
    else return;
    sync();
    renderSoon();
});

// 書き出しメニューは上部バーの横スクロール領域に隠れないよう、body直下へ移動して表示する。
// addon側のUIが読み込めない場合でも、ここでメニューだけは開けるようにする。
const exportToggle = $("exportToggle"),
    exportMenu = $("exportMenu");
if (exportMenu && exportMenu.parentElement !== document.body) document.body.appendChild(exportMenu);
function setExportOpen(open) {
    if (!exportMenu) return;
    exportMenu.classList.toggle("open", !!open);
    exportMenu.style.display = open ? "grid" : "none";
}
const exportLineWidthInput = $("exportLineWidth");
function syncExportLineWidth() {
    if (exportLineWidthInput && document.activeElement !== exportLineWidthInput)
        exportLineWidthInput.value = Number(P.pw || MASTER_W).toFixed(1);
}
if (exportLineWidthInput)
    exportLineWidthInput.oninput = () => {
        const value = clamp(Number(exportLineWidthInput.value) || MASTER_W, 0.5, 20);
        P.pw = value;
        const mainWidth = $("v_pw");
        if (mainWidth && document.activeElement !== mainWidth) mainWidth.value = value.toFixed(1);
        const slider = $("pw");
        if (slider) slider.value = value;
        renderSoon();
    };
syncExportLineWidth();
exportToggle.onclick = (e) => {
    e.stopPropagation();
    setExportOpen(!exportMenu.classList.contains("open"));
};