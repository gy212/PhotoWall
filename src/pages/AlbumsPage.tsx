import { useState, useEffect, useCallback } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlbumGrid, AlbumManager } from '@/components/album';
import { getAllAlbumsWithCount } from '@/services/api';
import type { AlbumWithCount } from '@/types';

function AlbumsPage() {
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<AlbumWithCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);

  const loadAlbums = useCallback(async () => {
    try {
      setLoading(true);
      const albumList = await getAllAlbumsWithCount();
      setAlbums(albumList);
    } catch (err) {
      console.error('Failed to load albums:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  const handleAlbumClick = useCallback(
    (album: AlbumWithCount) => {
      console.log('View album:', album);
      // navigate(`/albums/${album.album.albumId}`);
    },
    [navigate]
  );

  const handleAlbumContextMenu = useCallback((album: AlbumWithCount, event: MouseEvent) => {
    console.log('Context menu for album:', album, event);
  }, []);

  return (
    <div className="h-full w-full p-6 bg-background flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-4 sticky top-0 z-10">
          <div>
            <h1 className="text-2xl font-bold text-primary font-serif">相册</h1>
            <p className="mt-1 text-sm text-secondary">
              {albums.length} 个相册 · {albums.reduce((sum, a) => sum + a.photoCount, 0)} 张照片
            </p>
          </div>
          <button
            onClick={() => setManagerOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:bg-primary-dark"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            管理相册
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <AlbumGrid
            albums={albums}
            onAlbumClick={handleAlbumClick}
            onAlbumContextMenu={handleAlbumContextMenu}
            loading={loading}
          />
        </div>

        <AlbumManager open={managerOpen} onClose={() => setManagerOpen(false)} onAlbumsChange={loadAlbums} />
      </div>
    </div>
  );
}

export default AlbumsPage;
