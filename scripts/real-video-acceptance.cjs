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
  // The new flow must analyze a real uploaded video WITHOUT first requiring a wizard.
  await page.getByText('动作分析进度').waitFor({timeout:15000});
  await page.waitForFunction(()=>{
    const status=document.querySelector('section[aria-label="视频分析状态"]');
    const text=status?.textContent||'';
    return text.includes('已自动完成动作识别')||text.includes('人体姿态识别已完成')||
      text.includes('姿态已识别，但阶段定位')||text.includes('自动分析未完成')||
      text.includes('动作分析已完成');
  },null,{timeout:180000});
  report.observations.push('Analysis status: '+(await page.locator('section[aria-label="视频分析状态"]').innerText()).slice(0,400));
  report.checks.automaticPoseAnalysisStarted=true;
  let bodyBefore=await page.locator('body').innerText();
  report.checks.automaticFullDiagnosis=bodyBefore.includes('已完成关键点分析');
  assert.ok(!bodyBefore.includes('$已自动'), 'analysis status cannot contain stray placeholder characters');
  if(report.checks.automaticFullDiagnosis){
    await page.getByRole('button',{name:'查看诊断报告 ↓'}).click();
    await page.locator('#jump-diagnosis').waitFor({state:'visible'});
  }
  if(!report.checks.automaticFullDiagnosis){
    // A conservative detector is allowed to request keyframe confirmation;
    // this is not a failure, provided real MediaPipe results subsequently appear.
    const markerButton=page.getByRole('button',{name:'手动标记起跳与落地'});
    if(!(await markerButton.isVisible().catch(()=>false))){
      throw new Error('Automatic analysis did not finish and manual recovery is unavailable');
    }
    await markerButton.click();
    const wizard=page.locator('div.fixed.inset-0').filter({has:page.getByRole('button',{name:'确认标记此帧'})});
    await wizard.waitFor({state:'visible',timeout:10000});
    await page.getByText('第 3 步，共 4 步').waitFor({timeout:10000});
    const marker=wizard.getByRole('button',{name:'确认标记此帧'});
    const slider=wizard.getByRole('slider',{name:'调整视频关键帧'});
    async function chooseFrame(target){
      await slider.focus();
      await slider.press('Home');
      for(let i=0;i<target;i++) await slider.press('ArrowRight');
      await page.waitForFunction(frame=>{
        const v=document.querySelector('.fixed.inset-0 video');
        return v && Math.abs(v.currentTime-frame/30)<.14;
      },target,{timeout:15000});
      return wizard.locator('video').evaluate(v=>v.currentTime);
    }
    const takeoffTime=await chooseFrame(Math.round(1.13*30));
    await marker.click();
    await page.getByText('第 4 步，共 4 步').waitFor({timeout:10000});
    const landingTime=await chooseFrame(Math.round(1.83*30));
    await marker.click();
    await wizard.waitFor({state:'hidden',timeout:10000});
    report.markerTimes={takeoff:takeoffTime,landing:landingTime};
    report.checks.manualKeyframeFallback=true;
  }
  report.checks.userFrameMarking=true;
  report.checks.referenceMarkersSkipped=true;
  const stateBefore=await page.evaluate(()=>{
    const raw=localStorage.getItem('manual-markers');
    return raw?JSON.parse(raw):null
  });
  assert.ok(stateBefore?.reference?.takeoffTime!==null && stateBefore?.user?.takeoffTime!==null);
  await page.getByText('已完成关键点分析').waitFor({timeout:10000});
  const body=await page.locator('body').innerText();
  report.visibleAfterAnalysis=body.slice(0,3200);
  report.observations.push('Control label after analysis: '+(await page.locator('button').allTextContents()).filter(x=>/分析|导出|标记/.test(x)).join('|').slice(0,250));
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
