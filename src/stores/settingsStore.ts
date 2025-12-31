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
  /** 模糊半径 (0-100) */
  blurRadius: number;
  /** 是否启用自定义桌面模糊 */
  customBlurEnabled: boolean;
  /** 是否支持 Composition Backdrop (Windows 11+) */
  compositionBlurSupported: boolean;
  /** 是否启用 Composition Backdrop 模糊 */
  compositionBlurEnabled: boolean;

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
  setBlurRadius: (radius: number) => void;
  setCustomBlurEnabled: (enabled: boolean) => void;
  setCompositionBlurSupported: (supported: boolean) => void;
  setCompositionBlurEnabled: (enabled: boolean) => void;
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
  blurRadius: 20,
  customBlurEnabled: true,
  compositionBlurSupported: false,
  compositionBlurEnabled: false,
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
    setWindowOpacity: (windowOpacity) => {
      const clampedOpacity = Math.max(0, Math.min(1, windowOpacity));
      set({
        windowOpacity: clampedOpacity,
        windowTransparency: Math.round(clampedOpacity * 100),
      });
    },
    setWindowTransparency: (windowTransparency) => {
      const clampedTransparency = Math.max(0, Math.min(100, windowTransparency));
      set({
        windowTransparency: clampedTransparency,
        windowOpacity: clampedTransparency / 100,
      });
    },
    setBlurRadius: (blurRadius) => set({ blurRadius: Math.max(0, Math.min(100, blurRadius)) }),
    setCustomBlurEnabled: (customBlurEnabled) => set({ customBlurEnabled }),
    setCompositionBlurSupported: (compositionBlurSupported) => set({ compositionBlurSupported }),
    setCompositionBlurEnabled: (compositionBlurEnabled) => set({ compositionBlurEnabled }),

    resetToDefaults: () => set(defaultSettings),
  }),
  {
    name: 'photowall-settings',
  }
));
