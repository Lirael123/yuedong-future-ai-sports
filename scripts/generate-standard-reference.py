#!/usr/bin/env python3
"""Create the exact-version animated standing jump reference used by the app.
All geometry is authored in standard-motion.json and is public-domain-original work.
No remote video or third-party footage is downloaded. Requires Pillow and ffmpeg.
"""
import json, math, os, subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'src/reference/standard-motion.json').read_text(encoding='utf-8'))
out=ROOT/'public/reference/standing-long-jump-v1.mp4'
out.parent.mkdir(parents=True,exist_ok=True)
W,H=800,450
fps=data['fps']
duration=data['duration']
keys=['head','shoulder','elbow','wrist','hip','knee','ankle','toe']
def pose(t):
    arr=data['frames']
    i=next((i for i,p in enumerate(arr) if p['t']>=t),len(arr)-1)
    a,b=arr[max(0,i-1)],arr[i]
    x=max(0,min(1,(t-a['t'])/max(.0001,b['t']-a['t'])))
    p=x*x*(3-2*x)
    return {k:(a[k][0]*(1-p)+b[k][0]*p,a[k][1]*(1-p)+b[k][1]*p) for k in keys}
def coord(v):return (int(v[0]*W),int(v[1]*H))
def limb(d,a,b,width,color):
    d.line([a,b],fill=color,width=width,joint='curve')
    r=width//2
    d.ellipse((a[0]-r,a[1]-r,a[0]+r,a[1]+r),fill=color)
    d.ellipse((b[0]-r,b[1]-r,b[0]+r,b[1]+r),fill=color)
def scene(t):
    im=Image.new('RGB',(W,H),(249,252,251))
    d=ImageDraw.Draw(im)
    # Fixed ground and teaching guide - not distance measurement.
    d.rounded_rectangle((22,23,W-23,H-18),radius=22,fill='#ffffff',outline='#d9e7e0',width=2)
    d.rectangle((38,int(H*.90),W-38,int(H*.92)),fill='#b7e5cb')
    d.line((W*.13,H*.89,W*.88,H*.89),fill='#71b99c',width=2)
    d.line((int(W*.32),int(H*.82),int(W*.32),int(H*.93)),fill='#f2a45a',width=4)
    d.text((56,44),'STANDING LONG JUMP  /  REFERENCE V1',fill='#0f766e')
    phases=[(0,.8,'01  PREPARE'),(.8,1.0,'02  TAKEOFF'),(1.0,1.80,'03  FLIGHT'),(1.80,3.2,'04  LANDING')]
    stage=next((p[2] for p in phases if p[0]<=t<p[1]),'04  LANDING')
    d.rounded_rectangle((54,77,245,111),radius=12,fill='#e8f7ef')
    d.text((69,87),stage,fill='#166147')
    d.text((58,H-58),'SIDE VIEW  |  DIAGRAM  |  VERSION 1',fill='#64748b')
    o={k:coord(v) for k,v in pose(t).items()}
    # Black/navy torso, green sports shorts, highlighted swinging arm and leg.
    limb(d,o['hip'],o['shoulder'],27,'#18516f')
    limb(d,o['shoulder'],o['elbow'],16,'#efab77')
    limb(d,o['elbow'],o['wrist'],14,'#efab77')
    limb(d,o['hip'],o['knee'],23,'#10a776')
    limb(d,o['knee'],o['ankle'],19,'#14685e')
    limb(d,o['ankle'],o['toe'],16,'#233d54')
    hx,hy=o['head']
    d.ellipse((hx-22,hy-22,hx+22,hy+22),fill='#f1b887',outline='#5c4636',width=2)
    d.pieslice((hx-22,hy-22,hx+22,hy+22),180,360,fill='#21394d')
    d.ellipse((hx+7,hy-3,hx+9,hy-1),fill='#253c4b')
    # Consistent motion progress, no pseudo-score overlay.
    d.rounded_rectangle((W-228,78,W-65,89),radius=6,fill='#e2ece9')
    d.rounded_rectangle((W-228,78,W-228+int(163*t/duration),89),radius=6,fill='#159c73')
    return im
import imageio_ffmpeg
command=[imageio_ffmpeg.get_ffmpeg_exe(),'-y','-loglevel','error','-f','rawvideo','-pixel_format','rgb24',
 '-video_size',str(W)+'x'+str(H),'-framerate',str(fps),'-i','pipe:0',
 '-c:v','libx264','-pix_fmt','yuv420p','-preset','fast','-crf','25','-movflags','+faststart',str(out)]
proc=subprocess.Popen(command,stdin=subprocess.PIPE)
try:
 for i in range(int(duration*fps)):
    proc.stdin.write(scene(i/fps).tobytes())
except BrokenPipeError:
 raise RuntimeError('ffmpeg encoding failed')
finally:
 proc.stdin.close()
if proc.wait()!=0:raise SystemExit('ffmpeg failed')
print('Created',out,'bytes',out.stat().st_size)
