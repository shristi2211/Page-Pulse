/**
 * Extracts the <title> text from raw HTML content.
 */
export function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (!match || !match[1]) return null;
  return match[1].trim().replace(/\s+/g, ' ') || null;
}

/**
 * Normalizes a URL string — ensures it's absolute and well-formed.
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

/**
 * Returns true if the URL uses HTTPS protocol.
 */
export function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Safely parses content-length header to number of bytes.
 */
export function parseContentLength(header: string | undefined): number {
  if (!header) return 0;
  const parsed = parseInt(header, 10);
  return isNaN(parsed) ? 0 : parsed;
}

