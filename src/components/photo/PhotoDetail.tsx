/**
 * 照片详情面板组件
 *
 * 显示照片的详细信息，包括基本信息、EXIF、GPS、评分、收藏等
 * 可用于侧边栏或独立面板
 */

import { memo, useCallback } from 'react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { setPhotoRating, setPhotoFavorite } from '@/services/api';
import type { Photo } from '@/types';

interface PhotoDetailProps {
  /** 照片信息 */
  photo: Photo;
  /** 照片更新事件 */
  onPhotoUpdate?: (photo: Photo) => void;
  /** 额外的 CSS 类名 */
  className?: string;
}

/**
 * 照片详情面板组件
 */
const PhotoDetail = memo(function PhotoDetail({
  photo,
  onPhotoUpdate,
  className,
}: PhotoDetailProps) {
  // 切换收藏
  const toggleFavorite = useCallback(async () => {
    try {
      const newValue = !photo.isFavorite;
      await setPhotoFavorite(photo.photoId, newValue);
      onPhotoUpdate?.({ ...photo, isFavorite: newValue });
    } catch (error) {
      console.error('设置收藏失败:', error);
    }
  }, [photo, onPhotoUpdate]);

  // 设置评分
  const handleRating = useCallback(
    async (rating: number) => {
      try {
        // 点击相同星级则取消评分
        const newRating = photo.rating === rating ? 0 : rating;
        await setPhotoRating(photo.photoId, newRating);
        onPhotoUpdate?.({ ...photo, rating: newRating });
      } catch (error) {
        console.error('设置评分失败:', error);
      }
    },
    [photo, onPhotoUpdate]
  );

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={clsx('flex flex-col space-y-4', className)}>
      {/* 评分和收藏 */}
      <div className="neu-flat p-4">
        <div className="flex items-center justify-between">
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
                    'h-5 w-5',
                    star <= photo.rating
                      ? 'text-yellow-400'
                      : 'text-gray-300 hover:text-yellow-300 dark:text-gray-600 dark:hover:text-yellow-400'
                  )}
                  fill={star <= photo.rating ? 'currentColor' : 'none'}
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

          <button
            className={clsx(
              'rounded-full p-2 transition-colors',
              photo.isFavorite
                ? 'text-red-500 hover:text-red-600'
                : 'text-gray-400 hover:text-red-500'
            )}
            onClick={toggleFavorite}
            title={photo.isFavorite ? '取消收藏' : '收藏'}
          >
            <svg
              className="h-6 w-6"
              fill={photo.isFavorite ? 'currentColor' : 'none'}
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
        </div>
      </div>

      {/* 基本信息 */}
      <div className="neu-flat p-4">
        <h3 className="mb-3 text-sm font-semibold text-primary">基本信息</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">文件名</dt>
            <dd className="max-w-[200px] truncate font-medium" title={photo.fileName}>
              {photo.fileName}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">格式</dt>
            <dd className="font-medium">{photo.format || '未知'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">尺寸</dt>
            <dd className="font-medium">
              {photo.width && photo.height ? `${photo.width} × ${photo.height}` : '未知'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">大小</dt>
            <dd className="font-medium">{formatFileSize(photo.fileSize)}</dd>
          </div>
        </dl>
      </div>

      {/* 日期信息 */}
      <div className="neu-flat p-4">
        <h3 className="mb-3 text-sm font-semibold text-primary">日期</h3>
        <dl className="space-y-2 text-sm">
          {photo.dateTaken && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">拍摄时间</dt>
              <dd className="font-medium">
                {format(new Date(photo.dateTaken), 'yyyy-MM-dd HH:mm')}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">添加时间</dt>
            <dd className="font-medium">
              {format(new Date(photo.dateAdded), 'yyyy-MM-dd HH:mm')}
            </dd>
          </div>
        </dl>
      </div>

      {/* 相机信息 */}
      {(photo.cameraModel || photo.lensModel) && (
        <div className="neu-flat p-4">
          <h3 className="mb-3 text-sm font-semibold text-primary">相机</h3>
          <dl className="space-y-2 text-sm">
            {photo.cameraModel && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">相机</dt>
                <dd className="font-medium">{photo.cameraModel}</dd>
              </div>
            )}
            {photo.lensModel && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">镜头</dt>
                <dd className="max-w-[200px] truncate font-medium" title={photo.lensModel}>
                  {photo.lensModel}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* 拍摄参数 */}
      {(photo.focalLength || photo.aperture || photo.iso || photo.shutterSpeed) && (
        <div className="neu-flat p-4">
          <h3 className="mb-3 text-sm font-semibold text-primary">拍摄参数</h3>
          <dl className="space-y-2 text-sm">
            {photo.focalLength && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">焦距</dt>
                <dd className="font-medium">{photo.focalLength}mm</dd>
              </div>
            )}
            {photo.aperture && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">光圈</dt>
                <dd className="font-medium">f/{photo.aperture}</dd>
              </div>
            )}
            {photo.shutterSpeed && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">快门</dt>
                <dd className="font-medium">{photo.shutterSpeed}</dd>
              </div>
            )}
            {photo.iso && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">ISO</dt>
                <dd className="font-medium">{photo.iso}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* GPS 信息 */}
      {photo.gpsLatitude && photo.gpsLongitude && (
        <div className="neu-flat p-4">
          <h3 className="mb-3 text-sm font-semibold text-primary">位置</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">纬度</dt>
              <dd className="font-medium">{photo.gpsLatitude.toFixed(6)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">经度</dt>
              <dd className="font-medium">{photo.gpsLongitude.toFixed(6)}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* 文件路径 */}
      <div className="neu-flat p-4">
        <h3 className="mb-3 text-sm font-semibold text-primary">文件路径</h3>
        <p className="break-all text-xs text-muted-foreground">{photo.filePath}</p>
      </div>
    </div>
  );
});

export default PhotoDetail;
