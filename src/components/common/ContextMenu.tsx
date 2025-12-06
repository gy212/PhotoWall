/**
 * 右键菜单组件
 * 
 * 支持照片的常用操作：打开所在文件夹、复制路径、收藏、删除等
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  /** 菜单项ID */
  id: string;
  /** 显示文本 */
  label: string;
  /** 图标 */
  icon?: React.ReactNode;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否显示分割线 */
  divider?: boolean;
  /** 危险操作（红色显示） */
  danger?: boolean;
  /** 点击回调 */
  onClick?: () => void;
}

interface ContextMenuProps {
  /** 是否显示 */
  visible: boolean;
  /** X 坐标 */
  x: number;
  /** Y 坐标 */
  y: number;
  /** 菜单项列表 */
  items: ContextMenuItem[];
  /** 关闭回调 */
  onClose: () => void;
}

function ContextMenu({ visible, x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // 延迟添加监听器，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('scroll', handleScroll, true);
      document.addEventListener('keydown', handleKeyDown);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, onClose]);

  // 调整位置防止溢出
  const adjustPosition = useCallback(() => {
    if (!menuRef.current) return { x, y };
    
    const rect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let adjustedX = x;
    let adjustedY = y;
    
    if (x + rect.width > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 8;
    }
    
    if (y + rect.height > viewportHeight) {
      adjustedY = viewportHeight - rect.height - 8;
    }
    
    return { x: adjustedX, y: adjustedY };
  }, [x, y]);

  if (!visible) return null;

  const position = adjustPosition();

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] py-1.5 bg-white rounded-xl shadow-lg border border-gray-100 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item, index) => (
        <div key={item.id}>
          {item.divider && index > 0 && (
            <div className="h-px bg-gray-100 my-1.5 mx-2" />
          )}
          <button
            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-3 transition-colors
              ${item.disabled 
                ? 'text-gray-300 cursor-not-allowed' 
                : item.danger 
                  ? 'text-red-600 hover:bg-red-50' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled && item.onClick) {
                item.onClick();
                onClose();
              }
            }}
          >
            {item.icon && (
              <span className="w-4 h-4 flex items-center justify-center">
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}

export default ContextMenu;
