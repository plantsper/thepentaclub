/**
 * RiftcodexService — client for the public Riftcodex TCG card API.
 * Base URL: https://api.riftcodex.com  (no auth required)
 *
 * ## Primary lookup strategy
 *
 * `buildCardIndex()` pre-fetches all ~939 cards once per session and builds an
 * in-memory Map keyed by "SET_CODE:COLLECTOR_NUMBER" (e.g. "SFD:51").
 *
 * Once the index is ready, `lookupByCardCode(setCode, collectorNum)` gives an
 * instant, guaranteed match from the card number OCR'd off the physical card.
 *
 * ## Fallback
 *
 * `fuzzySearchCard(name, setCode?)` is used when card-number OCR fails.
 * Set code is used as a validation signal — not to swap to a different card.
 */

const BASE = 'https://api.riftcodex.com';

// ── API types ─────────────────────────────────────────────────────────────────

export interface RiftcodexCard {
  id: string;
  name: string;
  riftbound_id?: string;
  collector_number?: number;
  attributes: {
    energy: number | null;
    might:  number | null;
    power:  number | null;
  };
  classification: {
    type:      string;
    rarity:    string;
    supertype: string | null;
    domain:    string[];
  };
  text: {
    rich:    string;
    plain:   string;
    flavour: string | null;
  };
  set: {
    set_id: string;
    label:  string;
  };
  tags: string[];
  media: {
    image_url:          string | null;
    artist:             string | null;
    accessibility_text: string | null;
  };
  orientation?: string;
}

interface ApiListResponse<T> {
  items: T[];
  total: number;
  page:  number;
  size:  number;
  pages: number;
}

export interface RiftcodexMatch {
  source:      'riftcodex';
  lookupMethod: 'card-code' | 'fuzzy-name';
  card:        RiftcodexCard;
  fields: {
    name:          string;
    type?:         string;
    rarityName?:   string;
    setName?:      string;
    manaCost?:     number;
    attack?:       number;
    defense?:      number;
    description?:  string;
    imageUrl?:     string;
    tags:          string[];
    setValidated?: boolean;
    energy?:       number;
    supertype?:    string;
    domains:       string[];
    flavour?:      string;
    artist?:       string;
  };
}

// ── Card index (pre-fetched, module-level cache) ──────────────────────────────

let _index: Map<string, RiftcodexCard> | null = null;
let _indexPromise: Promise<void> | null = null;

function indexKey(setCode: string, collectorNum: number | string): string {
  return `${setCode.toUpperCase()}:${Number(collectorNum)}`;
}

/**
 * Pre-fetch all cards and build an in-memory lookup index.
 * Safe to call multiple times — only fetches once per session.
 *
 * Call this early (e.g. when the admin form opens) so it's ready by the time
 * the user uploads a card image.
 */
export async function buildCardIndex(): Promise<void> {
  if (_index) return;
  if (_indexPromise) return _indexPromise;

  _indexPromise = (async () => {
    const allCards: RiftcodexCard[] = [];
    let page = 1;

    // Riftcodex has ~939 cards, max size=100 → ~10 pages
    while (true) {
      const resp = await fetch(`${BASE}/cards?size=100&page=${page}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!resp.ok) break;
      const json = await resp.json() as ApiListResponse<RiftcodexCard>;
      allCards.push(...(json.items ?? []));
      if (page >= json.pages || (json.items?.length ?? 0) < 100) break;
      page++;
    }

    _index = new Map(
      allCards
        .filter(c => c.set?.set_id && c.collector_number != null)
        .map(c => [indexKey(c.set.set_id, c.collector_number!), c]),
    );
  })();

  return _indexPromise;
}

/**
 * Instant guaranteed lookup by set code + collector number.
 * Returns null if the index hasn't loaded yet or the code isn't found.
 */
export function lookupByCardCode(setCode: string, collectorNum: number | string): RiftcodexMatch | null {
  if (!_index) return null;
  const card = _index.get(indexKey(setCode, collectorNum));
  if (!card) return null;
  return { source: 'riftcodex', lookupMethod: 'card-code', card, fields: mapFields(card) };
}

export function isIndexReady(): boolean {
  return _index !== null;
}

// ── Fuzzy name search (fallback) ──────────────────────────────────────────────

/**
 * Fuzzy-search by card name.
 * Set code is used as a validation signal only — it does NOT switch to a
 * different card if the top name match is from a different set.
 */
export async function fuzzySearchCard(
  name: string,
  setCode?: string,
): Promise<RiftcodexMatch | null> {
  if (!name.trim()) return null;

  try {
    const size = setCode ? 5 : 1;
    const url  = `${BASE}/cards/name?fuzzy=${encodeURIComponent(name.trim())}&size=${size}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!resp.ok) return null;

    const json = await resp.json() as ApiListResponse<RiftcodexCard>;
    const candidates = json.items ?? [];
    if (!candidates.length) return null;

    const best = candidates[0];

    // Validate set code: true only if the top result is already from the right set
    let setValidated = false;
    if (setCode) {
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const bestNorm = norm(best.name);
      setValidated = best.set?.set_id?.toUpperCase() === setCode.toUpperCase() ||
        !!candidates.find(
          c => c.set?.set_id?.toUpperCase() === setCode.toUpperCase() && norm(c.name) === bestNorm,
        );
    }

    return {
      source: 'riftcodex',
      lookupMethod: 'fuzzy-name',
      card: best,
      fields: { ...mapFields(best), setValidated },
    };
  } catch {
    return null;
  }
}

/**
 * Full-text search — for the manual search input in the admin form.
 */
export async function searchCards(query: string, size = 10): Promise<RiftcodexCard[]> {
  if (!query.trim()) return [];
  try {
    const url  = `${BASE}/cards/search?query=${encodeURIComponent(query.trim())}&size=${size}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!resp.ok) return [];
    return ((await resp.json()) as ApiListResponse<RiftcodexCard>).items ?? [];
  } catch {
    return [];
  }
}

// ── Field mapping ─────────────────────────────────────────────────────────────

function mapFields(card: RiftcodexCard): Omit<RiftcodexMatch['fields'], 'setValidated'> {
  // Riftbound type → our DB CardType
  const typeRaw = (card.classification?.type ?? '').toLowerCase();
  const type: string | undefined =
      ['champion', 'legend', 'unit'].some(t => typeRaw.includes(t)) ? 'Champion'
    : ['spell', 'rune'].some(t => typeRaw.includes(t))               ? 'Spell'
    : ['gear', 'battlefield', 'equipment'].some(t => typeRaw.includes(t)) ? 'Artifact'
    : undefined;

  return {
    name:        card.name,
    type,
    rarityName:  card.classification?.rarity     ?? undefined,
    setName:     card.set?.label                 ?? undefined,
    manaCost:    card.attributes?.energy         ?? undefined,
    attack:      card.attributes?.might          ?? undefined,
    defense:     card.attributes?.power          ?? undefined,
    description: card.text?.plain                ?? undefined,
    imageUrl:    card.media?.image_url           ?? undefined,
    tags:        card.tags                       ?? [],
    energy:      card.attributes?.energy         ?? undefined,
    supertype:   card.classification?.supertype  ?? undefined,
    domains:     card.classification?.domain     ?? [],
    flavour:     card.text?.flavour              ?? undefined,
    artist:      card.media?.artist              ?? undefined,
  };
}
