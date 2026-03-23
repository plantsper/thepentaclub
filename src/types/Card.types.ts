export type CardType = 'Champion' | 'Spell' | 'Artifact';
export type CardRarity = 'Legendary' | 'Epic' | 'Rare' | 'Common';
export type CardSet = 'Rift Core' | 'Shattered Realms' | 'Tidal Abyss' | 'Void Expanse';

export interface ICard {
  id: string;
  name: string;
  type: CardType;
  rarity: CardRarity;
  manaCost: number;
  attack: number;
  defense: number;
  description: string;
  artGradient: string;
  set: CardSet;
  readonly rarityClass: string;
}

export interface ICardCollection {
  readonly all: ICard[];
  readonly count: number;
  add(card: ICard): void;
  filterByRarity(rarity: CardRarity | 'all'): ICard[];
  filterByType(type: CardType | 'all'): ICard[];
  search(query: string): ICard[];
}
