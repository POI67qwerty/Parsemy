/* キャンバス上の共通アセット操作。
 * 登録型 controls と従来の専用ハンドルを同じ数値スライダーへ変換する。
 * アセットの寸法計算や変更規則は各ハンドルの既存実装を唯一の正とする。 */
window.CityCanvasControls = (function () {
    "use strict";
    const asNumber = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
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
        if(kind==='building-backFace'||kind==='stacked-opening-back')return '開口の奥行き';
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
            handles=collectHandles(sg),result=[],seen=new Set(),controls=assetEditorControls(o);
        for(const c of controls){
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
            const value=asNumber(h.start,NaN);let min=asNumber(h.min,NaN),max=asNumber(h.max,NaN);
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
            result.push({id,label:legacyLabel(kind,h),value,min,max,step:integer?1:.01,integer,unit:integer?'':(kind.startsWith('person-')?'°':'m'),handle:h,kind});seen.add(id);
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
            ed={id:o.id,o0:o,t:item.kind,sign:{...item.handle,start:v,dir:{x:1,y:0},scale:1,dir2:null},p0:{x:0,y:0},started:true};
            dragEdit({x:0,y:0});
            return true;
        } finally { ed=oldEd;snapHit=oldSnap; }
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
        panel.innerHTML='<div class="canvasAssetFixed"><button type="button" class="canvasGround">地面につける</button><button type="button" class="canvasReset" title="位置・向きは維持して形と寸法を初期状態に戻す">リセットする</button><span class="canvasAssetControlLock" hidden>ロック中</span></div><div class="canvasAssetControlItems" aria-label="選択中の形状調整"></div>';
        stage.parentNode.insertBefore(panel,stage);
        const items=panel.querySelector('.canvasAssetControlItems'),ground=panel.querySelector('.canvasGround'),reset=panel.querySelector('.canvasReset');
        let selectedId=null,signature='',session=null;
        ground.addEventListener('click',()=>{const o=selectedObjects();if(o.length===1&&!obLocked(o[0]))document.getElementById('obGnd').click();});
        reset.addEventListener('click',()=>{const o=selectedObjects();if(o.length===1&&!obLocked(o[0]))window.cityResetAssetShape?.(o[0]);});
        function sync(){
            const selected=selectedObjects(),o=selected.length===1?selected[0]:null,
                controls=o&&objectVisible(o)?[...list(o),...faces(o)]:[],show=!!o&&objectVisible(o);
            const visibilityChanged=panel.hidden===show;
            panel.hidden=!show;
            if(visibilityChanged)fitCanvasDisplay();
            if(!show){selectedId=null;signature='';session=null;return;}
            if(selectedId!==o.id){selectedId=o.id;signature='';session=null;items.scrollLeft=0;}
            ground.disabled=obLocked(o);reset.disabled=obLocked(o)||!ASSETS[o.asset];
            panel.querySelector('.canvasAssetControlLock').hidden=!obLocked(o);
            const sig=controls.map(c=>c.id).join('|');
            if(sig!==signature){
                signature=sig;items.replaceChildren();
                controls.forEach(c=>{
                    const row=document.createElement('label');row.className='canvasAssetRow';row.dataset.controlId=c.id;
                    const label=document.createElement('span'),slider=document.createElement('input'),out=document.createElement('output'),unit=document.createElement('span');
                    label.className='canvasAssetControlLabel';label.textContent=c.label;slider.type='range';slider.dataset.controlId=c.id;slider.setAttribute('aria-label',c.label);unit.className='canvasAssetControlUnit';unit.textContent=c.unit;
                    row.append(label,slider,out,unit);items.append(row);
                });
            }
            controls.forEach(c=>{
                const row=Array.from(items.children).find(n=>n.dataset.controlId===c.id),input=row?.querySelector('input');if(!input)return;
                row.querySelector('.canvasAssetControlLabel').textContent=c.label;row.querySelector('.canvasAssetControlUnit').textContent=c.unit;
                input.min=String(c.min);input.max=String(c.max);input.step=c.integer?'1':'any';input.value=String(c.value);input.disabled=obLocked(o)||c.min>=c.max;
                row.querySelector('output').textContent=String(+c.value.toFixed(4));
            });

        }
        items.addEventListener('input',event=>{
            const input=event.target;if(!(input instanceof HTMLInputElement)||!input.dataset.controlId)return;
            const selected=selectedObjects(),o=selected.length===1?selected[0]:null;
            if(!o||o.id!==selectedId||obLocked(o))return;
            const item=[...list(o),...faces(o)].find(c=>c.id===input.dataset.controlId),n=Number(input.value);
            if(!item||!Number.isFinite(n))return;
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
        return {sync,panel};
    }
    return {list,apply,install};
})();
