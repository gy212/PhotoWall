import { useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'framer-motion';
import AppHeader from './AppHeader';
import BlurredBackground from './BlurredBackground';
import { useSettingsStore } from '@/stores/settingsStore';
import { useShallow } from 'zustand/shallow';

// 页面顺序，用于判断滑动方向
const PAGE_ORDER = ['/', '/albums', '/tags', '/folders', '/favorites', '/trash', '/settings'];

// 计算方向的函数
function getDirection(from: string, to: string): number {
  const fromIndex = PAGE_ORDER.indexOf(from);
  const toIndex = PAGE_ORDER.indexOf(to);
  // 如果是未知页面，默认向右滑动 (1)
  if (fromIndex === -1 || toIndex === -1) return 1;
  return toIndex > fromIndex ? 1 : -1;
}

// 页面切换动画 variants - 移除透明度变化，实现类似手机桌面的平移效果
const pageVariants = {
  enter: (dir: number) => ({ x: dir * 100 + '%' }),
  center: { x: 0 },
  exit: (dir: number) => ({ x: dir * -100 + '%' }),
};

/**
 * 主布局组件 - 深色玻璃风格
 */
function Layout() {
  const location = useLocation();
  const warmCacheTriggered = useRef(false);
  const applyWindowAppearanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tauri = isTauri();

  // 记录上一个路径和当前方向
  const prevPathRef = useRef(location.pathname);
  const directionRef = useRef(1);

  // 同步计算方向（在渲染时立即计算，不是异步）
  if (prevPathRef.current !== location.pathname) {
    directionRef.current = getDirection(prevPathRef.current, location.pathname);
    prevPathRef.current = location.pathname;
  }

  // 启动时处理 Splash Screen
  useEffect(() => {
    /* disabled: splash handled by backend
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
    */
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
  const { windowOpacity, windowTransparency, blurRadius, customBlurEnabled } = useSettingsStore(
    useShallow((state) => ({
      windowOpacity: state.windowOpacity,
      windowTransparency: state.windowTransparency,
      blurRadius: state.blurRadius,
      customBlurEnabled: state.customBlurEnabled,
    }))
  );

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
          <AnimatePresence initial={false} custom={directionRef.current}>
            <motion.div
              key={location.pathname}
              custom={directionRef.current}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="h-full w-full absolute inset-0 bg-background"
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
