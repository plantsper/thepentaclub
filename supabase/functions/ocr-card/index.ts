/**
 * ocr-card — Supabase Edge Function
 *
 * Receives a base64 JPEG of a Riftbound card, sends it to Claude Haiku vision,
 * and returns the raw card code text.
 *
 * The Anthropic API key is stored as a Supabase secret (never in VITE_ env vars).
 * Deploy: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Parse body
  let image: string;
  try {
    const body = await req.json();
    if (typeof body.image !== 'string' || body.image.length === 0) {
      return json({ error: 'Missing or invalid "image" field (expected base64 string)' }, 400);
    }
    image = body.image;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  // Reject absurdly large payloads (>4 MB base64 ≈ ~3 MB image)
  if (image.length > 4_000_000) {
    return json({ error: 'Image too large' }, 413);
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY secret is not set');
    return json({ error: 'Server configuration error' }, 500);
  }

  // Call Anthropic
  let anthropicRes: Response;
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 64,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: image },
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
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Anthropic fetch failed:', msg);
    return json({ error: 'Upstream API request failed' }, 502);
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => '');
    console.error('Anthropic API error', anthropicRes.status, errText);
    return json({ error: `Anthropic API returned ${anthropicRes.status}` }, 502);
  }

  const data = await anthropicRes.json();
  const raw: string = (data.content as Array<{ type: string; text: string }>)
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join(' ')
    .trim();

  return json({ raw });
});
