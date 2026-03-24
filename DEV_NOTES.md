# Dev Notes — The Pentaclub

*Checkpoint: 2026-03-24. Current state: TypeScript SPA, Supabase backend, Claude vision OCR, Riftcodex lookup.*

---

## Current Improvements

### ✅ 1. Remove Tesseract.js

~~`tesseract.js` (v7.0.0) is still in `package.json`~~ — uninstalled. `@types/node` also removed.

---

### ✅ 2. XSS: Sanitize HTML Before Inserting into DOM

Fixed. Added `src/utils/esc.ts` with `esc()` (HTML entity escaping) and `safeUrl()` (http/https validation). Applied across `CardLightboxComponent`, `CardsPageComponent`, and `AdminPageComponent`. `colorHex` values validated against a hex regex before use in CSS.

---

### ✅ 3. Missing Loading/Error States

Fixed. Claude API call in `CardOcrService` now has a 20s `AbortSignal.timeout()` — on expiry the existing error handler in `AdminPageComponent` surfaces the error status. `CardsPageComponent` error state was already covered by `App.ts` falling back to sample data.

---

### 4. Hardcoded Homepage Stats

`StatsComponent.ts` renders `500+ cards`, `7 realms`, `50K+ players`, `4 rarities` as static strings not connected to the database.

**Fix when ready:** Query Supabase for `COUNT(*)` from `cards`, `card_sets`, `card_rarities` and inject live numbers. For now, just be aware these values drift.

---

### ✅ 5. DOM Null-Safety

Fixed. Added private `#el<T>(id)` helper to `AdminPageComponent` — throws a descriptive error if an element is missing instead of silently returning `null`. Applied to all form field reads in `#handleSave` and key methods.

---

### ✅ 6. Admin Form Validation

Fixed. `#handleSave` now validates `name` (required), `rarity_id` (must be non-zero), and `set_id` (must be non-zero) before hitting Supabase. Errors surface inline via the existing `formError` element.

---

### ✅ 7. Auth: Password Reset Redirect URL

Fixed. `AuthService.sendPasswordReset` now uses `window.location.origin + '/#/reset-password'` — always lands on the correct route regardless of current path or subpath deployment.

---

### ✅ 8. Nav: Active Route Highlight

Already implemented — `NavComponent.updateActive()` toggles `.nav__link.active` and is called by `Router` on every navigation. CSS has the underline dot indicator. No changes needed.

---

### ✅ 9. Accessibility Gaps

Fixed. Admin table Edit/Delete buttons now have `aria-label="Edit {name}"` / `aria-label="Delete {name}"`. Tag/set delete chips also have descriptive `aria-label`. Form labels already had correct `for`/`id` pairs. `CardLightboxComponent` now has a Tab/Shift+Tab focus trap, moves focus to the close button on open, and restores focus to the previously focused element on close.

---

### ✅ 10. `sampleData.ts` Drift

Verified — TypeScript strict mode confirms all 16 sample cards match the current `ICard` shape. Added a comment flagging it as a fallback that needs review if the schema changes. Leaving the fallback in place since it provides a useful offline/demo experience.

---

---

## Ecommerce — Planning Notes

*Not building yet, but these are the key decisions to make before starting.*

### What We're Building

A marketplace layer on top of the existing card catalog — allowing users to list cards for sale, browse listings, and purchase. Think TCGPlayer-lite: fixed-price listings per card, with a cart and checkout flow.

---

### Database Schema (Proposed)

Everything builds on the existing `cards` table. New tables needed:

```sql
-- User profiles (extends Supabase auth.users)
user_profiles (
  id UUID PK (references auth.users)
  display_name TEXT
  avatar_url TEXT
  created_at TIMESTAMPTZ
)

-- A user's physical card inventory
user_cards (
  id UUID PK
  user_id UUID (FK user_profiles)
  card_id UUID (FK cards)
  condition TEXT ('NM' | 'LP' | 'MP' | 'HP' | 'DMG')
  foil BOOLEAN
  quantity INTEGER
  created_at TIMESTAMPTZ
)

-- Marketplace listings
listings (
  id UUID PK
  seller_id UUID (FK user_profiles)
  card_id UUID (FK cards)
  condition TEXT
  foil BOOLEAN
  quantity INTEGER  -- units available
  price_cents INTEGER  -- avoid float math
  status TEXT ('active' | 'sold' | 'cancelled')
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ
)

-- Orders
orders (
  id UUID PK
  buyer_id UUID (FK user_profiles)
  status TEXT ('pending' | 'paid' | 'shipped' | 'complete' | 'refunded')
  total_cents INTEGER
  stripe_payment_intent_id TEXT
  created_at TIMESTAMPTZ
)

-- Line items per order
order_items (
  id UUID PK
  order_id UUID (FK orders)
  listing_id UUID (FK listings)
  quantity INTEGER
  price_cents INTEGER  -- snapshot at time of purchase
)
```

**RLS:** Listings are publicly readable. Orders/user_cards are private to the owner. Admins can read everything.

---

### Payment Processing

**Stripe** is the right call. Specifically:

- **Stripe Checkout** for the initial build — hosted payment page, handles card input, no PCI scope needed on our end.
- Later: Stripe Elements for an embedded checkout if we want to keep users on-site.
- **Stripe Connect** if we want a marketplace model (seller payouts) — skip this for v1, just handle all transactions as direct purchases through one account.

**Flow:**
1. User adds listing(s) to cart (cart = client-side state or `localStorage`)
2. User hits checkout → POST to Supabase Edge Function → Edge Function calls `stripe.paymentIntents.create()`
3. Front-end confirms payment with Stripe.js
4. On success: Edge Function creates `order` + `order_items`, marks listings as sold

Stripe keys must live in a **Supabase Edge Function**, never in `VITE_*` env vars. No Stripe secret key in the browser.

---

### New Routes Needed

| Route | Component | Description |
|---|---|---|
| `#/market` | `MarketPageComponent` | Browse all active listings, filter by card/rarity/price |
| `#/listing/:id` | `ListingPageComponent` | Single listing detail + add to cart |
| `#/cart` | `CartPageComponent` | Cart summary + checkout trigger |
| `#/profile/:id` | `ProfilePageComponent` | User's listings + collection |
| `#/orders` | `OrdersPageComponent` | Buyer order history (auth required) |
| `#/sell` | `SellPageComponent` | Create new listing from user's inventory (auth required) |

The existing hash-based `Router.ts` supports parameterized routes — add `:id` matching.

---

### Services Needed

- `ListingService.ts` — CRUD for listings
- `CartService.ts` — client-side cart state (localStorage-backed)
- `OrderService.ts` — create orders, fetch history
- `StripeService.ts` — thin wrapper to call Edge Functions for payment intents

---

### Key Decisions Before Starting

1. **Marketplace model vs. direct sales** — Do sellers list their own cards, or does the site sell cards it owns inventory of? This changes the schema significantly (Connect vs. single account).

2. **Who can sell?** — Any authenticated user, or admin-only at first?

3. **Card condition** — Are we tracking `NM/LP/MP/HP/DMG` conditions, or just "card + quantity"?

4. **User profiles** — Do we need display names and avatars now, or can seller = email only for v1?

5. **Shipping** — Physical cards need shipping. Are we collecting addresses at checkout, or is this digital-only for now?

6. **Currency** — USD only? International considerations?

---

### Pre-Ecommerce Cleanup Checklist

Before adding ecommerce, these existing issues become load-bearing:

- [ ] **Auth must be solid** — password reset flow, session persistence. Fix item #7 above.
- [ ] **User profiles table** — Supabase auth gives us `auth.users`, but we need a `user_profiles` table in the public schema.
- [ ] **RLS policy review** — Current policies allow any authenticated user to write to `cards`. Once we have user-specific data, we need row-level ownership checks.
- [ ] **Error handling** — Checkout failures must surface clearly. Fix items #3 and #6 above first.
- [ ] **Remove Tesseract** — Clean the bundle before adding Stripe.js.
