# The Pentaclub - Riftbound TCG Project

## Project Overview

A single-page application (SPA) for a collectible trading card game called "Riftbound TCG" set in the Wildrift universe. The application showcases a card collection system with filtering, searching, and multiple page views.

## Core Functionality

### 1. **Application Architecture**
- **Pattern**: Object-Oriented Programming (OOP) with TypeScript-style classes compiled to ES6
- **Routing**: Hash-based SPA routing (`#/`, `#/cards`, `#/about`)
- **State Management**: Event-driven architecture using EventEmitter pattern
- **Rendering**: Component-based UI with manual DOM manipulation

### 2. **Data Models**

#### Card Model
Represents individual trading cards with properties:
- `id`: Unique identifier
- `name`: Card name
- `type`: Card type (Champion, Spell, Artifact)
- `rarity`: Rarity level (Legendary, Epic, Rare, Common)
- `manaCost`: Mana cost to play the card
- `attack`: Attack value
- `defense`: Defense value
- `description`: Card description
- `artGradient`: CSS gradient for card artwork
- `set`: Expansion set name

#### CardCollection Model
Manages the complete card collection with methods:
- `all`: Returns all cards
- `count`: Total card count
- `add(card)`: Add new card to collection
- `filterByRarity(rarity)`: Filter cards by rarity
- `filterByType(type)`: Filter cards by type
- `search(query)`: Search cards by name, type, or description

### 3. **Routing System**

#### Router Class
- Hash-based navigation system
- Route registration with handlers
- Navigation method for programmatic routing
- Hash change event listener
- Current route tracking

**Registered Routes:**
- `/` - Home page
- `/cards` - Cards collection page
- `/about` - About page

### 4. **Component Architecture**

#### Base Component (Abstract)
- `_container`: DOM container reference
- `render()`: Abstract method for HTML generation
- `mount()`: Renders and inserts HTML into container
- `afterMount()`: Lifecycle hook for post-render logic
- `destroy()`: Cleanup method

#### Navigation Component (`NavComponent`)
- Fixed header navigation
- Mobile responsive menu toggle
- Active route highlighting
- Scroll-based styling changes
- Logo with animated shimmer effect

#### Hero Component (`HeroComponent`)
- Full-screen hero section
- Animated badge with pulsing dot
- Gradient accent text
- Call-to-action buttons
- Floating particle animation (20 particles)

#### Stats Component (`StatsComponent`)
- Grid-based statistics display
- Animated gradient values
- Configurable stats array

#### Features Component (`FeaturesComponent`)
- Feature cards grid (auto-fit layout)
- Icon-based features
- Staggered entrance animations
- Hover effects with accent borders
- Three color variants (green, blue, purple)

#### Card Grid Component (`CardGridComponent`)
- Displays featured cards (first 8)
- Individual card hover effects
- Rarity badges
- Mana cost display
- Attack/Defense stats with icons
- Gradient-based card art

#### CTA Component (`CTAComponent`)
- Call-to-action section
- Animated rotating gradient background
- Primary action button

#### Footer Component (`FooterComponent`)
- Multi-column layout
- Brand information
- Navigation links (Game, Community, Support)
- Copyright and credits

#### Cards Page Component (`CardsPageComponent`)
- Full card collection display
- Search functionality (by name/type)
- Rarity filter buttons (All, Legendary, Epic, Rare, Common)
- Real-time filtering
- Empty state handling
- Active filter highlighting

#### About Page Component (`AboutPageComponent`)
- Lore and story content
- Statistics grid
- Rich text description
- Themed with accent fonts

### 5. **Utilities**

#### EventEmitter
- Observer pattern implementation
- `on(event, fn)`: Register event listeners
- `emit(event, data)`: Trigger events with data

#### ScrollAnimator
- Intersection Observer-based scroll animations
- Triggers `.visible` class on `.stagger-in` elements
- Threshold: 10%, with -40px bottom margin

### 6. **Design System**

#### Color Palette
- **Backgrounds**: Deep dark blues (#060a10 to #1e3350)
- **Accent Primary**: Bright cyan (#00e68a)
- **Accent Secondary**: Bright blue (#00c4ff)
- **Accent Tertiary**: Purple (#a855f7)
- **Text**: Tiered from primary (#e8ecf4) to muted (#566380)

#### Typography
- **Display Font**: Outfit (sans-serif)
- **Body Font**: Outfit (sans-serif)
- **Accent Font**: Crimson Pro (serif)
- Font weights: 300-900

#### Visual Effects
- Animated mesh gradient background
- Grid overlay with radial mask
- Glassmorphism (backdrop-filter blur)
- Card hover transformations
- Shimmer animations
- Rotating gradient effects
- Particle float animations

#### Spacing & Radii
- Border radius: 6px (sm) to 24px (xl)
- Responsive padding: clamp-based
- Grid gaps: 12px-20px

### 7. **Sample Data**

16 pre-seeded cards across 4 sets:
- **Rift Core** (4 cards)
- **Shattered Realms** (4 cards)
- **Tidal Abyss** (4 cards)
- **Void Expanse** (4 cards)

Rarity distribution:
- Legendary: 4 cards
- Epic: 4 cards
- Rare: 4 cards
- Common: 4 cards

### 8. **Responsive Design**

#### Mobile Breakpoint (<768px)
- Hidden nav links by default
- Mobile toggle button (hamburger menu)
- Overlay menu on toggle
- 2-column footer
- Adjusted hero font sizes

#### Small Mobile (<480px)
- Single-column footer
- 2-column stats grid

### 9. **Animations & Interactions**

- **Hero fade-in**: Staggered entrance for title, subtitle, buttons
- **Shimmer effect**: Logo icon animation (3s loop)
- **Pulse animation**: Badge dot (2s loop)
- **Float animation**: Particle effects
- **Rotating background**: CTA section gradient (12s loop)
- **Stagger-in entries**: Sequential card/feature appearances
- **Hover transforms**: Cards lift and scale on hover

### 10. **App Initialization Flow**

1. Create root skeleton (backgrounds, nav, page containers, footer)
2. Mount navigation component
3. Mount footer component
4. Initialize router with route handlers
5. Register routes (/, /cards, /about)
6. Start router (reads initial hash)
7. On route change:
   - Update nav active state
   - Hide all pages
   - Scroll to top
   - Mount appropriate page component
   - Trigger scroll animations

## Technical Debt & Improvements

### Current Limitations
- All code in single HTML file
- No build process
- No TypeScript compilation
- Manual DOM manipulation
- No state management library
- Hardcoded sample data
- No API integration
- No testing

### Recommended Modularization

#### Directory Structure
```
src/
├── models/
│   ├── Card.ts
│   └── CardCollection.ts
├── services/
│   ├── Router.ts
│   └── EventEmitter.ts
├── components/
│   ├── base/
│   │   └── Component.ts
│   ├── layout/
│   │   ├── NavComponent.ts
│   │   └── FooterComponent.ts
│   ├── home/
│   │   ├── HeroComponent.ts
│   │   ├── StatsComponent.ts
│   │   ├── FeaturesComponent.ts
│   │   ├── CardGridComponent.ts
│   │   └── CTAComponent.ts
│   └── pages/
│       ├── CardsPageComponent.ts
│       └── AboutPageComponent.ts
├── utils/
│   ├── ScrollAnimator.ts
│   └── sampleData.ts
├── styles/
│   ├── variables.css
│   ├── base.css
│   ├── components/
│   │   ├── nav.css
│   │   ├── hero.css
│   │   ├── cards.css
│   │   └── footer.css
│   └── main.css
├── types/
│   └── index.ts
└── App.ts
```

## Key Features for Enhancement

1. **TypeScript Strict Mode**: Full type safety
2. **CSS Modules**: Scoped styling per component
3. **Build System**: Vite or Webpack for bundling
4. **State Management**: Consider Zustand or Context API
5. **API Layer**: Fetch real card data
6. **Testing**: Jest + Testing Library
7. **Accessibility**: ARIA labels, keyboard navigation
8. **Performance**: Virtual scrolling for large card lists
9. **Progressive Enhancement**: Server-side rendering option

## Dependencies to Add

```json
{
  "typescript": "^5.0.0",
  "vite": "^5.0.0",
  "@types/node": "^20.0.0"
}
```

## Summary

This is a well-structured proof-of-concept SPA demonstrating OOP principles in JavaScript. The component-based architecture and encapsulated models make it an excellent candidate for TypeScript migration. The next phase should focus on:
1. Setting up TypeScript configuration
2. Modularizing into separate files
3. Extracting CSS into modules
4. Adding proper typings
5. Implementing a build pipeline
