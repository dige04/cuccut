import type { FontFaceQuery, FontsResolveResult } from '@cuccut/protocol';
import { R } from './render-copy.ts';

/** Maximum number of faces asked for in one `fonts.resolve` call (consistent with the protocol). */
const RESOLVE_BATCH = 32;
/** How many table ranges are fetched at the same time. */
const FETCH_CONCURRENCY = 4;

/**
 * A local font face: `key` identifies one face (when several queries land on the same face, it is injected only once). `load` asks again for its bytes (used when the render kernel reloads and when a thumbnail instance is created, so the UI keeps no copy of the bytes).
 */
export interface LocalFont {
  key: string;
  load(): Promise<Uint8Array>;
}

/** A face that was obtained: which query asked for it, what it is, and its bytes (no longer kept once injected into the render kernel). */
export interface LoadedFace {
  query: FontFaceQuery;
  font: LocalFont;
  bytes: Uint8Array;
}

/**
 * Local fonts that preview needs: for each face (family name, weight, italic), the extracted font bytes (faces not found are not given). Within a batch, those that arrive first (available locally, already downloaded) are given first through `onPartial`, without waiting for ones in the batch still downloading. Faces already given do not appear again in the final result.
 */
export interface FontSource {
  load(faces: readonly FontFaceQuery[], onPartial?: (faces: LoadedFace[]) => void): Promise<LoadedFace[]>;
}

type ResolvedFace = FontsResolveResult['faces'][number];

/** Identifies a face: file name, file byte count, and its index within the file. */
function faceKey(face: ResolvedFace): string {
  return `${face.file.fileName}\u0000${face.fileSize}\u0000${face.faceIndex}`;
}

/**
 * Assembles this one face the way the engine specifies: after the file header, each table is fetched from the file by range (`Range`). Only responses with 206 and a matching byte count are accepted. A response that returns the whole file (200) is not read, so the whole font collection is not pulled down.
 */
async function assemble(face: ResolvedFace, fetcher: (url: string, init?: RequestInit) => Promise<Response>): Promise<Uint8Array> {
  const out = new Uint8Array(face.size);
  const header = face.header;
  for (let i = 0; i < header.length / 2; i++) out[i] = parseInt(header.slice(i * 2, i * 2 + 2), 16);
  const tables = face.tables.filter((table) => table.length > 0);
  let next = 0;
  const worker = async () => {
    while (next < tables.length) {
      const table = tables[next++]!;
      const response = await fetcher(face.file.url, { headers: { Range: `bytes=${table.from}-${table.from + table.length - 1}` } });
      if (response.status !== 206) {
        await response.body?.cancel();
        throw new Error(R.fonts.tableFailed(response.status));
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length !== table.length) throw new Error(R.fonts.tableLength(table.length, bytes.length));
      out.set(bytes, table.to);
    }
  };
  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, tables.length) }, worker));
  return out;
}

/**
 * Fetches local fonts through the Runtime's `fonts.resolve` (architecture design §9.1). The engine picks the face by family name, weight and italic (the same resolution and extraction that export freezes). Here, only that face's tables are fetched through a read handle and assembled into a separate font, so a font collection (a .ttc of tens of MB holding dozens of faces) is not downloaded whole. When the preview only reports missing families, faces named during typesetting are used, and the font catalog is not listed. The same face (when several queries land on it) is given only once.
 * The browser session has no such method; when the request is rejected, every face is treated as absent.
 */
export function runtimeFonts(
  resolve: (faces: FontFaceQuery[], onPartial?: (faces: ResolvedFace[]) => void) => Promise<FontsResolveResult>,
  fetcher: (url: string, init?: RequestInit) => Promise<Response> = (url, init) => fetch(url, init),
): FontSource {
  const given = new Set<string>();
  const font = (query: FontFaceQuery, face: ResolvedFace): LocalFont => ({
    key: faceKey(face),
    // Handles expire: when asked again, resolve again first.
    async load() {
      const { faces } = await resolve([query]);
      const again = faces.find((f) => faceKey(f) === faceKey(face));
      if (!again) throw new Error(R.fonts.localMissing(query.family));
      return assemble(again, fetcher);
    },
  });
  /** From a batch of faces, fetch the bytes of those not yet given; if a fetch fails, put it back so it can be asked for again next time. */
  const take = async (pairs: readonly { query: FontFaceQuery; face: ResolvedFace }[]): Promise<LoadedFace[]> => {
    const fresh = pairs.filter(({ face }) => {
      const key = faceKey(face);
      if (given.has(key)) return false;
      given.add(key);
      return true;
    });
    try {
      return await Promise.all(
        fresh.map(async ({ query, face }) => ({ query, font: font(query, face), bytes: await assemble(face, fetcher) })),
      );
    } catch (error) {
      for (const { face } of fresh) given.delete(faceKey(face));
      throw error;
    }
  };
  const match = (batch: readonly FontFaceQuery[], faces: readonly ResolvedFace[]) =>
    faces.flatMap((face) => {
      const query = batch.find((q) => q.family === face.family && q.weight === face.weight && q.italic === face.italic);
      return query ? [{ query, face }] : [];
    });
  return {
    async load(queries, onPartial) {
      const found: { query: FontFaceQuery; face: ResolvedFace }[] = [];
      const early: Promise<void>[] = [];
      for (let start = 0; start < queries.length; start += RESOLVE_BATCH) {
        const batch = queries.slice(start, start + RESOLVE_BATCH);
        const partial = onPartial
          ? (faces: ResolvedFace[]) => {
              // First to arrive are given first; those that could not be fetched (`take` has put them back) are left to be tried again together at the end.
              early.push(
                take(match(batch, faces)).then(
                  (loaded) => void (loaded.length && onPartial(loaded)),
                  () => {},
                ),
              );
            }
          : undefined;
        const { faces } = await resolve([...batch], partial);
        found.push(...match(batch, faces));
      }
      await Promise.all(early);
      // Those not fetched in this batch can be asked for again next time.
      return take(found);
    },
  };
}
