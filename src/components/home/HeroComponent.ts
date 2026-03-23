import { Component } from '../base/Component';

export class HeroComponent extends Component {
  render(): string {
    const particles = Array.from({ length: 20 }, () => {
      const size = 2 + Math.random() * 3;
      const left = Math.random() * 100;
      const dur = 6 + Math.random() * 10;
      const delay = Math.random() * 8;
      const opacity = 0.15 + Math.random() * 0.3;
      return `<div class="hero__particle" style="width:${size}px;height:${size}px;left:${left}%;opacity:${opacity};animation-duration:${dur}s;animation-delay:${delay}s"></div>`;
    }).join('');

    return `
      <section class="hero">
        <div class="hero__particles">${particles}</div>
        <div class="hero__content">
          <div class="hero__badge">
            <span class="hero__badge-dot"></span>
            Now in Early Access
          </div>
          <h1 class="hero__title">
            Enter the <span class="hero__title-accent">Rift</span>.<br>
            Command the Cards.
          </h1>
          <p class="hero__subtitle">
            Riftbound is a next-generation trading card game set in the Wildrift universe. 
            Collect, trade, and battle with over 500 unique cards across multiple realms.
          </p>
          <div class="hero__actions">
            <button class="btn btn--primary" onclick="window.location.hash='#/cards'">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              Browse Collection
            </button>
            <button class="btn btn--secondary" onclick="document.getElementById('features')?.scrollIntoView({behavior:'smooth'})">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"/></svg>
              Learn More
            </button>
          </div>
        </div>
      </section>
    `;
  }
}
