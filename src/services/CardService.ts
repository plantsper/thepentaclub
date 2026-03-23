import { createClient } from '@supabase/supabase-js';
import { Card } from '../models/Card';
import type { ICard, CardType, CardRarity, CardSet } from '../types';

interface CardRow {
  id: string;
  name: string;
  type: CardType;
  rarity: CardRarity;
  mana_cost: number;
  attack: number;
  defense: number;
  description: string;
  art_gradient: string;
  set_name: CardSet;
  art_url: string | null;
}

export async function fetchCards(): Promise<ICard[]> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars not set');

  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data as CardRow[]).map(
    (row) =>
      new Card(
        row.id,
        row.name,
        row.type,
        row.rarity,
        row.mana_cost,
        row.attack,
        row.defense,
        row.description,
        row.art_gradient,
        row.set_name,
        row.art_url ?? undefined
      )
  );
}
