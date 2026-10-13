import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gzipSync, deflateRawSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToolArchiveError, extractToolArchive, rootEntryName } from './tool-archive.ts';

/**
 * Extraction of managed tool archives (architecture design §12.9): the archives are assembled byte by byte in the tests, covering names that escape the directory, links, subdirectories, the skip list, long pax names,
 * executable bits, and zip's “stored” (uncompressed) and deflate modes.
 */

interface TarEntry {
  name: string;
  body?: string;
  type?: string;
  mode?: number;
  linkName?: string;
}

function tarHeader(name: string, size: number, type: string, mode: number, linkName = ''): Buffer {
  const header = Buffer.alloc(512);
  header.write(name.slice(0, 100), 0, 'utf8');
  header.write(mode.toString(8).padStart(7, '0') + '\0', 100);
  header.write('0000000\0', 108);
  header.write('0000000\0', 116);
  header.write(size.toString(8).padStart(11, '0') + '\0', 124);
  header.write('00000000000\0', 136);
  header.write('        ', 148);
  header.write(type, 156);
  header.write(linkName, 157);
  header.write('ustar\0', 257);
  header.write('00', 263);
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return header;
}

function block(data: Buffer): Buffer {
  const padding = (512 - (data.length % 512)) % 512;
  return Buffer.concat([data, Buffer.alloc(padding)]);
}

function tarGz(entries: TarEntry[]): Buffer {
  const parts: Buffer[] = [];
  for (const entry of entries) {
    const body = Buffer.from(entry.body ?? '');
    if (entry.name.length > 100) {
      const record = `path=${entry.name}\n`;
      let length = record.length + 3;
      if (`${length} ${record}`.length !== length) length += 1;
      const pax = Buffer.from(`${length} ${record}`);
      parts.push(tarHeader('PaxHeader', pax.length, 'x', 0o644), block(pax));
    }
    parts.push(tarHeader(entry.name, body.length, entry.type ?? '0', entry.mode ?? 0o644, entry.linkName), block(body));
  }
  parts.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(parts));
}

interface ZipEntry {
  name: string;
  body?: string;
  deflate?: boolean;
  unixMode?: number;
}

function zip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const raw = Buffer.from(entry.body ?? '');
    const data = entry.deflate ? deflateRawSync(raw) : raw;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(entry.deflate ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(entry.deflate ? 8 : 0, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(((entry.unixMode ?? 0o100644) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, data);
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

describe('extractToolArchive', () => {
  let dir: string;
  let dest: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-tool-archive-'));
    dest = path.join(dir, 'out');
    await fs.mkdir(dest);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('rootEntryName: only accepts safe names in the root directory', () => {
    expect(rootEntryName('./audiocpp_cli')).toBe('audiocpp_cli');
    expect(rootEntryName('audiocpp_cli.exe')).toBe('audiocpp_cli.exe');
    for (const raw of ['./', '.', '..', '../evil', 'tools/x', '/etc/passwd', 'C:evil', 'a\\b', '._audiocpp_cli']) expect(rootEntryName(raw)).toBeNull();
  });

  it('tar.gz: extracts only regular files in the root directory, skipping links, subdirectories, traversal and the skip list; keeps the executable bit; recognizes pax long names', async () => {
    const longName = `./${'l'.repeat(120)}.so`;
    const archive = path.join(dir, 'a.tar.gz');
    await fs.writeFile(
      archive,
      tarGz([
        { name: './', type: '5', mode: 0o755 },
        { name: './audiocpp_cli', body: '#!/bin/sh\necho hi\n', mode: 0o755 },
        { name: './audiocpp_server', body: 'server', mode: 0o755 },
        { name: './libggml.so', body: 'lib' },
        { name: './libggml.so.0', type: '2', linkName: 'libggml.so' },
        { name: './tools/', type: '5', mode: 0o755 },
        { name: './tools/helper', body: 'helper', mode: 0o755 },
        { name: '../escape', body: 'nope' },
        { name: longName, body: 'long' },
      ]),
    );
    const names = await extractToolArchive(archive, { format: 'tar.gz', skip: ['audiocpp_server'] }, dest);
    expect(names.sort()).toEqual(['audiocpp_cli', 'libggml.so', longName.slice(2)].sort());
    expect((await fs.readdir(dest)).sort()).toEqual(names.sort());
    expect(await fs.readFile(path.join(dest, 'audiocpp_cli'), 'utf8')).toBe('#!/bin/sh\necho hi\n');
    expect(await fs.readFile(path.join(dest, longName.slice(2)), 'utf8')).toBe('long');
    expect((await fs.stat(path.join(dest, 'audiocpp_cli'))).mode & 0o111).not.toBe(0);
    expect((await fs.stat(path.join(dest, 'libggml.so'))).mode & 0o111).toBe(0);
    await expect(fs.access(path.join(dir, 'escape'))).rejects.toThrow();
  });

  it('tar.gz: errors when truncated or not gzip', async () => {
    const whole = tarGz([{ name: './audiocpp_cli', body: 'x'.repeat(4096), mode: 0o755 }]);
    const { gunzipSync } = await import('node:zlib');
    const truncated = gzipSync(gunzipSync(whole).subarray(0, 512 + 1000));
    await fs.writeFile(path.join(dir, 't.tar.gz'), truncated);
    await expect(extractToolArchive(path.join(dir, 't.tar.gz'), { format: 'tar.gz', skip: [] }, dest)).rejects.toBeInstanceOf(ToolArchiveError);
    await fs.writeFile(path.join(dir, 'n.tar.gz'), 'not gzip');
    await expect(extractToolArchive(path.join(dir, 'n.tar.gz'), { format: 'tar.gz', skip: [] }, path.join(dir, 'out'))).rejects.toThrow();
  });

  it('zip: stored (no compression) and deflate, skipping directories, links, subdirectories and the skip list; .exe is executable', async () => {
    const archive = path.join(dir, 'a.zip');
    await fs.writeFile(
      archive,
      zip([
        { name: 'audiocpp_cli.exe', body: 'MZ'.repeat(100), deflate: true },
        { name: 'audiocpp_server.exe', body: 'server' },
        { name: 'ggml.dll', body: 'dll' },
        { name: 'tools/', unixMode: 0o040755 },
        { name: 'tools/helper.exe', body: 'helper' },
        { name: 'link', body: 'ggml.dll', unixMode: 0o120777 },
        { name: '../escape.dll', body: 'nope' },
      ]),
    );
    const names = await extractToolArchive(archive, { format: 'zip', skip: ['audiocpp_server.exe'] }, dest);
    expect(names.sort()).toEqual(['audiocpp_cli.exe', 'ggml.dll']);
    expect(await fs.readFile(path.join(dest, 'audiocpp_cli.exe'), 'utf8')).toBe('MZ'.repeat(100));
    if (process.platform !== 'win32') expect((await fs.stat(path.join(dest, 'audiocpp_cli.exe'))).mode & 0o111).not.toBe(0);
  });

  it('zip: errors when not a zip or when the root directory has no files', async () => {
    await fs.writeFile(path.join(dir, 'n.zip'), 'not a zip at all, definitely not');
    await expect(extractToolArchive(path.join(dir, 'n.zip'), { format: 'zip', skip: [] }, dest)).rejects.toBeInstanceOf(ToolArchiveError);
    await fs.writeFile(path.join(dir, 'e.zip'), zip([{ name: 'sub/only.exe', body: 'x' }]));
    await expect(extractToolArchive(path.join(dir, 'e.zip'), { format: 'zip', skip: [] }, dest)).rejects.toThrow(/no files/);
  });
});
