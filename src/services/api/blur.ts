/**
 * 桌面模糊和 Composition Backdrop 相关 API
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * 获取模糊的桌面背景
 * @param blurRadius 模糊半径 (0-100)
 * @param scaleFactor 缩放因子 (0.1-1.0)，用于性能优化
 * @returns Base64编码的PNG图像
 */
export async function getBlurredDesktop(
  blurRadius: number,
  scaleFactor?: number
): Promise<string> {
  return invoke<string>('get_blurred_desktop', { blurRadius, scaleFactor });
}

/**
 * 设置窗口是否从屏幕捕获中排除
 */
export async function setExcludeFromCapture(exclude: boolean): Promise<void> {
  return invoke<void>('set_exclude_from_capture', { exclude });
}

/**
 * 清除模糊缓存
 */
export async function clearBlurCache(): Promise<void> {
  return invoke<void>('clear_blur_cache');
}

// ============ Composition Backdrop (Windows 11+) ============

/**
 * 检查是否支持 Composition Backdrop (Windows 11+)
 */
export async function isCompositionBlurSupported(): Promise<boolean> {
  return invoke<boolean>('is_composition_blur_supported');
}

/**
 * 启用 Composition Backdrop 模糊
 */
export async function enableCompositionBlur(): Promise<void> {
  return invoke<void>('enable_composition_blur');
}

/**
 * 禁用 Composition Backdrop 模糊
 */
export async function disableCompositionBlur(): Promise<void> {
  return invoke<void>('disable_composition_blur');
}

/**
 * 设置 Composition Backdrop 模糊半径
 * @param radius 模糊半径 (0-100)
 * @param scaleFactor DPI 缩放因子
 */
export async function setCompositionBlurRadius(
  radius: number,
  scaleFactor?: number
): Promise<void> {
  return invoke<void>('set_composition_blur_radius', { radius, scaleFactor });
}

/**
 * 设置 Composition Backdrop tint 颜色
 * @param r 红色 (0-255)
 * @param g 绿色 (0-255)
 * @param b 蓝色 (0-255)
 * @param opacity 不透明度 (0.0-1.0)
 */
export async function setCompositionTint(
  r: number,
  g: number,
  b: number,
  opacity: number
): Promise<void> {
  return invoke<void>('set_composition_tint', { r, g, b, opacity });
}
