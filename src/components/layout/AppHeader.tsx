import { useRef, useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import WindowControls from './WindowControls';
import { Icon, IconName } from '@/components/common/Icon';
import { SearchPanel } from '@/components/search';
import clsx from 'clsx';

export default function AppHeader() {
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const [showSearch, setShowSearch] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const itemsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const location = useLocation();

  const navItems: { to: string; label: string; icon: IconName; end?: boolean }[] = [
    { to: '/', label: '照片', icon: 'grid_view', end: true },
    { to: '/folders', label: '文件夹', icon: 'folder' },
    { to: '/trash', label: '废纸篓', icon: 'delete' },
    { to: '/settings', label: '设置', icon: 'settings' },
  ];

  useEffect(() => {
    const activeIndex = navItems.findIndex(item =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
    );

    if (activeIndex !== -1 && itemsRef.current[activeIndex] && navRef.current) {
      const activeEl = itemsRef.current[activeIndex];
      const navRect = navRef.current.getBoundingClientRect();
      const itemRect = activeEl.getBoundingClientRect();

      setPillStyle({
        left: itemRect.left - navRect.left,
        width: itemRect.width,
        opacity: 1
      });
    }
  }, [location.pathname]);

  return (
    <header className="h-14 flex-shrink-0 flex items-center justify-between px-6 relative z-50 select-none">
      {/* 透明拖拽层 - 覆盖整个 Header 但避开按钮 */}
      <div className="absolute inset-0 z-0" data-tauri-drag-region />

      {/* 左侧 Logo */}
      <div className="flex items-center gap-2.5 w-48 pointer-events-none z-10">
        <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 ring-1 ring-white/10">
          <Icon name="photo_library" className="text-white text-xl" />
        </div>
        <span className="font-bold text-xl tracking-tight text-primary font-serif">PhotoWall</span>
      </div>

      {/* 中间导航 - Claude/Cursor 风格胶囊 */}
      <nav
        ref={navRef}
        className="flex items-center gap-0.5 bg-element p-1 rounded-full relative z-10 pointer-events-auto border border-border/50"
      >
        {/* 滑动背景块 */}
        <div
          className="absolute top-1 bottom-1 bg-surface rounded-full shadow-sm border border-border/50 transition-all duration-200 ease-out z-0"
          style={{
            left: pillStyle.left,
            width: pillStyle.width,
            opacity: pillStyle.opacity
          }}
        />

        {navItems.map((item, index) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            ref={(el) => {
              itemsRef.current[index] = el;
            }}
            className={({ isActive }) =>
              clsx(
                'relative z-10 px-5 py-1.5 rounded-full text-sm font-semibold transition-colors duration-150 flex items-center gap-2',
                isActive
                  ? 'text-primary'
                  : 'text-secondary hover:text-primary'
              )
            }
          >
            <Icon name={item.icon} className="text-lg" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* 右侧工具 & 窗口控制 */}
      <div className="flex items-center gap-3 w-48 justify-end relative z-10 pointer-events-auto">
        <button
          onClick={() => setShowSearch(true)}
          className="p-2 text-secondary hover:text-primary hover:bg-element rounded-xl transition-all cursor-pointer"
          title="搜索 (Ctrl+K)"
        >
          <Icon name="search" className="text-xl" />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary/20 to-primary/5 border border-border shadow-inner" />

        <WindowControls />
      </div>

      {/* 搜索面板 */}
      <SearchPanel open={showSearch} onClose={() => setShowSearch(false)} />
    </header>
  );
}
