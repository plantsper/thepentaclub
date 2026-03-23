export type CardType = 'Champion' | 'Spell' | 'Artifact';

export interface IRarity {
  id: number;
  name: string;
  sortOrder: number;
  colorHex: string;
}

export interface ICardSet {
  id: number;
  name: string;
  slug: string;
  description: string;
}

export interface ITag {
  id: number;
  name: string;
}

export interface ICard {
  id: string;
  name: string;
  type: CardType;
  rarity: IRarity;
  manaCost: number;
  attack: number;
  defense: number;
  description: string;
  artGradient: string;
  artUrl?: string;
  set: ICardSet;
  tags: ITag[];
  readonly rarityClass: string;
}

export interface ICardCollection {
  readonly all: ICard[];
  readonly count: number;
  add(card: ICard): void;
  filterByRarity(rarityName: string | 'all'): ICard[];
  filterByType(type: CardType | 'all'): ICard[];
  search(query: string): ICard[];
}
