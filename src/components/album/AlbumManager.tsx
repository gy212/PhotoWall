/**
 * AlbumManager - 相册管理对话框
 *
 * 用于管理所有相册的CRUD操作
 */

import { useState, useEffect, useCallback } from 'react';
import { Album, AlbumWithCount } from '@/types';
import { getAllAlbumsWithCount, createAlbum, updateAlbum, deleteAlbum } from '@/services/api';
import clsx from 'clsx';

interface AlbumManagerProps {
  open: boolean;
  onClose: () => void;
  onAlbumsChange?: () => void;
}

export function AlbumManager({ open, onClose, onAlbumsChange }: AlbumManagerProps) {
  const [albums, setAlbums] = useState<AlbumWithCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDescription, setNewAlbumDescription] = useState('');

  // 加载相册
  const loadAlbums = useCallback(async () => {
    try {
      setLoading(true);
      const albumList = await getAllAlbumsWithCount();
      setAlbums(albumList);
      onAlbumsChange?.();
    } catch (err) {
      console.error('Failed to load albums:', err);
    } finally {
      setLoading(false);
    }
  }, [onAlbumsChange]);

  useEffect(() => {
    if (open) {
      loadAlbums();
    }
  }, [open, loadAlbums]);

  // 创建相册
  const handleCreate = useCallback(async () => {
    const name = newAlbumName.trim();
    if (!name) return;

    try {
      await createAlbum(name, newAlbumDescription.trim() || undefined);
      setNewAlbumName('');
      setNewAlbumDescription('');
      await loadAlbums();
    } catch (err) {
      console.error('Failed to create album:', err);
      alert('创建相册失败');
    }
  }, [newAlbumName, newAlbumDescription, loadAlbums]);

  // 开始编辑
  const handleStartEdit = useCallback((album: Album) => {
    setEditingAlbum(album);
    setEditName(album.albumName);
    setEditDescription(album.description || '');
  }, []);

  // 保存编辑
  const handleSaveEdit = useCallback(async () => {
    if (!editingAlbum) return;

    const name = editName.trim();
    if (!name) return;

    try {
      await updateAlbum(editingAlbum.albumId, name, editDescription.trim() || undefined);
      setEditingAlbum(null);
      await loadAlbums();
    } catch (err) {
      console.error('Failed to update album:', err);
      alert('更新相册失败');
    }
  }, [editingAlbum, editName, editDescription, loadAlbums]);

  // 删除相册
  const handleDelete = useCallback(async (album: Album) => {
    if (!confirm(`确定要删除相册 "${album.albumName}" 吗?`)) return;

    try {
      await deleteAlbum(album.albumId);
      await loadAlbums();
    } catch (err) {
      console.error('Failed to delete album:', err);
      alert('删除相册失败');
    }
  }, [loadAlbums]);

  if (!open) return null;

  return (
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 对话框 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-border"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-xl font-bold text-primary font-serif">相册管理</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-element text-secondary hover:text-primary transition-colors"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 创建新相册 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-secondary">创建新相册</h3>
              <div className="space-y-2">
                <input
                  type="text"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleCreate()}
                  placeholder="相册名称"
                  className="w-full px-3 py-2 text-sm bg-element border border-border rounded-xl text-primary placeholder-tertiary focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <textarea
                  value={newAlbumDescription}
                  onChange={(e) => setNewAlbumDescription(e.target.value)}
                  placeholder="描述（可选）"
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-element border border-border rounded-xl text-primary placeholder-tertiary focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-all"
                />
                <button
                  onClick={handleCreate}
                  disabled={!newAlbumName.trim()}
                  className={clsx(
                    "w-full px-4 py-2 rounded-xl text-sm font-medium text-white bg-primary transition-all",
                    newAlbumName.trim()
                      ? "hover:bg-primary-hover active:scale-95"
                      : "opacity-50 cursor-not-allowed"
                  )}
                >
                  创建相册
                </button>
              </div>
            </div>

            {/* 相册列表 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-secondary">
                所有相册 ({albums.length})
              </h3>
              {loading ? (
                <div className="text-center py-8 text-tertiary">加载中...</div>
              ) : albums.length === 0 ? (
                <div className="text-center py-8 text-tertiary">暂无相册</div>
              ) : (
                <div className="space-y-2">
                  {albums.map(({ album, photoCount }) => (
                    <div
                      key={album.albumId}
                      className="flex flex-col gap-2 p-3 border border-border rounded-xl hover:bg-element/50 transition-colors bg-surface"
                    >
                      {editingAlbum?.albumId === album.albumId ? (
                        // 编辑模式
                        <>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-3 py-1.5 text-sm bg-element border border-border rounded-lg text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder="描述（可选）"
                            rows={2}
                            className="px-3 py-1.5 text-sm bg-element border border-border rounded-lg text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveEdit}
                              className="flex-1 px-3 py-1.5 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingAlbum(null)}
                              className="flex-1 px-3 py-1.5 text-sm text-secondary bg-element hover:bg-hover rounded-lg transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        </>
                      ) : (
                        // 显示模式
                        <>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-primary">{album.albumName}</h4>
                              {album.description && (
                                <p className="text-sm text-secondary mt-1">{album.description}</p>
                              )}
                              <p className="text-xs text-tertiary mt-1">{photoCount} 张照片</p>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleStartEdit(album)}
                                className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                                title="编辑"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(album)}
                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="删除"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-secondary bg-element hover:bg-hover transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
