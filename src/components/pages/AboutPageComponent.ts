import { Component } from '../base/Component';

export class AboutPageComponent extends Component {
  render(): string {
    return `
      <div class="section" style="padding-top:32px">
        <div class="section__header">
          <div class="section__label">About</div>
          <h2 class="section__title">The Riftbound Universe</h2>
        </div>
        <div style="max-width:680px;margin:0 auto">
          <p style="font-size:17px;color:var(--text-secondary);line-height:1.8;margin-bottom:24px;font-family:var(--font-accent);font-size:20px;font-style:italic">
            Forge your path through the Rift. Across the regions of Runeterra, legendary Champions
            clash for dominance — and only the sharpest strategists will rise.
          </p>
          <p style="font-size:15px;color:var(--text-secondary);line-height:1.8;margin-bottom:24px">
            Riftbound is a collectible trading card game by Riot Games featuring champions and locales
            from the League of Legends universe. Build a deck around a Champion Legend — Ahri, Jinx,
            Darius, Viktor, and dozens more — then battle across Runeterra's iconic regions, from the
            disciplined ranks of Demacia to the ruthless streets of Noxus.
          </p>
          <p style="font-size:15px;color:var(--text-secondary);line-height:1.8;margin-bottom:24px">
            Every deck is shaped by two Domains — Fury, Calm, Mind, Body, Chaos, or Order — each
            representing a distinct philosophy of power. With sets spanning Origins, Spiritforged,
            and Unleashed, and over 500 cards across the game's first year, Riftbound rewards both
            new players and veteran TCG competitors alike.
          </p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-top:40px">
            <div style="background:var(--bg-surface);padding:24px;border-radius:var(--radius-lg);border:1px solid var(--border)">
              <div style="font-size:28px;font-weight:800;color:var(--accent)">6</div>
              <div style="font-size:13px;color:var(--text-muted);margin-top:4px">Domains of power</div>
            </div>
            <div style="background:var(--bg-surface);padding:24px;border-radius:var(--radius-lg);border:1px solid var(--border)">
              <div style="font-size:28px;font-weight:800;color:var(--accent-secondary)">500+</div>
              <div style="font-size:13px;color:var(--text-muted);margin-top:4px">Cards in year one</div>
            </div>
            <div style="background:var(--bg-surface);padding:24px;border-radius:var(--radius-lg);border:1px solid var(--border)">
              <div style="font-size:28px;font-weight:800;color:var(--accent-tertiary)">40+</div>
              <div style="font-size:13px;color:var(--text-muted);margin-top:4px">Champion Legends</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
