import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/core';

export interface ThumbnailReadyPayload {
  fileHash: string;
  size: string;
  path: string;
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
        const { fileHash, size, path } = event.payload;
        const key = this.getCacheKey(fileHash, size);
        const url = convertFileSrc(path);

        // Update cache
        this.cache.set(key, url);

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
