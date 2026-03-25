-- Migration 011: Introduce riftcodex_catalog cache table.
-- Clean-DB migration — no backfill required (all existing cards deleted before running).
-- Run in Supabase Studio SQL Editor.

-- ── 1. Create riftcodex_catalog ───────────────────────────────────────────

CREATE TABLE riftcodex_catalog (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  set_code      TEXT        NOT NULL,
  collector_num INTEGER     NOT NULL,
  variant       TEXT        NOT NULL DEFAULT 'standard',
  CONSTRAINT chk_catalog_variant CHECK (
    variant IN ('standard', 'overnumber', 'alt-art', 'signature', 'unknown')
  ),

  name          TEXT        NOT NULL,
  type          TEXT,
  rarity_name   TEXT,
  set_name      TEXT,
  energy        INTEGER     NOT NULL DEFAULT 0,
  supertype     TEXT,
  attack        INTEGER     NOT NULL DEFAULT 0,
  defense       INTEGER     NOT NULL DEFAULT 0,
  description   TEXT        NOT NULL DEFAULT '',
  flavour       TEXT,
  artist        TEXT,
  domains       TEXT[]      NOT NULL DEFAULT '{}',
  image_url     TEXT,

  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (set_code, collector_num, variant)
);

ALTER TABLE riftcodex_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read catalog"  ON riftcodex_catalog FOR SELECT USING (true);
CREATE POLICY "Auth write catalog"   ON riftcodex_catalog FOR ALL    USING (auth.role() = 'authenticated');

-- ── 2. Create catalog_tags ────────────────────────────────────────────────

CREATE TABLE catalog_tags (
  catalog_id  UUID    NOT NULL REFERENCES riftcodex_catalog(id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES tags(id)              ON DELETE CASCADE,
  PRIMARY KEY (catalog_id, tag_id)
);

ALTER TABLE catalog_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read catalog_tags" ON catalog_tags FOR SELECT USING (true);
CREATE POLICY "Auth write catalog_tags"  ON catalog_tags FOR ALL    USING (auth.role() = 'authenticated');

-- ── 3. Add catalog_id FK to cards ─────────────────────────────────────────

ALTER TABLE cards ADD COLUMN catalog_id UUID REFERENCES riftcodex_catalog(id) ON DELETE SET NULL;

-- ── 4. Drop Riftcodex-sourced columns from cards ──────────────────────────

ALTER TABLE cards
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS type,
  DROP COLUMN IF EXISTS energy,
  DROP COLUMN IF EXISTS supertype,
  DROP COLUMN IF EXISTS attack,
  DROP COLUMN IF EXISTS defense,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS flavour,
  DROP COLUMN IF EXISTS artist,
  DROP COLUMN IF EXISTS domains,
  DROP COLUMN IF EXISTS riftcodex_art_url;

-- ── 5. Drop card_tags (tags now live on catalog_tags) ─────────────────────

DROP TABLE IF EXISTS card_tags;
