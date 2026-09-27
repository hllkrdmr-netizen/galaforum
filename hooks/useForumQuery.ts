import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Minimal query cache: key-based caching, in-flight de-duplication, stale-time and invalidation.
 * Deliberately small and API-compatible in spirit with TanStack Query so it can be swapped
 * for `@tanstack/react-query` once that dependency is added (see docs/ROADMAP.md).
 */

type Status = 'idle' | 'loading' | 'success' | 'error';

interface Entry<T = unknown> {
  status: Status;
  data?: T;
  error?: Error;
  updatedAt: number;
  promise?: Promise<void>;
}

const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();

function emit(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

function subscribe(key: string, cb: () => void) {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(cb);
  return () => {
    set!.delete(cb);
  };
}

const IDLE: Entry = { status: 'idle', updatedAt: 0 };

function fetchKey<T>(key: string, fn: () => Promise<T>): Promise<void> {
  const current = cache.get(key);
  if (current?.promise) return current.promise;
  const promise = fn()
    .then((data) => {
      cache.set(key, { status: 'success', data, updatedAt: Date.now() });
    })
    .catch((e: unknown) => {
      const error = e instanceof Error ? e : new Error(String(e));
      cache.set(key, { status: 'error', error, data: current?.data, updatedAt: Date.now() });
    })
    .finally(() => emit(key));
  cache.set(key, { ...(current ?? IDLE), status: current?.data !== undefined ? current.status : 'loading', promise });
  emit(key);
  return promise;
}

/** Marks every cached key starting with `prefix` as stale and refetches mounted ones on next render. */
export function invalidateQueries(prefix: string) {
  for (const [key, entry] of cache) {
    if (key.startsWith(prefix)) {
      cache.set(key, { ...entry, updatedAt: 0 });
      emit(key);
    }
  }
}

export interface QueryResult<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: () => Promise<void>;
}

export function useForumQuery<T>(
  key: string,
  fn: () => Promise<T>,
  options: { staleTime?: number; enabled?: boolean } = {},
): QueryResult<T> {
  const { staleTime = 30_000, enabled = true } = options;
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const entry = useSyncExternalStore(
    useCallback((cb) => subscribe(key, cb), [key]),
    () => (cache.get(key) ?? IDLE) as Entry<T>,
    () => (cache.get(key) ?? IDLE) as Entry<T>,
  );

  useEffect(() => {
    if (!enabled) return;
    const e = cache.get(key);
    if (e?.promise) return;
    // A floor of 1s prevents a refetch loop when staleTime is 0 (each fetch updates `updatedAt`).
    const fresh = e && e.status === 'success' && Date.now() - e.updatedAt < Math.max(staleTime, 1000);
    // Errors are not retried automatically (avoids retry storms); the UI offers an explicit retry.
    const failedRecently = e && e.status === 'error' && e.updatedAt > 0;
    if (!fresh && !failedRecently) void fetchKey(key, () => fnRef.current());
  }, [key, enabled, staleTime, entry.updatedAt]);

  const refetch = useCallback(() => fetchKey(key, () => fnRef.current()), [key]);

  return {
    data: entry.data,
    error: entry.status === 'error' ? entry.error : undefined,
    isLoading: enabled && entry.data === undefined && (entry.status === 'loading' || entry.status === 'idle'),
    isRefreshing: Boolean(entry.promise) && entry.data !== undefined,
    refetch,
  };
}
