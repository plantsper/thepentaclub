export type CardType = 'Champion' | 'Spell' | 'Artifact';

export type { CardVariant } from '../utils/cardVariant';

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
  price: number;
  attack: number;
  defense: number;
  description: string;
  artGradient: string;
  artUrl?: string;
  set: ICardSet;
  tags: ITag[];
  /** Riftbound set abbreviation, e.g. 'SFD', 'OGN' */
  cardSetCode?: string;
  /** Collector number / total with variant suffix, e.g. '170/221', '000a/100', '200[*]/199' */
  cardCode?: string;
  /** Game energy cost (attributes.energy from Riftcodex) */
  energy: number;
  /** Card supertype, e.g. 'Legend' — null for non-legend cards */
  supertype?: string;
  /** Domain/element classification array, e.g. ['Fury', 'Chaos'] */
  domains: string[];
  /** Flavour text (text.flavour from Riftcodex) */
  flavour?: string;
  /** Card artist credit (media.artist from Riftcodex) */
  artist?: string;
  readonly rarityClass: string;
  readonly variant: import('../utils/cardVariant').CardVariant;
}

export interface ICardCollection {
  readonly all: ICard[];
  readonly count: number;
  add(card: ICard): void;
  filterByRarity(rarityName: string | 'all'): ICard[];
  filterByType(type: CardType | 'all'): ICard[];
  search(query: string): ICard[];
}
