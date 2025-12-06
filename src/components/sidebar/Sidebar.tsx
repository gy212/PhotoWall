import { useNavigate, useLocation } from 'react-router-dom';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  iconFilled?: string;
  path?: string;
}

// 主要导航项 - 媒体库
const libraryItems: NavItem[] = [
  {
    id: 'photos',
    label: '所有照片',
    icon: 'photo_library',
    path: '/',
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
    icon: 'favorite',
    iconFilled: 'favorite',
    path: '/favorites',
  },
];

// 次要导航项
const secondaryItems: NavItem[] = [
  {
    id: 'folders',
    label: '文件夹',
    icon: 'folder',
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
 * 侧边栏组件 - 新UI设计
 */
function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

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
    return (
      <button
        key={item.id}
        onClick={() => handleNavigation(item)}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary-100 text-primary font-semibold'
            : 'text-on-surface-variant hover:bg-white/60 hover:text-on-surface'
        }`}
      >
        <span className={`material-symbols-outlined text-2xl ${isActive ? 'filled' : ''}`}>
          {isActive && item.iconFilled ? item.iconFilled : item.icon}
        </span>
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-full flex-col justify-between p-4">
      {/* 顶部导航 */}
      <div className="flex flex-col gap-6">
        {/* 应用Logo和标题 */}
        <div className="flex items-center gap-3 px-2 pt-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
            <span className="material-symbols-outlined text-xl">photo_library</span>
          </div>
          <h1 className="text-lg font-bold text-on-surface">PhotoWall</h1>
        </div>

        {/* 导航组 */}
        <nav className="flex flex-col gap-1">
          {/* Library 组 */}
          <div className="space-y-1">
            {libraryItems.map(renderNavItem)}
          </div>

          {/* 分隔线 */}
          <div className="my-2 border-t border-outline/30" />

          {/* Secondary 组 */}
          <div className="space-y-1">
            {secondaryItems.map(renderNavItem)}
          </div>
        </nav>
      </div>

      {/* 底部设置 */}
      <div className="space-y-1">
        <button
          onClick={() => navigate('/settings')}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            activeItem === 'settings'
              ? 'bg-primary-100 text-primary font-semibold'
              : 'text-on-surface-variant hover:bg-white/60 hover:text-on-surface'
          }`}
        >
          <span className={`material-symbols-outlined text-2xl ${activeItem === 'settings' ? 'filled' : ''}`}>
            settings
          </span>
          <span>设置</span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
