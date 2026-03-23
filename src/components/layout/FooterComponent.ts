import { Component } from '../base/Component';

export class FooterComponent extends Component {
  render(): string {
    return `
      <footer class="footer">
        <div class="footer__inner">
          <div>
            <a href="#/" class="nav__logo">
              <div class="nav__logo-icon" style="width:28px;height:28px;font-size:13px;border-radius:6px">P</div>
              <span class="nav__logo-text" style="font-size:17px">The Pentaclub</span>
            </a>
            <p class="footer__brand-desc">The ultimate trading card game experience set in the Wildrift universe. Collect, trade, battle.</p>
          </div>
          <div>
            <div class="footer__col-title">Game</div>
            <a href="#/cards" class="footer__link">Card Collection</a>
            <a href="#/" class="footer__link">Deck Builder</a>
            <a href="#/" class="footer__link">Marketplace</a>
            <a href="#/" class="footer__link">Leaderboards</a>
          </div>
          <div>
            <div class="footer__col-title">Community</div>
            <a href="#/" class="footer__link">Discord</a>
            <a href="#/" class="footer__link">Twitter / X</a>
            <a href="#/" class="footer__link">Reddit</a>
            <a href="#/" class="footer__link">Blog</a>
          </div>
          <div>
            <div class="footer__col-title">Support</div>
            <a href="#/" class="footer__link">Help Center</a>
            <a href="#/" class="footer__link">Contact Us</a>
            <a href="#/about" class="footer__link">About</a>
            <a href="#/" class="footer__link">Privacy</a>
          </div>
        </div>
        <div class="footer__bottom">
          <span>&copy; 2026 Riftbound TCG. All rights reserved.</span>
          <span>Made with passion for the Wildrift community</span>
        </div>
      </footer>
    `;
  }
}
