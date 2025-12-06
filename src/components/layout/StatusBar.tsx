import { usePhotoStore } from '@/stores/photoStore';
import { useSelectionStore } from '@/stores/selectionStore';
import type { Photo } from '@/types';

/**
 * 状态栏组件 - Soft UI 风格重构
 */
function StatusBar() {
  const { photos, loading } = usePhotoStore();
  const { selectedIds } = useSelectionStore();

  // 格式化文件大小总和
  const formatTotalSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // 计算选中照片的总大小
  const selectedSize = photos
    .filter((p: Photo) => selectedIds.has(p.photoId))
    .reduce((sum: number, p: Photo) => sum + p.fileSize, 0);

  // 计算所有照片的总大小
  const totalSize = photos.reduce((sum: number, p: Photo) => sum + p.fileSize, 0);

  return (
    <div className="flex items-center justify-between px-2 text-xs font-bold text-gray-400">
      <div className="flex items-center space-x-4">
        <span>{photos.length} 张照片</span>
        {photos.length > 0 && <span>总大小 {formatTotalSize(totalSize)}</span>}
        {selectedIds.size > 0 && (
          <span className="text-[#2d3748]">
            已选 {selectedIds.size} 项 ({formatTotalSize(selectedSize)})
          </span>
        )}
      </div>
      <div className="flex items-center space-x-4">
        {loading ? (
          <span className="flex items-center space-x-2">
            <span className="inline-block h-2 w-2 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
            <span>加载中...</span>
          </span>
        ) : (
          <span>就绪</span>
        )}
      </div>
    </div>
  );
}

export default StatusBar;
