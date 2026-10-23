export type CoachTier = 'foundation'|'improvement'|'challenge';
export type CoachContext = {issueCodes:string[];tier:CoachTier;question:string};
export type CoachResult = {source:'coze'|'local';reply:string};
const LIMIT=350;
const knowledge:Record<string,{name:string,practice:string}> = {
 'SLJ-01':{name:'预摆屈膝幅度可能不足',practice:'先进行原地摆臂与屈膝配合练习，注意动作自然，不强求某个固定角度。'},
 'SLJ-02':{name:'蹬伸幅度可能不足',practice:'练习髋膝踝协调伸展，先做不腾空的技术分解，再在教师指导下做完整动作。'},
 'SLJ-03':{name:'腾空收腿可能不足',practice:'尝试坐姿收腿与小腿前伸协调练习，逐步迁移到完整动作。'},
 'SLJ-04':{name:'落地缓冲可能不足',practice:'在平坦防滑场地练习双脚屈膝缓冲，保证平衡优先于距离。'}
};
export function localCoach(context:CoachContext):CoachResult {
 const relevant=context.issueCodes.filter(x=>knowledge[x]).slice(0,3);
 const q=context.question;
 if(relevant.length){
  const summary=relevant.map(code=>knowledge[code].name).join('、');
  const practice=relevant.map(code=>knowledge[code].practice).join('\n');
  return {source:'local',reply:'根据当前视频的试验性诊断，可能需要关注：'+summary+'。\n'+practice+'\n建议每次先抓住一项动作重点，完成练习后在相同机位复测。训练建议由动作规则匹配生成，需体育教师复核。'};
 }
 if(/落地|膝盖|缓冲|摔/.test(q))return {source:'local',reply:'落地要尽量双脚同时着地、屈膝缓冲并保持稳定。若膝踝不适，请停止跳跃并告知老师。练习时注意安全，必要时请体育教师指导。'};
 if(/摆臂|起跳|蹬伸/.test(q))return {source:'local',reply:'预摆与蹬伸应协调连续；可以先用慢速分解动作感受摆臂、屈膝和向前上方伸展。请老师结合动作录像指出重点。练习时注意安全，必要时请体育教师指导。'};
 return {source:'local',reply:'建议先上传侧面完整的立定跳远视频，并对照“预摆—蹬伸—腾空—落地”四阶段观察动作；可在分层练习区选择符合当前能力的任务。可结合教师观察结果选择练习任务。'};
}
export async function askCoach(context:CoachContext):Promise<CoachResult> {
 const question=context.question.trim().slice(0,LIMIT);
 if(!question)throw new Error('请先输入想咨询的问题。');
 const payload={question,issue_codes:context.issueCodes.filter(x=>/^SLJ-0[1-4]$/.test(x)).join(','),tier:context.tier};
 const url=String(import.meta.env.VITE_COACH_API_URL||'').trim();
 if(!url)return localCoach(context);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),15000);
 try {
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
  if(!response.ok)throw new Error('智能体服务响应异常（HTTP '+response.status+'）。');
  const data:unknown=await response.json();
  if(!data||typeof data!=='object'||!('reply' in data)||typeof data.reply!=='string'||!data.reply.trim())throw new Error('智能体接口没有返回有效回答。');
  return {source:'coze',reply:data.reply.trim().slice(0,4000)};
 } finally {clearTimeout(timer)}
}