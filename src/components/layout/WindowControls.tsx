import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from '@tauri-apps/api/core';
import { Icon } from '@/components/common/Icon';

/**
 * 自定义窗口控制按钮 (最小化/最大化/关闭)
 */
export default function WindowControls() {
  if (!isTauri()) return null;

  const appWindow = getCurrentWindow();

  return (
    <div className="flex items-center gap-2 ml-2 pl-4 border-l border-white/10">
      <button
        onClick={() => appWindow.minimize()}
        className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white/70 flex items-center justify-center"
        title="最小化"
      >
        <Icon name="remove" className="text-[16px]" />
      </button>
      <button
        onClick={() => appWindow.toggleMaximize()}
        className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white/70 flex items-center justify-center"
        title="最大化/还原"
      >
        <Icon name="check_box_outline_blank" className="text-[16px]" />
      </button>
      <button
        onClick={() => appWindow.close()}
        className="p-1.5 hover:bg-red-500/80 hover:text-white rounded-md transition-colors text-white/70 flex items-center justify-center"
        title="关闭"
      >
        <Icon name="close" className="text-[16px]" />
      </button>
    </div>
  );
}
