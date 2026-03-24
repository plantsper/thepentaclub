import { Component } from '../base/Component';
import type { ICard, ICardCollection, IEventEmitter } from '../../types';
import { esc, safeUrl, safeCss } from '../../utils/esc';

export class CardGridComponent extends Component {
  #collection: ICardCollection;
  #events: IEventEmitter;

  constructor(container: HTMLElement, collection: ICardCollection, events: IEventEmitter) {
    super(container);
    this.#collection = collection;
    this.#events = events;
  }

  afterMount(): void {
    const showcase = document.getElementById('cardShowcase');
    showcase?.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.tcg-card');
      if (!card) return;
      const found = this.#collection.all.find(c => c.id === card.dataset.cardId);
      if (found) this.#events.emit('card:open', found);
    });

    requestAnimationFrame(() => {
      document.querySelectorAll('#cardShowcase .stagger-in').forEach(el => el.classList.add('visible'));
    });
  }

  render(): string {
    return `
      <section class="section" id="preview">
        <div class="section__header">
          <div class="section__label">Preview</div>
          <h2 class="section__title">Featured Cards</h2>
          <p class="section__desc">A glimpse into the Riftbound universe. Hundreds more await.</p>
        </div>
        <div class="card-showcase" id="cardShowcase">
          ${this.#renderCards(this.#collection.all.slice(0, 8))}
        </div>
      </section>
    `;
  }

  #renderCards(cards: ICard[]): string {
    return cards.map((card, i) => {
      const artSrc = safeUrl(card.artUrl ?? '');
      const gradient = safeCss(card.artGradient);
      return `
      <div class="tcg-card stagger-in" style="transition-delay:${i * 0.06}s" data-card-id="${esc(card.id)}">
        <div class="tcg-card__art">
          ${artSrc
            ? `<img class="tcg-card__art-img" src="${artSrc}" alt="${esc(card.name)}" loading="lazy">`
            : `<div class="tcg-card__art-bg" style="background:${gradient}"></div>`
          }
          <span class="tcg-card__rarity ${esc(card.rarityClass)}">${esc(card.rarity.name)}</span>
          <span class="tcg-card__mana-cost">${Number(card.manaCost)}</span>
        </div>
        <div class="tcg-card__info">
          <div class="tcg-card__name">${esc(card.name)}</div>
          <div class="tcg-card__type">${esc(card.type)} &mdash; ${esc(card.set.name)}</div>
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
    `;
    }).join('');
  }
}
