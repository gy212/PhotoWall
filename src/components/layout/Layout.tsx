import { Outlet } from 'react-router-dom';
import Sidebar from '../sidebar/Sidebar';
import StatusBar from './StatusBar';

/**
 * 主布局组件 - 新UI设计
 */
function Layout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* 侧边栏 */}
      <aside className="flex h-full w-64 flex-shrink-0 flex-col border-r border-outline/60 bg-sidebar/80 backdrop-blur-xl">
        <Sidebar />
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* 主内容区域 */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Outlet />
        </div>

        {/* 底部状态栏 */}
        <footer className="h-8 flex-shrink-0 px-6 flex items-center text-xs font-medium text-text-tertiary border-t border-outline/30">
          <StatusBar />
        </footer>
      </main>
    </div>
  );
}

export default Layout;
