-- ── 004_relational_schema.sql ────────────────────────────────────────────────
-- Normalises rarity and set into lookup tables.
-- Adds a tags system with card_tags junction table.
-- Run in Supabase SQL Editor.
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Lookup tables ─────────────────────────────────────────────────────────────

CREATE TABLE card_rarities (
  id         SERIAL PRIMARY KEY,
  name       TEXT    NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL,
  color_hex  TEXT    NOT NULL DEFAULT '#566380'
);

CREATE TABLE card_sets (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  released    DATE,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE tags (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE card_tags (
  card_id UUID    REFERENCES cards(id) ON DELETE CASCADE,
  tag_id  INTEGER REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (card_id, tag_id)
);

-- 2. Seed lookup tables ────────────────────────────────────────────────────────

INSERT INTO card_rarities (name, sort_order, color_hex) VALUES
  ('Legendary', 1, '#fbbf24'),
  ('Epic',      2, '#a855f7'),
  ('Rare',      3, '#00c4ff'),
  ('Common',    4, '#566380');

INSERT INTO card_sets (name, slug, description) VALUES
  ('Rift Core',        'rift-core',        'The foundational set — where the story begins.'),
  ('Shattered Realms', 'shattered-realms', 'Chaos fractures the multiverse.'),
  ('Tidal Abyss',      'tidal-abyss',      'Ancient power stirs in the depths.'),
  ('Void Expanse',     'void-expanse',     'The space between worlds tears open.');

-- 3. Migrate cards table ───────────────────────────────────────────────────────

-- Add FK columns (nullable for now, so we can backfill)
ALTER TABLE cards
  ADD COLUMN rarity_id INTEGER REFERENCES card_rarities(id),
  ADD COLUMN set_id    INTEGER REFERENCES card_sets(id);

-- Backfill from existing string columns
UPDATE cards c
  SET rarity_id = r.id
  FROM card_rarities r
  WHERE c.rarity = r.name;

UPDATE cards c
  SET set_id = s.id
  FROM card_sets s
  WHERE c.set_name = s.name;

-- Make FKs required
ALTER TABLE cards
  ALTER COLUMN rarity_id SET NOT NULL,
  ALTER COLUMN set_id    SET NOT NULL;

-- Drop old string columns and their CHECK constraints
ALTER TABLE cards
  DROP COLUMN rarity,
  DROP COLUMN set_name;

-- 4. Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE card_rarities ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_sets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_tags     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON card_rarities FOR SELECT USING (true);
CREATE POLICY "Public read" ON card_sets     FOR SELECT USING (true);
CREATE POLICY "Public read" ON tags          FOR SELECT USING (true);
CREATE POLICY "Public read" ON card_tags     FOR SELECT USING (true);

CREATE POLICY "Auth write"  ON card_rarities FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Auth write"  ON card_sets     FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Auth write"  ON tags          FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Auth write"  ON card_tags     FOR ALL USING (auth.role() = 'authenticated');
