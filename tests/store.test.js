'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { BookmarkStore } = require('../src/store');

function freshStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-test-'));
  return new BookmarkStore(path.join(dir, 'bookmarks.json'));
}

test('add persists and reloads bookmarks', () => {
  const store = freshStore();
  const added = store.add({ url: 'https://example.com/', title: 'Example', tags: ['demo'] });
  assert.equal(added.url, 'https://example.com');
  const reloaded = new BookmarkStore(store.filePath);
  assert.equal(reloaded.all().length, 1);
  assert.equal(reloaded.get(added.id).title, 'Example');
});

test('remove returns false for unknown ids and true once', () => {
  const store = freshStore();
  const b = store.add({ url: 'https://example.com' });
  assert.equal(store.remove('nope'), false);
  assert.equal(store.remove(b.id), true);
  assert.equal(store.all().length, 0);
});

test('list filters by tag and collection, newest first', () => {
  const store = freshStore();
  store.add({ url: 'https://a.com', tags: ['js'], collection: 'work', createdAt: '2024-01-01T00:00:00.000Z' });
  store.add({ url: 'https://b.com', tags: ['js', 'go'], collection: 'work', createdAt: '2025-01-01T00:00:00.000Z' });
  store.add({ url: 'https://c.com', tags: ['go'], collection: 'personal' });
  assert.equal(store.list({ tag: 'js' }).length, 2);
  assert.equal(store.list({ collection: 'personal' }).length, 1);
  assert.equal(store.list({ tag: 'js' })[0].url, 'https://b.com');
});

test('stats counts totals, tags, collections, and domains', () => {
  const store = freshStore();
  store.add({ url: 'https://example.com/1', tags: ['a'] });
  store.add({ url: 'https://example.com/2', tags: ['a', 'b'] });
  const s = store.stats();
  assert.equal(s.total, 2);
  assert.equal(s.tags, 2);
  assert.equal(s.domains[0].name, 'example.com');
  assert.equal(s.domains[0].count, 2);
});

test('findDuplicates groups only URLs with 2+ bookmarks', () => {
  const store = freshStore();
  store.add({ url: 'https://dup.com/' });
  store.add({ url: 'https://dup.com' }); // Same after normalisation.
  store.add({ url: 'https://unique.com' });
  const groups = store.findDuplicates();
  assert.equal(groups.length, 1);
  assert.equal(groups[0].length, 2);
});

test('import skips existing URLs and unparseable rows, reporting both counts', () => {
  const store = freshStore();
  store.add({ url: 'https://example.com' });
  const result = store.importBookmarks([
    { url: 'https://example.com/' }, // Duplicate after normalisation.
    { url: 'https://new.com', title: 'New' },
    { url: 'not a url' },
  ]);
  assert.deepEqual(result, { added: 1, skipped: 2 });
  assert.equal(store.all().length, 2);
});

test('corrupt bookmarks file fails loudly instead of silently emptying', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-test-'));
  const file = path.join(dir, 'bookmarks.json');
  fs.writeFileSync(file, '{not json', 'utf8');
  assert.throws(() => new BookmarkStore(file), /not valid JSON/);
});
