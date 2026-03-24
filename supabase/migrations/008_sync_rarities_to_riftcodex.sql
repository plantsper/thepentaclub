-- ── 008_sync_rarities_to_riftcodex.sql ──────────────────────────────────────
-- Aligns card_rarities with the exact rarity strings Riftcodex API returns.
-- Riftcodex rarities: Common, Uncommon, Rare, Epic, Showcase, Promo
-- (Ultimate not yet in Riftcodex — kept for Set 3 future use)
-- Safe to re-run (idempotent).
-- ──────────────────────────────────────────────────────────────────────────────

-- Rename 'Overnumbered' → 'Showcase' (Riftcodex's term for overnumbered cards)
UPDATE card_rarities
  SET name = 'Showcase', sort_order = 6
  WHERE name = 'Overnumbered';

-- Add Promo (Riftcodex rarity for promotional cards)
INSERT INTO card_rarities (name, sort_order, color_hex) VALUES
  ('Promo', 7, '#ec4899')
ON CONFLICT (name) DO UPDATE
  SET sort_order = EXCLUDED.sort_order,
      color_hex  = EXCLUDED.color_hex;
