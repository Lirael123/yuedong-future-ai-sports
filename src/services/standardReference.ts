import motion from '../reference/standard-motion.json';
import type {PoseLandmark} from './mediapipe/poseDetector';
import type {VideoAnalysis} from '../store/analysisStore';

/** 本站自绘示意动画与标定数据同源；标定姿态并非 MediaPipe 识别结果。 */
export const FIXED_REFERENCE_VERSION = motion.version;
export const FIXED_REFERENCE_URL = import.meta.env.BASE_URL + 'reference/standing-long-jump-v1.mp4';
export const FIXED_REFERENCE_DURATION = motion.duration;
export const fixedReferenceMarker = {
 takeoffFrame: Math.round(motion.takeoffTime * 30),takeoffTime:motion.takeoffTime,
 landingFrame: Math.round(motion.landingTime * 30),landingTime:motion.landingTime
};
export function isFixedReferenceUrl(url:string|undefined|null):boolean {
 return url===FIXED_REFERENCE_URL;
}
type Point=[number,number];
const keynames=['head','shoulder','elbow','wrist','hip','knee','ankle','toe'] as const;
type Key=typeof keynames[number];
function interpolate(t:number):Record<Key,Point>{
 const arr=motion.frames;
 let i=arr.findIndex(f=>f.t>=t);if(i<0)i=arr.length-1;
 const a=arr[Math.max(0,i-1)],b=arr[i];const p=Math.max(0,Math.min(1,(t-a.t)/Math.max(.0001,b.t-a.t)));
 const smooth=p*p*(3-2*p);
 return Object.fromEntries(keynames.map(k=>{
  const v=a[k],w=b[k];
  return [k,[v[0]+(w[0]-v[0])*smooth,v[1]+(w[1]-v[1])*smooth]];
 })) as Record<Key,Point>;
}
function poseAt(time:number):PoseLandmark[]{
 const o=interpolate(time);
 const all:PoseLandmark[]=Array.from({length:33},()=>({x:0,y:0,z:0,visibility:0}));
 const pt=(k:Key,dx=0,dy=0):PoseLandmark=>({x:o[k][0]+dx,y:o[k][1]+dy,z:0,visibility:1});
 all[0]=pt('head');
 for(const [n,k] of [[11,'shoulder'],[12,'shoulder'],[13,'elbow'],[14,'elbow'],[15,'wrist'],[16,'wrist'],[23,'hip'],[24,'hip'],[25,'knee'],[26,'knee'],[27,'ankle'],[28,'ankle'],[31,'toe'],[32,'toe']] as [number,Key][])all[n]=pt(k,n%2===0?-.005:.005);
 return all;
}
export function createStandardAnalysis(fps=15):VideoAnalysis {
 const totalFrames=Math.round(motion.duration*fps);
 const frames=Array.from({length:totalFrames},(_,i)=>{
  const timestamp=i/fps;
  const landmarks=poseAt(timestamp);
  return {timestamp,landmarks,worldLandmarks:landmarks,processed:true};
 });
 return {frames,totalFrames,processedFrames:totalFrames,duration:motion.duration,fps,isComplete:true};
}
