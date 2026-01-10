/**
 * 文件夹视图相关 API
 */

import { invoke } from '@tauri-apps/api/core';
import type { Photo, PaginationParams, PaginatedResult, FolderNode, FolderStats, SortOptions } from '@/types';

/**
 * 获取文件夹树结构
 */
export async function getFolderTree(): Promise<FolderStats> {
  return invoke<FolderStats>('get_folder_tree');
}

/**
 * 获取指定文件夹的子文件夹
 */
export async function getFolderChildren(folderPath: string): Promise<FolderNode[]> {
  return invoke<FolderNode[]>('get_folder_children', { folderPath });
}

/**
 * 获取指定文件夹中的照片
 */
export async function getPhotosByFolder(
  folderPath: string,
  includeSubfolders: boolean,
  pagination: PaginationParams,
  sort?: SortOptions
): Promise<PaginatedResult<Photo>> {
  return invoke<PaginatedResult<Photo>>('get_photos_by_folder', {
    folderPath,
    includeSubfolders,
    pagination,
    sort,
  });
}

/**
 * 获取文件夹的照片数量
 */
export async function getFolderPhotoCount(
  folderPath: string,
  includeSubfolders: boolean
): Promise<number> {
  return invoke<number>('get_folder_photo_count', { folderPath, includeSubfolders });
}
