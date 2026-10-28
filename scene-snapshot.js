/* 形状スナップショット（読み取りのみ）
 *
 * 棚にある全アセットを1体ずつ置き、線画（genShape）と面メッシュ
 * （exportSurfaceTriangles）のハッシュを書き出す。リファクタ前後で
 * この JSON を比べれば、見た目が変わっていないことを機械的に確認できる。
 *
 * 使い方:
 *   node tools/scene-snapshot.js before.json     # 変更前
 *   （編集して再ビルド）
 *   node tools/scene-snapshot.js after.json      # 変更後
 *   node tools/scene-snapshot.js --diff before.json after.json
 *
 * jsdom が必要: npm i jsdom（または既存の node_modules を参照）
 */
const fs=require('fs'),crypto=require('crypto'),{JSDOM}=require('/tmp/jsdomtest/node_modules/jsdom');

if (process.argv[2] === "--diff") {
    const a = JSON.parse(fs.readFileSync(process.argv[3], "utf8")),
        b = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
    const diffs = Object.keys(a.data).filter((k) => a.data[k].sha !== b.data[k]?.sha || a.data[k].triSha !== b.data[k]?.triSha);
    console.log(diffs.length ? `DIFF: ${diffs.join(", ")}` : `same: ${Object.keys(a.data).length} kinds`);
    process.exit(diffs.length ? 1 : 0);
}
const noop=()=>{}; const fake=()=>new Proxy({}, {get(t,k){if(k==='measureText')return s=>({width:String(s).length*6});if(k==='createLinearGradient'||k==='createRadialGradient')return()=>({addColorStop:noop});if(k==='getImageData')return()=>({data:new Uint8ClampedArray(4)});return noop;},set(t,k,v){t[k]=v;return true}});
const errors=[];const d=new JSDOM(fs.readFileSync('/home/user/cyberpunk-city-studio.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){w.addEventListener('error',e=>errors.push(e.error?.stack||e.message));w.console.error=(...a)=>errors.push(a.map(String).join(' '));Object.defineProperty(w.HTMLCanvasElement.prototype,'getContext',{configurable:true,value(){return fake()}});Object.defineProperty(w.HTMLCanvasElement.prototype,'getBoundingClientRect',{configurable:true,value(){return {left:0,top:0,width:800,height:600,right:800,bottom:600}}});w.HTMLCanvasElement.prototype.setPointerCapture=()=>{};w.HTMLCanvasElement.prototype.releasePointerCapture=()=>{};w.PointerEvent=w.MouseEvent;w.document.elementFromPoint=()=>w.document.getElementById('cv')}}),w=d.window;
const ev=x=>{try{return w.eval(x)}catch(e){errors.push(String(e&&e.stack||e));return undefined}};
const kinds=ev('Object.keys(ASSETS)');
const out={};
for(const k of kinds){
  const card=w.document.querySelector(`[data-asset="${k}"]`);
  if(!card) { out[k]={skip:'no-tray-card'}; continue; }
  card.click();
  const id=ev('sel');
  const data=ev(`(()=>{const o=obOf(${JSON.stringify(id)}); o.off=[0,0,0]; o.rot=0; o.ca=0; o.cb=0;
    const g=genShape(o).map(l=>({c:l.c,w:l.w,p:l.p}));
    const t=exportSurfaceTriangles(o);
    return {geo:JSON.stringify(g),tris:JSON.stringify(t),bounds:obBounds(o),label:assetLabel(o),params:o.asset==='wallSign'?wallSignParams(o):null}})()`);
  if(!data){out[k]={error:true};continue;}
  out[k]={sha:hash(data.geo),triSha:hash(data.tris),bounds:data.bounds,lines:JSON.parse(data.geo).length,tris:JSON.parse(data.tris).length,label:data.label,params:data.params};
  ev(`(()=>{const o=obOf(${JSON.stringify(id)}); if(!o) return; const i=S.findIndex(s=>s.ob&&s.ob.id===o.id); if(i>=0) S.splice(i,1); sel=null;})()`);
}
function hash(s){return crypto.createHash('sha1').update(s).digest('hex').slice(0,12)}
fs.writeFileSync(process.argv[2]||'/tmp/cg-scene-snapshot.json',JSON.stringify({kinds:Object.keys(out),data:out,errors},null,1));
console.log('kinds',Object.keys(out).length,'errors',errors.length);
process.exit(0);
