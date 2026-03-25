import { Component } from '../base/Component';
import type { ICard, IEventEmitter } from '../../types';
import { esc, safeUrl } from '../../utils/esc';
import { variantLabel } from '../../utils/cardVariant';
import { domainColor } from '../../utils/domainColors';

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

    // Carousel dot navigation (event delegation — dots are rendered dynamically)
    document.getElementById('lightboxArt')?.addEventListener('click', (e) => {
      const dot = (e.target as HTMLElement).closest<HTMLElement>('.lightbox__dot');
      if (!dot) return;
      this.#goToSlide(Number(dot.dataset.slide));
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

  #goToSlide(index: number): void {
    document.querySelectorAll('.lightbox__slide').forEach((el, i) => {
      el.classList.toggle('lightbox__slide--active', i === index);
    });
    document.querySelectorAll('.lightbox__dot').forEach((el, i) => {
      el.classList.toggle('lightbox__dot--active', i === index);
    });
    // Sync blurred background on the art container
    const activeSlide = document.querySelector<HTMLElement>('.lightbox__slide--active');
    const artEl = document.getElementById('lightboxArt');
    if (activeSlide && artEl) {
      artEl.style.setProperty('--art-url', activeSlide.style.getPropertyValue('--art-url'));
    }
  }

  #open(card: ICard): void {
    const lightbox = document.getElementById('cardLightbox');
    const art = document.getElementById('lightboxArt');
    const body = document.getElementById('lightboxBody');
    if (!lightbox || !art || !body) return;

    // Build image list: user scan first, Riftcodex art second
    const artImages: Array<{ src: string; label: string }> = [];
    const userSrc = safeUrl(card.artUrl ?? '');
    const rcSrc   = safeUrl(card.riftcodexArtUrl ?? '');
    if (userSrc) artImages.push({ src: userSrc, label: 'Your Scan' });
    if (rcSrc)   artImages.push({ src: rcSrc,   label: 'Official Art' });

    const priceHtml = `<span class="lightbox__price">$${card.price.toFixed(2)}</span>`;
    const fallbackGradient = card.artGradient;

    const slidesHtml = artImages.length > 0
      ? artImages.map((img, i) => `
          <div class="lightbox__slide${i === 0 ? ' lightbox__slide--active' : ''}"
               style="--art-url: url('${img.src}')">
            <img class="lightbox__art-img" src="${img.src}" alt="${esc(card.name)}" decoding="async">
            ${i === 0 ? priceHtml : ''}
          </div>
        `).join('')
      : `<div class="lightbox__slide lightbox__slide--active"
              style="background:${fallbackGradient}">
           ${priceHtml}
         </div>`;

    const navHtml = artImages.length > 1
      ? `<div class="lightbox__carousel-nav">
           ${artImages.map((_, i) =>
             `<button class="lightbox__dot${i === 0 ? ' lightbox__dot--active' : ''}"
                      data-slide="${i}" aria-label="Image ${i + 1}"></button>`
           ).join('')}
         </div>`
      : '';

    art.innerHTML = `<div class="lightbox__carousel">${slidesHtml}${navHtml}</div>`;

    // Sync blurred background to first slide
    if (artImages.length > 0) {
      art.style.setProperty('--art-url', `url('${artImages[0].src}')`);
    } else {
      art.style.removeProperty('--art-url');
      art.style.background = fallbackGradient;
    }

    const rc = safeHex(card.rarity.colorHex);

    // Domain chips — colored per domain using trusted local map
    const domainChips = (card.domains ?? []).map(d => {
      const c = domainColor(d);
      return `<span class="lightbox__domain-chip" style="background:${c}18;border-color:${c}50;color:${c}">${esc(d)}</span>`;
    }).join('');

    // Tag chips — gray, no color logic
    const tagChips = (card.tags ?? []).map(t =>
      `<span class="lightbox__tag-chip">${esc(t.name)}</span>`
    ).join('');

    const chipsRow = (domainChips || tagChips || card.supertype)
      ? `<div class="lightbox__chips">
          ${card.supertype && card.supertype.toLowerCase() !== card.type.toLowerCase() ? `<span class="lightbox__supertype-badge">${esc(card.supertype)}</span>` : ''}
          ${domainChips}
          ${tagChips}
        </div>`
      : '';

    body.innerHTML = `
      <div class="lightbox__set">${esc(card.set.name)}</div>
      <div class="lightbox__name-row">
        <h2 class="lightbox__name">${esc(card.name)}</h2>
      </div>
      <div class="lightbox__type-line">
        <span class="lightbox__type-badge">${esc(card.type)}</span>
        ${variantLabel(card.variant) ? `<span class="lightbox__variant-badge">${esc(variantLabel(card.variant)!)}</span>` : ''}
      </div>
      ${chipsRow}
      <div class="lightbox__effect-label">Card Effect</div>
      <p class="lightbox__desc">${esc(card.description)}</p>
      ${card.flavour ? `<p class="lightbox__flavour">${esc(card.flavour)}</p>` : ''}
      ${card.artist ? `<div class="lightbox__artist">Art by ${esc(card.artist)}</div>` : ''}
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
