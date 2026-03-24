/** Escape a string for safe insertion into HTML. */
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Return url only if it is a safe http/https URL, otherwise empty string. */
export function safeUrl(url: string): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? url : '';
  } catch {
    return '';
  }
}

/**
 * Validate a CSS value (e.g. gradient, color) for use in style attributes.
 * Allows only characters that appear in valid CSS gradient/background expressions.
 * Returns empty string if the value contains anything outside the allowlist.
 */
export function safeCss(value: string): string {
  return /^[\w\s#,()\-.%/]+$/.test(value) ? value : '';
}
