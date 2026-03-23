# The Pentaclub — Riftbound TCG

A modern TypeScript-based single-page application for a trading card game set in the Wildrift universe.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The application will be available at **http://localhost:3000**

## 📁 Project Structure

```
thepentaclub/
├── src/
│   ├── types/              # TypeScript interfaces
│   ├── models/             # Data models (Card, CardCollection)
│   ├── services/           # Core services (Router, EventEmitter)
│   ├── components/         # UI components
│   │   ├── base/           # Abstract base component
│   │   ├── layout/         # Nav & Footer
│   │   ├── home/           # Home page components
│   │   └── pages/          # Page components
│   ├── utils/              # Utilities (ScrollAnimator, sampleData)
│   ├── styles/             # Modular CSS files
│   ├── App.ts              # Main application controller
│   ├── main.ts             # Entry point
│   └── index.html          # HTML template
├── package.json
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite build configuration
├── PROJECT_OVERVIEW.md     # Detailed project documentation
├── MIGRATION_PLAN.md       # Migration strategy
└── MIGRATION_COMPLETE.md   # Migration summary
```

## 🎯 Features

- **Trading Card Collection**: Browse and filter 500+ unique cards
- **Search & Filter**: Real-time search by name/type, filter by rarity
- **Responsive Design**: Mobile-first design with adaptive layouts
- **Smooth Animations**: Intersection Observer-based scroll animations
- **Hash Routing**: Client-side routing for seamless navigation

## 🛠️ Tech Stack

- **TypeScript**: Strict type checking and modern ES features
- **Vite**: Lightning-fast HMR and build tooling
- **CSS Modules**: Modular, maintainable stylesheets
- **Hash Router**: Simple SPA routing without server configuration

## 📦 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Build for production (outputs to dist/) |
| `npm run preview` | Preview production build locally |

## 🏗️ Architecture

### Component-Based
- Abstract `Component` base class
- Lifecycle methods (render, mount, afterMount, destroy)
- Dependency injection for testability

### Type-Safe
- Interfaces for all data structures
- Private fields with `#` syntax
- Strict TypeScript configuration

### Modular CSS
- Variables for theming
- Component-specific stylesheets
- Utility classes for animations

## 📄 Pages

- **Home** (`/`): Hero, stats, features, card preview, CTA
- **Cards** (`/cards`): Full collection with search and filters
- **About** (`/about`): Lore and universe information

## 🎨 Design System

### Colors
- **Backgrounds**: Deep dark blues (#060a10 to #1e3350)
- **Accent**: Bright cyan (#00e68a), blue (#00c4ff), purple (#a855f7)
- **Text**: Tiered from primary (#e8ecf4) to muted (#566380)

### Typography
- **Display/Body**: Outfit (sans-serif)
- **Accent**: Crimson Pro (serif)

### Effects
- Animated mesh gradient backgrounds
- Glassmorphism navigation
- Card hover transformations
- Staggered entrance animations

## 🔧 Development

### Adding a New Component

1. Create TypeScript file in `src/components/`
2. Extend the `Component` base class
3. Implement `render()` method
4. Optional: Override `afterMount()` for event listeners
5. Create corresponding CSS in `src/styles/components/`
6. Import in parent component or App.ts

### Adding a New Page

1. Create component in `src/components/pages/`
2. Register route in `App.ts`
3. Add navigation link in `NavComponent.ts`

## 📊 Type Safety

All major structures have TypeScript interfaces:
- `ICard`, `ICardCollection`
- `IComponent`, `IStat`, `IFeature`
- `IRouter`, `IEventEmitter`

## 🚢 Deployment

### Build for Production

```bash
npm run build
```

Outputs to `dist/` folder. Deploy this folder to:
- Vercel
- Netlify
- GitHub Pages
- Any static hosting service

### Vercel Deployment

```bash
vercel --prod
```

## 📝 Notes

- Original `index.html` in root is kept as backup
- All new code is in `src/` directory
- TypeScript compilation checks before build
- No breaking changes - all functionality preserved

## 🤝 Contributing

1. Follow existing code structure
2. Use TypeScript strict mode
3. Add types for all functions
4. Keep components modular and focused
5. Run `npm run build` to check for errors

## 📖 Documentation

- [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) - Complete functionality breakdown
- [MIGRATION_PLAN.md](MIGRATION_PLAN.md) - Migration strategy
- [MIGRATION_COMPLETE.md](MIGRATION_COMPLETE.md) - What was changed

## 🎮 Card Rarities

- **Legendary**: Powerful realm-defining champions
- **Epic**: Rare spells and artifacts
- **Rare**: Strong champions and items
- **Common**: Basic spells and utilities

## 🌐 Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

---

**Status**: ✅ Production Ready
**Type Checking**: ✅ Passing
**Build**: ✅ Successful

Built with ❤️ for the Wildrift community
