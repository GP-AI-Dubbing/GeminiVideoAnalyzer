import React from 'react';

export type StorageMethod = 'localStorage' | 'indexedDB' | 'none';

interface StorageMethodSelectorProps {
  currentMethod: StorageMethod;
  onMethodChange: (method: StorageMethod) => void;
  videoSize: number;
}

export const StorageMethodSelector: React.FC<StorageMethodSelectorProps> = ({
  currentMethod,
  onMethodChange,
  videoSize,
}) => {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const videoSizeMB = videoSize / (1024 * 1024);

  return (
    <div className="storage-method-selector">
      <h3>🗂️ Chọn phương thức lưu trữ</h3>
      <p>
        Video của bạn: <strong>{formatBytes(videoSize)}</strong>
      </p>

      <div className="storage-options">
        <label className={`storage-option ${currentMethod === 'localStorage' ? 'selected' : ''}`}>
          <input
            type="radio"
            name="storageMethod"
            value="localStorage"
            checked={currentMethod === 'localStorage'}
            onChange={(e) => onMethodChange(e.target.value as StorageMethod)}
            disabled={videoSizeMB > 8}
          />
          <div className="option-content">
            <div className="option-header">
              <span className="icon">💾</span>
              <span className="title">LocalStorage</span>
              {videoSizeMB > 8 && <span className="badge error">Quá lớn</span>}
            </div>
            <div className="option-details">
              <p>Giới hạn: ~8MB | Tốc độ: Nhanh | Tương thích: Cao</p>
              {videoSizeMB > 8 && <p className="warning">⚠️ Video quá lớn cho localStorage</p>}
            </div>
          </div>
        </label>

        <label className={`storage-option ${currentMethod === 'indexedDB' ? 'selected' : ''}`}>
          <input
            type="radio"
            name="storageMethod"
            value="indexedDB"
            checked={currentMethod === 'indexedDB'}
            onChange={(e) => onMethodChange(e.target.value as StorageMethod)}
          />
          <div className="option-content">
            <div className="option-header">
              <span className="icon">🗄️</span>
              <span className="title">IndexedDB</span>
              <span className="badge recommended">Khuyên dùng</span>
            </div>
            <div className="option-details">
              <p>Giới hạn: ~500MB | Tốc độ: Trung bình | Hiệu suất: Cao</p>
              <p className="benefit">✅ Phù hợp cho video lớn</p>
            </div>
          </div>
        </label>

        <label className={`storage-option ${currentMethod === 'none' ? 'selected' : ''}`}>
          <input
            type="radio"
            name="storageMethod"
            value="none"
            checked={currentMethod === 'none'}
            onChange={(e) => onMethodChange(e.target.value as StorageMethod)}
          />
          <div className="option-content">
            <div className="option-header">
              <span className="icon">⚡</span>
              <span className="title">Không lưu trữ</span>
            </div>
            <div className="option-details">
              <p>Chỉ phân tích, không lưu vào thư viện</p>
              <p className="note">💡 Upload nhanh nhất</p>
            </div>
          </div>
        </label>
      </div>
    </div>
  );
};

export default StorageMethodSelector;
