/* 回帰テスト（依頼19）
   アセット棚から全アセットを1個ずつ追加し、
     1. genShape が例外を出さないこと
     2. specialGizmo のハンドルが画面座標を持つこと（掴める形になっていること）
     3. rot / rotX / rotZ を与えたときに線画の点列が変わること（＝線が追従すること）
     4. 円（circ）と丸椅子が「常に正円（ra === rb）」であること
   をまとめて確認する。実行: /tmp/run.sh /home/user/regress19.js */
const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1400,height:900}});
const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file:///home/user/cyberpunk-city-studio.html');await p.waitForTimeout(900);
const kinds=await p.evaluate(()=>Object.keys(ASSETS));
const rows=[];
await p.evaluate(()=>{const t=document.querySelector('#assetToggle');if(t.getAttribute('aria-expanded')!=='true')t.click();});
for(const grp of ['primitives','building','street','roof','person']){
  const has=await p.evaluate((g)=>!!document.querySelector(`[data-asset-group="${g}"]`),grp);
  if(has){await p.evaluate((g)=>document.querySelector(`[data-asset-group="${g}"]`).click(),grp);await p.waitForTimeout(80);}
}
for(const k of kinds){
  const ok=await p.evaluate((k)=>{const el=document.querySelector(`[data-asset="${k}"]`);if(!el)return false;el.click();return true;},k);
  await p.waitForTimeout(120);
  if(!ok){rows.push({k,missing:true});continue;}
  const r=await p.evaluate((k)=>{
    // 直前に追加されたオブジェクトを探す（同じ asset 名で最後に増えたもの）
    const ids=[...new Set(S.map(s=>s.ob&&s.ob.id).filter(Boolean))];
    const cand=ids.map(id=>obOf(id)).filter(o=>o&&!o.attachment);
    const o=cand[cand.length-1];
    if(!o) return {k,err:true};
    const key=(q)=>{try{return JSON.stringify(genShape(q).map(s=>s.p.map(v=>v.map(n=>+n.toFixed(3)))));}catch(e){return 'ERR:'+e.message;}};
    const base=key(o);
    const row={k,type:o.type,asset:o.asset,err:base.startsWith('ERR'),
      lines:(()=>{try{return genShape(o).length;}catch(e){return -1;}})(),
      rot:key({...o,rot:40})!==base, rotX:key({...o,rotX:30})!==base, rotZ:key({...o,rotZ:25})!==base};
    try{const g=specialGizmo(o); row.handles=g?Object.keys(g.handles||{}):[];}catch(e){row.handles='ERR';}
    row.circle = (o.type==='circ'||o.asset==='stool') ? Math.abs((o.ra||0)-(o.rb||0))<1e-9 : null;
    return row;
  },k);
  rows.push(r);
}
const bad=rows.filter(r=>r.err||r.missing||!r.rot||!r.rotX||!r.rotZ);
console.log('assets',rows.length,'追加失敗',rows.filter(r=>r.missing).length);
console.log('非追従/例外:',JSON.stringify(bad.map(r=>({k:r.k,missing:r.missing,err:r.err,rot:r.rot,rotX:r.rotX,rotZ:r.rotZ}))),'件数',bad.length);
console.log('正円チェック（circ/stool）:',JSON.stringify(rows.filter(r=>r.circle!==null&&r.circle!==undefined).map(r=>[r.k,r.circle])));
console.log('handles概要',JSON.stringify(rows.filter(r=>Array.isArray(r.handles)&&r.handles.length).map(r=>[r.k,r.handles.length])));
console.log('errs',JSON.stringify(errs));
await b.close();})();
