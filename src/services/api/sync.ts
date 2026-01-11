/**
 * 文件夹同步相关 API
 */

import { invoke } from '@tauri-apps/api/core';
import type { SyncFolder, AutoScanStatus, DirectoryScanState } from './types';

export type { SyncFolder, AutoScanStatus, DirectoryScanState };

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

// ==================== 自动扫描 API ====================

/**
 * 启动自动扫描服务
 */
export async function startAutoScan(): Promise<void> {
  return invoke<void>('start_auto_scan');
}

/**
 * 停止自动扫描服务
 */
export async function stopAutoScan(): Promise<void> {
  return invoke<void>('stop_auto_scan');
}

/**
 * 获取自动扫描状态
 */
export async function getAutoScanStatus(): Promise<AutoScanStatus> {
  return invoke<AutoScanStatus>('get_auto_scan_status');
}

/**
 * 获取所有目录扫描状态
 */
export async function getDirectoryScanStates(): Promise<DirectoryScanState[]> {
  return invoke<DirectoryScanState[]>('get_directory_scan_states');
}

/**
 * 重置目录扫描频率为 x1
 */
export async function resetDirectoryScanFrequency(dirPath: string): Promise<boolean> {
  return invoke<boolean>('reset_directory_scan_frequency', { dirPath });
}

/**
 * 手动触发目录扫描
 */
export async function triggerDirectoryScan(dirPath: string): Promise<void> {
  return invoke<void>('trigger_directory_scan', { dirPath });
}
