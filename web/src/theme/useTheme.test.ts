import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from './useTheme';

function mockMatchMedia(matches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.push(cb),
    removeEventListener: vi.fn(),
  });
  return {
    fireChange: (next: boolean) => listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent)),
  };
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to the system theme when nothing is stored', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('prefers a stored theme over the system theme', () => {
    mockMatchMedia(true);
    localStorage.setItem('havenote-theme', 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('toggleTheme flips the theme and persists it', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');

    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('havenote-theme')).toBe('dark');
  });

  it('stops following the system once an explicit choice has been made', () => {
    const { fireChange } = mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme('dark'));
    act(() => fireChange(false));

    expect(result.current.theme).toBe('dark');
  });

  it('follows a live system change when no explicit choice has been made', () => {
    const { fireChange } = mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');

    act(() => fireChange(true));

    expect(result.current.theme).toBe('dark');
  });
});
