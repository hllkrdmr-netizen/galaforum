-- Phase 5 — match hub, live match room, lineup builder.
-- Additive: apply after 20260927200000_auth_profiles_search.sql.
-- Match data is written by staff (moderator/admin) or a trusted server job using the service role;
-- clients only read, react and save their own lineups.
begin;

-- ---------------------------------------------------------------- tables
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  competition text not null check (char_length(btrim(competition)) between 2 and 80),
  home_team text not null check (char_length(btrim(home_team)) between 2 and 60),
  away_team text not null check (char_length(btrim(away_team)) between 2 and 60),
  kickoff_at timestamptz not null,
  venue text not null default '' check (char_length(venue) <= 120),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'halftime', 'finished', 'postponed')),
  minute integer check (minute between 0 and 130),
  home_score integer check (home_score between 0 and 99),
  away_score integer check (away_score between 0 and 99),
  topic_id uuid references public.topics (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists matches_kickoff_idx on public.matches (kickoff_at);
create index if not exists matches_topic_idx on public.matches (topic_id);

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  minute integer not null check (minute between 0 and 130),
  extra_minute integer check (extra_minute between 1 and 30),
  type text not null check (type in ('goal', 'own_goal', 'penalty_goal', 'penalty_miss', 'yellow', 'red', 'sub', 'var', 'kickoff', 'halftime', 'fulltime')),
  side text check (side in ('home', 'away')),
  player text check (char_length(player) <= 80),
  detail text check (char_length(detail) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists match_events_match_idx on public.match_events (match_id, minute, extra_minute, created_at);

create table if not exists public.match_reactions (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('gol', 'alkis', 'heyecan', 'uzgun')),
  created_at timestamptz not null default now()
);
create index if not exists match_reactions_match_idx on public.match_reactions (match_id, type);
create index if not exists match_reactions_user_idx on public.match_reactions (user_id, created_at desc);

create table if not exists public.squad_players (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  number integer check (number between 1 and 99),
  position text not null check (position in ('GK', 'DF', 'MF', 'FW')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.lineups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  match_id uuid references public.matches (id) on delete set null,
  formation text not null check (formation in ('4-2-3-1', '4-3-3', '3-4-3', '4-4-2')),
  players jsonb not null check (jsonb_typeof(players) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists lineups_user_idx on public.lineups (user_id, match_id, created_at desc);

-- ---------------------------------------------------------------- auto-generated match topic
-- Every new match gets "<Ev> – <Deplasman> | Canlı Maç Konusu" in Maç & Taktik, authored by the creator.
create or replace function public.matches_create_topic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category uuid;
  v_author uuid := coalesce(new.created_by, auth.uid());
  v_topic uuid;
begin
  if new.topic_id is not null or v_author is null then
    return new;
  end if;
  select id into v_category from public.categories where slug = 'mac-taktik';
  if v_category is null then
    return new;
  end if;
  insert into public.topics (category_id, author_id, title, is_pinned)
  values (v_category, v_author, left(btrim(new.home_team) || ' – ' || btrim(new.away_team) || ' | Canlı Maç Konusu', 140), false)
  returning id into v_topic;
  insert into public.posts (topic_id, author_id, body, is_opening_post)
  values (
    v_topic,
    v_author,
    btrim(new.competition) || ' · ' || to_char(new.kickoff_at at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI')
      || case when btrim(new.venue) <> '' then ' · ' || btrim(new.venue) else '' end
      || E'\n\nMaç boyunca yorumlarını bu konuya yaz. Saygılı dil, küfür yok; iddiaları kaynağıyla paylaş.',
    true
  );
  new.topic_id := v_topic;
  return new;
end;
$$;

drop trigger if exists matches_before_insert_topic on public.matches;
create trigger matches_before_insert_topic before insert on public.matches
for each row execute function public.matches_create_topic();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists matches_touch on public.matches;
create trigger matches_touch before update on public.matches
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- reactions
create or replace function public.match_reaction_counts(p_match_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'gol', count(*) filter (where type = 'gol'),
    'alkis', count(*) filter (where type = 'alkis'),
    'heyecan', count(*) filter (where type = 'heyecan'),
    'uzgun', count(*) filter (where type = 'uzgun'))
  from public.match_reactions
  where match_id = p_match_id;
$$;

-- One reaction per member every 3 seconds; only while the match is live.
create or replace function public.match_react(p_match_id uuid, p_type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if p_type not in ('gol', 'alkis', 'heyecan', 'uzgun') then
    raise exception 'invalid_reaction' using errcode = '22023';
  end if;
  select status into v_status from public.matches where id = p_match_id;
  if not found then
    raise exception 'match_not_found' using errcode = 'P0002';
  end if;
  if v_status not in ('live', 'halftime') then
    raise exception 'match_not_live' using errcode = '22023';
  end if;
  if exists (select 1 from public.match_reactions where user_id = v_uid and created_at > now() - interval '3 seconds') then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  insert into public.match_reactions (match_id, user_id, type) values (p_match_id, v_uid, p_type);
  return public.match_reaction_counts(p_match_id);
end;
$$;

-- ---------------------------------------------------------------- RLS
alter table public.matches enable row level security;
alter table public.match_events enable row level security;
alter table public.match_reactions enable row level security;
alter table public.squad_players enable row level security;
alter table public.lineups enable row level security;

revoke all on public.matches, public.match_events, public.match_reactions, public.squad_players, public.lineups from anon, authenticated;
grant select on public.matches, public.match_events, public.squad_players to anon, authenticated;
grant insert, update, delete on public.matches, public.match_events, public.squad_players to authenticated;
grant select, insert, delete on public.lineups to authenticated;
grant select on public.lineups to anon;

drop policy if exists "matches are public" on public.matches;
create policy "matches are public" on public.matches for select using (true);
drop policy if exists "staff manage matches" on public.matches;
create policy "staff manage matches" on public.matches for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

drop policy if exists "match events are public" on public.match_events;
create policy "match events are public" on public.match_events for select using (true);
drop policy if exists "staff manage match events" on public.match_events;
create policy "staff manage match events" on public.match_events for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

drop policy if exists "squad is public" on public.squad_players;
create policy "squad is public" on public.squad_players for select using (true);
drop policy if exists "staff manage squad" on public.squad_players;
create policy "staff manage squad" on public.squad_players for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- Reactions: no direct table access; counts via RPC only (no voter identities exposed).

drop policy if exists "lineups are public" on public.lineups;
create policy "lineups are public" on public.lineups for select using (true);
drop policy if exists "members save own lineups" on public.lineups;
create policy "members save own lineups" on public.lineups for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "members delete own lineups" on public.lineups;
create policy "members delete own lineups" on public.lineups for delete to authenticated
  using (user_id = auth.uid());

revoke all on function public.matches_create_topic() from public, anon, authenticated;
revoke all on function public.match_reaction_counts(uuid) from public;
revoke all on function public.match_react(uuid, text) from public, anon;
grant execute on function public.match_reaction_counts(uuid) to anon, authenticated;
grant execute on function public.match_react(uuid, text) to authenticated;

-- ---------------------------------------------------------------- account deletion
-- Extend Phase 4 deletion: reactions and lineups are personal data too.
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
  update public.profiles
     set username = 'silinmis_' || substr(replace(v_uid::text, '-', ''), 1, 10),
         avatar_url = null,
         role = 'user',
         deleted_at = now()
   where id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

-- ---------------------------------------------------------------- realtime (Supabase only)
-- Selective: live score/minute, match events and new posts. Skipped on plain PostgreSQL.
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['matches', 'match_events', 'posts'] loop
      if not exists (
        select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;

commit;
