#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { BookmarkStore } = require('./store');
const { toHtml, parseImportFile } = require('./export');

const DEFAULT_FILE = path.join(process.cwd(), 'bookmarks.json');

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const eq = key.indexOf('=');
      if (eq !== -1) {
        flags[key.slice(0, eq)] = key.slice(eq + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        flags[key] = argv[++i];
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function printBookmark(b) {
  const tags = b.tags.length ? ` [${b.tags.join(', ')}]` : '';
  console.log(`${b.id}  ${b.title}${tags}`);
  console.log(`    ${b.url}  (${b.collection})`);
  if (b.notes) console.log(`    ${b.notes}`);
}

function usage() {
  console.log(`Usage: bookmarks <command> [args] [options]

Commands:
  add <url> [--title T] [--tags a,b] [--collection C] [--notes N]
  list [--tag T] [--collection C]
  search <query>
  remove <id>
  tags
  stats
  duplicates
  export [--format json|html] [--out PATH]
  import <file>

Options:
  --file PATH   bookmarks data file (default: ./bookmarks.json,
                or $BOOKMARKS_FILE when set)`);
}

function main(argv) {
  const [command, ...rest] = argv;
  const { positional, flags } = parseArgs(rest);
  const file = flags.file || process.env.BOOKMARKS_FILE || DEFAULT_FILE;
  const store = new BookmarkStore(file);

  switch (command) {
    case 'add': {
      const [url] = positional;
      if (!url) {
        console.error('add requires a URL');
        process.exitCode = 1;
        return;
      }
      const bookmark = store.add({
        url,
        title: flags.title,
        tags: flags.tags,
        collection: flags.collection,
        notes: flags.notes,
      });
      printBookmark(bookmark);
      break;
    }
    case 'list':
      for (const b of store.list({ tag: flags.tag, collection: flags.collection })) {
        printBookmark(b);
      }
      break;
    case 'search': {
      const query = positional.join(' ');
      for (const b of store.search(query)) printBookmark(b);
      break;
    }
    case 'remove': {
      if (!positional[0] || !store.remove(positional[0])) {
        console.error(`No bookmark with id: ${positional[0] || ''}`);
        process.exitCode = 1;
      }
      break;
    }
    case 'tags':
      for (const { tag, count } of store.tagCounts()) console.log(`${tag} (${count})`);
      break;
    case 'stats': {
      const s = store.stats();
      console.log(`Total: ${s.total}  Tags: ${s.tags}`);
      console.log('Collections:');
      for (const c of s.collections) console.log(`  ${c.name} (${c.count})`);
      console.log('Top domains:');
      for (const d of s.domains) console.log(`  ${d.name} (${d.count})`);
      break;
    }
    case 'duplicates': {
      const groups = store.findDuplicates();
      if (groups.length === 0) console.log('No duplicates found.');
      for (const group of groups) {
        console.log(`Duplicate URL: ${group[0].url}`);
        for (const b of group) console.log(`  ${b.id}  ${b.title}`);
      }
      break;
    }
    case 'export': {
      const format = flags.format || 'json';
      const out =
        format === 'html' ? toHtml(store.all()) : JSON.stringify(store.all(), null, 2) + '\n';
      if (flags.out) fs.writeFileSync(flags.out, out, 'utf8');
      else process.stdout.write(out);
      break;
    }
    case 'import': {
      if (!positional[0]) {
        console.error('import requires a file path');
        process.exitCode = 1;
        return;
      }
      const records = parseImportFile(fs.readFileSync(positional[0], 'utf8'));
      const { added, skipped } = store.importBookmarks(records);
      console.log(`Imported ${added} bookmark(s), skipped ${skipped}.`);
      break;
    }
    default:
      usage();
      if (command) process.exitCode = 1;
  }
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { main, parseArgs };
