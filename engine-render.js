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
function roomShellCameraSides(o) {
    const sides=new Set();if(o?.asset!=="roomShell")return sides;
    let vx,vy;
    if(orthView){const v=orthBasis().depth.map(x=>-x);vx=v[0];vy=v[2];}
    else {const cam=camPos(),origin=L2W(o,0,0,0);vx=cam[0]-origin[0];vy=cam[2]-origin[2];}
    const a=(Number(o.rot)||0)*DG,c=Math.cos(a),s=Math.sin(a),lx=vx*c+vy*s,ly=-vx*s+vy*c,hw=Math.abs(Number(o.ra)||1.8),hd=Math.abs(Number(o.rb)||1.8);
    if(lx>hw*.32)sides.add("right");else if(lx< -hw*.32)sides.add("left");
    if(ly>hd*.32)sides.add("back");else if(ly< -hd*.32)sides.add("front");
    return sides;
}
function roomShellCameraCuts(o){
    const walls=roomShellCameraSides(o),floor=false,ceiling=false;
    if(o?.asset!=="roomShell")return{walls,floor,ceiling};
    if(orthView){
        // 正投影の6方向では、カメラに重なる壁・床・天井面が家具を覆わないよう
        // 塗り面をカリングし、線画の輪郭だけを残す断面表示にする。
        ["front","back","left","right"].forEach(x=>walls.add(x));
        if(["front","back","side","right","left"].includes(orthView))return{walls,floor:true,ceiling:true};
        if(orthView==="top")return{walls,floor:false,ceiling:true};
        if(orthView==="bottom")return{walls,floor:true,ceiling:false};
    }
    const origin=L2W(o,0,0,0),cam=camPos(),top=L2W(o,0,0,Math.abs(Number(o.h)||3.6))[1];
    return{walls,floor:cam[1]<origin[1]-.03,ceiling:cam[1]>top+.03};
}
const surfaceTriCache = new WeakMap();
function surfaceCacheKey(o) {
    try {
        const key=JSON.stringify(o);
        return o?.asset==="roomShell"?`${key}|room:${JSON.stringify({walls:[...roomShellCameraCuts(o).walls].sort(),floor:roomShellCameraCuts(o).floor,ceiling:roomShellCameraCuts(o).ceiling})}`:key;
    } catch (e) {
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
}
function surfaceTriangles(o) {
    if (!o || typeof o !== "object") return exportSurfaceTriangles(o);
    // 親へ接着しているパーツは、親の移動・回転が o 側の基準（wallSideBasis）へ
    // 反映されてから値を見る。反映前のキーで照合すると古い面が残る。
    const source = o.attachment && typeof syncAttachedPart === "function" ? syncAttachedPart(o) : o,
        key = surfaceCacheKey(source),
        hit = surfaceTriCache.get(o);
    if (hit && hit.key === key) return hit.tris;
    let base = exportSurfaceTriangles(source);
    if(source.asset==="roomShell"){const cut=roomShellCameraCuts(source);base=base.filter(t=>!cut.walls.has(t.roomShellWallSide)&&!(cut.floor&&t.roomShellFloor)&&!(cut.ceiling&&t.roomShellCeiling));}
    const spec = arrayModifierSpec(source), tris = spec && spec.count > 1 ? [...base] : base;
    // 面の遮蔽も各コピーに存在する。線と同じワールド軸・同じ間隔で展開する。
    if (spec && spec.count > 1 && base.length) {
        for (let i = 1; i < spec.count; i++) {
            const shift = arrayModifierShift(spec, i);
            for (const tri of base) {
                const copy = tri.map(p => p.map((v, j) => v + shift[j]));
                if (tri.surfaceColor) copy.surfaceColor = tri.surfaceColor;
                tris.push(copy);
            }
        }
    }
    surfaceTriCache.set(o, { key, tris });
    return tris;
}
// 人物の腕・脚・頭はカメラに対するメッシュのシルエット稜線だけを線画化する。
// 骨の中心線や顔パーツを描かず、球や円柱プリミティブと同じ輪郭方式にする。
function personSilhouetteLines(o,onlyPart=null) {
    if(o?.asset!=="person")return[];
    const tris=surfaceTriangles(o).filter(t=>!onlyPart||t.personPart===onlyPart),edges=new Map(),quant=p=>p.map(v=>Math.round(v*1e5)).join(","),
        toward=orthView?orthBasis().depth:camPos();
    for(const tri of tris){
        const [a,b,c]=tri,ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]),
            n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],nl=Math.hypot(...n);
        if(nl<1e-10)continue;
        const center=a.map((v,i)=>(v+b[i]+c[i])/3),view=orthView?toward:toward.map((v,i)=>v-center[i]),front=n[0]*view[0]+n[1]*view[1]+n[2]*view[2]>=0;
        for(const [u,v]of [[a,b],[b,c],[c,a]]){const ku=quant(u),kv=quant(v),key=ku<kv?`${ku}|${kv}`:`${kv}|${ku}`,entry=edges.get(key);if(entry){entry.faces.push(front);}else edges.set(key,{a:u,b:v,faces:[front]});}
    }
    const out=[];for(const edge of edges.values())if(edge.faces.length===1||edge.faces.some(Boolean)&&edge.faces.some(v=>!v))out.push({ob:o,c:o.c||"#222222",w:Math.max(.8,Number(o.w)||1.2),d3:true,p:[edge.a,edge.b],personSilhouette:true});
    return out;
}
function drawPersonSilhouettes(c,hidden=false,depth=null,cw=W,ch=H,tf=null){
    const seen=new Set(),vs=viewShift(),transform=tf||[Z,0,0,Z,vs[0],vs[1]];
    for(const s of S){const o=s?.ob;if(!o||o.asset!=="person"||!objectVisible(o)||seen.has(o.id))continue;seen.add(o.id);
        personSilhouetteLines(o).forEach(line=>hidden?strokeWVisible(c,line,depth,cw,ch,transform):strokeW(c,line));}
}
function exportSurfaceTriangles(o) {
    const out = exportSurfaceTrianglesBase(o);
    if (typeof buildingDoorTriangles === "function") out.push(...buildingDoorTriangles(o));
    return out;
}
function exportSurfaceTrianglesBase(o) {
    const out = [];
    if (o?.type === "compound") {
        compoundPartsAt(o).forEach((part) => out.push(...surfaceTriangles(part)));
        return out;
    }
    // ASSET_KIT（asset-kit.js）で作ったアセットは、形の記述が1か所にある。
    // 面はその記述から作られるので、ここの if 連鎖へ形を書き足す必要はない。
    if (typeof assetKitTriangles === "function") {
        const kit = assetKitTriangles(o);
        if (kit && kit.length) return kit;
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
        const v = boxCornerPoints(cx, cy, bw, bd, z0, z1),
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
        if (!o.doorEnabled && !o.omitOpeningBack) quad(point(backA, z0), point(backB, z0), point(backB, openingH), point(backA, openingH));
    };
    const openingBoxAt = (cx, cy, bw, bd, z0, z1, opening) => {
        const x = bw / 2,
            y = bd / 2,
            ow = clamp(Number(opening.openingW) || bw * 0.56, 0.1, Math.max(0.1, bw - 0.1)),
            oh = clamp(Number(opening.openingH) || (z1 - z0) * 0.66, 0.1, Math.max(0.1, z1 - z0 - 0.01)),
            panelY = clamp(Number(opening.openingBack), -y + 0.025, y - 0.025),
            dx = opening.openingOffset || 0,
            q = (a, b, c, d) => quad(...[a,b,c,d].map(p => [p[0]+cx,p[1]+cy,p[2]]));
        q([-x, -y, z0], [x, -y, z0], [x, y, z0], [-x, y, z0]);
        q([-x, -y, z1], [-x, y, z1], [x, y, z1], [x, -y, z1]);
        q([-x, -y, z0], [-x, -y, z1], [-x, y, z1], [-x, y, z0]);
        q([x, -y, z0], [x, y, z0], [x, y, z1], [x, -y, z1]);
        q([-x, y, z0], [-x, y, z1], [x, y, z1], [x, y, z0]);
        q([-x, -y, z0], [dx - ow / 2, -y, z0], [dx - ow / 2, -y, z1], [-x, -y, z1]);
        q([dx + ow / 2, -y, z0], [x, -y, z0], [x, -y, z1], [dx + ow / 2, -y, z1]);
        q([dx - ow / 2, -y, oh + z0], [dx + ow / 2, -y, oh + z0], [dx + ow / 2, -y, z1], [dx - ow / 2, -y, z1]);
        q([dx - ow / 2, -y, z0], [dx - ow / 2, panelY, z0], [dx - ow / 2, panelY, oh + z0], [dx - ow / 2, -y, oh + z0]);
        q([dx + ow / 2, -y, z0], [dx + ow / 2, -y, oh + z0], [dx + ow / 2, panelY, oh + z0], [dx + ow / 2, panelY, z0]);
        q([dx - ow / 2, -y, oh + z0], [dx - ow / 2, panelY, oh + z0], [dx + ow / 2, panelY, oh + z0], [dx + ow / 2, -y, oh + z0]);
        if (!o.doorEnabled) q([dx - ow / 2, panelY, z0], [dx + ow / 2, panelY, z0], [dx + ow / 2, panelY, oh + z0], [dx - ow / 2, panelY, oh + z0]);
    };
    const beveledOpeningAt = (cx, cy, bw, bd, z0, z1, offset, segments, opening) => {
        const footprint = beveledBoxFootprint(bw, bd, offset, segments),
            x = bw / 2,
            y = bd / 2,
            ow = clamp(Number(opening.openingW) || bw * 0.56, 0.1, Math.max(0.1, bw - 0.1)),
            oh = clamp(Number(opening.openingH) || (z1 - z0) * 0.66, 0.1, Math.max(0.1, z1 - z0 - 0.01)),
            panelY = clamp(Number(opening.openingBack), -y + 0.025, y - 0.025),
            dx = opening.openingOffset || 0,
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
                wall(-x, dx - ow / 2, z0, z1);
                wall(dx + ow / 2, x, z0, z1);
                wall(dx - ow / 2, dx + ow / 2, oh + z0, z1);
            }
        }
        quad(
            [cx + dx - ow / 2, cy - y, z0],
            [cx + dx - ow / 2, cy + panelY, z0],
            [cx + dx - ow / 2, cy + panelY, oh + z0],
            [cx + dx - ow / 2, cy - y, oh + z0],
        );
        quad(
            [cx + dx + ow / 2, cy - y, z0],
            [cx + dx + ow / 2, cy - y, oh + z0],
            [cx + dx + ow / 2, cy + panelY, oh + z0],
            [cx + dx + ow / 2, cy + panelY, z0],
        );
        quad(
            [cx + dx - ow / 2, cy - y, oh + z0],
            [cx + dx - ow / 2, cy + panelY, oh + z0],
            [cx + dx + ow / 2, cy + panelY, oh + z0],
            [cx + dx + ow / 2, cy - y, oh + z0],
        );
        if (!o.doorEnabled) quad(
            [cx + dx - ow / 2, cy + panelY, z0],
            [cx + dx + ow / 2, cy + panelY, z0],
            [cx + dx + ow / 2, cy + panelY, oh + z0],
            [cx + dx - ow / 2, cy + panelY, oh + z0],
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
    // wallSign の面は ASSET_KIT（asset-kit-assets.js）の部品から作る。
    if (kind === "cornerCutBox" && typeof cornerCutFootprint === "function") {
        const opening = typeof cornerCutOpeningParams === "function" ? cornerCutOpeningParams(o) : null,
            z0 = 0,
            z1 = Math.max(0.01, Math.abs(Number(o.h) || 0.01));
        if (opening?.enabled) cornerCutOpeningAt(z0, z1, opening);
        else {
            const params = cornerCutBoxParams(o),
                footprint = beveledPolygonData(cornerCutFootprint(params.w,params.d,params.cornerOffset,params.cornerCutCorner),params.bevelOffset,params.bevelSegments).points,
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
        const fascia=cornerCutFasciaParts(o),cutParams=cornerCutBoxParams(o);
        if(fascia.g.enabled){
            if(!opening?.enabled&&cutParams.bevelOffset>1e-6){
                cornerCutFasciaBevelTriangles(o).forEach(t=>{const world=t.map(v=>L(...v));world.surfaceColor=t.surfaceColor;out.push(world);});
            } else for(const polygon of fascia.parts) {
                const mark=out.length,lo=fascia.g.z0,hi=fascia.g.z1,point=(v,z)=>[v[0],v[1],z];
                for(let i=1;i<polygon.length-1;i++){
                    tri(point(polygon[0],lo),point(polygon[i+1],lo),point(polygon[i],lo));
                    tri(point(polygon[0],hi),point(polygon[i],hi),point(polygon[i+1],hi));
                }
                for(let i=0;i<polygon.length;i++) {
                    const j=(i+1)%polygon.length;
                    quad(point(polygon[i],lo),point(polygon[j],lo),point(polygon[j],hi),point(polygon[i],hi));
                }
                for(let i=mark;i<out.length;i++) out[i].surfaceColor=fascia.g.color;
            }
        }
        return out;
    }
    if ((kind === "beveledBox" || (kind === "box" && Number(o.bevelOffset) > 1e-5)) && typeof beveledBoxFootprint === "function") {
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
    if (kind === "stackedBuilding" || kind === "beveledStackedBuilding" || kind === "cornerCutStackedBuilding") {
        const floors =
            Array.isArray(o.floors) && o.floors.length
                ? o.floors
                : [{ x: 0, y: 0, z: 0, w, d, h, rimHeight: 0.16, rimOverhang: 0.18 }];
        floors.forEach((f, i) => {
            const floor=stackedFloorGeometry(o,f,i,{w,d,h}),
                fw=floor.w,fd=floor.d,fh=floor.h,
                fz=Number(f.z)||0,fx=Number(f.x)||0,fy=Number(f.y)||0,
                rh=floor.rimHeight,ro=floor.rimOverhang,
                bevelOffset=floor.bevelOffset,bevelSegments=floor.bevelSegments,opening=floor.opening;
            if (kind === "cornerCutStackedBuilding") {
                // 階ごとの隅切り面は既存の隅切り直方体を共用し、親の回転を保って位置をずらす。
                const base=customPt(o,0,0,0), dest=customPt(o,fx,fy,fz), shift=dest.map((v,j)=>v-base[j]),
                    part={...o,asset:"cornerCutBox",ra:fw/2,rb:fd/2,h:fh,facadeEnabled:false,doorEnabled:false,omitOpeningBack:!!opening && o.doorEnabled===true,arrayEnabled:false,cornerCutOpeningEnabled:!!opening,
                        cornerCutOpeningW:opening?.openingW,cornerCutOpeningH:opening?.openingH,cornerCutOpeningDepth:opening?.openingBack},
                    append=tris=>tris.forEach(t=>out.push(t.map(p=>p.map((v,j)=>v+shift[j]))));
                append(surfaceTriangles(part));
                const offset=cornerCutBoxParams(part).cornerOffset+(2-Math.SQRT2)*ro,
                    rim={...part,ra:(fw+2*ro)/2,rb:(fd+2*ro)/2,h:rh,cornerOffset:offset,cornerCutOpeningEnabled:false},
                    rimBase=customPt(o,0,0,fh-rh), origin=customPt(o,0,0,0), rimShift=rimBase.map((v,j)=>v-origin[j]);
                surfaceTriangles(rim).forEach(t=>out.push(t.map(p=>p.map((v,j)=>v+shift[j]+rimShift[j]))));
            } else if (kind === "beveledStackedBuilding" || bevelOffset > 1e-5) {
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
    // balcony / uWall / stall の面は ASSET_KIT（asset-kit-assets.js）の部品から作る。
    // railing（箱の集まり）の面は ASSET_KIT の K.box から作る。
    // stool（円柱3本）の面は ASSET_KIT の K.cylinder から作る。
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
        const addF1Options=()=>{
            if(o.f1AwningEnabled===true){const aw=f1AwningPanels(o,w,d,h);
                aw.top.forEach(q=>quad(...q));aw.underside.forEach(q=>quad(...q));aw.front.forEach(q=>quad(...q));aw.sides.forEach(q=>quad(...q));aw.back.forEach(q=>quad(...q));}
            if(o.f1SignEnabled===true){const sw=clamp(Number(o.f1SignWidth)||3,.2,w*.95),sh=clamp(Number(o.f1SignHeight)||1,.1,h*.4),sd=clamp(Number(o.f1SignDepth)||.5,.02,1),sx=clamp(Number(o.f1SignOffsetX)||0,-w*.45,w*.45),z0=clamp(o.f1SignZ===undefined?3.6:Number(o.f1SignZ),0,h),sb=clamp(o.f1SignBevelOffset==null ? .18 : Number(o.f1SignBevelOffset),0,Math.max(0,Math.min(sw,sh)*.45-.001)),frontY=-d/2-sd,backY=frontY+sd,zc=z0+sh/2,outline=beveledBoxFootprint(sw,sh,sb,4),frontCenter=[sx,frontY,zc],backCenter=[sx,backY,zc];for(let i=0;i<outline.length;i++){const j=(i+1)%outline.length,a=outline[i],b=outline[j],fa=[sx+a[0],frontY,zc+a[1]],fb=[sx+b[0],frontY,zc+b[1]],ba=[sx+a[0],backY,zc+a[1]],bb=[sx+b[0],backY,zc+b[1]];tri(frontCenter,fa,fb);tri(backCenter,bb,ba);quad(fa,ba,bb,fb);}}
        };
        const facade=buildingFasciaGeometry(o);
        if (facade.enabled) {
            const mark=out.length,fb=clamp(Number(o.bevelOffset)||0,0,Math.min(facade.projection,facade.z1-facade.z0,facade.w)*.45),
                fasciaBox=(x,y,bw,bd,z0,z1)=>fb>1e-5?beveledAt(x,y,bw,bd,z0,z1,fb,4):boxAt(x,y,bw,bd,z0,z1);
            fasciaBox(0,-facade.d/2-facade.projection/2,facade.w,facade.projection,facade.z0,facade.z1);
            if(facade.side) for(const sign of [-1,1]) fasciaBox(sign*(facade.w/2+facade.projection/2),-facade.projection/2,facade.projection,facade.d+facade.projection,facade.z0,facade.z1);
            // 面表示だけ看板色を使う。深度・隠線処理では通常の三角形として扱う。
            for(let i=mark;i<out.length;i++) out[i].surfaceColor=facade.color;
        }
        // 開口OFFでは面表示も通常の閉じた直方体へ戻す。
        if (o.openingEnabled === false) {
            const bevel=clamp(Number(o.bevelOffset)||0,0,Math.min(w,d)*.22);
            if(bevel>1e-5)beveledAt(0,0,w,d,0,h,bevel,4);else boxAt(0,0,w,d,0,h);
            addF1Options();
            return out;
        }
        const g = buildingGeometry(o),
            leftEdge = g.openingOffset - g.openingW / 2, rightEdge = g.openingOffset + g.openingW / 2,
            leftW = leftEdge + g.w / 2, rightW = g.w / 2 - rightEdge,
            panelY = g.backY,bevel=clamp(Number(o.bevelOffset)||0,0,Math.min(w,d)*.22);
        if(bevel>1e-5)beveledOpeningAt(0,0,g.w,g.d,0,g.h,bevel,4,{...g,openingBack:g.backY});
        else {
            boxAt((-g.w/2+leftEdge)/2,0,leftW,g.d,0,g.h);
            boxAt((rightEdge+g.w/2)/2,0,rightW,g.d,0,g.h);
            boxAt(0,0,g.w,g.d,g.openingH,g.h);
            if(!o.doorEnabled)quad([leftEdge,panelY,0],[rightEdge,panelY,0],[rightEdge,panelY,g.openingH],[leftEdge,panelY,g.openingH]);
        }
        addF1Options();
        return out;
    }
    if (kind === "wallSideSign") {
        const boardW = Math.max(0.05, Math.abs(Number(o.rb) || 0.75) * 2),
            boardH = Math.max(0.05, Math.abs(Number(o.ra) || 0.9) * 2),
            thickness = Math.max(0.02, Math.abs(Number(o.h) || 0.12)),
            count = clamp(Math.round(Number(o.wallSideSignBracketCount) || 0), 0, 3),
            length = clamp(Math.abs(Number(o.wallSideSignBracketLength) || 0.36), 0.05, 5),
            bracketThickness = clamp(Math.abs(Number(o.wallSideSignBracketThickness) || Math.max(.06, Math.min(.18, boardH * .1))), .02, .5),
            clearance = 0.025,
            span = length + clearance,
            centerY = -(boardW * 0.5 + span * 0.5),
            barV = bracketThickness,
            bevelOffset = clamp(
                Number(o.wallSideSignBevelOffset) || 0.06,
                0.01,
                Math.max(0.01, Math.min(boardH, boardW) * 0.45),
            ),
            bevelSegments = 4,
            drawBoard = (cx, cy, bw, bd, z0, z1) => beveledAt(cx, cy, bw, bd, z0, z1, bevelOffset, bevelSegments);
        // 面表示用も、ベベルは看板本体だけ。取付金具は普通の直方体の面にする。
        drawBoard(0, 0, boardH, boardW, -thickness * 0.5, thickness * 0.5);
        for (let i = 0; i < count; i++) {
            const t = (i + 1) / (count + 1),
                x = -boardH * 0.5 + boardH * t;
            boxAt(x,centerY,barV,span,-thickness*.5,thickness*.5);
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
            },
            markPart=(part,fn)=>{const start=out.length;fn();for(let i=start;i<out.length;i++)out[i].personPart=part;};
        // 台座は作らない（線画の linesPerson と同じ扱い）。
        // ここに箱を残していたため、線が消えても面表示では足元に立方体が出ていた。
        // 脚（股関節→膝→足）
        markPart("leg",()=>p.legs.forEach((leg) => {
            segment([leg.hip.x, leg.hip.y, leg.hip.z], [leg.knee.x, leg.knee.y, leg.knee.z], legR);
            segment([leg.knee.x, leg.knee.y, leg.knee.z], [leg.foot.x, leg.foot.y, leg.foot.z], legR * 0.92);
        }));
        // 肩・肘・手首の腕も、脚と同じ関節骨格に沿う閉じた形状にする。
        markPart("arm",()=>p.arms.forEach(arm=>{segment([arm.shoulder.x,arm.shoulder.y,arm.shoulder.z],[arm.elbow.x,arm.elbow.y,arm.elbow.z],arm.radius);segment([arm.elbow.x,arm.elbow.y,arm.elbow.z],[arm.wrist.x,arm.wrist.y,arm.wrist.z],arm.radius*.9);}));
        // 胴（腰を支点に傾く四角柱）
        markPart("torso",()=>prism(p.torsoBottom,p.torsoTop));
        // 頭は顔の中身を描かず、球状面の視点依存シルエットだけを使う。
        const headCy = (p.headC0.y + p.headC1.y) * 0.5,
            headCz = (p.headC0.z + p.headC1.z) * 0.5,
            headRy = p.headR * 0.9,
            headRz = Math.max(0.02, Math.hypot(p.headC1.y - p.headC0.y, p.headC1.z - p.headC0.z) * 0.5);
        markPart("head",()=>ellipsoid(p.headTopX * 0.5, headCy, headCz, p.headR, headRy, headRz, 8, 12));
        return out;
    }
    if (kind === "stairs") {
        // 階段は段板・蹴上げ・左右側面・底面・最奥面で閉じた実形状にする。
        // 各段の側面を区間ごとの長方形に分けることで、重複面や斜めの包絡箱を作らない。
        // 段の繰り返しは K.repeat に任せる（段数は線画と同じ K.count で決める）。
        const n = ASSET_KIT.count(o.steps || 6, 6, 2, 24),
            sd = d / n,
            sh = h / n,
            x = w / 2;
        ASSET_KIT.repeat(n, (i) => {
            const y0 = -d / 2 + i * sd,
                y1 = y0 + sd,
                z = (i + 1) * sh,
                z0 = i * sh;
            quad([-x, y0, z], [x, y0, z], [x, y1, z], [-x, y1, z]); // 段板（水平）
            quad([-x, y0, z0], [x, y0, z0], [x, y0, z], [-x, y0, z]); // 蹴上げ（垂直）
            quad([-x, y0, 0], [-x, y1, 0], [-x, y1, z], [-x, y0, z]); // 左の側面
            quad([x, y1, 0], [x, y0, 0], [x, y0, z], [x, y1, z]); // 右の側面
            return null;
        });
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
    // 透視の深度ラスタは頂点ごとに逆変換用の配列と cam() を2回作っていた。
    // scr3 と同じ「先に正規化してから回転」の演算順を保ちつつ、深度も一緒に求める。
    if (!orthView && T !== "f") {
        const rx = v[0] * 1 + (-P.cx) * 1, ry = v[1] * 1 + (1 - P.ch) * 1, rz = v[2] * 1 + (-P.cz) * 1,
            len = Math.hypot(rx, ry, rz) || 1, x = rx / len, y = ry / len, z = rz / len,
            m = camMatrix(), qx = m[0] * x + m[1] * y + m[2] * z,
            qy = m[3] * x + m[4] * y + m[5] * z, qz = m[6] * x + m[7] * y + m[8] * z;
        if (qz <= 0.02) return null;
        const f = (W * P.lens) / 36,
            sx = W / 2 + (f * qx) / qz, sy = (H * P.hz) / 100 - (f * qy) / qz;
        return { x: sx * tf[0] + tf[4], y: sy * tf[3] + tf[5], depth: m[6] * rx + m[7] * ry + m[8] * rz };
    }
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
    // 画素ごとの「面ID」。同じ平面（同じ法線＋同じ位置）の三角形は同じ番号になる。
    // 線の左右で面IDが同じなら、その線は平面の内側（＝継ぎ目）なので描かない。
    // FreePencil2 の「面ID＋法線バッファ」方式のうち、線の除去に必要な部分だけを持つ。
    depthFace = null,
    // 平面 → 面ID。作り直しても番号を変えないよう、消さずに使い回す
    // （静止分キャッシュに残った古い番号と衝突させないため）。
    facePlaneIds = new Map(),
    depthOwnerMap = new Map(),
    depthBufferLen = 0,
    depthUsedY0 = Infinity,
    depthUsedY1 = -Infinity,
    depthKey = null;
// 深度バッファは「大きさ・変換・カメラ・オブジェクトの中身」が同じなら作り直さない。
// 面を選び直しただけ・ハンドルに触れただけの描き直しでは、この計算（実測20ms前後）が丸ごと省ける。
// キー作りは JSON.stringify 30個で 0.04ms 程度なので、毎回作っても十分安い。
function exportDepthKey(cw, ch, tf, seen) {
    let key = cw + "," + ch + "," + (tf ? tf.join(",") : "") + "," + T + "," + sigNow() + "," + JSON.stringify(P) + "|";
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
function rasterizeDepthInto(buf, own, ownerMap, list, cw, ch, tf, used, face) {
    // 三角形を深度バッファへ書く。走査線（スキャンライン）方式で塗る。
    // 以前は外接矩形の全画素で重心座標を3つずつ計算していたため、
    // 面の多いシーン（30個・2,580三角形）で1フレーム400ms近くかかっていた。
    //   ・行ごとに三角形の左右の端（xL / xR）を辺との交点から出す
    //   ・重心座標は行の中で x の1次式なので、開始値＋増分の足し算で済ませる
    //   ・画面外の三角形は外接矩形の段階で捨てる
    // 三角形の平面（法線＋位置）から面IDを出す。同じ平面の三角形は同じIDになる。
    const faceIdOf = (tr) => {
        const ax = tr[1][0] - tr[0][0],
            ay = tr[1][1] - tr[0][1],
            az = tr[1][2] - tr[0][2],
            bx = tr[2][0] - tr[0][0],
            by = tr[2][1] - tr[0][1],
            bz = tr[2][2] - tr[0][2];
        let nx = ay * bz - az * by,
            ny = az * bx - ax * bz,
            nz = ax * by - ay * bx;
        const len = Math.hypot(nx, ny, nz);
        if (!(len > 1e-9)) return 0;
        nx /= len;
        ny /= len;
        nz /= len;
        // 表裏で同じ平面とみなすため、法線の向きをそろえる（大きい成分を正にする）。
        if (Math.abs(nx) >= Math.abs(ny) && Math.abs(nx) >= Math.abs(nz) ? nx < 0 : Math.abs(ny) >= Math.abs(nz) ? ny < 0 : nz < 0) {
            nx = -nx;
            ny = -ny;
            nz = -nz;
        }
        const d = nx * tr[0][0] + ny * tr[0][1] + nz * tr[0][2];
        // 量子化して、隣り合う三角形の計算誤差を同じ平面にまとめる。
        const key = nx.toFixed(3) + "," + ny.toFixed(3) + "," + nz.toFixed(3) + "," + d.toFixed(2);
        let id = facePlaneIds.get(key);
        if (id === undefined) facePlaneIds.set(key, (id = facePlaneIds.size + 1));
        return id;
    };
    const putTri = (tr, owner) => {
        const p0 = exportPoint(tr[0], tf),
            p1 = exportPoint(tr[1], tf),
            p2 = exportPoint(tr[2], tf);
        // 透視投影では「カメラの後ろ（奥行きが負）」の三角形を捨てる。
        // 正投影では奥行きが負になるのが普通（正面ビューでは手前ほど負）なので捨てない。
        if (
            !p0 || !p1 || !p2 ||
            !Number.isFinite(p0.depth) || !Number.isFinite(p1.depth) || !Number.isFinite(p2.depth) ||
            (!orthView && (p0.depth < -0.001 || p1.depth < -0.001 || p2.depth < -0.001))
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
                if (covered) {
                    // 格子点だけでは、その間の小さな穴や細い隙間を見落とす。
                    // 省略する前に外接矩形の全画素が確実に手前にあることを確認する。
                    // 三角形の外も含む保守的な判定なので、穴があれば通常通り塗る。
                    for (let y = by0; y <= by1 && covered; y++) {
                        const end = y * cw + bx1;
                        for (let i = y * cw + bx0; i <= end; i++) {
                            if (!(buf[i] < near - 0.02)) { covered = false; break; }
                        }
                    }
                    if (covered) return;
                }
            }
        }
        const y0 = Math.max(0, Math.floor(minY)),
            y1 = Math.min(ch - 1, Math.ceil(maxY));
        if (y1 < y0) return;
        if (y0 < used.y0) used.y0 = y0;
        if (y1 > used.y1) used.y1 = y1;
        // 列の範囲も覚える（動いた1台の塗り直しで、横にはみ出した古い奥行きを消すため）。
        const ux0 = Math.max(0, Math.floor(minX)),
            ux1 = Math.min(cw - 1, Math.ceil(maxX));
        if (ux0 < used.x0) used.x0 = ux0;
        if (ux1 > used.x1) used.x1 = ux1;
        // 奥行きの補間。
        // 透視投影では画面座標に対する「奥行きそのもの」は1次にならない（1次なのは 1/奥行き）。
        // 以前は奥行きをそのまま画面内で線形補間していたため、視線に近い角度で見える
        // 大きな面（壁・屋根）で奥行きが実際より数十cmずれることがあった。すると
        // 面の上を通る線が「面より奥」と判定されて所々消え、線画が途切れ途切れになる。
        // 正投影では奥行きは画面座標の1次式なので、そのまま補間してよい。
        const recip = !orthView && T !== "f" && p0.depth > 1e-6 && p1.depth > 1e-6 && p2.depth > 1e-6,
            r0 = recip ? 1 / p0.depth : 0,
            r1 = recip ? 1 / p1.depth : 0,
            r2 = recip ? 1 / p2.depth : 0;
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
                    const z = recip
                        ? 1 / (r0 * w1 + r1 * w2 + r2 * w0)
                        : p0.depth * w1 + p1.depth * w2 + p2.depth * w0;
                    if (z < buf[idx]) {
                        buf[idx] = z;
                        if (own) own[idx] = owner;
                        if (face) face[idx] = fid;
                    }
                }
            }
        }
    };
    let fid = 0; // いま塗っている三角形の面ID
    for (let i = 0; i < list.length; i++) {
        const o = list[i],
            tris = surfaceTriangles(o);
        if (!tris.length) continue;
        const owner = ownerMap.get(o.id) || 0;
        for (let i2 = 0; i2 < tris.length; i2++) {
            const tr = tris[i2];
            fid = faceIdOf(tr);
            putTri(tr, owner);
        }
    }
}
// 直前のフレームの「オブジェクトごとの内容」と、静止分キャッシュ。
// 1台だけ動いているとき（＝ドラッグ中）は、その1台を除いた面の奥行きを
// そのまま使い回し、動いた1台の面だけを塗り直す（dirty rect）。
// 全面を作り直すと実測 11〜21ms かかるが、この経路は 2〜4ms で済む。
// 前フレームで「動いていた1台」が塗った範囲（列も持つ）。
// 行だけだと、回転して横にはみ出した古い奥行きが残り、線が余計に隠れる。
let depthMovingRect = null, // { x0, y0, x1, y1 }
    depthLast = null, // { ctxKey, ids, sigs }
    depthStatic = null, // { key, len, buf, owner, y0, y1 }
    depthMovingUsedY0 = Infinity,
    depthMovingUsedY1 = -Infinity;
function buildExportDepth(cw, ch, tf) {
    const need = cw * ch,
        // カメラ・用紙・書き出し変換・設定（P）が同じなら、オブジェクトの
        // 中身が変わったかどうかだけを見ればよい。
        // 正投影（正面・横・上）の向きもキーに入れる。
        // 入れないと、3Dで作った奥行きをそのまま使ってしまい、正面・横・上では
        // 「奥の建物が手前の面に隠れて」線がほぼ全部消える（実測：面ONの線が 1/50 になった）。
        ctxKey =
            cw + "," + ch + "," + (tf ? tf.join(",") : "") + "," + T + "," + orthoProjectionKey() + "," +
            sigNow() + "," + JSON.stringify(P),
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
        if (!depthFace || depthFace.length !== need) depthFace = new Int32Array(need);
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
                face: reuse ? depthStatic.face : new Int32Array(need),
                y0: Infinity,
                y1: -Infinity,
            };
            st.buf.fill(Infinity);
            st.owner.fill(0);
            st.face.fill(0);
            rasterizeDepthInto(
                st.buf,
                st.owner,
                ownerMap,
                objs.filter((_, i) => i !== movingIdx),
                cw,
                ch,
                tf,
                st,
                st.face,
            );
            depthStatic = st;
        }
        // 1) 前フレームで動いていた1台が塗った範囲を消し、
        // 2) 静止分をそこへ貼り直し、3) 動いた1台を塗り直す。
        // 全面 fill（100万要素）を避け、必要な矩形だけを触る。
        //
        // 消す範囲は「前フレームのその1台の矩形」と「今回のその1台の矩形」の和。
        // 行（y）だけを見ていると、回転して横にはみ出した古い奥行きが残り、
        // その奥行きで線が隠されて「線が減る」不具合になる（1台だけの場面で顕著）。
        const nowRect = movingRectOf(moving, cw, ch, tf),
            prevRect = depthMovingRect;
        let rx0, ry0, rx1, ry1;
        if (prevRect) {
            rx0 = Math.max(0, Math.min(prevRect.x0, nowRect.x0));
            rx1 = Math.min(cw - 1, Math.max(prevRect.x1, nowRect.x1));
            ry0 = Math.max(0, Math.min(prevRect.y0, nowRect.y0));
            ry1 = Math.min(ch - 1, Math.max(prevRect.y1, nowRect.y1));
        } else {
            // 直前に全面を作り直した直後は、前フレームの矩形が分からない。
            // そのときだけ「前回塗った行すべて」を消して、取りこぼしを残さない。
            rx0 = 0;
            rx1 = cw - 1;
            ry0 = Number.isFinite(depthUsedY0) ? Math.max(0, depthUsedY0) : 0;
            ry1 = Number.isFinite(depthUsedY1) ? Math.min(ch - 1, depthUsedY1) : ch - 1;
        }
        if (ry1 >= ry0 && rx1 >= rx0) {
            // 静止分があるときは、上の貼り直しが全画素を上書きするので、
            // 先に Infinity で消す必要はない（消すとメモリを2倍触ることになる）。
            // 静止分が空（シーンに1台だけ）のときだけ、範囲を明示的に消す。
            const hasStatic = depthStatic.y1 >= depthStatic.y0;
            if (!hasStatic) {
                for (let y = ry0; y <= ry1; y++) {
                    const s0 = y * cw + rx0,
                        s1 = y * cw + rx1 + 1;
                    depth.fill(Infinity, s0, s1);
                    if (depthOwner) depthOwner.fill(0, s0, s1);
                    if (depthFace) depthFace.fill(0, s0, s1);
                }
            }
            if (hasStatic) {
                // 静止面の範囲外も含めて矩形の全行を復元する。
                // 静止バッファの範囲外は Infinity / 0 で初期化済み。
                // 範囲内の行だけコピーすると、移動前の上部の深度が残り、
                // 見上げたとき別のオブジェクトの線を誤って隠してしまう。
                for (let y = ry0; y <= ry1; y++) {
                    const s0 = y * cw + rx0,
                        s1 = y * cw + rx1 + 1;
                    depth.set(depthStatic.buf.subarray(s0, s1), s0);
                    if (depthOwner) depthOwner.set(depthStatic.owner.subarray(s0, s1), s0);
                    if (depthFace) depthFace.set(depthStatic.face.subarray(s0, s1), s0);
                }
            }
        }
        const used = { y0: Infinity, y1: -Infinity, x0: Infinity, x1: -Infinity };
        rasterizeDepthInto(depth, depthOwner, ownerMap, [moving], cw, ch, tf, used, window.__noFaceBuf ? null : depthFace);
        depthMovingUsedY0 = used.y0;
        depthMovingUsedY1 = used.y1;
        depthMovingRect = Number.isFinite(used.x0)
            ? { x0: used.x0, y0: Math.max(0, used.y0), x1: used.x1, y1: Math.min(ch - 1, used.y1) }
            : nowRect;
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
        if (depthFace) depthFace.fill(0, ry0, ry1);
    }
    depthUsedY0 = Infinity;
    depthUsedY1 = -Infinity;
    depthMovingUsedY0 = Infinity;
    depthMovingUsedY1 = -Infinity;
    depthMovingRect = null;
    const used = { y0: Infinity, y1: -Infinity, x0: Infinity, x1: -Infinity };
    rasterizeDepthInto(depth, depthOwner, ownerMap, objs, cw, ch, tf, used, window.__noFaceBuf ? null : depthFace);
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
// その画素が「形の輪郭の上」かどうか。左右3画素の奥行きを比べ、
// 片側だけ何も無い（または線よりずっと奥）なら輪郭とみなす。
// 面と面の取り合い（両側とも面）は輪郭ではないので false。
function silhouetteAt(depth, cw, ch, x, y, d) {
    const side = (dx) => {
        const sx = x + dx;
        if (sx < 0 || sx >= cw) return Infinity;
        const z = depth[y * cw + sx];
        return Number.isFinite(z) ? z : Infinity;
    },
        a = side(-3) - d,
        b = side(3) - d;
    return (a > 0.5 && b < 0.05) || (b > 0.5 && a < 0.05);
}
// 線が「自分の形の端（外形）」の上にあるか。
// ベベルの縦線のように、奥行きバッファでは判定できない輪郭がある
// （丸めた面が輪郭の所で急に手前に出るため、線より面のほうが手前になる）。
// そこで奥行きではなく「その画素を塗っているのが自分かどうか」で見る。
// 左右（または上下）±3px の片側だけが自分の面なら、線は形の端にある。
// 反対側が「自分より手前の別の物」なら隠れるので描かない（隠線の正しさは保つ）。
function shapeEdgeAt(depth, cw, ch, x, y, d, owner) {
    if (!depthOwner) return false;
    const at = (dx, dy) => {
        const xx = x + dx,
            yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= cw || yy >= ch) return { self: false, z: Infinity };
        const i = yy * cw + xx,
            z = depth[i];
        return { self: depthOwner[i] === owner, z: Number.isFinite(z) ? z : Infinity };
    };
    const pairs = [
        [at(-3, 0), at(3, 0)],
        [at(0, -3), at(0, 3)],
    ];
    for (const [p1, p2] of pairs) {
        if (p1.self === p2.self) continue;
        const far = p1.self ? p2 : p1;
        // 反対側が背景（何も無い）か、線より奥なら、その端は見えている。
        if (far.z >= d - 0.05) return true;
    }
    return false;
}
// 線が「1枚の平らな面の内側」にあるか（＝面ONでは描かなくてよい線）。
// ±r の範囲がすべて同じ面ID・同じ持ち主なら、その線は面の内側を通っている。
// 面の端（縁）では必ず別の面か背景が混ざるので、輪郭の線は消えない。
// 厚みが1画素未満の細い部材（笠木・スラブ）も、まわりに別の面が出るので残る。
// 速さのため、まわりの画素は「環」の8点だけ見る（25点は不要。実測で差なし）。
const INTERIOR_RING = [
    [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1],
];
function interiorOfFace(cw, ch, x, y, r, owner) {
    if (!depthFace || !depthOwner) return false;
    const f0 = depthFace[y * cw + x];
    if (!f0) return false;
    for (let k = 0; k < INTERIOR_RING.length; k++) {
        const xx = x + INTERIOR_RING[k][0] * r,
            yy = y + INTERIOR_RING[k][1] * r;
        if (xx < 0 || yy < 0 || xx >= cw || yy >= ch) return false;
        const i = yy * cw + xx;
        if (depthFace[i] !== f0 || depthOwner[i] !== owner) return false;
    }
    return true;
}
// 動いている1台の画面矩形（デバイスpx）。奥行きバッファの塗り直し範囲を決める。
// 三角形の投影だけを見るので、ラスタライズよりずっと安い。
function movingRectOf(o, cw, ch, tf) {
    const tris = surfaceTriangles(o);
    let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
    for (let i = 0; i < tris.length; i++) {
        const tr = tris[i];
        for (let j = 0; j < 3; j++) {
            const p = exportPoint(tr[j], tf || [1, 0, 0, 1, 0, 0]);
            if (!p) continue;
            if (p.x < x0) x0 = p.x;
            if (p.x > x1) x1 = p.x;
            if (p.y < y0) y0 = p.y;
            if (p.y > y1) y1 = p.y;
        }
    }
    if (!Number.isFinite(x0)) return { x0: 0, y0: 0, x1: cw - 1, y1: ch - 1 };
    // 2px の余白（輪郭の取りこぼし防止）と画面内外の丸め。
    return {
        x0: Math.max(0, Math.floor(x0) - 2),
        y0: Math.max(0, Math.floor(y0) - 2),
        x1: Math.min(cw - 1, Math.ceil(x1) + 2),
        y1: Math.min(ch - 1, Math.ceil(y1) + 2),
    };
}
// その画素の面ID（0 は「面が無い」）。
function faceIdAt(cw, ch, x, y) {
    if (!depthFace) return 0;
    if (x < 0 || x >= cw || y < 0 || y >= ch) return 0;
    return depthFace[y * cw + x];
}
// 「線が面の内側にある」かの判定に使う、線から横へはなれた距離（px）。
// 3px だけだと、線が面の端に近いときに「今回は内側・次は外側」と判定が揺れて
// 線が破線状に途切れる（実測：1場面で42か所）。少し広い距離も一緒に見て、
// すべてが同じ面のときだけ「面の内側」と判断する（判定が線に沿って安定する）。
const FACE_CULL_OFFSETS = window.__cullOffsets || [3];
// 「線が自分の面の内側にある」かの判定。
// 面IDは平面の式から作るので、**別々のオブジェクトが同じ平面上に並んでいると同じIDになる**
// （例：隣り合う建物の正面が同じ z にある）。オブジェクトの区別を入れないと、
// その境目の縦線を「平面の内側の線」と誤って消してしまい、線が点線状に途切れる
// （実測：2棟の正面が同じ平面のとき、境目の縦線が 6px おきの点線になった）。
// そこで「同じオブジェクトの、同じ面」だけを内側とみなす。
// 【重要】奥行きバッファを「線の正確な画面位置」で読む（双一次補間）。
// 画素に丸めて読むと、ほぼ真横を向いた面（画面上で 1px 進むあいだに奥行きが
// 数十cm変わる面）では、丸めの分だけで線が「面より奥」に見えてしまう。
// その結果、面の上を走る稜線が 1〜2px おきに消え、**点線状**になっていた
// （実測：屋台まわりの縦稜線。奥行きの食い違い 0.013m／画素あたりの変化 0.19m）。
// 線の位置（小数のまま）で面の奥行きを補間して比べれば、面の上の線は
// 面と同じ奥行きになるので、丸めに左右されない。
function depthAtPoint(depth, cw, ch, px, py) {
    // 画素の中心は (整数+0.5)。px,py もその座標系。
    const gx = px - 0.5,
        gy = py - 0.5,
        x0 = Math.floor(gx),
        y0 = Math.floor(gy),
        tx = gx - x0,
        ty = gy - y0;
    let sum = 0,
        wsum = 0;
    for (let j = 0; j <= 1; j++) {
        const yy = y0 + j;
        if (yy < 0 || yy >= ch) continue;
        const wy = j ? ty : 1 - ty;
        if (!(wy > 0)) continue;
        for (let i = 0; i <= 1; i++) {
            const xx = x0 + i;
            if (xx < 0 || xx >= cw) continue;
            const wi = i ? tx : 1 - tx;
            if (!(wi > 0)) continue;
            const v = depth[yy * cw + xx];
            if (!Number.isFinite(v)) continue;
            const w = wi * wy;
            sum += v * w;
            wsum += w;
        }
    }
    // まわりに面が1つも無ければ「奥」＝手前扱い（線は見える）。
    return wsum > 0 ? sum / wsum : Infinity;
}
function faceCullAround(cw, ch, x, y, f0, owner) {
    for (let i = 0; i < FACE_CULL_OFFSETS.length; i++) {
        const d = FACE_CULL_OFFSETS[i];
        for (let k = 0; k < 4; k++) {
            const nx = x + (k === 0 ? -d : k === 1 ? d : 0),
                ny = y + (k === 2 ? -d : k === 3 ? d : 0);
            if (faceIdAt(cw, ch, nx, ny) !== f0) return false;
            if (depthOwner && depthOwner[ny * cw + nx] !== owner) return false;
        }
    }
    return true;
}
// 面と面が接していると見なす距離（m）。これより奥の線は近くの画素を見ずに隠す。
const CONTACT_REACH = 0.05;
// 面と面が接している線（壁の下端と台の上面など）は、面をほぼ真横から見ているため
// 1画素の中でも奥行きが大きく変わる。中心の画素だけで判定すると点線状に欠けるので、
// 近くの画素の奥行きの「ばらつき」も見て判定する（真横に近い面ほど許容を広げる）。
// まわり（±3px）の画素にある面の奥行きの「いちばん奥」を返す。
// 線の奥行きがこれ以下なら、線はその範囲の中（＝面の輪郭の上）にある。
// 面を真横から見ているときの「1画素で数m変わる」食い違いを、丸めに左右されずに扱うため。
const RANGE_WIN = 3;
function silhouetteRange(depth, cw, ch, x, y, d) {
    let zmax = -Infinity;
    for (let dy = -RANGE_WIN; dy <= RANGE_WIN; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= ch) continue;
        const row = yy * cw;
        for (let dx = -RANGE_WIN; dx <= RANGE_WIN; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= cw) continue;
            const v = depth[row + xx];
            if (v > zmax) zmax = v;
        }
    }
    // 範囲内に面がまったく無ければ Infinity（線は背景にある＝描く）。
    return Number.isFinite(zmax) ? zmax : Infinity;
}
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
    if (!Number.isFinite(zmax)) return false; // まわりに面がまったく無い
    if (!(zmax >= d - eps)) return false;
    // 面を真横から見ている（近くの画素で奥行きが大きく違う）ときは、
    // ばらつきの 3/4 までを「面の上に乗っている」と見なす。上限 25cm。
    if (!Number.isFinite(zmin)) return false;
    const tol = Math.min(0.25, Math.max(eps, (zmax - zmin) * 0.75));
    return d <= zmin + tol;
}
// ベベルの縦線（s.seam）を「輪郭の1本」だけ描くための判定。
// 丸めた角の縦線は、弧の上に何本も並ぶ。全部描くと角が黒く潰れ、
// かといって全部消すと形の端（左右の輪郭）が抜ける。
// そこで1つの角につき「いちばん輪郭に近い1本」だけを選ぶ。
// 輪郭かどうかは、線の左右5pxの奥行きを深度バッファ（隠線と同じもの）で比べ、
// 片側だけ何も無い（またはずっと奥）なら輪郭、両側とも面なら面の中、と判断する。
const SEAM_OFF = 5,
    SEAM_BG = 2; // 背景（面が無い）を表すための倍率
// 【重要】以前は線の「中点」だけで比べていた。長い縦線では中点が面の真ん中に
// 来ることが多く、上端・下端が輪郭になっていても「面の中」と判定されていた
// （実測：丸めた角から屋根の面まで下りる縦線が丸ごと消えた）。
// そこで線に沿って7点を調べ、「何割の点で左右の奥行きが大きく違うか（＝輪郭か）」を返す。
function seamEdgeScore(a, b, depth, cw, ch) {
    const mz = (a.depth + b.depth) / 2,
        cap = Math.abs(mz) * SEAM_BG + 1,
        dx = b.x - a.x,
        dy = b.y - a.y,
        len = Math.hypot(dx, dy) || 1,
        // 線に直角の向き（画面座標）。縦線ならほぼ水平。
        px = -dy / len,
        py = dx / len,
        // 線の奥行きの許容（m）。
        tol = Math.max(0.3, Math.abs(mz) * 0.03),
        at = (x0, y0, k, dep) => {
            const x = Math.round(x0 + px * k),
                y = Math.round(y0 + py * k);
            if (x < 0 || y < 0 || x >= cw || y >= ch) return cap;
            const z = depth[y * cw + x];
            return Number.isFinite(z) ? Math.min(z, cap) : cap;
        },
        depthAbs = (x0, y0) => {
            const x = Math.round(x0),
                y = Math.round(y0);
            if (x < 0 || y < 0 || x >= cw || y >= ch) return Infinity;
            return depth[y * cw + x];
        },
        faceAt = (x0, y0, k) => {
            const x = Math.round(x0 + px * k),
                y = Math.round(y0 + py * k);
            if (x < 0 || y < 0 || x >= cw || y >= ch) return 0;
            return depthFace ? depthFace[y * cw + x] : 0;
        };
    let edge = 0,
        vis = 0;
    const N = 9;
    for (let i = 1; i <= N; i++) {
        const t = i / (N + 1),
            x0 = a.x + dx * t,
            y0 = a.y + dy * t,
            zLine = a.depth + (b.depth - a.depth) * t;
        const jump = Math.max(0.25, Math.abs(mz) * 0.04);
        // (1) 左右で奥行きが大きく違う＝輪郭。ベベル帯が狭いとき複数の候補線が 5px 以内に並ぶため、
        //     より外縁ギリギリ（±1px / ±2px でも奥行き差が出る本当のシルエット線）を高く評価する。
        if (Math.abs(at(x0, y0, SEAM_OFF) - at(x0, y0, -SEAM_OFF)) >= jump) {
            edge += Math.abs(at(x0, y0, 1) - at(x0, y0, -1)) >= jump ? 1.35 : Math.abs(at(x0, y0, 2) - at(x0, y0, -2)) >= jump ? 1.2 : 1;
        }
        // (2) 左右で面の番号が違う＝面と面の折れ目（丸めた角の縦線はこちら）。
        else {
            const f1 = faceAt(x0, y0, SEAM_OFF),
                f2 = faceAt(x0, y0, -SEAM_OFF);
            if (f1 && f2 && f1 !== f2) edge += 0.5;
        }
        // この点が隠れていないか。背景（面が無い）か、線とほぼ同じ奥行きなら見えている。
        const zBuf = depthAbs(x0, y0);
        if (!Number.isFinite(zBuf) || zBuf >= zLine - tol) vis++;
    }
    return { edge: edge / N, vis: vis / N };
}
let seamPicks = null;
function updateSeamPicks(depth, cw, ch, tf) {
    const best = new Map();
    seamPicks = null;
    for (let i = 0; i < S.length; i++) {
        const s = S[i];
        if (s.seam === undefined || s.seam === null || !s.p) continue;
        if (!s.ob || !objectVisible(s.ob)) continue;
        const a = exportPoint(s.p[0], tf),
            b = exportPoint(s.p[s.p.length - 1], tf);
        if (!a || !b) continue;
        // 背景は cap で頭打ちにしているので、輪郭では mz(以上) の差が出る。
        // 角1つにつき1本だけ選ぶ。選ぶ基準は
        // ・輪郭／折れ目の割合（edge）
        // ・その線が実際に見えている割合（vis）
        // の両方。以前は中点の奥行き差だけで選んでいたため、**隠れている線**が
        // 選ばれて描かれず、見えている縦線が捨てられていた（実測：屋根の張り出しの
        // 左右の角で、前側の縦線が丸ごと欠けた）。
        const sc = seamEdgeScore(a, b, depth, cw, ch),
            score = sc.edge * 0.6 + sc.vis * 0.4,
            key = (s.ob.id || "") + ":" + (s.arraySeamKey ? s.arraySeamKey + ":" : "") + s.seam,
            cur = best.get(key);
        if (!cur || score > cur.score) best.set(key, { score, vis: sc.vis, s, mz: (a.depth + b.depth) / 2 });
    }
    const picks = new Set(),
        th = window.__seamTh === undefined ? 0.25 : Number(window.__seamTh);
    best.forEach((v) => {
        // 差が小さい＝両側とも面＝面の中なので描かない。
        // 見えている部分がある線だけを描く（隠れている線を選んでしまうのを防ぐ）。
        if (v.vis > 0 && v.score >= th) picks.add(v.s);
    });
    seamPicks = picks;
}
// ===== 線を「色×太さ」ごとにまとめて引く =====
// 線を1本ずつ描く（まとめて stroke する方式は実測で高速化にならず、
// 交差部の濃さが変わるため採用しなかった。ドキュメント §5Z-5）。
// 二値化するときの「線の最小の太さ（デバイスpx）」と、そのときの拡大率。
// 二値化はアルファを 0/255 に落とすので、1px 前後の細い線はしきい値の上下で
// 破線状に欠ける（実測：拡大1.0で 357か所の欠け）。二値化する層だけ、
// 線が最低 1.15px の芯を持つように太らせて描く（画面の見た目はほぼ変わらない）。
let lineDevMin = 0,
    lineDevMinScale = 1;
function layerLineWidth(s) {
    const base = effectiveLineWidth(s);
    if (!(lineDevMin > 0)) return base;
    return Math.max(base, lineDevMin / Math.max(0.05, lineDevMinScale));
}
// 魚眼は平面の画面像が曲がるため、三角形頂点の直線補間だけでは
// 面と線の奥行きがずれる。線の試験点に対して実際の三角面への光線を使う。
let fishLineOccluders = null, fishBvhCache = null, fishBlockedPixels = null, fishBlockedWidth = 0, fishBlockedHeight = 0, fishOcclusionEpoch = 0, fishVisiblePixels = null, fishLineSerial = 0, fishCurrentLine = 0;
function prepareFishLineOccluders() {
    const cam = camPos();
    // 線分数ではなく一意なオブジェクト数だけ走査して状態を確認する。
    // S同一のままオブジェクト値が直接変更された場合も、シリアライズキーで取りこぼさない。
    const sourceObjects = typeof sceneObjects === "function"
            ? sceneObjects()
            : [...new Map(S.filter(s => s?.ob).map(s => [s.ob.id, s.ob])).values()],
        objects = [];
        for (const o of sourceObjects) {
            if (!o || !objectVisible(o)) continue;
            // syncAttachedPart は新しいオブジェクトを返す。親の移動後に更新された値を
            // 三角面生成へ渡す。オブジェクト単位で走査し、線の重複数に影響されない。
            objects.push(o.attachment && typeof syncAttachedPart === "function" ? syncAttachedPart(o) : o);
        }
    const key = objects.map((o) => o.id + ":" + surfaceCacheKey(o)).join("|");
    if (!fishBvhCache || fishBvhCache.key !== key) {
        const records = [];
        for (const o of objects) for (const t of surfaceTriangles(o)) {
            const a=t[0], e1=V.add(t[1],a,1,-1), e2=V.add(t[2],a,1,-1),
                lo=[0,1,2].map(i=>Math.min(t[0][i],t[1][i],t[2][i])-1e-7),
                hi=[0,1,2].map(i=>Math.max(t[0][i],t[1][i],t[2][i])+1e-7);
            let normal = V.crs(e1, e2), length = Math.hypot(...normal);
            if (length > 1e-9) normal = normal.map((v) => v / length);
            if (Math.abs(normal[0]) >= Math.abs(normal[1]) && Math.abs(normal[0]) >= Math.abs(normal[2]) ? normal[0] < 0 : Math.abs(normal[1]) >= Math.abs(normal[2]) ? normal[1] < 0 : normal[2] < 0) normal = normal.map((v) => -v);
            const plane = normal.map((v) => (Math.abs(v) < 0.0005 ? 0 : v).toFixed(3)).join(",") + "," +
                (Math.abs(V.dot(normal, a)) < 0.005 ? 0 : V.dot(normal, a)).toFixed(2);
            records.push({a,e1,e2,lo,hi,mid:lo.map((v,i)=>(v+hi[i])*0.5),owner:o.id,plane});
        }
        const makeNode = (items) => {
            if (!items.length) return null;
            const lo=[Infinity,Infinity,Infinity], hi=[-Infinity,-Infinity,-Infinity];
            for(const r of items) for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],r.lo[i]);hi[i]=Math.max(hi[i],r.hi[i]);}
            if(items.length<=8) return {lo,hi,items};
            const lengths=lo.map((v,i)=>hi[i]-v), axis=lengths[0]>=lengths[1]&&lengths[0]>=lengths[2]?0:lengths[1]>=lengths[2]?1:2;
            items.sort((a,b)=>a.mid[axis]-b.mid[axis]);
            const mid=items.length>>1;
            return {lo,hi,left:makeNode(items.slice(0,mid)),right:makeNode(items.slice(mid))};
        };
        fishBvhCache = {scene:S,key,records,root:makeNode(records.slice()),camKey:""};
    }
    const camKey = cam[0] + "," + cam[1] + "," + cam[2];
    if (fishBvhCache.camKey !== camKey) {
        fishBvhCache.camKey = camKey;
        for (const r of fishBvhCache.records) {
            const v=[cam[0]-r.a[0],cam[1]-r.a[1],cam[2]-r.a[2]], e1=r.e1, e2=r.e2,
                q=[v[1]*e1[2]-v[2]*e1[1],v[2]*e1[0]-v[0]*e1[2],v[0]*e1[1]-v[1]*e1[0]];
            r.v=v;r.q=q;r.n=e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2];
        }
    }
    fishLineOccluders={root:fishBvhCache.root,cam};
    fishOcclusionEpoch++;
}
const fishBvhStack=[], fishRayInverse=[0,0,0];
function fishPointOccluded(e) {
    if (e.fishEpoch === fishOcclusionEpoch) return e.fishBlocked;
    e.fishEpoch = fishOcclusionEpoch;
    const set=fishLineOccluders;
    if (!set || !set.root) return (e.fishBlocked=false);
    const dir=unscr({x:e.sx,y:e.sy}), dx=dir[0],dy=dir[1],dz=dir[2], limit=e.depth - Math.max(0.008, Math.abs(e.depth)*0.0002),
        inv=fishRayInverse, cam=set.cam;
    // 走査は同期的なので逆方向の配列を再利用し、点ごとの小配列を作らない。
    inv[0]=Math.abs(dx)<1e-14?Infinity:1/dx;
    inv[1]=Math.abs(dy)<1e-14?Infinity:1/dy;
    inv[2]=Math.abs(dz)<1e-14?Infinity:1/dz;
    fishBvhStack.length=0;fishBvhStack.push(set.root);
    while(fishBvhStack.length) {
        const node=fishBvhStack.pop();let near=0,far=limit,hit=true;
        for(let i=0;i<3;i++){
            if(!Number.isFinite(inv[i])){if(cam[i]<node.lo[i]||cam[i]>node.hi[i]){hit=false;break;}continue;}
            const a=(node.lo[i]-cam[i])*inv[i],b=(node.hi[i]-cam[i])*inv[i];
            near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(far<near){hit=false;break;}
        }
        if(!hit)continue;
        if(!node.items){if(node.left)fishBvhStack.push(node.left);if(node.right)fishBvhStack.push(node.right);continue;}
        for(const r of node.items) {
            const h0=dy*r.e2[2]-dz*r.e2[1], h1=dz*r.e2[0]-dx*r.e2[2], h2=dx*r.e2[1]-dy*r.e2[0],
                det=r.e1[0]*h0+r.e1[1]*h1+r.e1[2]*h2;
            if(Math.abs(det)<1e-10) continue;
            const k=1/det, u=(r.v[0]*h0+r.v[1]*h1+r.v[2]*h2)*k;
            if(u < -1e-8 || u > 1+1e-8) continue;
            const v=(dx*r.q[0]+dy*r.q[1]+dz*r.q[2])*k;
            if(v < -1e-8 || u+v > 1+1e-8) continue;
            const distance=r.n*k;
            if(distance>0.0001 && distance<limit) {
                if (fishBlockedPixels) {
                    const x=Math.round(e.x),y=Math.round(e.y);
                    for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
                        const xx=x+dx, yy=y+dy;
                        if(xx>=0&&xx<fishBlockedWidth&&yy>=0&&yy<fishBlockedHeight) {
                            const i=yy*fishBlockedWidth+xx;
                            if (!fishBlockedPixels[i]) fishBlockedPixels[i]=fishCurrentLine;
                        }
                    }
                }
                return (e.fishBlocked=true);
            }
        }
    }
    return (e.fishBlocked=false);
}
// 正投影は視点が点ではなく平行光線。ポール上端や灯器・標識の細い縁を
// 実面で判定し、重なっている部分が深度許容で透けるのを防ぐ。
function signalOrthOccluded(e, allowance = 0.008) {
    if (e.poleEpoch === fishOcclusionEpoch) return e.poleBlocked;
    e.poleEpoch = fishOcclusionEpoch;
    const root=fishLineOccluders?.root;
    if (!root) return (e.poleBlocked=false);
    const dir=orthBasis().depth, base=orthWorldAt({x:e.sx,y:e.sy},camPos()),
        point=base.map((v,i)=>v+dir[i]*e.depth),
        distance=2+Math.hypot(...root.lo.map((v,i)=>Math.max(Math.abs(v-point[i]),Math.abs(root.hi[i]-point[i])))),
        origin=point.map((v,i)=>v-dir[i]*distance),
        inv=dir.map(v=>Math.abs(v)<1e-14?Infinity:1/v),limit=distance-allowance;
    // 魚眼と同じ同期走査スタックを再利用。三角面ごとの一時ベクトルを作らず、
    // 以前の外積・内積と同じ順序でスカラー演算する。
    const stack=fishBvhStack, dx=dir[0],dy=dir[1],dz=dir[2];
    stack.length=0;stack.push(root);
    while(stack.length){
        const node=stack.pop();let near=0,far=limit,hit=true;
        for(let i=0;i<3;i++){
            if(!Number.isFinite(inv[i])){if(origin[i]<node.lo[i]||origin[i]>node.hi[i]){hit=false;break;}continue;}
            const a=(node.lo[i]-origin[i])*inv[i],b=(node.hi[i]-origin[i])*inv[i];
            near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(far<near){hit=false;break;}
        }
        if(!hit)continue;
        if(!node.items){if(node.left)stack.push(node.left);if(node.right)stack.push(node.right);continue;}
        for(const r of node.items){
            const h0=dy*r.e2[2]-dz*r.e2[1],h1=dz*r.e2[0]-dx*r.e2[2],h2=dx*r.e2[1]-dy*r.e2[0],
                det=r.e1[0]*h0+r.e1[1]*h1+r.e1[2]*h2;
            if(Math.abs(det)<1e-10)continue;
            const t0=origin[0]*1+r.a[0]*-1,t1=origin[1]*1+r.a[1]*-1,t2=origin[2]*1+r.a[2]*-1,
                invDet=1/det,u=(t0*h0+t1*h1+t2*h2)*invDet;
            if(u< -1e-8||u>1+1e-8)continue;
            const q0=t1*r.e1[2]-t2*r.e1[1],q1=t2*r.e1[0]-t0*r.e1[2],q2=t0*r.e1[1]-t1*r.e1[0],
                v=(dx*q0+dy*q1+dz*q2)*invDet;
            if(v< -1e-8||u+v>1+1e-8)continue;
            const hitDistance=(r.e2[0]*q0+r.e2[1]*q1+r.e2[2]*q2)*invDet;
            if(hitDistance>0.0001&&hitDistance<limit)return(e.poleBlocked=true);
        }
    }
    return(e.poleBlocked=false);
}
// 面内線を消す場合だけ、線の周囲が本当に同じ平面なのか光線でも確かめる。
// 魚眼の直線三角形ラスタでは、実際には角の外側にある点も面内に見えるため。
function fishNearestSurface(x, y, tf) {
    const det = tf[0] * tf[3] - tf[1] * tf[2];
    if (Math.abs(det) < 1e-12 || !fishLineOccluders?.root) return null;
    const px = x - tf[4], py = y - tf[5],
        dir = wld(bf({x: (tf[3] * px - tf[2] * py) / det, y: (-tf[1] * px + tf[0] * py) / det})),
        dx = dir[0], dy = dir[1], dz = dir[2], cam = fishLineOccluders.cam,
        inv = dir.map((v) => Math.abs(v) < 1e-14 ? Infinity : 1 / v);
    let distance = Infinity, found = null;
    fishBvhStack.length = 0;
    fishBvhStack.push(fishLineOccluders.root);
    while (fishBvhStack.length) {
        const node = fishBvhStack.pop();
        let near = 0, far = distance, hit = true;
        for (let i = 0; i < 3; i++) {
            if (!Number.isFinite(inv[i])) {
                if (cam[i] < node.lo[i] || cam[i] > node.hi[i]) { hit = false; break; }
                continue;
            }
            const a = (node.lo[i] - cam[i]) * inv[i], b = (node.hi[i] - cam[i]) * inv[i];
            near = Math.max(near, Math.min(a, b));
            far = Math.min(far, Math.max(a, b));
            if (far < near) { hit = false; break; }
        }
        if (!hit) continue;
        if (!node.items) {
            if (node.left) fishBvhStack.push(node.left);
            if (node.right) fishBvhStack.push(node.right);
            continue;
        }
        for (const r of node.items) {
            const h0 = dy*r.e2[2] - dz*r.e2[1], h1 = dz*r.e2[0] - dx*r.e2[2], h2 = dx*r.e2[1] - dy*r.e2[0],
                d = r.e1[0]*h0 + r.e1[1]*h1 + r.e1[2]*h2;
            if (Math.abs(d) < 1e-10) continue;
            const k = 1 / d, u = (r.v[0]*h0 + r.v[1]*h1 + r.v[2]*h2) * k;
            if (u < -1e-8 || u > 1 + 1e-8) continue;
            const v = (dx*r.q[0] + dy*r.q[1] + dz*r.q[2]) * k;
            if (v < -1e-8 || u + v > 1 + 1e-8) continue;
            const t = r.n * k;
            if (t > 0.0001 && t < distance) { distance = t; found = r; }
        }
    }
    return found ? {owner:found.owner, plane:found.plane, distance} : null;
}
function fishFaceInterior(e, owner, tf) {
    const center = fishNearestSurface(e.x, e.y, tf);
    if (!center || center.owner !== owner || Math.abs(e.depth - center.distance) > Math.max(0.03, e.depth * 0.002)) return false;
    for (const d of FACE_CULL_OFFSETS) for (const [x,y] of [[-d,0],[d,0],[0,-d],[0,d]]) {
        const neighbor = fishNearestSurface(e.x + x, e.y + y, tf);
        if (!neighbor || neighbor.owner !== owner || neighbor.plane !== center.plane) return false;
    }
    return true;
}
function strokeWVisible(c, s, depth, cw, ch, tf) {
    fishCurrentLine = ++fishLineSerial;
    // 壁付けベランダの補助線は、穴のない床スラブの内部に全区間が埋まる。
    // 隠線表示では見えない線なので、厚みが1〜2画素以下でも漏らさない。
    if (s.balconyEmbeddedSupport === true && s.ob?.asset === "balcony" && !window.__showBalconyEmbedded) return;
    // ベベルの縦線は、選ばれた「輪郭の1本」だけを描く。
    const seamLine = s.seam !== undefined && s.seam !== null;
    if (seamLine && !(seamPicks && seamPicks.has(s))) return;
    if (!s.ob || !s.d3) {
        strokeW(c, s);
        return;
    }
    const wallAlpha=c.globalAlpha;if(s.roomShellWallSide&&roomShellCameraCuts(s.ob).walls.has(s.roomShellWallSide))c.globalAlpha=wallAlpha*.12;
    c.strokeStyle = s.c;
    c.lineWidth = layerLineWidth(s);
    c.lineCap = c.lineJoin = "round";
    c.beginPath();
    let on = false;
    const myOwner = depthOwnerMap.get(s.ob.id) || 0;
    // 【重要】面の上へ意図的に描く線（凹窓の窓間仕切りなど）。
    // 面の内側を通る線は「重なった線」として消すのが基本だが、窓の桟のように
    // 面の上へ描くことを目的にした線まで消えると、窓の枚数を変えても
    // 何も描かれない（実測：凹窓階層建物の窓間仕切りが全部消えていた）。
    // 生成側が onFace を立てた線だけ、面の内側判定を通す。
    const onFace = !!s.onFace,
        preciseSignalEdge = (s.signalPoleTopRing && !window.__legacyPoleRay) || (s.signalSmoothSide && !window.__legacySignalSmoothRay) || !!s.preciseTubeEdge || !!s.arrayGeometry,
        poleTip = s.signalPoleSide && !window.__legacyPoleRay && s.p?.length ? projPoint(s.p[s.p.length-1], tf) : null,
        preciseSignalAt = e => preciseSignalEdge || !!(poleTip?.ok && Math.hypot(e.x-poleTip.x,e.y-poleTip.y) < 24*Math.max(1,Math.abs(tf[0] || 1)));
    // 線全体を数点だけ見て省略すると、試験点の間にある開口や遮蔽物の切れ目で
    // 見える区間まで丸ごと消える。面の内側・背面は下の点ごとの判定で除去する。
    const okx = tf[0] || 1,
        oky = tf[3] || 1;
    // 画面座標・奥行き・（必要なら近くの画素）から、この点を描いてよいか決める。
    // 確実に手前の面に覆われた点。断片の橋渡しでも同じ判定を使い、
    // 本当の遮蔽物を短いノイズとして埋めてしまわない。
    const exactPerspectiveOccluded = (e) => {
        if (e.accordionEpoch !== fishOcclusionEpoch) {
            const ray=unscr({x:e.sx,y:e.sy}), forward=cam(ray)[2];
            e.accordionEpoch=fishOcclusionEpoch;
            e.accordionBlocked=forward>1e-9 && fishPointOccluded({sx:e.sx,sy:e.sy,depth:e.depth/forward});
        }
        return e.accordionBlocked;
    };
    const definitelyOccluded = (e) => {
        // 実面への光線交差で遮蔽が確定した点は、短い隙間として橋渡ししない。
        if (fishLineOccluders && e.accordionEpoch === fishOcclusionEpoch && e.accordionBlocked === true) return true;
        if (fishLineOccluders && preciseSignalAt(e) &&
            (orthView ? signalOrthOccluded(e, (s.signalSmoothSide || s.preciseTubeEdge) ? 0.004 : 0.008) : T !== "f" && exactPerspectiveOccluded(e))) return true;
        const x = Math.round(e.x), y = Math.round(e.y);
        if (x < 0 || x >= cw || y < 0 || y >= ch) return false;
        if (!orthView && T === "f" && fishLineOccluders && !window.__legacyFishLines) return fishPointOccluded(e);
        // 【重要】「まわりの画素すべてが、この線よりはっきり手前の平らな面」なら、
        // その点は隠れる面の内側にある。同じオブジェクトの面かどうかに関係なく隠す。
        // これが無いと、階層建物の縁（張り出した帯）の奥にある壁の稜線が、
        // 「自分の面だから」という理由で残っていた（実測：縁の反対側の線が
        // 0.4〜4.4m 奥なのに描かれていた）。下の「自分の面」系の緩い判定より先に見る。
        if (!window.__noOccl && (!onFace || s.occludeSelf || !depthOwner || depthOwner[y * cw + x] !== myOwner)) {
            const sameOwner = depthOwner && depthOwner[y * cw + x] === myOwner,
                selfAllowance = onFace && sameOwner ? Math.max(0, Number(s.selfOcclusionAllowance) || 0) : 0,
                occTol = Math.max(0.03, Math.abs(e.depth) * 0.002, selfAllowance);
            let near9 = 0,
                bg = 0,
                zMin = Infinity,
                zMax = -Infinity;
            for (let dy = -1; dy <= 1; dy++) {
                const yy = y + dy;
                if (yy < 0 || yy >= ch) {
                    bg++;
                    continue;
                }
                for (let dx = -1; dx <= 1; dx++) {
                    const xx = x + dx;
                    if (xx < 0 || xx >= cw) {
                        bg++;
                        continue;
                    }
                    const zz = depth[yy * cw + xx];
                    if (!Number.isFinite(zz)) {
                        bg++;
                        continue;
                    }
                    if (zz < e.depth - occTol) near9++;
                    if (zz < zMin) zMin = zz;
                    if (zz > zMax) zMax = zz;
                }
            }
            // 面をほぼ真横から見ている所（1画素で奥行きが大きく変わる）では
            // 判定しない。平らな面に囲まれているときだけ「隠れている」と決める。
            if (!bg && near9 === 9 && zMax - zMin <= Math.max(0.10, Math.abs(e.depth) * 0.02)) return true;
        }
        return false;
    };
    const accept = (e) => {
        const x = Math.round(e.x),
            y = Math.round(e.y);
        if (x < 0 || x >= cw || y < 0 || y >= ch) return false;
        // 画素の奥行きは、線の正確な位置で補間して読む（丸めで点線にならないように）。
        // 面の持ち主・面IDは一番近い画素のものを使う（面の内外の判定用）。
        const i1 = y * cw + x,
            z = window.__noDepthInterp ? depth[i1] : depthAtPoint(depth, cw, ch, e.x, e.y);
        if (!orthView && T === "f" && fishLineOccluders && !window.__legacyFishLines) {
            if (fishPointOccluded(e)) return false;
            if (!onFace && !window.__noFaceCull && depthOwner?.[i1] === myOwner && depthFace?.[i1] &&
                faceCullAround(cw, ch, x, y, depthFace[i1], myOwner) && fishFaceInterior(e, s.ob.id, tf)) return false;
            return true;
        }
        if (fishLineOccluders && preciseSignalAt(e))
            return !(orthView ? signalOrthOccluded(e, (s.signalSmoothSide || s.preciseTubeEdge) ? 0.004 : 0.008) : exactPerspectiveOccluded(e));
        // 小さな灯器や自販機の前後ベベルは、細い曲面の隣で深度近似だけでは
        // 背面の線が漏れることがある。面より奥の候補だけ実光線で再判定する。
        if (!orthView && T !== "f" && s.depthBevelEdge && fishLineOccluders && !window.__legacyDepthBevelRay &&
            Number.isFinite(z) && e.depth > z + CG.depthEps(e.depth) && exactPerspectiveOccluded(e)) return false;
        // 線がその面より「はっきり手前」なら、面の内側の線ではない（見える線）。
        // 奥行きバッファは 1画素より細い部材（手すり・スラブ・笠木）を
        // 持たないことがあり、その稜線は面より 10〜30cm 手前になる。
        // これを「面の上にある線」と同じ扱いにすると、線が丸ごと消える／
        // 画素の丸めで 1点おきに消えて**点線**になる（実測：建物の縦の稜線が
        // 30px おきに欠けた。線 8.87m に対し面 9.08m）。
        const zNear = Math.max(0.03, Math.abs(z) * 0.005);
        if (!window.__noInFront && e.depth < z - zNear) return true;
        if (!(e.depth > z + CG.depthEps(e.depth))) {
            // 面IDによる面内線の除去。意図して面上に描く線は onFace を付ける。
            if (!window.__noFaceCull && !onFace) {
                const ow = depthOwner && depthOwner[i1];
                if (ow && ow === myOwner) {
                    // 上下左右とも同じ面IDのときだけ「面の内側」と判断する。
                    // 左右だけだと、板の厚みが1画素未満の細い部材（手すり・スラブ）で
                    // 縁の線まで消えて破線状になる（実測で確認済み）。
                    const f0 = depthFace ? depthFace[i1] : 0;
                    if (f0 && faceCullAround(cw, ch, x, y, f0, myOwner)) return false;
                }
            }
            return true;
        }
        if (definitelyOccluded(e)) return false;
        // その画素の面が「この線の持ち主」で、奥行きがほぼ同じなら、
        // その線は自分の面の稜線（面と面の取り合い）なので描く。
        const own = depthOwner && depthOwner[i1];
        if (own && own === myOwner && e.depth <= z + SELF_EDGE_EPS) return true;
        // 【重要】自分の面に「少しだけ隠れる」線の扱い。
        // 角を丸めた所や細い板（笠木・スラブ）の稜線は、奥行きバッファより
        // 数十cm 奥になることがある。奥行きの差だけで隠すと、
        // ・縁（面と面の境目）に乗っている稜線 → 1px ごとに消えて点線
        // ・平らな面の裏側を通る線 → 本来見えないのに残る
        // の両方が起きる（実測：角の縦線が欠け、板の裏の斜線が残った）。
        // そこで奥行きではなく「その線が面の境目に乗っているか」で決める。
        // まわり±3px に別の面が混じっていれば境目＝見える稜線、1枚の面だけなら隠す。
        if (own && own === myOwner && depthFace && !window.__noOwnFace) {
            // 大きすぎる許容は、部品の奥の稜線を「自分の面の縁」と誤認する。
            // 室外機・信号機で 0.2〜0.3m 奥の線が出ていたため許容を絞る。
            const ownTol = Math.max(0.12, Math.abs(z) * 0.01);
            if (e.depth <= z + ownTol) {
                const f0 = depthFace[i1];
                if (f0 && !faceCullAround(cw, ch, x, y, f0, myOwner)) return true;
            }
        }
        // 【重要】自分の面の「縁」に重なる線は、面をほぼ真横から見ているために
        // 画素の丸め（1px）だけで面の奥行きが線より大きく手前に出る。
        // 透視では奥行きが1pxあたり数十cm変わることもあり、固定の許容（25cm）では
        // 届かず、稜線が点線状に欠けていた（実測：線の点の 4割がこの理由で落ちていた）。
        // 奥行きではなく「面の境界かどうか」で判断する。面IDが隣の画素で変わるなら縁＝描く。
        // 面の内側（同じ面IDに囲まれている）ときは従来どおり隠す。
        // 面と面が接している場所では、線の奥行きと面の奥行きが数mm〜数cmずれる。
        // （壁に付いたベランダ・看板、隣り合う箱の取り合い、面の上を通る稜線など）
        // その差だけで隠すと、線が破線状に途切れる。ごく近いときは描く。
        const edgeTol = window.__edgeTol === undefined ? 0.025 : Number(window.__edgeTol);
        if (edgeTol > 0 && e.depth <= z + Math.max(SELF_EDGE_EPS, Math.min(0.08, edgeTol))) return true;
        // 面のすぐ外側を通る「形の輪郭」も描く（自分の面が少し手前でも輪郭なら見える）。
        // 左右数画素の奥行きを見て、片側だけ背景（何も無い／ずっと奥）なら輪郭と判断する。
        if (own && own === myOwner && silhouetteAt(depth, cw, ch, x, y, e.depth)) return true;
        // ベベルの縦線は形の輪郭線なので、面のすぐ外側（隣の面がほんの少し手前）でも描く。
        if (seamLine && e.depth <= z + Math.max(0.12, Math.abs(z) * 0.02)) return true;
        // 面と面が接している線は、面をほぼ真横から見ているため1画素でも奥行きが
        // 大きく変わる。近くの画素に「線より奥」の面があれば描く。
        // 【重要】「面をほぼ真横から見ている」場所では、1画素のあいだに奥行きが数m変わる。
        // そういう面の輪郭に重なる線は、画素の丸めだけで「面より奥」になったり手前になったりし、
        // **1px おきの点線**になる（実測：建物の縦の稜線が 7〜11px おきに欠けた）。
        // 線の奥行きが「まわりの画素の奥行きの範囲」に入っていれば、
        // その線は面の輪郭の上にあると判断して描く（範囲より奥なら隠す）。
        if (!window.__noRange && silhouetteRange(depth, cw, ch, x, y, e.depth) >= e.depth) {
            // 蛇腹の接近した段では、周辺深度の最大値だけだと奥の線を
            // 表に出すことがある。通常透視でも曖昧な点だけ実面との光線を使う。
            if (!orthView && T !== "f" && s.ob?.accordionEnabled && fishLineOccluders && !window.__legacyAccordionRange) {
                if (exactPerspectiveOccluded(e)) return false;
            }
            return true;
        }
        // 自分の面の「縁」に重なる線：隣の面（別ID）がほんの少しだけ手前なら、
        // その線は面と面の取り合い＝見える線として描く。差が大きい（本当に隠れている）
        // ときは描かないので、隠線の正しさは保たれる。
        // 画素の丸めで 1px おきに判定が入れ替わり、稜線が点線になるのを防ぐ。
        if (!window.__noOwnEdge && own && own === myOwner && depthFace && e.depth <= z + Math.max(0.08, Math.abs(z) * 0.012)) {
            const f1 = depthFace[i1];
            if (f1 && !faceCullAround(cw, ch, x, y, f1, myOwner)) return true;
        }
        // 【重要】自分の形の「端」の線は必ず描く（ユーザー指定：「外形になる縦辺は必ず描く」）。
        // ベベルの縦線・角から下りる稜線は、奥行きバッファでは面のほうが手前に出るため
        // 上のどの条件でも落ちていた（実測：丸めた角の下の縦線が丸ごと欠けた）。
        if (own && own === myOwner && !window.__noShapeEdge && shapeEdgeAt(depth, cw, ch, x, y, e.depth, myOwner)) return true;
        return nearVisible(depth, cw, ch, x, y, e.depth);
    };
    // 小さな切れ目（1〜3px）は線を切らずにつなぐ。
    // 隠線の判定は点ごとに「面の手前か」を見ているので、面の端や輪郭の上では
    // 1点だけ判定が揺れることがある。そのまま点を捨てると、線に1〜2px の切れ目
    // （破線状の穴）が残る。直前に描いた点からごく近ければ「見えている」とみなす。
    // 本当に隠れている区間は数pxより長いので、隠線の正しさは変わらない。
    const bridgePx = window.__noBridge ? 0 : (window.__bridgePx === undefined ? 9 : Number(window.__bridgePx)) * Math.max(1, Math.abs(tf[0] || 1));
    let lastOk = null;
    // 「見えている区間」をいったん溜めてから描く。
    // 隠線の判定は点ごとなので、面のすぐ後ろを通る線では判定が数点だけ表に出ることがあり、
    // それが「点線状の切れ端」として残る（実測：建物の稜線が 6px おきの点線に見えた）。
    // 短すぎる区間（--minRun px 未満）は、まわりが隠れているなら捨てる。
    // 線そのものが短いとき（--shortLine px 未満）は捨てない（小物の線が消えないように）。
    const minRun = preciseSignalEdge || (!orthView && T === "f" && fishLineOccluders && !window.__legacyFishLines) ? 0 :
            window.__minRun === undefined ? 4 : Number(window.__minRun) * Math.max(1, Math.abs(tf[0] || 1)),
        shortLine = 10 * Math.max(1, Math.abs(tf[0] || 1));
    let run = [],
        drew = 0,
        lineLen = 0;
    const flushRun = () => {
        if (!run.length) return;
        let len = 0;
        for (let i = 2; i < run.length; i += 2) len += Math.hypot(run[i] - run[i - 2], run[i + 1] - run[i - 1]);
        // 1点だけの区間（点）は、線全体が長いときは捨てる（点線の粒を残さない）。
        // 2点以上の区間は、短くても描く（捨てると線が欠けて見えるため）。
        if (run.length > 2 && len < minRun && lineLen >= shortLine) {
            // 捨てる
        } else {
            c.moveTo(run[0], run[1]);
            for (let i = 2; i < run.length; i += 2) c.lineTo(run[i], run[i + 1]);
            // 実面レイで確認した輪郭が1点だけ残る場合も、moveToだけでは描画されない。
            // 隠れた点はここへ入らないため、円柱などのサブピクセルの可視区間だけ点として残す。
            if ((s.railingRoundBar || s.preciseTinyGaps) && run.length === 2) c.lineTo(run[0] + 0.001, run[1]);
            // 遮蔽された別の線と手前の可視線が重なった場合、可視線の二値化補完は
            // 禁止しない。描いた区間だけを線ID付きで記録する（同じ線の隠れは除外）。
            if (fishVisiblePixels && run.length >= 4) {
                for (let i = 0; i < run.length; i += 2) {
                    const x = Math.round(tf[0]*run[i] + tf[2]*run[i+1] + tf[4]),
                        y = Math.round(tf[1]*run[i] + tf[3]*run[i+1] + tf[5]);
                    for (let dy=-2;dy<=2;dy++) for (let dx=-2;dx<=2;dx++) {
                        const xx=x+dx, yy=y+dy;
                        if(xx<0||xx>=cw||yy<0||yy>=ch) continue;
                        const index=yy*cw+xx, previous=fishVisiblePixels[index];
                        if (!previous) fishVisiblePixels[index]=fishCurrentLine;
                        else if (previous!==fishCurrentLine) fishVisiblePixels[index]=-1;
                    }
                }
            }
            drew++;
        }
        run = [];
    };
    // 見えている点を溜める。短い「隠れ」は、そのまま線を続けて埋める。
    // 以前は隠れた時点で線を切っていたため、面をほぼ真横から見ている場所
    // （1画素で奥行きが数m変わる）では、判定が1点ごとに揺れて
    // **1〜6px おきの点線**になっていた。数px の切れ目は「線の途切れ」ではなく
    // 判定の揺れなので、前後の点が近ければ（bridge px 以内）線としてつなぐ。
    // ただし確実に遮られている点では、短くても橋渡ししない。
    let pend = [], // いま隠れている途中の点（つながれば描く）
        pendFrom = null; // 隠れ始めた点（つながったときに埋める始点）
    const flushPend = () => {
        pend = [];
        pendFrom = null;
    };
    const emit = (e) => {
        if (!e.ok) {
            flushRun();
            flushPend();
            on = false;
            lastOk = null;
            return;
        }
        if (!accept(e)) {
            // 実際に手前の面で覆われている区間は、短くても橋渡ししない。
            if (definitelyOccluded(e)) {
                flushRun();
                flushPend();
                on = false;
                lastOk = null;
                return;
            }
            if (on) {
                if (!pend.length) pendFrom = { x: e.x, y: e.y };
                pend.push(e.sx, e.sy);
                // 切れ目が長すぎたら、そこで線を切る（本当に隠れている）。
                if (pendFrom && Math.hypot(e.x - pendFrom.x, e.y - pendFrom.y) > bridgePx) {
                    flushRun();
                    flushPend();
                    on = false;
                    lastOk = null;
                }
            }
            return;
        }
        if (on) {
            if (pend.length) {
                // 短い切れ目だったので、いま溜めていた点ごと線をつなぐ。
                for (let i = 0; i < pend.length; i += 2) run.push(pend[i], pend[i + 1]);
                flushPend();
            }
            run.push(e.sx, e.sy);
        } else if (lastOk && bridgePx > 0 && Math.hypot(e.x - lastOk.x, e.y - lastOk.y) <= bridgePx) run.push(e.sx, e.sy);
        else {
            flushRun();
            run.push(e.sx, e.sy);
        }
        on = true;
        lastOk = { x: e.x, y: e.y };
    };
    const put = (v) => emit(projPoint(v, tf));
    // 直線は透視投影でも画面上では直線になるので、区間の内部は
    // 両端の投影結果から補間できる（奥行きは 1/奥行き が画面内で1次）。
    // 以前は区間の各点を毎回投影していたため、細かく刻むほど遅くなっていた。
    const lerpFlag = !orthView && T !== "f";
    // 投影は点ごとに1回だけ（以前は区間の両端でもう一度投影していた）。
    // カメラが同じ間は、前回の投影結果をそのまま使う。
    const pj = projPtsFor(s, tf);
    for (let i = 1; i < pj.length; i++) {
        const a = pj[i - 1],
            b = pj[i];
        if (a.ok && b.ok) lineLen += Math.hypot(b.sx - a.sx, b.sy - a.sy);
    }
    s.p.forEach((v, i) => {
        if (i) {
            const a = s.p[i - 1];
            // 同じ線分を2回描かない（印は genShape が付けている）。
            if (s.dup && s.dup[i - 1]) {
                flushRun();
                flushPend();
                on = false;
                lastOk = null; // 重複線は橋渡ししない（2本描きになるため）
            }
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
                    // 粗い等間隔判定だけでは、その間の細い遮蔽物を見落とす。
                    // 例：22px 幅の板が 24px 間隔の検査点の間に収まり、
                    // 線が板を貫通していた。画面上の間隔で点ごとに判定する。
                    const n = Math.max(1, Math.ceil(s.preciseTinyGaps ? len * 2 : len / 2));
                    for (let j = 1; j < n; j++) emit(at(j / n));
                } else {
                    const worldN = Math.ceil(Math.hypot(v[0] - a[0], v[1] - a[1], v[2] - a[2]) * 10),
                        pixelN = ((!orthView && T === "f") || (preciseSignalEdge && fishLineOccluders)) && ea.ok && eb.ok ? Math.ceil(4 * Math.hypot(eb.x - ea.x, eb.y - ea.y)) : 0,
                        n = Math.max(!orthView && T === "f" && fishLineOccluders && !window.__legacyFishLines ? 8 : 1, worldN, pixelN);
                    for (let j = 1; j < n; j++) put(V.add(a, v, 1 - j / n, j / n));
                }
            }
        }
        emit(pj[i]);
    });
    flushRun();
    c.stroke();
    c.globalAlpha=wallAlpha;

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
    // 投影は線の描画で済んでいるので、その結果を使い回す（全点を投影し直さない）。
    S.forEach((s) => {
        if (s.ob && !objectVisible(s.ob)) return;
        const pj = projPtsFor(s, tf);
        for (let i = 0; i < pj.length; i++) add(pj[i]);
    });
    if (prev)
        prev.forEach((s) => {
            const pj = projPtsFor(s, tf);
            for (let i = 0; i < pj.length; i++) add(pj[i]);
        });
    if (!(x1 >= x0 && y1 >= y0)) return null;
    const pad = 3,
        bx = Math.max(0, Math.floor(x0) - pad),
        by = Math.max(0, Math.floor(y0) - pad),
        bx1 = Math.min(cw, Math.ceil(x1) + pad),
        by1 = Math.min(ch, Math.ceil(y1) + pad);
    if (bx1 <= bx || by1 <= by) return null;
    return { x: bx, y: by, w: bx1 - bx, h: by1 - by };
}
// 前回と同じ絵なら線の層を作り直さない（層の描き直しは実測30ms）。
// カメラ・用紙・設定・オブジェクトが変われば必ず作り直す（選択だけなら再利用）。
// 編集中の線（withCur）が乗るときは、内容が毎フレーム変わるので使わない。
let lineLayerKey = null;
// 線の点の投影結果（画面座標・奥行き）を線ごとに覚えておく。
// 投影はカメラ・用紙・ズーム・レンズが変わらなければ同じ値になるので、
// カメラを固定したドラッグ中は毎フレームの投影計算（点数 × 三角関数）が丸ごと省ける。
// 値は入力だけで決まるので、使い回しても結果は1画素も変わらない。
const projPtsCache = new WeakMap();
let projKeyValue = null;
// 画面への変換（拡大率と移動）の「移動ぶん」。
// 透視投影は原点(0,0)を中心に拡大するので ox, oy そのもの。
// 一方、正投影（正面・横・上）は投影結果がすでに画面座標（基準点 ax, ay）なので、
// 同じ ox, oy を使うと**拡大が基準点からずれて絵が画面外へ飛ぶ**（実測：拡大0.5で線が1本も出ない）。
// 基準点を中心に拡大するよう、移動ぶんを補正する。
function viewShift() {
    if (!orthView) return [ox, oy];
    const s = orthSetup();
    return [ox + s.ax * (1 - Z), oy + s.ay * (1 - Z)];
}
// 正投影（正面・横・上）の「どの向きを・どの倍率で・どこを中心に」を見分ける文字列。
// 以前はキャッシュの条件が「正投影かどうか（0/1）」だけだったため、正面→横→上と
// 切り替えても同じ絵（正面のまま）が返っていた。面の層と線の層の両方が同じ条件を使う。
function orthoProjectionKey() {
    if (!orthView) return "-";
    const s = orthSetup();
    return (
        orthView + ":" + s.sc + ":" + s.ax + ":" + s.ay + ":" +
        s.right.join(",") + ":" + s.up.join(",") + ":" + s.depth.join(",")
    );
}
function projCameraKey(tf) {
    return (
        (tf ? tf.join(",") : Z + "," + viewShift().join(",")) +
        "|" + T + "|" + orthoProjectionKey() + "|" + W + "," + H + "|" + JSON.stringify(P)
    );
}
// 線1本ぶんの投影結果。同じ条件（カメラ・用紙・ズーム）なら前回の配列を使い回す。
// 1本ぶんの投影結果。同じ条件なら前回の配列を使い回す。
function projPtsFor(s, tf) {
    const hit = projPtsCache.get(s);
    if (!window.__noProjCache && hit && hit.key === projKeyValue) return hit.pj;
    const pj = new Array(s.p.length);
    for (let i = 0; i < s.p.length; i++) pj[i] = projPoint(s.p[i], tf);
    projPtsCache.set(s, { key: projKeyValue, pj });
    return pj;
}
// オブジェクトに属さない線（ペンで描いた線）の署名。
// 層のキャッシュ判定は「オブジェクトの状態」だけで決めていたため、ペンで描いた線を
// あとから動かしても層が古いまま残ることがあった（線が動かない／消えない）。
// 座標と色・太さを小さな数値へ畳んで key に混ぜる。
function freeLineSig() {
    let h = 0,
        n = 0;
    for (let i = 0; i < S.length; i++) {
        const s = S[i];
        if (!s || s.ob) continue;
        n++;
        const p = s.p || [];
        for (let k = 0; k < p.length; k++) {
            const q = p[k];
            h = (Math.imul(h, 31) + ((q[0] * 1000) | 0) + ((q[1] * 1000) | 0) * 7919 + ((q[2] * 1000) | 0) * 104729) | 0;
        }
        const c = s.c || "";
        for (let k = 0; k < c.length; k++) h = (Math.imul(h, 131) + c.charCodeAt(k)) | 0;
        h = (Math.imul(h, 131) + Math.round((Number(s.w) || 0) * 97)) | 0;
    }
    return n + ":" + h;
}
function lineLayer(view, withCur, cw = W, ch = H, tf = null, hidden = false) {
    // tf=書き出し用の変換 [拡大,0,0,拡大,ずれx,ずれy]
    // このフレームの投影キー（投影キャッシュの判定に使う）。
    projKeyValue = projCameraKey(tf);
    const binOn = $("bin").checked;
    // オブジェクトごとの今の状態（層のキャッシュ判定に使う）。
    const sigs = new Map();
    S.forEach((s) => {
        const o = s && s.ob;
        if (!o || !objectVisible(o) || sigs.has(o.id)) return;
        sigs.set(o.id, JSON.stringify(o));
    });
    // 「描いている途中の線」を混ぜるかどうか。cur も prev も無いときは混ざるものが無いので、
    // 層の中身は withCur=false のときと同じになる。呼び出し側は面ONのとき常に withCur=true を
    // 渡してくるため、この区別をしないと**面ONでは層のキャッシュが一切効かなくなる**（実測 -19ms/フレーム）。
    const curEff = !!withCur && !!(cur || prev);
    // 選択色は線層へ描かずギズモだけに表示するため、選択変更だけでは線層を再生成しない。
    // 比較用フラグは旧方式（選択ごとに作り直し）へ切り替えて画素一致を検査できる。
    const selectionKey=window.__lineCacheBySelection ? (sel ?? "") : "";
    const camKey = projKeyValue + "|" + (hidden ? 1 : 0) + "|" + cw + "," + ch + "|" + (view ? 1 : 0) + "|" + selectionKey;
    const key =
        camKey + "|" + (curEff ? 1 : 0) + "|" + (binOn ? 1 : 0) + "|" + freeLineSig() + "|" +
        [...sigs].map(([id, sg]) => id + ":" + sg).join(";");
    // 同じ絵が続くときは層を作り直さない（層の描き直しは実測20〜30ms）。
    if (!window.__noLineCache && LC && LC.width === cw && LC.height === ch && lineLayerKey && key === lineLayerKey) {
        return LC;
    }
    if (!LC || LC.width !== cw || LC.height !== ch) {
        LC = document.createElement("canvas");
        LC.width = cw;
        LC.height = ch;
    }
    const x = LC.getContext("2d", { willReadFrequently: true });
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, cw, ch);
    // 線を引くときの変換（画面表示ならズーム・移動つき）。
    // 奥行きバッファも**同じ変換**で作る。以前はここが [1,0,0,1,0,0] 固定だったため、
    // 拡大・移動していると奥行きの画素位置と線の画素位置がずれて
    // 「隠れていない線まで隠れる」＝正投影で線がほぼ出ない状態になっていた（実測 ink 0）。
    const vs = viewShift(),
        tfEff = tf || [Z, 0, 0, Z, vs[0], vs[1]];
    x.setTransform(...tfEff);
    const hiddenDepth = hidden ? buildExportDepth(cw, ch, tfEff) : null;
    if (hiddenDepth && !orthView && T === "f" && !window.__legacyFishLines) {
        prepareFishLineOccluders();
        fishBlockedWidth=cw; fishBlockedHeight=ch; fishLineSerial=0;
        fishBlockedPixels=$("bin").checked ? new Int32Array(cw*ch) : null;
        fishVisiblePixels=fishBlockedPixels ? new Int32Array(cw*ch) : null;
    } else {
        fishBlockedPixels = null; fishVisiblePixels = null;
        if (hiddenDepth && S.some(s=>s.ob && objectVisible(s.ob) && ((!window.__legacyPoleRay && s.signalPoleTopRing) || (!window.__legacySignalSmoothRay && s.signalSmoothSide) || s.preciseTubeEdge || s.arrayGeometry || (!orthView && T !== "f" && ((!window.__legacyAccordionRange && s.ob.accordionEnabled) || (!window.__legacyDepthBevelRay && s.depthBevelEdge)))))) prepareFishLineOccluders();
        else fishLineOccluders = null;
    }
    // ベベルの縦線は「角ごとに輪郭の1本」だけ描く（面ONのとき）。
    if (hiddenDepth) updateSeamPicks(hiddenDepth, cw, ch, tfEff);
    // 二値化する層だけ、細い線が欠けないよう最小の太さを確保する。
    const binNow = $("bin").checked;
    lineDevMin = binNow && !window.__noBinMinW ? (window.__minDevW === undefined ? 1.15 : Number(window.__minDevW)) : 0;
    lineDevMinScale = tf ? Math.abs(tf[0] || 1) : view ? Z : 1;
    S.forEach((s) => {
        if (s.ob && !objectVisible(s.ob)) return;
        hidden ? strokeWVisible(x, s, hiddenDepth, cw, ch, tfEff) : strokeW(x, s);
    });
    drawPersonSilhouettes(x,hidden,hiddenDepth,cw,ch,tfEff);
    if (withCur) drawCur(x);
    if (withCur && prev) prev.forEach((s) => strokeW(x, s));
    lineDevMin = 0;
    lineLayerKey = curEff ? null : key;
    if ($("bin").checked) {
        // 二値化：しきい値以上の画素だけ完全に不透明にする。
        // 線がある範囲だけを処理すれば同じ結果（全体だと 100万画素以上を読み書きする）。
        // ※「変わった範囲だけ二値化する」案（層を2枚に分ける）も試したが、
        //   層をもう1枚経由すると GPU からの読み戻しが増えて、かえって遅かった。
        x.setTransform(1, 0, 0, 1, 0, 0);
        const box = strokeBox(cw, ch, tfEff);
        if (box) {
            const im = x.getImageData(box.x, box.y, box.w, box.h),
                d = im.data,
                t = P.bt;
            // アルファだけを 0 / 255 に落とす（4バイトをまとめて見たほうが速い）。
            const u32 = new Uint32Array(d.buffer, d.byteOffset, d.length >> 2);
            for (let i = 0; i < u32.length; i++) {
                const v = u32[i];
                u32[i] = (v >>> 24) < t ? 0 : v | 0xff000000;
            }
            // 1〜3px の切れ目を埋める。
            // 細い線（拡大が小さいときの1px 前後の線）はアンチエイリアスで1画素ごとの
            // アルファがしきい値の上下を行き来するため、二値化すると破線状に欠ける
            // （実測：拡大1.0で 357か所・2,435px の欠け）。線の両側が繋がっている
            // 短い切れ目だけを埋めれば、線の太さは変えずに連続した線に戻せる。
            const noFill = fishBlockedPixels ? (i) => {
                const index=(box.y + Math.floor(i / box.w)) * cw + box.x + i % box.w,
                    blocked=fishBlockedPixels[index], visible=fishVisiblePixels[index];
                return !!blocked && !(visible && visible !== blocked);
            } : null;
            closeBinGaps(u32, box.w, box.h, window.__binBridge === undefined ? 2 : Number(window.__binBridge), noFill);
            x.putImageData(im, box.x, box.y);
        }
    }
    return LC;
}

// 二値化した線の 1px の切れ目・欠けを埋める。
// 二値化はアルファを 0/255 に落とすので、細い線はアンチエイリアスの当たり方で
// 1px 単位に欠ける（実測：拡大1.0で 357か所）。「線の外側を太らせる」のではなく
// 「線に囲まれた穴だけを埋める」ので、線の太さはほとんど変わらない。
//   1. 反対側どうしが線で、あいだが1px → その1px を埋める（8方向の直線の切れ目）
//   2. まわりに線が3つ以上ある → 角の欠けなので埋める（階段状の切れ目）
function closeBinGaps(u32, w, h, strength, noFill = null) {
    if (!(strength > 0) || w < 3 || h < 3) return;
    const n = w * h;
    // 1) 線の画素を集める（1画素1回の読み出しで済む）。
    let inkCount = 0;
    for (let i = 0; i < n; i++) if (u32[i] !== 0) inkCount++;
    if (!inkCount) return;
    const ink = new Int32Array(inkCount);
    for (let i = 0, k = 0; i < n; i++) if (u32[i] !== 0) ink[k++] = i;
    // 2) 線の画素のまわりだけを見る（全画素を見ると 1回 20ms かかっていた）。
    const fill = [];
    const near = strength >= 2 ? new Uint8Array(n) : null;
    const dx8 = [1, 1, 0, -1, -1, -1, 0, 1],
        dy8 = [0, 1, 1, 1, 0, -1, -1, -1];
    for (let idx = 0; idx < ink.length; idx++) {
        const i = ink[idx],
            x = i % w,
            y = (i / w) | 0;
        // 右・下・右下・左下の4方向だけ見る（逆向きは相手側で調べる）。
        for (let k = 0; k < 4; k++) {
            const dx = dx8[k],
                dy = dy8[k],
                ax = x + dx,
                ay = y + dy;
            if (ax < 0 || ay < 0 || ax >= w || ay >= h) continue;
            const ai = ay * w + ax;
            if (u32[ai] !== 0) continue; // 線なら切れ目ではない
            // 1px の切れ目：その先が線で、反対側（手前）も線。
            const bx = ax + dx,
                by = ay + dy,
                px = x - dx,
                py = y - dy;
            if (bx >= 0 && by >= 0 && bx < w && by < h && u32[by * w + bx] !== 0 && px >= 0 && py >= 0 && px < w && py < h && u32[py * w + px] !== 0) {
                fill.push(ai);
                continue;
            }
            if (!near) continue;
            // 角の欠け：まわりの線の数が3つ以上なら埋める。
            if (near[ai] !== 255) {
                let cnt = 0;
                for (let j = 0; j < 8; j++) {
                    const nx = ax + dx8[j],
                        ny = ay + dy8[j];
                    if (nx >= 0 && ny >= 0 && nx < w && ny < h && u32[ny * w + nx] !== 0) cnt++;
                }
                near[ai] = cnt;
            }
            if (near[ai] >= 3) fill.push(ai);
        }
    }
    for (let i = 0; i < fill.length; i++) {
        const idx = fill[i];
        if (u32[idx] === 0 && (!noFill || !noFill(idx))) u32[idx] = 0xff000000;
    }
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
        st = orthSetup(),
        // 補助線は「表示中心（自動フィットの中心）」に合わせて引く。
        // 以前は画面中央 (W/2, H/2) 固定だったため、フィットで中心がずれると
        // 補助線とオブジェクトの位置関係が食い違っていた。
        cx = st.ax,
        cy = st.ay,
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
    const b = orthBasis(),
        // 画面に入る本数だけ引く（中心から ±20本では、拡大したときに足りなくなる）。
        nx = Math.ceil(W / Math.max(1, sc)) + 1,
        ny = Math.ceil(H / Math.max(1, sc)) + 1;
    if (orthPlane() === "top") {
        for (let i = -nx; i <= nx; i++) {
            const x = cx + i * sc;
            draw(x, 0, x, H, col[0]);
        }
        for (let i = -ny; i <= ny; i++) {
            const y = cy + i * sc;
            draw(0, y, W, y, col[2]);
        }
    } else {
        for (let i = -nx; i <= nx; i++) {
            const x = cx + i * sc;
            draw(x, 0, x, H, col[orthPlane() === "front" ? 0 : 1]);
        }
        for (let i = -ny; i <= ny; i++) {
            const y = cy + i * sc;
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
    const oldAlpha=c.globalAlpha;if(s.roomShellWallSide&&roomShellCameraCuts(s.ob).walls.has(s.roomShellWallSide))c.globalAlpha=oldAlpha*.12;
    c.beginPath();
    c.moveTo(s.p[0].x, s.p[0].y);
    for (let i = 1; i < s.p.length; i++) c.lineTo(s.p[i].x, s.p[i].y);
    c.stroke();
    c.globalAlpha=oldAlpha;
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
// 面の層（オフスクリーン）をそのまま貼る。
function blitSurfaceLayer(c, box) {
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = box.alpha;
    c.drawImage(surfaceLayerCanvas, 0, 0, box.dw, box.dh, box.dx0, box.dy0, box.dw, box.dh);
    c.restore();
}
// ===== 面の層（オフスクリーン）の作り直しを減らす =====
// 面は「1枚の層に不透明で塗ってから、最後に半透明で1回だけ貼る」方式。
// 三角形を1枚ずつ半透明で塗ると、重なった場所だけ濃くなる（乗算したように見える）ため
// この形は変えられない。重いのは貼るほうではなく、層を塗り直すほう（実測 8ms）。
// そこで3段階に分ける。
//   1. 何も変わっていない          → 前回の層をそのまま貼る（実測 1.3ms）
//   2. 1台だけ動いた／回った       → その1台の範囲（前フレームと今回の範囲の和）だけ塗り直す
//   3. カメラが動いた／台数が変わった → 全部作り直す
// 2 のときは、塗り直す範囲にかかる三角形を「全オブジェクトから」集めて奥から順に塗り、
// その範囲にクリップする。範囲の外は前回の絵がそのまま残るので、仕上がりは全体を作り直した
// ときと同じになる（＝見た目は変わらない）。
let surfaceLayerCache = null; // 前回の層（key が同じなら貼るだけ）
let surfState = null; // 台ごとの三角形と層の範囲（部分的な塗り直し用）

function surfaceLayerNew(w, h) {
    const cvNew = document.createElement("canvas");
    cvNew.width = Math.max(1, Math.ceil(w));
    cvNew.height = Math.max(1, Math.ceil(h));
    return cvNew;
}
// 三角形の外接範囲（画面の拡大を掛ける前の座標）。
function surfTriBox(t) {
    const x0 = Math.min(t.x0, t.x1, t.x2),
        x1 = Math.max(t.x0, t.x1, t.x2),
        y0 = Math.min(t.y0, t.y1, t.y2),
        y1 = Math.max(t.y0, t.y1, t.y2);
    t.bx0 = x0;
    t.by0 = y0;
    t.bx1 = x1;
    t.by1 = y1;
}
// 集めた三角形を層へ塗る。list は奥→手前の順に並べておくこと。
// clip を渡すと、その範囲（拡大を掛ける前の座標）だけを塗る。
function paintSurfaceTris(lc, list, clip) {
    if (!list.length) return;
    if (clip) {
        lc.save();
        lc.beginPath();
        lc.rect(clip.x0, clip.y0, clip.x1 - clip.x0, clip.y1 - clip.y0);
        lc.clip();
    }
    lc.lineJoin = "round";
    lc.globalAlpha = 1; // 層の中は不透明。重なっても濃くならない。
    lc.lineWidth = 1 / Math.max(0.25, Z);
    // 色ごとにまとめる（同じ色は1本のパスへ）。
    const byColor = new Map();
    list.forEach((t) => {
        let arr = byColor.get(t.color);
        if (!arr) byColor.set(t.color, (arr = []));
        arr.push(t);
    });
    byColor.forEach((arr, col) => {
        // 1本のパスへまとめすぎると、三角形が数千枚あるアセットでパス構築が重くなる。
        const chunk = 400;
        lc.fillStyle = col;
        lc.strokeStyle = col;
        for (let i = 0; i < arr.length; i += chunk) {
            const path = new Path2D(),
                edge = new Path2D(),
                end = Math.min(i + chunk, arr.length);
            let hasEdge = false;
            for (let k = i; k < end; k++) {
                const t = arr[k],
                    // 同じパスへ複数の三角形を入れると、巻き方向が逆の三角形どうしが
                    // 打ち消し合って塗りが抜ける。全三角形の巻き方向をそろえてから1本にする。
                    flip = t.area < 0,
                    q1x = flip ? t.x2 : t.x1,
                    q1y = flip ? t.y2 : t.y1,
                    q2x = flip ? t.x1 : t.x2,
                    q2y = flip ? t.y1 : t.y2;
                // closePath() は fill() が自動で閉じるので呼ばない（1回 16µs かかる）。
                path.moveTo(t.x0, t.y0);
                path.lineTo(q1x, q1y);
                path.lineTo(q2x, q2y);
                // 縁取りは隣り合う三角形の継ぎ目が透けて細い筋に見えるのを防ぐため。
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
    if (clip) lc.restore();
}

function drawObjectSurfaces(c) {
    if (!P.surfaceMode) return;
    const objs = [],
        seen = new Set();
    S.forEach((s) => {
        const o = s && s.ob;
        if (!o || !objectVisible(o) || seen.has(o.id)) return;
        seen.add(o.id);
        objs.push(o);
    });
    if (!objs.length) return;
    // カメラ（と用紙の設定）が同じで、台も同じなら「動いた台」だけ塗り直せる。
    // 面の層も、線の層と同じ「カメラ＋正投影の向き」で見分ける
    // （正投影の向きを入れないと、正面→横→上で前の面が貼られたままになる）。
    const cam = projCameraKey(null);
    const sigs = objs.map((o) => o.id + ":" + JSON.stringify(o));
    const ids = objs.map((o) => o.id).join(",");
    const key = "surf|" + cam + "|" + sigs.join(";");
    // 1. 何も変わっていない：前回の層をそのまま貼る。
    if (!window.__noSurfCache && surfaceLayerCache && surfaceLayerCache.key === key) {
        blitSurfaceLayer(c, surfaceLayerCache);
        return;
    }
    // 不透明度が台ごとに違うときは、層を分ける必要があるので部分的な塗り直しはしない。
    let alphaOne = null;
    for (let i = 0; i < objs.length; i++) {
        const a = Number(surfaceAlpha(objs[i]).toFixed(3));
        if (alphaOne === null) alphaOne = a;
        else if (a !== alphaOne) {
            alphaOne = null;
            break;
        }
    }
    const prev = surfState;
    const partial =
        !window.__noSurfFull &&
        alphaOne !== null &&
        !!prev &&
        prev.cam === cam &&
        prev.ids === ids &&
        prev.alphaOne === alphaOne &&
        !!surfaceLayerCanvas;
    const proj = surfaceProjector(),
        next = { cam, ids, alphaOne, entries: new Map(), box: prev && partial ? { ...prev.box } : null },
        changed = [];
    objs.forEach((o, i) => {
        const old = partial ? prev.entries.get(o.id) : null;
        if (old && old.sig === sigs[i]) {
            next.entries.set(o.id, old);
            return;
        }
        const list = surfaceTriangles(o);
        const ent = { sig: sigs[i], tris: null, box: null };
        if (list && list.length) {
            const color = surfaceColor(o),
                alpha = Number(surfaceAlpha(o).toFixed(3)),
                out = [];
            let bx0 = Infinity,
                by0 = Infinity,
                bx1 = -Infinity,
                by1 = -Infinity;
            for (let k = 0; k < list.length; k++) {
                const tr = list[k];
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
                const t = {
                    color: tr.surfaceColor || color,
                    alpha,
                    depth: (a.depth + b.depth + e.depth) / 3,
                    area,
                    x0: a.x,
                    y0: a.y,
                    x1: b.x,
                    y1: b.y,
                    x2: e.x,
                    y2: e.y,
                };
                surfTriBox(t);
                if (t.bx0 < bx0) bx0 = t.bx0;
                if (t.by0 < by0) by0 = t.by0;
                if (t.bx1 > bx1) bx1 = t.bx1;
                if (t.by1 > by1) by1 = t.by1;
                out.push(t);
            }
            if (out.length) {
                ent.tris = out;
                ent.box = { x0: bx0, y0: by0, x1: bx1, y1: by1 };
            }
        }
        next.entries.set(o.id, ent);
        changed.push([ent.box, old ? old.box : null]);
    });
    // 奥から手前へ（半透明でもオブジェクト同士の重なりが自然になる）。
    const sortTris = (list) => list.sort((a, b) => b.depth - a.depth);
    const toScreen = (u0, v0, u1, v1, pad) => {
        const vs1 = viewShift(),
            dx0 = Math.max(0, Math.floor(u0 * Z + vs1[0]) - pad),
            dy0 = Math.max(0, Math.floor(v0 * Z + vs1[1]) - pad),
            dx1 = Math.min(W, Math.ceil(u1 * Z + vs1[0]) + pad),
            dy1 = Math.min(H, Math.ceil(v1 * Z + vs1[1]) + pad);
        return { dx0, dy0, dx1, dy1, dw: dx1 - dx0, dh: dy1 - dy0 };
    };
    // 3. 全部作り直す（カメラが動いた／最初の1回／不透明度が混在）。
    const fullPaint = (unionBox) => {
        const all = [];
        next.entries.forEach((e) => {
            if (e.tris) for (let i = 0; i < e.tris.length; i++) all.push(e.tris[i]);
        });
        sortTris(all);
        const b = unionBox || { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
        if (!unionBox) {
            all.forEach((t) => {
                if (t.bx0 < b.x0) b.x0 = t.bx0;
                if (t.by0 < b.y0) b.y0 = t.by0;
                if (t.bx1 > b.x1) b.x1 = t.bx1;
                if (t.by1 > b.y1) b.y1 = t.by1;
            });
        }
        if (!Number.isFinite(b.x0) || !Number.isFinite(b.y0)) return null;
        const r = toScreen(b.x0, b.y0, b.x1, b.y1, 2);
        if (r.dw <= 0 || r.dh <= 0) return null;
        // 層は作り直す（中身が残っていると前の絵が透ける）。
        surfaceLayerCanvas = surfaceLayerNew(r.dw, r.dh);
        const lc = surfaceLayerCanvas.getContext("2d");
        const vs2 = viewShift();
        lc.setTransform(Z, 0, 0, Z, vs2[0] - r.dx0, vs2[1] - r.dy0);
        paintSurfaceTris(lc, all, null);
        const box = { alpha: alphaOne, dx0: r.dx0, dy0: r.dy0, dw: r.dw, dh: r.dh };
        next.box = { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, ...box };
        return box;
    };
    if (!partial) {
        const box = fullPaint(null);
        if (box) {
            blitSurfaceLayer(c, box);
            surfState = next;
            if (alphaOne !== null) surfaceLayerCache = { key, ...box };
            else surfaceLayerCache = null;
        }
        return;
    }
    // 2. 動いた台の範囲だけ塗り直す。
    // 前フレームでその台が写っていた範囲と、今回写る範囲の両方を消す必要がある
    // （回転・移動では範囲が横にも広がる）。
    let ux0 = Infinity,
        uy0 = Infinity,
        ux1 = -Infinity,
        uy1 = -Infinity;
    changed.forEach(([nb, ob]) => {
        [nb, ob].forEach((b) => {
            if (!b) return;
            if (b.x0 < ux0) ux0 = b.x0;
            if (b.y0 < uy0) uy0 = b.y0;
            if (b.x1 > ux1) ux1 = b.x1;
            if (b.y1 > uy1) uy1 = b.y1;
        });
    });
    const cur = next.box;
    if (!Number.isFinite(ux0) || !cur) {
        const box = fullPaint(null);
        if (box) {
            blitSurfaceLayer(c, box);
            surfState = next;
            surfaceLayerCache = { key, ...box };
        }
        return;
    }
    const dr = toScreen(ux0, uy0, ux1, uy1, 2);
    if (dr.dw <= 0 || dr.dh <= 0) {
        // 画面の外だけの変化：層はそのまま。
        blitSurfaceLayer(c, cur);
        surfState = next;
        surfaceLayerCache = { key, ...cur };
        return;
    }
    // 層の外へはみ出すなら、層を広げて中身を引き継ぐ（作り直さない）。
    const need = { x0: Math.min(cur.x0, dr.dx0), y0: Math.min(cur.y0, dr.dy0) },
        needX1 = Math.max(cur.dx0 + cur.dw, dr.dx1),
        needY1 = Math.max(cur.dy0 + cur.dh, dr.dy1);
    if (need.x0 !== cur.dx0 || need.y0 !== cur.dy0 || needX1 !== cur.dx0 + cur.dw || needY1 !== cur.dy0 + cur.dh) {
        // 少し余白を持たせて広げる（毎フレーム広げ直さないため）。
        const pad = 96,
            nx0 = Math.max(0, need.x0 - pad),
            ny0 = Math.max(0, need.y0 - pad),
            nx1 = Math.min(W, needX1 + pad),
            ny1 = Math.min(H, needY1 + pad),
            grown = surfaceLayerNew(nx1 - nx0, ny1 - ny0);
        grown.getContext("2d").drawImage(surfaceLayerCanvas, cur.dx0 - nx0, cur.dy0 - ny0);
        surfaceLayerCanvas = grown;
        cur.dx0 = nx0;
        cur.dy0 = ny0;
        cur.dw = nx1 - nx0;
        cur.dh = ny1 - ny0;
        cur.x0 = nx0 / Z - ox / Z;
        cur.y0 = ny0 / Z - oy / Z;
        cur.x1 = nx1 / Z - ox / Z;
        cur.y1 = ny1 / Z - oy / Z;
    }
    const lc = surfaceLayerCanvas.getContext("2d");
    // 消す（拡大の影響を受けないよう、いったん等倍に戻してから）。
    lc.save();
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.clearRect(dr.dx0 - cur.dx0, dr.dy0 - cur.dy0, dr.dw, dr.dh);
    lc.restore();
    // 範囲にかかる三角形を全台から集め、奥から順に塗る（範囲にクリップする）。
    const clipU = { x0: ux0 - 1 / Z, y0: uy0 - 1 / Z, x1: ux1 + 1 / Z, y1: uy1 + 1 / Z },
        near = [];
    next.entries.forEach((e) => {
        if (!e.tris) return;
        for (let i = 0; i < e.tris.length; i++) {
            const t = e.tris[i];
            if (t.bx0 > clipU.x1 || t.bx1 < clipU.x0 || t.by0 > clipU.y1 || t.by1 < clipU.y0) continue;
            near.push(t);
        }
    });
    sortTris(near);
    const vs3 = viewShift();
    lc.setTransform(Z, 0, 0, Z, vs3[0] - cur.dx0, vs3[1] - cur.dy0);
    paintSurfaceTris(lc, near, clipU);
    const box = { alpha: cur.alpha, dx0: cur.dx0, dy0: cur.dy0, dw: cur.dw, dh: cur.dh };
    blitSurfaceLayer(c, box);
    next.box = cur;
    surfState = next;
    surfaceLayerCache = { key, ...box };
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
        // 正投影（正面・横・上）の向き・倍率・中心も入れる。
        // 入れないと、3Dから正面へ切り替えても**前の透視の背景（床グリッド）がそのまま残る**
        // （実測：正面ビューに消失点へ向かうグリッドが描かれていた）。
        orthoProjectionKey(),
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
    const vsBg = viewShift();
    g.setTransform(Z, 0, 0, Z, vsBg[0], vsBg[1]);
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
let lastObjectGeometryScene = null,
    lastObjectGeometrySignature = null,
    lastObjectGeometryLength = -1,
    lastObjectGeometryFirst = null,
    lastObjectGeometryLast = null,
    lastObjectGeometryProjection = null;
function render() {
    // 予約済みの描画は、この同期描画1回にまとめる（二重に描かない）。
    if (RAF) {
        cancelAnimationFrame(RAF);
        RAF = 0;
    }
    dirty = true;
    // カメラロック中は、どの入口から視点が動いても描く前に元へ戻す（最後の砦）。
    enforceCameraLock();
    remember3DDisplay();
    // sigNow()は描画1回につき一度だけ計算する。以前は線ごとに再計算していたため、
    // アセットや線が多いシーンほど不要な文字列計算が増えていた。
    const currentSignature = sigNow();
    // S（シーン配列）または生成依存シグネチャが変わったときだけ、古い生成線が
    // 混ざっていないか走査する。視点をドラッグする毎フレームの全線走査を避ける。
    const sceneLength = S.length,
        sceneFirst = sceneLength ? S[0] : null,
        sceneLast = sceneLength ? S[sceneLength - 1] : null;
    if (
        lastObjectGeometryScene !== S ||
        lastObjectGeometrySignature !== currentSignature ||
        lastObjectGeometryLength !== sceneLength ||
        lastObjectGeometryFirst !== sceneFirst ||
        lastObjectGeometryLast !== sceneLast ||
        lastObjectGeometryProjection !== T
    ) {
        const projectionChanged=lastObjectGeometryProjection!==T,
            needsRegen=projectionChanged||S.some((s)=>s.ob&&((T==="f"&&s.cs!==currentSignature)||(s.signalPoleTopRing&&s.signalPoleContourView!==(orthView||"3d"))||(s.preciseTubeEdge&&s.tubeContourView!==(orthView||"3d"))));
        if(needsRegen)regenObjects();
        else if(T!=="f"&&lastObjectGeometrySignature!==currentSignature)S.forEach(s=>{if(s.ob)s.cs=currentSignature;});
        lastObjectGeometryScene = S;
        lastObjectGeometrySignature = currentSignature;
        lastObjectGeometryLength = S.length;
        lastObjectGeometryFirst = S.length ? S[0] : null;
        lastObjectGeometryLast = S.length ? S[S.length - 1] : null;
        lastObjectGeometryProjection = T;
    }
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
    const vsMain = viewShift();
    c.setTransform(Z, 0, 0, Z, vsMain[0], vsMain[1]); // 以降はズーム/移動つき
    // 面ONでも塗り色は別設定。塗り色OFF時も後段の深度バッファで隠面処理を行う。
    if(P.surfaceMode&&window.__surfaceColors)drawObjectSurfaces(c);
    let threeMainLines = false;
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
    threeMainLines = false;
    if (P.surfaceMode) {
        // 面の深度判定も線画もCanvas経路で描画する。
        if (threeMainLines) {
            S.forEach((s) => { if (!s?.d3 && (!s.ob || objectVisible(s.ob))) strokeW(c,s); });
            drawCur(c);
        } else {
            c.save(); c.setTransform(1,0,0,1,0,0); c.drawImage(lineLayer(true,true,W,H,null,true),0,0); c.restore();
        }
    } else if ($("bin").checked) {
        if (threeMainLines) S.forEach((s) => { if (!s?.d3 && (!s.ob || objectVisible(s.ob))) strokeW(c,s); });
        else { c.save(); c.setTransform(1,0,0,1,0,0); c.drawImage(lineLayer(true,true),0,0); c.restore(); }
        drawCur(c);
    } else if (threeMainLines) {
        S.forEach((s) => { if (!s?.d3 && (!s.ob || objectVisible(s.ob))) strokeW(c,s); });
        drawCur(c);
        if (prev) prev.forEach((s) => strokeW(c,s));
    } else {
        S.forEach((s) => { if (!s.ob || objectVisible(s.ob)) strokeW(c,s); });
        drawPersonSilhouettes(c,false,null,W,H,[Z,0,0,Z,vsMain[0],vsMain[1]]);
        drawCur(c);
        if (prev) prev.forEach((s) => strokeW(c,s));
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
    if (sel && tool === "edit") drawGizmo(c); // 正投影ビューでも選択中オブジェクトのギズモを表示
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
    // VPの目印（画面外なら端に寄せて表示）。正投影には消失点が無いので出さない。
    (orthView ? [] : ["VP1", "VP2", "VP3"]).forEach((nm, i) => {
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
