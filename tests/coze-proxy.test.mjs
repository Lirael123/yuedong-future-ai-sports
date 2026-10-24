import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../coze-proxy/worker.js';
const ORIGIN='https://lirael123.github.io';
const ENDPOINT='https://service.invalid/coach';
const ENV={ALLOWED_ORIGIN:ORIGIN,COZE_API_TOKEN:'test-secret-not-real',COZE_WORKFLOW_ID:'123456789'};
const request=(payload,origin=ORIGIN)=>new Request(ENDPOINT,{method:'POST',headers:{
 Origin:origin,'Content-Type':'application/json'
},body:JSON.stringify(payload)});
const context={question:'我落地需要练什么？',issue_codes:'SLJ-04',tier:'improvement',analysis_state:'ready',evidence_text:'落地缓冲: 145度；动作提醒代码：SLJ-04'};
test('explicit origin list supports Pages and an independent Coze site',async()=>{
 const coze='https://test-project.coze.site';
 const env={...ENV,ALLOWED_ORIGINS:`${ORIGIN}, ${coze}/`};
 for(const origin of [ORIGIN,coze]){
  const r=await worker.fetch(new Request(ENDPOINT,{method:'OPTIONS',headers:{Origin:origin}}),env);
  assert.equal(r.status,204);
  assert.equal(r.headers.get('access-control-allow-origin'),origin);
  assert.equal(r.headers.get('vary'),'Origin');
 }
 for(const origin of ['https://other.coze.site',coze+'.evil.invalid','null','']){
  const r=await worker.fetch(request(context,origin),env);
  assert.equal(r.status,403);
  assert.equal(r.headers.get('access-control-allow-origin'),'null');
 }
});
test('invalid origin configuration fails closed',async()=>{
 for(const origin of ['*','https://*.coze.site',ORIGIN+'/path','https://user:password@site.invalid','http://site.invalid',ORIGIN+',']){
  const r=await worker.fetch(request(context),{...ENV,ALLOWED_ORIGINS:origin});
  assert.equal(r.status,403);
 }
});
test('preflight allowed for configured origin',async()=>{
 const r=await worker.fetch(new Request(ENDPOINT,{method:'OPTIONS',headers:{Origin:ORIGIN}}),ENV);
 assert.equal(r.status,204);
 assert.equal(r.headers.get('access-control-allow-origin'),ORIGIN);
});
test('foreign origin is forbidden even when payload valid',async()=>{
 const r=await worker.fetch(request(context,'https://evil.invalid'),ENV);
 assert.equal(r.status,403);
});
test('unconfigured gateway is not falsely marked connected',async()=>{
 const r=await worker.fetch(request(context),{ALLOWED_ORIGIN:ORIGIN});
 assert.equal(r.status,503);
});
test('health shows configuration state only, never token',async()=>{
 const r=await worker.fetch(new Request('https://service.invalid/health',{headers:{Origin:ORIGIN}}),ENV);
 assert.equal((await r.json()).status,'configured');
});
test('reject unknown issues, invalid tier and evidence when diagnosis absent',async()=>{
 const inputs=[
  {...context,issue_codes:'SLJ-99'},
  {...context,tier:'expert'},
  {...context,analysis_state:'not_analyzed',issue_codes:'',evidence_text:'伪造视频数据'},
  {...context,question:''}
 ];
 for(const body of inputs){const r=await worker.fetch(request(body),ENV);assert.equal(r.status,400)}
});
test('pass only clean anonymous evidence as official workflow parameters and parse JSON-string answer',async()=>{
 const original=globalThis.fetch;
 let outbound;
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://api.coze.cn/v1/workflow/run');
  assert.equal(options.headers.Authorization,'Bearer test-secret-not-real');
  outbound=JSON.parse(options.body);
  return new Response(JSON.stringify({code:0,data:JSON.stringify({answer:'落地时先关注屈膝缓冲，并由老师复核。'})}),{status:200,headers:{'Content-Type':'application/json'}});
 };
 try{
  const r=await worker.fetch(request(context),ENV);
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{reply:'落地时先关注屈膝缓冲，并由老师复核。',source:'coze'});
  assert.equal(outbound.workflow_id,ENV.COZE_WORKFLOW_ID);
  assert.deepEqual(outbound.parameters,context);
  assert.ok(!('video' in outbound.parameters) && !('student' in outbound.parameters));
 }finally{globalThis.fetch=original}
});
test('accept without diagnosed evidence and do not inject fake issue code',async()=>{
 const original=globalThis.fetch;
 let outbound;
 globalThis.fetch=async(url,options)=>{
  outbound=JSON.parse(options.body);
  return new Response(JSON.stringify({code:0,data:{answer:'请先拍摄清晰的侧面视频。'}}),{status:200});
 };
 try{
  const r=await worker.fetch(request({...context,issue_codes:'',analysis_state:'not_analyzed',evidence_text:''}),ENV);
  assert.equal(r.status,200);assert.equal(outbound.parameters.issue_codes,'');assert.equal(outbound.parameters.evidence_text,'');
 }finally{globalThis.fetch=original}
});
test('failed Coze call is error, never disguised as local AI',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({code:4200,msg:'workflow not published'}),{status:200});
 try{
  const r=await worker.fetch(request(context),ENV);assert.equal(r.status,502);
  const response=await r.json();assert.ok(response.error);assert.equal(response.reply,undefined);
 }finally{globalThis.fetch=original}
});
test('published Coze Coding workflow receives only five anonymous fields with server identity',async()=>{
 const original=globalThis.fetch;
 let outbound;
 const env={ALLOWED_ORIGIN:ORIGIN,COZE_CODING_WORKFLOW_URL:'https://y26823vr3w.coze.site/run',COZE_WORKLOAD_API_TOKEN:'test-platform-token-not-real'};
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,env.COZE_CODING_WORKFLOW_URL);
  assert.equal(options.headers.Authorization,'Bearer test-platform-token-not-real');
  outbound=JSON.parse(options.body);
  return new Response(JSON.stringify({answer:'先由老师检查起跳与落地。',run_id:'test-run'}),{status:200});
 };
 try{
  const r=await worker.fetch(request(context),env);
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{reply:'先由老师检查起跳与落地。',source:'coze'});
  assert.deepEqual(outbound,context);
  assert.ok(!('workflow_id' in outbound)&&!('student' in outbound)&&!('video' in outbound));
 }finally{globalThis.fetch=original}
});
test('Coding workflow needs a server token and a trusted /run URL',async()=>{
 for(const url of ['http://y26823vr3w.coze.site/run','https://evil.invalid/run','https://y26823vr3w.coze.site/other']){
  const r=await worker.fetch(request(context),{...ENV,COZE_CODING_WORKFLOW_URL:url});
  assert.equal(r.status,503);
 }
 const r=await worker.fetch(request(context),{ALLOWED_ORIGIN:ORIGIN,COZE_CODING_WORKFLOW_URL:'https://y26823vr3w.coze.site/run'});
 assert.equal(r.status,503);
});
test('explicit production secret takes precedence over a sandbox identity',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(_url,options)=>{
  assert.equal(options.headers.Authorization,'Bearer test-production-secret');
  return new Response(JSON.stringify({answer:'请由教师复核。'}),{status:200});
 };
 try{
  const r=await worker.fetch(request(context),{
   ALLOWED_ORIGIN:ORIGIN,COZE_CODING_WORKFLOW_URL:'https://y26823vr3w.coze.site/run',
   COZE_WORKLOAD_API_TOKEN:'test-sandbox-identity',COZE_API_TOKEN:'test-production-secret'
  });
  assert.equal(r.status,200);
 }finally{globalThis.fetch=original}
});
test('Coding workflow gateway errors never become a fabricated reply',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({error:'unauthorized'}),{status:401});
 try{
  const r=await worker.fetch(request(context),{...ENV,COZE_CODING_WORKFLOW_URL:'https://y26823vr3w.coze.site/run'});
  assert.equal(r.status,502);
  assert.equal((await r.json()).reply,undefined);
 }finally{globalThis.fetch=original}
});
test('large payload rejected',async()=>{
 const r=await worker.fetch(request({...context,question:'abc'.repeat(2000)}),ENV);
 assert.equal(r.status,413);
});
test('optional limiter blocks too many requests',async()=>{
 const r=await worker.fetch(request(context),{...ENV,COACH_LIMITER:{limit:async()=>({success:false})}});
 assert.equal(r.status,429);
});
test('upstream request is aborted after 28 seconds',async t=>{
 const original=globalThis.fetch;
 let signal,started;
 const fetching=new Promise(resolve=>{started=resolve});
 t.mock.timers.enable({apis:['setTimeout']});
 globalThis.fetch=async(_url,options)=>new Promise((_resolve,reject)=>{
  signal=options.signal;
  signal.addEventListener('abort',()=>reject(new Error('upstream aborted')),{once:true});
  started();
 });
 try{
  const pending=worker.fetch(request(context),ENV);
  await fetching;
  assert.equal(signal.aborted,false);
  t.mock.timers.tick(28000);
  const r=await pending;
  assert.equal(signal.aborted,true);
  assert.equal(r.status,504);
  assert.equal((await r.json()).reply,undefined);
 }finally{globalThis.fetch=original;t.mock.timers.reset()}
});
