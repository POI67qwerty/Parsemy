/* City Grid Studio の共通ライブラリ（小さな道具箱）

   ここには「どのモジュールからも使う小さな計算」だけを置く。
   画面・状態・DOM には触らないので、単体で読んでも安全。

   いま入っているもの
     1. CG.depthEps()      … 隠線判定の許容量（奥行きに応じて変える）
     2. CG.lineDedup*      … 同じ線分を2回描かないための「この1回で描いた線分」の記録

   使い方
     - 隠線の判定：`if (depth > z + CG.depthEps(depth)) 隠れている`
     - 線の重複よけ：`CG.lineDedup.begin()` → 描く → `CG.lineDedup.end()`
       その間だけ、同じ線分（1mm 以内で同じ両端）は2回目以降を描かない。
*/
(function (global) {
    "use strict";

    // ===== 1. 隠線判定の許容量 =================================================
    // 「面より これだけ奥にあれば隠れている」と見なす距離（メートル）。
    // 以前は 0.025 m 固定だったため、2cm ほどの細かい部材（手すりの縦桟など）では
    // 奥の線が手前の面を突き抜けて見えていた（面ON で「描かなくていい線」が出る原因）。
    // 逆に小さくしすぎると、面と面が接している稜線（壁の下端と床の上面など）が
    // 面の奥行きと数mm 食い違って点線状に欠ける。
    // そこで「6mm＋奥行きの 0.08%」を許容する。15m 先でも 18mm にしかならないので、
    // 50mm ほどの部材の奥の線は隠れたままになる。
    // 実際に測ると、細かくしても手前の線が消えない下限は 0.0005〜0.002 だったので、
    // 奥行きに比例する小さな値＋最小値で決める。
    //   奥行き 11.7m → 0.0008m ／ 28.7m → 0.0014m
    function depthEps(depth) {
        const d = Math.abs(Number(depth) || 0);
        return Math.max(0.006, d * 0.0008);
    }

    // ===== 2. 同じ線分を2回描かない ==========================================
    // アセットの中には、同じ稜線を複数の部品として持っているものがある
    // （例：屋台271本・建物254本・階段218本ぶんの重複）。そのまま描くと
    // 線が二重・三重になって濃く見え、面ONのときに「線が重なっている」印象になる。
    // データ（genShape の結果）は変えず、描くときだけ間引く。
    // 1mm 単位に丸めた座標を 32bit のハッシュへ畳む。
    // 文字列キー（"123,456,789|..."）は1本ごとに文字列を作るため重く、
    // 10個の屋台（13,760区間）で 1フレーム +14ms かかっていた。
    // 数値キーの入れ子 Map にすると同じ判定が 1ms 未満で済む。
    const GRID = 1000,
        q = (v) => Math.round((Number(v[0]) || 0) * GRID);
    let seen = null; // Map<x1, Set<x2>>：線分の両端のハッシュ（向きは問わない）

    function hash3(a, b, c) {
        let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0;
        h = Math.imul(h ^ (h >>> 13), 1103515245);
        return (h ^ (h >>> 16)) | 0;
    }
    function keyOf(v) {
        // 1mm 格子。x を上位に置いた単純な合成（同じ点なら必ず同じ値）。
        const x = Math.round(q(v) / 4),
            y = Math.round((Number(v[1]) || 0) * GRID),
            z = Math.round((Number(v[2]) || 0) * GRID);
        return hash3(x, y, z);
    }

    const lineDedup = {
        // ===== 形が変わったときに1回だけ呼ぶ =====
        // 線ごとに「この区間は他の線と重なっている」印（Uint8Array）を付ける。
        // 描画のたびに判定すると 10個の手すりで +13ms かかったため、
        // 生成時（形が変わったとき）に1回だけ計算し、描画では印を見るだけにする。
        mark(lines) {
            if (!Array.isArray(lines) || !lines.length) return lines;
            const map = new Map();
            lines.forEach((s) => {
                const pts = s && s.p;
                if (!Array.isArray(pts) || pts.length < 2) return;
                let flags = null;
                for (let i = 1; i < pts.length; i++) {
                    const a = pts[i - 1],
                        b = pts[i];
                    if (!a || !b || a.length < 3 || b.length < 3) continue;
                    const ka = keyOf(a),
                        kb = keyOf(b);
                    if (map.get(ka)?.has(kb) || map.get(kb)?.has(ka)) {
                        if (!flags) flags = new Uint8Array(pts.length - 1);
                        flags[i - 1] = 1;
                    } else {
                        let set = map.get(ka);
                        if (!set) map.set(ka, (set = new Set()));
                        set.add(kb);
                    }
                }
                if (flags) s.dup = flags;
            });
            return lines;
        },
        begin() {
            seen = new Map();
        },
        end() {
            seen = null;
        },
        get active() {
            return !!seen;
        },
        // 「もう描いた線分か」を返す（初めてなら記録して false）。
        skip(a, b) {
            const cur = seen;
            if (!cur) return false;
            const ka = keyOf(a),
                kb = keyOf(b);
            if (cur.get(ka)?.has(kb) || cur.get(kb)?.has(ka)) return true;
            let set = cur.get(ka);
            if (!set) cur.set(ka, (set = new Set()));
            set.add(kb);
            return false;
        },
    };

    global.CG = Object.assign(global.CG || {}, { depthEps, lineDedup });
})(typeof window !== "undefined" ? window : globalThis);
