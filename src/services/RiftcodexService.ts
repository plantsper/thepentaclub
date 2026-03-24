/**
 * RiftcodexService — client for the public Riftcodex TCG card API.
 * Base URL: https://api.riftcodex.com  (no auth required)
 *
 * Primary use-case: fuzzy-search a card by name after OCR extraction,
 * then map the rich API response to our AdminPageComponent form fields.
 */

const BASE = 'https://api.riftcodex.com';

// ── API response types ───────────────────────────────────────────────────────

export interface RiftcodexCard {
  id: string;
  name: string;
  riftbound_id?: string;
  collector_number?: number;    // numeric in the real API
  public_code?: string;
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
    set_id: string;   // e.g. "SFD"
    label:  string;   // e.g. "Spiritforged"
  };
  tags: string[];
  media: {
    image_url:          string | null;
    artist:             string | null;
    accessibility_text: string | null;
  };
  metadata?: {
    clean_name:    string;
    alternate_art: boolean;
    overnumbered:  boolean;
    signature:     boolean;
  };
}

// Real API list wrapper uses "items", not "data"
interface ApiListResponse<T> {
  items: T[];
  total: number;
  page:  number;
  size:  number;
  pages: number;
}

// ── Mapped result returned to the admin form ─────────────────────────────────

export interface RiftcodexMatch {
  source: 'riftcodex';
  card:   RiftcodexCard;
  /** Our form-ready values */
  fields: {
    name:          string;
    type?:         string;        // 'Champion' | 'Spell' | 'Artifact'
    rarityName?:   string;        // matched against card_rarities.name
    setName?:      string;        // matched against card_sets.name
    manaCost?:     number;
    attack?:       number;
    defense?:      number;
    description?:  string;
    imageUrl?:     string;        // Riftcodex CDN URL — can skip manual art upload
    tags:          string[];      // tag names to cross-reference our tags table
    setValidated?: boolean;       // true if OCR set code confirms the name match
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fuzzy-search for a card by name.
 *
 * When a `setCode` is provided (e.g. "SFD" from OCR of "SFD • 249/221"),
 * it is used as a secondary validation signal: among multiple fuzzy candidates
 * we prefer the one whose set.set_id matches the OCR'd set code.
 *
 * Returns the best match or null if nothing was found / network error.
 */
export async function fuzzySearchCard(
  name: string,
  setCode?: string,
): Promise<RiftcodexMatch | null> {
  if (!name.trim()) return null;

  try {
    // Request a few candidates so we can pick the best set-code match
    const size = setCode ? 5 : 1;
    const url  = `${BASE}/cards/name?fuzzy=${encodeURIComponent(name.trim())}&size=${size}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;

    const json = await resp.json() as ApiListResponse<RiftcodexCard>;
    const candidates = json.items ?? [];

    if (candidates.length === 0) return null;

    // Always take the top-ranked fuzzy name match as the primary result.
    // If a setCode is provided, look for a same-name candidate from that set
    // only — do not fall back to a completely different card just because it
    // has the right set code (that would cause wrong-card returns on OCR errors).
    const best = candidates[0];

    let setValidated = false;
    if (setCode) {
      // The name match is set-validated if the top result is already from the
      // right set, OR another candidate with the same name is from that set.
      const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const bestNameNorm = normalise(best.name);
      const sameNameInSet = candidates.find(
        c =>
          c.set?.set_id?.toUpperCase() === setCode.toUpperCase() &&
          normalise(c.name) === bestNameNorm,
      );
      setValidated = sameNameInSet !== undefined ||
        best.set?.set_id?.toUpperCase() === setCode.toUpperCase();
    }

    return {
      source: 'riftcodex',
      card:   best,
      fields: { ...mapFields(best), setValidated },
    };
  } catch {
    return null;
  }
}

/**
 * Full-text search — useful for a manual search input in the admin form.
 */
export async function searchCards(query: string, size = 10): Promise<RiftcodexCard[]> {
  if (!query.trim()) return [];

  try {
    const url  = `${BASE}/cards/search?query=${encodeURIComponent(query.trim())}&size=${size}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return [];

    const json = await resp.json() as ApiListResponse<RiftcodexCard>;
    return json.items ?? [];
  } catch {
    return [];
  }
}

// ── Mapping ──────────────────────────────────────────────────────────────────

function mapFields(card: RiftcodexCard): Omit<RiftcodexMatch['fields'], 'setValidated'> {
  // Map Riftbound API types → our DB CardType (Champion | Spell | Artifact).
  // Full Riftbound type list as of 2025:
  //   Champion-like: Champion, Legend, Unit, Unit Token
  //   Spell-like:    Spell, Rune
  //   Artifact-like: Gear, Battlefield
  const typeRaw = (card.classification?.type ?? '').toLowerCase();
  const type: string | undefined =
      ['champion', 'legend', 'unit'].some(t => typeRaw.includes(t)) ? 'Champion'
    : ['spell', 'rune'].some(t => typeRaw.includes(t))               ? 'Spell'
    : ['gear', 'battlefield'].some(t => typeRaw.includes(t))         ? 'Artifact'
    : undefined;

  return {
    name:        card.name,
    type,
    rarityName:  card.classification?.rarity ?? undefined,
    setName:     card.set?.label             ?? undefined,
    // energy = play cost; might = primary combat stat; power = secondary stat
    manaCost:    card.attributes?.energy     ?? undefined,
    attack:      card.attributes?.might      ?? undefined,
    defense:     card.attributes?.power      ?? undefined,
    description: card.text?.plain            ?? undefined,
    imageUrl:    card.media?.image_url       ?? undefined,
    tags:        card.tags                   ?? [],
  };
}
