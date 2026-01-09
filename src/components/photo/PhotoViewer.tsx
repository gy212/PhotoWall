import React, { memo, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { format } from 'date-fns';
import { getAssetUrl, setPhotoRating, setPhotoFavorite, getRawPreview, isRawFile } from '@/services/api';
import { useThumbnail } from '@/hooks/useThumbnail';
import type { Photo } from '@/types';
import { Icon } from '@/components/common/Icon';
import { TagSelector } from '@/components/tag';

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
  const [loadError, setLoadError] = useState(false);
  const [rawPreviewUrl, setRawPreviewUrl] = useState<string | null>(null);

  // 获取缩略图作为占位图
  const { thumbnailUrl: placeholderUrl } = useThumbnail(
    localPhoto.filePath,
    localPhoto.fileHash,
    { size: 'large', enabled: open }
  );

  // 检测是否为 RAW 格式
  const isRaw = isRawFile(localPhoto.filePath);

  // 同步外部 photo 变化
  useEffect(() => {
    setLocalPhoto(photo);
    setScale(1);
    setPosition({ x: 0, y: 0 });
    // 重置加载状态
    setIsFullLoaded(false);
    setLoadError(false);
    setRawPreviewUrl(null);
  }, [photo]);

  // RAW 图像加载预览
  useEffect(() => {
    if (!open || !isRaw || rawPreviewUrl) return;

    let cancelled = false;
    getRawPreview(localPhoto.filePath)
      .then((response) => {
        if (!cancelled) {
          setRawPreviewUrl(`data:image/jpeg;base64,${response.data}`);
          setIsFullLoaded(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('RAW 预览加载失败:', err);
          setLoadError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, isRaw, localPhoto.filePath, rawPreviewUrl]);

  // 原图加载完成回调
  const handleFullImageLoad = useCallback(() => {
    setIsFullLoaded(true);
    setLoadError(false);
  }, []);

  // 原图加载失败回调
  const handleFullImageError = useCallback(() => {
    setLoadError(true);
  }, []);

  // 原图URL（RAW 使用预览，其他格式直接加载）
  const fullImageUrl = isRaw ? rawPreviewUrl : (open ? getAssetUrl(localPhoto.filePath) : '');
  const isFullLoading = open && !isFullLoaded && !loadError;

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
      {/* 顶部工具栏 - 统一悬浮条 */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        {/* 统一控制栏 */}
        <div className="flex items-center h-12 px-2 rounded-2xl bg-surface/95 backdrop-blur-md shadow-xl border border-white/20 ring-1 ring-black/5">

          {/* 计数器 */}
          <div className="px-3 text-sm font-medium text-secondary border-r border-border/50 pr-4 mr-1">
            <span className="tabular-nums">{currentIndex + 1}</span>
            <span className="mx-1 opacity-50">/</span>
            <span className="tabular-nums">{photos.length || 1}</span>
          </div>

          {/* 缩放控制 */}
          <div className="flex items-center">
            <button
              className="p-2 rounded-xl text-secondary hover:text-primary hover:bg-element transition-all"
              onClick={() => setScale(s => Math.max(s - 0.25, 0.5))}
              title="缩小"
            >
              <Icon name="remove" className="text-xl" />
            </button>
            <span className="w-14 text-center text-sm font-semibold text-primary tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <button
              className="p-2 rounded-xl text-secondary hover:text-primary hover:bg-element transition-all"
              onClick={() => setScale(s => Math.min(s + 0.25, 3))}
              title="放大"
            >
              <Icon name="add" className="text-xl" />
            </button>
          </div>

          <div className="w-px h-5 bg-border/50 mx-2" />

          {/* 常用操作 */}
          <div className="flex items-center gap-1">
            <button
              className="p-2 rounded-xl text-secondary hover:text-primary hover:bg-element transition-all"
              onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
              title="重置视图"
            >
              <Icon name="center_focus_weak" className="text-xl" />
            </button>

            <button
              className={clsx(
                'p-2 rounded-xl transition-all',
                isPlaying ? 'text-primary bg-primary/10' : 'text-secondary hover:text-primary hover:bg-element'
              )}
              onClick={toggleSlideshow}
              disabled={!hasNext}
              title="幻灯片播放"
            >
              <Icon name={isPlaying ? 'close' : 'start_scan'} className="text-xl" />
            </button>

            <button
              className={clsx(
                'p-2 rounded-xl transition-all',
                localPhoto.isFavorite ? 'text-red-500 bg-red-500/10' : 'text-secondary hover:text-primary hover:bg-element'
              )}
              onClick={toggleFavorite}
              title="收藏"
            >
              <Icon
                name="favorite"
                className="text-xl"
                filled={localPhoto.isFavorite}
              />
            </button>

            <button
              className={clsx(
                'p-2 rounded-xl transition-all',
                showInfo ? 'text-primary bg-primary/10' : 'text-secondary hover:text-primary hover:bg-element'
              )}
              onClick={() => setShowInfo(!showInfo)}
              title="信息"
            >
              <Icon name="info" className="text-xl" />
            </button>
          </div>
        </div>
      </div>

      {/* 关闭按钮 - 独立左上角 - 退出图标 */}
      <button
        className="absolute top-4 left-4 z-20 p-3 rounded-full bg-surface/90 backdrop-blur shadow-lg border border-white/20 ring-1 ring-black/5 text-secondary hover:text-primary hover:bg-element hover:scale-105 transition-all"
        onClick={onClose}
        title="返回 (Esc)"
      >
        <Icon name="arrow_back" className="text-2xl" />
      </button>

      {/* 导航按钮 */}
      {hasPrev && (
        <button
          className="absolute left-6 top-1/2 z-20 -translate-y-1/2 h-12 w-12 flex items-center justify-center rounded-full bg-surface shadow-lg border border-border text-secondary hover:text-primary hover:scale-110 transition-all"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          title="上一张 (←)"
        >
          <Icon name="chevron_left" className="text-3xl" />
        </button>
      )}
      {hasNext && (
        <button
          className="absolute right-6 top-1/2 z-20 -translate-y-1/2 h-12 w-12 flex items-center justify-center rounded-full bg-surface shadow-lg border border-border text-secondary hover:text-primary hover:scale-110 transition-all"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          title="下一张 (→)"
        >
          <Icon name="chevron_right" className="text-3xl" />
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
            <div className="flex flex-col items-center space-y-3 bg-surface/80 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-border">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
              <span className="text-sm text-secondary">加载高清图片...</span>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex flex-col items-center space-y-3 p-6 bg-surface rounded-2xl shadow-lg border border-border">
              <Icon name="error" className="text-4xl text-red-500" size={36} />
              <span className="text-sm text-secondary">图片加载失败</span>
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

        {/* 原图 - 始终渲染，通过 opacity 控制显示 */}
        {fullImageUrl && (
          <img
            src={fullImageUrl}
            alt={localPhoto.fileName}
            className={clsx(
              'max-h-full max-w-full object-contain select-none transition-opacity duration-300',
              isFullLoaded ? 'opacity-100' : 'opacity-0 absolute'
            )}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.2s',
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handleMouseDown}
            onLoad={handleFullImageLoad}
            onError={handleFullImageError}
            draggable={false}
          />
        )}
      </div>

      {/* 底部评分 - 优化样式 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center space-x-2 px-6 py-3 bg-surface/90 backdrop-blur shadow-2xl border border-white/20 ring-1 ring-black/5 rounded-2xl">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              className="group p-1 transition-transform hover:scale-110"
              onClick={() => handleRating(star)}
              title={`${star} 星`}
            >
              <Icon
                name="star"
                className={clsx(
                  "text-2xl transition-all",
                  star <= localPhoto.rating
                    ? "text-yellow-400 drop-shadow-sm"
                    : "text-secondary/20 group-hover:text-yellow-400"
                )}
                filled={star <= localPhoto.rating}
              />
            </button>
          ))}
        </div>
      </div>

      {/* 信息面板 - 侧边栏 */}
      {showInfo && (
        <div
          className="absolute right-4 top-20 bottom-24 z-20 w-80 overflow-y-auto bg-surface/95 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-primary font-serif">照片信息</h3>
            <button
              onClick={() => setShowInfo(false)}
              className="rounded-full p-1 text-secondary hover:bg-hover hover:text-primary transition-colors"
              title="关闭信息面板"
            >
              <Icon name="close" className="text-xl" />
            </button>
          </div>

          <div className="space-y-6 text-sm">
            {/* 标签 */}
            <section>
              <h4 className="mb-2 font-medium text-primary border-b border-border/50 pb-1">标签</h4>
              <TagSelector photoId={localPhoto.photoId} />
            </section>

            {/* 基本信息 */}
            <section>
              <h4 className="mb-2 font-medium text-primary border-b border-border/50 pb-1">基本信息</h4>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-secondary">文件名</dt>
                  <dd className="max-w-[160px] truncate text-primary font-medium" title={localPhoto.fileName}>
                    {localPhoto.fileName}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-secondary">格式</dt>
                  <dd className="text-primary font-medium">{localPhoto.format || '未知'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-secondary">尺寸</dt>
                  <dd className="text-primary font-medium">
                    {localPhoto.width && localPhoto.height
                      ? `${localPhoto.width} × ${localPhoto.height}`
                      : '未知'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-secondary">大小</dt>
                  <dd className="text-primary font-medium">{formatFileSize(localPhoto.fileSize)}</dd>
                </div>
              </dl>
            </section>

            {/* 日期信息 */}
            <section>
              <h4 className="mb-2 font-medium text-primary border-b border-border/50 pb-1">日期</h4>
              <dl className="space-y-2">
                {localPhoto.dateTaken && (
                  <div className="flex justify-between">
                    <dt className="text-secondary">拍摄时间</dt>
                    <dd className="text-primary font-medium">
                      {format(new Date(localPhoto.dateTaken), 'yyyy-MM-dd HH:mm')}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-secondary">添加时间</dt>
                  <dd className="text-primary font-medium">
                    {format(new Date(localPhoto.dateAdded), 'yyyy-MM-dd HH:mm')}
                  </dd>
                </div>
              </dl>
            </section>

            {/* 相机信息 */}
            {(localPhoto.cameraModel || localPhoto.lensModel) && (
              <section>
                <h4 className="mb-2 font-medium text-primary border-b border-border/50 pb-1">相机</h4>
                <dl className="space-y-2">
                  {localPhoto.cameraModel && (
                    <div className="flex justify-between">
                      <dt className="text-secondary">相机</dt>
                      <dd className="text-primary font-medium">{localPhoto.cameraModel}</dd>
                    </div>
                  )}
                  {localPhoto.lensModel && (
                    <div className="flex justify-between">
                      <dt className="text-secondary">镜头</dt>
                      <dd className="max-w-[160px] truncate text-primary font-medium" title={localPhoto.lensModel}>
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
                <h4 className="mb-2 font-medium text-primary border-b border-border/50 pb-1">拍摄参数</h4>
                <div className="grid grid-cols-2 gap-2">
                  {localPhoto.focalLength && (
                    <div className="bg-background rounded p-2 text-center">
                      <div className="text-xs text-secondary">焦距</div>
                      <div className="text-primary font-bold">{localPhoto.focalLength}mm</div>
                    </div>
                  )}
                  {localPhoto.aperture && (
                    <div className="bg-background rounded p-2 text-center">
                      <div className="text-xs text-secondary">光圈</div>
                      <div className="text-primary font-bold">f/{localPhoto.aperture}</div>
                    </div>
                  )}
                  {localPhoto.shutterSpeed && (
                    <div className="bg-background rounded p-2 text-center">
                      <div className="text-xs text-secondary">快门</div>
                      <div className="text-primary font-bold">{localPhoto.shutterSpeed}</div>
                    </div>
                  )}
                  {localPhoto.iso && (
                    <div className="bg-background rounded p-2 text-center">
                      <div className="text-xs text-secondary">ISO</div>
                      <div className="text-primary font-bold">{localPhoto.iso}</div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* GPS 信息 */}
            {localPhoto.gpsLatitude && localPhoto.gpsLongitude && (
              <section>
                <h4 className="mb-2 font-medium text-primary border-b border-border/50 pb-1">位置</h4>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-secondary">纬度</dt>
                    <dd className="text-primary font-medium text-xs font-mono">{localPhoto.gpsLatitude.toFixed(6)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-secondary">经度</dt>
                    <dd className="text-primary font-medium text-xs font-mono">{localPhoto.gpsLongitude.toFixed(6)}</dd>
                  </div>
                </dl>
              </section>
            )}

            {/* 文件路径 */}
            <section>
              <h4 className="mb-2 font-medium text-primary border-b border-border/50 pb-1">文件路径</h4>
              <p className="break-all text-xs text-secondary bg-background p-2 rounded selectable">{localPhoto.filePath}</p>
            </section>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
});

export default PhotoViewer;
