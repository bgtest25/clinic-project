import { useCallback, useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart'] as const;
const THROTTLE_MS = 1000;
const STORAGE_KEY = 'havenote-last-activity';

function readStoredActivity(): number | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

function recordActivity(now: number) {
  localStorage.setItem(STORAGE_KEY, String(now));
}

export function clearIdleActivity() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useIdleTimer({
  warningMs,
  logoutMs,
  onTimeout,
}: {
  warningMs: number;
  logoutMs: number;
  onTimeout: () => void;
}) {
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil((logoutMs - warningMs) / 1000));
  const lastActivityRef = useRef(readStoredActivity() ?? Date.now());
  const lastResetRef = useRef(Date.now());

  const reset = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    recordActivity(now);
    setWarning(false);
    setSecondsLeft(Math.ceil((logoutMs - warningMs) / 1000));
  }, [logoutMs, warningMs]);

  useEffect(() => {
    function handleActivity() {
      const now = Date.now();
      if (now - lastResetRef.current < THROTTLE_MS) return;
      lastResetRef.current = now;
      if (!warning) {
        lastActivityRef.current = now;
        recordActivity(now);
      }
    }

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity));
    return () => ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
  }, [warning]);

  // Mobile browsers throttle or fully suspend setInterval in a backgrounded
  // tab — the interval below can silently fail to fire for hours. This is
  // exactly how a clinician's phone stayed signed in overnight (found live
  // 2026-08-16): the tab was backgrounded, the interval never ran, and the
  // idle-logout that should have fired within 15 minutes simply never did.
  // Checking elapsed time immediately whenever the tab becomes
  // visible/focused again — against the persisted timestamp, not just
  // in-memory state, since the page may have been fully reloaded — closes
  // that gap: this check runs on resume regardless of whether the interval
  // ever got a chance to run while backgrounded.
  useEffect(() => {
    function checkNow() {
      const last = readStoredActivity() ?? lastActivityRef.current;
      if (Date.now() - last >= logoutMs) onTimeout();
    }
    document.addEventListener('visibilitychange', checkNow);
    window.addEventListener('focus', checkNow);
    checkNow();
    return () => {
      document.removeEventListener('visibilitychange', checkNow);
      window.removeEventListener('focus', checkNow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoutMs, onTimeout]);

  useEffect(() => {
    const interval = setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= logoutMs) {
        onTimeout();
      } else if (idleFor >= warningMs) {
        setWarning(true);
        setSecondsLeft(Math.max(0, Math.ceil((logoutMs - idleFor) / 1000)));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [warningMs, logoutMs, onTimeout]);

  return { warning, secondsLeft, reset };
}
