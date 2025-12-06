/**
 * 文件夹状态管理
 */

import { create } from 'zustand';
import type { FolderNode, FolderStats, Photo, SortOptions } from '../types';

interface FolderState {
  /** 文件夹统计信息 */
  folderStats: FolderStats | null;
  /** 当前选中的文件夹路径 */
  selectedFolderPath: string | null;
  /** 当前文件夹的照片列表 */
  photos: Photo[];
  /** 照片总数 */
  totalPhotoCount: number;
  /** 是否包含子文件夹 */
  includeSubfolders: boolean;
  /** 排序选项 */
  sortOptions: SortOptions;
  /** 是否加载中 */
  loading: boolean;
  /** 是否加载照片中 */
  loadingPhotos: boolean;
  /** 错误信息 */
  error: string | null;
  /** 展开的文件夹路径集合 */
  expandedPaths: Set<string>;

  // Actions
  setFolderStats: (stats: FolderStats | null) => void;
  setSelectedFolderPath: (path: string | null) => void;
  setPhotos: (photos: Photo[]) => void;
  addPhotos: (photos: Photo[]) => void;
  setTotalPhotoCount: (count: number) => void;
  setIncludeSubfolders: (include: boolean) => void;
  setSortOptions: (options: SortOptions) => void;
  setLoading: (loading: boolean) => void;
  setLoadingPhotos: (loading: boolean) => void;
  setError: (error: string | null) => void;
  toggleExpandPath: (path: string) => void;
  setExpandedPaths: (paths: Set<string>) => void;
  updateFolderChildren: (folderPath: string, children: FolderNode[]) => void;
  clearPhotos: () => void;
  reset: () => void;
}

const initialState = {
  folderStats: null,
  selectedFolderPath: null,
  photos: [],
  totalPhotoCount: 0,
  includeSubfolders: true,
  sortOptions: { field: 'dateTaken' as const, order: 'desc' as const },
  loading: false,
  loadingPhotos: false,
  error: null,
  expandedPaths: new Set<string>(),
};

export const useFolderStore = create<FolderState>((set) => ({
  ...initialState,

  setFolderStats: (folderStats) => set({ folderStats }),
  
  setSelectedFolderPath: (selectedFolderPath) => set({ selectedFolderPath }),
  
  setPhotos: (photos) => set({ photos }),
  
  addPhotos: (newPhotos) => set((state) => ({ 
    photos: [...state.photos, ...newPhotos] 
  })),
  
  setTotalPhotoCount: (totalPhotoCount) => set({ totalPhotoCount }),
  
  setIncludeSubfolders: (includeSubfolders) => set({ includeSubfolders }),
  
  setSortOptions: (sortOptions) => set({ sortOptions }),
  
  setLoading: (loading) => set({ loading }),
  
  setLoadingPhotos: (loadingPhotos) => set({ loadingPhotos }),
  
  setError: (error) => set({ error }),
  
  toggleExpandPath: (path) => set((state) => {
    const newPaths = new Set(state.expandedPaths);
    if (newPaths.has(path)) {
      newPaths.delete(path);
    } else {
      newPaths.add(path);
    }
    return { expandedPaths: newPaths };
  }),
  
  setExpandedPaths: (expandedPaths) => set({ expandedPaths }),
  
  updateFolderChildren: (folderPath, children) => set((state) => {
    if (!state.folderStats) return state;
    
    // 深度更新文件夹树中的子节点
    const updateChildren = (folders: FolderNode[]): FolderNode[] => {
      return folders.map(folder => {
        if (folder.path === folderPath) {
          return {
            ...folder,
            children,
            loaded: true,
          };
        }
        if (folder.children.length > 0) {
          return {
            ...folder,
            children: updateChildren(folder.children),
          };
        }
        return folder;
      });
    };
    
    return {
      folderStats: {
        ...state.folderStats,
        rootFolders: updateChildren(state.folderStats.rootFolders),
      },
    };
  }),
  
  clearPhotos: () => set({ photos: [], totalPhotoCount: 0 }),
  
  reset: () => set(initialState),
}));
