/**
 * 缩略图加载 Hook (Event-Driven Optimized)
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { thumbnailStore } from '@/services/ThumbnailStore';

export type ThumbnailSize = 'tiny' | 'small' | 'medium' | 'large';

export interface ThumbnailOptions {
  /** 缩略图尺寸 */
  size?: ThumbnailSize;
  /** 优先级 */
  priority?: number;
  /** 是否启用 */
  enabled?: boolean;
  /** 暂停发起新请求（滚动时），但保留已缓存结果 */
  suspendNewRequests?: boolean;
  /** 加载延迟（毫秒，用于滚动时防抖） */
  loadDelay?: number;
  /** 原图宽度（用于小图跳过逻辑） */
  width?: number;
  /** 原图高度（用于小图跳过逻辑） */
  height?: number;
  /** @deprecated 总是使用队列 */
  useQueue?: boolean;
  /** @deprecated 重试由 Store/Backend 处理 */
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
  /** 取消加载 (No-op in global store mode usually) */
  cancel: () => void;
}

const DEFAULT_OPTIONS: Required<ThumbnailOptions> = {
  size: 'medium',
  priority: 0,
  enabled: true,
  suspendNewRequests: false,
  loadDelay: 0,
  width: 0,
  height: 0,
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
 * 缩略图加载 Hook
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
    options.suspendNewRequests,
    options.loadDelay,
    options.width,
    options.height,
  ]);

  // Initial state from store if available
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(() =>
    thumbnailStore.get(fileHash, opts.size) ?? null
  );
  const [isLoading, setIsLoading] = useState(() => !thumbnailStore.get(fileHash, opts.size));
  const [error, setError] = useState<Error | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0); // Used to force effect re-run

  // Timer ref for debounce
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runtimeAvailable = detectTauriRuntime();
  const thumbnailEnabled = opts.enabled && runtimeAvailable;

  useEffect(() => {
    // 1. 始终先检查内存缓存（不受任何开关影响）
    const cached = thumbnailStore.get(fileHash, opts.size);
    if (cached) {
      setThumbnailUrl(cached);
      setIsLoading(false);
      return;
    }

    // 2. 未缓存时检查是否启用
    if (!thumbnailEnabled) {
      setThumbnailUrl(null);
      setIsLoading(false);
      return;
    }

    // 3. 暂停新请求时（滚动中），保持当前状态不变，不发起请求
    if (opts.suspendNewRequests) {
      return;
    }

    // Not in store, set loading
    setIsLoading(true);

    // 2. Subscribe to store updates
    const unsubscribe = thumbnailStore.subscribe(fileHash, opts.size, (url) => {
      setThumbnailUrl(url);
      setIsLoading(false);
    });

    // 3. Trigger generation
    let active = true;

    const triggerLoad = async () => {
      try {
        // Check disk cache first via backend (fast path)
        const diskCachePath = await invoke<string | null>('get_thumbnail_cache_path', {
          fileHash,
          size: opts.size,
        });

        if (!active) return;

        if (diskCachePath) {
          // Found in disk cache, update store manually which triggers our subscriber
          const assetUrl = convertFileSrc(diskCachePath);
          thumbnailStore.set(fileHash, opts.size, assetUrl);
          // subscription will handle state update
        } else {
          // Not in disk cache, enqueue generation
          await invoke('enqueue_thumbnail', {
            sourcePath,
            fileHash,
            size: opts.size,
            priority: opts.priority,
            width: opts.width || undefined,
            height: opts.height || undefined,
          });
        }
      } catch (err) {
        if (active) {
          console.error("Thumbnail error:", err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    };

    // Debounce logic
    if (opts.loadDelay > 0) {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
      loadTimerRef.current = setTimeout(triggerLoad, opts.loadDelay);
    } else {
      triggerLoad();
    }

    return () => {
      active = false;
      unsubscribe();
      if (loadTimerRef.current) {
        clearTimeout(loadTimerRef.current);
        loadTimerRef.current = null;
      }
    };
  }, [fileHash, sourcePath, opts.size, opts.priority, thumbnailEnabled, opts.suspendNewRequests, reloadTrigger, opts.loadDelay]);

  const reload = useCallback(() => {
    setReloadTrigger(prev => prev + 1);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
    // With global store, individual cancellation is tricky because other components might need it.
    // But we can send a cancel hint to backend.
    if (thumbnailEnabled) {
      invoke('cancel_thumbnail', { fileHash }).catch(() => { });
    }
  }, [fileHash, thumbnailEnabled]);

  return { thumbnailUrl, isLoading, error, reload, cancel };
}

// Helper for importing convertFileSrc only inside effect/async
import { convertFileSrc } from '@tauri-apps/api/core';

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

  // Always load tiny immediately
  const tiny = useThumbnail(sourcePath, fileHash, {
    ...options,
    size: 'tiny',
    priority: (options.priority || 0) + 10, // Tiny has higher priority
    loadDelay: 0, // Tiny should load immediately
  });

  const full = useThumbnail(sourcePath, fileHash, {
    ...options,
    size: fullSize,
  });

  return useMemo(
    () => ({
      tinyUrl: tiny.thumbnailUrl,
      fullUrl: full.thumbnailUrl,
      isLoadingTiny: tiny.isLoading,
      isLoadingFull: full.isLoading,
      showTiny: Boolean(tiny.thumbnailUrl && !full.thumbnailUrl),
      error: full.error ?? tiny.error,
    }),
    [tiny.thumbnailUrl, tiny.isLoading, tiny.error, full.thumbnailUrl, full.isLoading, full.error]
  );
}

// Re-export helpers
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

// ============ 事件驱动加载 ============

import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// Helper functions for cache operations
function getFromCache(fileHash: string, size: ThumbnailSize): string | undefined {
  return thumbnailStore.get(fileHash, size);
}

function touchCache(fileHash: string, size: ThumbnailSize): void {
  // Touch is a no-op for now, store handles LRU internally
  void fileHash;
  void size;
}

function addToCache(fileHash: string, size: ThumbnailSize, url: string): void {
  thumbnailStore.set(fileHash, size, url);
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
 * 事件驱动的缩略图加载 Hook
 *
 * 与 useThumbnail 不同，这个 hook 不使用轮询，而是：
 * 1. 先查内存缓存
 * 2. 再查磁盘缓存
 * 3. 不存在则 enqueue 并监听 thumbnail-ready 事件
 *
 * 优势：
 * - 彻底去掉轮询
 * - 减少 IPC 调用
 * - 更精确的 UI 更新时机
 *
 * @param sourcePath 源图片路径
 * @param fileHash 文件哈希
 * @param options 选项
 */
export function useThumbnailWithEvents(
  sourcePath: string,
  fileHash: string,
  options: ThumbnailOptions = {},
): UseThumbnailResult {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 故意只依赖具体属性值
  const opts = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [
    options.size,
    options.priority,
    options.enabled,
    options.loadDelay,
    options.width,
    options.height,
  ]);

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const mountedRef = useRef(true);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const runtimeAvailable = detectTauriRuntime();
  const thumbnailEnabled = opts.enabled && runtimeAvailable;

  const cancel = useCallback(() => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
    if (thumbnailEnabled) {
      invoke('cancel_thumbnail', { fileHash }).catch(() => { });
    }
  }, [fileHash, thumbnailEnabled]);

  const reload = useCallback(() => {
    setReloadTrigger(prev => prev + 1);
    setError(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // 1. 先查内存缓存
    const cached = getFromCache(fileHash, opts.size);
    if (cached) {
      touchCache(fileHash, opts.size);
      setThumbnailUrl(cached);
      setIsLoading(false);
      return () => { mountedRef.current = false; };
    }

    if (!thumbnailEnabled) {
      setThumbnailUrl(null);
      setIsLoading(false);
      return () => { mountedRef.current = false; };
    }

    let delayTimer: ReturnType<typeof setTimeout> | null = null;

    const startLoad = () => {
      setIsLoading(true);

      // 2. 查磁盘缓存
      invoke<string | null>('get_thumbnail_cache_path', {
        fileHash,
        size: opts.size,
      }).then(async (path) => {
        if (!mountedRef.current) return;

        if (path) {
          // 磁盘缓存命中
          const url = convertFileSrc(path);
          addToCache(fileHash, opts.size, url);
          setThumbnailUrl(url);
          setIsLoading(false);
        } else {
          // 3. 不存在则 enqueue 并监听事件
          await invoke('enqueue_thumbnail', {
            sourcePath,
            fileHash,
            size: opts.size,
            priority: opts.priority,
            width: opts.width || undefined,
            height: opts.height || undefined,
          });

          // 监听 thumbnail-ready 事件
          unlistenRef.current = await listen<ThumbnailReadyPayload>('thumbnail-ready', (event) => {
            if (!mountedRef.current) return;

            if (event.payload.fileHash === fileHash && event.payload.size === opts.size) {
              let url: string;

              if (event.payload.useOriginal) {
                // 小图跳过：直接使用原图
                url = convertFileSrc(event.payload.path);
                addToCache(fileHash, opts.size, url);
              } else if (event.payload.isPlaceholder && event.payload.placeholderBase64) {
                // 占位图：使用 data URL，不添加到持久缓存
                url = `data:image/webp;base64,${event.payload.placeholderBase64}`;
                // 注意：占位图不添加到缓存，下次请求时会重试提取
              } else {
                // 正常缩略图：转换文件路径并添加到缓存
                url = convertFileSrc(event.payload.path);
                addToCache(fileHash, opts.size, url);
              }

              setThumbnailUrl(url);
              setIsLoading(false);

              // 收到事件后取消监听
              if (unlistenRef.current) {
                unlistenRef.current();
                unlistenRef.current = null;
              }
            }
          });
        }
      }).catch((err) => {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      });
    };

    if (opts.loadDelay > 0) {
      delayTimer = setTimeout(startLoad, opts.loadDelay);
    } else {
      startLoad();
    }

    return () => {
      mountedRef.current = false;
      if (delayTimer) {
        clearTimeout(delayTimer);
      }
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [sourcePath, fileHash, opts.size, opts.priority, opts.loadDelay, reloadTrigger, thumbnailEnabled]);

  return useMemo(
    () => ({
      thumbnailUrl,
      isLoading,
      error,
      reload,
      cancel,
    }),
    [thumbnailUrl, isLoading, error, reload, cancel]
  );
}
