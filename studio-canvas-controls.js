/* キャンバス上の共通アセット操作。
 * 登録型 controls と従来の専用ハンドルを同じ数値スライダーへ変換する。
 * アセットの寸法計算や変更規則は各ハンドルの既存実装を唯一の正とする。 */
window.CityCanvasControls = (function () {
    "use strict";
    const asNumber = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
    let activeController = null;
    const CAMERA_CONTROLS_PERSPECTIVE = [
        { key: "lens", label: "レンズ", min: 14, max: 200, step: 1, integer: true, decimals: 0, unit: "mm" },
        { key: "yaw", label: "水平角", min: -90, max: 90, step: 0.001, integer: false, decimals: 1, unit: "°" },
        { key: "pitch", label: "仰角", min: -60, max: 60, step: 0.001, integer: false, decimals: 1, unit: "°" },
        { key: "hz", label: "アイレベル", min: -50, max: 150, step: 0.1, integer: false, decimals: 0, unit: "%" },
        { key: "ch", label: "カメラ高", min: 0.05, max: 30, step: 0.01, integer: false, decimals: 2, unit: "m" },
        { key: "cx", label: "左右位置", min: -30, max: 30, step: 0.05, integer: false, decimals: 2, unit: "m" },
        { key: "cz", label: "前後位置", min: -30, max: 30, step: 0.05, integer: false, decimals: 2, unit: "m" },
    ];
    const CAMERA_CONTROLS_FISHEYE = [
        { key: "fov", label: "画角", min: 90, max: 360, step: 1, integer: true, decimals: 0, unit: "°" },
        { key: "roll", label: "回転", min: -180, max: 180, step: 0.1, integer: false, decimals: 1, unit: "°" },
        { key: "yaw", label: "水平角", min: -90, max: 90, step: 0.001, integer: false, decimals: 1, unit: "°" },
        { key: "pitch", label: "仰角", min: -60, max: 60, step: 0.001, integer: false, decimals: 1, unit: "°" },
        { key: "ch", label: "カメラ高", min: 0.05, max: 30, step: 0.01, integer: false, decimals: 2, unit: "m" },
        { key: "cx", label: "左右位置", min: -30, max: 30, step: 0.05, integer: false, decimals: 2, unit: "m" },
        { key: "cz", label: "前後位置", min: -30, max: 30, step: 0.05, integer: false, decimals: 2, unit: "m" },
    ];
    function formatCameraValue(c, raw) {
        const n = asNumber(raw, 0);
        if (c.integer || c.decimals === 0) return String(Math.round(n));
        return n.toFixed(c.decimals ?? 2);
    }
    function cameraList() {
        if (typeof P === "undefined" || !P) return [];
        const defs = typeof T !== "undefined" && T === "f" ? CAMERA_CONTROLS_FISHEYE : CAMERA_CONTROLS_PERSPECTIVE;
        return defs.map((c) => {
            const domInput = typeof document !== "undefined" ? document.getElementById(c.key) : null,
                min = asNumber(domInput?.min, c.min),
                max = asNumber(domInput?.max, c.max);
            return {
                id: "camera:" + c.key,
                cameraKey: c.key,
                label: c.label,
                value: clamp(asNumber(P[c.key], 0), min, max),
                min,
                max,
                step: c.step,
                integer: !!c.integer,
                decimals: c.decimals,
                unit: c.unit,
            };
        });
    }
    function resetCamera() {
        if (typeof cameraLock !== "undefined" && cameraLock) {
            if (typeof notifyLocked === "function") notifyLocked("カメラは固定されています");
            return false;
        }
        const gt = document.getElementById("gt")?.value || (typeof T !== "undefined" && T === "f" ? "5" : "2"),
            defaults = { lens: 50, yaw: 39.912, hz: 50, pitch: 0, fov: 180, roll: 0, ch: 1, cx: 0, cz: 0 };
        if (gt === "1") {
            defaults.yaw = 0;
            defaults.pitch = 0;
        } else if (gt === "2") {
            defaults.pitch = 0;
        } else if (gt === "3") {
            defaults.pitch = 30;
        } else if (gt === "3u") {
            defaults.pitch = 24;
            defaults.hz = 78;
        } else if (gt === "3d") {
            defaults.pitch = -24;
            defaults.hz = 22;
        } else if (gt === "5") {
            defaults.yaw = 0;
            defaults.pitch = 0;
            defaults.roll = 0;
            defaults.fov = 180;
        } else if (gt === "6") {
            defaults.yaw = 45;
            defaults.pitch = 0;
            defaults.roll = 0;
            defaults.fov = 270;
        }
        Object.assign(P, defaults);
        if (typeof CAMKEY !== "undefined") CAMKEY = null;
        if (typeof orthView !== "undefined" && orthView) orthView = null;
        if (typeof Z !== "undefined") Z = 1;
        if (typeof ox !== "undefined") ox = 0;
        if (typeof oy !== "undefined") oy = 0;
        if (typeof sync === "function") sync();
        if (typeof regenObjects === "function") regenObjects();
        if (typeof render === "function") render();
        else if (typeof renderSoon === "function") renderSoon();
        return true;
    }
    function collectHandles(sg) {
        const found=[], seen=new Set();
        function walk(v,depth) {
            if(!v || typeof v!=="object" || depth>4 || seen.has(v))return;
            seen.add(v);
            if(v.s && v.dir && typeof v.kind==='string') { found.push(v); return; }
            if(Array.isArray(v))v.forEach(q=>walk(q,depth+1));
            else Object.keys(v).forEach(k=>{if(k!=='o' && k!=='bounds')walk(v[k],depth+1);});
        }
        walk(sg,0);
        return found;
    }
    // 左右や表裏の別ハンドルが同じパラメータを編集する場合は1行にまとめる。
    function legacyType(o,h) {
        if(h.kind.startsWith('person-joint-'))return null; // 回転用の丸ノブは対象外
        if(o.asset==='building')return 'building-'+h.kind;
        if(o.asset==='awning')return 'awning-'+h.kind;
        if(o.asset==='sign')return 'sign-'+h.kind;
        if(o.asset==='cone')return 'cone-height';
        if(o.asset==='sphere')return 'sphere-radius';
        return h.kind;
    }
    function canonical(kind) {
        if(/^building-(front|back)OpeningW/.test(kind))return 'building-opening-width';
        if(/^building-(front|back)OpeningH/.test(kind))return 'building-opening-height';
        if(/^stacked-opening-w-/.test(kind))return 'stacked-opening-width';
        return kind;
    }
    function legacyLabel(kind,h) {
        if(kind.startsWith('building-') && kind.includes('OpeningW'))return '開口の幅';
        if(kind.startsWith('building-') && kind.includes('OpeningH'))return '開口の高さ';
        if(kind==='building-backFace'||kind==='stacked-opening-back'||kind==='cornerCut-opening-depth')return '開口の凹み';
        if(kind.startsWith('stacked-opening-w-'))return '開口の幅';
        if(kind==='stacked-opening-h')return '開口の高さ';
        if(kind==='awning-edgeZ')return '前縁の高さ';
        if(kind==='sign-faceW')return '看板の幅';
        if(kind==='sign-faceH')return '看板の高さ';
        if(kind==='cone-height')return '高さ';
        if(kind==='sphere-radius'||kind==='path-radius')return '半径';
        if(kind.startsWith('path-point-'))return `制御点${Number(h.index)+1} ${['X','Y','Z'][h.axis]||''}`;
        return h.label || kind;
    }
    // 有効なギズモから操作を取得。生成面や任意部品のON/OFFをそのまま反映する。
    function list(o) {
        if(!o || (o.type!=='asset' && o.type!=='circ'))return [];
        const sg=typeof specialGizmo==='function'?specialGizmo(o):null,
            handles=collectHandles(sg),result=[],seen=new Set(),controls=assetEditorControls(o).filter(c=>{
                const activeF1=o.asset==="building"?window.__f1EditFeature:null;
                if(activeF1&&c.f1Feature!==activeF1)return false;
                if(activeF1==="awning"&&["f1AwningWidth","f1AwningOffsetX","f1AwningBackZ","f1AwningThickness","f1AwningDepth"].includes(c.key))return false;
                return typeof c.canvasVisible!=="function"||c.canvasVisible(o);
            });
        for(const c of controls){
            if(c.type==='select'&&c.canvasSelect===true){
                const id='select:'+c.key,value=assetControlValue(o,c);
                result.push({id,label:c.label||c.key,value,options:c.options||[],control:c,select:true});seen.add(id);continue;
            }
            if(!['number','range'].includes(c.type||'number'))continue;
            const h=handles.find(q=>q.paramKey===c.key);
            if(!h && c.canvasSlider!==true && !(c.type==='range' && typeof c.handle!=='function'))continue;
            const value=assetControlValue(o,c),min=assetControlLimit(c.min,o,Math.min(0,value-5)),max=assetControlLimit(c.max,o,Math.max(value+5,5)),
                id='param:'+c.key;
            if(!Number.isFinite(value)||!Number.isFinite(min)||!Number.isFinite(max)||max<min)continue;
            result.push({id,label:c.label||c.key,value,min,max,step:c.step??(c.integer?1:.01),integer:!!c.integer,unit:c.unit||'',control:c});seen.add(id);
        }
        for(const h of handles){
            if(h.paramKey)continue;
            const kind=legacyType(o,h);if(!kind)continue;
            const id='handle:'+canonical(kind);
            if(seen.has(id))continue;
            let value=asNumber(h.start,NaN),min=asNumber(h.min,NaN),max=asNumber(h.max,NaN),depthOffset=0;
            // 直線の開口は内部で壁中心からの符号付き位置を使う。UIでは正面からの凹み量にする。
            if(kind==='building-backFace'||kind==='stacked-opening-back'){
                const g=kind==='building-backFace'?buildingGeometry(o):stackedOpeningParams(o,o.floors?.[0]);
                depthOffset=g.d/2;value+=depthOffset;min+=depthOffset;max+=depthOffset;
            }
            // 窓1枚は割付セルより大きくならない。ハンドルの上限は壁全体なので、
            // スライダーには実際に形が変化するセル上限を使う。
            if(kind==='window-grid-width'||kind==='window-grid-height'){
                const w=Math.max(.2,Math.abs(Number(o.ra)||.2)*2),height=Math.max(.2,Math.abs(Number(o.h)||.2)),q=windowGridOptions(o,w,height),
                    cellW=Math.max(.03,(Math.max(.04,w-q.mx*2)-q.gx*Math.max(0,q.cols-1))/Math.max(1,q.cols)),
                    cellH=Math.max(.03,(Math.max(.04,height-q.sill-q.head)-q.gz*Math.max(0,q.rows-1))/Math.max(1,q.rows));
                max=kind==='window-grid-width'?cellW:cellH;min=Math.min(min,max);
            }
            if(!Number.isFinite(value)||!Number.isFinite(min)||!Number.isFinite(max)||max<min)continue;
            const integer=!!h.integer||kind==='recessed-window-count';
            result.push({id,label:legacyLabel(kind,h),value,min,max,step:integer?1:.01,integer,unit:integer?'':(kind.startsWith('person-')?'°':'m'),handle:h,kind,depthOffset});seen.add(id);
            // 庇の前縁は1つの菱形に高さ・奥行きの2軸がある。スライダーでは独立させる。
            if(kind==='awning-edgeZ' && Number.isFinite(h.start2) && Number.isFinite(h.min2) && Number.isFinite(h.max2)){
                result.push({id:'handle:awning-edgeY',label:'前縁の前後',value:h.start2,min:h.min2,max:h.max2,step:.01,unit:'m',kind:'awning-edgeY',handle:h});
            }
        }
        return result;
    }
    // 旧ギズモの分岐を二重に書かず、同じドラッグ実装を「移動量ゼロ＋指定開始値」で呼ぶ。
    // 一時的な編集状態は同期的に退避し、履歴は外側のスライダー編集が管理する。
    function apply(o,item,value) {
        if(!o || !item || obLocked(o) || !Number.isFinite(value))return false;
        const v=clamp(item.integer?Math.round(value):value,item.min,item.max);
        if(item.control){
            const c=item.control,patch=typeof c.patch==='function'?c.patch(o,v):{[c.key]:v};
            return setOb(o.id,patch)!==false;
        }
        if(item.kind==='awning-edgeY'){
            const h=item.handle;
            return setOb(o.id,{awningEdgeY:snapAwningEdge(snapAwningEdge(v,h.min2),h.max2),awningFrontBottom:h.frontBottom,awningEdgeEdited:true})!==false;
        }
        const oldEd=ed,oldSnap=snapHit;
        if(oldEd)return false;
        try{
            ed={id:o.id,o0:o,t:item.kind,sign:{...item.handle,start:v-(item.depthOffset||0),dir:{x:1,y:0},scale:1,dir2:null},p0:{x:0,y:0},started:true};
            dragEdit({x:0,y:0});
            return true;
        } finally { ed=oldEd;snapHit=oldSnap; }
    }
    function toggles(o) {
        if(!o || (o.type!=='asset' && o.type!=='circ'))return [];
        return assetEditorControls(o).filter(c=>c.type==='boolean' && c.canvasToggle===true && (!c.f1Feature||(o.asset==="building"&&window.__f1EditFeature===c.f1Feature)) && (typeof c.canvasVisible!=="function"||c.canvasVisible(o))).map(c=>({
            id:'toggle:'+c.key,
            label:c.label||c.key,
            checked:!!assetControlValue(o,c),
            toggle:true,
            control:c,
        }));
    }
    // 白い面ハンドルはそれぞれ反対側を固定して外形を変更する。
    // 対応する面だけを取り出し、既存の facePatch をそのまま使う。
    function faces(o) {
        if(!o || isStackedBuildingAsset(o) || o.type==='compound')return [];
        const names={'u+':'幅＋','u-':'幅−','v+':'奥行き＋','v-':'奥行き−','top':'高さ＋','base':'高さ−',
            'n+':'厚さ＋','n-':'厚さ−'};
        const circle=o.type==='circ'||(o.type==='asset'&&o.asset==='stool');
        const solid=['asset','box','cyl','rect','circ','triPrism','triPyramid'].includes(o.type) && !(o.type==='asset'&&ASSETS[o.asset]?.heightControl==='custom');
        const ids=o.attachment?.wallSideSign?['u+','u-','v+','v-','n+','n-']:[...(circle?[]:['u+','u-','v+','v-']),...(solid?['top','base']:[])];
        return ids.map(id=>{
            const axis=id[0],value=axis==='u'?Math.abs(o.ra)*2:axis==='v'?Math.abs(o.rb)*2:Math.max(0,Number(o.h)||0);
            return {id:'face:'+id,label:names[id],value,min:0,max:Math.max(10,Math.ceil(value/10)*20),step:.01,unit:'m',face:id};
        });
    }
    function install(stage){
        const panel=document.createElement('div');panel.id='canvasAssetControl';panel.hidden=true;
        panel.innerHTML='<div class="canvasAssetFixed"><button type="button" class="canvasGround">地面につける</button><button type="button" class="canvasReset" title="位置・向きは維持して形と寸法を初期状態に戻す">リセットする</button><label class="canvasPoleSignalToggle" hidden><input type="checkbox" aria-label="電柱に歩行者信号を付ける">歩行者信号</label><span class="canvasAssetControlLock" hidden>ロック中</span></div><div class="canvasAssetControlItems" aria-label="選択中の形状調整"></div>';
        stage.parentNode.insertBefore(panel,stage);
        const items=panel.querySelector('.canvasAssetControlItems'),ground=panel.querySelector('.canvasGround'),reset=panel.querySelector('.canvasReset'),lockBadge=panel.querySelector('.canvasAssetControlLock'),poleSignalToggle=panel.querySelector('.canvasPoleSignalToggle'),poleSignalInput=poleSignalToggle.querySelector('input');
        const rowMap=new Map();
        let selectedId=null,signature='',session=null;
        ground.addEventListener('click',()=>{
            if(typeof mode!=='undefined'&&mode==='view')return;
            const o=selectedObjects();
            if(o.length===1&&!obLocked(o[0]))document.getElementById('obGnd').click();
        });
        reset.addEventListener('click',()=>{
            if(typeof mode!=='undefined'&&mode==='view'){
                resetCamera();
                return;
            }
            const o=selectedObjects();
            if(o.length===1&&!obLocked(o[0]))window.cityResetAssetShape?.(o[0]);
        });
        poleSignalInput.addEventListener('change',()=>{
            const picked=selectedObjects(),o=picked.length===1?picked[0]:null;
            if(!o||o.asset!=="utilityPole"||obLocked(o))return;
            HU.push(S);RD=[];session=null;setOb(o.id,{polePedestrianSignal:poleSignalInput.checked});render();
        });
        function rebuildRows(controls){
            items.replaceChildren();
            rowMap.clear();
            controls.forEach(c=>{
                const row=document.createElement('label');row.className='canvasAssetRow';row.dataset.controlId=c.id;
                const label=document.createElement('span'),slider=document.createElement(c.select?'select':'input');
                label.className='canvasAssetControlLabel';label.textContent=c.label;slider.dataset.controlId=c.id;slider.setAttribute('aria-label',c.label);
                if(c.toggle){
                    slider.type='checkbox';slider.dataset.assetToggle=c.control.key;
                    row.append(label,slider);
                }else if(c.select){
                    slider.dataset.assetSelect=c.control.key;
                    for(const option of c.options){const node=document.createElement('option');node.value=String(option.value);node.textContent=option.label||String(option.value);slider.append(node);}
                    row.append(label,slider);
                }else{
                    const out=document.createElement('output'),unit=document.createElement('span');
                    slider.type='range';unit.className='canvasAssetControlUnit';unit.textContent=c.unit;
                    if(c.cameraKey){
                        slider.dataset.cameraControl=c.cameraKey;
                        slider.dataset.assetControl=c.cameraKey;
                    }else if(c.control?.key){
                        slider.dataset.assetControl=c.control.key;
                    }
                    row.append(label,slider,out,unit);
                }
                items.append(row);
                rowMap.set(c.id,{row,label,slider,out:row.querySelector('output'),unit:row.querySelector('.canvasAssetControlUnit')});
            });
        }
        function sync(){
            const isCameraMode=typeof mode!=='undefined'&&mode==='view';
            if(isCameraMode){
                const controls=cameraList(),show=controls.length>0,
                    locked=typeof cameraLock!=='undefined'&&!!cameraLock,
                    visibilityChanged=panel.hidden===show;
                panel.hidden=!show;
                panel.dataset.mode='camera';
                if(visibilityChanged)fitCanvasDisplay();
                if(!show){selectedId=null;signature='';session=null;return;}
                if(selectedId!=='__camera__'){selectedId='__camera__';signature='';session=null;items.scrollLeft=0;}
                items.setAttribute('aria-label','カメラの調整');
                ground.hidden=true;
                poleSignalToggle.hidden=true;
                reset.hidden=false;
                reset.disabled=locked;
                reset.title='カメラの位置・向き・レンズを現在のグリッド種別の初期状態に戻す';
                lockBadge.textContent='カメラ固定中';
                lockBadge.hidden=!locked;
                const sig='camera:'+controls.map(c=>c.id).join('|');
                if(sig!==signature){
                    signature=sig;
                    rebuildRows(controls);
                }
                controls.forEach(c=>{
                    const ref=rowMap.get(c.id);if(!ref)return;
                    ref.label.textContent=c.label;
                    ref.unit.textContent=c.unit;
                    ref.slider.min=String(c.min);
                    ref.slider.max=String(c.max);
                    ref.slider.step=c.integer?'1':String(c.step||'any');
                    ref.slider.value=String(c.value);
                    ref.slider.disabled=locked||c.min>=c.max;
                    ref.out.textContent=formatCameraValue(c,c.value);
                });
                return;
            }
            panel.dataset.mode='asset';
            items.setAttribute('aria-label','選択中の形状調整');
            ground.hidden=false;
            reset.hidden=false;
            reset.title='位置・向きは維持して形と寸法を初期状態に戻す';
            lockBadge.textContent='ロック中';
            const selected=selectedObjects(),o=selected.length===1?selected[0]:null,
                controls=o&&objectVisible(o)?[...toggles(o),...list(o),...faces(o)]:[],show=!!o&&objectVisible(o);
            const visibilityChanged=panel.hidden===show;
            panel.hidden=!show;
            poleSignalToggle.hidden=!o||o.asset!=="utilityPole";
            if(visibilityChanged)fitCanvasDisplay();
            if(!show){selectedId=null;signature='';session=null;return;}
            if(selectedId!==o.id){selectedId=o.id;signature='';session=null;items.scrollLeft=0;}
            const locked=obLocked(o);
            ground.disabled=locked;reset.disabled=locked||!ASSETS[o.asset];
            if(o.asset==="utilityPole"){poleSignalInput.checked=!!o.polePedestrianSignal;poleSignalInput.disabled=locked;}
            lockBadge.hidden=!locked;
            const sig=controls.map(c=>c.id).join('|');
            if(sig!==signature){
                signature=sig;
                rebuildRows(controls);
            }
            controls.forEach(c=>{
                const ref=rowMap.get(c.id);if(!ref)return;
                ref.label.textContent=c.label;
                if(c.toggle){
                    ref.slider.checked=!!c.checked;ref.slider.disabled=locked;
                    return;
                }
                if(c.select){ref.slider.value=String(c.value);ref.slider.disabled=locked;return;}
                ref.unit.textContent=c.unit;
                ref.slider.min=String(c.min);ref.slider.max=String(c.max);ref.slider.step=c.integer?'1':'any';ref.slider.value=String(c.value);ref.slider.disabled=locked||c.min>=c.max;
                ref.out.textContent=String(+c.value.toFixed(4));
            });
        }
        items.addEventListener('input',event=>{
            const input=event.target;if(!(input instanceof HTMLInputElement)&&!(input instanceof HTMLSelectElement)||!input.dataset.controlId)return;
            if(typeof mode!=='undefined'&&mode==='view'&&input.dataset.cameraControl){
                if(typeof cameraLock!=='undefined'&&cameraLock){
                    if(typeof notifyLocked==='function')notifyLocked('カメラは固定されています');
                    return;
                }
                const key=input.dataset.cameraControl,item=cameraList().find(c=>c.cameraKey===key);
                if(!item)return;
                const n=Number(input.value);
                if(!Number.isFinite(n))return;
                const value=clamp(item.integer?Math.round(n):n,item.min,item.max);
                if(typeof setP==='function')setP(key,value);
                else P[key]=value;
                const ref=rowMap.get(item.id);
                if(ref?.out)ref.out.textContent=formatCameraValue(item,P[key]);
                if(typeof render==='function')render();
                else if(typeof renderSoon==='function')renderSoon();
                return;
            }
            const selected=selectedObjects(),o=selected.length===1?selected[0]:null;
            if(!o||o.id!==selectedId||obLocked(o))return;
            const item=[...toggles(o),...list(o),...faces(o)].find(c=>c.id===input.dataset.controlId);
            if(!item)return;
            if(item.select){
                const value=String(input.value),c=item.control;if(value===String(item.value))return;
                HU.push(S);RD=[];session=null;setOb(o.id,typeof c.patch==='function'?c.patch(o,value):{[c.key]:value});render();return;
            }
            if(item.toggle){
                const value=!!input.checked,c=item.control;
                if(value===item.checked)return;
                if(o.asset==='building'&&c.key==='wallSideSignEnabled'){
                    const sideCheck=document.getElementById('wallSideSign');
                    if(sideCheck){sideCheck.checked=value;sideCheck.dispatchEvent(new Event('change',{bubbles:true}));return;}
                }
                HU.push(S);RD=[];session=null;
                setOb(o.id,typeof c.patch==='function'?c.patch(o,value):{[c.key]:value});
                render();
                return;
            }
            const n=Number(input.value);
            if(!Number.isFinite(n))return;
            const value=clamp(item.integer?Math.round(n):n,item.min,item.max);
            if(Math.abs(value-item.value)<1e-9)return;
            if(!session||session.id!==o.id||session.key!==item.id){HU.push(S);RD=[];session={id:o.id,key:item.id};}
            if(item.face){
                let delta=value-item.value;
                if(o.asset==='sign' && (item.face==='top'||item.face==='base'))delta*=.74;
                const patch=o.attachment?.wallSideSign?wallSideSignFacePatch(o,item.face,delta):
                    o.asset==='building'?buildingOuterFacePatch(o,item.face,delta):facePatch(o,item.face,delta);
                setOb(o.id,patch);
            }else apply(o,item,value);
            render();
        });
        for(const event of ['change','focusout','pointercancel'])items.addEventListener(event,()=>{session=null;});
        activeController={sync,panel};
        return activeController;
    }
    return {list,cameraList,resetCamera,apply,install,sync:()=>activeController?.sync?.()};
})();
