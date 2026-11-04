/* ===== asset-kit.js : アセットを「1つの形の記述」から作る小さな道具箱 =====
 *
 * これまで新しいアセットを1つ足すには、同じ形を2か所に書く必要があった。
 *   ・asset.js の ASSET_LINE_BUILDERS[kind]      … 線画（線）
 *   ・engine-render.js の exportSurfaceTriangles … 面（塗り・隠線判定）
 *
 * この道具箱では「部品（parts）の一覧」を1回書くだけで、線と面の両方が同じ形から作られる。
 *
 *   使い方（新しいアセットの例）
 *
 *     ASSET_KIT.define(
 *         "lightboxSign",
 *         { label: "電光看板", glyph: "▤", w: 1.0, d: 0.34, h: 1.2, accent: "#ff5a7a" },
 *         (o, K) => [
 *             K.box(K.rectPath(1.0, 0.17), 0.4, 1.2),      // 部品1（看板の板）
 *             K.box(K.rectPath(0.06, 0.06, 0.45), 0, 0.4), // 部品2（脚）
 *         ],
 *     );
 *
 * きまり
 *   ・座標は既存アセットと同じ「x=左右 / y=奥行き / z=高さ（上が＋）」のローカル座標。
 *     ワールドへの変換は L2W()（＝回転・生成面 k・接着に追従）に任せる。
 *   ・部品は「2Dの道筋（path）＋ 押し出し」で表す。箱も円柱も同じ形で書ける。
 *   ・線は部品の稜線をそのまま出す。面の内側に入り込んだ線は、既存の
 *     「面の内側の線は描かない」判定（engine-render.js の interiorOfFace）が消す。
 *   ・面は triangle（3点）で返し、奥行きバッファ・隠線・シルエット判定にそのまま乗る。
 *
 * 部品（part）のフィールド
 *   path      : [[u, v], ...]  2Dの道筋（自動で閉じる）
 *   axis      : "z"（既定）/ "y" / "x"  押し出す向き。path はその軸に垂直な面内の座標。
 *               "z" → (u,v)=(x,y) ／ "y" → (u,v)=(x,z) ／ "x" → (u,v)=(y,z)
 *   z0, z1    : 押し出す範囲（axis に沿った座標。名前は z だが向きは axis に従う）
 *   holes     : [[[u,v], ...], ...] 穴（道筋の内側の穴。ブーリアン差）
 *   holeSides : true で穴の内側の壁も作る
 *   color     : 線の色（省略時は o.c）／ width : 線の太さ
 *   noTop / noBottom / noSides : その面を出さない（ガラス面・開放面など）
 *   sheet     : 側面と縦の線を出さない（板・シート）
 *   rings     : 断面を積み上げる部品（K.loft / K.roundedBox が作る）
 *   poly      : 自由な3Dの面（K.face3。文字の板・斜めのガラスなど）
 */
const ASSET_KIT = (function () {
    const TAU = Math.PI * 2,
        KIT_TRIS = Object.create(null), // kind -> (o) => ワールド座標の三角形
        KIT_POINTS = Object.create(null); // 線・面の頂点（登録型アセットの選択範囲）

    const num = (v, f) => (Number.isFinite(Number(v)) ? Number(v) : f);
    // 画面から編集できる値（o[key]）→ ASSETS の初期値 → 最後の決め打ち、の順に見る。
    // これで新しいアセットは asset-controller.js を触らなくても初期値を持てる。
    function param(o, key, fallback) {
        const v = o ? o[key] : undefined;
        if (Number.isFinite(Number(v))) return Number(v);
        const d = o && o.asset ? ASSETS[o.asset] : null;
        if (d && Number.isFinite(Number(d[key]))) return Number(d[key]);
        const field=Array.isArray(d?.controls)?d.controls.find(c=>c.key===key):null;
        if(field && field.default !== undefined && Number.isFinite(Number(field.default))) return Number(field.default);
        return fallback;
    }

    // ===== 押し出す向き（axis）=====
    // 道筋の2D座標 (u, v) と、押し出し位置 w から、ローカルの3D点を作る。
    //   z（既定）: u=x, v=y, w=z   … 上へ押し出す（箱・柱・垂直に立つ板）
    //   y        : u=x, v=z, w=y   … 奥へ押し出す（正面を向いた板・壁）
    //   x        : u=y, v=z, w=x   … 横へ押し出す（横を向いた板）
    function toP3(axis, u, v, w) {
        if (axis === "y") return [u, w, v];
        if (axis === "x") return [w, u, v];
        return [u, v, w];
    }

    // ===== 2Dの道筋 =====
    // 長方形（左下から反時計回り）
    function rectPath(w, d, cx = 0, cy = 0) {
        const x = Math.max(1e-4, Math.abs(w)) / 2,
            y = Math.max(1e-4, Math.abs(d)) / 2;
        return [
            [cx - x, cy - y],
            [cx + x, cy - y],
            [cx + x, cy + y],
            [cx - x, cy + y],
        ];
    }
    // 角を丸めた長方形。点の数は常に 4*(steps+1) で固定（断面を積み上げる時に必要）。
    function ringPath(w, d, r, steps = 2, cx = 0, cy = 0) {
        const x = Math.max(1e-4, Math.abs(w)) / 2,
            y = Math.max(1e-4, Math.abs(d)) / 2,
            rr = Math.max(0, Math.min(Math.abs(r), Math.min(x, y) * 0.999)),
            n = Math.max(1, Math.round(steps)),
            out = [],
            quads = [
                [x - rr, -(y - rr), -Math.PI / 2],
                [x - rr, y - rr, 0],
                [-(x - rr), y - rr, Math.PI / 2],
                [-(x - rr), -(y - rr), Math.PI],
            ];
        quads.forEach(([qx, qy, a0]) => {
            for (let i = 0; i <= n; i++) {
                const t = a0 + (i / n) * (Math.PI / 2);
                out.push([cx + qx + Math.cos(t) * rr, cy + qy + Math.sin(t) * rr]);
            }
        });
        return out;
    }
    // 角を丸めた長方形（丸みが 0 のときは4点の長方形）
    function roundRectPath(w, d, r, seg = 2, cx = 0, cy = 0) {
        const rr = Math.abs(Number(r) || 0);
        if (rr < 1e-5) return rectPath(w, d, cx, cy);
        return ringPath(w, d, rr, seg, cx, cy);
    }
    // 円（n 角形）
    function circlePath(r, n = 20, cx = 0, cy = 0) {
        const rr = Math.max(1e-4, Math.abs(r)),
            cnt = Math.max(3, Math.round(n)),
            out = [];
        for (let i = 0; i < cnt; i++) {
            const t = (i / cnt) * TAU;
            out.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]);
        }
        return out;
    }
    // 道筋を動かす・縮める・回す
    function offsetPath(path, du = 0, dv = 0) {
        return path.map(([u, v]) => [u + du, v + dv]);
    }
    function scalePath(path, su = 1, sv = 1, cu = 0, cv = 0) {
        return path.map(([u, v]) => [cu + (u - cu) * su, cv + (v - cv) * sv]);
    }
    // 多角形を内側へ t だけ縮める（L字・コの字のような「凹みのある」形でも使える）。
    // 反時計回りの多角形を前提に、各辺を左（＝内側）へ t ずらし、頂点では
    // 隣り合う2辺のずらし量を足して交点を作る。辺が軸に平行な図形なら、
    // この足し算がそのまま正しい角の位置になる（凸でも凹でも同じ）。
    function insetPath(path, t) {
        const n = (path || []).length,
            off = Math.abs(Number(t) || 0);
        if (n < 3 || off < 1e-9) return (path || []).map(([u, v]) => [u, v]);
        const dir = (a, b) => {
            const du = b[0] - a[0],
                dv = b[1] - a[1],
                len = Math.hypot(du, dv) || 1;
            // 左向きの法線（反時計回りの多角形では内側を向く）
            return [(-dv / len) * off, (du / len) * off];
        };
        return path.map((v, k) => {
            const p = path[(k - 1 + n) % n],
                q = path[(k + 1) % n],
                a = dir(p, v),
                b = dir(v, q);
            return [v[0] + a[0] + b[0], v[1] + a[1] + b[1]];
        });
    }
    function rotatePath(path, deg, cu = 0, cv = 0) {
        const t = (deg * Math.PI) / 180,
            c = Math.cos(t),
            s = Math.sin(t);
        return path.map(([u, v]) => [cu + (u - cu) * c - (v - cv) * s, cv + (u - cu) * s + (v - cv) * c]);
    }

    // ===== 並べる道具 =====
    // 本数を整数へ丸めて範囲に収める（段数・柱の本数・窓の数）。
    function count(v, dflt = 1, min = 1, max = 999) {
        const n = Math.round(Number(v));
        return Math.max(min, Math.min(max, Number.isFinite(n) ? n : dflt));
    }
    // 同じ形を規則的に並べる。fn(i, t) は部品（配列でも1つでもよい）を返す。
    // t は 0→1 の進み具合（段の高さ・柱の位置などをここで決める）。
    // 部品だけでなく線（lineA/polyA の戻り値）を返してもよいので、
    // 既存アセットの「線の選び方」を変えずに繰り返しだけを畳める。
    function repeat(n, fn) {
        const out = [],
            cnt = Math.max(0, Math.round(Number(n) || 0));
        for (let i = 0; i < cnt; i++) {
            const r = fn(i, cnt > 1 ? i / (cnt - 1) : 0);
            if (Array.isArray(r)) r.forEach((q) => q && out.push(q));
            else if (r) out.push(r);
        }
        return out;
    }
    // 格子（行×列）。fn(row, col, u, v) は部品を返す。u/v は 0→1 の進み具合。
    function grid(rows, cols, fn) {
        return repeat(rows, (r, u) => repeat(cols, (c, v) => fn(r, c, u, v)));
    }
    // ===== 回転体 =====
    // 断面 [[r, z], …] を z 軸のまわりに回して立体にする（球・円錐・脚・植木鉢）。
    // 断面は下から上へ。r が 0 の点は軸の上（先端・頂点）として扱う。
    //   seg  … 円周の分割（既定 20）
    //   rings… 線を足す段の番号（断面の点の index。既定は上下の端だけ）
    function revolution(profile, opts = {}) {
        const seg = Math.max(3, Math.round(opts.seg || 20)),
            cx = opts.cx || 0,
            cy = opts.cy || 0,
            pts = (profile || []).map(([r, z]) => [Math.max(0, Math.abs(Number(r) || 0)), Number(z) || 0]),
            rings = pts.map(([r, z]) => ({ path: circlePath(Math.max(r, 1e-4), seg, cx, cy), w: z })),
            first = pts[0]?.[0] || 0,
            last = pts[pts.length - 1]?.[0] || 0;
        if (rings.length < 2) return loft([]);
        return loft(rings, {
            capStart: opts.capStart ?? first > 1e-4, // 先端が軸上なら面を出さない（潰れた三角形を作らない）
            capEnd: opts.capEnd ?? last > 1e-4,
            ringLines: (opts.rings || []).filter((k) => k > 0 && k < pts.length - 1),
            verts: Math.max(0, Math.round(opts.verts || 0)),
        });
    }

    // ===== 部品（parts）=====
    function prism(path, z0, z1, extra = {}) {
        return { path, z0: Math.min(z0, z1), z1: Math.max(z0, z1), ...extra };
    }
    const box = (path, z0, z1, extra = {}) => prism(path, z0, z1, extra);
    // x-z断面の四隅だけを丸め、前後（y）にそのまま押し出す。
    // 前後端面の外周には別のベベルを作らない。
    function depthBeveledBox(w, d, h, r, opts = {}) {
        const width=Math.max(1e-4,Math.abs(Number(w)||0)),depth=Math.max(1e-4,Math.abs(Number(d)||0)),
            height=Math.max(1e-4,Math.abs(Number(h)||0)),
            radius=Math.max(0,Math.min(Number(r)||0,Math.min(width,height)*.4999)),
            segments=Math.max(1,Math.min(12,Math.round(Number(opts.seg)||3))),
            z0=Number.isFinite(Number(opts.z0))?Number(opts.z0):0,
            path=roundRectPath(width,height,radius,segments,0,z0+height/2);
        return box(path,-depth/2,depth/2,{axis:"y",depthBevelEdge:true});
    }
    // 上下の面だけ（板・シート）。側面の線は出さない。
    const sheet = (path, z0, z1, extra = {}) => prism(path, z0, z1, { ...extra, sheet: true });
    // 円柱（脚・ポール・棒・タイヤ）。断面は正円の n 角形。
    //   seg        … 断面の角数（8〜24 くらい。大きいほど滑らか）
    //   axis       … 押し出す向き（"z" が既定＝立てる、"y"＝奥へ、"x"＝横へ）
    //   caps       … 上下の面（既定 true）
    //   verts      … 側面に足す縦線の本数（既定 0＝輪だけ。視線に直角な線は
    //                エンジンが自動で出せないので、必要な時だけ指定する）
    // 円の面は「中心から扇状に」分割する（既存アセットの円柱と同じ作り）。
    function cylinder(r, z0, z1, opts = {}) {
        const seg = Math.max(3, Math.round(opts.seg || 20));
        return prism(circlePath(r, seg, opts.cx || 0, opts.cy || 0), z0, z1, {
            axis: opts.axis || "z",
            centerCaps: opts.caps !== false,
            noBottom: opts.caps === false,
            noTop: opts.caps === false,
            smooth: true,
            verts: Math.max(0, Math.round(opts.verts || 0)),
        });
    }
    // 自由な3Dの面（斜めのガラス・屋根・文字の板）。凸であること。
    function face3(poly, extra = {}) {
        return {
            poly: poly.map((q) => [Number(q[0]) || 0, Number(q[1]) || 0, Number(q[2]) || 0]),
            ...extra,
        };
    }
    // 断面（rings）を積み上げた部品。rings = [{ path, w }, ...]（path の点数は全部同じ）
    function loft(rings, extra = {}) {
        return { rings: rings.filter((r) => r && Array.isArray(r.path) && r.path.length >= 3), ...extra };
    }

    // ===== 面の三角形分割 =====
    function area2(path) {
        let s = 0;
        for (let i = 0; i < path.length; i++) {
            const a = path[i],
                b = path[(i + 1) % path.length];
            s += a[0] * b[1] - b[0] * a[1];
        }
        return s / 2;
    }
    const ccw = (path) => (area2(path) > 0 ? path.slice() : path.slice().reverse());
    const cw = (path) => (area2(path) < 0 ? path.slice() : path.slice().reverse());
    function isConvex(path) {
        if (!path || path.length < 3) return false;
        let sign = 0;
        for (let i = 0; i < path.length; i++) {
            const a = path[i],
                b = path[(i + 1) % path.length],
                c = path[(i + 2) % path.length],
                cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
            if (Math.abs(cr) < 1e-9) continue;
            const s = cr > 0 ? 1 : -1;
            if (!sign) sign = s;
            else if (s !== sign) return false;
        }
        return true;
    }
    // 穴を外側の道筋へ橋渡しでつなぐ（1本の多角形にする）。
    // 穴のいちばん右の点から右向きに線を出し、外側と最初に当たる点と結ぶ。
    function bridgeHoles(outer, holes) {
        let poly = ccw(outer);
        const list = holes
            .filter((h) => Array.isArray(h) && h.length >= 3)
            .map((h) => cw(h))
            .sort((a, b) => Math.max(...b.map((p) => p[0])) - Math.max(...a.map((p) => p[0])));
        for (const hole of list) {
            let hi = 0;
            for (let i = 1; i < hole.length; i++) if (hole[i][0] > hole[hi][0]) hi = i;
            const P = hole[hi],
                py = P[1],
                px = P[0];
            let best = null;
            for (let i = 0; i < poly.length; i++) {
                const a = poly[i],
                    b = poly[(i + 1) % poly.length];
                if (a[1] > py === b[1] > py) continue;
                const t = (py - a[1]) / (b[1] - a[1]),
                    x = a[0] + (b[0] - a[0]) * t;
                if (x < px - 1e-9) continue;
                if (!best || x < best.x) best = { x, i };
            }
            if (!best) continue; // 穴が外側の外にある → 穴として扱わない
            const merged = [],
                cut = [best.x, py];
            for (let i = 0; i <= best.i; i++) merged.push(poly[i]);
            merged.push(cut);
            const rot = hole.slice(hi).concat(hole.slice(0, hi));
            rot.forEach((p) => merged.push(p));
            merged.push(P, cut);
            for (let i = best.i + 1; i < poly.length; i++) merged.push(poly[i]);
            poly = merged;
        }
        return poly;
    }
    // 2Dの道筋（＋穴）→ 三角形（[a,b,c] の組）。凹みも穴も分割できる。
    function triangulate(path, holes) {
        if (!path || path.length < 3) return [];
        const hasHoles = Array.isArray(holes) && holes.some((h) => Array.isArray(h) && h.length >= 3),
            poly = hasHoles ? bridgeHoles(path, holes) : path;
        if (poly.length === 3) return [[poly[0], poly[1], poly[2]]];
        if (!hasHoles && isConvex(poly)) {
            const out = [];
            for (let i = 1; i < poly.length - 1; i++) out.push([poly[0], poly[i], poly[i + 1]]);
            return out;
        }
        if (typeof polygonEarClip === "function") {
            const res = polygonEarClip(poly);
            if (res && res.length >= poly.length - 2) return res;
            if (res && res.length) return res;
        }
        const out = []; // 最後の逃げ道（壊れた形でも線画が消えないように）
        for (let i = 1; i < poly.length - 1; i++) out.push([poly[0], poly[i], poly[i + 1]]);
        return out;
    }

    // ===== 部品カタログ（よく使う小物を使い回す）=====
    // 登録した部品は K.parts("window", {...}) で「部品の一覧」として取り出せる。
    const PARTS = Object.create(null);
    function registerPart(name, build) {
        if (!name || typeof build !== "function") return false;
        PARTS[name] = build;
        return true;
    }
    function partNames() {
        return Object.keys(PARTS);
    }
    // 部品を置く方向（axis）ごとの、移動量 (dx,dy,dz) → 道筋の移動 (du,dv) と押し出しの移動 dw。
    function shiftOf(axis, dx, dy, dz) {
        if (axis === "y") return [dx, dz, dy];
        if (axis === "x") return [dy, dz, dx];
        return [dx, dy, dz];
    }
    // 部品（部品の一覧）をまとめて動かす。押し出し・積み上げ・自由な面のどれでも動く。
    function moveParts(parts, dx = 0, dy = 0, dz = 0) {
        const list = Array.isArray(parts) ? parts : [parts];
        return list.filter(Boolean).map((part) => {
            if (Array.isArray(part.poly)) return { ...part, poly: part.poly.map(([x, y, z]) => [x + dx, y + dy, z + dz]) };
            if (Array.isArray(part.rings)) {
                const [du, dv, dw] = shiftOf(part.axis || "z", dx, dy, dz);
                return {
                    ...part,
                    rings: part.rings.map((r) => ({ ...r, path: offsetPath(r.path, du, dv), w: r.w + dw })),
                };
            }
            const [du, dv, dw] = shiftOf(part.axis || "z", dx, dy, dz);
            return {
                ...part,
                path: offsetPath(part.path || [], du, dv),
                z0: (part.z0 || 0) + dw,
                z1: (part.z1 || 0) + dw,
                holes: (part.holes || []).map((h) => offsetPath(h, du, dv)),
            };
        });
    }
    // カタログから部品を取り出す。opts.at = [x, y, z] でその場へ置ける。
    function part(name, opts = {}) {
        const make = PARTS[name];
        if (!make) return [];
        const res = make(opts, API),
            list = Array.isArray(res) ? res.filter(Boolean) : res ? [res] : [],
            at = Array.isArray(opts.at) ? opts.at : [0, 0, 0];
        return at[0] || at[1] || at[2] ? moveParts(list, at[0] || 0, at[1] || 0, at[2] || 0) : list;
    }

    // ===== 部品 → 線 =====
    const closedLoop = (path, axis, w) => [...path, path[0]].map(([u, v]) => toP3(axis, u, v, w));
    function partEdges(part) {
        // 任意のメッシュも線と面を一つの部品にまとめる。
        if (Array.isArray(part.meshEdges)) return part.meshEdges;
        // 自由な3Dの面
        if (Array.isArray(part.poly)) {
            const poly = part.poly;
            return poly.length < 3 ? [] : [[...poly, poly[0]]];
        }
        // 断面の積み上げ
        if (Array.isArray(part.rings)) {
            const rings = part.rings,
                axis = part.axis || "z",
                out = [];
            if (rings.length < 2) return out;
            out.push(closedLoop(rings[0].path, axis, rings[0].w));
            out.push(closedLoop(rings[rings.length - 1].path, axis, rings[rings.length - 1].w));
            (part.ringLines || []).forEach((k) => {
                if (rings[k]) out.push(closedLoop(rings[k].path, axis, rings[k].w));
            });
            const n = rings[0].path.length;
            (part.verticals || []).forEach((k) => {
                const idx = ((Math.round(k) % n) + n) % n;
                for (let i = 0; i < rings.length - 1; i++) {
                    const a = rings[i],
                        b = rings[i + 1];
                    out.push([
                        toP3(axis, a.path[idx][0], a.path[idx][1], a.w),
                        toP3(axis, b.path[idx][0], b.path[idx][1], b.w),
                    ]);
                }
            });
            return out;
        }
        // 押し出し
        const path = part.path || [],
            axis = part.axis || "z",
            out = [];
        if (path.length < 3) return out;
        if (!part.noBottom) out.push(closedLoop(path, axis, part.z0));
        if (!part.noTop) out.push(closedLoop(path, axis, part.z1));
        (part.holes || []).forEach((h) => {
            if (!Array.isArray(h) || h.length < 3) return;
            if (!part.noBottom) out.push(closedLoop(h, axis, part.z0));
            if (!part.noTop) out.push(closedLoop(h, axis, part.z1));
        });
        if (part.sheet || part.noSides) return out;
        // 円柱（smooth）は全頂点に縦線を出すと筒が縞になる。輪だけ描き、
        // 縦線は verts 本（0 なら無し）だけを等間隔で足す。
        if (part.smooth) {
            const n = Math.max(0, Math.round(part.verts || 0)),
                indices = Array.isArray(part.verticals) ? part.verticals : Array.from({length:n}, (_,k) => Math.round((k * path.length) / n) % path.length);
            for (const idx of indices) {
                const [u, v] = path[((Math.round(idx) % path.length) + path.length) % path.length];
                out.push([toP3(axis, u, v, part.z0), toP3(axis, u, v, part.z1)]);
            }
            return out;
        }
        const sideIndices = Array.isArray(part.sideVerticals) ? part.sideVerticals : path.map((_, i) => i);
        for (const index of sideIndices) {
            const [u,v]=path[((index % path.length)+path.length)%path.length];
            out.push([toP3(axis, u, v, part.z0), toP3(axis, u, v, part.z1)]);
        }
        if (part.holeSides)
            (part.holes || []).forEach((h, hi) => {
                if (!Array.isArray(h) || h.length < 3) return;
                const indices=Array.isArray(part.holeSideVerticals?.[hi]) ? part.holeSideVerticals[hi] : h.map((_, i)=>i);
                for (const index of indices) {
                    const [u,v]=h[((index % h.length)+h.length)%h.length];
                    out.push([toP3(axis, u, v, part.z0), toP3(axis, u, v, part.z1)]);
                }
            });
        return out;
    }

    // ===== 部品 → 面（ローカル3Dの三角形）=====
    function partTris(part) {
        if (Array.isArray(part.meshTriangles)) return part.meshTriangles;
        const out = [];
        if (Array.isArray(part.poly)) {
            const poly = part.poly;
            if (poly.length < 3) return out;
            for (let i = 1; i < poly.length - 1; i++) out.push([poly[0], poly[i], poly[i + 1]]);
            return out;
        }
        const axis = part.axis || "z";
        if (Array.isArray(part.rings)) {
            const rings = part.rings;
            if (rings.length < 2) return out;
            for (let i = 0; i < rings.length - 1; i++) {
                const a = rings[i],
                    b = rings[i + 1],
                    n = Math.min(a.path.length, b.path.length);
                for (let k = 0; k < n; k++) {
                    const k2 = (k + 1) % n,
                        A = toP3(axis, a.path[k][0], a.path[k][1], a.w),
                        B = toP3(axis, a.path[k2][0], a.path[k2][1], a.w),
                        C = toP3(axis, b.path[k2][0], b.path[k2][1], b.w),
                        D = toP3(axis, b.path[k][0], b.path[k][1], b.w);
                    out.push([A, B, C], [A, C, D]);
                }
            }
            if (part.capEnd !== false) {
                const last = rings[rings.length - 1];
                triangulate(last.path).forEach(([x, y, z]) =>
                    out.push([toP3(axis, x[0], x[1], last.w), toP3(axis, y[0], y[1], last.w), toP3(axis, z[0], z[1], last.w)]),
                );
            }
            if (part.capStart !== false) {
                const first = rings[0];
                triangulate([...first.path].reverse()).forEach(([x, y, z]) =>
                    out.push([toP3(axis, x[0], x[1], first.w), toP3(axis, y[0], y[1], first.w), toP3(axis, z[0], z[1], first.w)]),
                );
            }
            return out;
        }
        const path = part.path || [],
            holes = part.holes || [];
        if (path.length < 3) return out;
        // 円柱の上下の面：中心から扇状に分割する（既存アセットの円柱と同じ作り）。
        if (part.centerCaps && !part.sheet) {
            const n = path.length,
                cu = path.reduce((a, p) => a + p[0], 0) / n,
                cv = path.reduce((a, p) => a + p[1], 0) / n,
                C0 = toP3(axis, cu, cv, part.z0),
                C1 = toP3(axis, cu, cv, part.z1);
            for (let i = 0; i < n; i++) {
                const a = path[i],
                    b = path[(i + 1) % n],
                    A0 = toP3(axis, a[0], a[1], part.z0),
                    B0 = toP3(axis, b[0], b[1], part.z0),
                    A1 = toP3(axis, a[0], a[1], part.z1),
                    B1 = toP3(axis, b[0], b[1], part.z1);
                if (!part.noTop) out.push([C1, A1, B1]);
                if (!part.noBottom) out.push([C0, B0, A0]);
            }
        } else {
            if (!part.noBottom)
                triangulate(path, holes).forEach(([a, b, c]) =>
                    out.push([
                        toP3(axis, a[0], a[1], part.z0),
                        toP3(axis, b[0], b[1], part.z0),
                        toP3(axis, c[0], c[1], part.z0),
                    ]),
                );
            if (!part.noTop)
                triangulate(path, holes).forEach(([a, b, c]) =>
                    out.push([
                        toP3(axis, a[0], a[1], part.z1),
                        toP3(axis, b[0], b[1], part.z1),
                        toP3(axis, c[0], c[1], part.z1),
                    ]),
                );
        }
        if (part.sheet || part.noSides) return out;
        const wall = (p, flip) => {
            for (let i = 0; i < p.length; i++) {
                const a = p[i],
                    b = p[(i + 1) % p.length],
                    A = toP3(axis, a[0], a[1], part.z0),
                    B = toP3(axis, b[0], b[1], part.z0),
                    C = toP3(axis, b[0], b[1], part.z1),
                    D = toP3(axis, a[0], a[1], part.z1);
                if (flip) out.push([A, C, B], [A, D, C]);
                else out.push([A, B, C], [A, C, D]);
            }
        };
        wall(path, false);
        if (part.holeSides) holes.forEach((h) => Array.isArray(h) && h.length >= 3 && wall(h, true));
        return out;
    }

    // ===== 曲面の押し出し（上下の縁を丸めた直方体）=====
    // 水平の断面を少しずつ内側へずらして積む。丸みは上下の縁と四隅の両方へ付く。
    //   radius        : 上下の縁の丸み（m）
    //   cornerRadius  : 四隅（縦の稜線）の丸み（m）。省略時は radius と同じ。
    function roundedBox(w, d, h, radius, opts = {}) {
        const seg = Math.max(1, Math.round(opts.seg ?? 3)),
            hseg = Math.max(1, Math.round(opts.cornerSeg ?? 2)),
            cx = Number(opts.cx) || 0,
            cy = Number(opts.cy) || 0,
            z0 = Number(opts.z0) || 0,
            W = Math.max(0.02, Math.abs(w)),
            D = Math.max(0.02, Math.abs(d)),
            H = Math.max(0.02, Math.abs(h)),
            r = Math.max(0, Math.min(Number(radius) || 0, Math.min(W, D, H) / 2 - 1e-3)),
            rc0 = Math.max(0, Math.min(Number(opts.cornerRadius ?? r) || 0, Math.min(W, D) / 2 - 1e-3)),
            rings = [];
        const push = (inset, z) =>
            rings.push({
                path: ringPath(Math.max(0.01, W - 2 * inset), Math.max(0.01, D - 2 * inset), Math.max(0, rc0 - inset), hseg, cx, cy),
                w: z0 + z,
            });
        if (r > 1e-4) {
            for (let i = 0; i <= seg; i++) {
                const a = (i / seg) * (Math.PI / 2); // 0=底面の内側 / 90°=丸みの終わり
                push(r * (1 - Math.sin(a)), r * (1 - Math.cos(a)));
            }
            for (let i = seg; i >= 0; i--) {
                const a = (i / seg) * (Math.PI / 2);
                push(r * (1 - Math.sin(a)), H - r * (1 - Math.cos(a)));
            }
        } else {
            push(0, 0);
            push(0, H);
        }
        const n = rings[0].path.length,
            per = Math.max(1, hseg) + 1,
            verticals = [];
        for (let j = 0; j < 4; j++) {
            verticals.push(j * per, j * per + (per - 1));
        }
        const ringLines = r > 1e-4 ? [...new Set([seg, rings.length - 1 - seg])] : [];
        return loft(rings, {
            verticals: [...new Set(verticals.map((k) => Math.min(n - 1, k)))],
            ringLines,
            ...(opts.extra || {}),
        });
    }

    // ===== 文字（線のフォント）=====
    // 5×7 の格子に線で描いた英大文字・数字・記号。y は上が＋、x は 0〜4。
    // 各文字は「折れ線の配列」。線画エンジンは文字を持たないので、
    // 文字は細い板（面）として出し、縁が線になる（＝看板の文字が読める）。
    const GLYPHS = {
        A: [[[0, 0], [0, 4], [2, 6], [4, 4], [4, 0]], [[0, 2.2], [4, 2.2]]],
        B: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]], [[3, 3], [4, 2], [4, 1], [3, 0], [0, 0]]],
        C: [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1]]],
        D: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 1], [3, 0], [0, 0]]],
        E: [[[4, 6], [0, 6], [0, 0], [4, 0]], [[0, 3.2], [3, 3.2]]],
        F: [[[4, 6], [0, 6], [0, 0]], [[0, 3.2], [3, 3.2]]],
        G: [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2.8], [2, 2.8]]],
        H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3.2], [4, 3.2]]],
        I: [[[2, 0], [2, 6]], [[0.6, 6], [3.4, 6]], [[0.6, 0], [3.4, 0]]],
        J: [[[4, 6], [4, 1], [3, 0], [1, 0], [0, 1]]],
        K: [[[0, 0], [0, 6]], [[4, 6], [0, 2.8]], [[1.4, 3.6], [4, 0]]],
        L: [[[0, 6], [0, 0], [4, 0]]],
        M: [[[0, 0], [0, 6], [2, 3.4], [4, 6], [4, 0]]],
        N: [[[0, 0], [0, 6], [4, 0], [4, 6]]],
        O: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
        P: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 3.4], [3, 2.4], [0, 2.4]]],
        Q: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]], [[2.2, 1.4], [4, -0.6]]],
        R: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 3.4], [3, 2.4], [0, 2.4]], [[2, 2.4], [4, 0]]],
        S: [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 3.8], [1, 3], [3, 3], [4, 2.2], [4, 1], [3, 0], [1, 0], [0, 1]]],
        T: [[[0, 6], [4, 6]], [[2, 6], [2, 0]]],
        U: [[[0, 6], [0, 1], [1, 0], [3, 0], [4, 1], [4, 6]]],
        V: [[[0, 6], [2, 0], [4, 6]]],
        W: [[[0, 6], [1, 0], [2, 3], [3, 0], [4, 6]]],
        X: [[[0, 0], [4, 6]], [[0, 6], [4, 0]]],
        Y: [[[0, 6], [2, 3.2], [4, 6]], [[2, 3.2], [2, 0]]],
        Z: [[[0, 6], [4, 6], [0, 0], [4, 0]]],
        0: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]], [[0.8, 1.2], [3.2, 4.8]]],
        1: [[[0.8, 5], [2, 6], [2, 0]], [[0.6, 0], [3.4, 0]]],
        2: [[[0, 5], [1, 6], [3, 6], [4, 5], [4, 3.8], [0, 0], [4, 0]]],
        3: [[[0, 6], [4, 6], [2.2, 3.6], [3.4, 3.6], [4, 2.6], [4, 1], [3, 0], [1, 0], [0, 1]]],
        4: [[[3, 0], [3, 6], [0, 2], [4, 2]]],
        5: [[[4, 6], [0, 6], [0, 3.4], [3, 3.4], [4, 2.4], [4, 1], [3, 0], [1, 0], [0, 1]]],
        6: [[[3.6, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2.4], [3, 3.4], [0, 3.4]]],
        7: [[[0, 6], [4, 6], [1.4, 0]]],
        8: [
            [[1, 3.4], [3, 3.4], [4, 4.4], [4, 5], [3, 6], [1, 6], [0, 5], [0, 4.4], [1, 3.4]],
            [[1, 3.4], [0, 2.4], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2.4], [3, 3.4]],
        ],
        9: [[[0.4, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 3.6], [1, 2.6], [4, 2.6]]],
        "-": [[[1, 3], [3, 3]]],
        ".": [[[1.8, 0], [2.2, 0], [2.2, 0.4], [1.8, 0.4], [1.8, 0]]],
        ",": [[[2.2, 0.4], [2.2, 0], [1.6, -0.8]]],
        ":": [[[2, 1.4], [2, 1.8]], [[2, 3.6], [2, 4]]],
        "/": [[[3.4, 6], [0.6, 0]]],
        "+": [[[2, 1.6], [2, 4.4]], [[0.8, 3], [3.2, 3]]],
        "!": [[[2, 6], [2, 2]], [[2, 0.6], [2, 0.2]]],
        "?": [[[0, 5], [1, 6], [3, 6], [4, 5], [4, 3.8], [2, 2.6], [2, 1.8]], [[2, 0.6], [2, 0.2]]],
        "&": [[[4, 0], [1.2, 4.2], [1.2, 5.2], [2, 6], [3, 5.4], [3, 4.4], [0, 1.6], [0.8, 0], [2, 0.6], [4, 3]]],
        "(": [[[3, 6], [1.4, 4], [1.4, 2], [3, 0]]],
        ")": [[[1, 6], [2.6, 4], [2.6, 2], [1, 0]]],
        "'": [[[2, 6], [2, 4.6]]],
        "*": [[[2, 3], [2, 5.6]], [[0.8, 3.6], [3.2, 5]], [[3.2, 3.6], [0.8, 5]]],
        " ": [],
    };
    // 文字列 → 2Dの折れ線（中央そろえ）。height は文字の高さ（m）。
    function textStrokes(text, opts = {}) {
        const src = String(text ?? "").toUpperCase(),
            height = Math.max(0.005, Number(opts.height) || 0.1),
            s = height / 6, // 格子 y=0..6 → height
            tracking = Number.isFinite(Number(opts.tracking)) ? Number(opts.tracking) : 1.4,
            advance = (4 + tracking) * s,
            align = opts.align || "center",
            lines = src.split("\n"),
            out = [];
        const widths = lines.map((ln) => (ln.length ? ln.length * advance - tracking * s : 0)),
            maxW = Math.max(...widths, 0);
        lines.forEach((ln, li) => {
            const baseU =
                    align === "left" ? 0 : align === "right" ? -widths[li] : -widths[li] / 2,
                baseV = -((lines.length - 1) / 2) * height * 1.3 + (lines.length - 1 - li) * height * 1.3;
            for (let i = 0; i < ln.length; i++) {
                const g = GLYPHS[ln[i]] || GLYPHS["?"] || [],
                    ox = baseU + i * advance;
                g.forEach((poly) => out.push(poly.map(([x, y]) => [ox + x * s, baseV + (y - 3) * s])));
            }
        });
        out.maxWidth = maxW;
        return out;
    }
    // 文字を「面に貼り付けた板」として返す（線が縁として出る）。
    //   face : "front"（-y を向く面）/ "back" / "left" / "right" / "top"（上向き）
    //   plane: その面の座標（front/back は y、left/right は x、top は z）
    //   u, v : 面内の中心（front の u は x、v は z）
    //   proud: 面から手前へ出す量（板に隠されないように少し出す）
    function textPart(text, opts = {}) {
        const face = opts.face || "front",
            plane = Number(opts.plane) || 0,
            u0 = Number(opts.u) || 0,
            v0 = Number(opts.v) || 0,
            height = Math.max(0.005, Number(opts.height) || 0.1),
            stroke = Math.max(0.003, Number(opts.stroke) || height * 0.14),
            proud = Number.isFinite(Number(opts.proud)) ? Number(opts.proud) : 0.012,
            strokes = textStrokes(text, {
                height,
                tracking: opts.tracking,
                align: opts.align || "center",
            }),
            map = (u, v) => {
                const uu = u + u0,
                    vv = v + v0;
                if (face === "back") return [-uu, plane + proud, vv];
                if (face === "left") return [plane - proud, uu, vv];
                if (face === "right") return [plane + proud, -uu, vv];
                if (face === "top") return [uu, -vv, plane + proud];
                if (face === "bottom") return [uu, vv, plane - proud];
                return [uu, plane - proud, vv]; // front
            },
            parts = [];
        for (const poly of strokes) {
            for (let i = 1; i < poly.length; i++) {
                const a = poly[i - 1],
                    b = poly[i],
                    du = b[0] - a[0],
                    dv = b[1] - a[1],
                    len = Math.hypot(du, dv);
                if (len < 1e-9) continue;
                const nu = (-dv / len) * (stroke / 2),
                    nv = (du / len) * (stroke / 2);
                parts.push(
                    face3(
                        [map(a[0] + nu, a[1] + nv), map(b[0] + nu, b[1] + nv), map(b[0] - nu, b[1] - nv), map(a[0] - nu, a[1] - nv)],
                        { color: opts.color },
                    ),
                );
            }
        }
        parts.width = strokes.maxWidth;
        return parts;
    }

    // ===== 登録 =====
    // meta は ASSETS の初期値（w/d/h のほか、lightboxFrame などの固有値もそのまま入る）。
    // build(o, K) は部品の配列を返す。
    // opts.replace : 既にあるアセットを置き換える（既存アセットの移行用）。
    //                 ASSETS の初期値（寸法・固有値）は既存のものを優先する。
    // opts.lines   : false にすると線は今の描き方（ASSET_LINE_BUILDERS）のまま残し、
    //                 面だけをキットの部品から作る（線を手で選んでいる既存アセット向け）。
    function define(kind, meta, build, opts = {}) {
        if (!kind || typeof build !== "function" || typeof registerAsset !== "function") return false;
        // 共通編集項目を持つ新方式では実際の部品から範囲を算出する。
        // 従来の定義は選択枠を変えない（移行は個別検証後）。
        if(Array.isArray(meta?.controls) && meta.geometryBounds===undefined)meta={...meta,geometryBounds:true};
        const exists = !!(ASSETS[kind] || ASSET_LINE_BUILDERS[kind]);
        if (exists && !opts.replace) return false; // 既存は勝手に触らない
        const lineBuilder = (ctx) => {
            const parts = build(ctx.o, API) || [];
            for (const part of parts) {
                const color = part.color || ctx.c,
                    width = part.width || ctx.o.w;
                let edgeIndex = 0;
                for (const seg of partEdges(part)) {
                    const line=lineA(ctx.o, seg, color, width);
                    if (part.signalPoleTopRing && edgeIndex === 1) {
                        line.signalPoleTopRing = true;
                        line.signalPoleContourView = orthView || "3d";
                    }
                    if (part.signalPoleTopRing && edgeIndex >= 2) line.signalPoleSide = true;
                    edgeIndex++;
                    if (part.signalSmoothSide) line.signalSmoothSide = true;
                    if (part.preciseTubeEdge) {
                        line.preciseTubeEdge = true;
                        line.tubeContourView = (typeof orthView !== 'undefined' && orthView) || '3d';
                    }
                    if(part.depthBevelEdge) line.depthBevelEdge=true;
                    ctx.out.push(line);
                }
            }
        };
        if (!exists) {
            if (!registerAsset(kind, meta, lineBuilder)) return false;
        } else {
            ASSETS[kind] = { ...ASSETS[kind], ...meta };
            if (opts.lines !== false) ASSET_LINE_BUILDERS[kind] = lineBuilder;
        }
        KIT_POINTS[kind] = (o) => {
            const points=[];
            for(const part of build(o,API)||[]) {
                for(const seg of partEdges(part))for(const v of seg)points.push(L2W(o,...v));
                for(const tri of partTris(part))for(const v of tri)points.push(L2W(o,...v));
            }
            return points;
        };
        KIT_TRIS[kind] = (o) => {
            const parts = build(o, API) || [],
                tris = [];
            for (const part of parts) for (const t of partTris(part)) tris.push([L2W(o, ...t[0]), L2W(o, ...t[1]), L2W(o, ...t[2])]);
            return tris;
        };
        return true;
    }

    // 登録型ハンドルの定番形。anchorを基準に、axis方向へvalueだけ離れた点を掴む。
    // 引数に負の方向を渡せば、逆方向へ増える寸法にも利用できる。
    function axisHandle(axis, anchor, value, sign=1) {
        const index={x:0,y:1,z:2}[axis];
        if(index===undefined || !Array.isArray(anchor) || anchor.length!==3)return null;
        const sample=anchor.slice(),probe=anchor.slice();
        sample[index]+=sign*value;probe[index]+=sign*(value+1);
        return {anchor:anchor.slice(),sample,probe,fallback:axis==="z"?{x:0,y:-sign}:{x:sign,y:0}};
    }
    const API = {
        // 登録
        define,
        // 値の読み取り
        param,
        num,
        // 2Dの道筋
        rectPath,
        roundRectPath,
        depthBeveledBox,
        ringPath,
        cylinder,
        part,
        partNames,
        registerPart,
        moveParts,
        count,
        repeat,
        grid,
        revolution,
        circlePath,
        offsetPath,
        scalePath,
        insetPath,
        rotatePath,
        // 部品
        prism,
        box,
        sheet,
        face3,
        loft,
        // 曲面（上下の縁を丸めた直方体）
        roundedBox,
        // 文字
        textStrokes,
        textPart,
        glyphs: () => Object.keys(GLYPHS),
        axisHandle,
        // 検査用
        toP3,
        isConvex,
        area2,
        bridgeHoles,
        triangulate,
        partEdges,
        partTris,
        kinds: () => Object.keys(KIT_TRIS),
    };
    window.ASSET_KIT = API;
    // engine-render.js の exportSurfaceTriangles() から呼ぶ入口。
    window.assetKitBoundsPoints = (o) => {
        const fn=o && o.asset?KIT_POINTS[o.asset]:null;
        return fn?fn(o):null;
    };
    window.assetKitTriangles = (o) => {
        const fn = o && o.asset ? KIT_TRIS[o.asset] : null;
        return fn ? fn(o) : null;
    };
    return API;
})();
