/**
 * 缩略图预取 Hook
 */

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { DateGroup } from '@/utils/dateGrouping';
import type { Photo } from '@/types';
import { thumbnailRequestManager, type ThumbnailSize } from '@/hooks';
import { findScrollParent } from '../utils/scrollbarMode';

export function useThumbnailPrefetch(
  containerRef: RefObject<HTMLDivElement>,
  dateGroups: DateGroup<Photo>[],
  groupElementsRef: RefObject<Map<string, HTMLElement>>,
  embedded: boolean,
  groupByDateEnabled: boolean
) {
  const groupObserverRef = useRef<IntersectionObserver | null>(null);
  const observedGroupsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!embedded || !groupByDateEnabled) return;

    const scrollRoot = findScrollParent(containerRef.current);

    // 创建 IntersectionObserver 观察日期分组块
    groupObserverRef.current = new IntersectionObserver(
      (entries) => {
        const visiblePhotos: Photo[] = [];

        for (const entry of entries) {
          if (entry.isIntersecting) {
            const groupDate = entry.target.getAttribute('data-group-date');
            if (!groupDate) continue;

            if (!observedGroupsRef.current.has(groupDate)) {
              observedGroupsRef.current.add(groupDate);
              // 找到对应的日期分组
              const group = dateGroups.find(g => g.date === groupDate);
              if (group) {
                visiblePhotos.push(...group.items);
              }
            }
          }
        }

        // 批量上报需求给 manager
        if (visiblePhotos.length > 0) {
          thumbnailRequestManager.demandBatch(
            visiblePhotos.map((photo, idx) => ({
              fileHash: photo.fileHash,
              size: 'small' as ThumbnailSize,
              sourcePath: photo.filePath,
              priority: 50 - idx,
              width: photo.width,
              height: photo.height,
              visible: true,
            }))
          );
          // 同时预取 tiny
          thumbnailRequestManager.demandBatch(
            visiblePhotos.map((photo, idx) => ({
              fileHash: photo.fileHash,
              size: 'tiny' as ThumbnailSize,
              sourcePath: photo.filePath,
              priority: 60 - idx, // tiny 优先级更高
              width: photo.width,
              height: photo.height,
              visible: true,
            }))
          );
        }
      },
      { root: scrollRoot ?? null, rootMargin: '800px 0px' }
    );

    if (groupElementsRef.current) {
      for (const el of groupElementsRef.current.values()) {
        groupObserverRef.current.observe(el);
      }
    }

    return () => {
      groupObserverRef.current?.disconnect();
      groupObserverRef.current = null;
    };
  }, [embedded, groupByDateEnabled, dateGroups, containerRef, groupElementsRef]);

  return { groupObserverRef };
}
