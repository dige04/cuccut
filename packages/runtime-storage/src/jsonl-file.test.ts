import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JsonlCorruptError, appendJsonl, compactJsonl, quarantineFile, readJsonl } from './jsonl-file.ts';

const HEADER = { op: 'header', formatVersion: 2 };

describe('jsonl-file', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-jsonl-file-'));
    file = path.join(dir, 'store', 'ledger.jsonl');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('missing file reads as null; append writes the header first, then only appends', async () => {
    expect(await readJsonl(file)).toBeNull();
    await appendJsonl(file, ['{"a":1}'], { header: HEADER });
    await appendJsonl(file, ['{"a":2}', '{"a":3}'], { header: HEADER });
    expect(await fs.readFile(file, 'utf8')).toBe(`${JSON.stringify(HEADER)}\n{"a":1}\n{"a":2}\n{"a":3}\n`);
    const read = await readJsonl(file);
    expect(read).toMatchObject({ header: HEADER, rows: [{ a: 1 }, { a: 2 }, { a: 3 }], skipped: 0, truncatedTail: false, lines: 3 });
  });

  it('trailing partial line skipped, not counted as a bad line; a later append adds a newline first so new lines don\'t join the partial line', async () => {
    await appendJsonl(file, ['{"a":1}'], { header: HEADER });
    await fs.appendFile(file, '{"a":2,"b"');
    expect(await readJsonl(file)).toMatchObject({ rows: [{ a: 1 }], skipped: 0, truncatedTail: true, lines: 2 });
    await appendJsonl(file, ['{"a":3}'], { header: HEADER });
    // A torn line in the middle became a bad line: skip and count it, keep reading the lines after it.
    expect(await readJsonl(file)).toMatchObject({ rows: [{ a: 1 }, { a: 3 }], skipped: 1, truncatedTail: false });
  });

  it('if the first line is unrecognized, the whole file is bad; empty file is not', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '');
    expect(await readJsonl(file)).toMatchObject({ header: null, rows: [], lines: 0 });
    // Only a partial line (crash while writing the file header): treat as an empty file and flag the torn line.
    await fs.writeFile(file, '{"op":"hea');
    expect(await readJsonl(file)).toMatchObject({ header: null, rows: [], lines: 0, truncatedTail: true });
    await fs.writeFile(file, 'not json\n{"a":1}\n');
    await expect(readJsonl(file)).rejects.toBeInstanceOf(JsonlCorruptError);
    const kept = await quarantineFile(file);
    expect(path.basename(kept)).toMatch(/^ledger\.jsonl\.corrupt-\d+$/);
    expect(await readJsonl(file)).toBeNull();
  });

  it('compaction: atomically replaced with the header plus these lines, no temp file left', async () => {
    await appendJsonl(file, ['{"a":1}', '{"a":2}'], { header: HEADER });
    const bytes = await compactJsonl(file, ['{"a":9}'], { header: HEADER });
    const text = await fs.readFile(file, 'utf8');
    expect(text).toBe(`${JSON.stringify(HEADER)}\n{"a":9}\n`);
    expect(bytes).toBe(Buffer.byteLength(text));
    expect(await fs.readdir(path.dirname(file))).toEqual(['ledger.jsonl']);
  });

  it('durable: false: appends and compaction do not fsync, content same as the default', async () => {
    const probe = await fs.open(path.join(dir, 'probe'), 'w');
    const proto = Object.getPrototypeOf(probe) as { sync: () => Promise<void> };
    await probe.close();
    const sync = vi.spyOn(proto, 'sync');
    try {
      await appendJsonl(file, ['{"a":1}'], { header: HEADER, durable: false });
      await appendJsonl(file, ['{"a":2}'], { header: HEADER, durable: false });
      await compactJsonl(file, ['{"a":3}'], { header: HEADER, durable: false });
      expect(sync).not.toHaveBeenCalled();
      expect(await fs.readFile(file, 'utf8')).toBe(`${JSON.stringify(HEADER)}\n{"a":3}\n`);
      await appendJsonl(file, ['{"a":4}'], { header: HEADER });
      expect(sync).toHaveBeenCalled();
    } finally {
      sync.mockRestore();
    }
  });
});
