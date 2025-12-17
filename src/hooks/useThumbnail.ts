/**
 * 缩略图加载 Hook
 *
 * 提供缩略图加载、缓存和错误处理功能
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';

export type ThumbnailSize = 'tiny' | 'small' | 'medium' | 'large';

export interface ThumbnailOptions {
  /** 缩略图尺寸 */
  size?: ThumbnailSize;
  /** 优先级（用于队列模式） */
  priority?: number;
  /** 是否使用优先级队列（批量加载时推荐） */
  useQueue?: boolean;
  /** 重试次数 */
  retryCount?: number;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
  /** 是否启用缩略图加载（可用于非 Tauri 运行时降级） */
  enabled?: boolean;
  /** 加载延迟（毫秒，用于滚动时防抖） */
  loadDelay?: number;
}

export interface ThumbnailResult {
  /** 缩略图路径 */
  path: string;
  /** 是否命中缓存 */
  hitCache: boolean;
  /** 生成耗时（毫秒） */
  generationTimeMs?: number;
}

export interface UseThumbnailResult {
  /** 缩略图 URL（用于 <img src>) */
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
  useQueue: false,
  retryCount: 2,
  retryDelay: 500,
  enabled: true,
  loadDelay: 0, // 默认立即加载，滚动时由组件层控制
};

// 前端内存缓存 - 缓存已加载的缩略图 URL
const thumbnailCache = new Map<string, string>();
// 提升缓存容量以支持大型相册滚动，减少重复生成缩略图
const MAX_CACHE_SIZE = 1500;

function getCacheKey(fileHash: string, size: ThumbnailSize): string {
  return `${fileHash}_${size}`;
}

function addToCache(fileHash: string, size: ThumbnailSize, url: string): void {
  const key = getCacheKey(fileHash, size);
  // LRU: 如果缓存满了，删除最早的条目
  if (thumbnailCache.size >= MAX_CACHE_SIZE) {
    const firstKey = thumbnailCache.keys().next().value;
    if (firstKey) {
      thumbnailCache.delete(firstKey);
    }
  }
  thumbnailCache.set(key, url);
}

function getFromCache(fileHash: string, size: ThumbnailSize): string | null {
  const key = getCacheKey(fileHash, size);
  return thumbnailCache.get(key) ?? null;
}

// 单独的函数用于访问时更新 LRU 顺序
function touchCache(fileHash: string, size: ThumbnailSize): void {
  const key = getCacheKey(fileHash, size);
  const url = thumbnailCache.get(key);
  if (url) {
    thumbnailCache.delete(key);
    thumbnailCache.set(key, url);
  }
}

const detectTauriRuntime = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  const tauriWindow = window as typeof window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  return Boolean(tauriWindow.__TAURI__ ?? tauriWindow.__TAURI_INTERNALS__);
};

/**
 * 缩略图加载 Hook
 *
 * @param sourcePath 源图片路径
 * @param fileHash 文件哈希
 * @param options 选项
 * @returns 缩略图状态和控制方法
 *
 * @example
 * ```tsx
 * function PhotoItem({ photo }) {
 *   const { thumbnailUrl, isLoading, error } = useThumbnail(
 *     photo.path,
 *     photo.fileHash,
 *     { size: 'small', useQueue: true }
 *   );
 *
 *   if (isLoading) return <Skeleton />;
 *   if (error) return <ErrorPlaceholder />;
 *   return <img src={thumbnailUrl} alt={photo.fileName} />;
 * }
 * ```
 */
export function useThumbnail(
  sourcePath: string,
  fileHash: string,
  options: ThumbnailOptions = {},
): UseThumbnailResult {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 故意只依赖具体属性值，避免 options 引用变化导致不必要的重新计算
  const opts = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [
    options.size,
    options.priority,
    options.useQueue,
    options.retryCount,
    options.retryDelay,
    options.enabled,
    options.loadDelay,
  ]);

  // 检查内存缓存（不产生副作用）
  const cachedUrl = getFromCache(fileHash, opts.size);
  
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(() => cachedUrl);
  const [isLoading, setIsLoading] = useState(() => !cachedUrl);
  const [error, setError] = useState<Error | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  
  // 使用 ref 存储取消状态和延迟定时器
  const shouldCancelRef = useRef(false);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runtimeAvailable = detectTauriRuntime();
  const thumbnailEnabled = opts.enabled && runtimeAvailable;

  const cancel = useCallback(() => {
    shouldCancelRef.current = true;
    // 清除延迟定时器
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
    if (!thumbnailEnabled) {
      return;
    }
    // 如果使用队列，取消队列中的任务
    if (opts.useQueue) {
      invoke('cancel_thumbnail', { fileHash }).catch(err => {
        console.warn('Failed to cancel thumbnail:', err);
      });
    }
  }, [fileHash, opts.useQueue, thumbnailEnabled]);

  const reload = useCallback(() => {
    setReloadTrigger(prev => prev + 1);
    shouldCancelRef.current = false;
    setError(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    shouldCancelRef.current = false;
    
    // 如果已有缓存，直接使用
    const cached = getFromCache(fileHash, opts.size);
    if (cached) {
      // 更新 LRU
      touchCache(fileHash, opts.size);
      // 只有当值不同时才更新状态，避免不必要的重渲染
      setThumbnailUrl(prev => prev === cached ? prev : cached);
      setIsLoading(false);
      setError(null);
      return () => { mounted = false; };
    }
    
    if (!thumbnailEnabled) {
      setThumbnailUrl(null);
      setIsLoading(false);
      setError(null);
      return () => {
        mounted = false;
      };
    }

    async function loadThumbnail(attempt = 0): Promise<void> {
      if (!mounted || shouldCancelRef.current) return;

      try {
        // 不要在每次尝试时都设置 isLoading，减少重渲染
        if (attempt === 0) {
          setIsLoading(true);
          setError(null);
        }

        let result: ThumbnailResult;

        if (opts.useQueue) {
          // 使用优先级队列：入队后轮询等待缓存生成完成
          await invoke('enqueue_thumbnail', {
            sourcePath,
            fileHash,
            size: opts.size,
            priority: opts.priority,
          });

          // 轮询等待缩略图生成完成（避免重复调用 generate_thumbnail 导致竞争）
          const maxWaitMs = 10000; // 最长等待 10 秒
          const pollIntervalMs = 100;
          let waited = 0;
          let cached: string | null = null;

          while (waited < maxWaitMs) {
            if (!mounted || shouldCancelRef.current) return;

            // 检查缓存是否已生成
            cached = await invoke<string | null>('get_thumbnail_cache_path', {
              fileHash,
              size: opts.size,
            });

            if (cached) {
              break;
            }

            await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
            waited += pollIntervalMs;
          }

          // 超时后仍未生成，抛出错误让重试逻辑处理
          if (!cached) {
            throw new Error('Thumbnail generation timeout');
          }

          result = {
            path: cached,
            hitCache: true,
          };
        } else {
          // 直接生成
          result = await invoke<ThumbnailResult>('generate_thumbnail', {
            sourcePath,
            fileHash,
            size: opts.size,
          });
        }

        if (!mounted || shouldCancelRef.current) return;

        // 转换为 Tauri asset 协议 URL
        const assetUrl = convertFileSrc(result.path);
        
        // 添加到内存缓存
        addToCache(fileHash, opts.size, assetUrl);
        
        setThumbnailUrl(assetUrl);
        setIsLoading(false);
      } catch (err) {
        if (!mounted || shouldCancelRef.current) return;

        const error = err instanceof Error ? err : new Error(String(err));

        // 重试逻辑
        if (attempt < opts.retryCount) {
          await new Promise(resolve => setTimeout(resolve, opts.retryDelay));
          return loadThumbnail(attempt + 1);
        }

        // 所有重试都失败
        console.error('Failed to load thumbnail after retries:', error);
        setError(error);
        setIsLoading(false);
      }
    }

    // 如果设置了延迟，使用防抖；否则立即加载
    if (opts.loadDelay > 0) {
      loadTimerRef.current = setTimeout(() => {
        loadThumbnail();
      }, opts.loadDelay);
    } else {
      loadThumbnail();
    }

    return () => {
      mounted = false;
      if (loadTimerRef.current) {
        clearTimeout(loadTimerRef.current);
        loadTimerRef.current = null;
      }
    };
  }, [
    sourcePath,
    fileHash,
    opts.size,
    opts.priority,
    opts.useQueue,
    opts.retryCount,
    opts.retryDelay,
    opts.loadDelay,
    reloadTrigger,
    thumbnailEnabled,
  ]);

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

/**
 * 检查缩略图是否已在内存缓存中
 */
export function isThumbnailCached(fileHash: string, size: ThumbnailSize): boolean {
  return thumbnailCache.has(getCacheKey(fileHash, size));
}

export interface UseThumbnailProgressiveResult {
  /** 极小缩略图 URL（用于模糊占位） */
  tinyUrl: string | null;
  /** 完整缩略图 URL */
  fullUrl: string | null;
  /** 极小缩略图是否正在加载 */
  isLoadingTiny: boolean;
  /** 完整缩略图是否正在加载 */
  isLoadingFull: boolean;
  /** 是否应显示模糊的极小缩略图（tiny 已加载但 full 未加载） */
  showTiny: boolean;
  /** 错误信息 */
  error: Error | null;
}

/**
 * 渐进式缩略图加载 Hook
 *
 * 先加载极小的模糊占位图（50px），再加载完整缩略图。
 * 提供更好的用户体验，避免空白等待。
 *
 * @param sourcePath 源图片路径
 * @param fileHash 文件哈希
 * @param options 选项（size 指定完整缩略图尺寸，默认 'small'）
 */
export function useThumbnailProgressive(
  sourcePath: string,
  fileHash: string,
  options: Omit<ThumbnailOptions, 'size'> & { size?: Exclude<ThumbnailSize, 'tiny'> } = {},
): UseThumbnailProgressiveResult {
  const fullSize = options.size ?? 'small';

  // 加载极小缩略图（无延迟，立即加载）
  const tiny = useThumbnail(sourcePath, fileHash, {
    ...options,
    size: 'tiny',
    loadDelay: 0,
  });

  // 加载完整缩略图（使用配置的延迟）
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

/**
 * 批量加入缩略图任务到队列
 *
 * @param tasks 任务列表
 * @example
 * ```tsx
 * // 在照片列表组件中批量预加载缩略图
 * useEffect(() => {
 *   enqueueThumbnails(
 *     photos.map((photo, index) => ({
 *       sourcePath: photo.path,
 *       fileHash: photo.fileHash,
 *       size: 'small',
 *       priority: 100 - index, // 列表前面的照片优先级更高
 *     }))
 *   );
 * }, [photos]);
 * ```
 */
export async function enqueueThumbnails(
  tasks: Array<{
    sourcePath: string;
    fileHash: string;
    size?: ThumbnailSize;
    priority?: number;
  }>
): Promise<void> {
  await invoke('enqueue_thumbnails_batch', { tasks });
}
