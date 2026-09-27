-- GalaForum — forum core schema (profiles, categories, topics, posts)
-- Phase 1/2 foundation. Later phases add polls, likes, follows, matches, meetups, notifications, moderation.
-- Security model: RLS on every table; roles live in profiles.role and are NOT writable by users.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'verified', 'moderator', 'admin')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  icon text not null default 'chatbubbles-outline',
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- topics
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 5 and 140),
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  reply_count int not null default 0,
  view_count bigint not null default 0,
  last_post_id uuid,
  last_poster_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create index if not exists topics_category_activity_idx on public.topics (category_id, is_pinned desc, last_activity_at desc);
create index if not exists topics_activity_idx on public.topics (last_activity_at desc);
create index if not exists topics_title_trgm_idx on public.topics using gin (title gin_trgm_ops);

-- ---------------------------------------------------------------- posts
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  is_opening_post boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_topic_created_idx on public.posts (topic_id, created_at);
create index if not exists posts_created_idx on public.posts (created_at desc) where is_deleted = false;
create index if not exists posts_body_trgm_idx on public.posts using gin (body gin_trgm_ops);

alter table public.topics
  drop constraint if exists topics_last_post_id_fkey,
  add constraint topics_last_post_id_fkey foreign key (last_post_id) references public.posts (id) on delete set null;

-- ---------------------------------------------------------------- helpers
create or replace function public.is_staff(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.role in ('moderator', 'admin'));
$$;

-- Keep topic counters/activity in sync when posts are created.
create or replace function public.on_post_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.topics t
     set reply_count = t.reply_count + case when new.is_opening_post then 0 else 1 end,
         last_post_id = new.id,
         last_poster_id = new.author_id,
         last_activity_at = new.created_at
   where t.id = new.topic_id;
  return new;
end;
$$;

drop trigger if exists posts_after_insert on public.posts;
create trigger posts_after_insert after insert on public.posts
for each row execute function public.on_post_inserted();

-- Profile row for every new auth user (username derived from e-mail, made unique).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text := lower(regexp_replace(split_part(coalesce(new.email, 'uye'), '@', 1), '[^a-z0-9_]', '', 'g'));
  candidate text;
begin
  if char_length(base) < 3 then base := 'uye' || base; end if;
  base := left(base, 18);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    candidate := base || '_' || substr(md5(random()::text), 1, 4);
  end loop;
  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Atomic topic creation (topic + opening post). The only way clients create topics:
-- runs as definer, but always writes auth.uid() as author and never sets pinned/locked.
create or replace function public.create_topic(p_category_slug text, p_title text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category uuid;
  v_topic uuid;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  select id into v_category from public.categories where slug = p_category_slug;
  if v_category is null then
    raise exception 'category_not_found' using errcode = 'P0002';
  end if;
  insert into public.topics (category_id, author_id, title)
  values (v_category, auth.uid(), btrim(p_title))
  returning id into v_topic;
  insert into public.posts (topic_id, author_id, body, is_opening_post)
  values (v_topic, auth.uid(), btrim(p_body), true);
  return v_topic;
end;
$$;

-- View counter without granting UPDATE on topics to clients.
create or replace function public.increment_topic_view(p_topic_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.topics set view_count = view_count + 1 where id = p_topic_id;
$$;

-- ---------------------------------------------------------------- category stats view
create or replace view public.category_stats
with (security_invoker = true) as
select
  c.id,
  c.slug,
  c.name,
  c.description,
  c.icon,
  c.sort_order,
  coalesce(s.topic_count, 0)::int as topic_count,
  coalesce(s.post_count, 0)::int as post_count,
  lt.last_activity_at,
  lt.id as last_topic_id,
  lt.title as last_topic_title
from public.categories c
left join lateral (
  select count(*) as topic_count, coalesce(sum(t.reply_count + 1), 0) as post_count
  from public.topics t
  where t.category_id = c.id
) s on true
left join lateral (
  select t.id, t.title, t.last_activity_at
  from public.topics t
  where t.category_id = c.id
  order by t.last_activity_at desc
  limit 1
) lt on true;

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.topics enable row level security;
alter table public.posts enable row level security;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- Role must never be user-writable: only username/avatar columns are updatable by clients.
revoke update on public.profiles from anon, authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;

drop policy if exists "categories are public" on public.categories;
create policy "categories are public" on public.categories for select using (true);

drop policy if exists "topics are public" on public.topics;
create policy "topics are public" on public.topics for select using (true);

-- No direct INSERT policy on topics: topics are created only through public.create_topic().
drop policy if exists "members create topics" on public.topics;

drop policy if exists "staff manage topics" on public.topics;
create policy "staff manage topics" on public.topics for update to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

drop policy if exists "visible posts are public" on public.posts;
create policy "visible posts are public" on public.posts for select
  using (is_deleted = false or public.is_staff(auth.uid()));

drop policy if exists "members reply to open topics" on public.posts;
create policy "members reply to open topics" on public.posts for insert to authenticated
  with check (
    auth.uid() = author_id
    and is_opening_post = false
    and is_deleted = false
    and exists (select 1 from public.topics t where t.id = topic_id and (t.is_locked = false or public.is_staff(auth.uid())))
  );

drop policy if exists "staff moderate posts" on public.posts;
create policy "staff moderate posts" on public.posts for update to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

revoke all on function public.increment_topic_view(uuid) from public;
grant execute on function public.increment_topic_view(uuid) to anon, authenticated;
revoke all on function public.create_topic(text, text, text) from public, anon;
grant execute on function public.create_topic(text, text, text) to authenticated;

-- ---------------------------------------------------------------- seed: 11 default categories
insert into public.categories (slug, name, description, icon, sort_order) values
  ('mac-taktik', 'Maç & Taktik', 'Maç analizleri, diziliş tercihleri ve teknik direktör kararları.', 'football-outline', 1),
  ('transfer', 'Transfer', 'Söylentiler, görüşmeler ve resmileşen transferler — kaynağıyla.', 'swap-horizontal-outline', 2),
  ('takim-oyuncular', 'Takım & Oyuncular', 'Kadro, form durumu, sakatlıklar ve oyuncu değerlendirmeleri.', 'shirt-outline', 3),
  ('yonetim-kulup', 'Yönetim & Kulüp', 'Yönetim kararları, bütçe, genel kurul ve kulüp politikaları.', 'business-outline', 4),
  ('avrupa', 'Avrupa', 'Avrupa kupaları, rakip analizleri ve deplasman notları.', 'globe-outline', 5),
  ('galatasaray-tarihi', 'Galatasaray Tarihi', 'Unutulmaz maçlar, efsaneler ve kulübün köklü hikâyesi.', 'trophy-outline', 6),
  ('mac-oncesi-bulusmalar', 'Maç Öncesi Buluşmalar', 'Şehir şehir maç günü buluşmaları ve ortak yolculuklar.', 'people-outline', 7),
  ('basketbol', 'Basketbol', 'Basketbol şubesi, maçlar ve kadro gündemi.', 'basketball-outline', 8),
  ('altyapi-akademi', 'Altyapı / Akademi', 'Genç yetenekler, akademi takımları ve A takıma yükselenler.', 'school-outline', 9),
  ('taraftar-tribun', 'Taraftar & Tribün', 'Tribün kültürü, koreografiler, besteler ve deplasman hatıraları.', 'megaphone-outline', 10),
  ('serbest', 'Serbest', 'Futbol dışı sohbetler ve konu dışı her şey — saygı çerçevesinde.', 'chatbubbles-outline', 11)
on conflict (slug) do update
  set name = excluded.name, description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order;
