import React, { useState, useEffect } from 'react';
import IndexedDBStorageService, { type StoredVideo } from '../services/indexedDbStorage.service';

interface VideoLibraryProps {
  videos: StoredVideo[];
  onSelectVideo: (video: StoredVideo) => void;
  onDeleteVideo: (videoId: string) => void;
  isVisible: boolean;
  onClose: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export const VideoLibrary: React.FC<VideoLibraryProps> = ({
  videos,
  onSelectVideo,
  onDeleteVideo,
  isVisible,
  onClose,
  isLoading = false,
  error = null
}) => {
  const [storageInfo, setStorageInfo] = useState({
    used: 0,
    available: 0,
    total: 0,
    percentage: 0
  });

  useEffect(() => {
    if (isVisible) {
      loadStorageInfo();
    }
  }, [isVisible, videos]);

  const loadStorageInfo = async () => {
    try {
      const info = await IndexedDBStorageService.getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('Error loading storage info:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectVideo = (video: StoredVideo) => {
    try {
      onSelectVideo(video);
    } catch (error) {
      console.error('Error selecting video:', error);
    }
  };

  const handleDeleteVideo = (videoId: string, videoName: string) => {
    if (window.confirm(`Bạn có chắc muốn xóa video "${videoName}"?`)) {
      onDeleteVideo(videoId);
    }
  };

  const handleClearAll = async () => {
    if (videos.length === 0) return;
    
    if (window.confirm(
      `Bạn có chắc muốn xóa TẤT CẢ ${videos.length} videos khỏi thư viện? ` +
      `Hành động này không thể hoàn tác!`
    )) {
      try {
        await IndexedDBStorageService.clearAllVideos();
        window.location.reload(); // Reload to refresh the state
      } catch (error) {
        console.error('Error clearing all videos:', error);
      }
    }
  };

  if (!isVisible) return null;

  return (
    <div className="video-library-overlay">
      <div className="video-library">
        <div className="library-header">
          <h2>📹 Video Library</h2>
          <div className="header-actions">
            {videos.length > 0 && (
              <button 
                className="clear-all-button"
                onClick={handleClearAll}
                title="Xóa tất cả videos"
              >
                🗑️ Clear All
              </button>
            )}
            <button className="close-button" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="library-content">
          {error && (
            <div className="error-message">
              <p>❌ {error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="loading-state">
              <p>Đang tải videos...</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="empty-library">
              <p>Chưa có video nào được lưu trữ</p>
              <span>Upload video đầu tiên để bắt đầu xây dựng thư viện!</span>
            </div>
          ) : (
            <div className="video-grid">
              {videos.map((video) => (
                <div key={video.id} className="video-card">
                  <div className="video-thumbnail">
                    {video.thumbnail ? (
                      <img 
                        src={video.thumbnail} 
                        alt={video.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="no-thumbnail">
                        <span className="icon">movie</span>
                      </div>
                    )}
                    <div className="video-duration">
                      {formatDuration(video.duration)}
                    </div>
                  </div>

                  <div className="video-info">
                    <h3 className="video-name" title={video.name}>
                      {video.name}
                    </h3>
                    
                    <div className="video-meta">
                      <span className="upload-date">
                        {formatDate(video.uploadedAt)}
                      </span>
                      <span className="file-size">
                        {formatFileSize(video.size)}
                      </span>
                    </div>

                    {video.analysisHistory && video.analysisHistory.length > 0 && (
                      <div className="analysis-count">
                        📊 {video.analysisHistory.length} phân tích
                      </div>
                    )}
                  </div>

                  <div className="video-actions">
                    <button
                      className="load-button"
                      onClick={() => handleSelectVideo(video)}
                      title="Load video này">
                      <span className="icon">play_circle</span>
                      Load
                    </button>
                    
                    <button
                      className="delete-button"
                      onClick={() => handleDeleteVideo(video.id, video.name)}
                      title="Xóa video">
                      <span className="icon">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="library-footer">
          <p>{videos.length}/{IndexedDBStorageService.MAX_VIDEOS} videos stored</p>
          <div className="storage-info">
            <div className="storage-bar">
              <div 
                className="storage-usage" 
                style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
              />
            </div>
            <small>
              {IndexedDBStorageService.formatBytes(storageInfo.used)} / {IndexedDBStorageService.formatBytes(storageInfo.total)} used
              {storageInfo.percentage > 90 && (
                <span style={{ color: '#dc3545', marginLeft: '8px' }}>
                  ⚠️ Gần hết dung lượng
                </span>
              )}
              {storageInfo.percentage > 70 && (
                <div style={{ color: '#856404', marginTop: '4px', fontSize: '11px' }}>
                  💡 Video mới có thể xóa video cũ để tạo chỗ trống
                </div>
              )}
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoLibrary;