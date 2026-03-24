/**
 * CardOcrService — Claude vision-based card code extraction.
 *
 * Sends the card image to the `ocr-card` Supabase Edge Function, which calls
 * Claude Haiku server-side. The Anthropic API key never touches the browser.
 *
 * ## Flow
 *   upload image → resize to ≤1024px (cost control) → base64
 *   → POST /functions/v1/ocr-card → parse response
 *   → setCode + collectorNum → Riftcodex guaranteed lookup
 */

import { getSupabaseClient } from './supabaseClient';

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
  const bare = text.match(/(\d{1,3})[/](\d{1,3})/);
  if (bare) return { cardNumber: `${bare[1]}/${bare[2]}`, rawResponse: text };

  return { rawResponse: text };
}

// ── Primary export ────────────────────────────────────────────────────────────

/**
 * Extract the card code from a Riftbound card photo using Claude vision.
 * Delegates to the `ocr-card` Edge Function — Anthropic key stays server-side.
 */
export async function extractCardCode(file: File): Promise<OcrCardResult> {
  const base64 = await fileToBase64Jpeg(file, 1024);

  const { data, error } = await getSupabaseClient().functions.invoke('ocr-card', {
    body: { image: base64 },
  });

  if (error) throw new Error(`OCR request failed: ${error.message}`);

  const raw: string = (data as { raw?: string }).raw ?? '';

  if (!raw || raw.toLowerCase() === 'not found') return { rawResponse: raw };
  return parseCardCode(raw);
}
