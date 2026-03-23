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

## Phase 2: Feature Additions ✅

### Card Lightbox
**Component**: `src/components/shared/CardLightboxComponent.ts`
**Styles**: `src/styles/components/lightbox.css`

- Mounted once globally in App.ts
- Listens for `card:open` events via EventEmitter
- Triggered by clicking any card on home page or cards page (event delegation)
- Two-panel layout: art panel (left) + detail panel (right)
- Shows: set label, name, type badge, description (italic serif), attack/defense/mana stats, rarity bar
- Close: backdrop click, X button, or Escape key
- Smooth `opacity` + `scale/translateY` animation
- Mobile: collapses to bottom sheet (`border-radius` top only, `align-items: flex-end`)
- Body scroll locked while open (`document.body.style.overflow = 'hidden'`)

**Wiring changes:**
- `CardGridComponent` — renamed `_events` → `events`, stored, added click delegation on `#cardShowcase`
- `CardsPageComponent` — renamed `_events` → `events`, stored, added click delegation on `#cardsGrid`

---

## Phase 3: Supabase Integration ✅

### Database
- **Platform**: Supabase (PostgreSQL + PostgREST REST API)
- **CMS**: Supabase Studio table editor

**Migrations:**
| File | Purpose |
|---|---|
| `supabase/migrations/001_create_cards_table.sql` | Creates `cards` table with RLS |
| `supabase/migrations/002_seed_cards.sql` | Seeds 16 sample cards |
| `supabase/migrations/003_add_art_url.sql` | Adds `art_url` column + `card-art` storage bucket |

**Row Level Security:**
- Public: SELECT (anyone can browse cards)
- Authenticated: full CRUD (Supabase Studio admins)

### CardService (`src/services/CardService.ts`)
- `fetchCards()`: queries `cards` table ordered by `created_at`
- Maps DB snake_case → TypeScript camelCase (`mana_cost` → `manaCost`, etc.)
- `art_url` mapped as `artUrl?: string` (null → undefined)
- Supabase client created lazily inside function (not at module load)
- Guards missing env vars: throws `'Supabase env vars not set'`

### Async App Init (`src/App.ts`)
- `#init()` is now `async`
- Shows loading spinner while fetching (`@keyframes spin` in `_utilities.css`)
- `try/catch`: on Supabase error → falls back to `createSampleCards()`
- Full app skeleton only built after cards are loaded

### Environment Variables
- `.env.example` documents required vars
- `.env.local` holds real keys (not committed)
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

---

## Phase 4: Card Image Hosting ✅

### Type changes
- `ICard` interface: added `artUrl?: string`
- `Card` model: added `artUrl` as optional last constructor param

### Rendering (all three card contexts)
All card art sections conditionally render:
- **If `artUrl`**: `<img class="tcg-card__art-img">` with `object-fit: cover; object-position: center top`
- **Fallback**: `<div class="tcg-card__art-bg">` with inline gradient background

Applied in:
- `CardGridComponent.#renderCards()`
- `CardsPageComponent.#renderCards()`
- `CardLightboxComponent.#open()` (also clears `art.style.background` when image present)

### CSS additions
- `.tcg-card__art-img` — `object-fit: cover`, `object-position: center top`, hover zoom
- `.lightbox__art-img` — fills art panel, `object-fit: cover`
- Hover zoom selector updated: `.tcg-card:hover .tcg-card__art-bg, .tcg-card:hover .tcg-card__art-img`

### Recommended image size
Upload at **1040 × 1460 px** (2x the 520 × 730 lightbox panel). Browser auto-crops with `object-position: center top`.

---

## Phase 5: Bug Fixes ✅

### Fix 1 — `import.meta.env` not typed
`tsconfig.json` was missing `"types": ["vite/client"]`.

```json
"types": ["vite/client"]
```

### Fix 2 — Env vars not found at build/dev time
`vite.config.ts` sets `root: './src'`, so Vite looked for `.env.local` inside `src/` instead of the project root.

```typescript
envDir: '../'   // added to vite.config.ts
```

Without this fix, Vite replaced `import.meta.env.VITE_SUPABASE_URL` with `undefined` at build time, Rollup's dead-code elimination reduced `fetchCards()` to just `throw new Error(...)`, and Supabase was excluded from the bundle entirely (bundle size dropped from 212 kB to 28 kB).

### Fix 3 — Supabase client crashed before App.ts try/catch
`createClient()` was called at module initialization time. If env vars were missing, it threw before `App.ts`'s `try/catch` around `fetchCards()` could catch it, crashing the entire app.

Moved `createClient()` inside `fetchCards()` with an explicit guard:
```typescript
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Supabase env vars not set');
const supabase = createClient(url, key);
```

---

## Current Build Status

```
✅ tsc --noEmit        — 0 errors
✅ vite build          — 212 kB JS bundle (Supabase included)
✅ dev server          — http://localhost:3000
✅ Supabase connection — live with real keys in .env.local
```

## File Change Log

| File | Status | Notes |
|---|---|---|
| `src/types/Card.types.ts` | Updated | Added `artUrl?: string` to `ICard` |
| `src/models/Card.ts` | Updated | Added `artUrl` optional param |
| `src/services/CardService.ts` | New | Supabase fetch, lazy client, env guard |
| `src/components/shared/CardLightboxComponent.ts` | New | Global card detail modal |
| `src/components/home/CardGridComponent.ts` | Updated | Stores events, click delegation, img support |
| `src/components/pages/CardsPageComponent.ts` | Updated | Stores events, click delegation, img support |
| `src/components/pages/AboutPageComponent.ts` | Updated | Riftbound-accurate lore copy |
| `src/styles/components/lightbox.css` | New | Lightbox styles |
| `src/styles/components/cards.css` | Updated | Added `.tcg-card__art-img`, updated hover selector |
| `src/styles/_utilities.css` | Updated | Added `@keyframes spin` |
| `src/styles/main.css` | Updated | Imports `lightbox.css` |
| `src/App.ts` | Updated | Async init, Supabase fetch + fallback, mounts lightbox |
| `tsconfig.json` | Updated | Added `"types": ["vite/client"]` |
| `vite.config.ts` | Updated | Added `envDir: '../'` |
| `.env.example` | New | Documents required env vars |
| `.env.local` | New | Real Supabase keys (not committed) |
| `supabase/migrations/001_create_cards_table.sql` | New | Schema + RLS |
| `supabase/migrations/002_seed_cards.sql` | New | 16 sample cards |
| `supabase/migrations/003_add_art_url.sql` | New | `art_url` column + `card-art` storage bucket |
| `package.json` | Updated | Added `@supabase/supabase-js` dependency |
