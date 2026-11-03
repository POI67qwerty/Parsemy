/* City Grid Studio studio layer — UI, gestures, floor tools and asset library.
   このファイルは画面UIとユーザー操作をまとめるコントローラ層。

   主な担当
   - workspace / quick panel : 人物・ポーズ・間取り・視点の画面切り替え
   - scene / asset panel     : オブジェクト一覧、固有パネル、配置UI
   - floor plan              : 正面・横・上の選択、移動、回転、寸法編集
   - presets / touch         : カメラプリセットとタッチジェスチャー

   エンジンの共有状態・座標計算は engine-core.js、ギズモ本体は
   engine-gizmo.js / engine-render.js / engine-input.js / engine-io.js、アセット生成とJSON処理は asset.js / asset-controller.js が担当する。 */
(function () {
    "use strict";
    // studio-lib.js が用意した共有の道具箱（el / side / stage / capturePointer / orthHandleGap）。
    const SH = (window.CityGridStudio = window.CityGridStudio || {});
    const el = SH.el,
        side = SH.side,
        stage = SH.stage,
        capturePointer = SH.capturePointer,
        orthHandleGap = SH.orthHandleGap;

    // ===== 1. クイック操作パネルと作業画面 =====
    // HTMLの既存サイドバーへ、人物・ポーズ・間取り・視点の操作UIを追加する。
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
      <div class="quickField"><span>腰の回転</span><input id="personWaist" type="number" min="-60" max="60" step="1" value="0"><em>°</em></div>
      <div class="quickField"><span>首の回転</span><input id="personNeck" type="number" min="-40" max="40" step="1" value="0"><em>°</em></div>
      <div class="quickField"><span>左股関節</span><input id="personHipL" type="number" min="-80" max="80" step="1" value="0"><em>°</em></div>
      <div class="quickField"><span>右股関節</span><input id="personHipR" type="number" min="-80" max="80" step="1" value="0"><em>°</em></div>
      <div class="quickField"><span>左膝</span><input id="personKneeL" type="number" min="0" max="120" step="1" value="0"><em>°</em></div>
      <div class="quickField"><span>右膝</span><input id="personKneeR" type="number" min="0" max="120" step="1" value="0"><em>°</em></div>
      <div class="quickRow"><button id="applyPersonPoseDetail" class="primary">ポーズを微調整</button></div>
      <div class="sceneNote">プリセット後に歩幅・しゃがみ量・体の傾き・頭の傾きを調整できます。腰・首・股関節・膝の角度は3Dビューの関節ギズモ（丸ハンドル）でも回せます。身長・体型は保持されます。</div>
    </section>

    <section class="workspaceScreen" data-workspace-screen="floorplan" hidden>
      <div class="screenLead">家具・カメラを平面で編集<small id="floorPlanStatus">間取りモードを開くと、X・Z方向へドラッグできます</small></div>
      <div class="quickRow"><button id="openFloorPlan" class="primary">開く</button><button id="closeFloorPlan">3Dへ戻る</button></div>
      <div id="floorPlanSelectionStatus" class="sceneNote">未選択</div>
      <div class="quickRow floorPlanRotateRow"><button id="floorRotateLeft" disabled>↺</button><button id="floorRotateRight" disabled>↻</button><button id="floorRotate90" disabled>90°</button><button id="floorDelete" disabled>削除</button></div>
      <div class="sceneNote">間取りでは全ての生成面のオブジェクトをドラッグ移動できます。正面・上・横の移動ギズモ、選択中の前側の丸をドラッグした回転、カメラ本体のドラッグ移動、先端の丸のドラッグで向きの変更ができます。回転は3本のリング（上下＝オレンジの破線／左右＝X／手前奥＝Y）をドラッグすると15°刻み（30°・45°・90°も選べ）、Shiftを押しながらドラッグすると自由な角度です。矢印キーで移動、Q/Eで15°ずつ回転します。幅・奥行き・高さの編集も生成面に関係なく利用できます。テントの前縁Yを一番下まで下げる／前後を一番奥まで寄せると、断面が三角形の三角柱になります。接続テントは接着を保つため本体の移動は上下方向に制限されますが、テントの形（前縁Y＝上下＋手前奥、前後）は店舗テントと同じように編集できます。横壁看板は上下＋壁沿いの前後方向へ移動できます。壁付きベランダとコの字壁は、腰壁（コの字壁は前面の壁）の外側面にあるオレンジの四角をドラッグしても厚さを変えられます。ベランダは床と壁が同じ厚さで、厚くすると全体の高さも伸びます。</div>
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
      <div class="sceneNote">カメラ・魚眼画角・レンズ・グリッド種類・補助線・表示設定などを保存します。オブジェクトと描画線は保存・変更しません。</div>
      <div class="quickField"><span>階段の段数</span><input id="stairsSteps" type="number" min="2" max="24" step="1" value="6"><em>段</em></div>
      <label class="quickCheck"><input id="stairsRail" type="checkbox"> 階段に手すりをつける</label>
      <div class="quickRow"><button id="applyStairs" class="primary">選択中の階段に反映</button></div>
      <div class="quickField"><span>アセット配置距離（最小）</span><input id="assetDepth" type="number" min="1" max="80" step="0.5" value="5"><em>m</em></div>
      <div class="quickField"><span>生成方向</span><select id="assetAxis"><option value="1">Y：地面／上下</option><option value="0">X：左右の面</option><option value="2">Z：正面／背面</option></select><em></em></div>
      <div class="quickRow" style="margin-top:7px"><button id="sampleRef">サンプル参照を表示</button><button id="clearRef">参照を外す</button></div>
      <div class="floorTintBox"><label class="quickCheck"><input id="floorTint" type="checkbox"> 床に透明色をつける</label>
        <div class="quickField"><span>床の色</span><input id="floorTintColor" type="color" value="#7fa8d8"><em></em></div>
        <div class="quickField"><span>透明度</span><input id="floorTintA" type="range" min="0" max="0.60" step="0.01" value="0.16"><output id="floorTintAO">0.16</output></div>
      </div>
    </section>

    <div class="quickHint">1 設定　2 視点　3 描画　4 編集　5 アセット　7 前　8 横　9 上　0 3D　／　詳細操作は「？」</div>
    <div class="sceneTitle">シーン内オブジェクト</div>
    <div class="sceneTools"><button id="sceneSelectAll">全選択</button><button id="sceneClearSel">選択解除</button><button id="sceneDeleteSel" class="danger">選択中を削除</button><button id="sceneLockSel" title="選択中のオブジェクトをロック／解除（⌘/Ctrl+L）">選択をロック</button><button id="sceneUnlockAll" title="ロック中のオブジェクトをすべて解除">全ロック解除</button><button id="sceneGroupSel">グループ化</button><button id="sceneUngroupSel">グループ解除</button><button id="sceneCombineSel">結合</button><button id="sceneSeparateSel">結合解除</button></div>
    <div class="alignTools"><button id="centerOnScreenSel" title="選択中のオブジェクト（接着した子パーツ・グループを含む）を、いま見ている画面の中央へ移動">画面中央へ</button><button id="centerChildSel" title="テント付き建物・看板付き建物のテント／看板を、建物の左右（X方向）の中央へすぐ戻す。1個を選ぶだけで使えます">テント・看板を中央へ</button></div>
    <div class="alignTools"><select id="alignAxis"><option value=0>X軸（左右）</option><option value=1>Z軸（高さ）</option><option value=2>Y軸（奥行き）</option></select><select id="alignMode"><option value=middle>中央に整列</option><option value=min>最小側に整列</option><option value=max>最大側に整列</option></select><button id="alignApply">整列</button></div>
    <div class="sceneNote">行のチェックで複数選択。「画面中央へ」は1個でも動きます（看板付き建物・テント付き建物は建物本体の中心を画面中央へ合わせます）。整列は2個以上を選んでください。グループ化は後から解除できます。結合は複数の定義を一つの複合オブジェクトにまとめ、結合解除まで一体として扱います。</div>
    <div id="objectList"><div class="emptyList">まだオブジェクトがありません</div></div>`;
    side.insertBefore(quick, side.firstChild);
    const humanInput = el("humanHeight");
    humanInput.value = Number(P.hm).toFixed(2);

    // ===== 2. 作業画面の切り替え =====
    // 1つのパネル内で画面を切り替え、必要な入力だけを表示する。
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
        // 人物・ポーズの設定を開いても、前／横／上の間取り表示は維持する。
        // 3Dへ戻るときだけ、明示的に間取りを閉じる。
        else if (window.cityFloorPlanActive && tab === "perspective") window.cityFloorPlanExit?.();
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
        personHeadTiltInput = el("personHeadTilt"),
        // 関節角度（3Dビューの関節ギズモと同じ値）
        personJointInputs = {
            personWaist: el("personWaist"),
            personNeck: el("personNeck"),
            personHipL: el("personHipL"),
            personHipR: el("personHipR"),
            personKneeL: el("personKneeL"),
            personKneeR: el("personKneeR"),
        };
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
        Object.entries(personJointInputs).forEach(([key, input]) => {
            if (input && document.activeElement !== input) input.value = Number(o?.[key] ?? 0).toFixed(0);
        });
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
        // プリセットは姿勢を丸ごと決めるので、関節角度も0へ戻す。
        setOb(o.id, {
            pose,
            poseStride: d.stride,
            poseCrouch: d.crouch,
            poseLean: d.lean,
            headTilt: d.headTilt,
            personWaist: 0,
            personNeck: 0,
            personHipL: 0,
            personHipR: 0,
            personKneeL: 0,
            personKneeR: 0,
        });
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
            headTilt = clamp(parseFloat(personHeadTiltInput.value) || 0, -25, 25),
            // 関節角度も同時に反映する（ギズモで回した値と数値欄は同じ項目）
            joints = {
                personWaist: clamp(parseFloat(personJointInputs.personWaist.value) || 0, -60, 60),
                personNeck: clamp(parseFloat(personJointInputs.personNeck.value) || 0, -40, 40),
                personHipL: clamp(parseFloat(personJointInputs.personHipL.value) || 0, -80, 80),
                personHipR: clamp(parseFloat(personJointInputs.personHipR.value) || 0, -80, 80),
                personKneeL: clamp(parseFloat(personJointInputs.personKneeL.value) || 0, 0, 120),
                personKneeR: clamp(parseFloat(personJointInputs.personKneeR.value) || 0, 0, 120),
            };
        HU.push(S);
        RD = [];
        setOb(o.id, { pose: "custom", poseStride: stride, poseCrouch: crouch, poseLean: lean, headTilt, ...joints });
        setStudioWorkspace("pose");
        render();
    }
    el("applyPersonEdit").onclick = applySelectedPerson;
    el("applyPersonPoseDetail").onclick = applyPersonPoseDetail;
    poseButtons.forEach((b) => (b.onclick = () => applyPersonPose(b.dataset.personPose)));
    syncPersonControls();

    // ===== 2.1 床の半透明表示 =====
    // ===== 3. 床・生成方向・シーン一覧 =====
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
        P.assetDepth = Math.max(1, Math.min(80, parseFloat(assetDepthInput.value) || 5));
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
        // 左パネルの「生成方向」から変えたときも、棚のセレクトと同じ処理を通す
        // （選択中のオブジェクトも新しい生成面へ移し替える）。
        if (window.cityGridSetAssetAxis) {
            window.cityGridSetAssetAxis(value);
            syncAssetAxis();
            return;
        }
        syncAssetAxis();
        render();
    }
    assetAxisInput.onchange = () => setAssetAxis(assetAxisInput.value);
    syncAssetAxis();
    window.cityFloorTint = function (c) {
        // 床はカメラから見える地平線より下を、透明な平面色として塗る。
        // 画角や魚眼でも必ず見えるよう、投影前の巨大四角ではなく画面上の台形で描く。
        // 正面・横・上（正投影）は消失点も地平線も無い。
        // 真上は地面の塗り分け自体が意味を持たないので塗らない。
        // 正面・横は「地面の高さ」より下を塗る（実際の床の見え方に合わせる）。
        let horizon;
        if (orthView) {
            if (orthView === "top") return;
            const g = projPoint([0, -1, 0], [1, 0, 0, 1, 0, 0]);
            horizon = g && g.ok ? clamp(g.y, 0, H) : H;
        } else horizon = T === "f" ? H * 0.5 : clamp(AX.hy, 0, H);
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
    // ===== 3.1 シーン一覧（オブジェクトグループ） =====
    const list = el("objectList");
    // Sに同じオブジェクトの線が複数あるため、ob.idごとに1件へまとめる。
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
    // シーン一覧（アウトライナー）を現在のSから再構築する。
    // 表示切替・選択・グループ操作の入口もここで各行へ接続する。
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
                      const visible = objectVisible(o),
                          locked = obLocked(o);
                      // 鍵ボタンは「ロック中でも押せる」唯一の入口。ここから解除できる。
                      return `<div class="objectRow ${selIds.has(o.id) ? "selected" : ""} ${sel === o.id ? "activeObject" : ""} ${visible ? "" : "hiddenObject"} ${locked ? "lockedObject" : ""}" data-object="${o.id}"><button type="button" class="objectVisibility" data-object-visibility="${o.id}" title="${visible ? "オブジェクトを非表示" : "オブジェクトを表示"}" aria-label="${visible ? "非表示" : "表示"}">${visible ? "◉" : "○"}</button><button type="button" class="objectLock ${locked ? "isLocked" : ""}" data-object-lock="${o.id}" title="${locked ? "ロックを解除（⌘/Ctrl+L）" : "ロックする（⌘/Ctrl+L）"}" aria-label="${locked ? "ロック解除" : "ロック"}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.4"/><path class="shackle" d="${locked ? "M8.4 10.5V8a3.6 3.6 0 0 1 7.2 0v2.5" : "M8.4 10.5V8a3.6 3.6 0 0 1 7.2 0"}" /></svg></button><input class="objectCheck" type="checkbox" data-object-check="${o.id}" ${selIds.has(o.id) ? "checked" : ""} ${locked ? "disabled" : ""} aria-label="${assetLabel(o)}を選択"><span class="objectIcon">${assetGlyph(o)}</span><span class="objectMeta">${assetLabel(o)} ${i + 1} ${group}<small>${detail}</small></span></div>`;
                  })
                  .join("")
            : '<div class="emptyList">まだオブジェクトがありません</div>';
        syncGroupActions();
    }
    function deleteSelectedScene() {
        const ids = new Set();
        selectedObjects().forEach((o) => linkedMemberIds(o.id).forEach((member) => ids.add(member)));
        // ロック中のものは消さない（engine-core の deleteSelectedObjects と同じ約束）。
        [...ids].forEach((id) => {
            if (obLocked(obOf(id))) ids.delete(id);
        });
        if (!ids.size) {
            flashHint("ロック中のオブジェクトは削除されません");
            return;
        }
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
    // ===== 画面中央へ =====
    // 看板付き建物・テント付き建物のような複合アセットは、建物本体と付属パーツで
    // 外接範囲が大きく、数値入力で中央へ寄せるのが難しい。押した1回で
    // 「見えている画面の中央」へ移動できるようにする。
    // 移動量は表示中のビューに合わせて決める。
    //   3D／真上 … 画面中央の床面（X/Z）。高さは変えない
    //   正面     … 画面中央の X と高さ
    //   真横     … 画面中央の奥行きと高さ
    // 接着中の子パーツ（テント・看板）は親と同じ量だけ動かし、位置関係を崩さない。
    function screenCenterTarget(worldCenter) {
        const mid = { x: W / 2, y: H / 2 };
        if (orthView === "front") {
            const w = SH.floorPlanFrontWorldAt(mid);
            return w ? [w.x, w.y, worldCenter[2]] : null;
        }
        if (orthView === "side") {
            const w = SH.floorPlanSideWorldAt(mid);
            return w ? [worldCenter[0], w.y, w.z] : null;
        }
        if (orthView === "top") {
            const w = SH.floorPlanWorldAt(mid);
            return w ? [w.x, worldCenter[1], w.z] : null;
        }
        // 3D（透視・魚眼）：画面中央の視線が床と交わる点を中央とみなす。
        // 視線が水平以上で床に当たらないときは、視線方向へ8m先。
        // 視線の向きはカメラ座標の+Z（cam()の逆回転）から求める。
        const th = (Number(P.yaw) || 0) * DG,
            ph = (Number(P.pitch) || 0) * DG,
            eyeY = (Number(P.ch) || 1.6) - 1,
            fx = -Math.cos(ph) * Math.sin(th),
            fy = Math.sin(ph),
            fz = Math.cos(ph) * Math.cos(th),
            // 画面中央の視線が、オブジェクトの高さ（worldCenter[1]）を通る位置を求める。
            // これで「オブジェクトの中心」が画面中央に来る。
            // 視線がほぼ水平で交点が無いときは、視線方向へ8m先にする。
            ty = Number(worldCenter[1]) || 0,
            drop = ty - eyeY,
            // 視線がほぼ水平（＝地平線が画面中央）のときは、床の上の点を画面中央へ
            // 置けない。その場合は「画面の下寄り（8割）に収まる距離」まで離して、
            // 画面外へ飛ばないようにする。
            fit = (Math.abs(drop) * ((W * (Number(P.lens) || 50)) / 36)) / Math.max(40, 0.85 * (H / 2)),
            tRaw = Math.abs(fy) > 1e-3 ? drop / fy : Math.max(8, fit),
            t = clamp(tRaw > 0.5 ? tRaw : Math.max(8, fit), 1.5, 80);
        return [
            (Number(P.cx) || 0) + fx * t,
            worldCenter[1],
            (Number(P.cz) || 0) + fz * t,
        ];
    }
    function centerSelectionOnScreen() {
        const objects = selectedObjects();
        if (!objects.length) {
            flashHint("中央へ移動するオブジェクトを選択してください");
            return;
        }
        // 接着している子パーツ・グループも同時に動かす（見た目が崩れないように）。
        const unitKeys = new Set(objects.map((o) => o.groupId || o.id)),
            unit = sceneObjects().filter((o) => unitKeys.has(o.groupId || o.id)),
            movable = unit.filter((o) => o && !obLocked(o));
        if (!movable.length) {
            flashHint("ロック中のオブジェクトは移動できません");
            return;
        }
        // 「建物の中央」を画面中央へ合わせる。テントや看板は建物の前面に
        // 付くため、付属パーツまで含めた中心を使うと建物本体が画面中央から
        // ずれる。親（建物本体）を基準に中心を決め、移動は付属パーツも一緒に行う。
        const bodyObjects = movable.filter((o) => !o.attachment?.parentId),
            b = groupBounds(bodyObjects.length ? bodyObjects : movable),
            center = [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2],
            target = screenCenterTarget(center);
        if (!target) {
            flashHint("このビューでは画面中央を計算できません");
            return;
        }
        const delta = [target[0] - center[0], target[1] - center[1], target[2] - center[2]];
        if (Math.hypot(delta[0], delta[1], delta[2]) < 1e-4) return;
        HU.push(S);
        RD = [];
        const ids = new Set(movable.map((o) => o.id));
        movable.forEach((o) => setOb(o.id, moveBy(o, delta, !!(o.attachment?.parentId && ids.has(o.attachment.parentId)))));
        render();
    }
    el("centerOnScreenSel").onclick = centerSelectionOnScreen;

    // ===== 表示中央へ（前／横／上の「表示位置」だけを動かす） =====
    // 「画面中央へ」はオブジェクトの方を画面中央へ移動するが、こちらは
    //   ・オブジェクト（o の座標）は動かさない
    //   ・カメラ（P.cx / P.cz / P.ch / yaw / pitch / lens …）も動かさない
    //   ・間取りキャンバスの表示中心（window.cityFloorPlanCenter）だけを寄せる
    // という操作。前／横／上は正投影なので、表示中心と倍率だけで見え方が決まる。
    // 実際の投影位置から表示中心の移動量を求める。カメラ位置に加えて、
    // キャンバスのズームやパンも考慮する。
    function centerFloorViewOnSelection() {
        if (!orthView) {
            flashHint("「表示中央へ」は前（7）・横（8）・上（9）のビューで使えます");
            return;
        }
        const objects = selectedObjects();
        if (!objects.length) {
            flashHint("表示を寄せたいオブジェクトを選択してください");
            return;
        }
        // 選択したものそのものを基準にする。付属パーツ単独の選択も親へすり替えない。
        const b = groupBounds(objects);
        if (!b || !b.lo || !b.hi) return;
        const c = [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2],
            tf = [Z, 0, 0, Z, ...viewShift()],
            p = projPoint(c, tf),
            sc = orthScale(),
            prev = orthPlanCenter(),
            next = [prev[0] + (p.x - W / 2) / sc, prev[1] + (H / 2 - p.y) / sc];
        if (Math.hypot(p.x - W / 2, p.y - H / 2) < 0.01) {
            flashHint("選択中のオブジェクトはすでに表示の中央にあります");
            return;
        }
        // オブジェクトもカメラも触らないので、元に戻す履歴は積まない。
        window.cityFloorPlanCenter = next;
        render();
        flashHint(
            `${orthView === "top" ? "真上" : orthView === "side" ? "真横" : "正面"}の表示位置を選択中のオブジェクトへ移動しました（カメラ＝3D視点は動かしていません）`,
        );
    }
    if (el("floorViewCenter")) el("floorViewCenter").onclick = centerFloorViewOnSelection;
    // ===== テント・看板を建物の中央へ =====
    // テント付き建物・看板付き建物の子パーツは「親のローカルX方向の位置（attachment.x）」を
    // 持っていて、0 が建物の左右の中央。整列（2個以上必要）を使わずに、
    // 選択1個から子パーツだけを中央へ戻せるようにする。
    function centerAttachedChildOnParent() {
        const objects = selectedObjects();
        if (!objects.length) {
            flashHint("テント付き建物・看板付き建物を選択してください");
            return;
        }
        const ids = new Set(objects.map((o) => o.id)),
            groupIds = new Set(objects.map((o) => o.groupId).filter(Boolean)),
            // 選択が親でも子でも、同じグループの接着パーツを対象にする。
            children = sceneObjects().filter(
                (o) =>
                    o &&
                    o.attachment?.parentId &&
                    (ids.has(o.attachment.parentId) || (o.groupId && groupIds.has(o.groupId))),
            );
        if (!children.length) {
            flashHint("接着しているテント・看板がありません（建物付きアセットを選んでください）");
            return;
        }
        const targets = children.filter((o) => !obLocked(o));
        if (!targets.length) {
            flashHint("ロック中のパーツは動かせません（一覧の鍵で解除）");
            return;
        }
        // すでに中央にあるなら何もしない（無駄なUndoを積まない）。
        const needs = targets.filter((o) => Math.abs(Number(o.attachment?.x) || 0) > 1e-4);
        if (!needs.length) {
            flashHint("テント・看板はすでに建物の中央にあります");
            return;
        }
        HU.push(S);
        RD = [];
        needs.forEach((o) => setOb(o.id, { attachment: { ...o.attachment, x: 0 } }));
        render();
        flashHint("テント・看板を建物の左右の中央へ戻しました");
    }
    el("centerChildSel").onclick = centerAttachedChildOnParent;
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
        if (e.target.closest("[data-object-lock]")) {
            // 一覧の鍵。ロック／解除だけは「選択されていなくても」行える。
            e.preventDefault();
            e.stopPropagation();
            const nowLocked = !obLocked(obOf(id));
            setObjectLock(id, nowLocked);
            if (typeof syncLockButtons === "function") syncLockButtons();
            flashHint(nowLocked ? "ロックしました（一覧の鍵で解除）" : "ロックを解除しました");
            updateOutliner();
            syncSel();
            render();
            return;
        }
        if (chosen && obLocked(chosen)) {
            // ロック中の行は選択できない。理由を伝えて終わる。
            e.preventDefault();
            syncSel();
            render();
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
            .filter((o) => !obLocked(o)) // ロック中は全選択の対象外
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
    el("sceneLockSel").onclick = () => {
        toggleSelectionLock();
        updateOutliner();
        syncSel();
        render();
    };
    el("sceneUnlockAll").onclick = () => {
        const n = unlockAllObjects();
        flashHint(n ? `ロックを全解除しました（${n}個）` : "ロック中のオブジェクトはありません");
        syncLockButtons();
        updateOutliner();
        syncSel();
        render();
    };
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
        // 旧保存データの接続建物は親の座標系を補正した後に一度だけ再生成する。
        // 保存済みの線をそのまま残すと、補正前のテント位置が画面に残るため。
        if (S.some((s) => s.ob?.linkedAsset === "buildingAwning" || s.ob?.linkedAsset === "buildingSign"))
            regenObjects();
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
    // テント／看板の子を選択した場合も、親建物の開口設定を表示する。
    // 親IDが無い通常建物は従来どおり通常の建物パネルへ戻す。
    function linkedBuildingParent(o = sel && obOf(sel)) {
        const candidate = o?.linkedRole === "child" && o.attachment?.parentId ? obOf(o.attachment.parentId) : o;
        return candidate &&
            candidate.type === "asset" &&
            candidate.asset === "building" &&
            ["buildingAwning", "buildingAwningOpen", "buildingSign"].includes(candidate.linkedAsset)
            ? candidate
            : null;
    }
    function buildingPanelObject(o = sel && obOf(sel)) {
        return linkedBuildingParent(o) || (o?.type === "asset" && o.asset === "building" ? o : null);
    }
    function wallSideSignParent(o = sel && obOf(sel)) {
        const candidate = o?.attachment?.parentId ? obOf(o.attachment.parentId) : o;
        return candidate &&
            candidate.type === "asset" &&
            (candidate.asset === "building" || isStackedBuildingAsset(candidate))
            ? candidate
            : null;
    }
    function wallSideSignChildren(parent) {
        return parent
            ? sceneObjects()
                  .filter((o) => o?.attachment?.parentId === parent.id && o.attachment.wallSideSign)
                  .sort((a, b) => (Number(a.attachment.floorIndex) || 0) - (Number(b.attachment.floorIndex) || 0))
            : [];
    }
    function wallSideSignScopeValue(parent, children = wallSideSignChildren(parent)) {
        if (!isStackedBuildingAsset(parent)) return "first";
        if (["first", "all", "individual"].includes(parent?.wallSideSignScope)) return parent.wallSideSignScope;
        if (children.length > 1 && children.length >= (parent.floors?.length || 0)) return "all";
        if (children.some((child) => Number(child.attachment?.floorIndex) > 0)) return "individual";
        return "first";
    }
    function wallSideSignFlags(parent, children = wallSideSignChildren(parent)) {
        const count = Math.max(1, parent?.floors?.length || 1),
            flags = Array.from({ length: count }, () => false);
        if (Array.isArray(parent?.wallSideSignFloors))
            parent.wallSideSignFloors.forEach((value, index) => {
                if (index < flags.length) flags[index] = !!value;
            });
        else
            children.forEach((child) => {
                const index = Number(child.attachment?.floorIndex) || 0;
                if (index >= 0 && index < flags.length) flags[index] = true;
            });
        if (!flags.some(Boolean)) flags[0] = true;
        return flags;
    }
    function syncWallSideSignFloorSelect(parent, children, scope) {
        const box = el("wallSideSignFloorSelect"),
            stacked = !!parent && isStackedBuildingAsset(parent);
        if (!box) return;
        if (!stacked || scope !== "individual") {
            box.style.display = "none";
            box.innerHTML = "";
            box.dataset.signature = "";
            return;
        }
        const floors = Array.isArray(parent.floors) ? parent.floors : [],
            flags = wallSideSignFlags(parent, children),
            signature = `${parent.id}:${floors.length}`;
        box.style.display = "";
        if (box.dataset.signature !== signature) {
            box.innerHTML = `<div class="note">看板を付ける階</div>${floors
                .map(
                    (_, index) => `<label><input type="checkbox" data-wall-sign-floor="${index}">${index + 1}F</label>`,
                )
                .join("")}`;
            box.dataset.signature = signature;
            box.querySelectorAll("[data-wall-sign-floor]").forEach((input) => {
                input.onchange = () => {
                    const next = wallSideSignFlags(wallSideSignParent()),
                        index = Number(input.dataset.wallSignFloor);
                    next[index] = input.checked;
                    if (!next.some(Boolean)) {
                        input.checked = true;
                        return;
                    }
                    applyWallSideSignControl(next);
                };
            });
        }
        box.querySelectorAll("[data-wall-sign-floor]").forEach((input) => {
            const index = Number(input.dataset.wallSignFloor);
            if (document.activeElement !== input) input.checked = !!flags[index];
        });
    }
    function syncWallSideSignPanel() {
        const panel = el("wallSideSignP"),
            parent = wallSideSignParent(),
            children = wallSideSignChildren(parent),
            child = children[0],
            check = el("wallSideSign"),
            side = el("wallSideSignSide"),
            brace = el("wallSideSignBrace"),
            brackets = el("wallSideSignBrackets"),
            shape = el("wallSideSignShape"),
            scope = el("wallSideSignScope"),
            scopeRow = el("wallSideSignScopeRow"),
            bevel = el("wallSideSignBevelOffset"),
            shapeValue = parent?.wallSideSignShape ?? child?.wallSideSignShape ?? "box",
            bevelValue = clamp(
                Number(parent?.wallSideSignBevelOffset ?? child?.wallSideSignBevelOffset ?? 0.06),
                0.01,
                1,
            ),
            count = clamp(
                Math.round(Number(parent?.wallSideSignBracketCount ?? child?.wallSideSignBracketCount ?? 3)),
                0,
                3,
            ),
            stacked = !!parent && isStackedBuildingAsset(parent),
            scopeValue = wallSideSignScopeValue(parent, children);
        if (!panel) return;
        panel.style.display = parent ? "" : "none";
        if (!parent) return;
        if (scopeRow) scopeRow.style.display = stacked ? "" : "none";
        if (check && document.activeElement !== check)
            check.checked = !!(parent.wallSideSignEnabled || children.length);
        if (side && document.activeElement !== side)
            side.value = String(Number(parent.wallSideSignSide ?? child?.attachment?.wallSideSignSide) < 0 ? -1 : 1);
        if (brace && document.activeElement !== brace) brace.checked = count > 0;
        if (brackets && document.activeElement !== brackets) brackets.value = String(count);
        if (shape && document.activeElement !== shape) shape.value = shapeValue === "beveled" ? "beveled" : "box";
        if (scope && document.activeElement !== scope) scope.value = scopeValue;
        if (bevel && document.activeElement !== bevel) bevel.value = bevelValue.toFixed(2);
        syncWallSideSignFloorSelect(parent, children, scopeValue);
    }
    // 建物・階層建物・開口設定の入力欄を、選択中オブジェクトへ同期する。
    function syncBuildingPanel() {
        const panel = el("buildingP"),
            selected = sel && obOf(sel),
            o = buildingPanelObject(selected),
            linked = !!linkedBuildingParent(selected),
            isBuilding = !!o;
        if (!panel) return;
        panel.style.display = isBuilding ? "" : "none";
        const openingRow = el("linkedBuildingOpeningRow"),
            openingCheck = el("linkedBuildingOpening");
        if (openingRow) openingRow.style.display = linked ? "" : "none";
        if (!isBuilding) return;
        const fascia=buildingFasciaGeometry(o), check=el("buildingFacadeEnabled"), controls=el("buildingFacadeControls");
        if(el("buildingFacadeRow")) el("buildingFacadeRow").style.display=buildingFacadeAllowed(o)?"":"none";
        if(check) check.checked=fascia.enabled;
        if(controls) controls.style.display=fascia.enabled ? "" : "none";
        if(el("buildingFacadeSides")) el("buildingFacadeSides").checked=fascia.side;
        if(el("buildingFacadeColor") && document.activeElement!==el("buildingFacadeColor")) el("buildingFacadeColor").value=fascia.color;
        [["buildingFacadeHeight",fascia.height],["buildingFacadeProjection",fascia.projection]].forEach(([id,v])=>{
            const input=el(id); if(input && document.activeElement!==input) input.value=Number(v).toFixed(3);
        });
        if (openingCheck && linked) openingCheck.checked = o.openingEnabled !== false;
        const g = buildingGeometry(o);
        [
            ["ov_openingW", g.openingW],
            ["ov_openingH", g.openingH],
        ].forEach(([id, v]) => {
            const n = el(id);
            if (n && document.activeElement !== n) n.value = Number(v).toFixed(3);
        });
    }
    function applyBuildingFacade(key,value) {
        const o=buildingPanelObject(); if(!o || !buildingFacadeAllowed(o)) return;
        const g=buildingFasciaGeometry(o), patch={};
        if(key==="facadeEnabled" || key==="facadeSides") patch[key]=!!value;
        else if(key==="facadeColor" && /^#[0-9a-f]{6}$/i.test(value)) patch[key]=value;
        else if(Number.isFinite(Number(value))) patch[key]=clamp(Number(value),key==="facadeHeight"?.05:.02,key==="facadeHeight"?g.h:2);
        else return;
        if(!buildingEditSession){HU.push(S);RD=[];buildingEditSession=true;}
        setOb(o.id,patch); render();
    }
    const fasciaToggle=el("buildingFacadeEnabled");
    if(fasciaToggle) fasciaToggle.onchange=()=>{buildingEditSession=false;applyBuildingFacade("facadeEnabled",fasciaToggle.checked);buildingEditSession=false;};
    const fasciaSides=el("buildingFacadeSides"), fasciaColor=el("buildingFacadeColor");
    if(fasciaSides) fasciaSides.onchange=()=>{buildingEditSession=false;applyBuildingFacade("facadeSides",fasciaSides.checked);buildingEditSession=false;};
    if(fasciaColor) {fasciaColor.oninput=()=>applyBuildingFacade("facadeColor",fasciaColor.value);fasciaColor.onchange=()=>{buildingEditSession=false;};}
    [["buildingFacadeHeight","facadeHeight"],["buildingFacadeProjection","facadeProjection"]].forEach(([id,key])=>{
        const n=el(id); if(!n)return; n.oninput=()=>applyBuildingFacade(key,n.value); n.onchange=()=>{buildingEditSession=false;};
    });
    function applyLinkedBuildingOpening(value) {
        const o = linkedBuildingParent();
        if (!o) return;
        if (!buildingEditSession) {
            HU.push(S);
            RD = [];
            buildingEditSession = true;
        }
        setOb(o.id, { openingEnabled: !!value });
        buildingEditSession = false;
        render();
    }
    const linkedBuildingOpening = el("linkedBuildingOpening");
    if (linkedBuildingOpening)
        linkedBuildingOpening.onchange = () => applyLinkedBuildingOpening(linkedBuildingOpening.checked);
    const wallSideSignCheck = el("wallSideSign"),
        wallSideSignSide = el("wallSideSignSide"),
        wallSideSignBrace = el("wallSideSignBrace"),
        wallSideSignBrackets = el("wallSideSignBrackets"),
        wallSideSignShape = el("wallSideSignShape"),
        wallSideSignScope = el("wallSideSignScope"),
        wallSideSignBevelOffset = el("wallSideSignBevelOffset");
    function applyWallSideSignControl(floorFlagsOverride = null) {
        const parent = wallSideSignParent();
        if (!parent || !window.cityGridWallSideSignToggle) return;
        const children = wallSideSignChildren(parent),
            stacked = isStackedBuildingAsset(parent),
            scope =
                stacked && ["first", "all", "individual"].includes(wallSideSignScope?.value)
                    ? wallSideSignScope.value
                    : wallSideSignScopeValue(parent, children),
            count = wallSideSignBrace?.checked ? clamp(Math.round(Number(wallSideSignBrackets?.value) || 0), 0, 3) : 0,
            length = clamp(Math.abs(Number(parent.wallSideSignBracketLength) || 0.36), 0.05, 5),
            shape = wallSideSignShape?.value === "beveled" ? "beveled" : "box",
            bevel = clamp(Number(wallSideSignBevelOffset?.value) || 0.06, 0.01, 1),
            flags = floorFlagsOverride || wallSideSignFlags(parent, children);
        window.cityGridWallSideSignToggle(
            parent.id,
            !!wallSideSignCheck?.checked,
            Number(wallSideSignSide?.value) || 1,
            count,
            length,
            shape,
            bevel,
            scope,
            flags,
        );
    }
    if (wallSideSignCheck) wallSideSignCheck.onchange = applyWallSideSignControl;
    if (wallSideSignSide)
        wallSideSignSide.onchange = () => {
            if (wallSideSignCheck?.checked) applyWallSideSignControl();
        };
    if (wallSideSignBrace) wallSideSignBrace.onchange = applyWallSideSignControl;
    if (wallSideSignBrackets) wallSideSignBrackets.onchange = applyWallSideSignControl;
    if (wallSideSignShape) wallSideSignShape.onchange = applyWallSideSignControl;
    if (wallSideSignScope) wallSideSignScope.onchange = applyWallSideSignControl;
    if (wallSideSignBevelOffset) wallSideSignBevelOffset.oninput = applyWallSideSignControl;
    let stackedEditSession = false;
    function stackFloorHeight(o) {
        const floors = Array.isArray(o?.floors) ? o.floors : [];
        return floors.reduce((max, f) => Math.max(max, (Number(f.z) || 0) + (Number(f.h) || 0)), 0);
    }
    function rebuildStackFloorRows(o) {
        const rows = el("stackFloorRows");
        if (!rows) return;
        const floors = Array.isArray(o?.floors) ? o.floors : [],
            rowKind = isBeveledStackedBuildingAsset(o) ? "beveled" : "normal";
        if (rows.dataset.count !== String(floors.length) || rows.dataset.kind !== rowKind) {
            rows.innerHTML = floors
                .map(
                    (f, i) =>
                        `<div class="stackFloorRow" data-floor-row="${i}"><button type="button" data-stack-floor-select="${i}" class="stackFloorSelect">${i + 1}F</button><label>幅<input data-stack-floor="${i}" data-stack-key="w" type="number" step="0.05"></label><label>奥行<input data-stack-floor="${i}" data-stack-key="d" type="number" step="0.05"></label><label>高さ<input data-stack-floor="${i}" data-stack-key="h" type="number" step="0.05"></label><label>X<input data-stack-floor="${i}" data-stack-key="x" type="number" step="0.05"></label><label>Y<input data-stack-floor="${i}" data-stack-key="y" type="number" step="0.05"></label><label>Z<input data-stack-floor="${i}" data-stack-key="z" type="number" step="0.05"></label><label>縁出<input data-stack-floor="${i}" data-stack-key="rimOverhang" type="number" step="0.01"></label><label>縁高<input data-stack-floor="${i}" data-stack-key="rimHeight" type="number" step="0.01"></label>${rowKind === "beveled" ? `<label>ベベル出<input data-stack-floor="${i}" data-stack-key="bevelOffset" type="number" min="0" step="0.01"></label><label>セグメント<input data-stack-floor="${i}" data-stack-key="bevelSegments" type="number" min="1" max="4" step="1"></label>` : ""}</div>`,
                )
                .join("");
            rows.dataset.count = String(floors.length);
            rows.dataset.kind = rowKind;
            rows.querySelectorAll("[data-stack-floor]").forEach((n) => {
                n.oninput = () => {
                    const current = sel && obOf(sel),
                        index = Number(n.dataset.stackFloor),
                        key = n.dataset.stackKey;
                    if (!current?.floors?.[index]) return;
                    const individualEdit = stackedIndividualEdit(current);
                    // 通常モードでは1Fだけを編集対象にする。上階の欄は表示専用。
                    if (!individualEdit && index !== 0) return;
                    if (!stackedEditSession) {
                        HU.push(S);
                        RD = [];
                        stackedEditSession = true;
                    }
                    const nextFloors = current.floors.map((f) => ({ ...f }));
                    nextFloors[index][key] = Number(n.value) || 0;
                    if (
                        !individualEdit &&
                        index === 0 &&
                        ["w", "d", "h", "rimOverhang", "rimHeight", "bevelOffset", "bevelSegments"].includes(key)
                    )
                        nextFloors.forEach((f) => (f[key] = nextFloors[0][key]));
                    if (!individualEdit && index === 0 && ["x", "y", "z"].includes(key)) {
                        const delta = (Number(nextFloors[0][key]) || 0) - (Number(current.floors[0][key]) || 0);
                        nextFloors.forEach((f, i) => {
                            if (i) f[key] = (Number(f[key]) || 0) + delta;
                        });
                    }
                    setOb(current.id, { floors: nextFloors, h: stackFloorHeight({ floors: nextFloors }) });
                    render();
                };
            });
            rows.querySelectorAll("[data-stack-floor-select]").forEach((n) => {
                n.onclick = () => {
                    const current = sel && obOf(sel);
                    if (!current) return;
                    const index = Number(n.dataset.stackFloorSelect);
                    if (!stackedIndividualEdit(current) && index !== 0) return;
                    setOb(current.id, { activeFloor: index });
                    render();
                };
            });
        }
        const individualEdit = stackedIndividualEdit(o),
            activeFloor = individualEdit ? Number(o.activeFloor || 0) : 0;
        rows.querySelectorAll("[data-floor-row]").forEach((row) =>
            row.classList.toggle("active", Number(row.dataset.floorRow) === activeFloor),
        );
        rows.querySelectorAll("[data-stack-floor]").forEach((n) => {
            const index = Number(n.dataset.stackFloor),
                f = floors[index],
                key = n.dataset.stackKey;
            n.disabled = !individualEdit && index !== 0;
            if (f && document.activeElement !== n) n.value = Number(f[key] || 0).toFixed(3);
        });
        rows.querySelectorAll("[data-stack-floor-select]").forEach((n) => {
            n.disabled = !individualEdit && Number(n.dataset.stackFloorSelect) !== 0;
        });
    }
    let recessedEditSession = false;
    function syncRecessedStackedPanel() {
        const panel = el("recessedStackedP"),
            o = sel && obOf(sel),
            active = !!(o && o.type === "asset" && o.asset === "recessedStackedBuilding");
        if (!panel) return;
        panel.style.display = active ? "" : "none";
        if (!active) {
            recessedEditSession = false;
            return;
        }
        const q = recessedStackedBuildingParams(o),
            values = [
                ["recessedFloorCount", q.floorCount],
                ["recessedFloorHeight", q.floorHeight],
                ["recessedFirstFloorExtra", q.firstFloorExtra],
                ["recessedFloorGap", q.floorGap],
                ["recessedCornerBevel", q.cornerBevel],
                ["recessedCornerBevelSegments", q.cornerBevelSegments],
                ["recessedWindowCount", q.windowCount],
                ["recessedWindowMarginLeft", q.marginLeft],
                ["recessedWindowMarginEnd", q.marginEnd],
                ["recessedWindowDepth", q.windowDepth],
            ];
        values.forEach(([id, value]) => {
            const input = el(id);
            if (input && document.activeElement !== input) input.value = Number(value).toFixed(3);
        });
        const side = el("recessedSideWindows");
        if (side) side.checked = q.sideWindows;
    }
    function applyRecessedStackedProp(name, rawValue) {
        const o = sel && obOf(sel);
        if (!o || o.type !== "asset" || o.asset !== "recessedStackedBuilding") return;
        const q = recessedStackedBuildingParams(o),
            patch = {};
        if (name === "recessedSideWindows") patch[name] = rawValue === true;
        else {
            const limits = {
                    recessedFloorCount: [1, 30],
                    recessedFloorHeight: [0.5, 30],
                    recessedFirstFloorExtra: [0, 5],
                    recessedFloorGap: [0, 5],
                    recessedCornerBevel: [0, recessedMaxInset(q.w, q.d)],
                    recessedCornerBevelSegments: [1, 8],
                    recessedWindowCount: [1, 12],
                    recessedWindowMarginLeft: [0, Math.max(0, q.w - q.cornerBevel - 0.2)],
                    recessedWindowMarginEnd: [0, Math.max(0, q.d - q.cornerBevel - 0.2)],
                    recessedWindowDepth: [0.025, Math.max(0.025, recessedMaxInset(q.w, q.d))],
                }[name],
                value = Number(rawValue);
            if (!limits || !Number.isFinite(value)) return;
            patch[name] = clamp(
                name === "recessedFloorCount" || name === "recessedWindowCount" ? Math.round(value) : value,
                limits[0],
                limits[1],
            );
        }
        const next = { ...o, ...patch },
            nextParams = recessedStackedBuildingParams(next);
        patch.ra = nextParams.w * 0.5;
        patch.rb = nextParams.d * 0.5;
        patch.h = nextParams.totalH;
        if (!recessedEditSession) {
            HU.push(S);
            RD = [];
            recessedEditSession = true;
        }
        setOb(o.id, patch);
        render();
    }
    [
        ["recessedFloorCount", "recessedFloorCount"],
        ["recessedFloorHeight", "recessedFloorHeight"],
        ["recessedFirstFloorExtra", "recessedFirstFloorExtra"],
        ["recessedFloorGap", "recessedFloorGap"],
        ["recessedCornerBevel", "recessedCornerBevel"],
        ["recessedCornerBevelSegments", "recessedCornerBevelSegments"],
        ["recessedWindowCount", "recessedWindowCount"],
        ["recessedWindowMarginLeft", "recessedWindowMarginLeft"],
        ["recessedWindowMarginEnd", "recessedWindowMarginEnd"],
        ["recessedWindowDepth", "recessedWindowDepth"],
    ].forEach(([id, name]) => {
        const input = el(id);
        if (!input) return;
        input.oninput = () => applyRecessedStackedProp(name, input.value);
        input.onchange = () => {
            recessedEditSession = false;
        };
    });
    // 縁付き階層建物と同じ「上方向へ整列」。階を地面から積み直し、
    // 高さと外形の寸法を現在の設定へそろえる。
    const recessedAlign = el("recessedAlign");
    if (recessedAlign)
        recessedAlign.onclick = () => {
            const o = sel && obOf(sel);
            if (!o || o.type !== "asset" || o.asset !== "recessedStackedBuilding") return;
            HU.push(S);
            RD = [];
            const q = recessedStackedBuildingParams(o),
                floors = recessedStackedBuildingFloors(o, q);
            let z = 0;
            floors.forEach((floor) => {
                z += floor.h + (floor.index < q.floorCount - 1 ? q.floorGap : 0);
            });
            setOb(o.id, {
                ra: q.w * 0.5,
                rb: q.d * 0.5,
                h: z,
                activeFloor: 0,
                recessedFloorCount: q.floorCount,
                recessedFloorHeight: q.floorHeight,
                recessedFloorGap: q.floorGap,
            });
            recessedEditSession = false;
            render();
        };
    const recessedSideWindows = el("recessedSideWindows");
    if (recessedSideWindows)
        recessedSideWindows.onchange = () => {
            recessedEditSession = false;
            applyRecessedStackedProp("recessedSideWindows", recessedSideWindows.checked);
            recessedEditSession = false;
        };
    function syncStackedPanel() {
        const panel = el("stackedP"),
            o = sel && obOf(sel),
            active = isStackedBuildingAsset(o),
            beveled = isBeveledStackedBuildingAsset(o);
        if (!panel) return;
        panel.style.display = active ? "" : "none";
        if (!active) {
            stackedEditSession = false;
            return;
        }
        const count = el("stackFloorCount"),
            individualEdit = el("stackIndividualEdit"),
            openingCheck = el("stackOpening"),
            openingControls = el("stackOpeningControls"),
            openingW = el("stackOpeningW"),
            openingH = el("stackOpeningH"),
            openingBack = el("stackOpeningBack"),
            gap = el("stackFloorGap");
        if (count && document.activeElement !== count) count.value = o.floorCount || o.floors?.length || 1;
        if (individualEdit) individualEdit.checked = stackedIndividualEdit(o);
        const corner=o.asset === "cornerCutStackedBuilding", cornerControls=el("stackCornerControls"), cornerOffset=el("stackCornerOffset"),
            backLabel=el("stackOpeningBackLabel"), openingNote=el("stackOpeningNote");
        if(cornerControls) cornerControls.style.display=corner?"":"none";
        if(cornerOffset && document.activeElement!==cornerOffset) cornerOffset.value=Number(o.cornerOffset ?? .8).toFixed(3);
        if(backLabel) backLabel.textContent=corner?"1F開口の奥行き":"1F開口の奥面";
        if(openingNote) openingNote.textContent=corner?"開口は1Fの隅切り面だけに作成します。幅・高さ・奥行きは数値欄と画面上のハンドルで編集できます。":"開口は1Fだけに作成します。開口幅・高さ・奥面は設定欄または画面上のハンドルから編集できます。奥面は建物中心からの位置です。";
        if (openingCheck) openingCheck.checked = stackedOpeningEnabled(o);
        if (openingControls) openingControls.style.display = stackedOpeningEnabled(o) ? "" : "none";
        if (stackedOpeningEnabled(o)) {
            const opening = stackedOpeningParams(o, o.floors?.[0]);
            if (openingW && document.activeElement !== openingW) openingW.value = opening.openingW.toFixed(3);
            if (openingH && document.activeElement !== openingH) openingH.value = opening.openingH.toFixed(3);
            if (openingBack && document.activeElement !== openingBack)
                openingBack.value = opening.openingBack.toFixed(3);
        }
        if (gap && document.activeElement !== gap) gap.value = Number(o.floorGap || 0).toFixed(3);
        const title = el("stackedPanelTitle"),
            bevelControls = el("stackBevelControls");
        if (title) title.textContent = corner ? "隅切りの縁付き階層建物" : beveled ? "ベベル直方体の縁付き階層建物" : "縁付き階層建物";
        if (bevelControls) bevelControls.style.display = beveled ? "" : "none";
        if (beveled) {
            const floors = Array.isArray(o.floors) ? o.floors : [],
                index = stackedIndividualEdit(o)
                    ? clamp(Math.round(Number(o.activeFloor) || 0), 0, Math.max(0, floors.length - 1))
                    : 0,
                f = floors[index] || {},
                width = Math.max(0.01, Math.abs(Number(f.w) || Number(o.ra) * 2 || 4)),
                depth = Math.max(0.01, Math.abs(Number(f.d) || Number(o.rb) * 2 || 3)),
                max = Math.max(0, Math.min(width, depth) * 0.5 - 0.001),
                offset = el("stackBevelOffset"),
                segments = el("stackBevelSegments");
            if (offset && document.activeElement !== offset)
                offset.value = clamp(Number(f.bevelOffset ?? o.bevelOffset) || 0, 0, max).toFixed(3);
            if (segments && document.activeElement !== segments)
                segments.value = beveledBoxSegments(f.bevelSegments ?? o.bevelSegments, f.bevelEdges ?? o.bevelEdges);
        }
        rebuildStackFloorRows(o);
    }
    function applyStackMeta(key, value) {
        const o = sel && obOf(sel);
        if (!o || !isStackedBuildingAsset(o)) return;
        if (!stackedEditSession) {
            HU.push(S);
            RD = [];
            stackedEditSession = true;
        }
        if (key === "individualEdit") {
            const individualEdit = !!value,
                patch = { individualEdit, syncFirst: !individualEdit };
            if (!individualEdit && o.floors?.length) {
                const first = o.floors[0];
                patch.floors = o.floors.map((f) => ({
                    ...f,
                    w: first.w,
                    d: first.d,
                    h: first.h,
                    rimHeight: first.rimHeight,
                    rimOverhang: first.rimOverhang,
                    ...(isBeveledStackedBuildingAsset(o)
                        ? { bevelOffset: first.bevelOffset, bevelSegments: first.bevelSegments }
                        : {}),
                }));
                patch.h = stackFloorHeight(patch);
                patch.activeFloor = 0;
            }
            setOb(o.id, patch);
            render();
            return;
        }
        if (key === "floorGap") {
            setOb(o.id, { floorGap: Math.max(0, Number(value) || 0) });
            render();
            return;
        }
        const count = Math.max(1, Math.min(30, Math.round(Number(value) || 1))),
            floors = (o.floors || []).map((f) => ({ ...f }));
        while (floors.length < count) {
            const prev = floors[floors.length - 1] || {
                x: 0,
                y: 0,
                z: 0,
                w: o.ra * 2 || 4,
                d: o.rb * 2 || 3,
                h: 2.2,
                rimHeight: 0.16,
                rimOverhang: 0.18,
            };
            floors.push({
                ...prev,
                name: `${floors.length + 1}F`,
                z: (Number(prev.z) || 0) + (Number(prev.h) || 2.2) + (Number(o.floorGap) || 0.06),
            });
        }
        floors.length = count;
        setOb(o.id, {
            floorCount: count,
            floors,
            activeFloor: Math.min(Math.max(0, Number(o.activeFloor) || 0), count - 1),
            h: stackFloorHeight({ floors }),
        });
        render();
    }
    // 1F開口の幅・高さ・奥面を更新する。上階へ自動コピーしない仕様をここで維持する。
    function applyStackOpeningProp(name, value) {
        const o = sel && obOf(sel);
        if (!o || !isStackedBuildingAsset(o)) return;
        if (!stackedEditSession) {
            HU.push(S);
            RD = [];
            stackedEditSession = true;
        }
        const first = o.floors?.[0],
            g = stackedOpeningParams(o, first),
            next =
                name === "openingEnabled"
                    ? !!value
                    : name === "openingW"
                      ? clamp(Number(value) || g.openingW, 0.1, Math.max(0.1, g.w - 0.1))
                      : name === "openingH"
                        ? clamp(Number(value) || g.openingH, 0.1, Math.max(0.1, g.h - g.rimHeight - 0.01))
                        : clamp(
                              Number.isFinite(Number(value)) ? Number(value) : g.openingBack,
                              -g.d * 0.5 + 0.025,
                              g.d * 0.5 - 0.025,
                          );
        // 隅切りは奥面の絶対位置ではなく、切り口からの奥行きを保存する。
        const cornerNext=o.asset === "cornerCutStackedBuilding" && name === "openingBack" ? clamp(Number(value)||g.openingBack,.025,g.corner.maxDepth) : next;
        setOb(o.id, {
            openingEnabled: name === "openingEnabled" ? next : stackedOpeningEnabled(o),
            [name]: cornerNext,
            openingW: name === "openingW" ? next : g.openingW,
            openingH: name === "openingH" ? next : g.openingH,
            openingBack:
                name === "openingBack"
                    ? cornerNext
                    : Number.isFinite(Number(o.openingBack))
                      ? Number(o.openingBack)
                      : g.openingBack,
        });
        render();
    }
    const stackCornerOffset=el("stackCornerOffset");
    if(stackCornerOffset) {
        stackCornerOffset.oninput=()=>{
            const o=sel && obOf(sel); if(!o || o.asset!=="cornerCutStackedBuilding") return;
            const n=Number(stackCornerOffset.value), f=o.floors?.[0]; if(!Number.isFinite(n)||!f)return;
            if(!stackedEditSession){HU.push(S);RD=[];stackedEditSession=true;}
            setOb(o.id,{cornerOffset:clamp(n,.05,Math.max(.05,Math.min(f.w,f.d)/2-.001))});render();
        };
        stackCornerOffset.onchange=()=>{stackedEditSession=false;};
    }
    function applyStackBevelProp(name, value) {
        const o = sel && obOf(sel);
        if (!isBeveledStackedBuildingAsset(o) || !Number.isFinite(value) || !o.floors?.length) return;
        if (!stackedEditSession) {
            HU.push(S);
            RD = [];
            stackedEditSession = true;
        }
        const individual = stackedIndividualEdit(o),
            index = individual ? clamp(Math.round(Number(o.activeFloor) || 0), 0, o.floors.length - 1) : 0,
            floors = o.floors.map((f) => ({ ...f })),
            floor = floors[index],
            width = Math.max(0.01, Math.abs(Number(floor.w) || Number(o.ra) * 2 || 4)),
            depth = Math.max(0.01, Math.abs(Number(floor.d) || Number(o.rb) * 2 || 3)),
            max = Math.max(0, Math.min(width, depth) * 0.5 - 0.001),
            next = name === "bevelOffset" ? clamp(value, 0, max) : clamp(Math.round(value), 1, 4);
        floor[name] = next;
        if (!individual && index === 0) floors.forEach((f) => (f[name] = next));
        setOb(o.id, { [name]: next, floors, h: stackFloorHeight({ floors }) });
        render();
    }
    [
        ["stackBevelOffset", "bevelOffset"],
        ["stackBevelSegments", "bevelSegments"],
    ].forEach(([id, name]) => {
        const input = el(id);
        if (!input) return;
        input.oninput = () => applyStackBevelProp(name, parseFloat(input.value));
        input.onchange = () => {
            stackedEditSession = false;
        };
    });
    const stackOpeningCheck = el("stackOpening");
    if (stackOpeningCheck)
        stackOpeningCheck.onchange = () => applyStackOpeningProp("openingEnabled", stackOpeningCheck.checked);
    [
        ["stackOpeningW", "openingW"],
        ["stackOpeningH", "openingH"],
        ["stackOpeningBack", "openingBack"],
    ].forEach(([id, name]) => {
        const input = el(id);
        if (!input) return;
        input.oninput = () => applyStackOpeningProp(name, parseFloat(input.value));
        input.onchange = () => {
            stackedEditSession = false;
        };
    });
    function alignStackedObject() {
        const o = sel && obOf(sel);
        if (!o || !isStackedBuildingAsset(o) || !o.floors?.length) return;
        HU.push(S);
        RD = [];
        const floors = o.floors.map((f) => ({ ...f })),
            first = floors[0],
            x = Number(first.x) || 0,
            y = Number(first.y) || 0;
        let z = Number(first.z) || 0;
        floors.forEach((f) => {
            f.x = x;
            f.y = y;
            f.z = z;
            z += Math.max(0.05, Number(f.h) || 2.2) + Math.max(0, Number(o.floorGap) || 0.06);
        });
        setOb(o.id, { floors, h: stackFloorHeight({ floors }) });
        stackedEditSession = false;
        render();
    }
    function copyWallSideSignFirstToAll(parent) {
        const children = wallSideSignChildren(parent),
            first = children.find((child) => Number(child.attachment?.floorIndex) === 0) || children[0];
        if (!first || children.length < 2) return;
        children.forEach((child) => {
            if (child.id === first.id) return;
            setOb(child.id, {
                ra: first.ra,
                rb: first.rb,
                h: first.h,
                c: first.c,
                wallSideSignBracketCount: first.wallSideSignBracketCount,
                wallSideSignBracketLength: first.wallSideSignBracketLength,
                wallSideSignShape: first.wallSideSignShape,
                wallSideSignBevelOffset: first.wallSideSignBevelOffset,
                wallSideSignBevelSegments: first.wallSideSignBevelSegments,
                attachment: {
                    ...child.attachment,
                    side: first.attachment?.side,
                    wallSideSignSide: first.attachment?.wallSideSignSide,
                    centerRatio: first.attachment?.centerRatio,
                    depthOffset: first.attachment?.depthOffset,
                },
            });
        });
    }
    function copyFirstFloorToAll(includeSigns = false) {
        const o = sel && obOf(sel);
        if (!o || !isStackedBuildingAsset(o) || !o.floors?.length) return;
        HU.push(S);
        RD = [];
        const first = o.floors[0],
            floors = o.floors.map((f) => ({
                ...f,
                w: first.w,
                d: first.d,
                h: first.h,
                rimHeight: first.rimHeight,
                rimOverhang: first.rimOverhang,
                ...(isBeveledStackedBuildingAsset(o)
                    ? { bevelOffset: first.bevelOffset, bevelSegments: first.bevelSegments }
                    : {}),
            }));
        setOb(o.id, { floors, h: stackFloorHeight({ floors }) });
        if (includeSigns) {
            // 看板込みを選んだ場合だけ、1F看板の寸法・相対位置を各階へコピーする。
            // 建物だけのコピーでは、既存看板の個別設定を変更しない。
            copyWallSideSignFirstToAll(obOf(o.id));
        }
        render();
    }
    [
        ["stackFloorCount", "floorCount"],
        ["stackFloorGap", "floorGap"],
    ].forEach(([id, key]) => {
        const n = el(id);
        if (n) n.oninput = () => applyStackMeta(key, n.value);
    });
    const stackIndividual = el("stackIndividualEdit");
    if (stackIndividual) stackIndividual.onchange = () => applyStackMeta("individualEdit", stackIndividual.checked);
    const stackAlign = el("stackAlign");
    if (stackAlign) stackAlign.onclick = alignStackedObject;
    const stackCopy = el("stackCopyFirst"),
        stackCopyWithSigns = el("stackCopyFirstWithSigns");
    if (stackCopy) stackCopy.onclick = () => copyFirstFloorToAll(false);
    if (stackCopyWithSigns) stackCopyWithSigns.onclick = () => copyFirstFloorToAll(true);

    function applyBuildingProp(name, v) {
        const o = buildingPanelObject();
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
        setOb(o.id, patch);
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
    // 看板の外枠と内側の絵枠（faceW / faceH）をパネルへ同期する。
    function syncSignPanel() {
        const panel = el("signP"),
            o = sel && obOf(sel),
            isSign = !!(o && o.type === "asset" && o.asset === "sign");
        if (!panel) return;
        panel.style.display = isSign ? "" : "none";
        const ext = el("obExtrude");
        if (ext) ext.disabled = !!o && !(o.type === "rect" || o.type === "circ" || (o.type === "asset" && (o.asset === "beveledBox" || o.asset === "track")));
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
    let balconyEditSession = false;
    function syncBalconyPanel() {
        const panel = el("balconyP"),
            o = sel && obOf(sel),
            isBalcony = !!(o && o.type === "asset" && o.asset === "balcony");
        if (!panel) return;
        panel.style.display = isBalcony ? "" : "none";
        if (!isBalcony) return;
        const thickness =
                Number(o.balconyThickness) ||
                Number(o.balconyRailThickness) ||
                Number(o.balconyFloorThickness) ||
                0.14,
            railH = Number(o.balconyRailHeight) || Math.max(0.12, (Number(o.h) || 1.25) - thickness);
        [
            ["balconyRailHeight", railH],
            // 床と壁の厚さは1本の値なので、入力欄も1つ。
            ["balconyThickness", thickness],
        ].forEach(([id, v]) => {
            const n = el(id);
            if (n && document.activeElement !== n) n.value = Number(v).toFixed(3);
        });
        const front = el("balconyFrontRail"),
            side = el("balconySideRail");
        if (front && document.activeElement !== front) front.checked = o.balconyFrontRail !== false;
        if (side && document.activeElement !== side) side.checked = o.balconySideRail !== false;
    }
    function applyBalconyProp(name, value) {
        const o = sel && obOf(sel);
        if (!o || o.type !== "asset" || o.asset !== "balcony" || !Number.isFinite(value)) return;
        if (!balconyEditSession) {
            HU.push(S);
            RD = [];
            balconyEditSession = true;
        }
        const thickness =
                Number(o.balconyThickness) || Number(o.balconyRailThickness) || Number(o.balconyFloorThickness) || 0.14,
            railH = Math.max(0.12, Number(o.balconyRailHeight) || Math.max(0.12, (Number(o.h) || 1.25) - thickness)),
            patch = {};
        if (name === "balconyRailHeight") {
            patch.balconyRailHeight = clamp(value, 0.12, 30);
            patch.balconyRailHeightEdited = true;
            patch.h = thickness + patch.balconyRailHeight;
        } else if (name === "balconyThickness") {
            // 厚さを変えると全体の高さ（床＋腰壁）もその分だけ伸びる。
            patch.balconyThickness = clamp(value, 0.035, 10);
            patch.h = patch.balconyThickness + railH;
        }
        setOb(sel, patch);
        render();
    }
    [
        ["balconyRailHeight", "balconyRailHeight"],
        ["balconyThickness", "balconyThickness"],
    ].forEach(([id, name]) => {
        const n = el(id);
        if (!n) return;
        n.oninput = () => applyBalconyProp(name, parseFloat(n.value));
        n.onchange = () => {
            balconyEditSession = false;
        };
    });
    [
        ["balconyFrontRail", "balconyFrontRail"],
        ["balconySideRail", "balconySideRail"],
    ].forEach(([id, name]) => {
        const n = el(id);
        if (!n) return;
        n.onchange = () => {
            const o = sel && obOf(sel);
            if (!o || o.type !== "asset" || o.asset !== "balcony") return;
            HU.push(S);
            RD = [];
            setOb(sel, { [name]: !!n.checked });
            render();
        };
    });
    // ===== コの字壁（3枚の壁をまとめて1本の厚さで編集） =====
    let uWallEditSession = false;
    function syncUWallPanel() {
        const panel = el("uWallP"),
            o = sel && obOf(sel),
            isWall = !!(o && o.type === "asset" && o.asset === "uWall");
        if (!panel) return;
        panel.style.display = isWall ? "" : "none";
        if (!isWall) return;
        const n = el("uWallThickness");
        if (n && document.activeElement !== n) n.value = (Number(o.uWallThickness) || 0.12).toFixed(3);
    }
    function applyUWallProp(name, value) {
        const o = sel && obOf(sel);
        if (!o || o.type !== "asset" || o.asset !== "uWall" || !Number.isFinite(value)) return;
        if (!uWallEditSession) {
            HU.push(S);
            RD = [];
            uWallEditSession = true;
        }
        // コの字壁は壁の高さがそのまま h なので、厚さを変えても高さは動かさない。
        if (name === "uWallThickness") setOb(sel, { uWallThickness: clamp(value, 0.035, 10) });
        render();
    }
    (() => {
        const n = el("uWallThickness");
        if (!n) return;
        n.oninput = () => applyUWallProp("uWallThickness", parseFloat(n.value));
        n.onchange = () => {
            uWallEditSession = false;
        };
    })();
    // ===== 屋台（コの字の壁＋カウンター箱＋屋根箱） =====
    // 5つの寸法はどれも「動かす面が1つだけ」なので、数値欄と画面ハンドルの
    // どちらから変えても同じ結果になる（stallGeometry が唯一の寸法源）。
    let stallEditSession = false;
    const STALL_PROPS = [
        ["stallWallThickness", 0.03, 10],
        ["stallCounterHeight", 0.1, 20],
        ["stallCounterDepth", 0.05, 20],
        ["stallRoofThickness", 0.04, 10],
        ["stallRoofOverhang", 0, 20],
    ];
    // 入力欄のIDと stallGeometry() の戻り値の対応。
    const STALL_KEYS = {
        stallWallThickness: "t",
        stallCounterHeight: "ch",
        stallCounterDepth: "cd",
        stallRoofThickness: "rt",
        stallRoofOverhang: "ro",
    };
    function syncStallPanel() {
        const panel = el("stallP"),
            o = sel && obOf(sel),
            isStall = !!(o && o.type === "asset" && o.asset === "stall");
        if (!panel) return;
        panel.style.display = isStall ? "" : "none";
        if (!isStall) return;
        const g = stallGeometry(o);
        STALL_PROPS.forEach(([id]) => {
            const n = el(id);
            const key = STALL_KEYS[id];
            if (n && document.activeElement !== n) n.value = Number(g[key] || 0).toFixed(3);
        });
    }
    function applyStallProp(name, value) {
        const o = sel && obOf(sel);
        if (!o || o.type !== "asset" || o.asset !== "stall" || !Number.isFinite(value)) return;
        const spec = STALL_PROPS.find(([id]) => id === name);
        if (!spec) return;
        if (!stallEditSession) {
            HU.push(S);
            RD = [];
            stallEditSession = true;
        }
        // 壁の厚さは「幅・奥行きに対して太すぎない」上限があり、その上限は
        // 幅を変えると動く。画面ハンドルと同じ上限で止める。
        const upper = name === "stallWallThickness" ? Math.min(stallGeometry(o).w, stallGeometry(o).d) * 0.3 : spec[2];
        setOb(sel, { [name]: clamp(value, spec[1], Math.max(spec[1], upper)) });
        render();
    }
    STALL_PROPS.forEach(([id]) => {
        const n = el(id);
        if (!n) return;
        n.oninput = () => applyStallProp(id, parseFloat(n.value));
        n.onchange = () => {
            stallEditSession = false;
        };
    });
    // ===== 丸椅子（座面・脚・台座） =====
    let stoolEditSession = false;
    // 座面・ポール・台座それぞれの「半径」と「高さ」。半径は正円を保つため
    // ra と rb を同じ値へそろえる（楕円にしない）。
    const STOOL_PROPS = [
        ["stoolSeatRadius", 0.02, 10],
        ["stoolSeatThickness", 0.02, 10],
        ["stoolLegRadius", 0.005, 10],
        ["stoolLegHeight", 0.02, 30],
        ["stoolBaseRadius", 0.01, 10],
        ["stoolBaseHeight", 0.01, 10],
    ];
    function syncStoolPanel() {
        const panel = el("stoolP"),
            o = sel && obOf(sel),
            isStool = !!(o && o.type === "asset" && o.asset === "stool");
        if (!panel) return;
        panel.style.display = isStool ? "" : "none";
        if (!isStool) return;
        const g = stoolGeometry(o),
            shown = {
                stoolSeatRadius: g.seatR,
                stoolSeatThickness: g.seatT,
                stoolLegRadius: g.legR,
                stoolLegHeight: g.legH,
                stoolBaseRadius: g.baseR,
                stoolBaseHeight: g.baseH,
            };
        STOOL_PROPS.forEach(([id]) => {
            const n = el(id);
            if (n && document.activeElement !== n) n.value = Number(shown[id]).toFixed(3);
        });
    }
    function applyStoolProp(name, value) {
        const o = sel && obOf(sel);
        if (!o || o.type !== "asset" || o.asset !== "stool" || !Number.isFinite(value)) return;
        const spec = STOOL_PROPS.find(([id]) => id === name);
        if (!spec) return;
        if (!stoolEditSession) {
            HU.push(S);
            RD = [];
            stoolEditSession = true;
        }
        const v = clamp(value, spec[1], spec[2]),
            g = stoolGeometry(o);
        // 座面の半径は幅・奥行きそのものなので、ra / rb も同じ値へそろえる
        // （そろえないと外接範囲とハンドルが楕円のまま食い違う）。
        if (name === "stoolSeatRadius") setOb(sel, { stoolSeatRadius: v, ra: v, rb: v });
        // ポールの高さは真ん中の段なので、全体の高さで持つ（上下の段はそのまま）。
        else if (name === "stoolLegHeight") setOb(sel, { h: v + g.seatT + g.baseH });
        else setOb(sel, { [name]: v });
        render();
    }
    STOOL_PROPS.forEach(([id]) => {
        const n = el(id);
        if (!n) return;
        n.oninput = () => applyStoolProp(id, parseFloat(n.value));
        n.onchange = () => {
            stoolEditSession = false;
        };
    });
    // ===== 手すり（柱＋上下の横桟＋縦の棒） =====
    // 形（コの字／L字／直線）と4つの寸法を、数値欄と「−／＋」ボタンで編集する。
    // 実際の寸法計算は railingGeometry()（engine-gizmo.js）が唯一の源なので、
    // 画面ハンドル・数値欄・線画がすべて同じ値になる。
    let railingEditSession = false;
    const RAILING_PROPS = [
        ["railingCount", 1, 40],
        ["railingThickness", 0.012, 10],
        ["railingPostSize", 0.012, 10],
        ["railingBottomGap", 0.02, 30],
    ];
    function syncRailingPanel() {
        const panel = el("railingP"),
            o = sel && obOf(sel),
            isRail = !!(o && o.type === "asset" && o.asset === "railing");
        if (!panel) return;
        panel.style.display = isRail ? "" : "none";
        if (!isRail) return;
        const g = railingGeometry(o),
            shown = {
                railingCount: g.count,
                railingThickness: g.t,
                railingPostSize: g.post,
                railingBottomGap: g.bottom,
            },
            shape = el("railingShape");
        if (shape && document.activeElement !== shape) shape.value = g.shape;
        RAILING_PROPS.forEach(([id]) => {
            const n = el(id);
            if (n && document.activeElement !== n)
                n.value = id === "railingCount" ? String(shown[id]) : Number(shown[id]).toFixed(3);
        });
        const minus = el("railingCountMinus"),
            plus = el("railingCountPlus");
        // 下限は「区間の数」（直線=1・L字=2・コの字=3）。それ以下には減らせない。
        if (minus) minus.disabled = g.count <= g.minCount;
        if (plus) plus.disabled = g.count >= 40;
    }
    function applyRailingProp(name, value) {
        const o = sel && obOf(sel);
        if (!o || o.type !== "asset" || o.asset !== "railing") return;
        if (!railingEditSession) {
            HU.push(S);
            RD = [];
            railingEditSession = true;
        }
        if (name === "railingShape") {
            if (["u", "l", "line"].includes(value)) setOb(sel, { railingShape: value });
            render();
            return;
        }
        if (!Number.isFinite(value)) return;
        const g = railingGeometry(o);
        if (name === "railingCount") setOb(sel, { railingCount: clamp(Math.round(value), 1, 40) });
        // 角材の太さは「幅・奥行き・高さに対して太すぎない」上限で止める（ハンドルと同じ）。
        else if (name === "railingThickness") setOb(sel, { railingThickness: clamp(value, 0.012, g.maxT) });
        else if (name === "railingPostSize") setOb(sel, { railingPostSize: clamp(value, 0.012, g.maxPost) });
        else if (name === "railingBottomGap") setOb(sel, { railingBottomGap: clamp(value, 0.02, g.maxBottom) });
        render();
    }
    RAILING_PROPS.forEach(([id]) => {
        const n = el(id);
        if (!n) return;
        n.oninput = () => applyRailingProp(id, parseFloat(n.value));
        n.onchange = () => {
            // 本数は整数に丸めて表示し直す（打ち終わりに揃える）。
            railingEditSession = false;
            if (id === "railingCount") n.value = String(Math.round(parseFloat(n.value) || 1));
        };
    });
    {
        const shape = el("railingShape");
        if (shape) shape.onchange = () => applyRailingProp("railingShape", shape.value);
        const minus = el("railingCountMinus"),
            plus = el("railingCountPlus"),
            step = (d) => {
                const o = sel && obOf(sel);
                if (!o || o.asset !== "railing") return;
                applyRailingProp("railingCount", railingGeometry(o).count + d);
                railingEditSession = false;
            };
        if (minus) minus.onclick = () => step(-1);
        if (plus) plus.onclick = () => step(1);
    }
    let pathPipeEditSession = false;
    function pathPipeText(path) {
        return (Array.isArray(path) ? path : pathPipeDefaultPoints())
            .map((v) => v.map((n) => Number(n).toFixed(3)).join(","))
            .join("; ");
    }
    // パスパイプの制御点・半径・角丸・断面分割数を編集欄へ同期する。
    function syncPathPipePanel() {
        const panel = el("pathPipeP"),
            o = sel && obOf(sel),
            isPipe = !!(o && o.type === "asset" && o.asset === "pathPipe");
        if (!panel) return;
        panel.style.display = isPipe ? "" : "none";
        if (!isPipe) return;
        [
            ["pathPipeRadius", Number(o.pipeRadius) || 0.18],
            ["pathPipeCornerRadius", Number.isFinite(Number(o.cornerRadius)) ? Number(o.cornerRadius) : 0.55],
            ["pathPipeSides", Number(o.pipeSides) || 10],
        ].forEach(([id, value]) => {
            const input = el(id);
            if (input && document.activeElement !== input)
                input.value = Number(value).toFixed(id === "pathPipeSides" ? 0 : 3);
        });
        const points = el("pathPipePoints");
        if (points && document.activeElement !== points) points.value = pathPipeText(o.path);
        if (pathPipePresetInput && document.activeElement !== pathPipePresetInput)
            pathPipePresetInput.value = pathPipePresetKey(o.path);
    }
    function applyPathPipeProp(name, value) {
        const o = sel && obOf(sel);
        if (!o || o.type !== "asset" || o.asset !== "pathPipe") return;
        if (!pathPipeEditSession) {
            HU.push(S);
            RD = [];
            pathPipeEditSession = true;
        }
        const patch = {};
        if (name === "pipeRadius" && Number.isFinite(value)) patch.pipeRadius = clamp(value, 0.02, 5);
        else if (name === "cornerRadius" && Number.isFinite(value)) patch.cornerRadius = clamp(value, 0, 20);
        else if (name === "pipeSides" && Number.isFinite(value)) patch.pipeSides = clamp(Math.round(value), 6, 24);
        else if (name === "path") {
            const path = String(value || "")
                .split(/[;\\n]+/)
                .map((chunk) => chunk.trim())
                .filter(Boolean)
                .map((chunk) => chunk.split(/[ ,]+/).map(Number).slice(0, 3))
                .filter((point) => point.length === 3 && point.every(Number.isFinite));
            if (path.length < 2) return;
            patch.path = path;
        }
        if (!Object.keys(patch).length) return;
        setOb(sel, patch);
        render();
    }
    [
        ["pathPipeRadius", "pipeRadius"],
        ["pathPipeCornerRadius", "cornerRadius"],
        ["pathPipeSides", "pipeSides"],
    ].forEach(([id, name]) => {
        const input = el(id);
        if (!input) return;
        input.oninput = () => applyPathPipeProp(name, parseFloat(input.value));
        input.onchange = () => {
            pathPipeEditSession = false;
        };
    });
    const pathPipePresets = {
        straight: [
            [-2.8, 0, 1.1],
            [2.8, 0, 1.1],
        ],
        l: [
            [-2.4, 0, 1.1],
            [0, 0, 1.1],
            [0, 2.4, 1.1],
        ],
        u: [
            [-2.4, 0, 1.1],
            [-2.4, 2.4, 1.1],
            [2.4, 2.4, 1.1],
            [2.4, 0, 1.1],
        ],
        z: [
            [-2.4, -1.6, 1.1],
            [0, -1.6, 1.1],
            [0, 1.6, 1.1],
            [2.4, 1.6, 1.1],
        ],
        step3d: [
            [-2.4, 0, 0.55],
            [-0.8, 0, 0.55],
            [-0.8, 0, 2.0],
            [0.8, 0, 2.0],
            [0.8, 1.8, 2.0],
            [2.4, 1.8, 2.0],
        ],
    };
    const pathPipePresetInput = el("pathPipePreset"),
        pathPipeApplyPresetButton = el("pathPipeApplyPreset");
    function pathPipePresetKey(path) {
        const text = pathPipeText(path);
        return Object.entries(pathPipePresets).find(([, points]) => pathPipeText(points) === text)?.[0] || "custom";
    }
    function applyPathPipePreset() {
        const o = sel && obOf(sel),
            key = pathPipePresetInput?.value,
            preset = pathPipePresets[key];
        if (!o || o.type !== "asset" || o.asset !== "pathPipe" || !preset) return;
        HU.push(S);
        RD = [];
        pathPipeEditSession = false;
        setOb(o.id, { path: preset.map((point) => [...point]) });
        render();
    }
    if (pathPipeApplyPresetButton) pathPipeApplyPresetButton.onclick = applyPathPipePreset;
    // ===== 3.2 壁付け看板（単体）のパネル =====
    // 数値欄・チェック・選択はすべてsetOb()経由で反映し、生成処理を重複させない。
    let wallSignEditSession = false;
    function wallSignPanelObject() {
        const o = sel && obOf(sel);
        return o && o.type === "asset" && o.asset === "wallSign" ? o : null;
    }
    function syncWallSignPanel() {
        const panel = el("wallSignP"),
            o = wallSignPanelObject();
        if (!panel) return;
        panel.style.display = o ? "" : "none";
        if (!o) {
            wallSignEditSession = false;
            return;
        }
        const params = wallSignParams(o),
            values = [
                ["wallSignBracketLength", params.bracketLength],
                ["wallSignBevelOffset", params.bevelOffset],
                ["wallSignBevelSegments", params.bevelSegments],
            ];
        values.forEach(([id, value]) => {
            const input = el(id);
            if (input && document.activeElement !== input) input.value = Number(value).toFixed(3);
        });
        const brace = el("wallSignBrace"),
            brackets = el("wallSignBrackets"),
            shape = el("wallSignShape");
        if (brace) brace.checked = params.bracketCount > 0;
        if (brackets) {
            brackets.disabled = params.bracketCount === 0;
            if (document.activeElement !== brackets)
                brackets.value = String(clamp(params.bracketCount || 3, 1, 3));
        }
        if (shape && document.activeElement !== shape) shape.value = params.beveled ? "beveled" : "box";
    }
    function applyWallSignPatch(patch) {
        const o = wallSignPanelObject();
        if (!o || !patch || !Object.keys(patch).length) return;
        if (!wallSignEditSession) {
            HU.push(S);
            RD = [];
            wallSignEditSession = true;
        }
        setOb(o.id, patch);
        render();
    }
    function applyWallSignProp(name, rawValue) {
        const o = wallSignPanelObject();
        if (!o) return;
        const params = wallSignParams(o),
            value = Number(rawValue),
            patch = {};
        if (!Number.isFinite(value)) return;
        if (name === "wallSignBracketLength") patch.wallSignBracketLength = clamp(value, 0.05, 5);
        else if (name === "wallSignBevelOffset")
            // ベベルは板厚方向の稜線へ付くため、上限は板厚で決まる。
            patch.wallSignBevelOffset = clamp(value, 0, params.bevelMax);
        else if (name === "wallSignBevelSegments") patch.wallSignBevelSegments = clamp(Math.round(value), 1, 4);
        applyWallSignPatch(patch);
    }
    [
        ["wallSignBracketLength", "wallSignBracketLength"],
        ["wallSignBevelOffset", "wallSignBevelOffset"],
        ["wallSignBevelSegments", "wallSignBevelSegments"],
    ].forEach(([id, name]) => {
        const input = el(id);
        if (!input) return;
        input.oninput = () => applyWallSignProp(name, input.value);
        input.onchange = () => {
            wallSignEditSession = false;
        };
    });
    const wallSignBrace = el("wallSignBrace"),
        wallSignBrackets = el("wallSignBrackets"),
        wallSignShape = el("wallSignShape");
    if (wallSignBrace)
        wallSignBrace.onchange = () => {
            applyWallSignPatch({ wallSignBracketCount: wallSignBrace.checked ? 3 : 0 });
            wallSignEditSession = false;
        };
    if (wallSignBrackets)
        wallSignBrackets.onchange = () => {
            applyWallSignPatch({ wallSignBracketCount: clamp(Math.round(Number(wallSignBrackets.value) || 1), 0, 3) });
            wallSignEditSession = false;
        };
    if (wallSignShape)
        wallSignShape.onchange = () => {
            applyWallSignPatch({
                wallSignShape: wallSignShape.value === "beveled" ? "beveled" : "box",
                wallSignBevelSegments: 4,
            });
            wallSignEditSession = false;
        };
    // ===== 3.3 屋根・スロープ・窓グリッドのパネル =====
    // 3つのアセットは共通の編集パターン（編集セッション＋setOb）を使う。
    function newAssetPanelObject(kinds, prop) {
        const o = sel && obOf(sel);
        return o && o.type === "asset" && kinds.includes(o.asset) ? o : null;
    }
    function makeAssetEditSession() {
        return {
            open(o, patch) {
                if (!this.active) {
                    HU.push(S);
                    RD = [];
                    this.active = true;
                }
                setOb(o.id, patch);
                render();
            },
            end() {
                this.active = false;
            },
            active: false,
        };
    }
    const roofSession = makeAssetEditSession(),
        rampSession = makeAssetEditSession(),
        windowSession = makeAssetEditSession();
    const roofPanelObject = () => newAssetPanelObject(["gableRoof", "shedRoof"], "roof"),
        rampPanelObject = () => newAssetPanelObject(["ramp"], "ramp"),
        windowPanelObject = () => newAssetPanelObject(["windowGrid"], "window");
    function syncRoofPanel() {
        const panel = el("roofP"),
            o = roofPanelObject();
        if (!panel) return;
        panel.style.display = o ? "" : "none";
        if (!o) return;
        const p = roofParams(o),
            isGable = o.asset === "gableRoof",
            overhang = el("roofOverhang"),
            thickness = el("roofThickness"),
            ridge = el("roofRidgeAxis"),
            low = el("roofLowZ");
        if (overhang && document.activeElement !== overhang) overhang.value = p.overhang.toFixed(3);
        if (thickness && document.activeElement !== thickness) thickness.value = p.thickness.toFixed(3);
        if (ridge) {
            ridge.disabled = !isGable;
            if (document.activeElement !== ridge) ridge.value = p.ridgeAxis;
        }
        if (low) {
            low.disabled = isGable;
            if (document.activeElement !== low) low.value = p.lowZ.toFixed(3);
        }
    }
    function applyRoofProp(patch) {
        const o = roofPanelObject();
        if (o && patch && Object.keys(patch).length) roofSession.open(o, patch);
    }
    // 選んだ屋根を、近くにある建物の上面へ合わせる。
    // 建物の寸法から屋根の大きさ・高さ・位置を決めるので、
    // 数値を手で合わせる必要がない。
    function fitRoofToHost() {
        const o = roofPanelObject();
        if (!o) return;
        const b = obBounds(o),
            centerX = (b.lo[0] + b.hi[0]) * 0.5,
            centerZ = (b.lo[2] + b.hi[2]) * 0.5,
            hosts = [];
        S.forEach((s) => {
            const q = s.ob;
            if (!q || q === o || q.type !== "asset") return;
            if (!["building", "box", "stackedBuilding", "beveledStackedBuilding", "cornerCutStackedBuilding", "recessedStackedBuilding"].includes(q.asset))
                return;
            const hb = obBounds(q),
                hx = (hb.lo[0] + hb.hi[0]) * 0.5,
                hz = (hb.lo[2] + hb.hi[2]) * 0.5;
            hosts.push({ q, hb, top: hb.hi[1], dist: Math.hypot(hx - centerX, hz - centerZ) });
        });
        if (!hosts.length) return;
        // 真下に近い建物を優先する。
        hosts.sort((a, c) => a.dist - c.dist);
        const host = hosts[0],
            fit = roofFitFromHost(host.q, o.asset),
            k = Number(o.k) || 1,
            d = Number(o.d) || -1,
            off = [...(o.off || [0, 0, 0])],
            [iu, iv] = PL[k],
            hostX = (host.hb.lo[0] + host.hb.hi[0]) * 0.5,
            hostZ = (host.hb.lo[2] + host.hb.hi[2]) * 0.5;
        // 水平位置は建物の中心へ寄せる（offはローカル中心への足し込み）。
        off[iu] = hostX - (Number(o.ca) || 0);
        off[iv] = hostZ - (Number(o.cb) || 0);
        // 鉛直位置は、屋根の「いちばん低い面」が建物の上面へ来るようにする。
        // 板厚は斜面に直角で取るので、軒先の下面は基準面より少し下がる。
        // その分（slabDrop）を持ち上げないと、軒が建物へめり込む。
        const slab = typeof roofSlab === "function" ? roofSlab({ ...o, h: fit.h, ra: fit.ra, rb: fit.rb, roofThickness: fit.roofThickness, roofLowZ: 0 }, o.asset) : null,
            slabDrop = slab ? Math.min(...slab.innerPath.map((p) => p[1]), 0) : 0;
        off[k] = host.top - d - slabDrop;
        roofSession.open(o, {
            ra: fit.ra,
            rb: fit.rb,
            h: fit.h,
            roofOverhang: fit.roofOverhang,
            roofThickness: fit.roofThickness,
            roofRidgeAxis: fit.roofRidgeAxis,
            roofLowZ: 0,
            lift: 0,
            off,
        });
        roofSession.end();
    }
    [
        ["roofOverhang", (v) => ({ roofOverhang: v })],
        ["roofThickness", (v) => ({ roofThickness: v })],
        ["roofLowZ", (v) => ({ roofLowZ: v })],
    ].forEach(([id, toPatch]) => {
        const input = el(id);
        if (!input) return;
        input.oninput = () => {
            const value = Number(input.value);
            if (Number.isFinite(value)) applyRoofProp(toPatch(value));
        };
        input.onchange = () => roofSession.end();
    });
    const roofRidgeAxis = el("roofRidgeAxis");
    if (roofRidgeAxis)
        roofRidgeAxis.onchange = () => {
            applyRoofProp({ roofRidgeAxis: roofRidgeAxis.value === "y" ? "y" : "x" });
            roofSession.end();
        };
    const roofFitHost = el("roofFitHost");
    if (roofFitHost) roofFitHost.onclick = fitRoofToHost;

    function syncRampPanel() {
        const panel = el("rampP"),
            o = rampPanelObject();
        if (!panel) return;
        panel.style.display = o ? "" : "none";
        if (!o) return;
        const p = rampParams(o),
            rail = el("rampHandrail"),
            height = el("rampRailHeight");
        if (rail) rail.checked = p.rail;
        if (height) {
            height.disabled = !p.rail;
            if (document.activeElement !== height) height.value = p.railH.toFixed(3);
        }
    }
    const rampHandrail = el("rampHandrail"),
        rampRailHeight = el("rampRailHeight");
    if (rampHandrail)
        rampHandrail.onchange = () => {
            const o = rampPanelObject();
            if (o) rampSession.open(o, { handrail: rampHandrail.checked });
            rampSession.end();
        };
    if (rampRailHeight)
        rampRailHeight.oninput = () => {
            const o = rampPanelObject(),
                value = Number(rampRailHeight.value);
            if (o && Number.isFinite(value)) rampSession.open(o, { rampRailHeight: clamp(value, 0.12, 1.8) });
        };
    if (rampRailHeight) rampRailHeight.onchange = () => rampSession.end();

    function syncWindowGridPanel() {
        const panel = el("windowGridP"),
            o = windowPanelObject();
        if (!panel) return;
        panel.style.display = o ? "" : "none";
        if (!o) return;
        const f = normalizedWindowFields(o),
            rows = el("windowRows"),
            cols = el("windowCols"),
            back = el("windowBack"),
            sides = el("windowSides");
        [
            ["windowW", f.windowW],
            ["windowH", f.windowH],
            ["windowMarginX", f.windowMarginX],
            ["windowSill", f.windowSill],
            ["windowHead", f.windowHead],
            ["windowGapX", f.windowGapX],
            ["windowGapZ", f.windowGapZ],
        ].forEach(([id, value]) => {
            const input = el(id);
            if (input && document.activeElement !== input) input.value = Number(value).toFixed(3);
        });
        if (rows && document.activeElement !== rows) rows.value = String(f.windowRows);
        if (cols && document.activeElement !== cols) cols.value = String(f.windowCols);
        if (back) back.checked = f.windowBack;
        if (sides) sides.checked = f.windowSides;
    }
    const applyWindowProp = (patch) => {
        const o = windowPanelObject();
        if (o && patch && Object.keys(patch).length) windowSession.open(o, patch);
    };
    [
        ["windowRows", (v) => ({ windowRows: clamp(Math.round(v), 0, 20) })],
        ["windowCols", (v) => ({ windowCols: clamp(Math.round(v), 0, 20) })],
        ["windowW", (v) => ({ windowW: Math.max(0, v) })],
        ["windowH", (v) => ({ windowH: Math.max(0, v) })],
        ["windowMarginX", (v) => ({ windowMarginX: Math.max(0, v) })],
        ["windowSill", (v) => ({ windowSill: Math.max(0, v) })],
        ["windowHead", (v) => ({ windowHead: Math.max(0, v) })],
        ["windowGapX", (v) => ({ windowGapX: Math.max(0, v) })],
        ["windowGapZ", (v) => ({ windowGapZ: Math.max(0, v) })],
    ].forEach(([id, toPatch]) => {
        const input = el(id);
        if (!input) return;
        input.oninput = () => {
            const value = Number(input.value);
            if (Number.isFinite(value)) applyWindowProp(toPatch(value));
        };
        input.onchange = () => windowSession.end();
    });
    ["windowBack", "windowSides"].forEach((id) => {
        const input = el(id);
        if (!input) return;
        input.onchange = () => {
            applyWindowProp({ [id]: input.checked });
            windowSession.end();
        };
    });

    let beveledBoxEditSession = false;
    function syncBeveledBoxPanel() {
        const panel = el("beveledBoxP"),
            o = sel && obOf(sel),
            isBeveled = !!(o && o.type === "asset" && o.asset === "beveledBox");
        if (!panel) return;
        panel.style.display = isBeveled ? "" : "none";
        if (!isBeveled) return;
        const offset = el("beveledBoxOffset"),
            segments = el("beveledBoxSegments"),
            width = Math.max(0.01, Math.abs(Number(o.ra) || 0.01) * 2),
            depth = Math.max(0.01, Math.abs(Number(o.rb) || 0.01) * 2),
            max = Math.max(0, Math.min(width, depth) * 0.5 - 0.001);
        if (offset && document.activeElement !== offset)
            offset.value = clamp(Number(o.bevelOffset) || 0, 0, max).toFixed(3);
        const segmentValue = Number(o.bevelSegments ?? o.bevelEdges);
        if (segments && document.activeElement !== segments)
            segments.value = clamp(Math.round(Number.isFinite(segmentValue) ? segmentValue : 4), 1, 4);
    }
    function applyBeveledBoxProp(name, value) {
        const o = sel && obOf(sel);
        if (!o || o.type !== "asset" || o.asset !== "beveledBox") return;
        if (!beveledBoxEditSession) {
            HU.push(S);
            RD = [];
            beveledBoxEditSession = true;
        }
        const width = Math.max(0.01, Math.abs(Number(o.ra) || 0.01) * 2),
            depth = Math.max(0.01, Math.abs(Number(o.rb) || 0.01) * 2),
            max = Math.max(0, Math.min(width, depth) * 0.5 - 0.001),
            patch = {};
        if (name === "bevelOffset" && Number.isFinite(value)) patch.bevelOffset = clamp(value, 0, max);
        else if (name === "bevelSegments" && Number.isFinite(value))
            patch.bevelSegments = clamp(Math.round(value), 1, 4);
        if (!Object.keys(patch).length) return;
        setOb(sel, patch);
        render();
    }
    [
        ["beveledBoxOffset", "bevelOffset"],
        ["beveledBoxSegments", "bevelSegments"],
    ].forEach(([id, name]) => {
        const input = el(id);
        if (!input) return;
        input.oninput = () => applyBeveledBoxProp(name, parseFloat(input.value));
        input.onchange = () => {
            beveledBoxEditSession = false;
        };
    });
    let cornerCutEditSession = false;
    function syncCornerCutPanel() {
        const panel = el("cornerCutP"),
            o = sel && obOf(sel),
            isCornerCut = !!(o && o.type === "asset" && o.asset === "cornerCutBox");
        if (!panel) return;
        panel.style.display = isCornerCut ? "" : "none";
        if (!isCornerCut) {
            cornerCutEditSession = false;
            return;
        }
        const params = typeof cornerCutOpeningParams === "function" ? cornerCutOpeningParams(o) : null,
            offsetInput = el("cornerCutOffset"),
            openingEnabled = el("cornerCutOpeningEnabled"),
            controls = el("cornerCutOpeningControls"),
            values = [
                ["cornerCutOpeningW", params?.openingW ?? o.cornerCutOpeningW ?? 0.7],
                ["cornerCutOpeningH", params?.openingH ?? o.cornerCutOpeningH ?? 2.2],
                ["cornerCutOpeningDepth", params?.openingDepth ?? o.cornerCutOpeningDepth ?? 0.8],
            ];
        if (offsetInput && document.activeElement !== offsetInput)
            offsetInput.value = Number(params?.cornerOffset ?? o.cornerOffset ?? 0).toFixed(3);
        const fascia=buildingFasciaGeometry(o), facadeCheck=el("cornerFacadeEnabled");
        if(facadeCheck) facadeCheck.checked=fascia.enabled;
        if(el("cornerFacadeControls")) el("cornerFacadeControls").style.display=fascia.enabled?"":"none";
        if(el("cornerFacadeSides")) el("cornerFacadeSides").checked=fascia.side;
        if(el("cornerFacadeColor") && document.activeElement!==el("cornerFacadeColor")) el("cornerFacadeColor").value=fascia.color;
        [["cornerFacadeHeight",fascia.height],["cornerFacadeProjection",fascia.projection]].forEach(([id,value])=>{
            const input=el(id);if(input && document.activeElement!==input) input.value=Number(value).toFixed(3);
        });
        if (openingEnabled) openingEnabled.checked = o.cornerCutOpeningEnabled === true;
        if (controls) controls.style.display = o.cornerCutOpeningEnabled === true ? "" : "none";
        values.forEach(([id, value]) => {
            const input = el(id);
            if (input && document.activeElement !== input) input.value = Number(value).toFixed(3);
        });
    }
    function applyCornerFacadeProp(name,value) {
        const o=sel && obOf(sel);if(!o || o.asset!=="cornerCutBox")return;
        const g=buildingFasciaGeometry(o),patch={};
        if(name==="facadeEnabled"||name==="facadeSides")patch[name]=!!value;
        else if(name==="facadeColor" && /^#[0-9a-f]{6}$/i.test(value))patch[name]=value;
        else if(Number.isFinite(Number(value)))patch[name]=clamp(Number(value),name==="facadeHeight"?Math.min(.05,g.h):.02,name==="facadeHeight"?g.h:2);
        else return;
        if(!cornerCutEditSession){HU.push(S);RD=[];cornerCutEditSession=true;}
        setOb(o.id,patch);render();
    }
    [["cornerFacadeEnabled","facadeEnabled"],["cornerFacadeSides","facadeSides"]].forEach(([id,key])=>{
        const n=el(id);if(n)n.onchange=()=>{cornerCutEditSession=false;applyCornerFacadeProp(key,n.checked);cornerCutEditSession=false;};
    });
    [["cornerFacadeColor","facadeColor"],["cornerFacadeHeight","facadeHeight"],["cornerFacadeProjection","facadeProjection"]].forEach(([id,key])=>{
        const n=el(id);if(n){n.oninput=()=>applyCornerFacadeProp(key,n.value);n.onchange=()=>{cornerCutEditSession=false;};}
    });
    function applyCornerCutProp(name, rawValue) {
        const o = sel && obOf(sel);
        if (!o || o.type !== "asset" || o.asset !== "cornerCutBox") return;
        const params = typeof cornerCutOpeningParams === "function" ? cornerCutOpeningParams(o) : null,
            patch = {};
        if (name === "cornerOffset") {
            const max = params?.max ?? 0,
                value = Number(rawValue);
            if (!Number.isFinite(value)) return;
            patch.cornerOffset = clamp(value, 0, max);
        } else if (name === "cornerCutOpeningEnabled") patch.cornerCutOpeningEnabled = rawValue === true;
        else {
            const limits = {
                    cornerCutOpeningW: [0.1, params?.maxWidth ?? 20],
                    cornerCutOpeningH: [0.1, params?.maxHeight ?? 20],
                    cornerCutOpeningDepth: [0.025, params?.maxDepth ?? 20],
                }[name],
                value = Number(rawValue);
            if (!limits || !Number.isFinite(value)) return;
            patch[name] = clamp(value, limits[0], limits[1]);
        }
        if (!cornerCutEditSession) {
            HU.push(S);
            RD = [];
            cornerCutEditSession = true;
        }
        setOb(o.id, patch);
        render();
    }
    const cornerCutOffsetInput = el("cornerCutOffset"),
        cornerCutOpeningEnabledInput = el("cornerCutOpeningEnabled"),
        cornerCutOpeningInputs = [
            ["cornerCutOpeningW", "cornerCutOpeningW"],
            ["cornerCutOpeningH", "cornerCutOpeningH"],
            ["cornerCutOpeningDepth", "cornerCutOpeningDepth"],
        ];
    if (cornerCutOffsetInput) {
        cornerCutOffsetInput.oninput = () => applyCornerCutProp("cornerOffset", cornerCutOffsetInput.value);
        cornerCutOffsetInput.onchange = () => {
            cornerCutEditSession = false;
        };
    }
    if (cornerCutOpeningEnabledInput) {
        cornerCutOpeningEnabledInput.onchange = () => {
            cornerCutEditSession = false;
            applyCornerCutProp("cornerCutOpeningEnabled", cornerCutOpeningEnabledInput.checked);
            cornerCutEditSession = false;
        };
    }
    cornerCutOpeningInputs.forEach(([id, name]) => {
        const input = el(id);
        if (!input) return;
        input.oninput = () => applyCornerCutProp(name, input.value);
        input.onchange = () => {
            cornerCutEditSession = false;
        };
    });
    // 登録の controls から数値欄を自動生成。特別なUIを持つ旧アセットには手を加えない。
    let genericAssetPanelKind=null, genericAssetPanelId=null, genericAssetEditSession=false;
    function syncGenericAssetEditor() {
        const panel=el("assetEditorP"), fields=el("assetEditorFields"), o=sel && obOf(sel),
            controls=o?assetEditorControls(o):[];
        if(!panel || !fields)return;
        panel.style.display=controls.length?"":"none";
        if(!controls.length){genericAssetPanelKind=null;genericAssetPanelId=null;genericAssetEditSession=false;return;}
        if(genericAssetPanelKind!==o.asset || genericAssetPanelId!==o.id){
            genericAssetPanelKind=o.asset;genericAssetPanelId=o.id;genericAssetEditSession=false;fields.replaceChildren();
            controls.forEach(c=>{
                const label=document.createElement("label"),input=document.createElement("input"),name=document.createElement("span");
                name.textContent=c.label||c.key;input.type=c.type==="boolean"?"checkbox":"number";input.dataset.assetControl=c.key;
                if(input.type==="number") {input.step=String(c.step ?? .05);input.style.width="100px";}
                label.append(name,input);
                if(c.unit){const unit=document.createElement("span");unit.className="un";unit.textContent=c.unit;label.append(unit);}
                fields.append(label);
            });
        }
        controls.forEach(c=>{
            const input=fields.querySelector(`[data-asset-control="${c.key}"]`);if(!input)return;
            const value=assetControlValue(o,c);
            if(input.type==="checkbox") input.checked=value;
            else {
                const min=assetControlLimit(c.min,o,-Infinity),max=assetControlLimit(c.max,o,Infinity);
                if(Number.isFinite(min))input.min=String(min);else input.removeAttribute("min");
                if(Number.isFinite(max))input.max=String(max);else input.removeAttribute("max");
                if(document.activeElement!==input)input.value=String(+value.toFixed(4));
            }
        });
    }
    function applyGenericAssetEditor(e) {
        const input=e.target, key=input?.dataset?.assetControl, o=sel && obOf(sel),
            control=o && assetEditorControls(o).find(c=>c.key===key);
        if(!control)return;
        let value;
        if(control.type==="boolean") value=!!input.checked;
        else {if(input.value.trim()===""||!Number.isFinite(Number(input.value)))return;
            const v=Number(input.value), lo=assetControlLimit(control.min,o,-Infinity), hi=assetControlLimit(control.max,o,Infinity);
            value=clamp(control.integer ? Math.round(v) : v,lo,hi);}
        if(!genericAssetEditSession){HU.push(S);RD=[];genericAssetEditSession=true;}
        setOb(o.id,typeof control.patch === "function" ? control.patch(o,value) : {[key]:value});render();
    }
    if(el("assetEditorFields")){
        el("assetEditorFields").addEventListener("input",applyGenericAssetEditor);
        el("assetEditorFields").addEventListener("change",()=>{genericAssetEditSession=false;});
    }
    function syncAssetControls() {
        const o = sel && obOf(sel);
        if (o && o.type === "asset" && o.asset === "stairs") {
            if (document.activeElement !== el("stairsSteps")) el("stairsSteps").value = o.steps || 6;
            el("stairsRail").checked = o.handrail === true;
        }
    }
    // Wrap render so the outliner follows undo/redo, opening files, and camera changes.
    // ===== 4. 描画フックと視点プリセット =====
    // エンジンのrenderを退避し、UIオーバーレイや選択状態を描いた後に呼び出す。
    const baseRender = render;
    render = function () {
        sanitizeScene();
        baseRender();
        updateOutliner();
        syncAssetControls();
        syncGenericAssetEditor();
        syncSignPanel();
        syncBuildingPanel();
        syncWallSideSignPanel();
        syncBalconyPanel();
        syncUWallPanel();
        syncStallPanel();
        syncStoolPanel();
        syncRailingPanel();
        syncPathPipePanel();
        syncWallSignPanel();
        syncRoofPanel();
        syncRampPanel();
        syncWindowGridPanel();
        syncBeveledBoxPanel();
        syncCornerCutPanel();
        syncRecessedStackedPanel();
        syncStackedPanel();
        syncSignShapePanel();
        syncFloorControls();
        syncAssetDepth();
        syncAssetAxis();
        syncPersonControls();
        window.cityGridSyncObjectInfoActions?.();
        SH.syncFloorPlanSelection?.();
    };

    // ===== 4.1 標準ビューと間取りショートカット（8=間取り横 / 9=間取り真上 / 0=元の視点） =====
    // 標準ビューだけは透視ではなく正投影にし、真横90°・真上90°を正確に扱う。
    const viewKeys = ["lens", "yaw", "hz", "pitch", "fov", "roll", "ch", "cx", "cz"];
    const captureHomeView = () => {
        const v = { gt: el("gt").value, T, orthView };
        viewKeys.forEach((k) => (v[k] = P[k]));
        return v;
    };
    // 接続テント／看板を選択したまま正面・横・上へ切り替えた場合は、
    // 3方向の寸法・開口ハンドルを持つ親建物へ編集対象を移す。
    // 子アセットは3D視点やシーン一覧から引き続き個別編集できる。
    function focusLinkedBuildingParentForOrtho() {
        const selected = sel && obOf(sel),
            parent =
                selected?.linkedRole === "child" && selected.attachment?.parentId
                    ? obOf(selected.attachment.parentId)
                    : null;
        if (
            parent?.type === "asset" &&
            parent.asset === "building" &&
            ["buildingAwning", "buildingSign"].includes(parent.linkedAsset)
        )
            setSelection(parent.id, false);
    }
    // 3Dの「ホーム」でシーン全体が画面に入るようにカメラを寄せ直す。
    // 以前は正投影から戻すだけで、カメラ値を一切変えていなかった。そのため
    // 初期カメラ（地表すれすれ・俯角0）のままでは、置いた建物の足元や頭が
    // 画面の外へ出て「切れて」いた（実測：stool 1048px / 看板 1008px / H=900）。
    // すでに全部入っているときは何もしない（利用者が合わせた視点を動かさない）。
    const HOME_FIT_MARGIN = 0.06; // 画面の上下左右に残す余白（割合）
    function sceneCornerPoints() {
        const pts = [];
        S.forEach((s) => {
            const o = s && s.ob;
            if (!o) return;
            let b = null;
            try {
                b = obBounds(o);
            } catch (e) {
                b = null;
            }
            if (!b || !b.lo || !b.hi) return;
            if (!Number.isFinite(b.lo[0]) || !Number.isFinite(b.hi[0])) return;
            for (const x of [b.lo[0], b.hi[0]])
                for (const y of [b.lo[1], b.hi[1]]) for (const z of [b.lo[2], b.hi[2]]) pts.push([x, y, z]);
        });
        return pts;
    }
    // いまのカメラ（P）で、すべての点が余白の内側に収まっているか。
    function homeFitOk(pts, pad = HOME_FIT_MARGIN) {
        const mx = W * pad,
            my = H * pad;
        for (const p of pts) {
            const s = scrW(p);
            if (!s || !s.ok) return false;
            if (s.x < mx || s.x > W - mx || s.y < my || s.y > H - my) return false;
        }
        return true;
    }
    function fitPerspectiveHome() {
        if (orthView) return false;
        if (window.__noHomeFit) return false; // 逃げ道：従来どおりカメラを動かさない
        const pts = sceneCornerPoints();
        if (!pts.length) return false; // 空のシーンは何もしない（初期カメラのまま）
        // すでに全部入っているなら視点を動かさない。
        if (homeFitOk(pts, HOME_FIT_MARGIN * 0.5)) return false;
        // シーンの中心と半径
        const lo = [Infinity, Infinity, Infinity],
            hi = [-Infinity, -Infinity, -Infinity];
        pts.forEach((p) => {
            for (let i = 0; i < 3; i++) {
                if (p[i] < lo[i]) lo[i] = p[i];
                if (p[i] > hi[i]) hi[i] = p[i];
            }
        });
        const target = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
            radius = Math.max(
                0.5,
                Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2,
            );
        const yaw = Number(P.yaw) || 0,
            th = yaw * DG,
            // 見下ろし（負のピッチ）ほど足元が入りやすい。今の向きがすでに見下ろしなら
            // その角度を優先し、そうでなければ 20°／30° を見る。
            pitches = [...new Set([Number(P.pitch) < -4 ? Number(P.pitch) : -20, -20, -30, -12, -38])];
        const keep = { cx: P.cx, cz: P.cz, ch: P.ch, pitch: P.pitch };
        for (const pitch of pitches) {
            const ph = pitch * DG,
                dir = [-Math.cos(ph) * Math.sin(th), Math.sin(ph), Math.cos(ph) * Math.cos(th)];
            // 距離の上下限を二分探索して「入る最小の距離」を探す
            let a = radius * 0.6,
                b = radius * 40,
                best = null;
            const place = (d) => {
                const C = [target[0] - dir[0] * d, target[1] - dir[1] * d, target[2] - dir[2] * d];
                P.cx = C[0];
                P.cz = C[2];
                P.ch = C[1] + 1;
                P.pitch = pitch;
                CAMKEY = null; // カメラ行列のキャッシュを捨てる
                return homeFitOk(pts);
            };
            if (!place(b)) {
                Object.assign(P, keep);
                CAMKEY = null;
                continue;
            }
            for (let i = 0; i < 24; i++) {
                const m = (a + b) / 2;
                if (place(m)) {
                    b = m;
                    best = m;
                } else a = m;
            }
            if (best != null) {
                // 浮動小数の丸めで端が切れないよう、少しだけ引いて置き直す（0.5%）
                place(b * 1.005);
                return true;
            }
            Object.assign(P, keep);
            CAMKEY = null;
        }
        return false;
    }
    function applyStandardView(kind) {
        standardApplying = true;
        // 正面・横・上は表示用の正投影だけを切り替える。
        // yaw／pitch／高さ／位置／レンズ／魚眼画角／ロールは一切変更しない。
        orthView = kind === "front" || kind === "side" || kind === "top" ? kind : null;
        if (kind === "home" && !orthView) {
            try {
                fitPerspectiveHome();
            } catch (e) {}
        }
        if (orthView) {
            // 切り替えた向きに合わせてシーン全体が入る倍率・中心を作り直す
            // （間取りモードと同じ計算を使う。オブジェクトの位置・寸法は変えない）。
            focusLinkedBuildingParentForOrtho();
            try {
                fitFloorPlan();
            } catch (e) {}
        }
        standardApplying = false;
        sync();
        // 0=3Dは視点プリセットだけを切り替える。編集ツールを選択中なら、
        // そのまま3Dギズモを使えるように描画／編集モードを維持する。
        setMode(tool === "edit" ? "draw" : "view");
        render();
    }
    window.cityStandardView = (kind) => applyStandardView(kind);

    // 間取りの投影を切り替える。真上／真横とも、入る前の透視カメラ設定を保持する。
    // 正面・横・上の表示面を切り替える。実際のオブジェクト座標は変更しない。
    function setFloorPlanProjection(kind = "top") {
        // 正投影はorthViewだけで切り替える。グリッド種類、魚眼画角、
        // レンズ、カメラ位置、高さ、回転、傾き、ロールは変更しない。
        standardApplying = true;
        orthView = kind === "side" ? "side" : kind === "front" ? "front" : "top";
        focusLinkedBuildingParentForOrtho();
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

    // ===== 4.2 間取りモード：真上／真横の正投影でシーンを確認する =====
    let floorPlanView = null,
        floorPlanSideWasHidden = null,
        floorPlanAutoHidSide = false;
    function restoreStudioView(v) {
        // 間取り終了時は保存した古いカメラ値へ戻さず、現在の設定をそのまま使う。
        // 間取り中に左パネルで変更した魚眼画角、レンズ、位置、高さ、回転、傾き、
        // ロールも含め、0=3Dで失われないようにする。
        standardApplying = true;
        orthView = null;
        standardApplying = false;
        sync();
        // 間取りを閉じても、編集ツールを選択していたら3D編集を続けられるようにする。
        setMode(tool === "edit" ? "draw" : "view");
        render();
    }
    // シーン・カメラを含む外接範囲から、間取りの表示中心と倍率を決める。
    // 表示をフィットするだけで、オブジェクトの位置や寸法は変更しない。
    // 自動フィットの倍率の下限。間取りモードではハンドルが潰れないよう 24px/単位 を保つ。
    // 3Dから正面・横・上へ切り替えたときは、広いシーンでも全部入るよう小さくできるようにする。
    const planMinScale = () => (window.cityFloorPlanActive ? 24 : 2);
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
        // 3Dから正面・横・上へ切り替えたときは、カメラ位置も枠に入れると
        // オブジェクトの塊から大きく外れた所まで入ってしまい、絵が小さく／端が切れる。
        // 間取りモードのときだけ、これまで通りカメラも含めてフィットする。
        const withCam = !!window.cityFloorPlanActive,
            camX = withCam ? [P.cx] : [],
            camZ = withCam ? [P.cz] : [],
            camY = withCam ? [P.ch - 1] : [],
            fyaw = Number(P.yaw || 0) * DG,
            fpitch = Number(P.pitch || 0) * DG,
            fhoriz = Math.cos(fpitch),
            tx = P.cx - Math.sin(fyaw) * SH.FLOOR_CAMERA_RAY * fhoriz,
            tz = P.cz + Math.cos(fyaw) * SH.FLOOR_CAMERA_RAY * fhoriz,
            ty = P.ch - 1 + Math.sin(fpitch) * SH.FLOOR_CAMERA_RAY;
        if (orthView === "side") {
            // 真横は画面の左右がワールドZ、上下がワールドY。共有カメラの高さ・傾きも含めて自動フィットする。
            if (!bounds.length) {
                window.cityFloorPlanCenter = [P.cz, P.ch - 1];
                window.cityFloorPlanScale = Math.min(W, H) / 7.2;
                return;
            }
            const minZ = Math.min(...camZ, ...(withCam ? [tz] : []), ...bounds.map((b) => b.lo[2])),
                maxZ = Math.max(...camZ, ...(withCam ? [tz] : []), ...bounds.map((b) => b.hi[2]));
            const minY = Math.min(...camY, ...(withCam ? [ty] : []), ...bounds.map((b) => b.lo[1])),
                maxY = Math.max(...camY, ...(withCam ? [ty] : []), ...bounds.map((b) => b.hi[1]));
            const spanZ = Math.max(0.1, maxZ - minZ),
                spanY = Math.max(0.1, maxY - minY),
                pad = Math.max(1, Math.max(spanZ, spanY) * 0.16);
            const fitScale = Math.min((W * 0.82) / (spanZ + pad * 2), (H * 0.82) / (spanY + pad * 2));
            window.cityFloorPlanCenter = [(minZ + maxZ) / 2, (minY + maxY) / 2];
            window.cityFloorPlanScale = Math.max(planMinScale(), Math.min(220, fitScale));
            return;
        }
        if (orthView === "front") {
            // 正面は画面の左右がワールドX、上下がワールドY。
            if (!bounds.length) {
                window.cityFloorPlanCenter = [P.cx, P.ch - 1];
                window.cityFloorPlanScale = Math.min(W, H) / 7.2;
                return;
            }
            const minX = Math.min(...camX, ...(withCam ? [tx] : []), ...bounds.map((b) => b.lo[0])),
                maxX = Math.max(...camX, ...(withCam ? [tx] : []), ...bounds.map((b) => b.hi[0]));
            const minY = Math.min(...camY, ...(withCam ? [ty] : []), ...bounds.map((b) => b.lo[1])),
                maxY = Math.max(...camY, ...(withCam ? [ty] : []), ...bounds.map((b) => b.hi[1]));
            const spanX = Math.max(0.1, maxX - minX),
                spanY = Math.max(0.1, maxY - minY),
                pad = Math.max(1, Math.max(spanX, spanY) * 0.16);
            const fitScale = Math.min((W * 0.82) / (spanX + pad * 2), (H * 0.82) / (spanY + pad * 2));
            window.cityFloorPlanCenter = [(minX + maxX) / 2, (minY + maxY) / 2];
            window.cityFloorPlanScale = Math.max(planMinScale(), Math.min(220, fitScale));
            return;
        }
        if (!bounds.length) {
            window.cityFloorPlanCenter = [P.cx, P.cz];
            window.cityFloorPlanScale = Math.min(W, H) / 7.2;
            return;
        }
        const minX = Math.min(...camX, ...(withCam ? [tx] : []), ...bounds.map((b) => b.lo[0])),
            maxX = Math.max(...camX, ...(withCam ? [tx] : []), ...bounds.map((b) => b.hi[0])),
            minZ = Math.min(...camZ, ...(withCam ? [tz] : []), ...bounds.map((b) => b.lo[2])),
            maxZ = Math.max(...camZ, ...(withCam ? [tz] : []), ...bounds.map((b) => b.hi[2]));
        const spanX = Math.max(0.1, maxX - minX),
            spanZ = Math.max(0.1, maxZ - minZ),
            pad = Math.max(1, Math.max(spanX, spanZ) * 0.16);
        const fitScale = Math.min((W * 0.82) / (spanX + pad * 2), (H * 0.82) / (spanZ + pad * 2));
        window.cityFloorPlanCenter = [(minX + maxX) / 2, (minZ + maxZ) / 2];
        window.cityFloorPlanScale = Math.max(planMinScale(), Math.min(220, fitScale));
    }
    // 間取りモードへ入り、正投影・編集ツール・専用ドックを有効にする。
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
        SH.floorPlanDock.classList.add("open");
        SH.syncFloorPlanDockLayout?.();
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
        // 間取り中に変更した共有カメラ設定は、そのまま3D視点へ引き継ぐ。
        window.cityFloorPlanActive = false;
        SH.floorPlanDock.classList.remove("open");
        const saved = floorPlanView,
            restoreSide = floorPlanAutoHidSide && !floorPlanSideWasHidden;
        floorPlanView = null;
        floorPlanSideWasHidden = null;
        floorPlanAutoHidSide = false;
        window.cityFloorPlanCenter = null;
        window.cityFloorPlanScale = null;
        if (restore) restoreStudioView(saved);
        else {
            setMode("view");
            render();
        }
        if (restoreSide) {
            setSide(false);
            fit();
        }
        el("assetTray")?.classList.remove("floorAssetTray");
        SH.syncFloorPlanDockLayout?.();
        const status = el("floorPlanStatus");
        if (status) status.textContent = "間取りモードを開くと、X・Z方向へドラッグできます";
    }
    window.cityFloorPlanActive = false;
    window.cityFloorPlanEnter = enterFloorPlan;
    window.cityFloorPlanExit = exitFloorPlan;
    window.cityFloorPlanView = showFloorPlan;
    // engine-gizmo.js は別スクリプト／別スコープで読み込まれるため、
    // ボックス選択から間取りのドラッグ状態を操作するときはこの橋を使う。
    window.cityFloorPlanGetDrag = () => SH.floorPlanDrag;
    window.cityFloorPlanSetDrag = (value) => {
        SH.floorPlanDrag = value;
    };
    window.cityFloorPlanFit = fitFloorPlan;
    el("openFloorPlan").onclick = () => setStudioWorkspace("floorplan");
    el("closeFloorPlan").onclick = () => setStudioWorkspace("perspective");

    // ===== 5.1 カメラ・スケールのプリセット =====
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

    // ===== 5.2 視点・設定のプリセット =====
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
        return {
            name: name || "名称未設定",
            version: 4,
            // プリセットは設定だけを保存し、オブジェクトと描画線は保存しない。
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
        // プリセット読込では、現在の3Dオブジェクトと描画線をそのまま維持する。
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

    // ===== 5.3 レンズのボタン =====
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

    // ===== 5.4 書き出し・ヘルプのUI =====
    el("exportToggle").onclick = (e) => {
        e.stopPropagation();
        setExportOpen(!el("exportMenu").classList.contains("open"));
        el("helpPanel")?.style.setProperty("display", "none");
    };
    document.addEventListener("pointerdown", (e) => {
        if (!e.target.closest("#exportMenu") && !e.target.closest("#exportToggle")) setExportOpen(false);
    });
    // ===== 標識の形・枚数（丸／逆三角形／四角／ひし形 × 1枚・2枚）=====
    // 標識は「板の形」と「枚数」で見た目が決まるので、選択中にパネルから切り替えられる。
    // 値は o.signShape / o.signCount / o.signShape2 に持ち、形の組み立て（asset-kit-assets.js）が読む。
    const SIGN_KINDS = ["signPost", "signPost2", "signTriangle", "signDiamond", "signCombo"];
    function syncSignShapePanel() {
        const panel = el("signShapeP"),
            o = sel && obOf(sel),
            on = !!(o && o.type === "asset" && SIGN_KINDS.includes(o.asset));
        if (!panel) return;
        panel.style.display = on ? "" : "none";
        if (!on) return;
        const count = String(clamp(Math.round(Number(o.signCount ?? ASSETS[o.asset]?.signCount ?? 1)), 1, 2)),
            shape = String(o.signShape ?? ASSETS[o.asset]?.signShape ?? "circle"),
            shape2 = String(o.signShape2 ?? ASSETS[o.asset]?.signShape2 ?? shape),
            countSel = el("signCountSel"),
            shapeSel = el("signShapeSel"),
            shape2Sel = el("signShape2Sel"),
            row2 = el("signShape2Row");
        if (countSel && document.activeElement !== countSel) countSel.value = count;
        if (shapeSel && document.activeElement !== shapeSel) shapeSel.value = shape;
        if (shape2Sel && document.activeElement !== shape2Sel) shape2Sel.value = shape2;
        if (row2) row2.style.display = count === "2" ? "" : "none";
    }
    function applySignShapeControl(name, value) {
        const o = sel && obOf(sel);
        if (!o || o.type !== "asset" || !SIGN_KINDS.includes(o.asset)) return;
        const patch = {};
        if (name === "signCount") {
            patch.signCount = clamp(Math.round(Number(value) || 1), 1, 2);
            // 2枚にしたときは、板が潰れない高さまで頭を広げる（1枚の高さはそのまま）。
            if (patch.signCount === 2) {
                const g = signalGeometry(o);
                if (g.headH < 0.4) patch.spHeadH = Math.min(Math.max(0.3, o.h - 0.3), 0.4);
            }
        } else if (name === "signShape") patch.signShape = String(value);
        else if (name === "signShape2") patch.signShape2 = String(value);
        else return;
        HU.push(S);
        RD = [];
        setOb(sel, patch);
        render();
        syncSignShapePanel();
    }
    [["signCountSel", "signCount"], ["signShapeSel", "signShape"], ["signShape2Sel", "signShape2"]].forEach(([id, name]) => {
        const n = el(id);
        if (!n) return;
        n.onchange = () => applySignShapeControl(name, n.value);
    });
    window.cityGridSyncSignShapePanel = syncSignShapePanel;

    // ===== 6. ヘルプ・キーボード・初期表示 =====
    // 最後にヘルプ表示、初期設定、localStorage移行を登録してUIを完成させる。
    const help = document.createElement("div");
    help.id = "helpPanel";
    help.innerHTML =
        '<div class="helpTitle">操作のコツ</div><div><span class="helpKey">Pencil</span>線を引く　<span class="helpKey">指</span>視点・ピンチ</div><div><span class="helpKey">⌘ Z</span>元に戻す　<span class="helpKey">E</span>消しゴム</div><div><span class="helpKey">図形</span>ドラッグで床・壁に配置</div><div><span class="helpKey">編集</span>線を選択 → 矢印移動（X左右／Y手前奥／Z上下）／白い四角で拡縮／輪で回転</div><div><span class="helpKey">画面中央へ</span>選択中の建物（接着した看板・テントも一緒）を、いまの画面の中央へ移動</div><div><span class="helpKey">⌘ L</span>選択をロック／解除　<span class="helpKey">L</span>カメラ（視点）を固定</div><div><span class="helpKey">Shift D</span>選択中のオブジェクトをその場に複製（ずらさず重ねる。パネルの「複製」は横へずらす）</div><div><span class="helpKey">表示中央へ</span>前（7）・横（8）・上（9）の表示位置だけを選択中のオブジェクトへ寄せる（カメラは動かさない）</div><div style="margin-top:7px;color:#7f999c">アセットを追加したあと、編集モードでBlender風ギズモを使えます。人物は基準身長から作られます。<br>ロックしたオブジェクトは、ギズモ・数値パネル・整列・削除のどれでも変わりません（シーン一覧の鍵で解除）。カメラ固定中もオブジェクトの編集はできます。</div>';
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
    if (innerWidth <= 900 && !sidePref) setSide(true);
    // ===== 数値欄の「−／＋」（全パネル共通）=====
    // input.nv（数値欄）の左右へ「−」「＋」を差し込む。押すと step ぶんだけ動かし、
    // 数値欄を直接打ったときと同じ経路（input → change）へ流す。こうしておくと
    // 画面ハンドル・数値欄・元に戻す（Undo）の扱いが欄ごとに食い違わない。
    // 既に −／＋ が付いている欄（手すりの本数など）は previousElementSibling が
    // ボタンなので飛ばす。
    function nudgeNv(n, dir) {
        const step = Math.abs(Number(n.step) || 0.05) || 0.05,
            cur = Number(n.value),
            min = n.min === "" ? NaN : Number(n.min),
            max = n.max === "" ? NaN : Number(n.max);
        let v = (Number.isFinite(cur) ? cur : 0) + dir * step;
        if (Number.isFinite(min) && v < min) v = min;
        if (Number.isFinite(max) && v > max) v = max;
        // 刻みに合わせた桁数で表示する（0.05 刻みなら小数2桁）。
        const dec = (String(step).split(".")[1] || "").length;
        n.value = dec ? v.toFixed(dec) : String(Math.round(v));
        n.dispatchEvent(new Event("input", { bubbles: true }));
        n.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function installNvSteppers(root) {
        const scope = root && root.querySelectorAll ? root : document;
        scope.querySelectorAll("input.nv").forEach((n) => {
            if (n.dataset.nvStep) return;
            const prev = n.previousElementSibling;
            n.dataset.nvStep = "1";
            if (prev && prev.tagName === "BUTTON") return; // 専用の −／＋ が既にある
            const mk = (text, dir, label) => {
                const b = document.createElement("button");
                b.type = "button";
                b.className = "nvstep";
                b.textContent = text;
                b.title = label;
                b.setAttribute("aria-label", label);
                b.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    nudgeNv(n, dir);
                });
                return b;
            };
            n.parentNode.insertBefore(mk("−", -1, "少し減らす"), n);
            n.parentNode.insertBefore(mk("＋", 1, "少し増やす"), n.nextSibling);
        });
    }
    installNvSteppers(document);
    // アセットごとのパネルは後から組み立てられるので、増えたら付け足す。
    // 差し込んだボタン自身も childList を揺らすが、dataset で除外するので止まる。
    const nvHost = el("side");
    if (nvHost && typeof MutationObserver === "function") {
        let nvPending = 0;
        new MutationObserver(() => {
            if (nvPending) return;
            nvPending = requestAnimationFrame(() => {
                nvPending = 0;
                installNvSteppers(nvHost);
            });
        }).observe(nvHost, { childList: true, subtree: true });
    }
    window.cityGridStudioBridge = {
        el,
        stage,
        setStudioWorkspace,
        validStroke,
        sanitizeScene,
        fitFloorPlan,
        syncFloorPlanDockLayout: (...a) => SH.syncFloorPlanDockLayout?.(...a),
        sceneObjects,
        syncAssetAxis: () => syncAssetAxis(),
    };
    if (window.cityGridInstallAssetUI) window.cityGridInstallAssetUI(window.cityGridStudioBridge);
    updateOutliner();
    render();

    // ===== studio-floorplan.js から使うもの =====
    SH.quick = quick;
    SH.sceneObjects = sceneObjects;
    SH.fitFloorPlan = fitFloorPlan;
})();
