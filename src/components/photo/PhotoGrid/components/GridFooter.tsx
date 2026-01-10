/**
 * Grid Footer 组件
 */

import { memo } from 'react';
import type { PhotoGridVirtuosoContext } from '../types';

export const GridFooter = memo(function GridFooter({ context }: { context?: PhotoGridVirtuosoContext }) {
  if (!context?.loading) {
    return null;
  }

  return (
    <div className="flex w-full items-center justify-center py-4">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      <span className="ml-2 text-sm text-secondary">加载中...</span>
    </div>
  );
});
