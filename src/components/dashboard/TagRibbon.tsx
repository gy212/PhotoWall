import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { getAllTagsWithCount } from '@/services/api';
import { usePhotoStore } from '@/stores/photoStore';

// RAW 格式扩展名
const RAW_EXTENSIONS = ['cr2', 'nef', 'arw', 'dng', 'raw', 'orf', 'rw2', 'raf', 'srw', 'pef'];

// 特殊筛选项
const SPECIAL_FILTERS = [
    { id: 'all', label: '全部', icon: '' },
    { id: 'fav', label: '收藏', icon: '❤️' },
    { id: '2025', label: '2025年', icon: '📅' },
    { id: 'raw', label: 'RAW', icon: '📸' },
];

export default function TagRibbon() {
    const { data: tagsWithCount } = useQuery({
        queryKey: ['tagsWithCount'],
        queryFn: getAllTagsWithCount,
    });

    const searchFilters = usePhotoStore(state => state.searchFilters);
    const setSearchFilters = usePhotoStore(state => state.setSearchFilters);
    const clearSearchFilters = usePhotoStore(state => state.clearSearchFilters);

    // 判断当前激活的筛选项
    const getActiveFilter = (): string => {
        const { favoritesOnly, dateFrom, dateTo, tagIds, fileExtensions } = searchFilters;

        // 检查是否有任何筛选条件
        const hasFilters = favoritesOnly || dateFrom || dateTo ||
            (tagIds && tagIds.length > 0) || (fileExtensions && fileExtensions.length > 0);

        if (!hasFilters) return 'all';
        if (favoritesOnly) return 'fav';
        if (dateFrom === '2025-01-01' && dateTo === '2025-12-31') return '2025';
        if (fileExtensions && fileExtensions.length > 0) return 'raw';
        if (tagIds && tagIds.length === 1) return `tag-${tagIds[0]}`;
        return '';
    };

    const activeFilter = getActiveFilter();

    const handleFilterClick = (filterId: string, tagId?: number) => {
        if (filterId === 'all') {
            clearSearchFilters();
        } else if (filterId === 'fav') {
            setSearchFilters({ favoritesOnly: true });
        } else if (filterId === '2025') {
            setSearchFilters({ dateFrom: '2025-01-01', dateTo: '2025-12-31' });
        } else if (filterId === 'raw') {
            setSearchFilters({ fileExtensions: RAW_EXTENSIONS });
        } else if (tagId !== undefined) {
            const tag = tagsWithCount?.find(t => t.tagId === tagId);
            setSearchFilters({
                tagIds: [tagId],
                tagNames: tag ? [tag.tagName] : undefined
            });
        }
    };

    const renderButton = (id: string, label: string, icon: string, isActive: boolean, onClick: () => void) => (
        <button
            key={id}
            onClick={onClick}
            className={clsx(
                "px-5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 border",
                isActive
                    ? "bg-primary text-white shadow-md border-transparent"
                    : "bg-surface text-secondary border-border hover:text-primary hover:bg-hover hover:border-border"
            )}
        >
            {icon && <span className="mr-1">{icon}</span>}
            {label}
        </button>
    );

    return (
        <section className="flex-shrink-0">
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-4 px-1">快速筛选</h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 mask-linear">
                {/* 特殊筛选项 */}
                {SPECIAL_FILTERS.map((filter) =>
                    renderButton(
                        filter.id,
                        filter.label,
                        filter.icon,
                        activeFilter === filter.id,
                        () => handleFilterClick(filter.id)
                    )
                )}

                {/* 动态标签 */}
                {tagsWithCount?.map((item) =>
                    renderButton(
                        `tag-${item.tagId}`,
                        item.tagName,
                        '',
                        activeFilter === `tag-${item.tagId}`,
                        () => handleFilterClick(`tag-${item.tagId}`, item.tagId)
                    )
                )}
            </div>
        </section>
    );
}
