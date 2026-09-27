import { compareNewestFirst, cursorOf, DEFAULT_SETTINGS, EXPO_TOKEN_PATTERN, groupOf, mergeSettings, normalizeSetting, parseCursor } from '../../lib/notifications';
import type { AppNotification, NotificationKind, NotificationSetting } from '../../types/notification';
import { DEMO_USERS } from '../forum/demoData';
import { ForumError } from '../forum/repository';
import type { NotificationRepository } from './repository';

const MIN = 60_000;

type Seed = Omit<AppNotification, 'actor' | 'createdAt' | 'readAt' | 'actorCount' | 'topicId' | 'postId' | 'meetupId' | 'matchId' | 'badgeId'> &
  Partial<Pick<AppNotification, 'topicId' | 'postId' | 'meetupId' | 'matchId' | 'badgeId' | 'actorCount'>> & {
    actorId?: string;
    minutesAgo: number;
    read?: boolean;
  };

const user = (id: string | undefined) => (id ? (DEMO_USERS.find((u) => u.id === id) ?? null) : null);

/** Sample inbox for the demo guest (misafir_taraftar); times are relative to `now`. */
export function buildDemoNotifications(now: number = Date.now()): AppNotification[] {
  const seeds: Seed[] = [
    {
      id: 'n-goal-2',
      kind: 'match_goal',
      matchId: 'm-canli',
      topicId: 't-mac-canli',
      data: { match_title: 'Galatasaray – Trabzonspor', minute: 51, event_type: 'goal', team: 'Trabzonspor' },
      minutesAgo: 6,
    },
    {
      id: 'n-reply-pivot',
      kind: 'reply',
      actorId: 'u-taktik',
      actorCount: 3,
      topicId: 't-cift-pivot',
      postId: 'p-pivot-4',
      data: { topic_title: 'Derbilerde çift pivot mu, tek ön libero mu?', excerpt: 'Derbide rakibin iki forvetle basması tek pivotu yalnız bırakır; ikinci pivot şart.' },
      minutesAgo: 12,
    },
    {
      id: 'n-mention-koreografi',
      kind: 'mention',
      actorId: 'u-tribun1905',
      topicId: 't-koreografi',
      data: { topic_title: 'Sezon açılışı koreografisi için fikir havuzu', excerpt: '@misafir_taraftar kuzey tribünü için renk planını sen hazırlar mısın?' },
      minutesAgo: 38,
    },
    {
      id: 'n-goal-1',
      kind: 'match_goal',
      matchId: 'm-canli',
      topicId: 't-mac-canli',
      data: { match_title: 'Galatasaray – Trabzonspor', minute: 23, event_type: 'goal', team: 'Galatasaray' },
      minutesAgo: 49,
    },
    {
      id: 'n-start',
      kind: 'match_start',
      matchId: 'm-canli',
      topicId: 't-mac-canli',
      data: { match_title: 'Galatasaray – Trabzonspor', competition: 'Süper Lig' },
      minutesAgo: 72,
    },
    {
      id: 'n-like',
      kind: 'like',
      actorId: 'u-aslanpence',
      actorCount: 5,
      topicId: 't-2000',
      data: { topic_title: '2000 UEFA Kupası yolculuğu: sizin için unutulmaz an hangisi?', excerpt: 'Kopenhag gecesi televizyon başında ağladığımı hatırlıyorum.' },
      minutesAgo: 3 * 60,
    },
    {
      id: 'n-follow',
      kind: 'follow',
      actorId: 'u-kopenhag',
      data: {},
      minutesAgo: 26 * 60,
      read: true,
    },
    {
      id: 'n-category',
      kind: 'category_topic',
      actorId: 'u-ankara',
      topicId: 't-kis-oncelik',
      data: { topic_title: 'Kış döneminde öncelik stoper mi, sol kanat mı?', category_name: 'Transfer', category_slug: 'transfer' },
      minutesAgo: 30 * 60,
      read: true,
    },
    {
      id: 'n-quote',
      kind: 'quote',
      actorId: 'u-taktik',
      topicId: 't-bek-bindirme',
      data: { topic_title: 'Bek bindirmeleri ve geride kalan alan: savunma dengesi', excerpt: 'Katılıyorum; ön liberonun kaymasıyla stoperler genişliği kapatabilir.' },
      minutesAgo: 3 * 24 * 60,
      read: true,
    },
    {
      id: 'n-end',
      kind: 'match_end',
      matchId: 'm-gecen',
      topicId: 't-mac-gecen',
      data: { match_title: 'Galatasaray – Kasımpaşa', competition: 'Süper Lig', home_score: 2, away_score: 1 },
      minutesAgo: 4 * 24 * 60 - 3 * 60,
      read: true,
    },
    {
      id: 'n-badge',
      kind: 'badge',
      badgeId: 'yeni-uye',
      data: { badge_name: 'Yeni Üye', badge_icon: 'leaf-outline' },
      minutesAgo: 9 * 24 * 60,
      read: true,
    },
  ];
  return seeds
    .map(({ actorId, minutesAgo, read, ...s }) => {
      const createdAt = new Date(now - minutesAgo * MIN).toISOString();
      return {
        topicId: null,
        postId: null,
        meetupId: null,
        matchId: null,
        badgeId: null,
        actorCount: 1,
        ...s,
        actor: user(actorId),
        createdAt,
        readAt: read ? createdAt : null,
      } satisfies AppNotification;
    })
    .sort(compareNewestFirst);
}

export function createDemoNotificationRepository(items: AppNotification[] = buildDemoNotifications(), clock: () => number = Date.now): NotificationRepository {
  const inbox = items.map((n) => ({ ...n }));
  let settings: NotificationSetting[] = DEFAULT_SETTINGS.map((s) => ({ ...s }));
  const tokens = new Set<string>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  // Mirrors the server: turning a group off hides it from the inbox (the server stops creating rows).
  const enabled = (kind: NotificationKind) => settings.find((s) => s.group === groupOf(kind))?.inApp ?? true;

  return {
    mode: 'demo',

    async list({ before, limit = 30, unreadOnly = false } = {}) {
      const cursor = parseCursor(before);
      const size = Math.min(Math.max(limit, 1), 100);
      const visible = inbox
        .filter((n) => enabled(n.kind))
        .filter((n) => !unreadOnly || !n.readAt)
        .sort(compareNewestFirst)
        .filter((n) => !cursor || compareNewestFirst(n, cursor) > 0);
      const page = visible.slice(0, size);
      return { items: page.map((n) => ({ ...n })), nextCursor: visible.length > size ? cursorOf(page[page.length - 1]!) : null };
    },

    async unreadCount() {
      return inbox.filter((n) => !n.readAt && enabled(n.kind)).length;
    },

    async markRead(ids) {
      const at = new Date(clock()).toISOString();
      let changed = 0;
      for (const n of inbox) {
        if (!n.readAt && (!ids || ids.includes(n.id))) {
          n.readAt = at;
          changed += 1;
        }
      }
      if (changed) emit();
      return changed;
    },

    async getSettings() {
      return settings.map((s) => ({ ...s }));
    },

    async setSetting(setting) {
      const next = normalizeSetting(setting);
      settings = mergeSettings(settings.map((s) => (s.group === next.group ? next : s)));
      emit();
    },

    async registerPushToken(token) {
      if (!EXPO_TOKEN_PATTERN.test(token)) throw new ForumError('Geçersiz bildirim anahtarı.', 'validation');
      tokens.add(token);
    },

    async unregisterPushToken(token) {
      tokens.delete(token);
    },

    subscribe(onChange) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
  };
}
