# Decisions

Architectural and product decisions made — reference before proposing alternatives.

---

## 2026-03-23

**Migrated to TypeScript + Vite**
Replaced the original vanilla JS with TypeScript SPA. Build output to `dist/`, deployed on Vercel as a static site.

**Replaced Tesseract.js with Claude Haiku vision**
Tesseract gave poor results on TCG card images. OCR now goes through a Supabase Edge Function (`ocr-card`) that calls `claude-haiku-4-5-20251001` server-side. API key stays in Supabase secrets, never in the browser bundle.

**Relational schema (migration 004)**
Normalised rarity and set into `card_rarities` and `card_sets` lookup tables. Tags system added via `card_tags` junction. This replaced string columns — do not suggest reverting to string-based rarity/set.

---

## 2026-03-24

**Replaced mana_cost with price (migration 005)**
Energy/mana concept dropped. Cards now have a dollar `price` (NUMERIC 10,2). Badge on card art changed from a circle to a pill shape. PostgREST returns NUMERIC as string — always wrap in `Number()` in CardService.

**Inline delete confirmation (no browser dialogs)**
`confirm()` replaced with inline row mutation: the actions cell swaps to "Delete [name]? Yes / No". No modal, no page interruption. `#promptDelete` / `#cancelPromptDelete` handle the swap.

**Bulk delete via banner, not modal**
Checkbox select-all + "Delete selected" toolbar button → banner above table with Confirm/Cancel. Dedicated `<span id="bulkDeleteError">` updated via `.textContent` — never `innerHTML +=` (would orphan the Confirm button listener).

**Bulk import via image drop zone (not textarea)**
Original textarea-based bulk add replaced with drag-and-drop image zone. Each image: OCR → Riftcodex lookup → DB insert. Queue shows per-item status with thumbnail previews. Object URLs revoked on panel close.

**Card code metadata (migration 006)**
Added `card_set_code TEXT` and `card_code TEXT` (nullable) to `cards`. Stores e.g. `SFD` + `170/221`. Both fields auto-populated by OCR scan and bulk import; editable in the admin form. Shown beside card name on all card layouts.

**Four card variant patterns**
Collector number regex: `\d+[a-z*]?` — captures letter suffix (alt-art `000a`) and asterisk suffix (signature `200*`). Variant derived at parse time, not stored:
- `standard` — digits only, collector ≤ total
- `overnumber` — digits only, collector > total
- `alt-art` — letter suffix
- `signature` — asterisk suffix (always also overnumber)

**OCR edge function deployed with `--no-verify-jwt`**
The Supabase anon key (`sb_publishable_*`) is not a valid JWT. Passing it as Bearer causes 401s. Abuse is mitigated by CORS origin lock (`ALLOWED_ORIGIN` secret) and 4 MB payload cap.

**CORS trailing-slash fix**
`ALLOWED_ORIGIN` must not have a trailing slash — browser sends origin without one, so exact-match fails. Edge function strips it: `.replace(/\/$/, '')`.

---

## 2026-03-24 (this session)

**Rarities must match Riftcodex exactly (migrations 007 + 008)**
Migration 004 seeded placeholder names (`Legendary`) that don't exist in Riftbound. Riftcodex returns `Common`, `Uncommon`, `Rare`, `Epic`, `Showcase`, `Promo` — DB must match these exactly or every lookup silently falls back to `#rarities[0]`. `Showcase` is Riftcodex's term for overnumbered/showcase cards. Do not rename back to `Overnumbered`. `Ultimate` is kept for Set 3 (not yet in Riftcodex).

**Variant suffix must be stripped before Riftcodex index lookup**
Alt-art collectorNum `"201a"` → `Number("201a")` = NaN → key `"SFD:NaN"` → no match. Always strip `[a-z*]+$` from collectorNum before calling `lookupByCardCode`. The stripped number finds the base card; variant is applied after.

**Overnumber/signature cards use "Showcase" rarity, not Riftcodex base rarity**
Riftcodex returns the base card's rarity (e.g. "Rare") even for showcase variants. After lookup, if `variant === 'overnumber' || variant === 'signature'`, override `rarityName` to `'Showcase'` before the DB rarity lookup.

**Variant is derived from card_code, not stored**
`card_code` already encodes the variant (`"220/219"` = overnumber, `"000a/100"` = alt-art, `"200[*]/199"` = signature). `variantFromCardCode()` in `src/utils/cardVariant.ts` derives it at runtime. No DB column needed — do not suggest adding one unless querying/filtering by variant is required.

**Rarity badge moved from card art to card info footer**
Top-right rarity badge on `.tcg-card__art` removed. A footer row with colored dot + rarity name + optional variant chip now lives at the bottom of `.tcg-card__info`. The lightbox retains its own rarity bar separately.

---

## 2026-03-24 (card UI session)

**Power/Health stats deprecated from all card surfaces**
Stats were noise for a browsing/collection context. Cards now show: art (with price pill) + name + type + footer (rarity dot + rarity name + variant chip). Lightbox shows: art (price pill only) + set label + name + type-line + description + rarity bar. Do not re-add Power/Health unless explicitly requested.

**Card code moved to lightbox rarity bar**
Was next to the name (collector metadata ≠ primary identity). Now right-aligned in the rarity bar: `● Rare   SFD 020/221`. Set name removed from rarity bar (already shown as `.lightbox__set` label at top). On the card grid, the code stays in the name row (space is limited; muted opacity keeps it secondary).

**Card grid layout uses flex column, not percentage heights**
`.tcg-card` is now `display: flex; flex-direction: column`. Art uses `aspect-ratio: 3/2.8; flex-shrink: 0` instead of `height: 58%`. Info section uses `flex: 1` to fill remaining height. Type line uses `flex: 1` to absorb slack, pinning the footer to the bottom. This eliminates dead space at any card width. Do not revert to `height: %` on the art — it breaks proportions at varying grid widths.

**`.tcg-card__rarity` CSS classes removed**
All rarity badge CSS (`--legendary`, `--epic`, `--rare`, `--common`, `--uncommon`, `--showcase`, `--promo`, `--ultimate`) deleted. The art badge was deprecated; these were orphaned. If rarity badges are ever needed again, re-add the CSS — do not assume it exists.
