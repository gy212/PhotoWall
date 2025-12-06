/**
 * 主题管理 Hook
 *
 * 提供主题状态和切换功能
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode } from '@/types';

interface ThemeState {
  /** 主题模式 */
  theme: ThemeMode;
  /** 实际使用的主题（解析后的） */
  resolvedTheme: 'light' | 'dark';
  /** 设置主题 */
  setTheme: (theme: ThemeMode) => void;
}

/**
 * 获取系统主题
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * 解析主题（将 'system' 解析为实际主题）
 */
function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
}

/**
 * 应用主题到 DOM
 */
function applyTheme(theme: 'light' | 'dark') {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => {
      // 监听系统主题变化
      if (typeof window !== 'undefined') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', () => {
          const { theme } = get();
          if (theme === 'system') {
            const resolvedTheme = getSystemTheme();
            set({ resolvedTheme });
            applyTheme(resolvedTheme);
          }
        });
      }

      const initialTheme: ThemeMode = 'system';
      const resolvedTheme = resolveTheme(initialTheme);

      // 初始化时应用主题
      if (typeof window !== 'undefined') {
        applyTheme(resolvedTheme);
      }

      return {
        theme: initialTheme,
        resolvedTheme,
        setTheme: (theme: ThemeMode) => {
          const resolved = resolveTheme(theme);
          set({ theme, resolvedTheme: resolved });
          applyTheme(resolved);
        },
      };
    },
    {
      name: 'theme-storage',
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        // persist 恢复后，重新计算 resolvedTheme 并应用主题
        if (state && typeof window !== 'undefined') {
          const resolved = resolveTheme(state.theme);
          state.resolvedTheme = resolved;
          applyTheme(resolved);
        }
      },
    }
  )
);
