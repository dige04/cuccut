import type { FontFaceQuery, FontsResolveResult, MediaHandle } from '@cuccut/protocol';
import { expect, test } from 'vitest';
import { runtimeFonts } from './local-fonts.ts';

function handle(fileName: string, size: number): MediaHandle {
  return { url: `http://runtime/media/${fileName}`, mimeType: 'font/collection', size, fileName, expiresAt: '2026-01-01T00:00:00Z' };
}

/** A 20-byte “font collection”; the two tables of the second face are at [8, 12) and [16, 19). */
const FILE = Uint8Array.from({ length: 20 }, (_, i) => 100 + i);
const LAYOUT = {
  faceIndex: 1,
  fileSize: FILE.length,
  size: 12,
  header: 'aabb',
  tables: [
    { from: 8, length: 4, to: 4 },
    { from: 16, length: 3, to: 8 },
    { from: 0, length: 0, to: 12 },
  ],
};
const EXPECTED = [0xaa, 0xbb, 0, 0, 108, 109, 110, 111, 116, 117, 118, 0];

function face(query: FontFaceQuery) {
  return { ...query, ...LAYOUT, source: 'local' as const, file: handle('Fake.ttc', FILE.length) };
}

/** A read handle that answers `Range` requests with 206; with `whole`, it returns the whole file, like a service that does not honor ranges. */
function server(requests: string[], whole = false) {
  return async (url: string, init?: RequestInit) => {
    const range = new Headers(init?.headers).get('Range') ?? '';
    requests.push(`${url} ${range}`);
    const match = /^bytes=(\d+)-(\d+)$/.exec(range);
    if (whole || !match) return new Response(FILE, { status: 200 });
    return new Response(FILE.slice(Number(match[1]), Number(match[2]) + 1), { status: 206 });
  };
}

test('requesting local fonts by face: only fetches this face\'s table by range and concatenates it; several queries resolving to the same face are given once; those not found are not given', async () => {
  const asked: FontFaceQuery[][] = [];
  const regular = { family: 'PingFang SC', weight: 400, italic: false };
  const medium = { family: 'PingFang SC', weight: 500, italic: false };
  const nowhere = { family: 'Nowhere', weight: 400, italic: false };
  const results: FontsResolveResult[] = [
    { faces: [face(regular), face(medium)], missing: [{ ...nowhere, reason: 'not-found' }] },
    { faces: [face(regular)], missing: [] },
  ];
  const requests: string[] = [];
  const source = runtimeFonts(async (faces) => (asked.push(faces), results.shift()!), server(requests));
  const loaded = await source.load([regular, medium, nowhere]);
  expect(asked).toEqual([[regular, medium, nowhere]]);
  expect(loaded.map((f) => [f.query, [...f.bytes]])).toEqual([[regular, EXPECTED]]);
  // Fetch each of the two non-empty tables once, not the whole file.
  expect(requests).toEqual(['http://runtime/media/Fake.ttc bytes=8-11', 'http://runtime/media/Fake.ttc bytes=16-18']);
  // When the render kernel reloads, it asks again by `load`: parse again (the handle has expired) and assemble the same bytes.
  expect([...(await loaded[0]!.font.load())]).toEqual(EXPECTED);
  expect(asked.at(-1)).toEqual([regular]);
});

test('at most 32 faces are asked at once; more are asked in several batches', async () => {
  const sizes: number[] = [];
  const source = runtimeFonts(async (faces) => (sizes.push(faces.length), { faces: [], missing: [] }), server([]));
  const queries = Array.from({ length: 70 }, (_, i) => ({ family: `F${i}`, weight: 400, italic: false }));
  expect(await source.load(queries)).toEqual([]);
  expect(sizes).toEqual([32, 32, 6]);
});

test('if the range is not recognized (the whole file is returned) or cannot be fetched, the whole batch fails without reading the whole file; later requests still work', async () => {
  const query = { family: 'X', weight: 400, italic: false };
  const requests: string[] = [];
  let whole = true;
  const fetchWhole = server(requests, true);
  const fetchRange = server(requests);
  const source = runtimeFonts(
    async () => ({ faces: [face(query)], missing: [] }),
    (url, init) => (whole ? fetchWhole(url, init) : fetchRange(url, init)),
  );
  await expect(source.load([query])).rejects.toThrow('200');
  whole = false;
  expect((await source.load([query])).map((f) => [...f.bytes])).toEqual([EXPECTED]);
  const notFound = runtimeFonts(
    async () => ({ faces: [face(query)], missing: [] }),
    async () => new Response(null, { status: 404 }),
  );
  await expect(notFound.load([query])).rejects.toThrow('404');
});

test('faces that arrive first are given first via onPartial (not waiting for downloads in the same batch), and are not repeated in the final result', async () => {
  const local = { family: 'PingFang SC', weight: 400, italic: false };
  const lobster = { family: 'Lobster', weight: 400, italic: false };
  const fileFace = (query: FontFaceQuery, fileName: string) => ({ ...face(query), file: handle(fileName, FILE.length) });
  let release!: () => void;
  const downloaded = new Promise<void>((r) => (release = r));
  const source = runtimeFonts(async (faces, onPartial) => {
    onPartial?.([fileFace(local, 'PingFang.ttc')]);
    await downloaded;
    return { faces: [fileFace(local, 'PingFang.ttc'), fileFace(lobster, 'Lobster.ttf')], missing: [] };
  }, server([]));
  const early: string[] = [];
  let seen!: () => void;
  const partialSeen = new Promise<void>((r) => (seen = r));
  const loading = source.load([local, lobster], (faces) => {
    early.push(...faces.map((f) => f.query.family));
    seen();
  });
  await partialSeen;
  expect(early).toEqual(['PingFang SC']);
  release();
  const rest = await loading;
  expect(rest.map((f) => f.query.family)).toEqual(['Lobster']);
  expect([...rest[0]!.bytes]).toEqual(EXPECTED);
});
