# Infrastructure: Card CMS

## Decision: Supabase

**Why Supabase over alternatives:**

| Option | Verdict |
|---|---|
| Supabase (PostgreSQL + REST API) | ✅ Chosen — owns your data, zero backend, great studio UI |
| Railway + Directus | More control but requires managing two services |
| PlanetScale (MySQL) | No free tier anymore, MySQL less expressive for relations |
| MongoDB Atlas | Document DB fine for cards but less queryable |
| Strapi / Payload CMS | Overkill — requires hosting a Node server, more complexity |

Supabase gives you:
- PostgreSQL database (hosted, yours to export anytime)
- Auto-generated REST + GraphQL API (PostgREST — no backend needed)
- **Supabase Studio table editor = the CMS UI**
- Row Level Security: public can read cards, only authed admins can write
- TypeScript SDK (`@supabase/supabase-js`)
- Free tier: 500MB DB, unlimited API calls, 2 projects

---

## Architecture

```
Supabase (PostgreSQL)
  └── cards table
        └── PostgREST REST API  ←── Supabase Studio (CMS / admin)
                  ↑
       @supabase/supabase-js
                  ↑
         CardService.ts
                  ↑
            App.ts (async init)
                  ↑
       CardCollection → components
```

---

## Setup Steps

### 1. Create a Supabase project

1. Go to https://supabase.com and sign in
2. Click **New project**
3. Name it `riftbound-tcg`, choose a region closest to your users, set a strong DB password
4. Wait ~2 minutes for provisioning

### 2. Create the cards table

In Supabase dashboard → **SQL Editor** → paste and run:

```sql
-- supabase/migrations/001_create_cards_table.sql

CREATE TABLE cards (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT        NOT NULL,
  type         TEXT        NOT NULL CHECK (type IN ('Champion', 'Spell', 'Artifact')),
  rarity       TEXT        NOT NULL CHECK (rarity IN ('Legendary', 'Epic', 'Rare', 'Common')),
  mana_cost    INTEGER     NOT NULL DEFAULT 0,
  attack       INTEGER     NOT NULL DEFAULT 0,
  defense      INTEGER     NOT NULL DEFAULT 0,
  description  TEXT        NOT NULL DEFAULT '',
  art_gradient TEXT        NOT NULL DEFAULT '',
  set_name     TEXT        NOT NULL CHECK (set_name IN ('Rift Core', 'Shattered Realms', 'Tidal Abyss', 'Void Expanse')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Public read access (no auth needed to browse cards)
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read cards"
  ON cards FOR SELECT
  USING (true);

-- Only authenticated users (admins) can insert/update/delete
CREATE POLICY "Authenticated users can manage cards"
  ON cards FOR ALL
  USING (auth.role() = 'authenticated');
```

### 3. Seed the sample cards

In SQL Editor, run the seed from `supabase/migrations/002_seed_cards.sql`.
Or paste cards manually via Supabase Studio → Table Editor → Insert rows.

### 4. Get your API keys

Dashboard → **Project Settings** → **API**:
- Copy **Project URL** → `VITE_SUPABASE_URL`
- Copy **anon/public key** → `VITE_SUPABASE_ANON_KEY`

### 5. Set up environment variables

```bash
cp .env.example .env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### 6. Install the Supabase client

```bash
npm install @supabase/supabase-js
```

### 7. Deploy frontend

The frontend remains a static site (no server needed). Deploy to:
- **Vercel** (recommended) — `vercel --prod`
- **Netlify** — drag dist/ folder or connect GitHub

Add the env vars in the hosting dashboard under Environment Variables.

---

## Using Supabase Studio as the CMS

Dashboard → **Table Editor** → `cards` table:
- **Add a card**: Insert row button → fill fields
- **Edit a card**: Click a row → edit inline
- **Delete a card**: Select row → Delete
- **Filter/search**: Use the filter bar at the top

For more advanced CMS features later (rich text descriptions, image uploads for card art), Supabase Storage can host card art images and you replace `art_gradient` with an `art_url` column.

---

---

## Card Image Hosting (Supabase Storage)

Card images live in the `card-art` bucket in Supabase Storage. The `art_url` column on a card row points to the public URL of its image. If `art_url` is null the card falls back to `art_gradient`.

### Uploading an image

**Via Supabase Studio:**
1. Dashboard → **Storage** → `card-art` bucket
2. Click **Upload file** → pick your image (JPEG/PNG/WebP, max 5MB)
3. Right-click the uploaded file → **Copy URL** — it looks like:
   `https://[project-id].supabase.co/storage/v1/object/public/card-art/vexar.jpg`
4. Dashboard → **Table Editor** → `cards` → find the card row → paste the URL into `art_url` → Save

### Recommended image dimensions

Cards render at a **3:4.2 aspect ratio** with the art filling the top 65%. The lightbox panel is 260px wide × full height.

| Use | Recommended size |
|---|---|
| Card grid thumbnail | 400 × 560 px |
| Lightbox panel | 520 × 730 px |
| Safe for both | **520 × 730 px** @ 2x = 1040 × 1460 px |

Upload at 1040 × 1460 px — the browser scales it down with `object-fit: cover` automatically.

`object-position: center top` is set by default so the subject's face/focus stays visible in the cropped thumbnail.

---

## Future: Custom Admin Panel

Once you outgrow Supabase Studio, build a protected `/admin` route in this SPA:
- Sign in with `supabase.auth.signInWithPassword()`
- CRUD forms that call `supabase.from('cards').insert/update/delete`
- Only accessible to authenticated users (enforced by RLS)
