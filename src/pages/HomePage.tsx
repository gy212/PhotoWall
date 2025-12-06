/**
 * 首页组件
 *
 * 显示所有照片的网格视图，支持添加文件夹、查看详情等
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { MouseEvent } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { PhotoGrid, PhotoViewer, TimelineView } from '@/components/photo';
import { usePhotoStore } from '@/stores/photoStore';
import { useSelectionStore } from '@/stores/selectionStore';
import ContextMenu from '@/components/common/ContextMenu';
import type { ContextMenuItem } from '@/components/common/ContextMenu';
import {
  indexDirectory,
  getPhotos,
  searchPhotos,
  getDatabaseStats,
  softDeletePhotos,
  refreshPhotoMetadata,
  setPhotosFavorite,
  setPhotoFavorite,
} from '@/services/api';
import type { Photo, PaginatedResult, SearchFilters, IndexResult } from '@/types';
import clsx from 'clsx';

/** 每页加载数量 */
const PAGE_SIZE = 100;

const detectTauriRuntime = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  const tauriWindow = window as Window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  return Boolean(tauriWindow.__TAURI__ ?? tauriWindow.__TAURI_INTERNALS__);
};

function HomePage() {
  const photos = usePhotoStore(state => state.photos);
  const loading = usePhotoStore(state => state.loading);
  const error = usePhotoStore(state => state.error);
  const sortOptions = usePhotoStore(state => state.sortOptions);
  const thumbnailSize = usePhotoStore(state => state.thumbnailSize);
  const searchQuery = usePhotoStore(state => state.searchQuery);
  const viewMode = usePhotoStore(state => state.viewMode);
  const totalCount = usePhotoStore(state => state.totalCount);
  const setPhotos = usePhotoStore(state => state.setPhotos);
  const addPhotos = usePhotoStore(state => state.addPhotos);
  const setLoading = usePhotoStore(state => state.setLoading);
  const setError = usePhotoStore(state => state.setError);
  const setTotalCount = usePhotoStore(state => state.setTotalCount);
  const selectedIds = useSelectionStore(state => state.selectedIds);
  const lastSelectedId = useSelectionStore(state => state.lastSelectedId);
  const toggleSelection = useSelectionStore(state => state.toggle);
  const clearSelection = useSelectionStore(state => state.clearSelection);
  const select = useSelectionStore(state => state.select);
  const selectMultiple = useSelectionStore(state => state.selectMultiple);
  const selectAllPhotos = useSelectionStore(state => state.selectAll);
  const isTauriRuntime = detectTauriRuntime();

  // 分页状态
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // 查看器状态
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<Photo | null>(null);

  // 索引状态
  const [indexing, setIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState<string>('');
  const [indexingError, setIndexingError] = useState(false);

  // 删除状态
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 收藏状态
  const [favoriting, setFavoriting] = useState(false);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    photo: Photo | null;
  }>({ visible: false, x: 0, y: 0, photo: null });

  // 元数据刷新状态
  const hasRefreshedMetadata = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  // 防抖搜索 - 避免频繁按键时的过多请求
  const debouncedLoadRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 初始加载和排序变化时立即加载
  useEffect(() => {
    loadPhotos(1, true);
  }, [sortOptions]);

  // 搜索关键词变化时使用防抖加载
  useEffect(() => {
    // 清除之前的防抖定时器
    if (debouncedLoadRef.current) {
      clearTimeout(debouncedLoadRef.current);
    }
    
    // 设置300ms防抖延迟
    debouncedLoadRef.current = setTimeout(() => {
      loadPhotos(1, true);
    }, 300);
    
    return () => {
      if (debouncedLoadRef.current) {
        clearTimeout(debouncedLoadRef.current);
      }
    };
  }, [searchQuery]);

  // 检测是否需要刷新元数据（照片缺少 dateTaken）
  useEffect(() => {
    const checkAndRefreshMetadata = async () => {
      if (hasRefreshedMetadata.current || photos.length === 0 || refreshing) return;
      
      // 检查是否有照片缺少 dateTaken
      const missingDateCount = photos.filter(p => !p.dateTaken).length;
      if (missingDateCount > 0) {
        console.log(`[HomePage] 发现 ${missingDateCount} 张照片缺少拍摄时间，正在刷新元数据...`);
        hasRefreshedMetadata.current = true;
        setRefreshing(true);
        setIndexProgress('正在刷新照片日期信息...');
        
        try {
          const result = await refreshPhotoMetadata();
          console.log(`[HomePage] 元数据刷新完成:`, result);
          setIndexProgress(`日期刷新完成：${result.updated} 张更新`);
          
          // 重新加载照片列表
          if (result.updated > 0) {
            await loadPhotos(1, true);
          }
          
          setTimeout(() => setIndexProgress(''), 3000);
        } catch (err) {
          console.error('[HomePage] 刷新元数据失败:', err);
          setIndexProgress('');
        } finally {
          setRefreshing(false);
        }
      }
    };
    
    checkAndRefreshMetadata();
  }, [photos.length]); // 只在照片数量变化时检查

  // 加载照片
  const loadPhotos = useCallback(
    async (pageNum: number, reset: boolean = false) => {
      if (loading) return;

      setLoading(true);
      setError(null);

      try {
        let result: PaginatedResult<Photo>;

        // 如果有搜索关键词，使用搜索API；否则使用普通列表API
        if (searchQuery && searchQuery.trim()) {
          const filters: SearchFilters = {
            query: searchQuery.trim(),
          };
          const searchResult = await searchPhotos(
            filters,
            { page: pageNum, pageSize: PAGE_SIZE },
            sortOptions
          );
          result = searchResult.photos;
        } else {
          result = await getPhotos(
            { page: pageNum, pageSize: PAGE_SIZE },
            sortOptions
          );
        }

        if (reset) {
          setPhotos(result.items);
        } else {
          addPhotos(result.items);
        }

        setPage(pageNum);
        setTotalCount(result.total);
        setHasMore(pageNum < result.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载照片失败');
      } finally {
        setLoading(false);
      }
    },
    [loading, sortOptions, searchQuery, setPhotos, addPhotos, setLoading, setError, setTotalCount]
  );

  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadPhotos(page + 1, false);
    }
  }, [loading, hasMore, page, loadPhotos]);

  // 选择文件夹并索引
  const handleAddFolder = useCallback(async () => {
    if (!isTauriRuntime) {
      setIndexingError(true);
      setIndexProgress('导入功能仅在桌面客户端中可用，请在 Tauri 应用内运行。');
      setTimeout(() => {
        setIndexProgress('');
        setIndexingError(false);
      }, 3000);
      return;
    }

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择照片文件夹',
      });

      if (!selected) return;

      setIndexingError(false);
      setIndexing(true);
      setIndexProgress('正在扫描文件夹...');

      const result: IndexResult = await indexDirectory(selected as string);

      setIndexProgress(
        `索引完成：${result.indexed} 张照片已添加，${result.skipped} 张跳过，${result.failed} 个错误`
      );

      // 重新加载照片列表
      await loadPhotos(1, true);

      // 更新数据库统计
      await getDatabaseStats();

      setIndexing(false);
      setTimeout(() => {
        setIndexProgress('');
      }, 3000);
    } catch (err) {
      setIndexing(false);
      setIndexingError(true);
      const fallback =
        !isTauriRuntime && err instanceof Error && err.message.includes('available')
          ? '导入功能仅在桌面客户端中可用，请在 Tauri 应用内运行。'
          : `索引失败: ${err instanceof Error ? err.message : '未知错误'}`;
      setIndexProgress(fallback);
      setTimeout(() => {
        setIndexProgress('');
        setIndexingError(false);
      }, 3000);
    }
  }, [isTauriRuntime, loadPhotos]);

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

  // 照片右键菜单
  const handlePhotoContextMenu = useCallback((photo: Photo, event: MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      photo,
    });
  }, []);

  // 关闭右键菜单
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  // 打开文件所在文件夹
  const handleOpenInFolder = useCallback(async (photo: Photo) => {
    if (!isTauriRuntime) return;
    try {
      // 获取文件所在目录
      const folderPath = photo.filePath.substring(0, photo.filePath.lastIndexOf('\\'));
      await shellOpen(folderPath);
    } catch (err) {
      console.error('打开文件夹失败:', err);
    }
  }, [isTauriRuntime]);

  // 复制文件路径
  const handleCopyPath = useCallback(async (photo: Photo) => {
    try {
      await navigator.clipboard.writeText(photo.filePath);
    } catch (err) {
      console.error('复制路径失败:', err);
    }
  }, []);

  // 单张照片收藏/取消收藏
  const handleSingleFavorite = useCallback(async (photo: Photo) => {
    try {
      await setPhotoFavorite(photo.photoId, !photo.isFavorite);
      // 更新照片列表中的收藏状态
      setPhotos(photos.map((p: Photo) => 
        p.photoId === photo.photoId ? { ...p, isFavorite: !photo.isFavorite } : p
      ));
    } catch (err) {
      console.error('设置收藏失败:', err);
    }
  }, [photos, setPhotos]);

  // 单张照片删除
  const handleSingleDelete = useCallback(async (photo: Photo) => {
    try {
      await softDeletePhotos([photo.photoId]);
      // 从照片列表中移除
      setPhotos(photos.filter((p: Photo) => p.photoId !== photo.photoId));
      setTotalCount(Math.max(0, totalCount - 1));
    } catch (err) {
      console.error('删除照片失败:', err);
    }
  }, [photos, setPhotos, setTotalCount, totalCount]);

  // 右键菜单项
  const contextMenuItems = useMemo((): ContextMenuItem[] => {
    const photo = contextMenu.photo;
    if (!photo) return [];

    return [
      {
        id: 'open-folder',
        label: '打开所在文件夹',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        ),
        disabled: !isTauriRuntime,
        onClick: () => handleOpenInFolder(photo),
      },
      {
        id: 'copy-path',
        label: '复制文件路径',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
        ),
        onClick: () => handleCopyPath(photo),
      },
      {
        id: 'favorite',
        label: photo.isFavorite ? '取消收藏' : '添加收藏',
        icon: (
          <svg className={`w-4 h-4 ${photo.isFavorite ? 'text-red-500' : ''}`} fill={photo.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        ),
        divider: true,
        onClick: () => handleSingleFavorite(photo),
      },
      {
        id: 'delete',
        label: '删除',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        ),
        danger: true,
        divider: true,
        onClick: () => handleSingleDelete(photo),
      },
    ];
  }, [contextMenu.photo, isTauriRuntime, handleOpenInFolder, handleCopyPath, handleSingleFavorite, handleSingleDelete]);

  // 关闭查看器
  const handleCloseViewer = useCallback(() => {
    setViewerOpen(false);
    setViewerPhoto(null);
  }, []);

  // 查看器中照片更新
  const handlePhotoUpdate = useCallback(
    (updatedPhoto: Photo) => {
      // 更新照片列表中的照片
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
      const deletedCount = await softDeletePhotos(photoIds); // 软删除，移入回收站

      // 从照片列表中移除已删除的照片
      setPhotos(photos.filter((p: Photo) => !selectedIds.has(p.photoId)));

      // 清除选择
      clearSelection();

      // 更新总数
      const nextTotal = Math.max(0, totalCount - deletedCount);
      setTotalCount(nextTotal);

      // 关闭对话框
      setShowDeleteDialog(false);

      // 如果删除后当前页没有照片了，重新加载
      if (photos.length - deletedCount === 0 && page > 1) {
        loadPhotos(page - 1, true);
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  }, [selectedIds, photos, setPhotos, clearSelection, setTotalCount, page, loadPhotos]);

  // 批量收藏/取消收藏
  const handleToggleFavorite = useCallback(async (shouldFavorite: boolean) => {
    const selectedCount = selectedIds.size;
    if (selectedCount === 0) return;

    setFavoriting(true);

    try {
      const photoIds = Array.from(selectedIds);
      
      // 使用批量 API
      await setPhotosFavorite(photoIds, shouldFavorite);

      // 更新照片列表中的收藏状态
      setPhotos(photos.map((p: Photo) => 
        selectedIds.has(p.photoId) ? { ...p, isFavorite: shouldFavorite } : p
      ));

      // 清除选择
      clearSelection();
    } catch (err) {
      console.error('设置收藏失败:', err);
    } finally {
      setFavoriting(false);
    }
  }, [selectedIds, photos, setPhotos, clearSelection]);

  // 视图模式
  const setViewMode = usePhotoStore(state => state.setViewMode);
  const setSearchQuery = usePhotoStore(state => state.setSearchQuery);
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  // 视图切换选项
  type ViewStyle = 'compact' | 'spaced' | 'aspect';
  const [viewStyle, setViewStyle] = useState<ViewStyle>('spaced');

  // 根据视图样式计算缩略图尺寸和间距
  const gridSettings = useMemo(() => {
    switch (viewStyle) {
      case 'compact':
        return { size: 150, gap: 4 };
      case 'spaced':
        return { size: 200, gap: 16 };
      case 'aspect':
        return { size: 240, gap: 16 };
      default:
        return { size: 200, gap: 16 };
    }
  }, [viewStyle]);

  // 打开删除确认对话框
  const handleDeleteClick = useCallback(() => {
    if (selectedIds.size > 0) {
      setShowDeleteDialog(true);
      setDeleteError(null);
    }
  }, [selectedIds]);

  // 搜索处理
  const handleSearchChange = useCallback((value: string) => {
    setLocalSearchQuery(value);
    setSearchQuery(value);
  }, [setSearchQuery]);

  // 格式化数量
  const formatCount = (count: number) => {
    return new Intl.NumberFormat('zh-CN').format(count);
  };

  // 空状态 - 显示欢迎页面
  if (photos.length === 0 && !loading && !error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center bg-surface">
        <div className="flex flex-col items-center">
          <div className="w-32 h-32 rounded-2xl bg-primary-100 dark:bg-primary/20 flex items-center justify-center mb-8">
            <span className="material-symbols-outlined text-6xl text-primary">photo_library</span>
          </div>

          <h2 className="text-3xl font-bold text-on-surface mb-3">
            欢迎使用 PhotoWall
          </h2>
          <p className="text-on-surface-variant text-base mb-8 max-w-md">
            您的照片库还是空的。添加一个文件夹开始整理您的回忆吧。
          </p>

          <button
            onClick={handleAddFolder}
            disabled={indexing}
            className="btn btn-primary gap-2 px-6 py-3 text-base"
          >
            {indexing ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>{indexProgress || '处理中...'}</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-xl">add</span>
                <span>添加文件夹</span>
              </>
            )}
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
          <div className="flex flex-col min-w-72">
            <h1 className="text-on-surface text-4xl font-black leading-tight tracking-tight">所有照片</h1>
            <p className="text-on-surface-variant text-base font-normal">
              {formatCount(totalCount)} 张照片
            </p>
          </div>
        </div>

        {/* 搜索栏和视图切换 */}
        <div className="grid grid-cols-1 gap-4 mt-6 md:grid-cols-2">
          {/* 搜索框 */}
          <div className="w-full">
            <label className="flex flex-col w-full h-12 min-w-40">
              <div className="flex items-stretch flex-1 w-full h-full rounded-lg">
                <div className="text-on-surface-variant flex items-center justify-center pl-4 bg-button rounded-l-lg">
                  <span className="material-symbols-outlined text-xl">search</span>
                </div>
                <input 
                  className="flex-1 w-full min-w-0 p-0 px-3 text-sm font-normal text-on-surface placeholder-on-surface-variant border-none rounded-r-lg bg-button focus:outline-none focus:ring-0" 
                  placeholder="按日期、地点或人物搜索"
                  value={localSearchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
            </label>
          </div>

          {/* 视图切换 */}
          <div className="flex items-center justify-start md:justify-end">
            <div className="flex items-center justify-center h-10 p-1 rounded-lg bg-button">
              <label className={clsx(
                'flex items-center justify-center h-full px-3 overflow-hidden text-sm font-medium rounded-md cursor-pointer text-on-surface-variant transition-colors',
                viewStyle === 'compact' && 'bg-surface text-on-surface shadow-sm'
              )}>
                <span>紧凑</span>
                <input 
                  className="w-0 invisible" 
                  name="view-toggle" 
                  type="radio" 
                  value="compact"
                  checked={viewStyle === 'compact'}
                  onChange={() => setViewStyle('compact')}
                />
              </label>
              <label className={clsx(
                'flex items-center justify-center h-full px-3 overflow-hidden text-sm font-medium rounded-md cursor-pointer text-on-surface-variant transition-colors',
                viewStyle === 'spaced' && 'bg-surface text-on-surface shadow-sm'
              )}>
                <span>适中</span>
                <input 
                  className="w-0 invisible" 
                  name="view-toggle" 
                  type="radio" 
                  value="spaced"
                  checked={viewStyle === 'spaced'}
                  onChange={() => setViewStyle('spaced')}
                />
              </label>
              <label className={clsx(
                'flex items-center justify-center h-full px-3 overflow-hidden text-sm font-medium rounded-md cursor-pointer text-on-surface-variant transition-colors',
                viewStyle === 'aspect' && 'bg-surface text-on-surface shadow-sm'
              )}>
                <span>原始比例</span>
                <input 
                  className="w-0 invisible" 
                  name="view-toggle" 
                  type="radio" 
                  value="aspect"
                  checked={viewStyle === 'aspect'}
                  onChange={() => setViewStyle('aspect')}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 - 移除 overflow-y-auto，让虚拟列表自己管理滚动 */}
      <div className="flex-1 min-h-0 mt-6 relative">
        {/* 错误提示 */}
        {error && (
          <div className="absolute top-4 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-red-50/90 px-6 py-3 text-sm font-medium text-red-600 shadow-lg backdrop-blur-md ring-1 ring-red-200 dark:bg-red-900/80 dark:text-red-100 dark:ring-red-800">
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-lg">error</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* 索引进度浮层 */}
        {indexProgress && (
          <div
            className={clsx(
              'absolute top-4 right-6 z-50 flex items-center rounded-full px-5 py-2.5 text-sm font-medium shadow-lg backdrop-blur-md',
              indexingError ? 'bg-red-500 text-white' : 'bg-primary text-white'
            )}
          >
            {indexing && !indexingError && (
              <div className="mr-2.5 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            <span>{indexProgress}</span>
          </div>
        )}

        {/* 选择操作栏 */}
        {selectedIds.size > 0 && (
          <div className="absolute top-4 left-1/2 z-50 -translate-x-1/2 flex items-center space-x-3 rounded-full bg-primary px-6 py-3 text-white shadow-xl">
            <span className="text-sm font-semibold">
              已选择 {selectedIds.size} 项
            </span>
            <div className="h-5 w-px bg-white/30" />
            <button
              onClick={() => handleToggleFavorite(true)}
              disabled={favoriting}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-white/20 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">favorite</span>
              <span>收藏</span>
            </button>
            <button
              onClick={handleDeleteClick}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-white/20"
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

        {/* 照片网格 */}
        {viewMode === 'timeline' ? (
          <TimelineView
            photos={photos}
            thumbnailSize={gridSettings.size}
            gap={gridSettings.gap}
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
            thumbnailSize={gridSettings.size}
            gap={gridSettings.gap}
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

      {/* 浮动添加按钮 */}
      <button
        onClick={handleAddFolder}
        className="absolute bottom-10 right-10 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary-dark transition-colors"
        title="添加照片"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl ring-1 ring-border/50 animate-in zoom-in-95 duration-200">
            <div className="mb-4 flex items-start space-x-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M7 7h10" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-primary">确认删除</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  确定要删除选中的 {selectedIds.size} 张照片吗？照片将被移至系统回收站。
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                <div className="flex items-center space-x-2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{deleteError}</span>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-border/60 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-secondary/20 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-800"
              >
                {deleting ? (
                  <span className="flex items-center justify-center">
                    <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    删除中...
                  </span>
                ) : (
                  '删除'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 右键菜单 */}
      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        items={contextMenuItems}
        onClose={handleCloseContextMenu}
      />
    </div>
  );
}

export default HomePage;
