import { useRef, useEffect, useState, useCallback } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Photo } from '@/types';

interface ContentShelfProps {
    title: string;
    icon?: string;
    photos?: Photo[];
    loading?: boolean;
}

export default function ContentShelf({
    title,
    icon = 'grid_view',
    photos = [],
    loading = false
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
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-white/90">
                        <span className="material-symbols-outlined text-blue-300 text-xl">{icon}</span>
                        {title}
                    </h3>
                </div>
                <div className="flex items-center justify-center w-full py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
                    <span className="ml-3 text-white/40 text-sm">加载中...</span>
                </div>
            </section>
        );
    }

    // 空状态
    if (photos.length === 0) {
        return (
            <section className="flex-shrink-0">
                <div className="flex items-center justify-between mb-4 px-1">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-white/90">
                        <span className="material-symbols-outlined text-blue-300 text-xl">{icon}</span>
                        {title}
                    </h3>
                </div>
                <div className="flex items-center justify-center w-full py-12">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-3xl text-white/30">add_photo_alternate</span>
                        </div>
                        <p className="text-white/40 text-sm">暂无照片</p>
                        <p className="text-white/25 text-xs mt-1">扫描文件夹开始使用</p>
                    </div>
                </div>
            </section>
        );
    }

    // 有照片时显示横向滚动列表
    return (
        <section className="flex-shrink-0">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-white/90">
                    <span className="material-symbols-outlined text-blue-300 text-xl">{icon}</span>
                    {title}
                </h3>
                <span className="text-sm text-white/40">{photos.length} 张</span>
            </div>

            <div className="relative group">
                {/* 左滚动按钮 */}
                {canScrollLeft && (
                    <button
                        onClick={() => scroll('left')}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                    >
                        <span className="material-symbols-outlined text-white">chevron_left</span>
                    </button>
                )}

                {/* 右滚动按钮 */}
                {canScrollRight && (
                    <button
                        onClick={() => scroll('right')}
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                    >
                        <span className="material-symbols-outlined text-white">chevron_right</span>
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
                            className="flex-shrink-0 w-40 h-40 rounded-xl overflow-hidden bg-white/5 border border-white/5 hover:border-white/20 transition-all cursor-pointer group/item"
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
