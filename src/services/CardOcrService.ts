/**
 * CardOcrService — Tesseract.js OCR for Riftbound card images.
 *
 * Strategy:
 *   1. Crop each zone from the image, then preprocess (grayscale + contrast)
 *      before passing to Tesseract. This handles holographic foil, photos taken
 *      at an angle, and colourful backgrounds that confuse raw OCR.
 *   2. Scan BOTH the name zone AND the type banner to get two name candidates.
 *      The banner ("CHAMPION UNIT • SORAKA • MOUNT TARGON") embeds the champion
 *      name as the second bullet segment, which is often cleaner than the name
 *      zone itself in real-world photos.
 *   3. Try both candidates in Riftcodex; use whichever returns a match.
 *   4. Fall back to full-card OCR when the API returns nothing.
 *
 *  ┌────────────────────────────────────────┐
 *  │ [E]  [Domain]                [Might]  │  ← energyCost TL, might TR
 *  │                                        │
 *  │              Card Art                  │
 *  │            (~62% of card)              │
 *  │                                        │
 *  ├── CHAMPION UNIT • SORAKA • MOUNT TARGON┤  ← typeBanner ~60-67%
 *  │   Soraka                               │  ← name ~64-73%
 *  │   WANDERER                             │    (subtitle line ignored)
 *  │   Ability text…                        │  ← description ~73-90%
 *  │   "Flavor text."                       │
 *  │ SFD • 239/221     Loiza Chen           │  ← cardNumber ~91-95%
 *  └────────────────────────────────────────┘
 *
 *  Zones are fractions of the image dimensions — they scale to any resolution
 *  and card orientation, but assume a portrait card (≈ 744 × 1040 px).
 */

import type { CardType } from '../types/Card.types';

// ── Zone definitions ─────────────────────────────────────────────────────────

interface Zone {
  top:    number;  // fraction of image height
  left:   number;  // fraction of image width
  width:  number;
  height: number;
}

/**
 * Fractional crop regions for each card field.
 *
 * Calibrated from two real Riftbound cards:
 *   Chem-Baroness (Legend) and Soraka – Wanderer (Champion Unit).
 *
 * Note: the name zone is deliberately wide (0.63-0.73) so it captures both
 * card types even when the nameplate sits slightly higher or lower.
 */
export const CARD_ZONES: Record<string, Zone> = {
  // Small italic strip: "CHAMPION UNIT • SORAKA • MOUNT TARGON"
  typeBanner:  { top: 0.60, left: 0.03, width: 0.92, height: 0.06 },
  // Large card name — starts just below the banner
  name:        { top: 0.63, left: 0.03, width: 0.78, height: 0.10 },
  description: { top: 0.73, left: 0.03, width: 0.94, height: 0.18 },
  // "SFD • 239/221   Artist • ©2025RGI"
  cardNumber:  { top: 0.91, left: 0.02, width: 0.45, height: 0.04 },
  // Stat zones — present on Champion / Unit cards only
  power:       { top: 0.87, left: 0.02, width: 0.14, height: 0.06 },
  health:      { top: 0.87, left: 0.84, width: 0.14, height: 0.06 },
  // Energy cost circle — top-left
  energyCost:  { top: 0.03, left: 0.02, width: 0.14, height: 0.12 },
};

/**
 * Riftbound type → our DB CardType mapping:
 *   Champion, Legend, Unit, Unit Token  → 'Champion'
 *   Spell, Rune                         → 'Spell'
 *   Gear, Battlefield                   → 'Artifact'
 */

// ── Result types ─────────────────────────────────────────────────────────────

export interface OcrNameResult {
  name:          string;
  cardNumber?:   string;   // e.g. "239/221"
  setCode?:      string;   // e.g. "SFD" from "SFD • 239/221"
  collectorNum?: string;   // e.g. "239"
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

// ── Preprocessing ─────────────────────────────────────────────────────────────

/**
 * Crop a zone from the source image and apply grayscale + contrast enhancement.
 * Returns an HTMLCanvasElement Tesseract can consume directly.
 *
 * Why:
 *   - Holographic foil cards produce rainbow interference that confuses OCR.
 *   - Grayscale eliminates colour noise.
 *   - 2× upscale + contrast boost gives Tesseract more signal to work with.
 *   - Cropping to the zone means Tesseract only sees the text we care about,
 *     avoiding confusion from adjacent card elements.
 */
async function cropAndPreprocess(file: File, zone: Zone): Promise<HTMLCanvasElement> {
  // Get image dimensions from a quick bitmap
  const bmp = await createImageBitmap(file);
  const W = bmp.width, H = bmp.height;
  bmp.close();

  const px = {
    left:   Math.round(zone.left   * W),
    top:    Math.round(zone.top    * H),
    width:  Math.round(zone.width  * W),
    height: Math.round(zone.height * H),
  };

  // Load full image into a temporary canvas so we can crop it
  const src = await createImageBitmap(file, px.left, px.top, px.width, px.height);

  const scale  = 2;
  const canvas = document.createElement('canvas');
  canvas.width  = src.width  * scale;
  canvas.height = src.height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  src.close();

  // Grayscale + contrast
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray       = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const contrasted = Math.min(255, Math.max(0, (gray - 128) * 2.2 + 128));
    d[i] = d[i + 1] = d[i + 2] = contrasted;
    d[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  return canvas;
}

// ── Banner name extraction ────────────────────────────────────────────────────

/**
 * Pull the champion / card name out of the type banner text.
 *
 * Banner formats:
 *   "CHAMPION UNIT • SORAKA • MOUNT TARGON"  → "SORAKA"   (segment 1)
 *   "LEGEND • RENATA GLASC"                  → "RENATA GLASC" (segment 1)
 *
 * The champion name is always the segment immediately after the first bullet.
 */
function nameFromBanner(bannerText: string): string {
  const segments = bannerText
    .split(/[•·|]/)
    .map(s => s.replace(/[^\w\s'\-]/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return segments[1] ?? '';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const m = raw.match(/\d+/);
  return m ? parseInt(m[0], 10) : undefined;
}

// ── Primary export: extract name candidates ───────────────────────────────────

/**
 * Fast path: OCR the name zone AND the type banner, returning up to two name
 * candidates plus the set code from the card number.
 *
 * The caller (AdminPageComponent) tries both candidates against Riftcodex and
 * uses whichever returns a match.
 *
 * Tesseract is lazy-imported so the WASM (~10 MB) only loads when a card is
 * actually being scanned.
 */
export async function extractCardName(file: File): Promise<OcrNameResult & { bannerName?: string }> {
  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('eng');

  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });

    // ── Name zone ──────────────────────────────────────────────────────────
    const nameCanvas  = await cropAndPreprocess(file, CARD_ZONES.name);
    const { data: nd } = await worker.recognize(nameCanvas);
    const rawName      = nd.text.trim();
    // Take only the first line (ignores subtitle like "WANDERER")
    const nameLine     = rawName.split('\n')[0] ?? rawName;
    const name         = nameLine.replace(/[^\w\s'\-,.:!?]/g, '').replace(/\s+/g, ' ').trim();

    // ── Type banner zone ───────────────────────────────────────────────────
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const bannerCanvas  = await cropAndPreprocess(file, CARD_ZONES.typeBanner);
    const { data: bd }  = await worker.recognize(bannerCanvas);
    const bannerName    = nameFromBanner(bd.text);

    // ── Card number zone ───────────────────────────────────────────────────
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    const numCanvas   = await cropAndPreprocess(file, CARD_ZONES.cardNumber);
    const { data: cnd } = await worker.recognize(numCanvas);
    const rawNumber   = cnd.text.trim();

    // Parse "SFD • 239/221" — bullet, dash, or en-dash as separator
    const cardNumMatch = rawNumber.match(/([A-Z]{2,5})\s*[•·\-–]\s*(\d+)[/](\d+)/i);
    let setCode:      string | undefined;
    let collectorNum: string | undefined;
    let cardNumber:   string | undefined;

    if (cardNumMatch) {
      setCode      = cardNumMatch[1].toUpperCase();
      collectorNum = cardNumMatch[2];
      cardNumber   = `${cardNumMatch[2]}/${cardNumMatch[3]}`;
    } else {
      const simpleMatch = rawNumber.match(/\d{1,3}[/]\d{1,3}/);
      cardNumber = simpleMatch?.[0];
    }

    return { name, bannerName: bannerName || undefined, cardNumber, setCode, collectorNum };
  } finally {
    await worker.terminate();
  }
}

// ── Fallback: scan all zones when Riftcodex has no match ─────────────────────

/**
 * Full-card OCR — used as fallback when the Riftcodex API returns no result.
 * All zones are preprocessed before OCR.
 */
export async function extractAllFields(file: File): Promise<OcrFullResult> {
  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('eng');
  const raw: Record<string, string> = {};

  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    for (const zone of ['energyCost', 'power', 'health', 'cardNumber', 'name'] as const) {
      const canvas    = await cropAndPreprocess(file, CARD_ZONES[zone]);
      const { data }  = await worker.recognize(canvas);
      raw[zone]       = data.text.split('\n')[0]?.trim() ?? '';
    }

    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    for (const zone of ['typeBanner', 'description'] as const) {
      const canvas    = await cropAndPreprocess(file, CARD_ZONES[zone]);
      const { data }  = await worker.recognize(canvas);
      raw[zone]       = data.text.trim();
    }
  } finally {
    await worker.terminate();
  }

  // Parse type from banner
  const bannerRaw = raw.typeBanner ?? '';
  const typeWord  = (bannerRaw.split(/[•·]/)[0] ?? bannerRaw).trim().toLowerCase();
  const type: CardType | undefined =
      ['champion', 'legend', 'unit'].some(t => typeWord.includes(t)) ? 'Champion'
    : ['spell', 'rune'].some(t => typeWord.includes(t))               ? 'Spell'
    : ['gear', 'battlefield'].some(t => typeWord.includes(t))         ? 'Artifact'
    : undefined;

  const cardNumMatch = (raw.cardNumber ?? '').match(/\d{1,3}[/]\d{1,3}/);

  return {
    name:        raw.name?.replace(/[^\w\s'\-,.:!?]/g, '').replace(/\s+/g, ' ').trim() || undefined,
    type,
    description: raw.description?.replace(/\s+/g, ' ').trim() || undefined,
    manaCost:    parseNumber(raw.energyCost),
    attack:      parseNumber(raw.power),
    defense:     parseNumber(raw.health),
    cardNumber:  cardNumMatch?.[0],
  };
}
