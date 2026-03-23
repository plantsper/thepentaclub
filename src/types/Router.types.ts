export type RouteHandler = () => void;
export type NavigateCallback = (route: string) => void;

export interface IRouter {
  register(path: string, handler: RouteHandler): IRouter;
  start(): IRouter;
  navigate(path: string): void;
  readonly current: string;
}
