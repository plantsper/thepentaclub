# Preferences

## Response Style
- Keep responses short and direct — no trailing summaries of what was just done
- Skip preamble ("I'll now...", "Let me...") — lead with the action or answer
- Don't restate what the user said; just do it
- Code references should use markdown links (e.g. `[AdminPageComponent.ts](src/...)`) not backtick-only

## Code Style
- Vanilla TypeScript, no framework — do not suggest React/Vue/etc.
- OOP component pattern: extend `Component`, implement `render()` + `afterMount()`
- Inline DOM mutations preferred over page reloads or full remounts when possible
- No browser `confirm()` / `alert()` — use inline DOM feedback elements
- Always use `esc()`, `safeUrl()`, `safeCss()` from `src/utils/esc.ts` before any `innerHTML` insertion
- Event delegation on persistent containers (e.g. `adminTableBody`) — avoids orphaned listeners on re-render
- Prefer `element.textContent =` over `innerHTML +=` for error messages (preserves existing listeners)

## UX Preferences
- Auto-populate form fields from OCR/Riftcodex — minimize manual entry
- Show per-item progress for batch operations (not just a spinner)
- Confirmations should be inline (in the row / panel), never blocking dialogs

## Security Non-Negotiables
- Anthropic API key stays server-side as a Supabase secret — never in `VITE_*` env vars
- All external strings through `esc()` before `innerHTML`
- MIME type checked from `file.type`, never from `file.name`
