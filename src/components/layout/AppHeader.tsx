import { NavLink } from 'react-router-dom';
import WindowControls from './WindowControls';
import clsx from 'clsx';

export default function AppHeader() {
    return (
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 pb-2 relative z-50 select-none">
            {/* 透明拖拽层 - 覆盖整个 Header 但避开按钮 */}
            <div className="absolute inset-0 z-0" data-tauri-drag-region />

            {/* 左侧 Logo - z-index 提升以允许交互或悬停 */}
            <div className="flex items-center gap-2 w-48 pointer-events-none z-10">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <span className="material-symbols-outlined text-white text-xl">photo_library</span>
                </div>
                <span className="font-bold text-lg tracking-tight text-white/90">PhotoWall</span>
            </div>

            {/* 中间导航 - 使用原生 Tauri 模糊，不使用 CSS backdrop-filter */}
            <nav className="flex items-center gap-1 bg-black/30 p-1 rounded-full border border-white/5 relative z-10 pointer-events-auto">
                <NavPill to="/" replace end label="照片" />
                <NavPill to="/folders" replace label="文件夹" />
                <NavPill to="/trash" replace label="废纸堆" />
                <NavPill to="/settings" replace label="设置" />
            </nav>

            {/* 右侧工具 & 窗口控制 - z-index 提升 */}
            <div className="flex items-center gap-4 w-48 justify-end relative z-10 pointer-events-auto">
                <button className="text-white/60 hover:text-white transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-[20px]">search</span>
                </button>
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-600 to-gray-400 border border-white/20"></div>

                <WindowControls />
            </div>
        </header>
    );
}

function NavPill({ to, label, end = false, replace = false }: { to: string; label: string; end?: boolean; replace?: boolean }) {
    return (
        <NavLink
            to={to}
            end={end}
            replace={replace}
            className={({ isActive }) =>
                clsx(
                    "px-6 py-1.5 rounded-full text-sm font-medium transition-all duration-300",
                    isActive
                        ? "bg-accent-bg text-white shadow-[0_0_15px_rgba(125,160,192,0.15)] border border-accent/30"
                        : "text-white/60 border border-transparent hover:text-white hover:bg-white/5"
                )
            }
        >
            {label}
        </NavLink>
    );
}
