import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useShallow } from 'zustand/shallow';

/**
 * 将 Hex 颜色转换为 RGB 对象
 */
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

/**
 * 调整颜色亮度
 * @param hex Hex 颜色代码
 * @param percent 调整百分比 (-100 到 100)
 */
const adjustBrightness = (hex: string, percent: number) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, rgb.r + amt));
  const G = Math.min(255, Math.max(0, rgb.g + amt));
  const B = Math.min(255, Math.max(0, rgb.b + amt));

  return `#${(
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  )
    .toString(16)
    .slice(1)}`;
};

/**
 * 主题管理 Hook
 * 监听 store 中的 themeColor 和 theme 变化，应用到 CSS 变量和 class
 */
export function useThemeColor() {
  const { themeColor, theme } = useSettingsStore(
    useShallow((state) => ({
      themeColor: state.themeColor,
      theme: state.theme,
    }))
  );

  // 应用主题色
  useEffect(() => {
    if (!themeColor) return;

    const root = document.documentElement;

    // 生成变体颜色
    const primary = themeColor;
    const primaryLight = adjustBrightness(themeColor, 20); // 变亮 20%
    const primaryDark = adjustBrightness(themeColor, -15); // 变暗 15%

    // 设置 CSS 变量
    root.style.setProperty('--primary', primary);
    root.style.setProperty('--primary-light', primaryLight);
    root.style.setProperty('--primary-dark', primaryDark);
  }, [themeColor]);

  // 应用主题模式 (Light/Dark)
  useEffect(() => {
    const root = document.documentElement;

    const applyThemeMode = () => {
      const isDark =
        theme === 'dark' ||
        (theme === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);

      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyThemeMode();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyThemeMode();
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);
}
