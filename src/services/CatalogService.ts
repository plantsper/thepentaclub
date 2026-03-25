/**
 * CatalogService — DB cache layer for Riftcodex card data.
 *
 * Keyed by (set_code, collector_num, variant). Import paths check this cache
 * first; the Riftcodex API is only called on a true cache miss or stale entry.
 */

import { getSupabaseClient } from './supabaseClient';
import { setIndexFromCatalog } from './RiftcodexService';
import type { CardVariant } from '../utils/cardVariant';

const CATALOG_TTL_DAYS = 30;

// ── Types ──────────────────────────────────────────────────────────────────

export interface CatalogEntry {
  id:            string;
  set_code:      string;
  collector_num: number;
  variant:       CardVariant;
  name:          string;
  type:          string | null;
  rarity_name:   string | null;
  set_name:      string | null;
  energy:        number;
  supertype:     string | null;
  attack:        number;
  defense:       number;
  description:   string;
  flavour:       string | null;
  artist:        string | null;
  domains:       string[];
  image_url:     string | null;
  fetched_at:    string;
  catalog_tags?: { tags: { id: number; name: string } }[];
}

export type CatalogEntryInput = Omit<CatalogEntry, 'id' | 'fetched_at' | 'catalog_tags'>;

// ── Index warm-up ──────────────────────────────────────────────────────────

/**
 * Read all catalog entries from DB and populate the RiftcodexService in-memory
 * index. Returns true if any entries were found (index is now warm).
 * Call this at admin startup before buildCardIndex() as the fast-path.
 */
export async function warmIndexFromCatalog(): Promise<boolean> {
  const entries = await fetchAllCatalogEntries();
  if (entries.length === 0) return false;
  setIndexFromCatalog(entries);
  return true;
}

// ── Lookup ─────────────────────────────────────────────────────────────────

/**
 * Look up a single catalog entry by (set_code, collector_num, variant).
 * Returns null on cache miss or if the entry is stale (> CATALOG_TTL_DAYS old).
 */
export async function lookupCatalog(
  setCode:      string,
  collectorNum: number,
  variant:      CardVariant = 'standard',
): Promise<CatalogEntry | null> {
  const { data, error } = await getSupabaseClient()
    .from('riftcodex_catalog')
    .select('*, catalog_tags(tags(id, name))')
    .eq('set_code',      setCode.toUpperCase())
    .eq('collector_num', collectorNum)
    .eq('variant',       variant)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const entry = data as CatalogEntry;

  // Treat stale entries as a miss so the caller can refresh them
  const ageMs = Date.now() - new Date(entry.fetched_at).getTime();
  if (ageMs > CATALOG_TTL_DAYS * 86_400_000) return null;

  return entry;
}

/**
 * Fetch all catalog entries — used to warm the in-memory Riftcodex index.
 * Does NOT filter by TTL; returns everything so the index stays fully populated.
 */
export async function fetchAllCatalogEntries(): Promise<CatalogEntry[]> {
  const { data, error } = await getSupabaseClient()
    .from('riftcodex_catalog')
    .select('*');

  if (error) throw error;
  return (data ?? []) as CatalogEntry[];
}

// ── Upsert ─────────────────────────────────────────────────────────────────

/**
 * Insert or update a catalog entry. Tags are synced separately.
 * Returns the catalog ID (existing or newly created).
 */
export async function upsertCatalog(
  entry:    CatalogEntryInput,
  tagNames: string[],
): Promise<string> {
  const { data, error } = await getSupabaseClient()
    .from('riftcodex_catalog')
    .upsert(
      { ...entry, set_code: entry.set_code.toUpperCase(), fetched_at: new Date().toISOString() },
      { onConflict: 'set_code,collector_num,variant' },
    )
    .select('id')
    .single();

  if (error) throw error;
  const catalogId = (data as { id: string }).id;

  if (tagNames.length > 0) {
    await syncCatalogTags(catalogId, tagNames);
  }

  return catalogId;
}

// ── Combined lookup-or-fetch ───────────────────────────────────────────────

/**
 * Returns a catalog entry from the DB if cached and fresh.
 * If the entry is missing or stale, calls `fetchFn` to get fresh data from the
 * Riftcodex API, writes it to the catalog, and returns the upserted entry.
 *
 * `fetchFn` is injected so CatalogService stays decoupled from RiftcodexService.
 */
export async function lookupOrFetch(
  setCode:      string,
  collectorNum: number,
  variant:      CardVariant,
  fetchFn:      (setCode: string, collectorNum: number) => Promise<{ entry: CatalogEntryInput; tags: string[] } | null>,
): Promise<{ catalogId: string; entry: CatalogEntry } | null> {
  // 1. DB cache hit (fresh)
  const cached = await lookupCatalog(setCode, collectorNum, variant);
  if (cached) return { catalogId: cached.id, entry: cached };

  // 2. Cache miss or stale — fetch from API
  const fresh = await fetchFn(setCode, collectorNum);
  if (!fresh) return null;

  const catalogId = await upsertCatalog(fresh.entry, fresh.tags);
  return {
    catalogId,
    entry: { ...fresh.entry, id: catalogId, fetched_at: new Date().toISOString() },
  };
}

// ── Tag sync ───────────────────────────────────────────────────────────────

async function syncCatalogTags(catalogId: string, tagNames: string[]): Promise<void> {
  if (!tagNames.length) return;
  const sb = getSupabaseClient();

  // Fetch existing tags by name
  const { data: existingTags } = await sb
    .from('tags')
    .select('id, name')
    .in('name', tagNames);

  const existingMap = new Map<string, number>(
    (existingTags ?? []).map((t: { id: number; name: string }) => [t.name.toLowerCase(), t.id]),
  );

  // Insert any tags that don't exist yet
  const missing = tagNames.filter(n => !existingMap.has(n.toLowerCase()));
  if (missing.length) {
    const { data: created } = await sb
      .from('tags')
      .insert(missing.map(name => ({ name })))
      .select('id, name');
    (created ?? []).forEach((t: { id: number; name: string }) => {
      existingMap.set(t.name.toLowerCase(), t.id);
    });
  }

  const tagIds = tagNames
    .map(n => existingMap.get(n.toLowerCase()))
    .filter((id): id is number => id !== undefined);

  // Replace all catalog tags for this entry
  await sb.from('catalog_tags').delete().eq('catalog_id', catalogId);
  if (tagIds.length > 0) {
    await sb.from('catalog_tags').insert(
      tagIds.map(tagId => ({ catalog_id: catalogId, tag_id: tagId })),
    );
  }
}
