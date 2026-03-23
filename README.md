# Riftbound TCG — The Pentaclub

A TypeScript SPA for the Riftbound TCG card game, set in the League of Legends / Runeterra universe. Cards are served from a Supabase database with card art hosted in Supabase Storage.

## Quick Start

```bash
npm install
cp .env.example .env.local   # fill in your Supabase keys
npm run dev                   # http://localhost:3000
```

If Supabase keys are not set, the app falls back to 16 hardcoded sample cards automatically.

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL (`https://xxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

Both values are in your Supabase dashboard under **Project Settings → API**.

## Database Setup

Run these SQL files in Supabase **SQL Editor** in order:

```
supabase/migrations/001_create_cards_table.sql   — schema + RLS
supabase/migrations/002_seed_cards.sql           — 16 sample cards
supabase/migrations/003_add_art_url.sql          — image column + storage bucket
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server with HMR at localhost:3000 |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build locally |

## Project Structure

```
src/
├── components/
│   ├── base/Component.ts           Abstract base class
│   ├── home/                       Homepage sections
│   │   ├── HeroComponent.ts
│   │   ├── StatsComponent.ts
│   │   ├── FeaturesComponent.ts
│   │   ├── CardGridComponent.ts    Emits card:open on click
│   │   └── CTAComponent.ts
│   ├── layout/
│   │   ├── NavComponent.ts
│   │   └── FooterComponent.ts
│   ├── pages/
│   │   ├── CardsPageComponent.ts   Emits card:open on click
│   │   └── AboutPageComponent.ts
│   └── shared/
│       └── CardLightboxComponent.ts  Global card detail modal
├── models/
│   ├── Card.ts                     Card data class
│   └── CardCollection.ts           Collection + filter/search
├── services/
│   ├── CardService.ts              Supabase data fetching
│   ├── EventEmitter.ts             Event bus (card:open, etc.)
│   └── Router.ts                   Hash-based SPA routing
├── styles/
│   ├── components/
│   │   ├── cards.css
│   │   ├── lightbox.css
│   │   └── ...
│   └── main.css
├── types/                          TypeScript interfaces
├── utils/
│   ├── sampleData.ts               Fallback card data
│   └── ScrollAnimator.ts
├── App.ts                          Async init, Supabase fetch
└── index.html
supabase/
└── migrations/                     SQL migration files
```

## Managing Cards (CMS)

Supabase Studio is the CMS. Go to your Supabase project dashboard:

- **Add/edit/delete cards**: Table Editor → `cards` table
- **Upload card art**: Storage → `card-art` bucket → Upload → copy public URL → paste into card's `art_url` field

Cards without an `art_url` render a CSS gradient instead.

**Recommended image size**: 1040 × 1460 px (the browser scales down with `object-fit: cover`).

## Architecture Notes

- **App init is async** — shows a spinner, fetches cards from Supabase, falls back to sample data on error
- **Lightbox** is mounted once globally, opened via `EventEmitter` (`card:open` event)
- **Card art** renders `<img>` when `artUrl` is set, falls back to CSS gradient div
- **Vite `envDir: '../'`** is required because `root` is `./src` — without it env vars are undefined at build time
- **Supabase client** is created lazily inside `fetchCards()` so a missing env var throws inside the try/catch rather than at module load

## Pages

| Route | Component |
|---|---|
| `#/` | Home — hero, stats, features, card preview grid, CTA |
| `#/cards` | Full collection with search + rarity filter |
| `#/about` | Riftbound universe lore |

## Tech Stack

- **TypeScript** (strict mode, ES2020)
- **Vite 8** (HMR, production bundling)
- **Supabase** (PostgreSQL + REST API + Storage)
- **@supabase/supabase-js** v2

## Deployment

```bash
npm run build   # outputs to dist/
```

Deploy `dist/` to Vercel, Netlify, or any static host. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in your hosting dashboard.
