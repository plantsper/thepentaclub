/**
 * CardOcrService — Claude vision-based card code extraction.
 *
 * Sends the card image to claude-haiku as base64 and asks it to extract the
 * card code printed at the bottom of every Riftbound card (e.g. "SFD • 170/221").
 *
 * This replaces the previous Tesseract.js approach which was unreliable on
 * real-world photos with angle, holographic foil, and sleeve glare.
 *
 * ## Flow
 *   upload image → resize to ≤1024px (cost control) → base64
 *   → Claude: "extract the card code" → parse response
 *   → setCode + collectorNum → Riftcodex guaranteed lookup
 */

import Anthropic from '@anthropic-ai/sdk';

// ── Result types ──────────────────────────────────────────────────────────────

export interface OcrCardResult {
  setCode?:      string;  // e.g. "SFD"
  collectorNum?: string;  // e.g. "170"
  cardNumber?:   string;  // e.g. "170/221"
  rawResponse?:  string;  // full Claude response for debugging
}

// ── Image helpers ─────────────────────────────────────────────────────────────

/**
 * Resize the image to fit within maxDim × maxDim, then return as a base64
 * JPEG string (no data-URL prefix). Keeps aspect ratio.
 * Smaller images = fewer tokens = faster + cheaper.
 */
async function fileToBase64Jpeg(file: File, maxDim = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file);

  const scale  = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w      = Math.round(bitmap.width  * scale);
  const h      = Math.round(bitmap.height * scale);

  const canvas  = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // canvas.toDataURL returns "data:image/jpeg;base64,<data>" — strip prefix
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  return dataUrl.split(',')[1];
}

// ── Card code parsing ─────────────────────────────────────────────────────────

/**
 * Parse the card code from Claude's free-text response.
 * Handles: "SFD • 170/221", "SFD-170/221", "SFD 170/221", "SFD·170"
 */
function parseCardCode(text: string): OcrCardResult {
  const m = text.match(/([A-Z]{2,5})\s*[•·\-–\s]\s*(\d+)(?:[/](\d+))?/i);
  if (m) {
    return {
      setCode:      m[1].toUpperCase(),
      collectorNum: m[2],
      cardNumber:   m[3] ? `${m[2]}/${m[3]}` : m[2],
      rawResponse:  text,
    };
  }
  // bare NNN/TTT with no set code
  const bare = text.match(/(\d{1,3})[/](\d{1,3})/);
  if (bare) return { cardNumber: `${bare[1]}/${bare[2]}`, rawResponse: text };

  return { rawResponse: text };
}

// ── Primary export ────────────────────────────────────────────────────────────

/**
 * Extract the card code from a Riftbound card photo using Claude vision.
 * Returns setCode + collectorNum if found; rawResponse always set for debugging.
 */
export async function extractCardCode(file: File): Promise<OcrCardResult> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not set in .env.local');

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const base64 = await fileToBase64Jpeg(file, 1024);

  const response = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 64,
    messages: [
      {
        role: 'user',
        content: [
          {
            type:   'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
          },
          {
            type: 'text',
            text:
              'This is a Riftbound trading card. Find the card code printed at the bottom — ' +
              'it looks like "SFD • 170/221" (set code, bullet or dash, collector number / total). ' +
              'Reply with ONLY the card code, nothing else. If you cannot find it, reply "not found".',
          },
        ],
      },
    ],
  });

  const raw = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join(' ')
    .trim();

  if (!raw || raw.toLowerCase() === 'not found') return { rawResponse: raw };
  return parseCardCode(raw);
}
