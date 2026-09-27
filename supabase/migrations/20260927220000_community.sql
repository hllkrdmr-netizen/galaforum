-- Phase 6 — community: richer profiles, follows, badges, meetups.
-- Additive: apply after 20260927210000_match_center.sql.
begin;

-- ---------------------------------------------------------------- profile fields
alter table public.profiles add column if not exists bio text check (char_length(bio) <= 280);
alter table public.profiles add column if not exists city text check (char_length(city) <= 60);
alter table public.profiles add column if not exists favorite_category_id uuid references public.categories (id) on delete set null;
grant update (bio, city, favorite_category_id) on public.profiles to authenticated;

-- ---------------------------------------------------------------- follows
create table if not exists public.user_follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists user_follows_followee_idx on public.user_follows (followee_id);

create table if not exists public.topic_follows (
  user_id uuid not null references public.profiles (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
create index if not exists topic_follows_topic_idx on public.topic_follows (topic_id);

create table if not exists public.category_follows (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, category_id)
);
create index if not exists category_follows_category_idx on public.category_follows (category_id);

-- ---------------------------------------------------------------- badges
create table if not exists public.badges (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null,
  sort_order integer not null
);

insert into public.badges (id, name, description, icon, sort_order) values
  ('kurucu-uye', 'Kurucu Üye', 'İlk 1000 üyeden biri.', 'star-outline', 1),
  ('yeni-uye', 'Yeni Üye', 'Aileye hoş geldin.', 'leaf-outline', 2),
  ('aktif-taraftar', 'Aktif Taraftar', 'Son 30 günde en az 30 mesaj.', 'flame-outline', 3),
  ('tribun-mudavimi', 'Tribün Müdavimi', '3 maç buluşmasına katıldı ya da Taraftar & Tribün’de 25 mesaj.', 'megaphone-outline', 4),
  ('taktikci', 'Taktikçi', 'Maç & Taktik’te 25 mesaj.', 'clipboard-outline', 5),
  ('transfer-uzmani', 'Transfer Uzmanı', 'Transfer’de 25 mesaj.', 'swap-horizontal-outline', 6),
  ('tarihci', 'Tarihçi', 'Galatasaray Tarihi’nde 15 mesaj.', 'trophy-outline', 7),
  ('100-mesaj', '100 Mesaj', 'Forumda 100 mesaj.', 'chatbubbles-outline', 8),
  ('1000-mesaj', '1000 Mesaj', 'Forumda 1000 mesaj.', 'ribbon-outline', 9)
on conflict (id) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order;

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id text not null references public.badges (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- ---------------------------------------------------------------- meetups
create table if not exists public.meetups (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 5 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  starts_at timestamptz not null,
  city text not null check (char_length(btrim(city)) between 2 and 60),
  place_name text not null check (char_length(btrim(place_name)) between 2 and 100),
  address text not null default '' check (char_length(address) <= 200),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  capacity integer check (capacity between 2 and 500),
  match_id uuid references public.matches (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  check ((lat is null) = (lng is null))
);
create index if not exists meetups_upcoming_idx on public.meetups (starts_at) where not cancelled;
create index if not exists meetups_city_idx on public.meetups (lower(city), starts_at);

create table if not exists public.meetup_attendees (
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (meetup_id, user_id)
);
create index if not exists meetup_attendees_user_idx on public.meetup_attendees (user_id);

-- ---------------------------------------------------------------- badge awarding
create or replace function public.award_badges(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_recent integer;
  v_cat record;
  v_meetups integer;
begin
  if p_user is null then return; end if;
  select count(*) into v_total from public.posts where author_id = p_user and not is_deleted;
  select count(*) into v_recent from public.posts where author_id = p_user and not is_deleted and created_at > now() - interval '30 days';
  select
    count(*) filter (where c.slug = 'mac-taktik') as taktik,
    count(*) filter (where c.slug = 'transfer') as transfer,
    count(*) filter (where c.slug = 'galatasaray-tarihi') as tarih,
    count(*) filter (where c.slug = 'taraftar-tribun') as tribun
  into v_cat
  from public.posts x join public.topics t on t.id = x.topic_id join public.categories c on c.id = t.category_id
  where x.author_id = p_user and not x.is_deleted;
  select count(*) into v_meetups
  from public.meetup_attendees a join public.meetups m on m.id = a.meetup_id
  where a.user_id = p_user and not m.cancelled and m.starts_at < now();

  insert into public.user_badges (user_id, badge_id)
  select p_user, b from unnest(array[
    case when v_total >= 100 then '100-mesaj' end,
    case when v_total >= 1000 then '1000-mesaj' end,
    case when v_recent >= 30 then 'aktif-taraftar' end,
    case when v_cat.taktik >= 25 then 'taktikci' end,
    case when v_cat.transfer >= 25 then 'transfer-uzmani' end,
    case when v_cat.tarih >= 15 then 'tarihci' end,
    case when v_meetups >= 3 or v_cat.tribun >= 25 then 'tribun-mudavimi' end
  ]) as b
  where b is not null
  on conflict do nothing;
end;
$$;

create or replace function public.award_badges_on_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_badges(new.author_id);
  return new;
end;
$$;

drop trigger if exists posts_award_badges on public.posts;
create trigger posts_award_badges after insert on public.posts
for each row execute function public.award_badges_on_post();

-- Welcome badges on profile creation.
create or replace function public.award_welcome_badges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_badges (user_id, badge_id) values (new.id, 'yeni-uye') on conflict do nothing;
  if (select count(*) from public.profiles where deleted_at is null) <= 1000 then
    insert into public.user_badges (user_id, badge_id) values (new.id, 'kurucu-uye') on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_welcome_badges on public.profiles;
create trigger profiles_welcome_badges after insert on public.profiles
for each row execute function public.award_welcome_badges();

-- ---------------------------------------------------------------- follows RPC
-- p_kind: 'user' (target = username) | 'topic' (target = topic id) | 'category' (target = slug)
create or replace function public.set_follow(p_kind text, p_target text, p_on boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if p_kind = 'user' then
    select id into v_id from public.profiles where username = lower(p_target) and deleted_at is null;
    if v_id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    if v_id = v_uid then raise exception 'self_follow' using errcode = '22023'; end if;
    if p_on then
      insert into public.user_follows (follower_id, followee_id) values (v_uid, v_id) on conflict do nothing;
    else
      delete from public.user_follows where follower_id = v_uid and followee_id = v_id;
    end if;
  elsif p_kind = 'topic' then
    select id into v_id from public.topics where id = p_target::uuid;
    if v_id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    if p_on then
      insert into public.topic_follows (user_id, topic_id) values (v_uid, v_id) on conflict do nothing;
    else
      delete from public.topic_follows where user_id = v_uid and topic_id = v_id;
    end if;
  elsif p_kind = 'category' then
    select id into v_id from public.categories where slug = p_target;
    if v_id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    if p_on then
      insert into public.category_follows (user_id, category_id) values (v_uid, v_id) on conflict do nothing;
    else
      delete from public.category_follows where user_id = v_uid and category_id = v_id;
    end if;
  else
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  return p_on;
end;
$$;

create or replace function public.my_follows()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'users', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'avatarUrl', p.avatar_url) order by p.username)
                       from public.user_follows f join public.profiles p on p.id = f.followee_id
                       where f.follower_id = auth.uid() and p.deleted_at is null), '[]'::jsonb),
    'topics', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title) order by t.last_activity_at desc)
                        from public.topic_follows f join public.topics t on t.id = f.topic_id
                        where f.user_id = auth.uid()), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(c.slug order by c.sort_order)
                            from public.category_follows f join public.categories c on c.id = f.category_id
                            where f.user_id = auth.uid()), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------- community profile
create or replace function public.community_profile(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'userId', p.id,
    'bio', p.bio,
    'city', p.city,
    'favoriteCategory', (select jsonb_build_object('slug', c.slug, 'name', c.name) from public.categories c where c.id = p.favorite_category_id),
    'followers', (select count(*) from public.user_follows f where f.followee_id = p.id),
    'following', (select count(*) from public.user_follows f where f.follower_id = p.id),
    'isFollowing', exists (select 1 from public.user_follows f where f.follower_id = auth.uid() and f.followee_id = p.id),
    'badges', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'description', b.description, 'icon', b.icon, 'awardedAt', ub.awarded_at) order by b.sort_order)
                        from public.user_badges ub join public.badges b on b.id = ub.badge_id
                        where ub.user_id = p.id), '[]'::jsonb)
  )
  from public.profiles p
  where p.username = lower(p_username) and p.deleted_at is null;
$$;

-- Most active members in the last N days (by visible posts).
create or replace function public.active_members(p_days integer default 30, p_limit integer default 12)
returns table (id uuid, username text, avatar_url text, post_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.avatar_url, count(x.id) as post_count
  from public.posts x join public.profiles p on p.id = x.author_id
  where not x.is_deleted and p.deleted_at is null
    and x.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
  group by p.id
  order by post_count desc, p.username
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;

-- ---------------------------------------------------------------- meetups RPC
create or replace function public.create_meetup(
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_city text,
  p_place text,
  p_address text default '',
  p_lat double precision default null,
  p_lng double precision default null,
  p_capacity integer default null,
  p_match_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if p_starts_at is null or p_starts_at < now() + interval '10 minutes' or p_starts_at > now() + interval '180 days' then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  if (select count(*) from public.meetups where created_by = v_uid and not cancelled and starts_at > now()) >= 5 then
    raise exception 'too_many_meetups' using errcode = '54000';
  end if;
  insert into public.meetups (title, description, starts_at, city, place_name, address, lat, lng, capacity, match_id, created_by)
  values (btrim(p_title), btrim(coalesce(p_description, '')), p_starts_at, btrim(p_city), btrim(p_place), btrim(coalesce(p_address, '')),
          p_lat, p_lng, p_capacity, p_match_id, v_uid)
  returning id into v_id;
  insert into public.meetup_attendees (meetup_id, user_id) values (v_id, v_uid);
  return v_id;
end;
$$;

create or replace function public.set_meetup_attendance(p_meetup_id uuid, p_join boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_m public.meetups%rowtype;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  select * into v_m from public.meetups where id = p_meetup_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_m.cancelled or v_m.starts_at < now() then
    raise exception 'meetup_closed' using errcode = '22023';
  end if;
  if p_join then
    select count(*) into v_count from public.meetup_attendees where meetup_id = p_meetup_id;
    if v_m.capacity is not null and v_count >= v_m.capacity
       and not exists (select 1 from public.meetup_attendees where meetup_id = p_meetup_id and user_id = v_uid) then
      raise exception 'meetup_full' using errcode = '22023';
    end if;
    insert into public.meetup_attendees (meetup_id, user_id) values (p_meetup_id, v_uid) on conflict do nothing;
  else
    if v_m.created_by = v_uid then
      raise exception 'organizer_cannot_leave' using errcode = '22023';
    end if;
    delete from public.meetup_attendees where meetup_id = p_meetup_id and user_id = v_uid;
  end if;
  select count(*) into v_count from public.meetup_attendees where meetup_id = p_meetup_id;
  return v_count;
end;
$$;

create or replace function public.cancel_meetup(p_meetup_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  update public.meetups set cancelled = true
   where id = p_meetup_id and (created_by = v_uid or public.is_staff(v_uid));
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
end;
$$;

-- Attendance counts toward badges once a meetup has happened; checked when members join.
create or replace function public.award_badges_on_attend()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_badges(new.user_id);
  return new;
end;
$$;

drop trigger if exists meetup_attendees_award on public.meetup_attendees;
create trigger meetup_attendees_award after insert on public.meetup_attendees
for each row execute function public.award_badges_on_attend();

-- ---------------------------------------------------------------- RLS
alter table public.user_follows enable row level security;
alter table public.topic_follows enable row level security;
alter table public.category_follows enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.meetups enable row level security;
alter table public.meetup_attendees enable row level security;

revoke all on public.user_follows, public.topic_follows, public.category_follows, public.badges, public.user_badges,
  public.meetups, public.meetup_attendees from anon, authenticated;
grant select on public.badges, public.user_badges, public.meetups, public.meetup_attendees, public.user_follows to anon, authenticated;
grant select on public.topic_follows, public.category_follows to authenticated;

drop policy if exists "badges are public" on public.badges;
create policy "badges are public" on public.badges for select using (true);
drop policy if exists "user badges are public" on public.user_badges;
create policy "user badges are public" on public.user_badges for select using (true);
drop policy if exists "user follows are public" on public.user_follows;
create policy "user follows are public" on public.user_follows for select using (true);
drop policy if exists "own topic follows" on public.topic_follows;
create policy "own topic follows" on public.topic_follows for select to authenticated using (user_id = auth.uid());
drop policy if exists "own category follows" on public.category_follows;
create policy "own category follows" on public.category_follows for select to authenticated using (user_id = auth.uid());
drop policy if exists "meetups are public" on public.meetups;
create policy "meetups are public" on public.meetups for select using (true);
drop policy if exists "meetup attendees are public" on public.meetup_attendees;
create policy "meetup attendees are public" on public.meetup_attendees for select using (true);

revoke all on function public.award_badges(uuid), public.award_badges_on_post(), public.award_welcome_badges(),
  public.award_badges_on_attend() from public, anon, authenticated;
revoke all on function public.set_follow(text, text, boolean), public.my_follows(), public.create_meetup(text, text, timestamptz, text, text, text, double precision, double precision, integer, uuid),
  public.set_meetup_attendance(uuid, boolean), public.cancel_meetup(uuid) from public, anon;
revoke all on function public.community_profile(text), public.active_members(integer, integer) from public;
grant execute on function public.set_follow(text, text, boolean), public.my_follows(),
  public.create_meetup(text, text, timestamptz, text, text, text, double precision, double precision, integer, uuid),
  public.set_meetup_attendance(uuid, boolean), public.cancel_meetup(uuid) to authenticated;
grant execute on function public.community_profile(text), public.active_members(integer, integer) to anon, authenticated;

-- ---------------------------------------------------------------- account deletion
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  delete from public.post_likes where user_id = v_uid;
  delete from public.poll_votes where user_id = v_uid;
  delete from public.post_reports where reporter_id = v_uid;
  delete from public.post_mentions where user_id = v_uid;
  delete from public.match_reactions where user_id = v_uid;
  delete from public.lineups where user_id = v_uid;
  delete from public.user_follows where follower_id = v_uid or followee_id = v_uid;
  delete from public.topic_follows where user_id = v_uid;
  delete from public.category_follows where user_id = v_uid;
  delete from public.user_badges where user_id = v_uid;
  delete from public.meetup_attendees where user_id = v_uid;
  update public.meetups set cancelled = true where created_by = v_uid and starts_at > now();
  update public.profiles
     set username = 'silinmis_' || substr(replace(v_uid::text, '-', ''), 1, 10),
         avatar_url = null,
         bio = null,
         city = null,
         favorite_category_id = null,
         role = 'user',
         deleted_at = now()
   where id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

-- Existing members get their welcome/milestone badges once.
insert into public.user_badges (user_id, badge_id)
select id, 'yeni-uye' from public.profiles where deleted_at is null
on conflict do nothing;
do $$
declare r record;
begin
  for r in select id from public.profiles where deleted_at is null loop
    perform public.award_badges(r.id);
  end loop;
end;
$$;

commit;
