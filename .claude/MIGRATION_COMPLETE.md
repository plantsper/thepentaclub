# Project Status — Complete ✅

## Phase 1: TypeScript Migration ✅

Successfully migrated from a single-file HTML/JS app to a fully modularized TypeScript + Vite project.

- ✅ npm package initialized
- ✅ TypeScript (strict mode) + Vite configured
- ✅ 30+ modular TypeScript and CSS files
- ✅ All types and interfaces defined
- ✅ All components, models, services extracted
- ✅ Hash-based SPA routing
- ✅ Component base class with lifecycle hooks
- ✅ EventEmitter for cross-component communication

---

## Phase 2: Card Lightbox ✅

**Component**: `src/components/shared/CardLightboxComponent.ts`
**Styles**: `src/styles/components/lightbox.css`

- Mounted once globally in App.ts
- Listens for `card:open` events via EventEmitter
- Two-panel layout: art panel (left) + detail panel (right)
- Stat labels use Riftbound terminology: **Power**, **Health**, **Energy**
- Rarity color driven by `card.rarity.colorHex` (DB-sourced, not hardcoded)
- Close: backdrop click, X button, or Escape key
- Smooth `opacity` + `scale/translateY` animation
- Mobile: collapses to bottom sheet

---

## Phase 3: Supabase Integration ✅

### Database
- **Platform**: Supabase (PostgreSQL + PostgREST REST API)
- **CMS**: Admin page at `#/admin` + Supabase Studio as fallback

**Migrations:**
| File | Purpose |
|---|---|
| `supabase/migrations/001_create_cards_table.sql` | Creates `cards` table with RLS |
| `supabase/migrations/002_seed_cards.sql` | Seeds 16 sample cards |
| `supabase/migrations/003_add_art_url.sql` | Adds `art_url` column + `card-art` storage bucket |
| `supabase/migrations/004_relational_schema.sql` | Relational schema (see Phase 7) |

### CardService (`src/services/CardService.ts`)
- Uses shared `getSupabaseClient()` singleton
- Nested select: cards + rarities + sets + tags in one query
- Maps snake_case DB rows → TypeScript camelCase objects
- `art_url` null → undefined

### Async App Init (`src/App.ts`)
- `fetchCards()` and `getSession()` run in parallel via `Promise.all`
- On Supabase error → falls back to `createSampleCards()`
- Full app skeleton built after cards are loaded

---

## Phase 4: Card Image Hosting ✅

- `ICard` has `artUrl?: string`
- All card renders: `<img>` when `artUrl` set, CSS gradient div as fallback
- Hover zoom applied to both image and gradient art
- **Recommended size**: 1040 × 1460 px (`object-fit: cover; object-position: center top`)

---

## Phase 5: Bug Fixes ✅

### Fix 1 — `import.meta.env` not typed
Added `"types": ["vite/client"]` to `tsconfig.json`.

### Fix 2 — Env vars not found at build time
Added `envDir: '../'` to `vite.config.ts`. Without this, Vite looks for `.env.local` inside `./src` (the `root`), finds nothing, statically replaces env vars with `undefined`, and Rollup dead-code-eliminates the entire Supabase import (bundle drops from 212 kB to 28 kB).

### Fix 3 — Supabase crashes before App.ts try/catch
Moved `createClient()` into a lazy singleton (`supabaseClient.ts`) so it throws inside the App's try/catch rather than at module load time.

---

## Phase 6: Auth System ✅

### New Files
| File | Purpose |
|---|---|
| `src/services/supabaseClient.ts` | Lazy singleton — one client instance shared by all services |
| `src/services/AuthService.ts` | `signIn`, `signOut`, `sendPasswordReset`, `updatePassword`, `getSession`, `onAuthStateChange` |
| `src/components/pages/LoginPageComponent.ts` | Email/password login + forgot password toggle |
| `src/components/pages/ResetPasswordPageComponent.ts` | Set new password (handles Supabase recovery link) |
| `src/components/pages/AdminPageComponent.ts` | Full card CMS with lookup management and tags |
| `src/styles/components/auth.css` | Auth page/card/form/button/feedback styles |
| `src/styles/components/admin.css` | Admin layout, table, form, lookup chips, tag checkboxes |

### Updated Files
| File | Change |
|---|---|
| `src/App.ts` | Auth state tracking, `onAuthStateChange` listener, 3 new routes, nav remount on auth change |
| `src/components/layout/NavComponent.ts` | Accepts `isLoggedIn` + `onLogout`; renders Admin/Logout or subtle Admin link |
| `src/styles/components/nav.css` | Added `.nav__cta--outline`, `.nav__link--muted` |
| `src/styles/main.css` | Imports `auth.css`, `admin.css` |

### Routes Added
| Route | Behaviour |
|---|---|
| `#/login` | Login + forgot password; redirects to `/admin` if already logged in |
| `#/admin` | Admin CMS; redirects to `/login` if no session |
| `#/reset-password` | Triggered automatically by `PASSWORD_RECOVERY` auth event |

### Forgot Password Flow
1. User clicks "Forgot password?" on login page
2. Enters email → `sendPasswordReset(email)` called
3. Supabase emails a recovery link pointing back to the app origin
4. User clicks link → lands on app with recovery tokens in URL hash
5. Supabase client detects tokens → fires `PASSWORD_RECOVERY` via `onAuthStateChange`
6. App navigates to `#/reset-password`
7. User enters + confirms new password → `updatePassword(newPassword)` called

### Admin Account Setup
No public sign-up. Create admin accounts via: Supabase dashboard → Authentication → Users → Add user.

---

## Phase 7: Relational Schema ✅

### What Changed
`rarity` and `set_name` were plain `TEXT` columns with CHECK constraints, duplicated in TypeScript union types and hardcoded in multiple components. Now they are proper relational tables with metadata.

### New Tables
| Table | Columns |
|---|---|
| `card_rarities` | `id`, `name`, `sort_order`, `color_hex` |
| `card_sets` | `id`, `name`, `slug`, `released`, `description` |
| `tags` | `id`, `name` |
| `card_tags` | `card_id` (FK), `tag_id` (FK) — junction table |

### cards Table Changes
- Dropped: `rarity TEXT`, `set_name TEXT` (with CHECK constraints)
- Added: `rarity_id INTEGER REFERENCES card_rarities(id)`, `set_id INTEGER REFERENCES card_sets(id)`
- Migration backfills FKs from old string values before dropping columns

### TypeScript Impact
- Removed: `CardRarity` union, `CardSet` union
- Added: `IRarity`, `ICardSet`, `ITag` interfaces
- `ICard.rarity`: `string` → `IRarity`
- `ICard.set`: `string` → `ICardSet`
- `ICard.tags`: new `ITag[]`
- `ICardCollection.filterByRarity`: `CardRarity | 'all'` → `string | 'all'`

### Component Impact
| Component | Change |
|---|---|
| `CardGridComponent` | `card.rarity` → `card.rarity.name`, `card.set` → `card.set.name` |
| `CardsPageComponent` | Same + filter buttons dynamically derived from `rarity.sortOrder` |
| `CardLightboxComponent` | Same + `card.rarity.colorHex` replaces hardcoded color lookup |
| `AdminPageComponent` | Fetches rarities/sets/tags from DB; form selects are DB-driven; tag checkboxes; set/tag CRUD |
| `sampleData.ts` | `RARITIES` and `SETS` as typed objects matching the interfaces |
| `CardCollection` | `filterByRarity` uses `c.rarity.name` |

### Adding New Sets / Tags
No code changes required — insert a row in `card_sets` or `tags` via the admin page. The app fetches these at runtime.

---

## Phase 8: Riftbound Stat Terminology ✅

Based on official Riftbound TCG rules research.

| Old label | New label | Riftbound basis |
|---|---|---|
| Mana | **Energy** | The colorless cost to play a card |
| Attack | **Power** | The card's offensive output |
| Defense | **Health** | The card's durability / damage it can absorb |

> In the real Riftbound game, "Might" is a single unified combat stat (both offense and defense). Our DB stores them separately for design flexibility; the UI labels reflect the spirit of the terminology.

**Files updated**: `CardLightboxComponent.ts` (stat labels), `AdminPageComponent.ts` (form labels).

---

## Current Build Status

```
✅ tsc --noEmit        — 0 errors
✅ vite build          — 237 kB JS bundle (Supabase + Auth included)
✅ dev server          — starts cleanly
✅ Supabase connection — live with real keys in .env.local
✅ Auth                — login, logout, forgot password, reset password
✅ Admin CMS           — card CRUD, image upload, set/tag management
```

---

## Full File Change Log

| File | Status | Notes |
|---|---|---|
| `src/types/Card.types.ts` | Updated | `IRarity`, `ICardSet`, `ITag`; updated `ICard`, `ICardCollection` |
| `src/models/Card.ts` | Updated | `rarity: IRarity`, `set: ICardSet`, `tags: ITag[]` |
| `src/models/CardCollection.ts` | Updated | `filterByRarity` uses `rarity.name` |
| `src/services/supabaseClient.ts` | New | Lazy singleton client |
| `src/services/AuthService.ts` | New | Full auth API wrapper |
| `src/services/CardService.ts` | Updated | Nested select query, uses singleton |
| `src/components/shared/CardLightboxComponent.ts` | Updated | Riftbound stat labels, `rarity.colorHex`, `rarity.name`, `set.name` |
| `src/components/home/CardGridComponent.ts` | Updated | `rarity.name`, `set.name` |
| `src/components/pages/CardsPageComponent.ts` | Updated | Dynamic filter buttons, `rarity.name`, `set.name` |
| `src/components/pages/AboutPageComponent.ts` | Updated | Riftbound-accurate lore copy |
| `src/components/pages/LoginPageComponent.ts` | New | Login + forgot password |
| `src/components/pages/ResetPasswordPageComponent.ts` | New | Password reset handler |
| `src/components/pages/AdminPageComponent.ts` | New | Full CMS — card CRUD, image upload, set/tag management |
| `src/components/layout/NavComponent.ts` | Updated | `isLoggedIn` param, Admin/Logout links |
| `src/styles/components/lightbox.css` | New | Lightbox styles |
| `src/styles/components/auth.css` | New | Auth page styles |
| `src/styles/components/admin.css` | New | Admin page styles |
| `src/styles/components/nav.css` | Updated | `.nav__cta--outline`, `.nav__link--muted` |
| `src/styles/components/cards.css` | Updated | `.tcg-card__art-img`, hover selector |
| `src/styles/_utilities.css` | Updated | `@keyframes spin` |
| `src/styles/main.css` | Updated | Imports `auth.css`, `admin.css`, `lightbox.css` |
| `src/utils/sampleData.ts` | Updated | Uses `IRarity`/`ICardSet` typed objects |
| `src/App.ts` | Updated | Auth state, 6 routes, nav remount, `Promise.all` init |
| `tsconfig.json` | Updated | `"types": ["vite/client"]` |
| `vite.config.ts` | Updated | `envDir: '../'` |
| `.env.example` | New | Documents required env vars |
| `supabase/migrations/001_create_cards_table.sql` | New | Schema + RLS |
| `supabase/migrations/002_seed_cards.sql` | New | 16 sample cards |
| `supabase/migrations/003_add_art_url.sql` | New | `art_url` + storage bucket |
| `supabase/migrations/004_relational_schema.sql` | New | Relational schema — rarities, sets, tags |
| `package.json` | Updated | `@supabase/supabase-js` dependency |
