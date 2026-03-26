import { Component } from '../base/Component';

export class NavComponent extends Component {
  #mobileOpen: boolean = false;
  #isLoggedIn: boolean;
  #onLogout: () => void;

  constructor(container: HTMLElement, isLoggedIn = false, onLogout: () => void = () => {}) {
    super(container);
    this.#isLoggedIn = isLoggedIn;
    this.#onLogout = onLogout;
  }

  render(): string {
    const authLink = this.#isLoggedIn
      ? `<a href="#/admin" class="nav__link" data-route="/admin">Admin</a>
         <button class="nav__cta nav__cta--outline" id="navLogout">Logout</button>`
      : `<a href="#/login" class="nav__link nav__link--muted" data-route="/login">Admin</a>
         <button class="nav__cta" id="navBrowse">Browse Cards</button>`;

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
          ${authLink}
        </div>
        <button class="nav__mobile-toggle" id="mobileToggle" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
      </nav>
    `;
  }

  afterMount(): void {
    document.getElementById('mobileToggle')?.addEventListener('click', () => {
      this.#mobileOpen ? this.#closeMenu() : this.#openMenu();
    });

    // Close mobile menu when any nav link is tapped
    document.querySelectorAll<HTMLElement>('#navLinks .nav__link').forEach(link => {
      link.addEventListener('click', () => {
        if (this.#mobileOpen) this.#closeMenu();
      });
    });

    // Browse Cards CTA — navigate and close menu if open
    document.getElementById('navBrowse')?.addEventListener('click', () => {
      window.location.hash = '#/cards';
      if (this.#mobileOpen) this.#closeMenu();
    });

    window.addEventListener('scroll', () => {
      document.getElementById('mainNav')?.classList.toggle('scrolled', window.scrollY > 40);
    });

    document.getElementById('navLogout')?.addEventListener('click', () => this.#onLogout());
  }

  #openMenu(): void {
    this.#mobileOpen = true;
    document.getElementById('mobileToggle')?.classList.add('open');
    document.getElementById('navLinks')?.classList.add('open');
    const bd = document.createElement('div');
    bd.id = 'navMobileBackdrop';
    bd.addEventListener('click', () => this.#closeMenu());
    document.body.appendChild(bd);
    requestAnimationFrame(() => bd.classList.add('open'));
    document.body.style.overflow = 'hidden';
  }

  #closeMenu(): void {
    this.#mobileOpen = false;
    document.getElementById('mobileToggle')?.classList.remove('open');
    document.getElementById('navLinks')?.classList.remove('open');
    document.getElementById('navMobileBackdrop')?.remove();
    document.body.style.overflow = '';
  }

  updateActive(route: string): void {
    document.querySelectorAll('.nav__link').forEach(link => {
      const element = link as HTMLElement;
      link.classList.toggle('active', element.dataset.route === route);
    });
  }
}
