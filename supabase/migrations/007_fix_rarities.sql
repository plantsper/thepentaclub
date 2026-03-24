-- ── 007_fix_rarities.sql ─────────────────────────────────────────────────────
-- Replaces placeholder rarities with actual Riftbound TCG rarities.
-- Migration 004 seeded: Legendary, Epic, Rare, Common
-- Actual Riftbound rarities: Ultimate, Uncommon, Rare, Epic, Common, Overnumbered
-- Run in Supabase Studio SQL Editor.
-- Safe to re-run (idempotent).
-- ──────────────────────────────────────────────────────────────────────────────

-- Rename 'Legendary' → 'Uncommon' only if 'Legendary' still exists
-- (guard: skip if already renamed or 'Uncommon' already present)
UPDATE card_rarities
  SET name = 'Uncommon', color_hex = '#22d3ee', sort_order = 2
  WHERE name = 'Legendary';

-- Shift existing rarities to make room for Ultimate at sort_order 1
UPDATE card_rarities SET sort_order = 3 WHERE name = 'Rare';
UPDATE card_rarities SET sort_order = 4 WHERE name = 'Epic';
UPDATE card_rarities SET sort_order = 5 WHERE name = 'Common';

-- Upsert missing rarities — safe to re-run
INSERT INTO card_rarities (name, sort_order, color_hex) VALUES
  ('Ultimate',     1, '#fbbf24'),
  ('Overnumbered', 6, '#f97316')
ON CONFLICT (name) DO UPDATE
  SET sort_order = EXCLUDED.sort_order,
      color_hex  = EXCLUDED.color_hex;
