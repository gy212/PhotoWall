/**
 * 工具函数
 */

import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { RawPreviewResponse } from './types';

/**
 * 将本地文件路径转换为可在 WebView 中使用的 URL
 */
export function getAssetUrl(filePath: string): string {
  return convertFileSrc(filePath);
}

/**
 * 获取 RAW 图像的预览
 */
export async function getRawPreview(sourcePath: string): Promise<RawPreviewResponse> {
  return invoke<RawPreviewResponse>('get_raw_preview', { sourcePath });
}

/**
 * 判断文件是否为 RAW 格式
 */
export function isRawFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return [
    'dng', 'cr2', 'cr3', 'nef', 'nrw', 'arw', 'srf', 'sr2',
    'orf', 'raf', 'rw2', 'pef', 'srw', 'raw', 'rwl', '3fr',
    'erf', 'kdc', 'dcr', 'x3f'
  ].includes(ext);
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

/**
 * 调用 greet 命令（测试用）
 */
export async function greet(name: string): Promise<string> {
  return invoke<string>('greet', { name });
}
