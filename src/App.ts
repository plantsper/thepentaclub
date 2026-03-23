import { Router } from './services/Router';
import { EventEmitter } from './services/EventEmitter';
import { CardCollection } from './models/CardCollection';
import { NavComponent } from './components/layout/NavComponent';
import { FooterComponent } from './components/layout/FooterComponent';
import { HeroComponent } from './components/home/HeroComponent';
import { StatsComponent } from './components/home/StatsComponent';
import { FeaturesComponent } from './components/home/FeaturesComponent';
import { CardGridComponent } from './components/home/CardGridComponent';
import { CTAComponent } from './components/home/CTAComponent';
import { CardsPageComponent } from './components/pages/CardsPageComponent';
import { AboutPageComponent } from './components/pages/AboutPageComponent';
import { LoginPageComponent } from './components/pages/LoginPageComponent';
import { ResetPasswordPageComponent } from './components/pages/ResetPasswordPageComponent';
import { AdminPageComponent } from './components/pages/AdminPageComponent';
import { CardLightboxComponent } from './components/shared/CardLightboxComponent';
import { ScrollAnimator } from './utils/ScrollAnimator';
import { fetchCards } from './services/CardService';
import { getSession, signOut, onAuthStateChange } from './services/AuthService';
import { createSampleCards } from './utils/sampleData';
import type { IStat, IFeature } from './types';
import type { Session } from '@supabase/supabase-js';

export class App {
  #root: HTMLElement | null;
  #router: Router;
  #events: EventEmitter;
  #collection: CardCollection;
  #nav: NavComponent | null = null;
  #scrollAnimator: ScrollAnimator;
  #session: Session | null = null;

  constructor(rootId: string) {
    this.#root = document.getElementById(rootId);

    if (!this.#root) {
      throw new Error(`Root element with id "${rootId}" not found`);
    }

    this.#events = new EventEmitter();
    this.#collection = new CardCollection([]);
    this.#scrollAnimator = new ScrollAnimator();
    this.#router = new Router((route) => this.#onNavigate(route));

    this.#init();
  }

  async #init(): Promise<void> {
    if (!this.#root) return;

    // Show loading screen while fetching cards
    this.#root.innerHTML = `
      <div class="bg-mesh"></div>
      <div class="grid-overlay"></div>
      <div style="height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px">
        <div style="width:40px;height:40px;border-radius:50%;border:3px solid var(--border);border-top-color:var(--accent);animation:spin 0.8s linear infinite"></div>
        <span style="font-size:13px;color:var(--text-muted);letter-spacing:0.06em;text-transform:uppercase">Loading cards...</span>
      </div>
    `;

    // Fetch cards and check auth session in parallel
    try {
      const [cards, session] = await Promise.all([
        fetchCards(),
        getSession().catch(() => null),
      ]);
      this.#collection = new CardCollection(cards);
      this.#session = session;
    } catch {
      // Supabase not configured — fall back to sample data
      this.#collection = new CardCollection(createSampleCards());
      this.#session = null;
    }

    // Listen for auth state changes (login, logout, password recovery)
    try {
      onAuthStateChange((event, session) => {
        this.#session = session;
        this.#remountNav();
        if (event === 'PASSWORD_RECOVERY') {
          window.location.hash = '#/reset-password';
        }
      });
    } catch {
      // No Supabase env vars — auth unavailable
    }

    // Build full app skeleton
    this.#root.innerHTML = `
      <div class="bg-mesh"></div>
      <div class="grid-overlay"></div>
      <div id="navMount"></div>
      <div id="page-home" class="page"></div>
      <div id="page-cards" class="page"></div>
      <div id="page-about" class="page"></div>
      <div id="page-login" class="page"></div>
      <div id="page-reset" class="page"></div>
      <div id="page-admin" class="page"></div>
      <div id="footerMount"></div>
      <div id="lightboxMount"></div>
    `;

    const navMount = document.getElementById('navMount');
    if (navMount) {
      this.#nav = new NavComponent(navMount, !!this.#session, () => this.#handleLogout());
      this.#nav.mount();
    }

    const footerMount = document.getElementById('footerMount');
    if (footerMount) {
      new FooterComponent(footerMount).mount();
    }

    const lightboxMount = document.getElementById('lightboxMount');
    if (lightboxMount) {
      new CardLightboxComponent(lightboxMount, this.#events).mount();
    }

    this.#router
      .register('/', () => this.#showHome())
      .register('/cards', () => this.#showCards())
      .register('/about', () => this.#showAbout())
      .register('/login', () => this.#showLogin())
      .register('/reset-password', () => this.#showResetPassword())
      .register('/admin', () => this.#showAdmin())
      .start();
  }

  #remountNav(): void {
    const navMount = document.getElementById('navMount');
    if (!navMount) return;
    this.#nav = new NavComponent(navMount, !!this.#session, () => this.#handleLogout());
    this.#nav.mount();
    this.#nav.updateActive(this.#router.current);
  }

  async #handleLogout(): Promise<void> {
    try {
      await signOut();
    } catch { /* ignore */ }
    this.#session = null;
    this.#remountNav();
    this.#router.navigate('/');
  }

  #onNavigate(route: string): void {
    this.#nav?.updateActive(route);
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  #showHome(): void {
    const page = document.getElementById('page-home');
    if (!page) return;

    const heroEl = document.createElement('div');
    const statsEl = document.createElement('div');
    const featuresEl = document.createElement('div');
    const cardsEl = document.createElement('div');
    const ctaEl = document.createElement('div');

    page.innerHTML = '';
    page.append(heroEl, statsEl, featuresEl, cardsEl, ctaEl);

    new HeroComponent(heroEl).mount();

    const stats: IStat[] = [
      { value: '500+', label: 'Unique Cards' },
      { value: '7', label: 'Realms' },
      { value: '50K+', label: 'Players' },
      { value: '4', label: 'Rarities' },
    ];
    new StatsComponent(statsEl, stats).mount();

    const features: IFeature[] = [
      { title: 'Collect & Trade', desc: 'Build your portfolio with cards from across the seven realms. Trade with players worldwide on the integrated marketplace.' },
      { title: 'Strategic Battles', desc: 'Challenge opponents in deep, tactical duels. Every card matters. Every decision shapes the outcome.' },
      { title: 'Live Pricing', desc: 'Real-time market data on every card. Track your collection value and spot opportunities before anyone else.' },
      { title: 'Deck Builder', desc: 'Craft the perfect deck with our intelligent builder. Analyze synergies, mana curves, and win rates.' },
      { title: 'Seasonal Events', desc: 'Compete in limited-time events with exclusive card rewards. New challenges every season.' },
      { title: 'Community First', desc: 'Join a passionate community of collectors and competitors. Tournaments, forums, and more.' },
    ];
    new FeaturesComponent(featuresEl, features).mount();

    new CardGridComponent(cardsEl, this.#collection, this.#events).mount();
    new CTAComponent(ctaEl).mount();

    page.classList.add('active');
    requestAnimationFrame(() => this.#scrollAnimator.observe());
  }

  #showCards(): void {
    const page = document.getElementById('page-cards');
    if (!page) return;

    new CardsPageComponent(page, this.#collection, this.#events).mount();
    page.classList.add('active');
    requestAnimationFrame(() => this.#scrollAnimator.observe());
  }

  #showAbout(): void {
    const page = document.getElementById('page-about');
    if (!page) return;

    new AboutPageComponent(page).mount();
    page.classList.add('active');
    requestAnimationFrame(() => this.#scrollAnimator.observe());
  }

  #showLogin(): void {
    // Already logged in → go to admin
    if (this.#session) {
      this.#router.navigate('/admin');
      return;
    }

    const page = document.getElementById('page-login');
    if (!page) return;

    new LoginPageComponent(page, () => {
      getSession().then(s => {
        this.#session = s;
        this.#remountNav();
        this.#router.navigate('/admin');
      }).catch(() => {});
    }).mount();

    page.classList.add('active');
  }

  #showResetPassword(): void {
    const page = document.getElementById('page-reset');
    if (!page) return;

    new ResetPasswordPageComponent(page, () => {
      this.#router.navigate('/');
    }).mount();

    page.classList.add('active');
  }

  #showAdmin(): void {
    // Not logged in → redirect to login
    if (!this.#session) {
      this.#router.navigate('/login');
      return;
    }

    const page = document.getElementById('page-admin');
    if (!page) return;

    new AdminPageComponent(page).mount();
    page.classList.add('active');
  }
}
