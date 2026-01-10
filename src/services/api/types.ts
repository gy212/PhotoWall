/**
 * API 相关接口定义
 */

import type { PaginatedResult, Photo } from '@/types';

/**
 * 扫描进度信息
 */
export interface ScanProgress {
  current: number;
  total: number;
  currentPath: string;
}

/**
 * 数据库统计
 */
export interface DatabaseStats {
  totalPhotos: number;
  totalTags: number;
  totalAlbums: number;
  databaseSize: number;
}

/**
 * 刷新照片元数据结果
 */
export interface RefreshMetadataResult {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
}

/**
 * 搜索结果
 */
export interface SearchResult {
  photos: PaginatedResult<Photo>;
  elapsedMs: number;
}

/**
 * 照片统计
 */
export interface PhotoStats {
  totalPhotos: number;
  totalFavorites: number;
  totalWithGps: number;
  earliestDate: string | null;
  latestDate: string | null;
}

/**
 * RAW 预览响应
 */
export interface RawPreviewResponse {
  /** Base64 编码的 JPEG 数据 */
  data: string;
  /** 图像宽度 */
  width: number;
  /** 图像高度 */
  height: number;
}

/**
 * 同步文件夹信息
 */
export interface SyncFolder {
  /** 文件夹路径 */
  path: string;
  /** 路径是否有效 */
  isValid: boolean;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 回收站统计信息
 */
export interface TrashStats {
  /** 已删除照片数量 */
  totalCount: number;
  /** 已删除照片总大小 */
  totalSize: number;
}
