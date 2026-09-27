import { BADGES } from '../../lib/badges';
import type { BadgeId } from '../../lib/badges';
import { CATEGORY_BY_SLUG } from '../../constants/categories';
import type { AuthorSummary } from '../../types/forum';
import type { ActiveMember, CommunityProfile, CreateMeetupInput, Meetup, MeetupDetail, MyFollows } from '../../types/community';
import { DEMO_POSTS, DEMO_USERS } from '../forum/demoData';
import { DEMO_GUEST } from '../forum/demoRepository';
import { ForumError } from '../forum/repository';
import type { CommunityRepository } from './repository';

interface StoredMeetup extends Omit<Meetup, 'organizer' | 'attendeeCount' | 'isAttending' | 'attendeePreview'> {
  organizerId: string;
  attendeeIds: string[];
}

const DAY = 86_400_000;

function atLocal(dayOffset: number, hour: number, minute: number, now: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const DEMO_BADGES: Record<string, BadgeId[]> = {
  'u-aslanpence': ['kurucu-uye', 'aktif-taraftar'],
  'u-tribun1905': ['kurucu-uye', 'tribun-mudavimi'],
  'u-taktik': ['kurucu-uye', 'taktikci'],
  'u-kopenhag': ['kurucu-uye', 'tarihci'],
  'u-ankara': ['kurucu-uye', 'tribun-mudavimi'],
  'u-akademi': ['yeni-uye'],
  'u-pota': ['yeni-uye'],
  'u-mod': ['kurucu-uye'],
  'u-guest': ['yeni-uye'],
};

const DEMO_EXTRAS: Record<string, { bio?: string; city?: string; favorite?: string }> = {
  'u-taktik': { bio: 'Diziliş, pres ve geçiş oyunu üzerine not tutarım.', city: 'İstanbul', favorite: 'mac-taktik' },
  'u-kopenhag': { bio: '2000 kuşağı. Avrupa deplasmanlarının müdavimi.', city: 'İzmir', favorite: 'galatasaray-tarihi' },
  'u-ankara': { bio: 'Ankara’dan her iç saha maçına otobüsle.', city: 'Ankara', favorite: 'mac-oncesi-bulusmalar' },
  'u-tribun1905': { city: 'İstanbul', favorite: 'taraftar-tribun' },
};

export function buildDemoMeetups(now: number = Date.now()): StoredMeetup[] {
  const everyone = DEMO_USERS.map((u) => u.id);
  return [
    {
      id: 'bm-ankara',
      title: 'Ankara’dan ortak yolculuk — Beşiktaş deplasmanı',
      description: 'Otobüs sabah hareket ediyor. Bilet ve deplasman kuralları konusunda yol boyunca bilgilendirme yapılacak.',
      startsAt: atLocal(3, 11, 0, now),
      city: 'Ankara',
      placeName: 'AŞTİ, peronlar önü',
      address: 'Mevlana Blv., Çankaya',
      lat: 39.9185,
      lng: 32.8106,
      capacity: 40,
      matchId: 'm-deplasman',
      organizerId: 'u-ankara',
      cancelled: false,
      attendeeIds: ['u-ankara', 'u-kopenhag', 'u-tribun1905'],
    },
    {
      id: 'bm-ajax',
      title: 'Avrupa gecesi öncesi stat yolunda buluşma',
      description: 'Maçtan iki saat önce buluşup birlikte stada yürüyoruz. Pankart ve bayrak getirmek serbest.',
      startsAt: atLocal(6, 19, 30, now),
      city: 'İstanbul',
      placeName: 'Seyrantepe metro çıkışı',
      address: 'Sarıyer',
      lat: 41.1036,
      lng: 28.9908,
      capacity: null,
      matchId: 'm-avrupa',
      organizerId: 'u-tribun1905',
      cancelled: false,
      attendeeIds: everyone.slice(0, 6),
    },
    {
      id: 'bm-izmir',
      title: 'İzmir: deplasman maçını birlikte izleyelim',
      description: 'Büyük ekran ve ayrılmış masalar var; yer sınırlı olduğu için katılımını işaretle.',
      startsAt: atLocal(3, 19, 30, now),
      city: 'İzmir',
      placeName: 'Alsancak, Kıbrıs Şehitleri Cd.',
      address: 'Konak',
      lat: 38.4369,
      lng: 27.1437,
      capacity: 25,
      matchId: 'm-deplasman',
      organizerId: 'u-kopenhag',
      cancelled: false,
      attendeeIds: ['u-kopenhag', 'u-akademi'],
    },
  ];
}

export function createDemoCommunityRepository(meetups = buildDemoMeetups(), clock: () => number = Date.now): CommunityRepository {
  const users: AuthorSummary[] = [...DEMO_USERS, DEMO_GUEST];
  const me = DEMO_GUEST.id;
  const followsUsers = new Set<string>();
  const followsTopics = new Set<string>();
  const followsCategories = new Set<string>();
  const followerCounts: Record<string, number> = { 'u-taktik': 14, 'u-kopenhag': 9, 'u-aslanpence': 21, 'u-tribun1905': 11, 'u-ankara': 6 };
  const myExtras = { bio: '', city: '', favorite: null as string | null };
  let seq = 0;

  const userById = (id: string) => users.find((u) => u.id === id) ?? null;

  const toMeetup = (m: StoredMeetup): Meetup => ({
    id: m.id,
    title: m.title,
    description: m.description,
    startsAt: m.startsAt,
    city: m.city,
    placeName: m.placeName,
    address: m.address,
    lat: m.lat,
    lng: m.lng,
    capacity: m.capacity,
    matchId: m.matchId,
    organizer: userById(m.organizerId),
    cancelled: m.cancelled,
    attendeeCount: m.attendeeIds.length,
    isAttending: m.attendeeIds.includes(me),
    attendeePreview: m.attendeeIds.slice(0, 5).map(userById).filter((u): u is AuthorSummary => Boolean(u)),
  });

  const find = (id: string) => {
    const m = meetups.find((x) => x.id === id);
    if (!m) throw new ForumError('Buluşma bulunamadı.', 'not_found');
    return m;
  };

  return {
    mode: 'demo',

    async getProfileExtras(username): Promise<CommunityProfile | null> {
      const u = users.find((x) => x.username === username.trim().toLowerCase());
      if (!u) return null;
      const extra = u.id === me ? { bio: myExtras.bio, city: myExtras.city, favorite: myExtras.favorite ?? undefined } : DEMO_EXTRAS[u.id] ?? {};
      const fav = extra.favorite ? CATEGORY_BY_SLUG[extra.favorite] : undefined;
      return {
        userId: u.id,
        bio: extra.bio || null,
        city: extra.city || null,
        favoriteCategory: fav ? { slug: fav.slug, name: fav.name } : null,
        followers: (followerCounts[u.id] ?? 0) + (followsUsers.has(u.id) ? 1 : 0),
        following: u.id === me ? followsUsers.size : 3,
        isFollowing: followsUsers.has(u.id),
        badges: (DEMO_BADGES[u.id] ?? ['yeni-uye']).map((id) => ({ id, ...BADGES[id] })),
      };
    },

    async updateMyProfile(update) {
      if (update.bio.trim().length > 280) throw new ForumError('Hakkında en fazla 280 karakter olabilir.', 'validation');
      if (update.city.trim().length > 60) throw new ForumError('Şehir en fazla 60 karakter olabilir.', 'validation');
      if (update.favoriteCategorySlug && !CATEGORY_BY_SLUG[update.favoriteCategorySlug]) throw new ForumError('Kategori bulunamadı.', 'validation');
      myExtras.bio = update.bio.trim();
      myExtras.city = update.city.trim();
      myExtras.favorite = update.favoriteCategorySlug;
    },

    async setFollow(kind, target, on) {
      if (kind === 'user') {
        const u = users.find((x) => x.username === target.toLowerCase());
        if (!u) throw new ForumError('Üye bulunamadı.', 'not_found');
        if (u.id === me) throw new ForumError('Kendini takip edemezsin.', 'validation');
        if (on) followsUsers.add(u.id);
        else followsUsers.delete(u.id);
      } else if (kind === 'topic') {
        if (on) followsTopics.add(target);
        else followsTopics.delete(target);
      } else {
        if (!CATEGORY_BY_SLUG[target]) throw new ForumError('Kategori bulunamadı.', 'not_found');
        if (on) followsCategories.add(target);
        else followsCategories.delete(target);
      }
      return on;
    },

    async getMyFollows(): Promise<MyFollows> {
      return {
        users: [...followsUsers].map(userById).filter((u): u is AuthorSummary => Boolean(u)),
        topics: [...followsTopics].map((id) => ({ id, title: '' })),
        categories: [...followsCategories],
      };
    },

    async activeMembers(limit = 12): Promise<ActiveMember[]> {
      const since = clock() - 30 * DAY;
      const counts = new Map<string, number>();
      for (const p of DEMO_POSTS) {
        if (clock() - p.minutesAgo * 60_000 >= since) counts.set(p.authorId, (counts.get(p.authorId) ?? 0) + 1);
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id, postCount]) => {
          const u = userById(id)!;
          return { id, username: u.username, avatarUrl: u.avatarUrl ?? null, postCount };
        });
    },

    async listMeetups(city) {
      const now = clock();
      const c = city?.trim().toLocaleLowerCase('tr-TR');
      return meetups
        .filter((m) => !m.cancelled && new Date(m.startsAt).getTime() > now)
        .filter((m) => !c || m.city.toLocaleLowerCase('tr-TR') === c)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map(toMeetup);
    },

    async getMeetup(id): Promise<MeetupDetail | null> {
      const m = meetups.find((x) => x.id === id);
      if (!m) return null;
      return { ...toMeetup(m), attendees: m.attendeeIds.map(userById).filter((u): u is AuthorSummary => Boolean(u)) };
    },

    async createMeetup(input: CreateMeetupInput) {
      const upcomingMine = meetups.filter((m) => m.organizerId === me && !m.cancelled && new Date(m.startsAt).getTime() > clock());
      if (upcomingMine.length >= 5) throw new ForumError('Aynı anda en fazla 5 yaklaşan buluşma açabilirsin.', 'validation');
      const id = `bm-local-${++seq}`;
      meetups.push({ ...input, id, organizerId: me, cancelled: false, attendeeIds: [me] });
      return { id };
    },

    async setAttendance(id, join) {
      const m = find(id);
      if (m.cancelled || new Date(m.startsAt).getTime() < clock()) throw new ForumError('Bu buluşma artık katılıma kapalı.', 'validation');
      if (join) {
        if (!m.attendeeIds.includes(me)) {
          if (m.capacity != null && m.attendeeIds.length >= m.capacity) throw new ForumError('Kontenjan dolu.', 'validation');
          m.attendeeIds.push(me);
        }
      } else {
        if (m.organizerId === me) throw new ForumError('Düzenleyen kişi buluşmadan ayrılamaz; gerekirse iptal et.', 'validation');
        m.attendeeIds = m.attendeeIds.filter((x) => x !== me);
      }
      return m.attendeeIds.length;
    },

    async cancelMeetup(id) {
      const m = find(id);
      if (m.organizerId !== me) throw new ForumError('Yalnızca düzenleyen kişi iptal edebilir.', 'validation');
      m.cancelled = true;
    },
  };
}
