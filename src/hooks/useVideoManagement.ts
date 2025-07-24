import { useState, useEffect, useCallback } from "react";
import VideoStorageService, {
  type StoredVideo,
} from "../services/videoStorage.service";

export const useVideoLibrary = () => {
  const [storedVideos, setStoredVideos] = useState<StoredVideo[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);

  useEffect(() => {
    loadStoredVideos();
  }, []);

  const loadStoredVideos = useCallback(() => {
    const videos = VideoStorageService.getStoredVideos();
    setStoredVideos(videos);
  }, []);

  const saveCurrentVideo = useCallback(
    async (
      file: File,
      geminiFile: any,
      url: string,
      videoElement?: HTMLVideoElement
    ) => {
      try {
        let thumbnail;
        if (videoElement) {
          thumbnail = await VideoStorageService.generateThumbnail(videoElement);
        }

        const storedVideo: StoredVideo = {
          id: `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          url,
          file: geminiFile,
          uploadedAt: new Date(),
          thumbnail,
          duration: videoElement?.duration,
          size: file.size,
          analysisHistory: [],
        };

        VideoStorageService.saveVideo(storedVideo);
        loadStoredVideos();

        return storedVideo.id;
      } catch (error) {
        console.error("Error saving video:", error);
        throw error;
      }
    },
    [loadStoredVideos]
  );

  const loadVideo = useCallback((videoId: string) => {
    return VideoStorageService.getVideoById(videoId);
  }, []);

  const deleteVideo = useCallback(
    (videoId: string) => {
      VideoStorageService.deleteVideo(videoId);
      loadStoredVideos();
    },
    [loadStoredVideos]
  );

  const saveAnalysisResult = useCallback(
    (videoId: string, mode: string, result: any) => {
      VideoStorageService.updateVideoAnalysis(videoId, {
        mode,
        timestamp: new Date(),
        result,
      });
      loadStoredVideos();
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
  };
};
