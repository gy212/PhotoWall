/**
 * 滚动条模式检测工具
 */

export type ScrollbarMode = 'auto' | 'stable-gutter' | 'force-scroll';

let cachedScrollbarMode: ScrollbarMode | null = null;

export function resolveScrollbarMode(): ScrollbarMode {
  if (cachedScrollbarMode) {
    return cachedScrollbarMode;
  }

  if (typeof document === 'undefined' || !document.body) {
    return 'auto';
  }

  const outer = document.createElement('div');
  outer.style.visibility = 'hidden';
  outer.style.overflow = 'scroll';
  outer.style.position = 'absolute';
  outer.style.top = '-9999px';
  outer.style.width = '100px';
  outer.style.height = '100px';
  document.body.appendChild(outer);

  const scrollbarWidth = outer.offsetWidth - outer.clientWidth;
  document.body.removeChild(outer);

  if (scrollbarWidth === 0) {
    cachedScrollbarMode = 'auto';
    return cachedScrollbarMode;
  }

  const cssApi = typeof window !== 'undefined' ? window.CSS : undefined;
  const supportsGutter =
    cssApi !== undefined &&
    typeof cssApi.supports === 'function' &&
    cssApi.supports('scrollbar-gutter: stable');

  cachedScrollbarMode = supportsGutter ? 'stable-gutter' : 'force-scroll';
  return cachedScrollbarMode;
}

/**
 * 查找滚动父元素
 */
export function findScrollParent(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;

  let parent: HTMLElement | null = element.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    const isScrollable = overflowY === 'auto' || overflowY === 'scroll';
    if (isScrollable && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
    parent = parent.parentElement;
  }

  return null;
}

/**
 * 比较两个 Set 是否相等
 */
export function areSetsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}
