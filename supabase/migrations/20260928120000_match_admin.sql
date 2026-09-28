-- Match administration: staff create and run matches from the app through audited RPCs.
-- Additive: apply after 20260928090000_moderation.sql.
--
-- Replaces the Phase 5 direct-table staff policies on matches/match_events, so every change is written to
-- moderation_log. Goal events keep the score in step automatically; status changes add the kickoff /
-- half-time / full-time events. Notifications (Phase 7 triggers) fire as before.
--
-- Event `side` is the team of the player involved: a goal or penalty goal counts for that side, an own goal
-- counts for the other side.
begin;

-- ---------------------------------------------------------------- lock down direct writes
drop policy if exists "staff manage matches" on public.matches;
drop policy if exists "staff manage match events" on public.match_events;
revoke insert, update, delete on public.matches, public.match_events from anon, authenticated;

-- ---------------------------------------------------------------- audit actions
alter table public.moderation_log drop constraint if exists moderation_log_action_check;
alter table public.moderation_log add constraint moderation_log_action_check check (action in (
  'post_remove', 'post_restore', 'topic_pin', 'topic_unpin', 'topic_lock', 'topic_unlock', 'topic_move',
  'topic_hide', 'topic_unhide', 'report_dismiss', 'user_mute', 'user_ban', 'sanction_revoke', 'role_change',
  'match_create', 'match_update', 'match_event_add', 'match_event_delete'
));
alter table public.moderation_log drop constraint if exists moderation_log_target_type_check;
alter table public.moderation_log add constraint moderation_log_target_type_check
  check (target_type in ('post', 'topic', 'user', 'match'));

-- ---------------------------------------------------------------- helpers
create or replace function public.match_goal_side(p_type text, p_side text)
returns text
language sql
immutable
as $$
  select case
    when p_type in ('goal', 'penalty_goal') then p_side
    when p_type = 'own_goal' then case p_side when 'home' then 'away' when 'away' then 'home' end
  end;
$$;

-- ---------------------------------------------------------------- create
create or replace function public.mod_create_match(
  p_competition text,
  p_home_team text,
  p_away_team text,
  p_kickoff_at timestamptz,
  p_venue text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.require_staff();
  if p_kickoff_at is null or p_kickoff_at < now() - interval '30 days' or p_kickoff_at > now() + interval '400 days' then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  if lower(btrim(coalesce(p_home_team, ''))) = lower(btrim(coalesce(p_away_team, ''))) then
    raise exception 'same_teams' using errcode = '22023';
  end if;
  insert into public.matches (competition, home_team, away_team, kickoff_at, venue, created_by)
  values (btrim(p_competition), btrim(p_home_team), btrim(p_away_team), p_kickoff_at, btrim(coalesce(p_venue, '')), auth.uid())
  returning id into v_id;
  perform public.log_moderation('match_create', 'match', v_id::text, btrim(p_home_team) || ' – ' || btrim(p_away_team), '',
    jsonb_build_object('kickoffAt', p_kickoff_at, 'competition', btrim(p_competition)));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------- update (details, status, minute, score)
-- p_patch keys (all optional): competition, home_team, away_team, kickoff_at, venue, status, minute,
-- home_score, away_score.
create or replace function public.mod_update_match(p_match_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches;
  n public.matches;
  v_changed text[];
begin
  perform public.require_staff();
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'invalid_patch' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_patch) k
              where k not in ('competition', 'home_team', 'away_team', 'kickoff_at', 'venue', 'status', 'minute', 'home_score', 'away_score')) then
    raise exception 'invalid_patch' using errcode = '22023';
  end if;
  select * into m from public.matches where id = p_match_id for update;
  if m.id is null then
    raise exception 'match_not_found' using errcode = 'P0002';
  end if;

  n := m;
  if p_patch ? 'competition' then n.competition := btrim(p_patch ->> 'competition'); end if;
  if p_patch ? 'home_team' then n.home_team := btrim(p_patch ->> 'home_team'); end if;
  if p_patch ? 'away_team' then n.away_team := btrim(p_patch ->> 'away_team'); end if;
  if p_patch ? 'kickoff_at' then n.kickoff_at := (p_patch ->> 'kickoff_at')::timestamptz; end if;
  if p_patch ? 'venue' then n.venue := btrim(coalesce(p_patch ->> 'venue', '')); end if;
  if p_patch ? 'status' then n.status := p_patch ->> 'status'; end if;
  if p_patch ? 'minute' then n.minute := (p_patch ->> 'minute')::integer; end if;
  if p_patch ? 'home_score' then n.home_score := (p_patch ->> 'home_score')::integer; end if;
  if p_patch ? 'away_score' then n.away_score := (p_patch ->> 'away_score')::integer; end if;

  if lower(n.home_team) = lower(n.away_team) then
    raise exception 'same_teams' using errcode = '22023';
  end if;

  -- Status rules: before kickoff there is no score/minute; once started the score starts at 0–0.
  if n.status in ('scheduled', 'postponed') then
    n.minute := null;
    n.home_score := null;
    n.away_score := null;
  else
    n.home_score := coalesce(n.home_score, 0);
    n.away_score := coalesce(n.away_score, 0);
    if n.status = 'live' then
      -- Second half starts at 46' unless the moderator typed a minute.
      if m.status = 'halftime' and not (p_patch ? 'minute') then
        n.minute := 46;
      else
        n.minute := coalesce(n.minute, 1);
      end if;
    elsif n.status = 'halftime' then
      n.minute := 45;
    elsif n.status = 'finished' then
      n.minute := null;
    end if;
  end if;

  update public.matches
     set competition = n.competition, home_team = n.home_team, away_team = n.away_team, kickoff_at = n.kickoff_at,
         venue = n.venue, status = n.status, minute = n.minute, home_score = n.home_score, away_score = n.away_score
   where id = p_match_id;

  -- Milestone events so the live feed tells the story without extra typing.
  if n.status is distinct from m.status then
    if n.status = 'live' and m.status = 'scheduled'
       and not exists (select 1 from public.match_events where match_id = p_match_id and type = 'kickoff') then
      insert into public.match_events (match_id, minute, type) values (p_match_id, 1, 'kickoff');
    elsif n.status = 'halftime'
       and not exists (select 1 from public.match_events where match_id = p_match_id and type = 'halftime') then
      insert into public.match_events (match_id, minute, type) values (p_match_id, 45, 'halftime');
    elsif n.status = 'finished'
       and not exists (select 1 from public.match_events where match_id = p_match_id and type = 'fulltime') then
      insert into public.match_events (match_id, minute, type) values (p_match_id, greatest(90, coalesce(m.minute, 90)), 'fulltime');
    end if;
  end if;

  select array_agg(k order by k) into v_changed from jsonb_object_keys(p_patch) k;
  perform public.log_moderation('match_update', 'match', p_match_id::text, n.home_team || ' – ' || n.away_team, '',
    jsonb_build_object('fields', to_jsonb(v_changed), 'from', m.status, 'to', n.status,
                       'score', case when n.home_score is null then null else n.home_score || '-' || n.away_score end));
end;
$$;

-- ---------------------------------------------------------------- events
create or replace function public.mod_add_match_event(
  p_match_id uuid,
  p_minute integer,
  p_extra_minute integer,
  p_type text,
  p_side text,
  p_player text default null,
  p_detail text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches;
  v_id uuid;
  v_goal text;
begin
  perform public.require_staff();
  select * into m from public.matches where id = p_match_id for update;
  if m.id is null then
    raise exception 'match_not_found' using errcode = 'P0002';
  end if;
  if m.status not in ('live', 'halftime', 'finished') then
    raise exception 'match_not_started' using errcode = '22023';
  end if;
  if p_type in ('goal', 'own_goal', 'penalty_goal', 'penalty_miss', 'yellow', 'red', 'sub') and p_side is null then
    raise exception 'side_required' using errcode = '22023';
  end if;
  insert into public.match_events (match_id, minute, extra_minute, type, side, player, detail)
  values (p_match_id, p_minute, p_extra_minute, p_type, p_side, nullif(btrim(coalesce(p_player, '')), ''), nullif(btrim(coalesce(p_detail, '')), ''))
  returning id into v_id;

  v_goal := public.match_goal_side(p_type, p_side);
  if v_goal = 'home' then
    update public.matches set home_score = coalesce(home_score, 0) + 1, away_score = coalesce(away_score, 0) where id = p_match_id;
  elsif v_goal = 'away' then
    update public.matches set away_score = coalesce(away_score, 0) + 1, home_score = coalesce(home_score, 0) where id = p_match_id;
  end if;

  perform public.log_moderation('match_event_add', 'match', p_match_id::text, m.home_team || ' – ' || m.away_team, '',
    jsonb_build_object('eventId', v_id, 'type', p_type, 'minute', p_minute, 'side', p_side, 'player', p_player));
  return v_id;
end;
$$;

create or replace function public.mod_delete_match_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
  v_goal text;
begin
  perform public.require_staff();
  select ev.*, m.home_team, m.away_team into e
    from public.match_events ev join public.matches m on m.id = ev.match_id
   where ev.id = p_event_id
   for update of ev;
  if e.id is null then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;
  delete from public.match_events where id = p_event_id;
  v_goal := public.match_goal_side(e.type, e.side);
  if v_goal = 'home' then
    update public.matches set home_score = greatest(0, coalesce(home_score, 0) - 1) where id = e.match_id;
  elsif v_goal = 'away' then
    update public.matches set away_score = greatest(0, coalesce(away_score, 0) - 1) where id = e.match_id;
  end if;
  perform public.log_moderation('match_event_delete', 'match', e.match_id::text, e.home_team || ' – ' || e.away_team, '',
    jsonb_build_object('type', e.type, 'minute', e.minute, 'side', e.side, 'player', e.player));
end;
$$;

-- ---------------------------------------------------------------- grants
revoke all on function public.match_goal_side(text, text) from public, anon, authenticated;
revoke all on function public.mod_create_match(text, text, text, timestamptz, text), public.mod_update_match(uuid, jsonb),
  public.mod_add_match_event(uuid, integer, integer, text, text, text, text), public.mod_delete_match_event(uuid)
  from public, anon;
grant execute on function public.mod_create_match(text, text, text, timestamptz, text), public.mod_update_match(uuid, jsonb),
  public.mod_add_match_event(uuid, integer, integer, text, text, text, text), public.mod_delete_match_event(uuid)
  to authenticated;

commit;
