import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getFavoritePhotos, getAssetUrl } from '@/services/api';
import { useMemo } from 'react';
import type { Photo } from '@/types';

import { Icon } from '@/components/common/Icon';

export default function HeroSection() {
    const navigate = useNavigate();

    // 获取收藏照片
    const { data: favoritesData, isLoading } = useQuery({
        queryKey: ['favoritePhotos', 'hero'],
        queryFn: () => getFavoritePhotos({ page: 1, pageSize: 10 }),
        staleTime: 30000, // 30秒内不重新请求
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
        <section className="grid grid-cols-12 gap-5 h-[280px] flex-shrink-0">
            {/* 左侧：精选大卡片 */}
            <div
                onClick={() => hasFavorites && navigate('/favorites')}
                className={`col-span-8 card rounded-2xl relative overflow-hidden flex flex-col ${hasFavorites ? 'cursor-pointer group' : ''}`}
            >
                {isLoading ? (
                    // 加载状态
                    <div className="absolute inset-0 flex items-center justify-center bg-element">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    </div>
                ) : featuredPhoto ? (
                    // 有精选照片
                    <>
                        <img
                            src={getAssetUrl(featuredPhoto.filePath)}
                            alt={featuredPhoto.fileName}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                        <div className="relative z-10 mt-auto p-5">
                            <div className="flex items-center gap-2 mb-1.5">
                                <Icon name="star" className="text-amber-400 text-lg" />
                                <span className="text-amber-400/90 text-xs font-medium">每日精选</span>
                            </div>
                            <h2 className="text-xl font-medium text-white mb-0.5">
                                {featuredPhoto.fileName}
                            </h2>
                            <p className="text-white/50 text-sm">
                                {favoritesData?.total ?? 0} 张收藏照片
                            </p>
                        </div>
                    </>
                ) : (
                    // 空状态
                    <>
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10" />
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                            <div className="relative z-10 w-16 h-16 rounded-2xl bg-element border border-border flex items-center justify-center mb-4">
                                <Icon name="photo_library" className="text-3xl text-primary/60" size={32} />
                            </div>
                            <h2 className="text-lg font-medium mb-2 text-primary relative z-10">每日精选</h2>
                            <p className="text-secondary text-sm max-w-md relative z-10">
                                收藏您喜欢的照片后，这里将展示您的精选作品
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* 右侧：文件合集入口 */}
            <div
                onClick={() => navigate('/folders')}
                className="col-span-4 card rounded-2xl relative overflow-hidden group cursor-pointer flex flex-col items-center justify-center text-center p-5 hover:border-primary/30 transition-all duration-200"
            >
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="relative z-10 w-14 h-14 rounded-2xl bg-element border border-border flex items-center justify-center mb-4 group-hover:scale-105 group-hover:bg-surface transition-all duration-200">
                    <Icon name="folder_open" className="text-2xl text-primary" size={28} />
                </div>
                <h3 className="text-lg font-medium relative z-10 text-primary">文件合集</h3>
                <p className="text-secondary text-sm mt-1 relative z-10">浏览所有文件夹和来源</p>
            </div>
        </section>
    );
}
