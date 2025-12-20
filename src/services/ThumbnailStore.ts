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

  constructor() {
    // Lazy initialization in init()
  }

  async init() {
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

    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }

    this.listeners.get(key)!.add(listener);

    // Make sure we are listening to global events
    this.init();

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
