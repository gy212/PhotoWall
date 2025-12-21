/**
 * 收藏相片页面
 *
 * 显示所有已收藏的照片，支持网格/时间线视图、取消收藏等操作
 */

import { useState, useCallback, useEffect } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhotoGrid, PhotoViewer, TimelineView } from '@/components/photo';
import { usePhotoStore } from '@/stores/photoStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { SelectionToolbar, SelectionAction } from '@/components/common/SelectionToolbar';
import {
  getFavoritePhotos,
  setPhotosFavorite,
} from '@/services/api';
import type { Photo, PaginatedResult } from '@/types';

/** 每页加载数量 */
const PAGE_SIZE = 100;

function FavoritesPage() {
  const navigate = useNavigate();
  
  // 从 store 获取视图设置
  const thumbnailSize = usePhotoStore(state => state.thumbnailSize);
  const viewMode = usePhotoStore(state => state.viewMode);
  
  // 选择相关
  const selectedIds = useSelectionStore(state => state.selectedIds);
  const lastSelectedId = useSelectionStore(state => state.lastSelectedId);
  const toggleSelection = useSelectionStore(state => state.toggle);
  const clearSelection = useSelectionStore(state => state.clearSelection);
  const select = useSelectionStore(state => state.select);
  const selectMultiple = useSelectionStore(state => state.selectMultiple);
  const selectAllPhotos = useSelectionStore(state => state.selectAll);

  // 本地照片状态
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 分页状态
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // 查看器状态
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<Photo | null>(null);

  // 取消收藏状态
  const [unfavoriting, setUnfavoriting] = useState(false);

  // 初始加载
  useEffect(() => {
    loadFavorites(1, true);
    // 进入页面时清空选择
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 加载收藏照片
  const loadFavorites = useCallback(
    async (pageNum: number, reset: boolean = false) => {
      if (loading) return;

      setLoading(true);
      setError(null);

      try {
        const result: PaginatedResult<Photo> = await getFavoritePhotos({
          page: pageNum,
          pageSize: PAGE_SIZE,
        });

        if (reset) {
          setPhotos(result.items);
        } else {
          setPhotos(prev => [...prev, ...result.items]);
        }

        setPage(pageNum);
        setTotalCount(result.total);
        setHasMore(pageNum < result.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载收藏照片失败');
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadFavorites(page + 1, false);
    }
  }, [loading, hasMore, page, loadFavorites]);

  // 范围选择
  const selectRange = useCallback(
    (targetId: number, additive: boolean) => {
      if (!photos.length) {
        return;
      }

      const anchorId = lastSelectedId ?? targetId;
      const anchorIndex = photos.findIndex(photo => photo.photoId === anchorId);
      const targetIndex = photos.findIndex(photo => photo.photoId === targetId);

      if (anchorIndex === -1 || targetIndex === -1) {
        if (!additive) {
          clearSelection();
        }
        select(targetId);
        return;
      }

      const [start, end] =
        anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
      const rangeIds = photos.slice(start, end + 1).map(photo => photo.photoId);

      if (!additive) {
        clearSelection();
      }
      selectMultiple(rangeIds);
    },
    [photos, lastSelectedId, clearSelection, selectMultiple, select]
  );

  // 照片点击
  const handlePhotoClick = useCallback(
    (photo: Photo, event?: MouseEvent) => {
      const isCtrlLike = Boolean(event?.ctrlKey || event?.metaKey);
      const isShift = Boolean(event?.shiftKey);

      if (isShift) {
        selectRange(photo.photoId, isCtrlLike);
        return;
      }

      if (isCtrlLike) {
        toggleSelection(photo.photoId);
        return;
      }

      clearSelection();
      select(photo.photoId);
    },
    [selectRange, toggleSelection, clearSelection, select]
  );

  // 照片双击 - 打开查看器
  const handlePhotoDoubleClick = useCallback((photo: Photo) => {
    setViewerPhoto(photo);
    setViewerOpen(true);
  }, []);

  // 照片选择
  const handlePhotoSelect = useCallback(
    (_photo: Photo, _selected: boolean) => {
      toggleSelection(_photo.photoId);
    },
    [toggleSelection]
  );

  // 照片右键菜单
  const handlePhotoContextMenu = useCallback((photo: Photo, event: MouseEvent) => {
    console.log('Context menu for photo:', photo.photoId, event);
  }, []);

  // 关闭查看器
  const handleCloseViewer = useCallback(() => {
    setViewerOpen(false);
    setViewerPhoto(null);
  }, []);

  // 查看器中照片更新
  const handlePhotoUpdate = useCallback(
    (updatedPhoto: Photo) => {
      // 如果取消收藏，从列表中移除
      if (!updatedPhoto.isFavorite) {
        setPhotos(prev => prev.filter(p => p.photoId !== updatedPhoto.photoId));
        setTotalCount(prev => Math.max(0, prev - 1));
      } else {
        setPhotos(prev =>
          prev.map(p => (p.photoId === updatedPhoto.photoId ? updatedPhoto : p))
        );
      }
    },
    []
  );

  // 批量取消收藏
  const handleUnfavorite = useCallback(async () => {
    const selectedCount = selectedIds.size;
    if (selectedCount === 0) return;

    setUnfavoriting(true);

    try {
      const photoIds = Array.from(selectedIds);
      
      // 使用批量 API
      await setPhotosFavorite(photoIds, false);

      // 从列表中移除
      setPhotos(prev => prev.filter(p => !selectedIds.has(p.photoId)));
      setTotalCount(prev => Math.max(0, prev - selectedCount));

      // 清除选择
      clearSelection();
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消收藏失败');
    } finally {
      setUnfavoriting(false);
    }
  }, [selectedIds, clearSelection]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isEditable =
        target?.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT';

      if (isEditable) {
        return;
      }

      if ((event.key === 'a' || event.key === 'A') && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if (photos.length) {
          selectAllPhotos(photos.map(photo => photo.photoId));
        }
        return;
      }

      if (event.key === 'Escape') {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photos, selectAllPhotos, clearSelection]);

  // 空状态
  if (photos.length === 0 && !loading && !error) {
    return (
      <div className="flex h-full w-full flex-col bg-surface rounded-xl">
        {/* 页面头部 */}
        <div className="p-6 border-b border-outline/30">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-3xl text-red-500 filled">favorite</span>
            <div>
              <h1 className="text-4xl font-black text-on-surface">收藏</h1>
              <p className="text-on-surface-variant">0 张照片</p>
            </div>
          </div>
        </div>

        {/* 空状态内容 */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-32 h-32 rounded-2xl bg-red-50 flex items-center justify-center mb-8">
            <span className="material-symbols-outlined text-6xl text-red-300">favorite</span>
          </div>

          <h2 className="text-3xl font-bold text-on-surface mb-3">
            暂无收藏
          </h2>
          <p className="text-on-surface-variant text-base mb-8 max-w-md">
            您还没有收藏任何照片。点击任何照片上的爱心图标即可添加到此处。
          </p>

          <button
            onClick={() => navigate('/')}
            className="btn btn-primary gap-2 px-6 py-3 text-base"
          >
            <span className="material-symbols-outlined text-xl">photo_library</span>
            <span>浏览照片</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-surface rounded-xl">
      {/* 页面头部 */}
      <div className="flex flex-col p-6 pb-0">
        {/* 标题和操作栏 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-3xl text-red-500 filled">favorite</span>
            <div>
              <h1 className="text-on-surface text-4xl font-black leading-tight tracking-tight">收藏</h1>
              <p className="text-on-surface-variant text-base font-normal">
                {totalCount} 张照片
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 min-h-0 mt-6 overflow-y-auto relative">
        {/* 错误提示 */}
        {error && (
          <div className="absolute top-4 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-red-50/90 px-6 py-3 text-sm font-medium text-red-600 shadow-lg backdrop-blur-md ring-1 ring-red-200">
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-lg">error</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* 选择操作栏 */}
        {selectedIds.size > 0 && (
          <SelectionToolbar selectedCount={selectedIds.size} onClear={clearSelection}>
            <SelectionAction
              icon={unfavoriting ? "" : "heart_minus"}
              label="取消收藏"
              onClick={handleUnfavorite}
              disabled={unfavoriting}
              title="移除收藏"
            >
              {unfavoriting && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent absolute" />
              )}
            </SelectionAction>
          </SelectionToolbar>
        )}

        {/* 照片网格 */}
        {viewMode === 'timeline' ? (
          <TimelineView
            photos={photos}
            thumbnailSize={thumbnailSize}
            hasMore={hasMore}
            loading={loading}
            onPhotoClick={handlePhotoClick}
            onPhotoDoubleClick={handlePhotoDoubleClick}
            onPhotoContextMenu={handlePhotoContextMenu}
            onPhotoSelect={handlePhotoSelect}
            onLoadMore={handleLoadMore}
          />
        ) : (
          <PhotoGrid
            photos={photos}
            thumbnailSize={thumbnailSize}
            loading={loading}
            hasMore={hasMore}
            onPhotoClick={handlePhotoClick}
            onPhotoDoubleClick={handlePhotoDoubleClick}
            onPhotoContextMenu={handlePhotoContextMenu}
            onPhotoSelect={handlePhotoSelect}
            onLoadMore={handleLoadMore}
          />
        )}
      </div>

      {/* 查看器 */}
      {viewerOpen && viewerPhoto && (
        <PhotoViewer
          photo={viewerPhoto}
          open={viewerOpen}
          photos={photos}
          onClose={handleCloseViewer}
          onPhotoUpdate={handlePhotoUpdate}
        />
      )}
    </div>
  );
}

export default FavoritesPage;
