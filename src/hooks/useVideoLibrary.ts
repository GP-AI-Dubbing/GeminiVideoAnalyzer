import { useCallback, useEffect, useState } from 'react';
import IndexedDBStorageService, { type AnalysisResult, type StoredVideo } from '../services/indexedDbStorage.service';

export interface VideoLibraryHook {
  storedVideos: StoredVideo[];
  showLibrary: boolean;
  setShowLibrary: (show: boolean) => void;
  saveCurrentVideo: (file: File, geminiFile: any, url: string, videoElement?: HTMLVideoElement) => Promise<string>;
  loadVideo: (videoId: string) => Promise<StoredVideo | null>;
  deleteVideo: (videoId: string) => Promise<void>;
  saveAnalysisResult: (videoId: string, mode: string, result: any) => Promise<void>;
  loadStoredVideos: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export const useVideoLibrary = (): VideoLibraryHook => {
  const [storedVideos, setStoredVideos] = useState<StoredVideo[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStoredVideos();
  }, []);

  const loadStoredVideos = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const videos = await IndexedDBStorageService.getStoredVideos();
      setStoredVideos(videos);
    } catch (err) {
      setError('Failed to load videos from storage');
      console.error('Error loading stored videos:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveCurrentVideo = useCallback(
    async (
      file: File,
      geminiFile: any,
      _url: string, // Prefixed with underscore to indicate unused
      videoElement?: HTMLVideoElement
    ): Promise<string> => {
      try {
        setIsLoading(true);
        setError(null);

        let thumbnail: string | undefined;
        if (videoElement) {
          try {
            thumbnail = await IndexedDBStorageService.generateThumbnail(videoElement);
          } catch (thumbError) {
            console.warn('Failed to generate thumbnail:', thumbError);
          }
        }

        const videoData = {
          id: `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          fileData: file, // Will be stored as Blob in IndexedDB
          file: geminiFile,
          uploadedAt: new Date(),
          thumbnail,
          duration: videoElement?.duration,
          size: file.size,
          analysisHistory: [],
        };

        await IndexedDBStorageService.saveVideo(videoData);
        await loadStoredVideos();

        return videoData.id;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save video';
        setError(errorMessage);
        console.error('Error saving video:', err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadStoredVideos]
  );

  const loadVideo = useCallback(async (videoId: string): Promise<StoredVideo | null> => {
    try {
      return await IndexedDBStorageService.getVideoById(videoId);
    } catch (err) {
      setError('Failed to load video');
      console.error('Error loading video:', err);
      return null;
    }
  }, []);

  const deleteVideo = useCallback(
    async (videoId: string) => {
      try {
        setError(null);
        await IndexedDBStorageService.deleteVideo(videoId);
        await loadStoredVideos();
      } catch (err) {
        setError('Failed to delete video');
        console.error('Error deleting video:', err);
      }
    },
    [loadStoredVideos]
  );

  const saveAnalysisResult = useCallback(
    async (videoId: string, mode: string, result: any) => {
      try {
        setError(null);
        const analysisResult: AnalysisResult = {
          mode,
          timestamp: new Date(),
          result,
          success: !!result,
        };

        await IndexedDBStorageService.updateVideoAnalysis(videoId, analysisResult);
        await loadStoredVideos();
      } catch (err) {
        setError('Failed to save analysis result');
        console.error('Error saving analysis result:', err);
      }
    },
    [loadStoredVideos]
  );

  return {
    storedVideos,
    showLibrary,
    setShowLibrary,
    saveCurrentVideo,
    loadVideo,
    deleteVideo,
    saveAnalysisResult,
    loadStoredVideos,
    isLoading,
    error,
  };
};
