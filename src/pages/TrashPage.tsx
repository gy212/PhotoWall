/**
 * 回收站页面
 *
 * 显示所有已删除的照片，支持恢复、永久删除和清空回收站
 */

import { useState, useCallback, useEffect } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhotoGrid, PhotoViewer, TimelineView } from '@/components/photo';
import { usePhotoStore } from '@/stores/photoStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { SelectionToolbar, SelectionAction, SelectionDivider } from '@/components/common/SelectionToolbar';
import { Icon } from '@/components/common/Icon';
import {
  getDeletedPhotos,
  restorePhotos,
  permanentDeletePhotos,
  emptyTrash,
  getTrashStats,
  type TrashStats,
} from '@/services/api';
import type { Photo, PaginatedResult } from '@/types';

/** 每页加载数量 */
const PAGE_SIZE = 100;

function TrashPage() {
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

  // 操作状态
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [emptying, setEmptying] = useState(false);

  // 对话框状态
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEmptyDialog, setShowEmptyDialog] = useState(false);

  // 统计信息
  const [, setStats] = useState<TrashStats | null>(null);

  // 初始加载
  useEffect(() => {
    loadTrash(1, true);
    loadStats();
    // 进入页面时清空选择
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 加载统计信息
  const loadStats = useCallback(async () => {
    try {
      const result = await getTrashStats();
      setStats(result);
    } catch (err) {
      console.error('加载回收站统计失败:', err);
    }
  }, []);

  // 加载回收站照片
  const loadTrash = useCallback(
    async (pageNum: number, reset: boolean = false) => {
      if (loading) return;

      setLoading(true);
      setError(null);

      try {
        const result: PaginatedResult<Photo> = await getDeletedPhotos({
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
        setError(err instanceof Error ? err.message : '加载回收站失败');
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadTrash(page + 1, false);
    }
  }, [loading, hasMore, page, loadTrash]);

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
      setPhotos(prev =>
        prev.map(p => (p.photoId === updatedPhoto.photoId ? updatedPhoto : p))
      );
    },
    []
  );

  // 恢复照片
  const handleRestore = useCallback(async () => {
    const selectedCount = selectedIds.size;
    if (selectedCount === 0) return;

    setRestoring(true);

    try {
      const photoIds = Array.from(selectedIds);

      await restorePhotos(photoIds);

      // 从列表中移除
      setPhotos(prev => prev.filter(p => !selectedIds.has(p.photoId)));
      setTotalCount(prev => Math.max(0, prev - selectedCount));

      // 清除选择
      clearSelection();

      // 更新统计
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : '恢复失败');
    } finally {
      setRestoring(false);
    }
  }, [selectedIds, clearSelection, loadStats]);

  // 永久删除
  const handlePermanentDelete = useCallback(async () => {
    const selectedCount = selectedIds.size;
    if (selectedCount === 0) return;

    setDeleting(true);

    try {
      const photoIds = Array.from(selectedIds);

      await permanentDeletePhotos(photoIds);

      // 从列表中移除
      setPhotos(prev => prev.filter(p => !selectedIds.has(p.photoId)));
      setTotalCount(prev => Math.max(0, prev - selectedCount));

      // 清除选择
      clearSelection();

      // 关闭对话框
      setShowDeleteDialog(false);

      // 更新统计
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  }, [selectedIds, clearSelection, loadStats]);

  // 清空回收站
  const handleEmptyTrash = useCallback(async () => {
    setEmptying(true);

    try {
      await emptyTrash();

      // 清空列表
      setPhotos([]);
      setTotalCount(0);

      // 清除选择
      clearSelection();

      // 关闭对话框
      setShowEmptyDialog(false);

      // 更新统计
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : '清空回收站失败');
    } finally {
      setEmptying(false);
    }
  }, [clearSelection, loadStats]);

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
      <div className="h-full w-full p-6">
        <div className="flex h-full w-full flex-col card rounded-2xl border border-border">
          {/* 页面头部 */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Icon name="delete" className="text-3xl text-secondary" />
                <div>
                  <h1 className="text-4xl font-black text-primary font-serif">最近删除</h1>
                  <p className="text-secondary">项目将在 30 天后永久删除。</p>
                </div>
              </div>
            </div>
          </div>

          {/* 空状态内容 */}
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-32 h-32 rounded-3xl bg-element flex items-center justify-center mb-8 shadow-inner">
              <Icon name="delete_sweep" className="text-6xl text-tertiary/50" />
            </div>

            <h2 className="text-3xl font-bold text-primary mb-3 font-serif tracking-tight">
              回收站为空
            </h2>
            <p className="text-secondary text-base mb-8 max-w-md">
              没有已删除的照片。您删除的项目将会临时显示在这里。
            </p>

            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-6 py-3 text-base bg-primary hover:bg-primary-dark text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0"
            >
              <Icon name="photo_library" className="text-xl" />
              <span>浏览照片</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full p-6">
      <div className="flex flex-col h-full w-full card rounded-2xl border border-border overflow-hidden">
        {/* 页面头部 */}
        <div className="flex flex-col p-6 pb-0 bg-surface">
          {/* 标题和操作栏 */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <h1 className="text-primary text-4xl font-bold leading-tight tracking-tight font-serif">最近删除</h1>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-4 h-10 bg-background hover:bg-hover text-primary rounded-lg font-medium transition-colors border border-border">选择</button>
              {totalCount > 0 && (
                <button
                  onClick={() => setShowEmptyDialog(true)}
                  className="flex items-center gap-2 h-10 px-4 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors shadow-sm"
                >
                  <Icon name="delete_forever" className="text-base" />
                  <span>清空回收站</span>
                </button>
              )}
            </div>
          </div>
          <p className="text-secondary text-base font-normal pt-4">
            项目将在 30 天后永久删除。{totalCount > 0 && `(共 ${totalCount} 项)`}
          </p>
        </div>

        {/* 主内容区域 */}
        <div className="flex-1 min-h-0 mt-4 overflow-y-auto relative">
          {/* 错误提示 */}
          {error && (
            <div className="absolute top-4 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-red-500/20 px-6 py-3 text-sm font-medium text-red-300 shadow-lg backdrop-blur-md border border-red-500/30">
              <div className="flex items-center space-x-2">
                <Icon name="error" className="text-lg" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* 选择操作栏 */}
          {selectedIds.size > 0 && (
            <SelectionToolbar selectedCount={selectedIds.size} onClear={clearSelection}>
              {/* 恢复按钮 */}
              <SelectionAction
                icon={restoring ? "" : "restore"}
                label="恢复"
                onClick={handleRestore}
                disabled={restoring}
                title="恢复"
              >
                {restoring && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent absolute" />
                )}
              </SelectionAction>

              <SelectionDivider />

              {/* 永久删除按钮 */}
              <SelectionAction
                icon="delete_forever"
                label="彻底删除"
                onClick={() => setShowDeleteDialog(true)}
                title="永久删除"
              />
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

        {/* 永久删除确认对话框 */}
        {showDeleteDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="relative w-full max-w-md rounded-2xl card p-6 shadow-2xl border border-border">
              <div className="mb-4 flex items-start space-x-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
                  <Icon name="warning" className="text-2xl text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">永久删除</h3>
                  <p className="mt-1 text-sm text-white/60">
                    确定要永久删除这 {selectedIds.size} 张照片吗？<br />
                    <span className="text-red-400 font-medium">此操作无法撤消！</span>
                  </p>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteDialog(false)}
                  disabled={deleting}
                  className="flex-1 h-10 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg font-medium transition-colors border border-white/10"
                >
                  取消
                </button>
                <button
                  onClick={handlePermanentDelete}
                  disabled={deleting}
                  className="flex-1 h-10 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors"
                >
                  {deleting ? '删除中...' : '永久删除'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 清空回收站确认对话框 */}
        {showEmptyDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="relative w-full max-w-md rounded-2xl card p-6 shadow-2xl border border-border">
              <div className="mb-4 flex items-start space-x-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
                  <Icon name="delete_forever" className="text-2xl text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">清空回收站</h3>
                  <p className="mt-1 text-sm text-white/60">
                    确定要永久删除回收站中的全部 {totalCount} 张照片吗？<br />
                    <span className="text-red-400 font-medium">此操作无法撤消！</span>
                  </p>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowEmptyDialog(false)}
                  disabled={emptying}
                  className="flex-1 h-10 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg font-medium transition-colors border border-white/10"
                >
                  取消
                </button>
                <button
                  onClick={handleEmptyTrash}
                  disabled={emptying}
                  className="flex-1 h-10 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors"
                >
                  {emptying ? '清空中...' : '清空回收站'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TrashPage;
