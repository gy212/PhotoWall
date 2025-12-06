/**
 * 导航状态管理
 */

import { create } from 'zustand';

export type NavigationSection = 'all' | 'folders' | 'albums' | 'tags' | 'favorites';

interface NavigationState {
  /** 当前活动的导航项 */
  activeSection: NavigationSection;
  /** 当前文件夹路径 (当 section 为 folders 时) */
  currentFolderPath: string | null;
  /** 当前相册ID (当 section 为 albums 时) */
  currentAlbumId: number | null;
  /** 当前标签ID (当 section 为 tags 时) */
  currentTagId: number | null;

  // Actions
  setActiveSection: (section: NavigationSection) => void;
  navigateToFolder: (path: string) => void;
  navigateToAlbum: (albumId: number) => void;
  navigateToTag: (tagId: number) => void;
  navigateToAll: () => void;
  navigateToFavorites: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  activeSection: 'all',
  currentFolderPath: null,
  currentAlbumId: null,
  currentTagId: null,

  setActiveSection: (activeSection) => set({ activeSection }),

  navigateToFolder: (path) =>
    set({
      activeSection: 'folders',
      currentFolderPath: path,
      currentAlbumId: null,
      currentTagId: null,
    }),

  navigateToAlbum: (albumId) =>
    set({
      activeSection: 'albums',
      currentAlbumId: albumId,
      currentFolderPath: null,
      currentTagId: null,
    }),

  navigateToTag: (tagId) =>
    set({
      activeSection: 'tags',
      currentTagId: tagId,
      currentFolderPath: null,
      currentAlbumId: null,
    }),

  navigateToAll: () =>
    set({
      activeSection: 'all',
      currentFolderPath: null,
      currentAlbumId: null,
      currentTagId: null,
    }),

  navigateToFavorites: () =>
    set({
      activeSection: 'favorites',
      currentFolderPath: null,
      currentAlbumId: null,
      currentTagId: null,
    }),
}));
