/**
 * API 响应类型定义
 */

/**
 * 命令错误
 */
export interface CommandError {
  code: string;
  message: string;
}

/**
 * 扫描进度事件
 */
export interface ScanProgressEvent {
  /** 当前处理的目录 */
  currentDir: string;
  /** 已扫描文件数 */
  scannedCount: number;
  /** 完成百分比 */
  percentage: number;
}

/**
 * 索引进度事件
 */
export interface IndexProgressEvent {
  /** 已索引数量 */
  indexed: number;
  /** 跳过数量 */
  skipped: number;
  /** 总数 */
  total: number;
  /** 完成百分比 */
  percentage: number;
}

/**
 * 缩略图生成结果
 */
export interface ThumbnailResult {
  /** 缓存路径 */
  path: string;
  /** 是否命中缓存 */
  hitCache: boolean;
}

/**
 * 搜索结果
 */
export interface SearchResult {
  /** 分页照片列表 */
  photos: import('./index').PaginatedResult<import('./index').Photo>;
  /** 搜索耗时（毫秒） */
  elapsedMs: number;
}
