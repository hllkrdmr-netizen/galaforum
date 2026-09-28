-- Match administration checks. Expected errors (7, in order): member create not_allowed, same_teams,
-- invalid_date, event before kickoff match_not_started, side_required, invalid_patch, direct event insert denied.
\set ON_ERROR_STOP 1
\pset footer off
insert into auth.users (id, email, raw_user_meta_data) values
 ('ffffffff-0000-0000-0000-00000000000b','m@x.com','{"username":"mac_mod"}'),
 ('ffffffff-0000-0000-0000-000000000001','u@x.com','{"username":"mac_uye"}');
update public.profiles set role = 'moderator' where username = 'mac_mod';
delete from public.notifications;

set role authenticated;
select set_config('request.jwt.claim.sub','ffffffff-0000-0000-0000-000000000001',false);
\set ON_ERROR_STOP 0
select public.mod_create_match('Süper Lig','Galatasaray','Rakip', now() + interval '1 day');
\set ON_ERROR_STOP 1

select set_config('request.jwt.claim.sub','ffffffff-0000-0000-0000-00000000000b',false);
\set ON_ERROR_STOP 0
select public.mod_create_match('Süper Lig','Galatasaray','galatasaray ', now() + interval '1 day');
select public.mod_create_match('Süper Lig','Galatasaray','Rakip', now() - interval '60 days');
\set ON_ERROR_STOP 1
select public.mod_create_match('Süper Lig','Galatasaray','Trabzonspor', now() + interval '1 hour', 'RAMS Park') as m \gset
select status, home_score, topic_id is not null as has_topic from public.matches where id = :'m';
\set ON_ERROR_STOP 0
select public.mod_add_match_event(:'m', 5, null, 'goal', 'home', 'Oyuncu');
\set ON_ERROR_STOP 1

\echo '== kickoff: score 0-0, minute 1, kickoff event, start notification'
select public.mod_update_match(:'m', '{"status":"live"}');
select status, minute, home_score, away_score from public.matches where id = :'m';

\echo '== goals keep the score; own goal counts for the other side; misses and cards do not'
select public.mod_add_match_event(:'m', 23, null, 'goal', 'home', 'Oyuncu A') is not null as g1;
select public.mod_add_match_event(:'m', 31, null, 'own_goal', 'home', 'Oyuncu B') as og \gset
select public.mod_add_match_event(:'m', 40, null, 'penalty_miss', 'away', null) is not null as miss;
select public.mod_add_match_event(:'m', 44, null, 'yellow', 'away', 'Oyuncu C') is not null as card;
\set ON_ERROR_STOP 0
select public.mod_add_match_event(:'m', 44, null, 'yellow', null, null);
\set ON_ERROR_STOP 1
select home_score, away_score from public.matches where id = :'m';
select public.mod_delete_match_event(:'og');
select home_score, away_score as after_own_goal_deleted from public.matches where id = :'m';

\echo '== half-time and second half'
select public.mod_update_match(:'m', '{"status":"halftime"}');
select status, minute from public.matches where id = :'m';
select public.mod_update_match(:'m', '{"status":"live"}');
select status, minute from public.matches where id = :'m';
select public.mod_update_match(:'m', '{"minute":88}');
\set ON_ERROR_STOP 0
select public.mod_update_match(:'m', '{"topic_id":null}');
\set ON_ERROR_STOP 1

\echo '== full time'
select public.mod_update_match(:'m', '{"status":"finished"}');
select status, minute, home_score, away_score from public.matches where id = :'m';
select type, minute from public.match_events where match_id = :'m' order by minute, created_at;
reset role;
select n.kind, count(*) from public.notifications n where n.match_id = :'m' group by 1 order by 1;
select n.data ->> 'home_score' as end_home, n.data ->> 'away_score' as end_away from public.notifications n
 where n.match_id = :'m' and n.kind = 'match_end' limit 1;

\echo '== audit log and locked tables'
select action, count(*) from public.moderation_log where target_type = 'match' group by 1 order by 1;
set role authenticated; select set_config('request.jwt.claim.sub','ffffffff-0000-0000-0000-00000000000b',false);
\set ON_ERROR_STOP 0
insert into public.match_events (match_id, minute, type) values (:'m', 50, 'var');
\set ON_ERROR_STOP 1
select public.mod_update_match(:'m', '{"status":"scheduled","kickoff_at":"2026-12-01T17:00:00Z"}');
select status, minute, home_score from public.matches where id = :'m';
