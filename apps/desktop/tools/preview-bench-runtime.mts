// The isolated Runtime for the preview playback benchmark (`tools/preview-bench.mjs`): started by the benchmark script with node; Home, the projects and downloads directories are all in the benchmark's temp directory
// (`CUCCUT_HOME`, `CUCCUT_PROJECTS_DIR`, `CUCCUT_DOWNLOADS_DIR`). It registers no agent Driver, starts no model Worker, watches no source directory,
// and broadcasts and discovers no LAN nodes; credentials use the plaintext file backend (the keychain is not touched), and the external tools' search path is one empty directory.
//
// After startup, the directory given by `--project` is registered as a project; each synthetic media item given by `--synthetic <JSON>` (`[{name, file, width, height, fps}]`)
// gets one video: the imported media is placed on the timeline, then two captions, Chinese and English, are added (in one transaction, the same as importing a caption file). Finally it writes one line
// `{"type":"ready","projectId":…,"videos":[{name, path}]}` to stdout. The token does not go to stdout; the benchmark's Electron main process reads it from the discovery file. It stops on SIGTERM.

import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CucCutClient } from '@cuccut/client';
import { startRuntime } from '@cuccut/runtime-core';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { importCaptionOperations } from '../../../packages/ui/src/model/cue-edit.ts';
import { rootSequence } from '../../../packages/ui/src/model/editor.ts';

interface Synthetic {
  name: string;
  file: string;
  width: number;
  height: number;
  fps: number;
}

const { values } = parseArgs({ options: { project: { type: 'string' }, synthetic: { type: 'string', default: '[]' } } });
if (!values.project) throw new Error('缺少 --project');
const synthetic = JSON.parse(values.synthetic!) as Synthetic[];
const home = resolveRuntimeHome(process.env);
const emptyPath = path.join(home.root, 'empty-path');
await fs.mkdir(emptyPath, { recursive: true });

const runtime = await startRuntime({
  home,
  drivers: () => [],
  watchSpace: false,
  engineHost: process.env.CUCCUT_ENGINE_HOST || undefined,
  modelWorker: null,
  credentials: 'file',
  initiator: { discoverer: null },
  nodes: { host: '127.0.0.1', advertiser: null },
  externalTools: { env: async () => ({ PATH: emptyPath }), overrides: {}, lookup: async () => ['127.0.0.1'] },
});
const { endpoint, token } = runtime.discovery;
const client = new CucCutClient({
  resolve: async () => ({ endpoint, token }),
  client: { kind: 'desktop', name: 'preview-bench', version: '0' },
  reconnect: false,
});
await client.connect();
const { project } = await client.request('projects.open', { path: values.project });

/** Captions: one every 1.5 seconds, covering the whole media. */
function cues(seconds: number, text: (index: number) => string) {
  return Array.from({ length: Math.floor(seconds / 1.5) }, (_, i) => ({ index: i + 1, start: i * 1.5, end: i * 1.5 + 1.4, text: text(i) }));
}

const videos: { name: string; path: string }[] = [];
for (const scene of synthetic) {
  const opened = await client.request('videos.create', {
    projectId: project.id,
    name: scene.name,
    fps: { num: scene.fps, den: 1 },
    width: scene.width,
    height: scene.height,
  });
  const { videoId } = opened.ref;
  let revision = opened.snapshot.video.revision;
  const apply = async (operations: unknown[]) => {
    const result = await client.request('edits.apply', {
      videoId,
      commandId: `cmd_${crypto.randomUUID().replaceAll('-', '')}`,
      expectedRevision: revision,
      operations: operations as never,
    });
    revision = result.receipt.videoRevision;
  };
  await apply([
    { type: 'importAsset', path: scene.file, ref: 'clip' },
    { type: 'addItem', sequenceId: opened.snapshot.video.rootSequenceId, asset: { ref: 'clip' }, alignment: 'nearest-frame' },
  ]);
  const duration = 12;
  for (const [language, text] of [
    ['zh', (i: number) => `第 ${i + 1} 句：预览播放的基准字幕，逐句换行`],
    ['en', (i: number) => `Line ${i + 1}: a benchmark caption for preview playback`],
  ] as const) {
    const sequence = rootSequence(runtime.videos.mirror(videoId)!.video)!;
    await apply(importCaptionOperations(sequence, cues(duration, text), `字幕 ${language}`, language));
  }
  await client.request('videos.close', { videoId });
  videos.push({ name: scene.name, path: opened.ref.relPath });
}
client.close();
process.stdout.write(`${JSON.stringify({ type: 'ready', projectId: project.id, videos })}\n`);

const stop = () => void runtime.close().then(() => process.exit(0));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
