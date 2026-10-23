import { useState, useEffect } from 'react'
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
import { videoExportService } from './services/videoExportService'
import {FIXED_REFERENCE_URL,FIXED_REFERENCE_DURATION,fixedReferenceMarker} from './services/standardReference'

function App() {
  const {
    isAnalyzing,
    analysisProgress,
    referenceVideo,
    userVideo,
    hasValidAnalysis,
    setReferenceVideo,
    setUserVideo,
    userMetrics,
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

  const [isExporting, setIsExporting] = useState(false)
  const [cachedVideoBlob, setCachedVideoBlob] = useState<Blob | null>(null)
  const [showWizard, setShowWizard] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview')
  const [isRestoringState, setIsRestoringState] = useState(true)
  const [isLoadingSampleVideos, setIsLoadingSampleVideos] = useState(false)

  const hasVideos = referenceVideo && userVideo
  const canAnalyze = hasVideos && hasValidMarkers() && !isAnalyzing
  const canStartWizard = hasVideos && !hasValidMarkers() && !isRestoringState && !isLoadingSampleVideos
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

  // Auto-launch wizard when both videos are uploaded (but not for sample videos with markers)
  useEffect(() => {
    if (canStartWizard && !showWizard) {
      setShowWizard(true)
    }
  }, [canStartWizard, showWizard])
  
  // Auto-analyze when both sample videos are loaded with markers
  const [hasAutoAnalyzed, setHasAutoAnalyzed] = useState(false);
  useEffect(() => {
    if (canAnalyze && !hasValidAnalysis() && !isAnalyzing && !hasAutoAnalyzed) {
      // Check if both videos have markers (indicating they're sample videos)
      if (manualMarkers?.reference.takeoffTime !== null && 
          manualMarkers?.reference.landingTime !== null &&
          manualMarkers?.user.takeoffTime !== null && 
          manualMarkers?.user.landingTime !== null) {
        // Mark as auto-analyzed to prevent loops
        setHasAutoAnalyzed(true);
        // Small delay to ensure videos are fully loaded
        setTimeout(() => {
          handleStartAnalysis();
        }, 500);
      }
    }
  }, [canAnalyze, hasValidAnalysis, isAnalyzing, manualMarkers])

  const handleUserVideoUpload = (video: VideoFile) => {
    setUserVideo({
      name: video.name,
      url: video.url,
      duration: video.duration || 0,
      file: video.file || undefined,
    }, true)
    
    // Clear cached video export when new user video is uploaded
    setCachedVideoBlob(null)
    
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
    
    // Save state after markers are set
    setTimeout(() => {
      saveState();
    }, 100);
  };

  const handleStartAnalysis = async () => {
    if (!canAnalyze || !manualMarkers) return

    // Clear cached video when starting new analysis
    setCachedVideoBlob(null)

    try {
      const referenceVideoEl = document.querySelector('[data-video-type="reference"]') as HTMLVideoElement
      const userVideoEl = document.querySelector('[data-video-type="user"]') as HTMLVideoElement

      if (!referenceVideoEl || !userVideoEl) {
        return
      }

      const analysisFPS = 15;
      
      // Run the full video analysis
      await videoAnalysisService.analyzeBothVideos(referenceVideoEl, userVideoEl, analysisFPS)
      
      // Save complete state after successful analysis
      setTimeout(() => {
        saveState();
      }, 100); // Small delay to ensure all state updates are complete
      
    } catch (error) {
      // Analysis failed - error is handled by the analysis service
    }
  }

  const handleStopAnalysis = () => {
    videoAnalysisService.abortAnalysis()
  }

  const handleShareVideo = async () => {
    if (!userAnalysis?.isComplete || !userMetrics) return;

    if (userMetrics.takeoffFrame === null || userMetrics.landingFrame === null) {
      // Cannot share: missing takeoff or landing frame
      return;
    }

    // Use cached video if available
    if (cachedVideoBlob) {
      const cachedVideoUrl = URL.createObjectURL(cachedVideoBlob);
      const shareLink = document.createElement('a');
      shareLink.href = cachedVideoUrl;
      shareLink.download = `analyzed_jump_${Date.now()}.mp4`;
      shareLink.click();
      URL.revokeObjectURL(cachedVideoUrl);
      return;
    }

    setIsExporting(true);

    try {
      const userVideoEl = document.querySelector('[data-video-type="user"]') as HTMLVideoElement;
      if (!userVideoEl) throw new Error('User video element not found');

      const videoBlob = await videoExportService.exportJumpVideo({
        userVideoElement: userVideoEl,
        metrics: userMetrics,
        takeoffFrame: userMetrics.takeoffFrame,
        landingFrame: userMetrics.landingFrame,
        fps: 30,
        quality: 0.8
      });

      if (!videoBlob) {
        throw new Error('Failed to export video');
      }

      // Cache the video blob for future shares
      setCachedVideoBlob(videoBlob);

      // Create download link
      const videoUrl = URL.createObjectURL(videoBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = videoUrl;
      downloadLink.download = `analyzed_jump_${Date.now()}.mp4`;
      downloadLink.click();
      URL.revokeObjectURL(videoUrl);
    } catch (error) {
      // Failed to export video
    } finally {
      setIsExporting(false);
    }
  }

  const getMainActionText = () => {
    if (isAnalyzing) return `视频分析中... ${analysisProgress}%`
    if (isExporting) return '视频导出中...'
    if (hasValidAnalysis()) return '导出分析视频'
    if (canAnalyze) return '开始动作分析'
    if (canStartWizard) return '标记起跳与落地'
    if (!hasVideos) return '请先上传动作对比和学生视频'
    return '请先完成关键帧标记'
  }

  const handleMainAction = () => {
    if (isAnalyzing) {
      handleStopAnalysis()
    } else if (hasValidAnalysis()) {
      handleShareVideo()
    } else if (canAnalyze) {
      handleStartAnalysis()
    } else if (canStartWizard) {
      setShowWizard(true)
    }
  }

  const canPressMainButton = isAnalyzing || hasValidAnalysis() || canAnalyze || canStartWizard

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
        <div className="h-[245px] md:h-[330px] p-3 md:p-5 grid grid-cols-1 md:grid-cols-2 gap-3 mb-2 auto-rows-fr">
          <VideoContainer
            label="固定标准动作 · V1"
            type="reference"
            showCloseButton={false}
            onVideoRemoved={handleVideoRemoved}
            onSampleVideoLoading={setIsLoadingSampleVideos}
          />
          <VideoContainer
            label="学生动作视频"
            type="user"
            onVideoUploaded={handleUserVideoUpload}
            onVideoRemoved={handleVideoRemoved}
            onSampleVideoLoading={setIsLoadingSampleVideos}
          />
        </div>

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

        {/* Bottom Action Button - Fixed */}
        <div className="flex-none p-4">
          <button
            onClick={handleMainAction}
            disabled={!canPressMainButton}
            className={`w-full py-4 rounded-xl font-semibold text-white text-base transition-all relative overflow-hidden ${
              isAnalyzing 
                ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800' 
                : canPressMainButton
                ? 'bg-gradient-to-r from-ice-blue-500 to-ice-blue-600 hover:from-ice-blue-600 hover:to-ice-blue-700'
                : 'bg-gray-600 cursor-not-allowed opacity-50'
            }`}
          >
            {/* Progress bar for analysis */}
            {isAnalyzing && (
              <div 
                className="absolute inset-0 bg-white bg-opacity-20 transition-all duration-300"
                style={{ 
                  width: `${analysisProgress}%`,
                  transformOrigin: 'left'
                }}
              />
            )}
            
            <span className="relative z-10">
              {getMainActionText()}
            </span>
          </button>
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