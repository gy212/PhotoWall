/**
 * 缩略图加载 Hook (Event-Driven + Manager-Based)
 *
 * 重构后的架构：
 * - useThumbnail 只负责"订阅 store + 上报需求给 manager"
 * - 不再直接调用 IPC（get_thumbnail_cache_path / enqueue_thumbnail）
 * - 所有 L2/L3 操作由 ThumbnailRequestManager 统一调度
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { thumbnailStore } from '@/services/ThumbnailStore';
import { thumbnailRequestManager, type ThumbnailSize } from '@/services/ThumbnailRequestManager';

export type { ThumbnailSize } from '@/services/ThumbnailRequestManager';

export interface ThumbnailOptions {
  /** 缩略图尺寸 */
  size?: ThumbnailSize;
  /** 优先级 */
  priority?: number;
  /** 是否启用 */
  enabled?: boolean;
  /** 是否可见（可见的需求有更高优先级和活性保障） */
  visible?: boolean;
  /** 原图宽度（用于小图跳过逻辑） */
  width?: number;
  /** 原图高度（用于小图跳过逻辑） */
  height?: number;
  /** @deprecated 不再使用 */
  suspendNewRequests?: boolean;
  /** @deprecated 不再使用 */
  loadDelay?: number;
  /** @deprecated 总是使用队列 */
  useQueue?: boolean;
  /** @deprecated 重试由 Manager 处理 */
  retryCount?: number;
  /** @deprecated */
  retryDelay?: number;
}

export interface UseThumbnailResult {
  /** 缩略图 URL */
  thumbnailUrl: string | null;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 重新加载 */
  reload: () => void;
  /** 取消加载 */
  cancel: () => void;
}

const DEFAULT_OPTIONS: Required<ThumbnailOptions> = {
  size: 'medium',
  priority: 0,
  enabled: true,
  visible: true,
  width: 0,
  height: 0,
  suspendNewRequests: false,
  loadDelay: 0,
  useQueue: true,
  retryCount: 0,
  retryDelay: 0,
};

const detectTauriRuntime = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  const tauriWindow = window as typeof window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  return Boolean(tauriWindow.__TAURI__ ?? tauriWindow.__TAURI_INTERNALS__);
};

/**
 * 缩略图加载 Hook（重构版）
 *
 * 职责：
 * 1. 订阅 ThumbnailStore 获取 URL
 * 2. 上报需求给 ThumbnailRequestManager
 * 3. 不再直接调用 IPC
 */
export function useThumbnail(
  sourcePath: string,
  fileHash: string,
  options: ThumbnailOptions = {},
): UseThumbnailResult {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const opts = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [
    options.size,
    options.priority,
    options.enabled,
    options.visible,
    options.width,
    options.height,
  ]);

  // 初始状态从 store 获取
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(() =>
    thumbnailStore.get(fileHash, opts.size) ?? null
  );
  const [isLoading, setIsLoading] = useState(() => !thumbnailStore.get(fileHash, opts.size));
  const [error, setError] = useState<Error | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const runtimeAvailable = detectTauriRuntime();
  const thumbnailEnabled = opts.enabled && runtimeAvailable;

  useEffect(() => {
    // 1. 先检查内存缓存
    const cached = thumbnailStore.get(fileHash, opts.size);
    if (cached) {
      setThumbnailUrl(cached);
      setIsLoading(false);
      return;
    }

    // 2. 未启用时直接返回
    if (!thumbnailEnabled) {
      setThumbnailUrl(null);
      setIsLoading(false);
      return;
    }

    // 3. 设置加载状态
    setIsLoading(true);

    // 4. 订阅 store 更新
    const unsubscribe = thumbnailStore.subscribe(fileHash, opts.size, (url) => {
      setThumbnailUrl(url);
      setIsLoading(false);
      setError(null);

      // Placeholder thumbnails (data URL) are not cached in store; keep manager state for liveness retries.
      if (!url.startsWith('data:image/')) {
        thumbnailRequestManager.resolve(fileHash, opts.size);
      }
    });

    // 5. 上报需求给 manager（由 manager 统一调度 L2/L3）
    thumbnailRequestManager.demand({
      fileHash,
      size: opts.size,
      sourcePath,
      priority: opts.priority,
      width: opts.width || undefined,
      height: opts.height || undefined,
      visible: opts.visible,
    });

    return () => {
      unsubscribe();
      // 取消需求（但不阻止已发起的请求）
      thumbnailRequestManager.cancel(fileHash, opts.size);
    };
  }, [fileHash, sourcePath, opts.size, opts.priority, opts.visible, opts.width, opts.height, thumbnailEnabled, reloadTrigger]);

  const reload = useCallback(() => {
    setReloadTrigger(prev => prev + 1);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    thumbnailRequestManager.cancel(fileHash, opts.size);
  }, [fileHash, opts.size]);

  return { thumbnailUrl, isLoading, error, reload, cancel };
}

// Helper for importing invoke only inside effect/async
import { invoke } from '@tauri-apps/api/core';

/**
 * 检查缩略图是否已在内存缓存中
 */
export function isThumbnailCached(fileHash: string, size: ThumbnailSize): boolean {
  return !!thumbnailStore.get(fileHash, size);
}

export interface UseThumbnailProgressiveResult {
  tinyUrl: string | null;
  fullUrl: string | null;
  isLoadingTiny: boolean;
  isLoadingFull: boolean;
  showTiny: boolean;
  error: Error | null;
  /** 重新加载（用于 onError 兜底重试） */
  reload: () => void;
}

/**
 * 渐进式缩略图加载 Hook
 */
export function useThumbnailProgressive(
  sourcePath: string,
  fileHash: string,
  options: Omit<ThumbnailOptions, 'size'> & { size?: Exclude<ThumbnailSize, 'tiny'> } = {},
): UseThumbnailProgressiveResult {
  const fullSize = options.size ?? 'small';

  // Always load tiny immediately with higher priority
  const tiny = useThumbnail(sourcePath, fileHash, {
    ...options,
    size: 'tiny',
    priority: (options.priority || 0) + 10,
  });

  const full = useThumbnail(sourcePath, fileHash, {
    ...options,
    size: fullSize,
  });

  // 合并 reload：同时重新加载 tiny 和 full
  const reload = useCallback(() => {
    tiny.reload();
    full.reload();
  }, [tiny, full]);

  return useMemo(
    () => ({
      tinyUrl: tiny.thumbnailUrl,
      fullUrl: full.thumbnailUrl,
      isLoadingTiny: tiny.isLoading,
      isLoadingFull: full.isLoading,
      showTiny: Boolean(tiny.thumbnailUrl && !full.thumbnailUrl),
      error: full.error ?? tiny.error,
      reload,
    }),
    [tiny.thumbnailUrl, tiny.isLoading, tiny.error, full.thumbnailUrl, full.isLoading, full.error, reload]
  );
}

// Re-export helpers for backward compatibility
export async function enqueueThumbnails(
  tasks: Array<{
    sourcePath: string;
    fileHash: string;
    size?: ThumbnailSize;
    priority?: number;
    width?: number;
    height?: number;
  }>
): Promise<void> {
  await invoke('enqueue_thumbnails_batch', { tasks });
}

export async function checkThumbnailsCached(
  items: Array<{ fileHash: string; size?: ThumbnailSize }>
): Promise<Map<string, { cached: boolean; path: string | null }>> {
  interface CheckCacheResult {
    fileHash: string;
    size: string;
    cached: boolean;
    path: string | null;
  }
  const results = await invoke<CheckCacheResult[]>('check_thumbnails_cached', { items });
  const map = new Map<string, { cached: boolean; path: string | null }>();
  for (const r of results) {
    map.set(`${r.fileHash}_${r.size}`, { cached: r.cached, path: r.path });
  }
  return map;
}

export function addToCacheExternal(fileHash: string, size: ThumbnailSize, url: string): void {
  thumbnailStore.set(fileHash, size, url);
}

export interface ThumbnailStats {
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  avgGenerationTimeMs: number;
  queueDepth: number;
}

export async function getThumbnailStats(): Promise<ThumbnailStats> {
  return invoke<ThumbnailStats>('get_thumbnail_stats');
}

/** thumbnail-ready 事件的 payload */
export interface ThumbnailReadyPayload {
  fileHash: string;
  size: string;
  path: string;
  /** 是否为占位图（RAW 提取失败时生成，不缓存到磁盘） */
  isPlaceholder: boolean;
  /** 占位图 Base64 编码（WebP 格式，仅占位图时有值） */
  placeholderBase64?: string;
  /** 是否直接使用原图（小图跳过缩略图生成） */
  useOriginal: boolean;
}

/**
 * @deprecated 使用 useThumbnail 代替，新版本已经是事件驱动的
 */
export const useThumbnailWithEvents = useThumbnail;

// Re-export manager for direct access if needed
export { thumbnailRequestManager } from '@/services/ThumbnailRequestManager';

