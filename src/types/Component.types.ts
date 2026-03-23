export interface IComponent {
  render(): string;
  mount(): void;
  afterMount(): void;
  destroy(): void;
}

export interface IStat {
  value: string;
  label: string;
}

export interface IFeature {
  title: string;
  desc: string;
}
