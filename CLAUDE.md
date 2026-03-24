# CLAUDE.md — The Pentaclub

This is a routing file. Keep it under 150 lines. Detailed specs live in the files linked below.

---

## What This Project Is

Riftbound TCG card catalog SPA. Vanilla TypeScript + Vite. Supabase backend. Claude Haiku vision OCR via Edge Function. Single admin, Vercel deployed.

**Read first:**
- [Project overview + file shortcuts](.claude/PROJECT_OVERVIEW.md)
- [Infrastructure, schema, OCR pipeline](.claude/infrastructure.md)

**Context files (always loaded via @ include):**

@.claude/rules/memory-profile.md
@.claude/rules/memory-preferences.md
@.claude/rules/memory-decisions.md
@.claude/rules/memory-sessions.md
@.claude/rules/design-system.md

---

## Auto-Update Memory (MANDATORY)

**Update memory files AS YOU GO, not at the end.** When you learn something new, update immediately.

| Trigger | Action |
|---------|--------|
| User shares a fact about themselves | → Update `memory-profile.md` |
| User states a preference | → Update `memory-preferences.md` |
| A decision is made | → Update `memory-decisions.md` with date |
| Completing substantive work | → Add to `memory-sessions.md` |

**Skip:** Quick factual questions, trivial tasks with no new info.

**DO NOT ASK. Just update the files when you learn something.**

---

## Non-Negotiables

- **XSS:** All DB/user strings through `esc()`, `safeUrl()`, `safeCss()` before `innerHTML` — see `src/utils/esc.ts`
- **API key:** `ANTHROPIC_API_KEY` is a Supabase secret. Never suggest putting it in `VITE_*` env vars.
- **No browser dialogs:** No `confirm()`, `alert()`, `prompt()`. Inline DOM feedback only.
- **Supabase client:** Always use `getSupabaseClient()` singleton — never `createClient()` directly.

---

## Stack at a Glance

| Thing | Detail |
|---|---|
| Language | TypeScript (strict), no framework |
| Build | Vite → `dist/` |
| DB | Supabase PostgREST — NUMERIC returns as string, wrap in `Number()` |
| OCR | `supabase/functions/ocr-card/` → Claude Haiku → `parseCardCode()` |
| Card lookup | `src/services/RiftcodexService.ts` → `buildCardIndex()` → `lookupByCardCode()` |
| Deploy | `npm run build && vercel --prod` + `supabase functions deploy ocr-card --no-verify-jwt` |

---

---

## Skills

### ui-ux-pro-max (`.claude/skills/ui-ux-pro-max/`)

**Design system output is saved in `.claude/rules/design-system.md` — already loaded, no need to re-run.**

Only re-run the script if intentionally redesigning:
```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "dark gaming TCG card catalog collectible" --design-system -p "The Pentaclub" -f markdown
```

For deeper domain-specific lookups:
```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <color|style|typography|ux> -n 3
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --stack html-tailwind
```

---

## Reference Docs (not memory)

- [Vercel deployment](.claude/VERCEL_DEPLOYMENT.md)
- [Riftbound game research](.claude/riftbound-research.md)
- [Migration history](.claude/MIGRATION_COMPLETE.md)
