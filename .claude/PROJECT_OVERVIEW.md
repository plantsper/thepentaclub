# The Pentaclub — Project Overview

Riftbound TCG card catalog SPA with a password-protected admin CMS. Vanilla TypeScript, no framework. Supabase backend. Claude vision OCR for card scanning via Edge Function.

**Deep technical details:** [infrastructure.md](./infrastructure.md)
**Roadmap + known issues:** [DEV_NOTES.md](../DEV_NOTES.md)

---

## Stack

- **Frontend:** Vanilla TypeScript, Vite, OOP component pattern (no React/Vue)
- **Backend:** Supabase (PostgreSQL + PostgREST + Auth + Storage + Edge Functions)
- **OCR:** Claude Haiku vision via `supabase/functions/ocr-card/` — Anthropic key never in browser
- **External:** Riftcodex public API (`https://api.riftcodex.com`) — card lookup by set code

---

## Routes

| Route | Component | Auth |
|---|---|---|
| `#/` | Home — Hero, Stats, CardGrid (8 cards), CTA | Public |
| `#/cards` | Full catalog, search + rarity filter | Public |
| `#/about` | Lore page | Public |
| `#/login` | Login + forgot password | Redirects to `/admin` if logged in |
| `#/reset-password` | New password after email link | Public |
| `#/admin` | Card CRUD, image upload, OCR scan | Redirects to `/login` if no session |

---

## Quick File Shortcuts

### "I need to change how cards are displayed"
- Grid on homepage → `src/components/home/CardGridComponent.ts`
- Full browse page → `src/components/pages/CardsPageComponent.ts`
- Lightbox modal → `src/components/shared/CardLightboxComponent.ts`
- Card CSS → `src/styles/components/cards.css`

### "I need to change the data model or DB query"
- Types → `src/types/Card.types.ts`
- Card class (computed props like `rarityClass`) → `src/models/Card.ts`
- Supabase fetch query → `src/services/CardService.ts`
- DB schema → `supabase/migrations/006_add_card_code.sql` (most recent)

### "I need to change the admin / CMS"
- All admin UI and logic → `src/components/pages/AdminPageComponent.ts`
- Image upload + MIME validation → `AdminPageComponent.ts:#handleImageUpload`
- Single card scan pipeline → `AdminPageComponent.ts:#handleCardScan`
- Bulk image import (drop zone → OCR → Riftcodex → DB) → `AdminPageComponent.ts:#handleBulkImport`
- Inline delete confirmation (no browser dialog) → `AdminPageComponent.ts:#promptDelete`
- Bulk delete (checkbox select + banner confirm) → `AdminPageComponent.ts:#executeBulkDelete`
- Card code fields (Set Code + Card Code) auto-filled by scan/import → `fCardSetCode`, `fCardCode`
- OCR service (browser side, variant detection + parsing) → `src/services/CardOcrService.ts`
- OCR edge function (server side, calls Anthropic) → `supabase/functions/ocr-card/index.ts`
- Card variant type → `CardVariant` in `CardOcrService.ts` (`standard` | `overnumber` | `alt-art` | `signature`)

### "I need to change auth"
- All auth calls → `src/services/AuthService.ts`
- Session state + route guards → `src/App.ts`
- Login UI → `src/components/pages/LoginPageComponent.ts`

### "I need to change navigation or routing"
- Nav component → `src/components/layout/NavComponent.ts`
- Nav CSS (including mobile) → `src/styles/components/nav.css`
- Route registration → `src/App.ts` (search `#router.register`)
- Router implementation → `src/services/Router.ts`

### "I need to fix a security / XSS issue"
- Escaping utilities → `src/utils/esc.ts` — `esc()`, `safeUrl()`, `safeCss()`
- All three must be applied before any `innerHTML` insertion of external data

### "I need to add a new page"
1. Create `src/components/pages/NewPageComponent.ts` extending `Component`
2. Add a mount div to the HTML skeleton in `App.ts:#init`
3. Register the route in `App.ts` with `#router.register`
4. Add nav link in `NavComponent.ts:render()`

---

## Data Model (brief)

```
Card
  id, name, type ('Champion'|'Spell'|'Artifact')
  price (NUMERIC 10,2 — sale price in dollars), attack, defense, description
  artUrl (Supabase Storage URL), artGradient (CSS fallback)
  rarity:       { id, name, sortOrder, colorHex }   ← from card_rarities table
  set:          { id, name, slug, description }      ← from card_sets table
  tags:         { id, name }[]                       ← via card_tags junction
  cardSetCode?  string  — Riftbound set abbreviation e.g. 'SFD', 'OGN'
  cardCode?     string  — Collector number / total with variant suffix
                          standard:   '170/221'
                          overnumber: '100/99'
                          alt-art:    '000a/100'
                          signature:  '200[*]/199'  (overnumber signature card)
```

Stat terminology in UI: `price → $X.XX` (pill badge top-left of card art), `attack → Power`, `defense → Health`.

`cardCode` and `cardSetCode` are shown beside the card name on all card layouts (grid, catalog, lightbox). They are nullable — existing cards imported before migration 006 will not have them until re-scanned or manually set.

`price` is always `0.00` after a Riftcodex auto-import — Riftcodex has no pricing data. Set it manually in the admin.

---

## Key Patterns

**Component lifecycle:** `new FooComponent(el, ...args).mount()` → calls `render()` (returns HTML string) then `afterMount()` (attaches listeners). Components remount fully on state change — no partial re-render.

**XSS safety:** Every DB string going into `innerHTML` uses `esc(s)`. URLs use `safeUrl(url)`. CSS values (gradients) use `safeCss(value)`. All three are in `src/utils/esc.ts`.

**Supabase client:** Always use `getSupabaseClient()` singleton from `src/services/supabaseClient.ts` — never `createClient()` directly. This keeps the auth session consistent across all service calls.

**Offline fallback:** If Supabase is unreachable on boot, `App.ts` falls back to 16 hardcoded cards from `src/utils/sampleData.ts`. Admin and auth are unavailable in fallback mode.

---

## Environment Variables

| Variable | Public? | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Protected by RLS — safe in browser |
| `ANTHROPIC_API_KEY` | **No** | Supabase secret only — never in `VITE_*` |
| `ALLOWED_ORIGIN` | **No** | Supabase secret — locks OCR function CORS |

---

## Known Gotchas

| Issue | Where to look |
|---|---|
| New page not routing | Check `App.ts` has the mount div + registered route |
| Supabase session lost between calls | Ensure all services use `getSupabaseClient()` singleton |
| OCR returning 401 | Edge function deployed with `--no-verify-jwt`; `sb_publishable_*` keys are not JWTs |
| Password reset redirect wrong | `AuthService.sendPasswordReset` uses `window.location.origin + '/#/reset-password'` |
| Admin account creation | Supabase Studio → Authentication → Users → Add user (no public sign-up) |
| Adding a field to cards | Update: `ICard` type → `Card` model → `CardService` query → migration → `sampleData.ts` |
| `price` shows as `$0.00` after bulk import | Riftcodex has no pricing — set price manually in the admin edit form |
| Card code not showing on existing cards | Migration 006 adds nullable columns — older cards need re-scan or manual entry in the admin form |
| Collector number regex | `\d+[a-z*]?` — captures standard digits, letter suffix (alt-art), asterisk suffix (signature) |
| Homepage stats are hardcoded | `StatsComponent.ts` — not connected to DB (tracked in DEV_NOTES.md #4) |
