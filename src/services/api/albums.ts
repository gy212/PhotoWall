/**
 * 相册管理相关 API
 */

import { invoke } from '@tauri-apps/api/core';
import type { Album, AlbumWithCount, RecentlyEditedAlbum } from '@/types';

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

/**
 * 获取最近编辑的相册
 */
export async function getRecentlyEditedAlbum(): Promise<RecentlyEditedAlbum | null> {
  return invoke<RecentlyEditedAlbum | null>('get_recently_edited_album');
}
