import type {VideoAnalysis, ManualMarkers} from '../store/analysisStore';
import {fixedReferenceMarker} from '../services/standardReference';

export type AutoEventResult =
  | {ok:true;markers:ManualMarkers;confidence:number;details:string}
  | {ok:false;reason:string;confidence:number};

function median(nums:number[]):number{
 const xs=[...nums].sort((a,b)=>a-b);
 return xs.length?xs[Math.floor(xs.length/2)]:NaN;
}
type Sample={time:number;footY:number;hipY:number;index:number};
function getSample(frames:VideoAnalysis['frames']):Sample[]{
 const samples:Sample[]=[];
 frames.forEach((f,index)=>{
   const p=f.landmarks;
   if(!p||p.length<33)return;
   const valid=(k:number)=>p[k] && Number.isFinite(p[k].y) && (p[k].visibility??1)>=0.55;
   const feet=[27,28,31,32].filter(valid);
   const hips=[23,24].filter(valid);
   if(feet.length<2 || !hips.length)return;
   const footY=Math.max(...feet.map(i=>p[i].y));
   const hipY=hips.map(i=>p[i].y).reduce((a,b)=>a+b,0)/hips.length;
   samples.push({time:f.timestamp,footY,hipY,index});
 });
 return samples;
}

/**
 * First-pass event detector for stationary, full-body side-view videos.
 * Detects a sustained airborne interval from actual tracked toe/ankle height.
 * Never invents timestamps when tracking, visibility or airborne evidence is weak.
 * These markers are provisional and must remain editable by a teacher.
 */
export function inferStandingLongJump(analysis:VideoAnalysis|null):AutoEventResult {
 if(!analysis?.isComplete || !analysis.frames.length)return{ok:false,reason:'人体姿态识别尚未完成。',confidence:0};
 const samples=getSample(analysis.frames);
 if(samples.length<Math.max(12,analysis.frames.length*.60))
  return {ok:false,reason:'有效人体关键点不足，请确保全身及双脚持续入镜。',confidence:0};
 const n=samples.length;
 const head=samples.slice(0,Math.max(4,Math.floor(n*.18))).map(p=>p.footY);
 const tail=samples.slice(Math.max(0,n-Math.max(4,Math.floor(n*.18)))).map(p=>p.footY);
 const baseline=median([...head,...tail]);
 const peaks=samples.map(p=>baseline-p.footY);
 const maxPeak=Math.max(...peaks);
 if(!Number.isFinite(maxPeak)||maxPeak<.043)
  return {ok:false,reason:'尚未识别到足够明显的双脚离地过程，请手动标记起跳和落地。',confidence:0};
 const threshold=Math.max(.022,Math.min(.075,maxPeak*.32));
 const positive=peaks.map((h,i)=>h>threshold && i>n*.06 && i<n*.94);
 const groups:Array<{start:number;end:number;max:number}>=[];
 let open=-1;
 for(let i=0;i<=positive.length;i++){
   if(positive[i] && open<0)open=i;
   if(!positive[i] && open>=0){
     const end=i-1;
     groups.push({start:open,end,max:Math.max(...peaks.slice(open,i))});
     open=-1;
   }
 }
 groups.sort((a,b)=>((b.end-b.start)*b.max)-((a.end-a.start)*a.max));
 const candidate=groups[0];
 if(!candidate || candidate.end-candidate.start<Math.max(2,Math.floor(analysis.fps*.18)))
   return {ok:false,reason:'未能稳定识别离地与着地时刻，请人工确认关键帧。',confidence:0};
 const takeoff=samples[Math.max(0,candidate.start-1)];
 const landing=samples[Math.min(n-1,candidate.end+1)];
 if(landing.time-takeoff.time<.25 || landing.time-takeoff.time>Math.min(2.8,analysis.duration*.8))
   return {ok:false,reason:'检测到的腾空时长异常，请人工确认关键帧。',confidence:0};
 const gaps=samples.slice(candidate.start,candidate.end+1).filter((p,i)=>{
   if(i===0)return false;
   const prev=samples[candidate.start+i-1];
   return p.index-prev.index>2;
 });
 if(gaps.length>1)return{ok:false,reason:'腾空期间姿态关键点丢失，建议人工标记。',confidence:0};
 const confidence=Math.min(.95,Math.max(.5,(candidate.end-candidate.start+1)/(analysis.fps*.6)*.25+maxPeak*3.0));
 return {ok:true,confidence,
  details:'根据真实视频的双脚轨迹估算，建议教师确认起跳和落地画面。',
  markers:{
   reference:{...fixedReferenceMarker},
   user:{
    takeoffTime:takeoff.time,landingTime:landing.time,
    takeoffFrame:Math.round(takeoff.time*30),landingFrame:Math.round(landing.time*30)
   }
  }
 };
}
