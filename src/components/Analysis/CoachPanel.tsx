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
 return <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3" aria-label="AI运动教练">
  <div className="flex flex-wrap items-center justify-between gap-2">
    <h3 className="font-semibold text-lg text-slate-900">03 · AI运动教练</h3>
    <span className={'text-xs rounded-full border px-2 py-1 '+(live?'text-emerald-300 border-emerald-700':'text-amber-300 border-amber-800')}>
       {live?'智能动作指导':'基础动作指导'}
    </span>
  </div>
  <p className="text-sm text-slate-300">可根据动作问题与训练等级获得练习建议、安全提醒和纠错提示。</p>
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
   <span className="text-xs text-slate-500">指导建议仅作教学辅助，动作问题请结合体育教师观察。</span>
   <button type="button" onClick={submit} disabled={busy||!question.trim()}
     className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-sm text-white hover:bg-emerald-500 disabled:opacity-50">
     {busy?'获取指导中…':'获取训练建议'}
   </button>
  </div>
  {error&&<p role="alert" className="text-sm text-amber-200 rounded-lg bg-amber-950/40 border border-amber-900 p-3">{error}</p>}
  {result&&<div className="rounded-xl border border-emerald-900 bg-slate-900 p-4 space-y-2">
    <div className="text-xs font-semibold text-emerald-300">
      {result.source==='coze'?'Coze 智能体回复':'动作练习建议 · 规则匹配'}
    </div>
    <p className="text-sm text-slate-100 whitespace-pre-wrap leading-6">{result.reply}</p>
    <p className="text-xs text-slate-400">建议仅供课堂教学辅助，不代替体育教师面对面观察与安全指导。</p>
   </div>}
 </section>;
}