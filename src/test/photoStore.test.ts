import { describe, it, expect, beforeEach } from 'vitest';
import { usePhotoStore } from '@/stores/photoStore';
import type { Photo } from '@/types';

const mockPhoto = (id: number): Photo => ({
  id,
  filename: `photo${id}.jpg`,
  path: `C:\\Photos\\photo${id}.jpg`,
  width: 1920,
  height: 1080,
  fileSize: 1024000,
  dateTaken: '2025-01-01T12:00:00Z',
  dateModified: '2025-01-01T12:00:00Z',
  dateAdded: '2025-01-01T12:00:00Z',
  hash: `hash${id}`,
  rating: 0,
  isFavorite: false,
  isDeleted: false,
});

describe('photoStore', () => {
  beforeEach(() => {
    usePhotoStore.setState({
      photos: [],
      totalCount: 0,
      loading: false,
      error: null,
      sortOptions: { field: 'dateTaken', order: 'desc' },
      viewMode: 'timeline',
      thumbnailSize: 200,
      searchQuery: '',
      searchFilters: {},
    });
  });

  it('setPhotos - sets photo list', () => {
    const photos = [mockPhoto(1), mockPhoto(2)];
    usePhotoStore.getState().setPhotos(photos);
    expect(usePhotoStore.getState().photos).toEqual(photos);
  });

  it('addPhotos - appends photos', () => {
    usePhotoStore.getState().setPhotos([mockPhoto(1)]);
    usePhotoStore.getState().addPhotos([mockPhoto(2)]);
    expect(usePhotoStore.getState().photos.length).toBe(2);
  });

  it('clearPhotos - clears photos and error', () => {
    usePhotoStore.getState().setPhotos([mockPhoto(1)]);
    usePhotoStore.getState().setError('test error');
    usePhotoStore.getState().clearPhotos();
    expect(usePhotoStore.getState().photos).toEqual([]);
    expect(usePhotoStore.getState().error).toBe(null);
  });

  it('setSortOptions - sets sort options', () => {
    usePhotoStore.getState().setSortOptions({ field: 'filename', order: 'asc' });
    expect(usePhotoStore.getState().sortOptions).toEqual({ field: 'filename', order: 'asc' });
  });

  it('setSortField - updates only field', () => {
    usePhotoStore.getState().setSortField('fileSize');
    expect(usePhotoStore.getState().sortOptions.field).toBe('fileSize');
    expect(usePhotoStore.getState().sortOptions.order).toBe('desc');
  });

  it('setSortOrder - updates only order', () => {
    usePhotoStore.getState().setSortOrder('asc');
    expect(usePhotoStore.getState().sortOptions.order).toBe('asc');
    expect(usePhotoStore.getState().sortOptions.field).toBe('dateTaken');
  });

  it('setSearchQuery - sets search query', () => {
    usePhotoStore.getState().setSearchQuery('sunset');
    expect(usePhotoStore.getState().searchQuery).toBe('sunset');
  });

  it('clearSearchFilters - clears query and filters', () => {
    usePhotoStore.getState().setSearchQuery('test');
    usePhotoStore.getState().setSearchFilters({ rating: 5 });
    usePhotoStore.getState().clearSearchFilters();
    expect(usePhotoStore.getState().searchQuery).toBe('');
    expect(usePhotoStore.getState().searchFilters).toEqual({});
  });

  it('setViewMode - sets view mode', () => {
    usePhotoStore.getState().setViewMode('grid');
    expect(usePhotoStore.getState().viewMode).toBe('grid');
  });

  it('setThumbnailSize - sets thumbnail size', () => {
    usePhotoStore.getState().setThumbnailSize(300);
    expect(usePhotoStore.getState().thumbnailSize).toBe(300);
  });
});
