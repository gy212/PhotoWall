/**
 * useScanner Hook
 *
 * 封装文件扫描相关的状态和操作
 */

import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Photo } from '@/types';

export interface ScanProgress {
  currentDir: string;
  scannedCount: number;
  foundCount: number;
}

export interface IndexProgress {
  processed: number;
  total: number;
  currentFile: string;
}

export interface UseScannerReturn {
  // 状态
  isScanning: boolean;
  isIndexing: boolean;
  scanProgress: ScanProgress | null;
  indexProgress: IndexProgress | null;
  error: string | null;

  // 操作
  scanDirectory: (path: string) => Promise<void>;
  indexPhotos: (paths: string[]) => Promise<Photo[]>;
  cancel: () => void;
}

export function useScanner(): UseScannerReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [indexProgress, setIndexProgress] = useState<IndexProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 扫描目录
  const scanDirectory = useCallback(async (path: string) => {
    try {
      setIsScanning(true);
      setError(null);
      setScanProgress(null);

      // 监听扫描进度事件
      const unlisten = await listen<ScanProgress>('scan-progress', (event) => {
        setScanProgress(event.payload);
      });

      try {
        // 调用后端扫描命令
        await invoke('scan_directory', {
          path,
          options: {
            recursive: true,
            excludeDirs: [],
            maxDepth: 0,
          },
        });
      } finally {
        unlisten();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error('扫描失败:', err);
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  }, []);

  // 索引照片
  const indexPhotos = useCallback(async (paths: string[]): Promise<Photo[]> => {
    try {
      setIsIndexing(true);
      setError(null);
      setIndexProgress(null);

      // 监听索引进度事件
      const unlisten = await listen<IndexProgress>('index-progress', (event) => {
        setIndexProgress(event.payload);
      });

      try {
        // 调用后端索引命令
        const result = await invoke<{ photos: Photo[] }>('index_photos', {
          paths,
          options: {
            skipExisting: true,
            extractMetadata: true,
            generateThumbnails: false, // 缩略图稍后生成
          },
        });

        return result.photos;
      } finally {
        unlisten();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error('索引失败:', err);
      throw err;
    } finally {
      setIsIndexing(false);
      setIndexProgress(null);
    }
  }, []);

  // 取消操作
  const cancel = useCallback(() => {
    if (isScanning || isIndexing) {
      invoke('cancel_scan').catch(console.error);
      setIsScanning(false);
      setIsIndexing(false);
      setScanProgress(null);
      setIndexProgress(null);
    }
  }, [isScanning, isIndexing]);

  return {
    isScanning,
    isIndexing,
    scanProgress,
    indexProgress,
    error,
    scanDirectory,
    indexPhotos,
    cancel,
  };
}
