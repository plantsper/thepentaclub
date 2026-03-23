import { Card } from '../models/Card';
import type { ICard } from '../types';

export function createSampleCards(): ICard[] {
  const gradients = [
    'linear-gradient(135deg,#1a0a2e,#3d1a78,#00e68a)',
    'linear-gradient(135deg,#0a1628,#1a3a5c,#00c4ff)',
    'linear-gradient(135deg,#2e0a0a,#6b1a1a,#ff6b6b)',
    'linear-gradient(135deg,#0a2e1a,#1a784a,#00e68a)',
    'linear-gradient(135deg,#1a1a2e,#3d3d78,#a855f7)',
    'linear-gradient(135deg,#2e1a0a,#78501a,#ffd700)',
    'linear-gradient(135deg,#0a1a2e,#1a3d78,#00c4ff)',
    'linear-gradient(135deg,#1a0a1a,#5c1a5c,#ff69b4)',
    'linear-gradient(135deg,#0a2e2e,#1a7878,#00e6e6)',
    'linear-gradient(135deg,#2e2e0a,#78781a,#e6e600)',
    'linear-gradient(135deg,#100818,#2d1548,#8b5cf6)',
    'linear-gradient(135deg,#081018,#182838,#38bdf8)',
    'linear-gradient(135deg,#180808,#482818,#f97316)',
    'linear-gradient(135deg,#081810,#183828,#22c55e)',
    'linear-gradient(135deg,#181008,#483818,#eab308)',
    'linear-gradient(135deg,#100810,#381838,#ec4899)',
  ];

  const data: Array<[string, string, string, number, number, number, string, string]> = [
    ['Vexar, Riftwalker', 'Champion', 'Legendary', 8, 9, 7, 'Traverses dimensions at will', 'Rift Core'],
    ['Luminara Shield', 'Spell', 'Epic', 5, 0, 8, 'Creates an impenetrable barrier', 'Rift Core'],
    ['Shadow Stalker', 'Champion', 'Rare', 3, 6, 3, 'Strikes from the void', 'Rift Core'],
    ['Mana Surge', 'Spell', 'Common', 2, 0, 0, 'Restores 3 mana crystals', 'Rift Core'],
    ['Drakonith, World Eater', 'Champion', 'Legendary', 10, 12, 5, 'Devours entire realms', 'Shattered Realms'],
    ['Ethereal Blade', 'Artifact', 'Epic', 4, 7, 2, 'Cuts through magical defenses', 'Shattered Realms'],
    ['Thornweaver', 'Champion', 'Rare', 4, 5, 5, 'Commands living vines', 'Shattered Realms'],
    ['Crystal Shard', 'Artifact', 'Common', 1, 2, 1, 'A fragment of pure mana', 'Shattered Realms'],
    ['Azura, Tidecaller', 'Champion', 'Legendary', 7, 8, 8, 'Bends oceans to her will', 'Tidal Abyss'],
    ['Flamestrike', 'Spell', 'Epic', 6, 10, 0, 'Rains fire upon all enemies', 'Tidal Abyss'],
    ['Void Sentinel', 'Champion', 'Rare', 5, 4, 7, 'Guards the rift passages', 'Tidal Abyss'],
    ['Healing Spring', 'Spell', 'Common', 2, 0, 3, 'Restores health each turn', 'Tidal Abyss'],
    ['Nyx, Shadow Queen', 'Champion', 'Legendary', 9, 10, 6, 'Rules the darkness between worlds', 'Void Expanse'],
    ['Chronoshift', 'Spell', 'Epic', 7, 0, 0, 'Reverses the last two turns', 'Void Expanse'],
    ['Iron Golem', 'Champion', 'Rare', 6, 3, 9, 'Unyielding metal construct', 'Void Expanse'],
    ['Quick Draw', 'Spell', 'Common', 1, 3, 0, 'A swift surprise attack', 'Void Expanse'],
  ];

  return data.map((d, i) => new Card(
    `card-${i + 1}`,
    d[0],
    d[1] as 'Champion' | 'Spell' | 'Artifact',
    d[2] as 'Legendary' | 'Epic' | 'Rare' | 'Common',
    d[3],
    d[4],
    d[5],
    d[6],
    gradients[i % gradients.length],
    d[7] as 'Rift Core' | 'Shattered Realms' | 'Tidal Abyss' | 'Void Expanse'
  ));
}
