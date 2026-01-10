/**
 * 滚动同步 Hook
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { RefObject } from 'react';
import type { DateGroup } from '@/utils/dateGrouping';
import type { Photo } from '@/types';
import { findScrollParent, areSetsEqual } from '../utils/scrollbarMode';

export function useScrollSync(
  containerRef: RefObject<HTMLDivElement>,
  dateGroups: DateGroup<Photo>[],
  embedded: boolean,
  groupByDateEnabled: boolean
) {
  const [activeGroupDates, setActiveGroupDates] = useState<Set<string>>(() => new Set());
  const groupElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const activeGroupDatesRef = useRef<Set<string>>(new Set());

  const registerGroupElement = useCallback((date: string, el: HTMLElement | null) => {
    if (el) {
      groupElementsRef.current.set(date, el);
    } else {
      groupElementsRef.current.delete(date);
    }
  }, []);

  // Embedded + grouped mode: keep active groups in sync with the actual scroll position.
  useEffect(() => {
    if (!embedded || !groupByDateEnabled) return;

    const scrollRoot = findScrollParent(containerRef.current);
    const scrollTarget: HTMLElement | typeof window = scrollRoot ?? window;
    const marginPx = 1200;
    let rafId: number | null = null;

    const computeActive = () => {
      rafId = null;

      const rootRect =
        scrollRoot !== null
          ? scrollRoot.getBoundingClientRect()
          : { top: 0, bottom: window.innerHeight };

      const next = new Set<string>();
      for (const [date, el] of groupElementsRef.current) {
        const rect = el.getBoundingClientRect();
        const visible =
          rect.bottom >= rootRect.top - marginPx && rect.top <= rootRect.bottom + marginPx;
        if (visible) next.add(date);
      }

      if (!areSetsEqual(activeGroupDatesRef.current, next)) {
        activeGroupDatesRef.current = next;
        setActiveGroupDates(next);
      }
    };

    const schedule = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(computeActive);
    };

    schedule();
    scrollTarget.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      scrollTarget.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [embedded, groupByDateEnabled, dateGroups.length, containerRef]);

  return { activeGroupDates, groupElementsRef, registerGroupElement };
}
