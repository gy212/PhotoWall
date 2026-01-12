import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getFavoritePhotos, getAssetUrl, getRecentlyEditedPhoto } from '@/services/api';
import { useMemo } from 'react';
import type { Photo } from '@/types';

import { Icon } from '@/components/common/Icon';

interface HeroSectionProps {
    onPhotoClick?: (photo: Photo) => void;
}

/** 格式化相对时间 */
function formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 30) return `${diffDays} 天前`;
    return date.toLocaleDateString('zh-CN');
}

/** 格式化文件大小 */
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 获取文件格式 */
function getFileFormat(fileName: string): string {
    return fileName.split('.').pop()?.toUpperCase() || '';
}

export default function HeroSection({ onPhotoClick }: HeroSectionProps) {
    const navigate = useNavigate();

    // 获取收藏照片
    const { data: favoritesData, isLoading } = useQuery({
        queryKey: ['favoritePhotos', 'hero'],
        queryFn: () => getFavoritePhotos({ page: 1, pageSize: 10 }),
        staleTime: 30000,
    });

    // 获取最近编辑的照片
    const { data: recentPhoto } = useQuery({
        queryKey: ['recentlyEditedPhoto'],
        queryFn: getRecentlyEditedPhoto,
        staleTime: 30000,
    });

    // 随机选择一张展示
    const featuredPhoto: Photo | null = useMemo(() => {
        const photos = favoritesData?.items ?? [];
        if (photos.length === 0) return null;
        // 使用当天日期作为种子，保证同一天展示同一张
        const today = new Date().toDateString();
        const seed = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const index = seed % photos.length;
        return photos[index];
    }, [favoritesData]);

    const hasFavorites = (favoritesData?.items?.length ?? 0) > 0;

    return (
        <section className="grid grid-cols-12 gap-6 h-[300px] flex-shrink-0">
            {/* 左侧：精选大卡片 */}
            <div
                onClick={() => hasFavorites && navigate('/favorites')}
                className={`col-span-8 card rounded-3xl relative overflow-hidden flex flex-col border-none shadow-2xl ${hasFavorites ? 'cursor-pointer group' : ''}`}
            >
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-element">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                    </div>
                ) : featuredPhoto ? (
                    <>
                        <img
                            src={getAssetUrl(featuredPhoto.filePath)}
                            alt={featuredPhoto.fileName}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="relative z-10 mt-auto p-8">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1 rounded-lg bg-amber-400/20 backdrop-blur-md">
                                    <Icon name="star" className="text-amber-400 text-lg" filled />
                                </div>
                                <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">每日精选</span>
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-1 font-serif tracking-tight">
                                {featuredPhoto.fileName}
                            </h2>
                            <p className="text-white/60 text-sm font-medium mb-4">
                                {favoritesData?.total ?? 0} 张收藏照片
                            </p>
                            {/* 照片信息：优先显示拍摄参数，否则显示基本信息 */}
                            <div className="relative pt-4 border-t border-white/20">
                                <div className="absolute inset-0 -bottom-8 -left-8 -right-8 backdrop-blur-md -z-10" />
                                <div className="flex items-center gap-6">
                                {featuredPhoto.aperture || featuredPhoto.shutterSpeed || featuredPhoto.iso ? (
                                    <>
                                        {featuredPhoto.aperture && (
                                            <div className="flex flex-col">
                                                <span className="text-white/50 text-xs uppercase tracking-wider">光圈</span>
                                                <span className="text-white text-lg font-semibold">f/{featuredPhoto.aperture}</span>
                                            </div>
                                        )}
                                        {featuredPhoto.shutterSpeed && (
                                            <div className="flex flex-col">
                                                <span className="text-white/50 text-xs uppercase tracking-wider">快门</span>
                                                <span className="text-white text-lg font-semibold">{featuredPhoto.shutterSpeed}</span>
                                            </div>
                                        )}
                                        {featuredPhoto.iso && (
                                            <div className="flex flex-col">
                                                <span className="text-white/50 text-xs uppercase tracking-wider">ISO</span>
                                                <span className="text-white text-lg font-semibold">{featuredPhoto.iso}</span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {featuredPhoto.width && featuredPhoto.height && (
                                            <div className="flex flex-col">
                                                <span className="text-white/50 text-xs uppercase tracking-wider">分辨率</span>
                                                <span className="text-white text-lg font-semibold">{featuredPhoto.width} × {featuredPhoto.height}</span>
                                            </div>
                                        )}
                                        <div className="flex flex-col">
                                            <span className="text-white/50 text-xs uppercase tracking-wider">大小</span>
                                            <span className="text-white text-lg font-semibold">{formatFileSize(featuredPhoto.fileSize)}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-white/50 text-xs uppercase tracking-wider">格式</span>
                                            <span className="text-white text-lg font-semibold">{getFileFormat(featuredPhoto.fileName)}</span>
                                        </div>
                                    </>
                                )}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5" />
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                            <div className="relative z-10 w-20 h-20 rounded-3xl bg-element border border-border flex items-center justify-center mb-6 shadow-inner">
                                <Icon name="photo_library" className="text-4xl text-primary/40" size={40} />
                            </div>
                            <h2 className="text-2xl font-bold mb-2 text-primary font-serif relative z-10">每日精选</h2>
                            <p className="text-secondary text-sm max-w-sm relative z-10 leading-relaxed">
                                收藏您喜欢的照片后，这里将展示您的精选作品，为您开启美好的一天。
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* 右侧：最近编辑的照片 */}
            <div
                onClick={() => recentPhoto && onPhotoClick?.(recentPhoto)}
                className="col-span-4 card rounded-3xl relative overflow-hidden group cursor-pointer flex flex-col border border-border bg-surface transition-all duration-300 hover:border-primary/50 hover:shadow-xl hover:-translate-y-1"
            >
                {recentPhoto ? (
                    <>
                        <img
                            src={getAssetUrl(recentPhoto.filePath)}
                            alt={recentPhoto.fileName}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        <div className="relative z-10 mt-auto p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1 rounded-lg bg-primary/20 backdrop-blur-md">
                                    <Icon name="schedule" className="text-primary text-lg" />
                                </div>
                                <span className="text-primary text-xs font-bold uppercase tracking-widest">最近编辑</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-1 font-serif truncate">
                                {recentPhoto.fileName}
                            </h3>
                            <p className="text-white/60 text-sm mb-3">
                                {recentPhoto.dateModified ? formatRelativeTime(recentPhoto.dateModified) : ''}
                            </p>
                            {/* 照片信息：优先显示拍摄参数，否则显示基本信息 */}
                            <div className="relative pt-3 border-t border-white/20">
                                <div className="absolute inset-0 -bottom-6 -left-6 -right-6 backdrop-blur-md -z-10" />
                                <div className="flex items-center gap-4">
                                {recentPhoto.aperture || recentPhoto.shutterSpeed || recentPhoto.iso ? (
                                    <>
                                        {recentPhoto.aperture && (
                                            <div className="flex flex-col">
                                                <span className="text-white/50 text-xs uppercase tracking-wider">光圈</span>
                                                <span className="text-white text-base font-semibold">f/{recentPhoto.aperture}</span>
                                            </div>
                                        )}
                                        {recentPhoto.shutterSpeed && (
                                            <div className="flex flex-col">
                                                <span className="text-white/50 text-xs uppercase tracking-wider">快门</span>
                                                <span className="text-white text-base font-semibold">{recentPhoto.shutterSpeed}</span>
                                            </div>
                                        )}
                                        {recentPhoto.iso && (
                                            <div className="flex flex-col">
                                                <span className="text-white/50 text-xs uppercase tracking-wider">ISO</span>
                                                <span className="text-white text-base font-semibold">{recentPhoto.iso}</span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {recentPhoto.width && recentPhoto.height && (
                                            <div className="flex flex-col">
                                                <span className="text-white/50 text-xs uppercase tracking-wider">分辨率</span>
                                                <span className="text-white text-base font-semibold">{recentPhoto.width} × {recentPhoto.height}</span>
                                            </div>
                                        )}
                                        <div className="flex flex-col">
                                            <span className="text-white/50 text-xs uppercase tracking-wider">大小</span>
                                            <span className="text-white text-base font-semibold">{formatFileSize(recentPhoto.fileSize)}</span>
                                        </div>
                                    </>
                                )}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                            <div className="relative z-10 w-16 h-16 rounded-3xl bg-element border border-border flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary/10 transition-all duration-300 shadow-inner">
                                <Icon name="schedule" className="text-3xl text-primary" size={32} />
                            </div>
                            <h3 className="text-xl font-bold relative z-10 text-primary font-serif">最近编辑</h3>
                            <p className="text-secondary text-sm mt-2 relative z-10 max-w-[180px] leading-snug">
                                收藏或评分照片后，这里将显示您最近编辑的照片
                            </p>
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}
