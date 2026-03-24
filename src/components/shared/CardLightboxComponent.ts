import { Component } from '../base/Component';
import type { ICard, IEventEmitter } from '../../types';
import { esc, safeUrl } from '../../utils/esc';

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
      art.innerHTML = `
        <img class="lightbox__art-img" src="${artSrc}" alt="${esc(card.name)}">
        <span class="tcg-card__rarity ${esc(card.rarityClass)}">${esc(card.rarity.name)}</span>
        <span class="lightbox__mana">${card.manaCost}</span>
      `;
    } else {
      art.style.background = card.artGradient;
      art.innerHTML = `
        <span class="tcg-card__rarity ${esc(card.rarityClass)}">${esc(card.rarity.name)}</span>
        <span class="lightbox__mana">${card.manaCost}</span>
      `;
    }

    const rc = safeHex(card.rarity.colorHex);

    const powerDisplay  = card.attack  > 0 ? card.attack  : '—';
    const healthDisplay = card.defense > 0 ? card.defense : '—';

    body.innerHTML = `
      <div class="lightbox__set">${esc(card.set.name)}</div>
      <h2 class="lightbox__name">${esc(card.name)}</h2>
      <div class="lightbox__type-line">
        <span class="lightbox__type-badge">${esc(card.type)}</span>
      </div>
      <p class="lightbox__desc">${esc(card.description)}</p>
      <div class="lightbox__stats">
        <div class="lightbox__stat lightbox__stat--atk">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14.7 2.3a1 1 0 0 0-1.4 0l-4.6 4.6L6 4.2a1 1 0 0 0-1.4 0L2.3 6.5a1 1 0 0 0 0 1.4L5 10.6l-2.3 2.3a1 1 0 0 0 0 1.4l6 6a1 1 0 0 0 1.4 0l2.3-2.3 2.7 2.7a1 1 0 0 0 1.4 0l2.3-2.3a1 1 0 0 0 0-1.4L16.1 14.3l4.6-4.6a1 1 0 0 0 0-1.4l-6-6z"/></svg>
          <span>${powerDisplay}</span>
          <label>Power</label>
        </div>
        <div class="lightbox__stat lightbox__stat--def">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/></svg>
          <span>${healthDisplay}</span>
          <label>Health</label>
        </div>
        <div class="lightbox__stat lightbox__stat--mana">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          <span>${card.manaCost}</span>
          <label>Energy</label>
        </div>
      </div>
      <div class="lightbox__rarity-bar" style="background:${rc}18;border-color:${rc}40">
        <span class="lightbox__rarity-dot" style="background:${rc}"></span>
        <span style="color:${rc};font-weight:600;font-size:13px">${esc(card.rarity.name)}</span>
        <span style="color:var(--text-muted);font-size:13px;margin-left:auto">${esc(card.set.name)}</span>
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
