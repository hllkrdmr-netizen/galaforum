# GalaForum — Roadmap & known limitations

## Done (Phase 0–6)
- Phase 0: audit (see `AUDIT.md`)
- Phase 1: Expo Router tabs + stack, design tokens, typography scale, UI kit, responsive container, data layer
  (`ForumRepository` with demo + Supabase implementations), core Supabase schema with RLS
- Phase 2: unified hero with the lion, GalaForum / DAİMA GALATASARAY, search, Son Mesaj (real latest post),
  Konu Aç, 11 categories with stats, Gündem list; category, topic, search and create-topic screens (baseline)

- Phase 3: replying, linked quotes, likes, @mentions, private reports, optional single-choice polls and paged posts.
  See `PHASE3.md` for migration, validation and operating notes.
- Phase 4: Supabase e-mail auth (sign-up, verification, sign-in, reset, sessions, sign-out, account deletion),
  public profiles, ranked full-text search with category/member/date filters and sorting. See `PHASE4.md`.
- Phase 5: match hub with countdown, live match room (score, minute, events, reactions, match topic), lineup
  builder with drag-and-drop and sharing, selective realtime. See `PHASE5.md`.
- UX simplification pass (see `UX-SADELESTIRME.md`).
- Phase 6: profiles (bio, city, favourite category, level), follows (users/topics/categories), automatic badges,
  meetups with city filter, capacity and map preview, community hub. See `PHASE6.md`.

## Known limitations
- **Dependencies not yet added:** `@tanstack/react-query`, `zustand`, `eslint`/`eslint-config-expo`,
  `jest`/`jest-expo` were not added in the original build environment (npm registry blocked). The Phase 3 local `npm install` succeeded; no additional application dependencies were needed. `hooks/useForumQuery`
  is a small stand-in with the same responsibilities (cache, de-dupe, stale time, invalidation). Replace it with
  TanStack Query when running `npm install` locally is possible; lint is not configured yet.
- **Search:** ranked (Turkish full-text + trigram) with filters since Phase 4; results are capped at 50 per type
  and not paginated yet.
- **Auth:** e-mail only; Apple/Google sign-in not added yet. Live e-mail flows need verification against the real
  Supabase project (redirect URLs must be configured, see `PHASE4.md`).
- **Fonts:** system font stacks (condensed display on Android/web fallbacks). A licensed display font can be
  dropped in via `expo-font` later.
- Demo interactions are session-only; accounts are disabled in demo mode.

## Next
- Phase 7 — Notifications (in-app + Expo push foundations, preferences)
- Phase 8 — Moderation roles, tools and audit logs
- Phase 9 — QA/release
