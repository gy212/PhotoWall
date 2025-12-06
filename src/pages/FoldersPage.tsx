/**
 * 文件夹视图页面
 *
 * 按照磁盘文件夹结构浏览和管理图片
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { MouseEvent } from 'react';
import { PhotoGrid, PhotoViewer } from '@/components/photo';
import { useFolderStore } from '@/stores/folderStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { usePhotoStore } from '@/stores/photoStore';
import {
  getFolderTree,
  getFolderChildren,
  getPhotosByFolder,
  softDeletePhotos,
  setPhotosFavorite,
} from '@/services/api';
import type { Photo, FolderNode } from '@/types';
import clsx from 'clsx';

/** 每页加载数量 */
const PAGE_SIZE = 100;

function FoldersPage() {
  // Folder store
  const folderStats = useFolderStore(state => state.folderStats);
  const selectedFolderPath = useFolderStore(state => state.selectedFolderPath);
  const photos = useFolderStore(state => state.photos);
  const totalPhotoCount = useFolderStore(state => state.totalPhotoCount);
  const includeSubfolders = useFolderStore(state => state.includeSubfolders);
  const sortOptions = useFolderStore(state => state.sortOptions);
  const loading = useFolderStore(state => state.loading);
  const loadingPhotos = useFolderStore(state => state.loadingPhotos);
  const error = useFolderStore(state => state.error);
  const expandedPaths = useFolderStore(state => state.expandedPaths);
  
  const setFolderStats = useFolderStore(state => state.setFolderStats);
  const setSelectedFolderPath = useFolderStore(state => state.setSelectedFolderPath);
  const setPhotos = useFolderStore(state => state.setPhotos);
  const addPhotos = useFolderStore(state => state.addPhotos);
  const setTotalPhotoCount = useFolderStore(state => state.setTotalPhotoCount);
  const setIncludeSubfolders = useFolderStore(state => state.setIncludeSubfolders);
  const setLoading = useFolderStore(state => state.setLoading);
  const setLoadingPhotos = useFolderStore(state => state.setLoadingPhotos);
  const setError = useFolderStore(state => state.setError);
  const toggleExpandPath = useFolderStore(state => state.toggleExpandPath);
  const updateFolderChildren = useFolderStore(state => state.updateFolderChildren);

  // Photo store - 仅用于缩略图尺寸
  const thumbnailSize = usePhotoStore(state => state.thumbnailSize);

  // Selection store
  const selectedIds = useSelectionStore(state => state.selectedIds);
  const lastSelectedId = useSelectionStore(state => state.lastSelectedId);
  const toggleSelection = useSelectionStore(state => state.toggle);
  const clearSelection = useSelectionStore(state => state.clearSelection);
  const select = useSelectionStore(state => state.select);
  const selectMultiple = useSelectionStore(state => state.selectMultiple);
  const selectAllPhotos = useSelectionStore(state => state.selectAll);

  // 本地状态
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<Photo | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [favoriting, setFavoriting] = useState(false);
  const [loadingFolderPath, setLoadingFolderPath] = useState<string | null>(null);

  // 初始加载
  useEffect(() => {
    const doLoad = async () => {
      setLoading(true);
      setError(null);
      try {
        const stats = await getFolderTree();
        setFolderStats(stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载文件夹失败');
      } finally {
        setLoading(false);
      }
    };
    doLoad();
  }, [setLoading, setError, setFolderStats]);

  // 加载文件夹中的照片
  const loadPhotos = useCallback(
    async (folderPath: string, pageNum: number, reset: boolean = false) => {
      if (loadingPhotos) return;

      setLoadingPhotos(true);
      setError(null);

      try {
        const result = await getPhotosByFolder(
          folderPath,
          includeSubfolders,
          { page: pageNum, pageSize: PAGE_SIZE },
          sortOptions
        );

        if (reset) {
          setPhotos(result.items);
        } else {
          addPhotos(result.items);
        }

        setPage(pageNum);
        setTotalPhotoCount(result.total);
        setHasMore(pageNum < result.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载照片失败');
      } finally {
        setLoadingPhotos(false);
      }
    },
    [loadingPhotos, includeSubfolders, sortOptions, setPhotos, addPhotos, setLoadingPhotos, setError, setTotalPhotoCount]
  );

  // 当选中文件夹或设置变化时重新加载照片
  useEffect(() => {
    if (selectedFolderPath) {
      // 清除旧照片并加载新照片
      const doLoadPhotos = async () => {
        if (loadingPhotos) return;
        setPhotos([]);
        setTotalPhotoCount(0);
        setLoadingPhotos(true);
        setError(null);

        try {
          const result = await getPhotosByFolder(
            selectedFolderPath,
            includeSubfolders,
            { page: 1, pageSize: PAGE_SIZE },
            sortOptions
          );
          setPhotos(result.items);
          setPage(1);
          setTotalPhotoCount(result.total);
          setHasMore(1 < result.totalPages);
        } catch (err) {
          setError(err instanceof Error ? err.message : '加载照片失败');
        } finally {
          setLoadingPhotos(false);
        }
      };
      doLoadPhotos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolderPath, includeSubfolders, sortOptions]);

  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (!loadingPhotos && hasMore && selectedFolderPath) {
      loadPhotos(selectedFolderPath, page + 1, false);
    }
  }, [loadingPhotos, hasMore, page, selectedFolderPath, loadPhotos]);

  // 文件夹点击
  const handleFolderClick = useCallback((folder: FolderNode) => {
    setSelectedFolderPath(folder.path);
    clearSelection();
  }, [setSelectedFolderPath, clearSelection]);

  // 加载子文件夹
  const handleLoadChildren = useCallback(async (folder: FolderNode): Promise<FolderNode[]> => {
    setLoadingFolderPath(folder.path);
    try {
      const children = await getFolderChildren(folder.path);
      updateFolderChildren(folder.path, children);
      return children;
    } catch (err) {
      console.error('加载子文件夹失败:', err);
      return [];
    } finally {
      setLoadingFolderPath(null);
    }
  }, [updateFolderChildren]);

  // 切换文件夹展开/折叠
  const handleToggleExpand = useCallback(async (folder: FolderNode, e: MouseEvent) => {
    e.stopPropagation();
    toggleExpandPath(folder.path);
    
    // 如果展开且未加载，则加载子文件夹
    if (!expandedPaths.has(folder.path) && !folder.loaded) {
      await handleLoadChildren(folder);
    }
  }, [toggleExpandPath, expandedPaths, handleLoadChildren]);

  // 范围选择
  const selectRange = useCallback(
    (targetId: number, additive: boolean) => {
      if (!photos.length) return;

      const anchorId = lastSelectedId ?? targetId;
      const anchorIndex = photos.findIndex(photo => photo.photoId === anchorId);
      const targetIndex = photos.findIndex(photo => photo.photoId === targetId);

      if (anchorIndex === -1 || targetIndex === -1) {
        if (!additive) clearSelection();
        select(targetId);
        return;
      }

      const [start, end] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
      const rangeIds = photos.slice(start, end + 1).map(photo => photo.photoId);

      if (!additive) clearSelection();
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

  // 照片双击
  const handlePhotoDoubleClick = useCallback((photo: Photo) => {
    setViewerPhoto(photo);
    setViewerOpen(true);
  }, []);

  // 照片选择
  const handlePhotoSelect = useCallback(
    (_photo: Photo) => {
      toggleSelection(_photo.photoId);
    },
    [toggleSelection]
  );

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isEditable = target?.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';

      if (isEditable) return;

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
      setPhotos(photos.map((p: Photo) => (p.photoId === updatedPhoto.photoId ? updatedPhoto : p)));
    },
    [photos, setPhotos]
  );

  // 删除照片
  const handleDelete = useCallback(async () => {
    const selectedCount = selectedIds.size;
    if (selectedCount === 0) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const photoIds = Array.from(selectedIds);
      const deletedCount = await softDeletePhotos(photoIds);

      setPhotos(photos.filter((p: Photo) => !selectedIds.has(p.photoId)));
      clearSelection();
      setTotalPhotoCount(Math.max(0, totalPhotoCount - deletedCount));
      setShowDeleteDialog(false);

      if (photos.length - deletedCount === 0 && page > 1 && selectedFolderPath) {
        loadPhotos(selectedFolderPath, page - 1, true);
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  }, [selectedIds, photos, setPhotos, clearSelection, setTotalPhotoCount, page, selectedFolderPath, loadPhotos, totalPhotoCount]);

  // 批量收藏/取消收藏
  const handleToggleFavorite = useCallback(async (shouldFavorite: boolean) => {
    const selectedCount = selectedIds.size;
    if (selectedCount === 0) return;

    setFavoriting(true);

    try {
      const photoIds = Array.from(selectedIds);
      await setPhotosFavorite(photoIds, shouldFavorite);
      setPhotos(photos.map((p: Photo) => 
        selectedIds.has(p.photoId) ? { ...p, isFavorite: shouldFavorite } : p
      ));
      clearSelection();
    } catch (err) {
      console.error('设置收藏失败:', err);
    } finally {
      setFavoriting(false);
    }
  }, [selectedIds, photos, setPhotos, clearSelection]);

  // 打开删除确认对话框
  const handleDeleteClick = useCallback(() => {
    if (selectedIds.size > 0) {
      setShowDeleteDialog(true);
      setDeleteError(null);
    }
  }, [selectedIds]);

  // 获取当前选中文件夹的名称
  const selectedFolderName = useMemo(() => {
    if (!selectedFolderPath) return null;
    const parts = selectedFolderPath.split(/[\\/]/);
    return parts[parts.length - 1] || selectedFolderPath;
  }, [selectedFolderPath]);

  // 渲染文件夹节点
  const renderFolderNode = useCallback((folder: FolderNode, level: number = 0) => {
    const isExpanded = expandedPaths.has(folder.path);
    const isSelected = selectedFolderPath === folder.path;
    const isLoading = loadingFolderPath === folder.path;
    const hasChildren = folder.children.length > 0 || !folder.loaded;

    return (
      <div key={folder.path}>
        <button
          onClick={() => handleFolderClick(folder)}
          className={clsx(
            'group flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
            isSelected
              ? 'bg-primary-100 text-primary'
              : 'hover:bg-button text-on-surface-variant hover:text-on-surface'
          )}
          style={{ paddingLeft: `${level * 1.25 + 0.75}rem` }}
        >
          {/* 展开/折叠按钮 */}
          {hasChildren ? (
            <span
              onClick={(e) => handleToggleExpand(folder, e)}
              className={clsx(
                'mr-2 flex h-5 w-5 items-center justify-center rounded transition-transform cursor-pointer hover:bg-button',
                isExpanded && 'rotate-90'
              )}
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <span className="material-symbols-outlined text-base">chevron_right</span>
              )}
            </span>
          ) : (
            <span className="mr-2 w-5" />
          )}

          {/* 文件夹图标 */}
          <span className={clsx(
            'material-symbols-outlined mr-2 text-xl',
            isSelected ? 'text-primary' : 'text-on-surface-variant'
          )}>
            {isExpanded ? 'folder_open' : 'folder'}
          </span>

          {/* 文件夹名称 */}
          <span className="flex-1 truncate text-left" title={folder.path}>{folder.name}</span>

          {/* 照片数量 */}
          {folder.totalPhotoCount > 0 && (
            <span
              className={clsx(
                'ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold',
                isSelected
                  ? 'bg-primary/20 text-primary'
                  : 'bg-button text-on-surface-variant'
              )}
            >
              {folder.totalPhotoCount}
            </span>
          )}
        </button>

        {/* 子文件夹 */}
        {isExpanded && folder.children.length > 0 && (
          <div className="mt-0.5">
            {folder.children.map((child) => renderFolderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  }, [expandedPaths, selectedFolderPath, loadingFolderPath, handleFolderClick, handleToggleExpand]);

  // 空状态 - 没有文件夹
  if (!loading && folderStats && folderStats.rootFolders.length === 0) {
    return (
      <div className="flex h-full w-full flex-col bg-surface rounded-xl">
        {/* 页面头部 */}
        <div className="p-6 border-b border-outline/30">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-3xl text-primary">folder</span>
            <div>
              <h1 className="text-4xl font-black text-on-surface">文件夹</h1>
              <p className="text-on-surface-variant">按文件夹浏览照片</p>
            </div>
          </div>
        </div>
  
        {/* 空状态内容 */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-32 h-32 rounded-2xl bg-primary-100 flex items-center justify-center mb-8">
            <span className="material-symbols-outlined text-6xl text-primary/50">folder_off</span>
          </div>
  
          <h2 className="text-3xl font-bold text-on-surface mb-3">
            暂无文件夹
          </h2>
          <p className="text-on-surface-variant text-base mb-8 max-w-md">
            请先从“所有照片”页面导入照片文件夹。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-surface rounded-xl">
      {/* 左侧文件夹树 */}
      <div className="w-72 flex-shrink-0 border-r border-outline/30 flex flex-col h-full">
        {/* 标题 */}
        <div className="p-4 border-b border-outline/30">
          <h2 className="text-lg font-semibold text-on-surface">文件夹</h2>
          {folderStats && (
            <p className="text-xs text-on-surface-variant mt-1">
              {folderStats.totalFolders} 个文件夹，{folderStats.totalPhotos} 张照片
            </p>
          )}
        </div>

        {/* 文件夹列表 */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-outline border-t-primary" />
            </div>
          ) : (
            <div className="space-y-0.5">
              {folderStats?.rootFolders.map(folder => renderFolderNode(folder))}
            </div>
          )}
        </div>
      </div>

      {/* 右侧内容区 */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* 工具栏和面包屑 */}
        {selectedFolderPath && (
          <header className="sticky top-0 z-10 flex flex-col gap-4 border-b border-outline/30 bg-surface/80 p-4 backdrop-blur-sm">
            {/* 面包屑导航 */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-on-surface-variant text-sm font-medium hover:text-primary cursor-pointer">文件夹</span>
              {selectedFolderPath.split(/[\\/]/).filter(Boolean).map((segment, index, arr) => (
                <span key={index} className="flex items-center gap-2">
                  <span className="text-on-surface-variant text-sm">/</span>
                  <span className={clsx(
                    'text-sm font-medium',
                    index === arr.length - 1 ? 'text-on-surface' : 'text-on-surface-variant hover:text-primary cursor-pointer'
                  )}>{segment}</span>
                </span>
              ))}
            </div>
            
            {/* 文件夹名称和操作 */}
            <div className="flex justify-between items-center gap-2">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-on-surface">{selectedFolderName}</h2>
                {totalPhotoCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-button text-xs font-medium text-on-surface-variant">
                    {totalPhotoCount} 张照片
                  </span>
                )}
              </div>
              
              {/* 选项 */}
              <div className="flex items-center space-x-3">
                <label className="flex items-center space-x-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSubfolders}
                    onChange={(e) => setIncludeSubfolders(e.target.checked)}
                    className="rounded border-outline text-primary focus:ring-primary/50"
                  />
                  <span className="text-on-surface-variant">包含子文件夹</span>
                </label>
              </div>
            </div>
          </header>
        )}

        {/* 照片网格 */}
        {selectedFolderPath ? (
          <div className="flex-1 overflow-hidden">
            {error && (
              <div className="absolute top-20 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-red-50/90 px-6 py-3 text-sm font-medium text-red-600 shadow-lg backdrop-blur-md">
                {error}
              </div>
            )}

            {/* 选择操作栏 */}
            {selectedIds.size > 0 && (
              <div className="absolute top-20 left-1/2 z-50 -translate-x-1/2 flex items-center space-x-3 rounded-full bg-primary px-6 py-3 text-white shadow-xl">
                <span className="text-sm font-semibold">
                  已选择 {selectedIds.size} 项
                </span>
                <div className="h-5 w-px bg-white/30" />
                <button
                  onClick={() => handleToggleFavorite(true)}
                  disabled={favoriting}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-white/20 disabled:opacity-50"
                  title="添加到收藏"
                >
                  <span className="material-symbols-outlined text-lg">favorite</span>
                  <span>收藏</span>
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-white/20"
                  title="删除"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                  <span>删除</span>
                </button>
                <button
                  onClick={() => clearSelection()}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-white/20"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            )}

            <PhotoGrid
              photos={photos}
              thumbnailSize={thumbnailSize}
              loading={loadingPhotos}
              hasMore={hasMore}
              onPhotoClick={handlePhotoClick}
              onPhotoDoubleClick={handlePhotoDoubleClick}
              onPhotoContextMenu={handlePhotoContextMenu}
              onPhotoSelect={handlePhotoSelect}
              onLoadMore={handleLoadMore}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 rounded-2xl bg-button flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/50">folder_open</span>
              </div>
              <p className="text-lg text-on-surface-variant">从左侧面板选择一个文件夹</p>
            </div>
          </div>
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

      {/* 删除确认对话框 */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl ring-1 ring-outline/30">
            <div className="mb-4 flex items-start space-x-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <span className="material-symbols-outlined text-2xl text-red-600">delete</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-on-surface">确认删除</h3>
                <p className="mt-1 text-sm text-on-surface-variant">
                  确定要删除这 {selectedIds.size} 张照片吗？它们将被移到回收站。
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                {deleteError}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
                className="flex-1 btn btn-secondary h-10"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 btn h-10 bg-red-600 text-white hover:bg-red-700"
              >
                {deleting ? '删除中...' : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FoldersPage;
