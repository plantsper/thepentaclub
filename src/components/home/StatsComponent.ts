import { Component } from '../base/Component';
import type { IStat } from '../../types';

export class StatsComponent extends Component {
  #stats: IStat[];

  constructor(container: HTMLElement, stats: IStat[]) {
    super(container);
    this.#stats = stats;
  }

  render(): string {
    return `
      <section class="section">
        <div class="stats">
          ${this.#stats.map(s => `
            <div class="stat stagger-in">
              <div class="stat__value">${s.value}</div>
              <div class="stat__label">${s.label}</div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }
}
