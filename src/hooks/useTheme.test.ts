import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTheme } from './useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    // 清理 localStorage
    localStorage.clear();
    // 重置 DOM 类
    document.documentElement.classList.remove('dark');
  });

  it('should initialize with system theme', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
  });

  it('should set light theme', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should set dark theme', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should switch from light to dark', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('light');
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    act(() => {
      result.current.setTheme('dark');
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should resolve system theme', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('system');
    });

    expect(result.current.theme).toBe('system');
    // resolvedTheme should be either 'light' or 'dark'
    expect(['light', 'dark']).toContain(result.current.resolvedTheme);
  });

  it('should persist theme preference', () => {
    const { result, unmount } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });

    // 卸载
    unmount();

    // 重新渲染，应该保持dark主题
    const { result: result2 } = renderHook(() => useTheme());
    expect(result2.current.theme).toBe('dark');
  });
});
