import { useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { usePhotoStore } from '@/stores/photoStore';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  iconFilled?: string;
  path?: string;
  count?: number; // Optional count for badge
}

// 主要导航项 - 媒体库
const libraryItems: NavItem[] = [
  {
    id: 'photos',
    label: '所有照片',
    icon: 'grid_view', // Nucleo uses grid icon for "All"
    path: '/',
    count: 0, // Will be replaced by dynamic store value
  },
  {
    id: 'albums',
    label: '相册',
    icon: 'photo_album',
    path: '/albums',
  },
  {
    id: 'favorites',
    label: '收藏',
    icon: 'star', // Star icon often used for favorites
    iconFilled: 'star',
    path: '/favorites',
  },
];

// 次要导航项
const secondaryItems: NavItem[] = [
  {
    id: 'folders',
    label: '文件夹',
    icon: 'folder_open',
    path: '/folders',
  },
  {
    id: 'trash',
    label: '回收站',
    icon: 'delete',
    path: '/trash',
  },
];

/**
 * 侧边栏组件 - Nucleo 风格
 */
function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const totalCount = usePhotoStore(state => state.totalCount);

  const getActiveItem = () => {
    const path = location.pathname;
    if (path === '/albums') return 'albums';
    if (path === '/tags') return 'tags';
    if (path === '/folders') return 'folders';
    if (path === '/favorites') return 'favorites';
    if (path === '/trash') return 'trash';
    if (path === '/settings') return 'settings';
    return 'photos';
  };

  const activeItem = getActiveItem();

  const handleNavigation = (item: NavItem) => {
    if (item.path) {
      navigate(item.path);
    }
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = activeItem === item.id;
    // Inject dynamic count for 'photos'
    const displayCount = item.id === 'photos' ? totalCount : item.count;

    return (
      <button
        key={item.id}
        onClick={() => handleNavigation(item)}
        className={clsx(
          "group flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-all duration-200 ease-out outline-none",
          isActive
            ? "bg-zinc-900 text-white shadow-md shadow-zinc-900/10 dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-white/5" // 黑色选中态
            : "text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
        )}
      >
        <div className="flex items-center gap-3">
          <span 
            className={clsx(
              "material-symbols-outlined text-[20px] transition-transform duration-200",
              isActive ? "scale-100" : "group-hover:scale-105"
            )}
          >
            {isActive && item.iconFilled ? item.iconFilled : item.icon}
          </span>
          <span>{item.label}</span>
        </div>
        
        {/* Count Badge */}
        {displayCount !== undefined && displayCount > 0 && (
          <span className={clsx(
            "text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
             isActive ? "text-zinc-300 bg-white/10 dark:text-zinc-600 dark:bg-black/10" : "text-zinc-400 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-800"
          )}>
            {displayCount > 999 ? '999+' : displayCount}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex h-full flex-col justify-between px-3 py-4 bg-[#f8f9fa] dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800">
      {/* 顶部导航 */}
      <div className="flex flex-col gap-6">
        
        {/* 导航组 */}
        <nav className="flex flex-col gap-6">
          {/* Library 组 */}
          <div className="space-y-1">
            <div className="px-3 mb-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">库</div>
            {libraryItems.map(renderNavItem)}
          </div>

          {/* Secondary 组 */}
          <div className="space-y-1">
            <div className="px-3 mb-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">文件</div>
            {secondaryItems.map(renderNavItem)}
          </div>
        </nav>
      </div>

      {/* 底部设置 */}
      <div className="space-y-1 pb-2">
        <button
          onClick={() => navigate('/settings')}
          className={clsx(
            "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-all duration-200 ease-out outline-none",
            activeItem === 'settings'
              ? "bg-zinc-900 text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          )}
        >
          <span 
            className={clsx(
              "material-symbols-outlined text-[20px] transition-transform duration-200",
              activeItem === 'settings' ? "filled" : "group-hover:rotate-45"
            )}
          >
            settings
          </span>
          <span>设置</span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;