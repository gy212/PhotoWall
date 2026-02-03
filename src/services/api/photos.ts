/**
 * 照片查询相关 API
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  Photo,
  SearchFilters,
  PaginationParams,
  PaginatedResult,
  PhotoCursor,
  CursorPageResult,
  SortOptions,
} from '@/types';
import type { SearchResult, PhotoStats } from './types';

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
 * 搜索照片（游标分页，用于无限滚动）
 */
export async function searchPhotosCursor(
  filters: SearchFilters,
  limit: number,
  cursor: PhotoCursor | null,
  sort: SortOptions,
  includeTotal: boolean
): Promise<CursorPageResult<Photo>> {
  return invoke<CursorPageResult<Photo>>('search_photos_cursor', {
    filters,
    limit,
    cursor,
    sort,
    includeTotal,
  });
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
 * 获取照片列表（游标分页，用于无限滚动）
 */
export async function getPhotosCursor(
  limit: number,
  cursor: PhotoCursor | null,
  sort: SortOptions,
  includeTotal: boolean
): Promise<CursorPageResult<Photo>> {
  return invoke<CursorPageResult<Photo>>('get_photos_cursor', {
    limit,
    cursor,
    sort,
    includeTotal,
  });
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

/**
 * 获取最近编辑的照片
 */
export async function getRecentlyEditedPhoto(): Promise<Photo | null> {
  return invoke<Photo | null>('get_recently_edited_photo');
}

/**
 * 搜索建议项
 */
export interface SearchSuggestionItem {
  /** 建议类型: file, camera, lens, tag */
  suggestionType: string;
  /** 建议文本 */
  text: string;
  /** 显示标签 */
  label?: string;
}

/**
 * 获取搜索建议
 */
export async function getSearchSuggestions(
  prefix: string,
  limit?: number
): Promise<SearchSuggestionItem[]> {
  return invoke<SearchSuggestionItem[]>('get_search_suggestions', { prefix, limit });
}
