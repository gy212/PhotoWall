/**
 * 选择状态管理
 */

import { create } from 'zustand';

interface SelectionState {
  /** 选中的照片ID列表 */
  selectedIds: Set<number>;
  /** 最后选中的ID (用于 shift 多选) */
  lastSelectedId: number | null;

  // Actions
  select: (id: number) => void;
  deselect: (id: number) => void;
  toggle: (id: number) => void;
  selectMultiple: (ids: number[]) => void;
  selectAll: (ids: number[]) => void;
  clearSelection: () => void;
  isSelected: (id: number) => boolean;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedIds: new Set(),
  lastSelectedId: null,

  select: (id) =>
    set((state) => ({
      selectedIds: new Set(state.selectedIds).add(id),
      lastSelectedId: id,
    })),

  deselect: (id) =>
    set((state) => {
      const newSet = new Set(state.selectedIds);
      newSet.delete(id);
      return { selectedIds: newSet };
    }),

  toggle: (id) => {
    const { selectedIds } = get();
    if (selectedIds.has(id)) {
      get().deselect(id);
    } else {
      get().select(id);
    }
  },

  selectMultiple: (ids) =>
    set((state) => ({
      selectedIds: new Set([...state.selectedIds, ...ids]),
      lastSelectedId: ids[ids.length - 1] ?? state.lastSelectedId,
    })),

  selectAll: (ids) =>
    set({
      selectedIds: new Set(ids),
      lastSelectedId: ids[ids.length - 1] ?? null,
    }),

  clearSelection: () =>
    set({
      selectedIds: new Set(),
      lastSelectedId: null,
    }),

  isSelected: (id) => get().selectedIds.has(id),
}));
