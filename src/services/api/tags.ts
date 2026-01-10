/**
 * 标签管理相关 API
 */

import { invoke } from '@tauri-apps/api/core';
import type { Tag, TagWithCount } from '@/types';

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
