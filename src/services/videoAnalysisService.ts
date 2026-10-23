import { poseDetector } from './mediapipe/poseDetector';
import { useAnalysisStore } from '../store/analysisStore';
import { jumpMetricsService } from './jumpMetricsService';
import { angleAnalysisService } from './angleAnalysisService';
import {isFixedReferenceUrl,createStandardAnalysis} from './standardReference';

export class VideoAnalysisService {
  private isAnalyzing = false;
  private abortController: AbortController | null = null;

  async analyzeVideo(
    videoElement: HTMLVideoElement,
    type: 'reference' | 'user',
    fps: number = 30 // Match video frame rate to capture every frame
  ): Promise<void> {
    const store = useAnalysisStore.getState();

    // Wait for video to be ready
    if (videoElement.readyState < 2) {
      await new Promise<void>((resolve) => {
        const onCanPlay = () => {
          videoElement.removeEventListener('canplay', onCanPlay);
          resolve();
        };
        videoElement.addEventListener('canplay', onCanPlay);
      });
    }

    const duration = videoElement.duration;

    try {
      // Initialize analysis data structure
      store.initializeVideoAnalysis(type, duration, fps);

      // Ensure MediaPipe is initialized
      if (!poseDetector.initialized) {
        await poseDetector.initialize();
      }
      
      // Use slow natural playback for better detection with temporal consistency
      await this.analyzeWithSlowPlayback(videoElement, type, fps, duration);

      // Analysis completed successfully

    } catch (error) {
      // Video analysis failed
      throw error;
    }
  }

  /**
   * Analyze video using natural playback with slower speed for better MediaPipe tracking
   * Maintains temporal consistency for improved pose detection in fast movements
   */
  /**
   * Deterministic full-timeline capture. Pausing and seeking samples a real decoded
   * video frame at each planned timestamp; natural slow playback previously missed
   * late jump frames in headless browsers and on throttled mobile devices.
   */
  private async analyzeWithSlowPlayback(
    videoElement: HTMLVideoElement,
    type: 'reference' | 'user',
    fps: number,
    duration: number
  ): Promise<void> {
    const store = useAnalysisStore.getState();
    const totalFrames = Math.min(600, Math.ceil(duration * fps));
    const lastTime = Math.max(0, duration - 0.05);
    const seekTo = async (seconds: number): Promise<void> => {
      const target = Math.min(lastTime, Math.max(0, seconds));
      if (Math.abs(videoElement.currentTime - target) < 0.008 && videoElement.readyState >= 2) return;
      await new Promise<void>((resolve, reject) => {
        let done = false;
        const finish = (err?:Error) => {
          if(done)return;done=true;
          window.clearTimeout(timer);
          videoElement.removeEventListener('seeked',onSeeked);
          if(err)reject(err);else resolve();
        };
        const onSeeked = () => finish();
        const timer = window.setTimeout(() => finish(new Error('视频定位超时，请检查编码格式。')), 8000);
        videoElement.addEventListener('seeked', onSeeked, {once:true});
        try { videoElement.currentTime = target; } catch(e) {finish(e instanceof Error?e:new Error('无法定位视频帧'))}
      });
    };
    videoElement.pause();
    try {
      for (let i=0;i<totalFrames;i++) {
        if (this.abortController?.signal.aborted) return;
        const t=Math.min(i/fps,lastTime);
        await seekTo(t);
        let landmarks=null,worldLandmarks=null;
        try {
          const results=await poseDetector.detectPose(videoElement);
          landmarks=results?.landmarks[0]||null;
          worldLandmarks=results?.worldLandmarks?.[0]||null;
        } catch {
          // Keep absent frames absent. Never fabricate skeleton data.
        }
        store.updateFrameAnalysisWithTimestamp(type,i,landmarks,t,worldLandmarks);
      }
      store.completeAnalysis(type);
    } finally {
      videoElement.pause();
    }
  }

  async analyzeBothVideos(
    referenceVideo: HTMLVideoElement,
    userVideo: HTMLVideoElement,
    fps: number = 30 // Match typical video frame rate
  ): Promise<void> {
    if (this.isAnalyzing) {
      throw new Error('动作分析正在进行，请勿重复提交');
    }

    this.isAnalyzing = true;
    this.abortController = new AbortController();
    
    const store = useAnalysisStore.getState();
    
    try {
      store.startAnalysis();
      
      // Standard animation uses creator-marked skeletal motion; do not run MediaPipe on drawings.
      if (isFixedReferenceUrl(useAnalysisStore.getState().referenceVideo?.url)) {
        const template = createStandardAnalysis(fps);
        store.initializeVideoAnalysis('reference', template.duration, fps);
        template.frames.forEach((f,i) => {
          store.updateFrameAnalysisWithTimestamp('reference',i,f.landmarks,f.timestamp,f.worldLandmarks);
        });
        store.completeAnalysis('reference');
      } else {
        await this.analyzeVideo(referenceVideo, 'reference', fps);
      }
      // Progress will be automatically updated by getAnalysisProgress() during frame processing
      
      // Check if analysis was aborted
      if (this.abortController?.signal.aborted) {
        return;
      }
      
      // Small delay between videos to ensure clean state
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Analyze second video (user)
      await this.analyzeVideo(userVideo, 'user', fps);
      // Progress will be automatically updated by getAnalysisProgress() during frame processing
      
      // Compute metrics and angles for both videos
      const state = useAnalysisStore.getState();
      const referenceAnalysis = state.referenceAnalysis;
      const userAnalysis = state.userAnalysis;
      const manualMarkers = state.manualMarkers; // Get manual markers from store
      
      if (referenceAnalysis && manualMarkers) {
        // First calculate angle analysis (including rotation data)
        const referenceAngles = angleAnalysisService.analyzeAngles(referenceAnalysis);
        store.setReferenceAngles(referenceAngles);

        // Then calculate metrics using the angle data
        try {
          const referenceMetrics = jumpMetricsService.computeJumpMetrics(referenceAnalysis, manualMarkers, 'reference', referenceAngles);
          store.setReferenceMetrics(referenceMetrics);
        } catch {
          // Failed to compute reference metrics - create empty metrics
          store.setReferenceMetrics({
            airTime: null,
            takeoffFrame: null,
            landingFrame: null,
            rotations: null,
            maxHeight: null
          });
        }
      }

      if (userAnalysis && manualMarkers) {
        // First calculate angle analysis (including rotation data)
        const userAngles = angleAnalysisService.analyzeAngles(userAnalysis);
        store.setUserAngles(userAngles);

        // Then calculate metrics using the angle data
        try {
          const userMetrics = jumpMetricsService.computeJumpMetrics(userAnalysis, manualMarkers, 'user', userAngles);
          store.setUserMetrics(userMetrics);
        } catch {
          // Failed to compute user metrics - create empty metrics
          store.setUserMetrics({
            airTime: null,
            takeoffFrame: null,
            landingFrame: null,
            rotations: null,
            maxHeight: null
          });
        }
      }
      
      // Final progress update
      store.setAnalysisProgress(100);
      
    } catch (error) {
      // Batch analysis failed
      store.setAnalysisError(`视频分析失败： ${error}`);
      throw error;
    } finally {
      this.isAnalyzing = false;
      this.abortController = null;
      store.stopAnalysis();
    }
  }

  abortAnalysis(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    
    const store = useAnalysisStore.getState();
    store.stopAnalysis();
  }

  /**
   * Get optimal frame rate for analysis based on video characteristics
   */
  getOptimalFrameRate(_videoElement: HTMLVideoElement): number {
    // For rotation analysis precision, we want the highest possible frame rate
    // Most figure skating videos are shot at 30fps or 60fps
    // Use 60fps for maximum precision in rotation detection
    return 60;
  }

  get isRunning(): boolean {
    return this.isAnalyzing;
  }
}

// Export singleton instance
export const videoAnalysisService = new VideoAnalysisService();