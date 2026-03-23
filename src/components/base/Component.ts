import type { IComponent } from '../../types';

export abstract class Component implements IComponent {
  protected _container: HTMLElement;

  constructor(container: HTMLElement) {
    this._container = container;
  }

  abstract render(): string;

  mount(): void {
    this._container.innerHTML = this.render();
    this.afterMount();
  }

  afterMount(): void {
    // Override in subclasses if needed
  }

  destroy(): void {
    this._container.innerHTML = '';
  }
}
