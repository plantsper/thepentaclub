# The Pentaclub - Riftbound TCG Project

## Project Overview

A single-page application (SPA) for **Riftbound TCG**, a collectible trading card game set in the League of Legends / Runeterra universe. The application includes a card collection system with filtering, searching, lightbox detail views, and a Supabase-backed data layer with image hosting.

## Core Functionality

### 1. **Application Architecture**
- **Pattern**: Object-Oriented Programming (OOP) with TypeScript classes
- **Routing**: Hash-based SPA routing (`#/`, `#/cards`, `#/about`)
- **State Management**: Event-driven architecture using EventEmitter pattern
- **Rendering**: Component-based UI with manual DOM manipulation
- **Data Layer**: Supabase (PostgreSQL + PostgREST REST API), with hardcoded sample data fallback
- **App Init**: Async — shows loading spinner, fetches cards from Supabase, falls back to `sampleData.ts` on error

### 2. **Data Models**

#### Card Model (`src/models/Card.ts`)
Represents individual trading cards:
- `id`: Unique identifier (UUID from Supabase)
- `name`: Card name
- `type`: Card type (`Champion` | `Spell` | `Artifact`)
- `rarity`: Rarity level (`Legendary` | `Epic` | `Rare` | `Common`)
- `manaCost`: Mana cost to play the card
- `attack`: Attack value (0 for non-combat cards)
- `defense`: Defense value (0 for non-combat cards)
- `description`: Flavor/ability text
- `artGradient`: CSS gradient fallback for card artwork
- `artUrl?`: Optional Supabase Storage public URL for card image
- `set`: Expansion set name
- `rarityClass` (getter): CSS class string for rarity badge styling

#### CardCollection Model (`src/models/CardCollection.ts`)
Manages the complete card collection:
- `all`: Returns all cards
- `count`: Total card count
- `add(card)`: Add new card to collection
- `filterByRarity(rarity)`: Filter cards by rarity
- `filterByType(type)`: Filter cards by type
- `search(query)`: Search cards by name, type, or description

### 3. **Routing System**

#### Router Class (`src/services/Router.ts`)
- Hash-based navigation
- Route registration with handlers
- Navigation method for programmatic routing
- Hash change event listener

**Registered Routes:**
- `/` — Home page
- `/cards` — Cards collection page
- `/about` — About page

### 4. **Component Architecture**

#### Base Component (`src/components/base/Component.ts`)
- `_container`: DOM container reference
- `render()`: Abstract method returning HTML string
- `mount()`: Renders and inserts HTML into container
- `afterMount()`: Lifecycle hook for post-render event listeners
- `destroy()`: Cleanup method

#### Navigation (`src/components/layout/NavComponent.ts`)
- Fixed header navigation
- Mobile responsive menu toggle
- Active route highlighting
- Scroll-based styling changes

#### Hero (`src/components/home/HeroComponent.ts`)
- Full-screen hero section
- Animated badge with pulsing dot
- Gradient accent text
- CTA buttons
- 20 floating particle animations

#### Stats (`src/components/home/StatsComponent.ts`)
- Grid-based statistics display
- Configurable `IStat[]` array

#### Features (`src/components/home/FeaturesComponent.ts`)
- Feature cards grid
- Staggered entrance animations
- Three icon color variants (green, blue, purple)

#### Card Grid (`src/components/home/CardGridComponent.ts`)
- Displays first 8 cards as homepage preview
- Supports image (`artUrl`) with gradient fallback
- Hover zoom on both image and gradient art
- Click delegates to emit `card:open` event → opens lightbox

#### CTA (`src/components/home/CTAComponent.ts`)
- Call-to-action section with animated rotating gradient background

#### Footer (`src/components/layout/FooterComponent.ts`)
- Multi-column layout (Game, Community, Support)
- Brand information and copyright

#### Cards Page (`src/components/pages/CardsPageComponent.ts`)
- Full card collection display
- Real-time search (by name/type)
- Rarity filter buttons (All, Legendary, Epic, Rare, Common)
- Empty state handling
- Click delegates to emit `card:open` event → opens lightbox

#### About Page (`src/components/pages/AboutPageComponent.ts`)
- Riftbound lore copy (based on official Riot Games Riftbound TCG)
- References real sets, champions, Domains, Runeterra regions
- Stats grid: 6 Domains, 500+ cards, 40+ Champions

#### Card Lightbox (`src/components/shared/CardLightboxComponent.ts`)
- Global modal mounted once in `App.ts`
- Listens for `card:open` events via EventEmitter
- Two-panel layout: art (left) + details (right)
- Shows: set, name, type badge, description, attack/defense/mana stats, rarity bar
- Supports `artUrl` image with gradient fallback
- Close via backdrop click, X button, or Escape key
- Smooth fade + scale animation; mobile collapses to bottom sheet
- Locks body scroll while open

### 5. **Services**

#### EventEmitter (`src/services/EventEmitter.ts`)
- `on(event, fn)`: Register event listener
- `emit(event, data)`: Fire event with payload
- Used for `card:open` event between card grids and lightbox

#### Router (`src/services/Router.ts`)
- Hash-based SPA routing

#### CardService (`src/services/CardService.ts`)
- `fetchCards()`: Queries Supabase `cards` table, maps snake_case rows to `ICard` objects
- Lazily creates Supabase client (inside function, not at module level)
- Guards for missing env vars — throws `'Supabase env vars not set'` caught by App fallback
- Maps `art_url` (nullable DB column) to `artUrl?: string`

### 6. **Utilities**

#### ScrollAnimator (`src/utils/ScrollAnimator.ts`)
- Intersection Observer-based scroll animations
- Triggers `.visible` class on `.stagger-in` elements

#### sampleData (`src/utils/sampleData.ts`)
- 16 hardcoded cards used as fallback when Supabase is unavailable
- 4 sets × 4 rarities

### 7. **Database — Supabase**

#### Connection
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`
- Vite `envDir: '../'` required because `root` is `./src`

#### Cards Table (`supabase/migrations/001_create_cards_table.sql`)
Columns: `id` (UUID PK), `name`, `type`, `rarity`, `mana_cost`, `attack`, `defense`, `description`, `art_gradient`, `set_name`, `art_url` (nullable), `created_at`

Row Level Security:
- Public: SELECT only
- Authenticated: full CRUD (admin use via Supabase Studio)

#### Storage (`supabase/migrations/003_add_art_url.sql`)
- Bucket: `card-art` (public)
- Max file size: 5 MB
- Allowed types: JPEG, PNG, WebP, GIF
- Same RLS pattern: public read, auth write

#### CMS Workflow
Supabase Studio table editor is the primary CMS:
- Add/edit/delete cards in Table Editor
- Upload card art in Storage → copy public URL → paste into `art_url`

### 8. **Design System**

#### Color Palette
- **Backgrounds**: `--bg-deep: #060a10` → `--bg-elevated: #1e3350`
- **Accent Primary**: `--accent: #00e68a` (cyan-green)
- **Accent Secondary**: `--accent-secondary: #00c4ff` (blue)
- **Accent Tertiary**: `--accent-tertiary: #a855f7` (purple)
- **Text**: `--text-primary: #e8ecf4` → `--text-muted: #566380`

#### Typography
- **Display/Body**: Outfit (sans-serif)
- **Accent**: Crimson Pro (serif, used for card descriptions and lore text)

#### CSS Structure (`src/styles/`)
```
_variables.css       CSS custom properties
_base.css            Reset & body styles
_backgrounds.css     Animated mesh gradient + grid overlay
_common.css          Section headers, buttons
_utilities.css       Page transitions, stagger-in, @keyframes spin, responsive
components/
  nav.css
  hero.css
  stats.css
  features.css
  cards.css          Card grid, card art (img + gradient), rarity badges
  lightbox.css       Modal overlay, dialog layout, art panel, body panel
  cta.css
  footer.css
main.css             @import all of the above
```

### 9. **App Initialization Flow**

1. Show loading spinner (CSS `@keyframes spin`)
2. Call `fetchCards()` from CardService
   - On success: populate `CardCollection` from Supabase
   - On error (no env vars / network): fall back to `createSampleCards()`
3. Build full app skeleton (bg-mesh, grid-overlay, nav, pages, footer, lightbox)
4. Mount `NavComponent`, `FooterComponent`, `CardLightboxComponent`
5. Register routes (`/`, `/cards`, `/about`) and start Router
6. On route change: update nav active state, hide all pages, scroll to top, mount page component

### 10. **Project Structure**

```
thepentaclub/
├── src/
│   ├── components/
│   │   ├── base/Component.ts
│   │   ├── home/
│   │   │   ├── HeroComponent.ts
│   │   │   ├── StatsComponent.ts
│   │   │   ├── FeaturesComponent.ts
│   │   │   ├── CardGridComponent.ts
│   │   │   └── CTAComponent.ts
│   │   ├── layout/
│   │   │   ├── NavComponent.ts
│   │   │   └── FooterComponent.ts
│   │   ├── pages/
│   │   │   ├── CardsPageComponent.ts
│   │   │   └── AboutPageComponent.ts
│   │   └── shared/
│   │       └── CardLightboxComponent.ts
│   ├── models/
│   │   ├── Card.ts
│   │   └── CardCollection.ts
│   ├── services/
│   │   ├── CardService.ts          ← Supabase data fetching
│   │   ├── EventEmitter.ts
│   │   └── Router.ts
│   ├── styles/
│   │   ├── components/
│   │   │   ├── cards.css
│   │   │   ├── lightbox.css        ← new
│   │   │   └── (others)
│   │   └── main.css
│   ├── types/
│   │   ├── Card.types.ts           ← includes artUrl?
│   │   ├── Component.types.ts
│   │   ├── Event.types.ts
│   │   ├── Router.types.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── ScrollAnimator.ts
│   │   └── sampleData.ts
│   ├── App.ts                      ← async init, Supabase fallback
│   ├── main.ts
│   └── index.html
├── supabase/
│   └── migrations/
│       ├── 001_create_cards_table.sql
│       ├── 002_seed_cards.sql
│       └── 003_add_art_url.sql
├── .env.example
├── .env.local                      ← not committed, holds real keys
├── tsconfig.json                   ← includes "types": ["vite/client"]
├── vite.config.ts                  ← envDir: '../'
└── package.json
```

### 11. **Dependencies**

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.100.0"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "typescript": "^6.0.2",
    "vite": "^8.0.2"
  }
}
```

### 12. **Known Gotchas**

| Issue | Fix |
|---|---|
| `import.meta.env` not typed | `"types": ["vite/client"]` in tsconfig |
| Env vars not found at build time | `envDir: '../'` in vite.config.ts (root is `./src`) |
| Supabase crashes before App try/catch | `createClient` moved inside `fetchCards()`, not at module level |
| Card art zoom on hover | Applied to both `.tcg-card__art-img` and `.tcg-card__art-bg` |
