-- ── 006_add_card_code.sql ─────────────────────────────────────────────────────
-- Adds card code metadata to each card.
--   card_set_code  TEXT  — Riftbound set abbreviation (e.g. 'SFD', 'OGN')
--   card_code      TEXT  — Collector number / total, with variant suffix if any
--                          e.g. '170/221'  (standard)
--                               '100/99'   (overnumber)
--                               '000a/100' (alt art)
--                               '200*/199' (signature overnumber)
-- Run in Supabase SQL Editor.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE cards
  ADD COLUMN card_set_code TEXT,
  ADD COLUMN card_code     TEXT;
