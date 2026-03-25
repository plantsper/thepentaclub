import { Component } from '../base/Component';
import type { ICard, ICardCollection, IEventEmitter } from '../../types';
import { esc, safeUrl, safeCss } from '../../utils/esc';
import { variantLabel } from '../../utils/cardVariant';
import { domainColor } from '../../utils/domainColors';

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

    const grid = document.getElementById('cardsGrid');
    grid?.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.tcg-card');
      if (!card) return;
      const found = this.#collection.all.find(c => c.id === card.dataset.cardId);
      if (found) this.#events.emit('card:open', found);
    });

    // Preload lightbox images on hover so they're cached before the user clicks
    const preloaded = new Set<string>();
    grid?.addEventListener('mouseover', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.tcg-card');
      if (!card?.dataset.cardId || preloaded.has(card.dataset.cardId)) return;
      preloaded.add(card.dataset.cardId);
      const found = this.#collection.all.find(c => c.id === card.dataset.cardId);
      if (!found) return;
      [found.artUrl, found.riftcodexArtUrl].forEach(url => {
        if (url) { const img = new Image(); img.src = url; }
      });
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
    return cards.map((card, i) => {
      const artSrc = safeUrl(card.artUrl ?? '');
      return `
      <div class="tcg-card stagger-in" style="transition-delay:${Math.min(i * 0.04, 0.5)}s" data-card-id="${card.id}">
        <div class="tcg-card__art">
          ${artSrc
            ? `<img class="tcg-card__art-img" src="${artSrc}" alt="${esc(card.name)}" loading="lazy" decoding="async">`
            : `<div class="tcg-card__art-bg" style="background:${safeCss(card.artGradient)}"></div>`
          }
          <span class="tcg-card__price-tag">$${card.price.toFixed(2)}</span>
        </div>
        <div class="tcg-card__info">
          <div class="tcg-card__name-row">
            <div class="tcg-card__name">${esc(card.name)}</div>
            ${card.cardSetCode ? `<span class="tcg-card__code">${esc(card.cardSetCode)}${card.cardCode ? ` ${esc(card.cardCode)}` : ''}</span>` : ''}
          </div>
          <div class="tcg-card__type">${esc(card.type)} &mdash; ${esc(card.set.name)}</div>
          ${card.domains?.length ? `<div class="tcg-card__domains">${card.domains.slice(0, 3).map(d => { const c = domainColor(d); return `<span class="tcg-card__domain-chip" style="background:${c}18;border-color:${c}50;color:${c}">${esc(d)}</span>`; }).join('')}</div>` : ''}
          <div class="tcg-card__footer">
            <span class="tcg-card__rarity-dot" style="background:${esc(card.rarity.colorHex)}"></span>
            <span class="tcg-card__rarity-name">${esc(card.rarity.name)}</span>
            ${variantLabel(card.variant) ? `<span class="tcg-card__variant-chip">${esc(variantLabel(card.variant)!)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
    }).join('');
  }
}
