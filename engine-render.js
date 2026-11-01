/* City Grid Studio: 描画（分割モジュール2/4）
   書き出し範囲・隠れ線除去・線画レイヤー・グリッド・補助線・render() 本体。 */
// ===== 2. 書き出し範囲（ブレンダーのレンダー範囲のような枠） =====
function crect() {
    return {
        x: Math.min(CR.x0, CR.x1),
        y: Math.min(CR.y0, CR.y1),
        w: Math.abs(CR.x1 - CR.x0),
        h: Math.abs(CR.y1 - CR.y0),
    };
}
function overlay(c) {
    // 範囲の外を暗くして枠を表示（画面だけ。書き出しには入らない）
    if (!CR) return;
    const r = crect();
    c.save();
    c.fillStyle = "rgba(0,0,0,.45)";
    c.beginPath();
    c.rect(0, 0, W, H);
    c.rect(r.x, r.y, r.w, r.h);
    c.fill("evenodd");
    c.strokeStyle = "#ffd34d";
    c.lineWidth = 2 / Z;
    c.strokeRect(r.x, r.y, r.w, r.h);
    c.fillStyle = "#ffd34d";
    c.font = `${16 / Z}px system-ui`;
    c.fillText(Math.round(r.w) + "×" + Math.round(r.h), r.x + 4 / Z, r.y > 24 / Z ? r.y - 6 / Z : r.y + 18 / Z);
    c.restore();
}
$("crC").onclick = () => {
    CR = null;
    render();
};
$("crF").onclick = () => {
    let x0 = 1e9,
        y0 = 1e9,
        x1 = -1e9,
        y1 = -1e9; // 描いた線がちょうど入る範囲にする
    S.forEach((s) =>
        s.p.forEach((v) => {
            const q = sp(s, v);
            if (!q.ok) return;
            x0 = Math.min(x0, q.x);
            x1 = Math.max(x1, q.x);
            y0 = Math.min(y0, q.y);
            y1 = Math.max(y1, q.y);
        }),
    );
    if (x0 > x1) return;
    const m = 20;
    CR = { x0: clamp(x0 - m, 0, W), y0: clamp(y0 - m, 0, H), x1: clamp(x1 + m, 0, W), y1: clamp(y1 + m, 0, H) };
    render();
};

// ===== 3. ツール切り替え（消しゴム・図形・範囲）と設定パネルの開閉 =====
function syncInteractionButtons() {
    // 視点／鉛筆と、編集／消しゴム／図形／範囲を同じ「ON」表示にしない。
    // 視点中はツールボタンをすべてOFF、描画中は選択した1ツールだけをONにする。
    $("mV").classList.toggle("on", mode === "view");
    $("mD").classList.toggle("on", mode === "draw" && tool === "pen");
    [
        ["tE", "erase"],
        ["tB", "border"],
        ["tM", "edit"],
    ].forEach(([id, n]) => $(id).classList.toggle("on", mode === "draw" && tool === n));
}
function setTool(t) {
    tool = t;
    setMode("draw");
    const HT = {
        border: "書き出し範囲：ドラッグで枠を指定。範囲指定はPNG保存・コピーに反映されます",
        erase: "消しゴム：なぞったところを消します",
        edit: "図形編集：線にさわって選択。空白を長押ししてドラッグするとボックス選択。Shift/Ctrl/⌘クリックでも複数選択でき、選択済みの線をドラッグするとまとめて移動。iPadは指またはApple Pencilで長押しドラッグ。矢印＝軸に沿って移動／白い四角＝面を押し引き／点線の輪＝回転（上下＝オレンジの輪／左右＝Xのリング／手前奥＝Yのリング）／線をドラッグ＝面の上で移動。看板は絵枠W・絵枠Hと外形の面ハンドル、建物は開口W/H・奥面と外側面、円錐は高さ、球体は半径ハンドルをドラッグできます",
    };
    if (HT[tool]) $("hint").textContent = HT[tool] + " ／ ⌘(Ctrl)+ドラッグ＝視点移動";
}
$("tE").onclick = () => setTool("erase");
// 「範囲」は同じボタンをもう一度押すとOFFに戻せるトグルにする。
// 指定済みの書き出し範囲(CR)自体は消さず、範囲ドラッグだけを終了する。
$("tB").onclick = () => {
    if (mode === "draw" && tool === "border") setMode("view");
    else setTool("border");
};
$("tM").onclick = () => setTool("edit");
const edge = document.createElement("button");
edge.id = "edgeTab";
edge.title = "設定パネルを開閉";
document.body.appendChild(edge); // パネルの端にいつも出るタブ
function setSide(h) {
    const sd = $("side");
    sd.classList.toggle("hide", h);
    $("tg").textContent = h ? "設定を開く" : "設定を隠す";
    edge.textContent = h ? "▶" : "◀";
    edge.style.left = h ? "env(safe-area-inset-left,0px)" : sd.getBoundingClientRect().right + "px";
    try {
        localStorage.setItem("pgrid-side", h ? "1" : "0");
    } catch (e) {}
}
$("tg").onclick = () => {
    setSide(!$("side").classList.contains("hide"));
    fit();
};
edge.onclick = $("tg").onclick;
addEventListener("resize", () => setSide($("side").classList.contains("hide")));

// ===== 4. 書き出し用の隠れ線除去 =====
// オブジェクトの面を簡易Zバッファへ rasterize し、ビューから遮られる線分だけを切る。
// 通常表示は従来どおり全線を描き、PNGの「背面線除去」項目だけでこの処理を使う。
function addExportBoxFaces(out, o, w, d, z0, z1) {
    const x = w / 2,
        y = d / 2,
        v = [
            [-x, -y, z0],
            [x, -y, z0],
            [x, y, z0],
            [-x, y, z0],
            [-x, -y, z1],
            [x, -y, z1],
            [x, y, z1],
            [-x, y, z1],
        ];
    const f = [
        [0, 1, 2, 3],
        [4, 7, 6, 5],
        [0, 4, 5, 1],
        [1, 5, 6, 2],
        [2, 6, 7, 3],
        [3, 7, 4, 0],
    ];
    f.forEach((q) => {
        const a = q.map((i) => L2W(o, ...v[i]));
        out.push([a[0], a[1], a[2]], [a[0], a[2], a[3]]);
    });
}
// 面メッシュはオブジェクトを編集しない限り変わらない。カメラを動かすたびに
// 作り直すのは重いので、オブジェクトごとに結果を保持して使い回す。
// キーはオブジェクトの現在値（数値・文字列・配列）をそのまま文字列にしたもの。
// 値が1つでも変われば作り直すので、編集結果が古いまま残ることはない。
const surfaceTriCache = new WeakMap();
function surfaceCacheKey(o) {
    const seen = new Set();
    return JSON.stringify(o, (key, value) => {
        if (typeof value === "function") return undefined;
        if (value && typeof value === "object") {
            if (seen.has(value)) return undefined;
            seen.add(value);
        }
        return value;
    });
}
function surfaceTriangles(o) {
    if (!o || typeof o !== "object") return exportSurfaceTriangles(o);
    // 親へ接着しているパーツは、親の移動・回転が o 側の基準（wallSideBasis）へ
    // 反映されてから値を見る。反映前のキーで照合すると古い面が残る。
    if (o.attachment && typeof syncAttachedPart === "function") syncAttachedPart(o);
    const key = surfaceCacheKey(o),
        hit = surfaceTriCache.get(o);
    if (hit && hit.key === key) return hit.tris;
    const tris = exportSurfaceTriangles(o);
    surfaceTriCache.set(o, { key, tris });
    return tris;
}
function exportSurfaceTriangles(o) {
    const out = [];
    if (o?.type === "compound") {
        compoundPartsAt(o).forEach((part) => out.push(...exportSurfaceTriangles(part)));
        return out;
    }
    const w = Math.abs(2 * Number(o.ra) || 1),
        d = Math.abs(2 * Number(o.rb) || 1),
        h = Math.max(0.01, Math.abs(Number(o.h) || 0.01));
    const L = (x, y, z) => L2W(o, x, y, z),
        tri = (a, b, c) => out.push([L(...a), L(...b), L(...c)]),
        quad = (a, b, c, d) => {
            tri(a, b, c);
            tri(a, c, d);
        };
    const disk = (z, n = 24) => {
        const c = [0, 0, z];
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2,
                b = ((i + 1) / n) * Math.PI * 2;
            tri(
                c,
                [(w / 2) * Math.cos(a), (d / 2) * Math.sin(a), z],
                [(w / 2) * Math.cos(b), (d / 2) * Math.sin(b), z],
            );
        }
    };
    const cylinder = (z0, z1, n = 24) => {
        disk(z0, n);
        disk(z1, n);
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2,
                b = ((i + 1) / n) * Math.PI * 2,
                A = [(w / 2) * Math.cos(a), (d / 2) * Math.sin(a), z0],
                B = [(w / 2) * Math.cos(b), (d / 2) * Math.sin(b), z0],
                C = [(w / 2) * Math.cos(b), (d / 2) * Math.sin(b), z1],
                D = [(w / 2) * Math.cos(a), (d / 2) * Math.sin(a), z1];
            quad(A, B, C, D);
        }
    };
    const boxAt = (cx, cy, bw, bd, z0, z1) => {
        const x = bw / 2,
            y = bd / 2,
            v = [
                [cx - x, cy - y, z0],
                [cx + x, cy - y, z0],
                [cx + x, cy + y, z0],
                [cx - x, cy + y, z0],
                [cx - x, cy - y, z1],
                [cx + x, cy - y, z1],
                [cx + x, cy + y, z1],
                [cx - x, cy + y, z1],
            ],
            f = [
                [0, 1, 2, 3],
                [4, 7, 6, 5],
                [0, 4, 5, 1],
                [1, 5, 6, 2],
                [2, 6, 7, 3],
                [3, 7, 4, 0],
            ];
        f.forEach((q) => quad(v[q[0]], v[q[1]], v[q[2]], v[q[3]]));
    };
    const beveledAt = (cx, cy, bw, bd, z0, z1, offset, segments) => {
        const footprint = beveledBoxFootprint(bw, bd, offset, segments),
            center0 = [cx, cy, z0],
            center1 = [cx, cy, z1];
        for (let i = 0; i < footprint.length; i++) {
            const j = (i + 1) % footprint.length,
                a = [cx + footprint[i][0], cy + footprint[i][1], z0],
                b = [cx + footprint[j][0], cy + footprint[j][1], z0],
                c = [cx + footprint[j][0], cy + footprint[j][1], z1],
                d0 = [cx + footprint[i][0], cy + footprint[i][1], z1];
            tri(center0, b, a);
            tri(center1, d0, c);
            quad(a, b, c, d0);
        }
    };
    const cornerCutOpeningAt = (z0, z1, opening) => {
        const footprint = opening.footprint,
            cutIndex = footprint.length - 1,
            center0 = [0, 0, z0],
            center1 = [0, 0, z1],
            point = (xy, z) => [xy[0], xy[1], z];
        for (let i = 0; i < footprint.length; i++) {
            const j = (i + 1) % footprint.length,
                a = point(footprint[i], z0),
                b = point(footprint[j], z0),
                c = point(footprint[j], z1),
                d0 = point(footprint[i], z1);
            tri(center0, b, a);
            tri(center1, d0, c);
            if (i !== cutIndex) quad(a, b, c, d0);
        }
        const { cutA, cutB, frontA, frontB, backA, backB, openingH } = opening;
        // 赤い隅切り面を開口幅で分割する。開口は床から始まるため、
        // 左右の残り面と上部だけを外周面として残す。
        quad(point(cutA, z0), point(frontA, z0), point(frontA, z1), point(cutA, z1));
        quad(point(frontB, z0), point(cutB, z0), point(cutB, z1), point(frontB, z1));
        quad(point(frontA, openingH), point(frontB, openingH), point(cutB, z1), point(cutA, z1));
        // 開口内部の左右側面・上面・奥壁。
        quad(point(frontA, z0), point(backA, z0), point(backA, openingH), point(frontA, openingH));
        quad(point(frontB, z0), point(frontB, openingH), point(backB, openingH), point(backB, z0));
        quad(point(frontA, openingH), point(backA, openingH), point(backB, openingH), point(frontB, openingH));
        quad(point(backA, z0), point(backB, z0), point(backB, openingH), point(backA, openingH));
    };
    const openingBoxAt = (cx, cy, bw, bd, z0, z1, opening) => {
        const x = bw / 2,
            y = bd / 2,
            ow = clamp(Number(opening.openingW) || bw * 0.56, 0.1, Math.max(0.1, bw - 0.1)),
            oh = clamp(Number(opening.openingH) || (z1 - z0) * 0.66, 0.1, Math.max(0.1, z1 - z0 - 0.01)),
            panelY = clamp(Number(opening.openingBack), -y + 0.025, y - 0.025),
            q = (a, b, c, d) => quad(a, b, c, d);
        q([-x, -y, z0], [x, -y, z0], [x, y, z0], [-x, y, z0]);
        q([-x, -y, z1], [-x, y, z1], [x, y, z1], [x, -y, z1]);
        q([-x, -y, z0], [-x, -y, z1], [-x, y, z1], [-x, y, z0]);
        q([x, -y, z0], [x, y, z0], [x, y, z1], [x, -y, z1]);
        q([-x, y, z0], [-x, y, z1], [x, y, z1], [x, y, z0]);
        q([-x, -y, z0], [-ow / 2, -y, z0], [-ow / 2, -y, z1], [-x, -y, z1]);
        q([ow / 2, -y, z0], [x, -y, z0], [x, -y, z1], [ow / 2, -y, z1]);
        q([-ow / 2, -y, oh + z0], [ow / 2, -y, oh + z0], [ow / 2, -y, z1], [-ow / 2, -y, z1]);
        q([-ow / 2, -y, z0], [-ow / 2, panelY, z0], [-ow / 2, panelY, oh + z0], [-ow / 2, -y, oh + z0]);
        q([ow / 2, -y, z0], [ow / 2, -y, oh + z0], [ow / 2, panelY, oh + z0], [ow / 2, panelY, z0]);
        q([-ow / 2, -y, oh + z0], [-ow / 2, panelY, oh + z0], [ow / 2, panelY, oh + z0], [ow / 2, -y, oh + z0]);
        q([-ow / 2, panelY, z0], [ow / 2, panelY, z0], [ow / 2, panelY, oh + z0], [-ow / 2, panelY, oh + z0]);
    };
    const beveledOpeningAt = (cx, cy, bw, bd, z0, z1, offset, segments, opening) => {
        const footprint = beveledBoxFootprint(bw, bd, offset, segments),
            x = bw / 2,
            y = bd / 2,
            ow = clamp(Number(opening.openingW) || bw * 0.56, 0.1, Math.max(0.1, bw - 0.1)),
            oh = clamp(Number(opening.openingH) || (z1 - z0) * 0.66, 0.1, Math.max(0.1, z1 - z0 - 0.01)),
            panelY = clamp(Number(opening.openingBack), -y + 0.025, y - 0.025),
            bottom = [cx, cy, z0],
            top = [cx, cy, z1];
        for (let i = 0; i < footprint.length; i++) {
            const j = (i + 1) % footprint.length,
                a = [cx + footprint[i][0], cy + footprint[i][1], z0],
                b = [cx + footprint[j][0], cy + footprint[j][1], z0],
                c = [cx + footprint[j][0], cy + footprint[j][1], z1],
                d0 = [cx + footprint[i][0], cy + footprint[i][1], z1],
                near = Math.abs(footprint[i][1] + y) < 1e-4 && Math.abs(footprint[j][1] + y) < 1e-4;
            tri(bottom, b, a);
            tri(top, d0, c);
            if (!near) quad(a, b, c, d0);
            else {
                const lo = Math.min(footprint[i][0], footprint[j][0]) + cx,
                    hi = Math.max(footprint[i][0], footprint[j][0]) + cx,
                    wall = (xa, xb, za, zb) => {
                        const l = Math.max(lo, xa + cx),
                            r = Math.min(hi, xb + cx);
                        if (r > l + 1e-5) quad([l, cy - y, za], [r, cy - y, za], [r, cy - y, zb], [l, cy - y, zb]);
                    };
                wall(-x, -ow / 2, z0, z1);
                wall(ow / 2, x, z0, z1);
                wall(-ow / 2, ow / 2, oh + z0, z1);
            }
        }
        quad(
            [cx - ow / 2, cy - y, z0],
            [cx - ow / 2, cy + panelY, z0],
            [cx - ow / 2, cy + panelY, oh + z0],
            [cx - ow / 2, cy - y, oh + z0],
        );
        quad(
            [cx + ow / 2, cy - y, z0],
            [cx + ow / 2, cy - y, oh + z0],
            [cx + ow / 2, cy + panelY, oh + z0],
            [cx + ow / 2, cy + panelY, z0],
        );
        quad(
            [cx - ow / 2, cy - y, oh + z0],
            [cx - ow / 2, cy + panelY, oh + z0],
            [cx + ow / 2, cy + panelY, oh + z0],
            [cx + ow / 2, cy - y, oh + z0],
        );
        quad(
            [cx - ow / 2, cy + panelY, z0],
            [cx + ow / 2, cy + panelY, z0],
            [cx + ow / 2, cy + panelY, oh + z0],
            [cx - ow / 2, cy + panelY, oh + z0],
        );
    };
    const ellipsoid = (cx, cy, cz, rx, ry, rz, lat = 8, lon = 12) => {
        for (let j = 0; j < lat; j++) {
            const p0 = -Math.PI / 2 + (j * Math.PI) / lat,
                p1 = -Math.PI / 2 + ((j + 1) * Math.PI) / lat;
            for (let i = 0; i < lon; i++) {
                const a = (i * 2 * Math.PI) / lon,
                    b = ((i + 1) * 2 * Math.PI) / lon,
                    q = (p, t) => [
                        cx + rx * Math.cos(p) * Math.cos(t),
                        cy + ry * Math.cos(p) * Math.sin(t),
                        cz + rz * Math.sin(p),
                    ],
                    A = q(p0, a),
                    B = q(p0, b),
                    C = q(p1, b),
                    D = q(p1, a);
                tri(A, B, C);
                tri(A, C, D);
            }
        }
    };
    const segment = (a, b, r, n = 6) => {
        const sub = (u, v) => u.map((x, i) => x - v[i]),
            add = (u, v) => u.map((x, i) => x + v[i]),
            mul = (u, s) => u.map((x) => x * s),
            dotL = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2],
            crossL = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]],
            unit = (u) => {
                const q = Math.hypot(...u) || 1;
                return u.map((x) => x / q);
            },
            axis = unit(sub(b, a)),
            ref = Math.abs(axis[2]) < 0.85 ? [0, 0, 1] : [0, 1, 0],
            u = unit(crossL(axis, ref)),
            v = unit(crossL(axis, u)),
            ra = [],
            rb = [];
        for (let i = 0; i < n; i++) {
            const t = (i / n) * Math.PI * 2,
                off = add(mul(u, Math.cos(t) * r), mul(v, Math.sin(t) * r));
            ra.push(add(a, off));
            rb.push(add(b, off));
        }
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            quad(ra[i], ra[j], rb[j], rb[i]);
            tri(a, ra[j], ra[i]);
            tri(b, rb[i], rb[j]);
        }
    };
    const kind = o.asset || o.type;
    if (kind === "recessedStackedBuilding" && typeof recessedStackedBuildingParams === "function") {
        const q = recessedStackedBuildingParams(o),
            ctri = (a, b, c) => out.push([customPt(o, ...a), customPt(o, ...b), customPt(o, ...c)]),
            cquad = (a, b, c, d) => {
                ctri(a, b, c);
                ctri(a, c, d);
            },
            // 窓の切り欠きで凹んだ面も、輪郭の外へはみ出さないよう
            // 耳切り法で三角形分割する。
            cface = (points, z) => {
                polygonEarClip(points).forEach(([a, b, c]) => {
                    ctri([a[0], a[1], z], [b[0], b[1], z], [c[0], c[1], z]);
                });
            },
            prism = (points, z0, z1) => {
                cface(points, z0);
                cface([...points].reverse(), z1);
                for (let i = 0; i < points.length; i++) {
                    const j = (i + 1) % points.length;
                    cquad(
                        [points[i][0], points[i][1], z0],
                        [points[j][0], points[j][1], z0],
                        [points[j][0], points[j][1], z1],
                        [points[i][0], points[i][1], z1],
                    );
                }
            },
            x = q.w * 0.5,
            y = q.d * 0.5,
            frontY = -y,
            footprint = recessedStackedBuildingFootprint(q),
            // 壁ブロックの範囲(z0..z1)へ窓帯(band)を切り欠く。
            // 接合部をまたぐ窓はブロックの上端・下端で途切れず続く。
            drawWindowBand = (z0, z1, band) => {
                const paths = recessedStackedBuildingWindowPaths(q),
                    outer = q.sideWindows ? paths.outer : paths.outer.slice(0, 2),
                    inner = q.sideWindows ? paths.inner : paths.inner.slice(0, 2),
                    fillWall = () => {
                        // 窓帯を持たない階（最上階など）は、窓帯の外周に沿う面を
                        // 床から天井まで塞ぐ。塞がないと背面線の除去が効かない。
                        for (let i = 0; i < outer.length - 1; i++) {
                            const a = outer[i],
                                b = outer[i + 1];
                            quad([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]);
                        }
                    },
                    za = band ? Math.max(z0, band.bottom) : z0,
                    zb = band ? Math.min(z1, band.top) : z0;
                if (!band || zb - za <= 0.0005) {
                    fillWall();
                    return { outer, inner };
                }
                // 凹みの下端・上端・奥壁を、正面→ベベル→側面の1本の帯として作る。
                for (let i = 0; i < outer.length - 1; i++) {
                    const a = outer[i],
                        b = outer[i + 1],
                        ia = inner[i],
                        ib = inner[i + 1];
                    if (za > z0 + 0.0005)
                        cquad([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], za], [a[0], a[1], za]);
                    if (zb < z1 - 0.0005)
                        cquad([a[0], a[1], zb], [b[0], b[1], zb], [b[0], b[1], z1], [a[0], a[1], z1]);
                    cquad([ia[0], ia[1], za], [ib[0], ib[1], za], [ib[0], ib[1], zb], [ia[0], ia[1], zb]);
                    cquad([a[0], a[1], za], [ia[0], ia[1], za], [ib[0], ib[1], za], [b[0], b[1], za]);
                    cquad([a[0], a[1], zb], [b[0], b[1], zb], [ib[0], ib[1], zb], [ia[0], ia[1], zb]);
                }
                const start = outer[0],
                    startInner = inner[0],
                    end = outer[outer.length - 1],
                    endInner = inner[inner.length - 1];
                cquad(
                    [start[0], start[1], za],
                    [startInner[0], startInner[1], za],
                    [startInner[0], startInner[1], zb],
                    [start[0], start[1], zb],
                );
                cquad(
                    [end[0], end[1], za],
                    [end[0], end[1], zb],
                    [endInner[0], endInner[1], zb],
                    [endInner[0], endInner[1], za],
                );
                return { outer, inner };
            },
            drawBeam = (z1) => {
                if (q.beamHeight <= 0 || q.beamProjection <= 0) return;
                prism(recessedStackedBuildingBeamFootprint(q), z1 - q.beamHeight, z1);
            },
            // 階の壁と、階の間を埋める壁の両方を同じ処理で作る。
            // capsをfalseにすると接合部の壁だけを描く。
            drawFloor = (z0, floorHeight, band, caps = true) => {
                const z1 = z0 + floorHeight,
                    paths = recessedStackedBuildingWindowPaths(q),
                    outer = q.sideWindows ? paths.outer : paths.outer.slice(0, 2),
                    frontStart = outer[0],
                    sideEnd = outer[outer.length - 1],
                    // 窓帯が床面をまたぐ階では、スラブの輪郭を切り欠く。
                    lowerNotch = !!band && band.bottom < z0 + 0.0001 && band.top > z0 + 0.0001,
                    upperNotch = !!band && band.bottom < z1 - 0.0001 && band.top > z1 - 0.0001;
                // 底面・上面をベベル付き外周で閉じる。
                if (caps) {
                    cface(recessedStackedBuildingCapPath(q, lowerNotch), z0);
                    cface([...recessedStackedBuildingCapPath(q, upperNotch)].reverse(), z1);
                }
                // 開口帯の左側、帯の後ろ側、背面、左面。
                cquad([-x, frontY, z0], [frontStart[0], frontStart[1], z0], [frontStart[0], frontStart[1], z1], [-x, frontY, z1]);
                if (q.sideWindows) {
                    cquad([sideEnd[0], sideEnd[1], z0], [x, y, z0], [x, y, z1], [sideEnd[0], sideEnd[1], z1]);
                } else {
                    const frontRight = x - q.cornerBevel,
                        sideStart = -y + q.cornerBevel;
                    cquad([frontRight, -y, z0], [x, sideStart, z0], [x, sideStart, z1], [frontRight, -y, z1]);
                    cquad([x, sideStart, z0], [x, y, z0], [x, y, z1], [x, sideStart, z1]);
                }
                cquad([x, y, z0], [-x, y, z0], [-x, y, z1], [x, y, z1]);
                cquad([-x, y, z0], [-x, -y, z0], [-x, -y, z1], [-x, y, z1]);
                drawWindowBand(z0, z1, band);
                // 屋根になる最上階には梁／庇を上端へ作る。
                if (caps) drawBeam(band ? band.top : z1);
            };
        const junctions = recessedStackedBuildingJunctionWindows(o, q);
        recessedStackedBuildingFloors(o, q).forEach((floor) => {
            // 開口は各階の下端ではなく、階と階の接合部中央に作る。
            drawFloor(floor.z, floor.h, junctions[floor.index]);
            // 階同士の間も空洞ではなく壁でつなぎ、接合部の窓はそこを貫通させる。
            if (floor.index < q.floorCount - 1 && q.floorGap > 0)
                drawFloor(floor.z + floor.h, q.floorGap, junctions[floor.index], false);
        });
        return out;
    }
    if (kind === "wallSign" && typeof wallSignParams === "function") {
        const params = wallSignParams(o),
            face = wallSignFacePoints(params),
            half = params.thickness * 0.5;
        // 板の表裏は凹みの無い凸多角形なので耳切りで分割し、
        // 側面は輪郭の辺を板厚方向へつないだ4角形にする。
        polygonEarClip(face).forEach(([a, b, c]) => {
            tri([a[0], -half, a[1]], [b[0], -half, b[1]], [c[0], -half, c[1]]);
            tri([a[0], half, a[1]], [c[0], half, c[1]], [b[0], half, b[1]]);
        });
        for (let i = 0; i < face.length; i++) {
            const a = face[i],
                b = face[(i + 1) % face.length];
            quad([a[0], -half, a[1]], [b[0], -half, b[1]], [b[0], half, b[1]], [a[0], half, a[1]]);
        }
        // 取付金具は板の左側面から横へ伸びる単純な直方体。
        wallSignBrackets(params).forEach((bracket) => {
            const z0 = bracket.z - bracket.h * 0.5,
                z1 = bracket.z + bracket.h * 0.5;
            quad([bracket.x0, bracket.y0, z0], [bracket.x1, bracket.y0, z0], [bracket.x1, bracket.y0, z1], [bracket.x0, bracket.y0, z1]);
            quad([bracket.x0, bracket.y1, z1], [bracket.x1, bracket.y1, z1], [bracket.x1, bracket.y1, z0], [bracket.x0, bracket.y1, z0]);
            quad([bracket.x0, bracket.y0, z1], [bracket.x1, bracket.y0, z1], [bracket.x1, bracket.y1, z1], [bracket.x0, bracket.y1, z1]);
            quad([bracket.x0, bracket.y1, z0], [bracket.x1, bracket.y1, z0], [bracket.x1, bracket.y0, z0], [bracket.x0, bracket.y0, z0]);
            quad([bracket.x0, bracket.y0, z0], [bracket.x0, bracket.y1, z0], [bracket.x0, bracket.y1, z1], [bracket.x0, bracket.y0, z1]);
            quad([bracket.x1, bracket.y0, z1], [bracket.x1, bracket.y1, z1], [bracket.x1, bracket.y1, z0], [bracket.x1, bracket.y0, z0]);
        });
        return out;
    }
    if (kind === "cornerCutBox" && typeof cornerCutFootprint === "function") {
        const opening = typeof cornerCutOpeningParams === "function" ? cornerCutOpeningParams(o) : null,
            z0 = 0,
            z1 = Math.max(0.01, Math.abs(Number(o.h) || 0.01));
        if (opening?.enabled) cornerCutOpeningAt(z0, z1, opening);
        else {
            const params = cornerCutBoxParams(o),
                footprint = cornerCutFootprint(params.w, params.d, params.cornerOffset, params.cornerCutCorner),
                center0 = [0, 0, z0],
                center1 = [0, 0, z1];
            // 隅切りした凸多角形を、上下の扇形と5枚の側面へ分解する。
            for (let i = 0; i < footprint.length; i++) {
                const j = (i + 1) % footprint.length,
                    a = [footprint[i][0], footprint[i][1], z0],
                    b = [footprint[j][0], footprint[j][1], z0],
                    c = [footprint[j][0], footprint[j][1], z1],
                    d0 = [footprint[i][0], footprint[i][1], z1];
                tri(center0, b, a);
                tri(center1, d0, c);
                quad(a, b, c, d0);
            }
        }
        return out;
    }
    if (kind === "beveledBox" && typeof beveledBoxFootprint === "function") {
        const q = beveledBoxParams(o),
            footprint = beveledBoxFootprint(q.w, q.d, q.bevelOffset, q.bevelSegments),
            z0 = 0,
            z1 = Math.max(0.01, Number(o.h) || 0.01),
            center0 = [0, 0, z0],
            center1 = [0, 0, z1];
        // 面取りした凸多角形を上下面のファンと側面の四角形へ分解する。
        for (let i = 0; i < footprint.length; i++) {
            const j = (i + 1) % footprint.length,
                a = [footprint[i][0], footprint[i][1], z0],
                b = [footprint[j][0], footprint[j][1], z0],
                c = [footprint[j][0], footprint[j][1], z1],
                d0 = [footprint[i][0], footprint[i][1], z1];
            tri(center0, b, a);
            tri(center1, d0, c);
            quad(a, b, c, d0);
        }
        return out;
    }
    if (kind === "pathPipe" && typeof pathPipeMesh === "function") {
        const mesh = pathPipeMesh(o);
        mesh.triangles.forEach((triangle) => out.push(triangle.map((v) => L(...v))));
        return out;
    }
    if (kind === "stackedBuilding" || kind === "beveledStackedBuilding") {
        const floors =
            Array.isArray(o.floors) && o.floors.length
                ? o.floors
                : [{ x: 0, y: 0, z: 0, w, d, h, rimHeight: 0.16, rimOverhang: 0.18 }];
        floors.forEach((f, i) => {
            const fw = Math.max(0.05, Math.abs(Number(f.w) || w)),
                fd = Math.max(0.05, Math.abs(Number(f.d) || d)),
                fh = Math.max(0.05, Math.abs(Number(f.h) || h)),
                fz = Number(f.z) || 0,
                fx = Number(f.x) || 0,
                fy = Number(f.y) || 0,
                rh = clamp(Math.abs(Number(f.rimHeight) || Number(o.rimHeight) || 0.16), 0.01, fh),
                ro = Math.max(0, Math.abs(Number(f.rimOverhang) || Number(o.rimOverhang) || 0.18)),
                bevelOffset = Number.isFinite(Number(f.bevelOffset))
                    ? Number(f.bevelOffset)
                    : Number(o.bevelOffset) || 0.28,
                bevelSegments = beveledBoxSegments(
                    f.bevelSegments,
                    f.bevelEdges,
                    beveledBoxSegments(o.bevelSegments, o.bevelEdges),
                ),
                opening = i === 0 && stackedOpeningEnabled(o) ? stackedOpeningParams(o, f) : null;
            if (kind === "beveledStackedBuilding") {
                if (opening) beveledOpeningAt(fx, fy, fw, fd, fz, fz + fh, bevelOffset, bevelSegments, opening);
                else beveledAt(fx, fy, fw, fd, fz, fz + fh, bevelOffset, bevelSegments);
                // 下側の縁は全階で作らず、各階の上側だけに縁を配置する。
                beveledAt(fx, fy, fw + ro * 2, fd + ro * 2, fz + fh - rh, fz + fh, bevelOffset, bevelSegments);
            } else {
                if (opening) openingBoxAt(fx, fy, fw, fd, fz, fz + fh, opening);
                else boxAt(fx, fy, fw, fd, fz, fz + fh);
                // 下側の縁は全階で作らず、各階の上側だけに縁を配置する。
                boxAt(fx, fy, fw + ro * 2, fd + ro * 2, fz + fh - rh, fz + fh);
            }
        });
        return out;
    }
    if (kind === "balcony") {
        const g = balconyGeometry(o);
        // 床スラブと腰壁を別の箱として作る（厚さは共通）。
        boxAt(0, 0, g.w, g.d, 0, g.thickness);
        if (g.frontRail) boxAt(0, -g.d / 2 + g.thickness / 2, g.w, g.thickness, g.thickness, g.thickness + g.railH);
        if (g.sideRail) {
            // 左右の腰壁は前面の腰壁と角で重ならないよう、前面の後ろ側から詰める
            //（重ねると半透明の塗りが二重になって濃くなる）。
            const sideY0 = g.frontRail ? -g.d / 2 + g.thickness : -g.d / 2,
                sideD = g.d / 2 - sideY0;
            boxAt(-g.w / 2 + g.thickness / 2, (sideY0 + g.d / 2) / 2, g.thickness, sideD, g.thickness, g.thickness + g.railH);
            boxAt(g.w / 2 - g.thickness / 2, (sideY0 + g.d / 2) / 2, g.thickness, sideD, g.thickness, g.thickness + g.railH);
        }
        return out;
    }
    if (kind === "uWall") {
        const g = uWallGeometry(o);
        // コの字（断面）を奥行きへ押し出した形＝屋根が上・左右が側壁。
        // 面は重ならないように分ける（屋根は側壁の上に載せる）。
        // 重ねると半透明の塗りが二重になって濃くなるため。
        boxAt(0, 0, g.w, g.d, g.h - g.thickness, g.h);
        boxAt(-g.w / 2 + g.thickness / 2, 0, g.thickness, g.d, 0, g.h - g.thickness);
        boxAt(g.w / 2 - g.thickness / 2, 0, g.thickness, g.d, 0, g.h - g.thickness);
        return out;
    }
    if (kind === "stall") {
        const g = stallGeometry(o),
            hd = g.d / 2,
            // 奥の壁・左右の壁（奥の壁の手前まで）・カウンター・屋根。
            // どの箱も重ならないので、半透明の塗りが二重になって濃くならない。
            sideD = g.d - g.t,
            sideY = (hd - g.t + -hd) / 2;
        boxAt(0, hd - g.t / 2, g.w, g.t, 0, g.roofBottom);
        boxAt(-g.w / 2 + g.t / 2, sideY, g.t, sideD, 0, g.roofBottom);
        boxAt(g.w / 2 - g.t / 2, sideY, g.t, sideD, 0, g.roofBottom);
        boxAt(0, -hd - g.cd / 2, g.w, g.cd, 0, g.ch);
        // 屋根は前へ張り出すので、中心は奥行き方向に ro/2 だけ手前へずれる。
        boxAt(0, -g.ro / 2, g.w, g.d + g.ro, g.roofBottom, g.h);
        return out;
    }
    if (kind === "railing") {
        const g = railingGeometry(o),
            // 線画（linesRailing）と同じ部材を、同じ寸法で箱にする。
            // 「包絡箱を1枚塗る」だけだと、実際の形の外側（棒と棒の間）まで
            // 塗ってしまうので、部材ごとに分ける。
            zTop0 = Math.max(0, g.h - g.t),
            zBot1 = Math.min(g.h - g.t, g.bottom + g.t),
            footH = Math.min(g.h, Math.min(0.03, Math.max(0.012, g.bottom * 0.35))),
            footW = g.post * 1.5,
            // 横桟は柱の間だけにする（柱と重ねると半透明の塗りが二重になって濃くなる）。
            railLen = (r) => Math.max(0.001, r.len - g.post);
        // 柱（足元の板の上から上端まで）と足元の板（床から足元の板の高さまで）。
        g.posts.forEach(({ x, y }) => {
            boxAt(x, y, g.post, g.post, Math.min(footH, g.h), g.h);
            boxAt(x, y, footW, footW, 0, footH);
        });
        g.runs.forEach((r) => {
            const cx = (r.a[0] + r.b[0]) / 2,
                cy = (r.a[1] + r.b[1]) / 2,
                len = railLen(r),
                bw = r.alongX ? len : g.t,
                bd = r.alongX ? g.t : len;
            boxAt(cx, cy, bw, bd, zTop0, g.h);
            if (zBot1 > g.bottom) boxAt(cx, cy, bw, bd, g.bottom, zBot1);
            if (zTop0 - zBot1 > 0.001)
                r.bars.forEach(([bx, by]) => boxAt(bx, by, g.barT, g.barT, zBot1, zTop0));
        });
        return out;
    }
    if (kind === "stool") {
        const g = stoolGeometry(o),
            // 円柱（座面・脚・台座）を輪で分割して塗る。
            cylinder = (r, z0, z1, n = 20) => {
                for (let i = 0; i < n; i++) {
                    const a0 = (i / n) * Math.PI * 2,
                        a1 = ((i + 1) / n) * Math.PI * 2,
                        x0 = Math.cos(a0) * r,
                        y0 = Math.sin(a0) * r,
                        x1 = Math.cos(a1) * r,
                        y1 = Math.sin(a1) * r;
                    quad([x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1]);
                    tri([0, 0, z1], [x0, y0, z1], [x1, y1, z1]);
                    tri([0, 0, z0], [x1, y1, z0], [x0, y0, z0]);
                }
            };
        cylinder(g.seatR, g.seatBottom, g.h);
        cylinder(g.legR, g.baseTop, g.poleTop, 12);
        cylinder(g.baseR, 0, g.baseH, 16);
        return out;
    }
    if (kind === "awning") {
        const g = awningGeometry(o),
            x = g.w / 2,
            baseY = g.baseFrontY,
            edgeY = g.edgeY,
            backY = g.d / 2;
        quad([-x, edgeY, g.edgeZ], [x, edgeY, g.edgeZ], [x, backY, g.h], [-x, backY, g.h]);
        quad(
            [-x, baseY, g.frontBottom],
            [x, baseY, g.frontBottom],
            [x, backY, g.backBottom],
            [-x, backY, g.backBottom],
        );
        quad([-x, baseY, g.frontBottom], [x, baseY, g.frontBottom], [x, edgeY, g.edgeZ], [-x, edgeY, g.edgeZ]);
        quad([-x, backY, g.backBottom], [x, backY, g.backBottom], [x, backY, g.h], [-x, backY, g.h]);
        quad([-x, baseY, g.frontBottom], [-x, backY, g.backBottom], [-x, backY, g.h], [-x, edgeY, g.edgeZ]);
        quad([x, baseY, g.frontBottom], [x, edgeY, g.edgeZ], [x, backY, g.h], [x, backY, g.backBottom]);
        return out;
    }
    if (kind === "building") {
        // 開口OFFでは面表示も通常の閉じた直方体へ戻す。
        if (o.openingEnabled === false) {
            boxAt(0, 0, w, d, 0, h);
            return out;
        }
        const g = buildingGeometry(o),
            side = Math.max(0.05, (g.w - g.openingW) / 2),
            cx = (g.openingW + side) / 2,
            panelY = g.backY;
        boxAt(-cx, 0, side, g.d, 0, g.h);
        boxAt(cx, 0, side, g.d, 0, g.h);
        boxAt(0, 0, g.w, g.d, g.openingH, g.h);
        // 開口はトンネルではなく、奥側に閉じた内壁を持つ。外側の奥行きと同じ位置へ置く。
        quad(
            [-g.openingW / 2, panelY, 0],
            [g.openingW / 2, panelY, 0],
            [g.openingW / 2, panelY, g.openingH],
            [-g.openingW / 2, panelY, g.openingH],
        );
        return out;
    }
    if (kind === "wallSideSign") {
        const boardW = Math.max(0.05, Math.abs(Number(o.rb) || 0.75) * 2),
            boardH = Math.max(0.05, Math.abs(Number(o.ra) || 0.9) * 2),
            thickness = Math.max(0.02, Math.abs(Number(o.h) || 0.12)),
            count = clamp(Math.round(Number(o.wallSideSignBracketCount) || 0), 0, 3),
            length = clamp(Math.abs(Number(o.wallSideSignBracketLength) || 0.36), 0.05, 5),
            clearance = 0.025,
            span = length + clearance,
            centerY = -(boardW * 0.5 + span * 0.5),
            barV = Math.max(0.06, Math.min(0.18, boardH * 0.1)),
            beveled = o.wallSideSignShape === "beveled",
            bevelOffset = clamp(
                Number(o.wallSideSignBevelOffset) || 0.06,
                0.01,
                Math.max(0.01, Math.min(boardH, boardW) * 0.45),
            ),
            bevelSegments = 4,
            drawBoard = (cx, cy, bw, bd, z0, z1) =>
                beveled ? beveledAt(cx, cy, bw, bd, z0, z1, bevelOffset, bevelSegments) : boxAt(cx, cy, bw, bd, z0, z1);
        // 面表示用も、ベベルは看板本体だけ。取付金具は普通の直方体の面にする。
        drawBoard(0, 0, boardH, boardW, -thickness * 0.5, thickness * 0.5);
        for (let i = 0; i < count; i++) {
            const t = (i + 1) / (count + 1),
                x = -boardH * 0.5 + boardH * t;
            boxAt(x, centerY, barV, span, -thickness * 0.5, thickness * 0.5);
        }
        return out;
    }
    if ((o.type === "rect" || kind === "rect") && !o.extrude) {
        quad([-w / 2, -d / 2, 0], [w / 2, -d / 2, 0], [w / 2, d / 2, 0], [-w / 2, d / 2, 0]);
        return out;
    }
    if (o.type === "rect" || kind === "box" || kind === "sign") {
        addExportBoxFaces(out, o, w, d, kind === "sign" ? h * 0.08 : 0, kind === "sign" ? h * 0.82 : h);
        return out;
    }
    if (o.type === "circ" || kind === "cylinder" || kind === "lantern") {
        cylinder(kind === "lantern" ? h * 0.22 : 0, kind === "lantern" ? h * 0.7 : h, kind === "lantern" ? 12 : 32);
        return out;
    }
    if (kind === "crosswalk") {
        quad([-w / 2, -d / 2, 0.01], [w / 2, -d / 2, 0.01], [w / 2, d / 2, 0.01], [-w / 2, d / 2, 0.01]);
        return out;
    }
    if (kind === "cone") {
        // 底面は中心からの三角形、側面は隣り合う外周頂点と頂点の一枚だけ。
        // 各区間を二重に登録しないので、面ONでも重複・交差する三角面にならない。
        disk(0, 32);
        const apex = [0, 0, h],
            n = 32;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2,
                b = ((i + 1) / n) * Math.PI * 2;
            tri(
                [(w / 2) * Math.cos(a), (d / 2) * Math.sin(a), 0],
                [(w / 2) * Math.cos(b), (d / 2) * Math.sin(b), 0],
                apex,
            );
        }
        return out;
    }
    if (kind === "triPrism") {
        const x = w / 2,
            y = d / 2,
            A = [
                [-x, -y, 0],
                [x, -y, 0],
                [0, -y, h],
            ],
            B = [
                [-x, y, 0],
                [x, y, 0],
                [0, y, h],
            ];
        quad(A[0], A[1], A[2], A[2]);
        quad(B[2], B[1], B[0], B[0]);
        for (let i = 0; i < 3; i++) quad(A[i], B[i], B[(i + 1) % 3], A[(i + 1) % 3]);
        return out;
    }
    if (kind === "triPyramid") {
        const x = w / 2,
            y = d / 2,
            A = [
                [-x, -y, 0],
                [x, -y, 0],
                [0, y, 0],
            ],
            ap = [0, 0, h];
        quad(A[0], A[1], A[2], A[2]);
        for (let i = 0; i < 3; i++) tri(A[i], A[(i + 1) % 3], ap);
        return out;
    }
    if (kind === "sphere") {
        const lat = 12,
            lon = 24;
        for (let j = 0; j < lat; j++) {
            const p0 = -Math.PI / 2 + (j * Math.PI) / lat,
                p1 = -Math.PI / 2 + ((j + 1) * Math.PI) / lat;
            for (let i = 0; i < lon; i++) {
                const a = (i * 2 * Math.PI) / lon,
                    b = ((i + 1) * 2 * Math.PI) / lon;
                const q = (p, t) => [
                    (w / 2) * Math.cos(p) * Math.cos(t),
                    (d / 2) * Math.cos(p) * Math.sin(t),
                    h / 2 + (h / 2) * Math.sin(p),
                ];
                const A = q(p0, a),
                    B = q(p0, b),
                    C = q(p1, b),
                    D = q(p1, a);
                tri(A, B, C);
                tri(A, C, D);
            }
        }
        return out;
    }
    if (kind === "person") {
        // 線画と同じ骨格（asset.js の personPose）から面を作る。
        // 関節を回すと線と面が同じように動く。
        const p = personPose(o),
            h = p.h,
            legR = Math.max(0.012, Math.min(p.legR * 0.9, p.bd * 0.3)),
            prism = (b, tp) => {
                quad(b[0], b[1], b[2], b[3]);
                quad(tp[3], tp[2], tp[1], tp[0]);
                for (let i = 0; i < 4; i++) quad(b[i], tp[i], tp[(i + 1) % 4], b[(i + 1) % 4]);
            };
        // 台座は作らない（線画の linesPerson と同じ扱い）。
        // ここに箱を残していたため、線が消えても面表示では足元に立方体が出ていた。
        // 脚（股関節→膝→足）
        p.legs.forEach((leg) => {
            segment([leg.hip.x, leg.hip.y, leg.hip.z], [leg.knee.x, leg.knee.y, leg.knee.z], legR);
            segment([leg.knee.x, leg.knee.y, leg.knee.z], [leg.foot.x, leg.foot.y, leg.foot.z], legR * 0.92);
        });
        // 胴（腰を支点に傾く四角柱）
        prism(p.torsoBottom, p.torsoTop);
        // 頭（首の角度ぶん傾いた位置へ置く）
        const headCy = (p.headC0.y + p.headC1.y) * 0.5,
            headCz = (p.headC0.z + p.headC1.z) * 0.5,
            headRy = p.headR * 0.9,
            headRz = Math.max(0.02, Math.hypot(p.headC1.y - p.headC0.y, p.headC1.z - p.headC0.z) * 0.5);
        ellipsoid(p.headTopX * 0.5, headCy, headCz, p.headR, headRy, headRz, 8, 12);
        return out;
    }
    if (kind === "stairs") {
        // 階段は段板・蹴上げ・左右側面・底面・最奥面で閉じた実形状にする。
        // 各段の側面を区間ごとの長方形に分けることで、重複面や斜めの包絡箱を作らない。
        const n = Math.max(2, Math.min(24, Math.round(o.steps || 6))),
            sd = d / n,
            sh = h / n,
            x = w / 2;
        for (let i = 0; i < n; i++) {
            const y0 = -d / 2 + i * sd,
                y1 = y0 + sd,
                z = (i + 1) * sh,
                z0 = i * sh;
            // 段板（水平）
            quad([-x, y0, z], [x, y0, z], [x, y1, z], [-x, y1, z]);
            // 蹴上げ（垂直）
            quad([-x, y0, z0], [x, y0, z0], [x, y0, z], [-x, y0, z]);
            // 左右の側面。各区間の下面から段板までを一枚で閉じる。
            quad([-x, y0, 0], [-x, y1, 0], [-x, y1, z], [-x, y0, z]);
            quad([x, y1, 0], [x, y0, 0], [x, y0, z], [x, y1, z]);
        }
        // 底面と最奥の立ち上がり面。
        quad([-x, -d / 2, 0], [x, -d / 2, 0], [x, d / 2, 0], [-x, d / 2, 0]);
        quad([-x, d / 2, 0], [x, d / 2, 0], [x, d / 2, h], [-x, d / 2, h]);
        return out;
    }
    // 屋根・スロープ・窓グリッドは、包絡箱ではなく実際の断面を押し出して面を作る。
    // （箱で近似すると、面表示や背面処理で勾配が消えてしまうため）
    if (
        (kind === "gableRoof" || kind === "shedRoof" || kind === "ramp" || kind === "windowGrid") &&
        typeof roofParams === "function"
    ) {
        // 断面（2つの軸の座標）を、もう1つの軸方向へ ±half 押し出して閉じた立体にする。
        // cross は断面の多角形、axis は押し出す軸（"x" か "y"）。
        const extrudeCross = (cross, axis, half) => {
            const at = (u, z, s) => (axis === "x" ? [s, u, z] : [u, s, z]),
                n = cross.length,
                cu = cross.reduce((a, q) => a + q[0], 0) / n,
                cz = cross.reduce((a, q) => a + q[1], 0) / n;
            // 両端の面は断面を多角形として分割する。
            // 山形の屋根板のように「く」の字に凹んだ断面では、重心からの扇状分割だと
            // 図形の外へはみ出した三角形ができ、線の外側まで色が塗られてしまう。
            // そのため凹みに強い耳切り法（asset.js の polygonEarClip）を使う。
            const tris2d =
                typeof polygonEarClip === "function"
                    ? polygonEarClip(cross.map((q) => [q[0], q[1]]))
                    : (() => {
                          const fan = [];
                          for (let i = 0; i < n; i++) fan.push([[cu, cz], cross[i], cross[(i + 1) % n]]);
                          return fan;
                      })();
            [-half, half].forEach((side) => {
                tris2d.forEach((t) => {
                    if (!t || t.length !== 3) return;
                    tri(at(t[0][0], t[0][1], side), at(t[1][0], t[1][1], side), at(t[2][0], t[2][1], side));
                });
            });
            // 側面は断面の各辺を押し出した四角形。
            for (let i = 0; i < n; i++) {
                const a = cross[i],
                    b = cross[(i + 1) % n];
                quad(at(a[0], a[1], -half), at(b[0], b[1], -half), at(b[0], b[1], half), at(a[0], a[1], half));
            }
        };
        if (kind === "gableRoof" || kind === "shedRoof") {
            // 線画と同じ断面（roofSlab）を使うので、面と線で形がずれない。
            const slab = roofSlab(o, kind);
            extrudeCross(slab.cross, slab.axis, slab.half);
        } else if (kind === "ramp") {
            const p = rampParams(o),
                hw = p.w * 0.5,
                hd = p.d * 0.5;
            // 手前（-y）が床、奥（+y）が立ち上がり上がりの楔。
            extrudeCross(
                [
                    [-hd, 0],
                    [hd, p.h],
                    [hd, 0],
                ],
                "x",
                hw,
            );
        } else {
            const ww = Math.max(0.2, Math.abs(Number(w) || 0.2)),
                hh = Math.max(0.05, Math.abs(Number(h) || 0.2)),
                t = Math.max(0.01, Math.abs(Number(d) || 0.01));
            extrudeCross(
                [
                    [-t * 0.5, 0],
                    [t * 0.5, 0],
                    [t * 0.5, hh],
                    [-t * 0.5, hh],
                ],
                "x",
                ww * 0.5,
            );
        }
        return out;
    }
    // 人物以外の細分化された線画は、全体の包絡箱で背面線を落とす安全側の近似。
    addExportBoxFaces(out, o, w, d, h * 0.02, h);
    return out;
}
function exportPoint(v, tf) {
    const rel = V.add(v, CO()),
        q = scr3(rel);
    if (!q.ok) return null;
    const depth = orthView
        ? dot3(rel, orthBasis().depth)
        : T === "f"
          ? Math.hypot(rel[0], rel[1], rel[2])
          : cam(rel)[2];
    return { x: q.x * tf[0] + tf[4], y: q.y * tf[3] + tf[5], depth };
}
// 画面座標と深度を「1回の投影」でまとめて求める。
// 以前は strokeWVisible が同じ点を scr3() と exportPoint() で2回投影していた
// （どちらも cam() を通るため、線の点数が多いほど無駄が大きかった）。
function projPoint(v, tf) {
    const rel = V.add(v, CO());
    if (orthView) {
        const q = orthPoint(rel);
        return { x: q.x * tf[0] + tf[4], y: q.y * tf[3] + tf[5], sx: q.x, sy: q.y, depth: q.depth, ok: true };
    }
    const c = cam(rel),
        len = Math.hypot(c[0], c[1], c[2]);
    if (!(len > 1e-9)) return { ok: false };
    const u = [c[0] / len, c[1] / len, c[2] / len],
        f = (W * P.lens) / 36;
    if (T === "f") {
        // 魚眼は向きだけを使う（scr3()→scr()→pf() と同じ計算）。
        const q = pf(u);
        return q.ok ? { x: q.x * tf[0] + tf[4], y: q.y * tf[3] + tf[5], sx: q.x, sy: q.y, depth: len, ok: true } : { ok: false };
    }
    if (u[2] <= 0.02) return { ok: false };
    const x = W / 2 + (f * u[0]) / u[2],
        y = (H * P.hz) / 100 - (f * u[1]) / u[2];
    return { x: x * tf[0] + tf[4], y: y * tf[3] + tf[5], sx: x, sy: y, depth: c[2], ok: true };
}
// 深度バッファは毎フレーム作り直さず、同じ大きさなら使い回す。
// さらに「前回書き込んだ行」だけを Infinity へ戻す（全面fillは毎回 canvas 全体＝
// 100万要素以上を書き直すことになり、その割に実際に使う行はごく一部だった）。
let depthBuffer = null,
    // 面の「持ち主」（どのオブジェクトの面が最深か）を持つ配列。
    // 線が自分の面の上にちょうど乗っている場合（稜線と面）を見分けるために使う。
    // これが無いと、同一平面上の稜線が面の奥行きと僅かに食い違って
    // 点線状に欠ける（＝重なった面の隠線が透ける）ことがある。
    depthOwner = null,
    depthOwnerMap = new Map(),
    depthBufferLen = 0,
    depthUsedY0 = Infinity,
    depthUsedY1 = -Infinity,
    depthKey = null;
// 深度バッファは「大きさ・変換・カメラ・オブジェクトの中身」が同じなら作り直さない。
// 面を選び直しただけ・ハンドルに触れただけの描き直しでは、この計算（実測20ms前後）が丸ごと省ける。
// キー作りは JSON.stringify 30個で 0.04ms 程度なので、毎回作っても十分安い。
function exportDepthKey(cw, ch, tf, seen) {
    let key = cw + "," + ch + "," + (tf ? tf.join(",") : "") + "," + sigNow() + "," + JSON.stringify(P) + "|";
    S.forEach((s) => {
        const o = s && s.ob;
        if (!o || !objectVisible(o) || seen.has(o.id)) return;
        seen.add(o.id);
        key += JSON.stringify(o) + ";";
    });
    return key;
}
// 面の奥行きをバッファへ塗る本体。buildExportDepth から呼ぶ。
// buf / own へ書き込み、実際に塗った行の範囲を used（{y0,y1}）へ返す。
// 次のフレームで消す行をその範囲だけに絞るために使う。
function rasterizeDepthInto(buf, own, ownerMap, list, cw, ch, tf, used) {
    // 三角形を深度バッファへ書く。走査線（スキャンライン）方式で塗る。
    // 以前は外接矩形の全画素で重心座標を3つずつ計算していたため、
    // 面の多いシーン（30個・2,580三角形）で1フレーム400ms近くかかっていた。
    //   ・行ごとに三角形の左右の端（xL / xR）を辺との交点から出す
    //   ・重心座標は行の中で x の1次式なので、開始値＋増分の足し算で済ませる
    //   ・画面外の三角形は外接矩形の段階で捨てる
    const putTri = (tr, owner) => {
        const p0 = exportPoint(tr[0], tf),
            p1 = exportPoint(tr[1], tf),
            p2 = exportPoint(tr[2], tf);
        if (
            !p0 || !p1 || !p2 ||
            !Number.isFinite(p0.depth) || !Number.isFinite(p1.depth) || !Number.isFinite(p2.depth) ||
            p0.depth < -0.001 || p1.depth < -0.001 || p2.depth < -0.001
        )
            return;
        const area = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
        if (Math.abs(area) < 0.001) return;
        const minY = Math.min(p0.y, p1.y, p2.y),
            maxY = Math.max(p0.y, p1.y, p2.y),
            minX = Math.min(p0.x, p1.x, p2.x),
            maxX = Math.max(p0.x, p1.x, p2.x);
        // 画面の外は捨てる（上下どちらか外れていれば描く画素が無い）
        if (maxY < 0 || minY > ch || minX > cw || maxX < 0) return;
        // 先に「この三角形は既に手前の面で覆われている」かを粗く調べる（早期Z）。
        // ビューポート内に格子状に点を取って、どの点も既存の面より奥なら塗る必要が無い。
        // 奥にある箱・裏を向いた面の多くがここで落ちるので、塗る量が大きく減る。
        if (!window.__noEarlyZ) {
            const near = Math.min(p0.depth, p1.depth, p2.depth),
                bx0 = Math.max(0, Math.floor(minX)),
                bx1 = Math.min(cw - 1, Math.ceil(maxX)),
                by0 = Math.max(0, Math.floor(minY)),
                by1 = Math.min(ch - 1, Math.ceil(maxY));
            if (bx1 > bx0 && by1 > by0) {
                let covered = true;
                const GN = 6;
                for (let g = 0; g < GN && covered; g++) {
                    const yy = by0 + ((by1 - by0) * (g + 0.5)) / GN;
                    const row = Math.floor(yy) * cw;
                    for (let h = 0; h < GN; h++) {
                        const xx = Math.floor(bx0 + ((bx1 - bx0) * (h + 0.5)) / GN);
                        if (!(buf[row + xx] < near - 0.02)) {
                            covered = false;
                            break;
                        }
                    }
                }
                if (covered) return;
            }
        }
        const y0 = Math.max(0, Math.floor(minY)),
            y1 = Math.min(ch - 1, Math.ceil(maxY));
        if (y1 < y0) return;
        if (y0 < used.y0) used.y0 = y0;
        if (y1 > used.y1) used.y1 = y1;
        const d0 = -(p1.y - p0.y) / area, // 重心座標の x 方向の増分
            d1 = -(p2.y - p1.y) / area,
            d2 = -(p0.y - p2.y) / area;
        for (let y = y0; y <= y1; y++) {
            const py = y + 0.5;
            // この行と三角形の辺が交わる x の最小・最大を求める
            let xL = Infinity,
                xR = -Infinity;
            for (let e = 0; e < 3; e++) {
                const a = e === 0 ? p0 : e === 1 ? p1 : p2,
                    b = e === 0 ? p1 : e === 1 ? p2 : p0;
                if ((a.y <= py && b.y >= py) || (b.y <= py && a.y >= py)) {
                    const px =
                        Math.abs(b.y - a.y) < 1e-9
                            ? Math.min(a.x, b.x)
                            : a.x + ((b.x - a.x) * (py - a.y)) / (b.y - a.y);
                    if (px < xL) xL = px;
                    if (b.y === a.y) {
                        // 水平な辺は行全体を覆うので、両端を候補にする
                        const px2 = Math.max(a.x, b.x);
                        if (px2 > xR) xR = px2;
                    }
                    if (px > xR) xR = px;
                }
            }
            if (!(xR >= xL)) continue;
            const xa = Math.max(0, Math.ceil(xL - 0.5)),
                xb = Math.min(cw - 1, Math.floor(xR - 0.5));
            if (xb < xa) continue;
            const px0 = xa + 0.5;
            let w0 = ((p1.x - p0.x) * (py - p0.y) - (p1.y - p0.y) * (px0 - p0.x)) / area,
                w1 = ((p2.x - p1.x) * (py - p1.y) - (p2.y - p1.y) * (px0 - p1.x)) / area,
                w2 = ((p0.x - p2.x) * (py - p2.y) - (p0.y - p2.y) * (px0 - p2.x)) / area,
                idx = y * cw + xa;
            for (let x = xa; x <= xb; x++, idx++, w0 += d0, w1 += d1, w2 += d2) {
                // 重心座標は和が必ず1なので「全部が -1e-5 未満」になることはない（＝内側の判定はこれだけで足りる）
                if (w0 >= -1e-5 && w1 >= -1e-5 && w2 >= -1e-5) {
                    const z = p0.depth * w1 + p1.depth * w2 + p2.depth * w0;
                    if (z < buf[idx]) {
                        buf[idx] = z;
                        if (own) own[idx] = owner;
                    }
                }
            }
        }
    };
    for (let i = 0; i < list.length; i++) {
        const o = list[i],
            tris = surfaceTriangles(o);
        if (!tris.length) continue;
        const owner = ownerMap.get(o.id) || 0;
        for (let i2 = 0; i2 < tris.length; i2++) putTri(tris[i2], owner);
    }
}
// 直前のフレームの「オブジェクトごとの内容」と、静止分キャッシュ。
// 1台だけ動いているとき（＝ドラッグ中）は、その1台を除いた面の奥行きを
// そのまま使い回し、動いた1台の面だけを塗り直す（dirty rect）。
// 全面を作り直すと実測 11〜21ms かかるが、この経路は 2〜4ms で済む。
let depthLast = null, // { ctxKey, ids, sigs }
    depthStatic = null, // { key, len, buf, owner, y0, y1 }
    depthMovingUsedY0 = Infinity,
    depthMovingUsedY1 = -Infinity;
function buildExportDepth(cw, ch, tf) {
    const need = cw * ch,
        // カメラ・用紙・書き出し変換・設定（P）が同じなら、オブジェクトの
        // 中身が変わったかどうかだけを見ればよい。
        ctxKey = cw + "," + ch + "," + (tf ? tf.join(",") : "") + "," + sigNow() + "," + JSON.stringify(P),
        objs = [],
        seen = new Set();
    S.forEach((s) => {
        const o = s && s.ob;
        if (!o || !objectVisible(o) || seen.has(o.id)) return;
        seen.add(o.id);
        objs.push(o);
    });
    const ids = objs.map((o) => o.id),
        sigs = objs.map((o) => JSON.stringify(o)),
        key = ctxKey + "|" + sigs.join(";");
    if (!window.__noDepthCache && depthKey === key && depthBuffer && depthBufferLen === need) {
        window.__depthPath = "cache";
        return depthBuffer;
    }
    const needAlloc = !depthBuffer || depthBufferLen !== need;
    if (needAlloc) {
        depthBuffer = new Float32Array(need);
        depthOwner = new Int32Array(need);
        depthBufferLen = need;
        // Float32Array の初期値は 0（＝いちばん手前）なので、そのままだと
        // 作った直後の1フレームだけ「面の外の線がすべて隠れる」。必ず無限遠で埋める。
        depthBuffer.fill(Infinity);
        depthUsedY0 = Infinity;
        depthUsedY1 = -Infinity;
        depthStatic = null;
    }
    const depth = depthBuffer;
    // 面の持ち主の番号は「このフレームの並び順」で決める（静止分と動いた分で
    // 番号がずれると、自分の面の稜線かどうかの判定が食い違う）。
    const ownerMap = new Map();
    objs.forEach((o) => ownerMap.set(o.id, ownerMap.size + 1));
    // 1台だけ変わったか調べる（オブジェクトが増減したときは対象外）。
    let movingIdx = -1;
    if (
        !window.__noDirtyDepth &&
        depthLast &&
        depthLast.ctxKey === ctxKey &&
        depthLast.ids.length === ids.length
    ) {
        let diff = -1,
            same = true;
        for (let i = 0; i < ids.length; i++) {
            if (depthLast.ids[i] !== ids[i]) {
                same = false;
                break;
            }
            if (depthLast.sigs[i] !== sigs[i]) {
                if (diff >= 0) {
                    same = false;
                    break;
                }
                diff = i;
            }
        }
        if (same && diff >= 0) movingIdx = diff;
    }
    if (movingIdx >= 0) {
        const moving = objs[movingIdx],
            staticKey = ctxKey + "|static|" + sigs.filter((_, i) => i !== movingIdx).join(";");
        if (!depthStatic || depthStatic.key !== staticKey || depthStatic.len !== need) {
            // バッファは使い回す（毎回 5MB×2 を新しく確保すると、
            // その1フレームだけドラッグの出だしが重くなる）。
            const reuse = depthStatic && depthStatic.len === need;
            const st = {
                key: staticKey,
                len: need,
                buf: reuse ? depthStatic.buf : new Float32Array(need),
                owner: reuse ? depthStatic.owner : new Int32Array(need),
                y0: Infinity,
                y1: -Infinity,
            };
            st.buf.fill(Infinity);
            st.owner.fill(0);
            rasterizeDepthInto(
                st.buf,
                st.owner,
                ownerMap,
                objs.filter((_, i) => i !== movingIdx),
                cw,
                ch,
                tf,
                st,
            );
            depthStatic = st;
        }
        // 1) 前フレームで動いていた1台が塗った行を消し、
        // 2) 静止分をそこへ貼り直し、3) 動いた1台を塗り直す。
        // 全面 fill（100万要素）を避け、必要な行だけを触る。
        const clr0 = Math.max(0, Math.min(depthMovingUsedY0, depthStatic.y0)),
            clr1 = Math.min(ch - 1, Math.max(depthMovingUsedY1, depthStatic.y1));
        if (clr1 >= clr0 && Number.isFinite(clr0)) {
            depth.fill(Infinity, clr0 * cw, (clr1 + 1) * cw);
            depthOwner.fill(0, clr0 * cw, (clr1 + 1) * cw);
        }
        if (depthStatic.y1 >= depthStatic.y0) {
            const sy0 = Math.max(0, Math.floor(depthStatic.y0)),
                sy1 = Math.min(ch - 1, Math.ceil(depthStatic.y1));
            depth.set(depthStatic.buf.subarray(sy0 * cw, (sy1 + 1) * cw), sy0 * cw);
            depthOwner.set(depthStatic.owner.subarray(sy0 * cw, (sy1 + 1) * cw), sy0 * cw);
        }
        const used = { y0: Infinity, y1: -Infinity };
        rasterizeDepthInto(depth, depthOwner, ownerMap, [moving], cw, ch, tf, used);
        depthMovingUsedY0 = used.y0;
        depthMovingUsedY1 = used.y1;
        depthUsedY0 = Math.min(depthStatic.y0, Number.isFinite(used.y0) ? used.y0 : Infinity);
        depthUsedY1 = Math.max(depthStatic.y1, Number.isFinite(used.y1) ? used.y1 : -Infinity);
        depthOwnerMap = ownerMap;
        depthKey = key;
        depthLast = { ctxKey, ids, sigs };
        window.__depthPath = "dirty";
        return depth;
    }
    // 全面を作り直す（通常の経路）。
    if (depthUsedY1 >= depthUsedY0) {
        const ry0 = Math.max(0, depthUsedY0) * cw,
            ry1 = Math.min(ch, depthUsedY1 + 1) * cw;
        depth.fill(Infinity, ry0, ry1);
        if (depthOwner) depthOwner.fill(0, ry0, ry1);
    }
    depthUsedY0 = Infinity;
    depthUsedY1 = -Infinity;
    depthMovingUsedY0 = Infinity;
    depthMovingUsedY1 = -Infinity;
    const used = { y0: Infinity, y1: -Infinity };
    rasterizeDepthInto(depth, depthOwner, ownerMap, objs, cw, ch, tf, used);
    depthUsedY0 = used.y0;
    depthUsedY1 = used.y1;
    depthOwnerMap = ownerMap;
    depthKey = key;
    depthLast = { ctxKey, ids, sigs };
    window.__depthPath = "full";
    return depth;
}
// 「自分の面に乗っている稜線」とみなす奥行きの差（m）。
// 深度バッファは画素ごとの補間なので、面の上の線は数mmずれる。
const SELF_EDGE_EPS = 0.02;
// 面と面が接していると見なす距離（m）。これより奥の線は近くの画素を見ずに隠す。
const CONTACT_REACH = 0.05;
// 面と面が接している線（壁の下端と台の上面など）は、面をほぼ真横から見ているため
// 1画素の中でも奥行きが大きく変わる。中心の画素だけで判定すると点線状に欠けるので、
// 近くの画素の奥行きの「ばらつき」も見て判定する（真横に近い面ほど許容を広げる）。
function nearVisible(depth, cw, ch, x, y, d) {
    const eps = CG.depthEps(d);
    let zmin = Infinity,
        zmax = -Infinity;
    for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= ch) continue;
        const row = yy * cw;
        for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= cw) continue;
            const v = depth[row + xx];
            if (v < zmin) zmin = v;
            if (v > zmax) zmax = v;
        }
    }
    // 近くに「線より奥」の面が無ければ、その線は面の外（背景）にある＝描く。
    if (!(zmax >= d - eps)) return false;
    // 面を真横から見ている（近くの画素で奥行きが大きく違う）ときは、
    // ばらつきの 3/4 までを「面の上に乗っている」と見なす。上限 25cm。
    const tol = Math.min(0.25, Math.max(eps, (zmax - zmin) * 0.75));
    return d <= zmin + tol;
}
function strokeWVisible(c, s, depth, cw, ch, tf) {
    if (!s.ob || !s.d3) {
        strokeW(c, s);
        return;
    }
    c.strokeStyle = s.c;
    c.lineWidth = effectiveLineWidth(s);
    c.lineCap = c.lineJoin = "round";
    c.beginPath();
    let on = false;
    const myOwner = depthOwnerMap.get(s.ob.id) || 0;
    const okx = tf[0] || 1,
        oky = tf[3] || 1;
    // 画面座標・奥行き・（必要なら近くの画素）から、この点を描いてよいか決める。
    const accept = (e) => {
        const x = Math.round(e.x),
            y = Math.round(e.y);
        if (x < 0 || x >= cw || y < 0 || y >= ch) return false;
        const i1 = y * cw + x,
            z = depth[i1];
        if (!(e.depth > z + CG.depthEps(e.depth))) return true;
        // その画素の面が「この線の持ち主」で、奥行きがほぼ同じなら、
        // その線は自分の面の稜線（面と面の取り合い）なので描く。
        const own = depthOwner && depthOwner[i1];
        if (own && own === myOwner && e.depth <= z + SELF_EDGE_EPS) return true;
        // 面と面が接している線は、面をほぼ真横から見ているため1画素でも奥行きが
        // 大きく変わる。近くの画素に「線より奥」の面があれば描く。
        return nearVisible(depth, cw, ch, x, y, e.depth);
    };
    const emit = (e) => {
        if (!e.ok || !accept(e)) {
            on = false;
            return;
        }
        on ? c.lineTo(e.sx, e.sy) : c.moveTo(e.sx, e.sy);
        on = true;
    };
    const put = (v) => emit(projPoint(v, tf));
    // 直線は透視投影でも画面上では直線になるので、区間の内部は
    // 両端の投影結果から補間できる（奥行きは 1/奥行き が画面内で1次）。
    // 以前は区間の各点を毎回投影していたため、細かく刻むほど遅くなっていた。
    const lerpFlag = !orthView && T !== "f";
    // 投影は点ごとに1回だけ（以前は区間の両端でもう一度投影していた）。
    const pj = new Array(s.p.length);
    for (let i = 0; i < s.p.length; i++) pj[i] = projPoint(s.p[i], tf);
    s.p.forEach((v, i) => {
        if (i) {
            const a = s.p[i - 1];
            // 同じ線分を2回描かない（印は genShape が付けている）。
            if (s.dup && s.dup[i - 1]) on = false;
            else {
                const ea = pj[i - 1],
                    eb = pj[i];
                if (lerpFlag && ea.ok && eb.ok && ea.depth > 1e-6 && eb.depth > 1e-6) {
                    const len = Math.hypot(eb.x - ea.x, eb.y - ea.y),
                        ia = 1 / ea.depth,
                        ib = 1 / eb.depth,
                        // t の位置の点（画面座標・奥行き）を作る。
                        at = (t) => {
                            const x = ea.x + (eb.x - ea.x) * t,
                                y = ea.y + (eb.y - ea.y) * t;
                            return {
                                ok: true,
                                x,
                                y,
                                sx: (x - tf[4]) / okx,
                                sy: (y - tf[5]) / oky,
                                depth: 1 / (ia + (ib - ia) * t),
                            };
                        };
                    // まず粗く調べる。区間ぜんぶが同じ状態（見える／隠れる）なら
                    // 細かく刻む必要はないので、そのまま1本の線として引く。
                    const nc = Math.min(16, Math.max(1, Math.ceil(len / 24)));
                    let uniform = true;
                    for (let j = 1; j < nc; j++)
                        if (!accept(at(j / nc))) {
                            uniform = false;
                            break;
                        }
                    if (!uniform) {
                        // 遮蔽物との境目がある区間だけ、細かく刻んで切る位置を合わせる。
                        // ドラッグ中は刻みを粗くして、操作中の描画を軽くする
                        // （操作が終われば次の描画で細かい刻みに戻る）。
                        const step = typeof ed !== "undefined" && ed ? 20 : 6;
                        const n = Math.min(48, Math.max(1, Math.ceil(len / step)));
                        for (let j = 1; j < n; j++) emit(at(j / n));
                    }
                } else {
                    const n = Math.max(1, Math.ceil(Math.hypot(v[0] - a[0], v[1] - a[1], v[2] - a[2]) * 10));
                    for (let j = 1; j < n; j++) put(V.add(a, v, 1 - j / n, j / n));
                }
            }
        }
        emit(pj[i]);
    });
    c.stroke();
}

// ===== 5. 線画レイヤー：線だけ別キャンバスに描き、アンチエイリアスを消して二値化する =====
let LC = null;
// 書き出し用の線だけを別キャンバスへ描く。
// hidden=trueでは面の深度情報を使って、背面に隠れる線を除去する。
// 実際に線を引いた範囲（デバイスpx）。二値化の対象を絞るために使う。
// 線が1本も無ければ null。
function strokeBox(cw, ch, tf) {
    let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
    const add = (e) => {
        if (!e.ok) return;
        if (e.x < x0) x0 = e.x;
        if (e.y < y0) y0 = e.y;
        if (e.x > x1) x1 = e.x;
        if (e.y > y1) y1 = e.y;
    };
    S.forEach((s) => {
        if (s.ob && !objectVisible(s.ob)) return;
        for (let i = 0; i < s.p.length; i++) add(projPoint(s.p[i], tf));
    });
    if (prev) prev.forEach((s) => { for (let i = 0; i < s.p.length; i++) add(projPoint(s.p[i], tf)); });
    if (!(x1 >= x0 && y1 >= y0)) return null;
    const pad = 3,
        bx = Math.max(0, Math.floor(x0) - pad),
        by = Math.max(0, Math.floor(y0) - pad),
        bx1 = Math.min(cw, Math.ceil(x1) + pad),
        by1 = Math.min(ch, Math.ceil(y1) + pad);
    if (bx1 <= bx || by1 <= by) return null;
    return { x: bx, y: by, w: bx1 - bx, h: by1 - by };
}
function lineLayer(view, withCur, cw = W, ch = H, tf = null, hidden = false) {
    // tf=書き出し用の変換 [拡大,0,0,拡大,ずれx,ずれy]
    if (!LC || LC.width !== cw || LC.height !== ch) {
        LC = document.createElement("canvas");
        LC.width = cw;
        LC.height = ch;
    }
    const x = LC.getContext("2d", { willReadFrequently: true });
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, cw, ch);
    if (tf) x.setTransform(...tf);
    else if (view) x.setTransform(Z, 0, 0, Z, ox, oy); // 画面表示用はズーム・移動つき
    const hiddenDepth = hidden ? buildExportDepth(cw, ch, tf || [1, 0, 0, 1, 0, 0]) : null;
    S.forEach((s) => {
        if (s.ob && !objectVisible(s.ob)) return;
        hidden ? strokeWVisible(x, s, hiddenDepth, cw, ch, tf || [1, 0, 0, 1, 0, 0]) : strokeW(x, s);
    });
    if (withCur) drawCur(x);
    if (withCur && prev) prev.forEach((s) => strokeW(x, s));
    if ($("bin").checked) {
        // 二値化：しきい値以上の画素だけ完全に不透明にする。
        // 以前は毎フレーム canvas 全体（例 1600×900＝144万画素）を読み書きしていた。
        // 実際に線がある範囲だけを処理すれば同じ結果で、はるかに軽い。
        x.setTransform(1, 0, 0, 1, 0, 0);
        const box = strokeBox(cw, ch, tf || [Z, 0, 0, Z, ox, oy]);
        if (box) {
            const im = x.getImageData(box.x, box.y, box.w, box.h),
                d = im.data,
                t = P.bt;
            for (let i = 3; i < d.length; i += 4) d[i] = d[i] < t ? 0 : 255;
            x.putImageData(im, box.x, box.y);
        }
    }
    return LC;
}

// ===== 6. 地面のグリッド：床(y=-1)の格子。カメラの高さ・位置・向きを変えるとちゃんと見え方が変わる =====
function floorGrid(c) {
    const n = Math.round(P.gn),
        cell = P.gs,
        ext = n * cell,
        co = CO(),
        steps = Math.min(400, n * 8);
    c.save();
    c.lineJoin = "round";
    const line = (a, b) => {
        let on = false; // 線を細かく区切って投影する（魚眼でも曲がって見える）
        for (let i = 0; i <= steps; i++) {
            const t = i / steps,
                q = scr3(V.add([a[0] + (b[0] - a[0]) * t, -1, a[2] + (b[2] - a[2]) * t], co));
            if (!q.ok) {
                on = false;
                continue;
            }
            on ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y);
            on = true;
        }
    };
    const pass = (sel, col, alpha, w) => {
        c.strokeStyle = col;
        c.globalAlpha = alpha;
        c.lineWidth = w;
        c.beginPath();
        for (let k = -n; k <= n; k++)
            if (sel(k)) {
                line([k * cell, -1, -ext], [k * cell, -1, ext]);
                line([-ext, -1, k * cell], [ext, -1, k * cell]);
            }
        c.stroke();
    };
    pass((k) => k % 5 !== 0, "#7d8279", P.ga * 0.55, P.gw); // ふつうの線
    pass((k) => k % 5 === 0 && k !== 0, "#7d8279", Math.min(1, P.ga * 1.1), P.gw * 1.6); // 5マスごとの太い線
    c.lineWidth = P.gw * 2.4;
    c.globalAlpha = Math.min(1, P.ga * 1.3); // 原点を通る線（X=橙・Z=緑）
    c.strokeStyle = "#e8743d";
    c.beginPath();
    line([-ext, -1, 0], [ext, -1, 0]);
    c.stroke();
    c.strokeStyle = "#2fb5a5";
    c.beginPath();
    line([0, -1, -ext], [0, -1, ext]);
    c.stroke();
    c.restore();
}

// 正投影ビューの補助線。消失点はなく、軸に沿った水平・垂直線として表示する。
function orthGuides(c) {
    const sc = orthScale(),
        col = ["#e8743d", "#2fb5a5", "#4a7be8"];
    c.save();
    c.globalAlpha = P.ga;
    c.lineWidth = P.gw;
    c.setLineDash([]);
    const draw = (x0, y0, x1, y1, color) => {
        c.strokeStyle = color;
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x1, y1);
        c.stroke();
    };
    const b = orthBasis();
    if (orthView === "top") {
        for (let i = -20; i <= 20; i++) {
            const x = W / 2 + i * sc;
            draw(x, 0, x, H, col[0]);
            const y = H / 2 + i * sc;
            draw(0, y, W, y, col[2]);
        }
    } else {
        for (let i = -20; i <= 20; i++) {
            const x = W / 2 + i * sc;
            draw(x, 0, x, H, col[orthView === "front" ? 0 : 1]);
            const y = H / 2 + i * sc;
            draw(0, y, W, y, col[2]);
        }
    }
    c.restore();
}

// ===== 7. 補助線（キャンバスに入る角度範囲にだけ本数を割り振る＝密に出来る） =====
function guides(c) {
    const col = ["#e8743d", "#2fb5a5", "#4a7be8"],
        diag = Math.hypot(W, H),
        n = P.n;
    AX.forEach((A, i) => {
        if (!show[i]) return;
        c.strokeStyle = col[i];
        c.globalAlpha = P.ga;
        c.lineWidth = P.gw;
        c.beginPath();
        if (A.vp) {
            const { x, y } = A.vp,
                inside = x >= 0 && x <= W && y >= 0 && y <= H,
                L = Math.hypot(x - W / 2, y - H / 2) + diag;
            let base = 0,
                lo = 0,
                hi = 0;
            if (!inside) {
                // 4隅への角度の最小〜最大を求める
                base = Math.atan2(H / 2 - y, W / 2 - x);
                lo = 1e9;
                hi = -1e9;
                for (const [px, py] of [
                    [0, 0],
                    [W, 0],
                    [0, H],
                    [W, H],
                ]) {
                    let d = Math.atan2(py - y, px - x) - base;
                    d = Math.atan2(Math.sin(d), Math.cos(d));
                    lo = Math.min(lo, d);
                    hi = Math.max(hi, d);
                }
            }
            for (let k = 0; k < n; k++) {
                const t = inside ? (2 * Math.PI * k) / n : base + lo + ((hi - lo) * k) / (n - 1);
                c.moveTo(x, y);
                c.lineTo(x + L * Math.cos(t), y + L * Math.sin(t));
            }
        } else {
            // 平行線（水平・垂直）
            const u = A.dir,
                nx = -u.y,
                ny = u.x;
            let lo = 1e9,
                hi = -1e9;
            for (const [px, py] of [
                [0, 0],
                [W, 0],
                [0, H],
                [W, H],
            ]) {
                const s = px * nx + py * ny;
                lo = Math.min(lo, s);
                hi = Math.max(hi, s);
            }
            for (let k = 0; k < n; k++) {
                const s = lo + ((hi - lo) * k) / (n - 1),
                    px = nx * s,
                    py = ny * s;
                c.moveTo(px - u.x * 2 * diag, py - u.y * 2 * diag);
                c.lineTo(px + u.x * 2 * diag, py + u.y * 2 * diag);
            }
        }
        c.stroke();
    });
    c.globalAlpha = 1;
}

// ===== 8. 描画 =====
function stroke(c, s) {
    c.strokeStyle = s.c;
    c.lineWidth = effectiveLineWidth(s);
    c.lineCap = c.lineJoin = "round";
    c.beginPath();
    c.moveTo(s.p[0].x, s.p[0].y);
    for (let i = 1; i < s.p.length; i++) c.lineTo(s.p[i].x, s.p[i].y);
    c.stroke();
}
// 画像全体の面表示。surfaceMode=trueのとき、すべてのオブジェクトを半透明で塗る。
// 面の三角形は既存の背面線除去用メッシュ定義を共有するので、線画と形状がずれない。
function surfaceColor(o) {
    return o.surfaceColor || o.accent || "#66e3c8";
}
function surfaceAlpha(o) {
    const v = Number(o.surfaceAlpha);
    return Number.isFinite(v) ? clamp(v, 0.04, 0.9) : 0.22;
}
// 面表示を「1回だけ半透明で重ねる」ためのオフスクリーン。
// 三角形を1枚ずつ半透明で塗ると、同じオブジェクトの面が重なる場所だけ
// 透明度が積み上がって乗算したように濃くなる（開口の奥の壁・柱の裏など）。
// そこで不透明度ごとに1枚の層へ不透明で描き、最後にまとめて1回だけ合成する。
let surfaceLayerCanvas = null;
function surfaceLayerCanvasFor(w, h) {
    // 毎フレーム大きさが変わると再確保が続くので、64px 単位に丸めて使い回す。
    const step = 64,
        cw = Math.max(step, Math.ceil(w / step) * step),
        ch = Math.max(step, Math.ceil(h / step) * step);
    if (!surfaceLayerCanvas) surfaceLayerCanvas = document.createElement("canvas");
    if (surfaceLayerCanvas.width !== cw || surfaceLayerCanvas.height !== ch) {
        surfaceLayerCanvas.width = cw;
        surfaceLayerCanvas.height = ch;
    }
    return surfaceLayerCanvas;
}
// 面描画用の投影器を作る。
// 従来は1頂点ごとに V.add() → V.nrm() → scr() → exportPoint() と配列を4個作り、
// 三角関数もその都度計算していた（140オブジェクトで毎フレーム約17万個の配列）。
// ここではカメラの三角関数と係数を1回だけ求め、使い回しの点へ書き込む。
// 戻り値が null のとき（魚眼）は従来の exportPoint() 経路を使う。
function surfaceProjector() {
    const cx = -P.cx,
        cy = 1 - P.ch,
        cz = -P.cz;
    if (orthView) {
        const s = orthSetup(),
            r = s.right,
            u = s.up,
            dp = s.depth,
            sc = s.sc,
            ax = s.ax,
            ay = s.ay;
        return (v, out) => {
            const x = v[0] + cx,
                y = v[1] + cy,
                z = v[2] + cz;
            out.x = ax + (x * r[0] + y * r[1] + z * r[2]) * sc;
            out.y = ay - (x * u[0] + y * u[1] + z * u[2]) * sc;
            out.depth = x * dp[0] + y * dp[1] + z * dp[2];
            return true;
        };
    }
    if (T === "f") return null;
    const cth = Math.cos(P.yaw * DG),
        sth = Math.sin(P.yaw * DG),
        cph = Math.cos(P.pitch * DG),
        sph = Math.sin(P.pitch * DG),
        f = (W * P.lens) / 36,
        hx = W / 2,
        hy = (H * P.hz) / 100;
    return (v, out) => {
        const x = v[0] + cx,
            y = v[1] + cy,
            z = v[2] + cz,
            x1 = x * cth + z * sth,
            z1 = -x * sth + z * cth,
            y2 = y * cph - z1 * sph,
            z2 = y * sph + z1 * cph;
        if (z2 <= 0.02) return false;
        out.x = hx + (f * x1) / z2;
        out.y = hy - (f * y2) / z2;
        out.depth = z2;
        return true;
    };
}
// 面描画用の使い回しの点（毎フレームのオブジェクト生成を避ける）。
const SURF_IDENT = [1, 0, 0, 1, 0, 0],
    SURF_P0 = { x: 0, y: 0, depth: 0 },
    SURF_P1 = { x: 0, y: 0, depth: 0 },
    SURF_P2 = { x: 0, y: 0, depth: 0 },
    // 画面上 0.3px² 未満の三角形は塗っても見えないので捨てる。
    SURF_MIN_AREA = 0.3,
    // 継ぎ目隠しの縁取りは、画面上 4px² 以上の三角形だけに絞る。
    // 小さい三角形は縁取りしても継ぎ目が画素に埋もれるため、描くだけ無駄になる。
    SURF_STROKE_AREA = 4,
    // 画面外の三角形を捨てる余白（px）。
    SURF_CULL_PAD = 8;
function drawObjectSurfaces(c) {
    if (!P.surfaceMode) return;
    const proj = surfaceProjector(),
        tris = [],
        seen = new Set();
    S.forEach((s) => {
        const o = s && s.ob;
        if (!o || !objectVisible(o) || seen.has(o.id)) return;
        seen.add(o.id);
        const list = surfaceTriangles(o);
        if (!list.length) return;
        // 色と不透明度はオブジェクトごとに1回だけ求める。
        // 従来は三角形ごとに surfaceColor() / surfaceAlpha().toFixed(3) を呼んでいた。
        const color = surfaceColor(o),
            alpha = Number(surfaceAlpha(o).toFixed(3));
        for (let i = 0; i < list.length; i++) {
            const tr = list[i];
            let a, b, e;
            if (proj) {
                if (!proj(tr[0], SURF_P0) || !proj(tr[1], SURF_P1) || !proj(tr[2], SURF_P2)) continue;
                a = SURF_P0;
                b = SURF_P1;
                e = SURF_P2;
            } else {
                a = exportPoint(tr[0], SURF_IDENT);
                b = exportPoint(tr[1], SURF_IDENT);
                e = exportPoint(tr[2], SURF_IDENT);
                if (!a || !b || !e) continue;
            }
            // 画面の外に丸ごと出ている三角形は塗らない。
            if (
                (a.x < -SURF_CULL_PAD && b.x < -SURF_CULL_PAD && e.x < -SURF_CULL_PAD) ||
                (a.x > W + SURF_CULL_PAD && b.x > W + SURF_CULL_PAD && e.x > W + SURF_CULL_PAD) ||
                (a.y < -SURF_CULL_PAD && b.y < -SURF_CULL_PAD && e.y < -SURF_CULL_PAD) ||
                (a.y > H + SURF_CULL_PAD && b.y > H + SURF_CULL_PAD && e.y > H + SURF_CULL_PAD)
            )
                continue;
            const area = (b.x - a.x) * (e.y - a.y) - (b.y - a.y) * (e.x - a.x);
            if (Math.abs(area) < SURF_MIN_AREA) continue;
            tris.push({
                color,
                alpha,
                depth: (a.depth + b.depth + e.depth) / 3,
                area,
                x0: a.x,
                y0: a.y,
                x1: b.x,
                y1: b.y,
                x2: e.x,
                y2: e.y,
            });
        }
    });
    // 遠い面から描く簡易ペインター法。半透明の面でもオブジェクト同士の重なりが自然になる。
    tris.sort((a, b) => b.depth - a.depth);
    // 不透明度が同じ面をまとめる（通常は全部 0.22 なので1グループ）。
    const groups = new Map();
    tris.forEach((t) => {
        if (!groups.has(t.alpha)) groups.set(t.alpha, []);
        groups.get(t.alpha).push(t);
    });
    groups.forEach((list, alpha) => {
        // 面が写っている範囲だけを層にする。画面全体を毎回消して重ねると重いため。
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        list.forEach((t) => {
            const ax = Math.min(t.x0, t.x1, t.x2),
                bx = Math.max(t.x0, t.x1, t.x2),
                ay = Math.min(t.y0, t.y1, t.y2),
                by = Math.max(t.y0, t.y1, t.y2);
            if (ax < minX) minX = ax;
            if (ay < minY) minY = ay;
            if (bx > maxX) maxX = bx;
            if (by > maxY) maxY = by;
        });
        if (!Number.isFinite(minX) || !Number.isFinite(minY)) return;
        const dx0 = Math.max(0, Math.floor(minX * Z + ox) - 2),
            dy0 = Math.max(0, Math.floor(minY * Z + oy) - 2),
            dx1 = Math.min(W, Math.ceil(maxX * Z + ox) + 2),
            dy1 = Math.min(H, Math.ceil(maxY * Z + oy) + 2),
            dw = dx1 - dx0,
            dh = dy1 - dy0;
        if (dw <= 0 || dh <= 0) return;
        const layer = surfaceLayerCanvasFor(dw, dh),
            lc = layer.getContext("2d");
        lc.setTransform(1, 0, 0, 1, 0, 0);
        lc.clearRect(0, 0, dw, dh);
        // 本番のキャンバスと同じズーム／移動を掛け、切り出した範囲の左上が原点に来るようにする。
        lc.setTransform(Z, 0, 0, Z, ox - dx0, oy - dy0);
        lc.lineJoin = "round";
        lc.globalAlpha = 1; // 層の中は不透明。重なっても濃くならない。
        // 色ごとに1本のパスへまとめてから塗る。三角形ごとに fill すると
        // パス生成の回数が面の数だけ増えて重いので、同じ色はまとめる。
        // 塗ったあと同色で縁をなぞるのは、隣り合う三角形の継ぎ目が
        // 透けて細い筋に見えるのを防ぐため（塗りと同色なので線には見えない）。
        const byColor = new Map();
        list.forEach((t) => {
            if (!byColor.has(t.color)) byColor.set(t.color, []);
            byColor.get(t.color).push(t);
        });
        byColor.forEach((trisOfColor, col) => {
            // 1本のパスへまとめすぎると、三角形が数千枚あるアセット（球・ベベル階層など）で
            // パス構築が重くなる。400枚ずつに区切って塗る。
            const chunk = 400;
            lc.fillStyle = col;
            lc.strokeStyle = col;
            // 継ぎ目の隙間を埋める縁取りは「画面上で1px」になる太さにする。
            // 変換に Z が掛かっているので、1/Z で1pxになる。
            lc.lineWidth = 1 / Math.max(0.25, Z);
            for (let i = 0; i < trisOfColor.length; i += chunk) {
                const path = new Path2D(),
                    edge = new Path2D(),
                    end = Math.min(i + chunk, trisOfColor.length);
                let hasEdge = false;
                for (let k = i; k < end; k++) {
                    const t = trisOfColor[k],
                        // 同じパスへ複数の三角形を入れると、巻き方向が逆の三角形どうしが
                        // 打ち消し合って塗りが抜ける（裏表の面が重なる立体で顕著）。
                        // 全三角形の巻き方向をそろえてから1本のパスにする。
                        flip = t.area < 0,
                        q1x = flip ? t.x2 : t.x1,
                        q1y = flip ? t.y2 : t.y1,
                        q2x = flip ? t.x1 : t.x2,
                        q2y = flip ? t.y1 : t.y2;
                    // closePath() は fill() が自動で閉じるので呼ばない。
                    // Chromium の Path2D.closePath() は1回あたり約16µsかかり、
                    // 1万枚の三角形で200ms以上を占めていた（実測）。
                    path.moveTo(t.x0, t.y0);
                    path.lineTo(q1x, q1y);
                    path.lineTo(q2x, q2y);
                    // 縁取りは辺を描くので、閉じる辺は lineTo で戻す（closePath は使わない）。
                    if (Math.abs(t.area) >= SURF_STROKE_AREA) {
                        edge.moveTo(t.x0, t.y0);
                        edge.lineTo(q1x, q1y);
                        edge.lineTo(q2x, q2y);
                        edge.lineTo(t.x0, t.y0);
                        hasEdge = true;
                    }
                }
                lc.fill(path, "nonzero");
                if (hasEdge) lc.stroke(edge);
            }
        });
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.globalAlpha = alpha;
        c.drawImage(layer, 0, 0, dw, dh, dx0, dy0, dw, dh);
        c.restore();
    });
}
// アセットを置いた直後の1回目の描画は、キャンバスの再ラスタライズが間に合わず
// 輪郭線が欠けて見えることがある（クリックして描き直すと出る）。
// 追加系の操作ではこちらを使い、次のフレームでもう一度描いて確実に線を出す。
function renderFresh() {
    render();
    // 追加直後の1回目の描画は、同じイベント処理の中で続けて描いても
    // 輪郭線が欠けたまま残ることがある（ラスタライズが間に合わない）。
    // イベント処理が終わったあとのタスクでもう一度描くと確実に出る。
    setTimeout(() => render(), 0);
}
// ===== 背景（用紙色・参考写真・床の色・床グリッド）のキャッシュ =====
// これらは「カメラ」か「設定」が変わったときだけ描き直せばよい。
// ハンドルをドラッグしている間カメラは止まっているので、毎フレーム描き直すのは無駄
// （床グリッドだけで実測 7ms/フレーム）。同じ状態なら前回の絵をそのまま貼る。
let BG = null,
    BGKey = "",
    imgSeq = 0;
// 参考写真は差し替わるたびに別の Image になるので、オブジェクトに通し番号を付けて見分ける。
const imgTag = () => (IMG ? IMG.__tag || (IMG.__tag = ++imgSeq) : -1);
function backgroundLayer() {
    const key = [
        W,
        H,
        Z,
        ox,
        oy,
        T,
        imgTag(),
        P.pa,
        $("bgw").checked,
        $("gg").checked,
        $("floorTint")?.checked ? 1 : 0,
        window.cityFloorTint ? 1 : 0,
        JSON.stringify(P),
    ].join("|");
    if (!window.__noBgCache && BG && BGKey === key && BG.width === W && BG.height === H) return BG;
    if (!BG || BG.width !== W || BG.height !== H) {
        BG = document.createElement("canvas");
        BG.width = W;
        BG.height = H;
    }
    const g = BG.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.fillStyle = $("bgw").checked ? "#fff" : "#23251f";
    g.fillRect(0, 0, W, H);
    g.save();
    g.setTransform(Z, 0, 0, Z, ox, oy);
    if (IMG) {
        const s = Math.min(W / IMG.width, H / IMG.height),
            w = IMG.width * s,
            h = IMG.height * s;
        g.globalAlpha = P.pa;
        g.drawImage(IMG, (W - w) / 2, (H - h) / 2, w, h);
        g.globalAlpha = 1;
    }
    if (window.cityFloorTint && $("floorTint")?.checked) window.cityFloorTint(g);
    if ($("gg").checked) floorGrid(g);
    g.restore();
    BGKey = key;
    return BG;
}
// ポインター移動のように「同じフレームに何度も呼ばれる」描画は、
// requestAnimationFrame で1回にまとめる。描画は1回 30〜40ms かかるため、
// 3回続けて呼ばれると 100ms 近くを捨てることになる（ドラッグが重くなる原因）。
// 同期で描きたい所（書き出し・確定時）は今まで通り render() をそのまま呼ぶ。
let RAF = 0;
function renderSoon() {
    if (RAF) return;
    RAF = requestAnimationFrame(() => {
        RAF = 0;
        render();
    });
}
function render() {
    // 予約済みの描画は、この同期描画1回にまとめる（二重に描かない）。
    if (RAF) {
        cancelAnimationFrame(RAF);
        RAF = 0;
    }
    dirty = true;
    // カメラロック中は、どの入口から視点が動いても描く前に元へ戻す（最後の砦）。
    enforceCameraLock();
    // sigNow()は描画1回につき一度だけ計算する。以前は線ごとに再計算していたため、
    // アセットや線が多いシーンほど不要な文字列計算が増えていた。
    const currentSignature = sigNow();
    if (S.some((s) => s.ob && s.cs !== currentSignature)) regenObjects();
    syncSel();
    T === "f" ? calcF() : calc();
    const c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    // 画面上のラベルは1フレーム分だけ位置を覚え、重ならないように置き直す。
    if (typeof gzLabelReset === "function") gzLabelReset();
    // 背景はキャッシュを貼るだけ（中身は backgroundLayer()）
    c.drawImage(backgroundLayer(), 0, 0);
    c.save();
    c.setTransform(Z, 0, 0, Z, ox, oy); // 以降はズーム/移動つき
    drawObjectSurfaces(c);
    if ($("gon").checked) {
        if (orthView) orthGuides(c);
        else T === "f" ? guidesF(c) : guides(c);
    }
    if ($("hzl").checked && !orthView) {
        c.strokeStyle = "#e8a33d";
        c.lineWidth = 1.2;
        c.setLineDash([10, 8]);
        c.beginPath();
        if (T === "f") circ(c, AXC[0], AXC[1]);
        else {
            c.moveTo(0, AX.hy);
            c.lineTo(W, AX.hy);
        }
        c.stroke();
        c.setLineDash([]);
    }
    if (P.surfaceMode) {
        // 面表示中は面を深度バッファに使い、面の裏側に隠れるエッジを表示しない。
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.drawImage(lineLayer(true, true, W, H, null, true), 0, 0);
        c.restore();
    } else if ($("bin").checked) {
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.drawImage(lineLayer(true, true), 0, 0);
        c.restore();
    } else {
        S.forEach((s) => {
            if (!s.ob || objectVisible(s.ob)) strokeW(c, s);
        });
        drawCur(c);
        if (prev) prev.forEach((s) => strokeW(c, s));
    }
    // 選択中の線を橙色に塗り替えない。線画は常に設定した線色で表示し、選択状態はギズモだけで示す。
    if (snapHit)
        S.forEach((s) => {
            if (s.ob && objectVisible(s.ob) && snapHit.has(s.ob.id)) {
                c.save();
                c.globalAlpha = 0.75;
                strokeW(c, { ...s, c: "#ff3df2", w: s.w + 3 / Z });
                c.restore();
            }
        }); // くっつき先は桃色
    if (tool === "edit" && selIds.size > 1) drawSelectionFeedback(c);
    const selectedForGizmo = sel && obOf(sel);
    if (sel && tool === "edit" && (!window.cityFloorPlanActive || selectedForGizmo?.attachment?.wallSideSign))
        drawGizmo(c); // 3D視点と壁横看板の前／横／上ビューへ、軸・面・専用ハンドルを表示
    if (window.cityFloorPlanOverlay && window.cityFloorPlanActive) window.cityFloorPlanOverlay(c);
    if (boxSelect) drawBoxSelection(c);
    if (er) {
        c.strokeStyle = "#e84a4a";
        c.lineWidth = 1.5 / Z;
        c.beginPath();
        c.arc(er.last.x, er.last.y, P.ew, 0, 7);
        c.stroke();
    }
    if (T === "f") {
        markF(c);
        drawLockMarks(c);
        overlay(c);
        c.restore();
        return;
    }
    // VPの目印（画面外なら端に寄せて表示）
    ["VP1", "VP2", "VP3"].forEach((nm, i) => {
        const A = AX[i];
        if (!A.vp || !show[i]) return;
        let dx = A.vp.x - W / 2,
            dy = A.vp.y - H / 2;
        const t = Math.min(1, (W / 2 - 14) / (Math.abs(dx) || 1e-9), (H / 2 - 14) / (Math.abs(dy) || 1e-9));
        const px = W / 2 + dx * t,
            py = H / 2 + dy * t;
        c.fillStyle = ["#e8743d", "#2fb5a5", "#4a7be8"][i];
        c.beginPath();
        c.arc(px, py, 7, 0, 7);
        c.fill();
        c.font = "bold 18px system-ui";
        c.fillText(nm + (t < 1 ? " →" : ""), Math.min(px + 10, W - 70), Math.max(py - 10, 20));
    });
    drawLockMarks(c);
    overlay(c);
    c.restore();
    const q = (v) => (v ? `(${((v.x / W) * 100).toFixed(0)}%, ${((v.y / H) * 100).toFixed(0)}%)` : "無限遠(平行)");
    $("info").innerHTML =
        `画角 ${((2 * Math.atan(18 / P.lens) * 180) / Math.PI).toFixed(1)}°<br>VP1 ${q(AX[0].vp)}<br>VP2 ${q(AX[1].vp)}<br>垂直 ${AX[2].vp ? "VP3 " + q(AX[2].vp) : "平行（垂直）"}<br>地平線 ${((AX.hy / H) * 100).toFixed(1)}%`;
}
