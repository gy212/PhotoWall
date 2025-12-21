import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import Sidebar from '../sidebar/Sidebar';
import StatusBar from './StatusBar';

/**
 * 主布局组件 - 新UI设计
 */
function Layout() {
  const warmCacheTriggered = useRef(false);

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
        // 暖缓存失败不影响正常使用
        console.debug('[暖缓存] 失败:', err);
      }
    }, 2000); // 启动后 2 秒

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background p-1.5 gap-1.5 transition-colors duration-300">
      {/* 侧边栏 Island */}
      <aside className="flex h-full w-64 flex-shrink-0 flex-col rounded-xl bg-sidebar/50 shadow-sm backdrop-blur-2xl overflow-hidden transition-all duration-300">
        <Sidebar />
      </aside>

      {/* 主内容区 Island */}
      <main className="flex-1 flex flex-col h-full min-w-0 rounded-xl bg-surface shadow-sm overflow-hidden relative transition-all duration-300">
        {/* 主内容区域 */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <Outlet />
        </div>

        {/* 底部状态栏 */}
        <footer className="h-8 flex-shrink-0 px-4 flex items-center text-xs font-medium text-text-tertiary bg-surface/50 backdrop-blur-sm">
          <StatusBar />
        </footer>
      </main>
    </div>
  );
}

export default Layout;
