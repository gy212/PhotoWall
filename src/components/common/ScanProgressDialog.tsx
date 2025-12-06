/**
 * 扫描进度对话框
 *
 * 显示文件扫描和索引的实时进度
 */

import type { ScanProgress, IndexProgress } from '@/hooks/useScanner';

interface ScanProgressDialogProps {
  open: boolean;
  isScanning: boolean;
  isIndexing: boolean;
  scanProgress: ScanProgress | null;
  indexProgress: IndexProgress | null;
  onCancel: () => void;
}

export function ScanProgressDialog({
  open,
  isScanning,
  isIndexing,
  scanProgress,
  indexProgress,
  onCancel,
}: ScanProgressDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        {/* 标题 */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isScanning && '正在扫描文件...'}
            {isIndexing && '正在索引照片...'}
          </h2>
        </div>

        {/* 扫描进度 */}
        {isScanning && scanProgress && (
          <div className="mb-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>当前目录</span>
              <span className="font-mono">{scanProgress.scannedCount} 个文件</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              {scanProgress.currentDir}
            </div>
            <div className="mt-2 flex justify-between text-sm font-medium">
              <span className="text-blue-600 dark:text-blue-400">
                找到 {scanProgress.foundCount} 张照片
              </span>
            </div>
          </div>
        )}

        {/* 索引进度 */}
        {isIndexing && indexProgress && (
          <div className="mb-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>处理进度</span>
              <span className="font-mono">
                {indexProgress.processed} / {indexProgress.total}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full bg-blue-600 transition-all duration-300 dark:bg-blue-500"
                style={{
                  width: `${(indexProgress.processed / indexProgress.total) * 100}%`,
                }}
              />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              {indexProgress.currentFile}
            </div>
          </div>
        )}

        {/* 加载动画 */}
        <div className="mb-4 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-500" />
        </div>

        {/* 取消按钮 */}
        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
