import { Component } from '../base/Component';
import type { IFeature } from '../../types';

export class FeaturesComponent extends Component {
  #features: IFeature[];

  constructor(container: HTMLElement, features: IFeature[]) {
    super(container);
    this.#features = features;
  }

  render(): string {
    const icons = {
      green: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
      blue: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l2.5 2.5L16 9"/></svg>`,
      purple: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`
    };

    return `
      <section class="section" id="features">
        <div class="section__header">
          <div class="section__label">What We Do</div>
          <h2 class="section__title">Built for Collectors & Competitors</h2>
          <p class="section__desc">Everything you need to build your ultimate Riftbound deck and dominate the arena.</p>
        </div>
        <div class="features-grid">
          ${this.#features.map((f, i) => {
            const color = ['green', 'blue', 'purple'][i % 3] as keyof typeof icons;
            return `
              <div class="feature-card stagger-in" style="transition-delay:${i * 0.08}s">
                <div class="feature-card__icon feature-card__icon--${color}">${icons[color]}</div>
                <h3 class="feature-card__title">${f.title}</h3>
                <p class="feature-card__desc">${f.desc}</p>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }
}
