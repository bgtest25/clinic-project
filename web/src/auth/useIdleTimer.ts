import { useCallback, useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart'] as const;
const THROTTLE_MS = 1000;

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
  const lastActivityRef = useRef(Date.now());
  const lastResetRef = useRef(Date.now());

  const reset = useCallback(() => {
    lastActivityRef.current = Date.now();
    setWarning(false);
    setSecondsLeft(Math.ceil((logoutMs - warningMs) / 1000));
  }, [logoutMs, warningMs]);

  useEffect(() => {
    function handleActivity() {
      const now = Date.now();
      if (now - lastResetRef.current < THROTTLE_MS) return;
      lastResetRef.current = now;
      if (!warning) lastActivityRef.current = now;
    }

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity));
    return () => ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
  }, [warning]);

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
