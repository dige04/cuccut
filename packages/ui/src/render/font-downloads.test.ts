import { expect, test } from 'vitest';
import type { FontFaceQuery, FontsResolveResult } from '@cuccut/protocol';
import { downloadingResolve } from './font-downloads.ts';

type Face = FontsResolveResult['faces'][number];

function face(query: FontFaceQuery, source: 'local' | 'downloaded'): Face {
  return {
    ...query,
    faceIndex: 0,
    fileSize: 10,
    size: 10,
    header: '',
    tables: [],
    source,
    file: { url: `http://127.0.0.1/${query.family}`, fileName: `${query.family}.ttf`, byteLength: 10, expiresAt: '2100-01-01T00:00:00Z' },
  } as unknown as Face;
}

test('a face still downloading is asked again after a while, until the download ends; faces available locally or that failed are merged into the result as is', async () => {
  const local = { family: 'PingFang SC', weight: 400, italic: false };
  const lobster = { family: 'Lobster', weight: 400, italic: false };
  const broken = { family: 'Broken Font', weight: 700, italic: false };
  const asked: { faces: FontFaceQuery[]; download: boolean }[] = [];
  const answers: FontsResolveResult[] = [
    {
      faces: [face(local, 'local')],
      missing: [
        { ...lobster, reason: 'downloading', jobId: 'job_1' },
        { ...broken, reason: 'downloading', jobId: 'job_2' },
      ],
    },
    {
      faces: [],
      missing: [
        { ...lobster, reason: 'downloading', jobId: 'job_1' },
        { ...broken, reason: 'download-failed', code: 'FONT_DOWNLOAD_SOURCE' },
      ],
    },
    { faces: [face(lobster, 'downloaded')], missing: [] },
  ];
  const sleeps: number[] = [];
  const resolve = downloadingResolve(async (params) => (asked.push(params), answers.shift()!), {
    pollMs: 5,
    sleep: async (ms) => void sleeps.push(ms),
  });
  const result = await resolve([local, lobster, broken]);
  expect(asked.map((a) => a.faces.map((f) => f.family))).toEqual([
    ['PingFang SC', 'Lobster', 'Broken Font'],
    ['Lobster', 'Broken Font'],
    ['Lobster'],
  ]);
  // Only the first request carries download: asking again only waits for downloads already started, so a download that was just cancelled is not restarted by a new request.
  expect(asked.map((a) => a.download)).toEqual([true, false, false]);
  expect(sleeps).toEqual([5, 5]);
  expect(result.faces.map((f) => [f.family, f.source])).toEqual([
    ['PingFang SC', 'local'],
    ['Lobster', 'downloaded'],
  ]);
  expect(result.missing).toEqual([{ ...broken, reason: 'download-failed', code: 'FONT_DOWNLOAD_SOURCE' }]);
});

test('download cancelled while waiting: asks again without download; if the Runtime answers \'can download\', it draws with the fallback font as before and does not restart', async () => {
  const lobster = { family: 'Lobster', weight: 400, italic: false };
  const asked: boolean[] = [];
  const answers: FontsResolveResult[] = [
    { faces: [], missing: [{ ...lobster, reason: 'downloading', jobId: 'job_1' }] },
    { faces: [], missing: [{ ...lobster, reason: 'downloadable' }] },
  ];
  const resolve = downloadingResolve(async (params) => (asked.push(params.download), answers.shift()!), {
    pollMs: 5,
    sleep: async () => {},
  });
  const result = await resolve([lobster]);
  expect(asked).toEqual([true, false]);
  expect(result).toEqual({ faces: [], missing: [{ ...lobster, reason: 'downloadable' }] });
});

test('waiting stops at the limit: faces still downloading are marked downloading and drawn with the fallback font', async () => {
  const lobster = { family: 'Lobster', weight: 400, italic: false };
  let calls = 0;
  const resolve = downloadingResolve(
    async () => (calls++, { faces: [], missing: [{ ...lobster, reason: 'downloading', jobId: 'job_1' }] }),
    { pollMs: 10, maxWaitMs: 30, sleep: async () => {} },
  );
  const result = await resolve([lobster]);
  expect(calls).toBe(4);
  expect(result).toEqual({ faces: [], missing: [{ ...lobster, reason: 'downloading' }] });
});

test('within a batch, faces that arrive first are handed over first: local ones do not wait for downloads, and while waiting, those finished downloading first are also given first', async () => {
  const local = { family: 'PingFang SC', weight: 400, italic: false };
  const lobster = { family: 'Lobster', weight: 400, italic: false };
  const mashan = { family: 'Ma Shan Zheng', weight: 400, italic: false };
  const answers: FontsResolveResult[] = [
    {
      faces: [face(local, 'local')],
      missing: [
        { ...lobster, reason: 'downloading', jobId: 'job_1' },
        { ...mashan, reason: 'downloading', jobId: 'job_2' },
      ],
    },
    { faces: [face(lobster, 'downloaded')], missing: [{ ...mashan, reason: 'downloading', jobId: 'job_2' }] },
    { faces: [face(mashan, 'downloaded')], missing: [] },
  ];
  const partial: string[][] = [];
  const resolve = downloadingResolve(async () => answers.shift()!, { pollMs: 5, sleep: async () => {} });
  const result = await resolve([local, lobster, mashan], (faces) => partial.push(faces.map((f) => f.family)));
  expect(partial).toEqual([['PingFang SC'], ['Lobster']]);
  expect(result.faces.map((f) => f.family)).toEqual(['PingFang SC', 'Lobster', 'Ma Shan Zheng']);
});

test('when nothing needs to wait, results are not split into batches: all given at once', async () => {
  const local = { family: 'PingFang SC', weight: 400, italic: false };
  const partial: unknown[] = [];
  const resolve = downloadingResolve(async () => ({ faces: [face(local, 'local')], missing: [] }), { sleep: async () => {} });
  const result = await resolve([local], (faces) => partial.push(faces));
  expect(partial).toEqual([]);
  expect(result.faces).toHaveLength(1);
});
