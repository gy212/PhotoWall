import { useRef, useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import WindowControls from './WindowControls';
import { Icon, IconName } from '@/components/common/Icon';
import clsx from 'clsx';

export default function AppHeader() {
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, opacity: 0 });
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
    <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 pb-2 relative z-50 select-none">
      {/* 透明拖拽层 - 覆盖整个 Header 但避开按钮 */}
      <div className="absolute inset-0 z-0" data-tauri-drag-region />

      {/* 左侧 Logo - z-index 提升以允许交互或悬停 */}
      <div className="flex items-center gap-3 w-56 pointer-events-none z-10">
        <div className="w-10 h-10 bg-gradient-to-br from-[#C15F3C] to-[#D57A5A] rounded-2xl flex items-center justify-center shadow-lg shadow-orange-900/20">
          <Icon name="photo_library" className="text-white text-2xl" />
        </div>
        <span className="font-bold text-2xl tracking-tight text-primary font-serif">PhotoWall</span>
      </div>

      {/* 中间导航 - 实体胶囊 */}
      <nav
        ref={navRef}
        className="flex items-center gap-1 bg-surface p-1 rounded-full border border-border shadow-sm relative z-10 pointer-events-auto"
      >
        {/* 滑动背景块 */}
        <div
          className="absolute top-1 bottom-1 bg-primary rounded-full shadow-md transition-all duration-300 ease-out z-0"
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
                'relative z-10 px-6 py-1.5 rounded-full text-sm font-medium transition-colors duration-200 flex items-center gap-2',
                isActive
                  ? 'text-white'
                  : 'text-secondary hover:text-primary hover:bg-hover'
              )
            }
          >
            <Icon name={item.icon} className="text-lg" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* 右侧工具 & 窗口控制 - z-index 提升 */}
      <div className="flex items-center gap-4 w-48 justify-end relative z-10 pointer-events-auto">
        <button className="text-secondary hover:text-primary transition-colors cursor-pointer">
          <Icon name="search" className="text-[20px]" />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-300 to-gray-100 border border-border"></div>

        <WindowControls />
      </div>
    </header>
  );
}
