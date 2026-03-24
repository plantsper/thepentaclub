/**
 * CardOcrService — orientation-aware OCR for Riftbound card images.
 *
 * ## Card orientations
 *
 * Riftbound has two physical card layouts:
 *
 *   PORTRAIT (h > w) — Champion, Legend, Unit, Spell, Rune, Battlefield
 *   ┌──────────────────────────────────────┐
 *   │ [E]   [Domain]              [Might]  │  ← stats in corners
 *   │              Card Art                │
 *   │           (~62% of card)             │
 *   ├── CHAMPION UNIT • SORAKA • TARGON ───┤  ← typeBanner ~60-67%
 *   │   Soraka / WANDERER                  │  ← name ~64-73%
 *   │   Ability text…                      │  ← description ~73-90%
 *   │ SFD • 239/221       Loiza Chen       │  ← cardNumber ~91-95%
 *   └──────────────────────────────────────┘
 *
 *   LANDSCAPE (w > h) — Gear, Equipment
 *   ┌──────────────────────────────────────────────────┐
 *   │              │ GEAR  EQUIP  │ [+1 Might]         │
 *   │   Card Art   │ Guardian     │ Ability text…      │
 *   │              │ Angel        │                    │
 *   │  [2 Energy]  │ (vertical)   │   SFD • 051/221    │
 *   └──────────────────────────────────────────────────┘
 *
 * ## Landscape handling
 * Landscape cards are rotated 90° CW before scanning so that the text panel
 * moves to the bottom of the image and the same portrait zones apply.
 *
 * ## Architecture
 * This service returns OCR candidates only — it does NOT fill form fields.
 * The caller (AdminPageComponent) puts the result in the search box;
 * the user confirms (or corrects), then Riftcodex fills the form via API.
 * This makes OCR a typing shortcut, not a reliability-critical path.
 */

import type { CardType } from '../types/Card.types';

// ── Zone definitions ─────────────────────────────────────────────────────────

interface Zone {
  top: number;    // fraction of image height (after any rotation)
  left: number;
  width: number;
  height: number;
}

/**
 * Portrait zones — applied after rotating landscape cards 90° CW.
 * All fractions are relative to the (possibly rotated) image dimensions.
 */
export const CARD_ZONES: Record<string, Zone> = {
  typeBanner:  { top: 0.60, left: 0.03, width: 0.92, height: 0.06 },
  name:        { top: 0.63, left: 0.03, width: 0.78, height: 0.10 },
  description: { top: 0.73, left: 0.03, width: 0.94, height: 0.18 },
  cardNumber:  { top: 0.91, left: 0.02, width: 0.55, height: 0.05 },
  power:       { top: 0.87, left: 0.02, width: 0.14, height: 0.06 },
  health:      { top: 0.87, left: 0.84, width: 0.14, height: 0.06 },
  energyCost:  { top: 0.03, left: 0.02, width: 0.14, height: 0.12 },
};

// ── Result types ─────────────────────────────────────────────────────────────

export interface OcrNameResult {
  /** Best name candidate from the name zone (first line only). */
  name:          string;
  /** Champion name extracted from the type banner, e.g. "SORAKA" from banner. */
  bannerName?:   string;
  cardNumber?:   string;   // e.g. "239/221"
  setCode?:      string;   // e.g. "SFD"
  collectorNum?: string;   // e.g. "239"
  wasRotated:    boolean;  // true if a landscape card was rotated before scanning
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

// ── Orientation + rotation ────────────────────────────────────────────────────

async function getImageDimensions(file: File): Promise<{ w: number; h: number }> {
  const bmp = await createImageBitmap(file);
  const dims = { w: bmp.width, h: bmp.height };
  bmp.close();
  return dims;
}

/**
 * Load the image into a canvas, rotating landscape cards 90° CW so that
 * portrait zones can be applied uniformly regardless of card type.
 *
 * Landscape (w > h): text panel is on the right side of the card.
 * After 90° CW: text panel moves to the bottom — portrait zones now apply.
 */
async function loadNormalisedCanvas(file: File): Promise<{ canvas: HTMLCanvasElement; wasRotated: boolean }> {
  const { w, h } = await getImageDimensions(file);
  const isLandscape = w > h;

  const src = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  if (!isLandscape) {
    canvas.width  = w;
    canvas.height = h;
    ctx.drawImage(src, 0, 0);
  } else {
    // Rotate 90° CW: text panel is on the right of landscape cards → moves to bottom after CW rotation
    // New dimensions: width = origH, height = origW
    canvas.width  = h;
    canvas.height = w;
    ctx.translate(h, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(src, 0, 0);
  }

  src.close();
  return { canvas, wasRotated: isLandscape };
}

// ── Per-zone preprocessing ────────────────────────────────────────────────────

/**
 * Crop a zone from the normalised canvas and apply:
 *   - 2× upscale  (more pixels for Tesseract to work with)
 *   - Grayscale   (removes holographic foil colour interference)
 *   - Contrast boost (makes text stand out on varied card backgrounds)
 *
 * Returns an HTMLCanvasElement that Tesseract accepts directly.
 */
function cropAndPreprocess(source: HTMLCanvasElement, zone: Zone): HTMLCanvasElement {
  const W = source.width, H = source.height;
  const px = {
    left:   Math.round(zone.left   * W),
    top:    Math.round(zone.top    * H),
    width:  Math.round(zone.width  * W),
    height: Math.round(zone.height * H),
  };

  const scale  = 2;
  const canvas = document.createElement('canvas');
  canvas.width  = px.width  * scale;
  canvas.height = px.height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, px.left, px.top, px.width, px.height, 0, 0, canvas.width, canvas.height);

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
 * Parse the champion name from the type banner text.
 *
 *   "CHAMPION UNIT • SORAKA • MOUNT TARGON" → "SORAKA"  (segment[1])
 *   "LEGEND • RENATA GLASC"                 → "RENATA GLASC"
 *   "GEAR EQUIPMENT"                        → ""  (no bullet — Gear cards have no champion name)
 */
function nameFromBanner(raw: string): string {
  const segments = raw
    .split(/[•·|]/)
    .map(s => s.replace(/[^\w\s'\-]/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return segments[1] ?? '';
}

// ── Card number parsing ───────────────────────────────────────────────────────

function parseCardNumber(raw: string): { setCode?: string; collectorNum?: string; cardNumber?: string } {
  // "SFD • 051/221"  "SFD-051/221"  "SFD–051/221"  "SFD•051/221"
  const m = raw.match(/([A-Z]{2,5})\s*[•·\-–]\s*(\d+)[/](\d+)/i);
  if (m) {
    return {
      setCode:      m[1].toUpperCase(),
      collectorNum: m[2],
      cardNumber:   `${m[2]}/${m[3]}`,
    };
  }
  // Fallback: bare "NNN/TTT"
  const simple = raw.match(/\d{1,3}[/]\d{1,3}/);
  return { cardNumber: simple?.[0] };
}

// ── Number parser ─────────────────────────────────────────────────────────────

function parseNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const m = raw.match(/\d+/);
  return m ? parseInt(m[0], 10) : undefined;
}

// ── Primary export ────────────────────────────────────────────────────────────

/**
 * Extract name candidates and set code from a card image.
 *
 * Returns:
 *   - `name`       — first line from the name zone (may be garbled for photos)
 *   - `bannerName` — champion name from the type banner (often more reliable)
 *   - `setCode`    — e.g. "SFD" from "SFD • 051/221"
 *   - `wasRotated` — true if the card was landscape and was rotated
 *
 * The caller tries both `name` and `bannerName` against the Riftcodex API
 * and uses the first match.
 *
 * Tesseract is lazy-imported so the WASM (~10 MB) only loads on first scan.
 */
export async function extractCardName(file: File): Promise<OcrNameResult> {
  const { canvas, wasRotated } = await loadNormalisedCanvas(file);
  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('eng');

  try {
    // ── Name zone (first line only) ───────────────────────────────────────
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    const nameCanvas = cropAndPreprocess(canvas, CARD_ZONES.name);
    const { data: nd } = await worker.recognize(nameCanvas);
    const rawNameLine = nd.text.split('\n')[0]?.trim() ?? '';
    const name = rawNameLine.replace(/[^\w\s'\-,.:!?]/g, '').replace(/\s+/g, ' ').trim();

    // ── Type banner (extract champion name from second bullet segment) ────
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const bannerCanvas = cropAndPreprocess(canvas, CARD_ZONES.typeBanner);
    const { data: bd } = await worker.recognize(bannerCanvas);
    const bannerName = nameFromBanner(bd.text) || undefined;

    // ── Card number (set code + collector number) ─────────────────────────
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    const numCanvas = cropAndPreprocess(canvas, CARD_ZONES.cardNumber);
    const { data: cnd } = await worker.recognize(numCanvas);
    const { setCode, collectorNum, cardNumber } = parseCardNumber(cnd.text.trim());

    return { name, bannerName, cardNumber, setCode, collectorNum, wasRotated };
  } finally {
    await worker.terminate();
  }
}

// ── Fallback: full field scan ─────────────────────────────────────────────────

/**
 * Full-card OCR fallback — used when the Riftcodex API returns nothing.
 * Scans all zones with preprocessing.
 */
export async function extractAllFields(file: File): Promise<OcrFullResult> {
  const { canvas } = await loadNormalisedCanvas(file);
  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('eng');
  const raw: Record<string, string> = {};

  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    for (const zone of ['energyCost', 'power', 'health', 'cardNumber', 'name'] as const) {
      const { data } = await worker.recognize(cropAndPreprocess(canvas, CARD_ZONES[zone]));
      raw[zone] = data.text.split('\n')[0]?.trim() ?? '';
    }
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    for (const zone of ['typeBanner', 'description'] as const) {
      const { data } = await worker.recognize(cropAndPreprocess(canvas, CARD_ZONES[zone]));
      raw[zone] = data.text.trim();
    }
  } finally {
    await worker.terminate();
  }

  const bannerRaw = raw.typeBanner ?? '';
  const typeWord  = (bannerRaw.split(/[•·]/)[0] ?? bannerRaw).trim().toLowerCase();
  const type: CardType | undefined =
      ['champion', 'legend', 'unit'].some(t => typeWord.includes(t)) ? 'Champion'
    : ['spell', 'rune'].some(t => typeWord.includes(t))               ? 'Spell'
    : ['gear', 'battlefield', 'equipment'].some(t => typeWord.includes(t)) ? 'Artifact'
    : undefined;

  return {
    name:        raw.name?.replace(/[^\w\s'\-,.:!?]/g, '').replace(/\s+/g, ' ').trim() || undefined,
    type,
    description: raw.description?.replace(/\s+/g, ' ').trim() || undefined,
    manaCost:    parseNumber(raw.energyCost),
    attack:      parseNumber(raw.power),
    defense:     parseNumber(raw.health),
    cardNumber:  parseCardNumber(raw.cardNumber ?? '').cardNumber,
  };
}
