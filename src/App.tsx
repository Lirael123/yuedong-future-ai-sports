import { useState, useEffect, useRef } from 'react'
import AppContainer from './components/Layout/AppContainer'
import StatusBar from './components/Layout/StatusBar'
import OfflineIndicator from './components/Layout/OfflineIndicator'
import VideoContainer from './components/Video/VideoContainer'
import DisplayModeToggle from './components/Video/DisplayModeToggle'
import FrameMarkingWizard from './components/Analysis/FrameMarkingWizard'
import TimelineWithMarkers from './components/Analysis/TimelineWithMarkers'
import TabNavigation from './components/Analysis/TabNavigation'
import YuedongDashboard from './components/Analysis/YuedongDashboard'
import AngleChart from './components/Analysis/AngleChart'
import { VideoFile } from './hooks/useVideoUpload'
import { useAnalysisStore, ManualMarkers } from './store/analysisStore'
import { videoAnalysisService } from './services/videoAnalysisService'
import {FIXED_REFERENCE_URL,FIXED_REFERENCE_DURATION,fixedReferenceMarker,createStandardAnalysis} from './services/standardReference'
import {inferStandingLongJump} from './logic/autoJumpEvents'
import {analyzeLongJump} from './logic/yuedong'

function App() {
  const {
    isAnalyzing,
    analysisProgress,
    analysisError,
    referenceVideo,
    userVideo,
    hasValidAnalysis,
    setUserVideo,
    userAnalysis,
    referenceAnalysis,
    manualMarkers,
    setManualMarkers,
    hasValidMarkers,
    restoreVideosFromStorage,
    restoreManualMarkersFromStorage,
    saveState,
    restoreState,
  } = useAnalysisStore()

  const [showWizard, setShowWizard] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview')
  const [isRestoringState, setIsRestoringState] = useState(true)
  const [, setIsLoadingSampleVideos] = useState(false)
  const [stage,setStage]=useState<'idle'|'processing'|'ready'|'review'|'error'>('idle')
  const [statusText,setStatusText]=useState('上传学生动作视频，系统将自动开始识别。')
  const [retryToken,setRetryToken]=useState(0)
  const launchedFor=useRef<string|null>(null)

  const showTabs = hasValidAnalysis() && hasValidMarkers()

  // Restore videos and full state from storage on app startup
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // First restore videos
        await restoreVideosFromStorage()
        
        // Then try to restore full analysis state
        const stateRestored = await restoreState()
        
        // Fallback to manual markers if full state wasn't available
        if (!stateRestored) {
          restoreManualMarkersFromStorage()
        }
        // Keep a single author-controlled analysis reference across sessions.
        const state = useAnalysisStore.getState()
        if (state.referenceVideo?.url !== FIXED_REFERENCE_URL) {
          state.clearAnalysis()
        }
        const now = useAnalysisStore.getState()
        now.setReferenceVideo({
          name: '系统标准动作示意动画 · 固定版',
          url: FIXED_REFERENCE_URL,
          duration: FIXED_REFERENCE_DURATION
        }, false)
        const user = now.manualMarkers?.user || {
          takeoffFrame:null,takeoffTime:null,landingFrame:null,landingTime:null
        }
        now.setManualMarkers({reference:fixedReferenceMarker,user})
      } finally {
        // Always set restoration as complete, even if it failed
        setIsRestoringState(false)
      }
    }
    
    initializeApp()
  }, [restoreVideosFromStorage, restoreManualMarkersFromStorage, restoreState])

  const handleUserVideoUpload = (video: VideoFile) => {
    setUserVideo({
      name: video.name,
      url: video.url,
      duration: video.duration || 0,
      file: video.file || undefined,
    }, true)
    
    // Clear cached video export when new user video is uploaded
    launchedFor.current=null
    setStage('processing')
    setStatusText('视频已上传，正在准备自动识别，请保持页面打开。')
    
    // Clear manual markers when user video changes
    if (manualMarkers?.user.takeoffTime !== null) {
      useAnalysisStore.getState().setManualMarkers({
        reference:fixedReferenceMarker,
        user:{takeoffFrame:null,takeoffTime:null,landingFrame:null,landingTime:null}
      })
    }
  }

  const handleVideoRemoved = () => {
    // Reset to overview tab when any video is removed
    setActiveTab('overview')
  }

  const handleWizardComplete = (markers: ManualMarkers) => {
    setManualMarkers(markers);
    setShowWizard(false);
    const st=useAnalysisStore.getState();
    if(st.referenceAnalysis?.isComplete && st.userAnalysis?.isComplete) {
      const ref=st.referenceAnalysis,usr=st.userAnalysis;
      const mapped=(a:typeof usr,m:{takeoffTime:number|null;landingTime:number|null})=>
        m.takeoffTime!==null&&m.landingTime!==null?
        {takeoffFrame:Math.round(m.takeoffTime*a.fps),landingFrame:Math.round(m.landingTime*a.fps)}:null;
      const report=analyzeLongJump(usr,mapped(usr,markers.user),ref,mapped(ref,markers.reference));
      setStage(report.status==='ready'?'ready':'review');
      setStatusText(report.status==='ready'?'已根据实际视频生成动作报告，可在下方查看。':'关键姿态帧不足，请检查录像角度或重新选择起跳与落地。');
    }
    
    // Save state after markers are set
    setTimeout(() => {
      saveState();
    }, 100);
  };

  // A single upload starts real MediaPipe analysis automatically. Event detection
  // uses measured foot trajectories, never fake scores or fixed time percentages.
  useEffect(()=>{
    if(isRestoringState||!userVideo?.url||!referenceVideo?.url)return;
    const snapshot=useAnalysisStore.getState();
    if(snapshot.userAnalysis?.isComplete && snapshot.referenceAnalysis?.isComplete){
      if(snapshot.hasValidMarkers()){
        const m=snapshot.manualMarkers!;
        const toFrames=(fps:number,x:{takeoffTime:number|null;landingTime:number|null})=>
          x.takeoffTime===null||x.landingTime===null?null:
          {takeoffFrame:Math.round(x.takeoffTime*fps),landingFrame:Math.round(x.landingTime*fps)};
        const report=analyzeLongJump(snapshot.userAnalysis,toFrames(snapshot.userAnalysis.fps,m.user),
          snapshot.referenceAnalysis,toFrames(snapshot.referenceAnalysis.fps,m.reference));
        setStage(report.status==='ready'?'ready':'review');
        setStatusText(report.status==='ready'?'动作分析已完成，请查看下方诊断报告。':'分析结果的关键帧不足，请重新确认起跳与落地。');
      }else{
        const outcome=inferStandingLongJump(snapshot.userAnalysis);
        if(outcome.ok){
          snapshot.setManualMarkers(outcome.markers);
        }else{
          setStage('review');setStatusText(outcome.reason+' 点击“手动标记起跳与落地”继续。');
        }
      }
      return;
    }
    if(launchedFor.current===userVideo.url)return;
    launchedFor.current=userVideo.url;
    let cancelled=false;
    const run=async()=>{
      setStage('processing');
      setStatusText('正在逐帧检测人体姿态，请保持网页打开。');
      try{
        // React video elements may mount later than upload state; allow metadata to decode.
        let ref:HTMLVideoElement|null=null,user:HTMLVideoElement|null=null;
        for(let attempt=0;attempt<100;attempt++){
          if(cancelled)return;
          ref=document.querySelector('video[data-video-type="reference"]');
          user=document.querySelector('video[data-video-type="user"]');
          if(ref && user && ref.readyState>=1 && user.readyState>=2 &&
              Number.isFinite(user.duration) && user.duration>=.8)break;
          await new Promise(resolve=>window.setTimeout(resolve,150));
        }
        if(!ref||!user||!Number.isFinite(user.duration)||user.readyState<2)throw Error('视频未能正常解码，请改用 MP4（H.264）视频。');
        await videoAnalysisService.analyzeBothVideos(ref,user,15);
        if(cancelled)return;
        const result=useAnalysisStore.getState();
        const usable=result.userAnalysis?.frames.filter(x=>x.landmarks?.length).length||0;
        if(usable<10)throw Error('未识别到足够的人体关键点，请保证单人全身、双脚入镜后重试。');
        const detected=inferStandingLongJump(result.userAnalysis);
        if(detected.ok){
          result.setManualMarkers(detected.markers);
          const reference=result.referenceAnalysis||createStandardAnalysis(15);
          const tested=analyzeLongJump(result.userAnalysis!,
            {takeoffFrame:Math.round(detected.markers.user.takeoffTime!*15),landingFrame:Math.round(detected.markers.user.landingTime!*15)},
            reference,{takeoffFrame:Math.round(fixedReferenceMarker.takeoffTime*15),landingFrame:Math.round(fixedReferenceMarker.landingTime*15)});
          if(tested.status==='ready'){
            setStage('ready');setStatusText('已自动完成动作识别与阶段定位，下方可查看四阶段诊断。');
          }else{
            setStage('review');setStatusText('姿态已识别，但阶段定位需要人工确认。请标记起跳与落地。');
          }
        }else{
          setStage('review');setStatusText('人体姿态识别已完成。'+detected.reason+' 请点击“手动标记起跳与落地”。');
        }
        result.saveState().catch(()=>{});
      }catch(e){
        if(cancelled)return;
        const msg=e instanceof Error?e.message:'视频处理失败';
        setStage('error');setStatusText('自动分析未完成：'+msg);
      }
    };
    const timer=window.setTimeout(run,200);
    return()=>{cancelled=true;window.clearTimeout(timer)};
  },[userVideo?.url,referenceVideo?.url,isRestoringState,retryToken]);

  const getMainActionText = () => {
    if(isAnalyzing || stage==='processing')return '人体姿态识别中… '+analysisProgress+'%';
    if(stage==='review')return '手动标记起跳与落地';
    if(stage==='error')return '重新尝试分析';
    if(stage==='ready')return '重新分析视频';
    if(!userVideo)return '请先上传学生动作视频';
    return '开始动作分析';
  };
  const handleMainAction=()=>{
    if(isAnalyzing)return;
    if(stage==='review'){setShowWizard(true);return;}
    if(!userVideo)return;
    launchedFor.current=null;
    useAnalysisStore.getState().clearAnalysis();
    useAnalysisStore.getState().setManualMarkers({
      reference:{...fixedReferenceMarker},
      user:{takeoffFrame:null,takeoffTime:null,landingFrame:null,landingTime:null}
    });
    setStage('processing');
    setStatusText('正在重新检测视频…');
    // A manual retry uses the same decoded video; no need for another upload.
    setRetryToken(x=>x+1);
  };

  return (
    <AppContainer>
      <div className="flex flex-col min-h-screen">
        {/* Loading overlay during state restoration */}
        {isRestoringState && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="text-white text-center">
              <div className="w-8 h-8 border-2 border-ice-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <div className="text-sm">正在恢复上次训练数据…</div>
            </div>
          </div>
        )}
        
        {/* Status Bar */}
        <StatusBar />
        
        {/* Offline Indicator */}
        <OfflineIndicator />

        {/* Video Section - Responsive height for better use of space */}
        <div className="p-3 md:p-5 grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
          <div className="h-[230px] md:h-[310px]">
            <VideoContainer label="固定参考动作 · V1" type="reference"
              showCloseButton={false} onVideoRemoved={handleVideoRemoved}
              onSampleVideoLoading={setIsLoadingSampleVideos}/>
          </div>
          <div className="h-[230px] md:h-[310px]">
            <VideoContainer label="学生动作视频" type="user"
              onVideoUploaded={handleUserVideoUpload} onVideoRemoved={handleVideoRemoved}
              onSampleVideoLoading={setIsLoadingSampleVideos}/>
          </div>
        </div>

        <section aria-label="视频分析状态" className="mx-4 mb-5 p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <p className="font-semibold text-slate-900">动作分析进度</p>
            <p className="text-sm text-slate-700 mt-1" role="status">${statusText}</p>
            {isAnalyzing && <div className="w-full h-2 rounded-full bg-slate-200 mt-2 overflow-hidden"><div className="h-full bg-emerald-600 transition-all" style={{width:analysisProgress+'%'}}/></div>}
            {analysisError && <p role="alert" className="text-sm text-red-700 mt-1">{analysisError}</p>}
          </div>
          <button type="button" onClick={handleMainAction}
            disabled={!userVideo||isAnalyzing||stage==='processing'}
            className="rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white px-5 py-3 font-semibold disabled:opacity-50">
            {getMainActionText()}
          </button>
        </section>

        {/* Display Mode Toggle */}
        {(referenceAnalysis || userAnalysis) && (
          <div className="flex-none px-4 pb-2 flex justify-center">
            <DisplayModeToggle />
          </div>
        )}

        {/* Timeline with Jump Markers */}
        <div className="flex-none px-4 pb-3">
          <TimelineWithMarkers />
        </div>

        {/* Tab Navigation */}
        <TabNavigation 
          activeTab={activeTab}
          onTabChange={setActiveTab}
          visible={showTabs}
        />

        {/* Content Area - Scrollable */}
        <div className="px-4 pb-4">
          {activeTab === 'overview' ? (
            <YuedongDashboard />
          ) : (
            <div className="space-y-4">
              {referenceAnalysis && userAnalysis && (
                <>


                  <AngleChart
                    title="左膝角变化"
                    selectedPlane="sagittal"
                    className="h-48"
                  />
                  <AngleChart
                    title="右膝角变化"
                    selectedPlane="sagittal"
                    className="h-48"
                  />
                </>
              )}
            </div>
          )}
        </div>

      </div>
      
      {/* Frame Marking Wizard */}
      <FrameMarkingWizard 
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={handleWizardComplete}
      />
    </AppContainer>
  )
}

export default App