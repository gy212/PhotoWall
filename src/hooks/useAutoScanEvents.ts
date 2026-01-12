import { useEffect, useRef } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';

export function useAutoScanEvents() {
  const queryClient = useQueryClient();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isTauri()) return;

    let unlistens: UnlistenFn[] = [];
    let cancelled = false;

    const scheduleRefresh = () => {
      if (timerRef.current != null) return;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        queryClient.invalidateQueries({ queryKey: ['photoFeed'] });
        queryClient.invalidateQueries({ queryKey: ['recentPhotos'] });
        queryClient.invalidateQueries({ queryKey: ['folders'] });
        queryClient.invalidateQueries({ queryKey: ['albums'] });
        queryClient.invalidateQueries({ queryKey: ['tags'] });
      }, 800);
    };

    const setup = async () => {
      const next: UnlistenFn[] = await Promise.all([
        listen('auto-scan:completed', scheduleRefresh),
        listen('auto-scan:realtime-indexed', scheduleRefresh),
        listen('auto-scan:realtime-deleted', scheduleRefresh),
      ]);

      if (cancelled) {
        next.forEach((fn) => fn());
        return;
      }
      unlistens = next;
    };

    void setup();

    return () => {
      cancelled = true;
      unlistens.forEach((fn) => fn());
      unlistens = [];
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [queryClient]);
}
