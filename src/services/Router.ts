import type { IRouter, RouteHandler, NavigateCallback } from '../types';

export class Router implements IRouter {
  #routes: Map<string, RouteHandler> = new Map();
  #currentRoute: string = '';
  #onNavigate: NavigateCallback | null = null;

  constructor(onNavigate?: NavigateCallback) {
    this.#onNavigate = onNavigate || null;
    window.addEventListener('hashchange', () => this.#handleRoute());
  }

  register(path: string, handler: RouteHandler): IRouter {
    this.#routes.set(path, handler);
    return this;
  }

  start(): IRouter {
    this.#handleRoute();
    return this;
  }

  navigate(path: string): void {
    window.location.hash = path;
  }

  get current(): string {
    return this.#currentRoute;
  }

  #handleRoute(): void {
    const hash = window.location.hash.slice(1) || '/';
    this.#currentRoute = hash;
    
    if (this.#onNavigate) {
      this.#onNavigate(hash);
    }
    
    const handler = this.#routes.get(hash);
    if (handler) {
      handler();
    }
  }
}
