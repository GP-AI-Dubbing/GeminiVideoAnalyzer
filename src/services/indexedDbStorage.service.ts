export interface StoredVideo {
  id: string;
  name: string;
  fileData: Blob; // Store as Blob instead of base64
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

class IndexedDBStorageService {
  private static readonly DB_NAME = 'GeminiVideoAnalyzer';
  private static readonly DB_VERSION = 1;
  private static readonly STORE_NAME = 'videos';
  public static readonly MAX_VIDEOS = 20; // Can store more with IndexedDB
  private static readonly MAX_STORAGE_SIZE = 500 * 1024 * 1024; // 500MB limit

  private static async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
        }
      };
    });
  }

  static async saveVideo(video: Omit<StoredVideo, 'fileData'> & { fileData: File }): Promise<void> {
    try {
      const db = await this.openDB();

      // Convert File to Blob (more efficient than base64)
      const videoBlob = new Blob([video.fileData], { type: video.fileData.type });

      const storedVideo: StoredVideo = {
        ...video,
        fileData: videoBlob,
      };

      // Check storage quota
      const existingVideos = await this.getStoredVideos();
      const totalSize = existingVideos.reduce((sum, v) => sum + v.size, 0) + video.fileData.size;

      if (totalSize > this.MAX_STORAGE_SIZE) {
        // Remove oldest videos to make space
        const sortedVideos = existingVideos.sort(
          (a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
        );

        let currentSize = totalSize;
        let i = 0;
        while (currentSize > this.MAX_STORAGE_SIZE && i < sortedVideos.length) {
          await this.deleteVideo(sortedVideos[i].id);
          currentSize -= sortedVideos[i].size;
          i++;
        }

        console.log(`🗑️ Removed ${i} old videos to make space`);
      }

      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.put(storedVideo);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log(`✅ Video saved to IndexedDB: ${video.name} (${this.formatBytes(video.fileData.size)})`);
    } catch (error) {
      console.error('Error saving video to IndexedDB:', error);
      throw error;
    }
  }

  static async getStoredVideos(): Promise<StoredVideo[]> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const videos = request.result.map((video: any) => ({
            ...video,
            uploadedAt: new Date(video.uploadedAt),
            analysisHistory:
              video.analysisHistory?.map((analysis: any) => ({
                ...analysis,
                timestamp: new Date(analysis.timestamp),
              })) || [],
          }));
          resolve(videos);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error loading videos from IndexedDB:', error);
      return [];
    }
  }

  static async deleteVideo(id: string): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error deleting video from IndexedDB:', error);
    }
  }

  static async createVideoURL(video: StoredVideo): Promise<string> {
    try {
      if (!video.fileData) {
        throw new Error('Video file data is missing');
      }

      // Create URL from Blob
      return URL.createObjectURL(video.fileData);
    } catch (error) {
      console.error('Error creating video URL from IndexedDB:', error);
      throw error;
    }
  }

  static async getVideoById(id: string): Promise<StoredVideo | null> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => {
          const video = request.result;
          if (video) {
            resolve({
              ...video,
              uploadedAt: new Date(video.uploadedAt),
              analysisHistory:
                video.analysisHistory?.map((analysis: any) => ({
                  ...analysis,
                  timestamp: new Date(analysis.timestamp),
                })) || [],
            });
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting video by ID from IndexedDB:', error);
      return null;
    }
  }

  static async updateVideoAnalysis(videoId: string, analysisResult: AnalysisResult): Promise<void> {
    try {
      const video = await this.getVideoById(videoId);
      if (!video) {
        throw new Error(`Video with ID ${videoId} not found`);
      }

      if (!video.analysisHistory) {
        video.analysisHistory = [];
      }

      console.log('analysisResult', analysisResult);

      video.analysisHistory.push(analysisResult);

      const db = await this.openDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.put(video);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error updating video analysis in IndexedDB:', error);
      throw error;
    }
  }

  static async generateThumbnail(videoElement: HTMLVideoElement): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Cannot get canvas context'));
          return;
        }

        // Set canvas size to match video
        canvas.width = videoElement.videoWidth || 320;
        canvas.height = videoElement.videoHeight || 240;

        // Draw current frame to canvas
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

        // Convert to base64
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch (error) {
        reject(error);
      }
    });
  }

  static async clearAllVideos(): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error clearing IndexedDB:', error);
    }
  }

  static async getStorageInfo() {
    try {
      const videos = await this.getStoredVideos();
      const used = videos.reduce((sum, video) => sum + video.size, 0);

      return {
        used,
        available: this.MAX_STORAGE_SIZE - used,
        total: this.MAX_STORAGE_SIZE,
        percentage: (used / this.MAX_STORAGE_SIZE) * 100,
      };
    } catch (error) {
      return {
        used: 0,
        available: this.MAX_STORAGE_SIZE,
        total: this.MAX_STORAGE_SIZE,
        percentage: 0,
      };
    }
  }

  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

export default IndexedDBStorageService;
