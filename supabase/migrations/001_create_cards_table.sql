-- Create cards table
CREATE TABLE cards (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT        NOT NULL,
  type         TEXT        NOT NULL CHECK (type IN ('Champion', 'Spell', 'Artifact')),
  rarity       TEXT        NOT NULL CHECK (rarity IN ('Legendary', 'Epic', 'Rare', 'Common')),
  mana_cost    INTEGER     NOT NULL DEFAULT 0,
  attack       INTEGER     NOT NULL DEFAULT 0,
  defense      INTEGER     NOT NULL DEFAULT 0,
  description  TEXT        NOT NULL DEFAULT '',
  art_gradient TEXT        NOT NULL DEFAULT '',
  set_name     TEXT        NOT NULL CHECK (set_name IN ('Rift Core', 'Shattered Realms', 'Tidal Abyss', 'Void Expanse')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Public read (anyone can browse cards)
CREATE POLICY "Public can read cards"
  ON cards FOR SELECT
  USING (true);

-- Only authenticated admins can write
CREATE POLICY "Authenticated users can manage cards"
  ON cards FOR ALL
  USING (auth.role() = 'authenticated');
