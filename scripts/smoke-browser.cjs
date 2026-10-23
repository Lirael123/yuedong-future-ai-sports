const { chromium } = require('playwright');
const assert = require('node:assert/strict');

async function check() {
 const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
 let failures=[];
 async function run(viewport,name){
  const page=await browser.newPage({viewport,locale:'zh-CN',reducedMotion:'reduce'});
  page.on('pageerror',e=>{failures.push(name+': '+e.message)});
  const base=process.env.YUEDONG_BASE_URL||'http://127.0.0.1:4173/yuedong-future-ai-sports/';
  const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(response?.status(),200,'preview must return 200');
  await page.getByText('跃动未来 · AI立定跳远教学诊断').waitFor();
  await page.getByRole('heading',{name:/跃动未来 · 立定跳远精准学练/}).waitFor();
  await page.getByRole('heading',{name:/AI运动教练/}).waitFor();
  await page.getByText('基础动作指导').waitFor();
  await page.getByRole('heading',{name:'立定跳远标准动作示范'}).waitFor();
  const fixed = page.locator('video[data-video-type="reference"]');
  await fixed.waitFor({state:'attached',timeout:10000});
  const fixedSrc=await fixed.getAttribute('src');
  assert.ok(fixedSrc?.includes('reference/standing-long-jump-v1.mp4'),'fixed analyzable reference must load');
  const res=await page.request.get(new URL(fixedSrc,base).toString());
  assert.equal(res.status(),200,'reference mp4 must be part of local build');
  assert.ok((res.headers()['content-type']||'').includes('video/mp4'),'should serve mp4');
  await page.waitForFunction(()=>{
    const video=document.querySelector('video[data-video-type="reference"]');
    return video&&video.readyState>=2&&video.videoWidth>0;
  });
  assert.equal(await fixed.evaluate(video=>video.duration),3,'original reference must decode');
  const manifestUrl=await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifestResponse=await page.request.get(new URL(manifestUrl,base).href);
  assert.equal(manifestResponse.status(),200);
  const manifest=await manifestResponse.json();
  const basePath=new URL(base).pathname;
  assert.equal(manifest.scope,basePath,'PWA scope follows deployment path');
  assert.equal(manifest.start_url,basePath,'PWA launch follows deployment path');
  for(const icon of manifest.icons){
    const iconResponse=await page.request.get(new URL(icon.src,base).href);
    assert.equal(iconResponse.status(),200);
    assert.ok(iconResponse.headers()['content-type'].includes('image/png'));
  }
  const worker=await page.evaluate(async()=>{
    const registration=await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('Service worker not ready')),15000))
    ]);
    return {scope:registration.scope,script:registration.active?.scriptURL};
  });
  assert.equal(worker.scope,new URL(base).href);
  assert.equal(worker.script,new URL('sw.js',base).href);
  const scrollHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
  assert.ok(scrollHeight>viewport.height+300,'whole document should scroll past upload panels');
  const demo=page.locator('iframe[title="立定跳远中文标准动作教学视频"]');
  assert.ok((await demo.getAttribute('src')).includes('BV1Nz42187EP'),'Chinese coach video must be fixed');
  const palette=await page.locator('.theme-light').evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.equal(palette,'rgb(255, 255, 255)','site should have white background');
  const bodyText=await page.locator('body').innerText();
  assert.ok(!bodyText.includes('原工程'),'legacy project copy should not be visible');
  assert.ok(!bodyText.includes('Coze 待接入'),'no API placeholder status should appear');
  const diagnose=page.getByRole('heading',{name:/动作诊断/});await diagnose.waitFor();
  const practice=page.getByRole('heading',{name:/分层学练/});await practice.waitFor();
  const history=page.getByRole('heading',{name:/运动成长档案/});await history.waitFor();
  // Exercise local fallback without treating it as a connected cloud AI.
  await page.getByRole('button',{name:'获取训练建议'}).click();
  await page.getByText('基础教学建议').waitFor();
  await page.getByText(/尚无有效动作诊断。可以先学习/).waitFor();
  // Actual persistence in browser storage after an anonymous practice note.
  await page.getByRole('textbox',{name:'匿名学生编号'}).fill(name==='mobile'?'MTEST':'DTEST');
  await page.getByRole('textbox',{name:'教师观察记录'}).fill('界面自动验收记录');
  await page.getByRole('button',{name:'保存本次训练'}).click();
  await page.getByText(/训练记录已保存/).waitFor();
  const data=await page.evaluate(()=>localStorage.getItem('yuedong-records-v1'));
  assert.ok(data && data.includes('界面自动验收记录'),'localStorage should persist record');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:/运动成长档案/}).waitFor();
  const restored=await page.evaluate(()=>localStorage.getItem('yuedong-records-v1'));
  assert.equal(restored,data,'record must survive reload');
  await page.getByRole('textbox',{name:'匿名学生编号'}).fill(name==='mobile'?'MTEST':'DTEST');
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出 CSV'}).click();
  const download=await downloadPromise;
  const stream=await download.createReadStream();
  const chunks=[];for await(const chunk of stream)chunks.push(chunk);
  const csv=Buffer.concat(chunks).toString('utf8');
  assert.ok(csv.includes('界面自动验收记录'),'CSV must include the saved record');
  await page.screenshot({path:'smoke-'+name+'.png',fullPage:true,timeout:15000});
  await page.close();
 }
 try {
  await run({width:1440,height:900},'desktop');
  await run({width:390,height:844},'mobile');
  assert.deepEqual(failures,[],'no runtime page errors');
  process.stdout.write('PASS: desktop and mobile Chromium UI, PWA paths, reference decoding, local coach, persisted records and CSV\n');
 } finally {await browser.close()}
}
check().catch(e=>{console.error(e);process.exit(1)});
