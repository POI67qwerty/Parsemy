/* 伸縮時に曲がり部を変形せず、支柱と横桟を接続したまま保つ。 */
const{open,ADD_FN}=require('./lib');(async()=>{const{browser,page,errors}=await open();await page.evaluate(ADD_FN);
const rows=await page.evaluate(()=>{const out=[];for(const kind of ['guardPoleU','guardPoleM']){
 S.length=0;clearSelection();__add(kind,1);const id=sel;setOb(id,{ca:0,cb:0,lift:0,h:.6,guardDiameter:.06});let o=obOf(id),L=guardPoleStraight(o),d=guardPoleDiameter(o),base=guardPoleBuild(o,ASSET_KIT,kind==='guardPoleM')[0].meshTriangles;
 const ctl=assetEditorControls(o).find(c=>c.key==='guardStraight');setOb(id,ctl.patch(o,L+.4));let q=obOf(id),changed=guardPoleBuild(q,ASSET_KIT,kind==='guardPoleM')[0].meshTriangles,err=0;
 for(const [start,end,dx] of [[3,11,-.2],[16,24,.2]])for(let i=start*32;i<end*32;i++)for(let p=0;p<3;p++){const a=base[i][p],b=changed[i][p];err=Math.max(err,Math.abs((b[0]-a[0])-dx),Math.abs(b[1]-a[1]),Math.abs(b[2]-a[2]));}
 const L2=guardPoleStraight(q);setOb(id,{rb:.045});q=obOf(id);const depthSync=Math.abs(q.guardDiameter-.09)<1e-10&&Math.abs(q.rb-.045)<1e-10&&Math.abs(guardPoleStraight(q)-L2)<1e-10;
 const dc=assetEditorControls(q).find(c=>c.key==='guardDiameter'),max=assetControlLimit(dc.max,q,1);setOb(id,dc.patch(q,max));q=obOf(id);const b=guardPoleBend(q),r=guardPoleDiameter(q)/2,zTop=q.h-r-b,foot=Math.min(.015,q.h*.08),crossFit=zTop-r>=foot+r-1e-10;
 const min=guardPoleMinHeight(q),width=guardPoleStraight(q);setOb(id,{h:.001});q=obOf(id);const clampHeight=Math.abs(q.h-min)<1e-10&&Math.abs(guardPoleStraight(q)-width)<1e-10;
 out.push({kind,bendTranslationError:err,straightDelta:L2-L,depthSync,crossFit,clampHeight,parts:guardPoleBuild(q,ASSET_KIT,kind==='guardPoleM').length});
}return out});console.log(JSON.stringify({rows,errors}));if(errors.length||rows.some(r=>r.bendTranslationError>1e-9||Math.abs(r.straightDelta-.4)>1e-9||!r.depthSync||!r.crossFit||!r.clampHeight))process.exitCode=1;else console.log('OK: 両カーブは変形せず平行移動、奥行きと太さの同期、極限寸法でも接続');await browser.close()})().catch(e=>{console.error(e);process.exit(1)});
