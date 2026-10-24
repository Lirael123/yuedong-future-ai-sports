/**
 * 跃动未来 Coze 代理 — Cloudflare Worker（中国区 Coze API）
 * GitHub Pages 或 Coze 托管的前端均只访问 /coach；Token 永远保留在 Worker Secret。
 * Run: npx wrangler dev / deploy
 */
const COZE_URL = 'https://api.coze.cn/v1/workflow/run';
const TIERS = new Set(['foundation','improvement','challenge']);
const STATES = new Set(['ready','insufficient','not_analyzed']);
const CODE_RE = /^SLJ-0[1-4]$/;
const MAX_BODY = 4096;

function upstream(env,parameters) {
  const codingUrl=String(env.COZE_CODING_WORKFLOW_URL||'').trim();
  if(codingUrl){
    let url;
    try {url=new URL(codingUrl)} catch {throw new Error('工作流地址配置错误。')}
    if(url.protocol!=='https:'||!url.hostname.endsWith('.coze.site')||url.username||url.password||url.search||url.hash||url.pathname!=='/run')
      throw new Error('工作流地址配置错误。');
    const token=env.COZE_API_TOKEN||env.COZE_WORKLOAD_API_TOKEN;
    if(!token)throw new Error('Coze 工作流尚未配置。');
    return {url:url.href,token,body:parameters,coding:true};
  }
  if(!env.COZE_API_TOKEN||!env.COZE_WORKFLOW_ID)throw new Error('Coze 工作流尚未配置。');
  const body={workflow_id:String(env.COZE_WORKFLOW_ID),parameters};
  if(env.COZE_APP_ID)body.app_id=String(env.COZE_APP_ID);
  else if(env.COZE_BOT_ID)body.bot_id=String(env.COZE_BOT_ID);
  return {url:COZE_URL,token:env.COZE_API_TOKEN,body,coding:false};
}

function configuredOrigins(env) {
  // ALLOWED_ORIGIN remains supported for existing GitHub Pages deployments.
  const configured = String(env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || '').trim();
  if (!configured) return new Set();
  const origins = configured.split(',').map(value => value.trim().replace(/\/$/, ''));
  try {
    for (const origin of origins) {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'https:' || parsed.origin !== origin) return new Set();
    }
    return new Set(origins);
  } catch {
    return new Set();
  }
}

function corsHeaders(origin) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers':'Content-Type',
    'Access-Control-Allow-Methods':'POST, GET, OPTIONS',
    'Vary':'Origin',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'
  };
}
function json(value,status,origin) {
  return new Response(JSON.stringify(value),{status,headers:corsHeaders(origin)});
}
function parseAnswer(value) {
  if(typeof value==='string') {
    const str=value.trim();
    if(!str)return '';
    try {const parsed=JSON.parse(str);return parseAnswer(parsed)}
    catch {return str}
  }
  if(value&&typeof value==='object'){
    for(const key of ['answer','reply','output','text','content','data']){
      if(Object.prototype.hasOwnProperty.call(value,key)) {
        const answer=parseAnswer(value[key]);if(answer)return answer;
      }
    }
  }
  return '';
}
function normalize(raw) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('无效请求。');
  const question=typeof raw.question==='string'?raw.question.trim():'';
  if(!question||question.length>350)throw new Error('问题不能为空，且不能超过350字。');
  const issueCodes=typeof raw.issue_codes==='string'?raw.issue_codes.trim():'';
  const codes=issueCodes?issueCodes.split(','):[];
  if(codes.length>4 || codes.some(s=>!CODE_RE.test(s)) || new Set(codes).size!==codes.length)
    throw new Error('动作问题代码不正确。');
  const tier=raw.tier;
  if(!TIERS.has(tier))throw new Error('练习等级不正确。');
  const analysis_state=raw.analysis_state??'not_analyzed';
  if(!STATES.has(analysis_state))throw new Error('诊断状态不正确。');
  const evidence_text=typeof raw.evidence_text==='string'?raw.evidence_text.trim():'';
  if(evidence_text.length>750)throw new Error('动作摘要不能超过750字。');
  // No diagnosed issues can be claimed without a valid assessment.
  if(analysis_state!=='ready' && (codes.length || evidence_text.length))
    throw new Error('无有效诊断时不能提交动作结果。');
  return {question,issue_codes:codes.join(','),tier,analysis_state,evidence_text};
}
export default {
  async fetch(request,env) {
    const origin=request.headers.get('Origin')||'';
    if(!configuredOrigins(env).has(origin))return json({error:'访问来源未授权。'},403,'null');
    const allowed=origin;
    const pathname=new URL(request.url).pathname;
    if(request.method==='OPTIONS'){
      if(pathname!=='/coach'&&pathname!=='/health')return json({error:'接口不存在。'},404,allowed);
      return new Response(null,{status:204,headers:corsHeaders(allowed)});
    }
    if(pathname==='/health'&&request.method==='GET')
      return json({status:(env.COZE_CODING_WORKFLOW_URL&&(env.COZE_WORKLOAD_API_TOKEN||env.COZE_API_TOKEN))||(env.COZE_API_TOKEN&&env.COZE_WORKFLOW_ID)?'configured':'not_configured'},200,allowed);
    if(pathname!=='/coach'||request.method!=='POST')return json({error:'接口不存在。'},404,allowed);
    let target;
    try {target=upstream(env,null)} catch(error){return json({error:error.message},503,allowed)}
    if(Number(request.headers.get('content-length')||0)>MAX_BODY)return json({error:'请求内容过长。'},413,allowed);
    let parameters;
    try{
      const raw=await request.text();
      if(raw.length>MAX_BODY)return json({error:'请求内容过长。'},413,allowed);
      parameters=normalize(JSON.parse(raw));
    }catch(error){
      return json({error:error instanceof Error?error.message:'请求解析失败。'},400,allowed);
    }
    // Production public sites should enable Cloudflare WAF/rate-limit rules as well.
    // Optional platform rate-limiter binding (configured through Cloudflare dashboard).
    if(env.COACH_LIMITER){
      try {
        const ip=request.headers.get('CF-Connecting-IP')||'unknown';
        const outcome=await env.COACH_LIMITER.limit({key:ip});
        if(!outcome.success)return json({error:'请求过于频繁，请稍后再试。'},429,allowed);
      }catch{return json({error:'接口限流服务不可用。'},503,allowed)}
    }
    target=upstream(env,parameters);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),28000);
    try{
      const response=await fetch(target.url,{
        method:'POST',
        headers:{Authorization:'Bearer '+target.token,'Content-Type':'application/json'},
        body:JSON.stringify(target.body),signal:controller.signal
      });
      if(!response.ok)return json({error:'Coze 请求失败，请检查工作流是否发布及令牌权限。'},502,allowed);
      const result=await response.json();
      if(!target.coding&&result?.code!==0)return json({error:'Coze 工作流返回错误，请查看 Coze 运行日志。'},502,allowed);
      const reply=parseAnswer(target.coding?result:result.data);
      if(!reply)return json({error:'Coze 工作流未返回 answer 内容，请检查结束节点。'},502,allowed);
      return json({reply:reply.slice(0,3500),source:'coze'},200,allowed);
    }catch{
      return json({error:'智能体服务连接超时或暂不可用。'},504,allowed);
    }finally{clearTimeout(timer)}
  }
};
