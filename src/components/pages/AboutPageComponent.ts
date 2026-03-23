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
            In the shattered realms of the Wildrift, ancient power flows through crystallized mana — 
            and only those who master the cards can command it.
          </p>
          <p style="font-size:15px;color:var(--text-secondary);line-height:1.8;margin-bottom:24px">
            Riftbound TCG is a collectible trading card game born from the Wildrift universe. 
            Each card represents a champion, spell, or artifact from one of the seven fractured realms. 
            Build your deck, form alliances, and challenge rivals in strategic duels that test both 
            cunning and courage.
          </p>
          <p style="font-size:15px;color:var(--text-secondary);line-height:1.8;margin-bottom:24px">
            With over 500 cards planned across multiple expansions, Riftbound offers deep 
            strategic gameplay, stunning card art, and a thriving community of collectors 
            and competitors alike.
          </p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-top:40px">
            <div style="background:var(--bg-surface);padding:24px;border-radius:var(--radius-lg);border:1px solid var(--border)">
              <div style="font-size:28px;font-weight:800;color:var(--accent)">7</div>
              <div style="font-size:13px;color:var(--text-muted);margin-top:4px">Realms to explore</div>
            </div>
            <div style="background:var(--bg-surface);padding:24px;border-radius:var(--radius-lg);border:1px solid var(--border)">
              <div style="font-size:28px;font-weight:800;color:var(--accent-secondary)">500+</div>
              <div style="font-size:13px;color:var(--text-muted);margin-top:4px">Unique cards planned</div>
            </div>
            <div style="background:var(--bg-surface);padding:24px;border-radius:var(--radius-lg);border:1px solid var(--border)">
              <div style="font-size:28px;font-weight:800;color:var(--accent-tertiary)">4</div>
              <div style="font-size:13px;color:var(--text-muted);margin-top:4px">Card rarities</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
