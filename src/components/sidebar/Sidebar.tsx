import { useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { usePhotoStore } from '@/stores/photoStore';

// === Modern SVG Icons (JetBrains Style) ===
// 采用线条风格，选中时加粗并变色，不再进行大面积填充
const icons = {
  photos: (active: boolean) => (
    <g stroke="currentColor" strokeWidth={active ? "2" : "1.5"} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </g>
  ),
  albums: (active: boolean) => (
    <g stroke="currentColor" strokeWidth={active ? "2" : "1.5"} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </g>
  ),
  favorites: (active: boolean) => (
    <path 
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" 
      stroke="currentColor" 
      strokeWidth={active ? "2" : "1.5"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      fill={active ? "currentColor" : "none"} // 收藏可以用实心，比较符合直觉，且心形面积小
      fillOpacity={active ? 0.2 : 0} // 选中时淡淡的填充，不是全实心
    />
  ),
  folders: (active: boolean) => (
    // 更圆润的文件夹，类似 macOS
    <path 
      d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z" 
      stroke="currentColor" 
      strokeWidth={active ? "2" : "1.5"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      fill="none" 
    />
  ),
  trash: (active: boolean) => (
    <g stroke="currentColor" strokeWidth={active ? "2" : "1.5"} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </g>
  ),
  settings: (active: boolean) => (
    <g stroke="currentColor" strokeWidth={active ? "2" : "1.5"} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </g>
  )
};

interface IconProps {
  name: keyof typeof icons;
  active: boolean;
  className?: string;
}

const Icon = ({ name, active, className }: IconProps) => {
  const iconRenderer = icons[name];
  if (!iconRenderer) return null;

  return (
    <svg 
      viewBox="0 0 24 24" 
      className={className} 
      width="24" 
      height="24"
    >
      {iconRenderer(active)}
    </svg>
  );
};

interface NavItem {
  id: string;
  label: string;
  iconName: keyof typeof icons;
  path?: string;
  count?: number; // Optional count for badge
}

// 主要导航项 - 媒体库
const libraryItems: NavItem[] = [
  {
    id: 'photos',
    label: '所有照片',
    iconName: 'photos',
    path: '/',
    count: 0, 
  },
  {
    id: 'albums',
    label: '相册',
    iconName: 'albums',
    path: '/albums',
  },
  {
    id: 'favorites',
    label: '收藏',
    iconName: 'favorites',
    path: '/favorites',
  },
];

// 次要导航项
const secondaryItems: NavItem[] = [
  {
    id: 'folders',
    label: '文件夹',
    iconName: 'folders',
    path: '/folders',
  },
  {
    id: 'trash',
    label: '回收站',
    iconName: 'trash',
    path: '/trash',
  },
];

/**
 * 侧边栏组件 - Nucleo ���格
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
          "group flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-all duration-200 ease-out outline-none select-none",
          isActive
            ? "bg-white shadow-sm ring-1 ring-black/5 text-primary dark:bg-primary/15 dark:text-primary dark:ring-0"
            : "text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-[#9da0a5] dark:hover:bg-[#393b40] dark:hover:text-[#dfe1e5]"
        )}
      >
        <div className="flex items-center gap-3">
          <Icon 
            name={item.iconName} 
            active={isActive} 
            className={clsx(
              "w-[18px] h-[18px] transition-transform duration-200", // 稍微调小一点图标，显得更精致
              isActive ? "text-primary dark:text-[#3574f0]" : "text-zinc-400 group-hover:text-zinc-600 dark:text-[#6f737a] dark:group-hover:text-[#dfe1e5]"
            )}
          />
          <span>{item.label}</span>
        </div>
        
        {/* Count Badge */}
        {displayCount !== undefined && displayCount > 0 && (
          <span className={clsx(
            "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
             isActive ? "text-primary bg-primary/10 dark:text-[#3574f0] dark:bg-[#3574f0]/20" : "text-zinc-400 bg-zinc-100 dark:bg-[#393b40] dark:text-[#6f737a] group-hover:bg-white/50 dark:group-hover:bg-[#45474d]"
          )}>
            {displayCount > 999 ? '999+' : displayCount}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex h-full flex-col justify-between px-2 py-3 bg-transparent">
      {/* 顶部导航 */}
      <div className="flex flex-col gap-5">
        
        {/* 导航组 */}
        <nav className="flex flex-col gap-0.5">
          {/* Library 组 */}
          <div className="px-3 mb-1.5 mt-1 text-[11px] font-bold text-zinc-400/80 dark:text-[#6f737a] uppercase tracking-widest">媒体库</div>
          {libraryItems.map(renderNavItem)}

          <div className="h-3"></div>

          {/* Secondary 组 */}
          <div className="px-3 mb-1.5 text-[11px] font-bold text-zinc-400/80 dark:text-[#6f737a] uppercase tracking-widest">文件管理</div>
          {secondaryItems.map(renderNavItem)}
        </nav>
      </div>

      {/* 底部设置 */}
      <div className="space-y-1 pb-1">
        <button
          onClick={() => navigate('/settings')}
          className={clsx(
            "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-all duration-200 ease-out outline-none select-none",
            activeItem === 'settings'
              ? "bg-white shadow-sm ring-1 ring-black/5 text-primary dark:bg-primary/15 dark:text-primary dark:ring-0"
              : "text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-[#9da0a5] dark:hover:bg-[#393b40] dark:hover:text-[#dfe1e5]"
          )}
        >
          <Icon 
            name="settings" 
            active={activeItem === 'settings'}
            className={clsx(
              "w-[18px] h-[18px] transition-transform duration-200",
              activeItem === 'settings' ? "text-primary dark:text-[#3574f0]" : "text-zinc-400 group-hover:text-zinc-600 dark:text-[#6f737a] dark:group-hover:text-[#dfe1e5] group-hover:rotate-45"
            )} 
          />
          <span>设置</span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;