import { describe, it, expect, beforeEach } from 'vitest';
import { useSelectionStore } from '@/stores/selectionStore';

describe('selectionStore', () => {
  beforeEach(() => {
    useSelectionStore.getState().clearSelection();
  });

  it('select - adds ID to selection', () => {
    const { select, selectedIds } = useSelectionStore.getState();
    select(1);
    expect(useSelectionStore.getState().selectedIds.has(1)).toBe(true);
    expect(useSelectionStore.getState().lastSelectedId).toBe(1);
  });

  it('deselect - removes ID from selection', () => {
    const store = useSelectionStore.getState();
    store.select(1);
    store.select(2);
    store.deselect(1);
    expect(useSelectionStore.getState().selectedIds.has(1)).toBe(false);
    expect(useSelectionStore.getState().selectedIds.has(2)).toBe(true);
  });

  it('toggle - toggles selection state', () => {
    const store = useSelectionStore.getState();
    store.toggle(1);
    expect(useSelectionStore.getState().selectedIds.has(1)).toBe(true);
    store.toggle(1);
    expect(useSelectionStore.getState().selectedIds.has(1)).toBe(false);
  });

  it('selectMultiple - adds multiple IDs', () => {
    const store = useSelectionStore.getState();
    store.selectMultiple([1, 2, 3]);
    const ids = useSelectionStore.getState().selectedIds;
    expect(ids.has(1)).toBe(true);
    expect(ids.has(2)).toBe(true);
    expect(ids.has(3)).toBe(true);
    expect(useSelectionStore.getState().lastSelectedId).toBe(3);
  });

  it('selectAll - replaces entire selection', () => {
    const store = useSelectionStore.getState();
    store.select(1);
    store.selectAll([4, 5]);
    const ids = useSelectionStore.getState().selectedIds;
    expect(ids.has(1)).toBe(false);
    expect(ids.has(4)).toBe(true);
    expect(ids.has(5)).toBe(true);
  });

  it('clearSelection - clears all', () => {
    const store = useSelectionStore.getState();
    store.selectMultiple([1, 2, 3]);
    store.clearSelection();
    expect(useSelectionStore.getState().selectedIds.size).toBe(0);
    expect(useSelectionStore.getState().lastSelectedId).toBe(null);
  });

  it('isSelected - checks if ID is selected', () => {
    const store = useSelectionStore.getState();
    store.select(1);
    expect(store.isSelected(1)).toBe(true);
    expect(store.isSelected(2)).toBe(false);
  });
});
