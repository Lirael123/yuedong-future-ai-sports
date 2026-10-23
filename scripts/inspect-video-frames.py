#!/usr/bin/env python3
"""Temporary test-only visual strip of a *publicly offered* sports demonstration.
Do not publish the source footage in the Git repository or Pages.
"""
from PIL import Image,ImageOps,ImageDraw
import subprocess,os,io
import imageio_ffmpeg
from pathlib import Path
src=Path(os.environ.get('SLJ_VIDEO_FILE','/tmp/slj-public-fixture.mp4'))
dst=Path('/tmp/slj-motion-contact-sheet.jpg')
times=[.2,.5,.8,1.1,1.4,1.7,2.0,2.3,2.6,2.9]
W,H=240,170
thumbs=[]
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
for i,t in enumerate(times):
    args=[ffmpeg,'-v','error','-ss',str(t),'-i',str(src),'-frames:v','1','-f','image2pipe','-vcodec','mjpeg','pipe:1']
    result=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=20)
    if result.returncode or not result.stdout:continue
    im=Image.open(io.BytesIO(result.stdout)).convert('RGB')
    im=ImageOps.contain(im,(W-10,H-22))
    tile=Image.new('RGB',(W,H),'#ffffff')
    tile.paste(im,((W-im.width)//2,5))
    d=ImageDraw.Draw(tile)
    d.text((8,H-18),f'{t:.1f} s',fill='#000000')
    thumbs.append(tile)
sheet=Image.new('RGB',(W*5,H*2),'#f0f0f0')
for i,im in enumerate(thumbs):sheet.paste(im,((i%5)*W,(i//5)*H))
sheet.save(dst,quality=73,optimize=True)
print('Contact sheet made; source video remains temporary.')
