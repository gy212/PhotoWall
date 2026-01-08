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
    <div className="flex items-center gap-1 ml-2 pl-3 border-l border-border/50">
      <button
        onClick={() => appWindow.minimize()}
        className="p-1.5 hover:bg-element rounded-md transition-colors text-secondary hover:text-primary flex items-center justify-center"
        title="最小化"
      >
        <Icon name="remove" className="text-base" />
      </button>
      <button
        onClick={() => appWindow.toggleMaximize()}
        className="p-1.5 hover:bg-element rounded-md transition-colors text-secondary hover:text-primary flex items-center justify-center"
        title="最大化/还原"
      >
        <Icon name="crop_square" className="text-sm" />
      </button>
      <button
        onClick={() => appWindow.close()}
        className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-md transition-colors text-secondary flex items-center justify-center"
        title="关闭"
      >
        <Icon name="close" className="text-base" />
      </button>
    </div>
  );
}
