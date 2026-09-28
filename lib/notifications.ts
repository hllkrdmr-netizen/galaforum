import type { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';

import type { AuthorSummary } from '../types/forum';
import type { AppNotification, NotificationGroup, NotificationKind, NotificationSetting } from '../types/notification';

type IconName = keyof typeof Ionicons.glyphMap;

// ---------------------------------------------------------------- groups and defaults
export interface GroupInfo {
  group: NotificationGroup;
  label: string;
  hint: string;
  icon: IconName;
}

/** Order shown in settings. Keep in sync with notification_group()/notification_default() in the Phase 7 migration. */
export const NOTIFICATION_GROUPS: GroupInfo[] = [
  { group: 'reply', label: 'Yanıtlar', hint: 'Açtığın ve takip ettiğin konulara gelen yanıtlar', icon: 'chatbubble-ellipses-outline' },
  { group: 'mention', label: 'Bahsetmeler', hint: 'Biri mesajında @kullanıcıadın yazdığında', icon: 'at-outline' },
  { group: 'quote', label: 'Alıntılar', hint: 'Mesajın alıntılandığında', icon: 'chatbox-outline' },
  { group: 'like', label: 'Beğeniler', hint: 'Mesajların beğenildiğinde', icon: 'heart-outline' },
  { group: 'follow', label: 'Yeni takipçiler', hint: 'Biri seni takip etmeye başladığında', icon: 'person-add-outline' },
  { group: 'category_topic', label: 'Takip ettiğin kategoriler', hint: 'Bu kategorilerde yeni konu açıldığında', icon: 'albums-outline' },
  { group: 'match', label: 'Maç uyarıları', hint: 'Başlama düdüğü, goller ve maç sonucu', icon: 'football-outline' },
  { group: 'meetup', label: 'Buluşmalar', hint: 'Buluşmana katılım ve iptal edilen buluşmalar', icon: 'location-outline' },
  { group: 'badge', label: 'Rozetler', hint: 'Yeni bir rozet kazandığında', icon: 'ribbon-outline' },
];

const PUSH_ON_BY_DEFAULT: ReadonlySet<NotificationGroup> = new Set(['reply', 'quote', 'mention', 'follow', 'meetup', 'match', 'moderation']);

export function groupOf(kind: NotificationKind): NotificationGroup {
  if (kind === 'meetup_join' || kind === 'meetup_cancelled') return 'meetup';
  if (kind === 'match_start' || kind === 'match_goal' || kind === 'match_end') return 'match';
  return kind;
}

export function defaultSetting(group: NotificationGroup): NotificationSetting {
  return { group, inApp: true, push: PUSH_ON_BY_DEFAULT.has(group) };
}

export const DEFAULT_SETTINGS: NotificationSetting[] = NOTIFICATION_GROUPS.map((g) => defaultSetting(g.group));

/** Full, ordered list from whatever the server returned (missing groups fall back to defaults). */
export function mergeSettings(saved: Array<Partial<NotificationSetting> & { group: NotificationGroup }>): NotificationSetting[] {
  return NOTIFICATION_GROUPS.map(({ group }) => {
    const s = saved.find((x) => x.group === group);
    const d = defaultSetting(group);
    return normalizeSetting({ group, inApp: s?.inApp ?? d.inApp, push: s?.push ?? d.push });
  });
}

/** Push requires in-app (the server enforces the same rule). */
export function normalizeSetting(s: NotificationSetting): NotificationSetting {
  return { ...s, push: s.inApp && s.push };
}

export function changeSetting(s: NotificationSetting, patch: Partial<Pick<NotificationSetting, 'inApp' | 'push'>>): NotificationSetting {
  const next = { ...s, ...patch };
  // Turning push on implies in-app on; turning in-app off turns push off.
  if (patch.push === true) next.inApp = true;
  return normalizeSetting(next);
}

// ---------------------------------------------------------------- display
export function unreadLabel(n: number): string {
  if (n <= 0) return '';
  return n > 99 ? '99+' : String(n);
}

export function actorLabel(actor: AuthorSummary | null, count: number): string {
  if (!actor) return 'GalaForum';
  const others = Math.max(0, count - 1);
  return others > 0 ? `${actor.username} ve ${others} kişi daha` : actor.username;
}

export interface NotificationView {
  icon: IconName;
  /** Accent for the small kind badge on the avatar. */
  tone: 'gold' | 'wine' | 'live' | 'muted';
  /** Bold lead (actor or event), e.g. "burak_gs ve 2 kişi daha". */
  lead: string;
  /** Rest of the sentence, e.g. "yanıt yazdı". */
  action: string;
  /** Bold subject after the sentence (topic title, meetup title…), may be empty. */
  subject: string;
  /** Optional preview line under the sentence. */
  preview: string;
  href: Href | null;
}

function matchScoreLine(title: string | undefined, home: number | null | undefined, away: number | null | undefined): string {
  if (!title) return '';
  const [h, a] = title.split(' – ');
  if (home == null || away == null || !a) return title;
  return `${h} ${home} – ${away} ${a}`;
}

const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function shortDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${DAY_NAMES[d.getDay()]} · ${hh}:${mm}`;
}

/** Turns a notification into sentence parts and a destination. `me` is used for badge links. */
export function describeNotification(n: AppNotification, me?: string | null): NotificationView {
  const d = n.data;
  const lead = actorLabel(n.actor, n.actorCount);
  const topicHref: Href | null = n.topicId ? `/konu/${n.topicId}` : null;
  // Replies, quotes, mentions and likes open the thread at the post itself.
  const postHref: Href | null = n.topicId && n.postId ? `/konu/${n.topicId}?mesaj=${n.postId}` : topicHref;
  switch (n.kind) {
    case 'reply':
      return { icon: 'chatbubble-ellipses', tone: 'gold', lead, action: 'yanıt yazdı:', subject: d.topic_title ?? '', preview: d.excerpt ?? '', href: postHref };
    case 'quote':
      return { icon: 'chatbox', tone: 'gold', lead, action: 'mesajını alıntıladı:', subject: d.topic_title ?? '', preview: d.excerpt ?? '', href: postHref };
    case 'mention':
      return { icon: 'at', tone: 'gold', lead, action: 'senden bahsetti:', subject: d.topic_title ?? '', preview: d.excerpt ?? '', href: postHref };
    case 'like':
      return { icon: 'heart', tone: 'wine', lead, action: 'mesajını beğendi:', subject: d.topic_title ?? '', preview: d.excerpt ?? '', href: postHref };
    case 'follow':
      return { icon: 'person-add', tone: 'gold', lead, action: 'seni takip etmeye başladı', subject: '', preview: '', href: n.actor ? `/uye/${n.actor.username}` : null };
    case 'category_topic':
      return {
        icon: 'albums',
        tone: 'muted',
        lead,
        action: d.category_name ? `${d.category_name} kategorisinde yeni konu açtı:` : 'yeni konu açtı:',
        subject: d.topic_title ?? '',
        preview: '',
        href: topicHref,
      };
    case 'meetup_join':
      return { icon: 'people', tone: 'gold', lead, action: 'buluşmana katıldı:', subject: d.meetup_title ?? '', preview: shortDate(d.starts_at), href: n.meetupId ? `/bulusma/${n.meetupId}` : null };
    case 'meetup_cancelled':
      return {
        icon: 'close-circle',
        tone: 'muted',
        lead: 'Buluşma iptal edildi:',
        action: '',
        subject: d.meetup_title ?? '',
        preview: [shortDate(d.starts_at), d.city].filter(Boolean).join(' · '),
        href: n.meetupId ? `/bulusma/${n.meetupId}` : null,
      };
    case 'match_start':
      return { icon: 'radio', tone: 'live', lead: 'Maç başladı:', action: '', subject: d.match_title ?? '', preview: d.competition ?? '', href: n.matchId ? `/mac/${n.matchId}` : topicHref };
    case 'match_goal': {
      const minute = d.minute != null ? `${d.minute}${d.extra_minute ? `+${d.extra_minute}` : ''}'` : '';
      const who = [d.player, d.team ? `(${d.team})` : ''].filter(Boolean).join(' ');
      const label = d.event_type === 'own_goal' ? 'Kendi kalesine gol!' : d.event_type === 'penalty_goal' ? 'Penaltı golü!' : 'Gol!';
      return {
        icon: 'football',
        tone: 'live',
        lead: label,
        action: [minute, who].filter(Boolean).join(' '),
        subject: d.match_title ?? '',
        preview: '',
        href: n.matchId ? `/mac/${n.matchId}` : topicHref,
      };
    }
    case 'match_end':
      return { icon: 'flag', tone: 'muted', lead: 'Maç sona erdi:', action: '', subject: matchScoreLine(d.match_title, d.home_score, d.away_score), preview: d.competition ?? '', href: n.matchId ? `/mac/${n.matchId}` : topicHref };
    case 'badge':
      return { icon: 'ribbon', tone: 'gold', lead: 'Yeni rozet kazandın:', action: '', subject: d.badge_name ?? '', preview: '', href: me ? `/uye/${me}` : '/hesap' };
    case 'moderation':
      return describeModeration(n);
  }
}

const ROLE_NAMES: Record<string, string> = { user: 'Üye', verified: 'Onaylı Üye', moderator: 'Moderatör', admin: 'Yönetici' };

function untilText(iso: string | null | undefined): string {
  if (!iso) return 'süresiz';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${hh}:${mm}’e kadar`;
}

/** Staff notices: shown as coming from "GalaForum ekibi", never from the individual moderator. */
function describeModeration(n: AppNotification): NotificationView {
  const d = n.data;
  const reason = d.reason ? `Gerekçe: ${d.reason}` : '';
  switch (d.action) {
    case 'post_removed':
      return { icon: 'shield', tone: 'muted', lead: 'Mesajın kaldırıldı:', action: '', subject: d.topic_title ?? '', preview: reason, href: n.topicId ? `/konu/${n.topicId}` : null };
    case 'topic_hidden':
      return { icon: 'shield', tone: 'muted', lead: 'Konun yayından kaldırıldı:', action: '', subject: d.topic_title ?? '', preview: reason, href: null };
    case 'muted':
      return { icon: 'volume-mute', tone: 'wine', lead: 'Hesabın susturuldu', action: `(${untilText(d.ends_at)})`, subject: '', preview: reason, href: '/hesap' };
    case 'banned':
      return { icon: 'ban', tone: 'wine', lead: 'Hesabın yasaklandı', action: `(${untilText(d.ends_at)})`, subject: '', preview: reason, href: '/hesap' };
    case 'sanction_revoked':
      return { icon: 'shield-checkmark', tone: 'gold', lead: 'Hesabındaki kısıtlama kaldırıldı.', action: '', subject: '', preview: '', href: '/hesap' };
    case 'role_changed':
      return { icon: 'ribbon', tone: 'gold', lead: 'Rolün güncellendi:', action: '', subject: ROLE_NAMES[d.role ?? ''] ?? d.role ?? '', preview: '', href: '/hesap' };
    default:
      return { icon: 'shield', tone: 'muted', lead: 'GalaForum ekibinden bir bildirim', action: '', subject: '', preview: reason, href: null };
  }
}

/** Plain one-line text (accessibility label, push body). */
export function notificationText(n: AppNotification): string {
  const v = describeNotification(n);
  return [v.lead, v.action, v.subject].filter(Boolean).join(' ');
}

// ---------------------------------------------------------------- inbox sections
export interface NotificationSection {
  title: string;
  items: AppNotification[];
}

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "Bugün", "Dün", "Bu hafta", "Daha önce" — keeps the incoming (newest-first) order inside sections. */
export function sectionByDay(items: AppNotification[], now: number = Date.now()): NotificationSection[] {
  const today = startOfDay(now);
  const yesterday = today - 86_400_000;
  const week = today - 6 * 86_400_000;
  const buckets: NotificationSection[] = [
    { title: 'Bugün', items: [] },
    { title: 'Dün', items: [] },
    { title: 'Bu hafta', items: [] },
    { title: 'Daha önce', items: [] },
  ];
  for (const n of items) {
    const t = new Date(n.createdAt).getTime();
    const i = t >= today ? 0 : t >= yesterday ? 1 : t >= week ? 2 : 3;
    buckets[i]!.items.push(n);
  }
  return buckets.filter((b) => b.items.length > 0);
}

export const EXPO_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,}\]$/;

// ---------------------------------------------------------------- paging
/** Stable keyset cursor: "createdAt|id" (ties on createdAt are broken by id, both descending). */
export function cursorOf(n: Pick<AppNotification, 'createdAt' | 'id'>): string {
  return `${n.createdAt}|${n.id}`;
}

export function parseCursor(cursor: string | null | undefined): { createdAt: string; id: string } | null {
  if (!cursor) return null;
  const i = cursor.lastIndexOf('|');
  if (i <= 0) return null;
  const createdAt = cursor.slice(0, i);
  const id = cursor.slice(i + 1);
  if (!id || Number.isNaN(new Date(createdAt).getTime())) return null;
  return { createdAt, id };
}

/** Newest first, ties broken by id descending (same order as the Supabase query). */
export function compareNewestFirst(a: Pick<AppNotification, 'createdAt' | 'id'>, b: Pick<AppNotification, 'createdAt' | 'id'>): number {
  const t = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (t !== 0) return t;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

// ---------------------------------------------------------------- push taps
/** Payload the push worker puts in each Expo message's `data` (keep in sync with docs/PHASE7.md). */
export interface PushPayload {
  notificationId?: string;
  kind?: NotificationKind;
  topicId?: string | null;
  postId?: string | null;
  matchId?: string | null;
  meetupId?: string | null;
  actorUsername?: string | null;
}

/** Where a tapped push should open. Falls back to the inbox. */
export function pushHref(data: PushPayload | null | undefined): Href {
  if (!data?.kind) return '/bildirimler';
  switch (data.kind) {
    case 'match_start':
    case 'match_goal':
    case 'match_end':
      if (data.matchId) return `/mac/${data.matchId}`;
      break;
    case 'meetup_join':
    case 'meetup_cancelled':
      if (data.meetupId) return `/bulusma/${data.meetupId}`;
      break;
    case 'follow':
      if (data.actorUsername) return `/uye/${data.actorUsername}`;
      break;
    case 'badge':
      return '/bildirimler';
    default:
      break;
  }
  if (data.topicId && data.postId) return `/konu/${data.topicId}?mesaj=${data.postId}`;
  return data.topicId ? `/konu/${data.topicId}` : '/bildirimler';
}
