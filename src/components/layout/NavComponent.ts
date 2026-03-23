import { Component } from '../base/Component';

export class NavComponent extends Component {
  #mobileOpen: boolean = false;

  render(): string {
    return `
      <nav class="nav" id="mainNav">
        <a href="#/" class="nav__logo">
          <div class="nav__logo-icon">P</div>
          <span class="nav__logo-text">The Pentaclub</span>
        </a>
        <div class="nav__links" id="navLinks">
          <a href="#/" class="nav__link" data-route="/">Home</a>
          <a href="#/cards" class="nav__link" data-route="/cards">Cards</a>
          <a href="#/about" class="nav__link" data-route="/about">About</a>
          <button class="nav__cta" onclick="window.location.hash='#/cards'">Browse Cards</button>
        </div>
        <button class="nav__mobile-toggle" id="mobileToggle" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
      </nav>
    `;
  }

  afterMount(): void {
    const toggle = document.getElementById('mobileToggle');
    toggle?.addEventListener('click', () => {
      this.#mobileOpen = !this.#mobileOpen;
      document.getElementById('navLinks')?.classList.toggle('open', this.#mobileOpen);
    });

    window.addEventListener('scroll', () => {
      document.getElementById('mainNav')?.classList.toggle('scrolled', window.scrollY > 40);
    });
  }

  updateActive(route: string): void {
    document.querySelectorAll('.nav__link').forEach(link => {
      const element = link as HTMLElement;
      link.classList.toggle('active', element.dataset.route === route);
    });
  }
}
