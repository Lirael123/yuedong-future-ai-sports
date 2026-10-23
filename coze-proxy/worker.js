/** Cloudflare Worker: Coze bearer token stays on the server. */
const respond=(data,status,origin)=>new Response(JSON.stringify(data),{status,headers:{
 'Content-Type':'application/json;charset=utf-8','Access-Control-Allow-Origin':origin,
 'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type',
 'Cache-Control':'no-store','Vary':'Origin'
}});
const answerOf=(v)=>{
 if(typeof v==='string'){try{const x=JSON.parse(v);if(x!==v)return answerOf(x)}catch{}return v.trim()}
 if(v&&typeof v==='object'){for(const k of ['answer','reply','output','text','content','data']){if(v[k]!==undefined){const s=answerOf(v[k]);if(s)return s}}}
 return '';
};
export default {
 async fetch(req,env){
  const origin=req.headers.get('Origin')||'';
  const allowed=String(env.ALLOWED_ORIGIN||'').trim();
  if(!allowed||allowed!==origin)return respond({error:'访问来源未授权。'},403,allowed);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
   'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Methods':'POST, OPTIONS',
   'Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400','Vary':'Origin'
  }});
  if(req.method!=='POST'||new URL(req.url).pathname!=='/coach')return respond({error:'接口不存在。'},404,allowed);
  if(!env.COZE_API_TOKEN||!env.COZE_WORKFLOW_ID)return respond({error:'尚未配置 Coze 工作流与令牌。'},503,allowed);
  if(Number(req.headers.get('content-length')||0)>8192)return respond({error:'提问内容过长。'},413,allowed);
  let body;
  try{body=await req.json()}catch{return respond({error:'请求格式不正确。'},400,allowed)}
  const question=typeof body?.question==='string'?body.question.trim().slice(0,350):'';
  const codes=typeof body?.issue_codes==='string'?body.issue_codes.slice(0,100):'';
  const tier=['foundation','improvement','challenge'].includes(body?.tier)?body.tier:'foundation';
  if(!question)return respond({error:'请输入问题。'},400,allowed);
  if(!/^(?:|SLJ-0[1-4](?:,SLJ-0[1-4])*)$/.test(codes))return respond({error:'诊断代码格式错误。'},400,allowed);
  try{
   const response=await fetch('https://api.coze.cn/v1/workflow/run',{method:'POST',headers:{
    Authorization:'Bearer '+env.COZE_API_TOKEN,'Content-Type':'application/json'
   },body:JSON.stringify({workflow_id:String(env.COZE_WORKFLOW_ID),parameters:{question,issue_codes:codes,tier}})});
   if(!response.ok)return respond({error:'Coze 无法响应，请检查工作流发布与鉴权。'},502,allowed);
   const data=await response.json();
   if(data?.code!==0)return respond({error:'Coze 工作流调用失败。'},502,allowed);
   const reply=answerOf(data?.data);
   if(!reply)return respond({error:'工作流没有返回 answer 文本。'},502,allowed);
   return respond({reply:reply.slice(0,4000),source:'coze'},200,allowed);
  }catch{return respond({error:'连接 Coze 超时或网络异常。'},502,allowed)}
 }
};