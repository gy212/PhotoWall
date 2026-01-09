/**
 * ThumbnailRequestManager - 缩略图请求统一调度器
 *
 * 核心职责：
 * 1. 收口所有"查 L2 / 入 L3"的动作，组件只负责"上报需求 + 订阅结果"
 * 2. 合并需求（去重、升优先级）
 * 3. 批量查 L2（check_thumbnails_cached）
 * 4. 批量入 L3（enqueue_thumbnails_batch）
 * 5. 活性保障：可见状态下超时未出图则重试
 */

import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { thumbnailStore } from './ThumbnailStore';

export type ThumbnailSize = 'tiny' | 'small' | 'medium' | 'large';

export interface ThumbnailDemand {
  fileHash: string;
  size: ThumbnailSize;
  sourcePath: string;
  priority: number;
  width?: number;
  height?: number;
  /** 需求创建时间（用于活性保障） */
  createdAt: number;
  /** 是否可见（可见的需求有更高优先级和活性保障） */
  visible: boolean;
}

interface CheckCacheResult {
  fileHash: string;
  size: string;
  cached: boolean;
  path: string | null;
}

/** 活性保障超时时间（毫秒） */
const LIVENESS_TIMEOUT_MS = 3000;
/** flush 防抖时间（毫秒） */
const FLUSH_DEBOUNCE_MS = 50;
/** watchdog 检查间隔（毫秒） */
const WATCHDOG_INTERVAL_MS = 1000;

export class ThumbnailRequestManager {
  /** 当前需要的缩略图 */
  private wanted = new Map<string, ThumbnailDemand>();
  /** 正在处理中的 key（防止重复 IPC） */
  private inFlight = new Set<string>();
  /** 上次尝试时间（用于活性保障） */
  private lastAttempt = new Map<string, number>();
  /** flush 防抖定时器 */
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  /** watchdog 定时器 */
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  /** 是否已初始化 */
  private initialized = false;

  private getKey(fileHash: string, size: ThumbnailSize): string {
    return `${fileHash}_${size}`;
  }

  /**
   * 初始化管理器
   * 应在应用启动时调用
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // 启动 watchdog
    this.startWatchdog();

    // 监听页面可见性变化
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // 监听窗口焦点
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.handleWindowFocus);
    }
  }

  /**
   * 清理管理器
   */
  cleanup(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.handleWindowFocus);
    }
    this.wanted.clear();
    this.inFlight.clear();
    this.lastAttempt.clear();
    this.initialized = false;
  }

  /**
   * 上报需求：组件需要某个缩略图
   */
  demand(params: {
    fileHash: string;
    size: ThumbnailSize;
    sourcePath: string;
    priority?: number;
    width?: number;
    height?: number;
    visible?: boolean;
  }): void {
    // Lazy init: enable watchdog/visibility hooks without relying on external boot code.
    this.init();

    const key = this.getKey(params.fileHash, params.size);

    // 如果已经在 store 中有缓存，直接跳过
    if (thumbnailStore.get(params.fileHash, params.size)) {
      return;
    }

    const existing = this.wanted.get(key);
    const now = Date.now();

    if (existing) {
      // 更新优先级（取更高的）
      existing.priority = Math.max(existing.priority, params.priority ?? 0);
      // 更新可见性（只要有一个组件认为可见就算可见）
      existing.visible = existing.visible || (params.visible ?? false);
    } else {
      this.wanted.set(key, {
        fileHash: params.fileHash,
        size: params.size,
        sourcePath: params.sourcePath,
        priority: params.priority ?? 0,
        width: params.width,
        height: params.height,
        createdAt: now,
        visible: params.visible ?? false,
      });
    }

    // 触发防抖 flush
    this.scheduleFlush();
  }

  /**
   * 批量上报需求
   */
  demandBatch(demands: Array<{
    fileHash: string;
    size: ThumbnailSize;
    sourcePath: string;
    priority?: number;
    width?: number;
    height?: number;
    visible?: boolean;
  }>): void {
    for (const d of demands) {
      this.demand(d);
    }
  }

  /**
   * 取消需求：组件不再需要某个缩略图
   */
  cancel(fileHash: string, size: ThumbnailSize): void {
    const key = this.getKey(fileHash, size);
    this.wanted.delete(key);
    // 注意：不从 inFlight 移除，让已发起的请求继续完成
  }

  /**
   * 标记为可见：提升优先级并启用活性保障
   */
  markVisible(fileHash: string, size: ThumbnailSize): void {
    const key = this.getKey(fileHash, size);
    const demand = this.wanted.get(key);
    if (demand) {
      demand.visible = true;
      demand.priority = Math.max(demand.priority, 50); // 可见的至少 50 优先级
    }
  }

  /**
   * 标记为不可见
   */
  markHidden(fileHash: string, size: ThumbnailSize): void {
    const key = this.getKey(fileHash, size);
    const demand = this.wanted.get(key);
    if (demand) {
      demand.visible = false;
    }
  }

  /**
   * 强制立即 flush（用于页面回归等场景）
   */
  forceFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }

  /**
   * Mark request resolved: store already has URL, clear wanted/inFlight/lastAttempt.
   *
   * Note: do NOT call this for placeholder data URLs, otherwise liveness retries stop.
   */
  resolve(fileHash: string, size: ThumbnailSize): void {
    const key = this.getKey(fileHash, size);
    this.wanted.delete(key);
    this.inFlight.delete(key);
    this.lastAttempt.delete(key);
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, FLUSH_DEBOUNCE_MS);
  }

  private async flush(): Promise<void> {
    // 获取需要处理的需求（未解决且不在处理中）
    const batch: ThumbnailDemand[] = [];
    const now = Date.now();

    for (const [key, demand] of this.wanted) {
      // 已经有缓存了，移除需求
      if (thumbnailStore.get(demand.fileHash, demand.size)) {
        this.wanted.delete(key);
        this.inFlight.delete(key);
        this.lastAttempt.delete(key);
        continue;
      }

      // 正在处理中，跳过
      if (this.inFlight.has(key)) {
        continue;
      }

      batch.push(demand);
    }

    if (batch.length === 0) return;

    // 按优先级排序（高优先级在前）
    batch.sort((a, b) => b.priority - a.priority);

    // 限制单次批量大小
    const batchToProcess = batch.slice(0, 100);

    // 标记为处理中
    for (const d of batchToProcess) {
      const key = this.getKey(d.fileHash, d.size);
      this.inFlight.add(key);
      this.lastAttempt.set(key, now);
    }

    try {
      // 1) 批量 L2 对账
      const checkItems = batchToProcess.map(d => ({
        fileHash: d.fileHash,
        size: d.size,
      }));

      const statuses = await invoke<CheckCacheResult[]>('check_thumbnails_cached', { items: checkItems });

      // 处理缓存命中
      const statusMap = new Map<string, CheckCacheResult>();
      for (const s of statuses) {
        const key = this.getKey(s.fileHash, s.size as ThumbnailSize);
        statusMap.set(key, s);

        if (s.cached && s.path) {
          // 命中磁盘缓存，直接塞进 L1
          thumbnailStore.set(s.fileHash, s.size, convertFileSrc(s.path));
          // 移除需求和处理中标记
          this.wanted.delete(key);
          this.inFlight.delete(key);
          this.lastAttempt.delete(key);
        }
      }

      // 2) 未命中的批量入队 L3
      const misses = batchToProcess.filter(d => {
        const key = this.getKey(d.fileHash, d.size);
        const status = statusMap.get(key);
        return !status?.cached;
      });

      if (misses.length > 0) {
        const tasks = misses.map(d => ({
          sourcePath: d.sourcePath,
          fileHash: d.fileHash,
          size: d.size,
          priority: d.priority,
          width: d.width,
          height: d.height,
        }));

        await invoke('enqueue_thumbnails_batch', { tasks });
      }

      // 移除处理中标记（让 watchdog 可以重试）
      // Keep misses inFlight to avoid immediate duplicate enqueues; liveness timeout enables retry.
    } catch (error) {
      console.error('[ThumbnailRequestManager] flush error:', error);
      // 出错时移除所有处理中标记
      for (const d of batchToProcess) {
        const key = this.getKey(d.fileHash, d.size);
        this.inFlight.delete(key);
      }
      return;
    }

    // If there are still pending demands not yet enqueued/checked, keep flushing to drain the queue.
    for (const [pendingKey, demand] of this.wanted) {
      if (this.inFlight.has(pendingKey)) continue;

      if (thumbnailStore.get(demand.fileHash, demand.size)) {
        this.wanted.delete(pendingKey);
        this.inFlight.delete(pendingKey);
        this.lastAttempt.delete(pendingKey);
        continue;
      }

      this.scheduleFlush();
      break;
    }
  }

  /**
   * 启动 watchdog：活性保障
   */
  private startWatchdog(): void {
    if (this.watchdogTimer) return;

    this.watchdogTimer = setInterval(() => {
      this.checkLiveness();
    }, WATCHDOG_INTERVAL_MS);
  }

  /**
   * 检查活性：可见且超时未出图的需求需要重试
   */
  private checkLiveness(): void {
    const now = Date.now();
    let needsFlush = false;

    for (const [key, demand] of this.wanted) {
      // 只检查可见的需求
      if (!demand.visible) continue;

      // 已经有缓存了
      if (thumbnailStore.get(demand.fileHash, demand.size)) {
        this.wanted.delete(key);
        this.inFlight.delete(key);
        this.lastAttempt.delete(key);
        continue;
      }

      // 正在处理中，跳过
      if (this.inFlight.has(key)) {
        const lastAttemptTime = this.lastAttempt.get(key) ?? demand.createdAt;
        if (now - lastAttemptTime <= LIVENESS_TIMEOUT_MS) continue;
        // Allow retry after timeout (e.g. event lost / backend stalled)
        this.inFlight.delete(key);
      }

      // 检查是否超时
      const lastAttemptTime = this.lastAttempt.get(key) ?? demand.createdAt;
      if (now - lastAttemptTime > LIVENESS_TIMEOUT_MS) {
        // 超时了，提升优先级并标记需要重试
        demand.priority = Math.max(demand.priority, 80);
        needsFlush = true;
      }
    }

    if (needsFlush) {
      this.scheduleFlush();
    }
  }

  /**
   * 页面可见性变化处理
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      // 页面变为可见，强制 flush
      this.forceFlush();
    }
  };

  /**
   * 窗口获得焦点处理
   */
  private handleWindowFocus = (): void => {
    // 窗口获得焦点，强制 flush
    this.forceFlush();
  };

  /**
   * 获取统计信息（调试用）
   */
  getStats(): {
    wantedCount: number;
    inFlightCount: number;
    visibleCount: number;
  } {
    let visibleCount = 0;
    for (const demand of this.wanted.values()) {
      if (demand.visible) visibleCount++;
    }
    return {
      wantedCount: this.wanted.size,
      inFlightCount: this.inFlight.size,
      visibleCount,
    };
  }
}

// 全局单例
export const thumbnailRequestManager = new ThumbnailRequestManager();
