// Checks after import: open each video in the project folder one by one, confirm the materials are all found at their original paths and were not copied into the video directory, the document bodies can all be read,
// the instances all use version 3 video-format fields (no old `cuccut.legacy-*` wrapper; only the source note remains in the import extension), and the body of the cut-point set holds.
//
//   node scripts/legacy-import/verify.ts <project folder> [--engine <engine-host>]

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { EngineFailure, EngineHost } from './engine-host.ts';
import type { ProjectReport } from './video-plan.ts';

const { values, positionals } = parseArgs({ options: { engine: { type: 'string' }, ffprobe: { type: 'string' } }, allowPositionals: true });
const root = path.resolve(positionals[0] ?? '.');
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const engine = values.engine ?? path.join(repoRoot, 'target', 'release', 'engine-host');
const ffprobe = values.ffprobe ?? process.env.CUCCUT_FFPROBE ?? execFileSync('which', ['ffprobe'], { encoding: 'utf8' }).trim();

interface Snapshot {
  schemaVersion: number;
  name: string;
  rootSequenceId: string;
  assets: Record<string, { id: string; name: string; kind: string; currentRevision: string }>;
  documents: Record<string, { id: string; kind: string; name: string; sourceAssetId?: string }>;
  sequences: Record<string, { tracks: unknown[]; items: Record<string, unknown>[] }>;
}

const ITEM_TYPES = new Set([
  'video',
  'image',
  'audio',
  'text',
  'shape',
  'sticker',
  'visualizer',
  'progress',
  'draw',
  'placeholder',
  'confetti',
  'whiteboard',
  'composition',
  'caption',
]);
/** Keys allowed to remain in the import extension: source notes, not element data (section 5 of the mapping notes). */
const IMPORT_KEYS = new Set(['sourceId', 'bcfClip', 'mediaId', 'itemCount']);

/** Body of the cut-point set: sorted by t0, non-overlapping, integer timescale, not exceeding the material. */
function cutSetProblems(body: Record<string, any>, durationSeconds: number | undefined, items: Set<string>): string[] {
  const out: string[] = [];
  if (body.schema !== 'cuccut.cut-set/1' || body.clock !== 'source-asset') out.push('schema or clock is wrong');
  if (!Number.isSafeInteger(body.timescale) || body.timescale <= 0) out.push(`timescale is not a positive integer: ${body.timescale}`);
  let last = -1n;
  for (const cut of (body.cuts ?? []) as Record<string, any>[]) {
    if (!/^\d+$/.test(String(cut.t0)) || !/^\d+$/.test(String(cut.t1))) {
      out.push(`cut point ${cut.id} has a non-integer tick`);
      continue;
    }
    const [t0, t1] = [BigInt(cut.t0), BigInt(cut.t1)];
    if (t0 >= t1) out.push(`cut point ${cut.id} is empty`);
    if (t0 < last) out.push(`cut point ${cut.id} overlaps the previous one or is not sorted`);
    last = t1;
    if (durationSeconds != null && Number(t1) / body.timescale > durationSeconds + 1e-6) out.push(`cut point ${cut.id} is past the end of the source`);
  }
  for (const id of (body.scopeItemIds ?? []) as string[]) if (!items.has(id)) out.push(`scope item ${id} does not exist`);
  return out;
}

function bytesUnder(dir: string): number {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) total += statSync(path.join(entry.parentPath, entry.name)).size;
  }
  return total;
}

const host = new EngineHost(engine, ffprobe);
await host.request('host.hello', {});
const problems: string[] = [];
// Merely opening the written objects cannot see skipped materials, instances or the whole project; also check this batch's import report.
const reportFile = path.join(root, 'import-report.json');
if (existsSync(reportFile)) {
  const report = JSON.parse(readFileSync(reportFile, 'utf8')) as { projects: ProjectReport[] };
  for (const project of report.projects) {
    const name = path.basename(project.source);
    if (!project.videoDir || !existsSync(path.join(root, path.basename(project.videoDir), 'video.db')))
      problems.push(`${name}：报告中的视频没有写出`);
    for (const failure of project.failed) problems.push(`${name}: import failed: ${failure}`);
    for (const missing of project.assets.missing) problems.push(`${name}：导入时缺失素材：${missing}`);
  }
}
let videos = 0;
const totals = { assets: 0, linked: 0, documents: 0, items: 0, blobBytes: 0 };
for (const entry of readdirSync(root).sort((a, b) => a.localeCompare(b))) {
  const dir = path.join(root, entry);
  if (!existsSync(path.join(dir, 'video.db'))) continue;
  videos++;
  const note = (text: string): number => problems.push(`${entry}: ${text}`);
  try {
    const { videoId, snapshot } = await host.request<{ videoId: string; snapshot: Snapshot }>('videos.open', { path: dir });
    try {
      if (snapshot.schemaVersion !== 3) note(`schemaVersion is ${snapshot.schemaVersion}, not 3`);
      for (const asset of Object.values(snapshot.assets)) {
        totals.assets++;
        const blob = await host.request<{ path: string; storage: string }>('assets.blobPath', { videoId, assetId: asset.id });
        if (blob.storage === 'linked') totals.linked++;
        else note(`asset ${asset.name} is not a linked asset (${blob.storage})`);
        if (!existsSync(blob.path)) note(`asset ${asset.name} file not found: ${blob.path}`);
        if (blob.path.startsWith(dir + path.sep)) note(`asset ${asset.name} is inside the video directory: ${blob.path}`);
      }
      for (const doc of Object.values(snapshot.documents)) {
        totals.documents++;
        const content = await host.request<{ body?: unknown }>('documents.read', { videoId, documentId: doc.id });
        if (content.body == null) note(`document ${doc.name} (${doc.kind}) body cannot be read`);
        if (doc.kind === 'cut-set' && content.body != null) {
          const asset = doc.sourceAssetId ? snapshot.assets[doc.sourceAssetId] : undefined;
          const revision = (asset as { revisions?: Record<string, { duration?: { ticks: string; timescale: number } }> } | undefined)
            ?.revisions?.[asset?.currentRevision ?? ''];
          const duration = revision?.duration ? Number(revision.duration.ticks) / revision.duration.timescale : undefined;
          const ids = new Set(snapshot.sequences[snapshot.rootSequenceId].items.map((item) => String(item.id)));
          for (const text of cutSetProblems(content.body as Record<string, any>, duration, ids)) note(`cut-set ${doc.name}: ${text}`);
        }
      }
      const items = snapshot.sequences[snapshot.rootSequenceId].items;
      totals.items += items.length;
      for (const item of items) {
        if (!ITEM_TYPES.has(String(item.type))) note(`instance ${String(item.id)} has unknown type ${String(item.type)}`);
        for (const key of ['style', 'shape', 'parameterValues'] as const) {
          const schema = (item[key] as { schema?: unknown } | undefined)?.schema;
          if (typeof schema === 'string' && schema.startsWith('cuccut.legacy'))
            note(`instance ${String(item.id)} still has the old wrapper ${schema} in ${key}`);
        }
        const imported = (item.extensions as Record<string, Record<string, unknown>> | undefined)?.['cuccut.import'] ?? {};
        const extra = Object.keys(imported).filter((key) => !IMPORT_KEYS.has(key));
        if (extra.length > 0) note(`instance ${String(item.id)} has element data in its import extension: ${extra.join(', ')}`);
        const policy = item.followPolicy as { kind?: string; start?: { speechRef?: { id: string } }; end?: { speechRef?: { id: string } } };
        for (const anchor of [policy?.start, policy?.end]) {
          if (anchor?.speechRef && !snapshot.documents[anchor.speechRef.id]) note(`instance ${String(item.id)} word anchor points to a missing document`);
        }
        const refs = [item.assetRef, item.prerender, (item.source as { assetRef?: unknown } | undefined)?.assetRef] as (
          { id: string } | undefined
        )[];
        for (const ref of refs) if (ref && !snapshot.assets[ref.id]) note(`instance ${String(item.id)} references missing asset ${ref.id}`);
        for (const id of [item.documentId, item.styleDocumentId] as (string | undefined)[]) {
          if (id && !snapshot.documents[id]) note(`instance ${String(item.id)} references missing document ${id}`);
        }
      }
      const blobBytes = bytesUnder(path.join(dir, 'blobs'));
      totals.blobBytes += blobBytes;
      if (blobBytes > 0) note(`blobs/ has ${blobBytes} bytes`);
    } finally {
      await host.request('videos.close', { videoId });
    }
  } catch (error) {
    if (!(error instanceof EngineFailure)) throw error;
    note(`${error.body.code} ${error.body.message}`);
  }
}
host.close();
if (videos === 0) problems.push('没有找到任何视频');

process.stdout.write(
  `视频 ${videos} 部；素材 ${totals.assets} 个，其中链接 ${totals.linked} 个；文档 ${totals.documents} 份（正文都读过）；实例 ${totals.items} 个；blobs/ 合计 ${totals.blobBytes} 字节\n`,
);
for (const text of problems) process.stdout.write(`✗ ${text}\n`);
if (problems.length === 0) process.stdout.write('✓ 没有发现问题\n');
else process.exitCode = 1;
