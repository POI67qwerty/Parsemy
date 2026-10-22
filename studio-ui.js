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
      <div class="sceneNote">カメラ・グリッド・補助線・ペン・消しゴム・画面比率など、オブジェクト以外の設定を保存します。シーン内容は含みません。</div>
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

    <div class="quickHint">1 設定　2 視点　3 描画　4 編集　5 アセット　7 前　8 横　9 上　0 3D　／　詳細操作は「？」</div>
    <div class="sceneTitle">シーン内オブジェクト</div>
    <div class="sceneTools"><button id="sceneSelectAll">全選択</button><button id="sceneClearSel">選択解除</button><button id="sceneDeleteSel" class="danger">選択中を削除</button><button id="sceneGroupSel">グループ化</button><button id="sceneUngroupSel">グループ解除</button><button id="sceneCombineSel">結合</button><button id="sceneSeparateSel">結合解除</button></div>
    <div class="alignTools"><select id="alignAxis"><option value=0>X軸（左右）</option><option value=1>Y軸（高さ）</option><option value=2>Z軸（奥行き）</option></select><select id="alignMode"><option value=middle>中央に整列</option><option value=min>最小側に整列</option><option value=max>最大側に整列</option></select><button id="alignApply">整列</button></div>
    <div class="sceneNote">行のチェックで複数選択。整列は2個以上を選んでください。グループ化は後から解除できます。結合は複数の定義を一つの複合オブジェクトにまとめ、結合解除まで一体として扱います。</div>
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
		person: { label: '人物', glyph: '♙', w: .46, d: .30, h: 1.70, accent: '#ad9cff' },
		stairs: { label: '階段', glyph: '▰', w: 1.45, d: 2.4, h: .78, accent: '#ffb36f' },
		crosswalk: { label: '横断歩道', glyph: '▥', w: 3.2, d: 4.2, h: .02, accent: '#668cff' }
	};
	const assetLabel = o => o.type === 'compound' ? '結合オブジェクト' : o.type === 'asset' ? (ASSETS[o.asset]?.label || (o.asset === 'cylinder' ? '円柱' : 'アセット')) : (o.type === 'rect' ? '長方形' : o.type === 'circ' ? '円' : o.type === 'box' ? '箱' : o.type === 'cyl' ? '円柱' : '図形');
	const assetGlyph = o => o.type === 'compound' ? '◆' : o.type === 'asset' ? (ASSETS[o.asset]?.glyph || (o.asset === 'cylinder' ? '◉' : '◆')) : (o.type === 'rect' ? '□' : o.type === 'circ' ? '○' : '◇');

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
	function assetLines(o) {
		const kind = o.asset, w = o.ra * 2, d = o.rb * 2, h = o.h, c = o.c || '#222222', a = c, out = []; // アセットも線画と同じ色で描く
		if (kind === 'stairs') {
			const n = Math.max(2, Math.min(24, Math.round(o.steps || 6))), sd = d / n, sh = h / n;
			// 段板・蹴上げ・左右側面の輪郭を、実際の階段断面に沿って描く。
			for (let i = 0; i < n; i++) {
				const y0 = -d / 2 + i * sd, y1 = y0 + sd, z = (i + 1) * sh, z0 = i * sh;
				out.push(polyA(o, [[-w / 2, y0, z], [w / 2, y0, z], [w / 2, y1, z], [-w / 2, y1, z]], c));
				out.push(lineA(o, [[-w / 2, y0, z0], [-w / 2, y0, z], [w / 2, y0, z]], a, .9));
				out.push(lineA(o, [[w / 2, y0, z0], [w / 2, y0, z]], a, .9));
				out.push(lineA(o, [[-w / 2, y0, z], [-w / 2, y1, z]], a, .9));
				out.push(lineA(o, [[w / 2, y0, z], [w / 2, y1, z]], a, .9));
			}
			out.push(polyA(o, [[-w / 2, -d / 2, 0], [w / 2, -d / 2, 0], [w / 2, d / 2, 0], [-w / 2, d / 2, 0]], a, .9));
			out.push(lineA(o, [[-w / 2, d / 2, 0], [w / 2, d / 2, 0], [w / 2, d / 2, h], [-w / 2, d / 2, h], [-w / 2, d / 2, 0]], a, 1.1));
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
			// 看板外側は通常の直方体。内側の絵枠だけを追加編集できる。
			const board0 = .08 * h, board1 = .82 * h, fy = signFaceDepth(o, .009);
			const faceW = Math.max(.08, Math.min(Number(o.faceW) || w * .70, w * .90));
			const faceH = Math.max(.08, Math.min(Number(o.faceH) || h * .34, (board1 - board0) * .84));
			out.push(...boxA(o, w, d, board0, board1, c));
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
		return { ...base, type: 'asset', asset: kind, ra: info.w / 2, rb: info.d / 2, h: height, pose: kind === 'person' ? 'stand' : undefined, bodyScale: kind === 'person' ? 1 : undefined, shoulderScale: kind === 'person' ? 1 : undefined, headScale: kind === 'person' ? 1 : undefined, legSpread: kind === 'person' ? 1 : undefined, faceW: kind === 'sign' ? info.w * .70 : undefined, faceH: kind === 'sign' ? info.h * .34 : undefined, steps: kind === 'stairs' ? Math.round(Number(el('stairsSteps')?.value) || 6) : undefined, handrail: kind === 'stairs' ? !!el('stairsRail')?.checked : undefined, stripes: kind === 'crosswalk' ? 7 : undefined };
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
			const lines = [], groupMap = new Map();
			objectClipboard.forEach((source, i) => {
				const n = JSON.parse(JSON.stringify(source)); n.id = uid(); n.off = [...(n.off || [0, 0, 0])];
				if (source.groupId) { if (!groupMap.has(source.groupId)) groupMap.set(source.groupId, 'group-' + uid()); n.groupId = groupMap.get(source.groupId) }
				// 元の場所を保ちつつ、貼り付け先が見つけやすいようにca方向へ少しずらす。
				const shift = Math.max(.35, Math.abs(Number(n.ra) || .25) * 2.4) + i * .18;
				if (n.type === 'compound') Object.assign(n, moveBy(n, [shift, 0, 0])); else { n.ca = Number(n.ca) || 0; n.ca += shift }
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
	// 選択中オブジェクトを、後から線画化できるテキストJSONとして取り出す。
	// 線そのものではなく定義を保存するので、寸法・向き・ポーズ・アセット固有値を保てる。
	const objectInfoCopyButton = el('objectInfoCopy'), objectInfoSaveButton = el('objectInfoSave');
	function objectInfoPayload() {
		const objects = selectedObjects().map(o => { const q = JSON.parse(JSON.stringify(o)); delete q.surface; delete q.surfaceColor; delete q.surfaceAlpha; if (q.asset === 'sign') delete q.bevel; return q });
		return { format: 'city-grid-studio-object-v1', coordinateSystem: { local: 'x=幅／左右, y=奥行／前後, z=高さ／上', planeAxis: 'k=0:X面, k=1:Y面(地面), k=2:Z面', rotation: 'rotは度', halfSize: 'ra/rbは幅・奥行の半分' }, renderMode: { surface: !!P.surfaceMode, backfaceRemoval: !!P.surfaceMode }, objects };
	}
	function objectInfoText() { return JSON.stringify(objectInfoPayload(), null, 2) }
	function writeTextToClipboard(text) {
		if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
		const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy') } finally { ta.remove() } return Promise.resolve();
	}
	function flashObjectInfoButton(button, label) { if (!button) return; const before = button.textContent; button.textContent = label; setTimeout(() => button.textContent = before, 900) }
	function syncObjectInfoActions() {
		const disabled = !selectedObjects().length;
		if (objectInfoCopyButton) objectInfoCopyButton.disabled = disabled;
		if (objectInfoSaveButton) objectInfoSaveButton.disabled = disabled;
		const sceneDeleteButton = el('sceneDeleteButton'); if (sceneDeleteButton) sceneDeleteButton.disabled = disabled;
	}
	if (objectInfoCopyButton) objectInfoCopyButton.onclick = () => { if (!selectedObjects().length) return; writeTextToClipboard(objectInfoText()).then(() => flashObjectInfoButton(objectInfoCopyButton, 'コピー済み')).catch(() => alert('オブジェクト情報をコピーできませんでした')) };
	if (objectInfoSaveButton) objectInfoSaveButton.onclick = () => { if (!selectedObjects().length) return; const a = document.createElement('a'), url = URL.createObjectURL(new Blob([objectInfoText()], { type: 'application/json' })); a.href = url; a.download = 'city-grid-object.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); flashObjectInfoButton(objectInfoSaveButton, '保存済み') };
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

	// ===== Scene outliner / object groups =====
	const list = el('objectList');
	function sceneObjects() { const a = [], seen = new Set(); S.forEach(s => { if (s.ob && !seen.has(s.ob.id)) { seen.add(s.ob.id); a.push(s.ob) } }); return a }
	function rewriteObjectDefs(ids, change) {
		const wanted = new Set(ids);
		S = S.map(s => {
			if (!s?.ob || !wanted.has(s.ob.id)) return s;
			const ob = { ...s.ob, ...change };
			return { ...s, ob };
		});
	}
	function groupSelectedScene() {
		const objects = selectedObjects(); if (objects.length < 2) { alert('グループ化するオブジェクトを2個以上選択してください'); return }
		const groupId = 'group-' + uid(); HU.push(S); RD = []; rewriteObjectDefs(objects.map(o => o.id), { groupId }); normalizeSelection(); render();
	}
	function ungroupSelectedScene() {
		const objects = selectedObjects().filter(o => o.groupId); if (!objects.length) return;
		HU.push(S); RD = []; const wanted = new Set(objects.map(o => o.id));
		S = S.map(s => { if (!s?.ob || !wanted.has(s.ob.id)) return s; const ob = { ...s.ob }; delete ob.groupId; return { ...s, ob } });
		normalizeSelection(); render();
	}
	function combineSelectedScene() {
		const objects = selectedObjects(); if (objects.length < 2) { alert('結合するオブジェクトを2個以上選択してください'); return }
		const parts = [];
		objects.forEach(o => {
			const sources = o.type === 'compound' ? compoundPartsAt(o) : [o];
			sources.forEach(source => { const q = JSON.parse(JSON.stringify(source)); q.id = uid(); delete q.groupId; parts.push(q) });
		});
		if (parts.length < 2) { alert('結合するパーツがありません'); return }
		const b = groupBounds(parts), lead = objects.find(o => o.id === sel) || objects[0], compound = { id: uid(), type: 'compound', parts, tx: 0, ty: 0, tz: 0, k: 1, d: -1, ca: (b.lo[0] + b.hi[0]) / 2, cb: (b.lo[2] + b.hi[2]) / 2, ra: Math.max(.005, (b.hi[0] - b.lo[0]) / 2), rb: Math.max(.005, (b.hi[2] - b.lo[2]) / 2), h: Math.max(.005, b.hi[1] - b.lo[1]), rot: 0, compoundRot: 0, lift: 0, off: [0, 0, 0], c: lead.c || '#222222', w: lead.w || MASTER_W, accent: lead.accent || '#66e3c8', surfaceColor: lead.surfaceColor, surfaceAlpha: lead.surfaceAlpha };
		const lines = genShape(compound); if (!lines.length || lines.some(s => !validStroke(s))) { alert('結合できない形状が含まれています'); return }
		const wanted = new Set(objects.map(o => o.id)); HU.push(S); RD = []; S = [...S.filter(s => !(s.ob && wanted.has(s.ob.id))), ...lines]; clearSelection(); setSelection(compound.id, false); render();
	}
	function separateSelectedScene() {
		const objects = selectedObjects().filter(o => o.type === 'compound'); if (!objects.length) return;
		const wanted = new Set(objects.map(o => o.id)), parts = [];
		objects.forEach(o => compoundPartsAt(o).forEach(source => { const q = JSON.parse(JSON.stringify(source)); q.id = uid(); delete q.groupId; parts.push(q) }));
		const lines = parts.flatMap(part => genShape(part)); HU.push(S); RD = []; S = [...S.filter(s => !(s.ob && wanted.has(s.ob.id))), ...lines]; clearSelection(); parts.forEach(part => selIds.add(part.id)); sel = parts[0]?.id || null; normalizeSelection(); render();
	}
	function syncGroupActions() {
		const group = el('sceneGroupSel'), ungroup = el('sceneUngroupSel'), combine = el('sceneCombineSel'), separate = el('sceneSeparateSel'), objects = selectedObjects(), units = new Set(objects.map(o => o.groupId || o.id));
		if (group) group.disabled = units.size < 2;
		if (ungroup) ungroup.disabled = !objects.some(o => o.groupId);
		if (combine) combine.disabled = objects.length < 2;
		if (separate) separate.disabled = !objects.some(o => o.type === 'compound');
	}
	function updateOutliner() {
		if (!list) return; normalizeSelection(); const objects = sceneObjects();
		list.innerHTML = objects.length ? objects.map((o, i) => { const group = o.type === 'compound' ? `<span class="compoundMark">結合</span>` : o.groupId ? `<span class="groupMark">グループ</span>` : ''; const detail = o.type === 'compound' ? `${Array.isArray(o.parts) ? o.parts.length : 0}パーツ・複合オブジェクト` : o.type === 'asset' && o.asset === 'person' ? Number(o.h).toFixed(2) + ' m' : (o.type === 'asset' ? 'low-poly asset' : 'vector shape'); return `<div class="objectRow ${selIds.has(o.id) ? 'selected' : ''}" data-object="${o.id}"><input class="objectCheck" type="checkbox" data-object-check="${o.id}" ${selIds.has(o.id) ? 'checked' : ''} aria-label="${assetLabel(o)}を選択"><span class="objectIcon">${assetGlyph(o)}</span><span class="objectMeta">${assetLabel(o)} ${i + 1} ${group}<small>${detail}</small></span></div>` }).join('') : '<div class="emptyList">まだオブジェクトがありません</div>';
		syncGroupActions();
	}
	function deleteSelectedScene() {
		const ids = new Set(selectedObjects().map(o => o.id)); if (!ids.size) return;
		HU.push(S); S = S.filter(s => !(s.ob && ids.has(s.ob.id))); RD = []; clearSelection(); render();
	}
	function alignSelectedScene() {
		const objects = selectedObjects(), units = [], unitMap = new Map();
		objects.forEach(o => { const key = o.groupId || o.id; if (!unitMap.has(key)) { const unit = { objects: [], b: null }; unitMap.set(key, unit); units.push(unit) } unitMap.get(key).objects.push(o) });
		units.forEach(unit => unit.b = groupBounds(unit.objects));
		if (units.length < 2) { alert('整列するオブジェクトを2個以上選択してください'); return }
		const axis = +$('alignAxis').value, kind = $('alignMode').value;
		const target = kind === 'min' ? Math.min(...units.map(x => x.b.lo[axis])) : kind === 'max' ? Math.max(...units.map(x => x.b.hi[axis])) : (Math.min(...units.map(x => x.b.lo[axis])) + Math.max(...units.map(x => x.b.hi[axis]))) / 2;
		HU.push(S); RD = [];
		units.forEach(({ objects, b }) => { const current = kind === 'min' ? b.lo[axis] : kind === 'max' ? b.hi[axis] : (b.lo[axis] + b.hi[axis]) / 2, delta = [0, 0, 0]; delta[axis] = target - current; if (Math.abs(delta[axis]) > 1e-7) objects.forEach(o => setOb(o.id, moveBy(o, delta))) });
		render();
	}
	list.addEventListener('click', e => {
		const b = e.target.closest('[data-object]'); if (!b) return; const id = b.dataset.object, chosen = obOf(id);
		if (chosen && chosen.type === 'asset' && chosen.asset === 'person') setStudioWorkspace('character');
		if (e.target.matches('[data-object-check]')) {
			if (e.target.checked) setSelection(id, true);
			else { groupMemberIds(id).forEach(member => selIds.delete(member)); if (sel === id) sel = [...selIds].pop() || null; normalizeSelection() }
			tool = 'edit'; setMode('draw'); syncSel(); render(); return;
		}
		setSelection(id, e.shiftKey || e.metaKey || e.ctrlKey); tool = 'edit'; setMode('draw'); syncSel(); render();
	});
	el('sceneSelectAll').onclick = () => { selIds.clear(); sceneObjects().forEach(o => selIds.add(o.id)); sel = [...selIds].pop() || null; normalizeSelection(); tool = 'edit'; setMode('draw'); syncSel(); render() };
	el('sceneClearSel').onclick = () => { clearSelection(); render() };
	el('sceneDeleteSel').onclick = deleteSelectedScene;
	el('sceneDeleteButton').onclick = deleteSelectedScene;
	el('sceneGroupSel').onclick = groupSelectedScene;
	el('sceneUngroupSel').onclick = ungroupSelectedScene;
	el('sceneCombineSel').onclick = combineSelectedScene;
	el('sceneSeparateSel').onclick = separateSelectedScene;
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
		const vals = { faceW: o.faceW ?? (2 * o.ra * .7), faceH: o.faceH ?? (o.h * .34) };
		[['ov_faceW', vals.faceW], ['ov_faceH', vals.faceH]].forEach(([id, v]) => { const n = el(id); if (n && document.activeElement !== n) n.value = Number(v).toFixed(3) });
	}
	function applySignProp(name, v) {
		const o = sel && obOf(sel); if (!o || o.type !== 'asset' || o.asset !== 'sign' || !Number.isFinite(v)) return;
		if (!signEditSession) { HU.push(S); RD = []; signEditSession = true }
		const w = 2 * o.ra, h = o.h, boardH = h * .74, max = name === 'faceW' ? w * .90 : boardH * .84;
		const patch = {}; patch[name] = clamp(v, .08, max); setOb(sel, patch); render();
	}
	[['ov_faceW', 'faceW'], ['ov_faceH', 'faceH']].forEach(([id, name]) => { const n = el(id); if (!n) return; n.oninput = () => applySignProp(name, parseFloat(n.value)); n.onchange = () => { signEditSession = false } });
	function syncAssetControls() {
		const o = sel && obOf(sel);
		if (o && o.type === 'asset' && o.asset === 'stairs') {
			if (document.activeElement !== el('stairsSteps')) el('stairsSteps').value = o.steps || 6;
			el('stairsRail').checked = o.handrail === true;
		}
	}
	// Wrap render so the outliner follows undo/redo, opening files, and camera changes.
	const originalRender = render;
	render = function () { sanitizeScene(); originalRender(); updateOutliner(); syncAssetControls(); syncSignPanel(); syncFloorControls(); syncAssetDepth(); syncAssetAxis(); syncPersonControls(); syncObjectInfoActions(); syncFloorPlanSelection?.() };

	// ===== 標準ビューと間取りショートカット（8=間取り横 / 9=間取り真上 / 0=元の視点） =====
	// 標準ビューだけは透視ではなく正投影にし、真横90°・真上90°を正確に扱う。
	const viewKeys = ['lens', 'yaw', 'hz', 'pitch', 'fov', 'roll', 'ch', 'cx', 'cz'];
	const captureHomeView = () => { const v = { gt: el('gt').value, T, orthView }; viewKeys.forEach(k => v[k] = P[k]); return v };
	let homeView = null;
	function applyStandardView(kind) {
		standardApplying = true;
		if (kind === 'home' && homeView) {
			// 0 3Dへ戻るだけでは、現在選択中のグリッド種類を復元値で上書きしない。
			// homeViewには古いセッションの値が残る場合があるため、gt／Tは現在値を維持する。
			orthView = homeView.orthView || null; viewKeys.forEach(k => { if (k in P) setP(k, homeView[k]) });
		} else {
			// 視点プリセットを切り替えても、ユーザーが選んだグリッド種類は変更しない。
			const keep = { lens: P.lens, hz: P.hz, ch: P.ch, cx: P.cx, cz: P.cz };
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
		// 視点切り替えではグリッド種類を変更しない。
		// 正投影はorthViewだけで切り替え、1／2／3点透視・魚眼の選択と設定を保持する。
		const cameraBefore = { lens: P.lens, hz: P.hz, ch: P.ch, cx: P.cx, cz: P.cz, yaw: P.yaw, pitch: P.pitch };
		standardApplying = true;
		// 真上／真横は表示だけを正投影へ切り替え、共有カメラの実値もグリッド種類も変更しない。
		// ここでpitchを0/-90へ固定すると、横で調整した上下の傾きが
		// 「上」へ移った瞬間や0 3Dへ戻った瞬間に失われる。
		const keep = { ...cameraBefore, fov: 180, roll: 0 };
		Object.entries(keep).forEach(([k, v]) => setP(k, v));
		orthView = kind === 'side' ? 'side' : kind === 'front' ? 'front' : 'top';
		standardApplying = false; sync(); setMode('draw'); render();
	}
	function showFloorPlan(kind = 'top') {
		if (window.cityFloorPlanActive) { setFloorPlanProjection(kind); fitFloorPlan(); render(); return }
		enterFloorPlan(kind);
	}
	el('viewFloorFront').onclick = () => showFloorPlan('front');
	el('viewFloorSide').onclick = () => showFloorPlan('side');
	el('viewFloorTop').onclick = () => showFloorPlan('top');
	el('viewHome').onclick = () => window.cityFloorPlanActive ? exitFloorPlan(true) : applyStandardView('home');

	// ===== 間取りモード：真上／真横の正投影でシーンを確認する =====
	let floorPlanView = null, floorPlanSideWasHidden = null, floorPlanAutoHidSide = false;
	function restoreStudioView(v, preserve = {}) {
		if (!v) { applyStandardView('home'); return }
		standardApplying = true;
		// 間取りから戻るときも、現在のグリッド種類／透視法の選択は保持する。
		// v.gtは保存された表示状態の情報として残すが、視点復帰でUIを2点透視へ戻さない。
		orthView = v.orthView || null;
		viewKeys.forEach(k => { if (k in P) setP(k, k in preserve ? preserve[k] : v[k]) });
		standardApplying = false; sync(); setMode('view'); render();
	}
	function fitFloorPlan() {
		const objects = sceneObjects(), bounds = [];
		objects.forEach(o => { try { const b = obBounds(o); if (b && b.lo && b.hi && Number.isFinite(b.lo[0]) && Number.isFinite(b.hi[0]) && Number.isFinite(b.lo[1]) && Number.isFinite(b.hi[1]) && Number.isFinite(b.lo[2]) && Number.isFinite(b.hi[2])) bounds.push(b) } catch (e) { } });
		const fyaw = Number(P.yaw || 0) * DG, fpitch = Number(P.pitch || 0) * DG, fhoriz = Math.cos(fpitch), tx = P.cx - Math.sin(fyaw) * FLOOR_CAMERA_RAY * fhoriz, tz = P.cz + Math.cos(fyaw) * FLOOR_CAMERA_RAY * fhoriz, ty = P.ch - 1 + Math.sin(fpitch) * FLOOR_CAMERA_RAY;
		if (orthView === 'side') {
			// 真横は画面の左右がワールドZ、上下がワールドY。共有カメラの高さ・傾きも含めて自動フィットする。
			if (!bounds.length) { window.cityFloorPlanCenter = [P.cz, P.ch - 1]; window.cityFloorPlanScale = Math.min(W, H) / 7.2; return }
			const minZ = Math.min(P.cz, tz, ...bounds.map(b => b.lo[2])), maxZ = Math.max(P.cz, tz, ...bounds.map(b => b.hi[2]));
			const minY = Math.min(P.ch - 1, ty, ...bounds.map(b => b.lo[1])), maxY = Math.max(P.ch - 1, ty, ...bounds.map(b => b.hi[1]));
			const spanZ = Math.max(.1, maxZ - minZ), spanY = Math.max(.1, maxY - minY), pad = Math.max(1, Math.max(spanZ, spanY) * .16);
			const fitScale = Math.min(W * .82 / (spanZ + pad * 2), H * .82 / (spanY + pad * 2));
			window.cityFloorPlanCenter = [(minZ + maxZ) / 2, (minY + maxY) / 2];
			window.cityFloorPlanScale = Math.max(24, Math.min(220, fitScale));
			return;
		}
		if (orthView === 'front') {
			// 正面は画面の左右がワールドX、上下がワールドY。
			if (!bounds.length) { window.cityFloorPlanCenter = [P.cx, P.ch - 1]; window.cityFloorPlanScale = Math.min(W, H) / 7.2; return }
			const minX = Math.min(P.cx, tx, ...bounds.map(b => b.lo[0])), maxX = Math.max(P.cx, tx, ...bounds.map(b => b.hi[0]));
			const minY = Math.min(P.ch - 1, ty, ...bounds.map(b => b.lo[1])), maxY = Math.max(P.ch - 1, ty, ...bounds.map(b => b.hi[1]));
			const spanX = Math.max(.1, maxX - minX), spanY = Math.max(.1, maxY - minY), pad = Math.max(1, Math.max(spanX, spanY) * .16);
			const fitScale = Math.min(W * .82 / (spanX + pad * 2), H * .82 / (spanY + pad * 2));
			window.cityFloorPlanCenter = [(minX + maxX) / 2, (minY + maxY) / 2];
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
		const status = el('floorPlanStatus'); if (status) status.textContent = `間取りモード中：${kind === 'side' ? '真横' : kind === 'front' ? '正面' : '真上'}（表示面内でオブジェクトを移動・編集できます）`;
		render();
	}
	function exitFloorPlan(restore = true) {
		if (!window.cityFloorPlanActive) return;
		// 間取り中に変更した共有カメラの位置・高さ・向き・上下の傾き・レンズを3D視点へ引き継ぐ。
		const keepCamera = { yaw: P.yaw, cx: P.cx, cz: P.cz, lens: P.lens, ch: P.ch, pitch: P.pitch };
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
	// 真横ビューは画面の左右がZ、上下がYなので、床面との交差ではなく
	// 正投影の表示中心・倍率から直接ワールドのZ/Yへ戻す。
	function floorPlanSideWorldAt(p) {
		if (orthView !== 'side') return null;
		if (!Array.isArray(window.cityFloorPlanCenter)) fitFloorPlan();
		const sc = Math.max(1, Number(orthScale()) || 1), pc = window.cityFloorPlanCenter || [0, 0];
		return { z: (p.x - W / 2) / sc + pc[0], y: -(p.y - H / 2) / sc + pc[1] };
	}
	function floorPlanFrontWorldAt(p) {
		if (orthView !== 'front') return null;
		if (!Array.isArray(window.cityFloorPlanCenter)) fitFloorPlan();
		const sc = Math.max(1, Number(orthScale()) || 1), pc = window.cityFloorPlanCenter || [0, 0];
		return { x: (p.x - W / 2) / sc + pc[0], y: -(p.y - H / 2) / sc + pc[1] };
	}
	function floorPlanVerticalWorldAt(p) {
		return orthView === 'side' ? floorPlanSideWorldAt(p) : orthView === 'front' ? floorPlanFrontWorldAt(p) : null;
	}
	function floorPlanObjectZRange(o) {
		const h = Math.max(0, Number(o?.h) || 0);
		// 看板の黒い外枠は、アセット全高の上下にある余白を除いた板部分。
		// 間取りの選択枠・高さハンドルも、この実際の外枠へ合わせる。
		return o?.type === 'asset' && o?.asset === 'sign' ? [h * .08, h * .82] : [0, h];
	}
	function floorPlanHandles() {
		const o = floorPlanObject(), out = { object: null, camera: null };
		if (o && o.k === 1) {
			if (o.type === 'compound') {
				const b = obBounds(o), base = objectAnchorWorld(o), dist = Math.max(b.hi[0] - b.lo[0], b.hi[2] - b.lo[2], .6) * .5 + .42;
				out.object = { o, base, center: scrW(base), world: { x: base[0], z: base[2] + dist } };
				out.object.s = orthView === 'front' ? scrW([base[0] + dist, base[1], base[2]]) : scrW([base[0], orthView === 'side' ? base[1] : -1, base[2] + dist]);
			} else {
				const [z0, z1] = floorPlanObjectZRange(o), base = L2W(o, 0, 0, z0), mid = L2W(o, 0, 0, (z0 + z1) / 2), a = (Number(o.rot) || 0) * DG, dist = Math.max(Math.abs(Number(o.ra) || .3), Math.abs(Number(o.rb) || .3)) + .42;
				out.object = { o, base, center: scrW(mid), world: { x: base[0] - Math.sin(a) * dist, z: base[2] + Math.cos(a) * dist } };
				out.object.s = orthView === 'front' ? scrW([base[0] + Math.cos(a) * dist, base[1], base[2]]) : scrW([out.object.world.x, orthView === 'side' ? base[1] : -1, out.object.world.z]);
			}
		}
		const yaw = Number(P.yaw || 0) * DG, pitch = Number(P.pitch || 0) * DG, body = { x: P.cx, z: P.cz }, cameraY = orthView === 'side' || orthView === 'front' ? P.ch - 1 : -1, horiz = Math.cos(pitch), target = { x: P.cx - Math.sin(yaw) * FLOOR_CAMERA_RAY * horiz, z: P.cz + Math.cos(yaw) * FLOOR_CAMERA_RAY * horiz }, targetY = orthView === 'side' || orthView === 'front' ? cameraY + Math.sin(pitch) * FLOOR_CAMERA_RAY : cameraY, half = Math.atan(18 / Math.max(12, Number(P.lens) || 38)), lensWorld = orthView === 'top' ? [P.cx - Math.sin(yaw - half) * FLOOR_CAMERA_RAY * horiz, cameraY, P.cz + Math.cos(yaw - half) * FLOOR_CAMERA_RAY * horiz] : null;
		out.camera = { body, target, targetY, sBody: scrW([body.x, cameraY, body.z]), sTarget: scrW([target.x, targetY, target.z]), sLens: lensWorld ? scrW(lensWorld) : null, lensWorld, yaw, pitch };
		return out;
	}
	function floorPlanItemAt(w) {
		if (!w) return null;
		return sceneObjects().slice().reverse().find(o => {
			if (!o || o.k !== 1) return false;
			if (o.type === 'compound') { const b = obBounds(o); return w.x >= b.lo[0] - .08 && w.x <= b.hi[0] + .08 && w.z >= b.lo[2] - .08 && w.z <= b.hi[2] + .08 }
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
	// 真横／正面では高さ0の地面オブジェクトが細い1本線になるため、
	// 外枠判定に加えて中心アンカーも許容する。これで線上のクリックを確実に家具移動へ渡す。
	function floorPlanAnchorAtSide(p) {
		if (!p) return null;
		return sceneObjects().slice().reverse().find(o => {
			if (!o || o.k !== 1) return false; const q = scrW(objectAnchorWorld(o));
			return q.ok && Math.hypot(q.x - p.x, q.y - p.y) <= 28 / Z;
		}) || null;
	}
	function floorPlanEditHandles() {
		const o = floorPlanObject(); if (!o || o.k !== 1 || o.type === 'compound') return null;
		const [z0, z1] = floorPlanObjectZRange(o), base = L2W(o, 0, 0, z0), zc = (z0 + z1) / 2, center = scrW(L2W(o, 0, 0, zc)), handles = [];
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
			// 真横ビューは黒い外枠の上端・下端へ高さハンドルを置く。
			// 看板の内部余白を含む全高 h の外側へは逃がさない。
			add('h', '上端', L2W(o, 0, 0, z1), L2W(o, 0, 0, z1 + .1), Math.max(0, Number(o.h) || 0), 0, 1);
			add('h', '下端', L2W(o, 0, 0, z0), L2W(o, 0, 0, z0 - .1), Math.max(0, Number(o.h) || 0), 0, -1);
		} else if (orthView === 'front') {
			// 正面では幅と高さを直接編集し、見えない奥行きは画面上へ逃がしたハンドルで編集する。
			// 正面の幅ハンドルも、看板では黒い外枠の下端へ置く。
			// 全高の底面 z=0 に置くと、看板の外枠から下へ浮いてしまう。
			add('w', '幅＋', L2W(o, o.ra, 0, z0), L2W(o, o.ra + .1, 0, z0), Math.abs(o.ra) * 2, .01, 1);
			add('w', '幅−', L2W(o, -o.ra, 0, z0), L2W(o, -o.ra - .1, 0, z0), Math.abs(o.ra) * 2, .01, -1);
			add('h', '上端', L2W(o, 0, 0, z1), L2W(o, 0, 0, z1 + .1), Math.max(0, Number(o.h) || 0), 0, 1);
			add('h', '下端', L2W(o, 0, 0, z0), L2W(o, 0, 0, z0 - .1), Math.max(0, Number(o.h) || 0), 0, -1);
			const gap = Math.max(48 / Z, Math.min(88 / Z, Math.max(Math.abs(Number(o.ra) || .5), Math.abs(Number(o.h) || .6)) * orthScale() * .65));
			handles.push({ kind: 'd', label: '奥行き', s: { x: center.x + gap, y: center.y, ok: true }, dir: { x: 1, y: 0 }, scale: orthScale(), start: Math.abs(o.rb) * 2, min: .01, side: 1, screen: true });
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
		if (orthView !== 'top' && orthView !== 'side' && orthView !== 'front') return;
		const h = floorPlanHandles(), r = 9 / Z;
		c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
		// 選択中オブジェクト：前側の回転ハンドルと薄い外枠
		if (h.object) {
			const o = h.object.o, [z0, z1] = floorPlanObjectZRange(o), corners = [[-o.ra, -o.rb], [o.ra, -o.rb], [o.ra, o.rb], [-o.ra, o.rb], [-o.ra, -o.rb]];
			c.strokeStyle = 'rgba(255,159,104,.9)'; c.lineWidth = 1.5 / Z; c.setLineDash([6 / Z, 4 / Z]); c.beginPath(); corners.forEach(([x, y], i) => { const p = L2W(o, x, y, z0), q = scrW(p); i ? q.ok ? c.lineTo(q.x, q.y) : null : c.moveTo(q.x, q.y) }); c.stroke(); c.setLineDash([]);
			if (orthView === 'side' && z1 > z0) {
				const baseCorners = [[-o.ra, -o.rb], [o.ra, -o.rb], [o.ra, o.rb], [-o.ra, o.rb]]; c.strokeStyle = 'rgba(255,159,104,.75)'; c.lineWidth = 1.2 / Z; c.beginPath(); baseCorners.forEach(([x, y], i) => { const q = scrW(L2W(o, x, y, z1)); i ? q.ok ? c.lineTo(q.x, q.y) : null : c.moveTo(q.x, q.y) }); c.closePath(); baseCorners.forEach(([x, y]) => { const a = scrW(L2W(o, x, y, z0)), b = scrW(L2W(o, x, y, z1)); if (a.ok && b.ok) { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y) } }); c.stroke();
			} else if (orthView === 'front') {
				const frontCorners = o.type === 'asset' && o.asset === 'sign'
					? [L2W(o, -o.ra, 0, z0), L2W(o, o.ra, 0, z0), L2W(o, o.ra, 0, z1), L2W(o, -o.ra, 0, z1)]
					: (() => { const b = obBounds(o), z = (b.lo[2] + b.hi[2]) / 2; return [[b.lo[0], b.lo[1], z], [b.hi[0], b.lo[1], z], [b.hi[0], b.hi[1], z], [b.lo[0], b.hi[1], z]] })();
				c.strokeStyle = 'rgba(255,159,104,.75)'; c.lineWidth = 1.2 / Z; c.beginPath(); frontCorners.forEach((v, i) => { const q = scrW(v); i ? q.ok ? c.lineTo(q.x, q.y) : null : c.moveTo(q.x, q.y) }); c.closePath(); c.stroke();
			}
			c.strokeStyle = '#ff9f68'; c.lineWidth = 1.5 / Z; c.beginPath(); c.moveTo(h.object.center.x, h.object.center.y); c.lineTo(h.object.s.x, h.object.s.y); c.stroke();
			c.fillStyle = '#fff'; c.strokeStyle = '#ff9f68'; c.lineWidth = 2 / Z; c.beginPath(); c.arc(h.object.s.x, h.object.s.y, r, 0, Math.PI * 2); c.fill(); c.stroke();
			c.beginPath(); c.arc(h.object.s.x, h.object.s.y, r * .52, -Math.PI * .15, Math.PI * 1.3); c.stroke();
			drawFloorPlanEditHandles(c);
		}
		// カメラ：本体をドラッグして位置、先端の丸をドラッグして向き
		const k = h.camera, half = Math.atan(18 / Math.max(12, Number(P.lens) || 38)), body = k.sBody, target = k.sTarget, cameraY = orthView === 'side' || orthView === 'front' ? P.ch - 1 : -1, horiz = Math.cos(k.pitch), coneY = orthView === 'side' || orthView === 'front' ? cameraY + Math.sin(k.pitch) * FLOOR_CAMERA_RAY : cameraY, left = scrW([P.cx - Math.sin(k.yaw - half) * FLOOR_CAMERA_RAY * horiz, coneY, P.cz + Math.cos(k.yaw - half) * FLOOR_CAMERA_RAY * horiz]), right = scrW([P.cx - Math.sin(k.yaw + half) * FLOOR_CAMERA_RAY * horiz, coneY, P.cz + Math.cos(k.yaw + half) * FLOOR_CAMERA_RAY * horiz]);
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
		const dockStatus = el('floorPlanDockStatus'); if (dockStatus) { const cameraHint = orthView === 'side' ? '真横：カメラ本体＝位置・高さ　／　先端の丸＝上下の傾き' : orthView === 'front' ? '正面：カメラ本体＝X位置・高さ　／　先端の丸＝上下の傾き' : 'カメラ本体：位置　／　先端の丸＝向き'; dockStatus.innerHTML = `${text}<small>幅・奥行ハンドルは反対側の面を固定　／　${cameraHint}</small>`; }
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
		let delta, axes;
		if (orthView === 'side') { delta = [0, dz, dx]; axes = [1, 2] }
		else if (orthView === 'front') { delta = [dx, dz, 0]; axes = [0, 1] }
		else { delta = [dx, 0, dz]; axes = [0, 2] }
		const setup = snapSetupGroup(objects, objectAnchorWorld(o)), q = $('snp')?.checked ? snapShift(setup.bb, delta, axes, setup.targets, setup.tau) : { d: delta, hit: new Set() };
		snapHit = q.hit.size ? q.hit : null;
		/* 上はX/Z、横はZ/Y、前はX/Yの表示面内を移動する。 */
		objects.forEach(g => setOb(g.id, moveBy(g, q.d))); render();
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
		// 看板の絵枠ハンドルは通常の3Dギズモと同じ編集経路へ渡す。
		// これを家具の間取り判定より後にすると、横／上ビューで本体移動として処理される。
		if (tool === 'edit' && sel) {
			const special = hitGizmo(p);
			if (special && (special.t.startsWith('sign-') || (special.t === 'face' && special.g?.o?.asset === 'sign'))) {
				e.preventDefault(); e.stopImmediatePropagation(); ptr = e.pointerId; ptrType = e.pointerType; beginGizmo(special, p); try { cv.setPointerCapture(e.pointerId) } catch (err) { } syncSel(); render(); return;
			}
		}
		const resize = floorPlanEditHandleAt(p);
		// 7 前も9 上・8 横と同じ面編集ハンドルを先に受け取る。
		// ここから漏れると、ハンドルを押してもオブジェクト移動として処理される。
		if (resize && (orthView === 'top' || orthView === 'side' || orthView === 'front')) { e.preventDefault(); e.stopImmediatePropagation(); floorPlanDrag = { kind: 'resize', pointerId: e.pointerId, id: resize.g.o.id, o0: { ...resize.g.o, off: [...(resize.g.o.off || [0, 0, 0])] }, handle: resize.h, p0: p, started: false }; try { cv.setPointerCapture(e.pointerId) } catch (err) { } return }
		if (orthView === 'side' || orthView === 'front') {
			const verticalHandles = floorPlanHandles(), verticalLim = 22 / Z, verticalAxis = orthView === 'side' ? 'side' : 'front';
			if (verticalHandles.camera && Math.hypot(verticalHandles.camera.sTarget.x - p.x, verticalHandles.camera.sTarget.y - p.y) < verticalLim) {
				e.preventDefault(); e.stopImmediatePropagation(); floorPlanDrag = { kind: 'aimSide', axis: verticalAxis, pointerId: e.pointerId }; try { cv.setPointerCapture(e.pointerId) } catch (err) { } return;
			}
			if (verticalHandles.camera && Math.hypot(verticalHandles.camera.sBody.x - p.x, verticalHandles.camera.sBody.y - p.y) < verticalLim) {
				const w = floorPlanVerticalWorldAt(p); if (!w) return;
				e.preventDefault(); e.stopImmediatePropagation(); floorPlanDrag = { kind: 'cameraSide', axis: verticalAxis, pointerId: e.pointerId, dx: orthView === 'front' ? P.cx - w.x : 0, dz: orthView === 'side' ? P.cz - w.z : 0, dy: (P.ch - 1) - w.y }; try { cv.setPointerCapture(e.pointerId) } catch (err) { } return;
			}
		}
		if (orthView === 'side' || orthView === 'front') {
			const hit = floorPlanItemAtSide(p) || floorPlanAnchorAtSide(p);
			if (hit) {
				const multi = e.shiftKey || e.metaKey || e.ctrlKey, wasSelected = selIds.has(hit.id);
				if (multi) setSelection(hit.id, true);
				else if (!wasSelected || selIds.size <= 1) setSelection(hit.id, false);
				if (!selIds.has(hit.id)) { syncSel(); render(); return }
				const w = floorPlanVerticalWorldAt(p), base = objectAnchorWorld(hit), group = selectedObjects().filter(o => o.k === 1), snap = snapSetupGroup(group, base);
				if (!w) { syncSel(); render(); return }
				e.preventDefault(); e.stopImmediatePropagation();
				floorPlanDrag = { kind: 'itemVertical', axis: orthView === 'side' ? 'side' : 'front', pointerId: e.pointerId, id: hit.id, o0: { ...hit, off: [...(hit.off || [0, 0, 0])] }, group, base0: base, bb: snap.bb, targets: snap.targets, tau: snap.tau, dx: orthView === 'front' ? base[0] - w.x : 0, dz: orthView === 'side' ? base[2] - w.z : 0, dy: base[1] - w.y, started: false };
				try { cv.setPointerCapture(e.pointerId) } catch (err) { } syncSel(); render();
			} else if (e.shiftKey) beginFloorPan(e, p);
			else beginFloorBoxPending(e, p);
			return;
		}
		const h = floorPlanHandles(), lim = 22 / Z;
		if (h.object && h.object.s && Math.hypot(h.object.s.x - p.x, h.object.s.y - p.y) < lim) {
			e.preventDefault(); e.stopImmediatePropagation();
			const center = objectAnchorWorld(h.object.o), angle0 = Math.atan2(h.object.world.x - center[0], h.object.world.z - center[2]);
			floorPlanDrag = { kind: 'turn', pointerId: e.pointerId, id: h.object.o.id, o0: h.object.o.type === 'compound' ? JSON.parse(JSON.stringify(h.object.o)) : null, center, angle0, started: false };
			try { cv.setPointerCapture(e.pointerId) } catch (err) { } return
		}
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
			const base = objectAnchorWorld(hit), group = selectedObjects().filter(o => o.k === 1), snap = snapSetupGroup(group, base);
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
		if (floorPlanDrag.kind === 'cameraSide' || floorPlanDrag.kind === 'aimSide') {
			const w = floorPlanVerticalWorldAt(pos(e)); if (!w) return;
			if (floorPlanDrag.kind === 'cameraSide') {
				if (floorPlanDrag.axis === 'front') P.cx = +(w.x + floorPlanDrag.dx).toFixed(3);
				else P.cz = +(w.z + floorPlanDrag.dz).toFixed(3);
				P.ch = +Math.max(.3, w.y + floorPlanDrag.dy + 1).toFixed(3);
			} else {
				const cameraY = Number(P.ch || 1.6) - 1;
				P.pitch = +clamp(Math.asin(clamp((w.y - cameraY) / Math.max(1, FLOOR_CAMERA_RAY), -.985, .985)) / DG, -60, 60).toFixed(2);
				if (floorPlanDrag.axis === 'front') {
					const horiz = Math.max(.1, FLOOR_CAMERA_RAY * Math.cos(P.pitch * DG));
					P.yaw = +clamp(Math.asin(clamp(-(w.x - P.cx) / horiz, -.985, .985)) / DG, -60, 60).toFixed(2);
				}
			}
			sync(); render(); return;
		}
		if (floorPlanDrag.kind === 'itemVertical') {
			const w = floorPlanVerticalWorldAt(pos(e)); if (!w) return;
			const o = floorPlanDrag.o0;
			if (o && o.k === 1) {
				if (!floorPlanDrag.started) { HU.push(S); RD = []; floorPlanDrag.started = true }
				const delta = floorPlanDrag.axis === 'front'
					? [w.x + floorPlanDrag.dx - floorPlanDrag.base0[0], w.y + floorPlanDrag.dy - floorPlanDrag.base0[1], 0]
					: [0, w.y + floorPlanDrag.dy - floorPlanDrag.base0[1], w.z + floorPlanDrag.dz - floorPlanDrag.base0[2]];
				const axes = floorPlanDrag.axis === 'front' ? [0, 1] : [1, 2];
				const q = $('snp')?.checked ? snapShift(floorPlanDrag.bb, delta, axes, floorPlanDrag.targets, floorPlanDrag.tau) : { d: delta, hit: new Set() };
				snapHit = q.hit.size ? q.hit : null;
				(floorPlanDrag.group || [o]).forEach(g => setOb(g.id, moveBy(g, q.d)));
			}
			render(); return;
		}
		const w = floorPlanWorldAt(pos(e)); if (!w) return;
		if (floorPlanDrag.kind === 'turn') {
			const o = obOf(floorPlanDrag.id); if (o && o.k === 1) {
				if (o.type === 'compound') {
					let delta = (Math.atan2(w.x - floorPlanDrag.center[0], w.z - floorPlanDrag.center[2]) - floorPlanDrag.angle0) / DG;
					if (!e.shiftKey) delta = Math.round(delta / 15) * 15;
					if (!floorPlanDrag.started) { HU.push(S); RD = []; floorPlanDrag.started = true }
					setOb(o.id, rotateCompoundBy(floorPlanDrag.o0 || o, delta));
				} else {
					let a = Math.atan2(w.x - L2W(o, 0, 0, 0)[0], w.z - L2W(o, 0, 0, 0)[2]) / DG; if (!e.shiftKey) a = Math.round(a / 15) * 15;
					if (!floorPlanDrag.started) { HU.push(S); RD = []; floorPlanDrag.started = true } setOb(o.id, { rot: angle360(a) })
				}
			}
		} else if (floorPlanDrag.kind === 'item') {
			const o = floorPlanDrag.o0;
			if (o && o.k === 1) {
				if (!floorPlanDrag.started) { HU.push(S); RD = []; floorPlanDrag.started = true }
				/* 家具本体の間取り移動はX/Zだけ。磁石ONなら選択全体の外周を他オブジェクトへ吸着する。 */
				const delta = [w.x + floorPlanDrag.dx - floorPlanDrag.base0[0], 0, w.z + floorPlanDrag.dz - floorPlanDrag.base0[2]];
				const q = $('snp')?.checked ? snapShift(floorPlanDrag.bb, delta, [0, 2], floorPlanDrag.targets, floorPlanDrag.tau) : { d: delta, hit: new Set() };
				snapHit = q.hit.size ? q.hit : null;
				(floorPlanDrag.group || [o]).forEach(g => setOb(g.id, moveBy(g, q.d)));
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
		// カメラプリセットは視点だけを変更し、グリッド種類は現在の選択を保持する。
		if (name === 'alley') {
			setValues({ lens: 38, yaw: 39.912, hz: 50, pitch: 0, ch: 1.62, cx: 0, cz: 0 }); el('bgw').checked = true; el('pc').value = '#222222';
		} else if (name === 'top') {
			// 添付された街並みのような、地面を広く見渡す見下ろし視点。
			setValues({ lens: 35, yaw: 39.912, hz: 52, pitch: -57, ch: 4.2, cx: 0, cz: 0 }); el('bgw').checked = true; el('pc').value = '#222222';
		} else if (name === 'three') {
			setValues({ lens: 42, yaw: 39.912, hz: 52, pitch: 27, ch: 2.3, cx: 0, cz: 0 }); el('bgw').checked = true; el('pc').value = '#222222';
		} else {
			setValues({ lens: 45, yaw: 0, hz: 50, pitch: 0, ch: 1.6, cx: 0, cz: 0 }); el('bgw').checked = true; el('pc').value = '#222222';
		}
		render();
	}

	// ===== User camera / settings presets =====
	const STUDIO_PRESET_KEY = 'city-grid-studio-presets-v1';
	const studioPresetNameInput = el('studioPresetName'), studioPresetSelect = el('studioPresetSelect');
	// オブジェクトを除く、カメラ・グリッド・補助線・ペン・消しゴム・表示設定をまとめて保存する。
	const presetCheckIds = ['gon', 'hzl', 'bgw', 'bin', 'zf', 'gg', 'p3', 'snp', 'pn', 'sq', 'wf'];
	const presetSelectIds = ['snap', 'em', 'shT', 'shK'];
	function readStudioPresets() { try { const a = JSON.parse(localStorage.getItem(STUDIO_PRESET_KEY) || '[]'); return Array.isArray(a) ? a : [] } catch (e) { return [] } }
	function writeStudioPresets(a) { try { localStorage.setItem(STUDIO_PRESET_KEY, JSON.stringify(a)); return true } catch (e) { return false } }
	function captureStudioPreset(name) {
		const checks = {}, selects = {}; presetCheckIds.forEach(id => { const n = el(id); if (n) checks[id] = !!n.checked }); presetSelectIds.forEach(id => { const n = el(id); if (n) selects[id] = n.value });
		const ui = { sideHidden: el('side')?.classList.contains('hide') || false, details: [...document.querySelectorAll('#side details')].map(d => !!d.open), trayOpen: el('assetTray')?.style.display === 'block', workspace: quick?.querySelector('[data-workspace-tab].active')?.dataset.workspaceTab || 'perspective' };
		const strokes = S.filter(s => !s?.ob).map(s => JSON.parse(JSON.stringify(s)));
		return {
			name: name || '名称未設定', version: 3, P: { ...P }, gt: el('gt').value, orthView: orthView || null, mode, tool, ar: el('ar').value, show: [...show], checks, selects, snap: el('snap').value, pc: el('pc').value,
			cr: CR ? { ...CR } : null, zoom: { Z, ox, oy }, photo: typeof IMGsrc === 'string' && IMGsrc.startsWith('data:') ? IMGsrc : null, strokes, ui,
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
		// 3Dオブジェクトは現在のシーンを維持し、プリセット側に保存した線画だけを復元する。
		if (Array.isArray(d.strokes)) {
			const objects = S.filter(s => s?.ob); S = [...d.strokes.map(s => JSON.parse(JSON.stringify(s))), ...objects];
		}
		if (Array.isArray(d.show)) d.show.forEach((v, i) => { if (i < show.length) { show[i] = !!v; const n = document.querySelector('[data-i="' + i + '"]'); if (n) n.checked = !!v } });
		if (d.checks) Object.entries(d.checks).forEach(([id, v]) => { const n = el(id); if (n) n.checked = !!v });
		if (d.selects) Object.entries(d.selects).forEach(([id, v]) => { const n = el(id); if (n && v != null) n.value = v });
		if (d.snap != null) el('snap').value = d.snap; if (d.pc != null) el('pc').value = d.pc;
		if (d.cr !== undefined) CR = d.cr ? { ...d.cr } : null;
		if (d.zoom && Number.isFinite(Number(d.zoom.Z))) { Z = clamp(Number(d.zoom.Z), 1, 10); ox = Number(d.zoom.ox) || 0; oy = Number(d.zoom.oy) || 0; updZ(); }
		if ('photo' in d) {
			if (d.photo) { const im = new Image(); im.onload = () => { IMG = im; IMGsrc = d.photo; render() }; im.src = d.photo }
			else { IMG = null; IMGsrc = null }
		}
		orthView = d.orthView || null; tool = d.tool || tool;
		if (d.ui) {
			if (Array.isArray(d.ui.details)) document.querySelectorAll('#side details').forEach((section, i) => { if (i < d.ui.details.length) section.open = !!d.ui.details[i] });
			if (typeof d.ui.sideHidden === 'boolean') { setSide(d.ui.sideHidden); fit() }
			const tray = el('assetTray'); if (tray && typeof d.ui.trayOpen === 'boolean') { tray.style.display = d.ui.trayOpen ? 'block' : 'none'; el('assetToggle')?.classList.toggle('on', d.ui.trayOpen); tray.classList.toggle('floorAssetTray', !!window.cityFloorPlanActive && d.ui.trayOpen) }
		}
		sync();
		if (d.floorActive) {
			window.cityFloorPlanEnter?.(orthView === 'side' ? 'side' : orthView === 'front' ? 'front' : 'top');
			if (Array.isArray(d.floorCenter)) window.cityFloorPlanCenter = [...d.floorCenter];
			if (Number.isFinite(d.floorScale)) window.cityFloorPlanScale = d.floorScale;
			if (d.ui?.workspace === 'floorplan') {
				quick.querySelectorAll('[data-workspace-tab]').forEach(b => b.classList.toggle('active', b.dataset.workspaceTab === 'floorplan'));
				quick.querySelectorAll('[data-workspace-screen]').forEach(screen => { screen.hidden = screen.dataset.workspaceScreen !== 'floorplan' });
			}
			setMode(d.mode === 'view' ? 'view' : 'draw'); render();
		} else { if (d.ui?.workspace && window.cityStudioWorkspace) window.cityStudioWorkspace(d.ui.workspace); setMode(d.mode === 'draw' ? 'draw' : 'view'); render() }
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
