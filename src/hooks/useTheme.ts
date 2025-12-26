/**
 * 主题管理 Hook - 简化版（固定深色主题）
 */

import { create } from 'zustand';

interface ThemeState {
  /** 主题模式（固定为 dark） */
  theme: 'dark';
  /** 实际使用的主题 */
  resolvedTheme: 'dark';
  /** 设置主题（保留接口兼容性，但不做任何事） */
  setTheme: (theme: string) => void;
}

/**
 * 应用深色主题到 DOM
 */
function applyDarkTheme() {
  if (typeof window !== 'undefined') {
    document.documentElement.classList.add('dark');
  }
}

// 立即应用深色主题
applyDarkTheme();

export const useTheme = create<ThemeState>()(() => ({
  theme: 'dark',
  resolvedTheme: 'dark',
  setTheme: () => {
    // 固定深色主题，不做任何切换
    applyDarkTheme();
  },
}));
