import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { format } from 'date-fns';
import { getAssetUrl, setPhotoRating, setPhotoFavorite } from '@/services/api';
import { useThumbnail } from '@/hooks/useThumbnail';
import type { Photo } from '@/types';

interface PhotoViewerProps {
  /** 当前照片 */
  photo: Photo;
  /** 照片列表（用于前后导航） */
  photos?: Photo[];
  /** 是否显示 */
  open: boolean;
  /** 关闭事件 */
  onClose: () => void;
  /** 照片变更事件 */
  onPhotoChange?: (photo: Photo) => void;
  /** 照片更新事件 */
  onPhotoUpdate?: (photo: Photo) => void;
}

/**
 * 照片查看器组件
 *
 * 全屏查看照片，支持缩放、拖拽、前后导航、评分、收藏等
 */
const PhotoViewer = memo(function PhotoViewer({
  photo,
  photos = [],
  open,
  onClose,
  onPhotoChange,
  onPhotoUpdate,
}: PhotoViewerProps) {
  const [scale, setScale] = useState(1);
  const [showInfo, setShowInfo] = useState(false);
  const [localPhoto, setLocalPhoto] = useState(photo);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  
  // 渐进式加载状态
  const [isFullLoaded, setIsFullLoaded] = useState(false);
  const [isFullLoading, setIsFullLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const fullImageRef = useRef<HTMLImageElement | null>(null);
  
  // 获取缩略图作为占位图
  const { thumbnailUrl: placeholderUrl } = useThumbnail(
    localPhoto.filePath,
    localPhoto.fileHash,
    { size: 'large', enabled: open }
  );

  // 同步外部 photo 变化
  useEffect(() => {
    setLocalPhoto(photo);
    setScale(1);
    setPosition({ x: 0, y: 0 });
    // 重置加载状态
    setIsFullLoaded(false);
    setIsFullLoading(false);
    setLoadError(false);
  }, [photo]);

  // 加载原图
  useEffect(() => {
    if (!open || isFullLoaded || isFullLoading) return;
    
    setIsFullLoading(true);
    const img = new Image();
    fullImageRef.current = img;
    
    img.onload = () => {
      setIsFullLoaded(true);
      setIsFullLoading(false);
    };
    
    img.onerror = () => {
      setLoadError(true);
      setIsFullLoading(false);
    };
    
    img.src = getAssetUrl(localPhoto.filePath);
    
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [open, localPhoto.filePath, isFullLoaded, isFullLoading]);

  // 获取当前照片索引
  const currentIndex = photos.findIndex((p) => p.photoId === localPhoto.photoId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  // 导航到上一张
  const goPrev = useCallback(() => {
    if (hasPrev) {
      const prevPhoto = photos[currentIndex - 1];
      setLocalPhoto(prevPhoto);
      onPhotoChange?.(prevPhoto);
    }
  }, [hasPrev, photos, currentIndex, onPhotoChange]);

  // 导航到下一张
  const goNext = useCallback(() => {
    if (hasNext) {
      const nextPhoto = photos[currentIndex + 1];
      setLocalPhoto(nextPhoto);
      onPhotoChange?.(nextPhoto);
    }
  }, [hasNext, photos, currentIndex, onPhotoChange]);

  // 鼠标拖拽处理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      e.preventDefault();
    }
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 鼠标滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => {
      const newScale = Math.max(0.5, Math.min(3, s + delta));
      // 重置位置当缩放到1时
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  }, []);

  // 切换幻灯片播放
  const toggleSlideshow = useCallback(() => {
    setIsPlaying((playing) => !playing);
  }, []);

  // 幻灯片自动播放
  useEffect(() => {
    if (!isPlaying || !hasNext) return;

    const timer = setTimeout(() => {
      goNext();
    }, 3000); // 3秒切换

    return () => clearTimeout(timer);
  }, [isPlaying, hasNext, goNext]);

  // 键盘事件
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goPrev();
          break;
        case 'ArrowRight':
          goNext();
          break;
        case ' ': // 空格键
          e.preventDefault();
          toggleSlideshow();
          break;
        case 'i':
        case 'I':
          setShowInfo((v) => !v);
          break;
        case '+':
        case '=':
          setScale((s) => {
            const newScale = Math.min(s + 0.25, 3);
            if (newScale === 1) setPosition({ x: 0, y: 0 });
            return newScale;
          });
          break;
        case '-':
          setScale((s) => {
            const newScale = Math.max(s - 0.25, 0.5);
            if (newScale === 1) setPosition({ x: 0, y: 0 });
            return newScale;
          });
          break;
        case '0':
          setScale(1);
          setPosition({ x: 0, y: 0 });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, goPrev, goNext, toggleSlideshow]);

  // 预加载前后照片
  useEffect(() => {
    if (!open || photos.length === 0) return;

    const preloadImages: HTMLImageElement[] = [];

    // 预加载前一张
    if (hasPrev) {
      const prevPhoto = photos[currentIndex - 1];
      const img = new Image();
      img.src = getAssetUrl(prevPhoto.filePath);
      preloadImages.push(img);
    }

    // 预加载后一张
    if (hasNext) {
      const nextPhoto = photos[currentIndex + 1];
      const img = new Image();
      img.src = getAssetUrl(nextPhoto.filePath);
      preloadImages.push(img);
    }

    return () => {
      // 清理预加载的图片
      preloadImages.forEach((img) => {
        img.src = '';
      });
    };
  }, [open, photos, currentIndex, hasPrev, hasNext]);

  // 切换收藏
  const toggleFavorite = useCallback(async () => {
    try {
      const newValue = !localPhoto.isFavorite;
      await setPhotoFavorite(localPhoto.photoId, newValue);
      const updatedPhoto = { ...localPhoto, isFavorite: newValue };
      setLocalPhoto(updatedPhoto);
      onPhotoUpdate?.(updatedPhoto);
    } catch (error) {
      console.error('设置收藏失败:', error);
    }
  }, [localPhoto, onPhotoUpdate]);

  // 设置评分
  const handleRating = useCallback(
    async (rating: number) => {
      try {
        // 点击相同星级则取消评分
        const newRating = localPhoto.rating === rating ? 0 : rating;
        await setPhotoRating(localPhoto.photoId, newRating);
        const updatedPhoto = { ...localPhoto, rating: newRating };
        setLocalPhoto(updatedPhoto);
        onPhotoUpdate?.(updatedPhoto);
      } catch (error) {
        console.error('设置评分失败:', error);
      }
    },
    [localPhoto, onPhotoUpdate]
  );

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90">
      {/* 顶部工具栏 */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent p-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-white/80">
            {currentIndex + 1} / {photos.length || 1}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* 缩放控制 */}
          <button
            className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
            onClick={() => {
              setScale((s) => {
                const newScale = Math.max(s - 0.25, 0.5);
                if (newScale === 1) setPosition({ x: 0, y: 0 });
                return newScale;
              });
            }}
            title="缩小 (-)"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="min-w-[4rem] text-center text-sm text-white/80">
            {Math.round(scale * 100)}%
          </span>
          <button
            className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
            onClick={() => {
              setScale((s) => {
                const newScale = Math.min(s + 0.25, 3);
                if (newScale === 1) setPosition({ x: 0, y: 0 });
                return newScale;
              });
            }}
            title="放大 (+)"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
            onClick={() => {
              setScale(1);
              setPosition({ x: 0, y: 0 });
            }}
            title="重置 (0)"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          </button>

          <div className="mx-2 h-6 w-px bg-white/30" />

          {/* 幻灯片播放 */}
          <button
            className={clsx(
              'rounded-full p-2 hover:bg-white/10',
              isPlaying ? 'text-green-400' : 'text-white/80 hover:text-white'
            )}
            onClick={toggleSlideshow}
            disabled={!hasNext}
            title={isPlaying ? '暂停幻灯片 (空格)' : '播放幻灯片 (空格)'}
          >
            {isPlaying ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>

          <div className="mx-2 h-6 w-px bg-white/30" />

          {/* 收藏 */}
          <button
            className={clsx(
              'rounded-full p-2 hover:bg-white/10',
              localPhoto.isFavorite ? 'text-red-500' : 'text-white/80 hover:text-white'
            )}
            onClick={toggleFavorite}
            title={localPhoto.isFavorite ? '取消收藏' : '收藏'}
          >
            <svg
              className="h-5 w-5"
              fill={localPhoto.isFavorite ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>

          {/* 信息面板切换 */}
          <button
            className={clsx(
              'rounded-full p-2 hover:bg-white/10',
              showInfo ? 'text-blue-400' : 'text-white/80 hover:text-white'
            )}
            onClick={() => setShowInfo(!showInfo)}
            title="照片信息 (I)"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>

          {/* 关闭 */}
          <button
            className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
            onClick={onClose}
            title="关闭 (Esc)"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 导航按钮 */}
      {hasPrev && (
        <button
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white/80 hover:bg-black/70 hover:text-white"
          onClick={goPrev}
          title="上一张 (←)"
        >
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {hasNext && (
        <button
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white/80 hover:bg-black/70 hover:text-white"
          onClick={goNext}
          title="下一张 (→)"
        >
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* 图片 */}
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden"
        onClick={onClose}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
        }}
      >
        {/* 加载指示器 */}
        {isFullLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex flex-col items-center space-y-3">
              <svg className="h-10 w-10 animate-spin text-white/60" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm text-white/60">加载高清图片...</span>
            </div>
          </div>
        )}
        
        {/* 错误提示 */}
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex flex-col items-center space-y-3 text-red-400">
              <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm">图片加载失败</span>
            </div>
          </div>
        )}
        
        {/* 缩略图占位 (isFullLoaded 为 false 时显示) */}
        {!isFullLoaded && placeholderUrl && !loadError && (
          <img
            src={placeholderUrl}
            alt={localPhoto.fileName}
            className="max-h-full max-w-full object-contain select-none blur-sm transition-opacity"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.2s',
              opacity: isFullLoading ? 0.7 : 1,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handleMouseDown}
            draggable={false}
          />
        )}
        
        {/* 原图 (isFullLoaded 为 true 时显示) */}
        {isFullLoaded && (
          <img
            src={getAssetUrl(localPhoto.filePath)}
            alt={localPhoto.fileName}
            className="max-h-full max-w-full object-contain select-none animate-in fade-in duration-300"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.2s',
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handleMouseDown}
            draggable={false}
          />
        )}
      </div>

      {/* 底部评分 */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center bg-gradient-to-t from-black/50 to-transparent p-4">
        <div className="flex items-center space-x-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              className="p-1 transition-transform hover:scale-110"
              onClick={() => handleRating(star)}
              title={`${star} 星`}
            >
              <svg
                className={clsx(
                  'h-6 w-6',
                  star <= localPhoto.rating ? 'text-yellow-400' : 'text-white/40 hover:text-white/60'
                )}
                fill={star <= localPhoto.rating ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* 信息面板 */}
      {showInfo && (
        <div
          className="absolute bottom-0 right-0 top-0 z-20 w-80 overflow-y-auto bg-gray-900/95 p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">照片信息</h3>
            <button
              onClick={() => setShowInfo(false)}
              className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              title="关闭信息面板"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4 text-sm">
            {/* 基本信息 */}
            <section>
              <h4 className="mb-2 font-medium text-gray-400">基本信息</h4>
              <dl className="space-y-1">
                <div className="flex justify-between">
                  <dt className="text-gray-500">文件名</dt>
                  <dd className="max-w-[180px] truncate text-white" title={localPhoto.fileName}>
                    {localPhoto.fileName}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">格式</dt>
                  <dd className="text-white">{localPhoto.format || '未知'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">尺寸</dt>
                  <dd className="text-white">
                    {localPhoto.width && localPhoto.height
                      ? `${localPhoto.width} × ${localPhoto.height}`
                      : '未知'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">大小</dt>
                  <dd className="text-white">{formatFileSize(localPhoto.fileSize)}</dd>
                </div>
              </dl>
            </section>

            {/* 日期信息 */}
            <section>
              <h4 className="mb-2 font-medium text-gray-400">日期</h4>
              <dl className="space-y-1">
                {localPhoto.dateTaken && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">拍摄时间</dt>
                    <dd className="text-white">
                      {format(new Date(localPhoto.dateTaken), 'yyyy-MM-dd HH:mm')}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">添加时间</dt>
                  <dd className="text-white">
                    {format(new Date(localPhoto.dateAdded), 'yyyy-MM-dd HH:mm')}
                  </dd>
                </div>
              </dl>
            </section>

            {/* 相机信息 */}
            {(localPhoto.cameraModel || localPhoto.lensModel) && (
              <section>
                <h4 className="mb-2 font-medium text-gray-400">相机</h4>
                <dl className="space-y-1">
                  {localPhoto.cameraModel && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">相机</dt>
                      <dd className="text-white">{localPhoto.cameraModel}</dd>
                    </div>
                  )}
                  {localPhoto.lensModel && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">镜头</dt>
                      <dd className="max-w-[180px] truncate text-white" title={localPhoto.lensModel}>
                        {localPhoto.lensModel}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {/* 拍摄参数 */}
            {(localPhoto.focalLength || localPhoto.aperture || localPhoto.iso || localPhoto.shutterSpeed) && (
              <section>
                <h4 className="mb-2 font-medium text-gray-400">拍摄参数</h4>
                <dl className="space-y-1">
                  {localPhoto.focalLength && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">焦距</dt>
                      <dd className="text-white">{localPhoto.focalLength}mm</dd>
                    </div>
                  )}
                  {localPhoto.aperture && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">光圈</dt>
                      <dd className="text-white">f/{localPhoto.aperture}</dd>
                    </div>
                  )}
                  {localPhoto.shutterSpeed && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">快门</dt>
                      <dd className="text-white">{localPhoto.shutterSpeed}</dd>
                    </div>
                  )}
                  {localPhoto.iso && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">ISO</dt>
                      <dd className="text-white">{localPhoto.iso}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {/* GPS 信息 */}
            {localPhoto.gpsLatitude && localPhoto.gpsLongitude && (
              <section>
                <h4 className="mb-2 font-medium text-gray-400">位置</h4>
                <dl className="space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">纬度</dt>
                    <dd className="text-white">{localPhoto.gpsLatitude.toFixed(6)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">经度</dt>
                    <dd className="text-white">{localPhoto.gpsLongitude.toFixed(6)}</dd>
                  </div>
                </dl>
              </section>
            )}

            {/* 文件路径 */}
            <section>
              <h4 className="mb-2 font-medium text-gray-400">文件路径</h4>
              <p className="break-all text-xs text-gray-300">{localPhoto.filePath}</p>
            </section>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
});

export default PhotoViewer;
