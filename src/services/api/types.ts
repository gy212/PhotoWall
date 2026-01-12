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
 * 自动扫描状态
 */
export interface AutoScanStatus {
  /** 是否正在运行 */
  running: boolean;
  /** 是否正在扫描 */
  scanning: boolean;
  /** 监控的路径列表 */
  watchedPaths: string[];
  /** 是否启用实时监控 */
  realtimeWatch: boolean;
  /** 实际正在监控的路径列表（实时监控关闭时可能为空） */
  activeWatchPaths: string[];
}

/**
 * 目录扫描状态
 */
export interface DirectoryScanState {
  /** 目录 ID */
  dirId: number;
  /** 目录路径 */
  dirPath: string;
  /** 最后扫描时间 */
  lastScan: string | null;
  /** 是否活跃 */
  isActive: boolean;
  /** 最后变化时间 */
  lastChangeTime: string | null;
  /** 连续无变化次数 */
  noChangeCount: number;
  /** 扫描倍率 */
  scanMultiplier: number;
  /** 下次扫描时间 */
  nextScanTime: string | null;
  /** 文件数量 */
  fileCount: number;
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
