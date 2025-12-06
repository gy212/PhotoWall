/**
 * Thumbnail - 缩略图组件
 *
 * 自动加载和显示照片缩略图，支持占位符、加载状态和错误处理
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useThumbnail, ThumbnailSize } from '@/hooks';

export interface ThumbnailProps {
  /** 源图片路径 */
  sourcePath: string;
  /** 文件哈希 */
  fileHash: string;
  /** 缩略图尺寸 */
  size?: ThumbnailSize;
  /** 优先级 */
  priority?: number;
  /** 是否使用队列模式 */
  useQueue?: boolean;
  /** alt 文本 */
  alt?: string;
  /** 自定义 className */
  className?: string;
  /** 点击事件 */
  onClick?: () => void;
  /** 是否显示加载动画 */
  showLoading?: boolean;
  /** 图片加载失败时的最大重试次数 */
  maxImageRetry?: number;
}

/**
 * 缩略图组件
 */
export const Thumbnail: React.FC<ThumbnailProps> = ({
  sourcePath,
  fileHash,
  size = 'medium',
  priority = 0,
  useQueue = false,
  alt = '',
  className = '',
  onClick,
  showLoading = true,
  maxImageRetry = 3,
}) => {
  const { thumbnailUrl, isLoading, error, reload } = useThumbnail(sourcePath, fileHash, {
    size,
    priority,
    useQueue,
  });

  // 图片加载状态
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 重置图片加载状态（当 URL 变化时）
  useEffect(() => {
    setImageLoadError(false);
    setImageLoaded(false);
    retryCountRef.current = 0;
  }, [thumbnailUrl]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  // 图片加载成功
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageLoadError(false);
    retryCountRef.current = 0;
  }, []);

  // 图片加载失败，自动重试
  const handleImageError = useCallback(() => {
    if (retryCountRef.current < maxImageRetry) {
      retryCountRef.current += 1;
      console.warn(
        `缩略图加载失败，第 ${retryCountRef.current} 次重试:`,
        fileHash
      );
      // 延迟重试，给后端一些时间生成缩略图
      retryTimerRef.current = setTimeout(() => {
        reload();
      }, 500 * retryCountRef.current); // 递增延迟
    } else {
      console.error(`缩略图加载失败，已达最大重试次数:`, fileHash);
      setImageLoadError(true);
    }
  }, [fileHash, maxImageRetry, reload]);

  // 手动重试（点击错误占位符）
  const handleManualRetry = useCallback(() => {
    retryCountRef.current = 0;
    setImageLoadError(false);
    reload();
  }, [reload]);

  // 加载状态
  if (isLoading && showLoading && !thumbnailUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${className}`}
        onClick={onClick}
      >
        <LoadingPlaceholder />
      </div>
    );
  }

  // 错误状态（后端生成失败或图片加载失败）
  if (error || imageLoadError) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${className}`}
        onClick={handleManualRetry}
        title="点击重试"
      >
        <ErrorPlaceholder />
      </div>
    );
  }

  // 显示缩略图
  if (thumbnailUrl) {
    return (
      <div className={`relative ${className}`} onClick={onClick}>
        {/* 加载中显示占位符背景 */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <LoadingPlaceholder />
          </div>
        )}
        <img
          src={thumbnailUrl}
          alt={alt}
          className={`object-cover w-full h-full ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          decoding="async"
        />
      </div>
    );
  }

  // 默认占位符
  return (
    <div
      className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${className}`}
      onClick={onClick}
    >
      <DefaultPlaceholder />
    </div>
  );
};

/**
 * 加载中占位符
 */
const LoadingPlaceholder: React.FC = () => (
  <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
    <svg
      className="animate-spin h-8 w-8"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  </div>
);

/**
 * 错误占位符（可点击重试）
 */
const ErrorPlaceholder: React.FC = () => (
  <div className="flex flex-col items-center justify-center text-red-400 dark:text-red-500">
    <svg
      className="h-8 w-8"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
    <span className="text-xs mt-1">点击重试</span>
  </div>
);

/**
 * 默认占位符
 */
const DefaultPlaceholder: React.FC = () => (
  <div className="flex flex-col items-center justify-center text-gray-300 dark:text-gray-600">
    <svg
      className="h-12 w-12"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  </div>
);
