import clsx from 'clsx';

// 临时模拟标签数据
const TAG_FILTERS = [
    { id: 'all', label: '全部', icon: '' },
    { id: 'fav', label: '收藏', icon: '❤️' },
    { id: 'landscape', label: '风景', icon: '🏔️' },
    { id: 'portrait', label: '人像', icon: '👤' },
    { id: 'pets', label: '宠物', icon: '🐱' },
    { id: '2025', label: '2025年', icon: '📅' },
    { id: 'raw', label: 'RAW', icon: '📸' },
];

export default function TagRibbon() {
    const activeTag = 'all'; // 暂时硬编码，后续应从 store 获取

    return (
        <section className="flex-shrink-0">
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-4 px-1">快速筛选</h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 mask-linear">
                {TAG_FILTERS.map((tag) => (
                    <button
                        key={tag.id}
                        className={clsx(
                            "px-5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 border",
                            activeTag === tag.id
                                ? "bg-primary text-white shadow-md border-transparent"
                                : "bg-surface text-secondary border-border hover:text-primary hover:bg-hover hover:border-border"
                        )}
                    >
                        <span className="mr-1">{tag.icon}</span>
                        {tag.label}
                    </button>
                ))}
            </div>
        </section>
    );
}
