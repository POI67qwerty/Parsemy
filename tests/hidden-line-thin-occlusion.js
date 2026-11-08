/* 細い遮蔽物を線が突き抜けないこと、遮蔽物の両側が描かれることを検査。
   strokeWVisible に既知の投影と深度を与え、画素で確認する。
   面上線も、別オブジェクトが手前にあれば遮蔽される。 */
const { open } = require('./lib');
(async () => {
    const { browser, page, errors } = await open();
    const rows = await page.evaluate(() => {
        const saved = { projPtsFor, projPoint, exportPoint, depthOwner, depthFace, depthOwnerMap, orthView, T };
        try {
            const w = 200, h = 100;
            orthView = null; T = '3';
            projPoint = v => ({ x:v[0], y:v[1], sx:v[0], sy:v[1], depth:v[2], ok:true });
            exportPoint = projPoint;
            projPtsFor = s => s.p.map(v => projPoint(v));
            const s = { ob:{id:'line'}, d3:true, p:[[20,50,10],[180,50,10]], c:'#000', w:1 };
            depthOwnerMap = new Map([['line', 1]]);
            const results = [];
            for (const width of [5, 8, 12, 22]) for (const onFace of [false,true]) {
                const dep = new Float32Array(w*h), owners = new Int32Array(w*h), faces = new Int32Array(w*h);
                dep.fill(Infinity);
                const x0 = 94 - Math.floor(width/2), x1 = x0 + width - 1;
                for (let y=0; y<h; y++) for (let x=x0; x<=x1; x++) {
                    const i = y*w+x; dep[i]=5; owners[i]=2; faces[i]=5;
                }
                depthOwner=owners; depthFace=faces; s.onFace=onFace;
                const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
                const c=cv.getContext('2d');
                strokeWVisible(c,s,dep,w,h,[1,0,0,1,0,0]);
                const pixels=c.getImageData(0,0,w,h).data;
                const ink=x=>pixels[(50*w+x)*4+3]>32;
                results.push({width,onFace,left:ink(40),behind:ink(Math.floor((x0+x1)/2)),right:ink(160)});
            }
            return results;
        } finally {
            projPtsFor=saved.projPtsFor; projPoint=saved.projPoint; exportPoint=saved.exportPoint;
            depthOwner=saved.depthOwner; depthFace=saved.depthFace; depthOwnerMap=saved.depthOwnerMap;
            orthView=saved.orthView; T=saved.T;
        }
    });
    const bad = rows.filter(r => !r.left || r.behind || !r.right);
    console.log(JSON.stringify(rows));
    if (bad.length || errors.length) { console.error('NG',JSON.stringify({bad,errors})); process.exitCode=1; }
    else console.log('OK: 5–22px occluders, ordinary lines and surface lines');
    await browser.close();
})().catch(e => { console.error(e); process.exitCode=1; });
