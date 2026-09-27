/** Restrained gamification: a level derived from contribution, not a points race. */
export interface LevelInfo {
  level: number;
  points: number;
  /** 0–1 progress towards the next level */
  progress: number;
}

/** points = posts + 2 × likes received; level n needs 10·(n−1)² points (1, 10, 40, 90, 160 …). */
export function levelFor(postCount: number, likesReceived: number): LevelInfo {
  const points = Math.max(0, postCount) + 2 * Math.max(0, likesReceived);
  const level = Math.min(50, Math.floor(Math.sqrt(points / 10)) + 1);
  const floor = 10 * (level - 1) ** 2;
  const next = 10 * level ** 2;
  return { level, points, progress: level >= 50 ? 1 : Math.min(1, (points - floor) / (next - floor)) };
}

/** Catalogue mirrors supabase/migrations/20260927220000_community.sql (used by demo mode). */
export const BADGES = {
  'kurucu-uye': { name: 'Kurucu Üye', description: 'İlk 1000 üyeden biri.', icon: 'star-outline' },
  'yeni-uye': { name: 'Yeni Üye', description: 'Aileye hoş geldin.', icon: 'leaf-outline' },
  'aktif-taraftar': { name: 'Aktif Taraftar', description: 'Son 30 günde en az 30 mesaj.', icon: 'flame-outline' },
  'tribun-mudavimi': { name: 'Tribün Müdavimi', description: '3 maç buluşmasına katıldı ya da Taraftar & Tribün’de 25 mesaj.', icon: 'megaphone-outline' },
  taktikci: { name: 'Taktikçi', description: 'Maç & Taktik’te 25 mesaj.', icon: 'clipboard-outline' },
  'transfer-uzmani': { name: 'Transfer Uzmanı', description: 'Transfer’de 25 mesaj.', icon: 'swap-horizontal-outline' },
  tarihci: { name: 'Tarihçi', description: 'Galatasaray Tarihi’nde 15 mesaj.', icon: 'trophy-outline' },
  '100-mesaj': { name: '100 Mesaj', description: 'Forumda 100 mesaj.', icon: 'chatbubbles-outline' },
  '1000-mesaj': { name: '1000 Mesaj', description: 'Forumda 1000 mesaj.', icon: 'ribbon-outline' },
} as const;

export type BadgeId = keyof typeof BADGES;
