const { chromium, devices } = require('playwright');
const assert = require('node:assert/strict');

async function check() {
 const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
 let failures=[];
 async function run(viewport,name){
  const page=await browser.newPage({viewport,locale:'zh-CN',reducedMotion:'reduce'});
  page.on('pageerror',e=>{failures.push(name+': '+e.message)});
  const base='http://127.0.0.1:4173/yuedong-future-ai-sports/';
  const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(response?.status(),200,'preview must return 200');
  await page.getByText('跃动未来 · AI立定跳远教学诊断').waitFor();
  await page.getByRole('heading',{name:/跃动未来 · 立定跳远精准学练/}).waitFor();
  await page.getByRole('heading',{name:/AI运动教练/}).waitFor();
  await page.getByText('本地教学指导 · Coze 待接入').waitFor();
  const diagnose=page.getByRole('heading',{name:/动作诊断/});await diagnose.waitFor();
  const practice=page.getByRole('heading',{name:/分层学练/});await practice.waitFor();
  const history=page.getByRole('heading',{name:/运动成长档案/});await history.waitFor();
  // Exercise local fallback without treating it as a connected cloud AI.
  await page.getByRole('button',{name:'获取训练建议'}).click();
  await page.getByText('本地规则建议（未调用 Coze）').waitFor();
  await page.getByText(/这里使用本地教学规则/).waitFor();
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
  await page.screenshot({path:'smoke-'+name+'.png',fullPage:true,timeout:15000});
  await page.close();
 }
 try {
  await run({width:1440,height:900},'desktop');
  await run({width:390,height:844},'mobile');
  assert.deepEqual(failures,[],'no runtime page errors');
  process.stdout.write('PASS: desktop and mobile startup, Chinese UI, local coach, persistent record and screenshots\n');
 } finally {await browser.close()}
}
check().catch(e=>{console.error(e);process.exit(1)});
