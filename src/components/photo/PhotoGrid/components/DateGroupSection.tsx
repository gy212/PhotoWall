/**
 * 日期分组区块组件
 */

import { memo } from 'react';
import type { MouseEvent } from 'react';
import PhotoThumbnail from '../../PhotoThumbnail';
import type { DateGroup } from '@/utils/dateGrouping';
import type { Photo } from '@/types';
import { getAspectRatioCategory } from '@/types';

interface DateGroupSectionProps {
  group: DateGroup<Photo>;
  columns: number;
  gap: number;
  thumbnailSize: number;
  selectedIds: Set<number>;
  isActive: boolean;
  onRegisterElement: (date: string, el: HTMLElement | null) => void;
  onPhotoClick?: (photo: Photo, event: MouseEvent) => void;
  onPhotoDoubleClick?: (photo: Photo) => void;
  onPhotoContextMenu?: (photo: Photo, event: MouseEvent) => void;
  onPhotoSelect?: (photo: Photo, selected: boolean) => void;
}

export const DateGroupSection = memo(function DateGroupSection({
  group,
  columns,
  gap,
  thumbnailSize,
  selectedIds,
  isActive,
  onRegisterElement,
  onPhotoClick,
  onPhotoDoubleClick,
  onPhotoContextMenu,
  onPhotoSelect,
}: DateGroupSectionProps) {
  return (
    <div
      className="mb-8"
      data-group-date={group.date}
      ref={(el) => onRegisterElement(group.date, el)}
    >
      {/* 日期分组 Header - Solid Background */}
      <div className="sticky top-0 z-20 mb-4 px-4 py-3 bg-surface border-b border-border">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-3">
            <h3 className="text-2xl font-bold tracking-tight text-primary font-serif">
              {group.displayDate}
            </h3>
            <span className="text-sm font-medium text-secondary">
              {group.items.length} 张
            </span>
          </div>
        </div>
      </div>
      {/* 照片网格 - 使用 CSS Grid 自动布局 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gridAutoRows: `${thumbnailSize}px`,
          gap: `${gap}px`,
          padding: `0 ${gap}px`,
        }}
      >
        {group.items.map((photo) => {
          const aspectCategory = getAspectRatioCategory(photo.width, photo.height);
          const colSpan = aspectCategory === 'wide' ? Math.min(2, columns) : 1;
          const rowSpan = aspectCategory === 'tall' ? 2 : 1;

          return (
            <div
              key={photo.photoId}
              style={{
                gridColumn: colSpan > 1 ? `span ${colSpan}` : undefined,
                gridRow: rowSpan > 1 ? `span ${rowSpan}` : undefined,
              }}
            >
              <PhotoThumbnail
                photo={photo}
                aspectCategory={aspectCategory}
                selected={selectedIds.has(photo.photoId)}
                thumbnailsEnabled={isActive}
                isScrolling={false}
                onClick={onPhotoClick}
                onDoubleClick={onPhotoDoubleClick}
                onContextMenu={onPhotoContextMenu}
                onSelect={onPhotoSelect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
