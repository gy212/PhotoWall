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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl border border-border">
        {/* 标题 */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-primary font-serif">
            {isScanning && '正在扫描文件...'}
            {isIndexing && '正在索引照片...'}
          </h2>
        </div>

        {/* 扫描进度 */}
        {isScanning && scanProgress && (
          <div className="mb-4 space-y-2">
            <div className="flex justify-between text-sm text-secondary">
              <span>当前目录</span>
              <span className="font-mono text-primary">{scanProgress.scannedCount} 个文件</span>
            </div>
            <div className="text-xs text-tertiary truncate" title={scanProgress.currentDir}>
              {scanProgress.currentDir}
            </div>
            <div className="mt-2 flex justify-between text-sm font-medium">
              <span className="text-primary">
                找到 {scanProgress.foundCount} 张照片
              </span>
            </div>
          </div>
        )}

        {/* 索引进度 */}
        {isIndexing && indexProgress && (
          <div className="mb-4 space-y-2">
            <div className="flex justify-between text-sm text-secondary">
              <span>处理进度</span>
              <span className="font-mono text-primary">
                {indexProgress.processed} / {indexProgress.total}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-element">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${(indexProgress.processed / indexProgress.total) * 100}%`,
                }}
              />
            </div>
            <div className="text-xs text-tertiary truncate" title={indexProgress.currentFile}>
              {indexProgress.currentFile}
            </div>
          </div>
        )}

        {/* 加载动画 */}
        <div className="mb-6 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-element border-t-primary" />
        </div>

        {/* 取消按钮 */}
        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="rounded-xl bg-element px-4 py-2 text-sm font-medium text-secondary hover:bg-hover hover:text-primary transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
