import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '@/hooks/useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('should always return light theme', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('should remove dark class when hook is used', () => {
    document.documentElement.classList.add('dark');
    const { result } = renderHook(() => useTheme());
    // 调用 setTheme 触发 applyLightTheme
    act(() => {
      result.current.setTheme('dark');
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('setTheme should be a no-op (always light)', () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setTheme('dark');
    });
    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
  });
});
