'use strict';

/**
 * Core domain model: a single bookmark.
 *
 * A bookmark is deliberately small and plain-data so it serialises to JSON
 * without any transformation: the store layer persists exactly these fields.
 * All validation and normalisation lives here, so no caller can construct
 * an inconsistent bookmark (an untagged, un-normalised, or invalid URL).
 */

let nextId = 0;

/** Normalise a URL for storage and duplicate detection. */
function normalizeUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Only http(s) URLs are supported: ${raw}`);
  }
  // Trailing slash on a bare host adds nothing; drop it so
  // https://example.com and https://example.com/ compare equal.
  let href = url.href;
  if (url.pathname === '/' && !url.search && !url.hash) {
    href = href.slice(0, -1);
  }
  return href;
}

/** Normalise tags: lowercase, trimmed, de-duplicated, order preserved. */
function normalizeTags(tags) {
  if (tags === undefined || tags === null) return [];
  const list = Array.isArray(tags) ? tags : String(tags).split(',');
  const seen = new Set();
  const out = [];
  for (const tag of list) {
    const t = String(tag).trim().toLowerCase();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/**
 * Build a bookmark record. `id` is only honoured when rehydrating records
 * read back from disk; new bookmarks always get a fresh id.
 */
function createBookmark({ url, title, tags, collection, notes, createdAt, id }) {
  if (!url) throw new Error('url is required');
  const normalized = normalizeUrl(url);
  const parsed = new URL(normalized);
  return {
    id: id !== undefined ? id : `bm_${Date.now().toString(36)}_${(nextId++).toString(36)}`,
    url: normalized,
    title: (title || '').trim() || parsed.hostname,
    tags: normalizeTags(tags),
    collection: (collection || 'default').trim().toLowerCase() || 'default',
    notes: (notes || '').trim(),
    createdAt: createdAt || new Date().toISOString(),
  };
}

/** True when the bookmark's searchable text contains every query token. */
function matchesQuery(bookmark, query) {
  const tokens = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = [bookmark.title, bookmark.url, bookmark.notes, ...bookmark.tags]
    .join(' ')
    .toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

module.exports = { createBookmark, normalizeUrl, normalizeTags, matchesQuery };
