import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * 自定义窗口控制按钮 (最小化/最大化/关闭)
 */
export default function WindowControls() {
    const appWindow = getCurrentWindow();

    return (
        <div className="flex items-center gap-2 ml-2 pl-4 border-l border-white/10">
            <button
                onClick={() => appWindow.minimize()}
                className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white/70 flex items-center justify-center"
                title="最小化"
            >
                <span className="material-symbols-outlined text-[16px]">remove</span>
            </button>
            <button
                onClick={() => appWindow.toggleMaximize()}
                className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white/70 flex items-center justify-center"
                title="最大化/还原"
            >
                <span className="material-symbols-outlined text-[16px]">check_box_outline_blank</span>
            </button>
            <button
                onClick={() => appWindow.close()}
                className="p-1.5 hover:bg-red-500/80 hover:text-white rounded-md transition-colors text-white/70 flex items-center justify-center"
                title="关闭"
            >
                <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
        </div>
    );
}
