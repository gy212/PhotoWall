/**
 * 照片状态管理
 */

import { create } from 'zustand';
import type { Photo, SortOptions, ViewMode, SortField, SortOrder } from '../types';

interface PhotoState {
  /** 照片列表 */
  photos: Photo[];
  /** 照片总数 */
  totalCount: number;
  /** 是否加载中 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 排序选项 */
  sortOptions: SortOptions;
  /** 视图模式 */
  viewMode: ViewMode;
  /** 缩略图大小 (px) */
  thumbnailSize: number;
  /** 当前搜索关键词（为空表示显示全部） */
  searchQuery: string;

  // Actions
  setPhotos: (photos: Photo[]) => void;
  addPhotos: (photos: Photo[]) => void;
  setTotalCount: (total: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSortOptions: (options: SortOptions) => void;
  setSortField: (field: SortField) => void;
  setSortOrder: (order: SortOrder) => void;
  setViewMode: (mode: ViewMode) => void;
  setThumbnailSize: (size: number) => void;
  setSearchQuery: (query: string) => void;
  clearPhotos: () => void;
}

export const usePhotoStore = create<PhotoState>((set) => ({
  photos: [],
  totalCount: 0,
  loading: false,
  error: null,
  sortOptions: { field: 'dateTaken', order: 'desc' },
  viewMode: 'timeline',
  thumbnailSize: 200,
  searchQuery: '',

  setPhotos: (photos) => set({ photos }),
  addPhotos: (photos) => set((state) => ({ photos: [...state.photos, ...photos] })),
  setTotalCount: (totalCount) => set({ totalCount }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setSortOptions: (sortOptions) => set({ sortOptions }),
  setSortField: (field) =>
    set((state) => ({
      sortOptions: { ...state.sortOptions, field },
    })),
  setSortOrder: (order) =>
    set((state) => ({
      sortOptions: { ...state.sortOptions, order },
    })),
  setViewMode: (viewMode) => set({ viewMode }),
  setThumbnailSize: (thumbnailSize) => set({ thumbnailSize }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  clearPhotos: () => set({ photos: [], error: null }),
}));
