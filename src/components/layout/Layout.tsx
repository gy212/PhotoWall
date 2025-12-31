import { useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { invoke, isTauri } from '@tauri-apps/api/core';
import AppHeader from './AppHeader';
import BlurredBackground from './BlurredBackground';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * 主布局组件 - 深色玻璃风格
 */
function Layout() {
  const warmCacheTriggered = useRef(false);
  const applyWindowAppearanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tauri = isTauri();

  // 启动后延迟触发暖缓存
  useEffect(() => {
    if (warmCacheTriggered.current) return;
    warmCacheTriggered.current = true;

    const timer = setTimeout(async () => {
      try {
        const result = await invoke<{ queued: number; alreadyCached: number }>('warm_thumbnail_cache', {
          strategy: 'recent',
          limit: 100,
        });
        if (result.queued > 0) {
          console.debug(`[暖缓存] 已入队 ${result.queued} 个任务，${result.alreadyCached} 个已有缓存`);
        }
      } catch (err) {
        console.debug('[暖缓存] 失败:', err);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // 从 Store 获取外观设置
  const { windowOpacity, windowTransparency, blurRadius, customBlurEnabled } = useSettingsStore();

  // 同步玻璃拟态 CSS 变量（影响 glass-panel / native-glass-panel 等）
  useLayoutEffect(() => {
    const clampedTransparency = Math.max(0, Math.min(100, windowTransparency));
    const clampedBlurRadius = Math.max(0, Math.min(100, blurRadius));

    document.documentElement.style.setProperty(
      '--glass-opacity',
      (clampedTransparency / 100).toString()
    );
    document.documentElement.style.setProperty('--glass-blur', `${clampedBlurRadius}px`);

    return () => {
      document.documentElement.style.removeProperty('--glass-opacity');
      document.documentElement.style.removeProperty('--glass-blur');
    };
  }, [windowTransparency, blurRadius]);

  // 将外观设置同步到原生窗口效果（Tauri 桌面端）
  useEffect(() => {
    if (!tauri) return;

    if (applyWindowAppearanceTimer.current) {
      clearTimeout(applyWindowAppearanceTimer.current);
    }

    applyWindowAppearanceTimer.current = setTimeout(() => {
      void invoke('apply_window_settings', {
        settings: {
          opacity: windowOpacity,
          transparency: windowTransparency,
          blurRadius: blurRadius,
          customBlurEnabled: customBlurEnabled,
        },
      }).catch((err) => {
        console.debug('[window] apply_window_settings failed:', err);
      });
    }, 80);

    return () => {
      if (applyWindowAppearanceTimer.current) {
        clearTimeout(applyWindowAppearanceTimer.current);
        applyWindowAppearanceTimer.current = null;
      }
    };
  }, [tauri, windowOpacity, windowTransparency, blurRadius, customBlurEnabled]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden native-glass-panel text-white/90 font-sans relative z-0">
      <BlurredBackground enabled={customBlurEnabled} />
      <AppHeader />
      <main className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default Layout;
