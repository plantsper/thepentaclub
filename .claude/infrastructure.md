# Infrastructure: The Pentaclub

*Last updated: 2026-03-25. Current state: TypeScript SPA, Supabase backend, Claude vision OCR via Edge Function. Riftcodex metadata split into `riftcodex_catalog` cache table (migration 011). `cards` table holds only collection data + `catalog_id` FK. Dual-image lightbox carousel (user scan + Riftcodex art). Rune card format `R01a` supported.*

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
  ├── CardService.ts          ──→ Supabase PostgREST (cards + riftcodex_catalog join)
  ├── CatalogService.ts       ──→ Supabase PostgREST (riftcodex_catalog CRUD + tag sync)
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
                                  warmIndexFromCatalog() → DB first, API fallback
                                  pre-fetches ~939 cards → in-memory Map index

Supabase (PostgreSQL)
  ├── cards                   — collection data only (price, art_url, card_code, catalog_id FK)
  ├── riftcodex_catalog       — Riftcodex metadata cache, keyed by (set_code, collector_num, variant)
  ├── catalog_tags            — junction: riftcodex_catalog ↔ tags (replaced card_tags)
  ├── card_rarities           — lookup: Common / Uncommon / Rare / Epic / Showcase / Promo / Ultimate
  ├── card_sets               — lookup: Origins / Spiritforged / etc.
  └── tags                    — arbitrary keyword tags

Supabase Storage
  └── card-art (public bucket) — user scan images, referenced by cards.art_url
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
  price         NUMERIC(10,2) NOT NULL DEFAULT 0.00  -- sale price in dollars
  art_gradient  TEXT          NOT NULL DEFAULT ''    -- CSS gradient fallback
  art_url       TEXT                                 -- Supabase Storage user scan URL (nullable)
  rarity_id     INTEGER       FK → card_rarities(id) NOT NULL
  set_id        INTEGER       FK → card_sets(id)     NOT NULL
  catalog_id    UUID          FK → riftcodex_catalog(id) ON DELETE SET NULL
  card_set_code TEXT                                 -- Riftbound set abbreviation e.g. 'SFD', 'OGN'
  card_code     TEXT                                 -- Collector number / total with variant suffix
                                                     --   standard:   '170/221'
                                                     --   overnumber: '100/99'
                                                     --   alt-art:    '000a/100'
                                                     --   signature:  '200*/199'
                                                     --   rune:       'R01a/100'
  created_at    TIMESTAMPTZ   DEFAULT NOW()
)

riftcodex_catalog (
  id            UUID          PK default gen_random_uuid()
  set_code      TEXT          NOT NULL
  collector_num INTEGER       NOT NULL               -- stripped numeric only (no prefix/suffix)
  variant       TEXT          NOT NULL DEFAULT 'standard'
                                                     -- 'standard'|'overnumber'|'alt-art'|'signature'|'unknown'
  name, type, rarity_name, set_name
  energy, supertype, attack, defense, description
  flavour, artist, domains TEXT[], image_url         -- Riftcodex CDN art URL
  fetched_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
  UNIQUE (set_code, collector_num, variant)
)

catalog_tags (
  catalog_id UUID    FK → riftcodex_catalog(id) ON DELETE CASCADE
  tag_id     INTEGER FK → tags(id)              ON DELETE CASCADE
  PRIMARY KEY (catalog_id, tag_id)
)

card_rarities (
  id         SERIAL PK
  name       TEXT   UNIQUE  -- 'Common'|'Uncommon'|'Rare'|'Epic'|'Showcase'|'Promo'|'Ultimate'
  sort_order INTEGER
  color_hex  TEXT
)

card_sets (
  id          SERIAL PK
  name, slug, description TEXT
)

tags (
  id   SERIAL PK
  name TEXT UNIQUE
)
```

Note: `card_tags` was dropped in migration 011. Tags are now on `catalog_tags` (per card type, not per collection item).

### Row Level Security

All tables have RLS enabled. Public `SELECT`, authenticated `INSERT/UPDATE/DELETE` on all tables.

### Card query (full join)

`CardService.ts` fetches via PostgREST embedded select — `catalog_id` FK resolved automatically:

```typescript
supabase
  .from('cards')
  .select(`
    id, price, art_gradient, art_url, card_set_code, card_code, catalog_id,
    card_rarities(id, name, sort_order, color_hex),
    card_sets(id, name, slug, description),
    riftcodex_catalog(
      id, name, type, energy, supertype, attack, defense,
      description, flavour, artist, domains, image_url,
      catalog_tags(tags(id, name))
    )
  `)
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
   │     Prompt: preserve leading zeros (e.g. "059" not "59"), letter prefix (rune "R01a"),
   │             letter/asterisk suffix (alt-art "000a", signature "200*")
   └── Returns { raw: "SFD • 059/221" } / "SFD • R01a/100" / "SFD • 200*/199"

4. parseCardCode(raw) → { setCode, collectorNum, cardNumber, variant }
   Regex captures: optional letter prefix + digits + optional letter/asterisk suffix
   e.g. "R01a" → collectorNum="R01a", numeric part=1
   Variant detection (CardOcrService.ts):
     - suffix '*'    → 'signature'
     - suffix [a-z]  → 'alt-art'
     - num > total   → 'overnumber'
     - otherwise     → 'standard'

5. CatalogService.lookupOrFetch(setCode, numericCollector, variant, fetchFn)
   ├── DB cache hit (riftcodex_catalog) → return immediately, no API call
   ├── Cache miss → fetchFn calls RiftcodexService.lookupByCardCode → upsertCatalog
   └── Returns { catalogId, entry }   (TTL = 30 days)

6. #applyRiftcodexFields(fields, catalogId) — populates admin form (read-only fields)
   fCatalogId (hidden) ← catalogId  |  fCardSetCode ← setCode  |  fCardCode ← cardNumber
```

**Fallback chain:** If OCR fails → user enters card code manually → "Look up" button triggers step 5 directly. If Riftcodex lookup misses → user fills fields manually.

### Bulk image import

Admin drops multiple card photos onto the drop zone. Each image goes through the same OCR pipeline sequentially with per-image status feedback.

```
1. AdminPageComponent — #addBulkFiles()
   └── Files validated (MIME + 5 MB cap), object URLs created for thumbnails

2. Per image — #handleBulkImport() loop:
   ├── CardOcrService.extractCardCode(file) → { setCode, collectorNum, cardNumber }
   ├── Upload scan to Supabase Storage → art_url
   ├── CatalogService.lookupOrFetch(setCode, numericCollector, variant, fetchFn) → { catalogId, entry }
   └── supabase.from('cards').insert([{ catalog_id, art_url, rarity_id, set_id, card_code, price: 0 }])

3. Status per item updates live in the queue UI:
   Pending → Scanning… → Looking up SFD-059… → Uploading scan… → Added: [name] | not-found | error
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
    CardService.ts                — fetchCards() with riftcodex_catalog join
    CatalogService.ts             — DB cache: lookupCatalog, upsertCatalog, lookupOrFetch, warmIndexFromCatalog
    AuthService.ts                — sign in/out, session, password reset
    CardOcrService.ts             — image → base64 → edge function → parsed card code (handles R01a, 059)
    RiftcodexService.ts           — card index: setIndexFromCatalog (DB warm), buildCardIndex (API), lookupByCardCode
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
    007_fix_rarities.sql          — renames rarities to match Riftcodex exactly
    008_add_showcase_promo.sql    — adds Showcase + Promo rarities
    009_add_riftcodex_fields.sql  — adds energy, supertype, artist, flavour, domains to cards
    010_add_riftcodex_art_url.sql — adds riftcodex_art_url to cards (superseded by 011)
    011_riftcodex_catalog.sql     — creates riftcodex_catalog + catalog_tags; adds catalog_id FK;
                                    drops Riftcodex-sourced columns from cards; drops card_tags
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
