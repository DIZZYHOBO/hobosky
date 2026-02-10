/* ──────────────────────────────────────────────────────────
   HoboSky v0.1.0 — Utility Helpers
   ────────────────────────────────────────────────────────── */

/**
 * Format a timestamp to a relative time string
 */
export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 5) return 'now';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  // Show actual date for older posts
  const month = date.toLocaleString('default', { month: 'short' });
  const day = date.getDate();
  const year = date.getFullYear();
  const currentYear = now.getFullYear();
  return year === currentYear ? `${month} ${day}` : `${month} ${day}, ${year}`;
}

/**
 * Format a number compactly (1.2K, 3.4M, etc.)
 */
export function formatCount(n: number | undefined): string {
  if (n === undefined || n === null) return '0';
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return k >= 100 ? `${Math.floor(k)}K` : `${k.toFixed(1).replace(/\.0$/, '')}K`;
  }
  const m = n / 1_000_000;
  return `${m.toFixed(1).replace(/\.0$/, '')}M`;
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Convert AT Protocol URI to route-friendly params
 * at://did:plc:xxx/app.bsky.feed.post/rkey -> { did, collection, rkey }
 */
export function parseAtUri(uri: string): {
  did: string;
  collection: string;
  rkey: string;
} {
  const parts = uri.replace('at://', '').split('/');
  return {
    did: parts[0],
    collection: parts[1],
    rkey: parts[2],
  };
}

/**
 * Render post text with facets into HTML spans
 */
export function renderTextWithFacets(
  text: string,
  facets?: Array<{
    index: { byteStart: number; byteEnd: number };
    features: Array<{ $type: string; uri?: string; did?: string; tag?: string }>;
  }>
): string {
  if (!facets || facets.length === 0) {
    return escapeHtml(text);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(text);

  // Sort facets by byteStart
  const sorted = [...facets].sort(
    (a, b) => a.index.byteStart - b.index.byteStart
  );

  let result = '';
  let lastIndex = 0;

  for (const facet of sorted) {
    const { byteStart, byteEnd } = facet.index;
    if (byteStart < lastIndex) continue;

    // Plain text before this facet
    const before = decoder.decode(bytes.slice(lastIndex, byteStart));
    result += escapeHtml(before);

    // Faceted text
    const facetText = decoder.decode(bytes.slice(byteStart, byteEnd));
    const feature = facet.features[0];

    if (!feature) {
      result += escapeHtml(facetText);
    } else if (feature.$type === 'app.bsky.richtext.facet#link' && feature.uri) {
      result += `<a href="${escapeHtml(feature.uri)}" target="_blank" rel="noopener noreferrer">${escapeHtml(facetText)}</a>`;
    } else if (feature.$type === 'app.bsky.richtext.facet#mention' && feature.did) {
      result += `<a href="/profile/${escapeHtml(feature.did)}" data-mention="${escapeHtml(feature.did)}">${escapeHtml(facetText)}</a>`;
    } else if (feature.$type === 'app.bsky.richtext.facet#tag' && feature.tag) {
      result += `<a href="/search?q=%23${encodeURIComponent(feature.tag)}" data-tag="${escapeHtml(feature.tag)}">${escapeHtml(facetText)}</a>`;
    } else {
      result += escapeHtml(facetText);
    }

    lastIndex = byteEnd;
  }

  // Remaining text
  const remaining = decoder.decode(bytes.slice(lastIndex));
  result += escapeHtml(remaining);

  return result;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Default avatar placeholder SVG data URI
 */
export const DEFAULT_AVATAR =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="%231e293b"/><circle cx="32" cy="24" r="12" fill="%2364748b"/><ellipse cx="32" cy="56" rx="20" ry="16" fill="%2364748b"/></svg>'
  );
