
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
let W = 1600, H = 900;                       // キャンバスの内部サイズ（比率変更でHが変わる）

// ===== パラメータ（初期値の水平回転は参考サイトのy=39.912） =====
const MASTER_W = 1.5;
const P = { lens: 35, yaw: 39.912, hz: 50, pitch: 0, fov: 180, roll: 0, n: 48, ga: 0.45, gw: 0.7, pw: MASTER_W, pa: 0.5, ew: 24, bt: 128, hr: 100, ch: 1, cx: 0, cz: 0, sn: 14, gs: 1, gn: 30, dp: 8 };
const show = [true, true, true];            // 軸ごとの補助線表示
let S = [], RD = [], HU = [], Z = 1, ox = 0, oy = 0, mg = null, ptrType = null, er = null, tool = 'pen', sh = null, prev = null, CR = null, bd = false, snapHit = null, sel = null, selIds = new Set(), ed = null, cur = null, drag = null, IMG = null, mode = 'view', AX = [], AXC = [], T = 'r';  // T: 'r'=通常の透視 / 'f'=魚眼
let orthView = null, standardApplying = false; // Blender風の正面・真横・真上では正投影を使う

// ===== 操作パネルの組み立て =====
const R = (k, t, min, max, st, u = '') => `<label><span>${t}</span><input type=range id=${k} min=${min} max=${max} step=${st}><input type=number class=nv id=v_${k} step=${st}><span class=un>${u}</span></label>`;   // スライダー＋数値入力
const RO = (k, t, min, max, st, u = '') => `<label><span>${t}</span><input type=range id=or_${k} min=${min} max=${max} step=${st}><input type=number class=nv id=ov_${k} step=${st}><span class=un>${u}</span></label>`;   // 選択中の図形用
$('side').innerHTML = `
<h3>グリッドの種類</h3>
<label><select id=gt style="flex:1"><option value=1>1点透視<option value=2 selected>2点透視<option value=3>3点透視<option value=5>魚眼 5点<option value=6>魚眼 6点</select></label>
<h3>カメラ（視点）</h3>
<div class=gr>${R('lens', 'レンズ', 14, 200, 1, 'mm')}</div>
<div class=gf>${R('fov', '魚眼の画角', 90, 360, 1, '°')}${R('roll', 'ロール(傾け)', -180, 180, 0.1, '°')}</div>
${R('yaw', '水平回転', -90, 90, 0.001, '°')}
<div class=gr>${R('hz', '地平線の高さ', -50, 150, 0.1, '%')}</div>
${R('pitch', '上下の傾き', -60, 60, 0.1, '°')}
${R('ch', 'カメラの高さ', 0.05, 30, 0.01)}
${R('cx', 'カメラ位置 X', -30, 30, 0.01)}
${R('cz', 'カメラ位置 Z', -30, 30, 0.01)}
<div class="note">カメラの高さは地面からの高さ（初期値1）。カメラを動かすと、図形（3D）は見え方が変わります。ペンで描いた線は「空に描いたもの」なので動きません</div>
<div class="note gr">3点透視：傾きを0以外にすると垂直もVP3に集まります</div>
<div class="note gf">魚眼：線は曲線（大円）になります。5点＝光軸がZ軸、6点＝軸を回して6点とも見せます</div>
<label><span>画面比率</span><select id=ar><option value=1.7778>16:9<option value=1.3333>4:3<option value=1.5>3:2<option value=1>1:1<option value=0.8>4:5<option value=0.5625>9:16</select></label>
<h3>補助線（細かくできます）</h3>
${R('n', '本数（各VP）', 2, 400, 1, '本')}
${R('ga', '濃さ', 0.05, 1, 0.01)}
${R('gw', '線の太さ', 0.2, 3, 0.1, 'px')}
<label><span>表示する軸</span>
 <span><input type=checkbox data-i=0 checked>VP1 <input type=checkbox data-i=1 checked>VP2 <input type=checkbox data-i=2 checked>垂直</span></label>
<label><input type=checkbox id=gg checked> 地面のグリッド（カメラの高さ・位置で見え方が変わる）</label>
${R('gs', 'マスの大きさ', 0.1, 10, 0.05)}
${R('gn', 'マスの数（片側）', 2, 60, 1)}
<label><input type=checkbox id=gon checked> 補助線を表示</label>
<label><input type=checkbox id=hzl checked> 地平線を表示</label>
<label><input type=checkbox id=bgw checked> 背景を白にする</label>
<h3>ペン</h3>
<label><input type=checkbox id=pn checked> iPad：指＝視点／ペン＝描画</label>
<div class="note">二本指タップ＝元に戻す／三本指タップ＝やり直し／二本指ピンチ＝ズーム・移動<br>オフだと上の①②ボタンのモードで全部の入力を扱います</div>
<label><span>スナップ</span><select id=snap><option value=auto>自動（向きで判定）<option value=0>VP1に固定<option value=1>VP2に固定<option value=2>垂直(VP3)に固定<option value=free>フリーハンド</select></label>
<label><input type=checkbox id=p3 checked> 線を3D空間に固定（視点移動に追従）</label>
${R('dp', '奥行き', 1, 100, 0.5)}
<div class="note">描画した線は3D空間に固定されます。視点を回転・水平移動すると、線画の見え方も変わります。</div>
${R('pw', '線の太さ（全体）', 0.5, 20, 0.5, 'px')}
<div class="note">描画線・図形・アセットを含む全ての線画に反映されます。</div>
<label><span>色</span><input type=color id=pc value="#222222"></label>
<label><input type=checkbox id=bin checked> 線画のアンチエイリアスをオフ（二値）</label>
${R('bt', 'しきい値', 16, 240, 1)}
<div class="note">値を下げると線が太く、上げると細くなります。細い線(1px未満)は消えやすいので、太さは1px以上がおすすめ</div>
<h3>図形（上の「図形」ボタンでON/OFF）</h3>
<label><span>種類</span><select id=shT style="flex:1"><option value=rect>長方形・正方形<option value=circ>円・楕円<option value=triPrism>三角柱<option value=triPyramid>三角錐</select></label>
<label><span>置く面</span><select id=shK style="flex:1"><option value=1>床・天井（水平）<option value=2>壁（VP1に向かう面）<option value=0>壁（VP2に向かう面）</select></label>
<label><input type=checkbox id=sq> 正方形／真円に固定</label>
<label><input type=checkbox id=wf> 裏側の線も描く（ワイヤー）</label>
<label><input type=checkbox id=snp checked> 磁石でスナップ（他の図形・地面にくっつく）</label>
${R('sn', '吸着する距離', 4, 60, 1, 'px')}
${R('hr', '高さ（短辺の％）', 10, 400, 1, '%')}
<div class="note">ドラッグした2点が対角になります。描き終わると自動的に編集モードへ切り替わります。選択中の白いハンドル、または「押し出しを有効」から厚みを作れます。</div>
<div class="note">「図形編集」ボタンをONにして図形の線にさわると選択できます（描いた直後は自動で選択）。<br>・色つきの矢印＝その軸（X赤・Y青・Z緑）に沿って移動<br>・白い四角＝その面を押し引き（幅・奥行き・高さが変わる）<br>・点線の輪＝回転<br>・線そのものをドラッグ＝面の上で移動<br>下の数値でも微調整できます。消しゴムで消した図形は編集できなくなります</div>
<div id=objP style="display:none">
<h3>選択中の図形</h3>
${RO('rot', '回転', -180, 180, 0.1, '°')}
<label><span>幅</span><input type=number class=nv id=ov_w step=0.05 style="width:100px"></label>
<label><span>奥行き</span><input type=number class=nv id=ov_dp step=0.05 style="width:100px"></label>
<label><span>高さ</span><input type=number class=nv id=ov_h step=0.05 style="width:100px"></label>
<label><span>位置 X(赤)</span><input type=number class=nv id=ov_px step=0.05 style="width:100px"></label>
<label><span>位置 Y(高さ)</span><input type=number class=nv id=ov_py step=0.05 style="width:100px"></label>
<label><span>位置 Z(緑)</span><input type=number class=nv id=ov_pz step=0.05 style="width:100px"></label>
<div id=signP style="display:none"><h3>看板の内側</h3>
<label><span>絵枠の幅</span><input type=number class=nv id=ov_faceW step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>絵枠の高さ</span><input type=number class=nv id=ov_faceH step=0.01 style="width:100px"><span class=un>m</span></label>
<label><span>角のベベル</span><input type=number class=nv id=ov_bevel step=0.01 style="width:100px"><span class=un>m</span></label>
</div>
<label><button id=obExtrude>押し出しを有効</button><button id=obGnd>地面につける</button><button id=obDup>複製</button><button id=obDel>削除</button><button id=obOff>選択解除</button></label>
<div class="note">位置は底面の中心です。Yは地面からの高さ（0で地面につく）、X・Zは床の方向（VP1・VP2側）です</div>
</div>
<h3>書き出し範囲（上の「範囲」ボタン）</h3>
<label><input type=checkbox id=zf checked> ズーム中は画面に見えている範囲だけ保存</label>
<label><button id=crF>線画に合わせる</button><button id=crC>範囲を解除</button></label>
<div class="note">範囲を指定すると、PNG保存・コピーはその範囲だけ切り取られます（補助線・線画とも）</div>
<h3>消しゴム（上の「消しゴム」ボタンでON/OFF）</h3>
<label><span>方式</span><select id=em><option value=part>部分消し<option value=all>線ごと消す</select></label>
${R('ew', '大きさ', 4, 150, 1, 'px')}
<h3>参考写真</h3>
<label><input type=file id=ph accept="image/*"></label>
${R('pa', '写真の濃さ', 0, 1, 0.05)}
<label><button id=phx>写真を外す</button></label>
<div class="note">貼り付け(Ctrl+V)・ドロップも可</div>
<h3>保存</h3>
<div class="note">上の「保存」で今の状態（視点・設定・線画・写真）をファイルに保存し、「開く」で続きから再開できます。<br>このブラウザには3秒ごとに自動保存され、次に開いたとき自動で復元されます。</div>
<label><button id=rst>自動保存を消して初期化</button></label>
<h3>読み取り</h3><div id=info class="note"></div>`;

// ===== 見出しごとに折りたためるようにする（開閉の状態は覚える） =====
(function () {
	const side = $('side'), kids = [...side.children], closedDef = ['グリッドの種類', 'カメラ', '補助線', 'ペン', '図形', '選択中の図形', '書き出し範囲', '消しゴム', '参考写真', '保存', '読み取り']; let st = {}, det = null;
	try { if (localStorage.getItem('city-grid-ui-compact-v1') !== '1') { localStorage.removeItem('pgrid-sec'); localStorage.setItem('city-grid-ui-compact-v1', '1') } st = JSON.parse(localStorage.getItem('pgrid-sec') || '{}') } catch (e) { }
	side.innerHTML = '<div class="secbar"><button id=secC>すべて閉じる</button><button id=secO>すべて開く</button></div>';
	kids.forEach(k => {
		if (k.tagName === 'H3') {
			const name = k.textContent.replace(/（.*）/, ''), d = document.createElement('details'), sm = document.createElement('summary');   // かっこ書きは除いた名前で状態を覚える
			d.open = name in st ? st[name] : !closedDef.includes(name); sm.textContent = k.textContent; d.appendChild(sm); side.appendChild(d);
			d.ontoggle = () => { st[name] = d.open; try { localStorage.setItem('pgrid-sec', JSON.stringify(st)) } catch (e) { } }; det = d;
		} else if (det) det.appendChild(k); else side.appendChild(k)
	});
	$('secC').onclick = () => side.querySelectorAll('details').forEach(d => d.open = false);
	$('secO').onclick = () => side.querySelectorAll('details').forEach(d => d.open = true);
})();
// 図形はアセット棚（長方形・円など）を使うため、旧式の「作成設定」だけ非表示にする。
// 選択後に表示する objP（幅・高さ・削除など）は残し、既存データとの互換性も保つ。
function hideLegacyShapeControls() {
	[...$('side').querySelectorAll('details')].forEach(d => {
		const sm = d.querySelector('summary');
		if (!sm || !sm.textContent.trim().startsWith('図形')) return;
		sm.textContent = '選択中のオブジェクト';
		let legacy = true;
		[...d.children].forEach(ch => {
			if (ch === sm) return;
			if (ch.id === 'objP') { legacy = false; return }
			if (legacy) ch.style.display = 'none';
		});
	});
}
hideLegacyShapeControls();

// ===== 値の同期 =====
function sync() { for (const k in P) { const el = $('v_' + k); if (el && document.activeElement !== el) el.value = +(+P[k]).toFixed(3) } }   // 入力中の欄は上書きしない
function leaveOrthView(changedKey) {
	if (standardApplying) return;
	// 間取り中のレンズ変更は正投影を解除せず、カメラの画角だけを更新する。
	if (window.cityFloorPlanActive && changedKey === 'lens') return;
	if (orthView === 'top' && changedKey !== 'pitch') { P.pitch = -75; const pitchInput = $('pitch'); if (pitchInput) pitchInput.value = -75 } orthView = null
}
function setP(k, v) { leaveOrthView(k); P[k] = v; const input = $(k); if (input) input.value = v }
for (const k in P) {
	const el = $(k); el.value = P[k]; el.oninput = () => { leaveOrthView(k); P[k] = +el.value; sync(); render() };
	const nv = $('v_' + k);   // 数値の直接入力（スライダーの範囲内に収める。本数だけは3000まで）
	nv.oninput = () => { let v = parseFloat(nv.value); if (isNaN(v)) return; leaveOrthView(k); v = Math.max(+el.min, Math.min(k === 'n' ? 3000 : +el.max, v)); P[k] = v; if (v >= +el.min && v <= +el.max) el.value = v; render() };
	nv.onchange = () => { nv.value = +P[k].toFixed(3) }
}
document.querySelectorAll('[data-i]').forEach(el => el.onchange = () => { show[el.dataset.i] = el.checked; render() });
['gon', 'hzl', 'bgw', 'snap', 'bin', 'gg'].forEach(k => $(k).onchange = render);
$('ar').onchange = () => { H = Math.round(W / +$('ar').value); cv.width = W; cv.height = H; fit() };

// ===== 画面サイズに合わせて表示 =====
function fit() { const st = $('stage'), s = Math.min((st.clientWidth - 12) / W, (st.clientHeight - 12) / H); cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px'; render() }
addEventListener('resize', fit);

// ===== 消失点の計算（カメラ→VP） =====
// 軸: 0=X方向, 1=Z方向, 2=垂直。VPが無限遠なら dir(平行線の向き) を返す
function calc() {
	const f = W * P.lens / 36, th = P.yaw * Math.PI / 180, ph = P.pitch * Math.PI / 180, cx = W / 2, cy = H * P.hz / 100;
	AX = [[1, 0, 0], [0, 0, 1], [0, 1, 0]].map(v => {
		const x1 = v[0] * Math.cos(th) + v[2] * Math.sin(th), z1 = -v[0] * Math.sin(th) + v[2] * Math.cos(th);
		const y2 = v[1] * Math.cos(ph) - z1 * Math.sin(ph), z2 = v[1] * Math.sin(ph) + z1 * Math.cos(ph);
		if (Math.abs(z2) < 2e-3) { const l = Math.hypot(x1, y2) || 1; return { dir: { x: x1 / l, y: -y2 / l } } }
		return { vp: { x: cx + f * x1 / z2, y: cy - f * y2 / z2 } };
	});
	AX.f = f; AX.hy = cy + f * Math.tan(ph);        // hy=地平線のy
}
// 点aでの軸iの向き（単位ベクトル）
function dirAt(a, i) { if (T === 'f') return dirF(a, i); const A = AX[i]; if (A.dir) return A.dir; const dx = A.vp.x - a.x, dy = A.vp.y - a.y, l = Math.hypot(dx, dy); return l < 1e-6 ? { x: 1, y: 0 } : { x: dx / l, y: dy / l } }

// ===== 魚眼（5点・6点）：視線の球面上で考える。直線は「大円」＝画面では曲線になる =====
const V = {
	dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
	crs: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
	nrm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] },
	add: (a, b, s = 1, t = 1) => [a[0] * s + b[0] * t, a[1] * s + b[1] * t, a[2] * s + b[2] * t]
};
const DG = Math.PI / 180;
const camPos = () => [P.cx, P.ch - 1, P.cz], CO = () => [-P.cx, 1 - P.ch, -P.cz], sigNow = () => P.ch + ',' + P.cx + ',' + P.cz + ',' + P.yaw + ',' + P.pitch + ',' + P.roll + ',' + T;   // カメラの位置／ワールド→カメラからの相対への足し算
// ワールドのベクトル→カメラ座標（水平回転→上下→ロール）
function cam(v) {
	const th = P.yaw * DG, ph = P.pitch * DG, ro = (T === 'f' ? P.roll : 0) * DG;
	const x1 = v[0] * Math.cos(th) + v[2] * Math.sin(th), z1 = -v[0] * Math.sin(th) + v[2] * Math.cos(th);
	const y2 = v[1] * Math.cos(ph) - z1 * Math.sin(ph), z2 = v[1] * Math.sin(ph) + z1 * Math.cos(ph);
	return [x1 * Math.cos(ro) - y2 * Math.sin(ro), x1 * Math.sin(ro) + y2 * Math.cos(ro), z2]
}
// 魚眼投影（等距離射影）：単位ベクトル→画面。okは画角内かどうか
function pf(v) {
	const half = P.fov * DG / 2, th = Math.acos(Math.max(-1, Math.min(1, v[2]))), r = th / half * H / 2, rho = Math.hypot(v[0], v[1]);
	return { x: W / 2 + (rho < 1e-9 ? 0 : r * v[0] / rho), y: H / 2 - (rho < 1e-9 ? 0 : r * v[1] / rho), ok: th <= half + 1e-9 }
}
// 画面の点→視線ベクトル（pfの逆）
function bf(p) {
	const half = P.fov * DG / 2, dx = p.x - W / 2, dy = -(p.y - H / 2), r = Math.hypot(dx, dy), th = Math.min(r / (H / 2) * half, Math.PI);
	return r < 1e-9 ? [0, 0, 1] : [Math.sin(th) * dx / r, Math.sin(th) * dy / r, Math.cos(th)]
}
function calcF() { AXC = [[1, 0, 0], [0, 0, 1], [0, 1, 0]].map(cam) }   // 軸0=X,1=Z,2=垂直(Y)
// 大円を現在のパスに追加（cos t・a + sin t・b）。画角の外は途切れさせる
function circ(c, a, b) { let on = false; for (let j = 0; j <= 240; j++) { const t = j / 240 * 2 * Math.PI, q = pf(V.add(a, b, Math.cos(t), Math.sin(t))); if (!q.ok) { on = false; continue } on ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); on = true } }
// 補助線：各軸(±VP)を通る大円を本数ぶん回転させて描く
function guidesF(c) {
	const col = ['#e8743d', '#2fb5a5', '#4a7be8'];
	AXC.forEach((d, i) => {
		if (!show[i]) return;
		c.strokeStyle = col[i]; c.globalAlpha = P.ga; c.lineWidth = P.gw; c.beginPath();
		const e1 = V.nrm(V.crs(Math.abs(d[0]) < .9 ? [1, 0, 0] : [0, 1, 0], d)), e2 = V.crs(d, e1);
		for (let k = 0; k < P.n; k++) { const f = Math.PI * k / P.n; circ(c, d, V.add(e1, e2, Math.cos(f), Math.sin(f))) }
		c.stroke()
	});
	c.globalAlpha = 1
}
// 点aでの軸iの向き（画面上の接線）
function dirF(a, i) {
	const v0 = bf(a), d = AXC[i], t = V.add(d, v0, 1, -V.dot(d, v0));
	if (Math.hypot(t[0], t[1], t[2]) < 1e-6) return { x: 1, y: 0 };
	const q = pf(V.nrm(V.add(v0, V.nrm(t), 1, .01))), b = pf(v0), dx = q.x - b.x, dy = q.y - b.y, l = Math.hypot(dx, dy);
	return l < 1e-9 ? { x: 1, y: 0 } : { x: dx / l, y: dy / l }
}
// 定規：開始点aと軸iが作る大円の上に、ペンの位置pを投影して曲線にする
function curveF(a, p, i) {
	const v0 = bf(a), d = AXC[i], n0 = V.crs(v0, d); if (Math.hypot(n0[0], n0[1], n0[2]) < 1e-6) return [a];
	const n = V.nrm(n0), vp = bf(p), w = V.add(vp, n, 1, -V.dot(vp, n)); if (Math.hypot(w[0], w[1], w[2]) < 1e-9) return [a];
	const v1 = V.nrm(w), tn = V.crs(n, v0); let al = Math.atan2(V.dot(v1, tn), V.dot(v1, v0));
	if (cur.al != null) al += 2 * Math.PI * Math.round((cur.al - al) / (2 * Math.PI)); cur.al = al;   // 角度の飛びを防ぐ
	const out = [a], N = Math.max(2, Math.ceil(Math.abs(al) / 0.02));
	for (let j = 1; j <= N; j++) { const t = al * j / N, q = pf(V.add(v0, tn, Math.cos(t), Math.sin(t))); if (!q.ok) break; out.push(q) }
	return out
}
// 魚眼の円とVP目印（±それぞれ。画角内のものだけ）
function markF(c) {
	c.strokeStyle = '#888'; c.lineWidth = 1.5; c.beginPath(); c.arc(W / 2, H / 2, H / 2, 0, 7); c.stroke();
	const col = ['#e8743d', '#2fb5a5', '#4a7be8']; let n = 0;
	AXC.forEach((d, i) => {
		if (!show[i]) return;[1, -1].forEach(s => {
			const q = pf([d[0] * s, d[1] * s, d[2] * s]); if (!q.ok) return; n++;
			c.fillStyle = col[i]; c.beginPath(); c.arc(q.x, q.y, 7, 0, 7); c.fill(); c.font = 'bold 18px system-ui'; c.fillText('VP' + (i + 1) + (s < 0 ? "'" : ''), q.x + 10, q.y - 10)
		})
	});
	$('info').innerHTML = `魚眼 画角 ${P.fov}°<br>表示中のVP ${n}個（軸ごとに＋と−）<br>円の半径＝画角の半分`
}

// ===== 線画の保存と再投影：画面の点→ワールドの向き(単位ベクトル)で持つので、視点を変えても追従する =====
// カメラ座標→ワールド（camの逆変換）
function wld(v) {
	const th = P.yaw * DG, ph = P.pitch * DG, ro = (T === 'f' ? P.roll : 0) * DG;
	const x1 = v[0] * Math.cos(ro) + v[1] * Math.sin(ro), y2 = -v[0] * Math.sin(ro) + v[1] * Math.cos(ro);
	const y1 = y2 * Math.cos(ph) + v[2] * Math.sin(ph), z1 = -y2 * Math.sin(ph) + v[2] * Math.cos(ph);
	return [x1 * Math.cos(th) - z1 * Math.sin(th), y1, x1 * Math.sin(th) + z1 * Math.cos(th)]
}
// Blender風の正投影ビュー。正面=X/Y、真横=Z/Y、真上=X/Zを画面へ置く。
// depthはカメラから遠いほど大きくなり、書き出し時の隠れ線判定にも使う。
function orthBasis() {
	if (orthView === 'side') return { right: [0, 0, 1], up: [0, 1, 0], depth: [-1, 0, 0] };
	if (orthView === 'top') return { right: [1, 0, 0], up: [0, 0, 1], depth: [0, -1, 0] };
	return { right: [1, 0, 0], up: [0, 1, 0], depth: [0, 0, 1] };
}
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// 間取りモードだけ、オブジェクト群を画面中央へ自動フィットする。
// 通常の9=真上は従来どおり原点中心の正投影を維持する。
const orthPlanCenter = () => window.cityFloorPlanActive && Array.isArray(window.cityFloorPlanCenter) ? window.cityFloorPlanCenter : [0, 0];
const orthScale = () => window.cityFloorPlanActive && Number.isFinite(Number(window.cityFloorPlanScale)) ? Number(window.cityFloorPlanScale) : Math.min(W, H) / 7.2;
function orthPoint(v) {
	const b = orthBasis(), sc = orthScale(), pc = window.cityFloorPlanActive && (orthView === 'top' || orthView === 'side') ? orthPlanCenter() : [0, 0]; let rx = dot3(v, b.right), ry = dot3(v, b.up);
	// scrW() は先にカメラ原点へ移すため、正投影では表示軸だけワールド原点へ戻す。
	if (window.cityFloorPlanActive && orthView === 'top') { rx += P.cx; ry += P.cz } else if (window.cityFloorPlanActive && orthView === 'side') { rx += P.cz; ry += P.ch - 1 }
	return { x: W / 2 + (rx - pc[0]) * sc, y: H / 2 - (ry - pc[1]) * sc, depth: dot3(v, b.depth), ok: true }
}
// ワールドの向き→画面（今のグリッド種類の投影）。okがfalseなら画角の外/カメラの後ろ
function scr(v) {
	if (orthView) return orthPoint(v); const q = cam(v); if (T === 'f') return pf(q);
	if (q[2] <= 0.02) return { ok: false }; const f = W * P.lens / 36; return { x: W / 2 + f * q[0] / q[2], y: H * P.hz / 100 - f * q[1] / q[2], ok: true }
}
// 画面の点→ワールドの向き
function unscr(p) { if (orthView) { const b = orthBasis(), sc = orthScale(), x = (p.x - W / 2) / sc, y = -(p.y - H / 2) / sc, pc = window.cityFloorPlanActive && (orthView === 'top' || orthView === 'side') ? orthPlanCenter() : [0, 0], q = [b.right[0] * x + b.up[0] * y + b.depth[0], b.right[1] * x + b.up[1] * y + b.depth[1], b.right[2] * x + b.up[2] * y + b.depth[2]]; if (orthView === 'top') { q[0] += pc[0]; q[2] += pc[1] } else if (window.cityFloorPlanActive && orthView === 'side') { q[2] += pc[0]; q[1] += pc[1] } return V.nrm(q) } if (T === 'f') return wld(bf(p)); const f = W * P.lens / 36; return wld(V.nrm([(p.x - W / 2) / f, -(p.y - H * P.hz / 100) / f, 1])) }
// 保存済みの線を今の視点で描く（点の間は球面上で補間するので魚眼でも曲線になる）
// d3=trueの線は3D座標の点（図形）、そうでなければ視線の向き（ペンで描いた線）
function effectiveLineWidth(s) {
	const base = Number(s && s.w); return Math.max(.1, (Number.isFinite(base) ? base : MASTER_W) * (Number(P.pw) || MASTER_W) / MASTER_W);
}
function strokeW(c, s) {
	c.strokeStyle = s.c; c.lineWidth = effectiveLineWidth(s); c.lineCap = c.lineJoin = 'round'; c.beginPath(); let on = false;
	const co = s.d3 ? CO() : null, rl = v => co ? V.add(v, co) : v;           // 3D点はカメラからの相対位置にする
	const put = v => { const q = scr3(rl(v)); if (!q.ok) { on = false; return } on ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); on = true };
	s.p.forEach((v, i) => {
		if (i) {
			const a = s.p[i - 1], n = Math.ceil(Math.acos(Math.max(-1, Math.min(1, V.dot(V.nrm(rl(a)), V.nrm(rl(v)))))) / 0.03);
			for (let j = 1; j < n; j++)put(co ? V.add(a, v, 1 - j / n, j / n) : V.nrm(V.add(a, v, 1 - j / n, j / n)))
		}
		put(v)
	});
	c.stroke()
}
const AXW = [[1, 0, 0], [0, 0, 1], [0, 1, 0]];   // ワールドのX・Z・垂直(Y)の向き（VP1・VP2・垂直）
function drawCur(x) { if (!cur) return; if (cur.pv) { if (cur.pv.p.length > 1) strokeW(x, cur.pv) } else if (cur.p.length > 1) stroke(x, cur) }   // 描いている途中の線
const sp = (s, v) => scr3(s.d3 ? V.add(v, CO()) : v);   // 線の点の画面位置

// ===== 図形：パースに沿った 長方形・円・立方体・円柱（3Dで作って視線の向きの線にする） =====
const PL = { 0: [2, 1], 1: [0, 2], 2: [0, 1] };                               // 面の法線k → 面内の2軸 (0=X,1=Y,2=Z)
const hit3 = (r, k, d, c = [0, 0, 0]) => { const den = r[k]; if (!Number.isFinite(den) || Math.abs(den) < 1e-7) return null; const t = (d - c[k]) / den, q = [c[0] + r[0] * t, c[1] + r[1] * t, c[2] + r[2] * t]; return t > 0 && q.every(Number.isFinite) ? q : null };   // 視線rが面(k座標=d)と交わる点（cはカメラ位置）   // 視線rが面(k座標=d)と交わる3D点
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// 図形の定義 ob（面の向きk・中心・半径・回転・大きさ・浮かせ量…）から線を作る。ob を直せば作り直せる＝移動・回転ができる
function genShape(ob) {
	const { type, k, d, ca, cb, wf } = ob, off = ob.off || [0, 0, 0], co = CO(), [iu, iv] = PL[k], ra = ob.ra, rb = ob.rb, cs = Math.cos(ob.rot * DG), sn = Math.sin(ob.rot * DG);
	const q = (a, b, ee = 0) => { const x = a - ca, y = b - cb, v = [0, 0, 0]; v[k] = d - d * ob.lift + ee; v[iu] = ca + x * cs - y * sn; v[iv] = cb + x * sn + y * cs; return [v[0] + off[0], v[1] + off[1], v[2] + off[2]] };   // 面内(a,b)を中心まわりに回転＋法線方向の3D点
	const e = -d * ob.h, L = [];                                // eは押し出し量（カメラ側へ）
	const ring = (ee, t0 = 0, t1 = 2 * Math.PI) => {
		const o = [], n = Math.max(8, Math.ceil(160 * (t1 - t0) / (2 * Math.PI)));
		for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n; o.push(q(ca + ra * Math.cos(t), cb + rb * Math.sin(t), ee)) } return o
	};
	const corners = (ee = 0) => [q(ca - ra, cb - rb, ee), q(ca + ra, cb - rb, ee), q(ca + ra, cb + rb, ee), q(ca - ra, cb + rb, ee)];
	const extruded = ob.extrude === true && Math.abs(ob.h) > 1e-4;
	if (type === 'rect') {
		const c0 = corners(0); L.push([...c0, c0[0]]);
		if (extruded) { const c1 = corners(e); L.push([...c1, c1[0]]); for (let i = 0; i < 4; i++)L.push([c0[i], c1[i]]) }
	} else if (type === 'circ') {
		const r0 = ring(0); L.push(r0);
		// 円を押し出した円柱は、上下輪郭に加えて「現在の視点から見える
		// 左右のシルエット母線」だけを描く。全周の縦線ではないので、
		// どの視点でも外周エッジだけが残る。
		if (extruded) {
			const r1 = ring(e); L.push(r1);
			const cen = q(ca, cb, 0), rel = V.add(camPos(), cen, 1, -1), eu = [0, 0, 0], ev = [0, 0, 0];
			eu[iu] = cs; eu[iv] = sn; ev[iu] = -sn; ev[iv] = cs;
			const vx = V.dot(rel, eu), vy = V.dot(rel, ev), ph = Math.atan2(vy, vx), t0 = ph + Math.PI / 2, t1 = ph - Math.PI / 2;
			[t0, t1].forEach(t => L.push([q(ca + ra * Math.cos(t), cb + rb * Math.sin(t), 0), q(ca + ra * Math.cos(t), cb + rb * Math.sin(t), e)]));
		}
	} else if (type === 'triPyramid') {
		const b0 = q(ca - ra, cb - rb, 0), b1 = q(ca + ra, cb - rb, 0), b2 = q(ca, cb + rb, 0), ap = q(ca, cb, e);
		L.push([b0, b1, b2, b0], [b0, ap], [b1, ap], [b2, ap]);
	} else if (type === 'triPrism') {
		const f0 = q(ca - ra, cb - rb, 0), f1 = q(ca + ra, cb - rb, 0), f2 = q(ca, cb - rb, e);
		const b0 = q(ca - ra, cb + rb, 0), b1 = q(ca + ra, cb + rb, 0), b2 = q(ca, cb + rb, e);
		L.push([f0, f1, f2, f0], [b0, b1, b2, b0], [f0, b0], [f1, b1], [f2, b2]);
	} else if (type === 'box') {
		const c = corners(), t = c.map(v => { const w = [...v]; w[k] += e; return w }), V8 = [...c, ...t];
		const F = [[0, 1, 2, 3], [4, 5, 6, 7], ...[0, 1, 2, 3].map(i => [i, (i + 1) % 4, 4 + (i + 1) % 4, 4 + i])];   // 面：底・上・側面4つ
		const cm = V8.reduce((s, v) => V.add(s, v), [0, 0, 0]).map(x => x / 8);
		const vis = F.map(f => {
			const fc = f.reduce((s, i) => V.add(s, V8[i]), [0, 0, 0]).map(x => x / 4);   // 面がカメラから見えるか
			let n = V.crs(V.add(V8[f[1]], V8[f[0]], 1, -1), V.add(V8[f[2]], V8[f[0]], 1, -1));
			if (V.dot(n, V.add(fc, cm, 1, -1)) < 0) n = n.map(x => -x); return V.dot(n, V.add(fc, co)) < 0
		});
		for (let i = 0; i < 4; i++) {
			const j = (i + 1) % 4;   // 辺：隣り合う面のどちらかが見えていれば描く
			[[[i, j], [0, 2 + i]], [[4 + i, 4 + j], [1, 2 + i]], [[i, 4 + i], [2 + i, 2 + (i + 3) % 4]]].forEach(([[a, b], [f1, f2]]) => { if (wf || vis[f1] || vis[f2]) L.push([V8[a], V8[b]]) })
		}
	} else if (type === 'cyl') {
		const r = ra, cl = V.add(camPos(), off, 1, -1), xc = ca - cl[iu], yc = cb - cl[iv], Ac = Math.hypot(xc, yc), ph = Math.atan2(yc, xc), far = Ac > r, ang = far ? Math.acos(-r / Ac) : 0, ez = [0, 0, 0]; ez[k] = -d;
		[[0, V.dot(ez, V.add(q(ca, cb, 0), co)) > 0], [e, V.dot(ez, V.add(q(ca, cb, e), co)) < 0]].forEach(([ee, v]) => {   // 上下の円：見えていれば全周、見えなければ手前の弧だけ
			if (v || wf || !far) L.push(ring(ee)); else L.push(ring(ee, ph + ang, ph + 2 * Math.PI - ang))
		});
		// 円柱の側面の縦エッジは描かない。上下輪郭だけで表現する。
	}
	return L.map(pl => ({ c: ob.c, w: ob.w, ob, d3: true, cs: sigNow(), p: dens3(pl) }));
}
// ドラッグした2点（対角）から図形の定義を作る
function buildShape(sh, p1) {
	const { k, d, A, off, cl } = sh, [iu, iv] = PL[k];
	// 地平線付近では選択した床/壁面と視線が交差しないことがあるため、
	// その場合はカメラ前方の仮想平面にフォールバックして必ず図形を作れるようにする。
	const B = hit3(unscr(p1), k, d, cl) || V.add(cl, unscr(p1), 1, P.dp);
	if (!A || !B) return null;
	const type = $('shT').value; let du = B[iu] - A[iu], dv = B[iv] - A[iv];
	if ($('sq').checked && type === 'circ') { const m = Math.max(Math.abs(du), Math.abs(dv)); du = du < 0 ? -m : m; dv = dv < 0 ? -m : m }
	if (Math.abs(du) < 1e-4 || Math.abs(dv) < 1e-4) return null;
	if (!sh.id) sh.id = uid();
	const baseH = (type === 'triPrism' || type === 'triPyramid') ? Math.min(Math.abs(du), Math.abs(dv)) * P.hr / 100 : 0;
	return genShape({ id: sh.id, type, k, d, off, ca: A[iu] + du / 2, cb: A[iv] + dv / 2, ra: Math.abs(du) / 2, rb: Math.abs(dv) / 2, h: baseH, extrude: false, rot: 0, lift: 0, wf: $('wf').checked, c: $('pc').value, w: MASTER_W });
}

// ===== 図形の編集（選択・移動・回転・大きさ・浮かせる） =====
const obOf = id => { const s = S.find(s => s.ob && s.ob.id === id); return s && s.ob };
// 選択状態は「操作対象の主役 sel」と、複数選択用の selIds を分けて持つ。
// 旧データや既存の操作経路が sel だけを書き換えても壊れないよう、ここで同期する。
function normalizeSelection() {
	if (sel && !selIds.has(sel)) selIds.add(sel);
	[...selIds].forEach(id => { if (!obOf(id)) selIds.delete(id) });
	if (sel && !obOf(sel)) sel = null;
	if (!sel && selIds.size) sel = [...selIds][selIds.size - 1];
	if (sel && !selIds.has(sel)) selIds.add(sel);
}
function setSelection(id, add = false) {
	if (!add) selIds.clear();
	if (id) { if (add && selIds.has(id)) selIds.delete(id); else selIds.add(id); sel = selIds.has(id) ? id : ([...selIds][selIds.size - 1] || null) }
	else if (!add) { sel = null }
	normalizeSelection();
}
function clearSelection() { sel = null; selIds.clear(); }
function selectedObjects() { normalizeSelection(); const ids = selIds.size ? selIds : (sel ? new Set([sel]) : new Set()), out = []; ids.forEach(id => { const o = obOf(id); if (o) out.push(o) }); return out }
// 図形の定義を更新して、その図形の線だけ作り直す
// カメラ位置が変わったら、図形の線（隠れ線の判定つき）を作り直す
function regenObjects() { const done = new Set(), out = []; S.forEach(s => { if (!s.ob) out.push(s); else if (!done.has(s.ob.id)) { done.add(s.ob.id); out.push(...genShape(s.ob)) } }); S = out }   // 描く順番(重なり)は変えない
function setOb(id, patch) { const o = obOf(id); if (!o) return; S = [...S.filter(s => !(s.ob && s.ob.id === id)), ...genShape({ ...o, ...patch })] }
// 近くにある図形の線を探す（24px以内）
function pickOb(p) {
	let best = null, bd = 24 / Z;
	S.forEach(s => { if (!s.ob) return; for (const v of s.p) { const q = sp(s, v); if (!q.ok) continue; const dd = Math.hypot(q.x - p.x, q.y - p.y); if (dd < bd) { bd = dd; best = s.ob.id } } }); return best
}
// 図形のローカル座標(x=幅方向,y=奥行き方向,z=高さ方向)→ワールドの3D点
function L2W(o, x, y, z) {
	const [iu, iv] = PL[o.k], cs = Math.cos(o.rot * DG), sn = Math.sin(o.rot * DG), v = [0, 0, 0];
	v[o.k] = o.d - o.d * o.lift - o.d * z; v[iu] = o.ca + x * cs - y * sn; const f = o.off || [0, 0, 0]; v[iv] = o.cb + x * sn + y * cs; return [v[0] + f[0], v[1] + f[1], v[2] + f[2]]
}
// 古い保存データ（大きさ%・高さ%）を、幅・奥行き・高さの形に直す
function fixOb(o) { let n = o; if (o.h === undefined) { const f = (o.sc || 100) / 100, ra = o.ra * f, rb = o.rb * f; n = { ...o, ra, rb, h: Math.min(ra, rb) * 2 * (o.hr || 100) / 100, sc: undefined, hr: undefined } } return n.off ? n : { ...n, off: [0, 0, 0] } }
// 選択中の図形の数値を、パネルに表示
function syncSel() {
	normalizeSelection();
	const o = sel && obOf(sel); if (sel && !o) sel = null; $('objP').style.display = o ? '' : 'none'; if (!o) return;
	if (sel !== lastSel) { lastSel = sel; const d = $('objP').closest('details'); if (d) d.open = true }
	const P3 = L2W(o, 0, 0, 0);
	[['rot', o.rot], ['w', 2 * o.ra], ['dp', 2 * o.rb], ['h', o.h], ['px', P3[0]], ['py', P3[1] + 1], ['pz', P3[2]]].forEach(([k, v]) => {
		const n = $('ov_' + k), r = $('or_' + k); if (n && document.activeElement !== n) n.value = +(+v).toFixed(3); if (r && document.activeElement !== r) r.value = v
	})
}
// パネルの数値 → 図形の変更内容
function fieldPatch(o, name, v) {
	const [iu, iv] = PL[o.k];
	if (name === 'rot') return { rot: v };
	if (name === 'w' || name === 'dp') {
		const r = Math.max(.005, v / 2);
		if (o.type === 'asset' && o.asset === 'sphere') return { ra: r, rb: r, h: r * 2 };
		return o.type === 'cyl' ? { ra: r, rb: r } : { [name === 'w' ? 'ra' : 'rb']: r }
	}
	if (name === 'h') {
		if (o.type === 'asset' && o.asset === 'sphere') { const r = Math.max(.005, v / 2); return { ra: r, rb: r, h: r * 2 } }
		return o.type === 'rect' || o.type === 'circ' ? { h: Math.max(0, v), extrude: v > 0 } : { h: Math.max(.005, v) };
	}
	const j = { px: 0, py: 1, pz: 2 }[name], vv = (name === 'py' ? v - 1 : v) - (o.off ? o.off[j] : 0);   // Yは地面からの高さ。図形の座標系に直す
	if (j === iu) return { ca: vv }; if (j === iv) return { cb: vv }; return { lift: 1 - vv * o.d }
}   // 面に垂直な方向は「浮かせ量」
// パネルの数値を変えたとき（1回の入力ごとに元に戻す履歴を1つだけ作る）
// パネルの数値を変えたとき（1回の入力ごとに元に戻す履歴を1つだけ作る）
let obS = false, lastSel = null;
function applyOb(name, v) { const o = sel && obOf(sel); if (!o) return; if (!obS) { HU.push(S); RD = []; obS = true } setOb(sel, fieldPatch(o, name, v)); render() }
{ const r = $('or_rot'), n = $('ov_rot'); r.oninput = () => applyOb('rot', +r.value); n.oninput = () => { const v = parseFloat(n.value); if (!isNaN(v)) applyOb('rot', v) }; r.onchange = n.onchange = () => { obS = false } }
['w', 'dp', 'h', 'px', 'py', 'pz'].forEach(k => { const n = $('ov_' + k); n.oninput = () => { const v = parseFloat(n.value); if (!isNaN(v)) applyOb(k, v) }; n.onchange = () => { obS = false } });
$('obExtrude').onclick = () => { const o = obOf(sel); if (!o || !['rect', 'circ'].includes(o.type)) return; HU.push(S); RD = []; setOb(sel, { h: Math.max(.12, Math.min(o.ra, o.rb) * .8), extrude: true }); render() };
$('obGnd').onclick = () => {
	const o = obOf(sel); if (!o) return; const bb = obBounds(o), dy = -1 - bb.lo[1];   // 一番低い点を地面(y=-1)に合わせる
	HU.push(S); RD = []; setOb(sel, moveBy(o, [0, dy, 0])); render()
};
$('obDup').onclick = () => { const o = obOf(sel); if (!o) return; const n = { ...o, id: uid(), ca: o.ca + o.ra * 2.4 }; HU.push(S); S = [...S, ...genShape(n)]; RD = []; setSelection(n.id); render() };
$('obDel').onclick = () => { const ids = new Set(selectedObjects().map(o => o.id)); if (!ids.size) return; HU.push(S); S = S.filter(s => !(s.ob && ids.has(s.ob.id))); RD = []; clearSelection(); render() };
$('obOff').onclick = () => { clearSelection(); render() };
// ===== ブレンダー風ギズモ：矢印(XYZ軸の移動)・白い四角(面の押し引き)・点線の輪(回転) =====
const scr3 = p => orthView ? scr(p) : scr(V.nrm(p));
const scrW = p => scr3(V.add(p, CO()));            // ワールド座標の点の画面位置
const cloc = o => V.add(camPos(), o.off || [0, 0, 0], 1, -1);   // 図形の座標系で見たカメラ位置
const wrap180 = a => ((a + 180) % 360 + 360) % 360 - 180;
const segd = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) };
// 視線rと「点Cを通る向きaの直線」の最も近い点の、直線上の位置t（軸に沿った移動量を求める）
function lineParam(r, C, a) { const b = V.dot(r, a), dd = V.dot(r, C), e = V.dot(a, C), den = 1 - b * b; return den < 1e-6 ? null : (dd * b - e) / den }
function moveBy(o, vec) { const [iu, iv] = PL[o.k]; return { ca: o.ca + vec[iu], cb: o.cb + vec[iv], lift: o.lift - o.d * vec[o.k] } }
// 面を動かしたときの変更内容（反対側の面は動かさない）
function facePatch(o, fid, dl) {
	const cs = Math.cos(o.rot * DG), sn = Math.sin(o.rot * DG), m = .005;
	if (fid === 'top') return { h: Math.max(m, o.h + dl), extrude: true };
	if (fid === 'base') { const h = Math.max(m, o.h + dl); return { h, extrude: true, lift: o.lift - (h - o.h) } }
	const sg = fid[1] === '+' ? 1 : -1, isU = fid[0] === 'u', r0 = isU ? o.ra : o.rb, r1 = Math.max(m, r0 + dl / 2), dr = r1 - r0, ex = isU ? [cs, sn] : [-sn, cs];
	const q = { ca: o.ca + sg * dr * ex[0], cb: o.cb + sg * dr * ex[1] };
	if (o.type === 'cyl') { q.ra = r1; q.rb = r1 }
	else if (o.type === 'asset' && o.asset === 'sphere') { q.ra = r1; q.rb = r1; q.h = r1 * 2 }
	else q[isU ? 'ra' : 'rb'] = r1; return q
}
// 看板専用のビュー内ハンドル。絵枠の幅・高さと外周ベベルを、
// 左の数値欄だけでなくキャンバス上のハンドルをドラッグして編集できる。
function signGizmo(o) {
	if (!o || o.type !== 'asset' || o.asset !== 'sign') return null;
	const w = Math.max(.08, o.ra * 2), d = Math.max(.04, o.rb * 2), h = Math.max(.08, o.h || 1), fy = -d / 2 - .018;
	const board0 = .08 * h, board1 = .82 * h;
	const maxW = w * .90, maxH = (board1 - board0) * .84, maxB = Math.min(w, d, h) * .39;
	const faceW = clamp(Number(o.faceW) || w * .70, .08, maxW), faceH = clamp(Number(o.faceH) || h * .34, .08, maxH), bevel = clamp(Number.isFinite(Number(o.bevel)) ? Number(o.bevel) : 0, 0, maxB);
	const pr = (x, y, z) => scrW(L2W(o, x, y, z));
	const iz0 = (board0 + board1 - faceH) / 2, iz1 = iz0 + faceH, zm = (iz0 + iz1) / 2;
	const center = pr(0, fy, zm), right = pr(faceW / 2, fy, zm), top = pr(0, fy, iz1), frame = [pr(-faceW / 2, fy, iz0), pr(faceW / 2, fy, iz0), pr(faceW / 2, fy, iz1), pr(-faceW / 2, fy, iz1)];
	const make = (kind, anchor, probe, base, min, max) => {
		const dx = probe.x - anchor.x, dy = probe.y - anchor.y, step = Math.max(.0001, Number(probe._step) || .05), sc = Math.hypot(dx, dy) / step;
		return { kind, s: anchor, dir: { x: dx / (Math.hypot(dx, dy) || 1), y: dy / (Math.hypot(dx, dy) || 1) }, scale: sc || 1, start: base, min, max };
	};
	// _step is kept on the temporary projected point so the screen scale can be measured.
	const pw = Math.max(.05, w * .12), ph = Math.max(.05, h * .10);
	const rw = pr(faceW / 2 + pw, fy, zm); rw._step = pw;
	const ht = pr(0, fy, iz1 + ph); ht._step = ph;
	const outer = pr(w / 2, fy, board1), bp = Math.max(.05, Math.min(maxB, .10));
	const bi = pr(w / 2 - bp, fy, board1 - bp); bi._step = bp;
	const handles = {
		faceW: make('faceW', right, rw, faceW, .08, maxW),
		faceH: make('faceH', top, ht, faceH, .08, maxH),
		bevel: make('bevel', outer, bi, bevel, 0, maxB)
	};
	const bh = handles.bevel, bo = Math.max(18 / Z, (bh.scale || 1) * bevel);
	bh.s = { ...bh.s, x: outer.x + bh.dir.x * bo, y: outer.y + bh.dir.y * bo };
	return { o, C3: L2W(o, 0, 0, (board0 + board1) / 2), center, frame, outer, handles };
}
function coneGizmo(o) {
	if (!o || o.type !== 'asset' || o.asset !== 'cone') return null;
	const h = Math.max(.02, o.h || 1), base = L2W(o, 0, 0, 0), apex = L2W(o, 0, 0, h), bp = scrW(base), ap = scrW(apex), step = Math.max(.08, h * .12), probe = scrW(L2W(o, 0, 0, h + step));
	const dx = probe.x - ap.x, dy = probe.y - ap.y, sc = Math.hypot(dx, dy) / step;
	return { o, C3: L2W(o, 0, 0, h / 2), base: bp, apex: ap, handle: { kind: 'height', s: ap, dir: { x: dx / (Math.hypot(dx, dy) || 1), y: dy / (Math.hypot(dx, dy) || 1) }, scale: sc || 1, start: h, min: .02, max: 20 } };
}
function sphereGizmo(o) {
	if (!o || o.type !== 'asset' || o.asset !== 'sphere') return null;
	const r = Math.min(2 * o.ra, 2 * o.rb, o.h) * .5, center = L2W(o, 0, 0, o.h * .5), right = V.nrm(wld([1, 0, 0])), cp = scrW(center), edge = scrW(V.add(center, right, r)), probe = scrW(V.add(center, right, r + .10));
	const dx = probe.x - edge.x, dy = probe.y - edge.y, sc = Math.hypot(dx, dy) / .10;
	return { o, C3: center, center: cp, edge, handle: { kind: 'radius', s: edge, dir: { x: dx / (Math.hypot(dx, dy) || 1), y: dy / (Math.hypot(dx, dy) || 1) }, scale: sc || 1, start: r, min: .02, max: 20 } };
}
function specialGizmo(o) { return o && o.type === 'asset' && o.asset === 'sign' ? signGizmo(o) : o && o.type === 'asset' && o.asset === 'cone' ? coneGizmo(o) : o && o.type === 'asset' && o.asset === 'sphere' ? sphereGizmo(o) : null }
function drawSpecialGizmo(c, o) {
	const sg = specialGizmo(o); if (!sg) return;
	c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
	const sq = (q, col, diamond = false) => { if (!q || !q.ok) return; c.fillStyle = col; c.strokeStyle = '#102027'; c.lineWidth = 1.4 / Z; c.beginPath(); if (diamond) { c.moveTo(q.x, q.y - 7 / Z); c.lineTo(q.x + 7 / Z, q.y); c.lineTo(q.x, q.y + 7 / Z); c.lineTo(q.x - 7 / Z, q.y) } else c.rect(q.x - 6 / Z, q.y - 6 / Z, 12 / Z, 12 / Z); c.closePath(); c.fill(); c.stroke() };
	if (sg.o.asset === 'sign') {
		const h = sg.handles; c.setLineDash([5 / Z, 4 / Z]); c.lineWidth = 1.2 / Z;
		c.strokeStyle = 'rgba(102,227,200,.9)'; c.beginPath(); c.moveTo(sg.center.x, sg.center.y); c.lineTo(h.faceW.s.x, h.faceW.s.y); c.moveTo(sg.center.x, sg.center.y); c.lineTo(h.faceH.s.x, h.faceH.s.y); c.stroke();
		c.strokeStyle = 'rgba(255,159,104,.95)'; c.beginPath(); c.moveTo(sg.outer.x, sg.outer.y); c.lineTo(h.bevel.s.x, h.bevel.s.y); c.stroke(); c.setLineDash([]);
		sq(h.faceW.s, '#66e3c8'); sq(h.faceH.s, '#66e3c8'); sq(h.bevel.s, '#ff9f68', true);
		c.fillStyle = '#66e3c8'; c.font = `bold ${12 / Z}px system-ui`; c.fillText('絵枠W', h.faceW.s.x + 8 / Z, h.faceW.s.y - 7 / Z); c.fillText('絵枠H', h.faceH.s.x + 8 / Z, h.faceH.s.y - 7 / Z);
		c.fillStyle = '#ffb995'; c.fillText('ベベル', h.bevel.s.x + 9 / Z, h.bevel.s.y - 8 / Z);
	} else if (sg.o.asset === 'cone') {
		c.strokeStyle = 'rgba(255,179,111,.95)'; c.lineWidth = 1.5 / Z; c.beginPath(); c.moveTo(sg.base.x, sg.base.y); c.lineTo(sg.apex.x, sg.apex.y); c.stroke();
		sq(sg.handle.s, '#ffb36f'); c.fillStyle = '#ffcf9f'; c.font = `bold ${12 / Z}px system-ui`; c.fillText('高さ', sg.handle.s.x + 9 / Z, sg.handle.s.y - 8 / Z);
	} else {
		c.strokeStyle = 'rgba(173,156,255,.95)'; c.lineWidth = 1.4 / Z; c.setLineDash([5 / Z, 4 / Z]); c.beginPath(); c.moveTo(sg.center.x, sg.center.y); c.lineTo(sg.handle.s.x, sg.handle.s.y); c.stroke(); c.setLineDash([]);
		sq(sg.handle.s, '#ad9cff'); c.fillStyle = '#d5ccff'; c.font = `bold ${12 / Z}px system-ui`; c.fillText('半径', sg.handle.s.x + 9 / Z, sg.handle.s.y - 8 / Z);
	}
	c.restore();
}

// 選択中の図形のギズモの位置（画面座標つき）
function gizmo() {
	const o = sel && obOf(sel); if (!o) return null;
	const [iu, iv] = PL[o.k], cs = Math.cos(o.rot * DG), sn = Math.sin(o.rot * DG), solid = o.type === 'box' || o.type === 'cyl' || o.type === 'rect' || o.type === 'circ' || o.type === 'triPrism' || o.type === 'triPyramid' || (o.type === 'asset' && (o.asset === 'triPrism' || o.asset === 'triPyramid'));
	const C3 = L2W(o, 0, 0, solid ? o.h / 2 : 0), sC = scrW(C3); if (!sC.ok) return null;
	const g = { o, C3, sC, axes: [], faces: [], ring: [] }, nC = Math.hypot(...V.add(C3, CO()));
	[[1, 0, 0, '#e8743d', 'X'], [0, 1, 0, '#4a7be8', 'Y'], [0, 0, 1, '#2fb5a5', 'Z']].forEach(([x, y, z, col, nm]) => {   // 画面で約90pxになる長さの矢印
		const a = [x, y, z], eps = 0.01 * Math.max(.1, nC), s1 = scrW(V.add(C3, a, 1, eps)); if (!s1.ok) return;
		const pu = Math.hypot(s1.x - sC.x, s1.y - sC.y) / eps; if (pu < 1e-6) return;
		const L = Math.min((90 / Z) / pu, 3 * nC + 1), sT = scrW(V.add(C3, a, 1, L)); if (sT.ok) g.axes.push({ a, col, nm, sT })
	});
	const en = [0, 0, 0], eu = [0, 0, 0], ev = [0, 0, 0]; en[o.k] = -o.d; eu[iu] = cs; eu[iv] = sn; ev[iu] = -sn; ev[iv] = cs;   // 高さ方向・幅方向・奥行き方向の単位ベクトル
	const F = (id, x, y, z, n) => { const P3 = L2W(o, x, y, z), s = scrW(P3); g.faces.push({ id, n, P3, s }) }, zc = solid ? o.h / 2 : 0, neg = v => v.map(t => -t);
	F('u+', o.ra, 0, zc, eu); F('u-', -o.ra, 0, zc, neg(eu)); F('v+', 0, o.rb, zc, ev); F('v-', 0, -o.rb, zc, neg(ev));
	if (solid) { F('top', 0, 0, o.h, en); F('base', 0, 0, 0, neg(en)) }
	const R = Math.max(o.ra, o.rb) * 1.4;
	for (let i = 0; i <= 72; i++) { const t = i / 72 * 2 * Math.PI; g.ring.push(scrW(L2W(o, R * Math.cos(t), R * Math.sin(t), 0))) }
	return g
}
function drawGizmo(c) {
	const g = gizmo(); if (!g) { const o = sel && obOf(sel); if (o) drawSpecialGizmo(c, o); return } c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
	c.strokeStyle = 'rgba(255,170,0,.85)'; c.lineWidth = 1.6 / Z; c.setLineDash([7 / Z, 5 / Z]); c.beginPath(); let on = false;   // 回転の輪
	g.ring.forEach(q => { if (!q.ok) { on = false; return } on ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); on = true }); c.stroke(); c.setLineDash([]);
	g.axes.forEach(a => {
		const dx = a.sT.x - g.sC.x, dy = a.sT.y - g.sC.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, h = 11 / Z;   // 軸の矢印
		c.strokeStyle = a.col; c.fillStyle = a.col; c.lineWidth = 3.2 / Z; c.beginPath(); c.moveTo(g.sC.x, g.sC.y); c.lineTo(a.sT.x, a.sT.y); c.stroke();
		c.beginPath(); c.moveTo(a.sT.x + ux * h, a.sT.y + uy * h); c.lineTo(a.sT.x - ux * h * .2 - uy * h * .6, a.sT.y - uy * h * .2 + ux * h * .6); c.lineTo(a.sT.x - ux * h * .2 + uy * h * .6, a.sT.y - uy * h * .2 - ux * h * .6); c.fill();
		c.font = `bold ${15 / Z}px system-ui`; c.fillText(a.nm, a.sT.x + ux * h + 4 / Z, a.sT.y + uy * h + 4 / Z)
	});
	c.fillStyle = '#fff'; c.strokeStyle = '#222'; c.lineWidth = 1.4 / Z;   // 面のハンドル（白い四角）
	g.faces.forEach(f => { if (!f.s.ok) return; const r = 6.5 / Z; c.beginPath(); c.rect(f.s.x - r, f.s.y - r, 2 * r, 2 * r); c.fill(); c.stroke() });
	c.beginPath(); c.arc(g.sC.x, g.sC.y, 5 / Z, 0, 7); c.fill(); c.stroke();
	drawSpecialGizmo(c, g.o);
	c.restore()
}
// タッチした位置にあるハンドルを調べる（アセット専用→面→軸の矢印→回転の輪）
function hitGizmo(p) {
	const active = sel && obOf(sel), special = active && specialGizmo(active), R = 20 / Z;
	if (special) {
		if (active.asset === 'sign') for (const h of Object.values(special.handles)) if (Math.hypot(h.s.x - p.x, h.s.y - p.y) < R) return { t: 'sign-' + h.kind, sign: h, g: { o: active, C3: special.C3 } };
		if (active.asset === 'cone' && Math.hypot(special.handle.s.x - p.x, special.handle.s.y - p.y) < R) return { t: 'cone-height', sign: special.handle, g: { o: active, C3: special.C3 } };
		if (active.asset === 'sphere' && Math.hypot(special.handle.s.x - p.x, special.handle.s.y - p.y) < R) return { t: 'sphere-radius', sign: special.handle, g: { o: active, C3: special.C3 } };
	}
	const g = gizmo(); if (!g) return null; const Rg = 20 / Z;
	for (const f of g.faces) if (f.s.ok && Math.hypot(f.s.x - p.x, f.s.y - p.y) < Rg) return { t: 'face', f, g };
	if (Math.hypot(g.sC.x - p.x, g.sC.y - p.y) > R * .8) for (const a of g.axes) if (segd(p, g.sC, a.sT) < R * .7) return { t: 'axis', a, g };
	for (let i = 1; i < g.ring.length; i++) { const a = g.ring[i - 1], b = g.ring[i]; if (a.ok && b.ok && segd(p, a, b) < R * .7) return { t: 'ring', g } }
	return null
}
// 図形の外枠（ワールド軸に沿った箱）。スナップや接地に使う
function obBounds(o) {
	const pts = [], solid = o.type === 'box' || o.type === 'cyl' || o.type === 'triPrism' || o.type === 'triPyramid' || ((o.type === 'rect' || o.type === 'circ') && o.extrude), hs = solid ? [0, o.h] : [0];
	if (o.type === 'rect' || o.type === 'box' || o.type === 'triPrism' || o.type === 'triPyramid') hs.forEach(z => [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => pts.push(L2W(o, a * o.ra, b * o.rb, z))));
	else for (let i = 0; i < 48; i++) { const t = i / 48 * 2 * Math.PI; hs.forEach(z => pts.push(L2W(o, o.ra * Math.cos(t), o.rb * Math.sin(t), z))) }
	const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; pts.forEach(v => { for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], v[j]); hi[j] = Math.max(hi[j], v[j]) } }); return { lo, hi }
}
// 動かしている図形以外の、くっつき先
function targetsOf(id) { const seen = new Set(), out = []; S.forEach(s => { if (s.ob && s.ob.id !== id && !seen.has(s.ob.id)) { seen.add(s.ob.id); out.push({ id: s.ob.id, b: obBounds(s.ob) }) } }); return out }
// 複数選択を一体として動かすときの外周と吸着先。選択中同士は吸着候補から外す。
function groupBounds(objects) {
	const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
	objects.forEach(o => { const b = obBounds(o); for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], b.lo[j]); hi[j] = Math.max(hi[j], b.hi[j]) } });
	return { lo, hi };
}
function targetsOfSet(ids) { const seen = new Set(), out = []; S.forEach(s => { if (s.ob && !ids.has(s.ob.id) && !seen.has(s.ob.id)) { seen.add(s.ob.id); out.push({ id: s.ob.id, b: obBounds(s.ob) }) } }); return out }
function snapSetupGroup(objects, C3) { const ids = new Set(objects.map(o => o.id)); return { bb: groupBounds(objects), targets: targetsOfSet(ids), tau: tauOf(C3) } }
// 画面上の吸着距離(px)を、その図形の位置でのワールドの長さにする
function tauOf(C3) { const rel = Math.max(.05, Math.hypot(...V.add(C3, CO()))), f = T === 'f' ? (H / 2) / (P.fov * DG / 2) : W * P.lens / 36; return (P.sn / Z) * rel / f }
const snapSetup = (o, C3) => ({ bb: obBounds(o), targets: targetsOf(o.id), tau: tauOf(C3) });
// 移動量deltaを、他の図形の面や地面に近ければぴったりくっつくよう補正（軸ごと）
function snapShift(bb, delta, axes, targets, tau) {
	const d = [...delta], hit = new Set();
	axes.forEach(j => {
		let best = null; const lo = bb.lo[j] + d[j], hi = bb.hi[j] + d[j], cand = [];
		targets.forEach(t => { cand.push([t.b.lo[j], t.id, 1], [t.b.hi[j], t.id, 1]) }); if (j === 1) cand.push([-1, 'ground', 0]);   // 地面(y=-1)には底だけ
		cand.forEach(([v, id, both]) => (both ? [v - lo, v - hi] : [v - lo]).forEach(sft => { if (Math.abs(sft) <= tau && (!best || Math.abs(sft) < Math.abs(best.s))) best = { s: sft, id } }));
		if (best) { d[j] += best.s; hit.add(best.id) }
	});
	return { d, hit }
}
// オブジェクトの実際の外周を、面スナップ用の投影点として返す。
// 軸に平行なobBoundsだけに頼らないので、回転した図形でも辺を拾える。
function snapObjectCorners(o) {
	if (!o) return [];
	const solid = o.type === 'box' || o.type === 'cyl' || o.type === 'triPrism' || o.type === 'triPyramid' || ((o.type === 'rect' || o.type === 'circ') && o.extrude) || o.type === 'asset';
	const hs = solid ? [0, Math.max(0, Number(o.h) || 0)] : [0], out = [];
	for (const x of [-Math.abs(Number(o.ra) || 0), Math.abs(Number(o.ra) || 0)]) for (const y of [-Math.abs(Number(o.rb) || 0), Math.abs(Number(o.rb) || 0)]) for (const z of hs) out.push(L2W(o, x, y, z));
	return out;
}
// 面の押し引きのスナップ。編集面の法線方向と、面内の辺の重なりを確認し、
// 隣接している対象の外周だけへ吸着する。ed.nはワールド単位ベクトルなので、
// 斜めに回転した図形にも同じ処理を適用できる。
function faceSnap(dl) {
	if (!$('snp')?.checked || !ed?.o0 || !ed?.n || !ed?.Fa) return dl;
	const o = ed.o0, n = V.nrm(ed.n), [iu, iv] = PL[o.k], cs = Math.cos(Number(o.rot || 0) * DG), sn = Math.sin(Number(o.rot || 0) * DG), eu = [0, 0, 0], ev = [0, 0, 0], en = [0, 0, 0];
	eu[iu] = cs; eu[iv] = sn; ev[iu] = -sn; ev[iv] = cs; en[o.k] = -o.d;
	const fid = String(ed.fid || ''), isU = fid[0] === 'u', isV = fid[0] === 'v', plus = fid === 'top' || fid.endsWith('+');
	const tangents = isU ? [ev, en] : isV ? [eu, en] : [eu, ev];
	const halves = isU ? [Math.abs(o.rb), Math.max(0, Number(o.h) || 0) / 2] : isV ? [Math.abs(o.ra), Math.max(0, Number(o.h) || 0) / 2] : [Math.abs(o.ra), Math.abs(o.rb)];
	const faceN0 = dot3(ed.Fa, n), faceN = faceN0 + dl, faceT = tangents.map(t => dot3(ed.Fa, t)), tau = Math.max(.04, Number(ed.tau) || .04), tol = Math.max(.01, tau * .25); let best = null;
	ed.targets.forEach(t => {
		const to = obOf(t.id), pts = snapObjectCorners(to); if (pts.length < 2) return;
		const proj = pts.map(p => ({ n: dot3(p, n), t: tangents.map(a => dot3(p, a)) }));
		const nMin = Math.min(...proj.map(p => p.n)), nMax = Math.max(...proj.map(p => p.n));
		for (let k = 0; k < 2; k++) {
			const tMin = Math.min(...proj.map(p => p.t[k])), tMax = Math.max(...proj.map(p => p.t[k])), fMin = faceT[k] - halves[k], fMax = faceT[k] + halves[k];
			if (Math.min(fMax, tMax) - Math.max(fMin, tMin) < -tol) return;
		}
		// 対象の下端・上端の両方を候補にする。面の接線方向が重なり、
		// かつ吸着距離内にある辺だけを通すので、遠い対象へは飛ばない。
		const candidates = [nMin, nMax];
		candidates.forEach(targetN => {
			const gap = targetN - faceN;
			if (Math.abs(gap) <= tau && (!best || Math.abs(gap) < Math.abs(best.gap))) best = { gap, id: t.id, targetN };
		});
	});
	if (!best) return dl;
	snapHit = new Set([best.id]);
	// dlは編集面そのものの移動量なので、対象面との差を加えるだけでよい。
	return dl + (best.targetN - faceN);
}

function beginGizmo(h, p) {
	const o = h.g.o, r = unscr(p), co = CO(), base = { id: o.id, o0: { ...o }, started: false, ...snapSetup(o, h.g.C3) };
	if (h.t.startsWith('sign-') || h.t === 'cone-height' || h.t === 'sphere-radius') ed = { ...base, t: h.t, sign: h.sign, p0: p };
	else if (h.t === 'axis') { const C0 = V.add(h.g.C3, co), t0 = lineParam(r, C0, h.a.a); if (t0 != null) ed = { ...base, t: 'axis', a: h.a.a, aj: h.a.a.indexOf(1), C0, t0 } }
	else if (h.t === 'face') {
		const F0 = V.add(h.f.P3, co), t0 = lineParam(r, F0, h.f.n);
		if (t0 != null) { const fj = [0, 1, 2].find(j => Math.abs(h.f.n[j]) > .999); ed = { ...base, t: 'face', fid: h.f.id, n: h.f.n, F0, Fa: h.f.P3, fj: fj === undefined ? -1 : fj, t0 } }
	}
	else { const dd = o.d - o.d * o.lift, P1 = hit3(r, o.k, dd, cloc(o)), [iu, iv] = PL[o.k]; if (P1) ed = { ...base, t: 'ring', dd, ang0: Math.atan2(P1[iv] - o.cb, P1[iu] - o.ca) } }
}
// キャンバス上のドラッグで編集（ed=いまの編集操作）。磁石スナップがONなら他の図形・地面にくっつく
function dragEdit(p) {
	const o = ed.o0, [iu, iv] = PL[o.k], r = unscr(p), on = $('snp').checked; let patch = null; snapHit = null;
	const snap = (delta, axes) => { if (!on) return delta; const q = snapShift(ed.bb, delta, axes, ed.targets, ed.tau); if (q.hit.size) snapHit = q.hit; return q.d };
	if (ed.t === 'sign-faceW' || ed.t === 'sign-faceH' || ed.t === 'sign-bevel') {
		const h = ed.sign, deltaX = p.x - ed.p0.x, deltaY = p.y - ed.p0.y, amount = (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1);
		const min = h.min, max = h.max, v = clamp(h.start + amount, min, max); patch = { [ed.t === 'sign-faceW' ? 'faceW' : ed.t === 'sign-faceH' ? 'faceH' : 'bevel']: v };
	} else if (ed.t === 'cone-height') {
		const h = ed.sign, deltaX = p.x - ed.p0.x, deltaY = p.y - ed.p0.y, v = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max); patch = { h: v };
	} else if (ed.t === 'sphere-radius') {
		const h = ed.sign, deltaX = p.x - ed.p0.x, deltaY = p.y - ed.p0.y, radius = clamp(h.start + (deltaX * h.dir.x + deltaY * h.dir.y) / (h.scale || 1), h.min, h.max); patch = { ra: radius, rb: radius, h: radius * 2 };
	} else if (ed.t === 'mv') {
		// 間取りモードは地面(Y=-1)のX/Zだけを移動させる。高さ・接地状態は変えない。
		if (window.cityFloorPlanActive && o.k !== 1) return;
		const floorMove = !!window.cityFloorPlanActive && o.k === 1, plane = floorMove ? -1 : o.d - o.d * o.lift;
		const P1 = hit3(r, o.k, plane, cloc(o));   // 線をドラッグ＝面の上で移動
		if (P1 && ed.P0) {
			const dl = [0, 0, 0]; dl[iu] = P1[iu] - ed.P0[iu]; dl[iv] = P1[iv] - ed.P0[iv]; const q = snap(dl, [iu, iv]);
			// 複数選択時は主役のドラッグ量をワールド移動量として全員へ同じように適用する。
			if (ed.group && ed.group.length > 1) { ed.moveDelta = [q[0], q[1], q[2]]; patch = { ca: o.ca + q[iu], cb: o.cb + q[iv] }; }
			else patch = { ca: o.ca + q[iu], cb: o.cb + q[iv] };/* 間取りではca/cbだけを変え、Y方向のliftとoffは保持する。 */
		}
	}
	else if (ed.t === 'axis') { const t = lineParam(r, ed.C0, ed.a); if (t != null) patch = moveBy(o, snap(ed.a.map(x => x * (t - ed.t0)), [ed.aj])) }   // 矢印＝その軸に沿って移動
	else if (ed.t === 'face') { const t = lineParam(r, ed.F0, ed.n); if (t != null) patch = facePatch(o, ed.fid, faceSnap(t - ed.t0)) }              // 白い四角＝面の押し引き
	else if (ed.t === 'ring') { const P1 = hit3(r, o.k, ed.dd, cloc(o)); if (P1) patch = { rot: wrap180(o.rot + (Math.atan2(P1[iv] - o.cb, P1[iu] - o.ca) - ed.ang0) / DG) } }   // 輪＝回転
	if (!patch) return; if (!ed.started) { HU.push(S); RD = []; ed.started = true }
	if (ed.t === 'mv' && ed.group && ed.group.length > 1 && ed.moveDelta) {
		// 初期スナップショットから再生成するので、ポインタ移動のたびに位置が累積しない。
		ed.group.forEach(g => { const q = moveBy(g, ed.moveDelta); setOb(g.id, q) });
	} else setOb(ed.id, patch);
	render()
}

// ===== 書き出し範囲（ブレンダーのレンダー範囲のような枠） =====
function crect() { return { x: Math.min(CR.x0, CR.x1), y: Math.min(CR.y0, CR.y1), w: Math.abs(CR.x1 - CR.x0), h: Math.abs(CR.y1 - CR.y0) } }
function overlay(c) {   // 範囲の外を暗くして枠を表示（画面だけ。書き出しには入らない）
	if (!CR) return; const r = crect();
	c.save(); c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.rect(0, 0, W, H); c.rect(r.x, r.y, r.w, r.h); c.fill('evenodd');
	c.strokeStyle = '#ffd34d'; c.lineWidth = 2 / Z; c.strokeRect(r.x, r.y, r.w, r.h);
	c.fillStyle = '#ffd34d'; c.font = `${16 / Z}px system-ui`; c.fillText(Math.round(r.w) + '×' + Math.round(r.h), r.x + 4 / Z, r.y > 24 / Z ? r.y - 6 / Z : r.y + 18 / Z); c.restore()
}
$('crC').onclick = () => { CR = null; render() };
$('crF').onclick = () => {
	let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;   // 描いた線がちょうど入る範囲にする
	S.forEach(s => s.p.forEach(v => { const q = sp(s, v); if (!q.ok) return; x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y) }));
	if (x0 > x1) return; const m = 20; CR = { x0: clamp(x0 - m, 0, W), y0: clamp(y0 - m, 0, H), x1: clamp(x1 + m, 0, W), y1: clamp(y1 + m, 0, H) }; render()
};

// ===== ツール切り替え（消しゴム・図形・範囲）と設定パネルの開閉 =====
function setTool(t) {
	tool = tool === t ? 'pen' : t;
	[['tE', 'erase'], ['tS', 'shape'], ['tB', 'border'], ['tM', 'edit']].forEach(([id, n]) => $(id).classList.toggle('on', tool === n));
	if (tool !== 'pen') setMode('draw');
	const HT = { shape: '図形：キャンバスをドラッグすると長方形／円／三角柱／三角錐を作成し、自動で編集モードになります。種類・面は左の設定で選びます', border: '書き出し範囲：ドラッグで枠を指定。PNG保存・コピーはこの範囲で切り取られます', erase: '消しゴム：なぞったところを消します', edit: '図形編集：線にさわって選択。空白を長押ししてドラッグするとボックス選択。Shift/Ctrl/⌘クリックでも複数選択でき、選択済みの線をドラッグするとまとめて移動。iPadは指またはApple Pencilで長押しドラッグ。矢印＝軸に沿って移動／白い四角＝面を押し引き／点線の輪＝回転／線をドラッグ＝面の上で移動。看板は絵枠W・絵枠H・ベベルのハンドル、円錐は高さ、球体は半径ハンドルをドラッグできます' };
	if (HT[tool]) $('hint').textContent = HT[tool] + ' ／ ⌘(Ctrl)+ドラッグ＝視点移動'
}
$('tE').onclick = () => setTool('erase'); $('tS').onclick = () => setTool('shape'); $('tB').onclick = () => setTool('border'); $('tM').onclick = () => setTool('edit');
const edge = document.createElement('button'); edge.id = 'edgeTab'; edge.title = '設定パネルを開閉'; document.body.appendChild(edge);   // パネルの端にいつも出るタブ
function setSide(h) {
	const sd = $('side'); sd.classList.toggle('hide', h); $('tg').textContent = h ? '設定を開く' : '設定を隠す'; edge.textContent = h ? '▶' : '◀';
	edge.style.left = h ? 'env(safe-area-inset-left,0px)' : sd.getBoundingClientRect().right + 'px'; try { localStorage.setItem('pgrid-side', h ? '1' : '0') } catch (e) { }
}
$('tg').onclick = () => { setSide(!$('side').classList.contains('hide')); fit() }; edge.onclick = $('tg').onclick;
addEventListener('resize', () => setSide($('side').classList.contains('hide')));

// ===== 書き出し用の隠れ線除去 =====
// オブジェクトの面を簡易Zバッファへ rasterize し、ビューから遮られる線分だけを切る。
// 通常表示は従来どおり全線を描き、PNGの「背面線除去」項目だけでこの処理を使う。
function addExportBoxFaces(out, o, w, d, z0, z1) {
	const x = w / 2, y = d / 2, v = [[-x, -y, z0], [x, -y, z0], [x, y, z0], [-x, y, z0], [-x, -y, z1], [x, -y, z1], [x, y, z1], [-x, y, z1]];
	const f = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
	f.forEach(q => { const a = q.map(i => L2W(o, ...v[i])); out.push([a[0], a[1], a[2]], [a[0], a[2], a[3]]) });
}
function exportSurfaceTriangles(o) {
	const out = [], w = Math.abs(2 * Number(o.ra) || 1), d = Math.abs(2 * Number(o.rb) || 1), h = Math.max(.01, Math.abs(Number(o.h) || .01));
	const L = (x, y, z) => L2W(o, x, y, z), tri = (a, b, c) => out.push([L(...a), L(...b), L(...c)]), quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d) };
	const disk = (z, n = 24) => { const c = [0, 0, z]; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2; tri(c, [w / 2 * Math.cos(a), d / 2 * Math.sin(a), z], [w / 2 * Math.cos(b), d / 2 * Math.sin(b), z]) } };
	const cylinder = (z0, z1, n = 24) => { disk(z0, n); disk(z1, n); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2, A = [w / 2 * Math.cos(a), d / 2 * Math.sin(a), z0], B = [w / 2 * Math.cos(b), d / 2 * Math.sin(b), z0], C = [w / 2 * Math.cos(b), d / 2 * Math.sin(b), z1], D = [w / 2 * Math.cos(a), d / 2 * Math.sin(a), z1]; quad(A, B, C, D) } };
	const kind = o.asset || o.type;
	if ((o.type === 'rect' || kind === 'rect') && !o.extrude) { quad([-w / 2, -d / 2, 0], [w / 2, -d / 2, 0], [w / 2, d / 2, 0], [-w / 2, d / 2, 0]); return out }
	if (o.type === 'rect' || kind === 'box' || kind === 'sign') { addExportBoxFaces(out, o, w, d, kind === 'sign' ? h * .08 : 0, kind === 'sign' ? h * .82 : h); return out }
	if (o.type === 'circ' || kind === 'cylinder' || kind === 'lantern') { cylinder(kind === 'lantern' ? h * .22 : 0, kind === 'lantern' ? h * .70 : h, kind === 'lantern' ? 12 : 32); return out }
	if (kind === 'crosswalk') { quad([-w / 2, -d / 2, .01], [w / 2, -d / 2, .01], [w / 2, d / 2, .01], [-w / 2, d / 2, .01]); return out }
	if (kind === 'cone') {
		disk(0, 32); const apex = [0, 0, h], n = 32; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2; tri([0, 0, 0], [w / 2 * Math.cos(a), d / 2 * Math.sin(a), 0], apex); tri([0, 0, 0], apex, [w / 2 * Math.cos(b), d / 2 * Math.sin(b), 0]) } return out;
	}
	if (kind === 'triPrism') {
		const x = w / 2, y = d / 2, A = [[-x, -y, 0], [x, -y, 0], [0, -y, h]], B = [[-x, y, 0], [x, y, 0], [0, y, h]]; quad(A[0], A[1], A[2], A[2]); quad(B[2], B[1], B[0], B[0]); for (let i = 0; i < 3; i++)quad(A[i], B[i], B[(i + 1) % 3], A[(i + 1) % 3]); return out;
	}
	if (kind === 'triPyramid') {
		const x = w / 2, y = d / 2, A = [[-x, -y, 0], [x, -y, 0], [0, y, 0]], ap = [0, 0, h]; quad(A[0], A[1], A[2], A[2]); for (let i = 0; i < 3; i++)tri(A[i], A[(i + 1) % 3], ap); return out;
	}
	if (kind === 'sphere') {
		const lat = 12, lon = 24; for (let j = 0; j < lat; j++) { const p0 = -Math.PI / 2 + j * Math.PI / lat, p1 = -Math.PI / 2 + (j + 1) * Math.PI / lat; for (let i = 0; i < lon; i++) { const a = i * 2 * Math.PI / lon, b = (i + 1) * 2 * Math.PI / lon; const q = (p, t) => [w / 2 * Math.cos(p) * Math.cos(t), d / 2 * Math.cos(p) * Math.sin(t), h / 2 + h / 2 * Math.sin(p)]; const A = q(p0, a), B = q(p0, b), C = q(p1, b), D = q(p1, a); tri(A, B, C); tri(A, C, D) } } return out;
	}
	if (kind === 'stairs') {
		const n = Math.max(2, Math.min(24, Math.round(o.steps || 6))), sd = d / n, sh = h / n; for (let i = 0; i < n; i++) { const y0 = -d / 2 + i * sd, y1 = y0 + sd, z = (i + 1) * sh; quad([-w / 2, y0, 0], [w / 2, y0, 0], [w / 2, y1, z], [-w / 2, y1, z]); quad([-w / 2, y0, z], [w / 2, y0, z], [w / 2, y1, z], [-w / 2, y1, z]) } return out;
	}
	// 人物など細分化された線画は、全体の包絡箱で背面線を落とす安全側の近似。
	addExportBoxFaces(out, o, w, d, h * .02, h); return out;
}
function exportPoint(v, tf) { const rel = V.add(v, CO()), q = scr3(rel); if (!q.ok) return null; const depth = orthView ? dot3(rel, orthBasis().depth) : T === 'f' ? Math.hypot(rel[0], rel[1], rel[2]) : cam(rel)[2]; return { x: q.x * tf[0] + tf[4], y: q.y * tf[3] + tf[5], depth } }
function buildExportDepth(cw, ch, tf) {
	const depth = new Float32Array(cw * ch); depth.fill(Infinity); const tris = [], seen = new Set(); S.forEach(s => { if (s.ob && !seen.has(s.ob.id)) { seen.add(s.ob.id); tris.push(...exportSurfaceTriangles(s.ob)) } });
	const putTri = tr => { const p = tr.map(v => exportPoint(v, tf)); if (p.some(q => !q || !Number.isFinite(q.depth) || q.depth < -.001)) return; const area = (p[1].x - p[0].x) * (p[2].y - p[0].y) - (p[1].y - p[0].y) * (p[2].x - p[0].x); if (Math.abs(area) < .001) return; const x0 = Math.max(0, Math.floor(Math.min(p[0].x, p[1].x, p[2].x))), x1 = Math.min(cw - 1, Math.ceil(Math.max(p[0].x, p[1].x, p[2].x))), y0 = Math.max(0, Math.floor(Math.min(p[0].y, p[1].y, p[2].y))), y1 = Math.min(ch - 1, Math.ceil(Math.max(p[0].y, p[1].y, p[2].y))); for (let y = y0; y <= y1; y++)for (let x = x0; x <= x1; x++) { const px = x + .5, py = y + .5, w0 = ((p[1].x - p[0].x) * (py - p[0].y) - (p[1].y - p[0].y) * (px - p[0].x)) / area, w1 = ((p[2].x - p[1].x) * (py - p[1].y) - (p[2].y - p[1].y) * (px - p[1].x)) / area, w2 = ((p[0].x - p[2].x) * (py - p[2].y) - (p[0].y - p[2].y) * (px - p[2].x)) / area; if ((w0 >= -1e-5 && w1 >= -1e-5 && w2 >= -1e-5) || (w0 <= 1e-5 && w1 <= 1e-5 && w2 <= 1e-5)) { const z = p[0].depth * w1 + p[1].depth * w2 + p[2].depth * w0, idx = y * cw + x; if (z < depth[idx]) depth[idx] = z } } };
	tris.forEach(putTri); return depth;
}
function strokeWVisible(c, s, depth, cw, ch, tf) {
	if (!s.ob || !s.d3) { strokeW(c, s); return }
	c.strokeStyle = s.c; c.lineWidth = effectiveLineWidth(s); c.lineCap = c.lineJoin = 'round'; c.beginPath(); let on = false;
	const put = v => {
		const rel = V.add(v, CO()), q = scr3(rel), e = exportPoint(v, tf); if (!e || !q.ok) { on = false; return }
		const x = Math.round(e.x), y = Math.round(e.y); if (x < 0 || x >= cw || y < 0 || y >= ch) { on = false; return }
		const z = depth[y * cw + x], eps = Math.max(.025, Math.abs(e.depth) * .00015); if (e.depth > z + eps) { on = false; return }
		on ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); on = true;
	};
	s.p.forEach((v, i) => { if (i) { const a = s.p[i - 1], n = Math.max(1, Math.ceil(Math.hypot(v[0] - a[0], v[1] - a[1], v[2] - a[2]) * 10)); for (let j = 1; j < n; j++)put(V.add(a, v, 1 - j / n, j / n)) } put(v) }); c.stroke();
}

// ===== 線画レイヤー：線だけ別キャンバスに描き、アンチエイリアスを消して二値化する =====
let LC = null;
function lineLayer(view, withCur, cw = W, ch = H, tf = null, hidden = false) {   // tf=書き出し用の変換 [拡大,0,0,拡大,ずれx,ずれy]
	if (!LC || LC.width !== cw || LC.height !== ch) { LC = document.createElement('canvas'); LC.width = cw; LC.height = ch }
	const x = LC.getContext('2d', { willReadFrequently: true });
	x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cw, ch);
	if (tf) x.setTransform(...tf); else if (view) x.setTransform(Z, 0, 0, Z, ox, oy);                 // 画面表示用はズーム・移動つき
	const hiddenDepth = hidden ? buildExportDepth(cw, ch, tf || [1, 0, 0, 1, 0, 0]) : null;
	S.forEach(s => hidden ? strokeWVisible(x, s, hiddenDepth, cw, ch, tf || [1, 0, 0, 1, 0, 0]) : strokeW(x, s));
	if (withCur) drawCur(x);
	if (withCur && prev) prev.forEach(s => strokeW(x, s));
	if ($('bin').checked) {                                   // 二値化：しきい値以上の画素だけ完全に不透明にする
		x.setTransform(1, 0, 0, 1, 0, 0);
		const im = x.getImageData(0, 0, cw, ch), d = im.data, t = P.bt;
		for (let i = 3; i < d.length; i += 4)d[i] = d[i] < t ? 0 : 255;
		x.putImageData(im, 0, 0)
	}
	return LC
}

// ===== 地面のグリッド：床(y=-1)の格子。カメラの高さ・位置・向きを変えるとちゃんと見え方が変わる =====
function floorGrid(c) {
	const n = Math.round(P.gn), cell = P.gs, ext = n * cell, co = CO(), steps = Math.min(400, n * 8);
	c.save(); c.lineJoin = 'round';
	const line = (a, b) => {
		let on = false;   // 線を細かく区切って投影する（魚眼でも曲がって見える）
		for (let i = 0; i <= steps; i++) {
			const t = i / steps, q = scr3(V.add([a[0] + (b[0] - a[0]) * t, -1, a[2] + (b[2] - a[2]) * t], co));
			if (!q.ok) { on = false; continue } on ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); on = true
		}
	};
	const pass = (sel, col, alpha, w) => {
		c.strokeStyle = col; c.globalAlpha = alpha; c.lineWidth = w; c.beginPath();
		for (let k = -n; k <= n; k++)if (sel(k)) { line([k * cell, -1, -ext], [k * cell, -1, ext]); line([-ext, -1, k * cell], [ext, -1, k * cell]) } c.stroke()
	};
	pass(k => k % 5 !== 0, '#7d8279', P.ga * .55, P.gw);                       // ふつうの線
	pass(k => k % 5 === 0 && k !== 0, '#7d8279', Math.min(1, P.ga * 1.1), P.gw * 1.6); // 5マスごとの太い線
	c.lineWidth = P.gw * 2.4; c.globalAlpha = Math.min(1, P.ga * 1.3);          // 原点を通る線（X=橙・Z=緑）
	c.strokeStyle = '#e8743d'; c.beginPath(); line([-ext, -1, 0], [ext, -1, 0]); c.stroke();
	c.strokeStyle = '#2fb5a5'; c.beginPath(); line([0, -1, -ext], [0, -1, ext]); c.stroke();
	c.restore()
}

// 正投影ビューの補助線。消失点はなく、軸に沿った水平・垂直線として表示する。
function orthGuides(c) {
	const sc = orthScale(), col = ['#e8743d', '#2fb5a5', '#4a7be8'];
	c.save(); c.globalAlpha = P.ga; c.lineWidth = P.gw; c.setLineDash([]);
	const draw = (x0, y0, x1, y1, color) => { c.strokeStyle = color; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke() };
	const b = orthBasis();
	if (orthView === 'top') {
		for (let i = -20; i <= 20; i++) { const x = W / 2 + i * sc; draw(x, 0, x, H, col[0]); const y = H / 2 + i * sc; draw(0, y, W, y, col[2]) }
	} else {
		for (let i = -20; i <= 20; i++) { const x = W / 2 + i * sc; draw(x, 0, x, H, col[orthView === 'front' ? 0 : 1]); const y = H / 2 + i * sc; draw(0, y, W, y, col[2]) }
	}
	c.restore();
}

// ===== 補助線（キャンバスに入る角度範囲にだけ本数を割り振る＝密に出来る） =====
function guides(c) {
	const col = ['#e8743d', '#2fb5a5', '#4a7be8'], diag = Math.hypot(W, H), n = P.n;
	AX.forEach((A, i) => {
		if (!show[i]) return;
		c.strokeStyle = col[i]; c.globalAlpha = P.ga; c.lineWidth = P.gw; c.beginPath();
		if (A.vp) {
			const { x, y } = A.vp, inside = x >= 0 && x <= W && y >= 0 && y <= H, L = Math.hypot(x - W / 2, y - H / 2) + diag;
			let base = 0, lo = 0, hi = 0;
			if (!inside) {                       // 4隅への角度の最小〜最大を求める
				base = Math.atan2(H / 2 - y, W / 2 - x); lo = 1e9; hi = -1e9;
				for (const [px, py] of [[0, 0], [W, 0], [0, H], [W, H]]) { let d = Math.atan2(py - y, px - x) - base; d = Math.atan2(Math.sin(d), Math.cos(d)); lo = Math.min(lo, d); hi = Math.max(hi, d) }
			}
			for (let k = 0; k < n; k++) {
				const t = inside ? 2 * Math.PI * k / n : base + lo + (hi - lo) * k / (n - 1);
				c.moveTo(x, y); c.lineTo(x + L * Math.cos(t), y + L * Math.sin(t));
			}
		} else {                               // 平行線（水平・垂直）
			const u = A.dir, nx = -u.y, ny = u.x; let lo = 1e9, hi = -1e9;
			for (const [px, py] of [[0, 0], [W, 0], [0, H], [W, H]]) { const s = px * nx + py * ny; lo = Math.min(lo, s); hi = Math.max(hi, s) }
			for (let k = 0; k < n; k++) { const s = lo + (hi - lo) * k / (n - 1), px = nx * s, py = ny * s; c.moveTo(px - u.x * 2 * diag, py - u.y * 2 * diag); c.lineTo(px + u.x * 2 * diag, py + u.y * 2 * diag) }
		}
		c.stroke();
	});
	c.globalAlpha = 1;
}

// ===== 描画 =====
function stroke(c, s) { c.strokeStyle = s.c; c.lineWidth = effectiveLineWidth(s); c.lineCap = c.lineJoin = 'round'; c.beginPath(); c.moveTo(s.p[0].x, s.p[0].y); for (let i = 1; i < s.p.length; i++)c.lineTo(s.p[i].x, s.p[i].y); c.stroke() }
function render() {
	dirty = true; if (S.some(s => s.ob && s.cs !== sigNow())) regenObjects(); syncSel(); T === 'f' ? calcF() : calc(); const c = ctx;
	c.clearRect(0, 0, W, H); c.fillStyle = $('bgw').checked ? '#fff' : '#23251f'; c.fillRect(0, 0, W, H); c.save(); c.setTransform(Z, 0, 0, Z, ox, oy);   // 以降はズーム/移動つき
	if (IMG) { const s = Math.min(W / IMG.width, H / IMG.height), w = IMG.width * s, h = IMG.height * s; c.globalAlpha = P.pa; c.drawImage(IMG, (W - w) / 2, (H - h) / 2, w, h); c.globalAlpha = 1 }
	if (window.cityFloorTint && $('floorTint')?.checked) window.cityFloorTint(c);
	if ($('gg').checked) floorGrid(c);
	if ($('gon').checked) { if (orthView) orthGuides(c); else T === 'f' ? guidesF(c) : guides(c); }
	if ($('hzl').checked && !orthView) { c.strokeStyle = '#e8a33d'; c.lineWidth = 1.2; c.setLineDash([10, 8]); c.beginPath(); if (T === 'f') circ(c, AXC[0], AXC[1]); else { c.moveTo(0, AX.hy); c.lineTo(W, AX.hy) } c.stroke(); c.setLineDash([]) }
	if ($('bin').checked) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(lineLayer(true, true), 0, 0); c.restore() }
	else { S.forEach(s => strokeW(c, s)); drawCur(c); if (prev) prev.forEach(s => strokeW(c, s)) }
	// 選択中の線を橙色に塗り替えない。線画は常に設定した線色で表示し、選択状態はギズモだけで示す。
	if (snapHit) S.forEach(s => { if (s.ob && snapHit.has(s.ob.id)) { c.save(); c.globalAlpha = .75; strokeW(c, { ...s, c: '#ff3df2', w: s.w + 3 / Z }); c.restore() } });   // くっつき先は桃色
	if (tool === 'edit' && selIds.size > 1) drawSelectionFeedback(c);
	if (sel && tool === 'edit' && !window.cityFloorPlanActive) drawGizmo(c);   // 3D視点の移動の矢印・面のハンドル・回転の輪
	if (window.cityFloorPlanOverlay && window.cityFloorPlanActive) window.cityFloorPlanOverlay(c);
	if (boxSelect) drawBoxSelection(c);
	if (er) { c.strokeStyle = '#e84a4a'; c.lineWidth = 1.5 / Z; c.beginPath(); c.arc(er.last.x, er.last.y, P.ew, 0, 7); c.stroke() }
	if (T === 'f') { markF(c); overlay(c); c.restore(); return }
	// VPの目印（画面外なら端に寄せて表示）
	['VP1', 'VP2', 'VP3'].forEach((nm, i) => {
		const A = AX[i]; if (!A.vp || !show[i]) return;
		let dx = A.vp.x - W / 2, dy = A.vp.y - H / 2; const t = Math.min(1, (W / 2 - 14) / (Math.abs(dx) || 1e-9), (H / 2 - 14) / (Math.abs(dy) || 1e-9));
		const px = W / 2 + dx * t, py = H / 2 + dy * t; c.fillStyle = ['#e8743d', '#2fb5a5', '#4a7be8'][i]; c.beginPath(); c.arc(px, py, 7, 0, 7); c.fill();
		c.font = 'bold 18px system-ui'; c.fillText(nm + (t < 1 ? ' →' : ''), Math.min(px + 10, W - 70), Math.max(py - 10, 20))
	});
	overlay(c); c.restore();
	const q = v => v ? `(${(v.x / W * 100).toFixed(0)}%, ${(v.y / H * 100).toFixed(0)}%)` : '無限遠(平行)';
	$('info').innerHTML = `画角 ${(2 * Math.atan(18 / P.lens) * 180 / Math.PI).toFixed(1)}°<br>VP1 ${q(AX[0].vp)}<br>VP2 ${q(AX[1].vp)}<br>垂直 ${AX[2].vp ? 'VP3 ' + q(AX[2].vp) : '平行（垂直）'}<br>地平線 ${(AX.hy / H * 100).toFixed(1)}%`;
}

// ===== マウス/タッチ操作 =====
let ptr = null, lastPen = 0;   // 操作中のポインタID／最後にペンを離した時刻（手のひら誤タッチ対策）
const rawOf = (cx, cy) => { const r = cv.getBoundingClientRect(); return { x: (cx - r.left) * W / r.width, y: (cy - r.top) * H / r.height } };   // 画面→キャンバス(ズーム前)
const pos = e => { const r = rawOf(e.clientX, e.clientY); return { x: (r.x - ox) / Z, y: (r.y - oy) / Z } };   // ズーム・移動を戻した描画座標
const TC = new Map();   // いま触れている指(touch)
function clampView() { Z = clamp(Z, 1, 10); ox = clamp(ox, W - W * Z, 0); oy = clamp(oy, H - H * Z, 0) }
function updZ() { $('zr').textContent = Math.round(Z * 100) + '%' }
$('zr').onclick = () => { Z = 1; ox = oy = 0; updZ(); render() };
cv.addEventListener('wheel', e => {
	e.preventDefault();
	if (mode === 'view') {
		P.lens = clamp(P.lens * Math.exp(-e.deltaY * 0.0012), 14, 200); sync(); render(); return;
	}
	const r = rawOf(e.clientX, e.clientY), q = { x: (r.x - ox) / Z, y: (r.y - oy) / Z };
	Z = clamp(Z * Math.exp(-e.deltaY * 0.0015), 1, 10); ox = r.x - q.x * Z; oy = r.y - q.y * Z; clampView(); updZ(); render()
}, { passive: false });   // ビューではレンズ、描画ではキャンバスズーム

// ===== 二本指/三本指：ピンチでズーム・移動、タップで元に戻す/やり直し =====
function multiStart() {
	cancelBoxPending(); boxSelect = null;
	if (drag) { setP('yaw', drag.yaw); setP('pitch', drag.pitch); setP('cx', drag.cx); setP('cz', drag.cz); setP('ch', drag.ch); sync() }   // 1本目で動いた分は戻す
	drag = null; cur = null; er = null; sh = null; prev = null; bd = false; ed = null; ptr = null; ptrType = null;
	if (!mg) mg = { t0: Date.now(), n: 0, moved: false, x0: null, y0: null, x1: null, y1: null };
	const pts = [...TC.values()]; mg.n = Math.max(mg.n, pts.length); mg.view = mode === 'view';
	const cx = pts.reduce((a, t) => a + t.x, 0) / Math.max(1, pts.length), cy = pts.reduce((a, t) => a + t.y, 0) / Math.max(1, pts.length);
	if (mg.x0 == null) { mg.x0 = cx; mg.y0 = cy } mg.x1 = cx; mg.y1 = cy;
	pts.forEach(t => { t.sx = t.x; t.sy = t.y });
	if (pts.length === 2) {
		const rc = rawOf((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
		mg.d0 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); mg.z0 = Z; mg.q0 = { x: (rc.x - ox) / Z, y: (rc.y - oy) / Z }; mg.cx0 = P.cx; mg.cz0 = P.cz; mg.ch0 = P.ch; mg.lens0 = P.lens; mg.mx0 = (pts[0].x + pts[1].x) / 2; mg.my0 = (pts[0].y + pts[1].y) / 2
	}   // 指の中心を基準にする
}
function multiMove(tc) {
	if (Math.hypot(tc.x - tc.sx, tc.y - tc.sy) > 14) mg.moved = true;   // 14px以上動いたらタップではない
	const pts = [...TC.values()];
	if (pts.length) { mg.x1 = pts.reduce((a, t) => a + t.x, 0) / pts.length; mg.y1 = pts.reduce((a, t) => a + t.y, 0) / pts.length }
	if (mg.moved && pts.length === 2 && mg.d0 > 0) {
		const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
		if (mg.view) {
			const k = W / cv.getBoundingClientRect().width, worldPerPx = Math.max(.15, P.ch) * 2 / H * k, dx = mx - mg.mx0, dy = my - mg.my0, th = P.yaw * DG;
			setP('cx', mg.cx0 - dx * worldPerPx * Math.cos(th)); setP('cz', mg.cz0 - dx * worldPerPx * Math.sin(th)); setP('ch', clamp(mg.ch0 + dy * worldPerPx, .05, 30)); P.lens = clamp(mg.lens0 * d / mg.d0, 14, 200); sync(); render();
		} else {
			const rc = rawOf(mx, my); Z = clamp(mg.z0 * d / mg.d0, 1, 10); ox = rc.x - mg.q0.x * Z; oy = rc.y - mg.q0.y * Z; clampView(); updZ(); render();
		}
	}
}

// ===== 消しゴム（線は向きの点列で持っているので、点を消して線を分割する） =====
// 点列を細かくする（部分消しの精度のため）
function dens(a) {
	const o = [a[0]]; for (let i = 1; i < a.length; i++) {
		const u = a[i - 1], v = a[i], n = Math.ceil(Math.acos(Math.max(-1, Math.min(1, V.dot(u, v)))) / 0.004);
		for (let j = 1; j <= n; j++)o.push(j === n ? v : V.nrm(V.add(u, v, 1 - j / n, j / n)))
	} return o
}
function dens3(a) {
	const o = [a[0]], co = CO();
	for (let i = 1; i < a.length; i++) {
		const u = a[i - 1], v = a[i], n = Math.ceil(Math.acos(Math.max(-1, Math.min(1, V.dot(V.nrm(V.add(u, co)), V.nrm(V.add(v, co)))))) / 0.004);
		for (let j = 1; j <= n; j++)o.push(j === n ? v : V.add(u, v, 1 - j / n, j / n))
	} return o
}
function eraseAt(p) {
	const r2 = P.ew * P.ew, all = $('em').value === 'all', res = [], det = new Set(); let ch = false;
	for (const s of S) {
		const hit = s.p.map(v => { const q = sp(s, v); return q.ok && (q.x - p.x) ** 2 + (q.y - p.y) ** 2 <= r2 });
		if (!hit.some(Boolean)) { res.push(s); continue }
		ch = true; if (s.ob) det.add(s.ob.id); if (all) continue;                       // 線ごと消す
		let seg = [];
		s.p.forEach((v, i) => { if (hit[i]) { if (seg.length > 1) res.push({ c: s.c, w: s.w, d3: s.d3, p: seg }); seg = [] } else seg.push(v) });
		if (seg.length > 1) res.push({ c: s.c, w: s.w, d3: s.d3, p: seg });
	}
	if (ch) { S = det.size ? res.map(s => s.ob && det.has(s.ob.id) ? { ...s, ob: undefined } : s) : res; if (sel && det.has(sel)) clearSelection() }
}
// aからbまでなぞった間も取りこぼさず消す
function stepErase(a, b) {
	const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / (P.ew / 2)));
	for (let i = 1; i <= n; i++)eraseAt({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n })
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// 長押し＋ドラッグのボックス選択。空白から始めたときだけ起動し、
// 通常のオブジェクトドラッグやiPadの視点操作とは競合しないようにする。
let boxSelect = null, boxPending = null, boxTimer = null;
function cancelBoxPending() { if (boxTimer) { clearTimeout(boxTimer); boxTimer = null } const p = boxPending; boxPending = null; return p }
function armBoxPending(start, pointerId, source = 'canvas', meta = {}) {
	cancelBoxPending();
	const pending = { start: { ...start }, pointerId, source, ...meta }; boxPending = pending;
	boxTimer = setTimeout(() => {
		if (boxPending !== pending) return;
		boxPending = null; boxTimer = null;
		if (source === 'floor') floorPlanDrag = null;
		boxSelect = { pointerId, start: { ...pending.start }, end: { ...pending.start }, source }; clearSelection(); render();
	}, 360);
}
// 戻り値: pending / cancel / floorPan。floorPanのときだけ従来の表示パンへ引き継ぐ。
function updateBoxPending(p, pointerId) {
	const pending = boxPending; if (!pending || pending.pointerId !== pointerId) return null;
	if (Math.hypot(p.x - pending.start.x, p.y - pending.start.y) <= 8) return 'pending';
	cancelBoxPending();
	if (pending.source === 'floor') {
		if (!Array.isArray(window.cityFloorPlanCenter)) fitFloorPlan();
		floorPlanDrag = { kind: 'pan', pointerId, p0: { ...pending.start }, center0: [...(pending.center0 || window.cityFloorPlanCenter || [0, 0])], tapClear: true, moved: true };
		return 'floorPan';
	}
	return 'cancel';
}
function boxScreenBounds(o) {
	const b = obBounds(o), pts = [];
	for (const x of [b.lo[0], b.hi[0]]) for (const y of [b.lo[1], b.hi[1]]) for (const z of [b.lo[2], b.hi[2]]) { const q = scrW([x, y, z]); if (q && q.ok && Number.isFinite(q.x) && Number.isFinite(q.y)) pts.push(q) }
	if (!pts.length) return null;
	return { x0: Math.min(...pts.map(q => q.x)), y0: Math.min(...pts.map(q => q.y)), x1: Math.max(...pts.map(q => q.x)), y1: Math.max(...pts.map(q => q.y)) };
}
// アセット側のIIFE内にあるsceneObjects()へ依存せず、単一版・分割版の
// どちらでもボックス選択から直接参照できるオブジェクト一覧を作る。
function boxSceneObjects() {
	const out = [], seen = new Set();
	S.forEach(s => { const o = s && s.ob; if (o && !seen.has(o.id)) { seen.add(o.id); out.push(o) } });
	return out;
}
function finishBoxSelection(end) {
	if (!boxSelect) return;
	const a = boxSelect.start, b = end || boxSelect.end, x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y), chosen = [];
	boxSceneObjects().filter(o => !window.cityFloorPlanActive || o.k === 1).forEach(o => { const q = boxScreenBounds(o); if (!q) return; const cx = (q.x0 + q.x1) / 2, cy = (q.y0 + q.y1) / 2; if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) chosen.push(o) });
	clearSelection(); chosen.forEach(o => selIds.add(o.id)); sel = chosen.length ? chosen[chosen.length - 1].id : null; normalizeSelection(); boxSelect = null; tool = 'edit'; setMode('draw'); syncSel(); render();
}
function drawBoxSelection(c) {
	if (!boxSelect) return; const a = boxSelect.start, b = boxSelect.end, x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
	c.save(); c.fillStyle = 'rgba(102,227,200,.12)'; c.strokeStyle = '#66e3c8'; c.lineWidth = 1.5 / Z; c.setLineDash([7 / Z, 4 / Z]); c.fillRect(x, y, w, h); c.strokeRect(x, y, w, h); c.restore();
}
// 複数選択時は主役のギズモだけでなく、選択中の全オブジェクトを枠で示す。
// 線色そのものは変えず、通常の編集表示を壊さないよう補助枠だけを描く。
function drawSelectionFeedback(c) {
	const chosen = boxSceneObjects().filter(o => selIds.has(o.id)); if (!chosen.length) return;
	c.save(); c.lineWidth = 1.6 / Z; c.setLineDash([6 / Z, 4 / Z]); c.globalAlpha = .92;
	chosen.forEach(o => {
		const q = boxScreenBounds(o); if (!q) return; const pad = 5 / Z;
		c.strokeStyle = o.id === sel ? '#ffd34d' : '#66e3c8'; c.fillStyle = o.id === sel ? '#ffd34d' : '#66e3c8';
		c.strokeRect(q.x0 - pad, q.y0 - pad, Math.max(1, q.x1 - q.x0 + pad * 2), Math.max(1, q.y1 - q.y0 + pad * 2));
		c.setLineDash([]); c.beginPath(); c.arc((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, 3.5 / Z, 0, Math.PI * 2); c.fill(); c.setLineDash([6 / Z, 4 / Z]);
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
	if (floorPlanDrag && floorPlanDrag.pointerId === pointerId) floorPlanDrag = null;
	if (ptr === pointerId) { ptr = null; ptrType = null }
	if (typeof TC !== 'undefined') TC.delete(pointerId);
	if (e?.pointerType === 'pen') lastPen = Date.now();
	try { if (cv.hasPointerCapture?.(pointerId)) cv.releasePointerCapture(pointerId) } catch (err) { }
	if (!commit) render();
	return true;
}
function abortAllBoxPointers() {
	const ids = new Set();
	if (boxSelect) ids.add(boxSelect.pointerId);
	if (boxPending) ids.add(boxPending.pointerId);
	ids.forEach(pointerId => endBoxPointer({ pointerId }, false));
}
// 押したままキャンバス外へ出た時点で確定して終了する。これにより、
// サイドパネル／上部バー上でpointerupを受け損なうブラウザでも残像を残さない。
addEventListener('pointermove', e => {
	if (!boxPointerIsActive(e.pointerId)) return;
	const released = e.pointerType !== 'touch' && e.buttons === 0;
	if (!released && !boxPointInsideCanvas(e)) {
		e.preventDefault(); e.stopPropagation(); endBoxPointer(e, !!(boxSelect && boxSelect.pointerId === e.pointerId));
	} else if (released) {
		e.preventDefault(); e.stopPropagation(); endBoxPointer(e, true);
	}
}, true);
addEventListener('pointerup', e => {
	if (!boxPointerIsActive(e.pointerId)) return;
	e.preventDefault(); e.stopPropagation(); endBoxPointer(e, true);
}, true);
addEventListener('pointercancel', e => {
	if (!boxPointerIsActive(e.pointerId)) return;
	e.preventDefault(); e.stopPropagation(); endBoxPointer(e, false);
}, true);
// Pointer Captureが途中で失われた場合も、矩形を残さずキャンセルする。
cv.addEventListener('lostpointercapture', e => {
	if (boxPointerIsActive(e.pointerId)) endBoxPointer(e, false);
}, true);
// UIへフォーカスが移った／画面が隠れた場合の最後の保険。
addEventListener('blur', abortAllBoxPointers);
document.addEventListener('visibilitychange', () => { if (document.hidden) abortAllBoxPointers() });
addEventListener('pagehide', abortAllBoxPointers);
// 最初の数pxの向きから、一番近い軸を選ぶ
function pick(a, p) {
	const l = Math.hypot(p.x - a.x, p.y - a.y), m = { x: (p.x - a.x) / l, y: (p.y - a.y) / l }; let b = 0, bs = 9;
	[0, 1, 2].forEach(i => { const u = dirAt(a, i), s = Math.abs(m.x * u.y - m.y * u.x); if (s < bs) { bs = s; b = i } }); return b
}
cv.onpointerdown = e => {
	const touch = e.pointerType === 'touch';
	if (touch && ptrType === 'pen') return;                                // ペンで描いている間の手のひらは無視
	if (touch) {                                                       // 指の本数を数える（2本以上→ピンチ/タップ判定）
		TC.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }); cv.setPointerCapture(e.pointerId);
		if (TC.size >= 2) { multiStart(); return }
		if (mg || Date.now() - lastPen < 600) return;                          // ペン直後の1本指(手のひら)は視点を動かさない。2本以上のジェスチャーは受け付ける
	} else if (e.pointerType === 'pen' && ptrType !== 'pen') { drag = null; cur = null; er = null; sh = null; prev = null; bd = false; ed = null; ptr = null; mg = null; TC.clear() }   // ペンは指より優先
	// iPadでpointerupを取りこぼした古いポインタが残っても、次の編集操作を止めない。
	if (ptr != null && ptr !== e.pointerId && e.pointerType !== 'mouse' && !TC.has(ptr)) { ptr = null; ptrType = null; ed = null; drag = null; cur = null; mg = null }
	if (tool === 'edit' && e.pointerType !== 'mouse' && mode !== 'draw') setMode('draw');
	if (ptr != null) return;
	ptr = e.pointerId; ptrType = e.pointerType; cv.setPointerCapture(e.pointerId); const p = pos(e);
	const pn = $('pn').checked, mod = e.pointerType === 'mouse' && (e.metaKey || e.ctrlKey), selectGesture = tool === 'edit' && mode === 'draw' && e.pointerType === 'mouse' && e.button === 0 && (e.shiftKey || e.metaKey || e.ctrlKey), nav = e.pointerType === 'mouse' && (e.button === 1 || e.button === 2 || e.altKey || ((e.shiftKey || mod) && !selectGesture)), touchTool = pn && e.pointerType === 'touch' && tool !== 'shape' && tool !== 'edit' && tool !== 'erase', editPointer = tool === 'edit' && (e.pointerType === 'touch' || e.pointerType === 'pen'), act = (nav || (!selectGesture && mod)) ? 'view' : editPointer ? 'draw' : pn && e.pointerType === 'pen' ? 'draw' : touchTool ? 'view' : mode;   // 編集モードのShift/Ctrl/⌘クリックとiPadの編集入力は編集を優先し、その他の修飾ドラッグは視点移動。
	if (act === 'view') {
		const pan = e.shiftKey || e.altKey || e.button === 2;
		drag = { kind: pan ? 'pan' : 'orbit', x: e.clientX, y: e.clientY, yaw: P.yaw, hz: P.hz, pitch: P.pitch, cx: P.cx, cz: P.cz, ch: P.ch };
		return;
	}
	if (act === 'draw' && tool === 'edit') {
		const hg = sel ? hitGizmo(p) : null;
		if (hg) beginGizmo(hg, p);                                   // 矢印・白い四角・輪をつかんだ
		else {
			const id = pickOb(p), multi = e.shiftKey || e.metaKey || e.ctrlKey, wasSelected = !!(id && selIds.has(id));
			// Shift/Ctrl/⌘クリックで追加・解除。選択済みのオブジェクトをそのままドラッグしたときは、選択中全体を動かす。
			if (multi) setSelection(id, true);
			else if (!wasSelected || selIds.size <= 1) setSelection(id, false);
			if (id && selIds.has(id)) {
				const o = obOf(id), group = selectedObjects().map(q => ({ ...q, off: [...(q.off || [0, 0, 0])] }));
				if (!window.cityFloorPlanActive || o.k === 1) ed = { t: 'mv', id, o0: { ...o }, group, p0: p, P0: hit3(unscr(p), o.k, o.d - o.d * o.lift, cloc(o)), started: false, ...snapSetupGroup(group, L2W(o, 0, 0, 0)) };
			} else armBoxPending(p, e.pointerId, 'canvas');
		}
		syncSel(); render(); return
	}
	if (act === 'draw' && tool === 'shape') {
		const k = +$('shK').value, r0 = unscr(p), d = r0[k] >= 0 ? 1 : -1, c = camPos(), off = [c[0], k === 1 && r0[1] < 0 ? 0 : c[1], c[2]], cl = V.add(c, off, 1, -1);
		const A = hit3(r0, k, d, cl) || V.add(cl, r0, 1, P.dp);
		sh = { k, d, off, cl, A }; prev = null; render(); return;
	}
	if (act === 'draw' && tool === 'border') { bd = true; CR = { x0: clamp(p.x, 0, W), y0: clamp(p.y, 0, H), x1: clamp(p.x, 0, W), y1: clamp(p.y, 0, H) }; render(); return }
	if (act === 'draw' && tool === 'erase') { er = { base: S, last: p }; stepErase(p, p); render(); return }   // 消しゴム
	const sn = $('snap').value;
	cur = { a: p, p: [p], ax: sn === 'free' ? -2 : sn === 'auto' ? -1 : +sn, c: $('pc').value, w: MASTER_W, al: null };
	if (true) {
		const r0 = unscr(p); let t0 = r0[1] < -1e-4 ? -P.ch / r0[1] : Infinity; if (!(t0 < 500)) t0 = P.dp;   // 床に当たれば床の位置、当たらなければ奥行き(空)
		cur.D = t0; cur.P0 = V.add(camPos(), r0, 1, t0); cur.pv = { c: cur.c, w: cur.w, d3: true, p: [cur.P0] }
	}
};
cv.onpointermove = e => {
	const tc = TC.get(e.pointerId); if (tc) { tc.x = e.clientX; tc.y = e.clientY; if (mg) { multiMove(tc); return } }
	const boxPendingState = updateBoxPending(pos(e), e.pointerId);
	if (boxSelect && boxSelect.pointerId === e.pointerId) { boxSelect.end = pos(e); render(); return }
	if (boxPendingState === 'pending' || boxPendingState === 'cancel') return;
	if (e.pointerId !== ptr) return;
	const k = W / cv.getBoundingClientRect().width;
	if (drag) {
		const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
		if (drag.kind === 'pan') {
			const worldPerPx = Math.max(.15, P.ch) * 2 / H * k;
			const th = P.yaw * DG;
			setP('cx', drag.cx - dx * worldPerPx * Math.cos(th));
			setP('cz', drag.cz - dx * worldPerPx * Math.sin(th));
			setP('ch', clamp(drag.ch + dy * worldPerPx, .05, 30));
		} else {
			const yawLimit = T === 'f' ? 180 : 180;
			setP('yaw', +clamp(drag.yaw + dx * k * 0.10, -yawLimit, yawLimit).toFixed(3));
			setP('pitch', +clamp(drag.pitch - dy * k * 0.10, -89, 89).toFixed(2));
		}
		sync(); render(); return
	}
	if (ed) { dragEdit(pos(e)); return }
	if (sh) { prev = buildShape(sh, pos(e)); render(); return }
	if (bd) { const p = pos(e); CR.x1 = clamp(p.x, 0, W); CR.y1 = clamp(p.y, 0, H); render(); return }
	if (er) { const p = pos(e); stepErase(er.last, p); er.last = p; render(); return }
	if (!cur) return; const p = pos(e), a = cur.a;
	if (cur.ax === -1 && Math.hypot(p.x - a.x, p.y - a.y) >= 6) cur.ax = pick(a, p);
	if (cur.ax === -2) { cur.p.push(p); if (cur.P0) cur.pv.p.push(V.add(camPos(), unscr(p), 1, cur.D)) }   // フリーハンド
	else if (cur.ax >= 0) {
		if (cur.P0) {   // 定規：3Dの直線（軸に沿う）。ペンの位置を、画面上の定規の線へ垂直に落とした点まで引く
			let E; if (T === 'f') { const q = curveF(a, p, cur.ax); E = q[q.length - 1] } else { const u = dirAt(a, cur.ax), tt = (p.x - a.x) * u.x + (p.y - a.y) * u.y; E = { x: a.x + u.x * tt, y: a.y + u.y * tt } }
			const a3 = AXW[cur.ax], t = lineParam(unscr(E), V.add(cur.P0, CO()), a3); if (t != null) cur.pv.p = dens3([cur.P0, V.add(cur.P0, a3, 1, t)])
		}
		else if (T === 'f') cur.p = curveF(a, p, cur.ax);   // 魚眼：大円の曲線に投影
		else { const u = dirAt(a, cur.ax), t = (p.x - a.x) * u.x + (p.y - a.y) * u.y; cur.p = [a, { x: a.x + u.x * t, y: a.y + u.y * t }] }  // 定規の線上に投影
	}
	render();
};
cv.onpointerup = cv.onpointercancel = e => {
	if (e.pointerType === 'touch') {
		const had = TC.delete(e.pointerId);
		if (mg) {
			if (!TC.size) {   // 指が全部離れた：2本タップ=元に戻す、3本タップ=やり直し、4本タップ=プリミティブメニュー
				if (e.type === 'pointerup' && !mg.moved && Date.now() - mg.t0 < 450) {
					if (mg.n === 2) undo();
					else if (mg.n === 3) redo();
					else if (mg.n >= 4 && window.cityPrimitiveMenuToggle) window.cityPrimitiveMenuToggle();
				} else if (e.type === 'pointerup' && mg.moved && mg.n === 3 && window.cityThreeFingerSelect) {
					window.cityThreeFingerSelect(mg.x1 - mg.x0, mg.y1 - mg.y0, mg.x1, mg.y1);
				}
				mg = null
			} return
		}
		if (!had) return
	}
	if (boxSelect && boxSelect.pointerId === e.pointerId) { if (e.type === 'pointerup') finishBoxSelection(boxPoint(e)); else boxSelect = null; cancelBoxPending(); ptr = null; ptrType = null; if (e.pointerType === 'pen') lastPen = Date.now(); return }
	if (boxPending && boxPending.pointerId === e.pointerId) { cancelBoxPending(); ptr = null; ptrType = null; if (e.pointerType === 'pen') lastPen = Date.now(); return }
	if (e.pointerId !== ptr) return; ptr = null; ptrType = null; if (e.pointerType === 'pen') lastPen = Date.now();
	if (er) { if (S !== er.base) { HU.push(er.base); RD = [] } er = null }
	if (sh) { if (prev && prev.length) { HU.push(S); S = [...S, ...prev]; RD = []; setSelection(prev[0].ob.id, false); setTool('edit') } sh = null; prev = null }   // 図形を確定し、すぐに押し出し可能な編集モードへ
	if (bd) { bd = false; const r = crect(); if (r.w < 8 || r.h < 8) CR = null }
	ed = null; snapHit = null;
	drag = null; if (cur && cur.pv) { if (cur.pv.p.length > 1) { HU.push(S); S = [...S, { c: cur.c, w: cur.w, d3: true, p: dens3(cur.pv.p) }]; RD = [] } }   // 3Dの線として保存
	else if (cur && cur.p.length > 1) { HU.push(S); S = [...S, { c: cur.c, w: cur.w, p: dens(cur.p.map(unscr)) }]; RD = [] } cur = null; render()
};   // 向きに変換して保存

// iPad Safariでキャンバス外へ指／ペンを離した場合の一般操作用保険。
// ボックス選択以外の編集でも、古いpointerIdが次の操作をブロックしないようにする。
function releaseInputState(e) {
	if (e?.pointerType === 'touch') {
		TC.delete(e.pointerId);
		if (!TC.size) mg = null;
	}
	if (e?.pointerType === 'pen') lastPen = Date.now();
	if (ptr === e?.pointerId) { ptr = null; ptrType = null; ed = null; drag = null; cur = null; sh = null; bd = false; er = null; snapHit = null }
}
addEventListener('pointerup', releaseInputState, false);
addEventListener('pointercancel', releaseInputState, false);
addEventListener('blur', () => { if (!boxSelect && !boxPending) { ptr = null; ptrType = null; ed = null; drag = null; cur = null; sh = null; bd = false; er = null; TC.clear(); mg = null } });

// ===== モード・ボタン =====
function setMode(m) {
	mode = m; $('mV').classList.toggle('on', m === 'view'); $('mD').classList.toggle('on', m === 'draw'); cv.style.cursor = m === 'view' ? 'move' : 'crosshair';
	$('hint').textContent = ($('pn').checked ? '【指＝視点／ペン＝描画】' : '') + (m === 'view' ? (T === 'f' ? 'ドラッグ：視点を回転／Shiftまたは右ドラッグ：水平移動／ホイール：ズーム' : 'ドラッグ：視点を回転／Shiftまたは右ドラッグ：水平移動／ホイール：ズーム（矢印キーでも可）') : '線を引くと、向かっているVPへ自動で吸着します。Ctrl/⌘+Zで元に戻す') + ' ／ 中ドラッグ：回転・Shift+ドラッグ：パン'
}
$('mV').onclick = () => setMode('view'); $('mD').onclick = () => setMode('draw');
const undo = () => { if (HU.length) { RD.push(S); S = HU.pop(); render() } }, redo = () => { if (RD.length) { HU.push(S); S = RD.pop(); render() } };
$('undo').onclick = undo; $('redo').onclick = redo; $('clr').onclick = () => { if (S.length && confirm('全部消しますか？')) { HU.push(S); S = []; RD = []; render() } };
addEventListener('keydown', e => {
	const m = e.ctrlKey || e.metaKey;
	if (m && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return }
	if (m && e.key.toLowerCase() === 'y') { redo(); return }
	if (e.key === 'e' && !window.cityFloorPlanActive && !/INPUT|SELECT/.test(e.target.tagName)) { $('tE').click(); return }
	if (!m && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) {
		if (e.key === '1') { if (typeof setSide === 'function') { setSide(!$('side').classList.contains('hide')); fit() } return }
		if (e.key === '2') { setMode('view'); return }
		if (e.key === '3') { tool = 'pen'; setTool('pen'); setMode('draw'); return }
		if (e.key === '4') { tool = 'pen'; setTool('edit'); return }
		if (e.key === '5') { document.getElementById('assetToggle')?.click(); return }
		if (e.key === '8') { window.cityFloorPlanView?.('side'); return }
		if (e.key === '9') { window.cityFloorPlanView?.('top'); return }
		if (e.key === '0') { if (window.cityFloorPlanActive) window.cityFloorPlanExit?.(true); else window.cityStandardView?.('home'); return }
	}
	if (mode !== 'view' || /INPUT|SELECT/.test(e.target.tagName)) return;
	const d = e.shiftKey ? 5 : 0.5;
	const L = 180;
	if (e.key === 'ArrowLeft') setP('yaw', clamp(P.yaw - d, -L, L)); else if (e.key === 'ArrowRight') setP('yaw', clamp(P.yaw + d, -L, L));
	else if (e.key === 'ArrowUp') setP('pitch', clamp(P.pitch + d, -89, 89));
	else if (e.key === 'ArrowDown') setP('pitch', clamp(P.pitch - d, -89, 89)); else return;
	sync(); render();
});

// 書き出しメニューは上部バーの横スクロール領域に隠れないよう、body直下へ移動して表示する。
// addon側のUIが読み込めない場合でも、ここでメニューだけは開けるようにする。
const exportToggle = $('exportToggle'), exportMenu = $('exportMenu');
if (exportMenu && exportMenu.parentElement !== document.body) document.body.appendChild(exportMenu);
function setExportOpen(open) { if (!exportMenu) return; exportMenu.classList.toggle('open', !!open); exportMenu.style.display = open ? 'grid' : 'none' }
exportToggle.onclick = e => { e.stopPropagation(); setExportOpen(!exportMenu.classList.contains('open')) };
// ===== 書き出し（線画のみ・透過PNG） =====
// m: 'line'=線画のみ / 'guide'=補助線のみ / 'both'=補助線＋線画（どれも背景透過・写真なし）
function out(m, hidden = false) {
	// 書き出す範囲：ズーム中は「画面に見えている範囲」、範囲指定があればその枠との重なり。拡大率のまま出力する
	const fit = $('zf').checked && Z > 1; let r = fit ? { x: -ox / Z, y: -oy / Z, w: W / Z, h: H / Z } : { x: 0, y: 0, w: W, h: H };
	if (CR) {
		const b = crect(); if (b.w >= 8 && b.h >= 8) {
			const x0 = Math.max(r.x, b.x), y0 = Math.max(r.y, b.y), x1 = Math.min(r.x + r.w, b.x + b.w), y1 = Math.min(r.y + r.h, b.y + b.h);
			if (x1 - x0 >= 1 && y1 - y0 >= 1) r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
		}
	}
	const sc = fit ? Z : 1, cw = Math.max(1, Math.round(r.w * sc)), ch = Math.max(1, Math.round(r.h * sc)), tf = [sc, 0, 0, sc, -r.x * sc, -r.y * sc];
	const c = document.createElement('canvas'); c.width = cw; c.height = ch; const x = c.getContext('2d');
	if (m !== 'line') {
		x.setTransform(...tf); T === 'f' ? calcF() : calc(); if (window.cityFloorTint && $('floorTint')?.checked) window.cityFloorTint(x); if ($('gg').checked) floorGrid(x); orthView ? orthGuides(x) : T === 'f' ? guidesF(x) : guides(x);
		if ($('hzl').checked && !orthView) { x.strokeStyle = '#e8a33d'; x.lineWidth = 1.2; x.setLineDash([10, 8]); x.beginPath(); if (T === 'f') circ(x, AXC[0], AXC[1]); else { x.moveTo(0, AX.hy); x.lineTo(W, AX.hy) } x.stroke(); x.setLineDash([]) }
		x.setTransform(1, 0, 0, 1, 0, 0)
	}
	if (m !== 'guide') x.drawImage(lineLayer(false, false, cw, ch, tf, hidden), 0, 0);   // 線画（二値化つき）
	return c
}
function closeExportMenu() { setExportOpen(false) }
function save(m, name, hidden = false) {
	try {
		const canvas = out(m, hidden);
		canvas.toBlob(b => {
			if (!b) { alert('PNGを作成できませんでした。'); return }
			const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); closeExportMenu();
		}, 'image/png');
	} catch (e) { console.error('City Grid export error', e); alert('書き出しに失敗しました。もう一度お試しください。') }
}
$('pngL').onclick = () => save('line', 'perspective-line.png');
$('pngG').onclick = () => save('guide', 'perspective-guide.png');
$('pngB').onclick = () => save('both', 'perspective-guide-line.png');
$('pngBH').onclick = () => save('both', 'perspective-guide-line-visible.png', true);
$('pngLH').onclick = () => save('line', 'perspective-line-visible.png', true);
$('pngGH').onclick = () => save('guide', 'perspective-guide-visible.png', true);
// 線画をクリップボードへコピー（PNG透過）。未対応ブラウザではボタンに状態を表示する。
$('cpyL').onclick = async () => {
	const button = $('cpyL'), label = '線画をクリップボードにコピー';
	try {
		if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Clipboard image API is unavailable');
		const blob = await new Promise(resolve => out('line').toBlob(resolve, 'image/png'));
		if (!blob) throw new Error('PNG blob was not created');
		await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); button.textContent = 'コピー済み'; closeExportMenu();
	} catch (e) { console.error('City Grid clipboard export error', e); button.textContent = 'コピー不可' }
	setTimeout(() => button.textContent = label, 1500)
};

// ===== 参考写真 =====
let IMGsrc = null, dirty = false;   // IMGsrc=保存用の写真データ(dataURL)
function loadImg(f) {
	const o = new Image(); o.onload = () => {
		const k = Math.min(1, 2000 / Math.max(o.width, o.height)), c = document.createElement('canvas'); c.width = o.width * k; c.height = o.height * k; c.getContext('2d').drawImage(o, 0, 0, c.width, c.height);
		IMGsrc = f.type === 'image/png' ? c.toDataURL() : c.toDataURL('image/jpeg', 0.88);
		const im = new Image(); im.onload = () => { IMG = im; render() }; im.src = IMGsrc
	}; o.src = URL.createObjectURL(f)
}
$('ph').onchange = e => e.target.files[0] && loadImg(e.target.files[0]);
$('phx').onclick = () => { IMG = null; IMGsrc = null; render() };
addEventListener('paste', e => { const f = [...e.clipboardData.files].find(f => f.type.startsWith('image/')); f && loadImg(f) });
cv.ondragover = e => e.preventDefault();
cv.ondrop = e => { e.preventDefault(); const f = e.dataTransfer.files[0]; f && f.type.startsWith('image/') && loadImg(f) };

// ===== グリッド種類の切り替え（1/2/3点は通常の透視、5/6点は魚眼） =====
function applyType(v) {
	v = +v; T = v >= 5 ? 'f' : 'r'; const f = T === 'f', L = 180, Lp = 90;
	$('yaw').min = -L; $('yaw').max = L; $('pitch').min = -Lp; $('pitch').max = Lp;
	document.querySelectorAll('.gr').forEach(e => e.style.display = f ? 'none' : '');
	document.querySelectorAll('.gf').forEach(e => e.style.display = f ? '' : 'none');
	const y = P.yaw !== 0 && Math.abs(P.yaw) <= 89 ? P.yaw : 39.912, set = o => { for (const k in o) setP(k, o[k]) };
	if (v === 1) set({ yaw: 0, pitch: 0 });
	if (v === 2) set({ yaw: y, pitch: 0 });
	if (v === 3) set({ yaw: y, pitch: Math.abs(P.pitch) < 5 ? 30 : clamp(P.pitch, -60, 60) });
	if (v === 5) set({ yaw: 0, pitch: 0, roll: 0, fov: 180 });
	if (v === 6) set({ yaw: 45, pitch: 0, roll: 0, fov: 270 });
	sync(); setMode(mode); render();
}
$('gt').onchange = e => { orthView = null; applyType(e.target.value) };
$('pn').onchange = () => setMode(mode);

// ===== 状態の保存・読み込み（プロジェクト） =====
const AK = 'pgrid-autosave-v1';
// 今の状態をまとめる（線は向きのベクトルなので、視点ごと再現できる）
function pack(withPhoto) {
	const d = {
		app: 'perspective-ruler-grid', v: 1, P: { ...P }, gt: $('gt').value, orthView, ar: $('ar').value, show: [...show],
		gon: $('gon').checked, hzl: $('hzl').checked, bgw: $('bgw').checked, bin: $('bin').checked, zf: $('zf').checked, gg: $('gg').checked, p3: $('p3').checked, cr: CR, snap: $('snap').value, em: $('em').value, pc: $('pc').value,
		S: S.map(s => ({ c: s.c, w: s.w, ob: s.ob, d3: s.d3, p: s.p.map(v => v.map(x => +x.toFixed(5))) }))
	};
	if (withPhoto && IMGsrc) d.photo = IMGsrc; return d
}
// 保存した状態を戻す
function unpack(d) {
	if (!d || d.app !== 'perspective-ruler-grid' || !Array.isArray(d.S)) throw new Error('形式が違います');
	$('ar').value = d.ar; $('ar').onchange();                  // 画面比率
	$('gt').value = d.gt; applyType(d.gt);                     // 種類（プリセットで値が変わるので直後に上書き）
	for (const k in P) if (d.P && d.P[k] != null) setP(k, d.P[k]);
	d.show.forEach((v, i) => { show[i] = v; document.querySelector('[data-i="' + i + '"]').checked = v });
	['gon', 'hzl', 'bgw', 'bin', 'zf', 'gg', 'p3'].forEach(k => { if (d[k] !== undefined) $(k).checked = d[k] });
	$('snap').value = d.snap; $('em').value = d.em; $('pc').value = d.pc;
	{
		const st = d.S.map(s => s.ob ? { ...s, ob: fixOb(s.ob) } : s), seen = new Set(), gen = [];   // 前の版の図形（向きで保存）は、3Dで作り直す
		st.forEach(s => { if (s.ob && !s.d3 && !seen.has(s.ob.id)) { seen.add(s.ob.id); gen.push(...genShape(s.ob)) } }); S = [...st.filter(s => !(s.ob && !s.d3)), ...gen]
	} CR = d.cr || null; HU = []; RD = []; cur = null; er = null; sh = null; prev = null; clearSelection(); ed = null; Z = 1; ox = oy = 0; updZ();
	if (d.photo) { const im = new Image(); im.onload = () => { IMG = im; IMGsrc = d.photo; render() }; im.src = d.photo } else { IMG = null; IMGsrc = null }
	orthView = d.orthView || null;
	sync(); render()
}
$('svP').onclick = () => {
	const z = n => String(n).padStart(2, '0'), t = new Date(), a = document.createElement('a');
	a.href = URL.createObjectURL(new Blob([JSON.stringify(pack(true))], { type: 'application/json' }));
	a.download = `perspective-${t.getFullYear()}${z(t.getMonth() + 1)}${z(t.getDate())}-${z(t.getHours())}${z(t.getMinutes())}.json`; a.click()
};
$('opP').onclick = () => $('opF').click();
$('opF').onchange = e => {
	const f = e.target.files[0]; if (!f) return;
	f.text().then(t => unpack(JSON.parse(t))).catch(() => alert('このファイルは読み込めませんでした')); e.target.value = ''
};
// 自動保存：変更があれば3秒ごとにこのブラウザへ保存（写真は容量のためファイル保存のみ）
setInterval(() => { if (!dirty) return; dirty = false; try { localStorage.setItem(AK, JSON.stringify(pack(false))) } catch (e) { } }, 3000);
$('rst').onclick = () => { if (confirm('自動保存を消して初期化します。よろしいですか？')) { try { localStorage.removeItem(AK) } catch (e) { } location.reload() } };

// ⌘/Ctrlを押している間は、カーソルを視点移動の形にする
const curs = () => { cv.style.cursor = mode === 'view' ? 'move' : 'crosshair' };
addEventListener('keydown', e => { if (e.key === 'Meta' || e.key === 'Control') cv.style.cursor = 'move' });
addEventListener('keyup', e => { if (e.key === 'Meta' || e.key === 'Control') curs() });
addEventListener('blur', curs); cv.oncontextmenu = e => e.preventDefault();

// ===== 起動 =====
cv.width = W; cv.height = H; sync(); applyType(2); try { setSide(localStorage.getItem('pgrid-side') === '1') } catch (e) { setSide(false) } fit();
try { const t = localStorage.getItem(AK); if (t) unpack(JSON.parse(t)) } catch (e) { }   // 前回の自動保存があれば復元


/* City Grid Studio compact layer — UI, gestures, floor tools and asset library.
   The perspective engine stays underneath so old projects remain compatible. */
(function () {
	'use strict';
	const el = id => document.getElementById(id);
	const side = el('side'), stage = el('stage');

	// ===== Quick workspace controls =====
	if (P.hm == null) P.hm = 1.7;
	if (P.floorOn == null) P.floorOn = true;
	if (P.floorColor == null) P.floorColor = '#7fa8d8';
	if (P.floorAlpha == null) P.floorAlpha = .24;
	if (P.assetDepth == null) P.assetDepth = 5;
	if (P.assetAxis == null) P.assetAxis = 1;
	const quick = document.createElement('section');
	quick.id = 'studioQuick';
	quick.innerHTML = `
    <h2>クイック操作</h2>
    <div class="quickSub">必要な操作だけを短くまとめています</div>
    <nav class="workspaceTabs" aria-label="作業画面">
      <button type="button" class="workspaceTab" data-workspace-tab="character">人物</button>
      <button type="button" class="workspaceTab" data-workspace-tab="pose">ポーズ</button>
      <button type="button" class="workspaceTab" data-workspace-tab="floorplan">間取り</button>
      <button type="button" class="workspaceTab active" data-workspace-tab="perspective">視点</button>
    </nav>

    <section class="workspaceScreen" data-workspace-screen="character" hidden>
      <div class="screenLead">人物アセットを選択してから、身長と体型を調整します。<small id="personSelectionStatus">人物を選択すると個別編集できます</small></div>
      <div class="quickField"><span>基準身長</span><input id="humanHeight" type="number" min="0.5" max="10" step="0.01" value="1.70"><em>m</em></div>
      <div class="quickRow"><button id="applyHuman" class="primary">全人物に反映</button><button id="eyeHeight">目線を合わせる</button></div>
      <div class="quickField"><span>選択人物の身長</span><input id="personHeight" type="number" min="0.5" max="10" step="0.01" value="1.70"><em>m</em></div>
      <div class="quickField"><span>体格の大きさ</span><input id="personBodyScale" type="number" min="0.6" max="1.8" step="0.05" value="1"><em>倍</em></div>
      <div class="quickField"><span>肩幅</span><input id="personShoulderScale" type="number" min="0.6" max="1.6" step="0.05" value="1"><em>倍</em></div>
      <div class="quickField"><span>頭の大きさ</span><input id="personHeadScale" type="number" min="0.7" max="1.5" step="0.05" value="1"><em>倍</em></div>
      <div class="quickField"><span>脚の開き</span><input id="personLegSpread" type="number" min="0.6" max="1.8" step="0.05" value="1"><em>倍</em></div>
      <div class="quickRow"><button id="applyPersonEdit" class="primary">選択人物に反映</button></div>
      <div class="sceneNote">人物を出したあとでも変更できます。編集モードで人物を選ぶか、シーン一覧から選択してください。</div>
    </section>

    <section class="workspaceScreen" data-workspace-screen="pose" hidden>
      <div class="screenLead">選択中の人物にポーズを適用します。腕は既存仕様どおり表示しません。<small id="poseSelectionStatus">人物を選択するとポーズを変更できます</small></div>
      <div class="quickRow">
        <button type="button" class="poseButton" data-person-pose="stand">直立</button>
        <button type="button" class="poseButton" data-person-pose="walk">歩行</button>
        <button type="button" class="poseButton" data-person-pose="crouch">しゃがみ</button>
        <button type="button" class="poseButton" data-person-pose="sit">着席</button>
      </div>
      <div class="quickField"><span>歩幅</span><input id="personPoseStride" type="number" min="0" max="0.5" step="0.01" value="0"><em>m</em></div>
      <div class="quickField"><span>しゃがみ量</span><input id="personPoseCrouch" type="number" min="0" max="1" step="0.05" value="0"><em>倍</em></div>
      <div class="quickField"><span>体の傾き</span><input id="personPoseLean" type="number" min="-0.35" max="0.35" step="0.01" value="0"><em>m</em></div>
      <div class="quickField"><span>頭の傾き</span><input id="personHeadTilt" type="number" min="-25" max="25" step="1" value="0"><em>°</em></div>
      <div class="quickRow"><button id="applyPersonPoseDetail" class="primary">ポーズを微調整</button></div>
      <div class="sceneNote">プリセット後に歩幅・しゃがみ量・体の傾き・頭の傾きを調整できます。身長・体型は保持されます。</div>
    </section>

    <section class="workspaceScreen" data-workspace-screen="floorplan" hidden>
      <div class="screenLead">家具・カメラを平面で編集<small id="floorPlanStatus">間取りモードを開くと、X・Z方向へドラッグできます</small></div>
      <div class="quickRow"><button id="openFloorPlan" class="primary">開く</button><button id="closeFloorPlan">3Dへ戻る</button></div>
      <div id="floorPlanSelectionStatus" class="sceneNote">未選択</div>
      <div class="quickRow floorPlanRotateRow"><button id="floorRotateLeft" disabled>↺</button><button id="floorRotateRight" disabled>↻</button><button id="floorRotate90" disabled>90°</button><button id="floorDelete" disabled>削除</button></div>
      <div class="sceneNote">間取りでは家具のドラッグ移動、選択中の前側の丸をドラッグした回転、カメラ本体のドラッグ移動、先端の丸のドラッグで向きの変更ができます。回転は15°刻みで、Shiftを押しながらドラッグすると自由な角度です。矢印キーで移動、Q/Eで15°ずつ回転します。移動中も高さ方向（Y）は変わらず、地面に接地した状態を保ちます。壁面などY方向以外の面へ生成したオブジェクトは表示のみで、位置は変更しません。</div>
    </section>

    <section class="workspaceScreen" data-workspace-screen="perspective">
      <div class="screenLead">視点と街の編集</div>
      <div class="quickRow compactPresets">
        <button class="primary" data-preset="alley">路地</button>
        <button data-preset="top">見下ろし</button>
        <button data-preset="three">見上げ</button>
        <button data-preset="flat">正面</button>
      </div>
      <div class="sceneTitle">レンズ</div>
      <div class="sceneNote">43mm＝目に近い画角／50mm＝標準</div>
      <div class="quickRow lensPresetRow">
        <button type="button" data-lens-preset="14">14 広</button>
        <button type="button" data-lens-preset="24">24 広角</button>
        <button type="button" data-lens-preset="35">35</button>
        <button type="button" data-lens-preset="43">43 目</button>
        <button type="button" data-lens-preset="50">50 標準</button>
        <button type="button" data-lens-preset="85">85 人物</button>
        <button type="button" data-lens-preset="135">135 望遠</button>
      </div>
      <div class="sceneTitle">プリセット</div>
      <div class="quickField"><span>名前</span><input id="studioPresetName" type="text" placeholder="路地・50mm"><em></em></div>
      <div class="quickRow">
        <button type="button" id="studioPresetSave" class="primary">保存</button>
        <button type="button" id="studioPresetLoad">読込</button>
        <button type="button" id="studioPresetDelete">削除</button>
      </div>
      <label><span>保存済み</span><select id="studioPresetSelect"><option value="">まだありません</option></select></label>
      <div class="sceneNote">カメラ・レンズ・表示設定を保存。シーン内容は含みません。</div>
      <div class="quickField"><span>階段の段数</span><input id="stairsSteps" type="number" min="2" max="24" step="1" value="6"><em>段</em></div>
      <label class="quickCheck"><input id="stairsRail" type="checkbox"> 階段に手すりをつける</label>
      <div class="quickRow"><button id="applyStairs" class="primary">選択中の階段に反映</button></div>
      <div class="quickField"><span>アセット配置距離</span><input id="assetDepth" type="number" min="1" max="20" step="0.5" value="5"><em>m</em></div>
      <div class="quickField"><span>生成方向</span><select id="assetAxis"><option value="1">Y：地面／上下</option><option value="0">X：左右の面</option><option value="2">Z：正面／背面</option></select><em></em></div>
      <div class="quickRow" style="margin-top:7px"><button id="sampleRef">サンプル参照を表示</button><button id="clearRef">参照を外す</button></div>
      <div class="floorTintBox"><label class="quickCheck"><input id="floorTint" type="checkbox"> 床に透明色をつける</label>
        <div class="quickField"><span>床の色</span><input id="floorTintColor" type="color" value="#7fa8d8"><em></em></div>
        <div class="quickField"><span>透明度</span><input id="floorTintA" type="range" min="0" max="0.60" step="0.01" value="0.16"><output id="floorTintAO">0.16</output></div>
      </div>
    </section>

    <div class="quickHint">1 設定　2 視点　3 描画　4 編集　5 アセット　8 横　9 上　0 3D　／　詳細操作は「？」</div>
    <div class="sceneTitle">シーン内オブジェクト</div>
    <div class="sceneTools"><button id="sceneSelectAll">全選択</button><button id="sceneClearSel">選択解除</button><button id="sceneDeleteSel" class="danger">選択中を削除</button></div>
    <div class="alignTools"><select id="alignAxis"><option value=0>X軸（左右）</option><option value=1>Y軸（高さ）</option><option value=2>Z軸（奥行き）</option></select><select id="alignMode"><option value=middle>中央に整列</option><option value=min>最小側に整列</option><option value=max>最大側に整列</option></select><button id="alignApply">整列</button></div>
    <div class="sceneNote">行のチェックで複数選択。整列は2個以上を選んでください。</div>
    <div id="objectList"><div class="emptyList">まだオブジェクトがありません</div></div>`;
	side.insertBefore(quick, side.firstChild);
	const humanInput = el('humanHeight');
	humanInput.value = Number(P.hm).toFixed(2);

	// ===== Separate work screens: character height/body, pose, and perspective =====
	function setStudioWorkspace(name) {
		const valid = ['character', 'pose', 'floorplan', 'perspective'], tab = valid.includes(name) ? name : 'perspective';
		quick.querySelectorAll('[data-workspace-tab]').forEach(b => b.classList.toggle('active', b.dataset.workspaceTab === tab));
		quick.querySelectorAll('[data-workspace-screen]').forEach(screen => { screen.hidden = screen.dataset.workspaceScreen !== tab });
		if (tab === 'floorplan') window.cityFloorPlanEnter?.();
		else if (window.cityFloorPlanActive) window.cityFloorPlanExit?.();
	}
	quick.querySelectorAll('[data-workspace-tab]').forEach(b => b.onclick = () => setStudioWorkspace(b.dataset.workspaceTab));
	window.cityStudioWorkspace = setStudioWorkspace;
	const personHeightInput = el('personHeight'), personBodyInput = el('personBodyScale'), personShoulderInput = el('personShoulderScale'), personHeadInput = el('personHeadScale'), personLegInput = el('personLegSpread'), personStatus = el('personSelectionStatus'), poseStatus = el('poseSelectionStatus');
	const personPoseStrideInput = el('personPoseStride'), personPoseCrouchInput = el('personPoseCrouch'), personPoseLeanInput = el('personPoseLean'), personHeadTiltInput = el('personHeadTilt');
	const poseButtons = [...quick.querySelectorAll('[data-person-pose]')];
	const poseDefaults = { stand: { stride: 0, crouch: 0, lean: 0, headTilt: 0 }, walk: { stride: .22, crouch: 0, lean: 0, headTilt: 0 }, crouch: { stride: .04, crouch: .65, lean: 0, headTilt: 0 }, sit: { stride: .10, crouch: .35, lean: 0, headTilt: 0 } };
	const selectedPerson = () => { const o = sel && obOf(sel); return o && o.type === 'asset' && o.asset === 'person' ? o : null };
	function personPoseDefaults(o) { return poseDefaults[o?.pose] || { stride: Number(o?.poseStride) || 0, crouch: Number(o?.poseCrouch) || 0, lean: Number(o?.poseLean) || 0, headTilt: Number(o?.headTilt) || 0 } }
	function syncPersonControls() {
		const o = selectedPerson(), h = o ? Number(o.h) || Number(P.hm) || 1.7 : Number(P.hm) || 1.7, pd = personPoseDefaults(o);
		if (personHeightInput && document.activeElement !== personHeightInput) personHeightInput.value = h.toFixed(2);
		if (personBodyInput && document.activeElement !== personBodyInput) personBodyInput.value = Number(o?.bodyScale ?? 1).toFixed(2);
		if (personShoulderInput && document.activeElement !== personShoulderInput) personShoulderInput.value = Number(o?.shoulderScale ?? 1).toFixed(2);
		if (personHeadInput && document.activeElement !== personHeadInput) personHeadInput.value = Number(o?.headScale ?? 1).toFixed(2);
		if (personLegInput && document.activeElement !== personLegInput) personLegInput.value = Number(o?.legSpread ?? 1).toFixed(2);
		if (personPoseStrideInput && document.activeElement !== personPoseStrideInput) personPoseStrideInput.value = Number(o?.poseStride ?? pd.stride).toFixed(2);
		if (personPoseCrouchInput && document.activeElement !== personPoseCrouchInput) personPoseCrouchInput.value = Number(o?.poseCrouch ?? pd.crouch).toFixed(2);
		if (personPoseLeanInput && document.activeElement !== personPoseLeanInput) personPoseLeanInput.value = Number(o?.poseLean ?? pd.lean).toFixed(2);
		if (personHeadTiltInput && document.activeElement !== personHeadTiltInput) personHeadTiltInput.value = Number(o?.headTilt ?? pd.headTilt).toFixed(0);
		if (personStatus) personStatus.textContent = o ? `選択中：人物アセット（身長 ${h.toFixed(2)} m）` : '人物アセットを選択すると個別編集できます';
		if (poseStatus) poseStatus.textContent = o ? `選択中のポーズ：${({ stand: '直立', walk: '歩行', crouch: 'しゃがみ', sit: '着席', custom: 'カスタム' }[o.pose || 'stand'] || 'カスタム')}` : '人物アセットを選択するとポーズを変更できます';
		poseButtons.forEach(b => b.classList.toggle('active', !!o && (o.pose || 'stand') === b.dataset.personPose));
	}
	function applySelectedPerson() {
		const o = selectedPerson(); if (!o) { alert('先に人物アセットを選択してください'); return }
		const h = clamp(parseFloat(personHeightInput.value) || o.h || 1.7, .5, 10), body = clamp(parseFloat(personBodyInput.value) || 1, .6, 1.8), shoulder = clamp(parseFloat(personShoulderInput.value) || 1, .6, 1.6), head = clamp(parseFloat(personHeadInput.value) || 1, .7, 1.5), legs = clamp(parseFloat(personLegInput.value) || 1, .6, 1.8);
		HU.push(S); RD = []; P.hm = h; humanInput.value = h.toFixed(2); setOb(o.id, { h, bodyScale: body, shoulderScale: shoulder, headScale: head, legSpread: legs, ra: h * .135 * body * shoulder, rb: h * .088 * body }); render();
	}
	function applyPersonPose(pose) {
		const o = selectedPerson(); if (!o) { alert('先に人物アセットを選択してください'); return }
		const d = poseDefaults[pose] || poseDefaults.stand; HU.push(S); RD = []; setOb(o.id, { pose, poseStride: d.stride, poseCrouch: d.crouch, poseLean: d.lean, headTilt: d.headTilt }); setStudioWorkspace('pose'); render();
	}
	function applyPersonPoseDetail() {
		const o = selectedPerson(); if (!o) { alert('先に人物アセットを選択してください'); return }
		const stride = clamp(parseFloat(personPoseStrideInput.value) || 0, 0, .5), crouch = clamp(parseFloat(personPoseCrouchInput.value) || 0, 0, 1), lean = clamp(parseFloat(personPoseLeanInput.value) || 0, -.35, .35), headTilt = clamp(parseFloat(personHeadTiltInput.value) || 0, -25, 25);
		HU.push(S); RD = []; setOb(o.id, { pose: 'custom', poseStride: stride, poseCrouch: crouch, poseLean: lean, headTilt }); setStudioWorkspace('pose'); render();
	}
	el('applyPersonEdit').onclick = applySelectedPerson;
	el('applyPersonPoseDetail').onclick = applyPersonPoseDetail;
	poseButtons.forEach(b => b.onclick = () => applyPersonPose(b.dataset.personPose));
	syncPersonControls();

	// ===== Transparent floor tint =====
	const floorToggle = el('floorTint'), floorColor = el('floorTintColor'), floorAlpha = el('floorTintA'), floorAlphaOut = el('floorTintAO');
	function syncFloorControls() {
		if (!floorToggle) return;
		floorToggle.checked = !!P.floorOn;
		if (document.activeElement !== floorColor) floorColor.value = P.floorColor || '#7fa8d8';
		if (document.activeElement !== floorAlpha) floorAlpha.value = Number(P.floorAlpha ?? .16).toFixed(2);
		floorAlphaOut.textContent = Number(P.floorAlpha ?? .16).toFixed(2);
	}
	function updateFloor() {
		P.floorOn = floorToggle.checked; P.floorColor = floorColor.value; P.floorAlpha = +floorAlpha.value; floorAlphaOut.textContent = P.floorAlpha.toFixed(2); render();
	}
	[floorToggle, floorColor, floorAlpha].forEach(x => x && x.addEventListener('input', updateFloor));
	syncFloorControls();
	const assetDepthInput = el('assetDepth');
	function syncAssetDepth() { if (assetDepthInput && document.activeElement !== assetDepthInput) assetDepthInput.value = Number(P.assetDepth || 5).toFixed(1) }
	assetDepthInput.oninput = () => { P.assetDepth = Math.max(1, Math.min(20, parseFloat(assetDepthInput.value) || 5)); render() };
	syncAssetDepth();
	const assetAxisInput = el('assetAxis');
	let assetAxisTrayInput = null;
	function syncAssetAxis() { const value = String(Number(P.assetAxis ?? 1)); if (assetAxisInput && document.activeElement !== assetAxisInput) assetAxisInput.value = value; if (assetAxisTrayInput && document.activeElement !== assetAxisTrayInput) assetAxisTrayInput.value = value }
	function setAssetAxis(value) { P.assetAxis = clamp(Math.round(Number(value)), 0, 2); syncAssetAxis(); render() }
	assetAxisInput.onchange = () => setAssetAxis(assetAxisInput.value);
	syncAssetAxis();
	window.cityFloorTint = function (c) {
		// 床はカメラから見える地平線より下を、透明な平面色として塗る。
		// 画角や魚眼でも必ず見えるよう、投影前の巨大四角ではなく画面上の台形で描く。
		const horizon = T === 'f' ? H * .5 : clamp(AX.hy, 0, H);
		c.save(); c.globalAlpha = Math.max(0, Math.min(.8, Number(P.floorAlpha) || 0)); c.fillStyle = P.floorColor || '#7fa8d8'; c.beginPath(); c.moveTo(0, horizon); c.lineTo(W, horizon); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill(); c.restore();
	};

	// ===== Low-poly asset library =====
	// 基本プリミティブを先頭にまとめ、その後に街並み用アセットを並べる。
	// 円柱は円の押し出しで作れるため、アセット棚からは外している。
	const ASSETS = {
		rect: { label: '長方形', glyph: '□', w: 1.5, d: 1.0, h: 0, accent: '#66e3c8' },
		circle: { label: '円', glyph: '○', w: 1.25, d: 1.25, h: 0, accent: '#ad9cff' },
		cone: { label: '円錐', glyph: '△', w: 1.25, d: 1.25, h: 1.45, accent: '#ffb36f' },
		sphere: { label: '球体', glyph: '●', w: 1.3, d: 1.3, h: 1.3, accent: '#ad9cff' },
		triPrism: { label: '三角柱', glyph: '△', w: 1.4, d: 1.8, h: 1.25, accent: '#ffb36f' },
		triPyramid: { label: '三角錐', glyph: '▲', w: 1.5, d: 1.5, h: 1.45, accent: '#ff79ba' },
		sign: { label: '看板', glyph: '▤', w: 1.0, d: .20, h: 2.15, accent: '#76d9ff' },
		lantern: { label: 'ちょうちん', glyph: '◉', w: .48, d: .48, h: 1.15, accent: '#ff795f' },
		person: { label: '人物', glyph: '♙', w: .46, d: .30, h: 1.70, accent: '#ad9cff' },
		stairs: { label: '階段', glyph: '▰', w: 1.45, d: 2.4, h: .78, accent: '#ffb36f' },
		crosswalk: { label: '横断歩道', glyph: '▥', w: 3.2, d: 4.2, h: .02, accent: '#668cff' }
	};
	const assetLabel = o => o.type === 'asset' ? (ASSETS[o.asset]?.label || (o.asset === 'cylinder' ? '円柱' : 'アセット')) : (o.type === 'rect' ? '長方形' : o.type === 'circ' ? '円' : o.type === 'box' ? '箱' : o.type === 'cyl' ? '円柱' : '図形');
	const assetGlyph = o => o.type === 'asset' ? (ASSETS[o.asset]?.glyph || (o.asset === 'cylinder' ? '◉' : '◆')) : (o.type === 'rect' ? '□' : o.type === 'circ' ? '○' : '◇');

	// Coordinate helpers. Local asset coordinates are x=width, y=depth, z=up.
	const pt = (o, x, y, z) => L2W(o, x, y, z);
	const lineA = (o, pts, color = o.c || '#e7fff4', width = o.w || 2) => ({ c: color, w: width, ob: o, d3: true, cs: sigNow(), p: dens3(pts.map(q => pt(o, q[0], q[1], q[2]))) });
	const polyA = (o, pts, color, width) => lineA(o, [...pts, pts[0]], color, width);
	function boxA(o, w, d, z0, z1, color = o.c || '#e7fff4') {
		const x = w / 2, y = d / 2, out = [];
		out.push(polyA(o, [[-x, -y, z0], [x, -y, z0], [x, y, z0], [-x, y, z0]], color));
		out.push(polyA(o, [[-x, -y, z1], [x, -y, z1], [x, y, z1], [-x, y, z1]], color));
		[[-x, -y], [x, -y], [x, y], [-x, y]].forEach(([a, b]) => out.push(lineA(o, [[a, b, z0], [a, b, z1]], color)));
		return out;
	}
	function ringA(o, rx, ry, z, n = 8, color = o.c || '#e7fff4') {
		const a = []; for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; a.push([rx * Math.cos(t), ry * Math.sin(t), z]) } return polyA(o, a, color);
	}
	function bevelBoxA(o, w, d, z0, z1, b, color = o.c || '#e7fff4') {
		const x = w / 2, y = d / 2, hh = Math.max(.001, z1 - z0), bb = Math.max(0, Math.min(Number(b) || 0, Math.min(x, y, hh / 2) * .8));
		if (bb < 1e-5) return boxA(o, w, d, z0, z1, color);
		const ring = (z) => [
			[-x + bb, -y, z], [x - bb, -y, z], [x, -y + bb, z], [x, y - bb, z],
			[x - bb, y, z], [-x + bb, y, z], [-x, y - bb, z], [-x, -y + bb, z]
		];
		const out = [polyA(o, ring(z0), color), polyA(o, ring(z1), color)], a = ring(z0), b2 = ring(z1);
		// 上下の面取り面（前後の長辺・左右の短辺）。
		for (const sz of [-1, 1]) {
			const z = sz < 0 ? z0 : z1, zi = z - sz * bb;
			for (const sy of [-1, 1]) out.push(polyA(o, [[-x + bb, sy * (y - bb), z], [x - bb, sy * (y - bb), z], [x - bb, sy * y, zi], [-x + bb, sy * y, zi]], color));
			for (const sx of [-1, 1]) out.push(polyA(o, [[sx * (x - bb), -y + bb, z], [sx * (x - bb), y - bb, z], [sx * x, y - bb, zi], [sx * x, -y + bb, zi]], color));
		}
		// 垂直方向の4本の面取り面。
		for (const sx of [-1, 1]) for (const sy of [-1, 1]) out.push(polyA(o, [[sx * (x - bb), sy * y, z0 + bb], [sx * x, sy * (y - bb), z0 + bb], [sx * x, sy * (y - bb), z1 - bb], [sx * (x - bb), sy * y, z1 - bb]], color));
		// 8つの外側の角は三角形の面として残す。添付画像のような「角の斜め線」になる。
		for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
			const z = sz < 0 ? z0 : z1, zi = z - sz * bb;
			out.push(polyA(o, [[sx * (x - bb), sy * y, z], [sx * x, sy * (y - bb), z], [sx * x, sy * y, zi]], color));
		}
		return out;
	}
	function assetLines(o) {
		const kind = o.asset, w = o.ra * 2, d = o.rb * 2, h = o.h, c = o.c || '#222222', a = c, out = []; // アセットも線画と同じ色で描く
		if (kind === 'stairs') {
			const n = Math.max(2, Math.min(24, Math.round(o.steps || 6))), sd = d / n, sh = h / n;
			// Step treads and risers.
			for (let i = 0; i < n; i++) {
				const y0 = -d / 2 + i * sd, y1 = y0 + sd, z = (i + 1) * sh;
				out.push(polyA(o, [[-w / 2, y0, z], [w / 2, y0, z], [w / 2, y1, z], [-w / 2, y1, z]], c));
				out.push(lineA(o, [[-w / 2, y0, i * sh], [-w / 2, y0, z], [-w / 2, y1, z]], c));
				out.push(lineA(o, [[w / 2, y0, i * sh], [w / 2, y0, z], [w / 2, y1, z]], c));
				out.push(lineA(o, [[-w / 2, y0, z], [w / 2, y0, z]], a, .9));
			}
			out.push(lineA(o, [[-w / 2, -d / 2, 0], [-w / 2, d / 2, h]], a, 1.1));
			out.push(lineA(o, [[w / 2, -d / 2, 0], [w / 2, d / 2, h]], a, 1.1));
			// Rail posts and handrail. The quick setting can hide the whole rail.
			if (o.handrail === true) [-w / 2, w / 2].forEach(x => {
				const p1 = [x, -d / 2, .48 * h], p2 = [x, d / 2, h + .35];
				out.push(lineA(o, [p1, p2], a, 1.1));
				for (let i = 0; i <= 3; i++) { const t = i / 3; out.push(lineA(o, [[x, -d / 2 + (d * t), (.48 * h) + (h + .35 - .48 * h) * t], [x, -d / 2 + (d * t), (.48 * h) + (h + .35 - .48 * h) * t + .22]], a, .8)) }
			});
		} else if (kind === 'crosswalk') {
			const n = Math.max(3, Math.min(16, Math.round(o.stripes || 7))), gap = d / (n + 1), stripeD = gap * .60;
			for (let i = 0; i < n; i++) { const y = -d / 2 + gap * (i + 1); out.push(polyA(o, [[-w / 2, y - stripeD / 2, .012], [w / 2, y - stripeD / 2, .012], [w / 2, y + stripeD / 2, .012], [-w / 2, y + stripeD / 2, .012]], c, 1.1)); }
			out.push(lineA(o, [[-w / 2, -d / 2, .014], [w / 2, -d / 2, .014]], a, .9));
			out.push(lineA(o, [[-w / 2, d / 2, .014], [w / 2, d / 2, .014]], a, .9));
		} else if (kind === 'cylinder') {
			// 円柱は上下の輪郭だけ。側面の縦エッジは描かない。
			out.push(ringA(o, w * .5, d * .5, 0, 12, c)); out.push(ringA(o, w * .5, d * .5, h, 12, c));
		} else if (kind === 'cone') {
			// 円錐も円柱と同じく、底面の輪郭と現在の視点から見える
			// 左右2本のシルエット母線だけを描く。全周の放射線は描かない。
			const rx = w * .5, ry = d * .5, base = []; for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2; base.push([rx * Math.cos(t), ry * Math.sin(t), 0]) }
			out.push(polyA(o, base, c));
			const cen = L2W(o, 0, 0, 0), rel = V.add(camPos(), cen, 1, -1), [iu, iv] = PL[o.k], cs = Math.cos(o.rot * DG), sn = Math.sin(o.rot * DG), eu = [0, 0, 0], ev = [0, 0, 0];
			eu[iu] = cs; eu[iv] = sn; ev[iu] = -sn; ev[iv] = cs;
			const ph = Math.atan2(V.dot(rel, ev), V.dot(rel, eu));
			[ph + Math.PI / 2, ph - Math.PI / 2].forEach(t => out.push(lineA(o, [[rx * Math.cos(t), ry * Math.sin(t), 0], [0, 0, h]], a, 1.0)));
		} else if (kind === 'sphere') {
			// 球は緯度線・経線を描かず、円形の外周輪郭だけを描く。
			// 視点方向に合わせた「正面向きの円」を3D線として置くため、
			// カメラを回転・パンしても画面上の輪郭はつぶれず、常に円のままになる。
			const r = Math.min(w, d, h) * .5, zc = h * .5, center = L2W(o, 0, 0, zc), eu = [0, 0, 0], ev = [0, 0, 0], ez = [0, 0, 0];
			const [iu, iv] = PL[o.k], cs = Math.cos(o.rot * DG), sn = Math.sin(o.rot * DG);
			eu[iu] = cs; eu[iv] = sn; ev[iu] = -sn; ev[iv] = cs; ez[o.k] = -o.d;
			const right = V.nrm(wld([1, 0, 0])), up = V.nrm(wld([0, 1, 0])), pts = [], toLocal = world => { const rel = V.add(world, center, 1, -1); return [V.dot(rel, eu), V.dot(rel, ev), zc + V.dot(rel, ez)] };
			for (let i = 0; i <= 48; i++) { const t = i / 48 * Math.PI * 2, co = Math.cos(t), si = Math.sin(t); pts.push(toLocal(V.add(center, V.add(right, up, r * co, r * si)))); }
			out.push(lineA(o, pts, c, 1.1));
		} else if (kind === 'triPrism') {
			const x = w / 2, y = d / 2, front = [[-x, -y, 0], [x, -y, 0], [0, -y, h]], back = [[-x, y, 0], [x, y, 0], [0, y, h]];
			out.push(polyA(o, front, c)); out.push(polyA(o, back, c)); for (let i = 0; i < 3; i++)out.push(lineA(o, [front[i], back[i]], a, 1.1));
		} else if (kind === 'triPyramid') {
			const x = w / 2, y = d / 2, base = [[-x, -y, 0], [x, -y, 0], [0, y, 0]], apex = [0, 0, h];
			out.push(polyA(o, base, c)); base.forEach(v => out.push(lineA(o, [v, apex], a, 1.1)));
		} else if (kind === 'lantern') {
			const body0 = .22 * h, body1 = .70 * h, rx = w * .48, ry = d * .48;
			out.push(ringA(o, rx, ry, body0, 8, c)); out.push(ringA(o, rx, ry, body1, 8, c));
			for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; out.push(lineA(o, [[rx * Math.cos(t), ry * Math.sin(t), body0], [rx * Math.cos(t), ry * Math.sin(t), body1]], c)) }
			out.push(ringA(o, rx * .82, ry * .82, .78 * h, 8, a));
			for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; out.push(lineA(o, [[rx * Math.cos(t), ry * Math.sin(t), body1], [rx * .82 * Math.cos(t), ry * .82 * Math.sin(t), .78 * h]], a, .9)) }
			out.push(lineA(o, [[0, 0, .78 * h], [0, 0, .94 * h]], a, 1.3));
			out.push(lineA(o, [[0, 0, .94 * h], [-.10 * w, 0, h], [.10 * w, 0, h], [0, 0, .94 * h]], a, 1.1));
			// Two inner bands suggest a glowing paper lantern without requiring a texture.
			[.36, .56].forEach(z => out.push(ringA(o, rx * 1.02, ry * 1.02, z * h, 8, a, .8)));
		} else if (kind === 'sign') {
			// 文字線は描かず、面取りされた外枠とサイズ変更可能な内側の絵枠だけにする。
			const board0 = .08 * h, board1 = .82 * h, fy = -d / 2 - .009;
			const bevel = Math.max(0, Math.min(Number.isFinite(Number(o.bevel)) ? Number(o.bevel) : 0, Math.min(w, d, h) * .39));
			const faceW = Math.max(.08, Math.min(Number(o.faceW) || w * .70, w * .90));
			const faceH = Math.max(.08, Math.min(Number(o.faceH) || h * .34, (board1 - board0) * .84));
			out.push(...bevelBoxA(o, w, d, board0, board1, bevel, c));
			// adjustable inner illustration frame; no lettering strokes inside.
			const ix = faceW / 2, iz0 = (board0 + board1 - faceH) / 2, iz1 = iz0 + faceH;
			const q = [[-ix, fy, iz0], [ix, fy, iz0], [ix, fy, iz1], [-ix, fy, iz1]];
			out.push(polyA(o, q, a, 1.1));
		} else if (kind === 'person') {
			// 人物は配置後も高さ・体格・頭身・脚の開き・簡易ポーズを編集できる。
			// 腕は既存仕様どおり描かず、立体感は胴体・脚・頭の線だけで表現する。
			const bodyScale = clamp(Number(o.bodyScale) || 1, .6, 1.8), shoulderScale = clamp(Number(o.shoulderScale) || 1, .6, 1.6), headScale = clamp(Number(o.headScale) || 1, .7, 1.5), legSpread = clamp(Number(o.legSpread) || 1, .6, 1.8), pose = o.pose || 'stand';
			const defaults = { stand: [0, 0, 0], walk: [.22, 0, 0], crouch: [.04, .65, 0], sit: [.10, .35, 0] }, def = defaults[pose] || defaults.stand;
			const stride = clamp(Number.isFinite(Number(o.poseStride)) ? Number(o.poseStride) : def[0], 0, .5), crouch = clamp(Number.isFinite(Number(o.poseCrouch)) ? Number(o.poseCrouch) : def[1], 0, 1), lean = clamp(Number.isFinite(Number(o.poseLean)) ? Number(o.poseLean) : def[2], -.35, .35), headTilt = clamp(Number(o.headTilt) || 0, -25, 25);
			const bw = .28 * h * bodyScale * shoulderScale, bd = .16 * h * bodyScale, leg = .055 * h * bodyScale, headR = .095 * h * headScale;
			let legTop = (.47 - .16 * crouch) * h, torso0 = (.44 - .16 * crouch) * h, torso1 = (.78 - .18 * crouch) * h, head0 = (.84 - .18 * crouch) * h, head1 = (.99 - .18 * crouch) * h, footY = [-stride, stride], kneeY = [-.02 * h, .02 * h], kneeX = [-.09 * h * legSpread, .09 * h * legSpread], poseTop = (1 - .18 * crouch) * h;
			const bodyY = lean * .18, headY = lean * .42, headTopX = Math.sin(headTilt * DG) * .06 * h;
			if (pose === 'walk') { kneeY = [-.05 * h, .06 * h]; kneeX = [-.07 * h * legSpread, .08 * h * legSpread] }
			if (pose === 'crouch') { kneeY = [-.06 * h, .06 * h]; kneeX = [-.10 * h * legSpread, .10 * h * legSpread] }
			if (pose === 'sit') { kneeY = [.20 * h, .26 * h]; kneeX = [-.11 * h * legSpread, .11 * h * legSpread] }
			// 足元の小さな台座と脚。歩幅・しゃがみ量・脚の開きを連続的に反映する。
			out.push(...boxA(o, leg * 1.5, bd * .85, 0, .08 * h, c));
			if (pose === 'sit') {
				out.push(lineA(o, [[-.09 * h * legSpread, bodyY, .32 * h], [kneeX[0], kneeY[0], .30 * h], [kneeX[0], footY[0], 0]], c, 1.4));
				out.push(lineA(o, [[.09 * h * legSpread, bodyY, .32 * h], [kneeX[1], kneeY[1], .30 * h], [kneeX[1], footY[1], 0]], c, 1.4));
			} else {
				out.push(lineA(o, [[kneeX[0], footY[0], 0], [kneeX[0], kneeY[0], legTop]], c, 1.4));
				out.push(lineA(o, [[kneeX[1], footY[1], 0], [kneeX[1], kneeY[1], legTop]], c, 1.4));
			}
			// Torso and shoulders. leanは肩・首・頭の位置へ反映する。
			out.push(...boxA(o, bw, bd, torso0, torso1, c));
			out.push(lineA(o, [[-bw * .48, bodyY, torso1 - .02 * h], [bw * .48, bodyY, torso1 - .02 * h]], a, 1));
			// 腕は省略。小さな人物シルエットとして使えるよう胴体と脚だけ残す。
			// Head rings are shifted/tilted without adding arms.
			const ringAt = (rx, ry, x0, y0, z, n, color) => { const pts = []; for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; pts.push([x0 + rx * Math.cos(t), y0 + ry * Math.sin(t), z]) } return polyA(o, pts, color) };
			out.push(lineA(o, [[0, bodyY, torso1], [headTopX, headY, head0]], c, 1.1));
			out.push(ringAt(headR, headR * .9, 0, headY, head0, 8, c)); out.push(ringAt(headR * .86, headR * .78, headTopX, headY + .02 * h, head1, 8, c));
			for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; out.push(lineA(o, [[headR * Math.cos(t), headY + headR * .9 * Math.sin(t), head0], [headTopX + headR * .86 * Math.cos(t), headY + .02 * h + headR * .78 * Math.sin(t), head1]], c, .85)) }
			// A small measurement tick makes the current pose height reference visible.
			const mx = .42 * h; out.push(lineA(o, [[mx, 0, 0], [mx, 0, poseTop]], a, .75)); out.push(lineA(o, [[mx - .045 * h, 0, 0], [mx + .045 * h, 0, 0]], a, .75)); out.push(lineA(o, [[mx - .045 * h, 0, poseTop], [mx + .045 * h, 0, poseTop]], a, .75));
		} else if (kind === 'building') {
			out.push(...boxA(o, w, d, 0, h, c));
			// Receding roof line and facade windows.
			out.push(lineA(o, [[-w / 2, -d / 2, h], [0, -d / 2, h + .18 * h], [w / 2, -d / 2, h]], a, 1.1));
			const cols = 3, rows = 4, ww = w * .16, wh = h * .10, fy = -d / 2 - .008;
			for (let r = 0; r < rows; r++)for (let j = 0; j < cols; j++) {
				const x = -w * .31 + j * w * .31, z = .26 * h + r * .16 * h;
				out.push(polyA(o, [[x - ww / 2, fy, z - wh / 2], [x + ww / 2, fy, z - wh / 2], [x + ww / 2, fy, z + wh / 2], [x - ww / 2, fy, z + wh / 2]], a, .75));
			}
			out.push(lineA(o, [[-w * .44, fy, .17 * h], [w * .44, fy, .17 * h]], a, .9));
		}
		return out;
	}
	function normalizedAsset(o) {
		if (o && o.asset === 'sphere') {
			const r = Math.max(.005, Math.min(Math.abs(Number(o.ra) || .65), Math.abs(Number(o.rb) || .65), Math.abs(Number(o.h) || 1.3) * .5));
			return { ...o, ra: r, rb: r, h: r * 2 };
		}
		return o;
	}
	function genAsset(o) { const q = normalizedAsset(o); return assetLines(q).map(s => ({ ...s, ob: q, d3: true, cs: sigNow() })); }

	// Route the existing shape pipeline through the asset generator.
	const originalGenShape = genShape;
	genShape = function (o) { return o && o.type === 'asset' ? genAsset(o) : originalGenShape(o) };
	const originalObBounds = obBounds;
	obBounds = function (o) {
		if (!o || o.type !== 'asset') return originalObBounds(o);
		const pts = []; const hs = [0, o.h], xs = [-o.ra, o.ra], ys = [-o.rb, o.rb];
		hs.forEach(z => xs.forEach(x => ys.forEach(y => pts.push(pt(o, x, y, z)))));
		const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; pts.forEach(v => v.forEach((n, i) => { lo[i] = Math.min(lo[i], n); hi[i] = Math.max(hi[i], n) }));
		return { lo, hi };
	};
	// 既に自動保存されているオブジェクトも、今回の円柱・球・看板の新しい線画へ更新する。
	regenObjects();

	function groundAt(p) {
		const q = hit3(unscr(p), 1, -1, camPos());
		if (q && Number.isFinite(q[0]) && Number.isFinite(q[2])) return q;
		return [0, -1, 4];
	}
	function assetGroundPoint() {
		// Asset buttons place objects on the ground a short distance in front of the camera,
		// rather than at the far intersection of a nearly horizontal ray.
		const yaw = P.yaw * DG, depth = Math.max(1, Math.min(20, Number(P.assetDepth) || 5)), f = [-Math.sin(yaw), 0, Math.cos(yaw)];
		return [P.cx + f[0] * depth, -1, P.cz + f[2] * depth];
	}
	function newAsset(kind, p) {
		const info = ASSETS[kind], isDefault = !p; p = p || { x: W * .5, y: H * .62 }; let q = isDefault ? assetGroundPoint() : groundAt(p); if (!q || !q.every(Number.isFinite)) q = assetGroundPoint();
		// Repeated clicks are fanned out slightly so a new object cannot hide exactly under the previous one.
		if (isDefault) { const n = sceneObjects().length; q = [q[0] + ((n % 4) - 1.5) * .85, q[1], q[2] + Math.floor(n / 4) * 1.05] }
		// 生成方向は「その軸に立つ面」の法線。Y=地面、X/Z=壁面として配置する。
		const k = clamp(Math.round(Number(P.assetAxis ?? 1)), 0, 2), d = -1, [iu, iv] = PL[k], off = [0, 0, 0];
		// L2Wの基準面は d=-1 なので、選んだ点へ基準面を平行移動する。
		off[k] = q[k] - d;
		const base = { id: uid(), k, d, off, ca: q[iu], cb: q[iv], rot: 0, lift: 0, wf: true, c: el('pc').value || '#222222', w: MASTER_W, accent: info.accent };
		const height = kind === 'person' ? Number(P.hm) || 1.7 : info.h;
		if (kind === 'rect' || kind === 'circle') return { ...base, type: kind === 'circle' ? 'circ' : 'rect', asset: kind, ra: info.w / 2, rb: info.d / 2, h: 0, extrude: false };
		return { ...base, type: 'asset', asset: kind, ra: info.w / 2, rb: info.d / 2, h: height, pose: kind === 'person' ? 'stand' : undefined, bodyScale: kind === 'person' ? 1 : undefined, shoulderScale: kind === 'person' ? 1 : undefined, headScale: kind === 'person' ? 1 : undefined, legSpread: kind === 'person' ? 1 : undefined, faceW: kind === 'sign' ? info.w * .70 : undefined, faceH: kind === 'sign' ? info.h * .34 : undefined, bevel: kind === 'sign' ? 0 : undefined, steps: kind === 'stairs' ? Math.round(Number(el('stairsSteps')?.value) || 6) : undefined, handrail: kind === 'stairs' ? !!el('stairsRail')?.checked : undefined, stripes: kind === 'crosswalk' ? 7 : undefined };
	}
	function placeAsset(kind, p) {
		sanitizeScene(); const before = S.slice(), wasFloor = !!window.cityFloorPlanActive;
		try {
			const o = newAsset(kind, p), lines = genShape(o); if (!lines.length || lines.some(s => !validStroke(s))) throw new Error('asset geometry is empty or malformed'); HU.push(S); RD = []; S = [...S, ...lines]; setSelection(o.id, false); tool = 'edit'; setMode('draw');
			// 間取りから追加したアセットは、そのまま間取りに留めて選択状態を保つ。
			if (wasFloor) { fitFloorPlan(); setMode('draw') }
			else if (kind === 'person') setStudioWorkspace('character');
			syncSel(); render()
		}
		catch (err) { S = before; prev = null; clearSelection(); console.error('City Grid asset error', err); try { render() } catch (e) { } alert('アセットを配置できませんでした。壊れた線は取り除きました。もう一度クリックしてください。') }
	}

	// オブジェクト用クリップボード。線画のクリップボードとは分けて、選択中の
	// 図形／アセット定義だけをコピーし、貼り付け時に新しいIDで再生成する。
	let objectClipboard = [];
	function copySelectedObjects() {
		const objects = selectedObjects(); if (!objects.length) return false;
		objectClipboard = objects.map(o => JSON.parse(JSON.stringify(o))); return true;
	}
	function pasteObjectClipboard() {
		if (!objectClipboard.length) return false;
		sanitizeScene(); const before = S.slice(), added = [];
		try {
			const lines = [];
			objectClipboard.forEach((source, i) => {
				const n = JSON.parse(JSON.stringify(source)); n.id = uid(); n.off = [...(n.off || [0, 0, 0])];
				// 元の場所を保ちつつ、貼り付け先が見つけやすいようにca方向へ少しずらす。
				n.ca = Number(n.ca) || 0; n.ca += Math.max(.35, Math.abs(Number(n.ra) || .25) * 2.4) + i * .18;
				const made = genShape(n); if (!made.length || made.some(s => !validStroke(s))) throw new Error('pasted object geometry is empty or malformed');
				lines.push(...made); added.push(n.id);
			});
			HU.push(S); RD = []; S = [...S, ...lines]; setSelection(added[0], false); added.slice(1).forEach(id => setSelection(id, true)); tool = 'edit'; setMode('draw');
			if (window.cityFloorPlanActive) { fitFloorPlan(); setMode('draw') }
			render(); return true;
		} catch (err) { S = before; console.error('City Grid object paste error', err); render(); return false }
	}

	// The old shape section is no longer a separate tool; rectangle/circle now live in the asset shelf.
	hideLegacyShapeControls();
	el('tS')?.style.setProperty('display', 'none');

	// ===== Asset shelf on the canvas =====
	const tray = document.createElement('div'); tray.id = 'assetTray';
	tray.innerHTML = '<div class="assetTrayInner"><div class="assetTrayTitle">シーンに追加</div><div class="assetTrayTools"><label>生成面<select id="assetAxisTray"><option value="1">Y：地面／上下</option><option value="0">X：左右の面</option><option value="2">Z：正面／背面</option></select></label></div><div class="assetClipboardTools"><button type="button" id="objectCopy">コピー</button><button type="button" id="objectPaste" disabled>貼り付け</button></div>' + Object.entries(ASSETS).map(([k, v]) => `<button class="assetCard" data-asset="${k}" title="${v.label}を追加"><span class="assetGlyph">${v.glyph}</span><span>${v.label}</span></button>`).join('') + '</div>';
	stage.appendChild(tray);
	assetAxisTrayInput = el('assetAxisTray');
	assetAxisTrayInput.onchange = () => setAssetAxis(assetAxisTrayInput.value);
	syncAssetAxis();
	tray.addEventListener('click', e => { const b = e.target.closest('[data-asset]'); if (b) placeAsset(b.dataset.asset) });
	const objectCopyButton = el('objectCopy'), objectPasteButton = el('objectPaste');
	objectCopyButton.onclick = () => { if (!copySelectedObjects()) return; objectPasteButton.disabled = false; const label = objectCopyButton.textContent; objectCopyButton.textContent = 'コピー済み'; setTimeout(() => objectCopyButton.textContent = label, 900) };
	objectPasteButton.onclick = () => { if (pasteObjectClipboard()) { objectPasteButton.disabled = false; const label = objectPasteButton.textContent; objectPasteButton.textContent = '貼り付け済み'; setTimeout(() => objectPasteButton.textContent = label, 900) } };
	addEventListener('keydown', e => { if (!(e.ctrlKey || e.metaKey) || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return; if (e.key.toLowerCase() === 'c' && selectedObjects().length) { e.preventDefault(); objectCopyButton.click() } else if (e.key.toLowerCase() === 'v' && objectClipboard.length) { e.preventDefault(); objectPasteButton.click() } });
	el('assetToggle').onclick = () => { tray.style.display = tray.style.display === 'block' ? 'none' : 'block'; el('assetToggle').classList.toggle('on', tray.style.display === 'block'); tray.classList.toggle('floorAssetTray', !!window.cityFloorPlanActive && tray.style.display === 'block'); requestAnimationFrame(syncFloorPlanDockLayout) };

	// ===== iPad four-finger primitive quick menu =====
	// 4本指タップで開く、長方形・円・円錐・球体・三角柱・三角錐専用の小型メニュー。
	const primitiveKinds = ['rect', 'circle', 'cone', 'sphere', 'triPrism', 'triPyramid'];
	const primitiveMenu = document.createElement('div'); primitiveMenu.id = 'primitiveQuickMenu';
	primitiveMenu.innerHTML = '<div class="primitiveMenuTitle">プリミティブを追加</div><div class="primitiveMenuGrid">' + primitiveKinds.map(k => { const v = ASSETS[k]; return `<button class="primitiveCard" data-primitive="${k}"><b>${v.glyph}</b><small>${v.label}</small></button>` }).join('') + '</div><div class="primitiveMenuSub">4本指タップで開閉　・　選ぶと現在の生成方向へ配置</div>';
	stage.appendChild(primitiveMenu);
	function togglePrimitiveMenu() { primitiveMenu.classList.toggle('open') }
	function closePrimitiveMenu() { primitiveMenu.classList.remove('open') }
	window.cityPrimitiveMenuToggle = togglePrimitiveMenu;
	primitiveMenu.addEventListener('click', e => { const b = e.target.closest('[data-primitive]'); if (!b) return; placeAsset(b.dataset.primitive); closePrimitiveMenu() });
	document.addEventListener('pointerdown', e => { if (!e.target.closest('#primitiveQuickMenu') && !e.target.closest('#cv')) closePrimitiveMenu() });

	// ===== Scene outliner =====
	const list = el('objectList');
	function sceneObjects() { const a = [], seen = new Set(); S.forEach(s => { if (s.ob && !seen.has(s.ob.id)) { seen.add(s.ob.id); a.push(s.ob) } }); return a }
	function updateOutliner() {
		if (!list) return; normalizeSelection(); const objects = sceneObjects();
		list.innerHTML = objects.length ? objects.map((o, i) => `<div class="objectRow ${selIds.has(o.id) ? 'selected' : ''}" data-object="${o.id}"><input class="objectCheck" type="checkbox" data-object-check="${o.id}" ${selIds.has(o.id) ? 'checked' : ''} aria-label="${assetLabel(o)}を選択"><span class="objectIcon">${assetGlyph(o)}</span><span class="objectMeta">${assetLabel(o)} ${i + 1}<small>${o.type === 'asset' && o.asset === 'person' ? Number(o.h).toFixed(2) + ' m' : (o.type === 'asset' ? 'low-poly asset' : 'vector shape')}</small></span></div>`).join('') : '<div class="emptyList">まだオブジェクトがありません</div>';
	}
	function deleteSelectedScene() {
		const ids = new Set(selectedObjects().map(o => o.id)); if (!ids.size) return;
		HU.push(S); S = S.filter(s => !(s.ob && ids.has(s.ob.id))); RD = []; clearSelection(); render();
	}
	function alignSelectedScene() {
		const objects = selectedObjects(); if (objects.length < 2) { alert('整列するオブジェクトを2個以上選択してください'); return }
		const axis = +$('alignAxis').value, kind = $('alignMode').value, bs = objects.map(o => ({ o, b: obBounds(o) }));
		const target = kind === 'min' ? Math.min(...bs.map(x => x.b.lo[axis])) : kind === 'max' ? Math.max(...bs.map(x => x.b.hi[axis])) : (Math.min(...bs.map(x => x.b.lo[axis])) + Math.max(...bs.map(x => x.b.hi[axis]))) / 2;
		HU.push(S); RD = [];
		bs.forEach(({ o, b }) => { const current = kind === 'min' ? b.lo[axis] : kind === 'max' ? b.hi[axis] : (b.lo[axis] + b.hi[axis]) / 2, delta = [0, 0, 0]; delta[axis] = target - current; if (Math.abs(delta[axis]) > 1e-7) setOb(o.id, moveBy(o, delta)) });
		render();
	}
	list.addEventListener('click', e => {
		const b = e.target.closest('[data-object]'); if (!b) return; const id = b.dataset.object, chosen = obOf(id);
		if (chosen && chosen.type === 'asset' && chosen.asset === 'person') setStudioWorkspace('character');
		if (e.target.matches('[data-object-check]')) {
			if (e.target.checked) { selIds.add(id); sel = id } else { selIds.delete(id); if (sel === id) sel = [...selIds].pop() || null }
			normalizeSelection(); tool = 'edit'; setMode('draw'); syncSel(); render(); return;
		}
		setSelection(id, e.shiftKey || e.metaKey || e.ctrlKey); tool = 'edit'; setMode('draw'); syncSel(); render();
	});
	el('sceneSelectAll').onclick = () => { selIds.clear(); sceneObjects().forEach(o => selIds.add(o.id)); sel = [...selIds].pop() || null; tool = 'edit'; setMode('draw'); syncSel(); render() };
	el('sceneClearSel').onclick = () => { clearSelection(); render() };
	el('sceneDeleteSel').onclick = deleteSelectedScene;
	el('alignApply').onclick = alignSelectedScene;
	// iPadの3本指スワイプ：指先にあるオブジェクトを選び、何もなければ選択対象を順番に切り替える。
	window.cityThreeFingerSelect = (dx, dy, clientX, clientY) => {
		const objects = sceneObjects(); if (!objects.length) return;
		let hit = null; try { hit = pickOb(pos({ clientX, clientY })) } catch (e) { }
		if (hit) setSelection(hit, false);
		else {
			const curIndex = Math.max(-1, objects.findIndex(o => o.id === sel)), dir = (Math.abs(dx) >= Math.abs(dy) ? dx : dy) < 0 ? 1 : -1;
			setSelection(objects[(curIndex + dir + objects.length) % objects.length].id, false);
		}
		tool = 'edit'; setMode('draw'); syncSel(); render();
	};

	// 以前の版でアセット生成に失敗した場合、pのない壊れた線がSに残ることがある。
	// それを先に除去し、以降の図形作成を止めない。
	function validStroke(s) {
		if (!s || Array.isArray(s) || !Array.isArray(s.p) || s.p.length < 1) return false;
		return s.p.every(v => Array.isArray(v) ? v.length >= 3 && v.every(Number.isFinite) : v && Number.isFinite(v.x) && Number.isFinite(v.y));
	}
	function sanitizeScene() {
		const clean = S.filter(validStroke);
		if (clean.length !== S.length) { S = clean; normalizeSelection(); HU = []; RD = []; prev = null; cur = null; }
	}
	sanitizeScene();
	// 以前「空」に保存された線も、現在のカメラ位置から3D線へ移行する。
	// これ以降の描画線は常に3D空間に固定し、視点移動で見え方が変わる。
	function migrateLineArt() {
		const cp = camPos();
		S = S.map(s => {
			if (!s || s.d3 || !Array.isArray(s.p) || !s.p.length || !Array.isArray(s.p[0])) return s;
			const p = s.p.map(v => { const dir = V.nrm(v), g = hit3(dir, 1, -1, cp); return g || V.add(cp, dir, 1, P.dp) });
			return { ...s, d3: true, p };
		});
	}
	migrateLineArt();
	el('p3').checked = true; el('p3').disabled = true;
	if (el('p3').closest('label')) el('p3').closest('label').style.opacity = '.6';
	const legacyUnpack = unpack;
	unpack = function (d) { legacyUnpack(d); migrateLineArt(); el('p3').checked = true; el('p3').disabled = true; render() };
	try { if (!localStorage.getItem('city-grid-v4-floor')) { P.floorOn = true; P.floorAlpha = .24; localStorage.setItem('city-grid-v4-floor', '1') } } catch (e) { }

	// 図形モード専用の安全な作成経路。既存の3D交差判定に失敗しても、
	// 画面上のドラッグを必ず編集可能な図形として確定する。
	let shapeDrag = null;
	const finite3 = q => q && q.every(Number.isFinite) ? q : null;
	function fallbackShape(type, id) {
		const q = groundAt({ x: W * .5, y: H * .64 }) || [0, -1, 4], isTri = type === 'triPrism' || type === 'triPyramid';
		const o = { id: id || uid(), type, k: 1, d: -1, off: [0, 0, 0], ca: q[0], cb: q[2], ra: .75, rb: .75, h: isTri ? .75 : 0, extrude: false, rot: 0, lift: 0, wf: $('wf').checked, c: $('pc').value, w: MASTER_W };
		return genShape(o);
	}
	function visibleShape(lines) {
		if (!lines || !lines.length) return false;
		try { return lines.some(s => validStroke(s) && s.p.some(v => { const q = sp(s, v); return q && q.ok && q.x > -W * .25 && q.x < W * 1.25 && q.y > -H * .25 && q.y < H * 1.25 })) } catch (e) { return false }
	}
	function makeDraggedShape(start, end, id) {
		const k = +$('shK').value, type = $('shT').value, r0 = unscr(start), d = r0[k] >= 0 ? 1 : -1, c = camPos();
		const off = [c[0], k === 1 && r0[1] < 0 ? 0 : c[1], c[2]], cl = V.add(c, off, 1, -1), A = finite3(hit3(r0, k, d, cl)) || V.add(cl, r0, 1, P.dp);
		const r1 = unscr(end), B = finite3(hit3(r1, k, d, cl)) || V.add(cl, r1, 1, P.dp), [iu, iv] = PL[k];
		let du = B[iu] - A[iu], dv = B[iv] - A[iv];
		if (type === 'circ' && $('sq').checked) { const m = Math.max(Math.abs(du), Math.abs(dv)); du = du < 0 ? -m : m; dv = dv < 0 ? -m : m }
		if (!Number.isFinite(du) || !Number.isFinite(dv) || Math.abs(du) < .002 || Math.abs(dv) < .002) return null;
		const baseH = (type === 'triPrism' || type === 'triPyramid') ? Math.min(Math.abs(du), Math.abs(dv)) * P.hr / 100 : 0;
		const lines = genShape({ id: id || uid(), type, k, d, off, ca: A[iu] + du / 2, cb: A[iv] + dv / 2, ra: Math.abs(du) / 2, rb: Math.abs(dv) / 2, h: baseH, extrude: false, rot: 0, lift: 0, wf: $('wf').checked, c: $('pc').value, w: MASTER_W });
		return visibleShape(lines) ? lines : fallbackShape(type, id);
	}
	const legacyDown = cv.onpointerdown, legacyMove = cv.onpointermove, legacyUp = cv.onpointerup;
	const isShapePointer = e => mode === 'draw' && tool === 'shape' && e.pointerType !== 'mouse' || mode === 'draw' && tool === 'shape' && e.pointerType === 'mouse' && !e.button && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey;
	cv.onpointerdown = e => {
		if (isShapePointer(e)) {
			e.preventDefault(); cv.setPointerCapture(e.pointerId); shapeDrag = { id: uid(), pointerId: e.pointerId, start: pos(e), preview: null }; prev = null; render(); return;
		}
		legacyDown && legacyDown.call(cv, e);
	};
	cv.onpointermove = e => {
		if (shapeDrag && e.pointerId === shapeDrag.pointerId) { e.preventDefault(); shapeDrag.preview = makeDraggedShape(shapeDrag.start, pos(e), shapeDrag.id); prev = shapeDrag.preview; render(); return; }
		legacyMove && legacyMove.call(cv, e);
	};
	cv.onpointerup = cv.onpointercancel = e => {
		if (shapeDrag && e.pointerId === shapeDrag.pointerId) {
			e.preventDefault(); const made = shapeDrag.preview;
			if (e.type === 'pointercancel') { shapeDrag = null; prev = null; render(); return }
			if (made && made.length && made[0].ob) { HU.push(S); S = [...S, ...made]; RD = []; setSelection(made[0].ob.id, false); prev = null; shapeDrag = null; setTool('edit'); syncSel(); render(); }
			else { shapeDrag = null; prev = null; render(); }
			return;
		}
		legacyUp && legacyUp.call(cv, e);
	};
	// Capture phase is intentionally used here so the old canvas handler cannot consume
	// the drag before the reliable shape path sees it.
	cv.addEventListener('pointerdown', e => {
		if (!isShapePointer(e)) return;
		e.preventDefault(); e.stopImmediatePropagation(); cv.setPointerCapture(e.pointerId);
		sh = null; cur = null; ed = null; drag = null; shapeDrag = { id: uid(), pointerId: e.pointerId, start: pos(e), preview: null }; prev = null; render();
	}, true);
	cv.addEventListener('pointermove', e => {
		if (!shapeDrag || e.pointerId !== shapeDrag.pointerId) return;
		e.preventDefault(); e.stopImmediatePropagation(); shapeDrag.preview = makeDraggedShape(shapeDrag.start, pos(e), shapeDrag.id); prev = shapeDrag.preview; render();
	}, true);
	cv.addEventListener('pointerup', e => {
		if (!shapeDrag || e.pointerId !== shapeDrag.pointerId) return;
		e.preventDefault(); e.stopImmediatePropagation();
		const made = shapeDrag.preview;
		if (made && made.length && made[0].ob) { HU.push(S); S = [...S, ...made]; RD = []; setSelection(made[0].ob.id, false); prev = null; shapeDrag = null; setTool('edit'); syncSel(); render(); }
		else { shapeDrag = null; prev = null; render(); }
	}, true);
	cv.addEventListener('pointercancel', e => {
		if (!shapeDrag || e.pointerId !== shapeDrag.pointerId) return;
		e.preventDefault(); e.stopImmediatePropagation(); shapeDrag = null; prev = null; render();
	}, true);

	let signEditSession = false;
	function syncSignPanel() {
		const panel = el('signP'), o = sel && obOf(sel), isSign = !!(o && o.type === 'asset' && o.asset === 'sign'); if (!panel) return; panel.style.display = isSign ? '' : 'none';
		const ext = el('obExtrude'); if (ext) ext.disabled = !!o && !(o.type === 'rect' || o.type === 'circ');
		if (!isSign) return;
		const vals = { faceW: o.faceW ?? (2 * o.ra * .7), faceH: o.faceH ?? (o.h * .34), bevel: o.bevel ?? 0 };
		[['ov_faceW', vals.faceW], ['ov_faceH', vals.faceH], ['ov_bevel', vals.bevel]].forEach(([id, v]) => { const n = el(id); if (n && document.activeElement !== n) n.value = Number(v).toFixed(3) });
	}
	function applySignProp(name, v) {
		const o = sel && obOf(sel); if (!o || o.type !== 'asset' || o.asset !== 'sign' || !Number.isFinite(v)) return;
		if (!signEditSession) { HU.push(S); RD = []; signEditSession = true }
		const w = 2 * o.ra, d = 2 * o.rb, h = o.h, boardH = h * .74, max = name === 'faceW' ? w * .90 : name === 'faceH' ? boardH * .84 : Math.min(w, d, h) * .39, min = name === 'bevel' ? 0 : .08;
		const patch = {}; patch[name] = clamp(v, min, max); setOb(sel, patch); render();
	}
	[['ov_faceW', 'faceW'], ['ov_faceH', 'faceH'], ['ov_bevel', 'bevel']].forEach(([id, name]) => { const n = el(id); if (!n) return; n.oninput = () => applySignProp(name, parseFloat(n.value)); n.onchange = () => { signEditSession = false } });
	function syncAssetControls() {
		const o = sel && obOf(sel);
		if (o && o.type === 'asset' && o.asset === 'stairs') {
			if (document.activeElement !== el('stairsSteps')) el('stairsSteps').value = o.steps || 6;
			el('stairsRail').checked = o.handrail === true;
		}
	}
	// Wrap render so the outliner follows undo/redo, opening files, and camera changes.
	const originalRender = render;
	render = function () { sanitizeScene(); originalRender(); updateOutliner(); syncAssetControls(); syncSignPanel(); syncFloorControls(); syncAssetDepth(); syncAssetAxis(); syncPersonControls(); syncFloorPlanSelection?.() };

	// ===== 標準ビューと間取りショートカット（8=間取り横 / 9=間取り真上 / 0=元の視点） =====
	// 標準ビューだけは透視ではなく正投影にし、真横90°・真上90°を正確に扱う。
	const viewKeys = ['lens', 'yaw', 'hz', 'pitch', 'fov', 'roll', 'ch', 'cx', 'cz'];
	const captureHomeView = () => { const v = { gt: el('gt').value, T, orthView }; viewKeys.forEach(k => v[k] = P[k]); return v };
	let homeView = null;
	function applyStandardView(kind) {
		standardApplying = true;
		if (kind === 'home' && homeView) {
			orthView = homeView.orthView || null; el('gt').value = homeView.gt; applyType(homeView.gt); viewKeys.forEach(k => { if (k in P) setP(k, homeView[k]) });
		} else {
			el('gt').value = '2'; applyType(2);
			const keep = { lens: P.lens, hz: P.hz, ch: P.ch, cx: P.cx, cz: P.cz, fov: 180, roll: 0 };
			if (kind === 'front') Object.assign(keep, { yaw: 0, pitch: 0 });
			else if (kind === 'side') Object.assign(keep, { yaw: 90, pitch: 0 });
			else Object.assign(keep, { yaw: 0, pitch: -90 });
			Object.entries(keep).forEach(([k, v]) => setP(k, v)); orthView = kind === 'front' || kind === 'side' || kind === 'top' ? kind : null;
		}
		standardApplying = false;
		sync(); setMode('view'); render();
	}
	window.cityStandardView = kind => applyStandardView(kind);

	// 間取りの投影を切り替える。真上／真横とも、入る前の透視カメラ位置は保持する。
	function setFloorPlanProjection(kind = 'top') {
		// applyType(2)は通常の2点透視用の初期yawへ補正することがあるため、
		// 切り替え前の実カメラの向き・位置を先に退避してから正投影へ移る。
		const cameraBefore = { lens: P.lens, hz: P.hz, ch: P.ch, cx: P.cx, cz: P.cz, yaw: P.yaw };
		standardApplying = true;
		el('gt').value = '2'; applyType(2);
		// orthViewが真上／真横でも、カメラの実際の向き(yaw)は書き換えない。
		// ここを0/90や2点透視の初期値へ固定すると、8/9切り替え後のカメラが別方向になる。
		const keep = { ...cameraBefore, fov: 180, roll: 0 };
		if (kind === 'side') Object.assign(keep, { pitch: 0 });
		else Object.assign(keep, { pitch: -90 });
		Object.entries(keep).forEach(([k, v]) => setP(k, v));
		orthView = kind === 'side' ? 'side' : 'top';
		standardApplying = false; sync(); setMode('draw'); render();
	}
	function showFloorPlan(kind = 'top') {
		if (window.cityFloorPlanActive) { setFloorPlanProjection(kind); fitFloorPlan(); render(); return }
		enterFloorPlan(kind);
	}
	el('viewFloorSide').onclick = () => showFloorPlan('side');
	el('viewFloorTop').onclick = () => showFloorPlan('top');
	el('viewHome').onclick = () => window.cityFloorPlanActive ? exitFloorPlan(true) : applyStandardView('home');

	// ===== 間取りモード：真上／真横の正投影でシーンを確認する =====
	let floorPlanView = null, floorPlanSideWasHidden = null, floorPlanAutoHidSide = false;
	function restoreStudioView(v, preserve = {}) {
		if (!v) { applyStandardView('home'); return }
		standardApplying = true;
		el('gt').value = v.gt; applyType(v.gt); orthView = v.orthView || null;
		viewKeys.forEach(k => { if (k in P) setP(k, k in preserve ? preserve[k] : v[k]) });
		standardApplying = false; sync(); setMode('view'); render();
	}
	function fitFloorPlan() {
		const objects = sceneObjects(), bounds = [];
		objects.forEach(o => { try { const b = obBounds(o); if (b && b.lo && b.hi && Number.isFinite(b.lo[0]) && Number.isFinite(b.hi[0]) && Number.isFinite(b.lo[1]) && Number.isFinite(b.hi[1]) && Number.isFinite(b.lo[2]) && Number.isFinite(b.hi[2])) bounds.push(b) } catch (e) { } });
		const fyaw = Number(P.yaw || 0) * DG, tx = P.cx - Math.sin(fyaw) * FLOOR_CAMERA_RAY, tz = P.cz + Math.cos(fyaw) * FLOOR_CAMERA_RAY;
		if (orthView === 'side') {
			// 真横は画面の左右がワールドZ、上下がワールドY。カメラの高さも含めて自動フィットする。
			if (!bounds.length) { window.cityFloorPlanCenter = [P.cz, P.ch - 1]; window.cityFloorPlanScale = Math.min(W, H) / 7.2; return }
			const minZ = Math.min(P.cz, tz, ...bounds.map(b => b.lo[2])), maxZ = Math.max(P.cz, tz, ...bounds.map(b => b.hi[2]));
			const minY = Math.min(P.ch - 1, ...bounds.map(b => b.lo[1])), maxY = Math.max(P.ch - 1, ...bounds.map(b => b.hi[1]));
			const spanZ = Math.max(.1, maxZ - minZ), spanY = Math.max(.1, maxY - minY), pad = Math.max(1, Math.max(spanZ, spanY) * .16);
			const fitScale = Math.min(W * .82 / (spanZ + pad * 2), H * .82 / (spanY + pad * 2));
			window.cityFloorPlanCenter = [(minZ + maxZ) / 2, (minY + maxY) / 2];
			window.cityFloorPlanScale = Math.max(24, Math.min(220, fitScale));
			return;
		}
		if (!bounds.length) { window.cityFloorPlanCenter = [P.cx, P.cz]; window.cityFloorPlanScale = Math.min(W, H) / 7.2; return }
		const minX = Math.min(P.cx, tx, ...bounds.map(b => b.lo[0])), maxX = Math.max(P.cx, tx, ...bounds.map(b => b.hi[0])), minZ = Math.min(P.cz, tz, ...bounds.map(b => b.lo[2])), maxZ = Math.max(P.cz, tz, ...bounds.map(b => b.hi[2]));
		const spanX = Math.max(.1, maxX - minX), spanZ = Math.max(.1, maxZ - minZ), pad = Math.max(1, Math.max(spanX, spanZ) * .16);
		const fitScale = Math.min(W * .82 / (spanX + pad * 2), H * .82 / (spanZ + pad * 2));
		window.cityFloorPlanCenter = [(minX + maxX) / 2, (minZ + maxZ) / 2];
		window.cityFloorPlanScale = Math.max(24, Math.min(220, fitScale));
	}
	function enterFloorPlan(kind = 'top') {
		if (!window.cityFloorPlanActive) {
			floorPlanView = captureHomeView(); floorPlanSideWasHidden = $('side').classList.contains('hide'); floorPlanAutoHidSide = false; window.cityFloorPlanActive = true;
		}
		// iPad / 狭い画面では設定パネルが間取り図を覆わないよう、一度だけ隠す。
		// 左端のタブまたは1キーでいつでも再表示できる。
		if (innerWidth <= 900 && !$('side').classList.contains('hide')) { floorPlanAutoHidSide = true; setSide(true); fit() }
		floorPlanDock.classList.add('open');
		syncFloorPlanDockLayout();
		Z = 1; ox = 0; oy = 0; updZ();
		setFloorPlanProjection(kind);
		fitFloorPlan();
		if (tool !== 'edit') setTool('edit');
		setMode('draw');
		const status = el('floorPlanStatus'); if (status) status.textContent = `間取りモード中：${kind === 'side' ? '真横' : '真上'}（家具は真上でX・Z移動）`;
		render();
	}
	function exitFloorPlan(restore = true) {
		if (!window.cityFloorPlanActive) return;
		// 間取り中に変更したカメラ位置・向き・レンズを3D視点へ引き継ぐ。
		const keepCamera = { yaw: P.yaw, cx: P.cx, cz: P.cz, lens: P.lens };
		window.cityFloorPlanActive = false; floorPlanDock.classList.remove('open');
		const saved = floorPlanView, restoreSide = floorPlanAutoHidSide && !floorPlanSideWasHidden; floorPlanView = null; floorPlanSideWasHidden = null; floorPlanAutoHidSide = false; window.cityFloorPlanCenter = null; window.cityFloorPlanScale = null;
		if (restore) restoreStudioView(saved, keepCamera); else { setMode('view'); render() }
		if (restoreSide) { setSide(false); fit() }
		el('assetTray')?.classList.remove('floorAssetTray');
		syncFloorPlanDockLayout();
		const status = el('floorPlanStatus'); if (status) status.textContent = '間取りモードを開くと、X・Z方向へドラッグできます';
	}
	window.cityFloorPlanActive = false;
	window.cityFloorPlanEnter = enterFloorPlan;
	window.cityFloorPlanExit = exitFloorPlan;
	window.cityFloorPlanView = showFloorPlan;
	el('openFloorPlan').onclick = () => setStudioWorkspace('floorplan');
	el('closeFloorPlan').onclick = () => setStudioWorkspace('perspective');

	// 間取り上の操作対象。オブジェクトの前側の丸、カメラ本体、カメラ先端の丸を
	// 3Dビューのギズモとは別に描き、参考サイトと同じ操作感にする。
	const FLOOR_CAMERA_RAY = 3;
	let floorPlanDrag = null, floorPlanPanMode = false;
	// 間取りでは既存のキャンバス捕捉が先に動くため、2本／3本指タップをここで明示的に数える。
	const floorTouchIds = new Map(); let floorTouchT0 = 0, floorTouchMax = 0, floorTouchMoved = false, floorTouchPan = null;
	function floorTouchDown(e) {
		if (e.pointerType !== 'touch') return false;
		if (!floorTouchIds.size) { floorTouchT0 = Date.now(); floorTouchMax = 0; floorTouchMoved = false; floorTouchPan = null }
		floorTouchIds.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }); floorTouchMax = Math.max(floorTouchMax, floorTouchIds.size);
		if (floorTouchIds.size >= 2) {
			// 1本目は通常の編集経路へ渡るため、2本目が入った時点で
			// 通常編集のポインタ状態を完全に捨てる。これをしないと、
			// 2本指タップ後もTC/ptrが残り、undo/redo結果が画面へ反映されない。
			cancelBoxPending(); boxSelect = null; floorPlanDrag = null; snapHit = null;
			TC.clear(); mg = null; ptr = null; ptrType = null; drag = null; cur = null; er = null; sh = null; prev = null; bd = false; ed = null;
			const pts = [...floorTouchIds.values()], mx = pts.reduce((a, t) => a + t.x, 0) / pts.length, my = pts.reduce((a, t) => a + t.y, 0) / pts.length;
			if (!Array.isArray(window.cityFloorPlanCenter)) fitFloorPlan();
			floorTouchPan = { mx0: mx, my0: my, center0: [...(window.cityFloorPlanCenter || [0, 0])] };
			e.preventDefault(); e.stopImmediatePropagation(); try { cv.setPointerCapture(e.pointerId) } catch (err) { } return true
		}
		return false;
	}
	function floorTouchMove(e) {
		const s = floorTouchIds.get(e.pointerId); if (!s) return false;
		if (Math.hypot(e.clientX - s.sx, e.clientY - s.sy) > 12) floorTouchMoved = true; s.x = e.clientX; s.y = e.clientY;
		if (floorTouchMax >= 2 && floorTouchPan) {
			const pts = [...floorTouchIds.values()], mx = pts.reduce((a, t) => a + t.x, 0) / pts.length, my = pts.reduce((a, t) => a + t.y, 0) / pts.length;
			const sc = Math.max(1, Number(orthScale()) || 1), dx = mx - floorTouchPan.mx0, dy = my - floorTouchPan.my0;
			window.cityFloorPlanCenter = [floorTouchPan.center0[0] - dx / sc, floorTouchPan.center0[1] + dy / sc]; floorTouchMoved = true; render();
		}
		return floorTouchMax >= 2;
	}
	function floorTouchUp(e) {
		if (e.pointerType !== 'touch' || !floorTouchIds.has(e.pointerId)) return false;
		const s = floorTouchIds.get(e.pointerId); if (Math.hypot(e.clientX - s.sx, e.clientY - s.sy) > 12) floorTouchMoved = true; floorTouchIds.delete(e.pointerId);
		if (floorTouchIds.size) return true;
		const count = floorTouchMax, moved = floorTouchMoved, quick = Date.now() - floorTouchT0 < 650; floorTouchMax = 0; floorTouchMoved = false; floorTouchT0 = 0; floorTouchPan = null;
		if (e.type === 'pointerup' && quick && !moved) { if (count === 2) undo(); else if (count === 3) redo(); else if (count >= 4 && window.cityPrimitiveMenuToggle) window.cityPrimitiveMenuToggle() }
		return true;
	}
	// Safariで画面遷移やサイドパネル操作がpointerupを欠落させても、
	// 次の指操作を古い本数として扱わない。
	const resetFloorTouch = () => { floorTouchIds.clear(); floorTouchMax = 0; floorTouchMoved = false; floorTouchT0 = 0; floorTouchPan = null };
	addEventListener('blur', resetFloorTouch); document.addEventListener('visibilitychange', () => { if (document.hidden) resetFloorTouch() });
	const floorPlanDock = document.createElement('div'); floorPlanDock.id = 'floorPlanDock'; floorPlanDock.innerHTML = '<div class="floorPlanDockInner"><div class="floorPlanDockHeader"><div id="floorPlanDockStatus" class="floorPlanDockStatus">オブジェクトを選択すると、移動・回転・サイズ変更ができます。<small>カメラ本体：位置　／　先端の丸：向き</small></div><div class="floorHistoryButtons"><button type="button" id="floorUndo" class="floorHistoryButton" title="間取りの操作を元に戻す">↶ 元に戻す</button><button type="button" id="floorRedo" class="floorHistoryButton" title="間取りの操作をやり直す">↷ やり直す</button></div><button type="button" class="dockCollapse" data-floor-dock-action="collapse" title="操作バーを折りたたむ">−</button></div><button type="button" data-floor-dock-action="left">↺ 15°</button><button type="button" data-floor-dock-action="right">↻ 15°</button><button type="button" data-floor-dock-action="90">90°回す</button><label class="floorLensTools">レンズ <input id="floorLensInput" type="number" min="14" max="200" step="1"> mm</label><div class="floorPlanPanTools"><span>表示移動</span><button type="button" data-floor-dock-action="pan-up" title="表示を上へ">↑</button><button type="button" data-floor-dock-action="pan-down" title="表示を下へ">↓</button><button type="button" data-floor-dock-action="pan-left" title="表示を左へ">←</button><button type="button" data-floor-dock-action="pan-right" title="表示を右へ">→</button></div><button type="button" data-floor-dock-action="assets">＋アセット</button><button type="button" data-floor-dock-action="delete">片付ける</button><span class="dockHint">中／右ドラッグ：表示移動　・　表示移動ボタン／Alt＋矢印／WASD：キャンバス移動　・　磁石ON：家具移動と幅／奥行の面編集をエッジへ吸着　・　2本指タップ：元に戻す／3本指タップ：やり直す</span></div>'; stage.appendChild(floorPlanDock);
	// アセット棚を開いたときは、間取り操作バーを棚の上へ逃がす。棚と操作バーを重ねないためのレイアウト調整。
	function syncFloorPlanDockLayout() {
		const tray = el('assetTray'); if (!tray) return;
		// 操作バーは右上に固定し、下部のアセット棚と重ならない配置にする。
		floorPlanDock.style.bottom = '';
		floorPlanDock.dataset.assetTrayOpen = !!window.cityFloorPlanActive && getComputedStyle(tray).display !== 'none' ? '1' : '0';
	}
	addEventListener('resize', () => requestAnimationFrame(syncFloorPlanDockLayout));
	const angle360 = a => ((Number(a) || 0) % 360 + 360) % 360;
	const floorPlanObject = () => sel && obOf(sel);
	function floorPlanWorldAt(p) {
		const q = hit3(unscr(p), 1, -1, [0, 0, 0]);
		return q && Number.isFinite(q[0]) && Number.isFinite(q[2]) ? { x: q[0], z: q[2] } : null;
	}
	function floorPlanHandles() {
		const o = floorPlanObject(), out = { object: null, camera: null };
		if (o && o.k === 1) {
			const base = L2W(o, 0, 0, 0), a = (Number(o.rot) || 0) * DG, dist = Math.max(Math.abs(Number(o.ra) || .3), Math.abs(Number(o.rb) || .3)) + .42;
			out.object = { o, base, center: scrW(base), world: { x: base[0] - Math.sin(a) * dist, z: base[2] + Math.cos(a) * dist } };
			out.object.s = scrW([out.object.world.x, orthView === 'side' ? base[1] : -1, out.object.world.z]);
		}
		const yaw = Number(P.yaw || 0) * DG, body = { x: P.cx, z: P.cz }, target = { x: P.cx - Math.sin(yaw) * FLOOR_CAMERA_RAY, z: P.cz + Math.cos(yaw) * FLOOR_CAMERA_RAY }, cameraY = orthView === 'side' ? P.ch - 1 : -1, half = Math.atan(18 / Math.max(12, Number(P.lens) || 38)), lensWorld = orthView === 'top' ? [P.cx - Math.sin(yaw - half) * FLOOR_CAMERA_RAY, cameraY, P.cz + Math.cos(yaw - half) * FLOOR_CAMERA_RAY] : null;
		out.camera = { body, target, sBody: scrW([body.x, cameraY, body.z]), sTarget: scrW([target.x, cameraY, target.z]), sLens: lensWorld ? scrW(lensWorld) : null, lensWorld, yaw };
		return out;
	}
	function floorPlanItemAt(w) {
		if (!w) return null;
		return sceneObjects().slice().reverse().find(o => {
			if (!o || o.k !== 1) return false;
			const base = L2W(o, 0, 0, 0), dx = w.x - base[0], dz = w.z - base[2], a = (Number(o.rot) || 0) * DG, cx = dx * Math.cos(a) + dz * Math.sin(a), cz = -dx * Math.sin(a) + dz * Math.cos(a);
			return Math.abs(cx) <= Math.abs(Number(o.ra) || .25) + .08 && Math.abs(cz) <= Math.abs(Number(o.rb) || .25) + .08;
		}) || null;
	}
	function floorPlanItemAtSide(p) {
		if (!p) return null;
		return sceneObjects().slice().reverse().find(o => {
			if (!o || o.k !== 1) return false;
			const b = obBounds(o), pts = [];
			for (const x of [b.lo[0], b.hi[0]]) for (const y of [b.lo[1], b.hi[1]]) for (const z of [b.lo[2], b.hi[2]]) { const q = scrW([x, y, z]); if (q.ok) pts.push(q) }
			if (!pts.length) return false;
			const x0 = Math.min(...pts.map(q => q.x)) - 14 / Z, x1 = Math.max(...pts.map(q => q.x)) + 14 / Z, y0 = Math.min(...pts.map(q => q.y)) - 14 / Z, y1 = Math.max(...pts.map(q => q.y)) + 14 / Z;
			return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
		}) || null;
	}
	function floorPlanEditHandles() {
		const o = floorPlanObject(); if (!o || o.k !== 1) return null;
		const base = L2W(o, 0, 0, 0), zc = Math.abs(Number(o.h) || 0) > 1e-6 ? Number(o.h) / 2 : 0, center = scrW(L2W(o, 0, 0, zc)), handles = [];
		const add = (kind, label, point, probe, start, min = .01, side = 1) => {
			const s = scrW(point), q = scrW(probe); if (!s.ok || !q.ok) return; const dx = q.x - s.x, dy = q.y - s.y, px = Math.hypot(dx, dy); if (px < .01) return;
			handles.push({ kind, label, s, dir: { x: dx / px, y: dy / px }, scale: px / .1, start, min, side });
		};
		if (orthView === 'top') {
			// 幅・奥行はプラス側とマイナス側の両面にハンドルを出す。
			add('w', '幅＋', L2W(o, o.ra, 0, 0), L2W(o, o.ra + .1, 0, 0), Math.abs(o.ra) * 2, .01, 1);
			add('w', '幅−', L2W(o, -o.ra, 0, 0), L2W(o, -o.ra - .1, 0, 0), Math.abs(o.ra) * 2, .01, -1);
			add('d', '奥行＋', L2W(o, 0, o.rb, 0), L2W(o, 0, o.rb + .1, 0), Math.abs(o.rb) * 2, .01, 1);
			add('d', '奥行−', L2W(o, 0, -o.rb, 0), L2W(o, 0, -o.rb - .1, 0), Math.abs(o.rb) * 2, .01, -1);
			// 真上ではY方向が投影されないため、画面上へ高さハンドルを逃がして表示する。
			const gap = Math.max(48 / Z, Math.min(88 / Z, Math.max(Math.abs(Number(o.ra) || .5), Math.abs(Number(o.rb) || .5)) * orthScale() * .65));
			handles.push({ kind: 'h', label: '高さ', s: { x: center.x, y: center.y + gap, ok: true }, dir: { x: 0, y: 1 }, scale: orthScale(), start: Math.max(0, Number(o.h) || 0), min: 0, screen: true });
		} else if (orthView === 'side') {
			add('d', '奥行＋', L2W(o, 0, o.rb, zc), L2W(o, 0, o.rb + .1, zc), Math.abs(o.rb) * 2, .01, 1);
			add('d', '奥行−', L2W(o, 0, -o.rb, zc), L2W(o, 0, -o.rb - .1, zc), Math.abs(o.rb) * 2, .01, -1);
			const visualH = Math.abs(Number(o.h) || 0) > 1e-6 ? Math.abs(Number(o.h)) : .6;
			// 真横ビューは上端・下端の両方を編集できるようにする。
			// 上端は下端固定、下端は上端固定で高さを変更する。
			add('h', '上端', L2W(o, 0, 0, visualH), L2W(o, 0, 0, visualH + .1), Math.max(0, Number(o.h) || 0), 0, 1);
			add('h', '下端', L2W(o, 0, 0, 0), L2W(o, 0, 0, -.1), Math.max(0, Number(o.h) || 0), 0, -1);
		}
		return { o, base, center, handles };
	}
	function floorPlanEditHandleAt(p) {
		const g = floorPlanEditHandles(); if (!g) return null; const lim = 20 / Z;
		return g.handles.find(h => Math.hypot(h.s.x - p.x, h.s.y - p.y) < lim) ? { g, h: g.handles.find(h => Math.hypot(h.s.x - p.x, h.s.y - p.y) < lim) } : null;
	}
	function drawFloorPlanEditHandles(c) {
		const g = floorPlanEditHandles(); if (!g) return;
		c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.font = `bold ${11 / Z}px system-ui`;
		g.handles.forEach(h => { c.strokeStyle = 'rgba(102,227,200,.85)'; c.fillStyle = '#66e3c8'; c.lineWidth = 1.2 / Z; c.setLineDash([4 / Z, 3 / Z]); c.beginPath(); c.moveTo(g.center.x, g.center.y); c.lineTo(h.s.x, h.s.y); c.stroke(); c.setLineDash([]); c.fillStyle = '#fff'; c.strokeStyle = '#66e3c8'; c.beginPath(); c.rect(h.s.x - 6 / Z, h.s.y - 6 / Z, 12 / Z, 12 / Z); c.fill(); c.stroke(); c.fillStyle = '#d9fff6'; c.fillText(h.label, h.s.x + 8 / Z, h.s.y - 7 / Z) });
		c.restore();
	}
	function drawFloorPlanOverlay(c) {
		if (orthView !== 'top' && orthView !== 'side') return;
		const h = floorPlanHandles(), r = 9 / Z;
		c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
		// 選択中オブジェクト：前側の回転ハンドルと薄い外枠
		if (h.object) {
			const o = h.object.o, cs = Math.cos((Number(o.rot) || 0) * DG), sn = Math.sin((Number(o.rot) || 0) * DG), corners = [[-o.ra, -o.rb], [o.ra, -o.rb], [o.ra, o.rb], [-o.ra, o.rb], [-o.ra, -o.rb]];
			c.strokeStyle = 'rgba(255,159,104,.9)'; c.lineWidth = 1.5 / Z; c.setLineDash([6 / Z, 4 / Z]); c.beginPath(); corners.forEach(([x, y], i) => { const p = L2W(o, x, y, 0), q = scrW(p); i ? q.ok ? c.lineTo(q.x, q.y) : null : c.moveTo(q.x, q.y) }); c.stroke(); c.setLineDash([]);
			if (orthView === 'side' && Number(o.h) > 1e-6) {
				const baseCorners = [[-o.ra, -o.rb], [o.ra, -o.rb], [o.ra, o.rb], [-o.ra, o.rb]]; c.strokeStyle = 'rgba(255,159,104,.75)'; c.lineWidth = 1.2 / Z; c.beginPath(); baseCorners.forEach(([x, y], i) => { const q = scrW(L2W(o, x, y, o.h)); i ? q.ok ? c.lineTo(q.x, q.y) : null : c.moveTo(q.x, q.y) }); c.closePath(); baseCorners.forEach(([x, y]) => { const a = scrW(L2W(o, x, y, 0)), b = scrW(L2W(o, x, y, o.h)); if (a.ok && b.ok) { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y) } }); c.stroke();
			}
			c.strokeStyle = '#ff9f68'; c.lineWidth = 1.5 / Z; c.beginPath(); c.moveTo(h.object.center.x, h.object.center.y); c.lineTo(h.object.s.x, h.object.s.y); c.stroke();
			c.fillStyle = '#fff'; c.strokeStyle = '#ff9f68'; c.lineWidth = 2 / Z; c.beginPath(); c.arc(h.object.s.x, h.object.s.y, r, 0, Math.PI * 2); c.fill(); c.stroke();
			c.beginPath(); c.arc(h.object.s.x, h.object.s.y, r * .52, -Math.PI * .15, Math.PI * 1.3); c.stroke();
			drawFloorPlanEditHandles(c);
		}
		// カメラ：本体をドラッグして位置、先端の丸をドラッグして向き
		const k = h.camera, half = Math.atan(18 / Math.max(12, Number(P.lens) || 38)), body = k.sBody, target = k.sTarget, cameraY = orthView === 'side' ? P.ch - 1 : -1, left = scrW([P.cx - Math.sin(k.yaw - half) * FLOOR_CAMERA_RAY, cameraY, P.cz + Math.cos(k.yaw - half) * FLOOR_CAMERA_RAY]), right = scrW([P.cx - Math.sin(k.yaw + half) * FLOOR_CAMERA_RAY, cameraY, P.cz + Math.cos(k.yaw + half) * FLOOR_CAMERA_RAY]);
		c.fillStyle = 'rgba(102,227,200,.16)'; c.strokeStyle = '#66e3c8'; c.lineWidth = 1.2 / Z; c.beginPath(); c.moveTo(body.x, body.y); c.lineTo(left.x, left.y); c.lineTo(right.x, right.y); c.closePath(); c.fill(); c.stroke();
		c.beginPath(); c.moveTo(body.x, body.y); c.lineTo(target.x, target.y); c.stroke();
		c.fillStyle = '#66e3c8'; c.strokeStyle = '#164c4b'; c.lineWidth = 1.5 / Z; c.beginPath(); c.arc(body.x, body.y, r, 0, Math.PI * 2); c.fill(); c.stroke();
		c.fillStyle = '#fff'; c.strokeStyle = '#66e3c8'; c.beginPath(); c.arc(target.x, target.y, r * .82, 0, Math.PI * 2); c.fill(); c.stroke();
		if (k.sLens && k.sLens.ok) { const q = k.sLens, s = 6 / Z; c.fillStyle = '#fff'; c.strokeStyle = '#ffd34d'; c.lineWidth = 1.5 / Z; c.beginPath(); c.moveTo(q.x, q.y - s); c.lineTo(q.x + s, q.y); c.lineTo(q.x, q.y + s); c.lineTo(q.x - s, q.y); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#ffe6a1'; c.font = `bold ${10 / Z}px system-ui`; c.fillText('レンズ', q.x + 8 / Z, q.y - 7 / Z) }
		c.restore();
	}
	window.cityFloorPlanOverlay = drawFloorPlanOverlay;
	function syncFloorPlanSelection() {
		const o = floorPlanObject(), ground = !!(o && o.k === 1), label = o ? (o.type === 'asset' ? (assetLabel(o) || 'アセット') : '図形') : 'オブジェクト';
		const text = o ? (ground ? `${label} を選択中（向き ${Math.round(angle360(o.rot))}°）` : `${label} を選択中（壁面オブジェクトは間取りでは表示のみ）`) : 'オブジェクトを選択すると、移動・回転できます。';
		const status = el('floorPlanSelectionStatus'); if (status) status.textContent = text;
		const dockStatus = el('floorPlanDockStatus'); if (dockStatus) dockStatus.innerHTML = `${text}<small>幅・奥行ハンドルは反対側の面を固定　／　真横は上端・下端ハンドルで高さを編集</small>`;
		[['floorRotateLeft', ground], ['floorRotateRight', ground], ['floorRotate90', ground], ['floorDelete', !!o]].forEach(([id, on]) => { const b = el(id); if (b) b.disabled = !on });
		floorPlanDock.querySelectorAll('[data-floor-dock-action]').forEach(b => { const a = b.dataset.floorDockAction; b.disabled = a === 'delete' ? !o : ['left', 'right', '90'].includes(a) ? !ground : false });
		const undoButton = el('floorUndo'), redoButton = el('floorRedo'); if (undoButton) undoButton.disabled = !HU.length; if (redoButton) redoButton.disabled = !RD.length;
		const lensInput = el('floorLensInput'); if (lensInput && document.activeElement !== lensInput) lensInput.value = Number(P.lens || 35).toFixed(0);
	}
	function floorDimensionPatch(o, name, value, side = 1) {
		const v = Math.max(name === 'h' ? 0 : .01, Number(value));
		if (!Number.isFinite(v)) return null;
		if (name === 'w' || name === 'd') {
			const oldW = Math.max(.01, Number(o.ra || 0) * 2), oldD = Math.max(.01, Number(o.rb || 0) * 2), r = Math.max(.005, v / 2), patch = {};
			// 幅／奥行ハンドルは手前側の面を動かす。反対側の面を固定するため、
			// 中点をそのままにせず、中心(ca/cb)も半分の差分だけ同じ面側へ移動する。
			const delta = (v - (name === 'w' ? oldW : oldD)) / 2, cs = Math.cos(Number(o.rot || 0) * DG), sn = Math.sin(Number(o.rot || 0) * DG);
			if (name === 'w') { patch.ca = o.ca + side * delta * cs; patch.cb = o.cb + side * delta * sn }
			else { patch.ca = o.ca - side * delta * sn; patch.cb = o.cb + side * delta * cs }
			if (o.asset === 'sphere' || o.type === 'cyl') { patch.ra = r; patch.rb = r; if (o.asset === 'sphere') patch.h = r * 2 }
			else patch[name === 'w' ? 'ra' : 'rb'] = r;
			return patch;
		}
		const patch = { h: v };
		// 真横ビューの下端ハンドルは、上面を固定したまま下側の面だけを動かす。
		// k=1,d=-1の床では、下端を下げるほどliftが減り、上端は変わらない。
		if (name === 'h' && side === -1) patch.lift = Number(o.lift || 0) + Math.max(0, Number(o.h) || 0) - v;
		if (o.type === 'rect' || o.type === 'circ') patch.extrude = v > 1e-6;
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
		if (o.k === 1) {
			const out = [];
			for (const x of [-Math.abs(Number(o.ra) || 0), Math.abs(Number(o.ra) || 0)]) for (const y of [-Math.abs(Number(o.rb) || 0), Math.abs(Number(o.rb) || 0)]) {
				const p = L2W(o, x, y, 0); out.push({ x: p[0], z: p[2] });
			}
			return out;
		}
		const b = obBounds(o), out = []; for (const x of [b.lo[0], b.hi[0]]) for (const z of [b.lo[2], b.hi[2]]) out.push({ x, z });
		return out;
	}
	function floorHeightSnap(o, patch, h, value) {
		const q = { ...o, ...patch }, base = L2W(q, 0, 0, 0), height = Math.max(0, Number(q.h) || 0), topY = base[1] - Number(q.d || -1) * height, side = Number(h?.side) === -1 ? -1 : 1, movingY = side === -1 ? base[1] : topY, fp = floorFootprintXZ(q);
		if (fp.length < 4) return patch;
		const x0 = Math.min(...fp.map(p => p.x)), x1 = Math.max(...fp.map(p => p.x)), z0 = Math.min(...fp.map(p => p.z)), z1 = Math.max(...fp.map(p => p.z));
		const scale = Math.max(24, Number(orthScale()) || 24), tau = Math.max(.04, (Number(P.sn) || 14) / scale), tolerance = Math.max(.01, tau * .25); let best = null;
		targetsOf(o.id).forEach(t => {
			const to = obOf(t.id), tf = floorFootprintXZ(to); if (tf.length < 4) return;
			const tx0 = Math.min(...tf.map(p => p.x)), tx1 = Math.max(...tf.map(p => p.x)), tz0 = Math.min(...tf.map(p => p.z)), tz1 = Math.max(...tf.map(p => p.z));
			if (Math.min(x1, tx1) - Math.max(x0, tx0) < -tolerance || Math.min(z1, tz1) - Math.max(z0, tz0) < -tolerance) return;
			const b = t.b;[b.lo[1], b.hi[1]].forEach(targetY => { const gap = targetY - movingY; if (Math.abs(gap) <= tau && (!best || Math.abs(gap) < Math.abs(best.gap))) best = { gap, id: t.id } });
		});
		if (!best) return patch;
		snapHit = new Set([best.id]);
		// 下端は高さ変更量と面の移動方向が逆なのでsideを掛ける。
		return floorDimensionPatch(o, 'h', Math.max(0, Number(value) + side * best.gap), side);
	}
	function floorResizeSnap(o, patch, h, value) {
		if (!$('snp')?.checked || !h || !['w', 'd', 'h'].includes(h.kind)) return patch;
		if (h.kind === 'h') return floorHeightSnap(o, patch, h, value);
		const q = { ...o, ...patch }, a = Number(q.rot || 0) * DG;
		// sideは「＋側／−側」の面そのもの。0や未設定を＋側へ丸めるが、
		// −1は絶対に失わない。間取り9の下辺はここで−1になる。
		const side = Number(h.side) === -1 ? -1 : 1;
		const nx = h.kind === 'w' ? Math.cos(a) : -Math.sin(a), nz = h.kind === 'w' ? Math.sin(a) : Math.cos(a), tx = -nz, tz = nx;
		const face = h.kind === 'w' ? L2W(q, side * q.ra, 0, 0) : L2W(q, 0, side * q.rb, 0), at = face[0] * nx + face[2] * nz, tAt = face[0] * tx + face[2] * tz;
		const halfT = h.kind === 'w' ? Math.abs(q.rb) : Math.abs(q.ra), faceMin = tAt - halfT, faceMax = tAt + halfT;
		// P.snは通常ビューと同じ画面上の吸着距離。正投影ではorthScaleがpx／world。
		const scale = Math.max(24, Number(orthScale()) || 24), tau = Math.max(.04, (Number(P.sn) || 14) / scale); let best = null;
		targetsOf(o.id).forEach(t => {
			const to = obOf(t.id), fp = floorFootprintXZ(to); if (fp.length < 4) return;
			const pts = fp.map(p => ({ n: p.x * nx + p.z * nz, t: p.x * tx + p.z * tz }));
			const nMin = Math.min(...pts.map(p => p.n)), nMax = Math.max(...pts.map(p => p.n)), tMin = Math.min(...pts.map(p => p.t)), tMax = Math.max(...pts.map(p => p.t));
			// 面の長さ方向が重なる、または辺／角が吸着距離以内にある対象だけを候補にする。
			// 真上の間取りでは、辺同士がちょうど接するケースも許可する。
			const tangentGap = Math.max(faceMin - tMax, tMin - faceMax, 0); if (tangentGap > tau) return;
			[nMin, nMax].forEach(targetN => {
				const gap = targetN - at;
				if (Math.abs(gap) <= tau && (!best || Math.abs(gap) < Math.abs(best.gap))) best = { gap, id: t.id };
			});
		});
		if (!best) return patch;
		snapHit = new Set([best.id]);
		// スナップ補正も反対側の面を固定したまま行う。オブジェクト全体を移動させない。
		// マイナス側の辺は、幅／奥行を増やすと逆方向へ動く。
		// そのため、面の補正量にsideを掛けて反対側の面を固定する。
		const next = Math.max(Number(h.min) || .01, Number(value) + side * best.gap);
		return floorDimensionPatch(o, h.kind, next, side);
	}
	function floorPlanSnapDelta(o, delta) {
		if (!$('snp')?.checked) return delta;
		const base = L2W(o, 0, 0, 0), snap = snapSetup(o, base), q = snapShift(snap.bb, delta, [0, 2], snap.targets, snap.tau);
		if (q.hit.size) snapHit = q.hit;
		return q.d;
	}
	function rotateFloorSelected(deg) {
		const o = floorPlanObject(); if (!o || o.k !== 1) return; HU.push(S); RD = []; setOb(o.id, { rot: angle360((Number(o.rot) || 0) + deg) }); render();
	}
	function moveFloorSelected(dx, dz) {
		const objects = selectedObjects().filter(o => o.k === 1), o = objects.find(q => q.id === sel) || objects[0]; if (!o || !objects.length) return; HU.push(S); RD = []; snapHit = null;
		const setup = snapSetupGroup(objects, L2W(o, 0, 0, 0)), q = $('snp')?.checked ? snapShift(setup.bb, [dx, 0, dz], [0, 2], setup.targets, setup.tau) : { d: [dx, 0, dz], hit: new Set() };
		snapHit = q.hit.size ? q.hit : null;
		/* 間取りは水平面のca/cbだけを変え、Y高さ・lift・offを保持する。 */
		objects.forEach(g => setOb(g.id, { ca: g.ca + q.d[0], cb: g.cb + q.d[2] })); render();
	}
	// カメラではなく、間取りキャンバスの表示中心だけを移動する。
	// dx/dyは画面上の移動量(px)。オブジェクトやP.cx/P.czは変更しない。
	function panFloorPlan(dx, dy) {
		if (!window.cityFloorPlanActive) return;
		if (!Array.isArray(window.cityFloorPlanCenter)) fitFloorPlan();
		const sc = Math.max(1, Number(orthScale()) || 1), c = window.cityFloorPlanCenter || [0, 0];
		window.cityFloorPlanCenter = [c[0] - dx / sc, c[1] + dy / sc]; render();
	}
	el('floorUndo').onclick = () => { floorPlanDrag = null; undo() };
	el('floorRedo').onclick = () => { floorPlanDrag = null; redo() };
	const floorLensInput = el('floorLensInput');
	floorLensInput.oninput = () => { const v = Number(floorLensInput.value); if (Number.isFinite(v)) { P.lens = clamp(v, 14, 200); sync(); render() } };
	floorLensInput.onchange = () => { floorLensInput.value = Number(P.lens || 35).toFixed(0) };
	floorPlanDock.querySelector('[data-floor-dock-action="pan-up"]').onclick = () => panFloorPlan(0, -80);
	floorPlanDock.querySelector('[data-floor-dock-action="pan-down"]').onclick = () => panFloorPlan(0, 80);
	floorPlanDock.querySelector('[data-floor-dock-action="pan-left"]').onclick = () => panFloorPlan(-80, 0);
	floorPlanDock.querySelector('[data-floor-dock-action="pan-right"]').onclick = () => panFloorPlan(80, 0);
	el('floorRotateLeft').onclick = () => rotateFloorSelected(15);
	el('floorRotateRight').onclick = () => rotateFloorSelected(-15);
	el('floorRotate90').onclick = () => rotateFloorSelected(90);
	el('floorDelete').onclick = () => el('obDel').click();
	floorPlanDock.querySelector('[data-floor-dock-action="left"]').onclick = () => rotateFloorSelected(15);
	floorPlanDock.querySelector('[data-floor-dock-action="right"]').onclick = () => rotateFloorSelected(-15);
	floorPlanDock.querySelector('[data-floor-dock-action="90"]').onclick = () => rotateFloorSelected(90);
	floorPlanDock.querySelector('[data-floor-dock-action="assets"]').onclick = () => { const tray = el('assetTray'); if (!tray) return; tray.classList.add('floorAssetTray'); if (getComputedStyle(tray).display !== 'block') el('assetToggle')?.click(); requestAnimationFrame(syncFloorPlanDockLayout) };
	floorPlanDock.querySelector('[data-floor-dock-action="delete"]').onclick = () => el('obDel').click();
	const floorDockCollapse = floorPlanDock.querySelector('[data-floor-dock-action="collapse"]');
	floorPlanDock.classList.add('collapsed'); floorDockCollapse.textContent = '＋ 操作'; floorDockCollapse.title = '操作バーを開く';
	floorDockCollapse.onclick = () => { const collapsed = floorPlanDock.classList.toggle('collapsed'); floorDockCollapse.textContent = collapsed ? '＋ 操作' : '−'; floorDockCollapse.title = collapsed ? '操作バーを開く' : '操作バーを折りたたむ'; };
	// カメラ／回転ハンドルだけを先に受け取り、それ以外のドラッグは既存の家具移動へ渡す。
	function beginFloorPan(e, p, tapClear = false) {
		if (!Array.isArray(window.cityFloorPlanCenter)) fitFloorPlan();
		e.preventDefault(); e.stopImmediatePropagation(); floorPlanDrag = { kind: 'pan', pointerId: e.pointerId, p0: p, center0: [...(window.cityFloorPlanCenter || [0, 0])], tapClear, moved: false }; try { cv.setPointerCapture(e.pointerId) } catch (err) { };
	}
	function beginFloorBoxPending(e, p) {
		if (!Array.isArray(window.cityFloorPlanCenter)) fitFloorPlan();
		e.preventDefault(); e.stopImmediatePropagation(); floorPlanDrag = { kind: 'boxPending', pointerId: e.pointerId }; armBoxPending(p, e.pointerId, 'floor', { center0: [...(window.cityFloorPlanCenter || [0, 0])], tapClear: true }); try { cv.setPointerCapture(e.pointerId) } catch (err) { };
	}
	cv.addEventListener('contextmenu', e => { if (window.cityFloorPlanActive) e.preventDefault() }, true);
	cv.addEventListener('pointerdown', e => {
		if (!window.cityFloorPlanActive) return;
		if (floorTouchDown(e)) return;
		const p = pos(e), panGesture = e.button === 1 || e.button === 2 || e.altKey || floorPlanPanMode;
		if (panGesture && (orthView === 'top' || orthView === 'side')) { beginFloorPan(e, p); return; }
		const resize = floorPlanEditHandleAt(p);
		if (resize && (orthView === 'top' || orthView === 'side')) { e.preventDefault(); e.stopImmediatePropagation(); floorPlanDrag = { kind: 'resize', pointerId: e.pointerId, id: resize.g.o.id, o0: { ...resize.g.o, off: [...(resize.g.o.off || [0, 0, 0])] }, handle: resize.h, p0: p, started: false }; try { cv.setPointerCapture(e.pointerId) } catch (err) { } return }
		if (orthView !== 'top') {
			const hit = floorPlanItemAtSide(p);
			if (hit) { e.preventDefault(); e.stopImmediatePropagation(); setSelection(hit.id, e.shiftKey || e.metaKey || e.ctrlKey); syncSel(); render() }
			else if (e.shiftKey) beginFloorPan(e, p);
			else beginFloorBoxPending(e, p);
			return;
		}
		const h = floorPlanHandles(), lim = 22 / Z;
		if (h.object && Math.hypot(h.object.s.x - p.x, h.object.s.y - p.y) < lim) { e.preventDefault(); e.stopImmediatePropagation(); floorPlanDrag = { kind: 'turn', pointerId: e.pointerId, id: h.object.o.id, started: false }; try { cv.setPointerCapture(e.pointerId) } catch (err) { } return }
		if (h.camera && Math.hypot(h.camera.sTarget.x - p.x, h.camera.sTarget.y - p.y) < lim) { e.preventDefault(); e.stopImmediatePropagation(); floorPlanDrag = { kind: 'aim', pointerId: e.pointerId }; try { cv.setPointerCapture(e.pointerId) } catch (err) { } return }
		if (h.camera && Math.hypot(h.camera.sBody.x - p.x, h.camera.sBody.y - p.y) < lim) { const w = floorPlanWorldAt(p); if (!w) return; e.preventDefault(); e.stopImmediatePropagation(); floorPlanDrag = { kind: 'camera', pointerId: e.pointerId, dx: P.cx - w.x, dz: P.cz - w.z }; try { cv.setPointerCapture(e.pointerId) } catch (err) { } return }
		if (orthView === 'top' && h.camera && h.camera.sLens && Math.hypot(h.camera.sLens.x - p.x, h.camera.sLens.y - p.y) < lim) { e.preventDefault(); e.stopImmediatePropagation(); floorPlanDrag = { kind: 'lens', pointerId: e.pointerId, p0: p, lens0: Number(P.lens) || 35, started: false }; try { cv.setPointerCapture(e.pointerId) } catch (err) { } return }
		const w = floorPlanWorldAt(p), hit = floorPlanItemAt(w);
		if (!hit && e.shiftKey) { beginFloorPan(e, p); return; }
		e.preventDefault(); e.stopImmediatePropagation();
		if (hit) {
			const multi = e.shiftKey || e.metaKey || e.ctrlKey, wasSelected = selIds.has(hit.id);
			if (multi) setSelection(hit.id, true);
			else if (!wasSelected || selIds.size <= 1) setSelection(hit.id, false);
			if (!selIds.has(hit.id)) { floorPlanDrag = null; syncSel(); render(); return }
			const base = L2W(hit, 0, 0, 0), group = selectedObjects().filter(o => o.k === 1), snap = snapSetupGroup(group, base);
			// 選択済みオブジェクトをドラッグした場合は、選択中の地面オブジェクトを同じ量だけ動かす。
			floorPlanDrag = { kind: 'item', pointerId: e.pointerId, id: hit.id, o0: { ...hit, off: [...(hit.off || [0, 0, 0])] }, group, base0: base, bb: snap.bb, targets: snap.targets, tau: snap.tau, dx: base[0] - w.x, dz: base[2] - w.z, started: false };
			try { cv.setPointerCapture(e.pointerId) } catch (err) { } syncSel(); render()
		} else beginFloorBoxPending(e, p);
	}, true);
	cv.addEventListener('pointermove', e => {
		if (floorTouchMove(e)) { e.preventDefault(); e.stopImmediatePropagation(); return }
		const boxPendingState = updateBoxPending(pos(e), e.pointerId);
		if (boxSelect && boxSelect.pointerId === e.pointerId) { boxSelect.end = pos(e); e.preventDefault(); e.stopImmediatePropagation(); render(); return }
		if (boxPendingState === 'pending' || boxPendingState === 'cancel') { e.preventDefault(); e.stopImmediatePropagation(); return }
		if (!floorPlanDrag || e.pointerId !== floorPlanDrag.pointerId) return;
		e.preventDefault(); e.stopImmediatePropagation();
		if (floorPlanDrag.kind === 'pan') {
			const p = pos(e), sc = Math.max(1, Number(orthScale()) || 1), dx = p.x - floorPlanDrag.p0.x, dy = p.y - floorPlanDrag.p0.y;
			if (Math.hypot(dx, dy) > 2) floorPlanDrag.moved = true;
			window.cityFloorPlanCenter = [floorPlanDrag.center0[0] - dx / sc, floorPlanDrag.center0[1] + dy / sc]; render(); return;
		}
		if (floorPlanDrag.kind === 'resize') {
			const o = floorPlanDrag.o0, h = floorPlanDrag.handle, p = pos(e), amount = ((p.x - floorPlanDrag.p0.x) * h.dir.x + (p.y - floorPlanDrag.p0.y) * h.dir.y) / (h.scale || 1), value = clamp(h.start + amount, h.min, 20); snapHit = null;
			const patch = floorResizeSnap(o, floorDimensionPatch(o, h.kind, value, h.side || 1), h, value);
			if (patch) { if (!floorPlanDrag.started) { HU.push(S); RD = []; floorPlanDrag.started = true } setOb(o.id, patch) }
			render(); return;
		}
		if (floorPlanDrag.kind === 'lens') {
			const w = floorPlanWorldAt(pos(e)); if (w) { const yaw = Number(P.yaw || 0) * DG, dx = w.x - P.cx, dz = w.z - P.cz, len = Math.hypot(dx, dz); if (len > .05) { const forwardX = -Math.sin(yaw), forwardZ = Math.cos(yaw), dot = forwardX * dx + forwardZ * dz, cross = forwardX * dz - forwardZ * dx, half = Math.max(.02, Math.min(1.45, Math.abs(Math.atan2(cross, dot)))), lens = clamp(18 / Math.tan(half), 14, 200); P.lens = +lens.toFixed(1); sync() } }
			render(); return;
		}
		const w = floorPlanWorldAt(pos(e)); if (!w) return;
		if (floorPlanDrag.kind === 'turn') {
			const o = obOf(floorPlanDrag.id); if (o && o.k === 1) { let a = Math.atan2(w.x - L2W(o, 0, 0, 0)[0], w.z - L2W(o, 0, 0, 0)[2]) / DG; if (!e.shiftKey) a = Math.round(a / 15) * 15; if (!floorPlanDrag.started) { HU.push(S); RD = []; floorPlanDrag.started = true } setOb(o.id, { rot: angle360(a) }) }
		} else if (floorPlanDrag.kind === 'item') {
			const o = floorPlanDrag.o0;
			if (o && o.k === 1) {
				if (!floorPlanDrag.started) { HU.push(S); RD = []; floorPlanDrag.started = true }
				/* 家具本体の間取り移動はX/Zだけ。磁石ONなら選択全体の外周を他オブジェクトへ吸着する。 */
				const delta = [w.x + floorPlanDrag.dx - floorPlanDrag.base0[0], 0, w.z + floorPlanDrag.dz - floorPlanDrag.base0[2]];
				const q = $('snp')?.checked ? snapShift(floorPlanDrag.bb, delta, [0, 2], floorPlanDrag.targets, floorPlanDrag.tau) : { d: delta, hit: new Set() };
				snapHit = q.hit.size ? q.hit : null;
				(floorPlanDrag.group || [o]).forEach(g => setOb(g.id, { ca: g.ca + q.d[0], cb: g.cb + q.d[2] }));
			}
		} else if (floorPlanDrag.kind === 'camera') {
			P.cx = +(w.x + floorPlanDrag.dx).toFixed(3); P.cz = +(w.z + floorPlanDrag.dz).toFixed(3); sync();
		} else if (floorPlanDrag.kind === 'aim') {
			// 3Dカメラの前方は[-sin(yaw), 0, cos(yaw)]なので、先端をその向きへ合わせる。
			P.yaw = +((Math.atan2(-(w.x - P.cx), w.z - P.cz) / DG + 540) % 360 - 180).toFixed(2); sync();
		}
		render();
	}, true);
	cv.addEventListener('pointerup', e => {
		const tracked = floorTouchUp(e);
		if (boxSelect && boxSelect.pointerId === e.pointerId) { e.preventDefault(); e.stopImmediatePropagation(); finishBoxSelection(boxPoint(e)); floorPlanDrag = null; return }
		if (boxPending && boxPending.pointerId === e.pointerId) { const pending = cancelBoxPending(); e.preventDefault(); e.stopImmediatePropagation(); floorPlanDrag = null; if (pending?.tapClear) setSelection(null, false); render(); return }
		if (tracked) { e.preventDefault(); e.stopImmediatePropagation(); if (!floorPlanDrag || e.pointerId !== floorPlanDrag.pointerId) return }
		if (!floorPlanDrag || e.pointerId !== floorPlanDrag.pointerId) return; e.preventDefault(); e.stopImmediatePropagation(); const tapClear = floorPlanDrag.kind === 'pan' && floorPlanDrag.tapClear && !floorPlanDrag.moved; floorPlanDrag = null; snapHit = null; if (tapClear) setSelection(null, false); render();
	}, true);
	cv.addEventListener('pointercancel', e => {
		const tracked = floorTouchUp(e);
		if (boxSelect && boxSelect.pointerId === e.pointerId) { e.preventDefault(); e.stopImmediatePropagation(); boxSelect = null; floorPlanDrag = null; cancelBoxPending(); render(); return }
		if (boxPending && boxPending.pointerId === e.pointerId) { cancelBoxPending(); e.preventDefault(); e.stopImmediatePropagation(); floorPlanDrag = null; render(); return }
		if (tracked) { e.preventDefault(); e.stopImmediatePropagation(); if (!floorPlanDrag || e.pointerId !== floorPlanDrag.pointerId) return }
		if (!floorPlanDrag || e.pointerId !== floorPlanDrag.pointerId) return; e.preventDefault(); e.stopImmediatePropagation(); floorPlanDrag = null; snapHit = null; render();
	}, true);
	addEventListener('keydown', e => {
		if (!window.cityFloorPlanActive || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
		if (e.code === 'Space') { e.preventDefault(); floorPlanPanMode = true; return }
		if (e.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
			e.preventDefault(); const panStep = 80; if (e.key === 'ArrowLeft') panFloorPlan(-panStep, 0); else if (e.key === 'ArrowRight') panFloorPlan(panStep, 0); else if (e.key === 'ArrowUp') panFloorPlan(0, -panStep); else panFloorPlan(0, panStep); return;
		}
		const panKey = e.key.toLowerCase(); if (['w', 'a', 's', 'd'].includes(panKey)) {
			e.preventDefault(); const panStep = 80; if (panKey === 'a') panFloorPlan(-panStep, 0); else if (panKey === 'd') panFloorPlan(panStep, 0); else if (panKey === 'w') panFloorPlan(0, -panStep); else panFloorPlan(0, panStep); return;
		}
		const step = e.shiftKey ? .5 : .1;
		if (e.key === 'ArrowLeft') { e.preventDefault(); moveFloorSelected(-step, 0) }
		else if (e.key === 'ArrowRight') { e.preventDefault(); moveFloorSelected(step, 0) }
		else if (e.key === 'ArrowUp') { e.preventDefault(); moveFloorSelected(0, -step) }
		else if (e.key === 'ArrowDown') { e.preventDefault(); moveFloorSelected(0, step) }
		else if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); rotateFloorSelected(15) }
		else if (e.key === 'e' || e.key === 'E') { e.preventDefault(); rotateFloorSelected(-15) }
		else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); if (floorPlanObject()) el('obDel').click() }
	});
	addEventListener('keyup', e => { if (e.code === 'Space') floorPlanPanMode = false });
	addEventListener('blur', () => floorPlanPanMode = false);

	// ===== Camera / scale presets =====
	function setValues(values) { Object.entries(values).forEach(([k, v]) => { if (k in P) setP(k, v) }); sync(); render() }
	function preset(name) {
		const gt = el('gt');
		if (name === 'alley') {
			gt.value = '2'; applyType(2); setValues({ lens: 38, yaw: 39.912, hz: 50, pitch: 0, ch: 1.62, cx: 0, cz: 0 }); el('bgw').checked = true; el('pc').value = '#222222';
		} else if (name === 'top') {
			// 添付された街並みのような、地面を広く見渡す見下ろし視点。
			gt.value = '2'; applyType(2); setValues({ lens: 35, yaw: 39.912, hz: 52, pitch: -57, ch: 4.2, cx: 0, cz: 0 }); el('bgw').checked = true; el('pc').value = '#222222';
		} else if (name === 'three') {
			gt.value = '3'; applyType(3); setValues({ lens: 42, yaw: 39.912, hz: 52, pitch: 27, ch: 2.3, cx: 0, cz: 0 }); el('bgw').checked = true; el('pc').value = '#222222';
		} else {
			gt.value = '1'; applyType(1); setValues({ lens: 45, yaw: 0, hz: 50, pitch: 0, ch: 1.6, cx: 0, cz: 0 }); el('bgw').checked = true; el('pc').value = '#222222';
		}
		render();
	}

	// ===== User camera / settings presets =====
	const STUDIO_PRESET_KEY = 'city-grid-studio-presets-v1';
	const studioPresetNameInput = el('studioPresetName'), studioPresetSelect = el('studioPresetSelect');
	const presetCheckIds = ['gon', 'hzl', 'bgw', 'bin', 'zf', 'gg', 'p3', 'snp'];
	function readStudioPresets() { try { const a = JSON.parse(localStorage.getItem(STUDIO_PRESET_KEY) || '[]'); return Array.isArray(a) ? a : [] } catch (e) { return [] } }
	function writeStudioPresets(a) { try { localStorage.setItem(STUDIO_PRESET_KEY, JSON.stringify(a)); return true } catch (e) { return false } }
	function captureStudioPreset(name) {
		const checks = {}; presetCheckIds.forEach(id => { const n = el(id); if (n) checks[id] = !!n.checked });
		return {
			name: name || '名称未設定', version: 1, P: { ...P }, gt: el('gt').value, orthView: orthView || null, mode, tool, ar: el('ar').value, show: [...show], checks, snap: el('snap').value, pc: el('pc').value,
			floorActive: !!window.cityFloorPlanActive, floorCenter: Array.isArray(window.cityFloorPlanCenter) ? [...window.cityFloorPlanCenter] : null, floorScale: Number(window.cityFloorPlanScale) || null
		};
	}
	function refreshStudioPresetList(selected = '') {
		if (!studioPresetSelect) return; const list = readStudioPresets(); studioPresetSelect.textContent = '';
		if (!list.length) { const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'まだありません'; studioPresetSelect.appendChild(empty) }
		else list.forEach(p => { const option = document.createElement('option'); option.value = String(p.name); option.textContent = String(p.name); studioPresetSelect.appendChild(option) });
		if (selected && list.some(p => p.name === selected)) studioPresetSelect.value = selected;
	}
	function applyStudioPreset(d) {
		if (!d) return;
		if (window.cityFloorPlanActive) window.cityFloorPlanExit?.(true);
		if (d.ar != null) { el('ar').value = d.ar; el('ar').onchange() }
		if (d.gt != null) { el('gt').value = d.gt; applyType(d.gt) }
		if (d.P) Object.keys(d.P).forEach(k => { if (k in P && d.P[k] != null) setP(k, d.P[k]) });
		if (Array.isArray(d.show)) d.show.forEach((v, i) => { if (i < show.length) { show[i] = !!v; const n = document.querySelector('[data-i="' + i + '"]'); if (n) n.checked = !!v } });
		if (d.checks) Object.entries(d.checks).forEach(([id, v]) => { const n = el(id); if (n) n.checked = !!v });
		if (d.snap != null) el('snap').value = d.snap; if (d.pc != null) el('pc').value = d.pc;
		orthView = d.orthView || null;
		sync();
		if (d.floorActive) {
			window.cityFloorPlanEnter?.(orthView === 'side' ? 'side' : 'top');
			if (Array.isArray(d.floorCenter)) window.cityFloorPlanCenter = [...d.floorCenter];
			if (Number.isFinite(d.floorScale)) window.cityFloorPlanScale = d.floorScale;
			render();
		} else { setMode(d.mode === 'draw' ? 'draw' : 'view'); render() }
	}
	el('studioPresetSave').onclick = () => {
		const name = (studioPresetNameInput.value || '').trim() || `プリセット ${readStudioPresets().length + 1}`;
		const list = readStudioPresets().filter(p => p.name !== name); list.push(captureStudioPreset(name));
		if (writeStudioPresets(list)) { studioPresetNameInput.value = name; refreshStudioPresetList(name) }
	};
	el('studioPresetLoad').onclick = () => { const name = studioPresetSelect.value, p = readStudioPresets().find(q => q.name === name); if (p) applyStudioPreset(p) };
	el('studioPresetDelete').onclick = () => { const name = studioPresetSelect.value; if (!name) return; const list = readStudioPresets().filter(p => p.name !== name); if (writeStudioPresets(list)) refreshStudioPresetList() };
	studioPresetSelect.onchange = () => { const p = readStudioPresets().find(q => q.name === studioPresetSelect.value); if (p) studioPresetNameInput.value = p.name };
	refreshStudioPresetList();

	// ===== Common lens buttons =====
	quick.querySelectorAll('[data-lens-preset]').forEach(b => b.onclick = () => { setP('lens', Number(b.dataset.lensPreset)); sync(); render() });
	quick.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => preset(b.dataset.preset));
	el('applyHuman').onclick = () => {
		const h = Math.max(.5, Math.min(10, parseFloat(humanInput.value) || 1.7)); P.hm = h; humanInput.value = h.toFixed(2);
		const people = sceneObjects().filter(o => o.type === 'asset' && o.asset === 'person');
		if (people.length) { HU.push(S); RD = []; people.forEach(o => { const body = Number(o.bodyScale) || 1, shoulder = Number(o.shoulderScale) || 1; setOb(o.id, { h, ra: h * .135 * body * shoulder, rb: h * .088 * body }) }); }
		render();
	};
	humanInput.onchange = () => { P.hm = Math.max(.5, Math.min(10, parseFloat(humanInput.value) || 1.7)); humanInput.value = P.hm.toFixed(2) };
	el('eyeHeight').onclick = () => { P.ch = Math.max(.3, P.hm * .93); sync(); render() };
	el('applyStairs').onclick = () => {
		const o = sel && obOf(sel); if (!o || o.type !== 'asset' || o.asset !== 'stairs') { alert('先に編集モードで階段を選択してください'); return }
		const steps = Math.max(2, Math.min(24, Math.round(Number(el('stairsSteps').value) || 6))), handrail = !!el('stairsRail').checked;
		HU.push(S); RD = []; setOb(o.id, { steps, handrail }); render();
	};

	// Reference image convenience. The supplied image is copied beside this HTML as reference-cyberpunk.jpg.
	el('sampleRef').onclick = () => { const im = new Image(); im.onload = () => { IMG = im; IMGsrc = null; render() }; im.onerror = () => alert('reference-cyberpunk.jpg が見つかりません。左の「参考写真」から画像を選んでください。'); im.src = 'reference-cyberpunk.jpg' };
	el('clearRef').onclick = () => el('phx').click();

	// ===== Compact export / help UI =====
	el('exportToggle').onclick = e => { e.stopPropagation(); setExportOpen(!el('exportMenu').classList.contains('open')); el('helpPanel')?.style.setProperty('display', 'none') };
	document.addEventListener('pointerdown', e => { if (!e.target.closest('#exportMenu') && !e.target.closest('#exportToggle')) setExportOpen(false) });
	const help = document.createElement('div'); help.id = 'helpPanel'; help.innerHTML = '<div class="helpTitle">操作のコツ</div><div><span class="helpKey">Pencil</span>線を引く　<span class="helpKey">指</span>視点・ピンチ</div><div><span class="helpKey">⌘ Z</span>元に戻す　<span class="helpKey">E</span>消しゴム</div><div><span class="helpKey">図形</span>ドラッグで床・壁に配置</div><div><span class="helpKey">編集</span>線を選択 → 矢印移動／白い四角で拡縮／輪で回転</div><div style="margin-top:7px;color:#7f999c">アセットを追加したあと、編集モードでBlender風ギズモを使えます。人物は基準身長から作られます。</div>';
	el('main').appendChild(help);
	el('helpToggle').onclick = () => { help.style.display = help.style.display === 'block' ? 'none' : 'block'; setExportOpen(false) };

	// A first-run cyberpunk treatment; the controls remain fully editable in the sidebar.
	let v2Seen = false, hasAuto = false, sidePref = '';
	try { v2Seen = !!localStorage.getItem('city-grid-v2-seen'); hasAuto = !!localStorage.getItem('pgrid-autosave-v1'); sidePref = localStorage.getItem('pgrid-side') || '' } catch (e) { }
	if (!v2Seen && !hasAuto) {
		el('bgw').checked = true; el('pc').value = '#222222'; P.ch = 1.62; el('ch').value = P.ch;
		try { localStorage.setItem('city-grid-v2-seen', '1') } catch (e) { }
	}
	// Existing sessions may already have the dark first-run flag. Migrate once to the white drawing background.
	let whiteMigrated = false; try { whiteMigrated = !!localStorage.getItem('city-grid-v3-white') } catch (e) { }
	if (!whiteMigrated) { el('bgw').checked = true; el('pc').value = '#222222'; try { localStorage.setItem('city-grid-v3-white', '1') } catch (e) { } }
	// 旧版の初期値2.5pxを、今回の標準1.5pxへ一度だけ移行する。
	let lineWidthMigrated = false; try { lineWidthMigrated = !!localStorage.getItem('city-grid-v6-line-width') } catch (e) { }
	if (!lineWidthMigrated) { if (Math.abs(Number(P.pw) - 2.5) < 1e-6) P.pw = MASTER_W; const pwEl = el('pw'); if (pwEl) pwEl.value = P.pw; sync(); try { localStorage.setItem('city-grid-v6-line-width', '1') } catch (e) { } }
	homeView = captureHomeView();
	if (innerWidth <= 900 && !sidePref) setSide(true);
	updateOutliner(); render();
})();
