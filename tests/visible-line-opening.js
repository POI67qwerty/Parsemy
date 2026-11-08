/* 面と同じ深さの線が、面の開口を横切る場合の回帰テスト。
   面内の線は消し、開口内で見える部分を残す。両端だけを見て線全体を
   省略すると、開口内まで消えてしまう（以前の不具合）。 */
const { open } = require('./lib');
(async () => {
    const { browser, page, errors } = await open();
    const rows = await page.evaluate(() => {
        const save = {projPtsFor,projPoint,exportPoint,depthOwner,depthFace,depthOwnerMap,orthView,T};
        try {
            const w=200,h=200;
            orthView=null; T='3'; depthOwnerMap=new Map([['line',1]]);
            projPoint=v=>({x:v[0],y:v[1],sx:v[0],sy:v[1],depth:v[2],ok:true});
            exportPoint=projPoint; projPtsFor=s=>s.p.map(v=>projPoint(v));
            const out=[];
            for(const vertical of [false,true]) for(const center of [53,100,142]) for(const width of [5,9,19]) {
                const dep=new Float32Array(w*h), own=new Int32Array(w*h), face=new Int32Array(w*h);
                dep.fill(10); own.fill(1); face.fill(7);
                const a=center-Math.floor(width/2), b=a+width;
                for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
                    const v=vertical?y:x;
                    if(v>=a && v<b){const i=y*w+x;dep[i]=Infinity;own[i]=0;face[i]=0;}
                }
                depthOwner=own;depthFace=face;
                const s={ob:{id:'line'},d3:true,p:vertical?[[100,20,10],[100,180,10]]:[[20,100,10],[180,100,10]],c:'#000',w:1};
                const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
                const ctx=canvas.getContext('2d');strokeWVisible(ctx,s,dep,w,h,[1,0,0,1,0,0]);
                const pixels=ctx.getImageData(0,0,w,h).data;
                const ink=v=>pixels[((vertical?v:100)*w+(vertical?100:v))*4+3]>32;
                out.push({vertical,center,width,opening:ink(center),left:ink(30),right:ink(170)});
            }
            return out;
        } finally {
            projPtsFor=save.projPtsFor;projPoint=save.projPoint;exportPoint=save.exportPoint;
            depthOwner=save.depthOwner;depthFace=save.depthFace;depthOwnerMap=save.depthOwnerMap;
            orthView=save.orthView;T=save.T;
        }
    });
    const bad=rows.filter(r=>!r.opening || r.left || r.right);
    console.log(JSON.stringify(rows));
    if(bad.length || errors.length){console.error('NG',JSON.stringify({bad,errors}));process.exitCode=1;}
    else console.log('OK: 18 openings; visible portions retained and face interiors hidden');
    await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
