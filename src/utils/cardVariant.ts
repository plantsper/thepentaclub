/**
 * Card variant detection — shared between CardOcrService (parse time)
 * and the Card model (display/query time from stored card_code).
 *
 * Variant is derived, never stored. It is fully encoded in card_code:
 *   170/221   -> standard   (collector ≤ total)
 *   220/219   -> overnumber (collector > total, no suffix)
 *   000a/100  -> alt-art    (letter suffix)
 *   200[*]/199 -> signature  (asterisk suffix)
 */

export type CardVariant = 'standard' | 'overnumber' | 'alt-art' | 'signature' | 'unknown';

/**
 * Derive variant from a parsed collector number and optional total.
 */
export function detectVariant(collectorNum: string, total: string | undefined): CardVariant {
  if (collectorNum.endsWith('*')) return 'signature';
  if (/[a-z]$/i.test(collectorNum)) return 'alt-art';
  if (total && parseInt(collectorNum, 10) > parseInt(total, 10)) return 'overnumber';
  return 'standard';
}

/**
 * Derive variant from a stored card_code string, e.g. "220/219", "000a/100".
 * Returns 'unknown' if card_code is absent or unparseable.
 */
export function variantFromCardCode(cardCode: string | undefined): CardVariant {
  if (!cardCode) return 'unknown';
  const m = cardCode.match(/^(\d+[a-z*]?)(?:\/(\d+))?$/i);
  if (!m) return 'unknown';
  return detectVariant(m[1], m[2]);
}

/** Human-readable label for display. Returns undefined for 'standard'. */
export function variantLabel(variant: CardVariant): string | undefined {
  switch (variant) {
    case 'alt-art':    return 'Alt Art';
    case 'overnumber': return 'Overnumber';
    case 'signature':  return 'Signature';
    default:           return undefined;
  }
}
