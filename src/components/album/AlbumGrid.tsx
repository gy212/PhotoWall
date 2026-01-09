import clsx from 'clsx';
import { getAssetUrl } from '@/services/api';
import type { AlbumWithCount } from '@/types';
import type { MouseEvent } from 'react';
import { Icon } from '@/components/common/Icon';

interface AlbumGridProps {
  albums: AlbumWithCount[];
  onAlbumClick?: (album: AlbumWithCount) => void;
  onAlbumContextMenu?: (album: AlbumWithCount, event: MouseEvent) => void;
  loading?: boolean;
}

export function AlbumGrid({ albums, onAlbumClick, onAlbumContextMenu, loading }: AlbumGridProps) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-tertiary">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-element border-t-primary" />
          <span className="text-sm">加载中...</span>
        </div>
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center text-tertiary">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-element shadow-inner">
          <Icon name="photo_library" className="text-3xl opacity-50" />
        </div>
        <p className="font-semibold text-secondary">暂无相册</p>
        <p className="mt-1 text-sm">点击右上角按钮创建一个吧</p>
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
            'group cursor-pointer overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-all duration-300',
            'hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg'
          )}
        >
          <div className="relative aspect-square bg-element">
            {album.coverPhotoId ? (
              <img
                src={getAssetUrl(`path/to/cover/${album.coverPhotoId}`)} // Note: logic for cover path might need adjustment if real
                alt={album.albumName}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Icon name="photo_library" className="text-4xl text-tertiary/40" />
              </div>
            )}
            <div className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md border border-white/10">
              {photoCount}
            </div>
          </div>

          <div className="p-3">
            <h3 className="truncate font-semibold text-primary group-hover:text-primary-dark transition-colors">{album.albumName}</h3>
            {album.description && (
              <p className="mt-1 truncate text-xs text-tertiary">{album.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
