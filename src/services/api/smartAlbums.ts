/**
 * 智能相册 API
 */

import { invoke } from '@tauri-apps/api/core';
import type { SearchFilters } from '@/types';

/**
 * 智能相册
 */
export interface SmartAlbum {
  smartAlbumId: number;
  name: string;
  description?: string;
  filters: SearchFilters;
  icon?: string;
  color?: string;
  dateCreated: string;
  dateModified: string;
  sortOrder: number;
}

/**
 * 创建智能相册参数
 */
export interface CreateSmartAlbum {
  name: string;
  description?: string;
  filters: SearchFilters;
  icon?: string;
  color?: string;
}

/**
 * 更新智能相册参数
 */
export interface UpdateSmartAlbum {
  name?: string;
  description?: string;
  filters?: SearchFilters;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

/**
 * 创建智能相册
 */
export async function createSmartAlbum(album: CreateSmartAlbum): Promise<number> {
  return invoke<number>('create_smart_album', { album });
}

/**
 * 获取智能相册
 */
export async function getSmartAlbum(smartAlbumId: number): Promise<SmartAlbum | null> {
  return invoke<SmartAlbum | null>('get_smart_album', { smartAlbumId });
}

/**
 * 获取所有智能相册
 */
export async function getAllSmartAlbums(): Promise<SmartAlbum[]> {
  return invoke<SmartAlbum[]>('get_all_smart_albums');
}

/**
 * 更新智能相册
 */
export async function updateSmartAlbum(
  smartAlbumId: number,
  update: UpdateSmartAlbum
): Promise<boolean> {
  return invoke<boolean>('update_smart_album', { smartAlbumId, update });
}

/**
 * 删除智能相册
 */
export async function deleteSmartAlbum(smartAlbumId: number): Promise<boolean> {
  return invoke<boolean>('delete_smart_album', { smartAlbumId });
}
