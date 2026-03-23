import { Component } from '../base/Component';
import type { ICard, ICardCollection, IEventEmitter } from '../../types';

export class CardsPageComponent extends Component {
  #collection: ICardCollection;
  #events: IEventEmitter;
  #activeRarity: string = 'all';
  #searchQuery: string = '';

  constructor(container: HTMLElement, collection: ICardCollection, events: IEventEmitter) {
    super(container);
    this.#collection = collection;
    this.#events = events;
  }

  render(): string {
    // Derive unique rarities sorted by sortOrder for filter buttons
    const rarities = [...new Map(
      this.#collection.all.map(c => [c.rarity.id, c.rarity])
    ).values()].sort((a, b) => a.sortOrder - b.sortOrder);

    const rarityButtons = rarities.map(r =>
      `<button class="filter-btn" data-rarity="${r.name}">${r.name}</button>`
    ).join('');

    return `
      <div class="section" style="padding-top:32px">
        <div class="section__header">
          <div class="section__label">Collection</div>
          <h2 class="section__title">All Cards</h2>
          <p class="section__desc">Browse the complete Riftbound card collection. Filter by rarity or search by name.</p>
        </div>
        <div class="cards-toolbar">
          <div style="position:relative;flex:1;min-width:200px">
            <svg style="position:absolute;left:12px;top:50%;transform:translateY(-50%);opacity:0.4" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input class="cards-toolbar__search" id="cardSearch" type="text" placeholder="Search cards...">
          </div>
          <button class="filter-btn active" data-rarity="all">All</button>
          ${rarityButtons}
        </div>
        <div class="card-showcase" id="cardsGrid"></div>
      </div>
    `;
  }

  afterMount(): void {
    this.#renderGrid();

    document.getElementById('cardsGrid')?.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.tcg-card');
      if (!card) return;
      const found = this.#collection.all.find(c => c.id === card.dataset.cardId);
      if (found) this.#events.emit('card:open', found);
    });

    const searchInput = document.getElementById('cardSearch') as HTMLInputElement | null;
    searchInput?.addEventListener('input', (e) => {
      this.#searchQuery = (e.target as HTMLInputElement).value;
      this.#renderGrid();
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.#activeRarity = (btn as HTMLElement).dataset.rarity ?? 'all';
        this.#renderGrid();
      });
    });
  }

  #renderGrid(): void {
    let cards = this.#collection.filterByRarity(this.#activeRarity);

    if (this.#searchQuery) {
      const q = this.#searchQuery.toLowerCase();
      cards = cards.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q)
      );
    }

    const grid = document.getElementById('cardsGrid');
    if (!grid) return;

    if (cards.length === 0) {
      grid.innerHTML = '<div class="empty-state">No cards found matching your criteria.</div>';
      return;
    }

    grid.innerHTML = this.#renderCards(cards);

    requestAnimationFrame(() => {
      grid.querySelectorAll('.stagger-in').forEach(el => el.classList.add('visible'));
    });
  }

  #renderCards(cards: ICard[]): string {
    return cards.map((card, i) => `
      <div class="tcg-card stagger-in" style="transition-delay:${Math.min(i * 0.04, 0.5)}s" data-card-id="${card.id}">
        <div class="tcg-card__art">
          ${card.artUrl
            ? `<img class="tcg-card__art-img" src="${card.artUrl}" alt="${card.name}" loading="lazy">`
            : `<div class="tcg-card__art-bg" style="background:${card.artGradient}"></div>`
          }
          <span class="tcg-card__rarity ${card.rarityClass}">${card.rarity.name}</span>
          <span class="tcg-card__mana-cost">${card.manaCost}</span>
        </div>
        <div class="tcg-card__info">
          <div class="tcg-card__name">${card.name}</div>
          <div class="tcg-card__type">${card.type} &mdash; ${card.set.name}</div>
          <div class="tcg-card__stats-row">
            <span class="tcg-card__stat tcg-card__stat--atk">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M14.7 2.3a1 1 0 0 0-1.4 0l-4.6 4.6L6 4.2a1 1 0 0 0-1.4 0L2.3 6.5a1 1 0 0 0 0 1.4L5 10.6l-2.3 2.3a1 1 0 0 0 0 1.4l6 6a1 1 0 0 0 1.4 0l2.3-2.3 2.7 2.7a1 1 0 0 0 1.4 0l2.3-2.3a1 1 0 0 0 0-1.4L16.1 14.3l4.6-4.6a1 1 0 0 0 0-1.4l-6-6z"/></svg>
              ${card.attack}
            </span>
            <span class="tcg-card__stat tcg-card__stat--def">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/></svg>
              ${card.defense}
            </span>
          </div>
        </div>
      </div>
    `).join('');
  }
}
