/* 魚眼では面内線は消し、実際の開口と意図した面上線を残す。 */
const{open}=require('./lib');
(async()=>{const{browser,page,errors}=await open({width:1200,height:800});
 const rows=await page.evaluate(()=>{
  const original=surfaceTriangles;const wall={id:'fish-wall',visible:true},front={id:'fish-front',visible:true};
  function quad(x0,x1,y0,y1,z){const a=[x0,y0,z],b=[x1,y0,z],c=[x1,y1,z],d=[x0,y1,z];return [[a,b,c],[a,c,d]];}
  surfaceTriangles=o=>o.id===wall.id?[...quad(-4,-.45,-3,3,10),...quad(.45,4,-3,3,10)]:o.id===front.id?quad(-.12,.12,-1,1,5):original(o);
  S.length=0;clearSelection();sel=null;tool='view';cityStandardView('home');orthView=null;T='f';P.surfaceMode=true;Object.assign(P,{cx:0,cz:0,ch:1,yaw:0,pitch:0,roll:0});CAMKEY=null;sync();window.__noLineCache=true;
  const line={ob:wall,d3:true,p:[[-3,0,10],[3,0,10]],c:'#000',w:2};S.push(line);const blocker={ob:front,d3:true,p:[[20,20,5],[21,20,5]],c:'#000',w:2};
  const results=[];for(const fov of [90,180,270])for(const roll of [0,35])for(const onFace of [false,true])for(const block of [false,true]){
   Object.assign(P,{fov,roll});CAMKEY=null;line.onFace=onFace;S.length=1;if(block)S.push(blocker);wall.token=fov+':'+roll+':'+onFace+':'+block;const tf=[1,0,0,1,0,0],c=lineLayer(false,false,W,H,tf,true),im=c.getContext('2d').getImageData(0,0,W,H).data;
   const ink=x=>{const q=projPoint([x,0,10],tf),px=Math.round(q.x),py=Math.round(q.y);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(im[((py+dy)*W+px+dx)*4+3]>100)return true;return false;};results.push({fov,roll,onFace,block,left:ink(-2),hole:ink(0),right:ink(2)});
  }surfaceTriangles=original;return results;
 });let bad=rows.filter(r=>r.hole===r.block||r.left!==r.onFace||r.right!==r.onFace);console.log(JSON.stringify({cases:rows.length,bad,errors}));if(bad.length||errors.length)process.exitCode=1;else console.log('OK: 魚眼の実面・開口・面上線・別物体遮蔽 24条件');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
