import {useMemo,useState} from 'react';
import {useAnalysisStore} from '../../store/analysisStore';
import CoachPanel from './CoachPanel';
import StandardDemo from '../Video/StandardDemo';
import {analyzeLongJump,planFor,cleanId,loadRecords,parseCentimeters,toCsv,RECORDS_KEY,
 type Phase,type Tier,type RecordEntry,type Report} from '../../logic/yuedong';

const phaseNames:Record<Phase,string>={preparation:'预摆屈膝',takeoff:'蹬伸起跳',airborne:'腾空收腿',landing:'落地缓冲'};
const tierNames:Record<Tier,string>={foundation:'基础巩固',improvement:'针对提高',challenge:'拓展挑战'};
const phaseOrder:Phase[]=['preparation','takeoff','airborne','landing'];
const tierOrder:Tier[]=['foundation','improvement','challenge'];

function storedRecords():RecordEntry[] {
 try{return loadRecords(localStorage.getItem(RECORDS_KEY));}catch{return []}
}
function numericBars(items:RecordEntry[]) {
 return items.filter(r=>r.measuredCm!==null && r.measuredCm!==undefined)
  .sort((a,b)=>a.date.localeCompare(b.date)).slice(-8);
}
const card='rounded-xl border border-slate-200 bg-white shadow-sm';
const button='rounded-lg px-4 py-2 text-sm font-semibold transition-colors';
export default function YuedongDashboard(){
 const {referenceAnalysis,userAnalysis,referenceMetrics,userMetrics}=useAnalysisStore();
 const [student,setStudent]=useState('学生A');
 const [tier,setTier]=useState<Tier>('foundation');
 const [checked,setChecked]=useState<string[]>([]);
 const [cm,setCm]=useState('');
 const [note,setNote]=useState('');
 const [records,setRecords]=useState<RecordEntry[]>(storedRecords);
 const [message,setMessage]=useState('');
 const id=cleanId(student);
 const report:Report=useMemo(()=>analyzeLongJump(
  userAnalysis,userMetrics?{takeoffFrame:userMetrics.takeoffFrame,landingFrame:userMetrics.landingFrame}:null,
  referenceAnalysis,referenceMetrics?{takeoffFrame:referenceMetrics.takeoffFrame,landingFrame:referenceMetrics.landingFrame}:null
 ),[userAnalysis,userMetrics,referenceAnalysis,referenceMetrics]);
 const codes=report.findings.map(f=>f.code);
 const selected=useMemo(()=>planFor(codes).filter(t=>t.tier===tier),[codes.join('|'),tier]);
 const my=records.filter(r=>r.student===id);
 const history=numericBars(my);
 const diagnoses=my.filter(r=>r.kind==='diagnosis').length;
 const max=Math.max(1,...history.map(r=>r.measuredCm||0));
 const min=Math.min(...history.map(r=>r.measuredCm||max),max);
 const persist=(kind:'diagnosis'|'practice',score:number|null,taskIds:string[])=>{
   const row:RecordEntry={
     id:Date.now()+'-'+Math.random().toString(36).slice(2,7),
     student:id,date:new Date().toISOString(),kind,findings:codes,
     taskIds:[...taskIds],measuredCm:score,note:note.trim().slice(0,300)
   };
   try{
     const updated=[row,...storedRecords()].slice(0,250);
     localStorage.setItem(RECORDS_KEY,JSON.stringify(updated));
     setRecords(updated);setMessage(kind==='diagnosis'?'已保存真实动作诊断。':'训练记录已保存，实测成绩来源为人工输入。');
     setChecked([]);setCm('');setNote('');
   }catch{setMessage('保存失败：浏览器可能禁止了本地存储。')}
 };
 const saveDiagnosis=()=>{
   if(report.status!=='ready'){setMessage('尚无有效关键点，不能保存诊断结果。');return}
   persist('diagnosis',null,[]);
 };
 const savePractice=()=>{
   const measured=parseCentimeters(cm);
   if(measured===undefined){setMessage('教师实测成绩须在 30—400 厘米范围内，也可以不填写。');return}
   if(!checked.length && measured===null && !note.trim()){setMessage('请先勾选练习、填写实测成绩或输入教师记录。');return}
   persist('practice',measured,checked);
 };
 const exportRecords=()=>{
   if(!my.length)return;
   const link=document.createElement('a'),url=URL.createObjectURL(new Blob([toCsv(my)],{type:'text/csv;charset=utf-8'}));
   link.href=url;link.download='yuedong-training-records.csv';document.body.append(link);link.click();link.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <section className="text-slate-900 space-y-5 pb-8" aria-label="跃动未来训练闭环">
   <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 space-y-2">
     <p className="text-xs tracking-[0.2em] font-semibold text-emerald-300">立定跳远 · AI教学辅助</p>
     <h2 className="text-xl md:text-2xl font-semibold">跃动未来 · 立定跳远精准学练</h2>
     <p className="text-sm text-slate-300">标准示范 → 学生动作 → 关键帧对齐 → 姿态反馈 → 分层训练 → 成长记录</p>
     <p className="text-xs text-slate-400">系统通过人体姿态关键点辅助分析动作。建议使用经授权拍摄的完整侧面视频，保持对比机位一致。</p>
   </div>
   <StandardDemo />
   <section className={card+' p-4 space-y-3'} aria-label="动作诊断">
     <div className="flex flex-wrap items-center justify-between gap-2">
       <h3 className="font-semibold text-lg">01 · 动作诊断</h3>
       <span className="text-xs text-emerald-300">{report.status==='ready'?'已完成关键点分析':'等待有效分析'}</span>
     </div>
     <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
       {phaseOrder.map((phase,i)=><div key={phase} className="rounded-lg border border-slate-700 bg-slate-900/90 p-3">
         <div className="text-xs text-emerald-400">阶段 {i+1}</div>
         <div className="text-sm mt-1">{phaseNames[phase]}</div>
         <div className="text-xl mt-2 font-semibold tabular-nums">{report.phases[phase]?.knee!==undefined ? report.phases[phase]!.knee.toFixed(1)+'°':'—'}</div>
         <p className="text-xs text-slate-400">视频估算膝角</p>
       </div>)}
     </div>
     <p role="status" className={'text-sm rounded-lg p-3 border '+(report.status==='ready'?'border-emerald-800 bg-emerald-950/60':'border-amber-900 bg-amber-950/40')}>{report.notice}</p>
     {report.status==='ready' && <div className="space-y-3">
       <div className="flex items-center justify-between text-xs text-slate-400"><span>识别有效姿态帧：{report.frameCount}</span><span>仅四类保守差异提醒</span></div>
       {report.findings.length===0
         ? <p className="rounded-lg bg-slate-900 p-3 text-sm">当前规则未发现显著差异，不代表动作完全标准，仍需体育教师复核。</p>
         : report.findings.map(f=><div key={f.code} className="rounded-lg border border-amber-900/70 bg-slate-900 p-3 space-y-1">
            <div className="font-semibold text-amber-300">{f.title} <span className="text-xs font-normal text-slate-400">({f.code} / {phaseNames[f.phase]})</span></div>
            <p className="text-xs text-slate-300">检测依据：{f.evidence}</p>
            <p className="text-sm text-slate-100">纠正建议：{f.advice}</p>
           </div>)}
       <button onClick={saveDiagnosis} className={button+' bg-emerald-600 hover:bg-emerald-500'}>保存本次诊断</button>
     </div>}
   </section>
   <section className={card+' p-4 space-y-4'} aria-label="分层学练">
     <div>
       <h3 className="font-semibold text-lg">02 · 分层学练</h3>
       <p className="text-xs text-slate-400 mt-1">根据诊断问题提示优先任务；未完成诊断时提供通用练习。动作剂量为建议值，请教师按个体情况调整。</p>
     </div>
     <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="训练等级">
       {tierOrder.map(t=><button type="button" role="tab" aria-selected={tier===t} key={t} onClick={()=>setTier(t)}
         className={'rounded-lg py-3 px-1 text-xs md:text-sm font-semibold border '+(tier===t?'bg-emerald-700 border-emerald-400':'bg-slate-900 border-slate-700 text-slate-300')}>
         {tierNames[t]}</button>)}
     </div>
     <div className="space-y-2">
       {selected.map(task=><label className="flex items-start gap-3 p-3 rounded-lg border border-slate-700 bg-slate-900 cursor-pointer" key={task.id}>
         <input type="checkbox" className="accent-emerald-500 mt-1 size-4" checked={checked.includes(task.id)}
           onChange={e=>setChecked(old=>e.target.checked?[...old,task.id]:old.filter(x=>x!==task.id))}/>
         <span className="flex-1 min-w-0">
           <span className="font-semibold text-sm">{task.name} <span className="text-emerald-300 font-normal">· {task.dose}</span></span>
           <span className="block text-sm text-slate-300 mt-1">{task.description}</span>
           <span className="block text-xs text-amber-200 mt-1">安全提示：{task.safety}</span>
         </span>
       </label>)}
     </div>
     <div className="border-t border-slate-700 pt-4 space-y-3">
       <label className="text-sm block">匿名学生编号
         <input value={student} onChange={e=>{setStudent(e.target.value);setChecked([]);setMessage('')}} maxLength={24}
           className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 text-white p-2" placeholder="例如 S001"/>
       </label>
       <div className="grid md:grid-cols-2 gap-3">
         <label className="block text-sm">教师实测成绩（厘米，可留空）
           <input type="number" min="30" max="400" step="0.1" value={cm} onChange={e=>setCm(e.target.value)}
             className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-white" placeholder="例如 168.5"/>
         </label>
         <label className="block text-sm">教师观察记录
           <input value={note} maxLength={300} onChange={e=>setNote(e.target.value)}
             className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-white" placeholder="描述练习表现"/>
         </label>
       </div>
       <div className="flex flex-wrap items-center gap-3">
         <button onClick={savePractice} className={button+' bg-emerald-600 hover:bg-emerald-500'}>保存本次训练</button>
         <span className="text-xs text-slate-400">已勾选 {checked.length} 项 · 不自动推算厘米成绩</span>
       </div>
       {message && <p role="status" className="text-sm text-emerald-200">{message}</p>}
     </div>
   </section>
   <CoachPanel issueCodes={codes}/>
   <section className={card+' p-4 space-y-4'} aria-label="成长档案">
     <div className="flex justify-between items-start gap-2">
       <div><h3 className="font-semibold text-lg">04 · 运动成长档案</h3><p className="text-xs text-slate-400 mt-1">编号 {id} · 保存在当前浏览器</p></div>
       <button onClick={exportRecords} disabled={!my.length} className={button+' border border-slate-600 disabled:opacity-40'}>导出 CSV</button>
     </div>
     <div className="grid grid-cols-3 gap-2 text-center">
       <div className="bg-slate-900 rounded-lg p-2"><div className="text-xl font-semibold">{diagnoses}</div><p className="text-xs text-slate-400">诊断记录</p></div>
       <div className="bg-slate-900 rounded-lg p-2"><div className="text-xl font-semibold">{my.filter(x=>x.kind==='practice').length}</div><p className="text-xs text-slate-400">训练记录</p></div>
       <div className="bg-slate-900 rounded-lg p-2"><div className="text-xl font-semibold">{history.length}</div><p className="text-xs text-slate-400">实测成绩</p></div>
     </div>
     {history.length? <div>
       <p className="text-xs text-slate-400 mb-2">教师实测成绩变化（cm）</p>
       <div className="flex items-end gap-2 h-32 border-b border-slate-600">
         {history.map((r,i)=><div key={r.id} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
           <span className="text-xs tabular-nums">{r.measuredCm}</span>
           <div className="bg-emerald-500 rounded-t w-full max-w-14" style={{height:Math.max(8,20+(((r.measuredCm||0)-min)/Math.max(20,max-min))*70)+'%'}}/>
           <span className="text-[10px] text-slate-500">{i+1}</span>
         </div>)}
       </div>
     </div>:<p className="text-sm text-slate-400">还没有人工实测成绩，录入后可查看变化图表。</p>}
     {!!my.length&&<div className="space-y-1 max-h-48 overflow-auto">
       {my.slice(0,8).map(r=><div key={r.id} className="flex justify-between gap-2 text-xs bg-slate-900 rounded-lg p-2">
         <span>{new Date(r.date).toLocaleString('zh-CN')}</span><span>{r.kind==='diagnosis'?'动作诊断':'分层学练'}</span>
         <span>{r.measuredCm===null?'—':r.measuredCm+' cm'}</span>
       </div>)}
     </div>}
     <p className="text-xs text-slate-500">所有成绩均由教师人工录入，不代表AI测距；请勿使用真实姓名、学号或其他敏感标识。当前无跨设备同步。</p>
   </section>
 </section>
}
