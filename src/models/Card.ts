import type { ICard, IRarity, ICardSet, ITag, CardType } from '../types';
import { variantFromCardCode } from '../utils/cardVariant';
import type { CardVariant } from '../utils/cardVariant';

export class Card implements ICard {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly type: CardType,
    public readonly rarity: IRarity,
    public readonly price: number,
    public readonly attack: number,
    public readonly defense: number,
    public readonly description: string,
    public readonly artGradient: string,
    public readonly set: ICardSet,
    public readonly tags: ITag[],
    public readonly artUrl?: string,
    public readonly cardSetCode?: string,
    public readonly cardCode?: string,
    public readonly energy: number = 0,
    public readonly supertype?: string,
    public readonly domains: string[] = [],
    public readonly flavour?: string,
    public readonly artist?: string,
    public readonly riftcodexArtUrl?: string
  ) {}

  get rarityClass(): string {
    return `tcg-card__rarity--${this.rarity.name.toLowerCase()}`;
  }

  get variant(): CardVariant {
    return variantFromCardCode(this.cardCode);
  }
}
