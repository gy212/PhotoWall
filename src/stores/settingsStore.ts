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

  /** 主题色 (Hex) */
  themeColor: string;
  /** 主题模式 */
  theme: 'light' | 'dark' | 'system';

  windowOpacity: number;
  windowTransparency: number;
  blurRadius: number;
  customBlurEnabled: boolean;
  compositionBlurSupported: boolean;
  compositionBlurEnabled: boolean;

  /** 高刷/流畅优先模式（减少重特效，提升帧率稳定性） */
  highRefreshUi: boolean;

  // Actions
  setLanguage: (language: 'zh-CN' | 'en-US') => void;
  addWatchedFolder: (path: string) => void;
  removeWatchedFolder: (path: string) => void;
  setExcludePatterns: (patterns: string[]) => void;
  setMaxCacheSize: (size: number) => void;
  setAutoCleanupCache: (enabled: boolean) => void;
  setWorkerThreads: (threads: number) => void;
  setAutoScanOnStart: (enabled: boolean) => void;
  setThemeColor: (color: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setWindowOpacity: (opacity: number) => void;
  setWindowTransparency: (transparency: number) => void;
  setBlurRadius: (radius: number) => void;
  setCustomBlurEnabled: (enabled: boolean) => void;
  setCompositionBlurSupported: (supported: boolean) => void;
  setCompositionBlurEnabled: (enabled: boolean) => void;
  setHighRefreshUi: (enabled: boolean) => void;
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
  themeColor: '#DA7756', // 默认 Terracotta
  theme: 'system' as const,
  windowOpacity: 100,
  windowTransparency: 30,
  blurRadius: 24,
  customBlurEnabled: false,
  compositionBlurSupported: false,
  compositionBlurEnabled: false,
  highRefreshUi: true,
};

export const useSettingsStore = create<SettingsState>()(persist(
  (set) => ({
    ...defaultSettings,

    setLanguage: (language) =>
      set((state) => (state.language === language ? state : { language })),

    addWatchedFolder: (path) =>
      set((state) => {
        if (state.watchedFolders.includes(path)) return state;
        return { watchedFolders: [...state.watchedFolders, path] };
      }),

    removeWatchedFolder: (path) =>
      set((state) => {
        if (!state.watchedFolders.includes(path)) return state;
        return { watchedFolders: state.watchedFolders.filter((f) => f !== path) };
      }),

    setExcludePatterns: (excludePatterns) =>
      set((state) =>
        state.excludePatterns === excludePatterns ? state : { excludePatterns }
      ),
    setMaxCacheSize: (maxCacheSize) =>
      set((state) => (state.maxCacheSize === maxCacheSize ? state : { maxCacheSize })),
    setAutoCleanupCache: (autoCleanupCache) =>
      set((state) =>
        state.autoCleanupCache === autoCleanupCache ? state : { autoCleanupCache }
      ),
    setWorkerThreads: (workerThreads) =>
      set((state) => (state.workerThreads === workerThreads ? state : { workerThreads })),
    setAutoScanOnStart: (autoScanOnStart) =>
      set((state) =>
        state.autoScanOnStart === autoScanOnStart ? state : { autoScanOnStart }
      ),
    setThemeColor: (themeColor) =>
      set((state) => (state.themeColor === themeColor ? state : { themeColor })),
    setTheme: (theme) => set((state) => (state.theme === theme ? state : { theme })),
    setWindowOpacity: (windowOpacity) =>
      set((state) => {
        const next = Math.max(0, Math.min(100, windowOpacity));
        return state.windowOpacity === next ? state : { windowOpacity: next };
      }),
    setWindowTransparency: (windowTransparency) =>
      set((state) => {
        const next = Math.max(0, Math.min(100, windowTransparency));
        return state.windowTransparency === next ? state : { windowTransparency: next };
      }),
    setBlurRadius: (blurRadius) =>
      set((state) => {
        const next = Math.max(0, Math.min(100, blurRadius));
        return state.blurRadius === next ? state : { blurRadius: next };
      }),
    setCustomBlurEnabled: (customBlurEnabled) =>
      set((state) => {
        const nextCompositionBlurEnabled = customBlurEnabled ? state.compositionBlurEnabled : false;
        if (
          state.customBlurEnabled === customBlurEnabled &&
          state.compositionBlurEnabled === nextCompositionBlurEnabled
        ) {
          return state;
        }
        return {
          customBlurEnabled,
          compositionBlurEnabled: nextCompositionBlurEnabled,
        };
      }),
    setCompositionBlurSupported: (compositionBlurSupported) =>
      set((state) =>
        state.compositionBlurSupported === compositionBlurSupported
          ? state
          : { compositionBlurSupported }
      ),
    setCompositionBlurEnabled: (compositionBlurEnabled) =>
      set((state) =>
        state.compositionBlurEnabled === compositionBlurEnabled
          ? state
          : { compositionBlurEnabled }
      ),
    setHighRefreshUi: (highRefreshUi) =>
      set((state) => (state.highRefreshUi === highRefreshUi ? state : { highRefreshUi })),

    resetToDefaults: () => set(defaultSettings),
  }),
  {
    name: 'photowall-settings',
  }
));
