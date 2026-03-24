import { Component } from '../base/Component';

export class CTAComponent extends Component {
  render(): string {
    return `
      <section class="section">
        <div class="cta-section">
          <div class="cta-section__inner">
            <h2 class="cta-section__title">Ready to Enter the Rift?</h2>
            <p class="cta-section__desc">View all the cards we have inventory.</p>
            <button class="btn btn--primary" onclick="window.location.hash='#/cards'">
              Start Collecting
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </section>
    `;
  }
}
