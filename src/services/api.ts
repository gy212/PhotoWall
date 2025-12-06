/**
 * Tauri IPC 服务封装
 *
 * 封装所有与 Rust 后端的通信
 */

import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import type {
  Photo,
  Tag,
  Album,
  TagWithCount,
  AlbumWithCount,
  SearchFilters,
  PaginationParams,
  PaginatedResult,
  SortOptions,
  ImportOptions,
  IndexResult,
  ExportOptions,
  ExportResult,
  BatchRenameOptions,
  BatchRenameResult,
  AppSettings,
  FolderNode,
  FolderStats,
} from '@/types';

// ============ 扫描和索引 ============

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
 * 刷新照片元数据结果
 */
export interface RefreshMetadataResult {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
}

/**
 * 刷新照片元数据（重新解析日期）
 */
export async function refreshPhotoMetadata(): Promise<RefreshMetadataResult> {
  return invoke<RefreshMetadataResult>('refresh_photo_metadata');
}

// ============ 照片查询 ============

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
 * 搜索照片（高级搜索）
 */
export async function searchPhotos(
  filters: SearchFilters,
  pagination: PaginationParams,
  sort: SortOptions
): Promise<SearchResult> {
  return invoke<SearchResult>('search_photos', { filters, pagination, sort });
}

/**
 * 简单文本搜索
 */
export async function searchPhotosSimple(
  query: string,
  pagination: PaginationParams
): Promise<PaginatedResult<Photo>> {
  return invoke<PaginatedResult<Photo>>('search_photos_simple', { query, pagination });
}

/**
 * 获取照片详情
 */
export async function getPhoto(photoId: number): Promise<Photo | null> {
  return invoke<Photo | null>('get_photo', { photoId });
}

/**
 * 获取照片列表（分页）
 */
export async function getPhotos(
  pagination: PaginationParams,
  sort: SortOptions
): Promise<PaginatedResult<Photo>> {
  return invoke<PaginatedResult<Photo>>('get_photos', { pagination, sort });
}

/**
 * 获取收藏的照片
 */
export async function getFavoritePhotos(
  pagination: PaginationParams
): Promise<PaginatedResult<Photo>> {
  return invoke<PaginatedResult<Photo>>('get_favorite_photos', { pagination });
}

/**
 * 根据标签获取照片
 */
export async function getPhotosByTag(
  tagId: number,
  pagination: PaginationParams,
  sort: SortOptions
): Promise<PaginatedResult<Photo>> {
  return invoke<PaginatedResult<Photo>>('get_photos_by_tag', { tagId, pagination, sort });
}

/**
 * 根据相册获取照片
 */
export async function getPhotosByAlbum(
  albumId: number,
  pagination: PaginationParams
): Promise<PaginatedResult<Photo>> {
  return invoke<PaginatedResult<Photo>>('get_photos_by_album', { albumId, pagination });
}

/**
 * 设置照片评分
 */
export async function setPhotoRating(photoId: number, rating: number): Promise<boolean> {
  return invoke<boolean>('set_photo_rating', { photoId, rating });
}

/**
 * 设置照片收藏状态
 */
export async function setPhotoFavorite(photoId: number, isFavorite: boolean): Promise<boolean> {
  return invoke<boolean>('set_photo_favorite', { photoId, isFavorite });
}

/**
 * 批量设置照片收藏状态
 */
export async function setPhotosFavorite(photoIds: number[], isFavorite: boolean): Promise<number> {
  return invoke<number>('set_photos_favorite', { photoIds, isFavorite });
}

/**
 * 获取相机型号列表
 */
export async function getCameraModels(): Promise<string[]> {
  return invoke<string[]>('get_camera_models');
}

/**
 * 获取镜头型号列表
 */
export async function getLensModels(): Promise<string[]> {
  return invoke<string[]>('get_lens_models');
}

/**
 * 获取照片统计信息
 */
export async function getPhotoStats(): Promise<PhotoStats> {
  return invoke<PhotoStats>('get_photo_stats');
}

// ============ 标签管理 ============

/**
 * 创建标签
 */
export async function createTag(tagName: string, color?: string): Promise<number> {
  return invoke<number>('create_tag', { tagName, color });
}

/**
 * 获取标签
 */
export async function getTag(tagId: number): Promise<Tag | null> {
  return invoke<Tag | null>('get_tag', { tagId });
}

/**
 * 根据名称获取标签
 */
export async function getTagByName(tagName: string): Promise<Tag | null> {
  return invoke<Tag | null>('get_tag_by_name', { tagName });
}

/**
 * 更新标签
 */
export async function updateTag(tagId: number, tagName: string, color?: string): Promise<boolean> {
  return invoke<boolean>('update_tag', { tagId, tagName, color });
}

/**
 * 删除标签
 */
export async function deleteTag(tagId: number): Promise<boolean> {
  return invoke<boolean>('delete_tag', { tagId });
}

/**
 * 获取所有标签
 */
export async function getAllTags(): Promise<Tag[]> {
  return invoke<Tag[]>('get_all_tags');
}

/**
 * 获取所有标签（带照片数量）
 */
export async function getAllTagsWithCount(): Promise<TagWithCount[]> {
  return invoke<TagWithCount[]>('get_all_tags_with_count');
}

/**
 * 为照片添加标签
 */
export async function addTagToPhoto(photoId: number, tagId: number): Promise<boolean> {
  return invoke<boolean>('add_tag_to_photo', { photoId, tagId });
}

/**
 * 为照片添加多个标签
 */
export async function addTagsToPhoto(photoId: number, tagIds: number[]): Promise<boolean> {
  return invoke<boolean>('add_tags_to_photo', { photoId, tagIds });
}

/**
 * 从照片移除标签
 */
export async function removeTagFromPhoto(photoId: number, tagId: number): Promise<boolean> {
  return invoke<boolean>('remove_tag_from_photo', { photoId, tagId });
}

/**
 * 移除照片的所有标签
 */
export async function removeAllTagsFromPhoto(photoId: number): Promise<boolean> {
  return invoke<boolean>('remove_all_tags_from_photo', { photoId });
}

/**
 * 获取照片的所有标签
 */
export async function getTagsForPhoto(photoId: number): Promise<Tag[]> {
  return invoke<Tag[]>('get_tags_for_photo', { photoId });
}

/**
 * 获取或创建标签
 */
export async function getOrCreateTag(tagName: string, color?: string): Promise<Tag> {
  return invoke<Tag>('get_or_create_tag', { tagName, color });
}

/**
 * 批量为照片添加标签
 */
export async function addTagToPhotos(photoIds: number[], tagId: number): Promise<number> {
  return invoke<number>('add_tag_to_photos', { photoIds, tagId });
}

/**
 * 批量从照片移除标签
 */
export async function removeTagFromPhotos(photoIds: number[], tagId: number): Promise<number> {
  return invoke<number>('remove_tag_from_photos', { photoIds, tagId });
}

// ============ 相册管理 ============

/**
 * 创建相册
 */
export async function createAlbum(albumName: string, description?: string): Promise<number> {
  return invoke<number>('create_album', { albumName, description });
}

/**
 * 获取相册
 */
export async function getAlbum(albumId: number): Promise<Album | null> {
  return invoke<Album | null>('get_album', { albumId });
}

/**
 * 根据名称获取相册
 */
export async function getAlbumByName(albumName: string): Promise<Album | null> {
  return invoke<Album | null>('get_album_by_name', { albumName });
}

/**
 * 更新相册
 */
export async function updateAlbum(
  albumId: number,
  albumName: string,
  description?: string
): Promise<boolean> {
  return invoke<boolean>('update_album', { albumId, albumName, description });
}

/**
 * 删除相册
 */
export async function deleteAlbum(albumId: number): Promise<boolean> {
  return invoke<boolean>('delete_album', { albumId });
}

/**
 * 获取所有相册
 */
export async function getAllAlbums(): Promise<Album[]> {
  return invoke<Album[]>('get_all_albums');
}

/**
 * 获取所有相册（带照片数量）
 */
export async function getAllAlbumsWithCount(): Promise<AlbumWithCount[]> {
  return invoke<AlbumWithCount[]>('get_all_albums_with_count');
}

/**
 * 添加照片到相册
 */
export async function addPhotoToAlbum(albumId: number, photoId: number): Promise<boolean> {
  return invoke<boolean>('add_photo_to_album', { albumId, photoId });
}

/**
 * 批量添加照片到相册
 */
export async function addPhotosToAlbum(albumId: number, photoIds: number[]): Promise<number> {
  return invoke<number>('add_photos_to_album', { albumId, photoIds });
}

/**
 * 从相册移除照片
 */
export async function removePhotoFromAlbum(albumId: number, photoId: number): Promise<boolean> {
  return invoke<boolean>('remove_photo_from_album', { albumId, photoId });
}

/**
 * 批量从相册移除照片
 */
export async function removePhotosFromAlbum(albumId: number, photoIds: number[]): Promise<number> {
  return invoke<number>('remove_photos_from_album', { albumId, photoIds });
}

/**
 * 移除相册中的所有照片
 */
export async function removeAllPhotosFromAlbum(albumId: number): Promise<boolean> {
  return invoke<boolean>('remove_all_photos_from_album', { albumId });
}

/**
 * 获取相册中的照片ID列表
 */
export async function getPhotoIdsInAlbum(albumId: number): Promise<number[]> {
  return invoke<number[]>('get_photo_ids_in_album', { albumId });
}

/**
 * 获取照片所在的相册
 */
export async function getAlbumsForPhoto(photoId: number): Promise<Album[]> {
  return invoke<Album[]>('get_albums_for_photo', { photoId });
}

/**
 * 设置相册封面
 */
export async function setAlbumCover(albumId: number, photoId: number): Promise<boolean> {
  return invoke<boolean>('set_album_cover', { albumId, photoId });
}

/**
 * 重新排序相册中的照片
 */
export async function reorderAlbumPhotos(albumId: number, photoIds: number[]): Promise<boolean> {
  return invoke<boolean>('reorder_album_photos', { albumId, photoIds });
}

// ============ 工具函数 ============

/**
 * 将本地文件路径转换为可在 WebView 中使用的 URL
 */
export function getAssetUrl(filePath: string): string {
  return convertFileSrc(filePath);
}

/**
 * 获取缩略图路径
 * 缩略图存储在 %AppData%/PhotoWall/Thumbnails/{size}/{hash}.webp
 */
export function getThumbnailPath(
  fileHash: string,
  size: 'small' | 'medium' | 'large' = 'medium'
): string {
  // 这个路径会在运行时由 Tauri 解析
  // 实际使用时需要通过后端获取完整路径
  return `thumbnails/${size}/${fileHash}.webp`;
}

// ============ Greet（测试用） ============

/**
 * 调用 greet 命令（测试用）
 */
export async function greet(name: string): Promise<string> {
  return invoke<string>('greet', { name });
}

// ============ 文件操作 ============

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

// ============ 设置管理 ============

/**
 * 获取应用程序设置
 */
export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>('get_settings');
}

/**
 * 保存应用程序设置
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke<void>('save_settings', { settings });
}

/**
 * 重置设置为默认值
 */
export async function resetSettings(): Promise<AppSettings> {
  return invoke<AppSettings>('reset_settings');
}

// ============ 文件夹同步 ============

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
 * 获取所有同步文件夹
 */
export async function getSyncFolders(): Promise<SyncFolder[]> {
  return invoke<SyncFolder[]>('get_sync_folders');
}

/**
 * 添加同步文件夹
 */
export async function addSyncFolder(folderPath: string): Promise<boolean> {
  return invoke<boolean>('add_sync_folder', { folderPath });
}

/**
 * 删除同步文件夹
 */
export async function removeSyncFolder(folderPath: string): Promise<boolean> {
  return invoke<boolean>('remove_sync_folder', { folderPath });
}

/**
 * 设置自动同步开关
 */
export async function setAutoSyncEnabled(enabled: boolean): Promise<boolean> {
  return invoke<boolean>('set_auto_sync_enabled', { enabled });
}

/**
 * 获取自动同步状态
 */
export async function getAutoSyncEnabled(): Promise<boolean> {
  return invoke<boolean>('get_auto_sync_enabled');
}

/**
 * 立即触发同步
 */
export async function triggerSyncNow(): Promise<number> {
  return invoke<number>('trigger_sync_now');
}

/**
 * 验证文件夹路径是否有效
 */
export async function validateFolderPath(folderPath: string): Promise<boolean> {
  return invoke<boolean>('validate_folder_path', { folderPath });
}

// ============ 回收站功能 ============

/**
 * 回收站统计信息
 */
export interface TrashStats {
  /** 已删除照片数量 */
  totalCount: number;
  /** 已删除照片总大小 */
  totalSize: number;
}

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

// ============ 文件夹视图 ============

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
