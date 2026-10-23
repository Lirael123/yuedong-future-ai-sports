import {useState} from 'react';
import {askCoach,type CoachTier,type CoachResult} from '../../services/coachApi';
const TIERS:{value:CoachTier;label:string}[]=[
 {value:'foundation',label:'基础巩固'},{value:'improvement',label:'针对提高'},{value:'challenge',label:'拓展挑战'}
];
export default function CoachPanel({issueCodes}:{issueCodes:string[]}){
 const [tier,setTier]=useState<CoachTier>('foundation');
 const [question,setQuestion]=useState('请根据这次动作诊断，告诉我优先练习什么？');
 const [result,setResult]=useState<CoachResult|null>(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const live=Boolean(String(import.meta.env.VITE_COACH_API_URL||'').trim());
 const submit=async()=>{
  if(busy)return;
  setError('');setResult(null);
  if(!question.trim()){setError('请先输入想咨询的问题。');return}
  setBusy(true);
  try{setResult(await askCoach({question,issueCodes,tier}))}
  catch(e){setError(e instanceof Error?e.message:'暂时无法取得智能体回复，请检查接口状态。')}
  finally{setBusy(false)}
 };
 return <section className="rounded-xl border border-slate-700 bg-slate-950/50 p-4 space-y-3" aria-label="AI运动教练">
  <div className="flex flex-wrap items-center justify-between gap-2">
    <h3 className="font-semibold text-lg text-white">03 · AI运动教练</h3>
    <span className={'text-xs rounded-full border px-2 py-1 '+(live?'text-emerald-300 border-emerald-700':'text-amber-300 border-amber-800')}>
       {live?'Coze 接口已配置（连接待实测）':'本地教学指导 · Coze 待接入'}
    </span>
  </div>
  <p className="text-sm text-slate-300">AI教练会参考当前动作问题与学练等级提供指导。未配置 Coze 时，仅返回明确标注的本地规则建议，不模拟联网回答。</p>
  <div className="flex flex-wrap gap-2">
   {TIERS.map(t=><button key={t.value} onClick={()=>setTier(t.value)} type="button"
    aria-pressed={tier===t.value}
    className={'rounded-lg border px-3 py-2 text-xs '+(tier===t.value?'bg-emerald-700 border-emerald-400 text-white':'border-slate-600 bg-slate-900 text-slate-300')}>{t.label}</button>)}
  </div>
  <label className="text-sm text-slate-200 block">向教练提问
   <textarea rows={3} maxLength={350} value={question} onChange={e=>setQuestion(e.target.value)}
     placeholder="例如：腾空时为什么要收腿？"
     className="block w-full mt-1 rounded-xl bg-slate-900 border border-slate-600 p-3 text-white placeholder:text-slate-500"/>
  </label>
  <div className="flex flex-wrap justify-between items-center gap-2">
   <span className="text-xs text-slate-400">仅发送动作问题代码与问题文本；不上传学生姓名、原始视频或身体关键点。</span>
   <button type="button" onClick={submit} disabled={busy||!question.trim()}
     className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-sm text-white hover:bg-emerald-500 disabled:opacity-50">
     {busy?'获取指导中…':'获取训练建议'}
   </button>
  </div>
  {error&&<p role="alert" className="text-sm text-amber-200 rounded-lg bg-amber-950/40 border border-amber-900 p-3">{error}</p>}
  {result&&<div className="rounded-xl border border-emerald-900 bg-slate-900 p-4 space-y-2">
    <div className="text-xs font-semibold text-emerald-300">
      {result.source==='coze'?'Coze 智能体回复':'本地规则建议（未调用 Coze）'}
    </div>
    <p className="text-sm text-slate-100 whitespace-pre-wrap leading-6">{result.reply}</p>
    <p className="text-xs text-slate-400">建议仅供课堂教学辅助，不代替体育教师面对面观察与安全指导。</p>
   </div>}
 </section>;
}