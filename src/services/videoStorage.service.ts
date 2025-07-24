// For saving video - expects File object for fileData
export interface VideoToSave {
  id: string;
  name: string;
  fileData: File; // File object to be converted to base64
  file: any; // Gemini file object
  uploadedAt: Date;
  thumbnail?: string;
  duration?: number;
  size: number;
  analysisHistory?: AnalysisResult[];
}

export interface StoredVideo {
  id: string;
  name: string;
  fileData: string; // Base64 data
  file: any; // Gemini file object
  uploadedAt: Date;
  thumbnail?: string;
  duration?: number;
  size: number;
  analysisHistory?: AnalysisResult[];
}

export interface AnalysisResult {
  mode: string;
  timestamp: Date;
  result: any;
  success: boolean;
}

class VideoStorageService {
  private static readonly STORAGE_KEY = 'gemini-video-analyzer-videos';
  public static readonly MAX_VIDEOS = 5; // Reasonable limit for localStorage
  private static readonly MAX_STORAGE_SIZE = 8 * 1024 * 1024; // 8MB - realistic localStorage limit

  static getStorageInfo() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    const currentSize = stored ? new Blob([stored]).size : 0;
    const available = this.MAX_STORAGE_SIZE - currentSize;
    
    return {
      used: currentSize,
      available,
      total: this.MAX_STORAGE_SIZE,
      percentage: (currentSize / this.MAX_STORAGE_SIZE) * 100
    };
  }

  static async saveVideo(video: VideoToSave): Promise<void> {
    try {
      const videos = this.getStoredVideos();
      
      console.log(`📹 Video size: ${VideoStorageService.formatBytes(video.fileData.size)}`);
      
      // Convert File to base64
      const base64Data = await this.fileToBase64(video.fileData);
      
      const storedVideo: StoredVideo = {
        ...video,
        fileData: base64Data
      };

      // Check if adding this video would exceed storage limit
      const testVideos = [...videos, storedVideo];
      let testSize = new Blob([JSON.stringify(testVideos)]).size;
      
      if (testSize > this.MAX_STORAGE_SIZE) {
        console.log(`🗜️ Storage limit exceeded (${this.formatBytes(testSize)} > ${this.formatBytes(this.MAX_STORAGE_SIZE)}). Cleaning up...`);
        
        // Remove oldest videos until we have enough space
        const sortedVideos = videos.sort((a, b) => 
          new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
        );
        
        let currentVideos = [...sortedVideos];
        let attempts = 0;
        const maxAttempts = videos.length + 1;
        
        while (testSize > this.MAX_STORAGE_SIZE && currentVideos.length > 0 && attempts < maxAttempts) {
          const removedVideo = currentVideos.shift(); // Remove oldest
          console.log(`🗑️ Removing old video: ${removedVideo?.name}`);
          
          const newVideos = [...currentVideos, storedVideo];
          testSize = new Blob([JSON.stringify(newVideos)]).size;
          attempts++;
        }
        
        // If still too large after removing all old videos, the new video itself is too big
        if (testSize > this.MAX_STORAGE_SIZE) {
          const videoSize = new Blob([JSON.stringify([storedVideo])]).size;
          throw new Error(
            `Video quá lớn để lưu trữ (${this.formatBytes(videoSize)}). ` +
            `Giới hạn: ${this.formatBytes(this.MAX_STORAGE_SIZE)}. ` +
            `Vui lòng thử video nhỏ hơn.`
          );
        }
        
        // Update videos array with cleaned up list
        videos.length = 0;
        videos.push(...currentVideos);
        console.log(`✅ Cleaned up storage. Removed ${sortedVideos.length - currentVideos.length} old videos.`);
      }
      
      videos.push(storedVideo);
      
      // Final safety check for video count limit
      if (videos.length > this.MAX_VIDEOS) {
        videos.splice(0, videos.length - this.MAX_VIDEOS);
      }
      
      // Try to save, with emergency cleanup if quota still exceeded
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(videos));
      } catch (quotaError) {
        if (quotaError instanceof Error && quotaError.name === 'QuotaExceededError') {
          console.warn('🚨 QuotaExceededError - Emergency cleanup!');
          
          // Emergency: Keep only the new video and 1 most recent
          const emergencyVideos = videos.slice(-2); // Keep last 2 videos only
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(emergencyVideos));
          console.log(`🆘 Emergency cleanup: Kept only ${emergencyVideos.length} videos`);
        } else {
          throw quotaError;
        }
      }
    } catch (error) {
      console.error('Error saving video:', error);
      throw error;
    }
  }

  static getStoredVideos(): StoredVideo[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const videos = JSON.parse(stored);
      
      // Convert string dates back to Date objects
      return videos.map((video: any) => ({
        ...video,
        uploadedAt: new Date(video.uploadedAt),
        analysisHistory: video.analysisHistory?.map((analysis: any) => ({
          ...analysis,
          timestamp: new Date(analysis.timestamp)
        })) || []
      }));
    } catch (error) {
      console.error('Error loading stored videos:', error);
      return [];
    }
  }

  static getVideoById(id: string): StoredVideo | null {
    const videos = this.getStoredVideos();
    return videos.find(v => v.id === id) || null;
  }

  static deleteVideo(id: string): void {
    try {
      const videos = this.getStoredVideos().filter(v => v.id !== id);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(videos));
    } catch (error) {
      console.error('Error deleting video:', error);
    }
  }

  static updateVideoAnalysis(videoId: string, analysis: AnalysisResult): void {
    try {
      const videos = this.getStoredVideos();
      const videoIndex = videos.findIndex(v => v.id === videoId);
      
      if (videoIndex !== -1) {
        if (!videos[videoIndex].analysisHistory) {
          videos[videoIndex].analysisHistory = [];
        }
        videos[videoIndex].analysisHistory!.push(analysis);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(videos));
      }
    } catch (error) {
      console.error('Error updating video analysis:', error);
    }
  }

  private static fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  static createVideoURL(video: StoredVideo): string {
    try {
      // Validate video data
      if (!video.fileData) {
        throw new Error('Video file data is missing');
      }

      // Convert base64 back to blob URL
      const base64Data = video.fileData;
      
      if (!base64Data.includes(',')) {
        throw new Error('Invalid base64 format: missing data separator');
      }
      
      const [header, data] = base64Data.split(',');
      
      // Extract MIME type from header
      const mimeMatch = header.match(/data:([^;]+)/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'video/mp4';
      
      const byteCharacters = atob(data);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error creating video URL:', error);
      throw error;
    }
  }

  static async generateThumbnail(videoElement: HTMLVideoElement): Promise<string> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = 160;
      canvas.height = 90;
      
      const generateFrame = () => {
        if (videoElement.readyState >= 2) {
          ctx?.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } else {
          setTimeout(generateFrame, 100);
        }
      };
      
      videoElement.currentTime = Math.min(1, videoElement.duration / 10);
      generateFrame();
    });
  }

  static clearAllVideos(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  static getStorageSize(): number {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? new Blob([stored]).size : 0;
  }

  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

export default VideoStorageService;