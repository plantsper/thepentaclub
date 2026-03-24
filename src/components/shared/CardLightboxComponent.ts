import { Component } from '../base/Component';
import type { ICard, IEventEmitter } from '../../types';
import { esc, safeUrl } from '../../utils/esc';
import { variantLabel } from '../../utils/cardVariant';

function safeHex(hex: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(hex) ? hex : '#566380';
}

export class CardLightboxComponent extends Component {
  #events: IEventEmitter;
  #previouslyFocused: HTMLElement | null = null;

  constructor(container: HTMLElement, events: IEventEmitter) {
    super(container);
    this.#events = events;
  }

  render(): string {
    return `
      <div class="lightbox" id="cardLightbox">
        <div class="lightbox__backdrop" id="lightboxBackdrop"></div>
        <div class="lightbox__dialog" role="dialog" aria-modal="true">
          <button class="lightbox__close" id="lightboxClose" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
          <div class="lightbox__art" id="lightboxArt"></div>
          <div class="lightbox__body" id="lightboxBody"></div>
        </div>
      </div>
    `;
  }

  afterMount(): void {
    document.getElementById('lightboxBackdrop')?.addEventListener('click', () => this.#close());
    document.getElementById('lightboxClose')?.addEventListener('click', () => this.#close());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.#close();
    });

    // Focus trap: keep Tab/Shift+Tab inside the dialog while open
    document.querySelector('.lightbox__dialog')?.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key !== 'Tab') return;
      const dialog = e.currentTarget as HTMLElement;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if ((e as KeyboardEvent).shiftKey && document.activeElement === first) {
        (e as KeyboardEvent).preventDefault();
        last.focus();
      } else if (!(e as KeyboardEvent).shiftKey && document.activeElement === last) {
        (e as KeyboardEvent).preventDefault();
        first.focus();
      }
    });

    this.#events.on<ICard>('card:open', (card) => this.#open(card));
  }

  #open(card: ICard): void {
    const lightbox = document.getElementById('cardLightbox');
    const art = document.getElementById('lightboxArt');
    const body = document.getElementById('lightboxBody');
    if (!lightbox || !art || !body) return;

    const artSrc = safeUrl(card.artUrl ?? '');
    if (artSrc) {
      art.style.background = '';
      art.style.setProperty('--art-url', `url('${artSrc}')`);
      art.innerHTML = `
        <img class="lightbox__art-img" src="${artSrc}" alt="${esc(card.name)}">
        <span class="lightbox__price">$${card.price.toFixed(2)}</span>
      `;
    } else {
      art.style.removeProperty('--art-url');
      art.style.background = card.artGradient;
      art.innerHTML = `
        <span class="lightbox__price">$${card.price.toFixed(2)}</span>
      `;
    }

    const rc = safeHex(card.rarity.colorHex);

    body.innerHTML = `
      <div class="lightbox__set">${esc(card.set.name)}</div>
      <div class="lightbox__name-row">
        <h2 class="lightbox__name">${esc(card.name)}</h2>
      </div>
      <div class="lightbox__type-line">
        <span class="lightbox__type-badge">${esc(card.type)}</span>
        ${variantLabel(card.variant) ? `<span class="lightbox__variant-badge">${esc(variantLabel(card.variant)!)}</span>` : ''}
      </div>
      <p class="lightbox__desc">${esc(card.description)}</p>
      <div class="lightbox__rarity-bar" style="background:${rc}18;border-color:${rc}40">
        <span class="lightbox__rarity-dot" style="background:${rc}"></span>
        <span style="color:${rc};font-weight:600;font-size:13px">${esc(card.rarity.name)}</span>
        ${card.cardSetCode ? `<span class="lightbox__card-code">${esc(card.cardSetCode)}${card.cardCode ? ` ${esc(card.cardCode)}` : ''}</span>` : ''}
      </div>
    `;

    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog and remember where it came from
    this.#previouslyFocused = document.activeElement as HTMLElement;
    const closeBtn = document.getElementById('lightboxClose');
    closeBtn?.focus();
  }

  #close(): void {
    document.getElementById('cardLightbox')?.classList.remove('open');
    document.body.style.overflow = '';
    this.#previouslyFocused?.focus();
    this.#previouslyFocused = null;
  }
}
