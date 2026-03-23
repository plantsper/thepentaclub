import type { ICard, CardType, CardRarity, CardSet } from '../types';

export class Card implements ICard {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly type: CardType,
    public readonly rarity: CardRarity,
    public readonly manaCost: number,
    public readonly attack: number,
    public readonly defense: number,
    public readonly description: string,
    public readonly artGradient: string,
    public readonly set: CardSet,
    public readonly artUrl?: string
  ) {}

  get rarityClass(): string {
    return `tcg-card__rarity--${this.rarity.toLowerCase()}`;
  }
}
