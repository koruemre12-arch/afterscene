# Decisions log

Reasonable assumptions made while building afterscene, in the order they came up.
Each entry: **what** was decided, **why**, and what would change it.

## Platform & tooling

1. **Next.js 15.5 + React 19, Tailwind v4, TypeScript 5.9 (strict + `noUncheckedIndexedAccess`).**
   Latest majors at build time were Next 16 / TS 7 / ESLint 10; the brief pins Next 15, and TS 7 (Go port)
   and ESLint 10 are not yet supported by `eslint-config-next@15`. Pinned conservatively.
2. **Vitest 3 / jsdom-free tests** — Vitest 5 needs Node ≥ 20.19/22; the dev machine runs Node 20.17.
3. **`next/og` instead of importing `@vercel/og` directly.** `next/og` *is* `@vercel/og`, bundled by Next;
   importing the package separately would ship two copies.
4. **Brand assets are generated from code** (`pnpm brand:generate`): the wordmark is Sora 600 converted to
   outlines with opentype.js, so logos render identically without the font installed. Output lives in
   `public/brand`, `public/icons`, `favicon.ico`, and `src/components/brand/brand-paths.ts`.
5. **TMDB attribution logo** is TMDB's official "blue short" SVG (downloaded from their logo page),
   rendered smaller and dimmer than the afterscene logo, as their terms require.

## Routing & i18n

6. **Locale is never in the URL** (`next-intl` with `localePrefix: "never"`). The brief's page map has no
   locale segment. Middleware resolves `NEXT_LOCALE` cookie → `Accept-Language` → `en`, and rewrites to
   `/[locale]/…` internally, which keeps pages statically renderable (ISR) per locale.
7. **Messages are split per feature** (`messages/<locale>/<area>.json`) and typed from the English files, so a
   missing key is a compile error; `tests/i18n.test.ts` asserts EN and TR have identical key sets.
8. The TMDB notice is shown translated in Turkish UI; `/about` shows the exact English sentence as well.

## Security

9. **CSP uses `'unsafe-inline'` for scripts.** Nonce-based CSP forces every route to render dynamically,
   which would defeat ISR for title pages. Everything else is locked down (frames only from
   `youtube-nocookie.com` and `open.spotify.com`, images only from TMDB/Supabase/YouTube thumbnails).
10. **Access gating lives in three layers**: middleware (redirects, using `app_metadata` claims in the JWT),
    server components (re-check), and Postgres (`can_write()` in every write policy — suspended users and,
    in private beta, users without a redeemed invite cannot write even via the REST API directly).

## Database & API

11. **All migrations are verified in-process with PGlite** (Postgres 17 in WASM) plus a tiny Supabase
    shim (`tests/db/harness.ts`: roles, `auth.uid()`, storage schema, realtime publication). This runs RLS
    policies and RPCs for real in Vitest without Docker. `pnpm db:gen-types` introspects the same database
    to emit `database.types.ts` in `supabase gen types` format; the official CLI (`pnpm db:types`) remains
    available when a local stack is running.
12. **Custom SQLSTATEs** raised by RPCs map to stable action error codes (`src/lib/actions.ts`):
    `P0401` unauthenticated · `P0403` forbidden/blocked · `P0404` not found · `P0402` Plus required /
    free-plan limit · `P0409` conflict · `P0410` closed · `P0422` validation · `P0425` not ready ·
    `P0429` rate limited.
13. **Privacy model**: profile *identity* (username, avatar) is always visible so names can render in
    communities; *content* (ratings, reviews, diary, lists, activity) follows the profile visibility
    (`public` / `followers` / `private` = only me), and "hide watch history" additionally hides tracking.
14. **Sensitive per-user fields live in `user_settings`** (owner-only RLS) rather than column grants on
    `profiles`, because PostgREST `select=*` fails on tables with column-level SELECT restrictions.
    Column-level *UPDATE* grants are used freely (they don't affect reads).
15. **Invite codes are consumed inside the `auth.users` insert trigger** when passed as sign-up metadata,
    so e-mail sign-ups (which have no session until confirmation) still redeem atomically. OAuth sign-ups
    park the code in a short-lived httpOnly cookie that `/auth/callback` applies.
16. **Public mode needs no DB change**: when `NEXT_PUBLIC_APP_MODE=public`, the auth callback / invite page
    grant `beta_access` automatically, the middleware stops requiring the claim, and catalog pages open up.
17. **XP is capped per kind per day** (`app_config.xp_daily_caps`) and deduplicated per `(kind, ref)`, all
    inside `award_xp()`; clients can't write `xp_events` or profile XP.

## Communities & the spoiler lock

18. **Scopes are assigned by the server, never the client.** General channels stamp the author's own
    furthest episode; episode rooms stamp the room's episode (even when the author is behind); thread
    comments are never scoped below their thread. A completed viewer's message is scoped to the last
    *aired* episode (not "infinity") so caught-up readers aren't locked out. Films collapse to S1E1 =
    "has watched the film". Direct INSERT/UPDATE on messages/posts/comments is revoked.
19. **Masking happens in Postgres** (`message_json`, `post_json`, `get_post_comments`) and RLS mirrors the
    same rule (`spoiler_ok`) for direct selects, so a locked text never appears in any response. Realtime
    uses a separate `channel_events` table that carries ids only; clients re-read through the masking RPC.
    Notifications for mentions/replies never include message text.
20. **"Show anyway" is per item and logged** (`spoiler_reveals` stores reader progress vs. scope).
21. **Helper functions that take a user id answer only for the caller** (`may_inspect`): RLS needs them
    executable, so a direct RPC with someone else's id returns a neutral value instead of leaking private
    progress, blocks or memberships. Internal code uses `*_internal` variants clients can't execute.
22. **Official communities are created lazily** (first visit from a title page) and are always public;
    posting in an official/public community joins you automatically. Episode rooms are created on first
    visit and open on the episode's air date.
23. **Chat uses a virtualized list** (@tanstack/react-virtual) with bottom anchoring and prepend-on-scroll;
    typing indicators and online counts go over Realtime broadcast/presence and carry no content.
