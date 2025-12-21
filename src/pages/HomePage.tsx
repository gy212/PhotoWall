/**
 * 首页组件
 *
 * 显示所有照片的网格视图，支持添加文件夹、查看详情等
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { MouseEvent } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { open } from '@tauri-apps/plugin-dialog';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { PhotoGrid, PhotoViewer, TimelineView } from '@/components/photo';
import { usePhotoStore } from '@/stores/photoStore';
import { useSelectionStore } from '@/stores/selectionStore';
import ContextMenu from '@/components/common/ContextMenu';
import type { ContextMenuItem } from '@/components/common/ContextMenu';
import {
  indexDirectory,
  getPhotosCursor,
  searchPhotosCursor,
  getDatabaseStats,
  softDeletePhotos,
  refreshPhotoMetadata,
  setPhotosFavorite,
  setPhotoFavorite,
} from '@/services/api';
import type { Photo, PhotoCursor, SearchFilters, IndexResult, SortField } from '@/types';
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
  const sortOptions = usePhotoStore(state => state.sortOptions);
  const searchQuery = usePhotoStore(state => state.searchQuery);
  const viewMode = usePhotoStore(state => state.viewMode);
  const totalCount = usePhotoStore(state => state.totalCount);
  const setTotalCount = usePhotoStore(state => state.setTotalCount);
  const setSearchQuery = usePhotoStore(state => state.setSearchQuery);
  const selectedIds = useSelectionStore(state => state.selectedIds);
  const lastSelectedId = useSelectionStore(state => state.lastSelectedId);
  const toggleSelection = useSelectionStore(state => state.toggle);
  const clearSelection = useSelectionStore(state => state.clearSelection);
  const select = useSelectionStore(state => state.select);
  const selectMultiple = useSelectionStore(state => state.selectMultiple);
  const selectAllPhotos = useSelectionStore(state => state.selectAll);
  const isTauriRuntime = detectTauriRuntime();
  const queryClient = useQueryClient();

  // 搜索防抖：避免每次按键都触发查询
  const debouncedLoadRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  useEffect(() => {
    if (debouncedLoadRef.current) {
      clearTimeout(debouncedLoadRef.current);
    }

    debouncedLoadRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      if (debouncedLoadRef.current) {
        clearTimeout(debouncedLoadRef.current);
        debouncedLoadRef.current = null;
      }
    };
  }, [searchQuery]);

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

  const getCursorForPhoto = useCallback((photo: Photo, field: SortField): PhotoCursor => {
    let sortValue: string | number | null = null;
    switch (field) {
      case 'dateTaken':
        sortValue = photo.dateTaken ?? null;
        break;
      case 'dateAdded':
        sortValue = photo.dateAdded ?? null;
        break;
      case 'fileName':
        sortValue = photo.fileName ?? null;
        break;
      case 'fileSize':
        sortValue = photo.fileSize ?? null;
        break;
      case 'rating':
        sortValue = photo.rating ?? null;
        break;
      default:
        sortValue = photo.dateTaken ?? null;
        break;
    }

    return { sortValue, photoId: photo.photoId };
  }, []);

  const photoFeedQueryKey = useMemo(
    () => [
      'photoFeed',
      {
        q: debouncedSearchQuery.trim(),
        field: sortOptions.field,
        order: sortOptions.order,
      },
    ] as const,
    [debouncedSearchQuery, sortOptions.field, sortOptions.order]
  );

  const {
    data,
    status,
    error: queryError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: photoFeedQueryKey,
    enabled: isTauriRuntime,
    initialPageParam: null as PhotoCursor | null,
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam ?? null;
      const includeTotal = pageParam == null;
      const q = debouncedSearchQuery.trim();

      if (q) {
        const filters: SearchFilters = { query: q };
        return searchPhotosCursor(filters, PAGE_SIZE, cursor, sortOptions, includeTotal);
      }

      return getPhotosCursor(PAGE_SIZE, cursor, sortOptions, includeTotal);
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.items.length < PAGE_SIZE) {
        return undefined;
      }
      const last = lastPage.items[lastPage.items.length - 1];
      return last ? getCursorForPhoto(last, sortOptions.field) : undefined;
    },
  });

  const photos = useMemo(() => data?.pages.flatMap(page => page.items) ?? [], [data]);
  const loading = status === 'pending' || isFetchingNextPage;
  const error = useMemo(() => {
    if (!queryError) return null;
    return queryError instanceof Error ? queryError.message : String(queryError);
  }, [queryError]);
  const hasMore = Boolean(hasNextPage);

  // 仅在需要时更新总数（首屏返回 total；后续页为 null）
  useEffect(() => {
    const total = data?.pages?.[0]?.total;
    if (typeof total === 'number') {
      setTotalCount(total);
    }
  }, [data, setTotalCount]);

  // 加载更多（由 PhotoGrid/TimelineView 在接近底部时触发）
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

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
          
          // 日期更新会影响排序，重置无限列表到首屏
          if (result.updated > 0) {
            queryClient.removeQueries({ queryKey: photoFeedQueryKey, exact: true });
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
  }, [photos, photoFeedQueryKey, queryClient, refreshing]);

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

      // 新增数据会改变列表，重置无限列表到首屏
      hasRefreshedMetadata.current = false;
      queryClient.removeQueries({ queryKey: photoFeedQueryKey, exact: true });

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
  }, [isTauriRuntime, photoFeedQueryKey, queryClient]);

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
      queryClient.setQueryData(photoFeedQueryKey, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            items: page.items.map((p: Photo) =>
              p.photoId === photo.photoId ? { ...p, isFavorite: !photo.isFavorite } : p
            ),
          })),
        };
      });
    } catch (err) {
      console.error('设置收藏失败:', err);
    }
  }, [photoFeedQueryKey, queryClient]);

  // 单张照片删除
  const handleSingleDelete = useCallback(async (photo: Photo) => {
    try {
      await softDeletePhotos([photo.photoId]);
      // 从照片列表中移除
      queryClient.removeQueries({ queryKey: photoFeedQueryKey, exact: true });
      setTotalCount(Math.max(0, totalCount - 1));
    } catch (err) {
      console.error('删除照片失败:', err);
    }
  }, [photoFeedQueryKey, queryClient, setTotalCount, totalCount]);

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
      queryClient.setQueryData(photoFeedQueryKey, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            items: page.items.map((p: Photo) =>
              p.photoId === updatedPhoto.photoId ? updatedPhoto : p
            ),
          })),
        };
      });
    },
    [photoFeedQueryKey, queryClient]
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

      // 清除选择
      clearSelection();

      // 更新总数
      const nextTotal = Math.max(0, totalCount - deletedCount);
      setTotalCount(nextTotal);

      // 关闭对话框
      setShowDeleteDialog(false);

      // 如果删除后当前页没有照片了，重新加载
      queryClient.removeQueries({ queryKey: photoFeedQueryKey, exact: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  }, [clearSelection, photoFeedQueryKey, queryClient, selectedIds, setTotalCount, totalCount]);

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
      const selected = new Set(selectedIds);
      queryClient.setQueryData(photoFeedQueryKey, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            items: page.items.map((p: Photo) =>
              selected.has(p.photoId) ? { ...p, isFavorite: shouldFavorite } : p
            ),
          })),
        };
      });

      // 清除选择
      clearSelection();
    } catch (err) {
      console.error('设置收藏失败:', err);
    } finally {
      setFavoriting(false);
    }
  }, [clearSelection, photoFeedQueryKey, queryClient, selectedIds]);

  // 视图模式
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // 视图切换选项
  type ViewStyle = 'compact' | 'spaced' | 'aspect';
  const [viewStyle, setViewStyle] = useState<ViewStyle>('spaced');

  // 根据视图样式计算缩略图尺寸和间距
  const gridSettings = useMemo(() => {
    switch (viewStyle) {
      case 'compact':
        return { size: 150, gap: 2 };
      case 'spaced':
        return { size: 200, gap: 8 };
      case 'aspect':
        return { size: 240, gap: 12 };
      default:
        return { size: 200, gap: 8 };
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
    <div className="flex flex-col h-full w-full bg-surface relative">
      {/* 统一的吸顶头部 - Islands 风格 */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-3 bg-surface/90 backdrop-blur-xl transition-all duration-200">
        {/* 左侧：标题与统计 */}
        <div className="flex items-baseline gap-3 min-w-[200px]">
          <h1 className="text-lg font-bold text-on-surface tracking-tight">所有照片</h1>
          <span className="text-xs font-medium text-muted-foreground">
            {formatCount(totalCount)} 张
          </span>
        </div>

        {/* 中间：搜索框 (居中) */}
        <div className="flex-1 max-w-md px-4">
          <div className="relative group w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-[18px] text-muted-foreground group-focus-within:text-primary transition-colors">search</span>
            </div>
            <input
              className="block w-full pl-9 pr-3 py-1.5 text-[13px] bg-zinc-100/50 dark:bg-black/20 border-transparent rounded-lg text-on-surface placeholder-muted-foreground focus:border-primary/30 focus:ring-4 focus:ring-primary/10 focus:bg-surface transition-all duration-200 outline-none"
              placeholder="搜索..."
              value={localSearchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
        </div>

        {/* 右侧：视图切换 - Islands Style Buttons */}
        <div className="flex items-center justify-end min-w-[200px] gap-3">
           {/* 导入按钮 */}
           <button
            onClick={handleAddFolder}
            disabled={indexing}
            className="flex items-center justify-center h-9 w-9 rounded-xl border border-outline/50 bg-surface text-secondary hover:bg-zinc-50 hover:border-outline hover:text-primary transition-all active:scale-95 shadow-sm dark:bg-white/5 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/10"
            title="添加文件夹"
          >
            {indexing ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <span className="material-symbols-outlined text-[20px]">add</span>
            )}
          </button>

          <div className="flex items-center p-1 bg-zinc-100/50 dark:bg-black/20 rounded-xl border border-outline/20">
            <button
              onClick={() => setViewStyle('compact')}
              className={clsx(
                'flex items-center justify-center h-7 px-3 text-xs font-medium rounded-lg transition-all duration-200',
                viewStyle === 'compact' 
                  ? 'bg-surface text-primary shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:text-white dark:ring-white/5' 
                  : 'text-muted-foreground hover:text-on-surface hover:bg-black/5 dark:hover:bg-white/5'
              )}
              title="紧凑视图"
            >
              紧凑
            </button>
            <button
              onClick={() => setViewStyle('spaced')}
              className={clsx(
                'flex items-center justify-center h-7 px-3 text-xs font-medium rounded-lg transition-all duration-200',
                viewStyle === 'spaced'
                  ? 'bg-surface text-primary shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:text-white dark:ring-white/5'
                  : 'text-muted-foreground hover:text-on-surface hover:bg-black/5 dark:hover:bg-white/5'
              )}
              title="标准视图"
            >
              适中
            </button>
            <button
              onClick={() => setViewStyle('aspect')}
              className={clsx(
                'flex items-center justify-center h-7 px-3 text-xs font-medium rounded-lg transition-all duration-200',
                viewStyle === 'aspect'
                  ? 'bg-surface text-primary shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:text-white dark:ring-white/5'
                  : 'text-muted-foreground hover:text-on-surface hover:bg-black/5 dark:hover:bg-white/5'
              )}
              title="原始比例"
            >
              原比
            </button>
          </div>
        </div>
      </header>

      {/* 主内容区域 - 移除 overflow-y-auto，让虚拟列表自己管理滚动 */}
      <div className="flex-1 min-h-0 mt-2 relative">
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

        {/* 选择操作栏 - 现代化 Dock 样式 */}
        {selectedIds.size > 0 && (
          <div className="absolute bottom-8 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-2xl bg-on-surface/90 backdrop-blur-xl px-4 py-2 text-white shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="px-3 py-1 bg-white/10 rounded-xl mr-2">
              <span className="text-sm font-bold tracking-tight">
                已选择 {selectedIds.size} 项
              </span>
            </div>
            
            <button
              onClick={() => handleToggleFavorite(true)}
              disabled={favoriting}
              className="group flex flex-col items-center justify-center w-14 h-14 rounded-xl hover:bg-white/10 transition-all active:scale-90 disabled:opacity-50"
              title="���藏"
            >
              <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">favorite</span>
              <span className="text-[10px] font-medium mt-0.5">收藏</span>
            </button>

            <button
              onClick={handleDeleteClick}
              className="group flex flex-col items-center justify-center w-14 h-14 rounded-xl hover:bg-red-500/20 text-white transition-all active:scale-90"
              title="删除"
            >
              <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform text-red-400">delete</span>
              <span className="text-[10px] font-medium mt-0.5 text-red-400">删除</span>
            </button>

            <div className="w-px h-8 bg-white/20 mx-1" />

            <button
              onClick={() => clearSelection()}
              className="group flex flex-col items-center justify-center w-14 h-14 rounded-xl hover:bg-white/10 transition-all active:scale-90"
              title="取消选择"
            >
              <span className="material-symbols-outlined text-2xl group-hover:rotate-90 transition-transform">close</span>
              <span className="text-[10px] font-medium mt-0.5">取消</span>
            </button>
          </div>
        )}

        {/* 照片网格 */}
        {viewMode === 'timeline' ? (
          <TimelineView
            photos={photos}
            thumbnailSize={gridSettings.size}
            gap={gridSettings.gap}
            selectedIds={selectedIds}
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
            selectedIds={selectedIds}
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
