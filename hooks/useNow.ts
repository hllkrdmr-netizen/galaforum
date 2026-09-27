import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Current time that re-renders every `intervalMs` while the app is in the foreground. */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = setInterval(() => setNow(Date.now()), intervalMs);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        setNow(Date.now());
        if (!timer) timer = setInterval(() => setNow(Date.now()), intervalMs);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    return () => {
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [intervalMs, enabled]);
  return now;
}
