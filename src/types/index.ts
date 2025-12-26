/**
 * PhotoWall 核心类型定义
 */

/**
 * 照片信息
 */
export interface Photo {
  /** 照片ID */
  photoId: number;
  /** 文件路径 */
  filePath: string;
  /** 文件名 */
  fileName: string;
  /** 文件大小（字节） */
  fileSize: number;
  /** 文件哈希 */
  fileHash: string;
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
  /** 格式 */
  format?: string;
  /** 拍摄时间 */
  dateTaken?: string;
  /** 添加时间 */
  dateAdded: string;
  /** 修改时间 */
  dateModified?: string;
  /** 相机型号 */
  cameraModel?: string;
  /** 镜头型号 */
  lensModel?: string;
  /** 焦距 */
  focalLength?: number;
  /** 光圈 */
  aperture?: number;
  /** ISO */
  iso?: number;
  /** 快门速度 */
  shutterSpeed?: string;
  /** GPS 纬度 */
  gpsLatitude?: number;
  /** GPS 经度 */
  gpsLongitude?: number;
  /** 方向 */
  orientation?: number;
  /** 评分 (0-5) */
  rating: number;
  /** 是否收藏 */
  isFavorite: boolean;
  /** 是否已删除（软删除） */
  isDeleted: boolean;
  /** 删除时间 */
  deletedAt?: string;
}

/**
 * 标签
 */
export interface Tag {
  /** 标签ID */
  tagId: number;
  /** 标签名 */
  tagName: string;
  /** 标签颜色 */
  color?: string;
  /** 创建时间 */
  dateCreated: string;
}

/**
 * 相册
 */
export interface Album {
  /** 相册ID */
  albumId: number;
  /** 相册名 */
  albumName: string;
  /** 描述 */
  description?: string;
  /** 封面照片ID */
  coverPhotoId?: number;
  /** 创建时间 */
  dateCreated: string;
  /** 排序顺序 */
  sortOrder: number;
}

/**
 * 带照片数量的标签
 */
export interface TagWithCount {
  tag: Tag;
  photoCount: number;
}

/**
 * 带照片数量的相册
 */
export interface AlbumWithCount {
  album: Album;
  photoCount: number;
}

/**
 * 缩略图尺寸
 */
export type ThumbnailSize = 'small' | 'medium' | 'large';

/**
 * 缩略图尺寸配置
 * 为了支持高 DPI 屏幕，尺寸已经提高
 */
export const THUMBNAIL_SIZES: Record<ThumbnailSize, number> = {
  small: 300,   // 提高到 300，支持 2x DPI
  medium: 500,  // 提高到 500，支持高清显示
  large: 800,   // 提高到 800，大图预览
};

/**
 * 排序方式
 */
export type SortOrder = 'asc' | 'desc';

/**
 * 排序字段
 */
export type SortField = 'dateTaken' | 'dateAdded' | 'fileName' | 'fileSize' | 'rating';

/**
 * 排序选项
 */
export interface SortOptions {
  field: SortField;
  order: SortOrder;
}

/**
 * 视图模式
 */
export type ViewMode = 'grid' | 'timeline' | 'detail';

/**
 * 搜索过滤器
 */
export interface SearchFilters {
  /** 搜索查询 */
  query?: string;
  /** 开始日期 */
  dateFrom?: string;
  /** 结束日期 */
  dateTo?: string;
  /** 标签ID列表 */
  tagIds?: number[];
  /** 相册ID */
  albumId?: number;
  /** 相机型号 */
  cameraModel?: string;
  /** 最低评分 */
  minRating?: number;
  /** 仅收藏 */
  favoritesOnly?: boolean;
}

/**
 * 分页参数
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 游标（用于无限滚动的高性能分页）
 */
export interface PhotoCursor {
  /** 当前排序字段的值（string/number/null） */
  sortValue: string | number | null;
  /** 稳定排序 tie-breaker */
  photoId: number;
}

/**
 * 游标分页结果
 */
export interface CursorPageResult<T> {
  items: T[];
  /** 仅在首屏/需要时返回，用于展示总数 */
  total?: number | null;
}

/**
 * 导入选项
 */
export interface ImportOptions {
  /** 要导入的目录列表 */
  paths: string[];
  /** 是否递归扫描子目录 */
  recursive: boolean;
  /** 是否跳过已存在的文件 */
  skipExisting: boolean;
  /** 是否检测重复文件 */
  detectDuplicates: boolean;
}

/**
 * 索引结果
 */
export interface IndexResult {
  /** 成功索引的照片数 */
  indexed: number;
  /** 跳过的照片数 */
  skipped: number;
  /** 失败的照片数 */
  failed: number;
  /** 失败的文件列表 */
  failedFiles: string[];
}

/**
 * 导出选项
 */
export interface ExportOptions {
  /** 照片ID列表 */
  photoIds: number[];
  /** 导出目标目录 */
  destination: string;
  /** 是否保留目录结构 */
  preserveStructure: boolean;
  /** 是否覆盖已存在的文件 */
  overwrite: boolean;
}

/**
 * 导出结果
 */
export interface ExportResult {
  /** 成功导出的文件数 */
  exported: number;
  /** 跳过的文件数 */
  skipped: number;
  /** 失败的文件数 */
  failed: number;
  /** 失败的文件列表 */
  failedFiles: string[];
}

/**
 * 批量重命名选项
 */
export interface BatchRenameOptions {
  /** 照片ID列表 */
  photoIds: number[];
  /** 命名模式 (支持变量: {index}, {name}, {date}) */
  pattern: string;
  /** 起始索引 */
  startIndex: number;
}

/**
 * 批量重命名结果
 */
export interface BatchRenameResult {
  /** 成功重命名的数量 */
  renamed: number;
  /** 失败的数量 */
  failed: number;
  /** 失败的文件列表 */
  failedFiles: string[];
}

/**
 * 主题模式
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * 扫描设置
 */
export interface ScanSettings {
  /** 监控的文件夹列表 */
  watchedFolders: string[];
  /** 排除的文件夹模式 */
  excludedPatterns: string[];
  /** 是否启用自动扫描 */
  autoScan: boolean;
  /** 扫描间隔（秒） */
  scanInterval: number;
  /** 是否递归扫描子文件夹 */
  recursive: boolean;
}

/**
 * 缩略图设置
 */
export interface ThumbnailSettings {
  /** 缓存大小限制（MB） */
  cacheSizeMb: number;
  /** 缩略图质量 (0-100) */
  quality: number;
  /** 是否启用自动清理 */
  autoCleanup: boolean;
  /** 清理阈值（百分比） */
  cleanupThreshold: number;
}

/**
 * 性能设置
 */
export interface PerformanceSettings {
  /** 扫描线程数（0 = 自动） */
  scanThreads: number;
  /** 缩略图生成线程数（0 = 自动） */
  thumbnailThreads: number;
  /** 是否启用数据库 WAL 模式 */
  enableWal: boolean;
}

export interface WindowSettings {
  /** 窗口背景不透明度 (0.0 - 1.0) */
  opacity: number;
  /** 窗口透明度 (0-100) */
  transparency: number;
}

/**
 * 应用程序设置
 */
export interface AppSettings {
  /** 主题模式 */
  theme: ThemeMode;
  /** 语言 */
  language: string;
  /** 扫描设置 */
  scan: ScanSettings;
  /** 缩略图设置 */
  thumbnail: ThumbnailSettings;
  /** 性能设置 */
  performance: PerformanceSettings;
  /** 窗口设置 */
  window: WindowSettings;
}

// ============ 文件夹视图类型 ============

/**
 * 文件夹节点
 */
export interface FolderNode {
  /** 文件夹路径 */
  path: string;
  /** 文件夹名称 */
  name: string;
  /** 直接包含的照片数量 */
  photoCount: number;
  /** 包含子文件夹的总照片数量 */
  totalPhotoCount: number;
  /** 子文件夹列表 */
  children: FolderNode[];
  /** 是否已加载子文件夹 */
  loaded: boolean;
}

/**
 * 文件夹统计信息
 */
export interface FolderStats {
  /** 总文件夹数 */
  totalFolders: number;
  /** 总照片数 */
  totalPhotos: number;
  /** 根文件夹列表 */
  rootFolders: FolderNode[];
}

// ============ 宽高比分类 ============

/**
 * 宽高比分类
 * - normal: 普通图片
 * - wide: 超宽图（宽高比 > 2:1）
 * - tall: 超长图（宽高比 < 1:2）
 */
export type AspectRatioCategory = 'normal' | 'wide' | 'tall';

/**
 * 获取图片的宽高比分类
 */
export function getAspectRatioCategory(width?: number, height?: number): AspectRatioCategory {
  if (!width || !height) return 'normal';
  const ratio = width / height;
  if (ratio > 2) return 'wide';
  if (ratio < 0.5) return 'tall';
  return 'normal';
}
