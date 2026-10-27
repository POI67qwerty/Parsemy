/* City Grid Studio studio layer — UI, gestures, floor tools and asset library.
   The perspective engine stays underneath so old projects remain compatible. */
(function () {
    "use strict";
    const el = (id) => document.getElementById(id);
    const side = el("side"),
        stage = el("stage");

    // ===== Quick workspace controls =====
    if (P.hm == null) P.hm = 1.7;
    if (P.floorOn == null) P.floorOn = true;
    if (P.floorColor == null) P.floorColor = "#7fa8d8";
    if (P.floorAlpha == null) P.floorAlpha = 0.24;
    if (P.assetDepth == null) P.assetDepth = 5;
    if (P.assetAxis == null) P.assetAxis = 1;
    const quick = document.createElement("section");
    quick.id = "studioQuick";
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
      <div class="sceneNote">間取りでは家具のドラッグ移動、正面・上・横の移動ギズモ、選択中の前側の丸をドラッグした回転、カメラ本体のドラッグ移動、先端の丸のドラッグで向きの変更ができます。回転は15°刻みで30°・45°・90°も選べ、Shiftを押しながらドラッグすると自由な角度です。矢印キーで移動、Q/Eで15°ずつ回転します。移動中も高さ方向（Y）は専用軸で編集でき、接続テント／看板は上下方向だけに制限されます。壁面などY方向以外の面へ生成したオブジェクトは表示のみで、位置は変更しません。</div>
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
    const humanInput = el("humanHeight");
    humanInput.value = Number(P.hm).toFixed(2);

    // ===== Separate work screens: character height/body, pose, and perspective =====
    function setStudioWorkspace(name) {
        const valid = ["character", "pose", "floorplan", "perspective"],
            tab = valid.includes(name) ? name : "perspective";
        quick
            .querySelectorAll("[data-workspace-tab]")
            .forEach((b) => b.classList.toggle("active", b.dataset.workspaceTab === tab));
        quick.querySelectorAll("[data-workspace-screen]").forEach((screen) => {
            screen.hidden = screen.dataset.workspaceScreen !== tab;
        });
        if (tab === "floorplan") window.cityFloorPlanEnter?.();
        else if (window.cityFloorPlanActive) window.cityFloorPlanExit?.();
    }
    quick
        .querySelectorAll("[data-workspace-tab]")
        .forEach((b) => (b.onclick = () => setStudioWorkspace(b.dataset.workspaceTab)));
    window.cityStudioWorkspace = setStudioWorkspace;
    const personHeightInput = el("personHeight"),
        personBodyInput = el("personBodyScale"),
        personShoulderInput = el("personShoulderScale"),
        personHeadInput = el("personHeadScale"),
        personLegInput = el("personLegSpread"),
        personStatus = el("personSelectionStatus"),
        poseStatus = el("poseSelectionStatus");
    const personPoseStrideInput = el("personPoseStride"),
        personPoseCrouchInput = el("personPoseCrouch"),
        personPoseLeanInput = el("personPoseLean"),
        personHeadTiltInput = el("personHeadTilt");
    const poseButtons = [...quick.querySelectorAll("[data-person-pose]")];
    const poseDefaults = {
        stand: { stride: 0, crouch: 0, lean: 0, headTilt: 0 },
        walk: { stride: 0.22, crouch: 0, lean: 0, headTilt: 0 },
        crouch: { stride: 0.04, crouch: 0.65, lean: 0, headTilt: 0 },
        sit: { stride: 0.1, crouch: 0.35, lean: 0, headTilt: 0 },
    };
    const selectedPerson = () => {
        const o = sel && obOf(sel);
        return o && o.type === "asset" && o.asset === "person" ? o : null;
    };
    function personPoseDefaults(o) {
        return (
            poseDefaults[o?.pose] || {
                stride: Number(o?.poseStride) || 0,
                crouch: Number(o?.poseCrouch) || 0,
                lean: Number(o?.poseLean) || 0,
                headTilt: Number(o?.headTilt) || 0,
            }
        );
    }
    function syncPersonControls() {
        const o = selectedPerson(),
            h = o ? Number(o.h) || Number(P.hm) || 1.7 : Number(P.hm) || 1.7,
            pd = personPoseDefaults(o);
        if (personHeightInput && document.activeElement !== personHeightInput) personHeightInput.value = h.toFixed(2);
        if (personBodyInput && document.activeElement !== personBodyInput)
            personBodyInput.value = Number(o?.bodyScale ?? 1).toFixed(2);
        if (personShoulderInput && document.activeElement !== personShoulderInput)
            personShoulderInput.value = Number(o?.shoulderScale ?? 1).toFixed(2);
        if (personHeadInput && document.activeElement !== personHeadInput)
            personHeadInput.value = Number(o?.headScale ?? 1).toFixed(2);
        if (personLegInput && document.activeElement !== personLegInput)
            personLegInput.value = Number(o?.legSpread ?? 1).toFixed(2);
        if (personPoseStrideInput && document.activeElement !== personPoseStrideInput)
            personPoseStrideInput.value = Number(o?.poseStride ?? pd.stride).toFixed(2);
        if (personPoseCrouchInput && document.activeElement !== personPoseCrouchInput)
            personPoseCrouchInput.value = Number(o?.poseCrouch ?? pd.crouch).toFixed(2);
        if (personPoseLeanInput && document.activeElement !== personPoseLeanInput)
            personPoseLeanInput.value = Number(o?.poseLean ?? pd.lean).toFixed(2);
        if (personHeadTiltInput && document.activeElement !== personHeadTiltInput)
            personHeadTiltInput.value = Number(o?.headTilt ?? pd.headTilt).toFixed(0);
        if (personStatus)
            personStatus.textContent = o
                ? `選択中：人物アセット（身長 ${h.toFixed(2)} m）`
                : "人物アセットを選択すると個別編集できます";
        if (poseStatus)
            poseStatus.textContent = o
                ? `選択中のポーズ：${{ stand: "直立", walk: "歩行", crouch: "しゃがみ", sit: "着席", custom: "カスタム" }[o.pose || "stand"] || "カスタム"}`
                : "人物アセットを選択するとポーズを変更できます";
        poseButtons.forEach((b) => b.classList.toggle("active", !!o && (o.pose || "stand") === b.dataset.personPose));
    }
    function applySelectedPerson() {
        const o = selectedPerson();
        if (!o) {
            alert("先に人物アセットを選択してください");
            return;
        }
        const h = clamp(parseFloat(personHeightInput.value) || o.h || 1.7, 0.5, 10),
            body = clamp(parseFloat(personBodyInput.value) || 1, 0.6, 1.8),
            shoulder = clamp(parseFloat(personShoulderInput.value) || 1, 0.6, 1.6),
            head = clamp(parseFloat(personHeadInput.value) || 1, 0.7, 1.5),
            legs = clamp(parseFloat(personLegInput.value) || 1, 0.6, 1.8);
        HU.push(S);
        RD = [];
        P.hm = h;
        humanInput.value = h.toFixed(2);
        setOb(o.id, {
            h,
            bodyScale: body,
            shoulderScale: shoulder,
            headScale: head,
            legSpread: legs,
            ra: h * 0.135 * body * shoulder,
            rb: h * 0.088 * body,
        });
        render();
    }
    function applyPersonPose(pose) {
        const o = selectedPerson();
        if (!o) {
            alert("先に人物アセットを選択してください");
            return;
        }
        const d = poseDefaults[pose] || poseDefaults.stand;
        HU.push(S);
        RD = [];
        setOb(o.id, { pose, poseStride: d.stride, poseCrouch: d.crouch, poseLean: d.lean, headTilt: d.headTilt });
        setStudioWorkspace("pose");
        render();
    }
    function applyPersonPoseDetail() {
        const o = selectedPerson();
        if (!o) {
            alert("先に人物アセットを選択してください");
            return;
        }
        const stride = clamp(parseFloat(personPoseStrideInput.value) || 0, 0, 0.5),
            crouch = clamp(parseFloat(personPoseCrouchInput.value) || 0, 0, 1),
            lean = clamp(parseFloat(personPoseLeanInput.value) || 0, -0.35, 0.35),
            headTilt = clamp(parseFloat(personHeadTiltInput.value) || 0, -25, 25);
        HU.push(S);
        RD = [];
        setOb(o.id, { pose: "custom", poseStride: stride, poseCrouch: crouch, poseLean: lean, headTilt });
        setStudioWorkspace("pose");
        render();
    }
    el("applyPersonEdit").onclick = applySelectedPerson;
    el("applyPersonPoseDetail").onclick = applyPersonPoseDetail;
    poseButtons.forEach((b) => (b.onclick = () => applyPersonPose(b.dataset.personPose)));
    syncPersonControls();

    // ===== Transparent floor tint =====
    const floorToggle = el("floorTint"),
        floorColor = el("floorTintColor"),
        floorAlpha = el("floorTintA"),
        floorAlphaOut = el("floorTintAO");
    function syncFloorControls() {
        if (!floorToggle) return;
        floorToggle.checked = !!P.floorOn;
        if (document.activeElement !== floorColor) floorColor.value = P.floorColor || "#7fa8d8";
        if (document.activeElement !== floorAlpha) floorAlpha.value = Number(P.floorAlpha ?? 0.16).toFixed(2);
        floorAlphaOut.textContent = Number(P.floorAlpha ?? 0.16).toFixed(2);
    }
    function updateFloor() {
        P.floorOn = floorToggle.checked;
        P.floorColor = floorColor.value;
        P.floorAlpha = +floorAlpha.value;
        floorAlphaOut.textContent = P.floorAlpha.toFixed(2);
        render();
    }
    [floorToggle, floorColor, floorAlpha].forEach((x) => x && x.addEventListener("input", updateFloor));
    syncFloorControls();
    const assetDepthInput = el("assetDepth");
    function syncAssetDepth() {
        if (assetDepthInput && document.activeElement !== assetDepthInput)
            assetDepthInput.value = Number(P.assetDepth || 5).toFixed(1);
    }
    assetDepthInput.oninput = () => {
        P.assetDepth = Math.max(1, Math.min(20, parseFloat(assetDepthInput.value) || 5));
        render();
    };
    syncAssetDepth();
    const assetAxisInput = el("assetAxis");
    let assetAxisTrayInput = null;
    function syncAssetAxis() {
        const value = String(Number(P.assetAxis ?? 1));
        if (assetAxisInput && document.activeElement !== assetAxisInput) assetAxisInput.value = value;
        if (assetAxisTrayInput && document.activeElement !== assetAxisTrayInput) assetAxisTrayInput.value = value;
        if (window.cityGridAssetAxisTray && document.activeElement !== window.cityGridAssetAxisTray)
            window.cityGridAssetAxisTray.value = value;
    }
    function setAssetAxis(value) {
        P.assetAxis = clamp(Math.round(Number(value)), 0, 2);
        syncAssetAxis();
        render();
    }
    assetAxisInput.onchange = () => setAssetAxis(assetAxisInput.value);
    syncAssetAxis();
    window.cityFloorTint = function (c) {
        // 床はカメラから見える地平線より下を、透明な平面色として塗る。
        // 画角や魚眼でも必ず見えるよう、投影前の巨大四角ではなく画面上の台形で描く。
        const horizon = T === "f" ? H * 0.5 : clamp(AX.hy, 0, H);
        c.save();
        c.globalAlpha = Math.max(0, Math.min(0.8, Number(P.floorAlpha) || 0));
        c.fillStyle = P.floorColor || "#7fa8d8";
        c.beginPath();
        c.moveTo(0, horizon);
        c.lineTo(W, horizon);
        c.lineTo(W, H);
        c.lineTo(0, H);
        c.closePath();
        c.fill();
        c.restore();
    };

    // Asset catalog and geometry generator are provided by asset.js.

    // Asset placement, asset tray, object JSON and primitive menu are installed by asset.js.
    // ===== Scene outliner / object groups =====
    const list = el("objectList");
    function sceneObjects() {
        const a = [],
            seen = new Set();
        S.forEach((s) => {
            if (s.ob && !seen.has(s.ob.id)) {
                seen.add(s.ob.id);
                a.push(s.ob);
            }
        });
        return a;
    }
    function rewriteObjectDefs(ids, change) {
        const wanted = new Set(ids);
        S = S.map((s) => {
            if (!s?.ob || !wanted.has(s.ob.id)) return s;
            const ob = { ...s.ob, ...change };
            return { ...s, ob };
        });
    }
    function groupSelectedScene() {
        const objects = selectedObjects();
        if (objects.length < 2) {
            alert("グループ化するオブジェクトを2個以上選択してください");
            return;
        }
        const groupId = "group-" + uid();
        HU.push(S);
        RD = [];
        rewriteObjectDefs(
            objects.map((o) => o.id),
            { groupId },
        );
        normalizeSelection();
        render();
    }
    function ungroupSelectedScene() {
        const objects = selectedObjects().filter((o) => o.groupId);
        if (!objects.length) return;
        HU.push(S);
        RD = [];
        const wanted = new Set(objects.map((o) => o.id));
        S = S.map((s) => {
            if (!s?.ob || !wanted.has(s.ob.id)) return s;
            const ob = { ...s.ob };
            delete ob.groupId;
            return { ...s, ob };
        });
        normalizeSelection();
        render();
    }
    function combineSelectedScene() {
        const objects = selectedObjects();
        if (objects.length < 2) {
            alert("結合するオブジェクトを2個以上選択してください");
            return;
        }
        const parts = [];
        objects.forEach((o) => {
            const sources = o.type === "compound" ? compoundPartsAt(o) : [o];
            sources.forEach((source) => {
                const q = JSON.parse(JSON.stringify(source));
                q.id = uid();
                delete q.groupId;
                parts.push(q);
            });
        });
        if (parts.length < 2) {
            alert("結合するパーツがありません");
            return;
        }
        const b = groupBounds(parts),
            lead = objects.find((o) => o.id === sel) || objects[0],
            compound = {
                id: uid(),
                type: "compound",
                parts,
                tx: 0,
                ty: 0,
                tz: 0,
                k: 1,
                d: -1,
                ca: (b.lo[0] + b.hi[0]) / 2,
                cb: (b.lo[2] + b.hi[2]) / 2,
                ra: Math.max(0.005, (b.hi[0] - b.lo[0]) / 2),
                rb: Math.max(0.005, (b.hi[2] - b.lo[2]) / 2),
                h: Math.max(0.005, b.hi[1] - b.lo[1]),
                rot: 0,
                compoundRot: 0,
                lift: 0,
                off: [0, 0, 0],
                c: lead.c || "#222222",
                w: lead.w || MASTER_W,
                accent: lead.accent || "#66e3c8",
                surfaceColor: lead.surfaceColor,
                surfaceAlpha: lead.surfaceAlpha,
            };
        const lines = genShape(compound);
        if (!lines.length || lines.some((s) => !validStroke(s))) {
            alert("結合できない形状が含まれています");
            return;
        }
        const wanted = new Set(objects.map((o) => o.id));
        HU.push(S);
        RD = [];
        S = [...S.filter((s) => !(s.ob && wanted.has(s.ob.id))), ...lines];
        clearSelection();
        setSelection(compound.id, false);
        render();
    }
    function separateSelectedScene() {
        const objects = selectedObjects().filter((o) => o.type === "compound");
        if (!objects.length) return;
        const wanted = new Set(objects.map((o) => o.id)),
            parts = [];
        objects.forEach((o) =>
            compoundPartsAt(o).forEach((source) => {
                const q = JSON.parse(JSON.stringify(source));
                q.id = uid();
                delete q.groupId;
                parts.push(q);
            }),
        );
        const lines = parts.flatMap((part) => genShape(part));
        HU.push(S);
        RD = [];
        S = [...S.filter((s) => !(s.ob && wanted.has(s.ob.id))), ...lines];
        clearSelection();
        parts.forEach((part) => selIds.add(part.id));
        sel = parts[0]?.id || null;
        normalizeSelection();
        render();
    }
    function syncGroupActions() {
        const group = el("sceneGroupSel"),
            ungroup = el("sceneUngroupSel"),
            combine = el("sceneCombineSel"),
            separate = el("sceneSeparateSel"),
            objects = selectedObjects(),
            units = new Set(objects.map((o) => o.groupId || o.id));
        if (group) group.disabled = units.size < 2;
        if (ungroup) ungroup.disabled = !objects.some((o) => o.groupId);
        if (combine) combine.disabled = objects.length < 2;
        if (separate) separate.disabled = !objects.some((o) => o.type === "compound");
    }
    function linkedMemberIds(id) {
        const o = obOf(id);
        if (!o) return [];
        if (!o.linkedAsset) return groupMemberIds(id);
        const members = sceneObjects()
            .filter((q) => q.linkedAsset === o.linkedAsset && q.groupId === o.groupId)
            .map((q) => q.id);
        return members.length ? members : [id];
    }
    function setObjectVisibility(id, visible) {
        const o = obOf(id);
        if (!o) return;
        const ids = linkedMemberIds(id);
        HU.push(S);
        RD = [];
        ids.forEach((member) => setOb(member, { visible: !!visible }));
        if (!visible) {
            ids.forEach((member) => selIds.delete(member));
            if (ids.includes(sel)) sel = [...selIds].pop() || null;
            normalizeSelection();
        }
        render();
    }
    function updateOutliner() {
        if (!list) return;
        normalizeSelection();
        const objects = sceneObjects();
        list.innerHTML = objects.length
            ? objects
                  .map((o, i) => {
                      const group =
                          o.type === "compound"
                              ? `<span class="compoundMark">結合</span>`
                              : o.groupId
                                ? `<span class="groupMark">グループ</span>`
                                : "";
                      const detail =
                          o.type === "compound"
                              ? `${Array.isArray(o.parts) ? o.parts.length : 0}パーツ・複合オブジェクト`
                              : o.type === "asset" && o.asset === "person"
                                ? Number(o.h).toFixed(2) + " m"
                                : o.type === "asset"
                                  ? "low-poly asset"
                                  : "vector shape";
                      const visible = objectVisible(o);
                      return `<div class="objectRow ${selIds.has(o.id) ? "selected" : ""} ${sel === o.id ? "activeObject" : ""} ${visible ? "" : "hiddenObject"}" data-object="${o.id}"><button type="button" class="objectVisibility" data-object-visibility="${o.id}" title="${visible ? "オブジェクトを非表示" : "オブジェクトを表示"}" aria-label="${visible ? "非表示" : "表示"}">${visible ? "◉" : "○"}</button><input class="objectCheck" type="checkbox" data-object-check="${o.id}" ${selIds.has(o.id) ? "checked" : ""} aria-label="${assetLabel(o)}を選択"><span class="objectIcon">${assetGlyph(o)}</span><span class="objectMeta">${assetLabel(o)} ${i + 1} ${group}<small>${detail}</small></span></div>`;
                  })
                  .join("")
            : '<div class="emptyList">まだオブジェクトがありません</div>';
        syncGroupActions();
    }
    function deleteSelectedScene() {
        const ids = new Set();
        selectedObjects().forEach((o) => linkedMemberIds(o.id).forEach((member) => ids.add(member)));
        if (!ids.size) return;
        HU.push(S);
        S = S.filter((s) => !(s.ob && ids.has(s.ob.id)));
        RD = [];
        clearSelection();
        render();
    }
    function alignSelectedScene() {
        const objects = selectedObjects(),
            units = [],
            unitMap = new Map();
        objects.forEach((o) => {
            const key = o.groupId || o.id;
            if (!unitMap.has(key)) {
                const unit = { objects: [], b: null };
                unitMap.set(key, unit);
                units.push(unit);
            }
            unitMap.get(key).objects.push(o);
        });
        units.forEach((unit) => (unit.b = groupBounds(unit.objects)));
        if (units.length < 2) {
            alert("整列するオブジェクトを2個以上選択してください");
            return;
        }
        const axis = +$("alignAxis").value,
            kind = $("alignMode").value;
        const target =
            kind === "min"
                ? Math.min(...units.map((x) => x.b.lo[axis]))
                : kind === "max"
                  ? Math.max(...units.map((x) => x.b.hi[axis]))
                  : (Math.min(...units.map((x) => x.b.lo[axis])) + Math.max(...units.map((x) => x.b.hi[axis]))) / 2;
        HU.push(S);
        RD = [];
        units.forEach(({ objects, b }) => {
            const current = kind === "min" ? b.lo[axis] : kind === "max" ? b.hi[axis] : (b.lo[axis] + b.hi[axis]) / 2,
                delta = [0, 0, 0];
            delta[axis] = target - current;
            if (Math.abs(delta[axis]) > 1e-7) {
                const ids = new Set(objects.map((o) => o.id));
                objects.forEach((o) =>
                    setOb(o.id, moveBy(o, delta, !!(o.attachment?.parentId && ids.has(o.attachment.parentId)))),
                );
            }
        });
        render();
    }
    list.addEventListener("click", (e) => {
        const b = e.target.closest("[data-object]");
        if (!b) return;
        const id = b.dataset.object,
            chosen = obOf(id);
        if (e.target.closest("[data-object-visibility]")) {
            e.preventDefault();
            setObjectVisibility(id, !objectVisible(chosen));
            return;
        }
        if (chosen && !objectVisible(chosen)) {
            e.preventDefault();
            syncSel();
            render();
            return;
        }
        if (chosen && chosen.type === "asset" && chosen.asset === "person") setStudioWorkspace("character");
        if (e.target.matches("[data-object-check]")) {
            if (e.target.checked) setSelection(id, true);
            else {
                groupMemberIds(id).forEach((member) => selIds.delete(member));
                if (sel === id) sel = [...selIds].pop() || null;
                normalizeSelection();
            }
            tool = "edit";
            setMode("draw");
            syncSel();
            render();
            return;
        }
        setSelection(id, e.shiftKey || e.metaKey || e.ctrlKey);
        tool = "edit";
        setMode("draw");
        syncSel();
        render();
    });
    el("sceneSelectAll").onclick = () => {
        selIds.clear();
        sceneObjects()
            .filter(objectVisible)
            .forEach((o) => selIds.add(o.id));
        sel = [...selIds].pop() || null;
        normalizeSelection();
        tool = "edit";
        setMode("draw");
        syncSel();
        render();
    };
    el("sceneClearSel").onclick = () => {
        clearSelection();
        render();
    };
    el("sceneDeleteSel").onclick = deleteSelectedScene;
    el("sceneDeleteButton").onclick = deleteSelectedScene;
    el("sceneGroupSel").onclick = groupSelectedScene;
    el("sceneUngroupSel").onclick = ungroupSelectedScene;
    el("sceneCombineSel").onclick = combineSelectedScene;
    el("sceneSeparateSel").onclick = separateSelectedScene;
    el("alignApply").onclick = alignSelectedScene;
    // iPadの3本指スワイプ：指先にあるオブジェクトを選び、何もなければ選択対象を順番に切り替える。
    window.cityThreeFingerSelect = (dx, dy, clientX, clientY) => {
        const objects = sceneObjects().filter(objectVisible);
        if (!objects.length) return;
        let hit = null;
        try {
            hit = pickOb(pos({ clientX, clientY }));
        } catch (e) {}
        if (hit) setSelection(hit, false);
        else {
            const curIndex = Math.max(
                    -1,
                    objects.findIndex((o) => o.id === sel),
                ),
                dir = (Math.abs(dx) >= Math.abs(dy) ? dx : dy) < 0 ? 1 : -1;
            setSelection(objects[(curIndex + dir + objects.length) % objects.length].id, false);
        }
        tool = "edit";
        setMode("draw");
        syncSel();
        render();
    };

    // 以前の版でアセット生成に失敗した場合、pのない壊れた線がSに残ることがある。
    // それを先に除去し、以降の図形作成を止めない。
    function validStroke(s) {
        if (!s || Array.isArray(s) || !Array.isArray(s.p) || s.p.length < 1) return false;
        return s.p.every((v) =>
            Array.isArray(v)
                ? v.length >= 3 && v.every(Number.isFinite)
                : v && Number.isFinite(v.x) && Number.isFinite(v.y),
        );
    }
    function sanitizeScene() {
        const clean = S.filter(validStroke);
        if (clean.length !== S.length) {
            S = clean;
            normalizeSelection();
            HU = [];
            RD = [];
            prev = null;
            cur = null;
        }
    }
    sanitizeScene();
    // 以前「空」に保存された線も、現在のカメラ位置から3D線へ移行する。
    // これ以降の描画線は常に3D空間に固定し、視点移動で見え方が変わる。
    function migrateLineArt() {
        const cp = camPos();
        S = S.map((s) => {
            if (!s || s.d3 || !Array.isArray(s.p) || !s.p.length || !Array.isArray(s.p[0])) return s;
            const p = s.p.map((v) => {
                const dir = V.nrm(v),
                    g = hit3(dir, 1, -1, cp);
                return g || V.add(cp, dir, 1, P.dp);
            });
            return { ...s, d3: true, p };
        });
    }
    migrateLineArt();
    el("p3").checked = true;
    el("p3").disabled = true;
    if (el("p3").closest("label")) el("p3").closest("label").style.opacity = ".6";
    const baseUnpack = unpack;
    unpack = function (d) {
        baseUnpack(d);
        migrateLineArt();
        el("p3").checked = true;
        el("p3").disabled = true;
        render();
    };
    try {
        if (!localStorage.getItem("city-grid-v4-floor")) {
            P.floorOn = true;
            P.floorAlpha = 0.24;
            localStorage.setItem("city-grid-v4-floor", "1");
        }
    } catch (e) {}

    let signEditSession = false,
        buildingEditSession = false;
    function syncBuildingPanel() {
        const panel = el("buildingP"),
            o = sel && obOf(sel),
            isBuilding = !!(o && o.type === "asset" && o.asset === "building");
        if (!panel) return;
        panel.style.display = isBuilding ? "" : "none";
        if (!isBuilding) return;
        const g = buildingGeometry(o);
        [
            ["ov_openingW", g.openingW],
            ["ov_openingH", g.openingH],
        ].forEach(([id, v]) => {
            const n = el(id);
            if (n && document.activeElement !== n) n.value = Number(v).toFixed(3);
        });
    }
    function applyBuildingProp(name, v) {
        const o = sel && obOf(sel);
        if (!o || o.type !== "asset" || o.asset !== "building" || !Number.isFinite(v)) return;
        if (!buildingEditSession) {
            HU.push(S);
            RD = [];
            buildingEditSession = true;
        }
        const g = buildingGeometry(o),
            max = name === "openingW" ? g.w - 0.1 : g.h - 0.1,
            patch = {};
        patch[name] = clamp(v, 0.1, Math.max(0.1, max));
        setOb(sel, patch);
        render();
    }
    [
        ["ov_openingW", "openingW"],
        ["ov_openingH", "openingH"],
    ].forEach(([id, name]) => {
        const n = el(id);
        if (!n) return;
        n.oninput = () => applyBuildingProp(name, parseFloat(n.value));
        n.onchange = () => {
            buildingEditSession = false;
        };
    });
    function syncSignPanel() {
        const panel = el("signP"),
            o = sel && obOf(sel),
            isSign = !!(o && o.type === "asset" && o.asset === "sign");
        if (!panel) return;
        panel.style.display = isSign ? "" : "none";
        const ext = el("obExtrude");
        if (ext) ext.disabled = !!o && !(o.type === "rect" || o.type === "circ");
        if (!isSign) return;
        const vals = { faceW: o.faceW ?? 2 * o.ra * 0.7, faceH: o.faceH ?? o.h * 0.34 };
        [
            ["ov_faceW", vals.faceW],
            ["ov_faceH", vals.faceH],
        ].forEach(([id, v]) => {
            const n = el(id);
            if (n && document.activeElement !== n) n.value = Number(v).toFixed(3);
        });
    }
    function applySignProp(name, v) {
        const o = sel && obOf(sel);
        if (!o || o.type !== "asset" || o.asset !== "sign" || !Number.isFinite(v)) return;
        if (!signEditSession) {
            HU.push(S);
            RD = [];
            signEditSession = true;
        }
        const w = 2 * o.ra,
            h = o.h,
            boardH = h * 0.74,
            max = name === "faceW" ? w * 0.9 : boardH * 0.84;
        const patch = {};
        patch[name] = clamp(v, 0.08, max);
        setOb(sel, patch);
        render();
    }
    [
        ["ov_faceW", "faceW"],
        ["ov_faceH", "faceH"],
    ].forEach(([id, name]) => {
        const n = el(id);
        if (!n) return;
        n.oninput = () => applySignProp(name, parseFloat(n.value));
        n.onchange = () => {
            signEditSession = false;
        };
    });
    function syncAssetControls() {
        const o = sel && obOf(sel);
        if (o && o.type === "asset" && o.asset === "stairs") {
            if (document.activeElement !== el("stairsSteps")) el("stairsSteps").value = o.steps || 6;
            el("stairsRail").checked = o.handrail === true;
        }
    }
    // Wrap render so the outliner follows undo/redo, opening files, and camera changes.
    const baseRender = render;
    render = function () {
        sanitizeScene();
        baseRender();
        updateOutliner();
        syncAssetControls();
        syncSignPanel();
        syncBuildingPanel();
        syncFloorControls();
        syncAssetDepth();
        syncAssetAxis();
        syncPersonControls();
        window.cityGridSyncObjectInfoActions?.();
        syncFloorPlanSelection?.();
    };

    // ===== 標準ビューと間取りショートカット（8=間取り横 / 9=間取り真上 / 0=元の視点） =====
    // 標準ビューだけは透視ではなく正投影にし、真横90°・真上90°を正確に扱う。
    const viewKeys = ["lens", "yaw", "hz", "pitch", "fov", "roll", "ch", "cx", "cz"];
    const captureHomeView = () => {
        const v = { gt: el("gt").value, T, orthView };
        viewKeys.forEach((k) => (v[k] = P[k]));
        return v;
    };
    let homeView = null;
    function applyStandardView(kind) {
        standardApplying = true;
        if (kind === "home" && homeView) {
            // 0 3Dへ戻るだけでは、現在選択中のグリッド種類を復元値で上書きしない。
            // homeViewには古いセッションの値が残る場合があるため、gt／Tは現在値を維持する。
            orthView = homeView.orthView || null;
            viewKeys.forEach((k) => {
                if (k in P) setP(k, homeView[k]);
            });
        } else {
            // 視点プリセットを切り替えても、ユーザーが選んだグリッド種類は変更しない。
            const keep = { lens: P.lens, hz: P.hz, ch: P.ch, cx: P.cx, cz: P.cz };
            if (kind === "front") Object.assign(keep, { yaw: 0, pitch: 0 });
            else if (kind === "side") Object.assign(keep, { yaw: 90, pitch: 0 });
            else Object.assign(keep, { yaw: 0, pitch: -90 });
            Object.entries(keep).forEach(([k, v]) => setP(k, v));
            orthView = kind === "front" || kind === "side" || kind === "top" ? kind : null;
        }
        standardApplying = false;
        sync();
        // 0=3Dは視点プリセットだけを切り替える。編集ツールを選択中なら、
        // そのまま3Dギズモを使えるように描画／編集モードを維持する。
        setMode(tool === "edit" ? "draw" : "view");
        render();
    }
    window.cityStandardView = (kind) => applyStandardView(kind);

    // 間取りの投影を切り替える。真上／真横とも、入る前の透視カメラ位置は保持する。
    function setFloorPlanProjection(kind = "top") {
        // 視点切り替えではグリッド種類を変更しない。
        // 正投影はorthViewだけで切り替え、1／2／3点透視・魚眼の選択と設定を保持する。
        const cameraBefore = { lens: P.lens, hz: P.hz, ch: P.ch, cx: P.cx, cz: P.cz, yaw: P.yaw, pitch: P.pitch };
        standardApplying = true;
        // 真上／真横は表示だけを正投影へ切り替え、共有カメラの実値もグリッド種類も変更しない。
        // ここでpitchを0/-90へ固定すると、横で調整した上下の傾きが
        // 「上」へ移った瞬間や0 3Dへ戻った瞬間に失われる。
        const keep = { ...cameraBefore, fov: 180, roll: 0 };
        Object.entries(keep).forEach(([k, v]) => setP(k, v));
        orthView = kind === "side" ? "side" : kind === "front" ? "front" : "top";
        standardApplying = false;
        sync();
        setMode("draw");
        render();
    }
    function showFloorPlan(kind = "top") {
        if (window.cityFloorPlanActive) {
            setFloorPlanProjection(kind);
            fitFloorPlan();
            render();
            return;
        }
        enterFloorPlan(kind);
    }
    el("viewFloorFront").onclick = () => showFloorPlan("front");
    el("viewFloorSide").onclick = () => showFloorPlan("side");
    el("viewFloorTop").onclick = () => showFloorPlan("top");
    el("viewHome").onclick = () => (window.cityFloorPlanActive ? exitFloorPlan(true) : applyStandardView("home"));

    // ===== 間取りモード：真上／真横の正投影でシーンを確認する =====
    let floorPlanView = null,
        floorPlanSideWasHidden = null,
        floorPlanAutoHidSide = false;
    function restoreStudioView(v, preserve = {}) {
        if (!v) {
            applyStandardView("home");
            return;
        }
        standardApplying = true;
        // 間取りから戻るときも、現在のグリッド種類／透視法の選択は保持する。
        // v.gtは保存された表示状態の情報として残すが、視点復帰でUIを2点透視へ戻さない。
        orthView = v.orthView || null;
        viewKeys.forEach((k) => {
            if (k in P) setP(k, k in preserve ? preserve[k] : v[k]);
        });
        standardApplying = false;
        sync();
        // 間取りを閉じても、編集ツールを選択していたら3D編集を続けられるようにする。
        setMode(tool === "edit" ? "draw" : "view");
        render();
    }
    function fitFloorPlan() {
        const objects = sceneObjects().filter(objectVisible),
            bounds = [];
        objects.forEach((o) => {
            try {
                const b = obBounds(o);
                if (
                    b &&
                    b.lo &&
                    b.hi &&
                    Number.isFinite(b.lo[0]) &&
                    Number.isFinite(b.hi[0]) &&
                    Number.isFinite(b.lo[1]) &&
                    Number.isFinite(b.hi[1]) &&
                    Number.isFinite(b.lo[2]) &&
                    Number.isFinite(b.hi[2])
                )
                    bounds.push(b);
            } catch (e) {}
        });
        const fyaw = Number(P.yaw || 0) * DG,
            fpitch = Number(P.pitch || 0) * DG,
            fhoriz = Math.cos(fpitch),
            tx = P.cx - Math.sin(fyaw) * FLOOR_CAMERA_RAY * fhoriz,
            tz = P.cz + Math.cos(fyaw) * FLOOR_CAMERA_RAY * fhoriz,
            ty = P.ch - 1 + Math.sin(fpitch) * FLOOR_CAMERA_RAY;
        if (orthView === "side") {
            // 真横は画面の左右がワールドZ、上下がワールドY。共有カメラの高さ・傾きも含めて自動フィットする。
            if (!bounds.length) {
                window.cityFloorPlanCenter = [P.cz, P.ch - 1];
                window.cityFloorPlanScale = Math.min(W, H) / 7.2;
                return;
            }
            const minZ = Math.min(P.cz, tz, ...bounds.map((b) => b.lo[2])),
                maxZ = Math.max(P.cz, tz, ...bounds.map((b) => b.hi[2]));
            const minY = Math.min(P.ch - 1, ty, ...bounds.map((b) => b.lo[1])),
                maxY = Math.max(P.ch - 1, ty, ...bounds.map((b) => b.hi[1]));
            const spanZ = Math.max(0.1, maxZ - minZ),
                spanY = Math.max(0.1, maxY - minY),
                pad = Math.max(1, Math.max(spanZ, spanY) * 0.16);
            const fitScale = Math.min((W * 0.82) / (spanZ + pad * 2), (H * 0.82) / (spanY + pad * 2));
            window.cityFloorPlanCenter = [(minZ + maxZ) / 2, (minY + maxY) / 2];
            window.cityFloorPlanScale = Math.max(24, Math.min(220, fitScale));
            return;
        }
        if (orthView === "front") {
            // 正面は画面の左右がワールドX、上下がワールドY。
            if (!bounds.length) {
                window.cityFloorPlanCenter = [P.cx, P.ch - 1];
                window.cityFloorPlanScale = Math.min(W, H) / 7.2;
                return;
            }
            const minX = Math.min(P.cx, tx, ...bounds.map((b) => b.lo[0])),
                maxX = Math.max(P.cx, tx, ...bounds.map((b) => b.hi[0]));
            const minY = Math.min(P.ch - 1, ty, ...bounds.map((b) => b.lo[1])),
                maxY = Math.max(P.ch - 1, ty, ...bounds.map((b) => b.hi[1]));
            const spanX = Math.max(0.1, maxX - minX),
                spanY = Math.max(0.1, maxY - minY),
                pad = Math.max(1, Math.max(spanX, spanY) * 0.16);
            const fitScale = Math.min((W * 0.82) / (spanX + pad * 2), (H * 0.82) / (spanY + pad * 2));
            window.cityFloorPlanCenter = [(minX + maxX) / 2, (minY + maxY) / 2];
            window.cityFloorPlanScale = Math.max(24, Math.min(220, fitScale));
            return;
        }
        if (!bounds.length) {
            window.cityFloorPlanCenter = [P.cx, P.cz];
            window.cityFloorPlanScale = Math.min(W, H) / 7.2;
            return;
        }
        const minX = Math.min(P.cx, tx, ...bounds.map((b) => b.lo[0])),
            maxX = Math.max(P.cx, tx, ...bounds.map((b) => b.hi[0])),
            minZ = Math.min(P.cz, tz, ...bounds.map((b) => b.lo[2])),
            maxZ = Math.max(P.cz, tz, ...bounds.map((b) => b.hi[2]));
        const spanX = Math.max(0.1, maxX - minX),
            spanZ = Math.max(0.1, maxZ - minZ),
            pad = Math.max(1, Math.max(spanX, spanZ) * 0.16);
        const fitScale = Math.min((W * 0.82) / (spanX + pad * 2), (H * 0.82) / (spanZ + pad * 2));
        window.cityFloorPlanCenter = [(minX + maxX) / 2, (minZ + maxZ) / 2];
        window.cityFloorPlanScale = Math.max(24, Math.min(220, fitScale));
    }
    function enterFloorPlan(kind = "top") {
        if (!window.cityFloorPlanActive) {
            floorPlanView = captureHomeView();
            floorPlanSideWasHidden = $("side").classList.contains("hide");
            floorPlanAutoHidSide = false;
            window.cityFloorPlanActive = true;
        }
        // iPad / 狭い画面では設定パネルが間取り図を覆わないよう、一度だけ隠す。
        // 左端のタブまたは1キーでいつでも再表示できる。
        if (innerWidth <= 900 && !$("side").classList.contains("hide")) {
            floorPlanAutoHidSide = true;
            setSide(true);
            fit();
        }
        floorPlanDock.classList.add("open");
        syncFloorPlanDockLayout();
        Z = 1;
        ox = 0;
        oy = 0;
        updZ();
        setFloorPlanProjection(kind);
        fitFloorPlan();
        if (tool !== "edit") setTool("edit");
        setMode("draw");
        const status = el("floorPlanStatus");
        if (status)
            status.textContent = `間取りモード中：${kind === "side" ? "真横" : kind === "front" ? "正面" : "真上"}（表示面内でオブジェクトを移動・編集できます）`;
        render();
    }
    function exitFloorPlan(restore = true) {
        if (!window.cityFloorPlanActive) return;
        // 間取り中に変更した共有カメラの位置・高さ・向き・上下の傾き・レンズを3D視点へ引き継ぐ。
        const keepCamera = { yaw: P.yaw, cx: P.cx, cz: P.cz, lens: P.lens, ch: P.ch, pitch: P.pitch };
        window.cityFloorPlanActive = false;
        floorPlanDock.classList.remove("open");
        const saved = floorPlanView,
            restoreSide = floorPlanAutoHidSide && !floorPlanSideWasHidden;
        floorPlanView = null;
        floorPlanSideWasHidden = null;
        floorPlanAutoHidSide = false;
        window.cityFloorPlanCenter = null;
        window.cityFloorPlanScale = null;
        if (restore) restoreStudioView(saved, keepCamera);
        else {
            setMode("view");
            render();
        }
        if (restoreSide) {
            setSide(false);
            fit();
        }
        el("assetTray")?.classList.remove("floorAssetTray");
        syncFloorPlanDockLayout();
        const status = el("floorPlanStatus");
        if (status) status.textContent = "間取りモードを開くと、X・Z方向へドラッグできます";
    }
    window.cityFloorPlanActive = false;
    window.cityFloorPlanEnter = enterFloorPlan;
    window.cityFloorPlanExit = exitFloorPlan;
    window.cityFloorPlanView = showFloorPlan;
    // engine-tools.jsは別スクリプト／別スコープで読み込まれるため、
    // ボックス選択から間取りのドラッグ状態を操作するときはこの橋を使う。
    window.cityFloorPlanGetDrag = () => floorPlanDrag;
    window.cityFloorPlanSetDrag = (value) => {
        floorPlanDrag = value;
    };
    window.cityFloorPlanFit = fitFloorPlan;
    el("openFloorPlan").onclick = () => setStudioWorkspace("floorplan");
    el("closeFloorPlan").onclick = () => setStudioWorkspace("perspective");

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
            floorTouchPan = { mx0: mx, my0: my, center0: [...(window.cityFloorPlanCenter || [0, 0])] };
            e.preventDefault();
            e.stopImmediatePropagation();
            try {
                cv.setPointerCapture(e.pointerId);
            } catch (err) {}
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
        if (floorTouchMax >= 2 && floorTouchPan) {
            const pts = [...floorTouchIds.values()],
                mx = pts.reduce((a, t) => a + t.x, 0) / pts.length,
                my = pts.reduce((a, t) => a + t.y, 0) / pts.length;
            const sc = Math.max(1, Number(orthScale()) || 1),
                dx = mx - floorTouchPan.mx0,
                dy = my - floorTouchPan.my0;
            window.cityFloorPlanCenter = [floorTouchPan.center0[0] - dx / sc, floorTouchPan.center0[1] + dy / sc];
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
        if (floorTouchIds.size) return true;
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
        return true;
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
        '<div class="floorPlanDockInner"><div class="floorPlanDockHeader"><div id="floorPlanDockStatus" class="floorPlanDockStatus">オブジェクトを選択すると、移動・回転・サイズ変更ができます。<small>カメラ本体：位置　／　先端の丸：向き</small></div><div class="floorHistoryButtons"><button type="button" id="floorUndo" class="floorHistoryButton" title="間取りの操作を元に戻す">↶ 元に戻す</button><button type="button" id="floorRedo" class="floorHistoryButton" title="間取りの操作をやり直す">↷ やり直す</button></div><button type="button" class="dockCollapse" data-floor-dock-action="collapse" title="操作バーを折りたたむ">−</button></div><button type="button" data-floor-dock-action="left">↺ 15°</button><button type="button" data-floor-dock-action="right">↻ 15°</button><button type="button" data-floor-dock-action="rot30">30°</button><button type="button" data-floor-dock-action="rot45">45°</button><button type="button" data-floor-dock-action="90">90°回す</button><label class="floorLensTools">レンズ <input id="floorLensInput" type="number" min="14" max="200" step="1"> mm</label><div class="floorPlanPanTools"><span>表示移動</span><button type="button" data-floor-dock-action="pan-up" title="表示を上へ">↑</button><button type="button" data-floor-dock-action="pan-down" title="表示を下へ">↓</button><button type="button" data-floor-dock-action="pan-left" title="表示を左へ">←</button><button type="button" data-floor-dock-action="pan-right" title="表示を右へ">→</button></div><button type="button" data-floor-dock-action="assets">＋アセット</button><button type="button" data-floor-dock-action="delete">片付ける</button><span class="dockHint">中／右ドラッグ：表示移動　・　表示移動ボタン／Alt＋矢印／WASD：キャンバス移動　・　磁石ON：家具移動と幅／奥行の面編集をエッジへ吸着　・　2本指タップ：元に戻す／3本指タップ：やり直す</span></div>';
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
        const q = hit3(unscr(p), 1, -1, [0, 0, 0]);
        return q && Number.isFinite(q[0]) && Number.isFinite(q[2]) ? { x: q[0], z: q[2] } : null;
    }
    // 真横ビューは画面の左右がZ、上下がYなので、床面との交差ではなく
    // 正投影の表示中心・倍率から直接ワールドのZ/Yへ戻す。
    function floorPlanSideWorldAt(p) {
        if (orthView !== "side") return null;
        if (!Array.isArray(window.cityFloorPlanCenter)) fitFloorPlan();
        const sc = Math.max(1, Number(orthScale()) || 1),
            pc = window.cityFloorPlanCenter || [0, 0];
        return { z: (p.x - W / 2) / sc + pc[0], y: -(p.y - H / 2) / sc + pc[1] };
    }
    function floorPlanFrontWorldAt(p) {
        if (orthView !== "front") return null;
        if (!Array.isArray(window.cityFloorPlanCenter)) fitFloorPlan();
        const sc = Math.max(1, Number(orthScale()) || 1),
            pc = window.cityFloorPlanCenter || [0, 0];
        return { x: (p.x - W / 2) / sc + pc[0], y: -(p.y - H / 2) / sc + pc[1] };
    }
    function floorPlanVerticalWorldAt(p) {
        return orthView === "side" ? floorPlanSideWorldAt(p) : orthView === "front" ? floorPlanFrontWorldAt(p) : null;
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
        if (o && o.k === 1) {
            if (o.type === "compound") {
                const b = obBounds(o),
                    base = objectAnchorWorld(o),
                    dist = Math.max(b.hi[0] - b.lo[0], b.hi[2] - b.lo[2], 0.6) * 0.5 + 0.42;
                out.object = { o, base, center: scrW(base), world: { x: base[0], z: base[2] + dist } };
                out.object.s =
                    orthView === "front"
                        ? scrW([base[0] + dist, base[1], base[2]])
                        : scrW([base[0], orthView === "side" ? base[1] : -1, base[2] + dist]);
            } else {
                const [z0, z1] = floorPlanObjectZRange(o),
                    base = L2W(o, 0, 0, z0),
                    mid = L2W(o, 0, 0, (z0 + z1) / 2),
                    a = (Number(o.rot) || 0) * DG,
                    dist = Math.max(Math.abs(Number(o.ra) || 0.3), Math.abs(Number(o.rb) || 0.3)) + 0.42;
                out.object = {
                    o,
                    base,
                    center: scrW(mid),
                    world: { x: base[0] - Math.sin(a) * dist, z: base[2] + Math.cos(a) * dist },
                };
                out.object.s =
                    orthView === "front"
                        ? scrW([base[0] + Math.cos(a) * dist, base[1], base[2]])
                        : scrW([out.object.world.x, orthView === "side" ? base[1] : -1, out.object.world.z]);
            }
        }
        const yaw = Number(P.yaw || 0) * DG,
            pitch = Number(P.pitch || 0) * DG,
            body = { x: P.cx, z: P.cz },
            cameraY = orthView === "side" || orthView === "front" ? P.ch - 1 : -1,
            horiz = Math.cos(pitch),
            target = {
                x: P.cx - Math.sin(yaw) * FLOOR_CAMERA_RAY * horiz,
                z: P.cz + Math.cos(yaw) * FLOOR_CAMERA_RAY * horiz,
            },
            targetY =
                orthView === "side" || orthView === "front" ? cameraY + Math.sin(pitch) * FLOOR_CAMERA_RAY : cameraY,
            half = Math.atan(18 / Math.max(12, Number(P.lens) || 38)),
            lensWorld =
                orthView === "top"
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
                    if (!o || !objectVisible(o) || o.k !== 1) return false;
                    if (o.type === "compound") {
                        const b = obBounds(o);
                        return (
                            w.x >= b.lo[0] - 0.08 &&
                            w.x <= b.hi[0] + 0.08 &&
                            w.z >= b.lo[2] - 0.08 &&
                            w.z <= b.hi[2] + 0.08
                        );
                    }
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
    function floorPlanItemAtSide(p) {
        if (!p) return null;
        return (
            sceneObjects()
                .slice()
                .reverse()
                .find((o) => {
                    if (!o || !objectVisible(o) || o.k !== 1) return false;
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
                    if (!o || !objectVisible(o) || o.k !== 1) return false;
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
        if (orthView === "top") {
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
            const gap = Math.max(
                48 / Z,
                Math.min(88 / Z, Math.max(b.hi[0] - b.lo[0], b.hi[2] - b.lo[2], 0.6) * orthScale() * 0.35),
            );
            addScreen(
                "h",
                "高さ",
                { x: center.x, y: center.y + gap, ok: true },
                { x: 0, y: 1 },
                Math.max(0, b.hi[1] - b.lo[1]),
            );
        } else if (orthView === "side") {
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
        } else if (orthView === "front") {
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
            const gap = Math.max(48 / Z, Math.min(88 / Z, Math.max(b.hi[0] - b.lo[0], 0.6) * orthScale() * 0.35));
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
            point = L2W(o, 0, g.edgeY, g.edgeZ),
            s = scrW(point);
        if (!s.ok) return [];
        const out = [],
            zMin = 0.05,
            zMax = g.h - 0.02,
            yMin = -g.d / 2 + 0.025,
            yMax = g.d / 2 - 0.025;
        if (orthView === "top") {
            const gap = Math.max(48 / Z, Math.min(88 / Z, Math.max(g.w, g.d, 0.6) * orthScale() * 0.35));
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
            const qz = scrW(L2W(o, 0, g.edgeY, g.edgeZ + 0.1));
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
        if (!o.attachment?.verticalOnly) {
            if (orthView === "front") {
                const gap = Math.max(48 / Z, Math.min(88 / Z, Math.max(g.w, g.d, 0.6) * orthScale() * 0.35));
                out.push({
                    kind: "awningEdgeY",
                    label: "前後",
                    s: { x: s.x + gap, y: s.y, ok: true },
                    dir: { x: 1, y: 0 },
                    scale: orthScale(),
                    start: g.edgeY,
                    min: yMin,
                    max: yMax,
                    inner: true,
                    screen: true,
                });
            } else {
                const qy = scrW(L2W(o, 0, g.edgeY + 0.1, g.edgeZ));
                if (qy.ok) {
                    const dx = qy.x - s.x,
                        dy = qy.y - s.y,
                        px = Math.hypot(dx, dy);
                    if (px > 0.01)
                        out.push({
                            kind: "awningEdgeY",
                            label: "前後",
                            s: qy,
                            dir: { x: dx / px, y: dy / px },
                            scale: px / 0.1,
                            start: g.edgeY,
                            min: yMin,
                            max: yMax,
                            inner: true,
                        });
                }
            }
        }
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
        if (orthView === "top") {
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
        } else if (orthView === "front") {
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
        } else if (orthView === "side") {
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
    function floorPlanEditHandles() {
        const o = floorPlanObject();
        if (!o || o.k !== 1) return null;
        if (o.type === "compound") return floorCompoundEditHandles(o);
        const [z0, z1] = floorPlanObjectZRange(o),
            base = L2W(o, 0, 0, z0),
            zc = (z0 + z1) / 2,
            center = scrW(L2W(o, 0, 0, zc)),
            handles = [],
            panel = o.type === "asset" && o.asset === "building" ? floorBuildingBackPanel(o) : null;
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
        if (orthView === "top") {
            // 幅・奥行はプラス側とマイナス側の両面にハンドルを出す。
            add("w", "幅＋", L2W(o, o.ra, 0, 0), L2W(o, o.ra + 0.1, 0, 0), Math.abs(o.ra) * 2, 0.01, 1);
            add("w", "幅−", L2W(o, -o.ra, 0, 0), L2W(o, -o.ra - 0.1, 0, 0), Math.abs(o.ra) * 2, 0.01, -1);
            add("d", "奥行＋", L2W(o, 0, o.rb, 0), L2W(o, 0, o.rb + 0.1, 0), Math.abs(o.rb) * 2, 0.01, 1);
            add("d", "奥行−", L2W(o, 0, -o.rb, 0), L2W(o, 0, -o.rb - 0.1, 0), Math.abs(o.rb) * 2, 0.01, -1);
            // 真上ではY方向が投影されないため、画面上へ高さハンドルを逃がして表示する。
            const gap = Math.max(
                48 / Z,
                Math.min(
                    88 / Z,
                    Math.max(Math.abs(Number(o.ra) || 0.5), Math.abs(Number(o.rb) || 0.5)) * orthScale() * 0.65,
                ),
            );
            handles.push({
                kind: "h",
                label: "高さ",
                s: { x: center.x, y: center.y + gap, ok: true },
                dir: { x: 0, y: 1 },
                scale: orthScale(),
                start: Math.max(0, Number(o.h) || 0),
                min: 0,
                screen: true,
            });
        } else if (orthView === "side") {
            add("d", "奥行＋", L2W(o, 0, o.rb, zc), L2W(o, 0, o.rb + 0.1, zc), Math.abs(o.rb) * 2, 0.01, 1);
            add("d", "奥行−", L2W(o, 0, -o.rb, zc), L2W(o, 0, -o.rb - 0.1, zc), Math.abs(o.rb) * 2, 0.01, -1);
            // 真横ビューは黒い外枠の上端・下端へ高さハンドルを置く。
            // 看板の内部余白を含む全高 h の外側へは逃がさない。
            add("h", "上端", L2W(o, 0, 0, z1), L2W(o, 0, 0, z1 + 0.1), Math.max(0, Number(o.h) || 0), 0, 1);
            add("h", "下端", L2W(o, 0, 0, z0), L2W(o, 0, 0, z0 - 0.1), Math.max(0, Number(o.h) || 0), 0, -1);
        } else if (orthView === "front") {
            // 正面では幅と高さを直接編集し、見えない奥行きは画面上へ逃がしたハンドルで編集する。
            // 正面の幅ハンドルも、看板では黒い外枠の下端へ置く。
            // 全高の底面 z=0 に置くと、看板の外枠から下へ浮いてしまう。
            add("w", "幅＋", L2W(o, o.ra, 0, z0), L2W(o, o.ra + 0.1, 0, z0), Math.abs(o.ra) * 2, 0.01, 1);
            add("w", "幅−", L2W(o, -o.ra, 0, z0), L2W(o, -o.ra - 0.1, 0, z0), Math.abs(o.ra) * 2, 0.01, -1);
            add("h", "上端", L2W(o, 0, 0, z1), L2W(o, 0, 0, z1 + 0.1), Math.max(0, Number(o.h) || 0), 0, 1);
            add("h", "下端", L2W(o, 0, 0, z0), L2W(o, 0, 0, z0 - 0.1), Math.max(0, Number(o.h) || 0), 0, -1);
            const gap = Math.max(
                48 / Z,
                Math.min(
                    88 / Z,
                    Math.max(Math.abs(Number(o.ra) || 0.5), Math.abs(Number(o.h) || 0.6)) * orthScale() * 0.65,
                ),
            );
            handles.push({
                kind: "d",
                label: "奥行き",
                s: { x: center.x + gap, y: center.y, ok: true },
                dir: { x: 1, y: 0 },
                scale: orthScale(),
                start: Math.abs(o.rb) * 2,
                min: 0.01,
                side: 1,
                screen: true,
            });
        }
        if (o.type === "asset" && o.asset === "building") handles.push(...floorBuildingInnerHandles(o));
        if (o.type === "asset" && o.asset === "awning") {
            const edge = floorAwningEdgeHandle(o);
            if (edge.length) handles.push(...edge);
        }
        return { o, base, center, handles, panel };
    }
    // 間取りの白い四角／オレンジ菱形を、近い順に拾う。
    // ここを通らず家具移動へ落ちると、サイズ変更ではなく移動になってしまう。
    function floorPlanEditHandleAt(p) {
        const g = floorPlanEditHandles();
        if (!g?.handles?.length) return null;
        const lim = 20 / Z,
            hit = g.handles
                .map((h) => ({ h, d: Math.hypot(h.s.x - p.x, h.s.y - p.y) }))
                .filter((q) => q.d < lim)
                .sort((a, b) => a.d - b.d)[0];
        return hit ? { g, h: hit.h } : null;
    }
    function floorMoveGizmo(o) {
        if (!o || o.k !== 1) return null;
        const b = obBounds(o),
            centerWorld = [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2],
            center = scrW(centerWorld),
            screenLen = 64 / Z,
            worldLen = Math.max(0.45, Math.min(2.4, screenLen / Math.max(1, Number(orthScale()) || 1)));
        const defs =
            orthView === "top"
                ? [
                      { vec: [1, 0, 0], name: "X", col: "#e8743d" },
                      { vec: [0, 0, 1], name: "Z", col: "#2fb5a5" },
                      { vec: [0, 1, 0], name: "Y", col: "#4a7be8", screenDir: { x: 0, y: -1 } },
                  ]
                : orthView === "side"
                  ? [
                        { vec: [0, 0, 1], name: "Z", col: "#2fb5a5" },
                        { vec: [0, 1, 0], name: "Y", col: "#4a7be8" },
                        { vec: [1, 0, 0], name: "X", col: "#e8743d", screenDir: { x: 1, y: 0 } },
                    ]
                  : [
                        { vec: [1, 0, 0], name: "X", col: "#e8743d" },
                        { vec: [0, 1, 0], name: "Y", col: "#4a7be8" },
                        { vec: [0, 0, 1], name: "Z", col: "#2fb5a5", screenDir: { x: 1, y: 0 } },
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
                        scale: Math.max(1, Number(orthScale()) || 1),
                    };
                if (!q.ok || px < 4) return null;
                return { ...d, sT: q, screen: false, scale: px / worldLen || 1 };
            })
            .filter(Boolean);
        return { centerWorld, center, axes };
    }
    function floorMoveHandleAt(p) {
        const o = floorPlanObject(),
            g = floorMoveGizmo(o);
        if (!g) return null;
        const lim = 18 / Z;
        for (const a of g.axes) if (segd(p, g.center, a.sT) < lim) return { g, a };
        return null;
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
            c.fillText(a.name, a.sT.x + ux * h + 4 / Z, a.sT.y + uy * h + 4 / Z);
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
            const orange = h.kind === "buildingBackFace" || h.kind === "awningEdgeZ" || h.kind === "awningEdgeY",
                col = orange ? "#ffb36f" : "#66e3c8",
                fill = orange ? "#ffd0a8" : "#d9fff6";
            c.strokeStyle = orange ? "rgba(255,179,111,.88)" : "rgba(102,227,200,.85)";
            c.fillStyle = col;
            c.lineWidth = 1.2 / Z;
            c.setLineDash([4 / Z, 3 / Z]);
            c.beginPath();
            c.moveTo(g.center.x, g.center.y);
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
            c.fillStyle = fill;
            c.fillText(h.label, h.s.x + 8 / Z, h.s.y - 7 / Z);
        });
        c.restore();
    }
    function drawFloorPlanOverlay(c) {
        if (orthView !== "top" && orthView !== "side" && orthView !== "front") return;
        const h = floorPlanHandles(),
            r = 9 / Z;
        c.save();
        c.lineCap = "round";
        c.lineJoin = "round";
        // 選択中オブジェクト：前側の回転ハンドルと薄い外枠
        if (h.object) {
            const o = h.object.o,
                [z0, z1] = floorPlanObjectZRange(o),
                corners = [
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
            corners.forEach(([x, y], i) => {
                const p = L2W(o, x, y, z0),
                    q = scrW(p);
                i ? (q.ok ? c.lineTo(q.x, q.y) : null) : c.moveTo(q.x, q.y);
            });
            c.stroke();
            c.setLineDash([]);
            if (orthView === "side" && z1 > z0) {
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
            } else if (orthView === "front") {
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
            drawFloorPlanEditHandles(c);
        }
        // カメラ：本体をドラッグして位置、先端の丸をドラッグして向き
        const k = h.camera,
            half = Math.atan(18 / Math.max(12, Number(P.lens) || 38)),
            body = k.sBody,
            target = k.sTarget,
            cameraY = orthView === "side" || orthView === "front" ? P.ch - 1 : -1,
            horiz = Math.cos(k.pitch),
            coneY =
                orthView === "side" || orthView === "front" ? cameraY + Math.sin(k.pitch) * FLOOR_CAMERA_RAY : cameraY,
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
            c.fillStyle = "#ffe6a1";
            c.font = `bold ${10 / Z}px system-ui`;
            c.fillText("レンズ", q.x + 8 / Z, q.y - 7 / Z);
        }
        c.restore();
    }
    window.cityFloorPlanOverlay = drawFloorPlanOverlay;
    function syncFloorPlanSelection() {
        const o = floorPlanObject(),
            ground = !!(o && o.k === 1),
            label = o ? (o.type === "asset" ? assetLabel(o) || "アセット" : "図形") : "オブジェクト";
        const text = o
            ? ground
                ? `${label} を選択中（向き ${Math.round(angle360(o.rot))}°）`
                : `${label} を選択中（壁面オブジェクトは間取りでは表示のみ）`
            : "オブジェクトを選択すると、移動・回転できます。";
        const status = el("floorPlanSelectionStatus");
        if (status) status.textContent = text;
        const dockStatus = el("floorPlanDockStatus");
        if (dockStatus) {
            const cameraHint =
                orthView === "side"
                    ? "真横：カメラ本体＝位置・高さ　／　先端の丸＝上下の傾き"
                    : orthView === "front"
                      ? "正面：カメラ本体＝X位置・高さ　／　先端の丸＝上下の傾き"
                      : "カメラ本体：位置　／　先端の丸＝向き";
            dockStatus.innerHTML = `${text}<small>幅・奥行ハンドルは反対側の面を固定　／　${cameraHint}</small>`;
        }
        [
            ["floorRotateLeft", ground],
            ["floorRotateRight", ground],
            ["floorRotate90", ground],
            ["floorDelete", !!o],
        ].forEach(([id, on]) => {
            const b = el(id);
            if (b) b.disabled = !on;
        });
        floorPlanDock.querySelectorAll("[data-floor-dock-action]").forEach((b) => {
            const a = b.dataset.floorDockAction;
            b.disabled = a === "delete" ? !o : ["left", "right", "rot30", "rot45", "90"].includes(a) ? !ground : false;
        });
        const undoButton = el("floorUndo"),
            redoButton = el("floorRedo");
        if (undoButton) undoButton.disabled = !HU.length;
        if (redoButton) redoButton.disabled = !RD.length;
        const lensInput = el("floorLensInput");
        if (lensInput && document.activeElement !== lensInput) lensInput.value = Number(P.lens || 35).toFixed(0);
    }
    function floorDimensionPatch(o, name, value, side = 1) {
        const v = Math.max(name === "h" ? 0 : 0.01, Number(value));
        if (!Number.isFinite(v)) return null;
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
    function rotateFloorSelected(deg) {
        const o = floorPlanObject();
        if (!o || o.k !== 1) return;
        HU.push(S);
        RD = [];
        setOb(o.id, { rot: angle360((Number(o.rot) || 0) + deg) });
        render();
    }
    function moveFloorSelected(dx, dz) {
        const selected = selectedObjects().filter((o) => o.k === 1),
            o = selected.find((q) => q.id === sel) || selected[0],
            objects = o?.attachment?.verticalOnly ? [o] : selected;
        if (!o || !objects.length) return;
        HU.push(S);
        RD = [];
        snapHit = null;
        let delta, axes;
        if (orthView === "side") {
            delta = [0, dz, dx];
            axes = [1, 2];
        } else if (orthView === "front") {
            delta = [dx, dz, 0];
            axes = [0, 1];
        } else {
            delta = [dx, 0, dz];
            axes = [0, 2];
        }
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
            center0: [...(window.cityFloorPlanCenter || [0, 0])],
            tapClear,
            moved: false,
        };
        try {
            cv.setPointerCapture(e.pointerId);
        } catch (err) {}
    }
    function beginFloorBoxPending(e, p) {
        if (!Array.isArray(window.cityFloorPlanCenter)) fitFloorPlan();
        e.preventDefault();
        e.stopImmediatePropagation();
        floorPlanDrag = { kind: "boxPending", pointerId: e.pointerId };
        armBoxPending(p, e.pointerId, "floor", {
            center0: [...(window.cityFloorPlanCenter || [0, 0])],
            tapClear: true,
        });
        try {
            cv.setPointerCapture(e.pointerId);
        } catch (err) {}
    }
    cv.addEventListener(
        "contextmenu",
        (e) => {
            if (window.cityFloorPlanActive) e.preventDefault();
        },
        true,
    );
    cv.addEventListener(
        "pointerdown",
        (e) => {
            if (!window.cityFloorPlanActive) return;
            if (floorTouchDown(e)) return;
            const p = pos(e),
                panGesture = e.button === 1 || e.button === 2 || e.altKey || floorPlanPanMode;
            if (panGesture && (orthView === "top" || orthView === "side")) {
                beginFloorPan(e, p);
                return;
            }
            // 看板の絵枠ハンドルは通常の3Dギズモと同じ編集経路へ渡す。
            // これを家具の間取り判定より後にすると、横／上ビューで本体移動として処理される。
            if (tool === "edit" && sel) {
                const special = hitGizmo(p);
                if (
                    special &&
                    (special.t.startsWith("sign-") || (special.t === "face" && special.g?.o?.asset === "sign"))
                ) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    ptr = e.pointerId;
                    ptrType = e.pointerType;
                    beginGizmo(special, p);
                    try {
                        cv.setPointerCapture(e.pointerId);
                    } catch (err) {}
                    syncSel();
                    render();
                    return;
                }
            }
            const resize = floorPlanEditHandleAt(p);
            // 7 前も9 上・8 横と同じ面編集ハンドルを先に受け取る。
            // ここから漏れると、ハンドルを押してもオブジェクト移動として処理される。
            if (resize && (orthView === "top" || orthView === "side" || orthView === "front")) {
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
                try {
                    cv.setPointerCapture(e.pointerId);
                } catch (err) {}
                return;
            }
            const moveHandle = floorMoveHandleAt(p),
                moveObject = floorPlanObject();
            if (
                moveHandle &&
                moveObject &&
                moveObject.k === 1 &&
                (orthView === "top" || orthView === "side" || orthView === "front")
            ) {
                const base = objectAnchorWorld(moveObject),
                    group = moveObject.attachment?.verticalOnly
                        ? [moveObject]
                        : selectedObjects().filter((o) => o.k === 1),
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
                try {
                    cv.setPointerCapture(e.pointerId);
                } catch (err) {}
                return;
            }
            if (orthView === "side" || orthView === "front") {
                const verticalHandles = floorPlanHandles(),
                    verticalLim = 22 / Z,
                    verticalAxis = orthView === "side" ? "side" : "front";
                if (
                    verticalHandles.camera &&
                    Math.hypot(verticalHandles.camera.sTarget.x - p.x, verticalHandles.camera.sTarget.y - p.y) <
                        verticalLim
                ) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    floorPlanDrag = { kind: "aimSide", axis: verticalAxis, pointerId: e.pointerId };
                    try {
                        cv.setPointerCapture(e.pointerId);
                    } catch (err) {}
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
                        dx: orthView === "front" ? P.cx - w.x : 0,
                        dz: orthView === "side" ? P.cz - w.z : 0,
                        dy: P.ch - 1 - w.y,
                    };
                    try {
                        cv.setPointerCapture(e.pointerId);
                    } catch (err) {}
                    return;
                }
            }
            if (orthView === "side" || orthView === "front") {
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
                        group = hit.attachment?.verticalOnly ? [hit] : selectedObjects().filter((o) => o.k === 1),
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
                        axis: orthView === "side" ? "side" : "front",
                        pointerId: e.pointerId,
                        id: hit.id,
                        o0: { ...hit, off: [...(hit.off || [0, 0, 0])] },
                        group,
                        base0: base,
                        bb: snap.bb,
                        targets: snap.targets,
                        tau: snap.tau,
                        dx: orthView === "front" ? base[0] - w.x : 0,
                        dz: orthView === "side" ? base[2] - w.z : 0,
                        dy: base[1] - w.y,
                        started: false,
                    };
                    try {
                        cv.setPointerCapture(e.pointerId);
                    } catch (err) {}
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
                try {
                    cv.setPointerCapture(e.pointerId);
                } catch (err) {}
                return;
            }
            if (h.camera && Math.hypot(h.camera.sTarget.x - p.x, h.camera.sTarget.y - p.y) < lim) {
                e.preventDefault();
                e.stopImmediatePropagation();
                floorPlanDrag = { kind: "aim", pointerId: e.pointerId };
                try {
                    cv.setPointerCapture(e.pointerId);
                } catch (err) {}
                return;
            }
            if (h.camera && Math.hypot(h.camera.sBody.x - p.x, h.camera.sBody.y - p.y) < lim) {
                const w = floorPlanWorldAt(p);
                if (!w) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                floorPlanDrag = { kind: "camera", pointerId: e.pointerId, dx: P.cx - w.x, dz: P.cz - w.z };
                try {
                    cv.setPointerCapture(e.pointerId);
                } catch (err) {}
                return;
            }
            if (
                orthView === "top" &&
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
                try {
                    cv.setPointerCapture(e.pointerId);
                } catch (err) {}
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
                    group = hit.attachment?.verticalOnly ? [hit] : selectedObjects().filter((o) => o.k === 1),
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
                try {
                    cv.setPointerCapture(e.pointerId);
                } catch (err) {}
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
                const p = pos(e),
                    sc = Math.max(1, Number(orthScale()) || 1),
                    dx = p.x - floorPlanDrag.p0.x,
                    dy = p.y - floorPlanDrag.p0.y;
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
                const patch = h.inner
                    ? h.kind === "buildingOpeningH"
                        ? { openingH: value }
                        : h.kind === "buildingBackFace"
                          ? { openingBack: value }
                          : h.kind === "awningEdgeZ"
                            ? { awningEdgeZ: value, awningFrontBottom: h.frontBottom, awningEdgeEdited: true }
                            : h.kind === "awningEdgeY"
                              ? { awningEdgeY: value, awningEdgeEdited: true }
                              : { openingW: value }
                    : floorResizeSnap(o, floorDimensionPatch(o, h.kind, value, h.side || 1), h, value);
                if (patch) {
                    if (!floorPlanDrag.started) {
                        HU.push(S);
                        RD = [];
                        floorPlanDrag.started = true;
                    }
                    setOb(o.id, patch);
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
                if (o && o.k === 1) {
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
            const w = floorPlanWorldAt(pos(e));
            if (!w) return;
            if (floorPlanDrag.kind === "turn") {
                const o = obOf(floorPlanDrag.id);
                if (o && o.k === 1) {
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
                if (o && o.k === 1) {
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

    // ===== Camera / scale presets =====
    function setValues(values) {
        Object.entries(values).forEach(([k, v]) => {
            if (k in P) setP(k, v);
        });
        sync();
        render();
    }
    function preset(name) {
        // カメラプリセットは視点だけを変更し、グリッド種類は現在の選択を保持する。
        if (name === "alley") {
            setValues({ lens: 38, yaw: 39.912, hz: 50, pitch: 0, ch: 1.62, cx: 0, cz: 0 });
            el("bgw").checked = true;
            el("pc").value = "#222222";
        } else if (name === "top") {
            // 添付された街並みのような、地面を広く見渡す見下ろし視点。
            setValues({ lens: 35, yaw: 39.912, hz: 52, pitch: -57, ch: 4.2, cx: 0, cz: 0 });
            el("bgw").checked = true;
            el("pc").value = "#222222";
        } else if (name === "three") {
            setValues({ lens: 42, yaw: 39.912, hz: 52, pitch: 27, ch: 2.3, cx: 0, cz: 0 });
            el("bgw").checked = true;
            el("pc").value = "#222222";
        } else {
            setValues({ lens: 45, yaw: 0, hz: 50, pitch: 0, ch: 1.6, cx: 0, cz: 0 });
            el("bgw").checked = true;
            el("pc").value = "#222222";
        }
        render();
    }

    // ===== User camera / settings presets =====
    const STUDIO_PRESET_KEY = "city-grid-studio-presets-v1";
    const studioPresetNameInput = el("studioPresetName"),
        studioPresetSelect = el("studioPresetSelect");
    // オブジェクトを除く、カメラ・グリッド・補助線・ペン・消しゴム・表示設定をまとめて保存する。
    const presetCheckIds = ["gon", "hzl", "bgw", "bin", "zf", "gg", "p3", "snp", "pn"];
    const presetSelectIds = ["snap", "em"];
    function readStudioPresets() {
        try {
            const a = JSON.parse(localStorage.getItem(STUDIO_PRESET_KEY) || "[]");
            return Array.isArray(a) ? a : [];
        } catch (e) {
            return [];
        }
    }
    function writeStudioPresets(a) {
        try {
            localStorage.setItem(STUDIO_PRESET_KEY, JSON.stringify(a));
            return true;
        } catch (e) {
            return false;
        }
    }
    function captureStudioPreset(name) {
        const checks = {},
            selects = {};
        presetCheckIds.forEach((id) => {
            const n = el(id);
            if (n) checks[id] = !!n.checked;
        });
        presetSelectIds.forEach((id) => {
            const n = el(id);
            if (n) selects[id] = n.value;
        });
        const ui = {
            sideHidden: el("side")?.classList.contains("hide") || false,
            details: [...document.querySelectorAll("#side details")].map((d) => !!d.open),
            trayOpen: el("assetTray")?.style.display === "block",
            workspace: quick?.querySelector("[data-workspace-tab].active")?.dataset.workspaceTab || "perspective",
        };
        const strokes = S.filter((s) => !s?.ob).map((s) => JSON.parse(JSON.stringify(s)));
        return {
            name: name || "名称未設定",
            version: 3,
            P: { ...P },
            gt: el("gt").value,
            orthView: orthView || null,
            mode,
            tool,
            ar: el("ar").value,
            show: [...show],
            checks,
            selects,
            snap: el("snap").value,
            pc: el("pc").value,
            cr: CR ? { ...CR } : null,
            zoom: { Z, ox, oy },
            photo: typeof IMGsrc === "string" && IMGsrc.startsWith("data:") ? IMGsrc : null,
            strokes,
            ui,
            floorActive: !!window.cityFloorPlanActive,
            floorCenter: Array.isArray(window.cityFloorPlanCenter) ? [...window.cityFloorPlanCenter] : null,
            floorScale: Number(window.cityFloorPlanScale) || null,
        };
    }
    function refreshStudioPresetList(selected = "") {
        if (!studioPresetSelect) return;
        const list = readStudioPresets();
        studioPresetSelect.textContent = "";
        if (!list.length) {
            const empty = document.createElement("option");
            empty.value = "";
            empty.textContent = "まだありません";
            studioPresetSelect.appendChild(empty);
        } else
            list.forEach((p) => {
                const option = document.createElement("option");
                option.value = String(p.name);
                option.textContent = String(p.name);
                studioPresetSelect.appendChild(option);
            });
        if (selected && list.some((p) => p.name === selected)) studioPresetSelect.value = selected;
    }
    function applyStudioPreset(d) {
        if (!d) return;
        if (window.cityFloorPlanActive) window.cityFloorPlanExit?.(true);
        if (d.ar != null) {
            el("ar").value = d.ar;
            el("ar").onchange();
        }
        if (d.gt != null) {
            el("gt").value = d.gt;
            applyType(d.gt);
        }
        if (d.P)
            Object.keys(d.P).forEach((k) => {
                if (k in P && d.P[k] != null) setP(k, d.P[k]);
            });
        // 3Dオブジェクトは現在のシーンを維持し、プリセット側に保存した線画だけを復元する。
        if (Array.isArray(d.strokes)) {
            const objects = S.filter((s) => s?.ob);
            S = [...d.strokes.map((s) => JSON.parse(JSON.stringify(s))), ...objects];
        }
        if (Array.isArray(d.show))
            d.show.forEach((v, i) => {
                if (i < show.length) {
                    show[i] = !!v;
                    const n = document.querySelector('[data-i="' + i + '"]');
                    if (n) n.checked = !!v;
                }
            });
        if (d.checks)
            Object.entries(d.checks).forEach(([id, v]) => {
                const n = el(id);
                if (n) n.checked = !!v;
            });
        if (d.selects)
            Object.entries(d.selects).forEach(([id, v]) => {
                const n = el(id);
                if (n && v != null) n.value = v;
            });
        if (d.snap != null) el("snap").value = d.snap;
        if (d.pc != null) el("pc").value = d.pc;
        if (d.cr !== undefined) CR = d.cr ? { ...d.cr } : null;
        if (d.zoom && Number.isFinite(Number(d.zoom.Z))) {
            Z = clamp(Number(d.zoom.Z), 1, 10);
            ox = Number(d.zoom.ox) || 0;
            oy = Number(d.zoom.oy) || 0;
            updZ();
        }
        if ("photo" in d) {
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
        }
        orthView = d.orthView || null;
        tool = d.tool === "shape" ? "edit" : d.tool || tool;
        if (d.ui) {
            if (Array.isArray(d.ui.details))
                document.querySelectorAll("#side details").forEach((section, i) => {
                    if (i < d.ui.details.length) section.open = !!d.ui.details[i];
                });
            if (typeof d.ui.sideHidden === "boolean") {
                setSide(d.ui.sideHidden);
                fit();
            }
            const tray = el("assetTray");
            if (tray && typeof d.ui.trayOpen === "boolean") {
                tray.style.display = d.ui.trayOpen ? "block" : "none";
                el("assetToggle")?.classList.toggle("on", d.ui.trayOpen);
                tray.classList.toggle("floorAssetTray", !!window.cityFloorPlanActive && d.ui.trayOpen);
            }
        }
        sync();
        if (d.floorActive) {
            window.cityFloorPlanEnter?.(orthView === "side" ? "side" : orthView === "front" ? "front" : "top");
            if (Array.isArray(d.floorCenter)) window.cityFloorPlanCenter = [...d.floorCenter];
            if (Number.isFinite(d.floorScale)) window.cityFloorPlanScale = d.floorScale;
            if (d.ui?.workspace === "floorplan") {
                quick
                    .querySelectorAll("[data-workspace-tab]")
                    .forEach((b) => b.classList.toggle("active", b.dataset.workspaceTab === "floorplan"));
                quick.querySelectorAll("[data-workspace-screen]").forEach((screen) => {
                    screen.hidden = screen.dataset.workspaceScreen !== "floorplan";
                });
            }
            setMode(d.mode === "view" ? "view" : "draw");
            render();
        } else {
            if (d.ui?.workspace && window.cityStudioWorkspace) window.cityStudioWorkspace(d.ui.workspace);
            setMode(d.mode === "draw" ? "draw" : "view");
            render();
        }
    }
    el("studioPresetSave").onclick = () => {
        const name = (studioPresetNameInput.value || "").trim() || `プリセット ${readStudioPresets().length + 1}`;
        const list = readStudioPresets().filter((p) => p.name !== name);
        list.push(captureStudioPreset(name));
        if (writeStudioPresets(list)) {
            studioPresetNameInput.value = name;
            refreshStudioPresetList(name);
        }
    };
    el("studioPresetLoad").onclick = () => {
        const name = studioPresetSelect.value,
            p = readStudioPresets().find((q) => q.name === name);
        if (p) applyStudioPreset(p);
    };
    el("studioPresetDelete").onclick = () => {
        const name = studioPresetSelect.value;
        if (!name) return;
        const list = readStudioPresets().filter((p) => p.name !== name);
        if (writeStudioPresets(list)) refreshStudioPresetList();
    };
    studioPresetSelect.onchange = () => {
        const p = readStudioPresets().find((q) => q.name === studioPresetSelect.value);
        if (p) studioPresetNameInput.value = p.name;
    };
    refreshStudioPresetList();

    // ===== Common lens buttons =====
    quick.querySelectorAll("[data-lens-preset]").forEach(
        (b) =>
            (b.onclick = () => {
                setP("lens", Number(b.dataset.lensPreset));
                sync();
                render();
            }),
    );
    quick.querySelectorAll("[data-preset]").forEach((b) => (b.onclick = () => preset(b.dataset.preset)));
    el("applyHuman").onclick = () => {
        const h = Math.max(0.5, Math.min(10, parseFloat(humanInput.value) || 1.7));
        P.hm = h;
        humanInput.value = h.toFixed(2);
        const people = sceneObjects().filter((o) => o.type === "asset" && o.asset === "person");
        if (people.length) {
            HU.push(S);
            RD = [];
            people.forEach((o) => {
                const body = Number(o.bodyScale) || 1,
                    shoulder = Number(o.shoulderScale) || 1;
                setOb(o.id, { h, ra: h * 0.135 * body * shoulder, rb: h * 0.088 * body });
            });
        }
        render();
    };
    humanInput.onchange = () => {
        P.hm = Math.max(0.5, Math.min(10, parseFloat(humanInput.value) || 1.7));
        humanInput.value = P.hm.toFixed(2);
    };
    el("eyeHeight").onclick = () => {
        P.ch = Math.max(0.3, P.hm * 0.93);
        sync();
        render();
    };
    el("applyStairs").onclick = () => {
        const o = sel && obOf(sel);
        if (!o || o.type !== "asset" || o.asset !== "stairs") {
            alert("先に編集モードで階段を選択してください");
            return;
        }
        const steps = Math.max(2, Math.min(24, Math.round(Number(el("stairsSteps").value) || 6))),
            handrail = !!el("stairsRail").checked;
        HU.push(S);
        RD = [];
        setOb(o.id, { steps, handrail });
        render();
    };

    // Reference image convenience. The supplied image is copied beside this HTML as reference-cyberpunk.jpg.
    el("sampleRef").onclick = () => {
        const im = new Image();
        im.onload = () => {
            IMG = im;
            IMGsrc = null;
            render();
        };
        im.onerror = () =>
            alert("reference-cyberpunk.jpg が見つかりません。左の「参考写真」から画像を選んでください。");
        im.src = "reference-cyberpunk.jpg";
    };
    el("clearRef").onclick = () => el("phx").click();

    // ===== Compact export / help UI =====
    el("exportToggle").onclick = (e) => {
        e.stopPropagation();
        setExportOpen(!el("exportMenu").classList.contains("open"));
        el("helpPanel")?.style.setProperty("display", "none");
    };
    document.addEventListener("pointerdown", (e) => {
        if (!e.target.closest("#exportMenu") && !e.target.closest("#exportToggle")) setExportOpen(false);
    });
    const help = document.createElement("div");
    help.id = "helpPanel";
    help.innerHTML =
        '<div class="helpTitle">操作のコツ</div><div><span class="helpKey">Pencil</span>線を引く　<span class="helpKey">指</span>視点・ピンチ</div><div><span class="helpKey">⌘ Z</span>元に戻す　<span class="helpKey">E</span>消しゴム</div><div><span class="helpKey">図形</span>ドラッグで床・壁に配置</div><div><span class="helpKey">編集</span>線を選択 → 矢印移動／白い四角で拡縮／輪で回転</div><div style="margin-top:7px;color:#7f999c">アセットを追加したあと、編集モードでBlender風ギズモを使えます。人物は基準身長から作られます。</div>';
    el("main").appendChild(help);
    el("helpToggle").onclick = () => {
        help.style.display = help.style.display === "block" ? "none" : "block";
        setExportOpen(false);
    };

    // A first-run cyberpunk treatment; the controls remain fully editable in the sidebar.
    let v2Seen = false,
        hasAuto = false,
        sidePref = "";
    try {
        v2Seen = !!localStorage.getItem("city-grid-v2-seen");
        hasAuto = !!localStorage.getItem("pgrid-autosave-v1");
        sidePref = localStorage.getItem("pgrid-side") || "";
    } catch (e) {}
    if (!v2Seen && !hasAuto) {
        el("bgw").checked = true;
        el("pc").value = "#222222";
        P.ch = 1.62;
        el("ch").value = P.ch;
        try {
            localStorage.setItem("city-grid-v2-seen", "1");
        } catch (e) {}
    }
    // Existing sessions may already have the dark first-run flag. Migrate once to the white drawing background.
    let whiteMigrated = false;
    try {
        whiteMigrated = !!localStorage.getItem("city-grid-v3-white");
    } catch (e) {}
    if (!whiteMigrated) {
        el("bgw").checked = true;
        el("pc").value = "#222222";
        try {
            localStorage.setItem("city-grid-v3-white", "1");
        } catch (e) {}
    }
    // 旧版の初期値2.5pxを、今回の標準1.5pxへ一度だけ移行する。
    let lineWidthMigrated = false;
    try {
        lineWidthMigrated = !!localStorage.getItem("city-grid-v6-line-width");
    } catch (e) {}
    if (!lineWidthMigrated) {
        if (Math.abs(Number(P.pw) - 2.5) < 1e-6) P.pw = MASTER_W;
        const pwEl = el("pw");
        if (pwEl) pwEl.value = P.pw;
        sync();
        try {
            localStorage.setItem("city-grid-v6-line-width", "1");
        } catch (e) {}
    }
    let lensDefaultMigrated = false;
    try {
        lensDefaultMigrated = !!localStorage.getItem("city-grid-v7-lens-50");
    } catch (e) {}
    if (!lensDefaultMigrated) {
        if (Math.abs(Number(P.lens) - 35) < 1e-6) P.lens = 50;
        sync();
        try {
            localStorage.setItem("city-grid-v7-lens-50", "1");
        } catch (e) {}
    }
    homeView = captureHomeView();
    if (innerWidth <= 900 && !sidePref) setSide(true);
    window.cityGridStudioBridge = {
        el,
        stage,
        setStudioWorkspace,
        validStroke,
        sanitizeScene,
        fitFloorPlan,
        syncFloorPlanDockLayout,
        sceneObjects,
        syncAssetAxis: () => syncAssetAxis(),
    };
    if (window.cityGridInstallAssetUI) window.cityGridInstallAssetUI(window.cityGridStudioBridge);
    updateOutliner();
    render();
})();
