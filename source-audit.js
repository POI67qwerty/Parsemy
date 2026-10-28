/* City Grid Studio ソース監査ツール（読み取りのみ・ファイルは変更しない）
 *
 * 使い方:
 *   npm i acorn acorn-walk          # 初回のみ
 *   node tools/source-audit.js      # -> /tmp/cg-audit.json
 *   CG_OUT=audit.json node tools/source-audit.js
 *
 * 出力:
 *   unused          どこからも参照されていないトップレベル宣言
 *   longest         行数の多い関数（分割の候補）
 *   dupFuncs        本文が同一の関数
 *   dupBlocks       6行以上一致する重複ブロック
 *   hotIds          何度も引いているDOM id
 *   smells          TODO/console.log/長すぎる行などの目安
 */
let acorn, walk;
try {
    acorn = require('acorn');
    walk = require('acorn-walk');
} catch (err) {
    console.error('acorn / acorn-walk が必要です: npm i acorn acorn-walk');
    process.exit(1);
}
const fs=require('fs'), path=require('path');
const ROOT=process.env.CG_ROOT||'/home/user';
const FILES=['engine-core.js','engine-tools.js','asset.js','asset-controller.js','studio-ui.js'];
const src=Object.fromEntries(FILES.map(f=>[f,fs.readFileSync(path.join(ROOT,f),'utf8')]));
const asts={};
for(const f of FILES){
  asts[f]=acorn.parse(src[f],{ecmaVersion:2022,locations:true});
}
// 1. top-level declarations + reference counts (approx: whole-source textual occurrences)
function topDecls(ast,text){
  const out=[];
  for(const node of ast.body){
    if(node.type==='FunctionDeclaration') out.push({name:node.id.name,kind:'function',start:node.loc.start.line,end:node.loc.end.line,text:text.slice(node.start,node.end)});
    else if(node.type==='VariableDeclaration'){
      for(const d of node.declarations){
        if(d.id.type==='Identifier') out.push({name:d.id.name,kind:'var',start:node.loc.start.line,end:node.loc.end.line,text:text.slice(node.start,node.end)});
      }
    }
  }
  return out;
}
const allNameCount={};
for(const f of FILES){
  const text=src[f];
  for(const d of topDecls(asts[f],text)){
    allNameCount[d.name]=(allNameCount[d.name]||0)+(src[f].match(new RegExp('\\b'+d.name.replace(/[$]/g,'\\$')+'\\b','g'))||[]).length;
  }
}
// cross-file names
const crossCount={};
for(const f of FILES){
  for(const d of topDecls(asts[f],src[f])){
    if(!crossCount[d.name]){
      // 名前の出現回数を数える。$ などの記号名でも数えられるよう境界は使わない。
      let n=0; for(const g of FILES) n+=(src[g].split(d.name).length-1);
      crossCount[d.name]=n;
    }

  }
}
const unused=[], duplicateNames=[], duplicateSeen=new Set();
for(const f of FILES){
  for(const d of topDecls(asts[f],src[f])){
    if(crossCount[d.name]<=1) unused.push({file:f,...d,refs:crossCount[d.name]});
    if(duplicateSeen.has(d.name)) duplicateNames.push([d.name,f]);
    duplicateSeen.add(d.name);
  }
}
// duplicate declaration names across files
const byName={};
for(const f of FILES) for(const d of topDecls(asts[f],src[f])) (byName[d.name]=byName[d.name]||[]).push(f);
for(const [n,fs2] of Object.entries(byName)) if(fs2.length>1) duplicateNames.push([n,fs2]);
// 2. function bodies: length & normalized hash duplicates
const funcs=[];
for(const f of FILES){
  walk.full(asts[f],node=>{
    if(node.type==='FunctionDeclaration'&&node.id){
      const t=src[f].slice(node.start,node.end);
      funcs.push({file:f,name:node.id.name,lines:node.loc.end.line-node.loc.start.line+1,text:t,
        norm:t.replace(/\/\/[^\n]*/g,'').replace(/\s+/g,' ').replace(/\b[a-zA-Z_$][\w$]*\b(?=[^"']*$)/g,m=>m).trim()});
    }
  });
}
funcs.sort((a,b)=>b.lines-a.lines);
// duplicate normalized bodies
const normMap={};
for(const fn of funcs){ if(fn.lines<8) continue; const key=fn.text.replace(/\s+/g,' ').replace(/\b(function\s*)?[\w$]+\s*\(/,'('); (normMap[key]=normMap[key]||[]).push(fn); }
const dupFuncs=Object.values(normMap).filter(v=>v.length>1);
// 3. duplicate code blocks (sliding window of normalized source lines, window=6)
const blocks={};
for(const f of FILES){
  const lines=src[f].split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('//'));
  for(let i=0;i+6<=lines.length;i++){
    const key=lines.slice(i,i+6).join('\n');
    if(key.length<80) continue;
    (blocks[key]=blocks[key]||[]).push(f+':'+i);
  }
}
const dupBlocks=Object.entries(blocks).filter(([,v])=>v.length>1).sort((a,b)=>b[1].length-a[1].length);
// 4. DOM id string reuse
const idUse={};
for(const f of FILES){
  for(const m of src[f].matchAll(/(?:getElementById\("|querySelector\("#)([\w-]+)/g)) (idUse[m[1]]=idUse[m[1]]||[]).push(f);
}
const hotIds=Object.entries(idUse).filter(([,v])=>v.length>=4).sort((a,b)=>b[1].length-a[1].length);
// 5. misc smells
const smells={};
for(const f of FILES){
  smells[f]={
    todo:(src[f].match(/TODO|FIXME|XXX|HACK/g)||[]).length,
    consoleLog:(src[f].match(/console\.(log|debug)\(/g)||[]).length,
    longLines:src[f].split('\n').filter(l=>l.length>120).length,
    lines:src[f].split('\n').length,
    getById:(src[f].match(/getElementById\(/g)||[]).length,
    querySelector:(src[f].match(/querySelector(All)?\(/g)||[]).length,
    newSetInLoop:(src[f].match(/new Set\(/g)||[]).length,
    filterMapChains:(src[f].match(/\.filter\([^)]*\)\.map\(/g)||[]).length,
  };
}
fs.writeFileSync(process.env.CG_OUT||'/tmp/cg-audit.json',JSON.stringify({unused,duplicateNames,longest:funcs.slice(0,25).map(({file,name,lines})=>({file,name,lines})),dupFuncs:dupFuncs.map(v=>v.map(({file,name,lines})=>({file,name,lines}))),dupBlocks:dupBlocks.slice(0,40),hotIds:hotIds.slice(0,25),smells},null,1));
console.log('files',FILES.length,'funcs',funcs.length,'unused',unused.length,'dupFuncs',dupFuncs.length,'dupBlocks',dupBlocks.length);
