/**
 * CardOcrService — Tesseract.js OCR for Riftbound card images.
 *
 * Strategy:
 *   1. Extract the card NAME from the title zone (fast, single-line OCR).
 *   2. Caller passes the name to RiftcodexService for a fuzzy API lookup.
 *   3. If the API returns nothing, fall back to `extractAllFields()` which
 *      scans every zone independently for a best-effort local parse.
 *
 * Zone coordinates are percentages of the image's natural dimensions so they
 * scale to any card resolution. Adjust CARD_ZONES if your card template
 * differs from the standard Riftbound portrait layout (≈ 744 × 1040 px).
 *
 *  ┌────────────────────────────────────┐
 *  │ [Domain] [Domain]                  │  ← domain icons top-left (not numeric)
 *  │                                    │
 *  │           Card Art                 │
 *  │          (~65% of card)            │
 *  │                                    │
 *  ├── LEGEND • RENATA GLASC ───────────┤  ← typeBanner ~62-69% (gold strip)
 *  │   Chem-Baroness                    │  ← name ~70-78% (blue nameplate)
 *  │   Ability text line 1...           │  ← description ~78-92%
 *  │   Ability text line 2...           │
 *  │ SFD • 249/221    Envar Studio      │  ← cardNumber ~93-97% (bottom bar)
 *  └────────────────────────────────────┘
 *
 *  Legend / Ally cards: typeBanner, name, description, cardNumber.
 *  Unit-type cards may also have power / health stat zones (bottom corners).
 *  Energy cost may appear as a numeric icon if the card has a play cost.
 */

import type { CardType } from '../types/Card.types';

// ── Zone definitions ─────────────────────────────────────────────────────────

interface Zone {
  top:    number; // fraction of image height
  left:   number; // fraction of image width
  width:  number;
  height: number;
}

/**
 * Fractional crop regions for each card field.
 *
 * Calibrated against the real Riftbound card layout (portrait, ~744 × 1040 px):
 *   - Art fills the top ~65% of the card.
 *   - typeBanner is the gold strip just above the name ("LEGEND • RENATA GLASC").
 *   - name is the blue nameplate below the type banner.
 *   - description is the white ability-text box below the name.
 *   - cardNumber lives in the bottom bar ("SFD • 249/221").
 *   - power / health are only present on unit-type cards (bottom corners).
 *   - energyCost may appear as a numeric play-cost icon; absent on some types.
 *
 * Adjust these if your card template uses a different aspect ratio.
 */
export const CARD_ZONES: Record<string, Zone> = {
  typeBanner:  { top: 0.62, left: 0.04, width: 0.90, height: 0.07 },
  name:        { top: 0.70, left: 0.04, width: 0.80, height: 0.08 },
  description: { top: 0.78, left: 0.04, width: 0.92, height: 0.14 },
  cardNumber:  { top: 0.93, left: 0.02, width: 0.45, height: 0.04 },
  // Stat zones — only populated on Champion / Unit / Legend cards
  power:       { top: 0.88, left: 0.02, width: 0.15, height: 0.07 },
  health:      { top: 0.88, left: 0.83, width: 0.15, height: 0.07 },
  // Energy cost icon — present on cards with a numeric play cost
  // Spell, Rune, Gear, Battlefield may omit this or use 0
  energyCost:  { top: 0.03, left: 0.02, width: 0.14, height: 0.12 },
};

/**
 * Riftbound type → our DB CardType mapping reference:
 *   Champion, Legend, Unit, Unit Token  → 'Champion'
 *   Spell, Rune                         → 'Spell'
 *   Gear, Battlefield                   → 'Artifact'
 */

// ── Result types ─────────────────────────────────────────────────────────────

export interface OcrNameResult {
  name:          string;
  cardNumber?:   string;   // e.g. "246/221"
  setCode?:      string;   // e.g. "SFD" from "SFD - 246/221"
  collectorNum?: string;   // e.g. "246"
}

export interface OcrFullResult {
  name?:        string;
  type?:        CardType;
  description?: string;
  manaCost?:    number;
  attack?:      number;
  defense?:     number;
  cardNumber?:  string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function imageDimensions(file: File): Promise<{ w: number; h: number }> {
  const bmp = await createImageBitmap(file);
  const dims = { w: bmp.width, h: bmp.height };
  bmp.close();
  return dims;
}

function toPixelRect(zone: Zone, w: number, h: number) {
  return {
    top:    Math.round(zone.top    * h),
    left:   Math.round(zone.left   * w),
    width:  Math.round(zone.width  * w),
    height: Math.round(zone.height * h),
  };
}

function parseNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const m = raw.match(/\d+/);
  return m ? parseInt(m[0], 10) : undefined;
}

// ── Primary export: extract name only (fast path) ────────────────────────────

/**
 * Run OCR on just the name zone (and card-number zone).
 * This is the fast path: caller then hands the name off to RiftcodexService.
 *
 * Tesseract is lazy-imported so the WASM bundle (~10 MB) only loads when
 * the user actually selects an image for scanning.
 */
export async function extractCardName(file: File): Promise<OcrNameResult> {
  const { w, h } = await imageDimensions(file);

  // Lazy-load Tesseract to keep initial bundle small
  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('eng');

  try {
    // Name zone — treat as a single text line for best accuracy
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    const nameRect = toPixelRect(CARD_ZONES.name, w, h);
    const { data: nameData } = await worker.recognize(file, { rectangle: nameRect });

    // Card number zone — also single line
    const numRect = toPixelRect(CARD_ZONES.cardNumber, w, h);
    const { data: numData } = await worker.recognize(file, { rectangle: numRect });

    const rawName   = nameData.text.trim();
    const rawNumber = numData.text.trim();

    // Strip OCR noise from name (keep letters, digits, common punctuation)
    const name = rawName.replace(/[^\w\s'\-,.:!?]/g, '').replace(/\s+/g, ' ').trim();

    // Card code format: "SFD • 249/221" or "SFD - 249/221" or "SFD•249/221"
    // Bullet (•), en-dash (–), dash (-) are all valid separators between set code and number.
    const cardNumMatch = rawNumber.match(/([A-Z]{2,5})\s*[•·\-–]\s*(\d+)[/](\d+)/i);

    let setCode:      string | undefined;
    let collectorNum: string | undefined;
    let cardNumber:   string | undefined;

    if (cardNumMatch) {
      setCode      = cardNumMatch[1].toUpperCase();
      collectorNum = cardNumMatch[2];
      cardNumber   = `${cardNumMatch[2]}/${cardNumMatch[3]}`;
    } else {
      // Fallback: bare "NNN/TTT" without set prefix
      const simpleMatch = rawNumber.match(/\d{1,3}[/]\d{1,3}/);
      cardNumber = simpleMatch?.[0];
    }

    return { name, cardNumber, setCode, collectorNum };
  } finally {
    await worker.terminate();
  }
}

// ── Fallback: scan all zones when Riftcodex has no match ─────────────────────

/**
 * Full-card OCR — used as fallback when the Riftcodex API returns no result.
 * Each zone is scanned with an appropriate PSM for best-effort field extraction.
 */
export async function extractAllFields(file: File): Promise<OcrFullResult> {
  const { w, h } = await imageDimensions(file);

  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('eng');

  const raw: Record<string, string> = {};

  try {
    // Numeric zones: single-line mode
    const numericZones = ['energyCost', 'power', 'health', 'cardNumber', 'name'];
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    for (const zone of numericZones) {
      const rect = toPixelRect(CARD_ZONES[zone], w, h);
      const { data } = await worker.recognize(file, { rectangle: rect });
      raw[zone] = data.text.trim();
    }

    // Block text zones: paragraph mode
    const blockZones = ['typeBanner', 'description'];
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    for (const zone of blockZones) {
      const rect = toPixelRect(CARD_ZONES[zone], w, h);
      const { data } = await worker.recognize(file, { rectangle: rect });
      raw[zone] = data.text.trim();
    }
  } finally {
    await worker.terminate();
  }

  // ── Parse results ──────────────────────────────────────────────────────────

  const name = raw.name
    ?.replace(/[^\w\s'\-,.:!?]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || undefined;

  // typeBanner format: "LEGEND • RENATA GLASC" — type is the word(s) before the bullet.
  // Map Riftbound card types → our DB CardType (Champion | Spell | Artifact).
  //   Champion-like: Champion, Legend, Unit, Unit Token
  //   Spell-like:    Spell, Rune
  //   Artifact-like: Gear, Battlefield
  const bannerRaw = raw.typeBanner ?? '';
  const typeWord  = (bannerRaw.split(/[•·]/)[0] ?? bannerRaw).trim().toLowerCase();
  const type: CardType | undefined =
      ['champion', 'legend', 'unit'].some(t => typeWord.includes(t)) ? 'Champion'
    : ['spell', 'rune'].some(t => typeWord.includes(t))               ? 'Spell'
    : ['gear', 'battlefield'].some(t => typeWord.includes(t))         ? 'Artifact'
    : undefined;

  const description = raw.description?.replace(/\s+/g, ' ').trim() || undefined;

  const cardNumMatch = (raw.cardNumber ?? '').match(/\d{1,3}[/\-]\d{1,3}/);

  return {
    name,
    type,
    description,
    manaCost:   parseNumber(raw.energyCost),
    attack:     parseNumber(raw.power),
    defense:    parseNumber(raw.health),
    cardNumber: cardNumMatch?.[0],
  };
}
