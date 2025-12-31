/**
 * 自定义桌面模糊背景组件
 *
 * 实现可调模糊半径的桌面背景模糊效果
 * 支持两种模式：
 * 1. Composition Backdrop (Windows 11+): GPU 实时模糊
 * 2. 抓屏模糊 (Fallback): CPU 模糊 + base64 背景
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  getBlurredDesktop,
  setExcludeFromCapture,
  clearBlurCache,
  isCompositionBlurSupported,
  enableCompositionBlur,
  disableCompositionBlur,
  setCompositionBlurRadius,
} from '@/services/api';
import { useSettingsStore } from '@/stores/settingsStore';

interface BlurredBackgroundProps {
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * 根据模糊半径计算抓屏缩放因子
 */
function getDesktopCaptureScaleFactor(blurRadius: number) {
  const clamped = Math.max(0, Math.min(100, blurRadius));
  const max = 0.55;
  const min = 0.25;
  const t = Math.max(0, Math.min(1, clamped / 40));
  return max + (min - max) * t;
}

function BlurredBackground({ enabled = true }: BlurredBackgroundProps) {
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const isUpdatingRef = useRef(false);
  const pendingFinalRef = useRef(false);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const compositionInitializedRef = useRef(false);
  const tauri = isTauri();

  const {
    blurRadius,
    customBlurEnabled,
    compositionBlurSupported,
    compositionBlurEnabled,
    setCompositionBlurSupported,
    setCompositionBlurEnabled,
  } = useSettingsStore();

  // 检测 Composition Blur 支持
  useEffect(() => {
    if (!tauri) return;

    const checkSupport = async () => {
      try {
        const supported = await isCompositionBlurSupported();
        setCompositionBlurSupported(supported);
        console.debug('[BlurredBackground] Composition blur supported:', supported);
      } catch (err) {
        console.debug('[BlurredBackground] Failed to check composition blur support:', err);
        setCompositionBlurSupported(false);
      }
    };

    void checkSupport();
  }, [tauri, setCompositionBlurSupported]);

  // 初始化/清理 Composition Blur
  useEffect(() => {
    if (!tauri || !enabled || !customBlurEnabled) {
      // 禁用时清理
      if (compositionInitializedRef.current) {
        void disableCompositionBlur().catch(() => undefined);
        compositionInitializedRef.current = false;
        setCompositionBlurEnabled(false);
      }
      setBackgroundImage(null);
      if (tauri) {
        void clearBlurCache();
      }
      return;
    }

    // 如果支持 Composition Blur，启用它
    if (compositionBlurSupported && !compositionInitializedRef.current) {
      const initComposition = async () => {
        try {
          await enableCompositionBlur();
          await setCompositionBlurRadius(blurRadius);
          compositionInitializedRef.current = true;
          setCompositionBlurEnabled(true);
          console.debug('[BlurredBackground] Composition blur enabled');
        } catch (err) {
          console.debug('[BlurredBackground] Failed to enable composition blur:', err);
          await disableCompositionBlur().catch(() => undefined);
          setCompositionBlurSupported(false);
          setCompositionBlurEnabled(false);
        }
      };
      void initComposition();
    }

    return () => {
      if (compositionInitializedRef.current) {
        void disableCompositionBlur().catch(() => undefined);
        compositionInitializedRef.current = false;
      }
    };
  }, [
    tauri,
    enabled,
    customBlurEnabled,
    compositionBlurSupported,
    setCompositionBlurSupported,
    setCompositionBlurEnabled,
    blurRadius,
  ]);

  // 更新 Composition Blur 半径
  useEffect(() => {
    if (!tauri || !enabled || !customBlurEnabled || !compositionBlurEnabled) return;

    void setCompositionBlurRadius(blurRadius).catch((err) => {
      console.debug('[BlurredBackground] Failed to set composition blur radius:', err);
      setCompositionBlurSupported(false);
      setCompositionBlurEnabled(false);
    });
  }, [
    tauri,
    enabled,
    customBlurEnabled,
    compositionBlurEnabled,
    blurRadius,
    setCompositionBlurSupported,
    setCompositionBlurEnabled,
  ]);

  // 更新模糊背景 (Fallback 模式)
  const updateBackground = useCallback(
    async (mode: 'preview' | 'final' = 'final', force = false) => {
      // 如果使用 Composition Blur，不需要抓屏
      if (!tauri || !enabled || !customBlurEnabled || compositionBlurEnabled) return;

      const now = Date.now();
      const minIntervalMs = mode === 'preview' ? 120 : 0;
      if (!force && minIntervalMs > 0 && now - lastUpdateRef.current < minIntervalMs) return;
      lastUpdateRef.current = now;

      if (isUpdatingRef.current) {
        if (mode === 'final') pendingFinalRef.current = true;
        return;
      }
      isUpdatingRef.current = true;

      try {
        await setExcludeFromCapture(true);

        const scaleFactor = mode === 'preview' ? 0.2 : getDesktopCaptureScaleFactor(blurRadius);
        const image = await getBlurredDesktop(blurRadius, scaleFactor);
        setBackgroundImage(image);
      } catch (err) {
        console.debug('[BlurredBackground] update failed:', err);
      } finally {
        isUpdatingRef.current = false;
        await setExcludeFromCapture(false).catch(() => undefined);
        if (pendingFinalRef.current) {
          pendingFinalRef.current = false;
          setTimeout(() => {
            void updateBackground('final', true);
          }, 0);
        }
      }
    },
    [tauri, enabled, customBlurEnabled, compositionBlurEnabled, blurRadius]
  );

  // 监听窗口事件 (Fallback 模式)
  useEffect(() => {
    // 如果使用 Composition Blur，不需要监听窗口事件
    if (!tauri || !enabled || !customBlurEnabled || compositionBlurEnabled) return;

    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const appWindow = getCurrentWindow();

        // 监听窗口移动和调整大小事件
        const unlistenFns: Array<() => void> = [];

        const scheduleUpdate = () => {
          // Clear previous timer
          if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
          }
          void updateBackground('preview');
          // Debounce final quality update
          updateTimeoutRef.current = setTimeout(() => {
            void updateBackground('final', true);
          }, 250);
        };

        unlistenFns.push(await appWindow.onMoved(scheduleUpdate));
        unlistenFns.push(await appWindow.onResized(scheduleUpdate));
        unlisten = () => {
          for (const fn of unlistenFns) fn();
        };

        // 初始更新
        void updateBackground('final', true);
      } catch (err) {
        console.debug('[BlurredBackground] 设置监听器失败:', err);
      }
    };

    void setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      // 清除缓存
      void clearBlurCache();
    };
  }, [tauri, enabled, customBlurEnabled, compositionBlurEnabled, updateBackground]);

  // 模糊半径变化时更新 (Fallback 模式)
  useEffect(() => {
    // 如果使用 Composition Blur，不需要抓屏更新
    if (!tauri || !enabled || !customBlurEnabled || compositionBlurEnabled) return;
    void updateBackground('final', true);
  }, [blurRadius, tauri, enabled, customBlurEnabled, compositionBlurEnabled, updateBackground]);

  // 不启用时不渲染
  if (!enabled || !customBlurEnabled) {
    return null;
  }

  // Composition Blur 模式：不需要渲染背景图（由原生层处理）
  if (compositionBlurEnabled) {
    return null;
  }

  // Fallback 模式：渲染 base64 背景图
  if (!backgroundImage) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none -z-10"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
  );
}

export default BlurredBackground;
