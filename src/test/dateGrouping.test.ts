import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDateLabel, groupByDate } from '@/utils/dateGrouping';

describe('formatDateLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-11T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "今天" for today', () => {
    expect(formatDateLabel('2025-01-11')).toBe('今天');
  });

  it('returns "昨天" for yesterday', () => {
    expect(formatDateLabel('2025-01-10')).toBe('昨天');
  });

  it('returns weekday for dates within 7 days', () => {
    // 2025-01-06 is Monday
    expect(formatDateLabel('2025-01-06')).toBe('星期一');
  });

  it('returns "X月X日" for older dates', () => {
    expect(formatDateLabel('2024-12-25')).toBe('12月25日');
  });

  it('returns "未知日期" for unknown', () => {
    expect(formatDateLabel('unknown')).toBe('未知日期');
  });
});

describe('groupByDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-11T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('groups items by date in descending order', () => {
    const items = [
      { id: 1, date: '2025-01-11T10:00:00Z' },
      { id: 2, date: '2025-01-10T10:00:00Z' },
      { id: 3, date: '2025-01-11T15:00:00Z' },
    ];
    const groups = groupByDate(items, (item) => item.date);
    expect(groups.length).toBe(2);
    expect(groups[0].date).toBe('2025-01-11');
    expect(groups[0].items.length).toBe(2);
    expect(groups[1].date).toBe('2025-01-10');
  });

  it('puts null dates in unknown group', () => {
    const items = [
      { id: 1, date: null },
      { id: 2, date: '2025-01-11T10:00:00Z' },
    ];
    const groups = groupByDate(items, (item) => item.date);
    const unknownGroup = groups.find((g) => g.date === 'unknown');
    expect(unknownGroup).toBeDefined();
    expect(unknownGroup!.displayDate).toBe('未知日期');
  });

  it('returns empty array for empty input', () => {
    const groups = groupByDate([], () => null);
    expect(groups).toEqual([]);
  });
});
