# GalaForum

**DAİMA GALATASARAY** — premium, forum-first Galatasaray supporter platform.
Classic forum depth + modern mobile UX. Independent fan platform; not an official club channel.

## Stack

- Expo SDK 57 · React Native 0.86 · Expo Router (file-based routing)
- TypeScript (strict)
- Supabase (Postgres + Auth + RLS) — optional at this stage; the app runs on an in-memory demo data source when not configured
- `@expo/vector-icons` (Ionicons), `expo-linear-gradient`

## Getting started

```bash
npm install
cp .env.example .env        # optional: fill in Supabase URL + anon key
npm run web                 # or: npm run ios / npm run android
```

Without `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` the app runs in **demo mode**
(sample members and discussions, labelled "Demo" in the UI). New topics created in demo mode live only
for the current session.

### Supabase

Apply `supabase/migrations/*.sql` to your project (`supabase db push` or the SQL editor). The migration
creates the whole schema (forum, auth profiles, match centre, community, notifications, moderation), seeds the
12 categories and badges, and enables RLS on every table. **Never** put the service-role key in the client or in `.env` files used by Expo.

Authentication (Phase 4) uses Supabase e-mail auth with PKCE. Add `galaforum://auth-callback` and your web
origin + `/auth-callback` to *Authentication → URL Configuration → Redirect URLs*; see `docs/PHASE4.md`.

To verify migrations locally on plain PostgreSQL 16:
`psql -f scripts/db-check/supabase-shim.sql`, apply `supabase/migrations/*.sql` in order, then run
`scripts/db-check/phase4.sql` … `phase8.sql` and the release gate `scripts/db-check/release.sql`.

**Before publishing:** follow `docs/RELEASE.md` (Supabase settings, environment variables, legal review,
store privacy answers, manual test plan).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` for the app and the tests |
| `npm test` | Unit tests with Node's built-in test runner |
| `npm run export:web` | Production web export (`expo export --platform web`) |
| `python scripts/qa/web_smoke.py <web-export>` | Web smoke test: every route at phone/desktop width + main demo flows |

## Structure

```
app/                   Expo Router routes
  (tabs)/              Gündem (home), Maç, Transfer, Topluluk, Daha
  kategori/, konu/     Category lists, topic detail; konu-ac (create), ara (search)
  mac/, ilk-11         Live match room, lineup builder
  bulusma*/, takip     Meetups, follows and blocks
  uye/, hesap, giris…  Profiles, account and auth screens
  bildirim*            Notification inbox and preferences
  moderasyon/          Staff panel and member review
  bilgi/[sayfa]        Community rules, terms, privacy (KVKK)
components/ui          Design-system primitives
constants/             Design tokens (theme.ts) and the 12 categories
features/              Feature modules (home, forum, match, community, notifications, moderation, auth, app)
hooks/                 Query cache, auth-aware hooks (follows, notifications, moderation)
lib/                   Pure logic: formatting, search, match, meetups, notifications, moderation, legal, push
services/*/            Repository interfaces with demo and Supabase implementations
supabase/migrations    Database schema, RLS policies, RPCs, triggers, seed
scripts/db-check       Local PostgreSQL verification scripts (per phase + release gate)
scripts/qa             Web smoke test
docs/                  Audit, roadmap, phase notes (PHASE3–8), UX pass, RELEASE checklist
```
