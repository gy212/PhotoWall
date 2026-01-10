/**
 * 自定义 Scroller 组件
 */

import { forwardRef, useState, useLayoutEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { resolveScrollbarMode, type ScrollbarMode } from '../utils/scrollbarMode';

export const GridScroller = forwardRef<HTMLDivElement, { style?: CSSProperties; children?: ReactNode }>(
  ({ style, children, ...props }, ref) => {
    const [scrollbarMode, setScrollbarMode] = useState<ScrollbarMode>('auto');

    useLayoutEffect(() => {
      setScrollbarMode(resolveScrollbarMode());
    }, []);

    return (
      <div
        ref={ref}
        {...props}
        style={{
          ...style,
          overflowY: scrollbarMode === 'force-scroll' ? 'scroll' : 'auto',
          ...(scrollbarMode === 'stable-gutter' ? ({ scrollbarGutter: 'stable' } as CSSProperties) : {}),
          overflowAnchor: 'none',
        }}
      >
        {children}
      </div>
    );
  }
);

GridScroller.displayName = 'GridScroller';
