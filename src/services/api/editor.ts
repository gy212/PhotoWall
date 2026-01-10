/**
 * 照片编辑相关 API
 */

import { invoke } from '@tauri-apps/api/core';
import type { Photo, EditParams } from '@/types';

/**
 * 检查照片是否可编辑（非 RAW 格式）
 */
export async function isPhotoEditable(filePath: string): Promise<boolean> {
  return invoke<boolean>('is_photo_editable', { filePath });
}

/**
 * 应用编辑并保存照片
 * @param photoId 照片ID
 * @param params 编辑参数
 * @param saveAsCopy 是否另存为副本
 * @returns 更新后的照片信息
 */
export async function applyPhotoEdits(
  photoId: number,
  params: EditParams,
  saveAsCopy: boolean = false
): Promise<Photo> {
  return invoke<Photo>('apply_photo_edits', { photoId, params, saveAsCopy });
}

/**
 * 获取编辑预览（Base64 编码的图像）
 * @param sourcePath 源文件路径
 * @param params 编辑参数
 * @param maxSize 预览最大尺寸
 * @returns Base64 编码的 JPEG 图像
 */
export async function getEditPreview(
  sourcePath: string,
  params: EditParams,
  maxSize?: number
): Promise<string> {
  return invoke<string>('get_edit_preview', { sourcePath, params, maxSize });
}
