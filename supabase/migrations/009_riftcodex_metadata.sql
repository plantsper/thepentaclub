-- Migration 009: Add Riftcodex metadata fields
-- New columns surfaced from Riftcodex API:
--   energy    — game stat (attributes.energy); separate from the dollar price field
--   supertype — classification.supertype e.g. 'Legend', null for non-legend cards
--   artist    — media.artist credit
--   flavour   — text.flavour italic flavour text
--   domains   — classification.domain[] e.g. '{Fury,Chaos}'

ALTER TABLE cards
  ADD COLUMN energy    INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN supertype TEXT,
  ADD COLUMN artist    TEXT,
  ADD COLUMN flavour   TEXT,
  ADD COLUMN domains   TEXT[]      NOT NULL DEFAULT '{}';
