# Sessions

Rolling summary — most recent first. Keep last 5 sessions; archive older ones.

---

## 2026-03-24 (latest)

**Card UI cleanup — stats removal, lightbox redesign, layout fix**

**Stats deprecated**
- Power/Health row removed from card grid (`CardGridComponent`) and catalog (`CardsPageComponent`)
- Lightbox stats section (Power, Health, Price boxes) removed entirely — price already shown as pill on art
- Rarity badge removed from lightbox art — rarity bar in body is the single rarity display

**Lightbox refinements**
- Art column widened 260px → 300px; dialog `max-height` 88vh → 92vh — card renders larger with less blank blurred space
- Card code moved from name row to rarity bar (right-aligned): `● Rare   SFD 020/221`
- Removed redundant set name from rarity bar (already shown as the top `.lightbox__set` label)
- `margin-left: auto` on card code moved from inline style to CSS: `.lightbox__rarity-bar .lightbox__card-code`
- Removed redundant `margin-top: auto` on `.lightbox__rarity-bar` (`.lightbox__desc { flex: 1 }` already pins it)

**Card grid layout fix**
- `.tcg-card` made a flex column — enables info section to fill remaining height
- `.tcg-card__art` switched from `height: 58%` to `aspect-ratio: 3/2.8; flex-shrink: 0` — fixed art proportion regardless of card size
- `.tcg-card__info` made `display: flex; flex-direction: column; flex: 1` — stretches to fill remaining card height
- `.tcg-card__type` given `flex: 1` — absorbs slack so footer always pins to bottom; margin-based spacing removed
- `aspect-ratio: 3/4.7` → `3/4.3` — reduced since stats row is gone

**CSS dead code removed**
- `.tcg-card__rarity` base class + all 8 modifier classes (`--legendary`, `--epic`, `--rare`, `--common`, `--uncommon`, `--showcase`, `--promo`, `--ultimate`) deleted — art badge was removed, these were orphaned

---

## 2026-03-24 (previous)

**Rarity pipeline overhaul + variant metadata + card layout**

**Rarity mapping fixed (migrations 007 + 008)**
- Migration 007: renamed `Legendary` → `Uncommon`, added `Ultimate` + `Overnumbered`, reordered sort_orders
- Discovered Riftcodex uses `"Showcase"` not `"Overnumbered"` by fetching the live API
- Migration 008: renamed `Overnumbered` → `Showcase`, added `Promo` — DB now exactly matches Riftcodex rarity strings
- Full Riftcodex rarity set: `Common`, `Uncommon`, `Rare`, `Epic`, `Showcase`, `Promo` (`Ultimate` kept for Set 3)
- CSS rarity badge classes added: `--uncommon`, `--showcase`, `--promo`, `--ultimate`

**Variant detection hardened**
- Root cause of "everything tagged Ultimate": alt-art collectorNum `"201a"` → `Number("201a")` = NaN → index key `"SFD:NaN"` → no Riftcodex match → silent fallback to `#rarities[0]`
- Fix: strip letter/asterisk suffix before lookup (`"201a"` → `"201"`) in both scan paths
- Overnumber/signature variants now override Riftcodex rarity to `"Showcase"` after lookup
- `detectVariant` + `variantFromCardCode` + `variantLabel` extracted to `src/utils/cardVariant.ts` (shared utility)
- `CardOcrService` now re-exports `CardVariant` type from shared util
- `variant` getter added to `Card` model — derived from stored `card_code` at runtime, no DB column needed
- `ICard` interface updated with `readonly variant: CardVariant`

**Variant surfaced in UI**
- Admin table: variant badge (`Alt Art` / `Overnumber` / `Signature`) shown inline in the Code column
- Lightbox: variant badge shown in type-line alongside card type badge

**Card layout**
- Top-right rarity badge removed from card art in both `CardGridComponent` and `CardsPageComponent`
- Footer row added to `.tcg-card__info`: colored rarity dot (from `rarity.colorHex`) + rarity name + optional variant chip
- `aspect-ratio: 3/4.2` → `3/4.7`; art height `65%` → `58%`; info bottom padding increased to `18px`

**Heading font**
- `EB Garamond` → `Domine` (weights 400–700); updated `_variables.css`, `index.html`, `design-system.md`

---

## 2026-03-24 (previous)

**Design system migration + heading font refinement**
- Google Fonts: `Outfit`/`Crimson Pro` → `EB Garamond` (headings) + `Chakra Petch` (body)
- `--font-display: 'EB Garamond', serif` in `_variables.css` and `index.html` inline `:root`
- `font-family: var(--font-display)` applied to: `.hero__title`, `.nav__logo-text`, `.section__title`, `.feature-card__title`, `.stat__value`, `.lightbox__name`, `.cta-section__title`, `.admin-title`, `.admin-form__title`
- EB Garamond weights 400–800 available; headings use `font-weight: 700–800`, letter-spacing `-0.01em` to `-0.02em`
- Card depth enhanced: `.tcg-card` resting 2-layer shadow; hover 4-layer with accent ring
- `.feature-card:hover`: 3-layer shadow + faint accent ring
- `.lightbox__dialog` and `.auth-card`: deeper layered shadows
- `.lightbox__desc`: removed Crimson Pro italic; now `Chakra Petch` weight 300

---

## 2026-03-24 (current)

**Card code metadata + variant recognition**
- Migration 006: added `card_set_code TEXT`, `card_code TEXT` (nullable) to `cards`
- `parseCardCode` regex updated to `\d+[a-z*]?` — captures alt-art (`000a`) and signature (`200*`) suffixes
- New `CardVariant` type: `standard | overnumber | alt-art | signature | unknown`
- `detectVariant()` derives type from parsed collector number — not stored in DB
- OCR prompt updated to instruct Haiku to preserve letter/asterisk suffixes exactly
- Admin form: new Set Code + Card Code fields, auto-filled by `#handleCardScan` and `#handleBulkImport`
- Admin table: new Code column between Name and Type; colspan updated to 10
- Card layouts (grid, catalog, lightbox): card code shown beside name in muted small text
- Docs updated: `infrastructure.md` and `PROJECT_OVERVIEW.md` reflect schema, OCR, and variant patterns
- CLAUDE.md + `.claude/rules/` memory architecture set up

**Pending deploy steps (not yet done):**
1. Run migration 006 in Supabase Studio SQL Editor
2. `supabase functions deploy ocr-card --no-verify-jwt` (for the prior CORS fix)
3. `npm run build && vercel --prod`

---

## 2026-03-24 (earlier)

**Bulk image import + CORS fix**
- Bulk add refactored from textarea to image drop zone: drag-and-drop, per-item queue with thumbnails and live status
- `#handleBulkImport`: OCR each image → Riftcodex lookup → DB insert, all sequential
- Riftcodex index checked with `isIndexReady()` after `await buildCardIndex()` — explicit error if still empty
- Object URL lifecycle: created in `#addBulkFiles`, revoked individually on remove, batch-revoked on panel close
- CORS fix: `ALLOWED_ORIGIN` secret had trailing slash; edge function now strips it with `.replace(/\/$/, '')`
- Diagnosed "cards not showing" bug: `App.ts` catch-all swallows `fetchCards()` errors and falls back to sample data — root cause is migration 005 not yet run on production

---

## 2026-03-23

**mana_cost → price refactor**
- Migration 005: `ALTER TABLE cards RENAME COLUMN mana_cost TO price`, widen to `NUMERIC(10,2)`, reset to 0.00
- Card badge: purple circle removed, replaced with green pill shape (`.tcg-card__price-tag`)
- All types, model, service, components updated; PostgREST returns NUMERIC as string — wrapped in `Number()`
- Admin form label: "Energy Cost" → "Price ($)", step 0.01
- Riftcodex `manaCost` field intentionally NOT used for price — Riftcodex has no pricing data

**Admin delete overhaul**
- All `confirm()` dialogs removed
- Inline row confirmation: `#promptDelete` / `#cancelPromptDelete` swap actions cell HTML
- Bulk delete: checkbox column + "Delete selected" toolbar → banner with dedicated error span
- `#executeBulkDelete` disables both buttons during operation to prevent double-click race

**Bulk add (original — textarea, later replaced)**
- Initial bulk add used a textarea for card codes; replaced same session with image drop zone
