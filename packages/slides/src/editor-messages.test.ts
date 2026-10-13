import { describe, expect, it } from 'vitest';
import { readEditorMessage, readHostMessage, SAVE_FILE_MAX_BYTES, saveFileName } from './editor-messages.ts';

describe('export file message (editor:save-file)', () => {
  it('parent window accepts ArrayBuffer and Blob; other content and empty file names rejected', () => {
    const data = new ArrayBuffer(4);
    expect(readEditorMessage({ type: 'editor:save-file', requestId: 'r1', filename: 'Landing.html', data })).toEqual({
      type: 'editor:save-file',
      requestId: 'r1',
      filename: 'Landing.html',
      data,
    });
    const blob = new Blob(['%PDF']);
    expect(readEditorMessage({ type: 'editor:save-file', requestId: 'r2', filename: 'Deck.pdf', data: blob })?.type).toBe('editor:save-file');
    expect(readEditorMessage({ type: 'editor:save-file', requestId: 'r3', filename: 'a.html', data: 'text' })).toBeNull();
    expect(readEditorMessage({ type: 'editor:save-file', requestId: 'r4', filename: 'a.html', data: new Uint8Array(4) })).toBeNull();
    expect(readEditorMessage({ type: 'editor:save-file', requestId: 'r5', filename: '  ', data })).toBeNull();
    expect(readEditorMessage({ type: 'editor:save-file', requestId: 'x'.repeat(101), filename: 'a.html', data })).toBeNull();
  });

  it('files over the limit rejected', () => {
    const big = { byteLength: SAVE_FILE_MAX_BYTES + 1 };
    Object.setPrototypeOf(big, ArrayBuffer.prototype);
    expect(readEditorMessage({ type: 'editor:save-file', requestId: 'r1', filename: 'a.zip', data: big })).toBeNull();
  });

  it('editor accepts only three result types', () => {
    for (const outcome of ['saved', 'declined', 'failed'] as const) {
      expect(readHostMessage({ type: 'editor:save-file-result', requestId: 'r1', outcome })).toEqual({ type: 'editor:save-file-result', requestId: 'r1', outcome });
    }
    expect(readHostMessage({ type: 'editor:save-file-result', requestId: 'r1', outcome: 'ok' })).toBeNull();
    expect(readHostMessage({ type: 'editor:save-file-result', requestId: 1, outcome: 'saved' })).toBeNull();
  });
});

describe('saveFileName', () => {
  it('removes path separators, keeps ordinary and control characters, extension must be within the allowed range', () => {
    expect(saveFileName('Landing page.html')).toBe('Landing page.html');
    expect(saveFileName('../../etc/passwd.html')).toBe('etc passwd.html');
    expect(saveFileName('a\\b:c*d?"e<f>g|h.PDF')).toBe('a b c d e f g h.PDF');
    expect(saveFileName('首页\u0007设计.png')).toBe('首页 设计.png');
    expect(saveFileName('  .hidden.zip  ')).toBe('hidden.zip');
    expect(saveFileName('design-html.zip')).toBe('design-html.zip');
  });

  it('returns null when there is no extension, the extension is unrecognized, or the name is too long', () => {
    expect(saveFileName('README')).toBeNull();
    expect(saveFileName('.html')).toBeNull();
    expect(saveFileName('run.exe')).toBeNull();
    expect(saveFileName('page.html.sh')).toBeNull();
    expect(saveFileName('x.constructor')).toBeNull();
    expect(saveFileName(`${'a'.repeat(260)}.html`)).toBeNull();
  });
});
