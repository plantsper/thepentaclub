-- 005_mana_cost_to_price.sql
-- Renames mana_cost → price and widens the type to NUMERIC(10,2)
-- so the field can hold a dollar value (e.g. 9.99).
-- All existing rows are reset to 0.00 — they held game mana values
-- which have no relation to a sale price.

ALTER TABLE cards RENAME COLUMN mana_cost TO price;

ALTER TABLE cards
  ALTER COLUMN price TYPE NUMERIC(10,2)
  USING price::NUMERIC(10,2);

ALTER TABLE cards
  ALTER COLUMN price SET DEFAULT 0.00;

UPDATE cards SET price = 0.00;
