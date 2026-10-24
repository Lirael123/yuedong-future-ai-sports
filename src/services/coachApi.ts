export type CoachTier='foundation'|'improvement'|'challenge';
export type AnalysisState='ready'|'insufficient'|'not_analyzed';
export type CoachContext={
  issueCodes:string[];
  tier:CoachTier;
  question:string;
  analysisState:AnalysisState;
  evidenceText:string;
};
export type CoachResult={source:'coze'|'local';reply:string};
const LIMIT=350;
const knowledge:Record<string,{name:string,practice:string}>={
 'SLJ-01':{name:'预摆屈膝幅度可能不足',practice:'先练习原地摆臂与屈膝配合，保持节奏自然，不强求某一个膝角。'},
 'SLJ-02':{name:'蹬伸幅度可能不足',practice:'练习髋、膝、踝连续伸展，由慢动作分解过渡到教师指导下的完整起跳。'},
 'SLJ-03':{name:'腾空收腿可能不足',practice:'先进行低冲击的坐姿收腿和小腿前伸协调练习，再迁移到完整动作。'},
 'SLJ-04':{name:'落地缓冲可能不足',practice:'在防滑平整场地练习双脚落地与屈膝缓冲，保持平衡优先于距离。'}
};
export function localCoach(context:CoachContext):CoachResult {
 if(/疼|痛|扭伤|受伤|头晕|眩晕|气短|呼吸困难|不适|崴/.test(context.question)){
  return {source:'local',reply:'若正在疼痛、受伤、头晕或呼吸不适，请立即停止练习，告知体育教师和监护人，必要时寻求专业医疗评估。恢复练习时间请由教师及专业人员判断。'};
 }
 if(context.analysisState!=='ready'){
  return {source:'local',reply:'尚无有效动作诊断。可以先学习预摆、蹬伸、腾空、落地四阶段要领，再上传全身及双脚清晰可见的侧面跳远视频进行分析。若身体不适，应停止练习并告知体育教师。'};
 }
 const relevant=context.issueCodes.filter(x=>knowledge[x]).slice(0,3);
 const q=context.question;
 if(relevant.length){
  const summary=relevant.map(code=>knowledge[code].name).join('、');
  const practice=relevant.map(code=>knowledge[code].practice).join('\n');
  return {source:'local',reply:'本次视频提示可能需要关注：'+summary+'。\n'+practice+'\n每次聚焦一项动作，完成练习后在相同机位复测。结果仅供辅助教学，需教师复核。'};
 }
 if(/落地|膝盖|缓冲|摔/.test(q))return {source:'local',reply:'落地注意双脚稳定着地、屈膝缓冲，避免用膝踝硬撑。如果感到疼痛或不适，应停止练习并告知老师。'};
 if(/摆臂|起跳|蹬伸/.test(q))return {source:'local',reply:'摆臂和下肢蹬伸应配合连贯，可先慢速做分解动作，再由体育教师核查协调性。不要追求某个固定膝角。'};
 return {source:'local',reply:'这次诊断规则未提示明显差异，但不代表动作完全标准。可先选择一项适合自己的训练任务，完成后再次录制侧面视频比较。'};
}
export async function askCoach(context:CoachContext):Promise<CoachResult> {
 const question=context.question.trim();
 if(!question||question.length>LIMIT)throw new Error('请填写350字以内的问题。');
 const ready=context.analysisState==='ready';
 const payload={
  question,
  issue_codes:ready?context.issueCodes.filter(x=>/^SLJ-0[1-4]$/.test(x)).slice(0,4).join(','):'',
  tier:context.tier,
  analysis_state:context.analysisState,
  evidence_text:ready?context.evidenceText.slice(0,750):''
 };
 const url=String(import.meta.env.VITE_COACH_API_URL||'').trim();
 if(!url)return localCoach(context);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),30000);
 try {
  const response=await fetch(url,{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify(payload),signal:controller.signal
  });
  const data:unknown=await response.json().catch(()=>null);
  if(!response.ok) {
   const error=data&&typeof data==='object'&&'error' in data&&typeof data.error==='string'?data.error:'智能体接口暂不可用';
   throw new Error(error+'（HTTP '+response.status+'）');
  }
  if(!data||typeof data!=='object'||!('source' in data)||data.source!=='coze'||
    !('reply' in data)||typeof data.reply!=='string'||!data.reply.trim())
   throw new Error('Coze 工作流未返回有效教学建议，请检查结束节点。');
  return {source:'coze',reply:data.reply.trim().slice(0,3500)};
 } catch(error) {
  if(controller.signal.aborted)throw new Error('智能体处理超时，请稍后重新尝试。');
  throw error;
 } finally {clearTimeout(timer)}
}
