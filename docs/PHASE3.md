# Phase 3 delivery — 2026-09-27

## Implemented

- Replies update topic reply counts, latest activity, category totals, search and Son Mesaj. Empty/oversize replies and locked topics are rejected.
- Quotes store a reference to a visible post in the same topic and render its author/body. Deleted quotes are hidden in Supabase.
- Likes use idempotent set/unset operations and unique post/user keys.
- @mentions resolve existing usernames, deduplicate references, persist through a database trigger, and link highlighted names to the existing member search. Email addresses and unknown users are not treated as resolved mentions.
- Reporting accepts a 5–1000 character reason. A member has one report per post; resubmission updates its reason. Reports are visible only to their author or staff.
- Optional polls are created atomically with topics, with 2–6 distinct options. Each member has one vote, can change it, and cannot vote on a locked topic. Public results expose totals, not voter identities.
- Topic posts use 20-item pages, chronological ordering and a next-page sentinel instead of the old 200-post ceiling.
- All controls use the existing burgundy/gold tokens, screens, navigation and repository selection. Expo 57, strict TypeScript and application dependencies are unchanged.

## Database setup

Apply `supabase/migrations/20260927120000_forum_core.sql` first on a fresh database, then `supabase/migrations/20260927180000_forum_interactions.sql`. On an existing Phase 2 database, apply only the latter, once, using the normal migration workflow. It runs in a transaction and does not replace existing content.

New tables: post_likes, post_mentions, post_reports, polls, poll_options, poll_votes; posts gains quote_post_id. All new tables have RLS. Writes use authenticated RPCs with server-owned user identity. Direct post inserts are revoked in favor of forum_reply, which serializes against topic locking. Existing create_topic remains compatible; forum_create_topic wraps it for atomic poll creation. Public reads use a bounded post-page RPC and an aggregate poll RPC. Explicit function grants prevent anonymous mutations.

The app uses demo mode when Supabase variables are absent. With variables configured, apply both migrations and provide an authenticated Supabase session for mutations. Authentication screens remain Phase 4, as before.

## Validation

- Local `npm install`: succeeded, 616 packages; generated package-lock.json. No new application dependencies.
- `npm run typecheck`: app and tests pass strict `tsc --noEmit`.
- `npm test`: 23 Node built-in tests pass, including 206-post pagination and demo/Supabase mutation contracts.
- `expo export --platform web`: passes.
- `expo export --platform ios --platform android`: both native JS/Hermes bundles pass. No device binaries were built.
- ESLint is absent after installation, so lint was not run.
- Both unmodified SQL migrations were executed in isolated PGlite PostgreSQL with pg_trgm and emulated Supabase auth roles. Checks cover replies, mentions, quotes, idempotent likes, vote replacement, report privacy, anonymous denial, direct-write denial, profile-role protection, locked topics, deleted quotes, and transactional rollback of invalid polls.
- Reproduce the optional isolated database check by installing `@electric-sql/pglite` outside the app, setting `PGLITE_DIST` to its absolute `dist` directory, and running `node scripts/check-phase3-db.mjs` from the repo. This runtime is not an application or npm-test dependency.
- Browser demo smoke check: home/categories/navigation present; topic+poll creation, voting and vote changes, liking, quoted reply with linked mention, report confirmation; no browser console errors.

## Limits

- Demo data and interactions reset on reload. Reports do not contact real moderators in demo mode.
- A hosted Supabase project was not configured or modified; production Auth/PostgREST integration still needs verification against the configured project.
- Mention notifications are Phase 7; moderation queue UI is Phase 8. Staff can already read reports through RLS.
- Polls are single-choice, with vote changes allowed; topic locking closes voting. Scheduled poll expiry and multi-select polls are not included.
- Offset pagination is deterministic for a static dataset; concurrent moderation deletions can shift later page offsets.
- npm install reported 14 moderate dependency advisories. No forced dependency upgrades were applied, preserving the requested Expo 57 package set.
