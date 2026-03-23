# TypeScript Migration & Modularization Plan

## Phase 1: Project Setup

### 1.1 Initialize TypeScript Project
```bash
npm init -y
npm install -D typescript vite @types/node
npx tsc --init
```

### 1.2 Configure TypeScript (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 1.3 Configure Vite (`vite.config.ts`)
```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  root: './src',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
});
```

### 1.4 Update `package.json` Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

## Phase 2: Directory Structure Creation

```
thepentaclub/
├── src/
│   ├── types/
│   │   ├── Card.types.ts
│   │   ├── Component.types.ts
│   │   └── index.ts
│   ├── models/
│   │   ├── Card.ts
│   │   └── CardCollection.ts
│   ├── services/
│   │   ├── Router.ts
│   │   └── EventEmitter.ts
│   ├── components/
│   │   ├── base/
│   │   │   └── Component.ts
│   │   ├── layout/
│   │   │   ├── NavComponent.ts
│   │   │   └── FooterComponent.ts
│   │   ├── home/
│   │   │   ├── HeroComponent.ts
│   │   │   ├── StatsComponent.ts
│   │   │   ├── FeaturesComponent.ts
│   │   │   ├── CardGridComponent.ts
│   │   │   └── CTAComponent.ts
│   │   └── pages/
│   │       ├── CardsPageComponent.ts
│   │       └── AboutPageComponent.ts
│   ├── utils/
│   │   ├── ScrollAnimator.ts
│   │   └── sampleData.ts
│   ├── styles/
│   │   ├── _variables.css
│   │   ├── _base.css
│   │   ├── _backgrounds.css
│   │   ├── components/
│   │   │   ├── nav.css
│   │   │   ├── hero.css
│   │   │   ├── sections.css
│   │   │   ├── stats.css
│   │   │   ├── features.css
│   │   │   ├── cards.css
│   │   │   ├── cta.css
│   │   │   └── footer.css
│   │   └── main.css
│   ├── App.ts
│   ├── index.html
│   └── main.ts
├── public/
│   └── (static assets)
├── dist/
├── tsconfig.json
├── vite.config.ts
├── package.json
├── PROJECT_OVERVIEW.md
└── MIGRATION_PLAN.md
```

## Phase 3: Type Definitions

### 3.1 Card Types (`src/types/Card.types.ts`)
```typescript
export type CardType = 'Champion' | 'Spell' | 'Artifact';
export type CardRarity = 'Legendary' | 'Epic' | 'Rare' | 'Common';
export type CardSet = 'Rift Core' | 'Shattered Realms' | 'Tidal Abyss' | 'Void Expanse';

export interface ICard {
  id: string;
  name: string;
  type: CardType;
  rarity: CardRarity;
  manaCost: number;
  attack: number;
  defense: number;
  description: string;
  artGradient: string;
  set: CardSet;
}

export interface ICardCollection {
  all: ICard[];
  count: number;
  add(card: ICard): void;
  filterByRarity(rarity: CardRarity | 'all'): ICard[];
  filterByType(type: CardType | 'all'): ICard[];
  search(query: string): ICard[];
}
```

### 3.2 Component Types (`src/types/Component.types.ts`)
```typescript
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
```

### 3.3 Router Types (`src/types/Router.types.ts`)
```typescript
export type RouteHandler = () => void;
export type NavigateCallback = (route: string) => void;

export interface IRouter {
  register(path: string, handler: RouteHandler): IRouter;
  start(): IRouter;
  navigate(path: string): void;
  current: string;
}
```

### 3.4 Event Types (`src/types/Event.types.ts`)
```typescript
export type EventListener<T = any> = (data: T) => void;

export interface IEventEmitter {
  on<T = any>(event: string, fn: EventListener<T>): void;
  emit<T = any>(event: string, data?: T): void;
}
```

## Phase 4: Model Migration

### 4.1 Card Model (`src/models/Card.ts`)
- Extract from line ~444-459
- Add type imports
- Implement `ICard` interface
- Add getter/setter validation

### 4.2 CardCollection Model (`src/models/CardCollection.ts`)
- Extract from line ~461-480
- Add type imports
- Implement `ICardCollection` interface
- Use private fields properly
- Add error handling

## Phase 5: Service Layer Migration

### 5.1 EventEmitter (`src/services/EventEmitter.ts`)
- Extract from line ~530-541
- Add type safety with generics
- Implement `IEventEmitter`

### 5.2 Router (`src/services/Router.ts`)
- Extract from line ~484-505
- Add type imports
- Implement `IRouter`
- Add route validation

## Phase 6: Base Component Migration

### 6.1 Abstract Component (`src/components/base/Component.ts`)
- Extract from line ~545-554
- Make truly abstract
- Add lifecycle methods
- Type the container properly

## Phase 7: Layout Components Migration

### 7.1 NavComponent (`src/components/layout/NavComponent.ts`)
- Extract from line ~558-596
- Add Router dependency injection
- Type all DOM references
- Extract mobile logic

### 7.2 FooterComponent (`src/components/layout/FooterComponent.ts`)
- Extract from line ~735-767
- No dependencies, simple migration

## Phase 8: Home Page Components Migration

### 8.1 HeroComponent (`src/components/home/HeroComponent.ts`)
- Extract from line ~600-640
- Type particle generation logic

### 8.2 StatsComponent (`src/components/home/StatsComponent.ts`)
- Extract from line ~644-660
- Add IStat[] type

### 8.3 FeaturesComponent (`src/components/home/FeaturesComponent.ts`)
- Extract from line ~664-696
- Add IFeature[] type
- Move SVG icons to constants

### 8.4 CardGridComponent (`src/components/home/CardGridComponent.ts`)
- Extract from line ~700-733
- Add CardCollection & EventEmitter deps
- Type all card rendering

### 8.5 CTAComponent (`src/components/home/CTAComponent.ts`)
- Extract from line ~769-787
- Simple, no dependencies

## Phase 9: Page Components Migration

### 9.1 CardsPageComponent (`src/components/pages/CardsPageComponent.ts`)
- Extract from line ~791-860
- Add state management for filters
- Type filter/search state
- Add CardCollection dependency

### 9.2 AboutPageComponent (`src/components/pages/AboutPageComponent.ts`)
- Extract from line ~864-900
- Static content, simple migration

## Phase 10: Utilities Migration

### 10.1 ScrollAnimator (`src/utils/ScrollAnimator.ts`)
- Extract from line ~904-918
- Add IntersectionObserver types
- Make options configurable

### 10.2 Sample Data (`src/utils/sampleData.ts`)
- Extract from line ~922-958
- Export typed card array
- Add data validation function

## Phase 11: CSS Extraction

### 11.1 Variables (`src/styles/_variables.css`)
- Lines 11-43 (CSS custom properties)

### 11.2 Base Styles (`src/styles/_base.css`)
- Lines 44-50 (reset, body, common)

### 11.3 Backgrounds (`src/styles/_backgrounds.css`)
- Lines 54-70 (mesh and grid overlay)

### 11.4 Component Styles
Extract each component's styles:
- `nav.css` - Lines 74-118
- `hero.css` - Lines 122-178
- `sections.css` - Lines 182-196
- `stats.css` - Lines 200-214
- `features.css` - Lines 218-258
- `cards.css` - Lines 262-337 + 391-435
- `cta.css` - Lines 341-360
- `footer.css` - Lines 364-387

### 11.5 Utilities & Responsive (`src/styles/_utilities.css`)
- Lines 439-459 (page transitions, animations)
- Lines 463-476 (responsive)

### 11.6 Main CSS (`src/styles/main.css`)
```css
@import './_variables.css';
@import './_base.css';
@import './_backgrounds.css';
@import './components/nav.css';
@import './components/hero.css';
@import './components/sections.css';
@import './components/stats.css';
@import './components/features.css';
@import './components/cards.css';
@import './components/cta.css';
@import './components/footer.css';
@import './_utilities.css';
```

## Phase 12: App Controller Migration

### 12.1 App Class (`src/App.ts`)
- Extract from line ~962-1031
- Add dependency injection
- Type all component references
- Improve initialization flow

### 12.2 Main Entry (`src/main.ts`)
```typescript
import './styles/main.css';
import { App } from './App';

// Boot application
new App('app');
```

## Phase 13: HTML Template

### 13.1 New `src/index.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Pentaclub — Wildrift and Riftbound TCG</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
</head>
<body>
  <div class="app" id="app"></div>
  <script type="module" src="/main.ts"></script>
</body>
</html>
```

## Phase 14: Testing Setup (Optional but Recommended)

### 14.1 Install Testing Dependencies
```bash
npm install -D vitest @testing-library/dom jsdom
```

### 14.2 Create Test Files
```
src/
├── models/__tests__/
│   ├── Card.test.ts
│   └── CardCollection.test.ts
├── services/__tests__/
│   ├── Router.test.ts
│   └── EventEmitter.test.ts
└── utils/__tests__/
    └── sampleData.test.ts
```

## Migration Order Summary

1. ✅ Create project documentation (PROJECT_OVERVIEW.md)
2. ✅ Create migration plan (MIGRATION_PLAN.md)
3. ⏳ Initialize TypeScript & Vite
4. ⏳ Create directory structure
5. ⏳ Define TypeScript types/interfaces
6. ⏳ Migrate models (Card, CardCollection)
7. ⏳ Migrate services (EventEmitter, Router)
8. ⏳ Migrate base Component
9. ⏳ Migrate layout components (Nav, Footer)
10. ⏳ Migrate home components (Hero, Stats, Features, CardGrid, CTA)
11. ⏳ Migrate page components (CardsPage, AboutPage)
12. ⏳ Migrate utilities (ScrollAnimator, sampleData)
13. ⏳ Extract and modularize CSS
14. ⏳ Migrate App controller
15. ⏳ Create new HTML template
16. ⏳ Test build and functionality
17. ⏳ Update deployment config

## Expected Benefits

- **Type Safety**: Catch errors at compile time
- **Better IDE Support**: IntelliSense, autocompletion, refactoring
- **Maintainability**: Easier to understand and modify
- **Scalability**: Add new features with confidence
- **Developer Experience**: Hot module replacement with Vite
- **Bundle Optimization**: Tree-shaking and code splitting
- **Testing**: Easier to unit test individual modules

## Potential Challenges

1. **DOM Typing**: Handling potentially null DOM elements
2. **Event Handling**: Typing custom events properly
3. **Component Lifecycle**: Ensuring proper cleanup
4. **CSS Imports**: Vite handles this, but need to configure
5. **Build Configuration**: May need adjustments for production

## Next Steps

Ready to proceed with implementation? I can:
1. Set up the TypeScript/Vite configuration
2. Create the directory structure
3. Begin migrating modules in order
4. Test each module as we go

Would you like me to start the implementation now?
