import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/core';

export interface ThumbnailReadyPayload {
  fileHash: string;
  size: string;
  path: string;
  /** 是否为占位图（RAW 提取失败时生成，不缓存到磁盘） */
  isPlaceholder: boolean;
  /** 占位图 Base64 编码（WebP 格式，仅占位图时有值） */
  placeholderBase64?: string;
}

type ThumbnailListener = (url: string) => void;

class ThumbnailStore {
  private cache = new Map<string, string>();
  private listeners = new Map<string, Set<ThumbnailListener>>();
  private unlistenFunction: UnlistenFn | null = null;
  private isListening = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // 立即初始化（不等待订阅）
    this.init();
  }

  /**
   * 初始化事件监听
   * 应用启动时自动调用，确保事件通道永远在线
   */
  async init(): Promise<void> {
    if (this.isListening) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    if (this.isListening) return;
    this.isListening = true;

    try {
      this.unlistenFunction = await listen<ThumbnailReadyPayload>('thumbnail-ready', (event) => {
        const { fileHash, size, path, isPlaceholder, placeholderBase64 } = event.payload;
        const key = this.getCacheKey(fileHash, size);

        let url: string;
        if (isPlaceholder && placeholderBase64) {
          // 占位图：使用 data URL，不添加到持久缓存
          url = `data:image/webp;base64,${placeholderBase64}`;
          // 注意：占位图不添加到缓存，只通知监听器
          // 下次请求时会重试提取
        } else {
          // 正常缩略图：转换文件路径并添加到缓存
          url = convertFileSrc(path);
          this.cache.set(key, url);
        }

        // Notify listeners
        const keyListeners = this.listeners.get(key);
        if (keyListeners) {
          keyListeners.forEach(listener => listener(url));
        }
      });
    } catch (e) {
      console.error('Failed to listen to thumbnail-ready event:', e);
      this.isListening = false;
      this.initPromise = null;
    }
  }

  private getCacheKey(fileHash: string, size: string): string {
    return `${fileHash}_${size}`;
  }

  get(fileHash: string, size: string): string | undefined {
    return this.cache.get(this.getCacheKey(fileHash, size));
  }

  set(fileHash: string, size: string, url: string) {
    const key = this.getCacheKey(fileHash, size);
    this.cache.set(key, url);

    // Also notify listeners if manually set (e.g. from preloading)
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(listener => listener(url));
    }
  }

  subscribe(fileHash: string, size: string, listener: ThumbnailListener): () => void {
    const key = this.getCacheKey(fileHash, size);

    // If initial eager init failed (e.g. Tauri internals not ready yet), retry on first real usage.
    if (!this.isListening) {
      void this.init().catch(() => {
        // Ignore: will retry on next subscribe/use.
      });
    }

    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }

    this.listeners.get(key)!.add(listener);

    // 不再需要在这里调用 init()，因为构造函数已经初始化了

    // ✅ 关键修复：订阅时立即推送已有缓存，避免竞态条件
    // 如果缓存已存在，立即回调一次，确保组件能收到已缓存的数据
    const cached = this.cache.get(key);
    if (cached) {
      // 使用 Promise.resolve().then() 确保在当前同步代码执行完后立即回调
      // 避免在 subscribe 调用期间触发状态更新
      Promise.resolve().then(() => listener(cached));
    }

    return () => {
      const set = this.listeners.get(key);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  cleanup() {
    if (this.unlistenFunction) {
      this.unlistenFunction();
      this.unlistenFunction = null;
    }
    this.isListening = false;
    this.cache.clear();
    this.listeners.clear();
  }
}

export const thumbnailStore = new ThumbnailStore();
