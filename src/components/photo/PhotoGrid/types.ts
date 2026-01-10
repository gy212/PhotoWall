/**
 * PhotoGrid 类型定义
 */

import type { Photo, AspectRatioCategory } from '@/types';
import type { MouseEvent } from 'react';

export interface PhotoWithLayout extends Photo {
  aspectCategory: AspectRatioCategory;
  colSpan: number;
  rowSpan: number;
}

export interface GridRow {
  id: string;
  photos: PhotoWithLayout[];
}

export type PhotoGridVirtuosoContext = {
  loading: boolean;
};

export interface PhotoGridProps {
  photos: Photo[];
  thumbnailSize?: number;
  gap?: number;
  selectedIds?: Set<number>;
  loading?: boolean;
  hasMore?: boolean;
  onPhotoClick?: (photo: Photo, event: MouseEvent) => void;
  onPhotoDoubleClick?: (photo: Photo) => void;
  onPhotoContextMenu?: (photo: Photo, event: MouseEvent) => void;
  onPhotoSelect?: (photo: Photo, selected: boolean) => void;
  onLoadMore?: () => void;
  /** 是否按日期分组显示 */
  groupByDateEnabled?: boolean;
  /** 嵌入模式：禁用内部滚动，融入父容器滚动流 */
  embedded?: boolean;
}
