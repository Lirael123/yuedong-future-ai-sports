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
    const allowed=String(env.ALLOWED_ORIGIN||'').replace(/\/$/,'');
    if(!allowed||origin!==allowed)return json({error:'访问来源未授权。'},403,allowed||'null');
    const pathname=new URL(request.url).pathname;
    if(request.method==='OPTIONS'){
      if(pathname!=='/coach'&&pathname!=='/health')return json({error:'接口不存在。'},404,allowed);
      return new Response(null,{status:204,headers:corsHeaders(allowed)});
    }
    if(pathname==='/health'&&request.method==='GET')
      return json({status:env.COZE_API_TOKEN&&env.COZE_WORKFLOW_ID?'configured':'not_configured'},200,allowed);
    if(pathname!=='/coach'||request.method!=='POST')return json({error:'接口不存在。'},404,allowed);
    if(!env.COZE_API_TOKEN||!env.COZE_WORKFLOW_ID)return json({error:'Coze 工作流尚未配置。'},503,allowed);
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
    const payload={workflow_id:String(env.COZE_WORKFLOW_ID),parameters};
    if(env.COZE_APP_ID)payload.app_id=String(env.COZE_APP_ID);
    else if(env.COZE_BOT_ID)payload.bot_id=String(env.COZE_BOT_ID);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),28000);
    try{
      const response=await fetch(COZE_URL,{
        method:'POST',
        headers:{Authorization:'Bearer '+env.COZE_API_TOKEN,'Content-Type':'application/json'},
        body:JSON.stringify(payload),signal:controller.signal
      });
      if(!response.ok)return json({error:'Coze 请求失败，请检查工作流是否发布及令牌权限。'},502,allowed);
      const result=await response.json();
      if(result?.code!==0)return json({error:'Coze 工作流返回错误，请查看 Coze 运行日志。'},502,allowed);
      const reply=parseAnswer(result.data);
      if(!reply)return json({error:'Coze 工作流未返回 answer 内容，请检查结束节点。'},502,allowed);
      return json({reply:reply.slice(0,3500),source:'coze'},200,allowed);
    }catch{
      return json({error:'智能体服务连接超时或暂不可用。'},504,allowed);
    }finally{clearTimeout(timer)}
  }
};
