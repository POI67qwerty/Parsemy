/* 階層建物の線・面・境界を整理前後で比較（正規・個別階・不完全な旧データ）。 */
const fs=require('fs'),crypto=require('crypto');const {open,ADD_FN}=require('./lib');
(async()=>{const {browser,page,errors}=await open();await page.evaluate(ADD_FN);
 const data=await page.evaluate(()=>{let rows={};for(const kind of ['stackedBuilding','beveledStackedBuilding','cornerCutStackedBuilding']){
 S.length=0;clearSelection();window.__add(kind,1);const base=obOf(sel);
 for(let variant=0;variant<4;variant++)for(const rot of [0,37,90])for(const openingEnabled of [false,true]){
 let o={...base,ca:0,cb:0,lift:0,rot,openingEnabled,floors:base.floors.map(f=>({...f}))};
 if(variant===1){o.floors[1]={...o.floors[1],x:.3,y:-.2,z:2.5,w:3.1,d:2.4,h:2.9,rimHeight:.3,rimOverhang:.25};}
 if(variant===2){o.floors[0]={x:0,y:0,z:0};}
 if(variant===3){delete o.floors;}
 const key=[kind,variant,rot,openingEnabled].join(':'),lines=genShape(o).map(s=>({p:s.p,c:s.c,w:s.w,seam:s.seam})),tris=surfaceTriangles(o),bounds=obBounds(o);
 rows[key]=JSON.stringify({lines,tris,bounds});
 }}return rows;});
 const result=Object.fromEntries(Object.entries(data).map(([k,v])=>[k,crypto.createHash('sha256').update(v).digest('hex')])),path='tests/fixtures/stack-geometry.json';
 if(process.argv.includes('--record')){fs.writeFileSync(path,JSON.stringify(result,null,2));console.log('RECORDED',Object.keys(result).length);}else{const baseline=JSON.parse(fs.readFileSync(path,'utf8')),bad=Object.keys(result).filter(k=>result[k]!==baseline[k]);console.log(JSON.stringify({cases:Object.keys(result).length,bad,errors}));if(bad.length||errors.length)process.exitCode=1;else console.log('OK: line points, face triangles and bounds identical in 72 cases');}
 await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
