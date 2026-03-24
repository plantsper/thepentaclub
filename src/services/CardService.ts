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

interface CardTagRow {
  tags: TagRow;
}

interface CardRow {
  id: string;
  name: string;
  type: CardType;
  price: number;
  attack: number;
  defense: number;
  description: string;
  art_gradient: string;
  art_url: string | null;
  card_set_code: string | null;
  card_code: string | null;
  card_rarities: RarityRow;
  card_sets: SetRow;
  card_tags: CardTagRow[];
}

export async function fetchCards(): Promise<ICard[]> {
  const { data, error } = await getSupabaseClient()
    .from('cards')
    .select(`
      *,
      card_rarities(id, name, sort_order, color_hex),
      card_sets(id, name, slug, description),
      card_tags(tags(id, name))
    `)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data as CardRow[]).map(row => new Card(
    row.id,
    row.name,
    row.type,
    {
      id: row.card_rarities.id,
      name: row.card_rarities.name,
      sortOrder: row.card_rarities.sort_order,
      colorHex: row.card_rarities.color_hex,
    },
    Number(row.price),
    row.attack,
    row.defense,
    row.description,
    row.art_gradient,
    {
      id: row.card_sets.id,
      name: row.card_sets.name,
      slug: row.card_sets.slug,
      description: row.card_sets.description,
    },
    (row.card_tags ?? []).map(ct => ct.tags),
    row.art_url ?? undefined,
    row.card_set_code ?? undefined,
    row.card_code ?? undefined
  ));
}
