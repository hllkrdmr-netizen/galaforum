# GalaForum — Roadmap & known limitations

## Done (Phase 0–3)
- Phase 0: audit (see `AUDIT.md`)
- Phase 1: Expo Router tabs + stack, design tokens, typography scale, UI kit, responsive container, data layer
  (`ForumRepository` with demo + Supabase implementations), core Supabase schema with RLS
- Phase 2: unified hero with the lion, GalaForum / DAİMA GALATASARAY, search, Son Mesaj (real latest post),
  Konu Aç, 11 categories with stats, Gündem list; category, topic, search and create-topic screens (baseline)

- Phase 3: replying, linked quotes, likes, @mentions, private reports, optional single-choice polls and paged posts.
  See `PHASE3.md` for migration, validation and operating notes.

## Known limitations
- **Dependencies not yet added:** `@tanstack/react-query`, `zustand`, `eslint`/`eslint-config-expo`,
  `jest`/`jest-expo` were not added in the original build environment (npm registry blocked). The Phase 3 local `npm install` succeeded; no additional application dependencies were needed. `hooks/useForumQuery`
  is a small stand-in with the same responsibilities (cache, de-dupe, stale time, invalidation). Replace it with
  TanStack Query when running `npm install` locally is possible; lint is not configured yet.
- **Search:** demo mode searches titles, post bodies, categories and usernames. Supabase mode uses `ILIKE`
  (backed by `pg_trgm` GIN indexes) — no ranking, date/category/user filters yet.
- **Auth:** not implemented yet (Phase 4). In Supabase mode, creating a topic requires a session and shows a clear
  message otherwise.
- **Fonts:** system font stacks (condensed display on Android/web fallbacks). A licensed display font can be
  dropped in via `expo-font` later.
- Demo interactions are session-only. Supabase interactions require an authenticated session; the login UI remains Phase 4.

## Next
- Phase 4 — Supabase Auth (email sign-up/login/verification/reset, sessions, account deletion), profiles, real search
- Phase 5 — Match hub, countdown, live match room, lineup builder
- Phase 6 — Community: profiles, follows, badges, meetups + map
- Phase 7 — Notifications (in-app + Expo push foundations, preferences)
- Phase 8 — Moderation roles, tools and audit logs
- Phase 9 — QA/release
