import { Component } from '../base/Component';
import type { ICard, ICardCollection, IEventEmitter } from '../../types';
import { esc, safeUrl, safeCss } from '../../utils/esc';
import { variantLabel } from '../../utils/cardVariant';
import { domainColor } from '../../utils/domainColors';

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

    // Preload lightbox images on hover so they're cached before the user clicks
    const preloaded = new Set<string>();
    showcase?.addEventListener('mouseover', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.tcg-card');
      if (!card?.dataset.cardId || preloaded.has(card.dataset.cardId)) return;
      preloaded.add(card.dataset.cardId);
      const found = this.#collection.all.find(c => c.id === card.dataset.cardId);
      if (!found) return;
      [found.artUrl, found.riftcodexArtUrl].forEach(url => {
        if (url) { const img = new Image(); img.src = url; }
      });
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
            ? `<img class="tcg-card__art-img" src="${artSrc}" alt="${esc(card.name)}" loading="lazy" decoding="async">`
            : `<div class="tcg-card__art-bg" style="background:${gradient}"></div>`
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
