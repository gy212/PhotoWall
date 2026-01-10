/**
 * 回收站功能相关 API
 */

import { invoke } from '@tauri-apps/api/core';
import type { Photo, PaginationParams, PaginatedResult } from '@/types';
import type { TrashStats } from './types';

export type { TrashStats };

/**
 * 获取已删除的照片（回收站）
 */
export async function getDeletedPhotos(
  pagination: PaginationParams
): Promise<PaginatedResult<Photo>> {
  return invoke<PaginatedResult<Photo>>('get_deleted_photos', { pagination });
}

/**
 * 软删除照片（移入回收站）
 */
export async function softDeletePhotos(photoIds: number[]): Promise<number> {
  return invoke<number>('soft_delete_photos', { photoIds });
}

/**
 * 恢复照片（从回收站恢复）
 */
export async function restorePhotos(photoIds: number[]): Promise<number> {
  return invoke<number>('restore_photos', { photoIds });
}

/**
 * 永久删除照片（彻底删除）
 */
export async function permanentDeletePhotos(photoIds: number[]): Promise<number> {
  return invoke<number>('permanent_delete_photos', { photoIds });
}

/**
 * 清空回收站
 */
export async function emptyTrash(): Promise<number> {
  return invoke<number>('empty_trash');
}

/**
 * 获取回收站统计信息
 */
export async function getTrashStats(): Promise<TrashStats> {
  return invoke<TrashStats>('get_trash_stats');
}
