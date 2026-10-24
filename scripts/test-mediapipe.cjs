const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const file=path.resolve(__dirname,'../src/services/mediapipe/poseDetector.ts');
const version=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../node_modules/@mediapipe/tasks-vision/package.json'),'utf8')).version;
function load(create,resolve=async()=>({})){
 const source=fs.readFileSync(file,'utf8')
  .replaceAll('import.meta.env.BASE_URL',JSON.stringify('/test/'))
  .replaceAll('import.meta.env.VITE_MEDIAPIPE_ASSET_VERSION',JSON.stringify(version));
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 const mod=new Module(file,module);mod.filename=file;mod.paths=module.paths;
 mod.require=name=>name==='@mediapipe/tasks-vision'?
  {PoseLandmarker:{createFromOptions:create},FilesetResolver:{forVisionTasks:resolve}}:module.require(name);
 mod._compile(js,file);
 return mod.exports.poseDetector;
}
test('use same-origin model and exact installed WASM version; fall back from GPU to CPU',async()=>{
 const delegates=[];let wasm;
 const detector=load(async(_vision,options)=>{
  delegates.push(options.baseOptions.delegate);
  assert.equal(options.baseOptions.modelAssetPath,'/test/mediapipe/pose_landmarker_lite.task');
  if(options.baseOptions.delegate==='GPU')throw new Error('GPU unavailable');
  return {close(){}};
 },async url=>{wasm=url;return {}});
 await detector.initialize();
 assert.equal(wasm,`/test/mediapipe/runtime/${version}`);
 assert.deepEqual(delegates,['GPU','CPU']);
 assert.equal(detector.initialized,true);
 detector.dispose();assert.equal(detector.initialized,false);
});
test('concurrent initialization waits for the same detector',async()=>{
 let finish,calls=0;
 const waiting=new Promise(resolve=>{finish=resolve});
 const detector=load(async()=>{calls++;return waiting});
 const first=detector.initialize(),second=detector.initialize();
 await Promise.resolve();
 assert.equal(detector.initialized,false);
 finish({close(){}});
 await Promise.all([first,second]);
 assert.equal(calls,1);assert.equal(detector.initialized,true);
 detector.dispose();
});
test('initialization failure remains an error, returns no pose, and can be retried',async t=>{
 t.mock.method(console,'error',()=>{});
 let fail=true;
 const detector=load(async()=>({close(){}}),async()=>{if(fail)throw new Error('missing model');return {}});
 await assert.rejects(detector.initialize(),/人体姿态识别未能加载/);
 assert.equal(detector.initialized,false);
 assert.equal(await detector.detectPose({currentTime:0}),null);
 fail=false;await detector.initialize();assert.equal(detector.initialized,true);
 detector.dispose();
});
test('timeout includes resolver loading and closes a late detector',async t=>{
 t.mock.method(console,'error',()=>{});
 t.mock.timers.enable({apis:['setTimeout']});
 let finish,closed=0;
 const waiting=new Promise(resolve=>{finish=resolve});
 const detector=load(async()=>waiting);
 const rejection=assert.rejects(detector.initialize(),/人体姿态识别未能加载/);
 await Promise.resolve();
 t.mock.timers.tick(30000);
 await rejection;
 assert.equal(detector.initialized,false);
 finish({close(){closed++}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(closed,1);
});
