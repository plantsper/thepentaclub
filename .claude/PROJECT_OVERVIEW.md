# The Pentaclub — Riftbound TCG Project

## Project Overview

A single-page application (SPA) for **Riftbound TCG**, a collectible trading card game set in the League of Legends / Runeterra universe. The application includes a card collection system with filtering, searching, lightbox detail views, a Supabase-backed data layer with image hosting, and a password-protected admin CMS for managing cards, sets, and tags.

---

## Core Functionality

### 1. Application Architecture
- **Pattern**: OOP with TypeScript classes
- **Routing**: Hash-based SPA (`#/`, `#/cards`, `#/about`, `#/login`, `#/admin`, `#/reset-password`)
- **State Management**: Event-driven via EventEmitter (`card:open`, etc.)
- **Rendering**: Component-based UI with manual DOM manipulation
- **Data Layer**: Supabase (PostgreSQL + PostgREST), relational schema, with hardcoded sample data fallback
- **Auth**: Supabase Auth — email/password, forgot password, password reset via email link
- **App Init**: Async — loads cards + session in parallel, falls back to sample data on Supabase error

---

### 2. Data Models

#### Card Model (`src/models/Card.ts`)
| Property | Type | Description |
|---|---|---|
| `id` | `string` | UUID from Supabase |
| `name` | `string` | Card name |
| `type` | `CardType` | `'Champion' \| 'Spell' \| 'Artifact'` |
| `rarity` | `IRarity` | `{ id, name, sortOrder, colorHex }` — from `card_rarities` table |
| `manaCost` | `number` | **Energy** cost to play (Riftbound terminology) |
| `attack` | `number` | **Power** stat — displayed as "Power" in UI |
| `defense` | `number` | **Health** stat — displayed as "Health" in UI |
| `description` | `string` | Flavor/ability text |
| `artGradient` | `string` | CSS gradient fallback when no image |
| `artUrl?` | `string` | Supabase Storage public URL |
| `set` | `ICardSet` | `{ id, name, slug, description }` — from `card_sets` table |
| `tags` | `ITag[]` | `{ id, name }[]` — from `card_tags` junction |
| `rarityClass` | getter | CSS class based on `rarity.name` |

#### TypeScript Interfaces (`src/types/Card.types.ts`)
```typescript
CardType = 'Champion' | 'Spell' | 'Artifact'

IRarity  = { id: number; name: string; sortOrder: number; colorHex: string }
ICardSet = { id: number; name: string; slug: string; description: string }
ITag     = { id: number; name: string }
```
Rarity and set are no longer union types — they are relational objects fetched from the DB.

#### CardCollection Model (`src/models/CardCollection.ts`)
- `all`: All cards
- `count`: Total count
- `add(card)`: Adds a card
- `filterByRarity(rarityName: string | 'all')`: Filters by `rarity.name` (case-insensitive)
- `filterByType(type)`: Filters by type string
- `search(query)`: Searches name, type, description

---

### 3. Routing

| Route | Component | Auth |
|---|---|---|
| `#/` | Home | Public |
| `#/cards` | Cards collection | Public |
| `#/about` | Riftbound lore | Public |
| `#/login` | Login + forgot password | Redirects to `/admin` if already logged in |
| `#/admin` | Admin CMS | Redirects to `/login` if not authenticated |
| `#/reset-password` | Set new password | Shown automatically when recovery link is clicked |

---

### 4. Component Architecture

#### Base (`src/components/base/Component.ts`)
Abstract class with `render()`, `mount()`, `afterMount()`, `destroy()`.

#### Navigation (`src/components/layout/NavComponent.ts`)
- Accepts `isLoggedIn: boolean` and `onLogout: () => void`
- When **logged out**: shows subtle low-opacity "Admin" link + "Browse Cards" CTA
- When **logged in**: shows "Admin" link + "Logout" button (outline style)
- Mobile responsive toggle, scroll-based styling

#### Hero, Stats, Features, CTA, Footer
Unchanged from original migration — static content components.

#### Card Grid (`src/components/home/CardGridComponent.ts`)
- Displays first 8 cards as homepage preview
- Click delegation → emits `card:open` → opens lightbox
- Renders `card.rarity.name`, `card.set.name`

#### Cards Page (`src/components/pages/CardsPageComponent.ts`)
- Full collection with real-time search and rarity filter
- Filter buttons are **dynamic** — derived from `collection.all` sorted by `rarity.sortOrder`
- No hardcoded rarity names in HTML
- Click delegation → emits `card:open`

#### Card Lightbox (`src/components/shared/CardLightboxComponent.ts`)
- Global modal mounted once in `App.ts`
- Listens for `card:open` via EventEmitter
- Two-panel layout: art (left) + details (right)
- Stat labels use **Riftbound terminology**: Power, Health, Energy (not Attack, Defense, Mana)
- Rarity color comes from `card.rarity.colorHex` (DB-driven, not hardcoded)
- Close via backdrop, X button, or Escape

#### Login Page (`src/components/pages/LoginPageComponent.ts`)
- Email/password login form
- "Forgot password?" toggle shows forgot-password form in same card
- On success: calls `onLogin()` callback → App fetches session → navigates to `/admin`
- Error messages per-field

#### Reset Password Page (`src/components/pages/ResetPasswordPageComponent.ts`)
- Shown when user clicks the Supabase password-reset email link
- App detects `PASSWORD_RECOVERY` event from `onAuthStateChange` → navigates to `#/reset-password`
- Calls `supabase.auth.updateUser({ password })` with confirmation field validation

#### Admin Page (`src/components/pages/AdminPageComponent.ts`)
- **Auth-gated**: App.ts redirects to `/login` if no session
- Fetches lookup tables (`card_rarities`, `card_sets`, `tags`) from DB on mount
- **Sets section**: chips showing current sets with delete, inline form to add new set
- **Tags section**: chips showing current tags with delete, inline form to add new tag
- **Card table**: Name, Type, Rarity, Set, Tags, Art (✓/—), Edit/Delete actions
- **Add/Edit form**: all card fields; rarity and set selects are DB-driven; tags are checkboxes; image upload to Supabase Storage
- Tag sync on save: deletes all existing `card_tags` for the card, re-inserts selected ones

---

### 5. Services

#### `supabaseClient.ts`
Lazy singleton — `getSupabaseClient()` creates the client once and reuses it. Auth session persists because the same client instance manages localStorage token storage.

#### `AuthService.ts`
| Function | Description |
|---|---|
| `signIn(email, password)` | Calls `signInWithPassword`, returns session |
| `signOut()` | Ends session |
| `sendPasswordReset(email)` | Sends reset email with `redirectTo: window.location.origin` |
| `updatePassword(newPassword)` | Updates password for currently-authenticated user |
| `getSession()` | Returns current session or null |
| `onAuthStateChange(callback)` | Fires on LOGIN, LOGOUT, PASSWORD_RECOVERY |

#### `CardService.ts`
Uses nested Supabase select to fetch cards with joined rarity, set, and tags in a single query:
```typescript
.from('cards')
.select('*, card_rarities(id,name,sort_order,color_hex), card_sets(id,name,slug,description), card_tags(tags(id,name))')
```

#### `EventEmitter.ts` / `Router.ts`
Unchanged.

---

### 6. Database — Supabase

#### Tables

| Table | Purpose |
|---|---|
| `cards` | Card catalog — `id`, `name`, `type`, `rarity_id` (FK), `set_id` (FK), `mana_cost`, `attack`, `defense`, `description`, `art_gradient`, `art_url`, `created_at` |
| `card_rarities` | Lookup — `id`, `name`, `sort_order`, `color_hex` |
| `card_sets` | Lookup — `id`, `name`, `slug`, `released`, `description` |
| `tags` | Lookup — `id`, `name` |
| `card_tags` | Junction — `card_id` (FK), `tag_id` (FK) |

#### Row Level Security
All tables: `SELECT` public, `ALL` authenticated only.

#### CMS Workflow
- **Cards**: Admin page at `#/admin` (email/password login required)
- **Card art**: Upload in admin form → goes to Supabase Storage `card-art` bucket → public URL stored in `art_url`
- **Direct edits**: Supabase Studio table editor (fallback)

#### Migrations
| File | Description |
|---|---|
| `001_create_cards_table.sql` | `cards` table + RLS |
| `002_seed_cards.sql` | 16 sample cards |
| `003_add_art_url.sql` | `art_url` column + `card-art` storage bucket |
| `004_relational_schema.sql` | `card_rarities`, `card_sets`, `tags`, `card_tags`; backfills + drops old string columns |

---

### 7. Riftbound Stat Terminology

Based on the official Riftbound TCG rules, the UI uses Riftbound-accurate stat names:

| DB column | Internal property | UI label | Riftbound meaning |
|---|---|---|---|
| `mana_cost` | `manaCost` | **Energy** | Colorless cost to play the card |
| `attack` | `attack` | **Power** | Card's offensive output |
| `defense` | `defense` | **Health** | Card's durability / damage absorption |

> In the real game, Might is a single combined combat stat. Our DB stores them separately for design flexibility.

---

### 8. Design System

#### Color Palette
- `--bg-deep: #060a10` → `--bg-elevated: #1e3350`
- `--accent: #00e68a` (cyan-green)
- `--accent-secondary: #00c4ff` (blue)
- `--accent-tertiary: #a855f7` (purple)
- `--text-primary: #e8ecf4` → `--text-muted: #566380`

#### Typography
- **Display/Body**: Outfit (sans-serif)
- **Accent**: Crimson Pro (serif — card descriptions, lore text)

#### CSS Structure
```
src/styles/
├── _variables.css
├── _base.css
├── _backgrounds.css
├── _common.css
├── _utilities.css        @keyframes spin, stagger-in, responsive
├── components/
│   ├── nav.css           + .nav__cta--outline, .nav__link--muted
│   ├── hero.css
│   ├── stats.css
│   ├── features.css
│   ├── cards.css
│   ├── lightbox.css
│   ├── cta.css
│   ├── footer.css
│   ├── auth.css          Login, ResetPassword page styles
│   └── admin.css         Admin page, lookup chips, tag checkboxes
└── main.css              @import all
```

---

### 9. App Initialization Flow

1. Show loading spinner
2. `Promise.all([fetchCards(), getSession()])` — in parallel
   - Cards: Supabase nested select → `CardCollection`
   - Session: checked from localStorage via Supabase client
   - On any error: fall back to `createSampleCards()`, `session = null`
3. Set up `onAuthStateChange` listener
   - `PASSWORD_RECOVERY` event → navigate to `#/reset-password`
   - Any session change → re-mount nav with updated auth state
4. Build HTML skeleton (nav, pages, footer, lightbox mounts)
5. Mount `NavComponent(isLoggedIn, onLogout)`, `FooterComponent`, `CardLightboxComponent`
6. Register routes and start Router
7. On route change: update nav active state, hide all pages, scroll to top, mount page component
   - `/admin` → redirects to `/login` if no session
   - `/login` → redirects to `/admin` if session exists

---

### 10. Project Structure

```
src/
├── components/
│   ├── base/Component.ts
│   ├── home/
│   │   ├── HeroComponent.ts
│   │   ├── StatsComponent.ts
│   │   ├── FeaturesComponent.ts
│   │   ├── CardGridComponent.ts
│   │   └── CTAComponent.ts
│   ├── layout/
│   │   ├── NavComponent.ts         auth-aware (isLoggedIn param)
│   │   └── FooterComponent.ts
│   ├── pages/
│   │   ├── CardsPageComponent.ts   dynamic rarity filters
│   │   ├── AboutPageComponent.ts
│   │   ├── LoginPageComponent.ts   login + forgot password
│   │   ├── ResetPasswordPageComponent.ts
│   │   └── AdminPageComponent.ts   full CMS
│   └── shared/
│       └── CardLightboxComponent.ts
├── models/
│   ├── Card.ts                     rarity: IRarity, set: ICardSet, tags: ITag[]
│   └── CardCollection.ts           filterByRarity uses rarity.name
├── services/
│   ├── supabaseClient.ts           lazy singleton
│   ├── AuthService.ts              signIn/Out/Reset/Update/getSession/onChange
│   ├── CardService.ts              nested select query
│   ├── CardOcrService.ts           Tesseract.js OCR — orientation-aware, per-zone preprocessing
│   ├── RiftcodexService.ts         Riftcodex public API — fuzzy search + field mapping
│   ├── EventEmitter.ts
│   └── Router.ts
├── styles/
│   ├── components/
│   │   ├── auth.css
│   │   ├── admin.css
│   │   └── ...
│   └── main.css
├── types/
│   ├── Card.types.ts               IRarity, ICardSet, ITag, ICard, ICardCollection
│   └── ...
├── utils/
│   ├── sampleData.ts               uses IRarity/ICardSet objects (not strings)
│   └── ScrollAnimator.ts
├── App.ts                          async init, auth state, 6 routes
└── index.html
supabase/
└── migrations/
    ├── 001_create_cards_table.sql
    ├── 002_seed_cards.sql
    ├── 003_add_art_url.sql
    └── 004_relational_schema.sql
```

---

### 11. Card Scanning — OCR + Riftcodex API

#### Overview
Admin card upload triggers an automatic scan pipeline to pre-fill form fields.

#### Card Orientations (critical)
Riftbound has **two physical card orientations** with completely different layouts:

| Orientation | Card Types | Name position | Card number |
|---|---|---|---|
| **Portrait** (h > w) | Champion, Legend, Unit, Spell, Rune, Battlefield | Blue nameplate ~64-73% from top | Bottom-left bar `SFD • 239/221` |
| **Landscape** (w > h) | Gear, Equipment | Vertical text on left edge of text panel | Bottom-right bar `SFD • 051/221` |

Landscape cards must be **rotated 90° CCW** before applying portrait zones — after rotation the art panel is at the top and the text panel is at the bottom, matching the portrait layout.

#### Scan Pipeline
```
Image uploaded
    │
    ├─ 1. Detect orientation (w > h → landscape → rotate 90° CCW)
    │
    ├─ 2. Preprocess zones (grayscale + 2× upscale + contrast)
    │
    ├─ 3. OCR name zone + type banner zone (two candidates)
    │      typeBanner "CHAMPION UNIT • SORAKA • MOUNT TARGON" → extract "SORAKA" as second candidate
    │
    ├─ 4. OCR card number zone → extract set code ("SFD") + collector num
    │
    ├─ 5. Fuzzy search Riftcodex API with each name candidate
    │      https://api.riftcodex.com/cards/name?fuzzy=<name>&size=5
    │      Use set code as validation signal (prefer match where set.set_id === setCode)
    │
    └─ 6. OCR result → fills SEARCH BOX (not form directly)
           User sees pre-filled search → confirms or corrects → Riftcodex fills all fields
           Manual search box always available as override
```

#### Why Search-Box-First
Direct OCR → form fill is too fragile for real-world card photos (holographic foil, perspective distortion, variable lighting). OCR fills the **search input** as a typing shortcut; the reliable data comes from the Riftcodex API after the user confirms.

#### Riftcodex API (`src/services/RiftcodexService.ts`)
- Base URL: `https://api.riftcodex.com` — public, no auth
- `fuzzySearchCard(name, setCode?)` — returns best match + `setValidated` flag
- Set code validation: if OCR setCode matches `card.set.set_id`, confidence is higher
- Maps API fields to form: `energy→manaCost`, `might→attack`, `power→defense`
- `media.image_url` auto-fills art URL (skips Supabase Storage upload for official cards)

#### Riftcodex Type → DB CardType mapping
| Riftcodex type | Our `CardType` |
|---|---|
| Champion, Legend, Unit, Unit Token | `'Champion'` |
| Spell, Rune | `'Spell'` |
| Gear, Battlefield | `'Artifact'` |

#### OCR Service (`src/services/CardOcrService.ts`)
- Tesseract.js v7 — lazy-loaded (WASM ~10 MB only when scanning)
- Per-zone canvas preprocessing: crop → grayscale → 2× scale → contrast boost
- `extractCardName(file)` — scans name zone + banner zone, returns two name candidates
- `extractAllFields(file)` — full fallback, all zones, used when API returns nothing
- Both functions handle landscape rotation automatically

#### Card Number Format
`SFD • 051/221` — set code + bullet separator + collector number / total
Regex: `/([A-Z]{2,5})\s*[•·\-–]\s*(\d+)[/](\d+)/i`

#### Known Limitations
- Photos at steep angles may misalign zones even after rotation
- Holographic/foil cards reduce OCR confidence — manual search override always available
- OCR is a convenience hint, not a critical dependency — all fields can be filled manually

---

### 12. Known Gotchas

| Issue | Fix |
|---|---|
| `import.meta.env` not typed | `"types": ["vite/client"]` in tsconfig |
| Env vars undefined at build | `envDir: '../'` in vite.config.ts (root is `./src`) |
| Supabase crashes before App try/catch | `createClient` in singleton, not at module level |
| Password reset redirect blocked | Add Vercel domain to Supabase Auth → URL Configuration → Redirect URLs |
| Supabase session not shared across service calls | All services use `getSupabaseClient()` singleton |
| Admin account creation | Use Supabase Studio → Authentication → Users → Add user (no public sign-up) |
