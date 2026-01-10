/**
 * 空状态组件
 */

import { memo } from 'react';

export const EmptyState = memo(function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <svg
          className="mx-auto h-16 w-16 text-tertiary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-primary">
          暂无照片
        </h3>
        <p className="mt-2 text-sm text-secondary">
          添加文件夹开始管理您的照片
        </p>
      </div>
    </div>
  );
});
