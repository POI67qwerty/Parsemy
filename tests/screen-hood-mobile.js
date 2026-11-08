const {open,ADD_FN}=require('./lib');
(async()=>{const {browser,page,errors}=await open({width:390,height:844});await page.evaluate(ADD_FN);
 const id=await page.evaluate(()=>{S.length=0;clearSelection();__add('screenHood',1);const id=sel;setOb(id,{ca:0,cb:0,lift:0});setSide(false);document.querySelector('#objP').closest('details').open=true;render();return id;});
 await page.waitForTimeout(500);
 const specs=[];for(const key of ['hoodLength','hoodFrameDepth','hoodKnee','hoodThickness','hoodBevel']){const el=page.locator(`[data-asset-control="${key}"]`);await el.scrollIntoViewIfNeeded();specs.push({key,count:await el.count(),visible:await el.isVisible()});}
 let el=page.locator('[data-asset-control="hoodLength"]');await el.fill('0.65');await el.press('Tab');const state=await page.evaluate(id=>{let g=screenHoodParams(obOf(id));return{length:g.brimLength,frame:g.frameDepth,thickness:g.t,knee:g.knee};},id);
 const ok=specs.every(x=>x.count===1&&x.visible)&&Math.abs(state.length-.65)<1e-7&&Math.abs(state.frame-.1)<1e-7;console.log(JSON.stringify({specs,state,errors}));if(errors.length||!ok)process.exitCode=1;else console.log('OK: 幅390pxの5設定と数値編集');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
