# Infrastructure: The Pentaclub

*Last updated: 2026-03-24. Current state: TypeScript SPA, Supabase backend, Claude vision OCR via Edge Function. Price field replaces mana cost. Admin has bulk-delete and image-drop bulk import. Card code metadata (set abbreviation + collector number with variant suffix) stored per card and shown beside card name in all views.*

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla TypeScript SPA (no framework), Vite |
| Database | Supabase (PostgreSQL via PostgREST) |
| Auth | Supabase Auth (email/password) |
| Storage | Supabase Storage (`card-art` bucket) |
| Edge Functions | Supabase Edge Functions (Deno) |
| AI / OCR | Claude Haiku (`claude-haiku-4-5-20251001`) via Edge Function |
| External API | Riftcodex public TCG API (`https://api.riftcodex.com`) |
| Deploy | Vercel (static) |

---

## Architecture

```
Browser (Vanilla TS SPA)
  ├── App.ts                  — boot, async init, auth state, route orchestration
  ├── Router.ts               — hash-based (#/route) client-side router
  ├── EventEmitter.ts         — pub/sub for card:open events (lightbox)
  ├── CardCollection.ts       — in-memory card store, passed to all components
  │
  ├── CardService.ts          ──→ Supabase PostgREST (cards + joins)
  ├── AuthService.ts          ──→ Supabase Auth
  ├── supabaseClient.ts       — singleton SupabaseClient, reads VITE_ env vars
  │
  ├── CardOcrService.ts       ──→ supabase.functions.invoke('ocr-card')
  │                                     │
  │                           supabase/functions/ocr-card/index.ts (Deno)
  │                                     │
  │                                     └──→ Anthropic API (key stored as secret)
  │
  └── RiftcodexService.ts     ──→ api.riftcodex.com (public, no auth)
                                  pre-fetches ~939 cards → in-memory Map index

Supabase (PostgreSQL)
  ├── cards                   — main card catalog
  ├── card_rarities           — lookup: Legendary / Epic / Rare / Common
  ├── card_sets               — lookup: Rift Core / Shattered Realms / Tidal Abyss / Void Expanse
  ├── tags                    — arbitrary keyword tags
  └── card_tags               — junction: card ↔ tag (many-to-many)

Supabase Storage
  └── card-art (public bucket) — card art images, referenced by cards.art_url
```

---

## Frontend SPA Pattern

No framework. Every UI element is a class that extends `Component` (base class in `src/components/base/Component.ts`).

### Component lifecycle

```
new FooComponent(containerElement, ...args)
  → .mount()
      → container.innerHTML = this.render()   // template literal HTML
      → this.afterMount()                      // attach event listeners
```

`render()` returns a template literal string. `afterMount()` queries the freshly-mounted DOM and wires up listeners. Components never re-render partially — they remount on state changes.

### XSS safety

All user-controlled or database-sourced strings must go through `src/utils/esc.ts` before insertion into `innerHTML`:

| Function | Use |
|---|---|
| `esc(s)` | HTML-encode any string for text/attribute contexts |
| `safeUrl(url)` | Allow only `http:`/`https:` URLs; returns `''` otherwise |
| `safeCss(value)` | Allowlist-validate CSS values (gradients, colors) for `style=` attributes |

Direct DOM property assignment (`element.textContent`, `element.style.background = value`) is safe without escaping and is preferred where possible.

### Routing

Hash-based (`#/route`). `Router.ts` listens on `hashchange`, matches the path, calls the registered handler. No params yet — all routes are static strings.

| Route | Component | Auth required |
|---|---|---|
| `#/` | Home (Hero + Stats + Features + CardGrid + CTA) | No |
| `#/cards` | CardsPageComponent | No |
| `#/about` | AboutPageComponent | No |
| `#/login` | LoginPageComponent | No (redirects to `/admin` if already logged in) |
| `#/reset-password` | ResetPasswordPageComponent | No |
| `#/admin` | AdminPageComponent | Yes (redirects to `/login` if no session) |

Auth guard is enforced in `App.ts` — `#showAdmin()` checks `this.#session` before mounting. RLS on Supabase enforces it server-side independently.

### Offline / fallback

If Supabase env vars are missing or the fetch fails on boot, `App.ts` falls back to 16 hardcoded sample cards from `src/utils/sampleData.ts`. The app remains functional for browsing; admin and auth are unavailable.

---

## Database Schema

Migration files live in `supabase/migrations/`. Run them in order in the Supabase SQL Editor.

### Tables

```sql
cards (
  id            UUID          PK default gen_random_uuid()
  name          TEXT          NOT NULL
  type          TEXT          NOT NULL  -- 'Champion' | 'Spell' | 'Artifact'
  price         NUMERIC(10,2) NOT NULL DEFAULT 0.00  -- sale price in dollars
  attack        INTEGER       NOT NULL DEFAULT 0
  defense       INTEGER       NOT NULL DEFAULT 0
  description   TEXT          NOT NULL DEFAULT ''
  art_gradient  TEXT          NOT NULL DEFAULT ''  -- CSS gradient fallback
  art_url       TEXT                               -- Supabase Storage URL (nullable)
  rarity_id     INTEGER       FK → card_rarities(id) NOT NULL
  set_id        INTEGER       FK → card_sets(id)     NOT NULL
  card_set_code TEXT                               -- Riftbound set abbreviation e.g. 'SFD', 'OGN' (nullable)
  card_code     TEXT                               -- Collector number / total with variant suffix (nullable)
                                                   --   standard:   '170/221'
                                                   --   overnumber: '100/99'
                                                   --   alt-art:    '000a/100'
                                                   --   signature:  '200[*]/199'
  created_at    TIMESTAMPTZ   DEFAULT NOW()
)

card_rarities (
  id         SERIAL PK
  name       TEXT   UNIQUE  -- 'Legendary' | 'Epic' | 'Rare' | 'Common'
  sort_order INTEGER
  color_hex  TEXT           -- e.g. '#fbbf24'
)

card_sets (
  id          SERIAL PK
  name        TEXT   UNIQUE  -- e.g. 'Rift Core'
  slug        TEXT   UNIQUE  -- e.g. 'rift-core'
  released    DATE
  description TEXT
)

tags (
  id   SERIAL PK
  name TEXT   UNIQUE
)

card_tags (
  card_id UUID    FK → cards(id) ON DELETE CASCADE
  tag_id  INTEGER FK → tags(id)  ON DELETE CASCADE
  PRIMARY KEY (card_id, tag_id)
)
```

### Row Level Security

All tables have RLS enabled. Policy pattern is consistent across all tables:

| Operation | Policy |
|---|---|
| `SELECT` | Public — anyone can read (no auth required) |
| `INSERT / UPDATE / DELETE` | Authenticated users only (`auth.role() = 'authenticated'`) |

Admin write access is gated by Supabase Auth session only — there is no separate admin role. Any authenticated user can write. This is acceptable for the current single-admin model; revisit before adding multi-user ecommerce.

### Card query (full join)

`CardService.ts` fetches cards with:

```typescript
supabase
  .from('cards')
  .select('*, card_rarities(id, name, color_hex), card_sets(id, name, slug), card_tags(tags(id, name))')
  .order('created_at', { ascending: true })
```

---

## Auth

Supabase Auth (email/password). Managed entirely via `src/services/AuthService.ts`.

| Function | What it does |
|---|---|
| `signIn(email, password)` | `supabase.auth.signInWithPassword()` |
| `signOut()` | `supabase.auth.signOut()` |
| `getSession()` | Returns current session or null |
| `onAuthStateChange(cb)` | Subscribes to login/logout/PASSWORD_RECOVERY events |
| `sendPasswordReset(email)` | Sends reset email; redirect URL hardcoded to `window.location.origin + '/#/reset-password'` |
| `updatePassword(newPassword)` | Called from ResetPasswordPageComponent after user clicks email link |

Auth state is held in `App.ts` as `#session`. On `PASSWORD_RECOVERY` event, the router pushes to `#/reset-password` automatically.

---

## Storage

Bucket: `card-art` (public read, authenticated write).

Images are uploaded from `AdminPageComponent.#handleImageUpload()`:

1. MIME type validated against allowlist: `image/jpeg`, `image/png`, `image/webp` only
2. File size checked: max 5 MB
3. Extension derived from `file.type` (not from filename — prevents extension spoofing)
4. Uploaded to path: `{timestamp}-{random}.{ext}` — no user-controlled segments
5. Public URL written to `cards.art_url`

If `art_url` is null, the card renders its `art_gradient` CSS value as a fallback background. `art_gradient` values are validated through `safeCss()` before being injected into `style=` attributes.

### Recommended image dimensions

Cards render at `3:4.2` aspect ratio; art fills top 65%.

| Use | Size |
|---|---|
| Grid / lightbox (safe for both) | 1040 × 1460 px |

Upload at 2x — the browser scales down with `object-fit: cover; object-position: center top`.

---

## Admin CMS (`AdminPageComponent`)

All card management lives in `src/components/pages/AdminPageComponent.ts`. Requires an authenticated session.

### Card table

Displays all cards with columns: Name, Code, Type, Rarity, Set, Tags, Price, Art, Actions.

- **Inline delete confirmation** — clicking Delete replaces the row's action cell with "Delete [name]? Yes / No". No browser `confirm()` dialog.
- **Bulk delete** — checkbox column (with select-all) lets the admin select multiple rows. A "Delete selected (N)" danger button appears in the toolbar. Clicking it shows a banner above the table; a second click on "Yes, delete all" fires a single `.delete().in('id', ids)` query. The banner has a dedicated error span so `innerHTML +=` is never used (which would destroy event listeners).
- **Code column** — shows `SFD 170/221` (set code + collector number); muted style; empty rows show `—`.
- **Price column** — shows `$X.XX` in the accent green; matches the card badge style.

### Single-card form

Opens above the table for both add and edit. Fields: Name, Type, Rarity, Set, Set Code, Card Code, Price ($), Power, Health, Art Gradient, Description, Tags (checkboxes), Card Art (file + URL).

- **Set Code** — `text` input, e.g. `SFD`; auto-uppercased; auto-populated by OCR scan and bulk import. Stored as `card_set_code`.
- **Card Code** — `text` input, e.g. `170/221` or `000a/100`; auto-populated by OCR scan and bulk import. Stored as `card_code`.
- **Price** — `type="number" step="0.01"` — stored as `NUMERIC(10,2)`. Riftcodex does not provide pricing; defaults to `$0.00` on all auto-filled cards.

### Bulk image import

Drop zone in the admin toolbar area. Flow: drop images → thumbnails appear in a queue → click "Import Cards" → each image OCR'd + Riftcodex-looked-up + inserted sequentially. See **OCR Pipeline → Bulk image import** below.

---

## OCR Pipeline (Card Scan)

The same OCR pipeline powers two admin flows: single-card scan and bulk image import.

### Single card scan

Admin selects one image in the add/edit form. Upload and scan run in parallel.

```
1. Browser (AdminPageComponent)
   └── file selected → #handleImageUpload + #handleCardScan run in parallel

2. CardOcrService.extractCardCode(file)
   ├── fileToBase64Jpeg() — canvas resize to ≤1024px, encode as JPEG base64
   └── supabase.functions.invoke('ocr-card', { body: { image: base64 } })

3. Edge Function: supabase/functions/ocr-card/index.ts (Deno)
   ├── Validates base64 format and payload size (max 4 MB)
   ├── Reads ANTHROPIC_API_KEY from Supabase secrets
   ├── POST https://api.anthropic.com/v1/messages
   │     model: claude-haiku-4-5-20251001
   │     max_tokens: 64
   │     Prompt: instructs model to preserve letter/asterisk suffix on collector number
   └── Returns { raw: "SFD • 170/221" }  (or "SFD • 000a/100" / "SFD • 200[*]/199")

4. parseCardCode(raw) → { setCode, collectorNum, cardNumber, variant }
   Variant detection (CardOcrService.ts):
     - suffix '*'    → 'signature'
     - suffix [a-z]  → 'alt-art'
     - num > total   → 'overnumber'
     - otherwise     → 'standard'

5. RiftcodexService.lookupByCardCode(setCode, collectorNum)
   ├── buildCardIndex() if not ready — fetches all ~939 cards from api.riftcodex.com
   └── O(1) Map lookup → RiftcodexCard

6. #applyRiftcodexFields() — populates admin form fields
   fCardSetCode ← setCode  |  fCardCode ← cardNumber
```

**Fallback chain:** If OCR fails → user enters card code manually → "Look up" button triggers step 5 directly. If Riftcodex lookup misses → user fills fields manually.

### Bulk image import

Admin drops multiple card photos onto the drop zone. Each image goes through the same OCR pipeline sequentially with per-image status feedback.

```
1. AdminPageComponent — #addBulkFiles()
   └── Files validated (MIME + 5 MB cap), object URLs created for thumbnails

2. Per image — #handleBulkImport() loop:
   ├── CardOcrService.extractCardCode(file) → { setCode, collectorNum, cardNumber, variant }
   ├── RiftcodexService.lookupByCardCode(setCode, collectorNum) → match
   └── supabase.from('cards').insert([...])  — card_set_code + card_code stored; price defaults to 0.00

3. Status per item updates live in the queue UI:
   Pending → Scanning… → Looking up SFD-170… → Added: [name] | not-found | error
```

**Notes:**
- Riftcodex has no pricing data — `price` is always set to `0.00` on import; admin must update it manually
- Object URLs are revoked on panel close to prevent memory leaks
- Processing is sequential to avoid overwhelming the OCR edge function

### Secrets

| Secret | Where set | Used by |
|---|---|---|
| `ANTHROPIC_API_KEY` | `supabase secrets set ANTHROPIC_API_KEY=...` | `ocr-card` Edge Function |
| `ALLOWED_ORIGIN` | `supabase secrets set ALLOWED_ORIGIN=https://yourdomain.com` | `ocr-card` CORS header |

Deploy the function:
```bash
supabase functions deploy ocr-card --no-verify-jwt
```

`--no-verify-jwt` is intentional — the function does not access user data. JWT verification is skipped because the Supabase anon key (`sb_publishable_*` format) is not itself a valid JWT and causes 401s when passed as Bearer token from non-authenticated contexts. Abuse is limited by CORS origin lock + 4 MB payload cap.

---

## Security Model

### Input sanitization (client-side)

All database-sourced or user-controlled strings go through `src/utils/esc.ts` before `innerHTML` insertion. This applies to every component that renders card data: `CardGridComponent`, `CardsPageComponent`, `CardLightboxComponent`, `AdminPageComponent`.

CSS values (gradients, color hex) are validated through `safeCss()` — allowlist regex, returns empty string on any character outside `[\w\s#,()\-.%/]`.

URLs are validated through `safeUrl()` — rejects anything that isn't `http:` or `https:`.

### SQL injection

Not possible — all Supabase queries use the typed JS query builder (PostgREST). No raw SQL string construction anywhere in the codebase.

### Auth

- Admin route guarded in `App.ts` (client) and by RLS (server) independently
- Password reset redirect URL is hardcoded to `window.location.origin + '/#/reset-password'` — not derived from query params

### File uploads

- MIME type checked server-side before Supabase Storage upload
- Extension derived from `file.type`, never from `file.name`
- 5 MB cap enforced before upload

### API keys

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are intentionally public — Supabase anon keys are designed for browser use, protected by RLS
- `ANTHROPIC_API_KEY` lives only as a Supabase secret — never in `VITE_*` env vars, never in the browser bundle
- `.env.local` is in `.gitignore` and has never been committed

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` | Supabase anon/public key (safe to expose) |
| `ANTHROPIC_API_KEY` | Supabase secret | Anthropic API key — server-side only |
| `ALLOWED_ORIGIN` | Supabase secret | Allowed CORS origin for `ocr-card` function |

```bash
# .env.local (local dev only — never commit)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

---

## Local Development

```bash
npm install
npm run dev        # Vite dev server → http://localhost:5173
```

TypeScript check (no emit):
```bash
npx tsc --noEmit
```

---

## Deployment

### Frontend (Vercel)

```bash
npm run build      # outputs to dist/
vercel --prod
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the Vercel dashboard.

### Edge Function

```bash
supabase link --project-ref tqbbzxaozajwukcchdip
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ALLOWED_ORIGIN=https://yourdomain.com
supabase functions deploy ocr-card --no-verify-jwt
```

---

## Project Structure

```
src/
  App.ts                          — application root, boot + routing
  main.ts                         — entry point
  components/
    base/Component.ts             — base class: render() + afterMount() lifecycle
    layout/
      NavComponent.ts             — fixed nav, mobile hamburger, auth-aware
      FooterComponent.ts
    home/
      HeroComponent.ts
      StatsComponent.ts           — hardcoded stats (not live from DB — see DEV_NOTES.md #4)
      FeaturesComponent.ts
      CardGridComponent.ts        — homepage card preview (first 8 cards)
      CTAComponent.ts
    pages/
      CardsPageComponent.ts       — full card catalog with search + rarity filter
      AdminPageComponent.ts       — card CRUD, image upload, OCR scan pipeline
      LoginPageComponent.ts
      ResetPasswordPageComponent.ts
      AboutPageComponent.ts
    shared/
      CardLightboxComponent.ts    — modal overlay, focus trap, keyboard close
  models/
    Card.ts                       — ICard → Card (adds computed props: rarityClass, artGradient)
    CardCollection.ts             — array wrapper with filter helpers
  services/
    supabaseClient.ts             — singleton SupabaseClient
    CardService.ts                — fetchCards() with full relational join
    AuthService.ts                — sign in/out, session, password reset
    CardOcrService.ts             — image → base64 → edge function → parsed card code
    RiftcodexService.ts           — card index build + lookup + fuzzy search
    Router.ts                     — hash-based SPA router
    EventEmitter.ts               — typed pub/sub (card:open)
  utils/
    esc.ts                        — esc(), safeUrl(), safeCss() — XSS prevention
    sampleData.ts                 — offline fallback cards (16 cards, mirrors ICard shape)
    ScrollAnimator.ts             — IntersectionObserver for .stagger-in animations
  types/
    Card.types.ts
    Component.types.ts
    Event.types.ts
    Router.types.ts
    index.ts
  styles/
    _variables.css
    _base.css
    components/
      nav.css, cards.css, lightbox.css, admin.css, ...

supabase/
  migrations/
    001_create_cards_table.sql
    002_seed_cards.sql
    003_add_art_url.sql
    004_relational_schema.sql     — normalised rarities, sets, tags, RLS
    005_mana_cost_to_price.sql    — renames mana_cost → price, widens to NUMERIC(10,2), resets all rows to 0.00
    006_add_card_code.sql         — adds card_set_code TEXT and card_code TEXT (nullable) to cards
  functions/
    ocr-card/
      index.ts                    — Deno edge function, calls Anthropic API
```

---

## Known Issues / Planned Work

See [DEV_NOTES.md](../DEV_NOTES.md) for the full list. Key items:

- **Hardcoded homepage stats** — `StatsComponent` renders static strings, not live DB counts
- **Rate limiting on `ocr-card`** — no per-IP limit; mitigated by CORS lock and payload cap for now
- **RLS write policy** — any authenticated user can write cards; needs per-row ownership checks before ecommerce
- **Ecommerce not started** — schema design and service plan documented in DEV_NOTES.md
