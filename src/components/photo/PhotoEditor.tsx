/**
 * 照片编辑器组件
 */

import { memo, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Icon, type IconName } from '@/components/common/Icon';
import { useEditStore } from '@/stores';
import { applyPhotoEdits, getAssetUrl } from '@/services/api';
import type { Photo, EditAdjustments } from '@/types';

interface PhotoEditorProps {
  photo: Photo;
  open: boolean;
  onClose: () => void;
  onSave?: (photo: Photo) => void;
}

// 调整项配置
const ADJUSTMENT_CONFIGS: Array<{
  key: keyof EditAdjustments;
  label: string;
  icon: IconName;
  min: number;
  max: number;
}> = [
  { key: 'brightness', label: '亮度', icon: 'brightness_6', min: -100, max: 100 },
  { key: 'contrast', label: '对比度', icon: 'contrast', min: -100, max: 100 },
  { key: 'saturation', label: '饱和度', icon: 'palette', min: -100, max: 100 },
  { key: 'exposure', label: '曝光', icon: 'exposure', min: -200, max: 200 },
  { key: 'highlights', label: '高光', icon: 'wb_sunny', min: -100, max: 100 },
  { key: 'shadows', label: '阴影', icon: 'nights_stay', min: -100, max: 100 },
  { key: 'temperature', label: '色温', icon: 'thermostat', min: -100, max: 100 },
  { key: 'tint', label: '色调', icon: 'tune', min: -100, max: 100 },
  { key: 'sharpen', label: '锐化', icon: 'deblur', min: 0, max: 100 },
  { key: 'blur', label: '模糊', icon: 'blur_on', min: 0, max: 100 },
  { key: 'vignette', label: '暗角', icon: 'vignette', min: 0, max: 100 },
];

/**
 * 照片编辑器
 */
export const PhotoEditor = memo(function PhotoEditor({
  photo,
  open,
  onClose,
  onSave,
}: PhotoEditorProps) {
  const {
    photo: editPhoto,
    rotation,
    flipH,
    flipV,
    adjustments,
    hasChanges,
    isSaving,
    rotate,
    flip,
    setAdjustment,
    resetAdjustments,
    setIsSaving,
    getEditParams,
  } = useEditStore();

  // 使用 store 中的 photo，避免外部 prop 变化导致重新渲染
  const currentPhoto = editPhoto ?? photo;

  const [activeTab, setActiveTab] = useState<'transform' | 'adjust'>('transform');
  const [saveAsCopy, setSaveAsCopy] = useState(false);

  // 缩放和拖拽状态
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // 计算 CSS 滤镜（用于实时预览）
  const cssFilters = useMemo(() => {
    const filters: string[] = [];

    if (adjustments.brightness !== 0) {
      const brightness = 1 + adjustments.brightness / 100;
      filters.push(`brightness(${brightness})`);
    }

    if (adjustments.contrast !== 0) {
      const contrast = 1 + adjustments.contrast / 100;
      filters.push(`contrast(${contrast})`);
    }

    if (adjustments.saturation !== 0) {
      const saturate = 1 + adjustments.saturation / 100;
      filters.push(`saturate(${saturate})`);
    }

    if (adjustments.blur > 0) {
      filters.push(`blur(${adjustments.blur / 10}px)`);
    }

    if (adjustments.temperature !== 0) {
      const sepia = Math.abs(adjustments.temperature) / 200;
      const hue = adjustments.temperature > 0 ? -10 : 10;
      filters.push(`sepia(${sepia}) hue-rotate(${hue}deg)`);
    }

    return filters.join(' ') || 'none';
  }, [adjustments]);

  // 计算变换样式
  const transformStyle = useMemo(() => {
    const transforms: string[] = [];
    if (rotation !== 0) {
      transforms.push(`rotate(${rotation}deg)`);
    }
    if (flipH) {
      transforms.push('scaleX(-1)');
    }
    if (flipV) {
      transforms.push('scaleY(-1)');
    }
    return transforms.join(' ') || 'none';
  }, [rotation, flipH, flipV]);

  // 滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(Math.max(z * delta, 0.5), 5));
  }, []);

  // 拖拽开始
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }, [zoom, pan]);

  // 拖拽移动
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  }, [isDragging]);

  // 拖拽结束
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 缩放控制
  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z * 1.25, 5)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z * 0.8, 0.5)), []);
  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // 保存编辑
  const handleSave = useCallback(async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      const params = getEditParams();
      const updatedPhoto = await applyPhotoEdits(currentPhoto.photoId, params, saveAsCopy);
      onSave?.(updatedPhoto);
      onClose();
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, currentPhoto.photoId, saveAsCopy, getEditParams, setIsSaving, onSave, onClose]);

  // 取消编辑
  const handleCancel = useCallback(() => {
    if (hasChanges) {
      if (!confirm('有未保存的更改，确定要放弃吗？')) {
        return;
      }
    }
    resetAdjustments();
    onClose();
  }, [hasChanges, resetAdjustments, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex bg-background">
      {/* 左侧预览区 */}
      <div className="flex-1 flex flex-col bg-[var(--bg-base)]">
        {/* 缩放控制栏 */}
        <div className="flex items-center justify-center gap-2 p-2 bg-surface border-b border-border">
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg hover:bg-element transition-colors cursor-pointer"
            title="缩小"
          >
            <Icon name="remove" className="text-lg text-primary" />
          </button>
          <button
            onClick={handleZoomReset}
            className="px-3 py-1 rounded-lg hover:bg-element transition-colors text-sm text-primary min-w-[60px] cursor-pointer"
            title="重置缩放"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg hover:bg-element transition-colors cursor-pointer"
            title="放大"
          >
            <Icon name="add" className="text-lg text-primary" />
          </button>
        </div>

        {/* 图片预览 */}
        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center p-8 overflow-hidden"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          <div
            className="relative max-w-full max-h-full rounded-lg shadow-2xl select-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
          >
            <img
              src={getAssetUrl(currentPhoto.filePath)}
              alt={currentPhoto.fileName}
              className="max-w-full max-h-[80vh] object-contain"
              style={{
                filter: cssFilters,
                transform: transformStyle,
              }}
              draggable={false}
            />
          </div>
        </div>
      </div>

      {/* 右侧控制面板 */}
      <div className="w-80 flex flex-col bg-surface border-l border-border">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">编辑照片</h2>
          <button
            onClick={handleCancel}
            className="p-2 rounded-lg text-secondary hover:text-[var(--text-primary)] hover:bg-element transition-colors cursor-pointer"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-border">
          <button
            className={clsx(
              'flex-1 py-3 text-sm font-medium transition-colors cursor-pointer',
              activeTab === 'transform'
                ? 'text-primary border-b-2 border-primary'
                : 'text-secondary hover:text-[var(--text-primary)]'
            )}
            onClick={() => setActiveTab('transform')}
          >
            变换
          </button>
          <button
            className={clsx(
              'flex-1 py-3 text-sm font-medium transition-colors cursor-pointer',
              activeTab === 'adjust'
                ? 'text-primary border-b-2 border-primary'
                : 'text-secondary hover:text-[var(--text-primary)]'
            )}
            onClick={() => setActiveTab('adjust')}
          >
            调整
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'transform' ? (
            <div className="space-y-6">
              {/* 旋转 */}
              <div>
                <h3 className="text-sm font-medium text-secondary mb-3">旋转</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => rotate(-90)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-element hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    <Icon name="rotate_left" className="text-xl" />
                    <span className="text-sm">左转</span>
                  </button>
                  <button
                    onClick={() => rotate(90)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-element hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    <Icon name="rotate_right" className="text-xl" />
                    <span className="text-sm">右转</span>
                  </button>
                </div>
              </div>

              {/* 翻转 */}
              <div>
                <h3 className="text-sm font-medium text-secondary mb-3">翻转</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => flip('horizontal')}
                    className={clsx(
                      'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-colors cursor-pointer',
                      flipH
                        ? 'bg-primary/10 text-primary'
                        : 'bg-element hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
                    )}
                  >
                    <Icon name="flip" className="text-xl" />
                    <span className="text-sm">水平</span>
                  </button>
                  <button
                    onClick={() => flip('vertical')}
                    className={clsx(
                      'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-colors cursor-pointer',
                      flipV
                        ? 'bg-primary/10 text-primary'
                        : 'bg-element hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
                    )}
                  >
                    <Icon name="flip" className="text-xl rotate-90" />
                    <span className="text-sm">垂直</span>
                  </button>
                </div>
              </div>

              {/* 当前状态 */}
              <div className="p-3 rounded-lg bg-element/50 text-sm text-secondary">
                <div>旋转: {rotation}°</div>
                <div>水平翻转: {flipH ? '是' : '否'}</div>
                <div>垂直翻转: {flipV ? '是' : '否'}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {ADJUSTMENT_CONFIGS.map((config) => (
                <div key={config.key}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon name={config.icon} className="text-lg text-secondary" />
                      <span className="text-sm font-medium text-[var(--text-primary)]">{config.label}</span>
                    </div>
                    <span className="text-xs text-secondary tabular-nums w-10 text-right">
                      {adjustments[config.key]}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={config.min}
                    max={config.max}
                    step={1}
                    value={adjustments[config.key]}
                    onChange={(e) => setAdjustment(config.key, Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary/20 accent-primary"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="p-4 border-t border-border space-y-3">
          {/* 另存为副本选项 */}
          <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={saveAsCopy}
              onChange={(e) => setSaveAsCopy(e.target.checked)}
              className="rounded border-border accent-primary cursor-pointer"
            />
            另存为副本
          </label>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <button
              onClick={resetAdjustments}
              className="flex-1 py-2.5 rounded-lg bg-element hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              重置
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={clsx(
                'flex-1 py-2.5 rounded-lg font-medium transition-colors',
                hasChanges
                  ? 'bg-primary text-white hover:bg-[var(--primary-dark)] cursor-pointer'
                  : 'bg-element text-secondary cursor-not-allowed'
              )}
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
});

export default PhotoEditor;
