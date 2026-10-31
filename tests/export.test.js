'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { toHtml, fromHtml, parseImportFile } = require('../src/export');
const { parseArgs } = require('../src/cli');

test('HTML export round-trips through the HTML parser', () => {
  const bookmarks = [
    { url: 'https://example.com', title: 'Example', tags: ['demo', 'js'], createdAt: '2025-01-01T00:00:00.000Z' },
  ];
  const records = fromHtml(toHtml(bookmarks));
  assert.equal(records.length, 1);
  assert.equal(records[0].url, 'https://example.com');
  assert.deepEqual(records[0].tags, ['demo', 'js']);
});

test('HTML export escapes markup in titles', () => {
  const html = toHtml([{ url: 'https://example.com', title: '<b>Hi</b>', tags: [], createdAt: '2025-01-01T00:00:00.000Z' }]);
  assert.ok(html.includes('&lt;b&gt;Hi&lt;/b&gt;'));
  assert.ok(!html.includes('<b>Hi</b>'));
});

test('parseImportFile accepts a JSON array and rejects a non-array', () => {
  assert.equal(parseImportFile('[{"url": "https://a.com"}]').length, 1);
  assert.throws(() => parseImportFile('{"url": "https://a.com"}'), /array/);
});

test('parseArgs handles --key value, --key=value, and positionals', () => {
  const { positional, flags } = parseArgs(['https://a.com', '--title', 'Hi', '--tags=a,b']);
  assert.deepEqual(positional, ['https://a.com']);
  assert.equal(flags.title, 'Hi');
  assert.equal(flags.tags, 'a,b');
});

test('CLI end-to-end: add, list, and search over a temp data file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-cli-'));
  const file = path.join(dir, 'bookmarks.json');
  const cli = path.join(__dirname, '..', 'src', 'cli.js');
  const run = (args) => execFileSync('node', [cli, ...args, '--file', file], { encoding: 'utf8' });
  run(['add', 'https://nodejs.org', '--title', 'Node.js', '--tags', 'js,runtime']);
  const list = run(['list']);
  assert.ok(list.includes('Node.js'));
  assert.ok(list.includes('https://nodejs.org'));
  assert.ok(run(['search', 'node']).includes('Node.js'));
  assert.equal(run(['search', 'definitely-not-here']).trim(), '');
});
