/**
 * 扫描和索引相关 API
 */

import { invoke } from '@tauri-apps/api/core';
import type { Photo, IndexResult } from '@/types';
import type { DatabaseStats, RefreshMetadataResult } from './types';

/**
 * 扫描单个目录
 */
export async function scanDirectory(path: string): Promise<Photo[]> {
  return invoke<Photo[]>('scan_directory', { path });
}

/**
 * 扫描多个目录
 */
export async function scanDirectories(paths: string[]): Promise<Photo[]> {
  return invoke<Photo[]>('scan_directories', { paths });
}

/**
 * 索引目录（扫描并存储到数据库）
 */
export async function indexDirectory(path: string): Promise<IndexResult> {
  return invoke<IndexResult>('index_directory', { path });
}

/**
 * 索引多个目录
 */
export async function indexDirectories(paths: string[]): Promise<IndexResult> {
  return invoke<IndexResult>('index_directories', { paths });
}

/**
 * 获取数据库统计信息
 */
export async function getDatabaseStats(): Promise<DatabaseStats> {
  return invoke<DatabaseStats>('get_database_stats');
}

/**
 * 刷新照片元数据（重新解析日期）
 */
export async function refreshPhotoMetadata(): Promise<RefreshMetadataResult> {
  return invoke<RefreshMetadataResult>('refresh_photo_metadata');
}
