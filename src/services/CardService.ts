import { getSupabaseClient } from './supabaseClient';
import { Card } from '../models/Card';
import type { ICard, CardType } from '../types';

interface RarityRow {
  id: number;
  name: string;
  sort_order: number;
  color_hex: string;
}

interface SetRow {
  id: number;
  name: string;
  slug: string;
  description: string;
}

interface TagRow {
  id: number;
  name: string;
}

interface CatalogTagRow {
  tags: TagRow;
}

interface CatalogRow {
  id: string;
  name: string;
  type: string | null;
  energy: number;
  supertype: string | null;
  attack: number;
  defense: number;
  description: string;
  flavour: string | null;
  artist: string | null;
  domains: string[];
  image_url: string | null;
  catalog_tags: CatalogTagRow[];
}

interface CardRow {
  id: string;
  price: number;
  art_gradient: string;
  art_url: string | null;
  card_set_code: string | null;
  card_code: string | null;
  catalog_id: string | null;
  card_rarities: RarityRow;
  card_sets: SetRow;
  riftcodex_catalog: CatalogRow | null;
}

export async function fetchCards(): Promise<ICard[]> {
  const { data, error } = await getSupabaseClient()
    .from('cards')
    .select(`
      id,
      price,
      art_gradient,
      art_url,
      card_set_code,
      card_code,
      catalog_id,
      card_rarities(id, name, sort_order, color_hex),
      card_sets(id, name, slug, description),
      riftcodex_catalog(
        id, name, type, energy, supertype, attack, defense,
        description, flavour, artist, domains, image_url,
        catalog_tags(tags(id, name))
      )
    `)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data as unknown as CardRow[]).map(row => {
    const cat = row.riftcodex_catalog;
    return new Card(
      row.id,
      cat?.name          ?? '',
      (cat?.type         ?? 'Spell') as CardType,
      {
        id:        row.card_rarities.id,
        name:      row.card_rarities.name,
        sortOrder: row.card_rarities.sort_order,
        colorHex:  row.card_rarities.color_hex,
      },
      Number(row.price),
      cat?.attack        ?? 0,
      cat?.defense       ?? 0,
      cat?.description   ?? '',
      row.art_gradient,
      {
        id:          row.card_sets.id,
        name:        row.card_sets.name,
        slug:        row.card_sets.slug,
        description: row.card_sets.description,
      },
      (cat?.catalog_tags ?? []).map(ct => ct.tags),
      row.art_url        ?? undefined,
      row.card_set_code  ?? undefined,
      row.card_code      ?? undefined,
      cat?.energy        ?? 0,
      cat?.supertype     ?? undefined,
      cat?.domains       ?? [],
      cat?.flavour       ?? undefined,
      cat?.artist        ?? undefined,
      cat?.image_url     ?? undefined,
    );
  });
}
