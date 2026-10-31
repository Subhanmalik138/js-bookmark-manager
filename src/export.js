'use strict';

/** Escape text for safe inclusion in HTML output. */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Serialise bookmarks as Netscape bookmark HTML (browser import format). */
function toHtml(bookmarks) {
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const b of bookmarks) {
    const tags = b.tags.length ? ` TAGS="${escapeHtml(b.tags.join(','))}"` : '';
    const date = Math.floor(new Date(b.createdAt).getTime() / 1000);
    lines.push(
      `    <DT><A HREF="${escapeHtml(b.url)}" ADD_DATE="${date}"${tags}>${escapeHtml(b.title)}</A>`,
    );
  }
  lines.push('</DL><p>');
  return lines.join('\n') + '\n';
}

/**
 * Parse Netscape bookmark HTML. Only <A HREF="..."> entries are read;
 * TAGS attributes are honoured when present. Malformed lines are skipped.
 */
function fromHtml(html) {
  const records = [];
  const anchor = /<A\s+[^>]*HREF="([^"]+)"[^>]*>([^<]*)<\/A>/gi;
  let match;
  while ((match = anchor.exec(html)) !== null) {
    const [, url, title] = match;
    const tagsMatch = /TAGS="([^"]*)"/i.exec(match[0]);
    records.push({
      url,
      title: title.trim(),
      tags: tagsMatch ? tagsMatch[1].split(',') : [],
    });
  }
  return records;
}

/** Parse an import file: JSON array, or Netscape HTML when it looks like it. */
function parseImportFile(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('<!DOCTYPE NETSCAPE') || /<A\s+[^>]*HREF=/i.test(trimmed)) {
    return fromHtml(text);
  }
  const data = JSON.parse(trimmed);
  if (!Array.isArray(data)) throw new Error('JSON import must be an array of bookmarks');
  return data;
}

module.exports = { toHtml, fromHtml, parseImportFile };
