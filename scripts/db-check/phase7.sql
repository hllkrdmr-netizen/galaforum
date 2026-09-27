-- Phase 7 behaviour checks. Expected errors (5, in order): direct notification insert denied, invalid_group,
-- invalid_token, claim_push_batch denied for members, push_tokens select denied for members.
\set ON_ERROR_STOP 1
\pset footer off
insert into auth.users (id, email, raw_user_meta_data) values
 ('cccccccc-0000-0000-0000-000000000001','a@x.com','{"username":"ayse_gs"}'),
 ('cccccccc-0000-0000-0000-000000000002','b@x.com','{"username":"burak_gs"}'),
 ('cccccccc-0000-0000-0000-000000000003','c@x.com','{"username":"cem_gs"}');
\echo '== welcome badges become notifications'
select p.username, array_agg(n.badge_id order by n.badge_id) as badge_notifications
  from public.notifications n join public.profiles p on p.id = n.user_id where n.kind = 'badge' group by 1 order by 1;
delete from public.notifications;

set role authenticated;
-- burak follows the category, cem will follow the topic
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000002',false);
select public.set_follow('category','mac-taktik',true);
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000001',false);
select public.forum_create_topic('mac-taktik','Derbi için ideal orta saha','İlk mesaj: pres mi, blok mu?') as t \gset
select id as opening from public.posts where topic_id = :'t' and is_opening_post \gset
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000003',false);
select public.set_follow('topic', :'t', true);
\echo '== replies: topic author + topic followers, grouped per topic while unread'
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000002',false);
select public.forum_reply(:'t', 'Bence yüksek pres.') is not null as r1;
select public.forum_reply(:'t', 'Ek olarak: bekler içeride.') is not null as r2;
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000003',false);
select public.forum_reply(:'t', 'Blok savunma daha güvenli.') is not null as r3;
\echo '== quote + mention of the same member -> one quote row; mention of another member -> mention row'
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000002',false);
select public.forum_reply(:'t', '@ayse_gs haklısın, @cem_gs katılmıyorum.', :'opening') as quoting \gset
reset role;
select p.username, n.kind, n.actor_count, a.username as last_actor, n.data->>'topic_title' as topic, n.post_id = :'quoting' as is_quoting_post
  from public.notifications n join public.profiles p on p.id = n.user_id left join public.profiles a on a.id = n.actor_id
 order by 1, 2;

\echo '== likes grouped, re-like does not inflate the count'
set role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000003',false);
select public.forum_set_like(:'opening', true);
select public.forum_set_like(:'opening', false);
select public.forum_set_like(:'opening', true);
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000002',false);
select public.forum_set_like(:'opening', true);
\echo '== follow notifies once even after unfollow/refollow'
select public.set_follow('user','ayse_gs',true);
select public.set_follow('user','ayse_gs',false);
select public.set_follow('user','ayse_gs',true);
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000001',false);
select kind, actor_count from public.notifications where kind in ('like', 'follow') order by kind;

\echo '== isolation and write protection'
\set ON_ERROR_STOP 0
insert into public.notifications (user_id, kind, dedupe_key) values ('cccccccc-0000-0000-0000-000000000001','badge','x');
\set ON_ERROR_STOP 1
select count(*) filter (where user_id <> auth.uid()) as foreign_rows_visible, count(*) as own_rows from public.notifications;

\echo '== read state'
select public.unread_notification_count() as unread_before;
select public.mark_notifications_read(array[(select id from public.notifications where kind = 'like')]) as marked_one;
select public.unread_notification_count() as unread_after_one;
select public.mark_notifications_read() as marked_rest;
select public.unread_notification_count() as unread_after_all;
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000003',false);
select public.forum_reply(:'t', 'Yeni bir yanıt, okunduktan sonra.') is not null as r5;
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000001',false);
select kind, actor_count, read_at is null as unread from public.notifications where kind = 'reply' order by created_at;

\echo '== settings'
select * from public.get_notification_settings();
select public.set_notification_setting('like', false, false);
select public.set_notification_setting('mention', false, true);
\set ON_ERROR_STOP 0
select public.set_notification_setting('nope', true, true);
\set ON_ERROR_STOP 1
select grp, in_app, push from public.get_notification_settings() where grp in ('like', 'mention');
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000003',false);
select public.forum_reply(:'t', 'Beğeni kapalıyken @ayse_gs anılıyor.') as p6 \gset
select public.forum_set_like(:'p6', true);
select public.forum_set_like((select id from public.posts where topic_id = :'t' and author_id = 'cccccccc-0000-0000-0000-000000000001' limit 1), true);
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000001',false);
select count(*) filter (where kind = 'mention' and read_at is null) as new_mentions, count(*) filter (where kind = 'like' and read_at is null) as new_likes
  from public.notifications;
\echo '   (mention off -> the post still arrives as part of the grouped reply row)'
select kind, actor_count, post_id = :'p6' as latest_is_p6, read_at is null as unread from public.notifications where read_at is null order by kind;

\echo '== community: meetup join and cancel'
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000002',false);
select public.create_meetup('Derbi öncesi Kadıköy buluşması','Birlikte yürüyelim.', now() + interval '2 days','İstanbul','Rıhtım') as m \gset
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000003',false);
select public.set_meetup_attendance(:'m', true) as joined;
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000002',false);
select kind, actor_count, data->>'meetup_title' as title from public.notifications where kind like 'meetup%';
select public.cancel_meetup(:'m');
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000003',false);
select kind, data->>'meetup_title' as title from public.notifications where kind like 'meetup%';

\echo '== match fan-out respects the match group setting (cem turns it off)'
select public.set_notification_setting('match', false, false);
reset role;
insert into public.matches (id, competition, home_team, away_team, kickoff_at, created_by)
values ('dddddddd-0000-0000-0000-000000000001','Süper Lig','Galatasaray','Trabzonspor', now(), 'cccccccc-0000-0000-0000-000000000002');
update public.matches set status = 'live', minute = 1, home_score = 0, away_score = 0 where id = 'dddddddd-0000-0000-0000-000000000001';
insert into public.match_events (match_id, minute, type, side, player) values ('dddddddd-0000-0000-0000-000000000001', 23, 'goal', 'home', 'Icardi');
insert into public.match_events (match_id, minute, type, side) values ('dddddddd-0000-0000-0000-000000000001', 30, 'yellow', 'away');
update public.matches set status = 'finished', home_score = 1, away_score = 0 where id = 'dddddddd-0000-0000-0000-000000000001';
select p.username, n.kind, n.data->>'match_title' as match, n.data->>'player' as player, n.data->>'home_score' as hs
  from public.notifications n join public.profiles p on p.id = n.user_id where n.kind like 'match%' order by 1, n.created_at, 2;

\echo '== push outbox'
set role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000001',false);
\set ON_ERROR_STOP 0
select public.register_push_token('not-a-token','ios');
\set ON_ERROR_STOP 1
select public.register_push_token('ExponentPushToken[abcdefghij123456]','ios');
select public.register_push_token('ExponentPushToken[abcdefghij123456]','ios');
\set ON_ERROR_STOP 0
select * from public.claim_push_batch(10);
select * from public.push_tokens;
\set ON_ERROR_STOP 1
reset role;
select p.username, n.push_status, count(*) from public.notifications n join public.profiles p on p.id = n.user_id group by 1, 2 order by 1, 2;
set role service_role;
select kind, actor_username, tokens from public.claim_push_batch(50) order by kind;
reset role;
select p.username, n.push_status, count(*) from public.notifications n join public.profiles p on p.id = n.user_id group by 1, 2 order by 1, 2;
set role service_role;
select public.disable_push_tokens(array['ExponentPushToken[abcdefghij123456]']) as disabled;
reset role;

\echo '== account deletion removes inbox, settings and tokens'
set role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000001',false);
select public.delete_my_account();
reset role;
select (select count(*) from public.notifications where user_id = 'cccccccc-0000-0000-0000-000000000001') as inbox_left,
       (select count(*) from public.notification_settings where user_id = 'cccccccc-0000-0000-0000-000000000001') as settings_left,
       (select count(*) from public.push_tokens where user_id = 'cccccccc-0000-0000-0000-000000000001') as tokens_left;
