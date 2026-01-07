/**
 * 主题管理 Hook - 简化版（固定浅色主题）
 */

import { create } from 'zustand';

interface ThemeState {
  /** 主题模式 */
  theme: 'light';
  /** 实际使用的主题 */
  resolvedTheme: 'light';
  /** 设置主题 */
  setTheme: (theme: string) => void;
}

/**
 * 移除深色主题类
 */
function applyLightTheme() {
  if (typeof window !== 'undefined') {
    document.documentElement.classList.remove('dark');
  }
}

// 立即应用浅色主题
applyLightTheme();

export const useTheme = create<ThemeState>()(() => ({
  theme: 'light',
  resolvedTheme: 'light',
  setTheme: () => {
    // 固定浅色主题
    applyLightTheme();
  },
}));
