import type { Ionicons } from '@expo/vector-icons';

import { CATEGORY_BY_SLUG } from '../constants/categories';
import type { UserRole } from '../types/forum';
import type { ModAction, ModLogEntry, Restriction, SanctionKind } from '../types/moderation';

type IconName = keyof typeof Ionicons.glyphMap;

export const ROLE_LABEL: Record<UserRole, string> = {
  user: 'Üye',
  verified: 'Onaylı Üye',
  moderator: 'Moderatör',
  admin: 'Yönetici',
};

export const ROLES: UserRole[] = ['user', 'verified', 'moderator', 'admin'];

export function isStaffRole(role: UserRole | null | undefined): boolean {
  return role === 'moderator' || role === 'admin';
}

export const SANCTION_LABEL: Record<SanctionKind, string> = { mute: 'Susturma', ban: 'Yasaklama' };

/** Durations offered in the sanction form (hours; null = until revoked). Server accepts 1–8760 h. */
export const SANCTION_DURATIONS: Array<{ label: string; hours: number | null }> = [
  { label: '1 saat', hours: 1 },
  { label: '24 saat', hours: 24 },
  { label: '3 gün', hours: 72 },
  { label: '7 gün', hours: 168 },
  { label: '30 gün', hours: 720 },
  { label: 'Süresiz', hours: null },
];

/** One-tap reasons; moderators can edit the text before confirming. Mirrors the forum rules. */
export const REASON_PRESETS = [
  'Hakaret veya kişisel saldırı',
  'Spam / reklam',
  'Konu dışı',
  'Kaynaksız iddia / yanıltıcı bilgi',
  'Nefret söylemi veya ayrımcılık',
  'Kişisel bilgi paylaşımı',
];

export function validateReason(reason: string, required: boolean): string | null {
  const r = reason.trim();
  if (r.length > 500) return 'Gerekçe en fazla 500 karakter olabilir.';
  if (required && r.length < 3) return 'Bir gerekçe yaz ya da hazır gerekçelerden birini seç.';
  return null;
}

export function durationLabel(hours: number | null | undefined): string {
  if (hours == null) return 'süresiz';
  const preset = SANCTION_DURATIONS.find((d) => d.hours === hours);
  if (preset) return preset.label;
  if (hours % 24 === 0) return `${hours / 24} gün`;
  return `${hours} saat`;
}

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export function untilLabel(iso: string | null | undefined): string {
  if (!iso) return 'süresiz';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${hh}:${mm}’e kadar`;
}

/** Text for the member's own restriction banner. */
export function restrictionText(r: Restriction): { title: string; body: string } {
  const until = r.endsAt ? untilLabel(r.endsAt) : 'süresiz olarak';
  if (r.kind === 'ban') {
    return {
      title: r.endsAt ? `Hesabın ${until} yasaklı` : 'Hesabın süresiz yasaklandı',
      body: `Bu sürede yazamaz, beğenemez ve takip edemezsin. Gerekçe: ${r.reason}`,
    };
  }
  return {
    title: r.endsAt ? `${until} susturuldun` : 'Süresiz susturuldun',
    body: `Bu sürede konu açamaz ve yanıt yazamazsın; okumaya devam edebilirsin. Gerekçe: ${r.reason}`,
  };
}

const ACTIONS: Record<ModAction, { label: string; icon: IconName; tone: 'danger' | 'gold' | 'muted' }> = {
  post_remove: { label: 'Mesaj kaldırıldı', icon: 'trash-outline', tone: 'danger' },
  post_restore: { label: 'Mesaj geri getirildi', icon: 'arrow-undo-outline', tone: 'muted' },
  topic_pin: { label: 'Konu sabitlendi', icon: 'pin-outline', tone: 'gold' },
  topic_unpin: { label: 'Sabitleme kaldırıldı', icon: 'pin-outline', tone: 'muted' },
  topic_lock: { label: 'Konu kilitlendi', icon: 'lock-closed-outline', tone: 'gold' },
  topic_unlock: { label: 'Konu kilidi açıldı', icon: 'lock-open-outline', tone: 'muted' },
  topic_move: { label: 'Konu taşındı', icon: 'swap-horizontal-outline', tone: 'gold' },
  topic_hide: { label: 'Konu gizlendi', icon: 'eye-off-outline', tone: 'danger' },
  topic_unhide: { label: 'Konu geri getirildi', icon: 'eye-outline', tone: 'muted' },
  report_dismiss: { label: 'Şikâyet reddedildi', icon: 'checkmark-done-outline', tone: 'muted' },
  user_mute: { label: 'Üye susturuldu', icon: 'volume-mute-outline', tone: 'danger' },
  user_ban: { label: 'Üye yasaklandı', icon: 'ban-outline', tone: 'danger' },
  sanction_revoke: { label: 'Yaptırım kaldırıldı', icon: 'shield-checkmark-outline', tone: 'muted' },
  role_change: { label: 'Rol değişti', icon: 'ribbon-outline', tone: 'gold' },
  match_create: { label: 'Maç eklendi', icon: 'calendar-outline', tone: 'gold' },
  match_update: { label: 'Maç güncellendi', icon: 'football-outline', tone: 'muted' },
  match_event_add: { label: 'Maç olayı eklendi', icon: 'add-circle-outline', tone: 'muted' },
  match_event_delete: { label: 'Maç olayı silindi', icon: 'remove-circle-outline', tone: 'danger' },
};

export function actionInfo(action: ModAction) {
  return ACTIONS[action] ?? { label: action, icon: 'shield-outline' as IconName, tone: 'muted' as const };
}

const STATUS_TEXT: Record<string, string> = { scheduled: 'Başlamadı', live: 'Canlı', halftime: 'Devre arası', finished: 'Maç sonu', postponed: 'Ertelendi' };
const EVENT_TEXT: Record<string, string> = {
  goal: 'Gol', own_goal: 'Kendi kalesine gol', penalty_goal: 'Penaltı golü', penalty_miss: 'Kaçan penaltı',
  yellow: 'Sarı kart', red: 'Kırmızı kart', sub: 'Oyuncu değişikliği', var: 'VAR',
};

const categoryName = (slug: string | undefined) => (slug ? (CATEGORY_BY_SLUG[slug]?.name ?? slug) : '');

/** Extra line for an audit entry, e.g. "Transfer → Maç & Taktik" or "7 gün". */
export function logDetail(e: ModLogEntry): string {
  switch (e.action) {
    case 'topic_move':
      return `${categoryName(e.meta.from)} → ${categoryName(e.meta.to)}`;
    case 'role_change':
      return `${ROLE_LABEL[(e.meta.from as UserRole) ?? 'user'] ?? e.meta.from} → ${ROLE_LABEL[(e.meta.to as UserRole) ?? 'user'] ?? e.meta.to}`;
    case 'user_mute':
    case 'user_ban':
      return durationLabel(e.meta.hours ?? null);
    case 'sanction_revoke':
      return e.meta.kind ? `${SANCTION_LABEL[e.meta.kind]} kaldırıldı` : '';
    case 'report_dismiss':
      return e.meta.reports ? `${e.meta.reports} şikâyet` : '';
    case 'match_update': {
      const status = STATUS_TEXT[e.meta.to ?? ''];
      const moved = e.meta.from && e.meta.to && e.meta.from !== e.meta.to && status ? status : '';
      return [moved, e.meta.score ? `Skor ${e.meta.score.replace('-', '–')}` : ''].filter(Boolean).join(' · ');
    }
    case 'match_event_add':
    case 'match_event_delete':
      return [e.meta.minute != null ? `${e.meta.minute}'` : '', EVENT_TEXT[e.meta.type ?? ''] ?? e.meta.type, e.meta.player].filter(Boolean).join(' ');
    default:
      return '';
  }
}

export function logTargetHref(e: ModLogEntry): string | null {
  if (e.targetType === 'topic' && e.action !== 'topic_hide') return `/konu/${e.targetId}`;
  if (e.targetType === 'post' && e.meta.topicId && e.action !== 'post_remove') return `/konu/${e.meta.topicId}`;
  if (e.targetType === 'user' && e.targetLabel) return `/moderasyon/uye/${e.targetLabel}`;
  if (e.targetType === 'match') return `/mac-yonetimi/${e.targetId}`;
  return null;
}

/** Server error codes → Turkish messages (shared by the moderation and forum services). */
export const MODERATION_MESSAGES: Array<[string, string]> = [
  ['not_allowed', 'Bu işlem için yetkin yok.'],
  ['use_topic_hide', 'Açılış mesajı tek başına kaldırılamaz; konuyu gizle.'],
  ['nothing_to_do', 'Bu işlem zaten uygulanmış.'],
  ['invalid_reason', 'Gerekçe 3–500 karakter olmalı.'],
  ['invalid_duration', 'Süre 1 saat ile 1 yıl arasında olmalı.'],
  ['user_not_found', 'Üye bulunamadı.'],
  ['self_block', 'Kendini engelleyemezsin.'],
  ['banned', 'Hesabın yasaklı olduğu için bu işlemi yapamazsın.'],
  ['muted', 'Hesabın susturulduğu için şu an yazamazsın.'],
];
