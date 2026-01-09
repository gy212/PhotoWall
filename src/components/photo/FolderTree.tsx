/**
 * 文件夹树组件
 *
 * 显示文件夹层级结构，支持懒加载和照片数量统计
 */

import { useState, useCallback, memo } from 'react';
import clsx from 'clsx';

export interface FolderNode {
  /** 文件夹路径 */
  path: string;
  /** 文件夹名称 */
  name: string;
  /** 照片数量 */
  photoCount: number;
  /** 子文件夹 */
  children?: FolderNode[];
  /** 是否已加载子文件夹 */
  loaded?: boolean;
  /** 是否展开 */
  expanded?: boolean;
}

interface FolderTreeProps {
  /** 根文件夹列表 */
  folders: FolderNode[];
  /** 当前选中的文件夹路径 */
  selectedPath?: string | null;
  /** 文件夹点击事件 */
  onFolderClick?: (folder: FolderNode) => void;
  /** 加载子文件夹事件（懒加载） */
  onLoadChildren?: (folder: FolderNode) => Promise<FolderNode[]>;
}

/**
 * 文件夹树组件
 */
const FolderTree = memo(function FolderTree({
  folders,
  selectedPath,
  onFolderClick,
  onLoadChildren,
}: FolderTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

  // 切换展开/折叠
  const toggleExpand = useCallback(
    async (folder: FolderNode, e: React.MouseEvent) => {
      e.stopPropagation();

      const path = folder.path;
      const isExpanded = expandedPaths.has(path);

      if (isExpanded) {
        // 折叠
        const newExpanded = new Set(expandedPaths);
        newExpanded.delete(path);
        setExpandedPaths(newExpanded);
      } else {
        // 展开
        const newExpanded = new Set(expandedPaths);
        newExpanded.add(path);
        setExpandedPaths(newExpanded);

        // 如果未加载子文件夹，触发加载
        if (!folder.loaded && onLoadChildren) {
          setLoadingPaths((prev) => new Set(prev).add(path));
          try {
            const children = await onLoadChildren(folder);
            folder.children = children;
            folder.loaded = true;
          } catch (error) {
            console.error('Failed to load children:', error);
          } finally {
            setLoadingPaths((prev) => {
              const newLoading = new Set(prev);
              newLoading.delete(path);
              return newLoading;
            });
          }
        }
      }
    },
    [expandedPaths, onLoadChildren]
  );

  // 渲染单个文件夹节点
  const renderFolder = useCallback(
    (folder: FolderNode, level = 0) => {
      const isExpanded = expandedPaths.has(folder.path);
      const isSelected = selectedPath === folder.path;
      const isLoading = loadingPaths.has(folder.path);
      const hasChildren = (folder.children && folder.children.length > 0) || !folder.loaded;

      return (
        <div key={folder.path}>
          {/* 文件夹项 */}
          <button
            onClick={() => onFolderClick?.(folder)}
            className={clsx(
              'group flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
              isSelected
                ? 'bg-element text-primary shadow-sm'
                : 'hover:bg-element text-secondary hover:text-primary'
            )}
            style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}
          >
            {/* 展开/折叠按钮 */}
            {hasChildren && (
              <span
                onClick={(e) => toggleExpand(folder, e)}
                className={clsx(
                  'mr-2 flex h-5 w-5 items-center justify-center rounded transition-transform',
                  isExpanded && 'rotate-90'
                )}
              >
                {isLoading ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </span>
            )}

            {/* 文件夹图标 */}
            <svg
              className={clsx('mr-2 h-5 w-5', isExpanded ? 'text-primary' : 'text-tertiary group-hover:text-primary')}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={isExpanded
                  ? "M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                  : "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"}
              />
            </svg>

            {/* 文件夹名称 */}
            <span className="flex-1 truncate text-left">{folder.name}</span>

            {/* 照片数量 */}
            {folder.photoCount > 0 && (
              <span
                className={clsx(
                  'ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold',
                  isSelected
                    ? 'bg-surface text-primary'
                    : 'bg-surface text-tertiary border border-border'
                )}
              >
                {folder.photoCount}
              </span>
            )}
          </button>

          {/* 子文件夹 */}
          {isExpanded && folder.children && folder.children.length > 0 && (
            <div className="mt-1">
              {folder.children.map((child) => renderFolder(child, level + 1))}
            </div>
          )}
        </div>
      );
    },
    [expandedPaths, selectedPath, loadingPaths, onFolderClick, toggleExpand]
  );

  // 空状态
  if (folders.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-tertiary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <p className="mt-2 text-sm text-secondary">
            暂无文件夹
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto p-2">
      <div className="space-y-1">
        {folders.map((folder) => renderFolder(folder))}
      </div>
    </div>
  );
});

export default FolderTree;
