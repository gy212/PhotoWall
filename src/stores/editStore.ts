/**
 * 照片编辑状态管理
 */

import { create } from 'zustand';
import type { Photo, EditAdjustments, CropRect, FlipDirection, EditParams, EditOperation } from '../types';
import { DEFAULT_ADJUSTMENTS } from '../types';

interface EditState {
  /** 是否正在编辑 */
  isEditing: boolean;
  /** 当前编辑的照片 */
  photo: Photo | null;
  /** 旋转角度 (0, 90, 180, 270) */
  rotation: number;
  /** 翻转状态 */
  flipH: boolean;
  flipV: boolean;
  /** 裁剪区域 */
  cropRect: CropRect | null;
  /** 是否正在裁剪 */
  isCropping: boolean;
  /** 调整参数 */
  adjustments: EditAdjustments;
  /** 是否有未保存的更改 */
  hasChanges: boolean;
  /** 是否正在保存 */
  isSaving: boolean;

  // Actions
  startEditing: (photo: Photo) => void;
  stopEditing: () => void;
  rotate: (degrees: 90 | -90) => void;
  flip: (direction: FlipDirection) => void;
  setCropRect: (rect: CropRect | null) => void;
  setIsCropping: (isCropping: boolean) => void;
  setAdjustment: <K extends keyof EditAdjustments>(key: K, value: number) => void;
  resetAdjustments: () => void;
  autoEnhance: () => void;
  setIsSaving: (isSaving: boolean) => void;
  getEditParams: () => EditParams;
}

export const useEditStore = create<EditState>((set, get) => ({
  isEditing: false,
  photo: null,
  rotation: 0,
  flipH: false,
  flipV: false,
  cropRect: null,
  isCropping: false,
  adjustments: { ...DEFAULT_ADJUSTMENTS },
  hasChanges: false,
  isSaving: false,

  startEditing: (photo) => set({
    isEditing: true,
    photo,
    rotation: 0,
    flipH: false,
    flipV: false,
    cropRect: null,
    isCropping: false,
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    hasChanges: false,
    isSaving: false,
  }),

  stopEditing: () => set({
    isEditing: false,
    photo: null,
    rotation: 0,
    flipH: false,
    flipV: false,
    cropRect: null,
    isCropping: false,
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    hasChanges: false,
    isSaving: false,
  }),

  rotate: (degrees) => set((state) => ({
    rotation: (state.rotation + degrees + 360) % 360,
    hasChanges: true,
  })),

  flip: (direction) => set((state) => ({
    flipH: direction === 'horizontal' ? !state.flipH : state.flipH,
    flipV: direction === 'vertical' ? !state.flipV : state.flipV,
    hasChanges: true,
  })),

  setCropRect: (rect) => set({ cropRect: rect, hasChanges: rect !== null }),

  setIsCropping: (isCropping) => set({ isCropping }),

  setAdjustment: (key, value) => set((state) => ({
    adjustments: { ...state.adjustments, [key]: value },
    hasChanges: true,
  })),

  resetAdjustments: () => set({
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    rotation: 0,
    flipH: false,
    flipV: false,
    cropRect: null,
    hasChanges: false,
  }),

  autoEnhance: () => set({ hasChanges: true }),

  setIsSaving: (isSaving) => set({ isSaving }),

  getEditParams: () => {
    const state = get();
    const operations: EditOperation[] = [];

    // 旋转
    if (state.rotation !== 0) {
      operations.push({ type: 'rotate', degrees: state.rotation });
    }

    // 翻转
    if (state.flipH) {
      operations.push({ type: 'flip', direction: 'horizontal' });
    }
    if (state.flipV) {
      operations.push({ type: 'flip', direction: 'vertical' });
    }

    // 裁剪
    if (state.cropRect) {
      operations.push({ type: 'crop', rect: state.cropRect });
    }

    // 调整参数（只添加非零值）
    const adj = state.adjustments;
    if (adj.brightness !== 0) operations.push({ type: 'brightness', value: adj.brightness });
    if (adj.contrast !== 0) operations.push({ type: 'contrast', value: adj.contrast });
    if (adj.saturation !== 0) operations.push({ type: 'saturation', value: adj.saturation });
    if (adj.exposure !== 0) operations.push({ type: 'exposure', value: adj.exposure });
    if (adj.highlights !== 0) operations.push({ type: 'highlights', value: adj.highlights });
    if (adj.shadows !== 0) operations.push({ type: 'shadows', value: adj.shadows });
    if (adj.temperature !== 0) operations.push({ type: 'temperature', value: adj.temperature });
    if (adj.tint !== 0) operations.push({ type: 'tint', value: adj.tint });
    if (adj.sharpen !== 0) operations.push({ type: 'sharpen', value: adj.sharpen });
    if (adj.blur !== 0) operations.push({ type: 'blur', value: adj.blur });
    if (adj.vignette !== 0) operations.push({ type: 'vignette', value: adj.vignette });

    return { operations };
  },
}));
