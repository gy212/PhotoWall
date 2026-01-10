/**
 * 文件操作相关 API
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  ImportOptions,
  IndexResult,
  ExportOptions,
  ExportResult,
  BatchRenameOptions,
  BatchRenameResult,
} from '@/types';

/**
 * 导入照片（就地索引）
 */
export async function importPhotos(options: ImportOptions): Promise<IndexResult> {
  return invoke<IndexResult>('import_photos', { options });
}

/**
 * 导出照片
 */
export async function exportPhotos(options: ExportOptions): Promise<ExportResult> {
  return invoke<ExportResult>('export_photos', { options });
}

/**
 * 删除照片（默认移至回收站）
 */
export async function deletePhotos(photoIds: number[], permanent = false): Promise<number> {
  return invoke<number>('delete_photos', { photoIds, permanent });
}

/**
 * 移动照片
 */
export async function movePhoto(photoId: number, newPath: string): Promise<boolean> {
  return invoke<boolean>('move_photo', { photoId, newPath });
}

/**
 * 复制照片
 */
export async function copyPhoto(photoId: number, newPath: string): Promise<number> {
  return invoke<number>('copy_photo', { photoId, newPath });
}

/**
 * 批量重命名照片
 */
export async function batchRenamePhotos(options: BatchRenameOptions): Promise<BatchRenameResult> {
  return invoke<BatchRenameResult>('batch_rename_photos', { options });
}
