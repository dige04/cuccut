#!/usr/bin/env node
// CucCut visual QC: seed a Runtime home for the review gate (docs/cuccut/m2-review-gate.md §7, QC screenshots).
//
//   node --experimental-strip-types tools/qc-seed-review.mjs --home <dir> [--standard builtin|user]
//
// Starts (or reuses) the Runtime of that home, makes a project "Review QC" with five 9:16 videos and prints their ids
// as JSON, so `tools/qc-shot.mjs --home <dir> --video <id> @video …` can open each one:
// - notChecked: an unfilled placeholder box and a line of text, never checked;
// - failed:     the same, checked (the built-in critical placeholder check fails);
// - waived:     the same, checked, and the placeholder finding let stand with a reason;
// - stale:      checked, then edited (one more text line), so the stored result is older than the video;
// - passed:     only text over the whole span, checked.
// --standard user also saves a standard of the user's own: checks (one on an unknown metric and one critical without
// a fix, so lint has something to say) and two questions; builtin (the default) clears it back to the built-ins.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CucCutClient } from '@cuccut/client';
import { newId } from '@cuccut/protocol';

const repo = path.resolve(import.meta.dirname, '..');
const { values } = parseArgs({
  options: {
    home: { type: 'string', default: path.join(repo, '.dev/qc-home') },
    standard: { type: 'string', default: 'builtin' },
  },
});
const home = path.resolve(values.home);
fs.mkdirSync(home, { recursive: true });
execFileSync(process.execPath, ['--experimental-strip-types', path.join(repo, 'apps/cli/src/main.ts'), 'runtime', 'ensure', '--json'], {
  env: { ...process.env, CUCCUT_HOME: home },
  cwd: repo,
  stdio: 'ignore',
});
const { endpoint, token } = JSON.parse(fs.readFileSync(path.join(home, 'runtime.json'), 'utf8'));
const client = new CucCutClient({ resolve: async () => ({ endpoint, token }), client: { kind: 'desktop', name: 'qc-seed-review', version: '0' }, reconnect: false });
await client.connect();

const standards = {
  builtin: { schema: 'cuccut.review-criteria/1', checks: [], rubric: [] },
  user: {
    schema: 'cuccut.review-criteria/1',
    checks: [
      { id: 'video-durationsec', metric: 'video.durationSec', min: 3, max: 60, severity: 'critical', fix: 'Trim it to a minute or less.', aspect: '9:16' },
      { id: 'items-placeholders', metric: 'items.placeholders', max: 0, severity: 'critical', fix: 'Fill or remove the placeholder boxes before delivering.' },
      { id: 'captions-on', metric: 'captions.on', is: true, severity: 'suggestion', fix: 'Add captions: most people watch with the sound off.' },
      { id: 'hook-words', metric: 'hook.words', max: 12, severity: 'nitpick', fix: '' },
      { id: 'video-length', metric: 'video.length', max: 60, severity: 'suggestion', fix: 'Keep it short.' },
      { id: 'layers-max', metric: 'layers.max', max: 3, severity: 'critical', fix: '' },
    ],
    rubric: [
      {
        id: 'payoff-first',
        ask: 'Does the first three seconds show the payoff rather than a warm-up?',
        evidence: 'timestamp',
        severity: 'suggestion',
        fix: 'Start on the line that makes the point.',
      },
      { id: 'names-right', ask: 'Are the names on screen spelled the way the speaker says them?', evidence: 'quote', severity: 'critical', fix: 'Correct the spelling in the captions.' },
    ],
  },
};
const standard = standards[values.standard];
if (!standard) throw new Error(`Unknown standard: ${values.standard} (builtin or user)`);
const current = await client.request('review.criteria.get', {});
await client.request('review.criteria.set', { standard, expectedRevision: current.revision });

const { projects } = await client.request('projects.list', {});
const project = projects.find((p) => p.name === 'Review QC') ?? (await client.request('projects.create', { name: 'Review QC' })).project;

async function edit(videoId, revision, operations) {
  return client.request('edits.apply', { videoId, commandId: newId('cmd'), expectedRevision: revision, operations });
}

/** A 9:16 video, 3 s at 30 fps: a placeholder box (0–2 s) then a text line (2–3 s), or only text when `filled`. */
async function video(name, { filled = false } = {}) {
  const opened = await client.request('videos.create', { projectId: project.id, name, width: 1080, height: 1920 });
  const { videoId } = opened.ref;
  const snapshot = opened.snapshot.video;
  const sequenceId = snapshot.rootSequenceId;
  const items = filled
    ? [{ type: 'text', trackRef: 'v', span: { fromFrame: 0, durationFrames: 90 }, place: { x: 50, w: 70 }, text: 'Three things nobody tells you' }]
    : [
        { type: 'placeholder', trackRef: 'v', span: { fromFrame: 0, durationFrames: 60 }, place: {}, placeholder: { variant: 'media' } },
        { type: 'text', trackRef: 'v', span: { fromFrame: 60, durationFrames: 30 }, place: { x: 50, w: 60 }, text: 'Watch this' },
      ];
  const receipt = await edit(videoId, snapshot.revision, [
    { type: 'addTrack', sequenceId, kind: 'visual', ref: 'v' },
    { type: 'insertItems', sequenceId, items },
  ]);
  return { videoId, sequenceId, revision: receipt.receipt.videoRevision };
}

const out = {};
out.notChecked = (await video('Not checked yet')).videoId;
const failed = await video('Launch teaser');
await client.request('review.run', { videoId: failed.videoId });
out.failed = failed.videoId;
const waived = await video('Rough cut for the team');
await client.request('review.run', { videoId: waived.videoId });
await client.request('review.waive', { videoId: waived.videoId, id: values.standard === 'user' ? 'items-placeholders' : 'placeholders', reason: 'The client drops their logo into this box.' });
out.waived = waived.videoId;
const stale = await video('Edited after checking');
await client.request('review.run', { videoId: stale.videoId });
await edit(stale.videoId, stale.revision, [
  { type: 'addTrack', sequenceId: stale.sequenceId, kind: 'visual', ref: 't' },
  { type: 'insertItems', sequenceId: stale.sequenceId, items: [{ type: 'text', trackRef: 't', span: { fromFrame: 0, durationFrames: 30 }, place: { x: 50, w: 60 }, text: 'New opening' }] },
]);
out.stale = stale.videoId;
const passed = await video('Clean short', { filled: true });
await client.request('review.run', { videoId: passed.videoId });
out.passed = passed.videoId;

client.close();
console.log(JSON.stringify({ project: project.path, standard: values.standard, videos: out }, null, 2));
