import type { SupabaseClient } from '@supabase/supabase-js';

import { CATEGORY_BY_SLUG } from '../../constants/categories';
import type { AuthorSummary, UserRole } from '../../types/forum';
import type { ActiveMember, CommunityProfile, Meetup, MeetupDetail, MyFollows } from '../../types/community';
import { ForumError } from '../forum/repository';
import type { CommunityRepository } from './repository';

interface MeetupRow {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  city: string;
  place_name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  capacity: number | null;
  match_id: string | null;
  cancelled: boolean;
  organizer: { id: string; username: string; avatar_url: string | null; role: UserRole } | null;
  attendees: Array<{ user_id: string }>;
}

const MEETUP_SELECT =
  'id, title, description, starts_at, city, place_name, address, lat, lng, capacity, match_id, cancelled, organizer:profiles!meetups_created_by_fkey(id, username, avatar_url, role), attendees:meetup_attendees(user_id)';

const MESSAGES: Array<[string, string]> = [
  ['meetup_full', 'Kontenjan dolu.'],
  ['meetup_closed', 'Bu buluşma artık katılıma kapalı.'],
  ['organizer_cannot_leave', 'Düzenleyen kişi buluşmadan ayrılamaz; gerekirse iptal et.'],
  ['too_many_meetups', 'Aynı anda en fazla 5 yaklaşan buluşma açabilirsin.'],
  ['invalid_date', 'Buluşma tarihi 10 dakika ile 180 gün sonrası arasında olmalı.'],
  ['self_follow', 'Kendini takip edemezsin.'],
  ['not_allowed', 'Bu işlem için yetkin yok.'],
];

function fail(error: { message: string; code?: string }, fallback: string): never {
  if (/fetch|network|timeout/i.test(error.message)) throw new ForumError('Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.', 'network');
  if (error.code === '28000') throw new ForumError('Bu işlem için giriş yapmalısın.', 'auth_required');
  const known = MESSAGES.find(([k]) => error.message.includes(k));
  if (known) throw new ForumError(known[1], 'validation');
  if (error.code === '23505') throw new ForumError('Bu kayıt zaten var.', 'validation');
  throw new ForumError(fallback, 'unknown');
}

export function createSupabaseCommunityRepository(sb: SupabaseClient): CommunityRepository {
  const uid = async () => (await sb.auth.getSession()).data.session?.user.id ?? null;
  const requireUid = async () => {
    const id = await uid();
    if (!id) throw new ForumError('Bu işlem için giriş yapmalısın.', 'auth_required');
    return id;
  };

  const toMeetup = (r: MeetupRow, me: string | null): Meetup => ({
    id: r.id,
    title: r.title,
    description: r.description,
    startsAt: r.starts_at,
    city: r.city,
    placeName: r.place_name,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    capacity: r.capacity,
    matchId: r.match_id,
    organizer: r.organizer ? { id: r.organizer.id, username: r.organizer.username, avatarUrl: r.organizer.avatar_url, role: r.organizer.role } : null,
    cancelled: r.cancelled,
    attendeeCount: r.attendees.length,
    isAttending: Boolean(me && r.attendees.some((a) => a.user_id === me)),
  });

  return {
    mode: 'supabase',

    async getProfileExtras(username) {
      const { data, error } = await sb.rpc('community_profile', { p_username: username.trim().toLowerCase() });
      if (error) fail(error, 'Profil yüklenemedi.');
      return (data as CommunityProfile | null) ?? null;
    },

    async updateMyProfile(update) {
      const id = await requireUid();
      let favoriteId: string | null = null;
      if (update.favoriteCategorySlug) {
        if (!CATEGORY_BY_SLUG[update.favoriteCategorySlug]) throw new ForumError('Kategori bulunamadı.', 'validation');
        const { data, error } = await sb.from('categories').select('id').eq('slug', update.favoriteCategorySlug).maybeSingle();
        if (error) fail(error, 'Kategori bulunamadı.');
        favoriteId = (data as { id: string } | null)?.id ?? null;
      }
      const { error } = await sb
        .from('profiles')
        .update({ bio: update.bio.trim() || null, city: update.city.trim() || null, favorite_category_id: favoriteId })
        .eq('id', id);
      if (error) fail(error, 'Profil kaydedilemedi.');
    },

    async setFollow(kind, target, on) {
      await requireUid();
      const { data, error } = await sb.rpc('set_follow', { p_kind: kind, p_target: target, p_on: on });
      if (error) fail(error, 'Takip durumu değiştirilemedi.');
      return Boolean(data);
    },

    async getMyFollows(): Promise<MyFollows> {
      if (!(await uid())) return { users: [], topics: [], categories: [] };
      const { data, error } = await sb.rpc('my_follows');
      if (error) fail(error, 'Takip listesi yüklenemedi.');
      return (data as MyFollows) ?? { users: [], topics: [], categories: [] };
    },

    async activeMembers(limit = 12): Promise<ActiveMember[]> {
      const { data, error } = await sb.rpc('active_members', { p_days: 30, p_limit: limit });
      if (error) fail(error, 'Aktif üyeler yüklenemedi.');
      return ((data ?? []) as Array<{ id: string; username: string; avatar_url: string | null; post_count: number }>).map((r) => ({
        id: r.id,
        username: r.username,
        avatarUrl: r.avatar_url,
        postCount: Number(r.post_count),
      }));
    },

    async listMeetups(city) {
      let q = sb.from('meetups').select(MEETUP_SELECT).eq('cancelled', false).gt('starts_at', new Date().toISOString());
      if (city?.trim()) q = q.ilike('city', city.trim());
      const { data, error } = await q.order('starts_at').limit(50);
      if (error) fail(error, 'Buluşmalar yüklenemedi.');
      const me = await uid();
      return ((data ?? []) as unknown as MeetupRow[]).map((r) => toMeetup(r, me));
    },

    async getMeetup(id): Promise<MeetupDetail | null> {
      const { data, error } = await sb.from('meetups').select(MEETUP_SELECT).eq('id', id).maybeSingle();
      if (error) fail(error, 'Buluşma yüklenemedi.');
      if (!data) return null;
      const row = data as unknown as MeetupRow;
      const ids = row.attendees.map((a) => a.user_id).slice(0, 100);
      const { data: people, error: pErr } = ids.length
        ? await sb.from('profiles').select('id, username, avatar_url, role').in('id', ids).is('deleted_at', null)
        : { data: [], error: null };
      if (pErr) fail(pErr, 'Katılımcılar yüklenemedi.');
      const attendees: AuthorSummary[] = ((people ?? []) as Array<{ id: string; username: string; avatar_url: string | null; role: UserRole }>).map((p) => ({
        id: p.id,
        username: p.username,
        avatarUrl: p.avatar_url,
        role: p.role,
      }));
      return { ...toMeetup(row, await uid()), attendees };
    },

    async createMeetup(input) {
      await requireUid();
      const { data, error } = await sb.rpc('create_meetup', {
        p_title: input.title,
        p_description: input.description,
        p_starts_at: input.startsAt,
        p_city: input.city,
        p_place: input.placeName,
        p_address: input.address,
        p_lat: input.lat,
        p_lng: input.lng,
        p_capacity: input.capacity,
        p_match_id: input.matchId,
      });
      if (error) fail(error, 'Buluşma oluşturulamadı.');
      return { id: String(data) };
    },

    async setAttendance(id, join) {
      await requireUid();
      const { data, error } = await sb.rpc('set_meetup_attendance', { p_meetup_id: id, p_join: join });
      if (error) fail(error, 'Katılım güncellenemedi.');
      return Number(data);
    },

    async cancelMeetup(id) {
      await requireUid();
      const { error } = await sb.rpc('cancel_meetup', { p_meetup_id: id });
      if (error) fail(error, 'Buluşma iptal edilemedi.');
    },
  };
}
