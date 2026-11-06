/* City Grid Studio: 入出力と起動（分割モジュール4/4）
   透過PNGの書き出し・参考写真・グリッド種類・保存/読み込み・ロック・起動処理。 */
// ===== 13. 書き出し（透過PNG） =====
// m: 'line'=描画のみ / 'guide'=補助線のみ / 'both'=補助線＋描画（どれも背景透過・写真なし）
// 面表示がONなら、PNGにも面と背面処理を反映する。
function out(m, hidden = false) {
    // 書き出す範囲：ズーム中は「画面に見えている範囲」、範囲指定があればその枠との重なり。拡大率のまま出力する
    const fit = $("zf").checked && Z > 1;
    let r = fit ? { x: -ox / Z, y: -oy / Z, w: W / Z, h: H / Z } : { x: 0, y: 0, w: W, h: H };
    if (CR) {
        const b = crect();
        if (b.w >= 8 && b.h >= 8) {
            const x0 = Math.max(r.x, b.x),
                y0 = Math.max(r.y, b.y),
                x1 = Math.min(r.x + r.w, b.x + b.w),
                y1 = Math.min(r.y + r.h, b.y + b.h);
            if (x1 - x0 >= 1 && y1 - y0 >= 1) r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        }
    }
    const sc = fit ? Z : 1,
        cw = Math.max(1, Math.round(r.w * sc)),
        ch = Math.max(1, Math.round(r.h * sc)),
        tf = [sc, 0, 0, sc, -r.x * sc, -r.y * sc];
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const x = c.getContext("2d");
    if (P.surfaceMode && m !== "guide") {
        x.setTransform(...tf);
        drawObjectSurfaces(x);
        x.setTransform(1, 0, 0, 1, 0, 0);
    }
    if (m !== "line") {
        x.setTransform(...tf);
        T === "f" ? calcF() : calc();
        if (window.cityFloorTint && $("floorTint")?.checked) window.cityFloorTint(x);
        if ($("gg").checked) floorGrid(x);
        orthView ? orthGuides(x) : T === "f" ? guidesF(x) : guides(x);
        if ($("hzl").checked && !orthView) {
            x.strokeStyle = "#e8a33d";
            x.lineWidth = 1.2;
            x.setLineDash([10, 8]);
            x.beginPath();
            if (T === "f") circ(x, AXC[0], AXC[1]);
            else {
                x.moveTo(0, AX.hy);
                x.lineTo(W, AX.hy);
            }
            x.stroke();
            x.setLineDash([]);
        }
        x.setTransform(1, 0, 0, 1, 0, 0);
    }
    if (m !== "guide") x.drawImage(lineLayer(false, false, cw, ch, tf, hidden || P.surfaceMode), 0, 0); // 線画／背面処理（二値化つき）
    return c;
}
function closeExportMenu() {
    setExportOpen(false);
}
function save(m, name, hidden = false) {
    try {
        const canvas = out(m, hidden);
        canvas.toBlob((b) => {
            if (!b) {
                alert("PNGを作成できませんでした。");
                return;
            }
            const a = document.createElement("a");
            a.href = URL.createObjectURL(b);
            a.download = name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            closeExportMenu();
        }, "image/png");
    } catch (e) {
        console.error("City Grid export error", e);
        alert("書き出しに失敗しました。もう一度お試しください。");
    }
}
$("pngL").onclick = () => save("line", "perspective-line.png");
$("pngG").onclick = () => save("guide", "perspective-guide.png");
$("pngB").onclick = () => save("both", "perspective-guide-line.png");
$("pngBH").onclick = () => save("both", "perspective-guide-line-visible.png", true);
$("pngLH").onclick = () => save("line", "perspective-line-visible.png", true);
$("pngGH").onclick = () => save("guide", "perspective-guide-visible.png", true);
// 線画・補助線・合成画像を、いずれも透過PNGとしてクリップボードへコピーする。
// 未対応ブラウザでは各ボタンに状態を表示する。
async function copyExportToClipboard(kind, id, label, hidden = false) {
    const button = $(id);
    if (!button) return;
    try {
        if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")
            throw new Error("Clipboard image API is unavailable");
        const blob = await new Promise((resolve) => out(kind, hidden).toBlob(resolve, "image/png"));
        if (!blob) throw new Error("PNG blob was not created");
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        button.textContent = "コピー済み";
        closeExportMenu();
    } catch (e) {
        console.error("City Grid clipboard export error", e);
        button.textContent = "コピー不可";
    }
    setTimeout(() => (button.textContent = label), 1500);
}
$("cpyL").onclick = () => copyExportToClipboard("line", "cpyL", "線画（透過）をクリップボードにコピー");
$("cpyLH").onclick = () => copyExportToClipboard("line", "cpyLH", "線画（透過・背面処理）をクリップボードにコピー", true);
$("cpyG").onclick = () => copyExportToClipboard("guide", "cpyG", "補助線（透過）をクリップボードにコピー");
$("cpyB").onclick = () => copyExportToClipboard("both", "cpyB", "描画＋補助線（透過）をクリップボードにコピー");

// ===== 14. 参考写真 =====
let IMGsrc = null,
    dirty = false; // IMGsrc=保存用の写真データ(dataURL)
function loadImg(f) {
    const o = new Image();
    o.onload = () => {
        const k = Math.min(1, 2000 / Math.max(o.width, o.height)),
            c = document.createElement("canvas");
        c.width = o.width * k;
        c.height = o.height * k;
        c.getContext("2d").drawImage(o, 0, 0, c.width, c.height);
        IMGsrc = f.type === "image/png" ? c.toDataURL() : c.toDataURL("image/jpeg", 0.88);
        const im = new Image();
        im.onload = () => {
            IMG = im;
            render();
        };
        im.src = IMGsrc;
    };
    o.src = URL.createObjectURL(f);
}
addEventListener("paste", (e) => {
    const f = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    f && loadImg(f);
});
cv.ondragover = (e) => e.preventDefault();
cv.ondrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    f && f.type.startsWith("image/") && loadImg(f);
};

// ===== 15. グリッド種類の切り替え（1/2/3点は通常の透視、5/6点は魚眼） =====
function applyType(v) {
    v = +v;
    T = v >= 5 ? "f" : "r";
    const f = T === "f",
        L = 180,
        Lp = 90;
    $("yaw").min = -L;
    $("yaw").max = L;
    $("pitch").min = -Lp;
    $("pitch").max = Lp;
    document.querySelectorAll(".gr").forEach((e) => (e.style.display = f ? "none" : ""));
    document.querySelectorAll(".gf").forEach((e) => (e.style.display = f ? "" : "none"));
    const y = P.yaw !== 0 && Math.abs(P.yaw) <= 89 ? P.yaw : 39.912,
        set = (o) => {
            for (const k in o) setP(k, o[k]);
        };
    if (v === 1) set({ yaw: 0, pitch: 0 });
    if (v === 2) set({ yaw: y, pitch: 0 });
    if (v === 3) set({ yaw: y, pitch: Math.abs(P.pitch) < 5 ? 30 : clamp(P.pitch, -60, 60) });
    if (v === 5) set({ yaw: 0, pitch: 0, roll: 0, fov: 180 });
    if (v === 6) set({ yaw: 45, pitch: 0, roll: 0, fov: 270 });
    sync();
    setMode(mode);
    window.CityCanvasControls?.sync?.();
    render();
}
$("gt").onchange = (e) => {
    orthView = null;
    applyType(e.target.value);
};
$("pn").onchange = () => setMode(mode);

// ===== 16. 状態の保存・読み込み（プロジェクト） =====
const AK = "pgrid-autosave-v1";
// 初期カメラと面表示の既定値を更新したため、旧既定値だけを一度移行する。
// ユーザーが任意に変更したカメラ位置や面OFFは、移行後の再読み込みでは保持する。
const DEFAULT_VIEW_MIGRATION_KEY = "city-grid-default-view-v4";
// 今の状態をまとめる（線は向きのベクトルなので、視点ごと再現できる）
function pack(withPhoto) {
    const d = {
        app: "perspective-ruler-grid",
        v: 1,
        P: { ...P },
        gt: $("gt").value,
        orthView,
        ar: $("ar").value,
        show: [...show],
        gon: $("gon").checked,
        hzl: $("hzl").checked,
        bgw: $("bgw").checked,
        bin: $("bin").checked,
        zf: $("zf").checked,
        gg: $("gg").checked,
        p3: $("p3").checked,
        cr: CR,
        snap: $("snap").value,
        em: $("em").value,
        pc: $("pc").value,
        S: S.map((s) => ({ c: s.c, w: s.w, ob: s.ob, d3: s.d3, p: s.p.map((v) => v.map((x) => +x.toFixed(5))) })),
    };
    if (withPhoto && IMGsrc) d.photo = IMGsrc;
    return d;
}
// 保存した状態を戻す
function unpack(d) {
    if (!d || d.app !== "perspective-ruler-grid" || !Array.isArray(d.S)) throw new Error("形式が違います");
    // ファイルを開いたらカメラ固定は解除する（保存されていた視点へ戻す必要があるため）。
    // オブジェクトの locked は保存データに含まれているので、そのまま復元される。
    if (typeof setCameraLock === "function" && cameraLock) setCameraLock(false);
    $("ar").value = d.ar;
    $("ar").onchange(); // 画面比率
    $("gt").value = d.gt;
    applyType(d.gt); // 種類（プリセットで値が変わるので直後に上書き）
    for (const k in P) if (d.P && d.P[k] != null) setP(k, d.P[k]);
    d.show.forEach((v, i) => {
        show[i] = v;
        document.querySelector('[data-i="' + i + '"]').checked = v;
    });
    ["gon", "hzl", "bgw", "bin", "zf", "gg", "p3"].forEach((k) => {
        if (d[k] !== undefined) $(k).checked = d[k];
    });
    $("snap").value = d.snap;
    $("em").value = d.em;
    $("pc").value = d.pc;
    {
        const st = d.S.map((s) => (s.ob ? { ...s, ob: fixOb(s.ob) } : s)),
            seen = new Set(),
            out = [],
            needsAssetUpdate = o => !!o && (o.arrayEnabled === true || o.doorEnabled === true || o.openingOffset != null || ["pathPipe", "screenHood", "shopAwning", "displayShelf2", "trafficSignal", "pedSignal", "railing", "streetPavement", "streetMailbox", "streetParcel", "streetPlantBox", "squareStool", "shopWardrobe", "shopWardrobe2", "pictureStairs", "guardPoleHalf", "corrugatedRoof", "securityCamera", "bottleCrate", "chainFence", "ufoCatcher", "gachaMachine"].includes(o.asset) || (o.type === "compound" && Array.isArray(o.parts) && o.parts.some(needsAssetUpdate))),
            regenerate = s => !!s.ob && (!s.d3 || needsAssetUpdate(s.ob));
        // 形を更新した既存アセットの保存線を新しい形へ作り直す。
        // 元の最初の線の位置へ挿入し、他の物体や手描き線との並び順も保つ。
        st.forEach((s) => {
            if (!regenerate(s)) out.push(s);
            else if (!seen.has(s.ob.id)) {
                seen.add(s.ob.id);
                out.push(...genShape(s.ob));
            }
        });
        S = out;
    }
    CR = d.cr || null;
    HU = [];
    RD = [];
    cur = null;
    er = null;
    prev = null;
    clearSelection();
    ed = null;
    Z = 1;
    ox = oy = 0;
    updZ();
    if (d.photo) {
        const im = new Image();
        im.onload = () => {
            IMG = im;
            IMGsrc = d.photo;
            render();
        };
        im.src = d.photo;
    } else {
        IMG = null;
        IMGsrc = null;
    }
    orthView = d.orthView || null;
    sync();
    render();
}
$("svP").onclick = () => {
    const z = (n) => String(n).padStart(2, "0"),
        t = new Date(),
        a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(pack(true))], { type: "application/json" }));
    a.download = `perspective-${t.getFullYear()}${z(t.getMonth() + 1)}${z(t.getDate())}-${z(t.getHours())}${z(t.getMinutes())}.json`;
    a.click();
};
$("opP").onclick = () => $("opF").click();
$("opF").onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    f.text()
        .then((t) => unpack(JSON.parse(t)))
        .catch(() => alert("このファイルは読み込めませんでした"));
    e.target.value = "";
};
// 自動保存：変更があれば3秒ごとにこのブラウザへ保存（写真は容量のためファイル保存のみ）
setInterval(() => {
    if (!dirty) return;
    dirty = false;
    try {
        localStorage.setItem(AK, JSON.stringify(pack(false)));
    } catch (e) {}
}, 3000);
$("rst").onclick = () => {
    if (confirm("自動保存を消して初期化します。よろしいですか？")) {
        try {
            localStorage.removeItem(AK);
        } catch (e) {}
        location.reload();
    }
};

// ⌘/Ctrlを押している間は、カーソルを視点移動の形にする
const curs = () => {
    cv.style.cursor = mode === "view" ? "move" : "crosshair";
};
addEventListener("keydown", (e) => {
    if (e.key === "Meta" || e.key === "Control") cv.style.cursor = "move";
});
addEventListener("keyup", (e) => {
    if (e.key === "Meta" || e.key === "Control") curs();
});
addEventListener("blur", curs);
cv.oncontextmenu = (e) => e.preventDefault();

// ===== 16.5 オブジェクトロック／カメラロック（2026-10-30 追加） =====
// 状態そのものは engine-core.js（obLocked / cameraLock / CAMERA_KEYS）が持ち、
// ここでは「操作の入口」と「画面の表示」を受け持つ。
let hintTimer = null,
    hintBase = "";
// ヒント行に一時メッセージを出す（元の文は自動で戻る）。
function flashHint(msg, ms = 1900) {
    const h = $("hint");
    if (!h) return;
    if (!hintTimer) hintBase = h.textContent;
    h.textContent = msg;
    h.classList.add("hintFlash");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
        hintTimer = null;
        h.classList.remove("hintFlash");
        h.textContent = hintBase;
    }, ms);
}
window.flashHint = flashHint;

// バーと一覧のボタン表示を現在の状態へ合わせる。ロック・解除のたびに呼ぶ。
function syncLockButtons() {
    const selBtn = $("lockSel"),
        camBtn = $("lockCam"),
        lockedCount = typeof lockedObjectCount === "function" ? lockedObjectCount() : 0,
        selected = selectedObjects(),
        allLocked = selected.length > 0 && selected.every(obLocked);
    if (selBtn) {
        // 文言はテキスト部分だけ差し替える（アイコンのSVGを消さないため）。
        const text = selBtn.querySelector(".lockText"),
            label = selected.length
                ? allLocked
                    ? "ロック解除"
                    : "ロック"
                : lockedCount
                  ? `全解除 (${lockedCount})`
                  : "ロック";
        if (text) text.textContent = label;
        else selBtn.textContent = label;
        // 状態はアイコンの形（施錠／開錠）でも分かるようにする。
        selBtn.classList.toggle("on", allLocked);
        selBtn.classList.toggle("unlocked", !allLocked && (selected.length > 0 || lockedCount > 0));
        selBtn.disabled = !selected.length && !lockedCount;
        selBtn.title = selected.length
            ? allLocked
                ? "選択中のオブジェクトのロックを解除（⌘/Ctrl+L）"
                : "選択中のオブジェクトをロック（⌘/Ctrl+L）"
            : lockedCount
              ? "ロック中のオブジェクトを全解除（⌘/Ctrl+L）"
              : "オブジェクトを選ぶとロックできます";
    }
    if (camBtn) {
        const text = camBtn.querySelector(".lockText");
        if (text) text.textContent = cameraLock ? "カメラ固定中" : "カメラ固定";
        else camBtn.textContent = cameraLock ? "カメラ固定中" : "カメラ固定";
        camBtn.classList.toggle("on", cameraLock);
        camBtn.title = cameraLock
            ? "3Dカメラを固定中。正面・横・上の拡大／表示移動はできます。クリックまたは L で解除"
            : "3Dカメラを固定する（正面・横・上の表示操作は可能、L）";
    }
    document.body.classList.toggle("cameraLocked", cameraLock);
}
window.syncLockButtons = syncLockButtons;

function toggleCameraLock() {
    return typeof setCameraLock === "function" ? setCameraLock(!cameraLock) : false;
}
// 選択中のロック切替。選択が無くロック中のものがあるときは全解除にする。
function toggleSelectionLock() {
    const selected = selectedObjects();
    if (selected.length) {
        const lock = !selected.every(obLocked);
        selected.forEach((o) => setObjectLock(o.id, lock));
        flashHint(lock ? `${selected.length}個をロックしました（⌘/Ctrl+L で解除）` : "ロックを解除しました");
    } else if (lockedObjectCount()) {
        const n = unlockAllObjects();
        flashHint(`ロックを全解除しました（${n}個）`);
    } else {
        flashHint("ロックするオブジェクトを先に選択してください");
    }
    syncLockButtons();
    if (typeof updateOutliner === "function") updateOutliner();
    render();
}
window.cityToggleObjectLock = toggleSelectionLock;
window.cityToggleCameraLock = toggleCameraLock;

if ($("lockSel")) $("lockSel").onclick = toggleSelectionLock;
if ($("lockCam")) $("lockCam").onclick = toggleCameraLock;

// 鍵アイコン（キャンバス用）。x,y は中心、s は一辺の目安。
function drawLockGlyph(c, x, y, s, color) {
    c.save();
    c.strokeStyle = color;
    c.lineWidth = Math.max(1, s * 0.16);
    c.lineCap = "round";
    c.beginPath();
    c.arc(x, y - s * 0.16, s * 0.26, Math.PI, Math.PI * 2); // はね
    c.stroke();
    c.beginPath();
    const w = s * 0.8,
        h = s * 0.6,
        bx = x - w / 2,
        by = y - s * 0.08;
    if (c.roundRect) c.roundRect(bx, by, w, h, s * 0.12);
    else c.rect(bx, by, w, h);
    c.fillStyle = "#0f1a20";
    c.fill();
    c.stroke();
    c.restore();
}
// ロック中のオブジェクトに小さな鍵、カメラ固定中は画面の左下にラベルを出す。
// どちらも「今どういう状態か」を画面だけで判断できるようにするためのもの。
function drawLockMarks(c) {
    const locked = [];
    const seen = new Set();
    S.forEach((s) => {
        const o = s && s.ob;
        if (!o || seen.has(o.id)) return;
        seen.add(o.id);
        if (obLocked(o) && objectVisible(o)) locked.push(o);
    });
    if (!locked.length && !cameraLock) return;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0); // 画面座標で描く（ズームの影響を受けない）
    locked.forEach((o) => {
        const b = obBounds(o);
        if (!b) return;
        const p = scrW([(b.lo[0] + b.hi[0]) / 2, b.hi[1], (b.lo[2] + b.hi[2]) / 2]);
        if (!p || !p.ok) return;
        const x = p.x * Z + ox,
            y = p.y * Z + oy - 14;
        if (x < -20 || y < -20 || x > W + 20 || y > H + 20) return;
        c.globalAlpha = 0.92;
        c.fillStyle = "rgba(13,20,24,.72)";
        c.strokeStyle = "#8fd8ff";
        c.lineWidth = 1.2;
        c.beginPath();
        if (c.roundRect) c.roundRect(x - 9, y - 9, 18, 18, 5);
        else c.rect(x - 9, y - 9, 18, 18);
        c.fill();
        c.stroke();
        drawLockGlyph(c, x, y + 1, 12, "#8fd8ff");
    });
    if (cameraLock) {
        const label = "カメラ固定",
            padX = 10;
        c.font = "bold 12px system-ui, sans-serif";
        const tw = c.measureText(label).width,
            w = tw + padX * 2 + 16,
            h = 24,
            x = 12,
            y = H - h - 12;
        c.globalAlpha = 0.94;
        c.fillStyle = "rgba(13,20,24,.78)";
        c.strokeStyle = "#ffd34d";
        c.lineWidth = 1.4;
        c.beginPath();
        if (c.roundRect) c.roundRect(x, y, w, h, 7);
        else c.rect(x, y, w, h);
        c.fill();
        c.stroke();
        drawLockGlyph(c, x + 13, y + h / 2 + 1, 13, "#ffd34d");
        c.fillStyle = "#ffe9a8";
        c.textBaseline = "middle";
        c.fillText(label, x + 26, y + h / 2 + 1);
        c.textBaseline = "alphabetic";
    }
    c.restore();
}
window.cityLockSnapshot = () => ({ cameraLock, locked: lockedObjectCount() });

// ===== 17. 起動 =====
cv.width = W;
cv.height = H;
sync();
syncSurfaceToggle();
syncLockButtons();
applyType(2);
try {
    const sideState = localStorage.getItem("pgrid-side");
    setSide(sideState === null ? true : sideState === "1");
} catch (e) {
    setSide(true);
}
fit();
try {
    const t = localStorage.getItem(AK);
    if (t) unpack(JSON.parse(t));
} catch (e) {} // 前回の自動保存があれば復元
function migrateDefaultViewOnce() {
    try {
        if (localStorage.getItem(DEFAULT_VIEW_MIGRATION_KEY) === "1") return;
        const oldCamera =
            (Math.abs(Number(P.cx) - 2.5) < 1e-6 && Math.abs(Number(P.cz) + 2.5) < 1e-6) ||
            (Math.abs(Number(P.cx) - 8) < 1e-6 && Math.abs(Number(P.cz) + 8) < 1e-6);
        if (oldCamera) {
            P.cx = 0;
            P.cz = 0;
        }
        if (P.surfaceMode === false) P.surfaceMode = true;
        localStorage.setItem(DEFAULT_VIEW_MIGRATION_KEY, "1");
        dirty = true;
        sync();
        syncSurfaceToggle();
        render();
    } catch (e) {}
}
migrateDefaultViewOnce();
