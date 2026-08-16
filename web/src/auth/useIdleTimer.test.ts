import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearIdleActivity, useIdleTimer } from './useIdleTimer';

const STORAGE_KEY = 'havenote-last-activity';

describe('useIdleTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows no warning and does not time out before the warning threshold', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleTimer({ warningMs: 5000, logoutMs: 10000, onTimeout }));

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(result.current.warning).toBe(false);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('flips into warning state once idle for warningMs', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleTimer({ warningMs: 5000, logoutMs: 10000, onTimeout }));

    act(() => {
      vi.advanceTimersByTime(5100);
    });

    expect(result.current.warning).toBe(true);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('calls onTimeout once idle for logoutMs', () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimer({ warningMs: 5000, logoutMs: 10000, onTimeout }));

    act(() => {
      vi.advanceTimersByTime(10100);
    });

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('reset() clears the warning and restarts the countdown', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleTimer({ warningMs: 5000, logoutMs: 10000, onTimeout }));

    act(() => {
      vi.advanceTimersByTime(5100);
    });
    expect(result.current.warning).toBe(true);

    act(() => {
      result.current.reset();
    });
    expect(result.current.warning).toBe(false);

    // Still well under the warning threshold since the reset — should stay clear.
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.warning).toBe(false);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('logs out immediately on mount if the persisted activity timestamp is already stale', () => {
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    localStorage.setItem(STORAGE_KEY, String(Date.now() - 20000));
    const onTimeout = vi.fn();

    renderHook(() => useIdleTimer({ warningMs: 5000, logoutMs: 10000, onTimeout }));

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('logs out on a visibilitychange event using the persisted timestamp, even if the interval never ran', () => {
    // This is the actual fix: a backgrounded mobile tab can have its
    // setInterval fully suspended by the OS for hours, so the interval below
    // never gets a chance to fire — the visibilitychange check is what
    // catches it on resume instead.
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimer({ warningMs: 5000, logoutMs: 10000, onTimeout }));
    expect(onTimeout).not.toHaveBeenCalled();

    vi.setSystemTime(new Date('2026-01-02T00:00:15Z')); // +15s, past logoutMs, timers never advanced
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('clearIdleActivity removes the persisted timestamp', () => {
    localStorage.setItem(STORAGE_KEY, '123');
    clearIdleActivity();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
