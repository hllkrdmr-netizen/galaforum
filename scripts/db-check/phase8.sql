-- Phase 8 behaviour checks. Expected errors (13, in order): member mod_report_queue not_allowed, use_topic_hide,
-- nothing_to_do (remove twice), invalid_reason (hide without reason), reply to hidden topic (topic_not_found),
-- direct topic update denied, muted reply, banned like, sanction staff not_allowed, moderator mod_set_role
-- not_allowed, admin own role not_allowed, self_block, banned follow.
\set ON_ERROR_STOP 1
\pset footer off
insert into auth.users (id, email, raw_user_meta_data) values
 ('eeeeeeee-0000-0000-0000-00000000000a','a@x.com','{"username":"admin_gs"}'),
 ('eeeeeeee-0000-0000-0000-00000000000b','m@x.com','{"username":"mod_gs"}'),
 ('eeeeeeee-0000-0000-0000-000000000001','u1@x.com','{"username":"uye_bir"}'),
 ('eeeeeeee-0000-0000-0000-000000000002','u2@x.com','{"username":"uye_iki"}');
update public.profiles set role = 'admin' where username = 'admin_gs';
update public.profiles set role = 'moderator' where username = 'mod_gs';
delete from public.notifications;

set role authenticated;
select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
select public.forum_create_topic('serbest','Moderasyon deneme konusu','Açılış mesajı burada.') as t \gset
select id as opening from public.posts where topic_id = :'t' and is_opening_post \gset
select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000002',false);
select public.forum_reply(:'t', 'Kurallara aykırı bir yanıt.') as p \gset
select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
select public.forum_report(:'p', 'Hakaret içeriyor.');
\echo '== members cannot open the queue'
\set ON_ERROR_STOP 0
select public.mod_report_queue();
\set ON_ERROR_STOP 1

\echo '== queue, dismiss, re-report reopens'
select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-00000000000b',false);
select public.mod_open_report_count() as open_cases;
select jsonb_array_length(public.mod_report_queue('open')) as open_rows,
       public.mod_report_queue('open') -> 0 ->> 'reportCount' as reports,
       public.mod_report_queue('open') -> 0 -> 'author' ->> 'username' as author;
select public.mod_dismiss_reports(:'p', 'Eleştiri, hakaret değil.') as dismissed;
select jsonb_array_length(public.mod_report_queue('open')) as open_after, public.mod_report_queue('closed') -> 0 ->> 'status' as closed_status;
select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
select public.forum_report(:'p', 'Tekrar bakın: kişisel saldırı var.');
select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-00000000000b',false);
select public.mod_open_report_count() as reopened;

\echo '== remove / restore a post'
\set ON_ERROR_STOP 0
select public.mod_remove_post(:'opening', 'Açılış mesajı kaldırılamaz');
\set ON_ERROR_STOP 1
select public.mod_remove_post(:'p', 'Kişisel saldırı (kural 2).');
\set ON_ERROR_STOP 0
select public.mod_remove_post(:'p', 'Kişisel saldırı (kural 2).');
\set ON_ERROR_STOP 1
reset role; set role anon; select set_config('request.jwt.claim.sub','',false);
select count(*) as anon_sees_removed from public.posts where id = :'p';
select reply_count from public.topics where id = :'t';
reset role;
select status, note from public.post_reports where post_id = :'p';
select p.username, n.kind, n.actor_id is null as anonymous_actor, n.data ->> 'action' as action, n.data ->> 'reason' as reason
  from public.notifications n join public.profiles p on p.id = n.user_id where n.kind = 'moderation';
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-00000000000b',false);
select public.mod_restore_post(:'p', 'İtiraz kabul edildi.');
select reply_count from public.topics where id = :'t';

\echo '== topic flags: pin, lock, move, hide'
select public.mod_set_topic_flag(:'t', 'pinned', true);
select public.mod_set_topic_flag(:'t', 'locked', true);
select public.mod_move_topic(:'t', 'mac-taktik', 'Doğru kategori');
\set ON_ERROR_STOP 0
select public.mod_set_topic_flag(:'t', 'hidden', true, '');
\set ON_ERROR_STOP 1
select public.mod_set_topic_flag(:'t', 'locked', false);
select public.mod_set_topic_flag(:'t', 'hidden', true, 'Spam konu');
reset role; set role anon; select set_config('request.jwt.claim.sub','',false);
select count(*) as anon_sees_hidden_topic from public.topics where id = :'t';
select count(*) as anon_sees_hidden_posts from public.posts where topic_id = :'t';
select (public.forum_profile('uye_bir') ->> 'topicCount') as profile_topic_count;
reset role; set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000002',false);
\set ON_ERROR_STOP 0
select public.forum_reply(:'t', 'Gizli konuya yanıt.');
\set ON_ERROR_STOP 1
select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-00000000000b',false);
select jsonb_array_length(public.mod_hidden_topics()) as hidden_list;
\set ON_ERROR_STOP 0
update public.topics set is_pinned = false where id = :'t';
\set ON_ERROR_STOP 1
select public.mod_set_topic_flag(:'t', 'hidden', false);
reset role;
select is_pinned, is_locked, (select slug from public.categories where id = category_id) as category, hidden_at is null as visible from public.topics where id = :'t';

\echo '== sanctions'
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-00000000000b',false);
select public.mod_sanction('uye_iki', 'mute', 24, 'Tekrarlayan hakaret') is not null as muted;
select public.mod_sanction('uye_bir', 'ban', null, 'Spam hesap') as ban_id \gset
select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000002',false);
select public.my_restriction() ->> 'kind' as my_kind, (public.my_restriction() ->> 'endsAt') is not null as has_end;
\set ON_ERROR_STOP 0
select public.forum_reply(:'t', 'Susturulmuşken yazıyorum.');
\set ON_ERROR_STOP 1
select 'ok' as muted_can_like from public.forum_set_like(:'opening', true);
select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
\set ON_ERROR_STOP 0
select public.forum_set_like(:'p', true);
\set ON_ERROR_STOP 1
select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-00000000000b',false);
\set ON_ERROR_STOP 0
select public.mod_sanction('admin_gs', 'mute', 1, 'Deneme amaçlı');
select public.mod_set_role('uye_iki', 'verified');
\set ON_ERROR_STOP 1
select public.mod_member('uye_iki') -> 'activeSanction' ->> 'kind' as member_active, jsonb_array_length(public.mod_member('uye_iki') -> 'sanctions') as history;
select public.mod_revoke_sanction(:'ban_id', 'Hesap doğrulandı');
select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
select 'ok' as unbanned_can_like from public.forum_set_like(:'p', true);

\echo '== roles (admin only, never own role)'
select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-00000000000a',false);
select public.mod_set_role('uye_bir', 'verified');
\set ON_ERROR_STOP 0
select public.mod_set_role('admin_gs', 'user');
\set ON_ERROR_STOP 1
reset role;
select username, role from public.profiles where username in ('uye_bir', 'admin_gs') order by 1;

\echo '== member blocks'
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000002',false);
select public.set_follow('user', 'uye_bir', true);
select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
select public.set_block('uye_iki', true);
\set ON_ERROR_STOP 0
select public.set_block('uye_bir', true);
\set ON_ERROR_STOP 1
select public.my_blocks() -> 0 ->> 'username' as blocked;
reset role;
select count(*) as follows_between from public.user_follows
 where follower_id = 'eeeeeeee-0000-0000-0000-000000000002' and followee_id = 'eeeeeeee-0000-0000-0000-000000000001';
delete from public.notifications;
update public.user_sanctions set revoked_at = now() where user_id = 'eeeeeeee-0000-0000-0000-000000000002';
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000002',false);
select public.forum_reply(:'t', '@uye_bir engellendikten sonra yazıyorum.') is not null as replied;
reset role;
select count(*) as notifications_from_blocked from public.notifications where user_id = 'eeeeeeee-0000-0000-0000-000000000001';

\echo '== audit log is staff-only'
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
select count(*) as member_log_rows from public.moderation_log;
select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-00000000000b',false);
select e ->> 'action' as action, e -> 'actor' ->> 'username' as actor, e ->> 'targetLabel' as target
  from jsonb_array_elements(public.mod_log()) e order by (e ->> 'id')::bigint;

\echo '== banned members cannot follow; deletion removes blocks'
select public.mod_sanction('uye_iki', 'ban', 1, 'Kısa süreli yasak');
select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000002',false);
\set ON_ERROR_STOP 0
select public.set_follow('category', 'transfer', true);
\set ON_ERROR_STOP 1
select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
select public.delete_my_account();
reset role;
select count(*) as blocks_left from public.user_blocks;
