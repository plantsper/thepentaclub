import type { IEventEmitter, EventListener } from '../types';

export class EventEmitter implements IEventEmitter {
  #listeners: Map<string, EventListener[]> = new Map();

  on<T = any>(event: string, fn: EventListener<T>): void {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, []);
    }
    this.#listeners.get(event)!.push(fn);
  }

  emit<T = any>(event: string, data?: T): void {
    const listeners = this.#listeners.get(event) || [];
    listeners.forEach(fn => fn(data));
  }
}
