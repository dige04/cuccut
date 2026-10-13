import { describe, expect, it } from 'vitest';
import type { MediaHandle } from '@cuccut/protocol';
import { resolvedPreviewMode, readPreviewText, documentPreview, formatJson, parseDelimited, pdfScale, TABLE_ROW_LIMIT } from './file-preview.ts';

describe('file preview', () => {
  it('chooses common formats; Office files are not passed off as plain text', () => {
    expect(['report.PDF', 'index.html', 'a.csv', 'a.tsv', 'a.json', 'a.md', 'a.docx'].map(documentPreview))
      .toEqual(['pdf', 'html', 'table', 'table', 'json', 'markdown', null]);
  });
  it('CSV supports BOM, CRLF, escaped double quotes, commas and multi-line cells; TSV keeps empty columns', () => {
    expect(parseDelimited('\uFEFFname,note\r\na,"one,two"\r\nb,"first\nsecond"\r\nc,"say ""hello"""\r\n', ',').rows)
      .toEqual([['name', 'note'], ['a', 'one,two'], ['b', 'first\nsecond'], ['c', 'say "hello"']]);
    expect(parseDelimited('a\tb\n1\t\n', '\t').rows).toEqual([['a', 'b'], ['1', '']]);
    expect(parseDelimited('""', ',').rows).toEqual([['']]);
  });
  it('corrupted and oversized tables explicitly fall back to source, without silently showing partial data', () => {
    for (const input of ['a,"unfinished', 'a,"closed"oops', 'a,b"c']) expect(parseDelimited(input, ',').error).toBe('quote');
    expect(parseDelimited('a\n'.repeat(TABLE_ROW_LIMIT + 1), ',').error).toBe('limit');
    expect(parseDelimited('a,'.repeat(202), ',').error).toBe('limit');
    expect(parseDelimited(Array(201).fill('a').join(','), ',').error).toBe('limit');
    expect(parseDelimited(Array(200).fill('a').join(','), ',').error).toBeNull();
  });
  it('JSON is formatted; when parsing fails, the raw data is kept; PDF fits width and scales proportionally', () => {
    expect(formatJson('{"a":1}')).toEqual({ text: '{\n  "a": 1\n}', valid: true });
    expect(formatJson('{\"id\":12345678901234567890,\"a\":[true,{},\"a:b\"]}').text).toContain('12345678901234567890');
    expect(formatJson('{bad')).toEqual({ text: '{bad', valid: false });
    expect(pdfScale(600, 648, 'fit')).toBe(1);
    expect(pdfScale(600, 348, 'fit')).toBe(0.5);
    expect(pdfScale(600, 648, '150')).toBe(1.5);
  });
});

describe('content facts decide the preview and bounded decoding', () => {
  const handle = (contentKind: MediaHandle['contentKind'], mimeType = 'application/octet-stream'): MediaHandle =>
    ({ url: '/media/test', fileName: 'test.abc', size: 10, mimeType, contentKind, expiresAt: '' });
  it('fallback for text, wrong extension, binary and older Runtime', () => {
    expect(resolvedPreviewMode('README', handle('text'), null)).toBe('text');
    expect(resolvedPreviewMode('notes.pdf', handle('text'), 'pdf')).toBe('text');
    expect(resolvedPreviewMode('notes.txt', handle('pdf'), 'text')).toBe('pdf');
    expect(resolvedPreviewMode('notes.txt', handle('binary'), 'text')).toBeNull();
    expect(resolvedPreviewMode('clip.abc', handle('video', 'video/mp4'), null)).toBe('video');
    expect(resolvedPreviewMode('clip.abc', handle('audio', 'audio/wav'), null)).toBe('audio');
    expect(resolvedPreviewMode('config.json', handle('text'), 'json')).toBe('json');
    expect(resolvedPreviewMode('clip.mp4', handle(undefined), 'video')).toBe('video');
  });
  it('binary content and file growth that appear after sampling is rejected does not show garbled text or load endlessly', async () => {
    expect(await readPreviewText(new Response(Uint8Array.of(65, 0, 66)))).toEqual({ error: 'binary' });
    expect(await readPreviewText(new Response(Uint8Array.of(0xff, 0xfe)))).toEqual({ error: 'binary' });
    expect(await readPreviewText(new Response('12345'), 'utf-8', 4)).toEqual({ error: 'limit' });
    const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('你好', 'utf16le')]);
    expect(await readPreviewText(new Response(le), 'utf-16le')).toEqual({ text: '你好' });
    expect(await readPreviewText(new Response(''))).toEqual({ text: '' });
  });
});
