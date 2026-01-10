/**
 * 网格布局 Hook
 */

import { useMemo } from 'react';
import type { Photo } from '@/types';
import { getAspectRatioCategory } from '@/types';
import type { GridRow, PhotoWithLayout } from '../types';

export function useGridLayout(photos: Photo[], columns: number) {
  const rows = useMemo<GridRow[]>(() => {
    const result: GridRow[] = [];
    let currentRow: PhotoWithLayout[] = [];
    let currentColCount = 0;
    const flushRow = () => {
      if (currentRow.length === 0) return;
      result.push({
        id: currentRow.map(p => p.photoId).join('-'),
        photos: currentRow,
      });
      currentRow = [];
      currentColCount = 0;
    };

    for (const photo of photos) {
      const aspectCategory = getAspectRatioCategory(photo.width, photo.height);
      const colSpan = aspectCategory === 'wide' ? Math.min(2, columns) : 1;
      const rowSpan = aspectCategory === 'tall' ? 2 : 1;

      const photoWithLayout: PhotoWithLayout = {
        ...photo,
        aspectCategory,
        colSpan,
        rowSpan,
      };

      // 如果当前行放不下，先保存当前行
      if (currentColCount + colSpan > columns && currentRow.length > 0) {
        flushRow();
      }

      currentRow.push(photoWithLayout);
      currentColCount += colSpan;

      // 行满了
      if (currentColCount >= columns) {
        flushRow();
      }
    }

    // 最后一行
    flushRow();

    return result;
  }, [photos, columns]);

  return { rows };
}
