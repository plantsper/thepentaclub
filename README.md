# Riftbound TCG — The Pentaclub

A TypeScript SPA for the Riftbound TCG card game, set in the League of Legends / Runeterra universe. Cards are served from a Supabase database with a relational schema for rarities, sets, and tags. Card art is hosted in Supabase Storage. An admin CMS at `#/admin` allows full card management behind email/password auth.

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
supabase/migrations/004_relational_schema.sql    — relational rarities, sets, tags
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
│   ├── base/Component.ts
│   ├── home/                       Homepage sections
│   │   ├── HeroComponent.ts
│   │   ├── StatsComponent.ts
│   │   ├── FeaturesComponent.ts
│   │   ├── CardGridComponent.ts    Emits card:open on click
│   │   └── CTAComponent.ts
│   ├── layout/
│   │   ├── NavComponent.ts         Auth-aware (Admin link / Logout)
│   │   └── FooterComponent.ts
│   ├── pages/
│   │   ├── CardsPageComponent.ts   Dynamic rarity filters, emits card:open
│   │   ├── AboutPageComponent.ts   Riftbound lore
│   │   ├── LoginPageComponent.ts   Email/password + forgot password
│   │   ├── ResetPasswordPageComponent.ts
│   │   └── AdminPageComponent.ts   Card CMS — CRUD, image upload, set/tag management
│   └── shared/
│       └── CardLightboxComponent.ts  Global card detail modal
├── models/
│   ├── Card.ts                     rarity: IRarity, set: ICardSet, tags: ITag[]
│   └── CardCollection.ts           Collection + filter/search
├── services/
│   ├── supabaseClient.ts           Lazy singleton client
│   ├── AuthService.ts              signIn/Out/Reset, getSession, onAuthStateChange
│   ├── CardService.ts              Nested Supabase fetch
│   ├── EventEmitter.ts
│   └── Router.ts
├── styles/
│   ├── components/
│   │   ├── auth.css
│   │   ├── admin.css
│   │   ├── lightbox.css
│   │   └── ...
│   └── main.css
├── types/                          IRarity, ICardSet, ITag, ICard, etc.
├── utils/
│   ├── sampleData.ts               Fallback card data
│   └── ScrollAnimator.ts
├── App.ts                          Async init, auth state, 6 routes
└── index.html
supabase/
└── migrations/
```

## Pages & Routes

| Route | Component | Auth |
|---|---|---|
| `#/` | Home — hero, stats, features, card preview, CTA | Public |
| `#/cards` | Full collection with search + rarity filter | Public |
| `#/about` | Riftbound universe lore | Public |
| `#/login` | Admin login + forgot password | Redirects to `/admin` if logged in |
| `#/admin` | Card CMS | Redirects to `/login` if not authenticated |
| `#/reset-password` | Set new password | Triggered by recovery email link |

## Admin CMS

Navigate to `#/login` (there is a subtle "Admin" link in the nav when logged out).

**First-time setup**: Create your admin account in Supabase dashboard → **Authentication → Users → Add user**. There is no public sign-up.

**What you can do in the admin:**
- Add, edit, delete cards
- Upload card art directly to Supabase Storage
- Manage sets (add/delete)
- Manage tags (add/delete) and assign tags to cards

**Forgot password**: Click "Forgot password?" on the login page. You'll receive an email link that returns you to the app and prompts for a new password.

> **Vercel deployment**: Add your Vercel domain to Supabase → Authentication → URL Configuration → Redirect URLs, or the password reset email link will be blocked.

## Managing Card Art

- **Upload**: Admin page → Edit card → upload file or paste URL
- **Direct**: Supabase Storage → `card-art` bucket → Upload → copy public URL → paste into `art_url`
- **Recommended size**: 1040 × 1460 px (scaled with `object-fit: cover`)
- Cards without `art_url` render a CSS gradient fallback

## Card Stats (Riftbound Terminology)

| DB column | UI label | Meaning |
|---|---|---|
| `mana_cost` | **Energy** | Colorless cost to play the card |
| `attack` | **Power** | Card's offensive output |
| `defense` | **Health** | Card's durability |

## Relational Schema

`card_rarities`, `card_sets`, and `tags` are separate tables. To add a new set or tag, insert a row in the admin page — no code changes or redeploy needed.

## Architecture Notes

- **App init is async** — loads cards + auth session in parallel, shows spinner, falls back to sample data on error
- **Supabase singleton** — `getSupabaseClient()` returns one instance so auth sessions persist across all service calls
- **Lightbox** — mounted once globally, opened via EventEmitter `card:open` event
- **Filter buttons** — dynamically derived from loaded cards sorted by `rarity.sortOrder`
- **Vite `envDir: '../'`** — required because `root` is `./src`; without it env vars are undefined at build time
- **Password recovery** — Supabase fires `PASSWORD_RECOVERY` via `onAuthStateChange`; app navigates to `#/reset-password` automatically

## Tech Stack

- **TypeScript** (strict mode, ES2020)
- **Vite 8** (HMR, production bundling)
- **Supabase** (PostgreSQL + REST API + Auth + Storage)
- **@supabase/supabase-js** v2

## Deployment

```bash
npm run build   # outputs to dist/
```

Deploy `dist/` to Vercel or Netlify. Add these environment variables in your hosting dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Add your deployment domain to Supabase → **Authentication → URL Configuration → Redirect URLs**.
