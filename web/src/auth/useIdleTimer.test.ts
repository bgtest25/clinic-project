import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIdleTimer } from './useIdleTimer';

describe('useIdleTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
});
