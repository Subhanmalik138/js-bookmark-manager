# Bookmark Manager CLI

A zero-dependency command-line bookmark manager. Add URLs with tags and
collections, search them with full-text queries, find duplicates, see usage
stats, and move your data in and out as JSON or browser-style Netscape HTML.

Bookmarks live in a single JSON file (`./bookmarks.json` by default), so the
whole collection is plain text you can back up, grep, or version-control.

## Why this exists

Browser bookmark managers bury search and export behind sync accounts and
opaque databases. This tool keeps the same job — remember a link, find it
again later — in a format you fully own, with duplicate detection that
catches the same URL saved twice under different spellings.

## Design decisions

1. **Domain model first, storage second.** Validation and normalisation
   (URL canonicalisation, tag lower-casing and de-duplication) live in
   `src/bookmark.js`, not in the CLI. The store rehydrates old files through
   the same model, so saved data can never drift out of shape.
2. **Atomic writes.** Every save writes a temp file and renames it into
   place, so a crash mid-write leaves the previous good file intact — never
   a half-written JSON file.
3. **URL normalisation as the duplicate key.** `https://example.com` and
   `https://example.com/` are the same bookmark; duplicate detection and
   import de-duplication both key on the normalised URL.
4. **No dependencies.** Only Node's built-in modules and `node:test` are
   used, so `npm install` installs nothing and the tool runs anywhere Node
   18+ runs.

## Usage

```bash
# Add a bookmark
node src/cli.js add https://nodejs.org --title "Node.js" --tags js,runtime --collection work

# List, filtered by tag or collection
node src/cli.js list --tag js
node src/cli.js list --collection work

# Full-text search (all tokens must match, across title, URL, notes, tags)
node src/cli.js search "node streams"

# Tags, stats, and duplicates
node src/cli.js tags
node src/cli.js stats
node src/cli.js duplicates

# Remove by id (shown by list/search)
node src/cli.js remove bm_abc123

# Export / import (JSON by default; --format html for browser import)
node src/cli.js export --format html --out bookmarks.html
node src/cli.js import bookmarks.html
```

Use `--file PATH` (or the `BOOKMARKS_FILE` environment variable) to point
at a different data file, e.g. one per project.

## Running tests

```bash
npm test
```

17 tests cover URL/tag normalisation, store CRUD and persistence,
filtering, stats, duplicate detection, import de-duplication, corrupt-file
handling, HTML export round-trips, and a CLI end-to-end run.

## Tech stack

- Node.js 18+ (built-ins only: `fs`, `path`, `child_process` in tests)
- `node:test` + `node:assert` for tests — no test framework to install
