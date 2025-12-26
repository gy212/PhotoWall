/**
 * 日期分组工具函数
 * 用于 PhotoGrid 和 TimelineView 的共享日期分组逻辑
 */

export interface DateGroup<T> {
  date: string;           // ISO 日期 key (2025-12-26)
  displayDate: string;    // 显示文本 (今天/昨天/星期X/12月26日)
  items: T[];
}

/**
 * 格式化日期标签
 * - 今天 → "今天"
 * - 昨天 → "昨天"
 * - 7天内 → "星期X"
 * - 更早 → "X月X日"
 * - 未知 → "未知日期"
 */
export function formatDateLabel(dateStr: string): string {
  if (dateStr === 'unknown') return '未知日期';

  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return '今天';
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return '昨天';
  }

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  if (date > weekAgo) {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return days[date.getDay()];
  }

  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 通用日期分组函数
 * @param items 要分组的项目数组
 * @param getDate 获取项目日期的函数，返回 ISO 日期字符串或 null
 * @returns 按日期分组的数组，按日期降序排列
 */
export function groupByDate<T>(
  items: T[],
  getDate: (item: T) => string | null
): DateGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const dateValue = getDate(item);
    const dateKey = dateValue ? new Date(dateValue).toISOString().split('T')[0] : 'unknown';

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(item);
  }

  return Array.from(groups.entries())
    .map(([date, groupItems]) => ({
      date,
      displayDate: formatDateLabel(date),
      items: groupItems,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
