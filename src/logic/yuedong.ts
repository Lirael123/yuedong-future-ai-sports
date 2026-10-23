/**
 * 跃动未来 V1 — browser-side standing long jump teaching assistance.
 * Inputs are genuine MediaPipe landmarks emitted by the reused feedback-loop video engine.
 * Do not interpret comparison scores as validated sports examination scores or measurement.
 */
export type Phase = 'preparation' | 'takeoff' | 'airborne' | 'landing';
export type Tier = 'foundation' | 'improvement' | 'challenge';
export type Landmark = {x:number;y:number;visibility?:number};
export type VideoFrame = {timestamp:number; landmarks:Landmark[]|null};
export type VideoAnalysisInput = {frames:VideoFrame[];isComplete:boolean};
export type JumpMarkers = {takeoffFrame:number|null;landingFrame:number|null};
export type Snapshot = {frame:number;timestamp:number;knee:number;hip:number|null};
export type Finding = {code:string;phase:Phase;title:string; evidence:string;advice:string};
export type Report = {status:'ready'|'insufficient';notice:string;frameCount:number;phases:Partial<Record<Phase,Snapshot>>;findings:Finding[]};
export type Task = {id:string;tier:Tier;name:string;dose:string;description:string; safety:string;reason:string};
export type RecordEntry = {
 id:string;student:string;date:string;kind:'diagnosis'|'practice';findings:string[];
 taskIds:string[];measuredCm:number|null;note:string
};
export const RECORDS_KEY='yuedong-records-v1';
const phases:Phase[]=['preparation','takeoff','airborne','landing'];
const unknownReport=(notice:string):Report=>({status:'insufficient',notice,frameCount:0,phases:{},findings:[]});
function angle(a:Landmark|undefined,b:Landmark|undefined,c:Landmark|undefined):number|null {
 if(!a||!b||!c||[a,b,c].some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||(p.visibility??1)<0.5))return null;
 const ax=a.x-b.x,ay=a.y-b.y,cx=c.x-b.x,cy=c.y-b.y;
 const denom=Math.hypot(ax,ay)*Math.hypot(cx,cy);
 if(denom<1e-6)return null;
 return Math.acos(Math.min(1,Math.max(-1,(ax*cx+ay*cy)/denom)))*180/Math.PI;
}
function snapshot(frame:VideoFrame,index:number):Snapshot|null {
 const p=frame.landmarks;if(!p||p.length<29)return null;
 const knees=[angle(p[23],p[25],p[27]),angle(p[24],p[26],p[28])].filter((x):x is number=>x!==null);
 const hips=[angle(p[11],p[23],p[25]),angle(p[12],p[24],p[26])].filter((x):x is number=>x!==null);
 if(!knees.length)return null;
 return {frame:index,timestamp:frame.timestamp,knee:knees.reduce((a,b)=>a+b,0)/knees.length,hip:hips.length?hips.reduce((a,b)=>a+b,0)/hips.length:null};
}
/** Markers here are ALREADY video-analysis frame indices from jumpMetricsService,
 * not the original 30fps wizard marker indices. */
function phaseSample(a:VideoAnalysisInput,m:JumpMarkers,phase:Phase):Snapshot|undefined {
 const t=m.takeoffFrame!,l=m.landingFrame!,n=a.frames.length;
 const range:Record<Phase,[number,number]>={
  preparation:[Math.max(0,t-Math.max(8,Math.round(n*0.18))),Math.max(0,t-3)],
  takeoff:[Math.max(0,t-2),Math.min(n-1,t+3)],
  airborne:[Math.min(n-1,t+2),Math.max(t+2,l-2)],
  landing:[Math.max(0,l),Math.min(n-1,l+4)]
 };
 const [start,end]=range[phase],values:Snapshot[]=[];
 for(let i=start;i<=end && i<n;i++){const s=snapshot(a.frames[i],i);if(s)values.push(s)}
 if(!values.length)return undefined;
 if(phase==='takeoff')return values.reduce((a,b)=>a.knee>b.knee?a:b);
 if(phase==='landing')return values[0];
 return values.reduce((a,b)=>a.knee<b.knee?a:b);
}
function goodMarkers(a:VideoAnalysisInput|null,m:JumpMarkers|null):boolean {
 const n=a?.frames?.length??0;
 return !!a?.isComplete && n>=16 && !!m && m.takeoffFrame!==null && m.landingFrame!==null &&
 Number.isInteger(m.takeoffFrame)&&Number.isInteger(m.landingFrame) &&
 m.takeoffFrame>=5 && m.landingFrame>m.takeoffFrame+4 && m.landingFrame<n-1;
}
export function analyzeLongJump(student:VideoAnalysisInput|null,sm:JumpMarkers|null,reference:VideoAnalysisInput|null,rm:JumpMarkers|null):Report {
 const insufficient=unknownReport('请上传同方向、相近机位的标准示范与学生立定跳远视频，标记起跳和落地，再完成视频骨架分析。');
 if(!goodMarkers(student,sm)||!goodMarkers(reference,rm))return insufficient;
 const s=student!,r=reference!;
 const found=phases.map(p=>[p,phaseSample(s,sm!,p),phaseSample(r,rm!,p)] as const);
 const shots:Partial<Record<Phase,Snapshot>>={};const refs:Partial<Record<Phase,Snapshot>>={};
 found.forEach(([p,x,y])=>{if(x)shots[p]=x;if(y)refs[p]=y});
 const count=s.frames.filter(f=>!!f.landmarks?.length).length;
 if(count<10||!shots.preparation||!shots.takeoff||!shots.landing||!refs.preparation||!refs.takeoff||!refs.landing)
  return {status:'insufficient',notice:'关键姿态帧不足。请确保侧面全身入镜、视频无遮挡，并检查起跳和落地标记。',frameCount:count,phases:shots,findings:[]};
 const findings:Finding[]=[];
 const check=(phase:Phase,code:string,title:string,advice:string,predicate:(a:number,b:number)=>boolean)=>{
   const x=shots[phase],y=refs[phase];if(!x||!y)return;
   if(predicate(x.knee,y.knee))findings.push({code,phase,title,
    evidence:'学生膝角 '+x.knee.toFixed(1)+'°，示范膝角 '+y.knee.toFixed(1)+'°；差值 '+Math.abs(x.knee-y.knee).toFixed(1)+'°。',
    advice});
 };
 // Conservative, experimental comparison rules — teacher verification is essential.
 check('preparation','SLJ-01','预摆屈膝幅度可能不足','练习摆臂与屈膝配合，按自身能力调整，不追求固定角度。',(a,b)=>a>b+22&&a>125);
 check('takeoff','SLJ-02','蹬伸幅度可能不足','教师观察蹬地时髋膝踝协同伸展及向前上方起跳方向。',(a,b)=>a<b-20&&a<160);
 check('airborne','SLJ-03','腾空收腿可能不足','通过低冲击动作练习收腿与前伸的协调，不在疲劳时重复跳跃。',(a,b)=>a>b+25&&a>105);
 check('landing','SLJ-04','落地屈膝缓冲可能不足','注意双脚着地、屈膝缓冲，优先保证稳定和安全。',(a,b)=>a>b+25&&a>135);
 return {status:'ready',notice:'基于真实视频关键点的试验性动作对比，仅辅助教学，需体育教师复核；不进行自动测距或正式成绩评分。',frameCount:count,phases:shots,findings};
}
const tasks:Record<Tier,Task[]> = {
 foundation:[
  {id:'f-swing',tier:'foundation',name:'原地摆臂屈膝',dose:'2组 × 6次',description:'先做慢速预摆，感受手臂与下肢协调。',safety:'不追求蹲深，膝踝不适停止练习。',reason:'SLJ-01'},
  {id:'f-balance',tier:'foundation',name:'屈膝缓冲定格',dose:'2组 × 5次',description:'双脚在平整场地轻微屈膝，保持站稳。',safety:'无需从高处跳下，保持地面平整。',reason:'SLJ-04'},
  {id:'f-basic',tier:'foundation',name:'技术动作复盘',dose:'1组 × 4次',description:'观察示范视频并口述预摆、起跳、腾空、落地要点。',safety:'学习动作时不必反复进行完整跳跃。',reason:'GENERAL'}
 ],
 improvement:[
  {id:'i-extend',tier:'improvement',name:'髋膝踝协调蹬伸',dose:'2组 × 6次',description:'先不腾空，练习从屈膝到伸展的连续协调动作。',safety:'避免过快、过大幅度的动作。',reason:'SLJ-02'},
  {id:'i-tuck',tier:'improvement',name:'坐姿收腿与前伸',dose:'2组 × 8次',description:'坐在稳固座椅上练习膝部抬起与小腿前伸。',safety:'座椅稳定，动作缓慢且不憋气。',reason:'SLJ-03'},
  {id:'i-replay',tier:'improvement',name:'视频定格纠错',dose:'3次关键帧复盘',description:'对照相同阶段的标准视频，指出一个最需要改进的动作。',safety:'建议与老师共同分析，不以单一角度下结论。',reason:'GENERAL'}
 ],
 challenge:[
  {id:'c-link',tier:'challenge',name:'四阶段动作串联',dose:'2组 × 3次',description:'在教师观察下有节奏地完成完整立定跳远。',safety:'间隔休息、确保落地区域防滑无障碍。',reason:'GENERAL'},
  {id:'c-compare',tier:'challenge',name:'复测视频对比',dose:'1次复测',description:'保持相同机位拍摄，比较同阶段动作是否更协调。',safety:'准备活动充分，避免过量重复尝试。',reason:'GENERAL'}
 ]
};
export function planFor(codes:string[]):Task[] {
 const set=new Set(codes);
 return (Object.values(tasks) as Task[][]).flat().map(t=>({...t,
 description: set.has(t.reason)?t.description+'（本次优先推荐）':t.description
 }));
}
export function cleanId(v:string):string {return v.trim().slice(0,24)||'匿名学生'}
export function loadRecords(raw:string|null):RecordEntry[] {
 try{const v=JSON.parse(raw||'[]');return Array.isArray(v)?v.filter(x=>x&&typeof x.student==='string'&&typeof x.date==='string'&&Array.isArray(x.findings)).slice(0,250):[]}catch{return []}
}
export function parseCentimeters(v:string):number|null|undefined {
 if(!v.trim())return null;
 const n=Number(v);
 return Number.isFinite(n)&&n>=30&&n<=400?Math.round(n*10)/10:undefined;
}
export function toCsv(rows:RecordEntry[]):string {
 const esc=(x:string|number)=>'"'+String(x).replace(/"/g,'""')+'"';
 const header=['日期','匿名编号','记录类型','问题代码','已完成任务','教师实测厘米','教师备注'];
 return '\uFEFF'+[header.map(esc).join(','),...rows.map(r=>[
  r.date,r.student,r.kind==='diagnosis'?'动作诊断':'分层学练',r.findings.join(';'),r.taskIds.join(';'),r.measuredCm??'',r.note
 ].map(esc).join(','))].join('\r\n');
}
