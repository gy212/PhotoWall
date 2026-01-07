import { useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getAllWindows, getCurrentWindow } from '@tauri-apps/api/window';
import { AnimatePresence, motion } from 'framer-motion';
import AppHeader from './AppHeader';
import BlurredBackground from './BlurredBackground';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * 主布局组件 - 深色玻璃风格
 */
function Layout() {
  const location = useLocation(); // 获取当前路径用于动画 key
  const warmCacheTriggered = useRef(false);
  const splashClosed = useRef(false);
  const applyWindowAppearanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tauri = isTauri();

  // 启动时处理 Splash Screen
  useEffect(() => {
    if (!tauri || splashClosed.current) return;

    const initApp = async () => {
      // 模拟或者等待初始化 (例如等待 1.5 秒让 Logo 动画展示完)
      await new Promise(resolve => setTimeout(resolve, 1500));

      try {
        const windows = await getAllWindows();
        const splashWin = windows.find(w => w.label === 'splash');
        const mainWin = getCurrentWindow();

        if (splashWin) {
          // 显示主窗口
          await mainWin.show();
          await mainWin.setFocus();
          // 关闭 Splash
          await splashWin.close();
        } else {
          // 如果找不到 splash (开发模式可能)，确保主窗口显示
          await mainWin.show();
        }
        splashClosed.current = true;
      } catch (e) {
        console.error('Failed to close splash screen', e);
        // Fallback: ensure main window is visible
        getCurrentWindow().show();
      }
    };

    initApp();
  }, [tauri]);

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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-primary font-sans relative z-0">
      <BlurredBackground enabled={customBlurEnabled} />
      <AppHeader />
      <main className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="h-full w-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default Layout;
