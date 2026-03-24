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
