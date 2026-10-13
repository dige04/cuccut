import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE } from '@cuccut/protocol';
import { messageFileProperties, messageFiles } from './message-files.ts';

describe('unified message file picker', () => {
  let dir: string;
  beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-message-files-')); });
  afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });

  it('macOS mixes selection types; Windows / Linux opens one picker type at a time, keeping multi-select', () => {
    expect(messageFileProperties('darwin', false)).toEqual(['openFile', 'openDirectory', 'multiSelections']);
    for (const platform of ['win32', 'linux', 'other']) {
      expect(messageFileProperties(platform, false)).toEqual(['openFile', 'multiSelections']);
      expect(messageFileProperties(platform, true)).toEqual(['openDirectory', 'multiSelections']);
    }
  });

  it('mixed selection of images, documents and folders: images pass bytes, documents and folders pass references only, folders are not recursed', async () => {
    const image = path.join(dir, 'photo.PNG');
    const document = path.join(dir, 'brief.txt');
    const folder = path.join(dir, 'folder.png');
    await fs.writeFile(image, new Uint8Array([1, 2, 3]));
    await fs.writeFile(document, 'brief');
    await fs.mkdir(folder);
    await fs.writeFile(path.join(folder, 'private.txt'), 'not read');
    expect(await messageFiles([image, document, folder], true)).toEqual([
      { path: image, kind: 'file', image: { mimeType: 'image/png', bytes: new Uint8Array([1, 2, 3]) } },
      { path: document, kind: 'file' }, { path: folder, kind: 'directory' },
    ]);
    expect(await messageFiles([image], false)).toEqual([{ path: image, kind: 'file' }]);
    expect(await messageFiles([], true)).toEqual([]);
  });

  it('empty images, oversized images and unsupported formats are not read as attachments', async () => {
    const empty = path.join(dir, 'empty.png');
    const big = path.join(dir, 'big.jpg');
    const svg = path.join(dir, 'drawing.svg');
    await fs.writeFile(empty, '');
    await fs.writeFile(big, '');
    await fs.truncate(big, MAX_ATTACHMENT_BYTES + 1);
    await fs.writeFile(svg, '<svg/>');
    expect(await messageFiles([empty, big, svg], true)).toEqual([empty, big, svg].map(file => ({ path: file, kind: 'file' })));
  });

  it('reads at most 8 images per call; the 9th still keeps its local reference', async () => {
    const paths = Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE + 1 }, (_, i) => path.join(dir, `${i}.webp`));
    await Promise.all(paths.map(file => fs.writeFile(file, 'image')));
    const selected = await messageFiles(paths, true);
    expect(selected.filter(file => file.image)).toHaveLength(MAX_ATTACHMENTS_PER_MESSAGE);
    expect(selected.at(-1)).toEqual({ path: paths.at(-1), kind: 'file' });
  });
});
