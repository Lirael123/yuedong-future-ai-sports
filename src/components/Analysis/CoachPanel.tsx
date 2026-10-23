import {useEffect,useState} from 'react';
import {askCoach,type CoachTier,type CoachResult,type AnalysisState} from '../../services/coachApi';

const TIERS:{value:CoachTier;label:string}[]=[
 {value:'foundation',label:'基础巩固'},
 {value:'improvement',label:'针对提高'},
 {value:'challenge',label:'拓展挑战'}
];
type Props={issueCodes:string[];analysisState:AnalysisState;evidenceText:string};
export default function CoachPanel({issueCodes,analysisState,evidenceText}:Props){
 const [tier,setTier]=useState<CoachTier>('foundation');
 const [question,setQuestion]=useState('根据本次诊断，我应该优先练习什么？');
 const [result,setResult]=useState<CoachResult|null>(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const live=Boolean(String(import.meta.env.VITE_COACH_API_URL||'').trim());
 useEffect(()=>{setResult(null);setError('')},[analysisState,evidenceText]);
 const submit=async()=>{
  if(busy)return;
  setError('');setResult(null);
  if(!question.trim()){setError('请先输入问题。');return}
  setBusy(true);
  try{setResult(await askCoach({question,issueCodes,tier,analysisState,evidenceText}))}
  catch(e){setError(e instanceof Error?e.message:'暂时无法获取训练建议。')}
  finally{setBusy(false)}
 };
 return <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3" aria-label="AI运动教练">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <h3 className="font-semibold text-lg text-slate-900">03 · AI运动教练</h3>
   <span className={'text-xs rounded-full border px-2 py-1 '+(live?'text-emerald-700 border-emerald-200 bg-emerald-50':'text-slate-600 border-slate-200 bg-slate-50')}>
     {live?'智能动作指导':'基础动作指导'}
   </span>
  </div>
  <p className="text-sm text-slate-600">结合动作阶段、训练目标与教师观察，给出可执行的纠错练习及安全提示。</p>
  <p className="text-xs text-slate-500">
   {analysisState==='ready'?'已准备本次诊断摘要（不包含视频和身份信息）。':'本次暂无有效动作诊断，可先咨询通用技术与练习方法。'}
  </p>
  <div className="flex flex-wrap gap-2">
   {TIERS.map(t=><button key={t.value} onClick={()=>{setTier(t.value);setResult(null)}} type="button"
    aria-pressed={tier===t.value}
    className={'rounded-lg border px-3 py-2 text-xs '+(tier===t.value?'bg-emerald-700 border-emerald-600 text-white':'border-slate-200 bg-slate-50 text-slate-700')}>
    {t.label}
   </button>)}
  </div>
  <label className="text-sm text-slate-700 block">向教练提问
   <textarea rows={3} maxLength={350} value={question} onChange={e=>setQuestion(e.target.value)}
    placeholder="例如：落地时怎样屈膝缓冲？"
    className="block w-full mt-1 rounded-xl bg-white border border-slate-300 p-3 text-slate-900 placeholder:text-slate-500"/>
  </label>
  <div className="flex flex-wrap justify-between items-center gap-2">
   <span className="text-xs text-slate-500">不发送学生姓名、原始视频、学号或人脸数据；建议须由体育教师核对。</span>
   <button type="button" onClick={submit} disabled={busy||!question.trim()}
    className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-sm text-white hover:bg-emerald-600 disabled:opacity-50">
    {busy?'正在生成建议…':'获取训练建议'}
   </button>
  </div>
  {error&&<p role="alert" className="text-sm text-red-800 rounded-lg bg-red-50 border border-red-200 p-3">{error}</p>}
  {result&&<div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-2">
   <div className="text-xs font-semibold text-emerald-800">
    {result.source==='coze'?'Coze AI教练建议':'基础教学建议'}
   </div>
   <p className="text-sm text-slate-800 whitespace-pre-wrap leading-6">{result.reply}</p>
   <p className="text-xs text-slate-500">本建议用于课堂辅助教学，不替代体育教师的现场观察与安全指导。</p>
  </div>}
 </section>
}
