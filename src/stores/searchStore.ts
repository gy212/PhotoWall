/**
 * 搜索状态管理
 *
 * 管理搜索历史、搜索建议等搜索相关状态
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SearchFilters } from '../types';

/**
 * 搜索历史项
 */
export interface SearchHistoryItem {
  /** 唯一标识 */
  id: string;
  /** 搜索查询文本 */
  query: string;
  /** 搜索过滤器 */
  filters: SearchFilters;
  /** 时间戳 */
  timestamp: number;
  /** 搜索结果数量 */
  resultCount?: number;
}

/**
 * 搜索建议项
 */
export interface SearchSuggestion {
  /** 建议类型 */
  type: 'term' | 'field' | 'tag' | 'camera' | 'lens' | 'history';
  /** 建议文本 */
  text: string;
  /** 显示标签 */
  label?: string;
  /** 图标 */
  icon?: string;
}

interface SearchState {
  /** 搜索历史 */
  history: SearchHistoryItem[];
  /** 最大历史记录数 */
  maxHistorySize: number;

  /** 搜索建议 */
  suggestions: SearchSuggestion[];
  /** 建议加载中 */
  suggestionsLoading: boolean;

  /** 当前输入的搜索文本（用于防抖） */
  inputText: string;

  // Actions
  /** 添加到历史记录 */
  addToHistory: (item: Omit<SearchHistoryItem, 'id' | 'timestamp'>) => void;
  /** 从历史记录中移除 */
  removeFromHistory: (id: string) => void;
  /** 清空历史记录 */
  clearHistory: () => void;
  /** 设置搜索建议 */
  setSuggestions: (suggestions: SearchSuggestion[]) => void;
  /** 设置建议加载状态 */
  setSuggestionsLoading: (loading: boolean) => void;
  /** 清空搜索建议 */
  clearSuggestions: () => void;
  /** 设置输入文本 */
  setInputText: (text: string) => void;
  /** 获取最近搜索（前 N 条） */
  getRecentSearches: (limit?: number) => SearchHistoryItem[];
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 检查两个搜索是否相同
 */
function isSameSearch(a: SearchHistoryItem, query: string, filters: SearchFilters): boolean {
  if (a.query !== query) return false;

  // 比较过滤器
  const aFilters = a.filters || {};
  const bFilters = filters || {};

  // 简单比较：转换为 JSON 字符串
  return JSON.stringify(aFilters) === JSON.stringify(bFilters);
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set, get) => ({
      history: [],
      maxHistorySize: 50,
      suggestions: [],
      suggestionsLoading: false,
      inputText: '',

      addToHistory: (item) =>
        set((state) => {
          const newItem: SearchHistoryItem = {
            ...item,
            id: generateId(),
            timestamp: Date.now(),
          };

          // 去重：如果相同查询已存在，移除旧的
          const filtered = state.history.filter(
            (h) => !isSameSearch(h, item.query, item.filters)
          );

          // 新记录放在最前面，限制数量
          return {
            history: [newItem, ...filtered].slice(0, state.maxHistorySize),
          };
        }),

      removeFromHistory: (id) =>
        set((state) => ({
          history: state.history.filter((h) => h.id !== id),
        })),

      clearHistory: () => set({ history: [] }),

      setSuggestions: (suggestions) => set({ suggestions }),

      setSuggestionsLoading: (suggestionsLoading) => set({ suggestionsLoading }),

      clearSuggestions: () => set({ suggestions: [] }),

      setInputText: (inputText) => set({ inputText }),

      getRecentSearches: (limit = 5) => {
        const { history } = get();
        return history.slice(0, limit);
      },
    }),
    {
      name: 'photowall-search',
      // 只持久化历史记录
      partialize: (state) => ({ history: state.history }),
    }
  )
);
