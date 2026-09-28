import { Platform } from 'react-native';

import type { PushPlatform } from '../types/notification';

/**
 * Push abstraction. Screens talk to push only through a PushProvider. On iOS/Android the Expo provider
 * (features/app/PushBridge.tsx, registered at startup) is used; on web, and before registration, the
 * default provider reports "unsupported" and the settings screen says so honestly.
 */
export type PushStatus = 'unsupported' | 'undetermined' | 'denied' | 'granted';

export interface PushProvider {
  readonly name: string;
  getStatus(): Promise<PushStatus>;
  /** Asks for permission when needed; resolves to an Expo push token or null (denied/unavailable). */
  requestToken(): Promise<string | null>;
}

const unsupported: PushProvider = {
  name: 'none',
  async getStatus() {
    return 'unsupported';
  },
  async requestToken() {
    return null;
  },
};

let provider: PushProvider = unsupported;
let registeredToken: string | null = null;

export function setPushProvider(next: PushProvider | null): void {
  provider = next ?? unsupported;
}

export function getPushProvider(): PushProvider {
  return provider;
}

export function currentPlatform(): PushPlatform {
  return Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
}

interface TokenStore {
  registerPushToken(token: string, platform: PushPlatform): Promise<void>;
  unregisterPushToken(token: string): Promise<void>;
}

export type EnableResult = 'enabled' | 'denied' | 'unsupported';

/** Requests permission + token and stores it for the signed-in member. */
export async function enablePushOnThisDevice(store: TokenStore): Promise<EnableResult> {
  const status = await provider.getStatus();
  if (status === 'unsupported') return 'unsupported';
  const token = await provider.requestToken();
  if (!token) return 'denied';
  await store.registerPushToken(token, currentPlatform());
  registeredToken = token;
  return 'enabled';
}

/** Call before sign-out so the next person on this device does not get the previous member's pushes. */
export async function disablePushOnThisDevice(store: TokenStore): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await store.unregisterPushToken(token).catch(() => undefined);
}
