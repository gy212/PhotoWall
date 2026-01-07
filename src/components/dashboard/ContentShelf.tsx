import { useRef, useEffect, useState, useCallback } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Photo } from '@/types';
import { Icon, IconName } from '@/components/common/Icon';

interface ContentShelfProps {
    title: string;
    icon?: string; // Kept as string for compatibility, but will interpret as IconName
    photos?: Photo[];
    loading?: boolean;
    onPhotoClick?: (photo: Photo) => void;
}

export default function ContentShelf({
    title,
    icon = 'grid_view',
    photos = [],
    loading = false,
    onPhotoClick
}: ContentShelfProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 0);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    }, []);

    useEffect(() => {
        checkScroll();
        const el = scrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', checkScroll);
        window.addEventListener('resize', checkScroll);
        return () => {
            el.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, [checkScroll, photos]);

    const scroll = (direction: 'left' | 'right') => {
        const el = scrollRef.current;
        if (!el) return;
        const scrollAmount = el.clientWidth * 0.8;
        el.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    };

    // 加载状态
    if (loading) {
        return (
            <section className="flex-shrink-0">
                <div className="flex items-center justify-between mb-4 px-1">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-primary">
                        <Icon name={icon as IconName} className="text-primary text-xl" />
                        {title}
                    </h3>
                </div>
                <div className="flex items-center justify-center w-full py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
                    <span className="ml-3 text-secondary text-sm">加载中...</span>
                </div>
            </section>
        );
    }

    // 空状态
    if (photos.length === 0) {
        return (
            <section className="flex-shrink-0">
                <div className="flex items-center justify-between mb-4 px-1">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-primary">
                        <Icon name={icon as IconName} className="text-primary text-xl" />
                        {title}
                    </h3>
                </div>
                <div className="flex items-center justify-center w-full py-12">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center mb-4">
                            <Icon name="add_photo_alternate" className="text-3xl text-secondary" size={32} />
                        </div>
                        <p className="text-secondary text-sm">暂无照片</p>
                        <p className="text-secondary/70 text-xs mt-1">扫描文件夹开始使用</p>
                    </div>
                </div>
            </section>
        );
    }

    // 有照片时显示横向滚动列表
    return (
        <section className="flex-shrink-0">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-primary font-serif">
                    <Icon name={icon as IconName} className="text-primary text-xl" />
                    {title}
                </h3>
                <span className="text-sm text-secondary">{photos.length} 张</span>
            </div>

            <div className="relative group">
                {/* 左滚动按钮 */}
                {canScrollLeft && (
                    <button
                        onClick={() => scroll('left')}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-surface shadow-md border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-hover hover:scale-105"
                    >
                        <Icon name="chevron_left" className="text-primary" />
                    </button>
                )}

                {/* 右滚动按钮 */}
                {canScrollRight && (
                    <button
                        onClick={() => scroll('right')}
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-surface shadow-md border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-hover hover:scale-105"
                    >
                        <Icon name="chevron_right" className="text-primary" />
                    </button>
                )}

                {/* 照片滚动容器 */}
                <div
                    ref={scrollRef}
                    className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth pb-2"
                >
                    {photos.map((photo) => (
                        <div
                            key={photo.photoId}
                            onClick={() => onPhotoClick?.(photo)}
                            className="flex-shrink-0 w-40 h-40 rounded-lg overflow-hidden bg-surface border border-border shadow-sm hover:shadow-md transition-all cursor-pointer group/item"
                        >
                            <img
                                src={convertFileSrc(photo.filePath)}
                                alt={photo.fileName}
                                className="w-full h-full object-cover group-hover/item:scale-105 transition-transform duration-300"
                                loading="lazy"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
