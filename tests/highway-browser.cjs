/* Isolated WebGL smoke test. Serves only this checkout, with external requests blocked. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'test-results');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  const requested=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!requested.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(requested,(err,data)=>{
    if(err){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',requested.endsWith('.js')?'text/javascript':'text/html');res.end(data);
  });
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
  const report=[];
  try{
    for(const config of [{name:'desktop',viewport:{width:1366,height:768}},{name:'phone',viewport:{width:390,height:844},isMobile:true,hasTouch:true}]){
      const {name,...device}=config;
      const context=await browser.newContext({...device,deviceScaleFactor:1});
      const page=await context.newPage(),errors=[];
      await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      try{
        await page.goto(origin+'/highway-rush.html');
        await page.waitForFunction(()=>!document.getElementById('drive-button').disabled,{},{timeout:30000});
        await page.waitForFunction(()=>renderer.info.render.calls>0);
        await page.screenshot({path:path.join(out,config.name+'-garage.png')});
        assert.equal(await page.locator('#render-error').isVisible(),false);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
        for(const preset of ['smooth','high','auto']){
          await page.locator('#quality').selectOption(preset);
          await page.waitForTimeout(500);
          assert.equal(errors.length,0,errors.join('\n'));
        }
        await page.locator('[aria-label="Ocean blue"]').click();
        assert.equal(await page.locator('[aria-label="Ocean blue"]').getAttribute('aria-pressed'),'true');
        await page.locator('#m-two').click();
        await page.locator('#drive-button').click();
        await page.waitForFunction(()=>running&&dist>1);
        await page.screenshot({path:path.join(out,config.name+'-driving.png')});
        if(config.name==='desktop'){
          await page.keyboard.down('ArrowLeft');await page.waitForTimeout(200);
          assert.equal(await page.evaluate(()=>keys.l),true);
          await page.keyboard.up('ArrowLeft');assert.equal(await page.evaluate(()=>keys.l),false);
        }else{
          for(const id of ['s-left','s-right','s-gas','s-brake'])assert.equal(await page.locator('#'+id).isVisible(),true);
          await page.locator('#s-gas').tap();assert.equal(await page.evaluate(()=>keys.gas),false);
        }
        await page.getByRole('button',{name:'Pause game',exact:true}).click();
        assert.equal(await page.getByRole('dialog',{name:'Game paused'}).isVisible(),true);
        const pausedDistance=await page.evaluate(()=>dist);
        await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>dist),pausedDistance);
        await page.getByRole('button',{name:'Resume game'}).click();
        await page.waitForFunction(old=>dist>old,pausedDistance);
        // Deterministic crash fixture exercises real results/replay without waiting for random traffic.
        await page.evaluate(()=>{const t=traffic[0];t.active=true;t.z=pz;t.mesh.position.set(px,0,pz);t.mesh.visible=true;});
        await page.locator('#over.show').waitFor();
        await page.getByRole('button',{name:'DRIVE AGAIN'}).click();
        await page.waitForFunction(()=>running&&dist<20);
        assert.equal(await page.locator('#over').isVisible(),false);
        assert.equal(errors.length,0,errors.join('\n'));
        report.push({device:config.name,status:'passed',render:await page.evaluate(()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,webgl:renderer.capabilities.isWebGL2}))});
      }catch(error){
        await page.screenshot({path:path.join(out,config.name+'-failure.png')});
        report.push({device:config.name,status:'failed',error:error.message,console:errors});
        process.exitCode=1;
      }
      await context.close();
    }
  }finally{
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
    await browser.close();server.close();
  }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
