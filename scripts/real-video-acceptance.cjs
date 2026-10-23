/**
 * Real public video acceptance. Input footage is downloaded temporarily in CI from
 * Paralympics Ireland's publicly provided standing-long-jump SIDE demonstration.
 * Media is NOT copied to repository, Pages or workflow artifacts.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const file=process.env.SLJ_VIDEO_FILE;
if(!file||!fs.existsSync(file)){console.error('SLJ_VIDEO_FILE missing');process.exit(1)}
const report={source:'Paralympics Ireland',sample:'Standing-long-jump-side.mp4',
  sourceUrl:'https://paralympics.ie/wp-content/uploads/Standing-long-jump-side.mp4',
  status:'not-run',testedAt:new Date().toISOString(),checks:{},observations:[]};
async function main(){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1440,height:900},locale:'zh-CN',permissions:[]});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{if(msg.type()==='error'&& !/favicon|Bilibili|bilibili/i.test(msg.text()))errors.push(msg.text().slice(0,300))});
 const timeout=180000;
 try{
  const base='http://127.0.0.1:4173/yuedong-future-ai-sports/';
  const navigation=await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(navigation.status(),200);
  report.checks.page=true;
  // Original authored animation must stay selected while the student clip changes.
  const reference=page.locator('video[data-video-type="reference"]');
  await reference.waitFor({state:'attached'});
  assert.ok((await reference.getAttribute('src')).includes('standing-long-jump-v1.mp4'));
  report.checks.fixedReference=true;
  const userUpload=page.locator('input[type="file"]').last();
  await userUpload.setInputFiles(file,{timeout:30000});
  const actual=page.locator('video[data-video-type="user"]');
  await actual.waitFor({state:'attached',timeout:30000});
  await page.waitForFunction(()=>{const v=document.querySelector('video[data-video-type="user"]');return v&&Number.isFinite(v.duration)&&v.duration>1},{timeout:30000});
  const duration=await actual.evaluate(v=>v.duration);
  report.videoDurationSeconds=Math.round(duration*100)/100;
  report.checks.actualMp4Loaded=true;
  if(duration<2) throw new Error('Downloaded video too short for standing jump assessment');
  const wizard=page.locator('div.fixed.inset-0').filter({has:page.getByRole('button',{name:'确认标记此帧'})});
  await wizard.waitFor({state:'visible',timeout:15000});
  // The fixed reference markers must be prefilled; the user should only mark steps 3 and 4.
  await page.getByText('第 3 步，共 4 步').waitFor({timeout:10000});
  report.checks.referenceMarkersSkipped=true;
  const control=wizard.getByRole('button',{name:'▶'});
  const marker=wizard.getByRole('button',{name:'确认标记此帧'});
  const steps=Math.max(12,Math.min(40,Math.floor(duration*30*.22)));
  for(let i=0;i<steps;i++) await control.click();
  const takeoffTime=await wizard.locator('video').evaluate(v=>v.currentTime);
  await marker.click();
  await page.getByText('第 4 步，共 4 步').waitFor({timeout:10000});
  const extra=Math.max(15,Math.min(65,Math.floor(duration*30*.42)));
  for(let i=0;i<extra;i++) {
    if(await control.isDisabled())break;
    await control.click();
  }
  const landingTime=await wizard.locator('video').evaluate(v=>v.currentTime);
  await marker.click();
  await wizard.waitFor({state:'hidden',timeout:10000});
  report.markerTimes={takeoff:takeoffTime,landing:landingTime};
  report.checks.userFrameMarking=true;
  // A real start (button or existing auto-start) must result in MediaPipe frames, not mocked data.
  const stateBefore=await page.evaluate(async()=>{const s=localStorage.getItem('manual-markers');return s?JSON.parse(s):null});
  assert.ok(stateBefore&&stateBefore.reference.takeoffTime!==null&&stateBefore.user.takeoffTime!==null);
  const start=page.getByRole('button',{name:'开始动作分析'});
  if(await start.isVisible().catch(()=>false)) await start.click();
  await page.waitForFunction(()=>{
    const label=document.body.innerText;
    return label.includes('已完成关键点分析')||label.includes('关键姿态帧不足')||
      label.includes('视频分析失败')||label.includes('等待有效分析')&&!label.includes('视频分析中') && label.includes('导出分析视频');
  },null,{timeout});
  const body=await page.locator('body').innerText();
  const good=body.includes('已完成关键点分析');
  const insufficient=body.includes('关键姿态帧不足');
  report.checks.videoAnalysisFinished=good||insufficient;
  report.checks.diagnosisReady=good;
  report.checks.insufficientReported=insufficient;
  report.observations.push(body.includes('视频分析失败')?'Error reported in UI':'No explicit UI failure message');
  report.observations.push(good?'Diagnostic output produced from actual video':'No valid diagnostic output; inspect MediaPipe capture');
  report.observations.push('Keyframes were selected automatically for pipeline testing; their sporting accuracy is NOT validated.');
  // Save a real training record as follow-on workflow, no fake physical measurement.
  await page.getByRole('textbox',{name:'匿名学生编号'}).fill('TEST-PUBLIC-DEMO');
  await page.getByRole('textbox',{name:'教师观察记录'}).fill('真实视频流水线验收，未进行体育教师人工诊断');
  await page.getByRole('button',{name:'保存本次训练'}).click();
  const raw=await page.evaluate(()=>localStorage.getItem('yuedong-records-v1'));
  assert.ok(raw?.includes('TEST-PUBLIC-DEMO'));
  report.checks.trainingSaved=true;
  await page.reload({waitUntil:'domcontentloaded'});
  const check=await page.evaluate(()=>localStorage.getItem('yuedong-records-v1'));
  assert.ok(check?.includes('TEST-PUBLIC-DEMO'));
  report.checks.trainingPersists=true;
  report.browserErrors=errors.slice(0,10);
  report.status=good?'pass':'partial';
  if(!good)throw new Error('Actual MediaPipe video test did not achieve ready diagnosis');
  console.log('REAL-VIDEO PASS: duration '+duration.toFixed(2)+' sec; actual student video; diagnostic status ready; training persisted');
 }catch(e){
  report.status='fail';report.error=String(e?.stack||e);report.browserErrors=errors.slice(0,10);
  throw e;
 }finally{
  fs.writeFileSync('real-video-acceptance.json',JSON.stringify(report,null,2));
  await browser.close();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
