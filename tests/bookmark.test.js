'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createBookmark, normalizeUrl, normalizeTags, matchesQuery } = require('../src/bookmark');

test('normalizeUrl strips a bare-host trailing slash', () => {
  assert.equal(normalizeUrl('https://example.com/'), 'https://example.com');
  assert.equal(normalizeUrl('https://example.com/path/'), 'https://example.com/path/');
});

test('normalizeUrl rejects non-http(s) and malformed URLs', () => {
  assert.throws(() => normalizeUrl('ftp://example.com'), /Only http/);
  assert.throws(() => normalizeUrl('not a url'), /Invalid URL/);
});

test('normalizeTags lowercases, trims, and de-duplicates', () => {
  assert.deepEqual(normalizeTags('JS, js , Node'), ['js', 'node']);
  assert.deepEqual(normalizeTags(['a', 'a', ' b ']), ['a', 'b']);
  assert.deepEqual(normalizeTags(undefined), []);
});

test('createBookmark falls back to hostname when no title is given', () => {
  const b = createBookmark({ url: 'https://news.example.com/article' });
  assert.equal(b.title, 'news.example.com');
  assert.equal(b.collection, 'default');
});

test('matchesQuery requires every token, across title, url, notes, and tags', () => {
  const b = createBookmark({ url: 'https://example.com', title: 'Node Guide', tags: ['js'], notes: 'streams' });
  assert.equal(matchesQuery(b, 'node streams'), true);
  assert.equal(matchesQuery(b, 'node missing'), false);
  assert.equal(matchesQuery(b, ''), true);
});
