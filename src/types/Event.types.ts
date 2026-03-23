export type EventListener<T = any> = (data: T) => void;

export interface IEventEmitter {
  on<T = any>(event: string, fn: EventListener<T>): void;
  emit<T = any>(event: string, data?: T): void;
}
