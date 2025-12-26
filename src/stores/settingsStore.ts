/**
 * 设置状态管理
 *
 * 注意：主题已固定为深色，不再支持切换
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  /** 语言 */
  language: 'zh-CN' | 'en-US';
  /** 扫描监控文件夹列表 */
  watchedFolders: string[];
  /** 排除的文件夹模式 */
  excludePatterns: string[];
  /** 缩略图缓存最大大小 (MB) */
  maxCacheSize: number;
  /** 自动清理缓存 */
  autoCleanupCache: boolean;
  /** 性能 - 并发线程数 */
  workerThreads: number;
  /** 启动时自动扫描 */
  autoScanOnStart: boolean;

  /** 窗口背景不透明度 - 保留兼容性 */
  windowOpacity: number;
  /** 窗口透明度 (0-100)，0=不透明，100=高度透明 */
  windowTransparency: number;

  // Actions
  setLanguage: (language: 'zh-CN' | 'en-US') => void;
  addWatchedFolder: (path: string) => void;
  removeWatchedFolder: (path: string) => void;
  setExcludePatterns: (patterns: string[]) => void;
  setMaxCacheSize: (size: number) => void;
  setAutoCleanupCache: (enabled: boolean) => void;
  setWorkerThreads: (threads: number) => void;
  setAutoScanOnStart: (enabled: boolean) => void;
  setWindowOpacity: (opacity: number) => void;
  setWindowTransparency: (transparency: number) => void;
  resetToDefaults: () => void;
}

const defaultSettings = {
  language: 'zh-CN' as const,
  watchedFolders: [],
  excludePatterns: ['node_modules', '.git', '__pycache__', 'temp'],
  maxCacheSize: 1024, // 1GB
  autoCleanupCache: true,
  workerThreads: 4,
  autoScanOnStart: false,
  windowOpacity: 0.3,
  windowTransparency: 30,
};

export const useSettingsStore = create<SettingsState>()(persist(
  (set) => ({
    ...defaultSettings,

    setLanguage: (language) => set({ language }),

    addWatchedFolder: (path) =>
      set((state) => ({
        watchedFolders: [...new Set([...state.watchedFolders, path])],
      })),

    removeWatchedFolder: (path) =>
      set((state) => ({
        watchedFolders: state.watchedFolders.filter((f) => f !== path),
      })),

    setExcludePatterns: (excludePatterns) => set({ excludePatterns }),
    setMaxCacheSize: (maxCacheSize) => set({ maxCacheSize }),
    setAutoCleanupCache: (autoCleanupCache) => set({ autoCleanupCache }),
    setWorkerThreads: (workerThreads) => set({ workerThreads }),
    setAutoScanOnStart: (autoScanOnStart) => set({ autoScanOnStart }),
    setWindowOpacity: (windowOpacity) => set({ windowOpacity }),
    setWindowTransparency: (windowTransparency) => set({ windowTransparency }),

    resetToDefaults: () => set(defaultSettings),
  }),
  {
    name: 'photowall-settings',
  }
));
