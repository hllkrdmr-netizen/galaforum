-- Phase 5 behaviour checks. Expected errors: member match insert denied, rate_limited, invalid_reaction, member score update denied, permission denied (reactions table, anon react), lineup RLS/check, match_not_live.
-- Since 20260928120000_match_admin.sql staff write matches through audited mod_* RPCs (see match_admin.sql check).
\set ON_ERROR_STOP 1
\pset footer off
insert into auth.users (id, email, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001','mod@x.com','{"username":"mod_gs"}'),
 ('aaaaaaaa-0000-0000-0000-000000000002','uye@x.com','{"username":"uye_gs"}');
update public.profiles set role='moderator' where username='mod_gs';

-- member cannot create a match
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000002',false);
\set ON_ERROR_STOP 0
insert into public.matches (competition, home_team, away_team, kickoff_at) values ('Süper Lig','Galatasaray','Rakip', now());
\set ON_ERROR_STOP 1

-- moderator creates a match -> topic auto-created
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
select public.mod_create_match('Süper Lig','Galatasaray','Fenerbahçe', now() + interval '2 days', 'RAMS Park') as mid \gset
select topic_id as tid from public.matches where id = :'mid' \gset
select t.title, c.slug, (select count(*) from public.posts p where p.topic_id=t.id and p.is_opening_post) as opening from public.topics t join public.categories c on c.id=t.category_id where t.id=:'tid';
select left(body, 60) as opening_body from public.posts where topic_id=:'tid';
select public.mod_update_match(:'mid', '{"status":"live","minute":23}');
select public.mod_add_match_event(:'mid', 23, null, 'goal', 'home', 'Oyuncu A') is not null as goal_added;
select status, minute, home_score, updated_at > created_at as touched from public.matches where id=:'mid';

-- member reacts; rate limit; counts via RPC
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000002',false);
select public.match_react(:'mid','gol') as counts;
\set ON_ERROR_STOP 0
select public.match_react(:'mid','alkis');
select public.match_react(:'mid','kotu');
\set ON_ERROR_STOP 1
\set ON_ERROR_STOP 0
update public.matches set home_score=5 where id=:'mid';
select * from public.match_reactions;
\set ON_ERROR_STOP 1
select home_score as unchanged_by_member from public.matches where id=:'mid';

-- lineups
insert into public.lineups (match_id, formation, players) values (:'mid','4-3-3','{"GK":"Kaleci"}');
\set ON_ERROR_STOP 0
insert into public.lineups (user_id, match_id, formation, players) values ('aaaaaaaa-0000-0000-0000-000000000001', :'mid','4-3-3','{}');
insert into public.lineups (match_id, formation, players) values (:'mid','5-5-0','{}');
\set ON_ERROR_STOP 1
select count(*) as my_lineups from public.lineups;

-- anon reads
reset role; set role anon; select set_config('request.jwt.claim.sub','',false);
select count(*) as anon_matches from public.matches;
select public.match_reaction_counts(:'mid') as anon_counts;
\set ON_ERROR_STOP 0
select public.match_react(:'mid','gol');
\set ON_ERROR_STOP 1

-- not live -> reaction refused
reset role;
update public.matches set status='finished' where id=:'mid';
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000002',false);
select pg_sleep(3.1);
\set ON_ERROR_STOP 0
select public.match_react(:'mid','gol');
\set ON_ERROR_STOP 1
-- account deletion removes reactions + lineups
select public.delete_my_account();
reset role;
select (select count(*) from public.match_reactions) as reactions_left, (select count(*) from public.lineups) as lineups_left;
