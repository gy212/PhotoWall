/**
 * 设置管理相关 API
 */

import { invoke } from '@tauri-apps/api/core';
import type { AppSettings } from '@/types';

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
