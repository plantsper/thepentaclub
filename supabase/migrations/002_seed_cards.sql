-- Seed sample cards
INSERT INTO cards (name, type, rarity, mana_cost, attack, defense, description, art_gradient, set_name) VALUES
  ('Vexar, Riftwalker',    'Champion', 'Legendary', 8, 9,  7,  'Traverses dimensions at will',       'linear-gradient(135deg,#1a0a2e,#3d1a78,#00e68a)', 'Rift Core'),
  ('Luminara Shield',      'Spell',    'Epic',       5, 0,  8,  'Creates an impenetrable barrier',    'linear-gradient(135deg,#0a1628,#1a3a5c,#00c4ff)', 'Rift Core'),
  ('Shadow Stalker',       'Champion', 'Rare',       3, 6,  3,  'Strikes from the void',              'linear-gradient(135deg,#2e0a0a,#6b1a1a,#ff6b6b)', 'Rift Core'),
  ('Mana Surge',           'Spell',    'Common',     2, 0,  0,  'Restores 3 mana crystals',           'linear-gradient(135deg,#0a2e1a,#1a784a,#00e68a)', 'Rift Core'),
  ('Drakonith, World Eater','Champion','Legendary',  10,12, 5,  'Devours entire realms',              'linear-gradient(135deg,#1a1a2e,#3d3d78,#a855f7)', 'Shattered Realms'),
  ('Ethereal Blade',       'Artifact', 'Epic',       4, 7,  2,  'Cuts through magical defenses',      'linear-gradient(135deg,#2e1a0a,#78501a,#ffd700)', 'Shattered Realms'),
  ('Thornweaver',          'Champion', 'Rare',       4, 5,  5,  'Commands living vines',              'linear-gradient(135deg,#0a1a2e,#1a3d78,#00c4ff)', 'Shattered Realms'),
  ('Crystal Shard',        'Artifact', 'Common',     1, 2,  1,  'A fragment of pure mana',            'linear-gradient(135deg,#1a0a1a,#5c1a5c,#ff69b4)', 'Shattered Realms'),
  ('Azura, Tidecaller',    'Champion', 'Legendary',  7, 8,  8,  'Bends oceans to her will',           'linear-gradient(135deg,#0a2e2e,#1a7878,#00e6e6)', 'Tidal Abyss'),
  ('Flamestrike',          'Spell',    'Epic',       6, 10, 0,  'Rains fire upon all enemies',        'linear-gradient(135deg,#2e2e0a,#78781a,#e6e600)', 'Tidal Abyss'),
  ('Void Sentinel',        'Champion', 'Rare',       5, 4,  7,  'Guards the rift passages',           'linear-gradient(135deg,#100818,#2d1548,#8b5cf6)', 'Tidal Abyss'),
  ('Healing Spring',       'Spell',    'Common',     2, 0,  3,  'Restores health each turn',          'linear-gradient(135deg,#081018,#182838,#38bdf8)', 'Tidal Abyss'),
  ('Nyx, Shadow Queen',    'Champion', 'Legendary',  9, 10, 6,  'Rules the darkness between worlds',  'linear-gradient(135deg,#180808,#482818,#f97316)', 'Void Expanse'),
  ('Chronoshift',          'Spell',    'Epic',       7, 0,  0,  'Reverses the last two turns',        'linear-gradient(135deg,#081810,#183828,#22c55e)', 'Void Expanse'),
  ('Iron Golem',           'Champion', 'Rare',       6, 3,  9,  'Unyielding metal construct',         'linear-gradient(135deg,#181008,#483818,#eab308)', 'Void Expanse'),
  ('Quick Draw',           'Spell',    'Common',     1, 3,  0,  'A swift surprise attack',            'linear-gradient(135deg,#100810,#381838,#ec4899)', 'Void Expanse');
