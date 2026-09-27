import type { Category } from '../types/forum';

/**
 * The 12 main GalaForum categories (default structure).
 * `icon` is an Ionicons glyph name. Slugs are stable identifiers shared with the database seed.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat-mac-taktik',
    slug: 'mac-taktik',
    name: 'Maç & Taktik',
    description: 'Maç analizleri, diziliş tercihleri ve teknik direktör kararları.',
    icon: 'football-outline',
    sortOrder: 1,
  },
  {
    id: 'cat-transfer',
    slug: 'transfer',
    name: 'Transfer',
    description: 'Söylentiler, görüşmeler ve resmileşen transferler — kaynağıyla.',
    icon: 'swap-horizontal-outline',
    sortOrder: 2,
  },
  {
    id: 'cat-takim-oyuncular',
    slug: 'takim-oyuncular',
    name: 'Takım & Oyuncular',
    description: 'Kadro, form durumu, sakatlıklar ve oyuncu değerlendirmeleri.',
    icon: 'shirt-outline',
    sortOrder: 3,
  },
  {
    id: 'cat-yonetim-kulup',
    slug: 'yonetim-kulup',
    name: 'Yönetim & Kulüp',
    description: 'Yönetim kararları, bütçe, genel kurul ve kulüp politikaları.',
    icon: 'business-outline',
    sortOrder: 4,
  },
  {
    id: 'cat-avrupa',
    slug: 'avrupa',
    name: 'Avrupa',
    description: 'Avrupa kupaları, rakip analizleri ve deplasman notları.',
    icon: 'globe-outline',
    sortOrder: 5,
  },
  {
    id: 'cat-tarih',
    slug: 'galatasaray-tarihi',
    name: 'Galatasaray Tarihi',
    description: 'Unutulmaz maçlar, efsaneler ve kulübün köklü hikâyesi.',
    icon: 'trophy-outline',
    sortOrder: 6,
  },
  {
    id: 'cat-bulusmalar',
    slug: 'mac-oncesi-bulusmalar',
    name: 'Maç Öncesi Buluşmalar',
    description: 'Şehir şehir maç günü buluşmaları ve ortak yolculuklar.',
    icon: 'people-outline',
    sortOrder: 7,
  },
  {
    id: 'cat-basketbol',
    slug: 'basketbol',
    name: 'Basketbol',
    description: 'Basketbol şubesi, maçlar ve kadro gündemi.',
    icon: 'basketball-outline',
    sortOrder: 8,
  },
  {
    id: 'cat-diger-branslar',
    slug: 'diger-branslar',
    name: 'Diğer Branşlar',
    description: 'Voleybol, yüzme, atletizm ve diğer branşlardan haberler ve tartışmalar.',
    icon: 'fitness-outline',
    sortOrder: 9,
  },
  {
    id: 'cat-altyapi',
    slug: 'altyapi-akademi',
    name: 'Altyapı / Akademi',
    description: 'Genç yetenekler, akademi takımları ve A takıma yükselenler.',
    icon: 'school-outline',
    sortOrder: 10,
  },
  {
    id: 'cat-tribun',
    slug: 'taraftar-tribun',
    name: 'Taraftar & Tribün',
    description: 'Tribün kültürü, koreografiler, besteler ve deplasman hatıraları.',
    icon: 'megaphone-outline',
    sortOrder: 11,
  },
  {
    id: 'cat-serbest',
    slug: 'serbest',
    name: 'Serbest',
    description: 'Futbol dışı sohbetler ve konu dışı her şey — saygı çerçevesinde.',
    icon: 'chatbubbles-outline',
    sortOrder: 12,
  },
];

export const CATEGORY_BY_SLUG: Record<string, Category> = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.slug, c]),
);
