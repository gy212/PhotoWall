/**
 * 单行渲染组件
 */

import { memo } from 'react';
import type { MouseEvent } from 'react';
import PhotoThumbnail from '../../PhotoThumbnail';
import type { GridRow as GridRowType } from '../types';
import type { Photo } from '@/types';

interface GridRowProps {
  row: GridRowType;
  columns: number;
  gap: number;
  thumbnailSize: number;
  selectedIds: Set<number>;
  isScrolling: boolean;
  onPhotoClick?: (photo: Photo, event: MouseEvent) => void;
  onPhotoDoubleClick?: (photo: Photo) => void;
  onPhotoContextMenu?: (photo: Photo, event: MouseEvent) => void;
  onPhotoSelect?: (photo: Photo, selected: boolean) => void;
}

export const GridRow = memo(function GridRow({
  row,
  columns,
  gap,
  thumbnailSize,
  selectedIds,
  isScrolling,
  onPhotoClick,
  onPhotoDoubleClick,
  onPhotoContextMenu,
  onPhotoSelect,
}: GridRowProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridAutoRows: `${thumbnailSize}px`,
        gap: `${gap}px`,
        padding: `0 ${gap}px`,
        marginBottom: `${gap}px`,
        alignItems: 'start',
      }}
    >
      {row.photos.map((photo) => (
        <div
          key={photo.photoId}
          style={{
            gridColumn: photo.colSpan > 1 ? `span ${photo.colSpan}` : undefined,
            gridRow: photo.rowSpan > 1 ? `span ${photo.rowSpan}` : undefined,
          }}
        >
          <PhotoThumbnail
            photo={photo}
            aspectCategory={photo.aspectCategory}
            selected={selectedIds.has(photo.photoId)}
            isScrolling={isScrolling}
            onClick={onPhotoClick}
            onDoubleClick={onPhotoDoubleClick}
            onContextMenu={onPhotoContextMenu}
            onSelect={onPhotoSelect}
          />
        </div>
      ))}
    </div>
  );
});
