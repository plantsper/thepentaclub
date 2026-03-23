import type { ICard, ICardCollection, CardRarity, CardType } from '../types';

export class CardCollection implements ICardCollection {
  #cards: ICard[] = [];

  constructor(cards: ICard[] = []) {
    this.#cards = cards;
  }

  get all(): ICard[] {
    return [...this.#cards];
  }

  get count(): number {
    return this.#cards.length;
  }

  add(card: ICard): void {
    this.#cards.push(card);
  }

  filterByRarity(rarity: CardRarity | 'all'): ICard[] {
    if (rarity === 'all') return this.all;
    return this.#cards.filter(c => c.rarity.toLowerCase() === rarity.toLowerCase());
  }

  filterByType(type: CardType | 'all'): ICard[] {
    if (type === 'all') return this.all;
    return this.#cards.filter(c => c.type.toLowerCase() === type.toLowerCase());
  }

  search(query: string): ICard[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.all;
    return this.#cards.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  }
}
