/**
 * 中文立定跳远技术示范（固定嵌入 B 站官方外链播放器）
 * 这属于课堂观看资料；第三方 iframe 不能被 MediaPipe 当作可读视频帧。
 * 因此动作对比分析仍使用本地已授权的视频文件。
 */
const VIDEO_ID = 'BV1Nz42187EP';
const BILIBILI_URL = 'https://www.bilibili.com/video/' + VIDEO_ID + '/';
const PLAYER_URL = 'https://player.bilibili.com/player.html?bvid=' + VIDEO_ID + '&autoplay=0&danmaku=0&poster=1';

export default function StandardDemo(){
 return (
  <section className="rounded-2xl border border-emerald-100 bg-white p-4 sm:p-5 shadow-sm" aria-label="中文立定跳远示范教学">
   <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
    <div>
     <p className="text-emerald-700 font-semibold text-xs tracking-wide mb-1">动作学习 · 中文视频</p>
     <h3 className="text-lg font-bold text-slate-900">立定跳远标准动作示范</h3>
     <p className="text-sm text-slate-600 mt-1">黄老师的体育课 · 约 3 分钟动作模式教学</p>
    </div>
    <a href={BILIBILI_URL} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100">
      在哔哩哔哩观看 ↗
    </a>
   </div>
   <details className="rounded-xl border border-emerald-100 bg-emerald-50/40">
    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-emerald-800">
      展开中文教练讲解（约 3 分钟）
    </summary>
    <div className="relative aspect-video max-w-[780px] mx-3 mb-3 rounded-xl overflow-hidden bg-slate-900">
     <iframe title="立定跳远中文标准动作教学视频" src={PLAYER_URL}
      className="absolute inset-0 h-full w-full border-0" loading="lazy"
      allow="fullscreen; picture-in-picture; encrypted-media"
      allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>
    </div>
   </details>
   <div className="grid grid-cols-4 gap-2 mt-4">
    {['预摆协调','蹬地起跳','腾空收腿','落地缓冲'].map((step,i)=>
      <div key={step} className="rounded-lg bg-emerald-50 border border-emerald-100 px-1 py-2 text-center">
       <span className="block text-emerald-700 text-xs font-semibold">{String(i+1).padStart(2,'0')}</span>
       <span className="text-slate-700 text-xs">{step}</span>
      </div>
    )}
   </div>
   <p className="text-xs text-slate-500 mt-3">中文讲解可以展开观看；若站外播放器受限，可点击“在哔哩哔哩观看”。上方固定动作示意为算法参考模板，无须另选标准视频；学生视频由本人上传分析。</p>
  </section>
 )
}
