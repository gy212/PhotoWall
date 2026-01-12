/**
 * 照片详情面板组件
 *
 * 显示照片的详细信息，包括基本信息、EXIF、GPS、评分、收藏等
 * 可用于侧边栏或独立面板
 */

import { memo, useCallback } from 'react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { Icon } from '@/components/common/Icon';
import { setPhotoFavorite, setPhotoRating } from '@/services/api';
import type { Photo } from '@/types';

interface PhotoDetailProps {
  photo: Photo;
  onPhotoUpdate?: (photo: Photo) => void;
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
      <div className="bg-surface rounded-xl p-4 border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                className="p-1 transition-transform hover:scale-110"
                onClick={() => handleRating(star)}
                title={`${star} 星`}
              >
                <Icon
                  name="star"
                  className={clsx(
                    'h-5 w-5',
                    star <= photo.rating
                      ? 'text-yellow-400'
                      : 'text-tertiary hover:text-yellow-300'
                  )}
                  filled={star <= photo.rating}
                />
              </button>
            ))}
          </div>

          <button
            className={clsx(
              'rounded-full p-2 transition-colors',
              photo.isFavorite
                ? 'text-red-500 hover:bg-red-500/10'
                : 'text-tertiary hover:text-red-500 hover:bg-red-500/10'
            )}
            onClick={toggleFavorite}
            title={photo.isFavorite ? '取消收藏' : '收藏'}
          >
            <Icon name="favorite" className="h-6 w-6" filled={photo.isFavorite} />
          </button>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="bg-surface rounded-xl p-4 border border-border">
        <h3 className="mb-3 text-sm font-semibold text-primary">基本信息</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-secondary">文件名</dt>
            <dd className="max-w-[200px] truncate font-medium text-primary" title={photo.fileName}>
              {photo.fileName}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-secondary">格式</dt>
            <dd className="font-medium text-primary">{photo.format || '未知'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-secondary">尺寸</dt>
            <dd className="font-medium text-primary">
              {photo.width && photo.height ? `${photo.width} × ${photo.height}` : '未知'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-secondary">大小</dt>
            <dd className="font-medium text-primary">{formatFileSize(photo.fileSize)}</dd>
          </div>
        </dl>
      </div>

      {/* 日期信息 */}
      <div className="bg-surface rounded-xl p-4 border border-border">
        <h3 className="mb-3 text-sm font-semibold text-primary">日期</h3>
        <dl className="space-y-2 text-sm">
          {photo.dateTaken && (
            <div className="flex justify-between">
              <dt className="text-secondary">拍摄时间</dt>
              <dd className="font-medium text-primary">
                {format(new Date(photo.dateTaken), 'yyyy-MM-dd HH:mm')}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-secondary">添加时间</dt>
            <dd className="font-medium text-primary">
              {format(new Date(photo.dateAdded), 'yyyy-MM-dd HH:mm')}
            </dd>
          </div>
        </dl>
      </div>

      {/* 相机信息 */}
      {(photo.cameraModel || photo.lensModel) && (
        <div className="bg-surface rounded-xl p-4 border border-border">
          <h3 className="mb-3 text-sm font-semibold text-primary">相机</h3>
          <dl className="space-y-2 text-sm">
            {photo.cameraModel && (
              <div className="flex justify-between">
                <dt className="text-secondary">相机</dt>
                <dd className="font-medium text-primary">{photo.cameraModel}</dd>
              </div>
            )}
            {photo.lensModel && (
              <div className="flex justify-between">
                <dt className="text-secondary">镜头</dt>
                <dd className="max-w-[200px] truncate font-medium text-primary" title={photo.lensModel}>
                  {photo.lensModel}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* 拍摄参数 */}
      {(photo.focalLength || photo.aperture || photo.iso || photo.shutterSpeed) && (
        <div className="bg-surface rounded-xl p-4 border border-border">
          <h3 className="mb-3 text-sm font-semibold text-primary">拍摄参数</h3>
          <div className="grid grid-cols-2 gap-2">
            {photo.focalLength && (
              <div className="bg-background rounded-lg p-3 flex flex-col items-center justify-center text-center space-y-1">
                <Icon name="focal_length" className="text-secondary h-5 w-5 mb-1" />
                <div className="text-xs text-secondary">焦距</div>
                <div className="text-primary font-bold">{photo.focalLength}mm</div>
              </div>
            )}
            {photo.aperture && (
              <div className="bg-background rounded-lg p-3 flex flex-col items-center justify-center text-center space-y-1">
                <Icon name="aperture" className="text-secondary h-5 w-5 mb-1" />
                <div className="text-xs text-secondary">光圈</div>
                <div className="text-primary font-bold">f/{photo.aperture}</div>
              </div>
            )}
            {photo.shutterSpeed && (
              <div className="bg-background rounded-lg p-3 flex flex-col items-center justify-center text-center space-y-1">
                <Icon name="shutter_speed" className="text-secondary h-5 w-5 mb-1" />
                <div className="text-xs text-secondary">快门</div>
                <div className="text-primary font-bold">{photo.shutterSpeed}</div>
              </div>
            )}
            {photo.iso && (
              <div className="bg-background rounded-lg p-3 flex flex-col items-center justify-center text-center space-y-1">
                <Icon name="iso" className="text-secondary h-5 w-5 mb-1" />
                <div className="text-xs text-secondary">ISO</div>
                <div className="text-primary font-bold">{photo.iso}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GPS 信息 */}
      {photo.gpsLatitude && photo.gpsLongitude && (
        <div className="bg-surface rounded-xl p-4 border border-border">
          <h3 className="mb-3 text-sm font-semibold text-primary">位置</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-secondary">纬度</dt>
              <dd className="font-medium text-primary">{photo.gpsLatitude.toFixed(6)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-secondary">经度</dt>
              <dd className="font-medium text-primary">{photo.gpsLongitude.toFixed(6)}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* 文件路径 */}
      <div className="bg-surface rounded-xl p-4 border border-border">
        <h3 className="mb-3 text-sm font-semibold text-primary">文件路径</h3>
        <p className="break-all text-xs text-secondary">{photo.filePath}</p>
      </div>
    </div>
  );
});

export default PhotoDetail;
