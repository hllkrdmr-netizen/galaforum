import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { invalidateQueries } from '../../hooks/useForumQuery';
import { useAuth } from '../../lib/auth/AuthProvider';
import { pushHref } from '../../lib/notifications';
import type { PushPayload } from '../../lib/notifications';
import { enablePushOnThisDevice, getPushProvider, setPushProvider } from '../../lib/push';
import type { PushProvider, PushStatus } from '../../lib/push';
import { notifications } from '../../services/notifications';

/** EAS project id (set by `eas init`); without it Expo cannot issue push tokens. */
function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Genel',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#D9A441',
    vibrationPattern: [0, 200, 120, 200],
  });
}

/** Expo implementation of the app's PushProvider (lib/push.ts). */
export function createExpoPushProvider(): PushProvider {
  return {
    name: 'expo',
    async getStatus(): Promise<PushStatus> {
      // Simulators/emulators and builds without an EAS project cannot receive remote pushes.
      if (!Device.isDevice || !projectId()) return 'unsupported';
      const p = await Notifications.getPermissionsAsync();
      if (p.granted) return 'granted';
      return p.canAskAgain ? 'undetermined' : 'denied';
    },
    async requestToken() {
      const id = projectId();
      if (!Device.isDevice || !id) return null;
      await ensureAndroidChannel();
      const current = await Notifications.getPermissionsAsync();
      const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
      if (!granted) return null;
      const token = await Notifications.getExpoPushTokenAsync({ projectId: id });
      return token.data;
    },
  };
}

setPushProvider(createExpoPushProvider());

// Foreground: show the banner too (the in-app bell also updates through realtime).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Mounted once in the root layout (native only; web uses PushBridge.web.tsx):
 * - opens the right screen when a push is tapped (also after a cold start),
 * - re-registers this device's token after sign-in when permission was already granted.
 */
export function PushBridge() {
  const { status, user } = useAuth();
  const last = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!last || last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = last.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const data = last.notification.request.content.data as PushPayload | undefined;
    invalidateQueries('notif:');
    router.push(pushHref(data));
    Notifications.clearLastNotificationResponse();
  }, [last]);

  useEffect(() => {
    if (status !== 'signedIn') return;
    let active = true;
    void getPushProvider()
      .getStatus()
      .then((s) => (active && s === 'granted' ? enablePushOnThisDevice(notifications) : undefined))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [status, user?.id]);

  return null;
}
