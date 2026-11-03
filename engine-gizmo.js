/* City Grid Studio: ギズモとアセットの寸法（分割モジュール1/4）

   engine-tools.js を役割ごとに4つへ分割したうちの1つ。読み込み順は
     1. engine-gizmo.js   ← このファイル（ギズモ・当たり判定・ドラッグ・アセットの寸法）
     2. engine-render.js     書き出し範囲・隠れ線・線画レイヤー・グリッド・描画
     3. engine-input.js      ポインター・ピンチ・消しゴム・モード切替
     4. engine-io.js         画像書き出し・参考写真・グリッド種類・保存/読み込み・起動
   中身は分割前と同一（グローバル空間を共有するので、分割しても挙動は変わらない）。
   分割したのは「どこに何があるか」を探しやすくするため。 */
/* City Grid Studio engine tools.
   選択・ギズモ・スナップ・描画・書き出し・ポインター操作を担当する。

   主な流れ
   1. gizmo / specialGizmo で表示中の操作ハンドルを作る
   2. hitGizmo でクリック対象を決める
   3. beginGizmo / dragEdit でドラッグ量を寸法・位置へ変換する
   4. render で面・線・補助UIを再描画する
   5. 保存・書き出し・タッチ操作を末尾のイベント処理へ接続する

   アセット形状は asset.js、棚・パネル・間取り専用操作は
   asset-controller.js / studio-ui.js が担当する。 */
// ===== 1. ブレンダー風ギズモ：矢印(XYZ軸の移動)・白い四角(面の押し引き)・点線の輪(回転) =====
// 3Dビューでは透視／魚眼、間取りでは正投影へ自動的に振り分ける。
const scr3 = (p) => (orthView ? scr(p) : scr(V.nrm(p)));
const scrW = (p) => scr3(V.add(p, CO())); // ワールド座標の点の画面位置
const cloc = (o) => V.add(camPos(), o.off || [0, 0, 0], 1, -1); // 図形の座標系で見たカメラ位置
const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
// カメラの向きで裏へ回り込んだハンドルは、輪郭の外側へ逃がして描く。
// 逃がす距離は画面のピクセル基準なので、ズーム倍率Zで割って座標系に合わせる。
const hiddenHandleGap = () => Math.max(30 / Z, 42 / Z);
// 画面上で向きが読めないハンドル（真上から見た高さ方向など）を逃がす向き。
// 真上ビューでは斜め左下へ、それ以外は左やや下へ逃がすと、本体の線に重なりにくい。
const hiddenHandleDir = () => (orthView === "top" ? { x: -Math.SQRT1_2, y: -Math.SQRT1_2 } : { x: -1, y: -0.35 });
// つぶれた向きのときの倍率（px/単位）。正投影は px/単位が分かるのでそれを使う。
const hiddenHandleScale = () => Math.max(24, orthView ? orthScale() : 24);
const segd = (p, a, b) => {
    const dx = b.x - a.x,
        dy = b.y - a.y,
        l = dx * dx + dy * dy || 1e-9,
        t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l));
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
// 軸矢印の「掴める範囲」は、中心から先端までの線分のうち外側だけにする。
// 線分全体を当たり判定にすると、中心から先端へ引いた線が図形の内側を通るため、
// 面上の白い四角やアセット専用ハンドル（窓の幅など）を軸が奪ってしまう。
// 図形の中心付近は面・専用ハンドルへ譲り、矢印の外側（全長の55%〜先端）だけを
// 軸の当たり判定にする。軸を掴める長さは十分に残る。
const AXIS_GRAB_FROM = 0.55;
function axisGrabSeg(g, a) {
    const k = AXIS_GRAB_FROM;
    return {
        a: { x: g.sC.x + (a.sT.x - g.sC.x) * k, y: g.sC.y + (a.sT.y - g.sC.y) * k },
        b: a.sT,
    };
}
// 押した点が軸矢印（外側部分）に触れているか。触れていればその軸を返す。
function axisHitAt(g, p, rad) {
    if (!g || !Array.isArray(g.axes) || !g.sC) return null;
    let best = null;
    const minLen = 14 / Z;
    for (const a of g.axes) {
        // 画面上で長さが無い軸（真上ビューの高さ方向など）は掴めない。
        // 中心に固まった矢印を当たり判定に残すと、中心付近の面ハンドルを奪う。
        if (!a || !a.sT || Math.hypot(a.sT.x - g.sC.x, a.sT.y - g.sC.y) < minLen) continue;
        const seg = axisGrabSeg(g, a),
            d = segd(p, seg.a, seg.b);
        if (d < rad && (!best || d < best.d)) best = { a, d };
    }
    return best;
}
// 回転リング用：軸に直交する2本の単位ベクトル（u × v = axis）。
// リング上の点は C + R(u cos t + v sin t) と表せるので、
// 「掴んだ位置の t」を読めば、そのまま軸まわりの回転角になる。
// 回転ギズモの色（Blender と同じ割り当て）。
// 左右＝X は赤、手前奥＝Y は緑、上下＝Z は青。
// 「上下＝Z・青／手前奥＝Y・緑」というアプリの決めごとはそのまま。
const GZ_X = "#e2564f",
    GZ_Y = "#6fbf49",
    GZ_Z = "#4a8cf0";
// 画面に平行な外側の白い輪（Blender の回転ギズモの外周）の点列。
// 掴むと「上下軸まわり」に回る（画面の回転そのものは表せないため、
// いちばん近い表現として上下軸の回転にしてある）。
function outerRingPoints(sC, r) {
    const out = [];
    for (let i = 0; i <= 72; i++) {
        const t = (i / 72) * 2 * Math.PI;
        out.push({ ok: true, x: sC.x + Math.cos(t) * r, y: sC.y + Math.sin(t) * r });
    }
    return out;
}
function ringBasis(axis) {
    const a = V.nrm(axis),
        ref = Math.abs(a[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0],
        u = V.nrm(V.crs(ref, a)),
        v = V.crs(a, u);
    return { u, v };
}
// 画面上の折れ線（リング）のうち、点 p に最も近い位置のパラメータ角 t を返す。
// リングが画面で線に潰れている（真横から見ている）ときは null。
function ringParamAt(poly, p) {
    if (!poly || poly.length < 3) return null;
    let best = null;
    for (let i = 1; i < poly.length; i++) {
        const a = poly[i - 1],
            b = poly[i];
        if (!a?.ok || !b?.ok) continue;
        const dx = b.x - a.x,
            dy = b.y - a.y,
            l2 = dx * dx + dy * dy;
        if (l2 < 1e-6) continue;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)),
            d = Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
        if (!best || d < best.d) best = { d, t: (i - 1 + t) / (poly.length - 1) * 2 * Math.PI };
    }
    return best ? best.t : null;
}
// 角度差を -180..180 に畳む（連続ドラッグで回り続けても破綻しないように使う）。
function wrapPi(a) {
    const t = ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    return t - Math.PI;
}
// 回転リングの「画面の点 → 面内の座標」変換。
// 面内の2軸（iu,iv）が画面上でどちらへ伸びるか（su/sv）が分かっていれば、
// 画面の移動量を2元連立で面内の (u,v) に戻せる。正投影はアフィンなので誤差が出ない。
// 面が画面に対して真横を向いている（行列式≒0）ときは null を返し、
// 呼び出し側が画面角度による回転へ切り替える。
function ringPlaneUV(plane, p) {
    if (!plane || !plane.s0 || !plane.su || !plane.sv) return null;
    const det = plane.su.x * plane.sv.y - plane.su.y * plane.sv.x;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-6) return null;
    const dx = p.x - plane.s0.x,
        dy = p.y - plane.s0.y;
    return {
        u: (dx * plane.sv.y - dy * plane.sv.x) / det,
        v: (plane.su.x * dy - plane.su.y * dx) / det,
    };
}
// 視線rと「点Cを通る向きaの直線」の最も近い点の、直線上の位置t（軸に沿った移動量を求める）
function lineParam(r, C, a) {
    const b = V.dot(r, a),
        dd = V.dot(r, C),
        e = V.dot(a, C),
        den = 1 - b * b;
    return den < 1e-6 ? null : (dd * b - e) / den;
}
// 面ハンドルは、3Dの最近接計算だけでなく「画面上で見えている向き」も使う。
// 面の法線が視線に近いと、最近接計算は分母が小さくなり、少しのドラッグで
// 反対方向へ跳ねることがあるため、表示されたハンドルの向きに投影して量を求める。
function faceScreenGuide(face) {
    if (!face?.P3 || !face?.n) return null;
    const base = scrW(face.P3);
    if (!base?.ok) return null;
    // 遠景でも十分な画面差が得られるよう、短いサンプルを段階的に試す。
    for (const step of [0.05, 0.1, 0.2, 0.4, 0.8]) {
        const probe = scrW(V.add(face.P3, face.n, 1, step));
        if (!probe?.ok) continue;
        const dx = probe.x - base.x,
            dy = probe.y - base.y,
            px = Math.hypot(dx, dy);
        if (px >= 0.35)
            return {
                dir: { x: dx / px, y: dy / px },
                scale: px / step,
            };
    }
    // 真正面の奥行き面（前ビューで手前/奥の面）や、真上ビューでの高さ面は、
    // 画面上で法線方向が完全につぶれて向きが取れない。以前はここで dl=0 にして
    // 「このビューでは動かない」扱いにしていたが、それだと 3D では編集できる面が
    // 前・横・上では編集できない、という差が出る。
    // つぶれた向きは専用ハンドルと同じ規則で画面の上向きへ逃がし、
    // 倍率は正投影の px/単位（3D は既定値）を使う。これでどのビューでも同じ量だけ動く。
    return { hidden: true, dir: hiddenHandleDir(), scale: hiddenHandleScale() };
}
// ワールド軸の移動量を、オブジェクト定義のca/cb/liftへ戻す。
// 親子接続中は、必要に応じて接着オフセットも保つ。
function moveBy(o, vec, keepAttachedOffset = false) {
    const v = [Number(vec?.[0]) || 0, Number(vec?.[1]) || 0, Number(vec?.[2]) || 0];
    if (o?.type === "compound")
        return { tx: (Number(o.tx) || 0) + v[0], ty: (Number(o.ty) || 0) + v[1], tz: (Number(o.tz) || 0) + v[2] };
    if (o?.attachment?.wallSideSign) {
        // 横壁看板は上下に加えて、壁に沿う前後方向（親のローカルY）へ動かせる。
        // 外向きの接着距離は取付金具の長さで管理するため、ここでは壁面上だけを移動する。
        const basis = o.wallSideBasis || syncAttachedPart(o).wallSideBasis,
            alongWall = basis?.n ? V.dot(v, basis.n) : 0,
            up = basis?.u ? V.dot(v, basis.u) : v[1],
            patch = {};
        if (Math.abs(alongWall) > 1e-8)
            patch.attachment = {
                ...o.attachment,
                depthOffset: (Number(o.attachment.depthOffset) || 0) + alongWall,
            };
        if (Math.abs(up) > 1e-8) patch.lift = (Number(o.lift) || 0) - o.d * up;
        return patch;
    }
    if (o?.attachment?.verticalOnly) {
        v[0] = 0;
        v[2] = 0;
        const patch = { lift: (Number(o.lift) || 0) - o.d * v[1] };
        if (!keepAttachedOffset)
            patch.attachment = { ...o.attachment, offsetZ: (Number(o.attachment.offsetZ) || 0) + v[1] };
        return patch;
    }
    const [iu, iv] = PL[o.k];
    return { ca: o.ca + v[iu], cb: o.cb + v[iv], lift: o.lift - o.d * v[o.k] };
}
// 間取りの回転ハンドルで、地面上の複合オブジェクトを一体回転する。
// 子パーツの定義を壊さず、現在位置をいったんワールド座標へ展開してから戻す。
// 複合オブジェクトを回すときの軸（ワールド座標）。
// 一度決めた軸は o.spinPivot に保存し、以後はその点で回す。
// 毎回「いまの外接箱の中心」を出すと、回すたびに箱が膨らんで軸が動き、
// 「回すたびに位置がずれる」原因になるため、保存した軸を優先する。
// 保存が無いとき（＝まだ一度も回していない）は今の外接箱の中心にする。
function compoundSpinPivot(o) {
    const sp = o?.spinPivot;
    if (sp && Number.isFinite(sp[0]) && Number.isFinite(sp[2])) return [sp[0], sp[1], sp[2]];
    const b0 = obBounds(o);
    if (b0 && Number.isFinite(b0.lo[0]) && Number.isFinite(b0.hi[0]))
        return [(b0.lo[0] + b0.hi[0]) / 2, (b0.lo[1] + b0.hi[1]) / 2, (b0.lo[2] + b0.hi[2]) / 2];
    const parts = compoundPartsAt(o);
    if (!parts.length) {
        const b = obBounds(o);
        return [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2];
    }
    let x = 0,
        y = 0,
        z = 0;
    parts.forEach((q) => {
        const p = L2W(q, 0, 0, 0);
        x += p[0];
        y += p[1];
        z += p[2];
    });
    return [x / parts.length, y / parts.length, z / parts.length];
}
// 結合したオブジェクトを、その場で（軸を動かさずに）ヨー回転する。
// 子パーツは2通りで回す。
//   ・水平面(k=1)のパーツ … 定義そのもの（rot・中心・off）を回す。数値パネルの
//     回転や、分離したあとの見た目もそのまま保てる。
//   ・それ以外（縦の面 k=0/2 など）… 定義ではヨーを表せないので、パーツごとの
//     外側の回転 spin（＋中心 spinPivot）として持たせる。前から回してある場合は
//     2つの回転を1つに合成する（spinComposePivot）。
// どちらも「同じ軸まわりの同じ角度」なので、結合体は形を変えずに回る。
function rotateCompoundBy(o, deg) {
    if (o?.type !== "compound") return { rot: wrap180((Number(o?.rot) || 0) + deg) };
    const dDeg = Number(deg) || 0,
        pivot = compoundSpinPivot(o),
        a = dDeg * DG,
        cs = Math.cos(a),
        sn = Math.sin(a),
        parts = compoundPartsAt(o).map((part) => {
            const q = bakePartSpin({ ...part, off: [...(part.off || [0, 0, 0])] });
            // 横壁看板のように「壁沿いの基底(wallSideBasis)」で形を作るパーツは、
            // 位置が ca/cb ではなく基底の原点で決まるので、定義を書き換えても回らない。
            // こういうパーツは縦の面と同じく spin で回す。
            if (Number(q.k) === 1 && !q.wallSideBasis) {
                // 位置（中心）を軸まわりに回し、off も同じ角度だけ回す。
                // off はワールド方向の平行移動なので、回さないと本体だけ取り残される。
                const base = L2W(q, 0, 0, 0),
                    dx = base[0] - pivot[0],
                    dz = base[2] - pivot[2],
                    rx = pivot[0] + dx * cs + dz * sn,
                    rz = pivot[2] - dx * sn + dz * cs,
                    ox = q.off[0] * cs + q.off[2] * sn,
                    oz = -q.off[0] * sn + q.off[2] * cs;
                q.off = [ox, q.off[1], oz];
                q.ca = rx - ox;
                q.cb = rz - oz;
                // 形の回転角 rot は「面の中で +で反時計（x右・z手前）だが、上の
                // 中心移動は −で同じ向き」という逆向きの決まりになっている。
                // そのため rot は“引く”。足すと、中心だけ回って形が逆に回り、
                // パーツが滑って「位置がずれた」ように見える（実データで30°ずれ）。
                q.rot = wrap180((Number(q.rot) || 0) - dDeg);
                q.spin = 0;
                q.spinPivot = [pivot[0], pivot[1], pivot[2]];
                return q;
            }
            const s0 = partSpinDeg(q),
                Ps = q.spinPivot && Number.isFinite(q.spinPivot[0]) ? q.spinPivot : pivot,
                P2 = spinComposePivot(Ps, s0, pivot, dDeg);
            q.spin = wrap180(s0 + dDeg);
            q.spinPivot = [P2[0], Ps[1], P2[2]];
            return q;
        });
    return {
        parts,
        tx: 0,
        ty: 0,
        tz: 0,
        rot: 0,
        compoundRot: (Number(o.compoundRot) || 0) + dDeg,
        ca: pivot[0],
        cb: pivot[2],
        // 次に回すときも同じ軸を使う（＝回すたびに軸が動かない）。
        spinPivot: [pivot[0], pivot[1], pivot[2]],
    };
}
// 面を動かしたときの変更内容（反対側の面は動かさない）
function facePatch(o, fid, dl) {
    const cs = Math.cos(o.rot * DG),
        sn = Math.sin(o.rot * DG),
        m = 0.005;
    if (fid === "top") {
        if (o.type === "asset" && o.asset === "sign") {
            // 看板の実外周は0.08h〜0.82h。上端を動かすと下端を固定する。
            const dh = dl / 0.74,
                h = Math.max(m, o.h + dh);
            return { h, extrude: true, lift: o.lift - 0.08 * (h - o.h) };
        }
        return { h: Math.max(m, o.h + dl), extrude: true };
    }
    if (fid === "base") {
        if (o.type === "asset" && o.asset === "sign") {
            // 下端を動かすと上端を固定する。dlは下向き面の移動量。
            const dh = dl / 0.74,
                h = Math.max(m, o.h + dh);
            return { h, extrude: true, lift: o.lift - 0.82 * (h - o.h) };
        }
        const h = Math.max(m, o.h + dl);
        return { h, extrude: true, lift: o.lift - (h - o.h) };
    }
    const sg = fid[1] === "+" ? 1 : -1,
        isU = fid[0] === "u",
        r0 = isU ? o.ra : o.rb,
        r1 = Math.max(m, r0 + dl / 2),
        dr = r1 - r0,
        ex = isU ? [cs, sn] : [-sn, cs];
    const q = { ca: o.ca + sg * dr * ex[0], cb: o.cb + sg * dr * ex[1] };
    if (o.type === "cyl") {
        q.ra = r1;
        q.rb = r1;
    } else if (o.type === "asset" && o.asset === "sphere") {
        q.ra = r1;
        q.rb = r1;
        q.h = r1 * 2;
    } else q[isU ? "ra" : "rb"] = r1;
    return q;
}
function buildingOuterFacePatch(o, fid, dl) {
    const q = facePatch(o, fid, dl),
        w = Math.max(0.1, Math.abs(Number(q.ra ?? o.ra) || 1) * 2),
        d = Math.max(0.05, Math.abs(Number(q.rb ?? o.rb) || 0.5) * 2),
        h = Math.max(0.1, Number(q.h ?? o.h) || 1),
        openingW = clamp(Number(o.openingW) || w * 0.56, 0.1, Math.max(0.1, w - 0.1)),
        openingH = clamp(Number(o.openingH) || h * 0.66, 0.1, Math.max(0.1, h - 0.1)),
        patch = {
            ...q,
            openingW: Math.min(openingW, Math.max(0.1, w - 0.1)),
            openingH: Math.min(openingH, Math.max(0.1, h - 0.1)),
        };
    if (Number.isFinite(Number(o.openingBack)))
        patch.openingBack = clamp(Number(o.openingBack), -d / 2 + 0.025, d / 2 - 0.025);
    return patch;
}
// 壁横看板の白い外形面ハンドルから寸法を編集する。
// 看板は親の側壁へ接着されているため、縦方向はcenterRatio、
// 壁から外へ出る方向は接着面を基準にして変更する。
function wallSideSignFacePatch(o, fid, dl) {
    const axis = String(fid || "")[0],
        plus = String(fid || "").endsWith("+"),
        minHalf = 0.025,
        parent = o?.attachment?.parentId ? obOf(o.attachment.parentId) : null;
    if (!o?.attachment?.wallSideSign) return {};
    if (axis === "u") {
        const oldHalf = Math.max(minHalf, Math.abs(Number(o.ra) || 0.9)),
            nextHalf = Math.max(minHalf, oldHalf + dl * 0.5),
            deltaHalf = nextHalf - oldHalf,
            floors = parent && isStackedBuildingAsset(parent) && Array.isArray(parent.floors) ? parent.floors : [],
            index = clamp(Math.round(Number(o.attachment.floorIndex) || 0), 0, Math.max(0, floors.length - 1)),
            floor = floors[index],
            parentHeight = floor
                ? Math.max(0.05, Math.abs(Number(floor.h) || 2.2))
                : Math.max(0.1, Math.abs(Number(parent?.h) || 1)),
            ratio = clamp(
                (Number(o.attachment.centerRatio) || (floor ? 0.58 : 0.68)) +
                    ((plus ? 1 : -1) * deltaHalf) / parentHeight,
                0.06,
                0.94,
            );
        return {
            ra: nextHalf,
            attachment: { ...o.attachment, centerRatio: ratio },
        };
    }
    if (axis === "v") {
        const oldHalf = Math.max(minHalf, Math.abs(Number(o.rb) || 0.75)),
            nextHalf = Math.max(minHalf, oldHalf + dl * 0.5);
        return { rb: nextHalf };
    }
    if (axis === "n") {
        const oldThickness = Math.max(0.02, Math.abs(Number(o.h) || 0.12)),
            nextThickness = Math.max(0.02, oldThickness + dl),
            delta = nextThickness - oldThickness;
        return {
            h: nextThickness,
            attachment: {
                ...o.attachment,
                depthOffset: (Number(o.attachment.depthOffset) || 0) + (plus ? 1 : -1) * delta * 0.5,
            },
        };
    }
    return {};
}
// 看板の黒い外枠を構成する実高さ。全高の上下余白は外形ハンドルの対象にしない。
function outerZRange(o) {
    const h = Math.max(0, Number(o?.h) || 0);
    return o?.type === "asset" && o?.asset === "sign" ? [h * 0.08, h * 0.82] : [0, h];
}
// 看板の絵枠は常にカメラ側の面へ出す。反対側へ回り込んだ3D視点でも、
// 編集ハンドルが看板の裏へ隠れず、実際に見えている面を編集できるようにする。
function signFaceDepth(o, gap = 0.018) {
    const [iu, iv] = PL[o.k],
        cs = Math.cos(Number(o.rot || 0) * DG),
        sn = Math.sin(Number(o.rot || 0) * DG),
        ev = [0, 0, 0];
    ev[iu] = -sn;
    ev[iv] = cs;
    const base = L2W(o, 0, 0, 0),
        rel = V.add(camPos(), base, 1, -1),
        side = V.dot(rel, ev) >= 0 ? 1 : -1,
        depth = Math.max(0.02, Math.abs(Number(o.rb) || 0.1));
    return side * (depth + gap);
}
// 看板専用のビュー内ハンドル。内側の絵枠の幅・高さを、
// 左の数値欄だけでなくキャンバス上のハンドルをドラッグして編集できる。
function signGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "sign") return null;
    const w = Math.max(0.08, o.ra * 2),
        d = Math.max(0.04, o.rb * 2),
        h = Math.max(0.08, o.h || 1),
        fy = signFaceDepth(o);
    const board0 = 0.08 * h,
        board1 = 0.82 * h;
    const maxW = w * 0.9,
        maxH = (board1 - board0) * 0.84;
    const faceW = clamp(Number(o.faceW) || w * 0.7, 0.08, maxW),
        faceH = clamp(Number(o.faceH) || h * 0.34, 0.08, maxH);
    const pr = (x, y, z) => scrW(L2W(o, x, y, z));
    const iz0 = (board0 + board1 - faceH) / 2,
        iz1 = iz0 + faceH,
        zm = (iz0 + iz1) / 2;
    const center = pr(0, fy, zm),
        right = pr(faceW / 2, fy, zm),
        top = pr(0, fy, iz1),
        frame = [pr(-faceW / 2, fy, iz0), pr(faceW / 2, fy, iz0), pr(faceW / 2, fy, iz1), pr(-faceW / 2, fy, iz1)];
    const make = (kind, anchor, probe, base, min, max, fallbackAxis = null) => {
        const dx = probe.x - anchor.x,
            dy = probe.y - anchor.y,
            step = Math.max(0.0001, Number(probe._step) || 0.05),
            px = Math.hypot(dx, dy);
        // 真横では絵枠の幅(X)が投影上つぶれ、真上では高さ(Y)がつぶれる。
        // 投影が縮退しても、緑の四角は絵枠の実際の辺から離さない。
        // ドラッグ方向だけを画面軸へ固定し、見た目のアンカーは常に元の点に置く。
        if (fallbackAxis && (!anchor?.ok || !probe?.ok || px < 6 / Z)) {
            const dir = fallbackAxis === "x" ? { x: 1, y: 0 } : { x: 0, y: -1 };
            return {
                kind,
                s: anchor,
                dir,
                scale: orthView ? Math.max(1, orthScale()) : Math.max(24, px / step || 1),
                start: base,
                min,
                max,
                fallback: true,
            };
        }
        return {
            kind,
            s: anchor,
            dir: { x: dx / (px || 1), y: dy / (px || 1) },
            scale: px / step || 1,
            start: base,
            min,
            max,
        };
    };
    // _step is kept on the temporary projected point so the screen scale can be measured.
    const pw = Math.max(0.05, w * 0.12),
        ph = Math.max(0.05, h * 0.1);
    const rw = pr(faceW / 2 + pw, fy, zm);
    rw._step = pw;
    const ht = pr(0, fy, iz1 + ph);
    ht._step = ph;
    const handles = {
        faceW: make("faceW", right, rw, faceW, 0.08, maxW, "x"),
        faceH: make("faceH", top, ht, faceH, 0.08, maxH, "y"),
    };
    return { o, C3: L2W(o, 0, 0, (board0 + board1) / 2), center, frame, handles };
}
function coneGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "cone") return null;
    const h = Math.max(0.02, o.h || 1),
        base = L2W(o, 0, 0, 0),
        apex = L2W(o, 0, 0, h),
        bp = scrW(base),
        ap = scrW(apex),
        step = Math.max(0.08, h * 0.12),
        probe = scrW(L2W(o, 0, 0, h + step));
    const dx = probe.x - ap.x,
        dy = probe.y - ap.y,
        sc = Math.hypot(dx, dy) / step;
    return {
        o,
        C3: L2W(o, 0, 0, h / 2),
        base: bp,
        apex: ap,
        handle: {
            kind: "height",
            s: ap,
            dir: { x: dx / (Math.hypot(dx, dy) || 1), y: dy / (Math.hypot(dx, dy) || 1) },
            scale: sc || 1,
            start: h,
            min: 0.02,
            max: 20,
        },
    };
}
function sphereGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "sphere") return null;
    const r = Math.min(2 * o.ra, 2 * o.rb, o.h) * 0.5,
        center = L2W(o, 0, 0, o.h * 0.5),
        right = V.nrm(wld([1, 0, 0])),
        cp = scrW(center),
        edge = scrW(V.add(center, right, r)),
        probe = scrW(V.add(center, right, r + 0.1));
    const dx = probe.x - edge.x,
        dy = probe.y - edge.y,
        sc = Math.hypot(dx, dy) / 0.1;
    return {
        o,
        C3: center,
        center: cp,
        edge,
        handle: {
            kind: "radius",
            s: edge,
            dir: { x: dx / (Math.hypot(dx, dy) || 1), y: dy / (Math.hypot(dx, dy) || 1) },
            scale: sc || 1,
            start: r,
            min: 0.02,
            max: 20,
        },
    };
}
function buildingBackY(o, d) {
    const half = Math.max(0.025, d * 0.5),
        stored = Number(o?.openingBack);
    if (Number.isFinite(stored)) return clamp(stored, -half + 0.025, half - 0.025);
    const far = -buildingFaceDepth(o);
    return far >= 0 ? half - 0.025 : -half + 0.025;
}
function buildingGeometry(o) {
    const w = Math.max(0.1, Math.abs(Number(o.ra) || 1) * 2),
        d = Math.max(0.05, Math.abs(Number(o.rb) || 0.5) * 2),
        h = Math.max(0.1, Number(o.h) || 1),
        openingW = clamp(Number(o.openingW) || w * 0.56, 0.1, Math.max(0.1, w - 0.1)),
        openingH = clamp(Number(o.openingH) || h * 0.66, 0.1, Math.max(0.1, h - 0.1)),
        backY = buildingBackY(o, d);
    return { w, d, h, openingW, openingH, backY };
}
function buildingFaceDepth(o) {
    const base = L2W(o, 0, 0, 0),
        edge = L2W(o, 0, 1, 0),
        axis = V.nrm(V.add(edge, base, 1, -1)),
        rel = V.add(camPos(), base, 1, -1),
        half = Math.abs(Number(o.rb) || 0.1);
    return (V.dot(rel, axis) >= 0 ? 1 : -1) * (half + 0.025);
}
function buildingGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "building" || o.openingEnabled === false) return null;
    const g = buildingGeometry(o),
        half = Math.abs(Number(o.rb) || 0.1),
        near = buildingFaceDepth(o) >= 0 ? half : -half,
        far = -near,
        pr = (x, y, z) => scrW(L2W(o, x, y, z)),
        stepW = Math.max(0.05, g.w * 0.06),
        stepH = Math.max(0.05, g.h * 0.06),
        mk = (kind, s, q, start, min, max, factor = 1) => {
            const dx = q.x - s.x,
                dy = q.y - s.y,
                px = Math.hypot(dx, dy) || 1;
            return {
                kind,
                s,
                dir: { x: dx / px, y: dy / px },
                scale: px / (kind.includes("openingH") ? stepH : stepW) || 1,
                start,
                min,
                max,
                factor,
            };
        };
    const makeFace = (prefix, y) => {
        const center = pr(0, y, g.openingH * 0.5),
            left = pr(-g.openingW * 0.5, y, g.openingH * 0.5),
            right = pr(g.openingW * 0.5, y, g.openingH * 0.5),
            top = pr(0, y, g.openingH),
            lw = pr(-g.openingW * 0.5 - stepW, y, g.openingH * 0.5),
            rw = pr(g.openingW * 0.5 + stepW, y, g.openingH * 0.5),
            th = pr(0, y, g.openingH + stepH),
            tag = prefix === "front" ? "" : "Back";
        return {
            center,
            frame: [
                pr(-g.openingW * 0.5, y, 0),
                pr(-g.openingW * 0.5, y, g.openingH),
                pr(g.openingW * 0.5, y, g.openingH),
                pr(g.openingW * 0.5, y, 0),
            ],
            handles: {
                [prefix + "OpeningWLeft"]: mk(
                    prefix + "OpeningWLeft",
                    left,
                    lw,
                    g.openingW,
                    0.1,
                    Math.max(0.1, g.w - 0.1),
                    2,
                ),
                [prefix + "OpeningWRight"]: mk(
                    prefix + "OpeningWRight",
                    right,
                    rw,
                    g.openingW,
                    0.1,
                    Math.max(0.1, g.w - 0.1),
                    2,
                ),
                [prefix + "OpeningH"]: mk(prefix + "OpeningH", top, th, g.openingH, 0.1, Math.max(0.1, g.h - 0.1)),
            },
            tag,
        };
    };
    const front = makeFace("front", near),
        back = makeFace("back", far),
        panelY = g.backY,
        panelFrame = [
            pr(-g.openingW * 0.5, panelY, 0),
            pr(-g.openingW * 0.5, panelY, g.openingH),
            pr(g.openingW * 0.5, panelY, g.openingH),
            pr(g.openingW * 0.5, panelY, 0),
        ],
        panelCenter = pr(0, panelY, g.openingH * 0.5),
        panelProbe = pr(0, panelY + (panelY >= 0 ? 0.1 : -0.1), g.openingH * 0.5),
        pdx = panelProbe.x - panelCenter.x,
        pdy = panelProbe.y - panelCenter.y,
        ppx = Math.hypot(pdx, pdy),
        backFace = {
            kind: "backFace",
            s: panelCenter,
            dir: { x: pdx / (ppx || 1), y: pdy / (ppx || 1) },
            scale: ppx / 0.1 || 1,
            start: panelY,
            min: -half + 0.025,
            max: half - 0.025,
            factor: 1,
            side: panelY >= 0 ? 1 : -1,
            face: true,
        };
    return {
        o,
        C3: L2W(o, 0, 0, g.h * 0.5),
        center: front.center,
        backCenter: back.center,
        frame: front.frame,
        backFrame: back.frame,
        panelFrame,
        panelCenter,
        handles: { ...front.handles, ...back.handles, backFace },
    };
}
// テントの前縁ハンドルを、直方体になる値（上辺＝屋根の高さ h / 前面＝建物の手前面）へ
// 近づいたら吸着させる。吸着幅は 3cm。これで「最大まで動かす」だけで
// きれいな直方体になり、少し傾いた中途半端な状態が残らない。
function snapAwningEdge(value, target) {
    const v = Number(value),
        t = Number(target);
    if (!Number.isFinite(v) || !Number.isFinite(t)) return v;
    return Math.abs(v - t) <= 0.03 ? t : v;
}
function awningGeometry(o) {
    const w = Math.max(0.1, Math.abs(Number(o.ra) || 1) * 2),
        d = Math.max(0.05, Math.abs(Number(o.rb) || 0.5) * 2),
        h = Math.max(0.1, Number(o.h) || 1),
        half = d / 2,
        // 手前の上辺は「建物の手前面（-d/2）」と「屋根の高さ h」まで届かせる。
        // 以前は 0.025／0.02 の余白を残していたため、ハンドルを最大まで動かしても
        // 上辺が水平にならず、前面もわずかに傾いたまま（直方体にならない）だった。
        // 手前の上辺は「建物の手前面（-d/2）」から「奥の上辺（d/2）」まで動かせる。
        // 一番奥まで寄せると手前の上辺が奥の上辺に重なり、断面が三角形＝三角柱になる。
        edgeY = clamp(
            Number.isFinite(Number(o.awningEdgeY)) ? Number(o.awningEdgeY) : -half,
            -half,
            half,
        ),
        // 高さは 0（＝手前の下端）まで下げられる。0 にすると手前の上辺が下端に重なり、
        // こちらも断面が三角形＝三角柱になる。以前は 0.05 の余白を残していたため、
        // 一番下まで下げても薄い板が残り、三角柱にならなかった。
        edgeZ = clamp(Number.isFinite(Number(o.awningEdgeZ)) ? Number(o.awningEdgeZ) : h, 0, Math.max(0, h)),
        thickness = clamp(Number(o.awningThickness) || Math.max(0.05, h * 0.14), 0.03, Math.max(0.03, h * 0.45)),
        frontBottom = clamp(
            Number.isFinite(Number(o.awningFrontBottom)) ? Number(o.awningFrontBottom) : 0,
            0,
            Math.max(0, edgeZ - 0.03),
        ),
        backBottom = clamp(
            Number.isFinite(Number(o.awningBackBottom)) ? Number(o.awningBackBottom) : 0,
            0,
            Math.max(0, h - 0.03),
        );
    // 手前の上辺が奥の上辺の真下へ来たら、上辺を奥の高さへ揃えて
    // 「奥が垂直な三角柱」として閉じる（斜めの上辺が残って形が濁るのを防ぐ）。
    const triangleBack = edgeY >= half - 0.02,
        frontTop = triangleBack ? h : edgeZ;
    return {
        w,
        d,
        h,
        half,
        baseFrontY: -half,
        edgeY,
        edgeZ: frontTop,
        thickness,
        frontBottom,
        backBottom,
        triangleBack,
        // 一番下まで下げた状態（手前の上辺＝下端）も三角柱。
        triangleFront: frontTop <= 0.001 && edgeY <= -half + 0.02,
    };
}
function awningGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "awning") return null;
    const g = awningGeometry(o),
        edgeY = g.edgeY,
        pr = (x, y, z) => scrW(L2W(o, x, y, z)),
        s = pr(0, edgeY, g.edgeZ),
        // 前縁Yの2軸目（手前奥）の向きを出すためのサンプル点。「前後」ハンドルは廃止したが、
        // 前縁Yを斜めに引くと上下と手前奥が同時に動くので、この点は残す。
        qz = pr(0, edgeY, g.edgeZ + 0.1),
        qy = pr(0, edgeY + 0.1, g.edgeZ),
        zdx = qz.x - s.x,
        zdy = qz.y - s.y,
        zpx = Math.hypot(zdx, zdy) || 1,
        ydx = qy.x - s.x,
        ydy = qy.y - s.y,
        ypx = Math.hypot(ydx, ydy) || 1;
    const handles = {
        edgeZ: {
            kind: "edgeZ",
            s,
            dir: { x: zdx / zpx, y: zdy / zpx },
            scale: zpx / 0.1 || 1,
            start: g.edgeZ,
            // 一番下（0）まで下げると手前の上辺が下端に重なり、断面が三角形＝三角柱になる。
            // 間取りの正面・横ビューと同じ値にして、ビューごとに三角柱にできたり
            // できなかったりする差を作らない。
            min: 0,
            max: g.h,
            frontBottom: g.frontBottom,
        },
    };
    // 前縁（手前の上辺）は上下だけでなく手前奥へも動かせる。
    // 2本目の軸を同じハンドルへ持たせ、斜めに引いても両方いっぺんに変わる。
    // ただし2軸目は1軸目と直交させておく。斜め投影では手前奥の向きが
    // 画面上で斜めになるため、そのままだと「真下へ引いたのに手前奥も動く」状態になり、
    // 高さを下げ切ったつもりでも三角柱にならない（＝3Dだけ三角柱にできない）原因だった。
    const dot12 = (ydx * zdx + ydy * zdy) / (zpx * zpx),
        ox2 = ydx - zdx * dot12,
        oy2 = ydy - zdy * dot12,
        opx2 = Math.hypot(ox2, oy2);
    if (opx2 > 0.01) {
        handles.edgeZ.dir2 = { x: ox2 / opx2, y: oy2 / opx2 };
        handles.edgeZ.scale2 = opx2 / 0.1 || 1;
    } else {
        handles.edgeZ.dir2 = { x: ydx / ypx, y: ydy / ypx };
        handles.edgeZ.scale2 = ypx / 0.1 || 1;
    }
    handles.edgeZ.start2 = g.edgeY;
    handles.edgeZ.min2 = -g.d / 2;
    handles.edgeZ.max2 = g.d / 2; // 一番奥まで寄せられる（三角柱）
    // 「前後」ハンドルは廃止した。手前奥は前縁Y（edgeZ）の2軸目で動かせるため、
    // 同じ場所に2つ並べると掴み間違えるだけだった。
    return {
        o,
        C3: L2W(o, 0, 0, (g.edgeZ + g.h) * 0.5),
        edge: s,
        frame: [
            pr(-g.w / 2, edgeY, g.edgeZ),
            pr(g.w / 2, edgeY, g.edgeZ),
            pr(g.w / 2, g.d / 2, g.h),
            pr(-g.w / 2, g.d / 2, g.h),
        ],
        handles,
        handle: null,
    };
}
// ===== 壁付けベランダの寸法（線画・面・ハンドルで同じ値を使う） =====
// asset.js の linesBalcony もこの関数を呼ぶ。丸め方を1か所に集約しないと
// 「ハンドルで変えたのに線が変わらない」というズレが出る。
// 床スラブと腰壁の厚さは同じ1つの値（2026-11-01：分ける必要が無いとの指示）。
function balconyGeometry(o) {
    const w = Math.max(0.2, Math.abs(Number(o?.ra) || 0.5) * 2),
        d = Math.max(0.2, Math.abs(Number(o?.rb) || 0.5) * 2),
        h = Math.max(0.12, Number(o?.h) || 1.25),
        thickness = clamp(
            Number(o?.balconyThickness) || Number(o?.balconyRailThickness) || Number(o?.balconyFloorThickness) || 0.14,
            0.035,
            Math.min(w, d) * 0.35,
        ),
        railH = clamp(
            Number(o?.balconyRailHeight) || Math.max(0.12, h - thickness),
            0.12,
            Math.max(0.12, h - 0.01),
        );
    return {
        w,
        d,
        h,
        thickness,
        railH,
        frontRail: o?.balconyFrontRail !== false,
        sideRail: o?.balconySideRail !== false,
    };
}
// ===== 屋台（コの字の壁＋手前下のカウンター箱＋真上の屋根箱） =====
// 写真のような売店。奥の壁＋左右の壁でコの字を作り、その手前の下へカウンター箱、
// 真上へ屋根箱を載せる。編集は「全体の幅・高さ・奥行き」＋
// 「カウンターの奥行き（手前の面だけ動く）・高さ（下の面は動かない）」
// 「屋根の手前の張り出し（手前の面だけ動く）・厚さ（上の面は動かない）」「壁の厚さ」。
// 既定値は h・d に対する比率で持たせ、h や d を変えたときに形が崩れないようにする。
function stallNum(v, dflt) {
    const n = Number(v);
    return Number.isFinite(n) && n !== 0 ? n : dflt;
}
function stallGeometry(o) {
    const w = Math.max(0.8, Math.abs(Number(o?.ra) || 1.2) * 2),
        d = Math.max(0.6, Math.abs(Number(o?.rb) || 0.7) * 2),
        h = Math.max(1, Number(o?.h) || 2.4),
        t = clamp(stallNum(o?.stallWallThickness, w * 0.0375), 0.03, Math.min(w, d) * 0.3),
        // 屋根の厚さは「上の面を動かさない」ので、先に決める。
        rt = clamp(stallNum(o?.stallRoofThickness, h * 0.09), 0.04, Math.max(0.05, h * 0.4)),
        roofBottom = Math.max(0.2, h - rt),
        // カウンターの高さは下の面（床）を動かさないので、上の面の位置＝そのまま値。
        ch = clamp(stallNum(o?.stallCounterHeight, h * 0.44), 0.1, Math.max(0.12, roofBottom - 0.12)),
        cd = Math.max(0.05, stallNum(o?.stallCounterDepth, d * 0.34)),
        ro = Math.max(0, stallNum(o?.stallRoofOverhang, d * 0.24));
    return { w, d, h, t, rt, roofBottom, ch, cd, ro };
}
// ===== 丸椅子（屋台の前に置く小物。座面＋ポール＋台座の3つの円柱） =====
// 3つの円柱は「半径」と「高さ」を1つずつ持つ（合計6つ）。
// ・台座：床から baseH まで
// ・ポール：台座の上から座面の下まで（高さは全体の高さ h から決まる）
// ・座面：いちばん上（上面が全体の高さ h）
// 半径は必ず正円（ra と rb を別々には使わない）。楕円にならないようにするため。
function stoolGeometry(o) {
    const w = Math.max(0.12, Math.abs(Number(o?.ra) || 0.18) * 2),
        d = Math.max(0.12, Math.abs(Number(o?.rb) || 0.18) * 2),
        minWD = Math.min(w, d),
        h = Math.max(0.12, Number(o?.h) || 0.45),
        seatR = clamp(stallNum(o?.stoolSeatRadius, minWD * 0.5), 0.02, minWD),
        baseR = clamp(stallNum(o?.stoolBaseRadius, minWD * 0.3), 0.01, minWD * 0.5),
        // ポールは座面と台座からはみ出さない太さまで。
        legR = clamp(stallNum(o?.stoolLegRadius, minWD * 0.11), 0.005, Math.max(0.005, Math.min(seatR, baseR))),
        seatT = clamp(stallNum(o?.stoolSeatThickness, h * 0.13), 0.02, Math.max(0.03, h * 0.6)),
        baseH = clamp(stallNum(o?.stoolBaseHeight, h * 0.09), 0.01, Math.max(0.02, h * 0.45)),
        legH = Math.max(0.02, h - seatT - baseH);
    return {
        w,
        d,
        h,
        seat: seatT,
        seatT,
        seatR,
        legR,
        baseR,
        baseH,
        legH,
        baseTop: baseH,
        poleTop: baseH + legH,
        seatBottom: h - seatT,
    };
}
// ===== コの字壁（コの字をZ軸＝高さ方向へ押し出した壁） =====
// 前面＋左右の3枚の壁が、同じ厚さで立ち上がる形。床スラブは持たない。
// 壁付けベランダと同じく、開口は壁側（+Y）を向く。
function uWallGeometry(o) {
    const w = Math.max(0.2, Math.abs(Number(o?.ra) || 1.6) * 2),
        d = Math.max(0.2, Math.abs(Number(o?.rb) || 0.9) * 2),
        h = Math.max(0.12, Number(o?.h) || 1.1),
        // 厚さの上限は「幅・奥行きに対して太すぎない」ことに加え、
        // 「高さより厚くならない」ことも必要（屋根の下面が床より下へ抜けて形が壊れるため）。
        maxThickness = Math.max(0.035, Math.min(Math.min(w, d) * 0.35, h * 0.45)),
        thickness = clamp(Number(o?.uWallThickness) || 0.12, 0.035, maxThickness);
    return { w, d, h, thickness, maxThickness };
}
// ===== 手すり（柱＋上下の横桟＋縦の棒） =====
// ローカル座標は x=幅、y=奥行き、z=高さ。手前は -Y（ベランダ・コの字壁と同じ向き）。
// 形は3種類。
//   line（直線）… 手前の1本だけ
//   l（L字）   … 手前＋左の2本
//   u（コの字）… 手前＋左右の3本
// 横桟は「柱の中心を結ぶ折れ線」に沿って置き、縦の棒はその区間を等分した位置へ立てる。
// 棒の本数は区間の長さに比例して配分するので、コの字でも1区間に固まらない。
function railingGeometry(o) {
    const w = Math.max(0.24, Math.abs(Number(o?.ra) || 1) * 2),
        d = Math.max(0.24, Math.abs(Number(o?.rb) || 0.6) * 2),
        h = Math.max(0.2, Number(o?.h) || 1.05),
        shape = ["u", "l", "line"].includes(o?.railingShape) ? o.railingShape : "u",
        requested = clamp(Math.round(Number(o?.railingCount) || 5), 1, 40),
        // 角材（横桟）の太さ。幅・奥行き・高さに対して太すぎない所で止める。
        maxT = Math.max(0.012, Math.min(Math.min(w, d) * 0.22, h * 0.22)),
        t = clamp(Number(o?.railingThickness) || 0.045, 0.012, maxT),
        // 柱は角材より太い。細くはできない（見た目が崩れるため）。
        maxPost = Math.max(t, Math.min(Math.min(w, d) * 0.28, h * 0.5)),
        post = clamp(Number(o?.railingPostSize) || 0.075, t, maxPost),
        // 下の横桟の下端の高さ。上の横桟と棒の長さが残る範囲で止める。
        maxBottom = Math.max(0.02, h - t * 3),
        bottom = clamp(Number(o?.railingBottomGap) || 0.12, 0.02, maxBottom),
        barT = Math.max(0.01, t * 0.55),
        inset = post / 2,
        x0 = -w / 2 + inset,
        x1 = w / 2 - inset,
        yF = -d / 2 + inset,
        yB = d / 2 - inset,
        // 柱の中心を結ぶ折れ線（端から端まで）。U は右奥から左奥へ回り込む。
        line =
            shape === "line"
                ? [[x0, yF], [x1, yF]]
                : shape === "l"
                  ? [[x1, yF], [x0, yF], [x0, yB]]
                  : [[x1, yB], [x1, yF], [x0, yF], [x0, yB]],
        posts = [],
        runs = [];
    line.forEach((p, i) => {
        const key = `${p[0].toFixed(4)}|${p[1].toFixed(4)}`;
        if (!posts.some((q) => q.key === key)) posts.push({ key, x: p[0], y: p[1] });
        if (!i) return;
        const a = line[i - 1],
            b = p,
            len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len > 0.02)
            runs.push({
                a,
                b,
                len,
                alongX: Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]),
            });
    });
    // 縦の棒の本数を区間の長さで配分する（合計が count 本になるように端数を寄せる）。
    const totalLen = runs.reduce((s, r) => s + r.len, 0) || 1,
        minCount = Math.max(1, runs.length),
        // 区間ごとに最低1本立つので、指定がそれより少ないときは区間数まで引き上げる。
        count = Math.max(minCount, requested),
        raw = runs.map((r) => (count * r.len) / totalLen),
        nums = raw.map((v) => Math.max(1, Math.floor(v)));
    let sum = nums.reduce((a, b) => a + b, 0);
    const frac = raw.map((v) => v - Math.floor(v));
    while (sum < count && nums.length) {
        let best = 0;
        frac.forEach((f, i) => {
            if (f > frac[best]) best = i;
        });
        nums[best]++;
        frac[best] -= 1;
        sum++;
    }
    while (sum > count) {
        let worst = -1;
        nums.forEach((v, i) => {
            if (v > 1 && (worst < 0 || v > nums[worst])) worst = i;
        });
        if (worst < 0) break;
        nums[worst]--;
        sum--;
    }
    runs.forEach((r, i) => {
        const n = Math.max(1, nums[i] || 1);
        r.bars = [];
        for (let j = 1; j <= n; j++) {
            const f = j / (n + 1);
            r.bars.push([r.a[0] + (r.b[0] - r.a[0]) * f, r.a[1] + (r.b[1] - r.a[1]) * f]);
        }
    });
    // 実際に立った棒の本数を返す（区間ごとに最低1本なので、コの字では3本が下限）。
    // 数値パネルにはこの実際の本数を表示し、入力もこの範囲へ丸める。
    const actual = runs.reduce((sum, r) => sum + r.bars.length, 0) || 1;
    return {
        w, d, h, shape, count: actual, requested, minCount,
        t, maxT, post, maxPost, bottom, maxBottom, barT, runs, posts,
    };
}
// 手すりの画面ハンドル。寸法（幅・奥行き・高さ）は共通の面ハンドルが受け持つので、
// ここでは「角材の太さ」と「下の横桟の高さ」の2本だけを出す。
function railingGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "railing") return null;
    const g = railingGeometry(o),
        hw = g.w / 2,
        hd = g.d / 2,
        outY = Math.max(0.16, g.d * 0.45),
        handles = {
            // 角材の太さ：上の横桟の左端から手前（-Y）へ引くと太くなる。
            thickness: screenHandle(
                o,
                "railing-thickness",
                [-hw + g.post, -hd + g.post, g.h - g.t / 2],
                [-hw + g.post, -hd - outY, g.h - g.t / 2],
                [-hw + g.post, -hd - outY - 0.3, g.h - g.t / 2],
                g.t,
                0.012,
                g.maxT,
                "角材の太さ",
                { x: -1, y: 0 },
                "#ff9f68",
            ),
            // 下の横桟の高さ：手前の下の横桟の外側。上へ引くと高くなる。
            bottom: screenHandle(
                o,
                "railing-bottom",
                [0, -hd + g.post, g.bottom + g.t / 2],
                [0, -hd - outY, g.bottom + g.t / 2],
                [0, -hd - outY, g.bottom + g.t / 2 + 0.3],
                g.bottom,
                0.02,
                g.maxBottom,
                "下の横桟",
                { x: 0, y: 1 },
                "#ffb36f",
            ),
            // 縦の棒の本数：上の横桟の真ん中から真上へ引くと増える。
            // 数値欄の −＋ と同じ値を動かすので、画面とパネルのどちらでも編集できる。
            count: screenHandle(
                o,
                "railing-count",
                [0, -hd + g.post, g.h],
                [0, -hd + g.post, g.h + 0.26],
                [0, -hd + g.post, g.h + 0.56],
                Math.max(g.minCount, g.requested),
                g.minCount,
                40,
                "本数",
                { x: 0, y: 1 },
                "#7dd8ff",
            ),
        };
    // 角材の太さのような「数cmの値」は、既定の感度（画面60pxで1m）だと数pxで
    // 振り切れてしまう。手すりの2本は指先の移動に対して細かく動くよう感度を落とす
    // （scale は「1m動かすのに何px必要か」なので、値を大きくするほど繊細になる）。
    handles.thickness.scale = Math.max(handles.thickness.scale, 1000);
    handles.bottom.scale = Math.max(handles.bottom.scale, 420);
    // 本数は「整数の段数」なので、40px で1本ぶん動かし、値は整数に丸める。
    handles.count.scale = 40;
    handles.count.integer = true;
    return { o, C3: L2W(o, 0, 0, g.h * 0.5), handles };
}
// 壁付けベランダ／コの字壁の画面ハンドル。
// 掴むのは腰壁（コの字壁では前面の壁）の外側の面。外へ引くと厚くなる。
// 3Dと間取り（前・横・上）の両方で同じハンドルを出すため、
// 位置は「ワールド座標」で返し、呼び出し側でscrWに通す。
function uWallGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "uWall") return null;
    const g = uWallGeometry(o),
        // 厚さは屋根板の厚み（上下方向）。ハンドルは屋根の手前角の少し外側へ出す。
        // 面の上に置くと、横（真横）ビューで屋根のシルエットと重なり、
        // オブジェクトの移動に負けて掴めないため。
        out = Math.max(0.1, g.thickness),
        handle = screenHandle(
            o,
            "uWall-thickness",
            [g.w * 0.4, -g.d / 2 + g.thickness * 0.5, g.h],
            [g.w * 0.4, -g.d / 2 - out, g.h],
            [g.w * 0.4, -g.d / 2 - out, g.h - g.thickness],
            g.thickness,
            0.035,
            g.maxThickness,
            "屋根の厚さ",
            { x: 0, y: -1 },
            "#ff9f68",
        );
    return { o, C3: L2W(o, 0, 0, g.h - g.thickness * 0.5), handles: { thickness: handle } };
}
// 丸椅子の画面ハンドル。座面・ポール・台座それぞれの「半径」と「高さ」で6本。
// 丸椅子は 0.45m しか高さが無く、6本を近くに置くと掴み間違えるので、
//  ・半径の3本 … 右側（ローカル +X）に、それぞれの段の真ん中の高さで
//  ・高さの3本 … 左側（ローカル -X）に、それぞれの段の真ん中の高さで
// と、左右・上下に振り分ける。ラベルでどれがどれか分かるようにしてある。
function stoolGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "stool") return null;
    const g = stoolGeometry(o),
        rMax = Math.max(g.w, g.d) * 0.5,
        // 半径ハンドルは段の外周から少し外へ出す（本体の上に重ねない）。
        // 高さハンドルは左側のさらに外へ出して、回転リングや面ハンドルと離す。
        outR = Math.max(0.1, rMax * 0.5),
        outL = Math.max(0.35, rMax * 2),
        zBase = g.baseH * 0.5,
        zPole = (g.baseTop + g.poleTop) * 0.5,
        zSeat = (g.seatBottom + g.h) * 0.5,
        handles = {
            seatRadius: screenHandle(
                o, "stool-seat-radius",
                [g.seatR + outR, 0, zSeat],
                [g.seatR, 0, zSeat],
                [g.seatR + outR + 0.3, 0, zSeat],
                g.seatR, 0.02, rMax * 2, "座面の半径", { x: 1, y: 0 }, "#ad9cff",
            ),
            legRadius: screenHandle(
                o, "stool-leg-radius",
                [g.legR + outR, 0, zPole],
                [g.legR, 0, zPole],
                [g.legR + outR + 0.3, 0, zPole],
                g.legR, 0.005, rMax, "ポールの半径", { x: 1, y: 0 }, "#c3b6ff",
            ),
            baseRadius: screenHandle(
                o, "stool-base-radius",
                [g.baseR + outR, 0, zBase],
                [g.baseR, 0, zBase],
                [g.baseR + outR + 0.3, 0, zBase],
                g.baseR, 0.01, rMax * 2, "台座の半径", { x: 1, y: 0 }, "#e0dbff",
            ),
            seatHeight: screenHandle(
                o, "stool-seat-height",
                [-outL, 0, zSeat],
                [-outL, 0, zSeat],
                [-outL, 0, zSeat + 0.3],
                g.seatT, 0.02, Math.max(0.03, g.h * 0.6), "座面の高さ", { x: 0, y: -1 }, "#ff9f68",
            ),
            legHeight: screenHandle(
                o, "stool-leg-height",
                [-outL, 0, zPole],
                [-outL, 0, zPole],
                [-outL, 0, zPole + 0.3],
                g.legH, 0.02, Math.max(0.05, g.h * 3), "ポールの高さ", { x: 0, y: -1 }, "#ffb36f",
            ),
            baseHeight: screenHandle(
                o, "stool-base-height",
                [-outL, 0, zBase],
                [-outL, 0, zBase],
                [-outL, 0, zBase + 0.3],
                g.baseH, 0.01, Math.max(0.02, g.h * 0.45), "台座の高さ", { x: 0, y: -1 }, "#ffd0a8",
            ),
        };
    // 感度：1m ドラッグすると画面上 1m ぶん動く（ほかの寸法ハンドルと同じ手ざわり）。
    // 真横・真上から見て伸びが取れないビューでは既定の scale のままにする。
    const pr = (x, y, z) => scrW(pt(o, x, y, z)),
        span = (at, dz) => {
            const a = pr(...at),
                b = pr(at[0], at[1], at[2] + dz);
            return a?.ok && b?.ok ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
        },
        zSpan = (at) => span(at, 1),
        xSpan = (at) => {
            const a = pr(...at),
                b = pr(at[0] + 1, at[1], at[2]);
            return a?.ok && b?.ok ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
        };
    [["seatRadius", [g.seatR + outR, 0, zSeat]], ["legRadius", [g.legR + outR, 0, zPole]], ["baseRadius", [g.baseR + outR, 0, zBase]]].forEach(
        ([k, at]) => {
            const v = xSpan(at);
            if (v > 20) handles[k].scale = v;
        },
    );
    [["seatHeight", [-outL, 0, zSeat]], ["legHeight", [-outL, 0, zPole]], ["baseHeight", [-outL, 0, zBase]]].forEach(([k, at]) => {
        const v = zSpan(at);
        if (v > 20) handles[k].scale = v;
    });
    return { o, C3: L2W(o, 0, 0, g.h * 0.5), handles };
}
// 円・円柱の画面ハンドル。半径を1本だけ出す。
// 幅と奥行きは同じ値（＝正円）なので、どちらかを動かすと楕円になってしまう。
// ここでは常に ra と rb を同じ値へ書き換え、高さは上下の面ハンドルで編集する。
function circleGizmo(o) {
    if (!o || o.type !== "circ") return null;
    const r = Math.max(0.02, Math.abs(Number(o.ra) || 0.5)),
        zc = Math.max(0, Number(o.h) || 0) * 0.5,
        h = r / Math.max(0.1, r),
        radius = screenHandle(
            o,
            "circle-radius",
            [r, 0, zc],
            [r * Math.cos(0), r * Math.sin(0), zc],
            [(r + 0.5) * Math.cos(0), (r + 0.5) * Math.sin(0), zc],
            r,
            0.02,
            60,
            "半径",
            { x: 1, y: 0 },
            "#ad9cff",
        );
    // 1m 動かすのに画面 1m ぶん動かす（＝ほかの寸法ハンドルと同じ手ざわり）に直す。
    const pr = (rr) => scrW(pt(o, rr, 0, zc)),
        s0 = pr(r),
        s1 = pr(r + 1);
    if (s0?.ok && s1?.ok && Math.hypot(s1.x - s0.x, s1.y - s0.y) > 20)
        radius.scale = Math.hypot(s1.x - s0.x, s1.y - s0.y);
    return { o, C3: L2W(o, 0, 0, zc), handles: { radius } };
}
// 屋台の画面ハンドル。掴むのは
//  ・カウンターの手前の面（奥行き。奥の面はコの字に付いたままなので手前だけ動く）
//  ・カウンターの上面（高さ。下の面＝床は動かさない）
//  ・屋根の手前の面（張り出し。手前だけ動く）
//  ・屋根の下面（厚さ。上の面は動かさない）
// 幅・奥行き・全体の高さは通常の寸法ハンドル（面）で編集する。
function stallGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "stall") return null;
    const g = stallGeometry(o),
        hw = g.w / 2,
        hd = g.d / 2,
        // 壁の厚さハンドルは、左の壁の外側へ出した位置に置く。
        // シルエットの上に置くと、面（幅）のハンドルや移動に負けて掴めないため。
        wallOut = Math.max(0.12, g.t * 2),
        // 掴み位置から外向きに置く「目盛りの長さ」。この距離が画面上の
        // ドラッグ量の基準になるので、厚さのような小さい値でも細かく動かせるよう
        // 幅に対して十分な長さを取る（短いと数十pxで最大まで飛ぶ）。
        wallSpan = Math.max(0.6, g.w * 0.5),
        wallMax = Math.min(g.w, g.d) * 0.3,
        counterFrontY = -hd - g.cd,
        roofFrontY = -hd - g.ro,
        roofMidZ = (g.roofBottom + g.h) / 2,
        handles = {
            // 壁の厚さ（コの字の壁＝奥＋左右の3枚で共通）。
            // 左の壁の手前の面から外側（−X）へ引くと厚くなる。
            wallThickness: screenHandle(
                o,
                "stall-wall-thickness",
                // 掴む四角は、壁の手前の縁より少し上（壁の外側の面の上）へ置く。
                // カウンターの上面と重なると、そちらのハンドルに負けるため。
                [-hw + g.t / 2, -hd, Math.max(g.ch + 0.12, g.roofBottom * 0.55)],
                [-hw - wallOut, -hd, g.ch * 0.5],
                [-hw - wallOut - wallSpan, -hd, g.ch * 0.5],
                g.t,
                0.03,
                wallMax,
                "壁の厚さ",
                { x: -1, y: 0 },
                "#ffb36f",
            ),
            counterFront: screenHandle(
                o,
                "stall-counter-front",
                [0, counterFrontY, g.ch * 0.5],
                [0, counterFrontY, g.ch * 0.5],
                [0, counterFrontY - 0.25, g.ch * 0.5],
                g.cd,
                0.05,
                Math.max(0.1, g.d * 3),
                "カウンター奥行き",
                { x: 0, y: 1 },
                "#ff9f68",
            ),
            counterTop: screenHandle(
                o,
                "stall-counter-top",
                [0, counterFrontY + g.cd * 0.5, g.ch],
                [0, counterFrontY + g.cd * 0.5, g.ch],
                [0, counterFrontY + g.cd * 0.5, g.ch + 0.25],
                g.ch,
                0.1,
                Math.max(0.12, g.roofBottom - 0.12),
                "カウンター高さ",
                { x: 0, y: -1 },
                "#ffd0a8",
            ),
            roofFront: screenHandle(
                o,
                "stall-roof-front",
                [0, roofFrontY, roofMidZ],
                [0, roofFrontY, roofMidZ],
                [0, roofFrontY - 0.25, roofMidZ],
                g.ro,
                0,
                Math.max(0.2, g.w),
                "屋根の張り出し",
                { x: 0, y: 1 },
                "#7dd8ff",
            ),
            roofBottom: screenHandle(
                o,
                "stall-roof-bottom",
                // 屋根の下面そのものの上に四角を置くと、面ハンドルと重なって
                // 面の移動に負ける（コの字壁の厚さハンドルと同じ理由）。
                // 四角だけ屋根の手前の外へ出し、破線で下面へ結ぶ。
                [0, roofFrontY, g.roofBottom],
                [0, roofFrontY - Math.max(0.12, g.ro * 0.5), g.roofBottom],
                [0, roofFrontY - Math.max(0.12, g.ro * 0.5), g.roofBottom - 0.25],
                g.rt,
                0.04,
                Math.max(0.06, g.h * 0.4),
                "屋根の厚さ",
                { x: 0, y: 1 },
                "#9db8d6",
            ),
        };
    // 壁の厚さは値の幅が狭い（0.03〜0.42m 程度）ので、ドラッグ量の基準を
    // 画面上の長さから決め直す。1m 変えるのに画面 4m ぶん動かす想定にして、
    // 数十px で最大まで飛ばないようにする（他のハンドルは自動のまま）。
    const pr = (x, y, z) => scrW(pt(o, x, y, z)),
        w0 = pr(-hw - wallOut, -hd, g.ch * 0.5),
        w1 = pr(-hw - wallOut - 1, -hd, g.ch * 0.5);
    if (w0?.ok && w1?.ok) {
        const pxPerM = Math.hypot(w1.x - w0.x, w1.y - w0.y);
        // 真横・真正面のように投影が潰れるビューでも操作量が暴れないよう、下限を置く。
        handles.wallThickness.scale = pxPerM > 20 ? Math.max(300, pxPerM * 4) : 300;
    }
    return { o, C3: L2W(o, 0, 0, g.roofBottom * 0.5), handles };
}
function balconyGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "balcony") return null;
    const g = balconyGeometry(o),
        zRail = g.thickness + g.railH * 0.5,
        // 腰壁の外側の面がどの面にあるか（前面の腰壁が無ければ左右の腰壁を使う）。
        rail = g.frontRail
            ? {
                  anchor: [g.w * 0.4, -g.d / 2 + g.thickness * 0.5, zRail],
                  sample: [g.w * 0.4, -g.d / 2, zRail],
                  probe: [g.w * 0.4, -g.d / 2 + g.thickness, zRail],
                  fallback: { x: 0, y: 1 },
              }
            : {
                  anchor: [-g.w / 2 + g.thickness * 0.5, g.d * 0.3, zRail],
                  sample: [-g.w / 2, g.d * 0.3, zRail],
                  probe: [-g.w / 2 + g.thickness, g.d * 0.3, zRail],
                  fallback: { x: 1, y: 0 },
              },
        handle = screenHandle(
            o,
            "balcony-thickness",
            rail.anchor,
            rail.sample,
            rail.probe,
            g.thickness,
            0.035,
            Math.min(g.w, g.d) * 0.35,
            "壁の厚さ",
            rail.fallback,
            "#ff9f68",
        );
    return { o, C3: L2W(o, 0, 0, zRail), handles: { thickness: handle } };
}
function stackedIndividualEdit(o) {
    // 新形式はindividualEditを優先し、旧JSONのsyncFirst=falseも個別編集として読む。
    return o?.individualEdit === true || (o?.individualEdit == null && o?.syncFirst === false);
}
function stackedBevelHandle(o, f, index) {
    if (!isBeveledStackedBuildingAsset(o) || !f) return null;
    const w = Math.max(0.08, Math.abs(Number(f.w) || 4)),
        d = Math.max(0.08, Math.abs(Number(f.d) || 3)),
        h = Math.max(0.08, Math.abs(Number(f.h) || 2.2)),
        x = Number(f.x) || 0,
        y = Number(f.y) || 0,
        z = Number(f.z) || 0,
        max = Math.max(0, Math.min(w, d) * 0.5 - 0.001),
        start = clamp(
            Number.isFinite(Number(f.bevelOffset)) ? Number(f.bevelOffset) : Number(o.bevelOffset) || 0.28,
            0,
            max,
        ),
        pr = (px, py, pz) => scrW(customPt(o, px, py, pz)),
        anchor = pr(x + w * 0.5, y + d * 0.5, z + h),
        step = Math.max(0.05, Math.min(max || 0.25, Math.min(w, d) * 0.08)),
        sample = (b) => pr(x + w * 0.5 - b * 0.5, y + d * 0.5 - b * 0.5, z + h),
        raw = sample(start),
        probe = sample(Math.min(max, start + step)),
        dx = (probe?.x || 0) - (raw?.x || 0),
        dy = (probe?.y || 0) - (raw?.y || 0),
        length = Math.hypot(dx, dy),
        projected = !!raw?.ok && !!probe?.ok && Number.isFinite(length),
        hidden = projected && length <= 0.5 / Z,
        fallback = hiddenHandleDir();
    return {
        kind: "stacked-bevel-offset",
        s: !raw?.ok
            ? raw
            : hidden
              ? {
                    x: raw.x + fallback.x * hiddenHandleGap(),
                    y: raw.y + fallback.y * hiddenHandleGap(),
                    ok: true,
                }
              : raw,
        anchor,
        dir: projected && length > 0.0001 ? { x: dx / length, y: dy / length } : fallback,
        scale:
            projected && length > 0.0001
                ? length / Math.max(0.0001, Math.min(step, max - start || step))
                : hiddenHandleScale(),
        start,
        min: 0,
        max,
        floorIndex: index,
        label: "ベベル",
    };
}
function stackedOpeningGizmo(o) {
    if (!isStackedBuildingAsset(o) || !stackedOpeningEnabled(o)) return null;
    const floors = Array.isArray(o.floors) && o.floors.length ? o.floors : [];
    if (!floors.length || typeof stackedOpeningParams !== "function") return null;
    const f = floors[0],
        g = stackedOpeningParams(o, f),
        fx = Number(f.x) || 0,
        fy = Number(f.y) || 0,
        fz = Number(f.z) || 0,
        near = -g.d * 0.5,
        far = g.d * 0.5,
        pr = (x, y, z) => scrW(customPt(o, fx + x, fy + y, fz + z)),
        stepW = Math.max(0.05, g.w * 0.06),
        stepH = Math.max(0.05, g.h * 0.06),
        mk = (kind, s, q, start, min, max, step, factor = 1) => {
            const dx = q.x - s.x,
                dy = q.y - s.y,
                length = Math.hypot(dx, dy),
                hidden = !Number.isFinite(length) || length <= 0.5 / Z,
                fallback =
                    kind === "stacked-opening-h"
                        ? { x: 0, y: -1 }
                        : kind.endsWith("left")
                          ? { x: -1, y: 0 }
                          : { x: 1, y: 0 },
                gap = Math.max(30 / Z, Math.min(54 / Z, 0.34 * Math.max(1, Number(orthScale()) || 1))),
                display = hidden ? { ...s, x: s.x + fallback.x * gap, y: s.y + fallback.y * gap, ok: true } : s;
            return {
                kind,
                s: display,
                dir: hidden ? fallback : { x: dx / length, y: dy / length },
                scale: hidden ? hiddenHandleScale() : length / step || 1,
                start,
                min,
                max,
                factor,
            };
        },
        left = pr(-g.openingW * 0.5, near, g.openingH * 0.5),
        right = pr(g.openingW * 0.5, near, g.openingH * 0.5),
        top = pr(0, near, g.openingH),
        backCenter = pr(0, g.openingBack, g.openingH * 0.5),
        front = {
            center: pr(0, near, g.openingH * 0.5),
            frame: [
                pr(-g.openingW * 0.5, near, 0),
                pr(-g.openingW * 0.5, near, g.openingH),
                pr(g.openingW * 0.5, near, g.openingH),
                pr(g.openingW * 0.5, near, 0),
            ],
            handles: {
                left: mk(
                    "stacked-opening-w-left",
                    left,
                    pr(-g.openingW * 0.5 - stepW, near, g.openingH * 0.5),
                    g.openingW,
                    0.1,
                    Math.max(0.1, g.w - 0.1),
                    stepW,
                    2,
                ),
                right: mk(
                    "stacked-opening-w-right",
                    right,
                    pr(g.openingW * 0.5 + stepW, near, g.openingH * 0.5),
                    g.openingW,
                    0.1,
                    Math.max(0.1, g.w - 0.1),
                    stepW,
                    2,
                ),
                height: mk(
                    "stacked-opening-h",
                    top,
                    pr(0, near, g.openingH + stepH),
                    g.openingH,
                    0.1,
                    Math.max(0.1, g.h - g.rimHeight - 0.01),
                    stepH,
                ),
            },
        },
        backFrame = [
            pr(-g.openingW * 0.5, far, 0),
            pr(-g.openingW * 0.5, far, g.openingH),
            pr(g.openingW * 0.5, far, g.openingH),
            pr(g.openingW * 0.5, far, 0),
        ],
        panelFrame = [
            pr(-g.openingW * 0.5, g.openingBack, 0),
            pr(-g.openingW * 0.5, g.openingBack, g.openingH),
            pr(g.openingW * 0.5, g.openingBack, g.openingH),
            pr(g.openingW * 0.5, g.openingBack, 0),
        ],
        panelProbe = pr(0, g.openingBack + (g.openingBack >= 0 ? 0.1 : -0.1), g.openingH * 0.5),
        pdx = panelProbe.x - backCenter.x,
        pdy = panelProbe.y - backCenter.y,
        ppx = Math.hypot(pdx, pdy),
        panelProjected = Number.isFinite(ppx) && ppx > 0.5 / Z,
        panelDir = panelProjected ? { x: pdx / ppx, y: pdy / ppx } : { x: 1, y: 0 },
        panelScale = panelProjected ? ppx / 0.1 : hiddenHandleScale();
    return {
        o,
        opening: g,
        front,
        backFrame,
        panelFrame,
        panelCenter: backCenter,
        handles: {
            ...front.handles,
            backFace: {
                kind: "stacked-opening-back",
                s: backCenter,
                dir: panelDir,
                scale: panelScale,
                start: g.openingBack,
                min: -g.d * 0.5 + 0.025,
                max: g.d * 0.5 - 0.025,
                factor: 1,
                side: g.openingBack >= 0 ? 1 : -1,
            },
        },
        C3: customPt(o, fx, fy, fz + g.h * 0.5),
    };
}
function stackedBuildingGizmo(o) {
    if (!isStackedBuildingAsset(o)) return null;
    const floors = Array.isArray(o.floors) && o.floors.length ? o.floors : [];
    if (!floors.length) return null;
    const index = stackedIndividualEdit(o) ? clamp(Math.round(Number(o.activeFloor) || 0), 0, floors.length - 1) : 0,
        f = floors[index],
        w = Math.max(0.08, Math.abs(Number(f.w) || 4)),
        d = Math.max(0.08, Math.abs(Number(f.d) || 3)),
        h = Math.max(0.08, Math.abs(Number(f.h) || 2.2)),
        x = Number(f.x) || 0,
        y = Number(f.y) || 0,
        z = Number(f.z) || 0,
        p3 = (px, py, pz) => customPt(o, px, py, pz),
        pr = (px, py, pz) => scrW(p3(px, py, pz)),
        center = pr(x, y, z + h * 0.5),
        make = (kind, px, py, pz, axis, sign, label) => {
            const s = pr(px, py, pz),
                step = axis === "h" ? Math.max(0.05, h * 0.08) : Math.max(0.05, (axis === "w" ? w : d) * 0.08),
                q =
                    axis === "w"
                        ? pr(px + step * sign, py, pz)
                        : axis === "d"
                          ? pr(px, py + step * sign, pz)
                          : pr(px, py, pz + step),
                dx = q.x - s.x,
                dy = q.y - s.y,
                pxLen = Math.hypot(dx, dy),
                hidden = pxLen <= 0.5 / Z,
                fallback = axis === "h" ? { x: 0, y: -1 } : { x: 1, y: 0 },
                displayGap = Math.max(30 / Z, Math.min(54 / Z, 0.34 * Math.max(1, Number(orthScale()) || 1))),
                display = hidden ? { x: s.x + fallback.x * displayGap, y: s.y + fallback.y * displayGap, ok: true } : s;
            return {
                kind,
                s: display,
                dir: hidden ? fallback : { x: dx / pxLen, y: dy / pxLen },
                scale: hidden ? hiddenHandleScale() : pxLen / step,
                start: axis === "w" ? w : axis === "d" ? d : h,
                min: 0.08,
                max: 30,
                axis,
                sign,
                floorIndex: index,
                label,
            };
        },
        handles = {
            widthLeft: make("stacked-width", x - w * 0.5, y, z + h * 0.5, "w", -1, "幅"),
            widthRight: make("stacked-width", x + w * 0.5, y, z + h * 0.5, "w", 1, "幅"),
            depthLeft: make("stacked-depth", x, y - d * 0.5, z + h * 0.5, "d", -1, "奥行"),
            depthRight: make("stacked-depth", x, y + d * 0.5, z + h * 0.5, "d", 1, "奥行"),
            height: make("stacked-height", x, y, z + h, "h", 1, "高さ"),
        },
        frame = [pr(x - w / 2, y, z), pr(x - w / 2, y, z + h), pr(x + w / 2, y, z + h), pr(x + w / 2, y, z)],
        bevelHandle = stackedBevelHandle(o, f, index),
        opening = stackedOpeningGizmo(o);
    return { o, C3: p3(x, y, z + h * 0.5), center, frame, handles, bevelHandle, opening, floorIndex: index };
}
// 凹窓階層建物の窓寸法用ギズモ。正面窓の幅・高さ・凹み奥行きを
// 1つのハンドル群へまとめ、変更値は全階へ反復して適用する。
function recessedStackedGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "recessedStackedBuilding") return null;
    const q = recessedStackedBuildingParams(o),
        paths = recessedStackedBuildingWindowPaths(q),
        // 開口は各階の下端ではなく、階と階の接合部の中央に置く。
        junctions = recessedStackedBuildingJunctionWindows(o, q),
        firstJunction = junctions[0] || { bottom: q.windowH * 0.5, top: q.windowH * 1.5 },
        z0 = firstJunction.bottom,
        z1 = firstJunction.top,
        frontY = -q.d * 0.5,
        frontStart = paths.outer[0],
        frontEnd = paths.outer[1],
        innerStart = paths.inner[0],
        innerEnd = paths.inner[1],
        windowCenterX = (frontStart[0] + frontEnd[0]) * 0.5,
        midZ = (z0 + z1) * 0.5,
        pr = (x, y, z) => scrW(customPt(o, x, y, z)),
        project = (kind, anchor3, screen3, probe3, start, min, max, label, color, fallback) => {
            const anchor = pr(...anchor3),
                s0 = pr(...screen3),
                probe = pr(...probe3),
                dx = (probe?.x || 0) - (s0?.x || 0),
                dy = (probe?.y || 0) - (s0?.y || 0),
                px = Math.hypot(dx, dy),
                hidden = !s0?.ok || !probe?.ok || px <= 0.5 / Z,
                fl = Math.hypot(fallback.x, fallback.y) || 1,
                dir = hidden ? { x: fallback.x / fl, y: fallback.y / fl } : { x: dx / px, y: dy / px },
                gap = Math.max(34 / Z, 48 / Z),
                s = hidden && anchor?.ok ? { x: anchor.x + dir.x * gap, y: anchor.y + dir.y * gap, ok: true } : s0;
            return {
                kind,
                s,
                anchor,
                dir,
                scale: hidden ? hiddenHandleScale() : px,
                start,
                min,
                max,
                label,
                color,
            };
        },
        // 窓帯は建物全体に追従する。編集するのは両端の壁幅だけ。
        marginLeft = project(
            "recessed-window-margin-left",
            [frontStart[0], frontY, midZ],
            [frontStart[0], frontY, midZ],
            [frontStart[0] - 0.1, frontY, midZ],
            q.marginLeft,
            0,
            Math.max(0, q.w - q.cornerBevel - 0.2),
            "端の壁幅（手前）",
            "#ffd34d",
            { x: -1, y: 0 },
        ),
        marginEnd = project(
            "recessed-window-margin-end",
            [q.w * 0.5, paths.sideEnd, midZ],
            [q.w * 0.5, paths.sideEnd, midZ],
            [q.w * 0.5, paths.sideEnd + 0.1, midZ],
            q.marginEnd,
            0,
            Math.max(0, q.d - q.cornerBevel - 0.2),
            "端の壁幅（奥）",
            "#ffd34d",
            { x: 1, y: 0 },
        ),
        floorHeight = project(
            "recessed-floor-height",
            [-q.w * 0.5 + 0.45, frontY, q.firstFloorHeight],
            [-q.w * 0.5 + 0.45, frontY, q.firstFloorHeight],
            [-q.w * 0.5 + 0.45, frontY, q.firstFloorHeight + 0.1],
            q.floorHeight,
            0.5,
            30,
            "階高",
            "#ffd8a8",
            { x: 0, y: -1 },
        ),
        firstFloorH = project(
            "recessed-first-floor-height",
            [-q.w * 0.5 + 0.12, frontY, 0.05],
            [-q.w * 0.5 + 0.12, frontY, 0.05],
            [-q.w * 0.5 + 0.12, frontY, 0.15],
            q.firstFloorHeight,
            0.5,
            30,
            "1階の高さ",
            "#ffb3ff",
            { x: 0, y: -1 },
        ),
        floorGap = project(
            "recessed-floor-gap",
            [frontEnd[0] - 0.25, frontY, q.firstFloorHeight],
            [frontEnd[0] - 0.25, frontY, q.firstFloorHeight],
            [frontEnd[0] - 0.25, frontY, q.firstFloorHeight + 0.1],
            q.floorGap,
            0.05,
            5,
            "階接合部の高さ（＝窓高）",
            "#8ef7ff",
            { x: 0, y: -1 },
        ),
        depth = project(
            "recessed-window-depth",
            [(innerStart[0] + innerEnd[0]) * 0.5, innerStart[1], midZ],
            [(innerStart[0] + innerEnd[0]) * 0.5, innerStart[1], midZ],
            [(innerStart[0] + innerEnd[0]) * 0.5, innerStart[1] + 0.1, midZ],
            q.windowDepth,
            0.025,
            Math.max(0.025, Math.min(q.w - q.cornerBevel, q.d) * 0.45),
            "凹み奥行",
            "#ad9cff",
            { x: 1, y: -0.5 },
        ),
        bevelCenter = [q.w * 0.5 - q.cornerBevel, -q.d * 0.5 + q.cornerBevel],
        bevelDir = { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
        bevelPoint = [
            bevelCenter[0] + q.cornerBevel * bevelDir.x,
            bevelCenter[1] + q.cornerBevel * bevelDir.y,
            midZ,
        ],
        bevelProbe = [
            bevelCenter[0] + (q.cornerBevel + 0.1) * bevelDir.x,
            bevelCenter[1] + (q.cornerBevel + 0.1) * bevelDir.y,
            midZ,
        ],
        bevel = project(
            "recessed-corner-bevel",
            bevelPoint,
            bevelPoint,
            bevelProbe,
            q.cornerBevel,
            0,
            recessedMaxInset(q.w, q.d),
            "ベベルオフセット",
            "#ff6b7c",
            { x: -1, y: -1 },
        ),
        count = project(
            "recessed-window-count",
            [windowCenterX, frontY, z0 - 0.12],
            [windowCenterX, frontY, z0 - 0.12],
            [windowCenterX + 0.1, frontY, z0 - 0.12],
            q.windowCount,
            1,
            12,
            "窓枚数",
            "#56d8ff",
            { x: 1, y: 1 },
        );
    count.scale = 20 / Z;
    // projectの試点は0.1m先。端の壁幅ハンドルの移動量をmへ換算する。
    [
        [marginLeft, frontStart[0] - 0.1, frontY],
        [marginEnd, q.w * 0.5, paths.sideEnd + 0.1],
    ].forEach(([handle, px, py]) => {
        const probe = pr(px, py, midZ),
            delta = probe?.ok && handle.anchor?.ok ? Math.hypot(probe.x - handle.anchor.x, probe.y - handle.anchor.y) : 0;
        if (delta > 0.5 / Z) handle.scale = delta / 0.1;
    });
    return {
        o,
        C3: customPt(o, windowCenterX, frontY, midZ),
        handles: { floorHeight, firstFloorH, floorGap, marginLeft, marginEnd, depth, bevel, count },
        frame: [
            pr(frontStart[0], frontY, z0),
            pr(frontEnd[0], frontY, z0),
            pr(frontEnd[0], frontY, z1),
            pr(frontStart[0], frontY, z1),
        ],
        backFrame: [
            pr(innerStart[0], innerStart[1], z0),
            pr(innerEnd[0], innerEnd[1], z0),
            pr(innerEnd[0], innerEnd[1], z1),
            pr(innerStart[0], innerStart[1], z1),
        ],
    };
}
function pathPipeGizmo(o) {
    if (
        !o ||
        o.type !== "asset" ||
        o.asset !== "pathPipe" ||
        typeof pathPipeControlPoints !== "function" ||
        typeof pathPipeMesh !== "function" ||
        typeof pt !== "function"
    )
        return null;
    const points = pathPipeControlPoints(o),
        pr = (v) => scrW(pt(o, v[0], v[1], v[2])),
        controlPoints = points.map((v) => pr(v)),
        pathHandles = [],
        axisNames = ["X", "Y", "Z"],
        // ローカル y＝奥行き（緑）／ローカル z＝高さ（青）
        axisColors = ["#e8743d", "#3fa45b", "#4a7be8"],
        // 正面／横ビューでは、経路の別の点が投影上で同じ場所になることがある
        // （例：奥行きだけが違う2点）。同じ画面座標へ全ハンドルを重ねると
        // hitGizmoが常に先頭の点を返すため、重なった点の操作列を扇状に分ける。
        pointFan = controlPoints.map((anchor, index) => {
            const peers = controlPoints
                .map((q, i) => (q?.ok && anchor?.ok && Math.hypot(q.x - anchor.x, q.y - anchor.y) < 12 / Z ? i : -1))
                .filter((i) => i >= 0);
            if (peers.length < 2) return { x: 0, y: 0 };
            const rank = peers.indexOf(index),
                lane = rank - (peers.length - 1) * 0.5,
                gap = Math.max(44 / Z, Math.min(64 / Z, 0.42 * Math.max(1, Number(orthScale()) || 1))),
                d = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
            return { x: d.x * lane * gap, y: d.y * lane * gap };
        });
    points.forEach((v, index) => {
        const rawAnchor = pr(v),
            fan = pointFan[index] || { x: 0, y: 0 },
            anchor = rawAnchor?.ok ? { ...rawAnchor, x: rawAnchor.x + fan.x, y: rawAnchor.y + fan.y } : rawAnchor;
        [0, 1, 2].forEach((axis) => {
            const step = Math.max(0.18, (Number(o.pipeRadius) || 0.18) * 2.4),
                probePoint = [...v];
            probePoint[axis] += step;
            const probe = pr(probePoint),
                dx = probe.x - rawAnchor.x,
                dy = probe.y - rawAnchor.y,
                length = Math.hypot(dx, dy),
                fallback = axis === 2 ? { x: 0, y: -1 } : { x: 1, y: 0 },
                projected = !!probe?.ok && Number.isFinite(dx) && Number.isFinite(dy) && Number.isFinite(length),
                hidden = !projected || length <= 0.5 / Z,
                // 正面／横／上では奥行きまたは高さの軸が画面へつぶれる。
                // そのまま中心点へ重ねると、制御点を押しても別軸を拾ったり、
                // 「押せるハンドルがない」ように見えるため、画面上へ逃がす。
                displayGap = Math.max(30 / Z, Math.min(54 / Z, 0.34 * Math.max(1, Number(orthScale()) || 1))),
                display = hidden
                    ? { x: anchor.x + fallback.x * displayGap, y: anchor.y + fallback.y * displayGap, ok: true }
                    : { ...probe, x: probe.x + fan.x, y: probe.y + fan.y };
            pathHandles.push({
                kind: `path-point-${index}-${axis}`,
                index,
                axis,
                s: display,
                anchor,
                dir: hidden ? fallback : { x: dx / length, y: dy / length },
                scale: hidden ? hiddenHandleScale() : length / step,
                start: Number(v[axis]) || 0,
                min: -50,
                max: 50,
                label: axisNames[axis],
                color: axisColors[axis],
            });
        });
    });
    const mesh = pathPipeMesh(o),
        radius = Math.max(0.02, Number(o.pipeRadius) || 0.18),
        radiusAnchor = controlPoints[0],
        radiusPoint = mesh.rings[0]?.[0] ? pr(mesh.rings[0][0]) : radiusAnchor,
        rdx = radiusPoint.x - radiusAnchor.x,
        rdy = radiusPoint.y - radiusAnchor.y,
        rLength = Math.hypot(rdx, rdy),
        radiusProjected =
            !!radiusPoint?.ok &&
            !!radiusAnchor?.ok &&
            Number.isFinite(rdx) &&
            Number.isFinite(rdy) &&
            Number.isFinite(rLength),
        radiusHidden = !radiusProjected || rLength <= 0.5 / Z,
        radiusFallback = orthView === "top" ? { x: 0, y: 1 } : { x: -1, y: 0 },
        radiusGap = Math.max(34 / Z, Math.min(58 / Z, 0.38 * Math.max(1, Number(orthScale()) || 1))),
        radiusDisplay = radiusHidden
            ? {
                  x: radiusAnchor.x + radiusFallback.x * radiusGap,
                  y: radiusAnchor.y + radiusFallback.y * radiusGap,
                  ok: true,
              }
            : radiusPoint;
    return {
        o,
        C3: L2W(o, points[0][0], points[0][1], points[0][2]),
        controlPoints,
        pathHandles,
        radiusHandle: {
            kind: "path-radius",
            s: radiusDisplay,
            anchor: radiusAnchor,
            dir: radiusHidden ? radiusFallback : { x: rdx / rLength, y: rdy / rLength },
            scale: radiusHidden ? hiddenHandleScale() : rLength / radius,
            start: radius,
            min: 0.02,
            max: 5,
        },
    };
}
function beveledBoxGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "beveledBox" || typeof beveledBoxParams !== "function") return null;
    const q = beveledBoxParams(o),
        z = Math.max(0, Number(o.h) || 0),
        x = q.w * 0.5,
        y = q.d * 0.5,
        pr = (px, py, pz) => scrW(pt(o, px, py, pz)),
        anchor = pr(x, y, z),
        step = Math.max(0.05, Math.min(q.max || 0.25, Math.min(q.w, q.d) * 0.08)),
        sample = (b) => pr(x - b * 0.5, y - b * 0.5, z),
        raw = sample(q.bevelOffset),
        probe = sample(Math.min(q.max, q.bevelOffset + step)),
        dx = (probe?.x || 0) - (raw?.x || 0),
        dy = (probe?.y || 0) - (raw?.y || 0),
        length = Math.hypot(dx, dy),
        projected = !!raw?.ok && !!probe?.ok && Number.isFinite(length),
        hidden = projected && length <= 0.5 / Z,
        fallback = hiddenHandleDir(),
        visibleDir = hidden ? fallback : { x: dx / length, y: dy / length },
        // 断面の実点は外周線のすぐ内側にあるため、そこへハンドルを置くと
        // 面／移動ギズモと重なって「移動できない」ように見える。表示だけを
        // 外側へ逃がし、編集量の方向とスケールは実点の投影から保つ。
        displayGap = Math.max(48 / Z, 56 / Z),
        displayS = !raw?.ok
            ? raw
            : hidden
              ? {
                    x: raw.x + fallback.x * hiddenHandleGap(),
                    y: raw.y + fallback.y * hiddenHandleGap(),
                    ok: true,
                }
              : {
                    x: raw.x - visibleDir.x * displayGap,
                    y: raw.y - visibleDir.y * displayGap,
                    ok: true,
                },
        handle = {
            kind: "beveled-offset",
            s: displayS,
            anchor,
            dir: visibleDir,
            scale: hidden
                ? hiddenHandleScale()
                : length / Math.max(0.0001, Math.min(step, q.max - q.bevelOffset || step)),
            start: q.bevelOffset,
            min: 0,
            max: q.max,
            label: "ベベル",
        };
    return { o, C3: L2W(o, 0, 0, z * 0.5), center: scrW(L2W(o, 0, 0, z * 0.5)), handle };
}
// 隅切り開口の幅・高さ・奥行き用ハンドル。
// 3D投影で方向がつぶれる直交ビューでは画面上のフォールバック方向を使い、
// すべてのビューで同じ数値を編集できるようにする。
function cornerCutOpeningGizmo(o, opening) {
    if (!opening?.enabled) return null;
    const pr = (xy, z) => scrW(pt(o, xy[0], xy[1], z)),
        mid = opening.midpoint,
        midZ = opening.openingH * 0.5,
        frontMid = [(opening.frontA[0] + opening.frontB[0]) * 0.5, (opening.frontA[1] + opening.frontB[1]) * 0.5],
        backMid = [(opening.backA[0] + opening.backB[0]) * 0.5, (opening.backA[1] + opening.backB[1]) * 0.5],
        projected = (xy, z, vector, fallback) => {
            const a = pr(xy, z),
                b = pr([xy[0] + vector[0], xy[1] + vector[1]], z + (vector[2] || 0)),
                dx = (b?.x || 0) - (a?.x || 0),
                dy = (b?.y || 0) - (a?.y || 0),
                px = Math.hypot(dx, dy),
                hidden = !a?.ok || !b?.ok || px <= 0.5 / Z,
                f = fallback || { x: 1, y: 0 },
                fl = Math.hypot(f.x, f.y) || 1;
            return {
                anchor: a,
                dir: hidden ? { x: f.x / fl, y: f.y / fl } : { x: dx / px, y: dy / px },
                scale: hidden ? hiddenHandleScale() : px,
                hidden,
            };
        },
        handle = (kind, xy, z, vector, start, min, max, label, color, fallback) => {
            const p = projected(xy, z, vector, fallback),
                raw = pr(xy, z),
                gap = Math.max(34 / Z, 46 / Z),
                s =
                    p.hidden && p.anchor?.ok
                        ? { x: p.anchor.x + p.dir.x * gap, y: p.anchor.y + p.dir.y * gap, ok: true }
                        : raw;
            return {
                kind,
                s,
                anchor: p.anchor,
                dir: p.dir,
                scale: p.scale,
                start,
                min,
                max,
                label,
                color,
            };
        },
        left = handle(
            "cornerCut-opening-width-left",
            opening.frontA,
            midZ,
            [-opening.tangent[0], -opening.tangent[1], 0],
            opening.openingW,
            0.1,
            opening.maxWidth,
            "開口幅",
            "#ffd34d",
            { x: -1, y: 0 },
        ),
        right = handle(
            "cornerCut-opening-width-right",
            opening.frontB,
            midZ,
            [opening.tangent[0], opening.tangent[1], 0],
            opening.openingW,
            0.1,
            opening.maxWidth,
            "開口幅",
            "#ffd34d",
            { x: 1, y: 0 },
        ),
        height = handle(
            "cornerCut-opening-height",
            frontMid,
            0,
            [0, 0, 1],
            opening.openingH,
            0.1,
            opening.maxHeight,
            "開口高",
            "#ff9f68",
            { x: 0, y: -1 },
        ),
        depth = handle(
            "cornerCut-opening-depth",
            frontMid,
            midZ,
            [opening.inward[0], opening.inward[1], 0],
            opening.openingDepth,
            0.025,
            opening.maxDepth,
            "開口奥行",
            "#ad9cff",
            { x: 1, y: -0.5 },
        );
    if (!depth.hidden) depth.s = pr(backMid, midZ);
    if (!height.hidden) height.s = pr(frontMid, opening.openingH);
    left.anchor = pr(frontMid, midZ);
    right.anchor = pr(frontMid, midZ);
    height.anchor = pr(frontMid, 0);
    return {
        C3: L2W(o, mid[0], mid[1], midZ),
        handles: { left, right, height, depth },
        panelFrame: [
            pr(opening.frontA, 0),
            pr(opening.frontB, 0),
            pr(opening.frontB, opening.openingH),
            pr(opening.frontA, opening.openingH),
        ],
        backFrame: [
            pr(opening.backA, 0),
            pr(opening.backB, 0),
            pr(opening.backB, opening.openingH),
            pr(opening.backA, opening.openingH),
        ],
    };
}
// 隅切り直方体の切り口オフセット用ハンドル。
// 切り口の中央を基準に、オフセットが増える方向を画面へ投影する。
// 正面／横／上で片方の成分がつぶれても、残った成分または表示用の
// フォールバック方向を使うため、どの直交ビューでも操作対象が見える。
function cornerCutGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "cornerCutBox" || typeof cornerCutBoxParams !== "function") return null;
    const q = cornerCutBoxParams(o),
        footprint = cornerCutFootprint(q.w, q.d, q.cornerOffset, q.cornerCutCorner),
        a = footprint[footprint.length - 1],
        b = footprint[0],
        z = Math.max(0.01, Math.abs(Number(o.h) || 0.01)) * 0.5,
        mid = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5],
        pr = (x, y, zz = z) => scrW(pt(o, x, y, zz)),
        anchor = pr(mid[0], mid[1]),
        step = Math.max(0.05, Math.min(Math.max(0.001, q.max - q.cornerOffset), Math.min(q.w, q.d) * 0.08)),
        probeFootprint = cornerCutFootprint(q.w, q.d, q.cornerOffset + step, q.cornerCutCorner),
        probeA = probeFootprint[probeFootprint.length - 1],
        probeB = probeFootprint[0],
        probe = pr((probeA[0] + probeB[0]) * 0.5, (probeA[1] + probeB[1]) * 0.5),
        dx = (probe?.x || 0) - (anchor?.x || 0),
        dy = (probe?.y || 0) - (anchor?.y || 0),
        px = Math.hypot(dx, dy),
        hidden = !anchor?.ok || !probe?.ok || px <= 0.5 / Z,
        fallback = hiddenHandleDir(),
        dir = hidden ? fallback : { x: dx / px, y: dy / px },
        gap = Math.max(32 / Z, 48 / Z),
        display = anchor?.ok
            ? hidden
                ? { x: anchor.x + fallback.x * gap, y: anchor.y + fallback.y * gap, ok: true }
                : { x: anchor.x + dir.x * gap, y: anchor.y + dir.y * gap, ok: true }
            : anchor;
    const opening = typeof cornerCutOpeningParams === "function" ? cornerCutOpeningParams(o) : null;
    return {
        o,
        C3: L2W(o, 0, 0, z),
        opening: cornerCutOpeningGizmo(o, opening),
        handle: {
            kind: "cornerCut-offset",
            s: display,
            anchor,
            dir,
            scale: hidden ? hiddenHandleScale() : px / step,
            start: q.cornerOffset,
            min: 0,
            max: q.max,
            label: "隅切り",
        },
    };
}
// 壁付け看板（単体）のギズモ。
// 金具の長さとベベル幅を、3D・正面・横・上のどこからでも同じ手順で編集できる。
// 幅・奥行き（板厚）・高さは標準の面ハンドルへ任せる。
// 画面上のハンドルを1つ作る共通処理。
// anchor3=取付点（線の付け根）、sample3=つまみの位置、probe3=少し先の点。
// 奥に隠れて投影が潰れたときは fallback の向きへ逃がして、必ず掴める位置に置く。
function screenHandle(o, kind, anchor3, sample3, probe3, start, min, max, label, fallback, color) {
    const pr = (x, y, z) => scrW(pt(o, x, y, z)),
        anchor = pr(...anchor3),
        from = pr(...sample3),
        to = pr(...probe3),
        dx = (to?.x || 0) - (from?.x || 0),
        dy = (to?.y || 0) - (from?.y || 0),
        length = Math.hypot(dx, dy),
        hidden = !from?.ok || !to?.ok || length <= 0.5 / Z,
        fl = Math.hypot(fallback.x, fallback.y) || 1,
        dir = hidden ? { x: fallback.x / fl, y: fallback.y / fl } : { x: dx / length, y: dy / length },
        gap = Math.max(40 / Z, 50 / Z);
    return {
        kind,
        s: hidden && from?.ok ? { x: from.x + dir.x * gap, y: from.y + dir.y * gap, ok: true } : from,
        anchor,
        dir,
        // 薄い板・壁の厚さのように、画面上の長さが数pxしかない寸法は、
        // そのまま倍率にすると数十pxのドラッグで最大値まで飛んでしまう。
        // 画面 60px で 1m 動く程度の下限を置き、細かい値も掴めるようにする。
        scale: hidden ? hiddenHandleScale() : Math.max(length, 60),
        start,
        min,
        max,
        label,
        color,
    };
}
function wallSignGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "wallSign" || typeof wallSignParams !== "function") return null;
    const params = wallSignParams(o),
        half = params.thickness * 0.5,
        // 板の輪郭を画面座標へ落とすための投影と、寸法ハンドルを作る関数。
        pr = (x, y, z) => scrW(pt(o, x, y, z)),
        handle = (...args) => screenHandle(o, ...args),
        // 金具は板の左側面（-x）から横へ伸びる。ハンドルは先端（外側）へ置く。
        bracketInner = [-params.width * 0.5, 0, 0],
        bracketOuter = [-params.width * 0.5 - params.bracketLength, 0, 0],
        bracket = handle(
            "wall-sign-bracket-length",
            bracketInner,
            bracketOuter,
            [bracketOuter[0] - 0.1, 0, bracketOuter[2]],
            params.bracketLength,
            0.05,
            5,
            "金具の長さ",
            { x: -1, y: 0 },
            "#ffd34d",
        ),
        // ベベルは板の表裏の輪郭の角へ付くので、右前上の角にハンドルを置く。
        bevelCorner = [params.width * 0.5, -half, params.height * 0.5],
        bevelInset = params.beveled ? params.bevelOffset : 0,
        bevel = handle(
            "wall-sign-bevel",
            bevelCorner,
            [bevelCorner[0] - bevelInset, bevelCorner[1], bevelCorner[2] - bevelInset],
            [bevelCorner[0] - bevelInset - 0.1, bevelCorner[1], bevelCorner[2] - bevelInset - 0.1],
            params.bevelOffset,
            0,
            params.bevelMax,
            "ベベル幅",
            { x: -1, y: 1 },
            "#ff6b7c",
        );
    return {
        o,
        C3: L2W(o, 0, half, params.height * 0.5),
        handles: { bracket, bevel },
        frame: wallSignFacePoints(params).map(([x, z]) => pr(x, -half, z)),
        backFrame: wallSignFacePoints(params).map(([x, z]) => pr(x, half, z)),
    };
}
// 窓グリッドは、窓1枚の幅と高さを画面上のハンドルで変えられる。
// ハンドルは左上の窓の右辺・上辺へ置き、ドラッグ量をそのまま寸法へ足す。
function windowGridGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "windowGrid" || typeof windowGridOptions !== "function") return null;
    const w = Math.max(0.2, Math.abs(Number(o.ra) || 0.2) * 2),
        h = Math.max(0.2, Math.abs(Number(o.h) || 0.2)),
        t = Math.max(0.01, Math.abs(Number(o.rb) || 0.06) * 2),
        opts = windowGridOptions(o, w, h),
        rects = facadeWindowGridRects(w, h, opts),
        y = -t * 0.5;
    if (!rects.length) return null;
    // 左上（最も上・最も左）の窓を基準にする。並びは行→列の順で作られている。
    const rect = rects[0],
        cx = (rect.x0 + rect.x1) * 0.5,
        cz = (rect.z0 + rect.z1) * 0.5,
        winW = rect.x1 - rect.x0,
        winH = rect.z1 - rect.z0,
        maxW = Math.max(0.05, w - Math.abs(opts.mx) * 2),
        maxH = Math.max(0.05, h - opts.sill - opts.head),
        widthHandle = screenHandle(
            o,
            "window-grid-width",
            [cx, y, cz],
            [rect.x1, y, cz],
            [rect.x1 + 0.1, y, cz],
            winW,
            0.05,
            maxW,
            "窓の幅",
            { x: 1, y: 0 },
            "#5ec8ff",
        ),
        heightHandle = screenHandle(
            o,
            "window-grid-height",
            [cx, y, cz],
            [cx, y, rect.z1],
            [cx, y, rect.z1 + 0.1],
            winH,
            0.05,
            maxH,
            "窓の高さ",
            { x: 0, y: -1 },
            "#5ec8ff",
        );
    return { o, C3: L2W(o, 0, y, cz), handles: { width: widthHandle, height: heightHandle } };
}
// 人物の関節回転ギズモ。腰・首・左右の股関節・左右の膝に、
// 画面で回せる丸ハンドルを1つずつ置く。
// 角度は asset.js の personPose と同じ式で計算するので、
// 線画・面メッシュとハンドルの位置が食い違わない。
// 関節ハンドルの 1度あたりの画面ピクセル（向きが画面上で動かない場合）。
// 6px/度 なので、200px ドラッグすると約33度まわる。
const PERSON_JOINT_PX_PER_DEG = 6;
// 画面上でほぼ同じ点に重なったハンドルを、輪状に少しずつずらす。
// 真上ビューの腰と首、股と膝のように視線方向で前後する関節は、
// 正投影すると1点に重なって掴み分けできなくなる。ずらした位置から
// 支点へ破線を引くので、どの関節のハンドルかは見た目で分かる。
function spreadOverlappingHandles(handles, minGap) {
    if (!Array.isArray(handles) || handles.length < 2) return handles;
    const gap = Math.max(14 / Z, Number(minGap) || 0 || 26 / Z),
        placed = [];
    for (const h of handles) {
        if (!h || !h.s || !h.s.ok || !Number.isFinite(h.s.x) || !Number.isFinite(h.s.y)) {
            placed.push(null);
            continue;
        }
        let x = h.s.x,
            y = h.s.y,
            k = 0;
        // 重なりが解けるまで、外側へ広がる渦状の候補点を順に試す。
        while (k < 32 && placed.some((q) => q && Math.hypot(q.x - x, q.y - y) < gap)) {
            k++;
            const ring = Math.ceil(k / 8),
                ang = -Math.PI / 2 + ((k - 1) % 8) * (Math.PI / 4);
            x = h.s.x + Math.cos(ang) * gap * ring;
            y = h.s.y + Math.sin(ang) * gap * ring;
        }
        h.s = { x, y, ok: true, spread: k > 0 };
        placed.push(h.s);
    }
    return handles;
}
function personJointHandles(o) {
    if (!o || o.type !== "asset" || o.asset !== "person" || typeof personPose !== "function") return [];
    const eps = 4,
        rad = (deg) => -Number(deg || 0) * DG,
        rotate = (py, pz, oy, oz, deg) => {
            const a = rad(deg),
                cs = Math.cos(a),
                sn = Math.sin(a),
                dy = py - oy,
                dz = pz - oz;
            return [oy + dy * cs - dz * sn, oz + dy * sn + dz * cs];
        },
        base = personPose(o),
        pr = (x, y, z) => scrW(L2W(o, x, y, z)),
        // 1つの関節ハンドル。pivot=支点、probe=いまの位置、alt=角度を少し増やした位置。
        make = (id, key, label, color, pivot3, probe3, alt3, start, min, max) => {
            const anchor = pr(...pivot3),
                from = pr(...probe3),
                to = pr(...alt3),
                dx = (to?.x ?? 0) - (from?.x ?? 0),
                dy = (to?.y ?? 0) - (from?.y ?? 0),
                length = Math.hypot(dx, dy),
                visible = !!from?.ok && !!to?.ok && length > 0.75,
                // 画面で回転が動かない向き（真横から見た膝の曲げなど）では、
                // 支点から見た外向きの直交方向へ逃がして固定ハンドルにする。
                ax = (from?.x ?? 0) - (anchor?.x ?? 0),
                ay = (from?.y ?? 0) - (anchor?.y ?? 0),
                an = Math.hypot(ax, ay) || 1,
                fallback = { x: -ay / an, y: ax / an },
                dir = visible ? { x: dx / length, y: dy / length } : fallback,
                gap = Math.max(34 / Z, 42 / Z),
                s = visible
                    ? from
                    : from?.ok
                      ? { x: from.x + fallback.x * gap, y: from.y + fallback.y * gap, ok: true }
                      : from;
            return {
                kind: `person-joint-${id}`,
                key,
                label,
                color,
                s,
                anchor,
                dir,
                // 1度あたりの画面ピクセル。ドラッグ量÷これが角度(度)になる。
                // 画面上で回転が動く向き（visible）は、実際の移動量から求めた
                // 比率を使う。動かない向き（前から見た膝など）は比率が取れないので、
                // どのビューでも同じ操作感になる固定値を使う。
                // 以前はここに orthScale()×4（前ビューで約533px/度）を入れていたため、
                // 200px ドラッグしても 0.4 度しか動かず「編集できない」状態だった。
                scale: visible ? clamp(length / eps, 3, 14) : PERSON_JOINT_PX_PER_DEG,
                start,
                min,
                max,
            };
        },
        num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d),
        waist = clamp(num(o.personWaist, 0), -60, 60),
        neck = clamp(num(o.personNeck, 0), -40, 40),
        hips = [clamp(num(o.personHipL, 0), -80, 80), clamp(num(o.personHipR, 0), -80, 80)],
        knees = [clamp(num(o.personKneeL, 0), 0, 120), clamp(num(o.personKneeR, 0), 0, 120)],
        [waistY, waistZ] = rotate(base.bodyY, base.torso1, 0, base.torso0, waist),
        [waistYa, waistZa] = rotate(base.bodyY, base.torso1, 0, base.torso0, waist + eps),
        // 「角度を少しだけ増やした位置」は、骨格をもう一度計算せずに
        // 支点まわりの回転だけで求める（毎フレームの再計算を1回に抑える）。
        neckAlt = rotate(base.headC1.y, base.headC1.z, base.neckBase.y, base.neckBase.z, eps),
        hipAlt = [0, 1].map((i) =>
            rotate(base.legs[i].knee.y, base.legs[i].knee.z, base.legs[i].hip.y, base.legs[i].hip.z, eps),
        ),
        kneeAlt = [0, 1].map((i) =>
            rotate(base.legs[i].foot.y, base.legs[i].foot.z, base.legs[i].knee.y, base.legs[i].knee.z, -eps),
        );
    return spreadOverlappingHandles([
        make("waist", "personWaist", "腰", "#ff8a3d", [0, 0, base.torso0], [0, waistY, waistZ], [0, waistYa, waistZa], waist, -60, 60),
        make(
            "neck",
            "personNeck",
            "首",
            "#5ec8ff",
            [0, base.neckBase.y, base.neckBase.z],
            [0, base.headC1.y, base.headC1.z],
            [0, neckAlt[0], neckAlt[1]],
            neck,
            -40,
            40,
        ),
        ...[0, 1].map((i) =>
            make(
                `hip-${i}`,
                i ? "personHipR" : "personHipL",
                i ? "右股" : "左股",
                "#7bd389",
                [base.legs[i].hip.x, base.legs[i].hip.y, base.legs[i].hip.z],
                [base.legs[i].knee.x, base.legs[i].knee.y, base.legs[i].knee.z],
                [base.legs[i].knee.x, hipAlt[i][0], hipAlt[i][1]],
                hips[i],
                -80,
                80,
            ),
        ),
        ...[0, 1].map((i) =>
            make(
                `knee-${i}`,
                i ? "personKneeR" : "personKneeL",
                i ? "右膝" : "左膝",
                "#c792ea",
                [base.legs[i].knee.x, base.legs[i].knee.y, base.legs[i].knee.z],
                [base.legs[i].foot.x, base.legs[i].foot.y, base.legs[i].foot.z],
                [base.legs[i].foot.x, kneeAlt[i][0], kneeAlt[i][1]],
                knees[i],
                0,
                120,
            ),
        ),
    ]);
}
// 人物ギズモは関節ハンドルの集まり。C3は腰の高さにして、
// 移動用の軸矢印・回転リングは通常のギズモ側で描く。
function personGizmo(o) {
    const handles = personJointHandles(o);
    if (!handles.length) return null;
    return { o, C3: L2W(o, 0, 0, 0), handles: Object.fromEntries(handles.map((h) => [h.kind, h])) };
}
// 画面上で向きがつぶれたハンドルを、必ず動かせる向きへ直す。
// 真上から見たときの高さ方向のように「視線と平行な軸」は画面上の長さが0になり、
// dir が (0,0)・scale が 0 になって、ドラッグしても値が変わらない状態になる。
// 正投影（前・横・上）ではどの軸も同じ px/単位なので、画面の上向きと
// orthScale() を代わりに使えば、3Dビューと同じ感覚で増減できる。
function fixScreenHandleDir(h) {
    if (!h || typeof h !== "object") return;
    const dir = h.dir;
    if (!dir || !h.s || !h.s.ok) return;
    const len = Math.hypot(Number(dir.x) || 0, Number(dir.y) || 0);
    if (len > 0.15) return;
    const sc = Number(h.scale);
    h.dir = { x: 0, y: -1 }; // 画面の上向き＝値を増やす向き
    h.scale = orthView
        ? Math.max(1, orthScale())
        : Number.isFinite(sc) && sc > 1e-6 && sc < 1e6
          ? Math.max(6, sc)
          : 24;
    h.hiddenDir = true; // 描画側で「つぶれていた」ことを知りたいとき用
}
// sg の中にあるハンドル（handle / handles / pathHandles / opening.handles …）を
// まとめて走査する。今後ハンドルを増やしてもここを直せば済むようにしている。
function normalizeScreenHandles(sg) {
    if (!sg || typeof sg !== "object") return sg;
    const seen = new Set(),
        found = [],
        walk = (v, depth) => {
            if (!v || typeof v !== "object" || depth > 3 || seen.has(v)) return;
            seen.add(v);
            if (v.s && v.dir) {
                fixScreenHandleDir(v);
                found.push(v);
            }
            if (Array.isArray(v)) {
                v.forEach((q) => walk(q, depth + 1));
                return;
            }
            Object.keys(v).forEach((k) => {
                if (k === "o" || k === "bounds") return; // 図形データ自身は辿らない
                walk(v[k], depth + 1);
            });
        };
    walk(sg, 0);
    // 視線と平行な向きを持つハンドルどうしは、正投影すると画面上の同じ点に重なる
    // （真上ビューの腰と首、前ビューの看板の上下など）。重なったままだと
    // 手前の1つしか掴めないので、掴める間隔まで少しずつずらす。
    spreadOverlappingHandles(found, 26 / Z);
    return sg;
}
function specialGizmo(o) {
    const sg = o && o.type === "circ"
        ? circleGizmo(o)
        : o && o.type === "asset" && o.asset === "wallSideSign" && o.attachment?.wallSideSign
        ? wallSideSignSpecialGizmo(o)
        : o && o.type === "asset" && o.asset === "cornerCutBox"
          ? cornerCutGizmo(o)
          : o && o.type === "asset" && o.asset === "wallSign"
          ? wallSignGizmo(o)
          : o && o.type === "asset" && o.asset === "windowGrid"
          ? windowGridGizmo(o)
          : o && o.type === "asset" && o.asset === "beveledBox"
          ? beveledBoxGizmo(o)
          : o && o.type === "asset" && o.asset === "recessedStackedBuilding"
            ? recessedStackedGizmo(o)
            : o && o.type === "asset" && o.asset === "pathPipe"
              ? pathPipeGizmo(o)
              : isStackedBuildingAsset(o)
                ? stackedBuildingGizmo(o)
                : o && o.type === "asset" && o.asset === "building"
                  ? buildingGizmo(o)
                  : o && o.type === "asset" && o.asset === "awning"
                    ? awningGizmo(o)
                    : o && o.type === "asset" && o.asset === "balcony"
                      ? balconyGizmo(o)
                      : o && o.type === "asset" && o.asset === "uWall"
                        ? uWallGizmo(o)
                      : o && o.type === "asset" && o.asset === "railing"
                        ? railingGizmo(o)
                      : o && o.type === "asset" && o.asset === "stall"
                        ? stallGizmo(o)
                      : o && o.type === "asset" && o.asset === "stool"
                        ? stoolGizmo(o)
                      : o && o.type === "asset" && o.asset === "outdoorUnit"
                        ? outdoorUnitGizmo(o)
                      : isSignalAsset(o)
                        ? signalGizmo(o)
                      : isCounterAsset(o)
                        ? counterGizmo(o)
                    : o && o.type === "asset" && o.asset === "sign"
                      ? signGizmo(o)
                      : o && o.type === "asset" && o.asset === "cone"
                        ? coneGizmo(o)
                        : o && o.type === "asset" && o.asset === "sphere"
                          ? sphereGizmo(o)
                          : o && o.type === "asset" && o.asset === "person"
                            ? personGizmo(o)
                            : null;
    return normalizeScreenHandles(sg);
}
// ===== 室外機（ASSET_KIT の outdoorUnit）=====
// 形を決める値はここに1か所だけ置く。線画・面・ハンドルがすべてこの値を使うので、
// 幅を変えたときに「円だけ違う位置」になることがない。
function outdoorUnitGeometry(o) {
    const num = (v, dflt) => (Number.isFinite(Number(v)) && Number(v) !== 0 ? Number(v) : dflt),
        clampN = (v, lo, hi, dflt) => Math.max(lo, Math.min(hi, Number.isFinite(Number(v)) ? Number(v) : dflt)),
        W = Math.max(0.3, Math.abs(2 * num(o?.ra, 0.43))),
        D = Math.max(0.12, Math.abs(2 * num(o?.rb, 0.17))),
        H = Math.max(0.25, Math.abs(num(o?.h, 0.66))),
        legH = Math.max(0, Math.min(H * 0.45, clampN(o?.ouLegH, 0, H * 0.45, 0.12))),
        bodyH = Math.max(0.1, H - legH),
        bodyCz = legH + bodyH / 2,
        fanRatio = clampN(o?.ouFanRatio, 0.2, 0.95, 0.78),
        fanR = Math.max(0.04, (bodyH / 2) * fanRatio),
        // ファンの左右位置は「実寸（m）」。幅を変えても円の位置は動かない。
        // 動かせる範囲は、円が胴からはみ出さない所まで。
        limit = Math.max(0, W / 2 - fanR),
        fanX = Math.max(-limit, Math.min(limit, clampN(o?.ouFanX, -limit, limit, -0.1))),
        corner = Math.max(0.005, Math.min(W, H) * 0.12);
    return { W, D, H, legH, bodyH, bodyCz, fanR, fanX, limit, corner };
}
// 室外機の専用ハンドル：前面の丸いファンを左右にだけ動かす。
function outdoorUnitGizmo(o) {
    if (!o || o.type !== "asset" || o.asset !== "outdoorUnit") return null;
    const g = outdoorUnitGeometry(o),
        front = -g.D / 2 - 0.02,
        // ハンドルは円のすぐ外（右）に置き、右へ引くと円が右へ動く（上下には動かない）。
        fanHandle = screenHandle(
            o,
            "outdoor-fan-x",
            [g.fanX, front, g.bodyCz],
            [g.fanX + g.fanR + 0.05, front, g.bodyCz],
            [g.fanX + g.fanR + 1.05, front, g.bodyCz], // 1m ぶん離して、ドラッグ量を 1:1 にする
            g.fanX,
            -g.limit,
            g.limit,
            "ファンの左右",
            { x: 1, y: 0 },
            "#7dd8ff",
        );
    return { o, C3: L2W(o, 0, 0, g.bodyCz), handles: { fanX: fanHandle } };
}

// ===== 信号機・標識（ポールもの）=====
// 4種（車両用信号機・歩行者用信号機・丸標識・踏切標識）は、どれも
// 「台座＋ポール＋頭（信号機／標識板）」という同じ骨格。違うのは頭の寸法だけ。
// ポールの長さはアセットの高さ h そのもの（＝頭の上端）なので、
// 画面の上下ハンドルでも、専用の「ポール」ハンドルでも同じ値が動く。
const SIGNAL_HEADS = {
    trafficSignal: { w: 1.05, h: 0.34, d: 0.24 }, // 車両用：横3灯
    pedSignal: { w: 0.36, h: 0.66, d: 0.22 }, // 歩行者用：縦2灯
    signPost: { w: 0.42, h: 0.42, d: 0.06 }, // 丸標識（地下鉄風）
    crossingSign: { w: 0.5, h: 0.46, d: 0.1 }, // 踏切のX標識
};
const isSignalAsset = (o) => !!o && o.type === "asset" && Object.prototype.hasOwnProperty.call(SIGNAL_HEADS, o.asset);
function signalGeometry(o) {
    const dflt = SIGNAL_HEADS[o?.asset] || SIGNAL_HEADS.trafficSignal,
        num = (v, f) => (Number.isFinite(Number(v)) && Number(v) !== 0 ? Math.abs(Number(v)) : f),
        H = Math.max(0.8, num(o?.h, 2.6)),
        // 頭の幅・奥行きは、ほかのアセットと同じく左右／前後の面ハンドルで変えられる。
        headW = Math.max(0.12, num(o?.ra, dflt.w / 2) * 2),
        headD = Math.max(0.03, num(o?.rb, dflt.d / 2) * 2),
        headH = Math.max(0.12, Math.min(H - 0.25, num(o?.spHeadH, dflt.h))),
        headBottom = H - headH,
        poleR = Math.max(0.008, num(o?.spPoleR, 0.042)),
        baseR = Math.max(poleR * 2, num(o?.spBaseR, 0.16)),
        baseH = Math.min(headBottom * 0.5, num(o?.spBaseH, 0.16));
    return {
        H,
        headW,
        headH,
        headD,
        headBottom,
        headCz: headBottom + headH / 2,
        poleR,
        baseR,
        baseH,
        // 「ポール」ハンドルは頭の横（頭の幅の外）に出す。ポールと重ならない位置。
        knobX: Math.max(headW / 2, baseR) + 0.12,
    };
}
// 信号機・標識の専用ハンドル：ポールの高さ（＝アセットの高さ）を上下に動かす。
function signalGizmo(o) {
    if (!isSignalAsset(o)) return null;
    const g = signalGeometry(o),
        poleHandle = screenHandle(
            o,
            "signal-pole-h",
            [0, 0, g.headBottom], // 支点はポールの上端
            [g.knobX, 0, g.headBottom], // ノブは頭の横
            [g.knobX, 0, g.headBottom + 1], // 1m 上を向きの基準に（ドラッグ 1:1）
            g.H,
            0.9,
            6,
            "ポール",
            { x: 0, y: -1 },
            "#8ce6c2",
        ),
        // 頭（灯器・標識板）の幅と奥行き。左右／前後の面ハンドルでも変えられるが、
        // 数値の目安が読めるよう、専用のハンドルも出す。
        headW = screenHandle(
            o,
            "signal-head-w",
            [g.headW / 2, 0, g.headCz], // 頭の右端から、右へ
            [g.headW / 2, 0, g.headCz],
            [g.headW / 2 + 1, 0, g.headCz],
            g.headW,
            0.15,
            4,
            "頭の幅",
            { x: 1, y: 0 },
            "#ffb36f",
        ),
        headD = screenHandle(
            o,
            "signal-head-d",
            [0, -g.headD / 2, g.headCz], // 頭の手前の面から、手前へ
            [0, -g.headD / 2, g.headCz],
            [0, -g.headD / 2 - 1, g.headCz],
            g.headD,
            0.03,
            2,
            "奥行き",
            { x: 0, y: 1 },
            "#ffd34d",
        );
    return { o, C3: L2W(o, 0, 0, g.H * 0.5), handles: { poleH: poleHandle, headW, headD } };
}

// ===== カウンター（テーブル天板が薄く、下の土台がどっしりしたもの）=====
// 「普通／L字／コの字」の3種は、どれも同じ作り（薄い天板＋内側へ引いた土台）。
// 形の違いは「足元の輪郭（footprint）」だけなので、天板の多角形を1か所で作り、
// 土台はその多角形を内側へ縮めて作る（K.insetPath）。
const COUNTER_SHAPES = { counter: "straight", counterL: "l", counterU: "u" };
const isCounterAsset = (o) => !!o && o.type === "asset" && Object.prototype.hasOwnProperty.call(COUNTER_SHAPES, o.asset);
function counterGeometry(o) {
    // 数値は o → ASSETS の初期値 → 決め打ち、の順に見る（キットの K.param と同じ規則）。
    const meta = (key, dflt) => {
            const v = Number(o?.[key]);
            if (Number.isFinite(v) && v !== 0) return Math.abs(v);
            const m = Number(ASSETS?.[o?.asset]?.[key]);
            return Number.isFinite(m) && m !== 0 ? Math.abs(m) : dflt;
        },
        W = Math.max(0.3, Math.abs(2 * (Number(o?.ra) || 1))),
        D = Math.max(0.16, Math.abs(2 * (Number(o?.rb) || 0.3))),
        H = Math.max(0.3, Math.abs(Number(o?.h) || 1)),
        // 天板の厚さは「高さの4割」まで。土台が消えないようにする。
        topT = Math.max(0.008, Math.min(H * 0.4, meta("ctTopT", 0.06))),
        baseH = Math.max(0.05, H - topT),
        // L字・コの字の腕の幅。幅・奥行きのどちらも 62% を超えると、
        // 腕が反対側まで届いて「L」「コ」の形が壊れる（凹みが消える）。
        // 横長・縦長に極端に伸ばしても形が保たれるよう、ここで頭打ちにする。
        arm = Math.max(0.08, Math.min(Math.min(W, D) * 0.62, meta("ctArm", 0.55))),
        // 天板の張り出し（土台をこれだけ内側へ引く）
        overhang = Math.max(0, Math.min(arm * 0.3, meta("ctOverhang", 0.06)));
    return { shape: COUNTER_SHAPES[o?.asset] || "straight", W, D, H, topT, baseH, arm, overhang };
}
// 天板の輪郭（奥行き方向は y）。反時計回りで返す。
function counterFootprint(o) {
    const g = counterGeometry(o),
        hw = g.W / 2,
        hd = g.D / 2,
        arm = g.arm,
        foot =
            g.shape === "l"
                ? [
                      [-hw, -hd],
                      [hw, -hd],
                      [hw, -hd + arm],
                      [-hw + arm, -hd + arm],
                      [-hw + arm, hd],
                      [-hw, hd],
                  ]
                : g.shape === "u"
                  ? [
                        [-hw, -hd],
                        [hw, -hd],
                        [hw, hd],
                        [hw - arm, hd],
                        [hw - arm, -hd + arm],
                        [-hw + arm, -hd + arm],
                        [-hw + arm, hd],
                        [-hw, hd],
                    ]
                  : [
                        [-hw, -hd],
                        [hw, -hd],
                        [hw, hd],
                        [-hw, hd],
                    ];
    return { ...g, foot };
}
// カウンターの画面ハンドル：長さ／天板の厚さ／土台の高さ。
function counterGizmo(o) {
    if (!isCounterAsset(o)) return null;
    const g = counterGeometry(o),
        hw = g.W / 2,
        hd = g.D / 2,
        length = screenHandle(
            o,
            "counter-length",
            [hw, 0, g.H], // 右端の上の角から、右へ
            [hw, 0, g.H],
            [hw + 1, 0, g.H],
            g.W,
            0.4,
            8,
            "幅",
            { x: 1, y: 0 },
            "#ffb36f",
        ),
        // 天板の厚さは 6cm 程度と小さい。1m の物差しで測ると 1px で 2cm 以上動いて
        // しまうので、倍率を 3.5 倍にして「ゆっくり」動かせるようにする。
        topT = screenHandle(
            o,
            "counter-top-t",
            [hw, -hd, g.H],
            [hw, -hd, g.H],
            [hw, -hd, g.H + 1],
            g.topT,
            0.012,
            0.3,
            "天板の厚さ",
            { x: 0, y: -1 },
            "#7dd8ff",
        ),
        depth = screenHandle(
            o,
            "counter-depth",
            [0, -hd, g.H], // 手前の縁の真ん中から、手前へ
            [0, -hd, g.H],
            [0, -hd - 1, g.H],
            g.D,
            0.2,
            6,
            "奥行き",
            { x: 0, y: 1 },
            "#ffd34d",
        ),
        baseH = screenHandle(
            o,
            "counter-base-h",
            [-hw, -hd, 0],
            [-hw, -hd, 0],
            [-hw, -hd, 1],
            g.baseH,
            0.3,
            3,
            "土台の高さ",
            { x: 0, y: -1 },
            "#8ce6c2",
        );
    const zScale = Math.max(60, topT.scale); // 画面の上下 1m の長さ（px）
    topT.scale = zScale * 3.5;
    // L字・コの字だけ：腕の太さ（コの字の棒の太さ）。
    // 手前の縁から内側の縁までを破線で示し、内側の縁の四角を前後へ動かして太さを変える。
    // 奥行きハンドル（x=0）と重ならないよう、少し右へずらした位置に置く。
    const handles = { length, depth, topT, baseH };
    if (g.shape !== "straight") {
        const ax = Math.min(hw * 0.5, Math.max(0, hw - g.arm - 0.05));
        handles.arm = screenHandle(
            o,
            "counter-arm",
            [ax, -hd, g.H], // 手前の縁から
            [ax, -hd + g.arm, g.H], // 内側の縁（ここを掴む）
            [ax, -hd + g.arm + 1, g.H], // 1m 奥を向きの基準に（ドラッグ 1:1）
            g.arm,
            0.08,
            Math.max(0.1, Math.min(g.W, g.D) * 0.62),
            "腕の太さ",
            { x: 0, y: -1 },
            "#c9a97a",
        );
        // 太さは 5cm 程度の値なので、画面の上下方向へ「ゆっくり」動かす。
        // 奥行き（+y）方向の投影は、見下ろしが浅いビューでほぼ潰れて
        // 数十 px 動かしても 2cm しか変わらないため、掴む向きは上下に固定する。
        handles.arm.dir = { x: 0, y: -1 };
        handles.arm.scale = zScale * 2;
    }
    return { o, C3: L2W(o, 0, 0, g.H * 0.5), handles };
}

// ===== 画面上のラベル（白い用紙でも読める共通表示） =====
// 以前はハンドルの名前と数値を、ハンドルと同じ明るい色（#fff0b0 / #ffd0a8 など）で
// そのまま描いていた。背景が白い用紙になった今、その色はほぼ背景に溶けて読めない。
// Blender のビューポートと同じ考え方で、ラベルは「白いチップ＋濃い文字」にし、
// ハンドルの色はチップの枠と左端の細い帯で示す（色の対応は保ったまま読める）。
// さらに、置いたチップの矩形を1フレーム分だけ覚えておき、重なるときは上へ逃がす。
// 屋台の「屋根箱の高さ」と「壁の厚さ」のように、近い値のラベルが重なって
// 読めなくなっていたのを防ぐため。
let gzLabelRects = [];
const GZ_LABEL_INK = "#1f2933";
// 明るい色は白い用紙に溶けるので、枠に使う色だけ暗くしてから使う。
function gzLabelTone(color) {
    const m = /^#([0-9a-f]{6})$/i.exec(String(color || ""));
    if (!m) return "#54636f";
    const n = parseInt(m[1], 16),
        r = (n >> 16) & 255,
        g = (n >> 8) & 255,
        b = n & 255,
        k = Math.min(1, 168 / (Math.max(r, g, b) || 1)),
        h = (v) => Math.round(v * k).toString(16).padStart(2, "0");
    return `#${h(r)}${h(g)}${h(b)}`;
}
// 1フレーム分のラベル位置を捨てる（render() の先頭で呼ぶ）。
function gzLabelReset() {
    gzLabelRects = [];
}
// 角丸の四角をパスとして作る（半径は短辺の半分まで）。
function gzRoundRect(c, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + rr, y);
    c.lineTo(x + w - rr, y);
    c.arcTo(x + w, y, x + w, y + rr, rr);
    c.lineTo(x + w, y + h - rr);
    c.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    c.lineTo(x + rr, y + h);
    c.arcTo(x, y + h, x, y + h - rr, rr);
    c.lineTo(x, y + rr);
    c.arcTo(x, y, x + rr, y, rr);
    c.closePath();
}
// 文字の基準点 (x, y) は「これまで通り、掴む四角の右上あたり」。
// 引数の font は画面上のピクセル数（内部で Z で割る）。
function gzLabel(c, text, x, y, color, font) {
    const str = `${text ?? ""}`;
    if (!str) return;
    const size = Math.max(9, Number(font) || 12),
        f = size / Z,
        padX = 4.5 / Z,
        padY = 2.6 / Z,
        bar = 2.4 / Z,
        tone = gzLabelTone(color);
    c.save();
    c.setLineDash([]);
    c.font = `bold ${f}px system-ui`;
    c.textBaseline = "middle";
    c.textAlign = "left";
    const tw = c.measureText(str).width,
        w = tw + padX * 2 + bar,
        h = f + padY * 2;
    // 文字の中心が (y - f * 0.68) あたりに来るように置き、重なると上へ逃がす。
    let rect = { x, y: y - f * 1.18, w, h };
    // 重なり判定はデバイスpxで行う。呼び出し側の描画変換は場所によって
    // ズーム付き（Z, ox, oy）だったり素のpxだったりするため、そのままの座標で
    // 比べると別の変換どうしのラベルを見落とす（間取りの「上端」など）。
    const m = typeof c.getTransform === "function" ? c.getTransform() : null,
        sx = m && m.a ? m.a : 1,
        sy = m && m.d ? m.d : 1,
        toPx = (r) => ({ x: r.x * sx + (m ? m.e : 0), y: r.y * sy + (m ? m.f : 0), w: r.w * sx, h: r.h * sy }),
        hits = (r) => {
            const a = toPx(r);
            return gzLabelRects.some(
                (b) => !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y),
            );
        };
    for (let i = 0; i < 16 && hits(rect); i++) rect = { ...rect, y: rect.y - h - 2 / Z };
    for (let i = 0; i < 16 && hits(rect); i++) rect = { ...rect, y: rect.y + (h + 2 / Z) * (i + 2) };
    // それでも空きが無いときは右へ逃がす（同じ場所に何本も集まるアセット用）。
    for (let i = 0; i < 4 && hits(rect); i++) rect = { ...rect, x: rect.x + w + 3 / Z };
    gzLabelRects.push(toPx(rect));
    // 白いチップ（下に少し影を落として、線の上でも読めるようにする）
    c.shadowColor = "rgba(16,32,39,.28)";
    c.shadowBlur = 3 / Z;
    c.shadowOffsetY = 1 / Z;
    c.fillStyle = "rgba(255,255,255,.95)";
    gzRoundRect(c, rect.x, rect.y, rect.w, rect.h, 3.5 / Z);
    c.fill();
    c.shadowColor = "transparent";
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
    c.strokeStyle = tone;
    c.lineWidth = 1 / Z;
    c.stroke();
    // 左端の色帯（ハンドルの色との対応）
    c.fillStyle = tone;
    gzRoundRect(c, rect.x + 0.9 / Z, rect.y + 1.2 / Z, bar, rect.h - 2.4 / Z, bar / 2);
    c.fill();
    c.fillStyle = GZ_LABEL_INK;
    c.fillText(str, rect.x + bar + padX, rect.y + rect.h / 2);
    c.restore();
}
function drawSpecialGizmo(c, o) {
    const sg = specialGizmo(o);
    if (!sg) return;
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";
    const sq = (q, col, diamond = false) => {
        if (!q || !q.ok) return;
        c.fillStyle = col;
        c.strokeStyle = "#102027";
        c.lineWidth = 1.4 / Z;
        c.beginPath();
        if (diamond) {
            c.moveTo(q.x, q.y - 7 / Z);
            c.lineTo(q.x + 7 / Z, q.y);
            c.lineTo(q.x, q.y + 7 / Z);
            c.lineTo(q.x - 7 / Z, q.y);
        } else c.rect(q.x - 6 / Z, q.y - 6 / Z, 12 / Z, 12 / Z);
        c.closePath();
        c.fill();
        c.stroke();
    };
    // アセット専用ハンドルの共通表示：支点から破線 → ひし形（or 四角）→ 数値ラベル。
    // 以前は同じ描画をアセットごとに書き写していた（見た目の微差も発生していた）。
    const valueHandle = (h, opt = {}) => {
        if (!h || !h.s || !h.s.ok) return;
        const color = opt.color || h.color || "#ff9f68",
            label = opt.label !== undefined ? opt.label : h.label || "",
            dash = opt.dash || [5, 4],
            width = opt.width || 1.5,
            font = opt.font || 12,
            textColor = opt.textColor || "#fff0b0",
            gap = font > 11 ? 9 : 8;
        if (h.anchor && h.anchor.ok) {
            c.setLineDash([dash[0] / Z, dash[1] / Z]);
            c.strokeStyle = color;
            c.lineWidth = width / Z;
            c.beginPath();
            c.moveTo(h.anchor.x, h.anchor.y);
            c.lineTo(h.s.x, h.s.y);
            c.stroke();
            c.setLineDash([]);
        }
        sq(h.s, color, opt.diamond !== false);
        if (!label) return;
        gzLabel(c, label, h.s.x + gap / Z, h.s.y - (gap - 1) / Z, color, font);
    };
    if (sg.o.asset === "wallSideSign") {
        valueHandle(sg.bracketHandle, { color: "#ffd34d", label: `金具 ${Number(sg.bracketHandle?.start || 0).toFixed(2)}m`, diamond: false, textColor: "#fff0a8" });
        valueHandle(sg.handle, { color: "#ff9f68", label: `ベベル ${Number(sg.handle?.start || 0).toFixed(2)}`, textColor: "#ffd0a8" });
    } else if (sg.o.asset === "cornerCutBox") {
        valueHandle(sg.handle, {
            color: "#e24b4b",
            label: `隅切り ${Number(sg.handle?.start || 0).toFixed(2)}m`,
            textColor: "#ffd0d0",
        });
        Object.values(sg.opening?.handles || {}).forEach((handle) =>
            valueHandle(handle, {
                dash: [4, 3],
                width: 1.4,
                font: 11,
                label: `${handle.label} ${Number(handle.start || 0).toFixed(2)}m`,
            }),
        );
    } else if (sg.o.asset === "wallSign" || sg.o.asset === "windowGrid") {
        // 壁付け看板（金具の長さ・ベベル幅）と窓グリッド（窓の幅・高さ）は、
        // 同じ見た目（破線＋菱形）のハンドルをまとめて描く。
        Object.values(sg.handles || {}).forEach((handle) =>
            valueHandle(handle, { label: `${handle.label} ${Number(handle.start || 0).toFixed(2)}m` }),
        );
    } else if (sg.o.asset === "person") {
        // 関節ハンドル：支点からハンドルへ破線を引き、丸いノブと角度を描く。
        Object.values(sg.handles || {}).forEach((handle) => {
            if (!handle?.s?.ok) return;
            if (handle.anchor?.ok) {
                c.setLineDash([4 / Z, 3 / Z]);
                c.strokeStyle = handle.color;
                c.lineWidth = 1.3 / Z;
                c.beginPath();
                c.moveTo(handle.anchor.x, handle.anchor.y);
                c.lineTo(handle.s.x, handle.s.y);
                c.stroke();
                c.setLineDash([]);
            }
            c.fillStyle = handle.color;
            c.strokeStyle = "#102027";
            c.lineWidth = 1.5 / Z;
            c.beginPath();
            c.arc(handle.s.x, handle.s.y, 6.5 / Z, 0, Math.PI * 2);
            c.fill();
            c.stroke();
            // 回転方向が分かるよう、ノブから接線方向へ小さな矢じりを添える。
            const d = handle.dir || { x: 1, y: 0 },
                ax = handle.s.x + d.x * 11 / Z,
                ay = handle.s.y + d.y * 11 / Z;
            c.beginPath();
            c.moveTo(ax + d.x * 5 / Z - d.y * 3.5 / Z, ay + d.y * 5 / Z + d.x * 3.5 / Z);
            c.lineTo(ax, ay);
            c.lineTo(ax + d.x * 5 / Z + d.y * 3.5 / Z, ay + d.y * 5 / Z - d.x * 3.5 / Z);
            c.stroke();
            gzLabel(c, `${handle.label} ${Math.round(Number(handle.start) || 0)}°`, handle.s.x + 9 / Z, handle.s.y - 8 / Z, "#fff0b0", 11);
        });
    } else if (sg.o.asset === "beveledBox") {
        valueHandle(sg.handle, {
            color: "#ff9f68",
            label: `ベベル ${Number(sg.handle?.start || 0).toFixed(2)}`,
            textColor: "#ffd0a8",
        });
    } else if (sg.o.asset === "recessedStackedBuilding") {
        const drawFrame = (frame, color) => {
            if (!frame?.every((q) => q && q.ok)) return;
            c.strokeStyle = color;
            c.lineWidth = 1.25 / Z;
            c.beginPath();
            frame.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
            c.closePath();
            c.stroke();
        };
        drawFrame(sg.frame, "#8aaeb5");
        drawFrame(sg.backFrame, "#42616b");
        Object.values(sg.handles || {}).forEach((handle) =>
            valueHandle(handle, {
                dash: [4, 3],
                width: 1.4,
                font: 11,
                label: `${handle.label} ${
                    handle.kind === "recessed-window-count"
                        ? `${Math.round(handle.start)}枚`
                        : `${Number(handle.start || 0).toFixed(2)}m`
                }`,
            }),
        );
    } else if (sg.o.asset === "pathPipe") {
        const h = sg.radiusHandle;
        c.setLineDash([5 / Z, 4 / Z]);
        c.strokeStyle = "rgba(255,159,104,.9)";
        c.lineWidth = 1.2 / Z;
        if (sg.controlPoints.length > 1) {
            c.beginPath();
            sg.controlPoints.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
            c.stroke();
        }
        sg.pathHandles.forEach((handle) => {
            if (!handle.s?.ok || !handle.anchor?.ok) return;
            c.strokeStyle = handle.color;
            c.beginPath();
            c.moveTo(handle.anchor.x, handle.anchor.y);
            c.lineTo(handle.s.x, handle.s.y);
            c.stroke();
            sq(handle.s, handle.color, true);
        });
        c.setLineDash([]);
        sg.controlPoints.forEach((q) => {
            if (!q?.ok) return;
            c.fillStyle = "#fff";
            c.strokeStyle = "#ff9f68";
            c.lineWidth = 1.5 / Z;
            c.beginPath();
            c.arc(q.x, q.y, 5 / Z, 0, Math.PI * 2);
            c.fill();
            c.stroke();
        });
        valueHandle(h, { color: "#ff9f68", label: "半径", dash: [4, 3], textColor: "#ffd0a8" });
    } else if (isStackedBuildingAsset(sg.o)) {
        const h = sg.handles,
            usable = Object.values(h).filter((handle) => Math.hypot(handle.dir.x, handle.dir.y) > 0.15);
        c.setLineDash([5 / Z, 4 / Z]);
        c.strokeStyle = "rgba(255,179,111,.9)";
        c.lineWidth = 1.4 / Z;
        if (sg.frame && sg.frame.every((q) => q && q.ok)) {
            c.beginPath();
            sg.frame.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
            c.closePath();
            c.stroke();
        }
        usable.forEach((handle) => {
            c.beginPath();
            c.moveTo(sg.center.x, sg.center.y);
            c.lineTo(handle.s.x, handle.s.y);
            c.stroke();
        });
        c.setLineDash([]);
        usable.forEach((handle) => sq(handle.s, "#ffb36f", handle.kind === "stacked-height"));
        gzLabel(c, `${sg.floorIndex + 1}F 幅/奥行/高さ`, sg.center.x + 8 / Z, sg.center.y - 8 / Z, "#ffd0a8", 12);
        const opening = sg.opening;
        if (opening) {
            const drawFrame = (frame, color = "#8ce6c2") => {
                if (!frame?.every((q) => q && q.ok)) return;
                c.strokeStyle = color;
                c.lineWidth = 1.25 / Z;
                c.beginPath();
                frame.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
                c.closePath();
                c.stroke();
            };
            drawFrame(opening.front.frame, "#8ce6c2");
            drawFrame(opening.panelFrame, "#ffd37a");
            c.strokeStyle = "#8ce6c2";
            c.beginPath();
            [opening.handles.left, opening.handles.right, opening.handles.height].forEach((h) => {
                if (h?.s?.ok) {
                    c.moveTo(opening.front.center.x, opening.front.center.y);
                    c.lineTo(h.s.x, h.s.y);
                }
            });
            c.stroke();
            [opening.handles.left, opening.handles.right, opening.handles.height].forEach((h) => sq(h.s, "#8ce6c2"));
            if (opening.handles.backFace?.s?.ok) {
                c.strokeStyle = "#ffd37a";
                c.beginPath();
                c.moveTo(opening.panelCenter.x, opening.panelCenter.y);
                c.lineTo(opening.handles.backFace.s.x, opening.handles.backFace.s.y);
                c.stroke();
                sq(opening.handles.backFace.s, "#ffd37a", true);
            }
            gzLabel(c, "1F 開口 W/H", opening.front.center.x + 8 / Z, opening.front.center.y - 8 / Z, "#d8fff0", 12);
        }
        if (sg.bevelHandle?.s?.ok && sg.bevelHandle?.anchor?.ok) {
            const bh = sg.bevelHandle;
            c.setLineDash([4 / Z, 3 / Z]);
            c.strokeStyle = "#ff9f68";
            c.beginPath();
            c.moveTo(bh.anchor.x, bh.anchor.y);
            c.lineTo(bh.s.x, bh.s.y);
            c.stroke();
            c.setLineDash([]);
            sq(bh.s, "#ff9f68", true);
            gzLabel(c, `ベベル ${Number(bh.start || 0).toFixed(2)}`, bh.s.x + 9 / Z, bh.s.y - 8 / Z, "#ffd0a8", 12);
        }
    } else if (sg.o.asset === "building") {
        const h = sg.handles,
            front = ["frontOpeningWLeft", "frontOpeningWRight", "frontOpeningH"],
            back = ["backOpeningWLeft", "backOpeningWRight", "backOpeningH"];
        c.setLineDash([5 / Z, 4 / Z]);
        c.lineWidth = 1.2 / Z;
        [
            ["front", front, sg.frame, sg.center, "#8ce6c2"],
            ["back", back, sg.backFrame, sg.backCenter, "#ffd37a"],
        ].forEach(([label, keys, frame, center, col]) => {
            if (frame && frame.every((q) => q && q.ok)) {
                c.strokeStyle = col;
                c.beginPath();
                frame.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
                c.stroke();
            }
            c.strokeStyle = col;
            c.beginPath();
            keys.forEach((k) => {
                c.moveTo(center.x, center.y);
                c.lineTo(h[k].s.x, h[k].s.y);
            });
            c.stroke();
            keys.forEach((k) => sq(h[k].s, col));
            gzLabel(c, label === "front" ? "開口W/H" : "奥の開口", h[keys[1]].s.x + 8 / Z, h[keys[1]].s.y - 7 / Z, col, 12);
        });
        if (sg.panelFrame && sg.panelFrame.every((q) => q && q.ok)) {
            c.fillStyle = "rgba(255,179,111,.18)";
            c.strokeStyle = "#ffb36f";
            c.lineWidth = 1.8 / Z;
            c.beginPath();
            sg.panelFrame.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
            c.closePath();
            c.fill();
            c.stroke();
            c.strokeStyle = "rgba(255,179,111,.82)";
            c.setLineDash([3 / Z, 3 / Z]);
            c.beginPath();
            c.moveTo(sg.panelCenter.x, sg.panelCenter.y);
            c.lineTo(h.backFace.s.x, h.backFace.s.y);
            c.stroke();
            c.setLineDash([]);
            sq(h.backFace.s, "#ffb36f", true);
            gzLabel(c, "奥の面", h.backFace.s.x + 9 / Z, h.backFace.s.y - 8 / Z, "#ffd0a8", 12);
        }
        c.setLineDash([]);
    } else if (sg.o.asset === "awning") {
        const hz = sg.handles.edgeZ;
        c.setLineDash([5 / Z, 4 / Z]);
        c.strokeStyle = "rgba(255,179,111,.9)";
        c.lineWidth = 1.5 / Z;
        if (sg.frame && sg.frame.every((q) => q && q.ok)) {
            c.beginPath();
            sg.frame.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
            c.closePath();
            c.stroke();
        }
        c.setLineDash([]);
        // テントのハンドルは菱形1つ（前縁Y）。上下と手前奥の両方へ動く。
        sq(hz.s, "#ffb36f", true);
        gzLabel(c, "前縁Y", hz.s.x + 9 / Z, hz.s.y - 8 / Z, "#ffd0a8", 12);
    } else if (sg.o.asset === "balcony" || sg.o.asset === "uWall") {
        // 厚さの四角を1つだけ描く。掴む四角から寸法の向きへ破線を引き、
        // 現在値を添えて、何を動かしているかが分かるようにする。
        const h = sg.handles.thickness;
        if (h?.s?.ok) {
            c.strokeStyle = h.color || "#ff9f68";
            c.lineWidth = 1.4 / Z;
            c.setLineDash([5 / Z, 4 / Z]);
            c.beginPath();
            if (h.anchor?.ok) {
                c.moveTo(h.anchor.x, h.anchor.y);
                c.lineTo(h.s.x, h.s.y);
            }
            c.stroke();
            c.setLineDash([]);
            sq(h.s, h.color || "#ff9f68");
            gzLabel(c, `${h.label} ${Number(h.start || 0).toFixed(2)}`, h.s.x + 9 / Z, h.s.y - 8 / Z, h.color || "#ff9f68", 12);
        }
    } else if (isCounterAsset(sg.o)) {
        // 長さ（左右）／天板の厚さ（上下・ゆっくり）／土台の高さ（上下）の3本。
        Object.values(sg.handles || {}).forEach((h) => {
            if (!h?.s?.ok) return;
            const col = h.color || "#ffb36f",
                d = h.dir || { x: 1, y: 0 };
            c.strokeStyle = col;
            c.lineWidth = 1.4 / Z;
            c.setLineDash([5 / Z, 4 / Z]);
            c.beginPath();
            if (h.anchor?.ok) {
                c.moveTo(h.anchor.x, h.anchor.y);
                c.lineTo(h.s.x, h.s.y);
            }
            c.stroke();
            c.setLineDash([]);
            sq(h.s, col, false);
            // 動く向き（左右または上下）へ小さな矢じりを2つ
            c.beginPath();
            [1, -1].forEach((sgn) => {
                const ax = h.s.x + d.x * sgn * 13 / Z,
                    ay = h.s.y + d.y * sgn * 13 / Z;
                c.moveTo(ax, ay);
                c.lineTo(ax - d.x * 6 / Z - d.y * 4 / Z, ay - d.y * 6 / Z + d.x * 4 / Z);
                c.lineTo(ax - d.x * 6 / Z + d.y * 4 / Z, ay - d.y * 6 / Z - d.x * 4 / Z);
                c.closePath();
            });
            c.fillStyle = col;
            c.fill();
            gzLabel(c, `${h.label} ${Number(h.start || 0).toFixed(2)}m`, h.s.x + 16 / Z, h.s.y - 8 / Z, col, 12);
        });
    } else if (isSignalAsset(sg.o)) {
        // ポールの高さ（上下）／頭の幅（左右）／奥行き（前後）の3本。
        // どれも「動く向き」へ矢じりを2つ付けて、掴む前に向きが分かるようにする。
        Object.values(sg.handles || {}).forEach((h) => {
            if (!h?.s?.ok) return;
            const col = h.color || "#8ce6c2",
                d = h.dir || { x: 0, y: -1 };
            c.strokeStyle = col;
            c.lineWidth = 1.4 / Z;
            c.setLineDash([5 / Z, 4 / Z]);
            c.beginPath();
            if (h.anchor?.ok) {
                c.moveTo(h.anchor.x, h.anchor.y);
                c.lineTo(h.s.x, h.s.y);
            }
            c.stroke();
            c.setLineDash([]);
            sq(h.s, col, false);
            c.beginPath();
            [1, -1].forEach((sgn) => {
                const ax = h.s.x + d.x * sgn * 13 / Z,
                    ay = h.s.y + d.y * sgn * 13 / Z;
                c.moveTo(ax, ay);
                c.lineTo(ax - d.x * 6 / Z - d.y * 4 / Z, ay - d.y * 6 / Z + d.x * 4 / Z);
                c.lineTo(ax - d.x * 6 / Z + d.y * 4 / Z, ay - d.y * 6 / Z - d.x * 4 / Z);
                c.closePath();
            });
            c.fillStyle = col;
            c.fill();
            gzLabel(c, `${h.label} ${Number(h.start || 0).toFixed(2)}m`, h.s.x + 16 / Z, h.s.y - 8 / Z, col, 12);
        });
    } else if (sg.o.asset === "outdoorUnit") {
        // ファンの左右位置ハンドル1本。左右の矢印で「横にだけ動く」ことを示す。
        const h = sg.handles?.fanX;
        if (h?.s?.ok) {
            const col = h.color || "#7dd8ff";
            c.strokeStyle = col;
            c.lineWidth = 1.4 / Z;
            c.setLineDash([5 / Z, 4 / Z]);
            c.beginPath();
            if (h.anchor?.ok) {
                c.moveTo(h.anchor.x, h.anchor.y);
                c.lineTo(h.s.x, h.s.y);
            }
            c.stroke();
            c.setLineDash([]);
            sq(h.s, col, false);
            // 左右の矢じり
            c.beginPath();
            c.moveTo(h.s.x - 13 / Z, h.s.y);
            c.lineTo(h.s.x - 7 / Z, h.s.y - 4 / Z);
            c.lineTo(h.s.x - 7 / Z, h.s.y + 4 / Z);
            c.closePath();
            c.moveTo(h.s.x + 13 / Z, h.s.y);
            c.lineTo(h.s.x + 7 / Z, h.s.y - 4 / Z);
            c.lineTo(h.s.x + 7 / Z, h.s.y + 4 / Z);
            c.closePath();
            c.fillStyle = col;
            c.fill();
            gzLabel(c, `${h.label} ${Number(h.start || 0).toFixed(2)}m`, h.s.x + 16 / Z, h.s.y - 8 / Z, col, 12);
        }
    } else if (sg.o.asset === "stool") {
        // 半径（外向き）と高さ（上下）の6本を同じ見た目で描く。
        Object.values(sg.handles).forEach((h) => {
            if (!h?.s?.ok) return;
            const col = h.color || "#ad9cff";
            c.strokeStyle = col;
            c.lineWidth = 1.3 / Z;
            c.setLineDash([5 / Z, 4 / Z]);
            c.beginPath();
            if (h.anchor?.ok) {
                c.moveTo(h.anchor.x, h.anchor.y);
                c.lineTo(h.s.x, h.s.y);
            }
            c.stroke();
            c.setLineDash([]);
            sq(h.s, col);
            gzLabel(c, `${h.label} ${Number(h.start || 0).toFixed(2)}`, h.s.x + 8 / Z, h.s.y - 7 / Z, col, 12);
        });
    } else if (sg.o.type === "circ") {
        // 半径の四角1つ。中心から破線を引き、現在値を添える。
        const hd = sg.handles.radius;
        if (hd?.s?.ok) {
            const col = hd.color || "#ad9cff";
            c.strokeStyle = col;
            c.lineWidth = 1.4 / Z;
            c.setLineDash([5 / Z, 4 / Z]);
            c.beginPath();
            if (hd.anchor?.ok) {
                c.moveTo(hd.anchor.x, hd.anchor.y);
                c.lineTo(hd.s.x, hd.s.y);
            }
            c.stroke();
            c.setLineDash([]);
            sq(hd.s, col);
            gzLabel(c, `半径 ${Number(hd.start || 0).toFixed(2)}`, hd.s.x + 9 / Z, hd.s.y - 8 / Z, col, 12);
        }
    } else if (sg.o.asset === "railing") {
        // 角材の太さ・下の横桟の高さの2本。掴む四角から破線を引き、現在値を添える。
        Object.values(sg.handles).forEach((h) => {
            if (!h?.s?.ok) return;
            const col = h.color || "#ff9f68";
            c.strokeStyle = col;
            c.lineWidth = 1.4 / Z;
            c.setLineDash([5 / Z, 4 / Z]);
            c.beginPath();
            if (h.anchor?.ok) {
                c.moveTo(h.anchor.x, h.anchor.y);
                c.lineTo(h.s.x, h.s.y);
            }
            c.stroke();
            c.setLineDash([]);
            sq(h.s, col);
            c.fillStyle = col;
            c.font = `bold ${12 / Z}px system-ui`;
            // 本数のように整数の値は、小数を付けずにそのまま出す。
            const shown = h.integer ? Math.round(Number(h.start) || 0) : Number(h.start || 0).toFixed(3);
            gzLabel(c, `${h.label} ${shown}`, h.s.x + 9 / Z, h.s.y - 8 / Z, "#ff9f68", 12);
        });
    } else if (sg.o.asset === "stall") {
        // 4つの四角（カウンター奥行き・カウンター高さ・屋根の張り出し・屋根の厚さ）を
        // 同じ見た目で描く。掴む四角から寸法の向きへ破線を引き、現在値を添える。
        Object.values(sg.handles).forEach((h) => {
            if (!h?.s?.ok) return;
            const col = h.color || "#ff9f68";
            c.strokeStyle = col;
            c.lineWidth = 1.4 / Z;
            c.setLineDash([5 / Z, 4 / Z]);
            c.beginPath();
            if (h.anchor?.ok) {
                c.moveTo(h.anchor.x, h.anchor.y);
                c.lineTo(h.s.x, h.s.y);
            }
            c.stroke();
            c.setLineDash([]);
            sq(h.s, col);
            gzLabel(c, `${h.label} ${Number(h.start || 0).toFixed(2)}`, h.s.x + 9 / Z, h.s.y - 8 / Z, col, 12);
        });
    } else if (sg.o.asset === "sign") {
        const h = sg.handles;
        c.setLineDash([5 / Z, 4 / Z]);
        c.lineWidth = 1.2 / Z;
        if (sg.frame && sg.frame.length === 4 && sg.frame.every((q) => q && q.ok)) {
            c.strokeStyle = "rgba(102,227,200,.58)";
            c.beginPath();
            sg.frame.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
            c.closePath();
            c.stroke();
        }
        c.strokeStyle = "rgba(102,227,200,.9)";
        c.beginPath();
        c.moveTo(sg.center.x, sg.center.y);
        c.lineTo(h.faceW.s.x, h.faceW.s.y);
        c.moveTo(sg.center.x, sg.center.y);
        c.lineTo(h.faceH.s.x, h.faceH.s.y);
        c.stroke();
        c.setLineDash([]);
        sq(h.faceW.s, "#66e3c8");
        sq(h.faceH.s, "#66e3c8");
        gzLabel(c, "絵枠W", h.faceW.s.x + 8 / Z, h.faceW.s.y - 7 / Z, "#66e3c8", 12);
        gzLabel(c, "絵枠H", h.faceH.s.x + 8 / Z, h.faceH.s.y - 7 / Z, "#66e3c8", 12);
    } else if (sg.o.asset === "cone") {
        c.strokeStyle = "rgba(255,179,111,.95)";
        c.lineWidth = 1.5 / Z;
        c.beginPath();
        c.moveTo(sg.base.x, sg.base.y);
        c.lineTo(sg.apex.x, sg.apex.y);
        c.stroke();
        sq(sg.handle.s, "#ffb36f");
        gzLabel(c, "高さ", sg.handle.s.x + 9 / Z, sg.handle.s.y - 8 / Z, "#ffcf9f", 12);
    } else {
        c.strokeStyle = "rgba(173,156,255,.95)";
        c.lineWidth = 1.4 / Z;
        c.setLineDash([5 / Z, 4 / Z]);
        c.beginPath();
        c.moveTo(sg.center.x, sg.center.y);
        c.lineTo(sg.handle.s.x, sg.handle.s.y);
        c.stroke();
        c.setLineDash([]);
        sq(sg.handle.s, "#ad9cff");
        gzLabel(c, "半径", sg.handle.s.x + 9 / Z, sg.handle.s.y - 8 / Z, "#d5ccff", 12);
    }
    c.restore();
}

// 複合オブジェクトをワールド軸方向へ拡縮する。子パーツの相対配置と定義を
// 保持したまま、各パーツを同じアフィン変換で作り直す。
function scaleCompoundPart(part, pivot, scale) {
    const q = { ...part, off: [...(part.off || [0, 0, 0])] };
    if (!PL[q.k]) return q;
    // ヨー(spin)を持っているパーツは、回す前の座標で拡縮してから元のヨーを戻す。
    // 回したあとの座標のまま ca/cb を書き換えると、ヨーが二重に掛かってしまう。
    const spinS = partSpinDeg(q),
        base = L2W(spinS ? { ...q, spin: 0 } : q, 0, 0, 0),
        nb = base.map((v, j) => pivot[j] + (v - pivot[j]) * (Number(scale[j]) || 1)),
        [iu, iv] = PL[q.k],
        d = Number(q.d) || 1;
    q.ca = nb[iu] - q.off[iu];
    q.cb = nb[iv] - q.off[iv];
    q.lift = (d + q.off[q.k] - nb[q.k]) / d;
    const rot = Number(q.rot) || 0,
        cs = Math.cos(rot * DG),
        sn = Math.sin(rot * DG),
        su = Math.hypot(scale[iu] * cs, scale[iv] * sn),
        sv = Math.hypot(scale[iu] * sn, scale[iv] * cs);
    q.ra = Math.max(0.002, Math.abs(Number(q.ra) || 0.002) * Math.max(0.002, su));
    q.rb = Math.max(0.002, Math.abs(Number(q.rb) || 0.002) * Math.max(0.002, sv));
    if (su > 0.0001) q.rot = wrap180(Math.atan2(scale[iv] * sn, scale[iu] * cs) / DG);
    if (Number(q.h) > 0) q.h = Math.max(0.002, Number(q.h) * Math.abs(Number(scale[q.k]) || 1));
    // 回転中心も同じ倍率で動かす（拡縮しても回転軸がずれない）。
    const Ps = q.spinPivot;
    if (spinS && Ps && Number.isFinite(Ps[0]))
        q.spinPivot = [0, 1, 2].map((j) => pivot[j] + (Ps[j] - pivot[j]) * (Number(scale[j]) || 1));
    return q;
}
function scaleCompoundDefinition(o, pivot, scale) {
    const parts = compoundPartsAt(o).map((part) => scaleCompoundPart(part, pivot, scale)),
        b = groupBounds(parts),
        center = [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2];
    const sp = o.spinPivot;
    return {
        parts,
        tx: 0,
        ty: 0,
        tz: 0,
        ca: center[0],
        cb: center[2],
        ra: Math.max(0.005, (b.hi[0] - b.lo[0]) / 2),
        rb: Math.max(0.005, (b.hi[2] - b.lo[2]) / 2),
        h: Math.max(0, b.hi[1] - b.lo[1]),
        // 回転軸も同じ倍率で動かす（拡縮したあとに回しても、その場で回る）。
        ...(sp && Number.isFinite(sp[0])
            ? { spinPivot: [0, 1, 2].map((j) => pivot[j] + (sp[j] - pivot[j]) * (Number(scale[j]) || 1)) }
            : {}),
    };
}
function compoundFacePatch(o, fid, dl) {
    const b = obBounds(o),
        map = { "x+": [0, 1], "x-": [0, -1], "y+": [1, 1], "y-": [1, -1], "z+": [2, 1], "z-": [2, -1] },
        spec = map[fid];
    if (!spec) return {};
    const axis = spec[0],
        side = spec[1],
        span = Math.max(0.005, b.hi[axis] - b.lo[axis]),
        pivot = [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2],
        fixed = side > 0 ? b.lo[axis] : b.hi[axis],
        // マイナス側の面の法線は−方向。法線へ正に動かしたときは、
        // 下限をさらに小さくして同じ面から外へ広げる。
        edge = side > 0 ? b.hi[axis] + dl : b.lo[axis] - dl,
        newSpan = Math.max(0.005, side > 0 ? edge - b.lo[axis] : b.hi[axis] - edge),
        scale = [1, 1, 1];
    pivot[axis] = fixed;
    scale[axis] = newSpan / span;
    return scaleCompoundDefinition(o, pivot, scale);
}
function compoundGizmo(o) {
    const b = obBounds(o),
        // 回転の軸（compoundSpinPivot）をそのまま輪の中心にする。
        // 箱の中心を使うと、回している間に輪だけが動いて「軸が違う」ように見える。
        C3 = compoundSpinPivot(o),
        sC = scrW(C3);
    if (!sC.ok) return null;
    const g = { o, C3, sC, axes: [], faces: [], ring: [], compound: true, bounds: b },
        nC = Math.hypot(...V.add(C3, CO()));
    [
        // 上下方向を Z（青）、手前・奥を Y（緑）として表示する。
        // 内部の座標計算（ワールドY＝高さ）は変えず、名前と色だけを揃えている。
        [1, 0, 0, GZ_X, "X"],
        [0, 1, 0, GZ_Z, "Z"],
        [0, 0, 1, GZ_Y, "Y"],
    ].forEach(([x, y, z, col, nm]) => {
        const a = [x, y, z],
            eps = 0.01 * Math.max(0.1, nC),
            s1 = scrW(V.add(C3, a, 1, eps));
        if (!s1.ok) return;
        const pu = Math.hypot(s1.x - sC.x, s1.y - sC.y) / eps;
        // 画面で完全に潰れた軸（真横・真上から見た奥行き方向）は、3Dでは矢印を出さない。
        // ただし正投影（正面・横・上）では、その軸へ動かす手段が無くなってしまうため、
        // 決まった向きの短い矢印を置いて掴めるようにする（3Dの見た目は変えない）。
        if (pu < 1e-6) {
            if (!orthView) return;
            const d = hiddenHandleDir(),
                L = 120 / Math.max(0.05, Z);
            g.axes.push({ a, col, nm, sT: { x: sC.x + d.x * L, y: sC.y + d.y * L, ok: true }, hiddenAxis: true });
            return;
        }
        const L = Math.min(90 / Z / pu, 3 * nC + 1),
            sT = scrW(V.add(C3, a, 1, L));
        if (sT.ok) g.axes.push({ a, col, nm, sT });
    });
    const center = [...C3],
        neg = (v) => v.map((t) => -t),
        face = (id, p, n) => g.faces.push({ id, n, P3: p, s: scrW(p) });
    face("x+", [b.hi[0], center[1], center[2]], [1, 0, 0]);
    face("x-", [b.lo[0], center[1], center[2]], [-1, 0, 0]);
    face("y+", [center[0], b.hi[1], center[2]], [0, 1, 0]);
    face("y-", [center[0], b.lo[1], center[2]], [0, -1, 0]);
    face("z+", [center[0], center[1], b.hi[2]], [0, 0, 1]);
    face("z-", [center[0], center[1], b.lo[2]], [0, 0, -1]);
    const R = Math.max(b.hi[0] - b.lo[0], b.hi[2] - b.lo[2], 0.25) * 0.7;
    for (let i = 0; i <= 72; i++) {
        const t = (i / 72) * 2 * Math.PI,
            p3 = [C3[0] + R * Math.cos(t), C3[1], C3[2] + R * Math.sin(t)],
            q = scrW(p3);
        // 奥半分を薄く描くための目安（結合体でも手前／奥を分ける）。
        if (q) q.d = ringPointDepth(p3);
        g.ring.push(q);
    }
    g.ringCDepth = ringPointDepth(C3);
    {
        let r = 0;
        g.ring.forEach((q) => {
            if (q?.ok) r = Math.max(r, Math.hypot(q.x - sC.x, q.y - sC.y));
        });
        if (r > 0) g.outer = outerRingPoints(sC, r * 1.03);
    }
    return g;
}
// 横壁看板専用のベベルハンドル。オレンジ菱形をドラッグすると、
// 0なら普通の直方体、0より大きければベベル直方体へ切り替わる。
// ベベルの分割数は横壁看板では常に4に固定する。
function wallSideSignBevelHandle(o) {
    const q = syncAttachedPart(o),
        boardH = Math.max(0.05, Math.abs(Number(q.ra) || 0.9) * 2),
        boardW = Math.max(0.05, Math.abs(Number(q.rb) || 0.75) * 2),
        max = Math.max(0, Math.min(boardH, boardW) * 0.5 - 0.001),
        start = q.wallSideSignShape === "beveled" ? clamp(Number(q.wallSideSignBevelOffset) || 0, 0, max) : 0,
        z = 0,
        pr = (x, y) => scrW(L2W(q, x, y, z)),
        anchor = pr(boardH * 0.5, boardW * 0.5),
        step = Math.max(0.05, Math.min(max || 0.25, Math.min(boardH, boardW) * 0.08)),
        raw = pr(boardH * 0.5 - start * 0.5, boardW * 0.5 - start * 0.5),
        probe = pr(boardH * 0.5 - Math.min(max, start + step) * 0.5, boardW * 0.5 - Math.min(max, start + step) * 0.5),
        dx = (probe?.x || 0) - (raw?.x || 0),
        dy = (probe?.y || 0) - (raw?.y || 0),
        length = Math.hypot(dx, dy),
        projected = !!raw?.ok && !!probe?.ok && Number.isFinite(length),
        hidden = projected && length <= 0.5 / Z,
        fallback = hiddenHandleDir(),
        visibleDir = hidden ? fallback : { x: dx / (length || 1), y: dy / (length || 1) },
        displayGap = Math.max(48 / Z, 56 / Z),
        displayS = !raw?.ok
            ? raw
            : hidden
              ? {
                    x: raw.x + fallback.x * hiddenHandleGap(),
                    y: raw.y + fallback.y * hiddenHandleGap(),
                    ok: true,
                }
              : { x: raw.x - visibleDir.x * displayGap, y: raw.y - visibleDir.y * displayGap, ok: true };
    return {
        kind: "wallSideSign-beveled-offset",
        s: displayS,
        anchor,
        dir: visibleDir,
        scale: hidden
            ? hiddenHandleScale()
            : length / Math.max(0.0001, Math.min(step, max - start || step)),
        start,
        min: 0,
        max,
    };
}
// 横壁看板専用のギズモ。看板のローカル座標は
// X=上下、Y=壁から外側、Z=壁に沿う方向。移動用の2軸に加えて、
// 白い6面ハンドルで高さ・外向き幅・板厚も編集できる。
// 横壁看板の取付金具長さハンドル。金具が1本以上あるときだけ表示する。
// 看板内側を基準に、壁方向へ伸びる金具の端をドラッグして長さを変更する。
function wallSideSignBracketHandle(o) {
    const q = syncAttachedPart(o),
        count = clamp(Math.round(Number(q.wallSideSignBracketCount) || 0), 0, 3),
        lengthValue = clamp(Math.abs(Number(q.wallSideSignBracketLength) || 0.36), 0.05, 5);
    if (!count || !q?.wallSideBasis) return null;
    const boardW = Math.max(0.05, Math.abs(Number(q.rb) || 0.75) * 2),
        clearance = 0.025,
        span = lengthValue + clearance,
        step = Math.max(0.05, Math.min(0.5, lengthValue * 0.18)),
        pr = (y) => scrW(L2W(q, 0, y, 0)),
        anchor = pr(-boardW * 0.5),
        raw = pr(-boardW * 0.5 - span),
        probe = pr(-boardW * 0.5 - span - step),
        dx = (probe?.x || 0) - (raw?.x || 0),
        dy = (probe?.y || 0) - (raw?.y || 0),
        px = Math.hypot(dx, dy),
        hidden = !raw?.ok || !probe?.ok || px <= 0.5 / Z,
        fallback = hiddenHandleDir(),
        dir = hidden ? fallback : { x: dx / px, y: dy / px },
        display = raw?.ok
            ? hidden
                ? {
                      x: raw.x + fallback.x * Math.max(26 / Z, 34 / Z),
                      y: raw.y + fallback.y * Math.max(26 / Z, 34 / Z),
                      ok: true,
                  }
                : { x: raw.x + dir.x * Math.max(30 / Z, 36 / Z), y: raw.y + dir.y * Math.max(30 / Z, 36 / Z), ok: true }
            : raw;
    return {
        kind: "wallSideSign-bracket-length",
        s: display,
        anchor,
        dir,
        scale: hidden ? hiddenHandleScale() : px / step,
        start: lengthValue,
        min: 0.05,
        max: 5,
    };
}
function wallSideSignGizmo(o) {
    const q = syncAttachedPart(o),
        basis = q?.wallSideBasis,
        C3 = basis?.origin || L2W(q, 0, 0, 0),
        sC = scrW(C3);
    if (!sC?.ok) return null;
    const boardHalfHeight = Math.max(0.025, Math.abs(Number(q.ra) || 0.9)),
        boardHalfWidth = Math.max(0.025, Math.abs(Number(q.rb) || 0.75)),
        halfThickness = Math.max(0.01, Math.abs(Number(q.h) || 0.12) * 0.5),
        g = {
            o: q,
            C3,
            sC,
            axes: [],
            faces: [],
            ring: [],
            bevelHandle: wallSideSignBevelHandle(q),
            bracketHandle: wallSideSignBracketHandle(q),
        },
        nC = Math.hypot(...V.add(C3, CO())),
        defs = [
            [basis?.u || [0, 1, 0], "#4a7be8", "Z"],
            [basis?.n || [0, 0, 1], "#3fa45b", "Y"],
        ],
        along = (base, axis, amount) => base.map((value, i) => value + axis[i] * amount),
        neg = (axis) => axis.map((value) => -value),
        addFace = (id, axis, amount) => {
            const P3 = along(C3, axis, amount),
                s = scrW(P3);
            g.faces.push({ id, n: axis, P3, s, wallSideSign: true });
        };
    defs.forEach(([a, col, nm]) => {
        const axis = V.nrm(a),
            eps = 0.01 * Math.max(0.1, nC),
            s1 = scrW(V.add(C3, axis, 1, eps));
        if (!s1?.ok) return;
        const pu = Math.hypot(s1.x - sC.x, s1.y - sC.y) / eps;
        // 画面で完全に潰れた軸（真横・真上から見た奥行き方向）は、3Dでは矢印を出さない。
        // ただし正投影（正面・横・上）では、その軸へ動かす手段が無くなってしまうため、
        // 通常の直方体と同じく決まった向きの短い矢印を置いて掴めるようにする。
        // （以前はこの分岐が壁横看板だけ抜けていて、正面・上のビューで
        //   壁から出る向き＝看板の厚み方向へ動かせなかった）
        if (pu < 1e-6) {
            if (!orthView) return;
            const d = hiddenHandleDir(),
                L = 120 / Math.max(0.05, Z);
            g.axes.push({
                a: axis,
                col,
                nm,
                sT: { x: sC.x + d.x * L, y: sC.y + d.y * L, ok: true },
                hiddenAxis: true,
                wallSideSign: true,
            });
            return;
        }
        const length = Math.min(90 / Z / pu, 3 * nC + 1),
            sT = scrW(V.add(C3, axis, 1, length));
        if (sT?.ok) g.axes.push({ a: axis, col, nm, sT, wallSideSign: true });
    });
    // 壁横看板も、通常の直方体と同じ白い外形面ハンドルを表示する。
    // u=看板高さ、v=壁から外へ出る幅、n=看板の板厚として、
    // 3D視点でも看板本体の各面から寸法を編集できるようにする。
    const u = V.nrm(basis?.u || [0, 1, 0]),
        v = V.nrm(basis?.v || [1, 0, 0]),
        n = V.nrm(basis?.n || [0, 0, 1]);
    addFace("u+", u, boardHalfHeight);
    addFace("u-", neg(u), boardHalfHeight);
    addFace("v+", v, boardHalfWidth);
    addFace("v-", neg(v), boardHalfWidth);
    addFace("n+", n, halfThickness);
    addFace("n-", neg(n), halfThickness);
    return g;
}
function wallSideSignSpecialGizmo(o) {
    const q = syncAttachedPart(o),
        C3 = q?.wallSideBasis?.origin || L2W(q, 0, 0, 0);
    return {
        o: q,
        C3,
        handle: wallSideSignBevelHandle(q),
        bracketHandle: wallSideSignBracketHandle(q),
    };
}
// 描画とヒット判定の両方が同じ座標を使うため、見た目と操作がずれにくい。
function gizmo() {
    const selected = sel && obOf(sel);
    if (selected?.attachment?.wallSideSign) return wallSideSignGizmo(selected);
    const o = sel && obOf(sel);
    if (!o) return null;
    if (o.type === "compound") return compoundGizmo(o);
    // 積層建物も3Dの移動・回転ギズモは表示する。ただし、
    // ra/rb/hへ書き込む汎用の面ハンドルは使わず、寸法編集は階別ギズモへ渡す。
    // ASSET_KIT で作ったアセットは、どれも「高さを持つ立体」として扱う。
    // （以前は下の solid 一覧へ種類を書き足す必要があり、新しく足したアセット
    //   ＝自販機・店先・電光看板などが上下の面ハンドルを出せず、3Dで高さを
    //   編集できなかった。2026-11-03）
    const kitAsset =
            o.type === "asset" &&
            typeof ASSET_KIT !== "undefined" &&
            typeof ASSET_KIT.kinds === "function" &&
            ASSET_KIT.kinds().includes(o.asset),
        stacked = isStackedBuildingAsset(o),
        [iu, iv] = PL[o.k],
        cs = Math.cos(o.rot * DG),
        sn = Math.sin(o.rot * DG),
        solid =
            o.type === "box" ||
            o.type === "cyl" ||
            o.type === "rect" ||
            o.type === "circ" ||
            o.type === "triPrism" ||
            o.type === "triPyramid" ||
            (o.type === "asset" &&
                (o.asset === "triPrism" ||
                    o.asset === "triPyramid" ||
                    o.asset === "sign" ||
                    o.asset === "stairs" ||
                    o.asset === "building" ||
                    o.asset === "awning" ||
                    o.asset === "balcony" ||
                    // コの字壁は高さ方向の面（屋根・底面）を持つので、
                    // 3Dでも上下の面ハンドルで高さを変えられるようにする。
                    o.asset === "uWall" ||
                    // 屋台・丸椅子も高さ方向の面を持つので、3Dで上下の面を掴める。
                    o.asset === "stall" ||
                    o.asset === "stool" ||
                    // 手すりは柱と横桟を上下に持つ立体なので、3Dでも上下の面で
                    // 高さを変えられるようにする（ビューごとの差を作らない）。
                    o.asset === "railing" ||
                    o.asset === "pathPipe" ||
                    o.asset === "box" ||
                    o.asset === "beveledBox" ||
                    o.asset === "cornerCutBox" ||
                    o.asset === "recessedStackedBuilding" ||
                    o.asset === "wallSign" ||
                    o.asset === "person" ||
                    o.asset === "gableRoof" ||
                    o.asset === "shedRoof" ||
                    o.asset === "ramp" ||
                    o.asset === "windowGrid" ||
                    o.asset === "crosswalk" ||
                    kitAsset ||
                    isStackedBuildingAsset(o))),
        [z0, z1] = outerZRange(o),
        zc = solid ? (z0 + z1) / 2 : 0;
    const C3 = L2W(o, 0, 0, zc),
        sC = scrW(C3);
    if (!sC.ok) return null;
    const g = { o, C3, sC, axes: [], faces: [], ring: [] },
        nC = Math.hypot(...V.add(C3, CO()));
    [
        // 上下方向を Z（青）、手前・奥を Y（緑）として表示する。
        // 内部の座標計算（ワールドY＝高さ）は変えず、名前と色だけを揃えている。
        [1, 0, 0, GZ_X, "X"],
        [0, 1, 0, GZ_Z, "Z"],
        [0, 0, 1, GZ_Y, "Y"],
    ].forEach(([x, y, z, col, nm]) => {
        // 画面で約90pxになる長さの矢印
        const a = [x, y, z],
            eps = 0.01 * Math.max(0.1, nC),
            s1 = scrW(V.add(C3, a, 1, eps));
        if (!s1.ok) return;
        const pu = Math.hypot(s1.x - sC.x, s1.y - sC.y) / eps;
        // 画面で完全に潰れた軸（真横・真上から見た奥行き方向）は、3Dでは矢印を出さない。
        // ただし正投影（正面・横・上）では、その軸へ動かす手段が無くなってしまうため、
        // 決まった向きの短い矢印を置いて掴めるようにする（3Dの見た目は変えない）。
        if (pu < 1e-6) {
            if (!orthView) return;
            const d = hiddenHandleDir(),
                L = 120 / Math.max(0.05, Z);
            g.axes.push({ a, col, nm, sT: { x: sC.x + d.x * L, y: sC.y + d.y * L, ok: true }, hiddenAxis: true });
            return;
        }
        const L = Math.min(90 / Z / pu, 3 * nC + 1),
            sT = scrW(V.add(C3, a, 1, L));
        if (sT.ok) g.axes.push({ a, col, nm, sT });
    });
    if (o.attachment?.verticalOnly) g.axes = g.axes.filter((a) => Math.abs(a.a[1]) > 0.9);
    const en = [0, 0, 0],
        eu = [0, 0, 0],
        ev = [0, 0, 0],
        tiltM = typeof objectTiltMatrix === "function" ? objectTiltMatrix(o) : null,
        // 傾き（rotX/rotZ）が入っているときは、面の法線も同じだけ回して
        // 白い四角が実際の面の上に来るようにする。
        tiltDir = (v) => (tiltM ? tiltM.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]) : v);
    en[o.k] = -o.d;
    eu[iu] = cs;
    eu[iv] = sn;
    ev[iu] = -sn;
    ev[iv] = cs; // 高さ方向・幅方向・奥行き方向の単位ベクトル
    if (tiltM) {
        const eu2 = tiltDir(eu),
            ev2 = tiltDir(ev),
            en2 = tiltDir(en);
        eu[0] = eu2[0], eu[1] = eu2[1], eu[2] = eu2[2];
        ev[0] = ev2[0], ev[1] = ev2[1], ev[2] = ev2[2];
        en[0] = en2[0], en[1] = en2[1], en[2] = en2[2];
    }
    const F = (id, x, y, z, n) => {
            const P3 = L2W(o, x, y, z),
                s = scrW(P3);
            g.faces.push({ id, n, P3, s });
        },
        neg = (v) => v.map((t) => -t);
    // 外形の6面は、開口のある建物でも編集対象にする。
    // 積層建物だけはfloors[]を持つため、汎用面ハンドルを出さない。
    // 円（type=circ）は幅と奥行きが同じ「半径」1つで決まる形なので、
    // 幅・奥行きを別々に動かす面ハンドルは出さない（出すと楕円になってしまう）。
    // 半径は画面の専用ハンドル（circleGizmo）、高さは上下の面で編集する。
    // 丸椅子も幅・奥行きは「座面の半径」1つで決まるので、左右の面ハンドルは出さない
    // （出すと座面だけ楕円になり、半径ハンドルの値とも食い違う）。
    const isCircle = o.type === "circ" || (o.type === "asset" && o.asset === "stool");
    if (!stacked) {
        if (!isCircle) {
            F("u+", o.ra, 0, zc, eu);
            F("u-", -o.ra, 0, zc, neg(eu));
            F("v+", 0, o.rb, zc, ev);
            F("v-", 0, -o.rb, zc, neg(ev));
        }
        if (solid) {
            F("top", 0, 0, z1, en);
            F("base", 0, 0, z0, neg(en));
        }
    }
    // 回転リングの大きさは、3本とも同じ「オブジェクトの半分の対角」に揃える。
    // 以前は上下リングだけ 1.4×ra で、傾きリングとは別の大きさだったため、
    // 同じ回転ギズモなのに輪の大きさが違い、外周の輪だけが大きく見えていた。
    const bb = obBounds(o),
        diag = Math.hypot(
            Math.max(0.2, bb.hi[0] - bb.lo[0]),
            Math.max(0.2, bb.hi[1] - bb.lo[1]),
            Math.max(0.2, bb.hi[2] - bb.lo[2]),
        ),
        ringR = clamp(diag * 0.5, 0.45, 60),
        R = ringR;
    // 回転リングの各点に「カメラからの距離」を持たせる。手前半分は濃く、
    // 奥半分は薄く描くため（Blender の回転ギズモと同じ見え方）。
    // 上下リングだけは形の底面（z0）に置く。中心の高さ（zc）に置くと、
    // 左右・手前奥の白い面ハンドル（±ra / ±rb の位置）と画面上で重なり、
    // 面をつかむつもりが回転になる／回すつもりが面になる、という取り違えが起きる。
    for (let i = 0; i <= 72; i++) {
        const t = (i / 72) * 2 * Math.PI,
            p3 = L2W(o, R * Math.cos(t), R * Math.sin(t), solid ? z0 : 0),
            q = scrW(p3);
        if (q) q.d = ringPointDepth(p3);
        g.ring.push(q);
    }
    g.ringCDepth = ringPointDepth(C3);
    // 画面の回転ギズモ：上下（ワールドY）は従来のリング、左右（X）と手前奥（Z）は
    // ワールド軸まわりのリングを追加する。3つそろうと、どの向きにも回せる。
    g.rings = [];
    // 傾きリングも上下リングと同じ半径 ringR を使う（上の gizmo() 冒頭で算出）。
    [
        [[1, 0, 0], GZ_X, "X", "x"],
        [[0, 0, 1], GZ_Y, "Y", "z"],
    ].forEach(([axis, col, nm, key]) => {
        const { u, v } = ringBasis(axis),
            poly = [];
        for (let i = 0; i <= 72; i++) {
            const t = (i / 72) * 2 * Math.PI,
                s2 = scrW([
                    C3[0] + ringR * (u[0] * Math.cos(t) + v[0] * Math.sin(t)),
                    C3[1] + ringR * (u[1] * Math.cos(t) + v[1] * Math.sin(t)),
                    C3[2] + ringR * (u[2] * Math.cos(t) + v[2] * Math.sin(t)),
                ]);
            if (s2) s2.d = ringPointDepth([
                C3[0] + ringR * (u[0] * Math.cos(t) + v[0] * Math.sin(t)),
                C3[1] + ringR * (u[1] * Math.cos(t) + v[1] * Math.sin(t)),
                C3[2] + ringR * (u[2] * Math.cos(t) + v[2] * Math.sin(t)),
            ]);
            poly.push(s2?.ok ? s2 : { ok: false });
        }
        // 画面で線に潰れているリング（真横から見た輪）は掴めないので描かない。
        const span = poly.reduce(
            (acc, q) => (q?.ok ? Math.max(acc, Math.hypot(q.x - sC.x, q.y - sC.y)) : acc),
            0,
        );
        if (span > 18 / Z) g.rings.push({ axis, col, nm, key, poly, cDepth: ringPointDepth(C3) });
    });
    // 外側の白い輪（Blender の回転ギズモの外周）を、いちばん大きい輪より少し外側に置く。
    {
        let r = 0;
        [g.ring, ...(g.rings || []).map((q) => q.poly)].forEach((poly) =>
            (poly || []).forEach((q) => {
                if (q?.ok) r = Math.max(r, Math.hypot(q.x - sC.x, q.y - sC.y));
            }),
        );
        if (r > 0) g.outer = outerRingPoints(sC, r * 1.03);
    }
    spreadFlatFaces(g.faces);
    return g;
}
// 高さ0の平らな形状（rect・circle・初期状態のbeveledBoxなど）では、
// 上面と底面の白い四角が同じ画面上の点に重なり、さらに中央の移動ハンドルとも
// 重なるため、押しても「移動」しか反応しなかった。
// 上下の面がほぼ同じ点にあるときは、上下へ逃がして個別に掴めるようにする。
// s（画面座標）だけをずらし、P3・法線・ドラッグ量の計算には触れない。
function spreadFlatFaces(faces) {
    if (!faces || faces.length < 2) return;
    const top = faces.find((f) => f.id === "top"),
        base = faces.find((f) => f.id === "base");
    if (!top?.s?.ok || !base?.s?.ok) return;
    const gap = 14 / Math.max(0.05, Z);
    if (Math.hypot(top.s.x - base.s.x, top.s.y - base.s.y) >= gap) return;
    const cx = (top.s.x + base.s.x) / 2,
        cy = (top.s.y + base.s.y) / 2;
    top.s = { x: cx, y: cy - gap, ok: true, depth: top.s.depth };
    base.s = { x: cx, y: cy + gap, ok: true, depth: base.s.depth };
}
// リングの点がカメラからどれだけ離れているか（奥半分を薄く描くための目安）。
// 正投影ではカメラ位置が無限遠なので、投影の奥行き軸へ落として代用する。
function ringPointDepth(p3) {
    if (orthView) return dot3(p3, orthBasis().depth);
    const cp = camPos();
    return Math.hypot(p3[0] - cp[0], p3[1] - cp[1], p3[2] - cp[2]);
}
function drawGizmo(c) {
    const g = gizmo();
    if (!g) {
        const o = sel && obOf(sel);
        if (o) drawSpecialGizmo(c, o);
        return;
    }
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";
    // ===== 回転ギズモ（Blender 風） =====
    // ・3本のリングは「その軸の色」（左右X＝オレンジ／手前奥Y＝緑／上下Z＝青）
    // ・奥半分は薄く、手前半分は濃く描く（Blender と同じで、輪の向きが読みやすい）
    // ・掴んでいるリングは太くして、いま何度かをカーソルの横に出す
    const ringActive =
            ed && ed.t === "ring" ? "up" : ed && ed.t === "tiltring" ? ed.axisKey : null,
        // 折れ線をまとめて描く（ok でない点が来たら線を切る）
        strokeSpan = (pts, alpha, width) => {
            if (!pts || !pts.length) return;
            c.globalAlpha = alpha;
            c.lineWidth = width;
            c.setLineDash([]);
            c.lineCap = "round";
            c.lineJoin = "round";
            c.beginPath();
            let on = false;
            pts.forEach((q) => {
                if (!q?.ok) {
                    on = false;
                    return;
                }
                on ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y);
                on = true;
            });
            c.stroke();
        },
        // 輪は「奥半分＝薄い」「手前半分＝濃い」の2本に分けて描く（Blender と同じ）。
        // いちばん手前の点には四角い取っ手を置き、掴む場所が分かるようにする。
        drawRing = (poly, col, key, cDepth) => {
            if (!Array.isArray(poly) || poly.length < 2) return;
            const act = ringActive === key,
                width = (act ? 2.8 : 1.7) / Z,
                depth0 = cDepth ?? ringPointDepth(g.C3),
                near = [],
                far = [];
            poly.forEach((q) => {
                const far1 = !(Number(q?.d) <= depth0);
                (far1 ? far : near).push(q);
            });
            c.strokeStyle = col;
            strokeSpan(far, act ? 0.42 : 0.18, width);
            strokeSpan(near, act ? 1 : 0.92, width);
            c.globalAlpha = 1;
            let knob = null;
            poly.forEach((q) => {
                if (q?.ok && (!knob || Number(q.d ?? 0) < Number(knob.d ?? 0))) knob = q;
            });
            if (knob) {
                const r = (act ? 5 : 4.2) / Z;
                c.fillStyle = col;
                c.globalAlpha = act ? 1 : 0.95;
                c.fillRect(knob.x - r, knob.y - r, r * 2, r * 2);
                c.globalAlpha = 1;
            }
        };
    // 外周の白い輪（画面に平行な輪）。掴むと上下軸まわりに回る。
    if (g.outer?.length && !g.o?.attachment?.verticalOnly) {
        // 白い背景では白い輪が見えないので、明暗どちらの背景でも読める灰色にする。
        c.strokeStyle = "#8d97a3";
        strokeSpan(g.outer, 0.62, 1.5 / Z);
        c.globalAlpha = 1;
    }
    // 上下（Z）のリング：面内の回転（rot）
    drawRing(g.ring, GZ_Z, "up", g.ringCDepth);
    // 左右（X）・手前奥（Y）のリング：傾き（rotX / rotZ）の回転
    (g.rings || []).forEach((ring) => drawRing(ring.poly, ring.col, ring.key, ring.cDepth));
    // 中心：白いリングと小さな点（Blender の回転ギズモの中心）
    // 中心の輪も白い背景では見えないので、Blender の白い輪に相当する濃さの灰色にする。
    c.setLineDash([]);
    c.strokeStyle = "#5a6b78";
    c.globalAlpha = 0.55;
    c.lineWidth = 1.6 / Z;
    c.beginPath();
    c.arc(g.sC.x, g.sC.y, 7 / Z, 0, 7);
    c.stroke();
    c.fillStyle = "#ff9d3d";
    c.beginPath();
    c.arc(g.sC.x, g.sC.y, 2.2 / Z, 0, 7);
    c.fill();
    c.globalAlpha = 1;
    // 回転中は、いま何度かをカーソルの横に出す。
    if (ringActive && lastPtr) {
        const deg =
                ed.t === "ring"
                    ? Number(g.o?.compoundRot ?? g.o?.rot) || 0
                    : Number(ed.axisKey === "x" ? g.o?.rotX : g.o?.rotZ) || 0,
            txt = `${Math.round(wrap180(deg))}°`;
        c.strokeStyle = "#7d8b96";
        c.globalAlpha = 0.55;
        c.lineWidth = 1 / Z;
        c.setLineDash([4 / Z, 4 / Z]);
        c.beginPath();
        c.moveTo(g.sC.x, g.sC.y);
        c.lineTo(lastPtr.x, lastPtr.y);
        c.stroke();
        c.setLineDash([]);
        c.globalAlpha = 1;
        gzLabel(c, txt, lastPtr.x + 12 / Z, lastPtr.y - 6 / Z, "#ff9f68", 14);
    }
    c.setLineDash([]);
    g.axes.forEach((a) => {
        const dx = a.sT.x - g.sC.x,
            dy = a.sT.y - g.sC.y,
            l = Math.hypot(dx, dy) || 1,
            ux = dx / l,
            uy = dy / l,
            h = 9 / Z; // 軸の矢印
        c.strokeStyle = a.col;
        c.fillStyle = a.col;
        c.lineWidth = 1.8 / Z;
        c.beginPath();
        c.moveTo(g.sC.x, g.sC.y);
        c.lineTo(a.sT.x, a.sT.y);
        c.stroke();
        c.beginPath();
        c.moveTo(a.sT.x + ux * h, a.sT.y + uy * h);
        c.lineTo(a.sT.x - ux * h * 0.2 - uy * h * 0.6, a.sT.y - uy * h * 0.2 + ux * h * 0.6);
        c.lineTo(a.sT.x - ux * h * 0.2 + uy * h * 0.6, a.sT.y - uy * h * 0.2 - ux * h * 0.6);
        c.fill();
        gzLabel(c, a.nm, a.sT.x + ux * h + 4 / Z, a.sT.y + uy * h + 4 / Z, a.col, 13);
    });
    c.fillStyle = "#fff";
    c.strokeStyle = "#222";
    c.lineWidth = 1.4 / Z; // 面のハンドル（白い四角）
    g.faces.forEach((f) => {
        if (!f.s.ok) return;
        const r = 6.5 / Z;
        c.beginPath();
        c.rect(f.s.x - r, f.s.y - r, 2 * r, 2 * r);
        c.fill();
        c.stroke();
    });
    c.beginPath();
    c.arc(g.sC.x, g.sC.y, 4.5 / Z, 0, 7);
    c.fill();
    c.stroke();
    drawSpecialGizmo(c, g.o);
    c.restore();
}
function stackedFloorScreen(o, index) {
    const f = o?.floors?.[index];
    if (!f) return null;
    const w = Math.max(0.08, Math.abs(Number(f.w) || 4)),
        d = Math.max(0.08, Math.abs(Number(f.d) || 3)),
        h = Math.max(0.08, Math.abs(Number(f.h) || 2.2)),
        x = Number(f.x) || 0,
        y = Number(f.y) || 0,
        z = Number(f.z) || 0,
        p3 = (px, py, pz) => customPt(o, px, py, pz),
        pr = (px, py, pz) => scrW(p3(px, py, pz)),
        center = pr(x, y, z + h * 0.5),
        top = [
            pr(x - w / 2, y - d / 2, z + h),
            pr(x + w / 2, y - d / 2, z + h),
            pr(x + w / 2, y + d / 2, z + h),
            pr(x - w / 2, y + d / 2, z + h),
        ],
        corners = [
            pr(x - w / 2, y - d / 2, z),
            pr(x + w / 2, y - d / 2, z),
            pr(x + w / 2, y + d / 2, z),
            pr(x - w / 2, y + d / 2, z),
            ...top,
        ];
    return { f, center, top, corners, index };
}
function stackedFloorHit(o, p) {
    if (!isStackedBuildingAsset(o) || !Array.isArray(o.floors)) return null;
    let best = null;
    o.floors.forEach((f, index) => {
        const q = stackedFloorScreen(o, index),
            valid = q && q.center?.ok && q.corners.every((v) => v && v.ok);
        if (!valid) return;
        const xs = q.corners.map((v) => v.x),
            ys = q.corners.map((v) => v.y),
            inside = insidePoly2D(
                p,
                q.top.filter((v) => v && v.ok),
            ),
            inBox =
                p.x >= Math.min(...xs) - 12 / Z &&
                p.x <= Math.max(...xs) + 12 / Z &&
                p.y >= Math.min(...ys) - 12 / Z &&
                p.y <= Math.max(...ys) + 12 / Z,
            distance = Math.hypot(p.x - q.center.x, p.y - q.center.y);
        if ((inside || inBox) && (!best || distance < best.distance)) best = { ...q, distance };
    });
    return best;
}
function insidePoly2D(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i],
            b = poly[j],
            cross = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || 1e-9) + a.x;
        if (cross) inside = !inside;
    }
    return inside;
}
// タッチした位置にあるハンドルを調べる（アセット専用→面→軸の矢印→回転の輪）
// 画面上のクリックを、特殊アセット用→面→軸→回転リングの順で判定する。
// 看板・階層建物・パスパイプなどはここで専用ハンドルへ分岐する。
// 画面上の点 p に最も近いハンドルを返す（許容半径 R 以内、無ければ null）。
// 「丸が重なったら押した位置に近い方を選ぶ」という同じ規則を、
// アセットごとに書き写していたので1か所へまとめた。
function nearestHandleOf(handles, p, R) {
    let best = null,
        bestD = R;
    for (const h of handles || []) {
        if (!h || !h.s || !h.s.ok) continue;
        const d = Math.hypot(h.s.x - p.x, h.s.y - p.y);
        if (d < bestD) {
            bestD = d;
            best = { handle: h, d };
        }
    }
    return best;
}
function hitGizmo(p) {
    const active = sel && obOf(sel),
        special = active && specialGizmo(active),
        R = 20 / Z;
    // 白い面ハンドル（通常ギズモ）のうち押した点に最も近いもの。
    // アセット専用ハンドルと重なったときは「押した位置に近い方」を採用したいので、
    // 専用ハンドルだけを先に返さず、両方の距離を比べる。
    let faceCache;
    const nearestFaceHit = () => {
        if (faceCache !== undefined) return faceCache;
        const g0 = gizmo();
        faceCache =
            (g0
                ? (g0.faces || [])
                      .filter((f) => f.s?.ok)
                      .map((f) => ({ f, g: g0, d: Math.hypot(f.s.x - p.x, f.s.y - p.y) }))
                      .filter((q) => q.d < R)
                      .sort((a, b) => a.d - b.d)[0]
                : null) || null;
        return faceCache;
    };
    // 専用ハンドルと面ハンドルの勝負。同じくらいなら専用ハンドルを優先する
    // （専用ハンドルは手前に描いていて、狭い範囲を指しているため）。
    const handleOrFace = (nearest, mk) => {
        if (!nearest) return null;
        const face = nearestFaceHit();
        if (!face || nearest.d <= face.d + 1.5 / Z) return mk(nearest);
        return { t: "face", f: face.f, g: face.g };
    };
    if (special) {
        if (active.asset === "wallSideSign") {
            const handles = [
                    { t: "wallSideSign-bracket-length", h: special.bracketHandle },
                    { t: "wallSideSign-beveled-offset", h: special.handle },
                ]
                    .filter((q) => q.h?.s?.ok)
                    .map((q) => ({ ...q, d: Math.hypot(q.h.s.x - p.x, q.h.s.y - p.y) }))
                    .filter((q) => q.d < R)
                    .sort((a, b) => a.d - b.d),
                faceHits = (wallSideSignGizmo(active)?.faces || [])
                    .filter((f) => f.s?.ok)
                    .map((f) => ({ f, d: Math.hypot(f.s.x - p.x, f.s.y - p.y) }))
                    .filter((q) => q.d < R)
                    .sort((a, b) => a.d - b.d),
                nearestHandle = handles[0],
                nearestFace = faceHits[0];
            // 黄色／オレンジの専用ハンドルと白い面ハンドルが重なるときは、
            // 実際に押した位置へ近い方を採用する。
            if (nearestHandle && (!nearestFace || nearestHandle.d <= nearestFace.d))
                return { t: nearestHandle.t, sign: nearestHandle.h, g: { o: active, C3: special.C3 } };
            if (nearestFace) return { t: "wallSideSign-face", f: nearestFace.f, g: { o: active, C3: special.C3 } };
        }
        if (active.asset === "cornerCutBox") {
            const opening = special.opening;
            if (opening) {
                const openingHits = [
                    ["cornerCut-opening-width-left", opening.handles.left],
                    ["cornerCut-opening-width-right", opening.handles.right],
                    ["cornerCut-opening-height", opening.handles.height],
                    ["cornerCut-opening-depth", opening.handles.depth],
                ]
                    .filter(([, handle]) => handle?.s?.ok)
                    .map(([t, handle]) => ({ t, handle, d: Math.hypot(handle.s.x - p.x, handle.s.y - p.y) }))
                    .filter((q) => q.d < R)
                    .sort((a, b) => a.d - b.d);
                if (openingHits.length) {
                    // 開口ハンドルと外形の白い面ハンドルが重なるときは近い方へ渡す。
                    const hit = openingHits[0],
                        face = nearestFaceHit();
                    if (!face || hit.d <= face.d + 1.5 / Z)
                        return { t: hit.t, sign: hit.handle, g: { o: active, C3: opening.C3 } };
                    return { t: "face", f: face.f, g: face.g };
                }
                if (opening.panelFrame?.every((q) => q?.ok) && insidePoly2D(p, opening.panelFrame))
                    return {
                        t: "cornerCut-opening-depth",
                        sign: opening.handles.depth,
                        g: { o: active, C3: opening.C3 },
                    };
            }
            const h = special.handle,
                cut = h?.s?.ok ? nearestHandleOf([h], p, R) : null,
                cutHit = handleOrFace(cut, (q) => ({ t: "cornerCut-offset", sign: q.handle, g: { o: active, C3: special.C3 } }));
            if (cutHit) return cutHit;
        }
        if (active.asset === "recessedStackedBuilding") {
            const nearest = nearestHandleOf(Object.values(special.handles || {}), p, R),
                depthHit = handleOrFace(nearest, (q) => ({
                    t: q.handle.kind,
                    sign: q.handle,
                    g: { o: active, C3: special.C3 },
                }));
            if (depthHit) return depthHit;
            if (special.frame?.every((q) => q?.ok) && insidePoly2D(p, special.frame))
                return {
                    t: "recessed-window-depth",
                    sign: special.handles.depth,
                    g: { o: active, C3: special.C3 },
                };
        }
        if (
            active.type === "circ" ||
            active.asset === "wallSign" ||
            active.asset === "windowGrid" ||
            active.asset === "balcony" ||
            active.asset === "uWall" ||
            // 屋台の5つ（壁の厚さ・カウンターの奥行きと高さ・屋根の張り出しと厚さ）、
            // 丸椅子の6つ（3つの半径と3つの高さ）も、同じ規則で掴めるようにする。
            active.asset === "stall" ||
            active.asset === "stool" ||
            active.asset === "railing" ||
            active.asset === "outdoorUnit" ||
            isSignalAsset(active) ||
            isCounterAsset(active)
        ) {
            const nearest = nearestHandleOf(Object.values(special.handles || {}), p, R),
                hit = handleOrFace(nearest, (q) => ({
                    t: q.handle.kind,
                    sign: q.handle,
                    g: { o: active, C3: special.C3 },
                }));
            if (hit) return hit;
        }
        if (active.asset === "person") {
            // 小さい図形なので、関節の丸が重なるときは押した位置に近い方を選ぶ。
            // 白い面ハンドル（胴の正面など）と重なる場合も同じ規則で選ぶ。
            const nearest = nearestHandleOf(Object.values(special.handles || {}), p, R),
                hit = handleOrFace(nearest, (q) => ({
                    t: q.handle.kind,
                    sign: q.handle,
                    g: { o: active, C3: special.C3 },
                }));
            if (hit) return hit;
        }
        if (active.asset === "beveledBox") {
            const h = special.handle,
                bevel = h?.s?.ok ? nearestHandleOf([h], p, R) : null,
                bevelHit = handleOrFace(bevel, (q) => ({
                    t: "beveled-offset",
                    sign: q.handle,
                    g: { o: active, C3: special.C3 },
                }));
            if (bevelHit) return bevelHit;
        }
        if (active.asset === "pathPipe") {
            // 扇状に分けた隣接点のハンドルが許容半径へ少し重なることがある。
            // 配列の先頭ではなく、押した位置に最も近いハンドルを返して
            // 奥側の制御点を手前の点へ誤配分しない。
            const nearest = nearestHandleOf(
                [...(special.pathHandles || []), special.radiusHandle].filter(Boolean),
                p,
                R,
            );
            if (nearest) return { t: nearest.handle.kind, sign: nearest.handle, g: { o: active, C3: special.C3 } };
        }
        if (isStackedBuildingAsset(active)) {
            const opening = special.opening;
            if (opening) {
                for (const h of [
                    opening.handles.left,
                    opening.handles.right,
                    opening.handles.height,
                    opening.handles.backFace,
                ])
                    if (h?.s?.ok && Math.hypot(h.s.x - p.x, h.s.y - p.y) < R)
                        return { t: h.kind, sign: h, g: { o: active, C3: opening.C3 } };
                if (opening.panelFrame?.every((q) => q && q.ok) && insidePoly2D(p, opening.panelFrame))
                    return {
                        t: "stacked-opening-back",
                        sign: opening.handles.backFace,
                        g: { o: active, C3: opening.C3 },
                    };
            }
            if (
                special.bevelHandle?.s?.ok &&
                Math.hypot(special.bevelHandle.s.x - p.x, special.bevelHandle.s.y - p.y) < R
            )
                return { t: "stacked-bevel-offset", sign: special.bevelHandle, g: { o: active, C3: special.C3 } };
            for (const h of Object.values(special.handles))
                if (Math.hypot(h.dir.x, h.dir.y) > 0.15 && Math.hypot(h.s.x - p.x, h.s.y - p.y) < R)
                    return { t: h.kind, sign: h, g: { o: active, C3: special.C3 } };
            // X／Y／Z移動矢印は階の外形判定より先に拾う。
            // 矢印の先端が階の箱の中に見える3D視点でも、1Fだけの移動へ落とさない。
            const moveG = gizmo();
            if (moveG && Math.hypot(moveG.sC.x - p.x, moveG.sC.y - p.y) > R * 0.8)
                for (const a of moveG.axes) {
                    const seg = axisGrabSeg(moveG, a);
                    if (segd(p, seg.a, seg.b) < R * 0.7) return { t: "axis", a, g: moveG };
                }
            const floor = stackedFloorHit(active, p);
            if (floor) return { t: "stack-floor", floorIndex: floor.index, floor, g: { o: active, C3: special.C3 } };
        }
        if (active.asset === "building") {
            // 看板付き建物では、開口ハンドルの判定範囲が外形の白い面ハンドルへ
            // 重なることがある。押した点に近い方を優先し、外形の幅・奥行き・高さ
            // 編集を開口奥面へ誤配分しない。
            const openingHits = (() => {
                    const nearest = nearestHandleOf(Object.values(special.handles), p, R);
                    return nearest ? [{ h: nearest.handle, d: nearest.d }] : [];
                })(),
                generic = gizmo(),
                faceHits = (generic?.faces || [])
                    .filter((f) => f.s?.ok)
                    .map((f) => ({ f, d: Math.hypot(f.s.x - p.x, f.s.y - p.y) }))
                    .filter((q) => q.d < R)
                    .sort((a, b) => a.d - b.d);
            // 開口ハンドル（ひし形）は面ハンドル（白い四角）より手前に描いているので、
            // 同じくらい近ければ開口を優先する。真上ビューのように高さ方向が
            // つぶれて面ハンドルと重なる場合でも、開口の高さを掴める。
            if (openingHits.length && (!faceHits.length || openingHits[0].d <= faceHits[0].d + 1.5 / Z)) {
                const h = openingHits[0].h;
                return { t: "building-" + h.kind, sign: h, g: { o: active, C3: special.C3 } };
            }
            if (faceHits.length) return { t: "face", f: faceHits[0].f, g: generic };
            if (special.panelFrame && special.panelFrame.every((q) => q && q.ok) && insidePoly2D(p, special.panelFrame))
                return { t: "building-backFace", sign: special.handles.backFace, g: { o: active, C3: special.C3 } };
        }
        if (active.asset === "awning") {
            // 手前の高さ（edgeZ）と奥行き（edgeY）は近い位置に並ぶので、
            // 配列の順ではなく押した位置に近い方を掴む。
            // 白い面ハンドルと重なる場合も同じ規則（近い方）で選ぶ。
            const nearest = nearestHandleOf(Object.values(special.handles), p, R),
                edgeHit = handleOrFace(nearest, (q) => ({
                    t: "awning-" + q.handle.kind,
                    sign: q.handle,
                    g: { o: active, C3: special.C3 },
                }));
            if (edgeHit) return edgeHit;
            if (
                special.frame &&
                special.frame[0]?.ok &&
                special.frame[1]?.ok &&
                segd(p, special.frame[0], special.frame[1]) < R * 0.8 &&
                // 白い面ハンドル（白い四角）が押した点にあれば、辺の救済より面を優先する。
                !nearestFaceHit()
            )
                return { t: "awning-edgeZ", sign: special.handles.edgeZ, g: { o: active, C3: special.C3 } };
        }
        if (active.asset === "sign") {
            const nearest = nearestHandleOf(Object.values(special.handles), p, R);
            if (nearest) return { t: "sign-" + nearest.handle.kind, sign: nearest.handle, g: { o: active, C3: special.C3 } };
        }
        if (active.asset === "cone" || active.asset === "sphere") {
            const h = special.handle,
                near = h?.s?.ok ? nearestHandleOf([h], p, R) : null,
                hh = handleOrFace(near, (q) => ({
                    t: active.asset === "cone" ? "cone-height" : "sphere-radius",
                    sign: q.handle,
                    g: { o: active, C3: special.C3 },
                }));
            if (hh) return hh;
        }
    }
    const g = gizmo();
    if (!g) return null;
    const Rg = 20 / Z;
    // 壁横看板は白い外形面ハンドルを優先する。看板の上下端が移動軸の
    // 先端と重なっても、面を押した操作を軸移動へ誤配分しない。
    if (active.asset === "wallSideSign") {
        const wallFaceHits = g.faces
            .filter((f) => f.s?.ok)
            .map((f) => ({ f, d: Math.hypot(f.s.x - p.x, f.s.y - p.y) }))
            .filter((q) => q.d < Rg)
            .sort((a, b) => a.d - b.d);
        if (wallFaceHits.length) return { t: "wallSideSign-face", f: wallFaceHits[0].f, g };
    }
    // 面ハンドル（白い四角）と軸矢印が重なるときは「押した位置に近い方」を採用する。
    // 以前は軸矢印を無条件で先に判定していたため、上面の中心にある白い四角が
    // Y軸の線分に奪われ、「面を押したのに大きさではなく位置が動く」状態になっていた。
    // 面ハンドルは軸より後に描いていて手前に見えるので、同じくらい近ければ面を優先する。
    const faceHits = g.faces
        .filter((f) => f.s.ok)
        .map((f) => ({ f, d: Math.hypot(f.s.x - p.x, f.s.y - p.y) }))
        .filter((q) => q.d < Rg);
    if (Math.hypot(g.sC.x - p.x, g.sC.y - p.y) > R * 0.8) {
        const ax = axisHitAt(g, p, R * 0.7);
        if (ax && (!faceHits.length || ax.d + 1.5 / Z < faceHits[0].d)) return { t: "axis", a: ax.a, g };
    }
    if (faceHits.length) {
        // 表裏の面ハンドルが重なるときは、画面に近い面を優先する。
        // 配列の先頭順だけで選ぶと、裏面の法線を拾ってドラッグ方向が反転する。
        faceHits.sort((a, b) => {
            if (Math.abs(a.d - b.d) > 0.5 / Z) return a.d - b.d;
            const da = Math.hypot(...V.add(a.f.P3, camPos(), 1, -1)),
                db = Math.hypot(...V.add(b.f.P3, camPos(), 1, -1));
            return da - db;
        });
        return {
            t: active.asset === "wallSideSign" ? "wallSideSign-face" : "face",
            f: faceHits[0].f,
            g,
        };
    }
    // 傾き用のリング（左右X・手前奥Y）を先に調べる。中心から離れた位置にあるので、
    // 白い四角や専用ハンドルを奪うことはない。
    // 3本のリング（左右X・手前奥Y・上下Z）を同じ土俵で比べ、いちばん近い輪を掴む。
    // 以前は傾きリングを先に返していたため、輪が交わる所では狙った輪を掴めなかった。
    let bestRing = null;
    (g.rings || []).forEach((r) => {
        for (let i = 1; i < r.poly.length; i++) {
            const a = r.poly[i - 1],
                b = r.poly[i];
            if (!a?.ok || !b?.ok) continue;
            const d = segd(p, a, b);
            if (d < R * 0.9 && (!bestRing || d < bestRing.d)) bestRing = { d, tilt: r };
        }
    });
    for (let i = 1; i < g.ring.length; i++) {
        const a = g.ring[i - 1],
            b = g.ring[i];
        if (!a?.ok || !b?.ok) continue;
        const d = segd(p, a, b);
        if (d < R * 0.9 && (!bestRing || d < bestRing.d)) bestRing = { d, tilt: null };
    }
    // 外側の白い輪（画面上の輪）も、上下軸まわりの回転として掴める。
    for (let i = 1; i < (g.outer?.length || 0); i++) {
        const a = g.outer[i - 1],
            b = g.outer[i];
        if (!a?.ok || !b?.ok) continue;
        const d = segd(p, a, b);
        if (d < R * 0.9 && (!bestRing || d < bestRing.d)) bestRing = { d, tilt: null };
    }
    if (bestRing) return bestRing.tilt ? { t: "tiltring", g, ring: bestRing.tilt } : { t: "ring", g };
    return null;
}
function compoundBounds(o) {
    const parts = compoundPartsAt(o);
    if (!parts.length) return { lo: [0, 0, 0], hi: [0, 0, 0] };
    return groupBounds(parts);
}
function objectAnchorWorld(o) {
    if (o?.type === "compound" || (o?.type === "asset" && o.asset === "pathPipe")) {
        const b = obBounds(o);
        return [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2];
    }
    return L2W(o, 0, 0, 0);
}
// 図形の外枠（ワールド軸に沿った箱）。スナップや接地に使う
function stackedObjectCorners(o) {
    if (!isStackedBuildingAsset(o)) return [];
    const floors =
        Array.isArray(o.floors) && o.floors.length
            ? o.floors
            : [{ x: 0, y: 0, z: 0, w: Number(o.ra || 4) * 2, d: Number(o.rb || 3) * 2, h: Number(o.h || 2.2) }];
    const out = [];
    floors.forEach((f) => {
        const w = Math.max(0.05, Math.abs(Number(f.w) || 4)),
            d = Math.max(0.05, Math.abs(Number(f.d) || 3)),
            z = Number(f.z) || 0,
            h = Math.max(0.05, Math.abs(Number(f.h) || 2.2)),
            x = Number(f.x) || 0,
            y = Number(f.y) || 0,
            rimH = clamp(Math.abs(Number(f.rimHeight) || Number(o.rimHeight) || 0.16), 0.01, h),
            over = Math.max(0, Math.abs(Number(f.rimOverhang) || Number(o.rimOverhang) || 0.18));
        const addBox = (fw, fd, z0, z1) => {
            for (const xx of [-fw / 2, fw / 2])
                for (const yy of [-fd / 2, fd / 2]) {
                    out.push(L2W(o, x + xx, y + yy, z0));
                    out.push(L2W(o, x + xx, y + yy, z1));
                }
        };
        addBox(w, d, z, z + h);
        // 上側の縁だけを外形へ含める。下側の縁は生成しない仕様と一致させる。
        addBox(w + over * 2, d + over * 2, z + h - rimH, z + h);
    });
    return out;
}
// オブジェクトのワールド軸外接箱を返す。
// 選択・ボックス選択・間取りヒット判定・スナップで共通利用する重要な関数。
function obBounds(o) {
    if (o?.attachment) o = syncAttachedPart(o);
    if (o?.type === "compound") return compoundBounds(o);
    if (isStackedBuildingAsset(o)) {
        const pts = stackedObjectCorners(o),
            lo = [1e9, 1e9, 1e9],
            hi = [-1e9, -1e9, -1e9];
        pts.forEach((p) =>
            p.forEach((v, j) => {
                lo[j] = Math.min(lo[j], v);
                hi[j] = Math.max(hi[j], v);
            }),
        );
        return { lo, hi };
    }
    // 屋台はカウンターと屋根が基準の奥行きより手前へ張り出すので、
    // 実寸から外接範囲を作る（選択枠・吸着・ボックス選択がずれないように）。
    if (o?.type === "asset" && o.asset === "stall" && typeof stallGeometry === "function") {
        const g = stallGeometry(o),
            hw = g.w / 2,
            hd = g.d / 2,
            lo = [1e9, 1e9, 1e9],
            hi = [-1e9, -1e9, -1e9];
        [-hw, hw].forEach((x) =>
            [-hd - g.ro, hd].forEach((y) =>
                [0, g.h].forEach((z) => {
                    const v = L2W(o, x, y, z);
                    for (let j = 0; j < 3; j++) {
                        lo[j] = Math.min(lo[j], v[j]);
                        hi[j] = Math.max(hi[j], v[j]);
                    }
                }),
            ),
        );
        return { lo, hi };
    }
    // 丸椅子は円柱を積んだ形なので、3段のうち一番太い半径で外接範囲を取る。
    if (o?.type === "asset" && o.asset === "stool" && typeof stoolGeometry === "function") {
        const g = stoolGeometry(o),
            r = Math.max(g.seatR, g.baseR),
            lo = [1e9, 1e9, 1e9],
            hi = [-1e9, -1e9, -1e9];
        for (let i = 0; i < 32; i++) {
            const t = (i / 32) * Math.PI * 2,
                x = Math.cos(t) * r,
                y = Math.sin(t) * r;
            [0, g.h].forEach((z) => {
                const v = L2W(o, x, y, z);
                for (let j = 0; j < 3; j++) {
                    lo[j] = Math.min(lo[j], v[j]);
                    hi[j] = Math.max(hi[j], v[j]);
                }
            });
        }
        return { lo, hi };
    }
    const sign = o.type === "asset" && o.asset === "sign",
        pts = [],
        solid =
            o.type === "box" ||
            o.type === "cyl" ||
            o.type === "triPrism" ||
            o.type === "triPyramid" ||
            ((o.type === "rect" || o.type === "circ") && o.extrude) ||
            sign,
        hs = solid ? (sign ? outerZRange(o) : [0, o.h]) : [0];
    if (o.type === "rect" || o.type === "box" || o.type === "triPrism" || o.type === "triPyramid" || sign)
        hs.forEach((z) =>
            [
                [-1, -1],
                [1, -1],
                [1, 1],
                [-1, 1],
            ].forEach(([a, b]) => pts.push(L2W(o, a * o.ra, b * o.rb, z))),
        );
    else
        for (let i = 0; i < 48; i++) {
            const t = (i / 48) * Math.PI * 2;
            hs.forEach((z) => pts.push(L2W(o, o.ra * Math.cos(t), o.rb * Math.sin(t), z)));
        }
    const lo = [1e9, 1e9, 1e9],
        hi = [-1e9, -1e9, -1e9];
    pts.forEach((v) => {
        for (let j = 0; j < 3; j++) {
            lo[j] = Math.min(lo[j], v[j]);
            hi[j] = Math.max(hi[j], v[j]);
        }
    });
    return { lo, hi };
}
// 動かしている図形以外の、くっつき先
function targetsOf(id) {
    const seen = new Set(),
        out = [];
    S.forEach((s) => {
        if (s.ob && objectVisible(s.ob) && s.ob.id !== id && !seen.has(s.ob.id)) {
            seen.add(s.ob.id);
            out.push({ id: s.ob.id, b: obBounds(s.ob) });
        }
    });
    return out;
}
// 複数選択を一体として動かすときの外周と吸着先。選択中同士は吸着候補から外す。
function groupBounds(objects) {
    const lo = [1e9, 1e9, 1e9],
        hi = [-1e9, -1e9, -1e9];
    objects.forEach((o) => {
        const b = obBounds(o);
        for (let j = 0; j < 3; j++) {
            lo[j] = Math.min(lo[j], b.lo[j]);
            hi[j] = Math.max(hi[j], b.hi[j]);
        }
    });
    return { lo, hi };
}
function targetsOfSet(ids) {
    const seen = new Set(),
        out = [];
    S.forEach((s) => {
        if (s.ob && objectVisible(s.ob) && !ids.has(s.ob.id) && !seen.has(s.ob.id)) {
            seen.add(s.ob.id);
            out.push({ id: s.ob.id, b: obBounds(s.ob) });
        }
    });
    return out;
}
function snapSetupGroup(objects, C3) {
    const ids = new Set(objects.map((o) => o.id));
    return { bb: groupBounds(objects), targets: targetsOfSet(ids), tau: tauOf(C3) };
}
// 画面上の吸着距離(px)を、その図形の位置でのワールドの長さにする
function tauOf(C3) {
    // 正投影ではカメラ距離を使うと吸着幅が極端に小さくなる。
    // orthScaleはpx／worldなので、表示上の磁石距離をそのままワールドへ直す。
    if (orthView) return Math.max(1, Number(P.sn) || 14) / Z / Math.max(1, Number(orthScale()) || 1);
    const rel = Math.max(0.05, Math.hypot(...V.add(C3, CO()))),
        f = T === "f" ? H / 2 / ((P.fov * DG) / 2) : (W * P.lens) / 36;
    return ((P.sn / Z) * rel) / f;
}
const snapSetup = (o, C3) => ({ bb: obBounds(o), targets: targetsOf(o.id), tau: tauOf(C3) });
// 移動量deltaを、他の図形の面や地面に近ければぴったりくっつくよう補正（軸ごと）
// 移動量deltaを、近くの外周面・角へ吸着させる。
// 対象軸だけ補正し、他軸の移動や親子接続を壊さない。
function snapShift(bb, delta, axes, targets, tau) {
    const d = [...delta],
        hit = new Set();
    axes.forEach((j) => {
        let best = null;
        const lo = bb.lo[j] + d[j],
            hi = bb.hi[j] + d[j],
            cand = [];
        targets.forEach((t) => {
            cand.push([t.b.lo[j], t.id, 1], [t.b.hi[j], t.id, 1]);
        });
        if (j === 1) cand.push([-1, "ground", 0]); // 地面(y=-1)には底だけ
        cand.forEach(([v, id, both]) =>
            (both ? [v - lo, v - hi] : [v - lo]).forEach((sft) => {
                if (Math.abs(sft) <= tau && (!best || Math.abs(sft) < Math.abs(best.s))) best = { s: sft, id };
            }),
        );
        if (best) {
            d[j] += best.s;
            hit.add(best.id);
        }
    });
    return { d, hit };
}
// オブジェクトの実際の外周を、面スナップ用の投影点として返す。
// 軸に平行なobBoundsだけに頼らないので、回転した図形でも辺を拾える。
function snapObjectCorners(o) {
    if (!o) return [];
    if (o.type === "compound") return compoundPartsAt(o).flatMap((part) => snapObjectCorners(part));
    if (isStackedBuildingAsset(o)) return stackedObjectCorners(o);
    const sign = o.type === "asset" && o.asset === "sign",
        solid =
            o.type === "box" ||
            o.type === "cyl" ||
            o.type === "triPrism" ||
            o.type === "triPyramid" ||
            ((o.type === "rect" || o.type === "circ") && o.extrude) ||
            o.type === "asset";
    const hs = solid ? (sign ? outerZRange(o) : [0, Math.max(0, Number(o.h) || 0)]) : [0],
        out = [];
    for (const x of [-Math.abs(Number(o.ra) || 0), Math.abs(Number(o.ra) || 0)])
        for (const y of [-Math.abs(Number(o.rb) || 0), Math.abs(Number(o.rb) || 0)])
            for (const z of hs) out.push(L2W(o, x, y, z));
    return out;
}
// 面の押し引きのスナップ。編集面の法線方向と、面内の辺の重なりを確認し、
// 隣接している対象の外周だけへ吸着する。ed.nはワールド単位ベクトルなので、
// 斜めに回転した図形にも同じ処理を適用できる。
function faceSnap(dl) {
    if (!$("snp")?.checked || !ed?.o0 || !ed?.n || !ed?.Fa) return dl;
    const o = ed.o0,
        n = V.nrm(ed.n),
        [iu, iv] = PL[o.k],
        cs = Math.cos(Number(o.rot || 0) * DG),
        sn = Math.sin(Number(o.rot || 0) * DG),
        eu = [0, 0, 0],
        ev = [0, 0, 0],
        en = [0, 0, 0];
    eu[iu] = cs;
    eu[iv] = sn;
    ev[iu] = -sn;
    ev[iv] = cs;
    en[o.k] = -o.d;
    const fid = String(ed.fid || ""),
        isU = fid[0] === "u",
        isV = fid[0] === "v",
        plus = fid === "top" || fid.endsWith("+");
    const tangents = isU ? [ev, en] : isV ? [eu, en] : [eu, ev],
        outerH = outerZRange(o)[1] - outerZRange(o)[0];
    const halves = isU
        ? [Math.abs(o.rb), outerH / 2]
        : isV
          ? [Math.abs(o.ra), outerH / 2]
          : [Math.abs(o.ra), Math.abs(o.rb)];
    const faceN0 = dot3(ed.Fa, n),
        faceN = faceN0 + dl,
        faceT = tangents.map((t) => dot3(ed.Fa, t)),
        tau = Math.max(0.04, Number(ed.tau) || 0.04),
        tol = Math.max(0.01, tau * 0.25);
    let best = null;
    ed.targets.forEach((t) => {
        const to = obOf(t.id),
            pts = snapObjectCorners(to);
        if (pts.length < 2) return;
        const proj = pts.map((p) => ({ n: dot3(p, n), t: tangents.map((a) => dot3(p, a)) }));
        const nMin = Math.min(...proj.map((p) => p.n)),
            nMax = Math.max(...proj.map((p) => p.n));
        for (let k = 0; k < 2; k++) {
            const tMin = Math.min(...proj.map((p) => p.t[k])),
                tMax = Math.max(...proj.map((p) => p.t[k])),
                fMin = faceT[k] - halves[k],
                fMax = faceT[k] + halves[k];
            if (Math.min(fMax, tMax) - Math.max(fMin, tMin) < -tol) return;
        }
        // 対象の下端・上端の両方を候補にする。面の接線方向が重なり、
        // かつ吸着距離内にある辺だけを通すので、遠い対象へは飛ばない。
        const candidates = [nMin, nMax];
        candidates.forEach((targetN) => {
            const gap = targetN - faceN;
            if (Math.abs(gap) <= tau && (!best || Math.abs(gap) < Math.abs(best.gap)))
                best = { gap, id: t.id, targetN };
        });
    });
    if (!best) return dl;
    snapHit = new Set([best.id]);
    // dlは編集面そのものの移動量なので、対象面との差を加えるだけでよい。
    return dl + (best.targetN - faceN);
}

function beginGizmo(h, p) {
    const o = h.g.o,
        r = unscr(p),
        co = CO(),
        group = o.attachment?.verticalOnly ? [o] : selectedObjects(),
        base = {
            id: o.id,
            o0: o.type === "compound" ? JSON.parse(JSON.stringify(o)) : { ...o },
            group: group.map((q) => ({ ...q, off: [...(q.off || [0, 0, 0])] })),
            started: false,
            ...(group.length > 1 ? snapSetupGroup(group, h.g.C3) : snapSetup(o, h.g.C3)),
        };
    if (h.t === "stack-floor") {
        const index = stackedIndividualEdit(o)
                ? clamp(Math.round(Number(h.floorIndex) || 0), 0, Math.max(0, (o.floors || []).length - 1))
                : 0,
            f = o.floors?.[index],
            q = stackedFloorScreen(o, index);
        if (f && q) {
            const zmid = (Number(f.z) || 0) + (Number(f.h) || 2.2) * 0.5,
                c = scrW(customPt(o, Number(f.x) || 0, Number(f.y) || 0, zmid)),
                bx = scrW(customPt(o, (Number(f.x) || 0) + 1, Number(f.y) || 0, zmid)),
                by = scrW(customPt(o, Number(f.x) || 0, (Number(f.y) || 0) + 1, zmid));
            setOb(o.id, { activeFloor: index });
            ed = {
                ...base,
                o0: { ...o, floors: (o.floors || []).map((floor) => ({ ...floor })) },
                t: "stack-floor-mv",
                floorIndex: index,
                p0: p,
                stackMove: {
                    x: Number(f.x) || 0,
                    y: Number(f.y) || 0,
                    bx: { x: (bx?.x || c.x) - c.x, y: (bx?.y || c.y) - c.y },
                    by: { x: (by?.x || c.x) - c.x, y: (by?.y || c.y) - c.y },
                },
            };
        }
    } else if (h.t === "wallSideSign-face") {
        const F0 = V.add(h.f.P3, co),
            t0 = lineParam(r, F0, h.f.n),
            faceGuide = faceScreenGuide(h.f);
        if (t0 != null || faceGuide)
            ed = {
                ...base,
                t: h.t,
                fid: h.f.id,
                n: h.f.n,
                F0,
                Fa: h.f.P3,
                t0,
                faceGuide,
                p0: p,
            };
    } else if (
        h.t.startsWith("sign-") ||
        h.t.startsWith("building-") ||
        h.t.startsWith("awning-") ||
        h.t.startsWith("stacked-") ||
        h.t === "stacked-bevel-offset" ||
        h.t.startsWith("path-point-") ||
        h.t === "path-radius" ||
        h.t === "beveled-offset" ||
        h.t === "cornerCut-offset" ||
        h.t.startsWith("cornerCut-opening-") ||
        h.t.startsWith("recessed-window-") ||
        h.t === "recessed-corner-bevel" ||
        h.t === "recessed-first-floor-height" ||
        h.t === "recessed-floor-height" ||
        h.t === "recessed-floor-gap" ||
        h.t === "wall-sign-bracket-length" ||
        h.t === "wall-sign-bevel" ||
        h.t === "window-grid-width" ||
        h.t === "window-grid-height" ||
        h.t === "balcony-thickness" ||
        h.t === "uWall-thickness" ||
        h.t.startsWith("stall-") ||
        h.t.startsWith("stool-") ||
        h.t.startsWith("railing-") ||
        h.t === "outdoor-fan-x" ||
        h.t === "signal-pole-h" ||
        h.t === "signal-head-w" ||
        h.t === "signal-head-d" ||
        h.t === "counter-length" ||
        h.t === "counter-depth" ||
        h.t === "counter-arm" ||
        h.t === "counter-top-t" ||
        h.t === "counter-base-h" ||
        h.t === "circle-radius" ||
        h.t === "wallSideSign-beveled-offset" ||
        h.t === "wallSideSign-bracket-length" ||
        h.t === "cone-height" ||
        h.t === "sphere-radius" ||
        h.t.startsWith("person-joint-")
    )
        ed = { ...base, t: h.t, sign: h.sign, p0: p };
    else if (h.t === "axis") {
        const C0 = V.add(h.g.C3, co),
            t0 = lineParam(r, C0, h.a.a),
            axisGuide = faceScreenGuide({ P3: h.g.C3, n: h.a.a });
        if (t0 != null || axisGuide)
            ed = { ...base, t: "axis", a: h.a.a, aj: h.a.a.indexOf(1), C0, t0, axisGuide, p0: p };
    } else if (h.t === "face") {
        const F0 = V.add(h.f.P3, co),
            t0 = lineParam(r, F0, h.f.n),
            faceGuide = faceScreenGuide(h.f);
        // 画面方向を基準にすると、ドラッグした側と反対へ拡大する跳ね返りを防げる。
        // guideがつぶれるビューでは、t0だけで不安定に動かさない。
        if (t0 != null || faceGuide) {
            const fj = [0, 1, 2].find((j) => Math.abs(h.f.n[j]) > 0.999);
            ed = {
                ...base,
                t: "face",
                fid: h.f.id,
                n: h.f.n,
                F0,
                Fa: h.f.P3,
                fj: fj === undefined ? -1 : fj,
                t0,
                faceGuide,
                p0: p,
            };
        }
    } else if (h.t === "tiltring") {
        // リング上の掴んだ位置のパラメータ角を覚えておき、ドラッグ中の角との差を
        // そのまま「軸まわりの回転角」として使う（どの向きから見ても同じ操作になる）。
        const t0 = ringParamAt(h.ring.poly, p);
        ed = {
            ...base,
            t: "tiltring",
            axisKey: h.ring.key,
            start: h.ring.key === "x" ? Number(o.rotX) || 0 : Number(o.rotZ) || 0,
            t0: t0 == null ? 0 : t0,
            tLast: t0 == null ? 0 : t0,
            acc: 0,
            deg: 0,
        };
    } else if (o.type === "compound")
        ed = { ...base, t: "ring", sC: h.g.sC, ang0: Math.atan2(p.y - h.g.sC.y, p.x - h.g.sC.x) };
    else {
        const dd = o.d - o.d * o.lift,
            C0 = cloc(o),
            P1 = hit3(r, o.k, dd, C0),
            [iu, iv] = PL[o.k],
            s0 = scrW(C0),
            unit = (j) => [j === 0 ? 1 : 0, j === 1 ? 1 : 0, j === 2 ? 1 : 0],
            pu = s0?.ok ? scrW(V.add(C0, unit(iu), 1, 1)) : null,
            pv = s0?.ok ? scrW(V.add(C0, unit(iv), 1, 1)) : null,
            // 面内2軸の画面上の伸び。正投影では画面移動量→面内座標の逆算に使う。
            plane =
                s0?.ok && pu?.ok && pv?.ok
                    ? {
                          s0,
                          su: { x: pu.x - s0.x, y: pu.y - s0.y },
                          sv: { x: pv.x - s0.x, y: pv.y - s0.y },
                      }
                    : null,
            uv = plane ? ringPlaneUV(plane, p) : null;
        if (P1)
            ed = { ...base, t: "ring", dd, ang0: Math.atan2(P1[iv] - o.cb, P1[iu] - o.ca), plane };
        else if (orthView && plane) {
            // 正投影では視線が面と平行になり、面との交点が取れない（前ビューの床面など）。
            // 画面の移動量をそのまま面内座標へ分解して角度を出せば、
            // どのビューでもリングを掴んで回せる。
            const ang0 = uv
                ? Math.atan2(uv.v, uv.u)
                : Math.atan2(p.y - s0.y, p.x - s0.x);
            ed = { ...base, t: "ring", dd, ang0, plane, screenRing: !uv };
        }
    }
}
// キャンバス上のドラッグで編集（ed=いまの編集操作）。磁石スナップがONなら他の図形・地面にくっつく
function dragEdit(p, freeRotation = false) {
    const o = ed.o0,
        [iu, iv] = PL[o.k],
        r = unscr(p),
        on = $("snp").checked;
    let patch = null;
    snapHit = null;
    const snap = (delta, axes) => {
        if (!on) return delta;
        const q = snapShift(ed.bb, delta, axes, ed.targets, ed.tau);
        if (q.hit.size) snapHit = q.hit;
        return q.d;
    };
    if (ed.t === "cornerCut-offset") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            offset = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = { cornerOffset: offset };
    } else if (ed.t.startsWith("cornerCut-opening-")) {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            amount = (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1),
            value = clamp(h.start + amount, h.min, h.max);
        if (ed.t.includes("width")) patch = { cornerCutOpeningW: value };
        else if (ed.t.includes("height")) patch = { cornerCutOpeningH: value };
        else patch = { cornerCutOpeningDepth: value };
    } else if (
        ed.t.startsWith("recessed-window-") ||
        ed.t === "recessed-corner-bevel" ||
        ed.t === "recessed-first-floor-height" ||
        ed.t === "recessed-floor-height" ||
        ed.t === "recessed-floor-gap"
    ) {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            amount = (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1),
            value = clamp(h.start + amount, h.min, h.max);
        patch = recessedHandlePatch(o, ed.t, value);
    } else if (ed.t.startsWith("path-point-")) {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            amount = (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1),
            path = pathPipeControlPoints(o).map((point) => [...point]);
        if (path[h.index]) {
            path[h.index][h.axis] = clamp(h.start + amount, h.min, h.max);
            patch = { path };
        }
    } else if (ed.t === "path-radius") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            radius = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = { pipeRadius: radius };
    } else if (ed.t === "wall-sign-bracket-length" || ed.t === "wall-sign-bevel") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            value = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = ed.t === "wall-sign-bevel" ? { wallSignBevelOffset: value } : { wallSignBracketLength: value };
    } else if (ed.t.startsWith("stool-")) {
        // 丸椅子の6つの寸法。半径は正円を保つため ra と rb を同じ値へそろえる。
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            value = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max),
            g = stoolGeometry(o);
        if (ed.t === "stool-seat-radius") patch = { stoolSeatRadius: value, ra: value, rb: value };
        else if (ed.t === "stool-base-radius") patch = { stoolBaseRadius: value };
        else if (ed.t === "stool-leg-radius") patch = { stoolLegRadius: value };
        else if (ed.t === "stool-seat-height") patch = { stoolSeatThickness: value };
        else if (ed.t === "stool-base-height") patch = { stoolBaseHeight: value };
        // ポールの高さは真ん中の段なので、全体の高さを変えて上下の段はそのまま残す。
        else if (ed.t === "stool-leg-height") patch = { h: value + g.seatT + g.baseH };
    } else if (ed.t === "circle-radius") {
        // 円・円柱の半径。幅と奥行きを同じ値にして、常に正円を保つ。
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            value = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = { ra: value, rb: value };
    } else if (ed.t.startsWith("stall-")) {
        // 屋台の寸法（カウンターの奥行き・高さ、屋根の張り出し・厚さ）。
        // どの値も「動かす面は1つだけ」なので、掴んだ向きの成分だけを足す。
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            value = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max),
            KEY = {
                "stall-wall-thickness": "stallWallThickness",
                "stall-counter-front": "stallCounterDepth",
                "stall-counter-top": "stallCounterHeight",
                "stall-roof-front": "stallRoofOverhang",
                "stall-roof-bottom": "stallRoofThickness",
            },
            key = KEY[ed.t];
        if (key) patch = { [key]: value };
    } else if (ed.t.startsWith("railing-")) {
        // 手すりの角材の太さ・下の横桟の高さ。ドラッグ量は画面の向きに投影済み。
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            value = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max),
            KEY = {
                "railing-thickness": "railingThickness",
                "railing-bottom": "railingBottomGap",
                "railing-count": "railingCount",
            },
            key = KEY[ed.t],
            // 本数は整数。ほかの2つは 0.001 刻みで扱う（数値欄と同じ桁）。
            num = h.integer ? Math.round(value) : Math.round(value * 1000) / 1000;
        if (key) patch = { [key]: num };
    } else if (ed.t === "counter-length") {
        // 長さ（＝左右の幅）。左右へ同じだけ伸びる。
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            value = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = { ra: Math.round(value * 500) / 1000 };
    } else if (ed.t === "counter-arm") {
        // L字・コの字の腕の太さ。天板も土台も同じ太さで一緒に変わる。
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            value = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = { ctArm: Math.round(value * 1000) / 1000 };
    } else if (ed.t === "counter-depth") {
        // 奥行き（縦の長さ）。L字・コの字の腕の長さもこれで決まる。
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            value = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = { rb: Math.round(value * 500) / 1000 };
    } else if (ed.t === "counter-top-t") {
        // 天板の厚さ。全体の高さ h は変えず、土台がその分だけ縮む。
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            value = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = { ctTopT: Math.round(value * 1000) / 1000 };
    } else if (ed.t === "counter-base-h") {
        // 土台の高さ。天板は土台の上に載っているので、全体の高さ h を同じだけ変える。
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            value = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        const topT = counterGeometry(ed.o0).topT;
        patch = { h: Math.round((value + topT) * 1000) / 1000 };
    } else if (ed.t === "signal-head-w" || ed.t === "signal-head-d") {
        // 頭の幅（左右）と奥行き（前後）。左右・前後は対称に広がる。
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            value = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max),
            half = Math.round(value * 500) / 1000;
        patch = ed.t === "signal-head-w" ? { ra: half } : { rb: half };
    } else if (ed.t === "signal-pole-h") {
        // ポールの高さ（＝アセットの高さ）。頭はポールの上に載るので、
        // 伸ばすと信号機・標識ごと上へ上がる。
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            value = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = { h: Math.round(value * 1000) / 1000 };
    } else if (ed.t === "outdoor-fan-x") {
        // 室外機のファンの左右位置。実寸（m）なので、幅を変えても円は動かない。
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            value = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = { ouFanX: Math.round(value * 1000) / 1000 };
    } else if (ed.t === "balcony-thickness" || ed.t === "uWall-thickness") {
        // ベランダ／コの字壁の厚さ。ドラッグ量は画面の向きに投影済み。
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            value = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        if (ed.t === "uWall-thickness") patch = { uWallThickness: value };
        else {
            // ベランダは床と壁が同じ厚さなので、厚くすると全体の高さもその分だけ伸びる
            //（数値パネルと同じ扱い）。
            const g = balconyGeometry(o);
            patch = { balconyThickness: value, h: value + g.railH };
        }
    } else if (ed.t === "window-grid-width" || ed.t === "window-grid-height") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            value = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        // 窓の幅・高さは寸法そのものなので、そのまま数値を書き換える。
        patch = ed.t === "window-grid-width" ? { windowW: value } : { windowH: value };
    } else if (ed.t.startsWith("person-joint-")) {
        // 関節は「支点からの回転」なので、画面の接線方向のドラッグ量を
        // そのまま角度（度）へ換算する。0.5度刻みに丸める。
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            amount = (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1),
            value = clamp(h.start + amount, h.min, h.max);
        // 関節を回したらプリセットからは外れる（数値欄も「カスタム」表示になる）。
        patch = { [h.key]: Math.round(value * 2) / 2, pose: "custom" };
    } else if (ed.t === "beveled-offset") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            offset = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = { bevelOffset: offset };
    } else if (ed.t === "wallSideSign-bracket-length") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            length = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = { wallSideSignBracketLength: length };
    } else if (ed.t === "wallSideSign-beveled-offset") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            offset = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = {
            wallSideSignShape: offset > 0.0001 ? "beveled" : "box",
            wallSideSignBevelOffset: offset,
            wallSideSignBevelSegments: 4,
        };
    } else if (ed.t.startsWith("building-")) {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            amount = (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1);
        if (ed.t === "building-backFace")
            patch = { openingBack: clamp(h.start + (h.factor || 1) * amount, h.min, h.max) };
        else if (ed.t.includes("OpeningH")) patch = { openingH: clamp(h.start + amount, h.min, h.max) };
        else patch = { openingW: clamp(h.start + (h.factor || 1) * amount, h.min, h.max) };
    } else if (ed.t === "stack-floor-mv") {
        const h = ed.stackMove,
            dx = p.x - ed.p0.x,
            dy = p.y - ed.p0.y,
            det = h.bx.x * h.by.y - h.bx.y * h.by.x;
        let mx = 0,
            my = 0;
        if (Math.abs(det) > 1e-6) {
            mx = (dx * h.by.y - dy * h.by.x) / det;
            my = (h.bx.x * dy - h.bx.y * dx) / det;
        } else if (Math.hypot(h.bx.x, h.bx.y) >= Math.hypot(h.by.x, h.by.y)) {
            const n = Math.hypot(h.bx.x, h.bx.y) || 1;
            mx = (dx * h.bx.x + dy * h.bx.y) / (n * n);
        } else {
            const n = Math.hypot(h.by.x, h.by.y) || 1;
            my = (dx * h.by.x + dy * h.by.y) / (n * n);
        }
        const floors = Array.isArray(o.floors) ? o.floors.map((f) => ({ ...f })) : [],
            floor = floors[ed.floorIndex],
            individual = stackedIndividualEdit(o);
        if (floor) {
            let nextX = h.x + mx,
                nextY = h.y + my;
            if (!individual && $("snp")?.checked) {
                // ローカル階座標をワールドX/Zの移動量へ変換してから吸着する。
                // そのまま画面量だけを補正すると、回転した建物では別方向へずれる。
                const a = Number(o.rot || 0) * DG,
                    cs = Math.cos(a),
                    sn = Math.sin(a),
                    raw = [
                        (nextX - (Number(floor.x) || 0)) * cs - (nextY - (Number(floor.y) || 0)) * sn,
                        0,
                        (nextX - (Number(floor.x) || 0)) * sn + (nextY - (Number(floor.y) || 0)) * cs,
                    ],
                    q = snapShift(ed.bb, raw, [0, 2], ed.targets, ed.tau);
                snapHit = q.hit.size ? q.hit : null;
                nextX = (Number(floor.x) || 0) + q.d[0] * cs + q.d[2] * sn;
                nextY = (Number(floor.y) || 0) - q.d[0] * sn + q.d[2] * cs;
            }
            if (individual) {
                floor.x = nextX;
                floor.y = nextY;
                patch = {
                    floors,
                    activeFloor: ed.floorIndex,
                    h: (Number(floors[floors.length - 1]?.z) || 0) + (Number(floors[floors.length - 1]?.h) || 0),
                };
            } else {
                // 通常モードの1F移動は階のx/yではなく建物本体を移動する。
                // これで全階が同じ量だけ動き、3Dの回転リングも移動後の
                // 建物中心へ追従する。
                const dx = nextX - (Number(floor.x) || 0),
                    dy = nextY - (Number(floor.y) || 0),
                    a = Number(o.rot || 0) * DG,
                    cs = Math.cos(a),
                    sn = Math.sin(a);
                patch = {
                    ca: (Number(o.ca) || 0) + dx * cs - dy * sn,
                    cb: (Number(o.cb) || 0) + dx * sn + dy * cs,
                    activeFloor: 0,
                    h: (Number(floors[floors.length - 1]?.z) || 0) + (Number(floors[floors.length - 1]?.h) || 0),
                };
            }
        }
    } else if (ed.t === "stacked-bevel-offset") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            floors = Array.isArray(o.floors) ? o.floors.map((f) => ({ ...f })) : [],
            floor = floors[h.floorIndex],
            offset = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        if (floor) {
            floor.bevelOffset = offset;
            if (!stackedIndividualEdit(o) && h.floorIndex === 0) floors.forEach((f) => (f.bevelOffset = offset));
            const last = floors[floors.length - 1];
            patch = {
                floors,
                bevelOffset: offset,
                floorCount: floors.length,
                h: (Number(last?.z) || 0) + (Number(last?.h) || 0),
            };
        }
    } else if (ed.t.startsWith("stacked-opening-")) {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            amount = (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1),
            value = clamp(h.start + (h.factor || 1) * amount, h.min, h.max);
        patch =
            ed.t === "stacked-opening-w-left" || ed.t === "stacked-opening-w-right"
                ? { openingW: value }
                : ed.t === "stacked-opening-h"
                  ? { openingH: value }
                  : { openingBack: value };
    } else if (ed.t.startsWith("stacked-")) {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            amount = (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1),
            floors = Array.isArray(o.floors) ? o.floors.map((f) => ({ ...f })) : [],
            floor = floors[h.floorIndex];
        if (floor) {
            const key = h.axis === "w" ? "w" : h.axis === "d" ? "d" : "h";
            floor[key] = clamp(h.start + amount, h.min, h.max);
            if (!stackedIndividualEdit(o) && h.floorIndex === 0 && ["w", "d", "h"].includes(key))
                floors.forEach((f) => (f[key] = floor[key]));
            const last = floors[floors.length - 1];
            patch = { floors, floorCount: floors.length, h: (Number(last?.z) || 0) + (Number(last?.h) || 0) };
        }
    } else if (ed.t === "awning-edgeZ") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            amount = (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1);
        // 直方体（上辺が水平・前面が垂直）へ近づいたら、ぴったり吸着させる。
        // 上辺が水平（＝直方体）と、一番下（＝三角柱）の両方へ吸着させる。
        patch = {
            awningEdgeZ: snapAwningEdge(
                snapAwningEdge(clamp(h.start + amount, h.min, h.max), h.max),
                h.min,
            ),
            awningFrontBottom: h.frontBottom,
            awningEdgeEdited: true,
        };
        // 2軸目（手前奥）も一緒に動かす。前縁の点を画面の好きな方向へ引ける。
        if (h.dir2) {
            const amount2 = (deltaX * h.dir2.x + deltaY * h.dir2.y) / (h.scale2 || 1);
            patch.awningEdgeY = snapAwningEdge(
                snapAwningEdge(clamp(h.start2 + amount2, h.min2, h.max2 ?? 20), h.min2),
                h.max2,
            );
        }
    } else if (ed.t === "sign-faceW" || ed.t === "sign-faceH") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            amount = (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1);
        const min = h.min,
            max = h.max,
            v = clamp(h.start + amount, min, max);
        patch = { [ed.t === "sign-faceW" ? "faceW" : "faceH"]: v };
    } else if (ed.t === "cone-height") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            v = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = { h: v };
    } else if (ed.t === "sphere-radius") {
        const h = ed.sign,
            deltaX = p.x - ed.p0.x,
            deltaY = p.y - ed.p0.y,
            radius = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max);
        patch = { ra: radius, rb: radius, h: radius * 2 };
    } else if (ed.t === "mv") {
        // 間取りモードは表示面内を移動させる。高さ・接地状態は専用の
        // 正面／横ギズモで編集し、生成面がX/Zでも位置移動を止めない。
        const floorMove = !!window.cityFloorPlanActive,
            plane = floorMove && o.k === 1 ? -1 : o.d - o.d * o.lift;
        const P1 = hit3(r, o.k, plane, cloc(o)); // 線をドラッグ＝面の上で移動
        if (P1 && ed.P0) {
            const dl = [0, 0, 0];
            dl[iu] = P1[iu] - ed.P0[iu];
            dl[iv] = P1[iv] - ed.P0[iv];
            const q = snap(dl, [iu, iv]);
            // 複数選択時は主役のドラッグ量をワールド移動量として全員へ同じように適用する。
            if (ed.group && ed.group.length > 1) {
                ed.moveDelta = [q[0], q[1], q[2]];
                patch = moveBy(o, ed.moveDelta);
            } else patch = moveBy(o, q); /* 間取りではca/cbだけを変え、Y方向のliftとoffは保持する。 */
        }
    } else if (ed.t === "axis") {
        let amount = null;
        if (ed.axisGuide?.hidden) {
            // 画面上で潰れている軸は、決まった向き（画面の左上）を動かした量で代用する。
            // 以前は「このビューでは動かない」としていたが、それだと 3D でできる移動が
            // 前・横・上ではできない、という差が出る（面ハンドルと同じ扱いに揃える）。
            const dx = p.x - ed.p0.x,
                dy = p.y - ed.p0.y;
            amount = (dx * ed.axisGuide.dir.x + dy * ed.axisGuide.dir.y) / (ed.axisGuide.scale || 1);
        }
        else if (ed.axisGuide) {
            const dx = p.x - ed.p0.x,
                dy = p.y - ed.p0.y;
            amount = (dx * ed.axisGuide.dir.x + dy * ed.axisGuide.dir.y) / (ed.axisGuide.scale || 1);
        } else {
            const t = lineParam(r, ed.C0, ed.a);
            if (t != null && ed.t0 != null) amount = t - ed.t0;
        }
        if (amount != null) {
            // 壁横看板の前後軸はワールドX/Zの単一軸ではないため、
            // 回転した建物でも軸方向を保ち、通常のXYZ軸だけスナップする。
            const snapAxes = Number.isInteger(ed.aj) && ed.aj >= 0 ? [ed.aj] : [];
            ed.moveDelta = snap(
                ed.a.map((x) => x * amount),
                snapAxes,
            );
            patch = moveBy(o, ed.moveDelta);
        }
    } // 矢印＝その軸に沿って移動
    else if (ed.t === "wallSideSign-face") {
        let dl = null;
        if (ed.faceGuide) {
            const dx = p.x - ed.p0.x,
                dy = p.y - ed.p0.y;
            dl = (dx * ed.faceGuide.dir.x + dy * ed.faceGuide.dir.y) / (ed.faceGuide.scale || 1);
        } else {
            const t = lineParam(r, ed.F0, ed.n);
            if (t != null && ed.t0 != null) dl = t - ed.t0;
        }
        if (dl != null) patch = wallSideSignFacePatch(o, ed.fid, dl);
    } else if (ed.t === "face") {
        let dl = null;
        // faceGuide が hidden でも dir/scale は画面の上向きへの逃がし値が入っている。
        // （以前は hidden のとき dl=0 にして、そのビューでは編集できないようにしていた）
        if (ed.faceGuide) {
            const dx = p.x - ed.p0.x,
                dy = p.y - ed.p0.y;
            dl = (dx * ed.faceGuide.dir.x + dy * ed.faceGuide.dir.y) / (ed.faceGuide.scale || 1);
        } else {
            const t = lineParam(r, ed.F0, ed.n);
            if (t != null && ed.t0 != null) dl = t - ed.t0;
        }
        if (dl != null) {
            const moved = o.type === "compound" ? dl : faceSnap(dl);
            patch =
                o.type === "compound"
                    ? compoundFacePatch(o, ed.fid, moved)
                    : o.type === "asset" && o.asset === "building"
                      ? buildingOuterFacePatch(o, ed.fid, moved)
                      : facePatch(o, ed.fid, moved);
        }
    } // 白い四角＝面の押し引き
    else if (ed.t === "tiltring") {
        // 掴んだリングをもう一度クリックした位置のパラメータ角を読む。
        const ring = (ed.ringSel ||= (() => {
                const g = gizmo();
                return (g?.rings || []).find((q) => q.key === ed.axisKey) || null;
            })()),
            t = ring ? ringParamAt(ring.poly, p) : null;
        if (t != null) {
            // 連続で回せるよう、前回との差を積算する（0°/360°をまたいでも飛ばない）。
            ed.acc += wrapPi(t - ed.tLast);
            ed.tLast = t;
            const raw = ed.acc / DG,
                target = freeRotation ? ed.start + raw : Math.round((ed.start + raw) / 15) * 15;
            patch = { [ed.axisKey === "x" ? "rotX" : "rotZ"]: wrap180(target) };
        }
    } // リング＝傾き（左右X・手前奥Y）
    else if (ed.t === "ring") {
        if (o.type === "compound") {
            const raw = wrap180((Math.atan2(p.y - ed.sC.y, p.x - ed.sC.x) - ed.ang0) / DG),
                base = Number(o.compoundRot) || 0,
                target = freeRotation ? base + raw : Math.round((base + raw) / 15) * 15;
            patch = rotateCompoundBy(ed.o0 || o, target - base);
        } else {
            let raw = null;
            if (!orthView) {
                // 3Dは従来どおり、視線と面が交わる点の角度を使う。
                const P1 = hit3(r, o.k, ed.dd, cloc(o));
                if (P1) raw = (Math.atan2(P1[iv] - o.cb, P1[iu] - o.ca) - ed.ang0) / DG;
            } else if (ed.plane) {
                // 正投影は画面の移動量を面内座標へ分解して角度を出す
                // （前ビューの床面のように面が真横を向く場合は画面角度で代用）。
                const uv = ed.screenRing ? null : ringPlaneUV(ed.plane, p);
                raw = uv
                    ? (Math.atan2(uv.v, uv.u) - ed.ang0) / DG
                    : (Math.atan2(p.y - ed.plane.s0.y, p.x - ed.plane.s0.x) - ed.ang0) / DG;
            }
            if (raw != null) {
                const target = freeRotation ? Number(o.rot || 0) + raw : Math.round((Number(o.rot || 0) + raw) / 15) * 15;
                patch = { rot: wrap180(target) };
            }
        }
    } // 輪＝回転（通常15°吸着、Shiftで自由回転）
    if (!patch) return;
    if (!ed.started) {
        HU.push(S);
        RD = [];
        ed.started = true;
    }
    if ((ed.t === "mv" || ed.t === "axis") && ed.group && ed.group.length > 1 && ed.moveDelta) {
        // 初期スナップショットから再生成するので、ポインタ移動のたびに位置が累積しない。
        const ids = new Set(ed.group.map((g) => g.id));
        ed.group.forEach((g) => {
            const q = moveBy(g, ed.moveDelta, !!(g.attachment?.parentId && ids.has(g.attachment.parentId)));
            setOb(g.id, q);
        });
    } else setOb(ed.id, patch);
    renderSoon(); // ポインタ移動ごとに呼ばれるので、フレームに1回へまとめる
}
