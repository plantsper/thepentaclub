/**
 * Domain color map — Riftbound TCG domain/element classification.
 * Colors are hardcoded from game lore; never derived from user/DB data.
 * Extend as new domains are discovered from live Riftcodex API responses.
 */

const DOMAIN_COLORS: Record<string, string> = {
  fury:    '#f97316',  // orange  — aggression / fire
  chaos:   '#a855f7',  // purple  — void / chaos magic
  order:   '#3b82f6',  // blue    — law / structure
  nature:  '#22c55e',  // green   — wild / growth
  shadow:  '#8b5cf6',  // violet  — darkness / shadow
  valor:   '#eab308',  // yellow  — courage / honor
  arcane:  '#06b6d4',  // cyan    — magic / knowledge
  ruin:    '#ef4444',  // red     — destruction
};

const FALLBACK = '#566380';

/** Returns a CSS hex color for a given domain name. Falls back to muted gray for unknowns. */
export function domainColor(domain: string): string {
  return DOMAIN_COLORS[domain.toLowerCase()] ?? FALLBACK;
}
