'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createBookmark, matchesQuery, normalizeUrl } = require('./bookmark');

/**
 * Atomic JSON store for bookmarks.
 *
 * Writes go to a sibling temp file followed by rename, so a crash mid-write
 * can never leave a half-written bookmarks file behind — the worst case is
 * a stray `.tmp` file, never data loss. The in-memory list is the source of
 * truth within a process; every mutation saves immediately.
 */
class BookmarkStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.bookmarks = this._load();
  }

  _load() {
    if (!fs.existsSync(this.filePath)) return [];
    let data;
    try {
      data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch {
      throw new Error(`Bookmarks file is not valid JSON: ${this.filePath}`);
    }
    if (!Array.isArray(data)) {
      throw new Error(`Bookmarks file must contain a JSON array: ${this.filePath}`);
    }
    // Rehydrate through the domain model so old files get normalised too.
    return data.map((raw) => createBookmark(raw));
  }

  _save() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.bookmarks, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, this.filePath);
  }

  add(fields) {
    const bookmark = createBookmark(fields);
    this.bookmarks.push(bookmark);
    this._save();
    return bookmark;
  }

  all() {
    return [...this.bookmarks];
  }

  get(id) {
    return this.bookmarks.find((b) => b.id === id) || null;
  }

  remove(id) {
    const index = this.bookmarks.findIndex((b) => b.id === id);
    if (index === -1) return false;
    this.bookmarks.splice(index, 1);
    this._save();
    return true;
  }

  /** Case-insensitive tag/collection filter, newest first. */
  list({ tag, collection } = {}) {
    let out = this.bookmarks;
    if (tag) {
      const t = tag.toLowerCase();
      out = out.filter((b) => b.tags.includes(t));
    }
    if (collection) {
      const c = collection.toLowerCase();
      out = out.filter((b) => b.collection === c);
    }
    return [...out].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  search(query) {
    return this.bookmarks.filter((b) => matchesQuery(b, query));
  }

  /** Tag -> count, most used first. */
  tagCounts() {
    const counts = new Map();
    for (const b of this.bookmarks) {
      for (const tag of b.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  stats() {
    const domains = new Map();
    const collections = new Map();
    for (const b of this.bookmarks) {
      const domain = new URL(b.url).hostname;
      domains.set(domain, (domains.get(domain) || 0) + 1);
      collections.set(b.collection, (collections.get(b.collection) || 0) + 1);
    }
    const top = (map) =>
      [...map.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return {
      total: this.bookmarks.length,
      tags: this.tagCounts().length,
      collections: top(collections),
      domains: top(domains).slice(0, 10),
    };
  }

  /**
   * Groups of bookmarks sharing a normalised URL. A group only counts as a
   * duplicate when it holds 2+ bookmarks — singletons are not reported.
   */
  findDuplicates() {
    const groups = new Map();
    for (const b of this.bookmarks) {
      const key = normalizeUrl(b.url);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
    }
    return [...groups.values()].filter((group) => group.length > 1);
  }

  /**
   * Import records, skipping ones whose normalised URL already exists.
   * Returns { added, skipped } so callers can report both numbers.
   */
  importBookmarks(records) {
    const existing = new Set(this.bookmarks.map((b) => normalizeUrl(b.url)));
    let added = 0;
    let skipped = 0;
    for (const raw of records) {
      try {
        const bookmark = createBookmark(raw);
        if (existing.has(bookmark.url)) {
          skipped++;
          continue;
        }
        existing.add(bookmark.url);
        this.bookmarks.push(bookmark);
        added++;
      } catch {
        skipped++; // Unparseable rows are skipped, never fatal to the batch.
      }
    }
    if (added > 0) this._save();
    return { added, skipped };
  }
}

module.exports = { BookmarkStore };
