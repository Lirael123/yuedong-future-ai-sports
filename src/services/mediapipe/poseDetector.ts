import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export interface PoseLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface PoseResults {
  landmarks: PoseLandmark[][];
  worldLandmarks?: PoseLandmark[][];
}

class PoseDetectorService {
  private poseLandmarker: PoseLandmarker | null = null;
  private isInitialized = false;
  private initialization: Promise<void> | null = null;
  private lastVideoTime = -1;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (!this.initialization) {
      this.initialization = this.createDetector().finally(() => { this.initialization = null; });
    }
    return this.initialization;
  }

  private async createDetector(): Promise<void> {
    const base = import.meta.env.BASE_URL + 'mediapipe/';
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expired = false;
    try {
      // Copy WASM from the exact installed JS package, avoiding mixed CDN versions.
      const create = async () => {
        const vision = await FilesetResolver.forVisionTasks(
          base + 'runtime/' + import.meta.env.VITE_MEDIAPIPE_ASSET_VERSION
        );
        if (expired) throw new Error('MediaPipe initialization expired');
        const options = (delegate: 'GPU' | 'CPU') => ({
          baseOptions: {
            modelAssetPath: base + 'pose_landmarker_lite.task',
            delegate
          },
          runningMode: 'VIDEO' as const,
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,  // Match extraction tool settings
          minPosePresenceConfidence: 0.5,   // Match extraction tool settings
          minTrackingConfidence: 0.5,       // Match extraction tool settings
          outputSegmentationMasks: false
        });
        let detector: PoseLandmarker;
        try {
          detector = await PoseLandmarker.createFromOptions(vision, options('GPU'));
        } catch {
          if (expired) throw new Error('MediaPipe initialization expired');
          detector = await PoseLandmarker.createFromOptions(vision, options('CPU'));
        }
        if (expired) {
          detector.close();
          throw new Error('MediaPipe initialization expired');
        }
        return detector;
      };
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new Error('人体姿态识别加载超时，请检查网络后重试。'));
        }, 30000);
      });
      this.poseLandmarker = await Promise.race([create(), timeout]);

      this.isInitialized = true;
    } catch (error) {
      // Failed to initialize MediaPipe Pose Landmarker
      this.isInitialized = false;
      console.error('MediaPipe initialization failed', error);
      throw new Error('人体姿态识别未能加载，请检查网络或更换支持视频分析的浏览器后重试。');
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  async detectPose(videoElement: HTMLVideoElement): Promise<PoseResults | null> {
    if (!this.isInitialized || !this.poseLandmarker) {
      return null;
    }

    try {
      // Use performance.now() for monotonically increasing timestamps
      const timestamp = performance.now();

      // Skip duplicate frames (natural playback won't have duplicates)
      const currentVideoTime = videoElement.currentTime;
      if (currentVideoTime === this.lastVideoTime) {
        return null;
      }
      this.lastVideoTime = currentVideoTime;
      
      const results = this.poseLandmarker.detectForVideo(videoElement, timestamp);
      
      if (results.landmarks && results.landmarks.length > 0) {
        return {
          landmarks: results.landmarks,
          worldLandmarks: results.worldLandmarks
        };
      }
      
      return null;
    } catch (error) {
      // Pose detection error
      return null;
    }
  }

  drawPose(
    canvas: HTMLCanvasElement,
    landmarks: PoseLandmark[],
    color: string = '#A855F7'
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx || !landmarks || landmarks.length === 0) return;

    ctx.save();
    
    // Set drawing style - make it very visible
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 6;
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 2;

    const width = canvas.width;
    const height = canvas.height;

    // Define pose connections (MediaPipe pose model connections)
    const connections = [
      // Face outline
      [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
      // Shoulders and arms
      [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
      [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
      // Torso
      [11, 23], [12, 24], [23, 24],
      // Left Leg
      [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
      // Right Leg
      [24, 26], [26, 28], [28, 30], [28, 32], [30, 32]
    ];

    // Draw connections - no visibility check for now
    ctx.beginPath();
    connections.forEach(([startIdx, endIdx]) => {
      const startLandmark = landmarks[startIdx];
      const endLandmark = landmarks[endIdx];
      
      if (startLandmark && endLandmark) {
        ctx.moveTo(startLandmark.x * width, startLandmark.y * height);
        ctx.lineTo(endLandmark.x * width, endLandmark.y * height);
      }
    });
    ctx.stroke();

    // Draw landmark points - bigger and no visibility check
    landmarks.forEach((landmark) => {
      ctx.beginPath();
      ctx.arc(
        landmark.x * width,
        landmark.y * height,
        6,
        0,
        2 * Math.PI
      );
      ctx.fill();
    });

    ctx.restore();
  }

  dispose(): void {
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }
    this.isInitialized = false;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const poseDetector = new PoseDetectorService();
