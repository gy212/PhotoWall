/**
 * OCR 文字识别相关 API
 */

import { invoke } from '@tauri-apps/api/core';
import type { OcrProgress, OcrStats } from '@/types';

/**
 * 检查 Tesseract OCR 是否可用
 */
export async function checkOcrAvailable(): Promise<boolean> {
  return invoke<boolean>('check_ocr_available');
}

/**
 * 获取可用的 OCR 语言列表
 */
export async function getOcrLanguages(): Promise<string[]> {
  return invoke<string[]>('get_ocr_languages');
}

/**
 * 获取 OCR 统计信息
 */
export async function getOcrStats(): Promise<OcrStats> {
  return invoke<OcrStats>('get_ocr_stats');
}

/**
 * 获取 OCR 处理进度
 */
export async function getOcrProgress(): Promise<OcrProgress> {
  return invoke<OcrProgress>('get_ocr_progress');
}

/**
 * 启动 OCR 后台处理
 * @param batchSize 批量处理大小（可选，默认 10）
 * @param language OCR 语言（可选，默认 "chi_sim+eng"）
 */
export async function startOcrProcessing(
  batchSize?: number,
  language?: string
): Promise<OcrProgress> {
  return invoke<OcrProgress>('start_ocr_processing', { batchSize, language });
}

/**
 * 停止 OCR 处理
 */
export async function stopOcrProcessing(): Promise<void> {
  return invoke<void>('stop_ocr_processing');
}

/**
 * 对单张照片执行 OCR
 * @param photoId 照片 ID
 */
export async function ocrSinglePhoto(photoId: number): Promise<string> {
  return invoke<string>('ocr_single_photo', { photoId });
}

/**
 * 重置所有照片的 OCR 状态
 */
export async function resetOcrStatus(): Promise<number> {
  return invoke<number>('reset_ocr_status');
}

/**
 * 重置失败的 OCR 状态（用于重试）
 */
export async function resetFailedOcr(): Promise<number> {
  return invoke<number>('reset_failed_ocr');
}
