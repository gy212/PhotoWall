import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { Icon } from '@/components/common/Icon';
import { importPhotos } from '@/services/api/fileOps';
import { ScanProgressDialog } from '@/components/common/ScanProgressDialog';
import type { IndexProgress } from '@/hooks/useScanner';
import clsx from 'clsx';
import { useQueryClient } from '@tanstack/react-query';

// 一级页面路径白名单
const ALLOWED_PATHS = ['/', '/albums', '/tags', '/folders', '/favorites'];

export function ImportFab() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<IndexProgress | null>(null);

  // 判断是否显示 FAB
  const isVisible = useMemo(() => {
    // 精确匹配或者是以这些路径开头的（防止例如 /albums/details 被误判? 用户说二级页面不要出现）
    // 用户说“在其他二级页面不要出现”，所以应该是精确匹配
    // 但是 /albums 可能是 /albums，而 /albums/123 是二级
    // 所以检查 exact match
    return ALLOWED_PATHS.includes(location.pathname);
  }, [location.pathname]);

  // 监听导入进度
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await listen<IndexProgress>('import-progress', (event) => {
        setImportProgress(event.payload);
      });
    };

    if (isImporting) {
      setupListener();
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, [isImporting]);

  const handleImport = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
        title: '选择要导入的文件夹',
      });

      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      if (paths.length === 0) return;

      setIsImporting(true);
      setImportProgress({
        total: 0,
        processed: 0,
        indexed: 0,
        skipped: 0,
        failed: 0,
        percentage: 0,
        currentFile: '准备中...'
      });

      await importPhotos({
        paths,
        recursive: true,
        skipExisting: true,
        detectDuplicates: true,
      });

      // 导入完成，刷新相关查询
      queryClient.invalidateQueries({ queryKey: ['photoFeed'] });
      queryClient.invalidateQueries({ queryKey: ['recentPhotos'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });

    } catch (error) {
      console.error('Import failed:', error);
      // TODO: Show error toast
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const handleCancel = () => {
    // 目前后端可能不支持取消，但前端可以关闭对话框
    // TODO: 调用后端 cancel_import 命令如果存在
    setIsImporting(false);
    setImportProgress(null);
  };

  if (!isVisible && !isImporting) return null;

  return (
    <>
      {/* FAB 按钮 */}
      <div 
        className={clsx(
          "fixed bottom-8 right-8 z-40 transition-all duration-300 ease-in-out",
          isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none"
        )}
      >
        <button
          onClick={handleImport}
          className="group flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-primary/40 active:scale-95"
          title="快速导入文件夹"
        >
          <Icon 
            name="add_photo_alternate" 
            className="text-2xl text-white transition-all duration-300 group-hover:scale-110" 
          />
        </button>
      </div>

      {/* 进度对话框 */}
      <ScanProgressDialog
        open={isImporting}
        isScanning={false}
        isIndexing={true}
        scanProgress={null}
        indexProgress={importProgress}
        onCancel={handleCancel}
      />
    </>
  );
}
