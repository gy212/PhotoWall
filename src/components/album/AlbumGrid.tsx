import clsx from 'clsx';
import { getAssetUrl } from '@/services/api';
import type { AlbumWithCount } from '@/types';
import type { MouseEvent } from 'react';

interface AlbumGridProps {
  albums: AlbumWithCount[];
  onAlbumClick?: (album: AlbumWithCount) => void;
  onAlbumContextMenu?: (album: AlbumWithCount, event: MouseEvent) => void;
  loading?: boolean;
}

export function AlbumGrid({ albums, onAlbumClick, onAlbumContextMenu, loading }: AlbumGridProps) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">加载中...</div>
    );
  }

  if (albums.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center text-muted-foreground">
        <svg className="mb-4 h-16 w-16 text-muted-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="font-semibold">暂无相册</p>
        <p className="mt-1 text-sm">点击右下角按钮创建一个吧</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {albums.map(({ album, photoCount }) => (
        <div
          key={album.albumId}
          onClick={() => onAlbumClick?.({ album, photoCount })}
          onContextMenu={(e) => {
            e.preventDefault();
            onAlbumContextMenu?.({ album, photoCount }, e);
          }}
          className={clsx(
            'group cursor-pointer overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-all duration-300',
            'hover:-translate-y-1 hover:border-primary hover:shadow-lg'
          )}
        >
          <div className="relative aspect-square bg-gradient-to-br from-muted/20 to-muted/10">
            {album.coverPhotoId ? (
              <img
                src={getAssetUrl(`path/to/cover/${album.coverPhotoId}`)}
                alt={album.albumName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <svg className="h-16 w-16 text-muted-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            )}
            <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {photoCount}
            </div>
          </div>

          <div className="p-3">
            <h3 className="truncate font-semibold text-primary group-hover:text-primary/80">{album.albumName}</h3>
            {album.description && (
              <p className="mt-1 truncate text-sm text-muted-foreground">{album.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
