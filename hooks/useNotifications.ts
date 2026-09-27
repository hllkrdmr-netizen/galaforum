import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '../lib/auth/AuthProvider';
import { notifications } from '../services/notifications';
import { invalidateQueries, useForumQuery } from './useForumQuery';

// One realtime subscription for the whole app, shared by every mounted consumer (ref-counted), so
// the bell, the inbox and the "Daha" row do not each open a channel.
let subscribers = 0;
let unsubscribe: (() => void) | null = null;

function retainRealtime() {
  subscribers += 1;
  if (subscribers === 1) unsubscribe = notifications.subscribe(() => invalidateQueries('notif:'));
}

function releaseRealtime() {
  subscribers = Math.max(0, subscribers - 1);
  if (subscribers === 0 && unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

/** True when there is an inbox to show: a signed-in member, or the demo guest. */
export function useHasInbox(): boolean {
  const { status } = useAuth();
  return status === 'signedIn' || status === 'unavailable';
}

/** Unread count for badges; live via realtime, refreshed when the app returns to the foreground. */
export function useUnreadNotifications(): number {
  const { status, user } = useAuth();
  const enabled = status === 'signedIn' || status === 'unavailable';
  // The key includes the member so a sign-out/sign-in never shows the previous member's count.
  const query = useForumQuery(`notif:unread:${user?.id ?? 'demo'}`, () => notifications.unreadCount(), { enabled, staleTime: 60_000 });

  useEffect(() => {
    if (!enabled) return;
    retainRealtime();
    const appState =
      Platform.OS === 'web'
        ? null
        : AppState.addEventListener('change', (s) => {
            if (s === 'active') invalidateQueries('notif:');
          });
    return () => {
      appState?.remove();
      releaseRealtime();
    };
  }, [enabled, user?.id]);

  return enabled ? (query.data ?? 0) : 0;
}
