import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ThumbnailSize } from './ThumbnailRequestManager';
import { ThumbnailRequestManager } from './ThumbnailRequestManager';

const tauriMocks = vi.hoisted(() => {
  return {
    invoke: vi.fn(),
    convertFileSrc: (path: string) => `asset://${path}`,
  };
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: tauriMocks.invoke,
  convertFileSrc: tauriMocks.convertFileSrc,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => {}),
}));

describe('ThumbnailRequestManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    tauriMocks.invoke.mockReset();
    tauriMocks.invoke.mockImplementation(async (cmd: string, args: unknown) => {
      if (cmd === 'check_thumbnails_cached') {
        const payload = args as { items: Array<{ fileHash: string; size: string }> };
        return payload.items.map((item) => ({
          fileHash: item.fileHash,
          size: item.size,
          cached: false,
          path: null,
        }));
      }

      if (cmd === 'enqueue_thumbnails_batch') {
        return null;
      }

      throw new Error(`Unexpected invoke: ${cmd}`);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('drains pending demands across multiple flush batches without duplicate enqueues', async () => {
    const manager = new ThumbnailRequestManager();

    const demands: Array<{
      fileHash: string;
      size: ThumbnailSize;
      sourcePath: string;
      priority?: number;
      visible?: boolean;
    }> = [];

    for (let i = 0; i < 60; i++) {
      const fileHash = `hash-${i}`;
      const sourcePath = `C:\\\\p\\\\${i}.jpg`;
      demands.push({ fileHash, size: 'tiny', sourcePath, priority: 10, visible: true });
      demands.push({ fileHash, size: 'small', sourcePath, priority: 0, visible: true });
    }

    manager.demandBatch(demands);

    // First flush (debounced)
    await vi.advanceTimersByTimeAsync(60);
    // Second flush scheduled by the manager to drain remaining items
    await vi.advanceTimersByTimeAsync(60);

    const enqueueCalls = tauriMocks.invoke.mock.calls.filter(([cmd]) => cmd === 'enqueue_thumbnails_batch');
    expect(enqueueCalls).toHaveLength(2);
    expect(enqueueCalls[0][1].tasks).toHaveLength(100);
    expect(enqueueCalls[1][1].tasks).toHaveLength(20);

    const allTasks = enqueueCalls.flatMap(([, payload]) => payload.tasks as Array<{ fileHash: string; size: string }>);
    const uniqueKeys = new Set(allTasks.map((t) => `${t.fileHash}_${t.size}`));
    expect(uniqueKeys.size).toBe(120);

    manager.cleanup();
  });
});
