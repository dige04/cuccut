#!/usr/bin/env node
// CucCut visual QC: seed a Runtime home with a user profile (docs/cuccut/m2-profile-rules.md §8, QC screenshots).
//
//   node tools/qc-seed-profile.mjs --home <dir> --variant skipped|full|fresh [--project <project dir>]
//
// - skipped: the interview skipped with a few answers and no preferences (the state of docs/cuccut/reference/settings.png).
// - full:    the interview done with a written section, the user's own text and four workspace rules (one off, one naming a missing template).
// - fresh:   no profile file (pending interview, reminder on).
// - --project: also give that registered project (`cuccut projects create`) its own preferences and one rule (`<dir>/.ccut/profile.json`).
//
// The Runtime serving that home is stopped first, so the next `tools/qc-shot.mjs --home <dir>` starts it on the seeded file.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const repo = path.resolve(import.meta.dirname, '..');
const { values } = parseArgs({
  options: {
    home: { type: 'string', default: path.join(repo, '.dev/qc-home') },
    variant: { type: 'string', default: 'skipped' },
    project: { type: 'string' },
  },
});
const home = path.resolve(values.home);
mkdirSync(path.join(home, 'store'), { recursive: true });
try {
  execFileSync(process.execPath, ['--experimental-strip-types', path.join(repo, 'apps/cli/src/main.ts'), 'runtime', 'stop', '--json'], {
    env: { ...process.env, CUCCUT_HOME: home },
    cwd: repo,
    stdio: 'ignore',
  });
} catch {}

const file = path.join(home, 'store', 'profile.json');
const rule = (id, name, when, instruction, extra = {}) => ({
  id,
  name,
  when,
  instruction,
  templateId: null,
  stage: 'any',
  order: 0,
  enabled: true,
  note: '',
  source: null,
  ...extra,
});

const variants = {
  skipped: {
    interview: {
      status: 'skipped',
      reminder: true,
      answers: {
        who: 'Coding streams on Twitch; clips for TikTok and Shorts aimed at junior devs.',
        platforms: 'TikTok and Shorts, 30 to 60 seconds; the odd 16:9 for YouTube.',
      },
      writtenAt: null,
      usedAgent: null,
      namesGlossaryId: null,
    },
    preferences: { own: '', interview: '' },
    rules: [],
  },
  full: {
    interview: {
      status: 'done',
      reminder: false,
      answers: {
        who: 'Coding streams on Twitch; clips for TikTok and Shorts aimed at junior devs.',
        record: 'Two-hour streams with a webcam in the corner; sometimes a talking-head explainer.',
        platforms: 'TikTok and Shorts, 30 to 60 seconds; the odd 16:9 for YouTube.',
        annoys: 'Captions misspell names, hooks are too long, music drowns the voice.',
        names: 'Deska, Claude, Next.js, my handle @pasho',
      },
      writtenAt: '2026-10-12T09:30:00.000Z',
      usedAgent: true,
      namesGlossaryId: null,
    },
    preferences: {
      own: 'Never emojis in captions.\nTwo words a line.',
      interview: [
        '- Clips are vertical 9:16, 30 to 60 seconds, for TikTok and Shorts.',
        '- Open on the payoff: the hook is under three seconds.',
        '- Keep the webcam in frame when the code is the subject; crop to the face for reactions.',
        '- Captions spell names exactly as in the glossary.',
        '- Music always sits under the voice, never over it.',
        '- The audience is junior developers: explain jargon in one short caption.',
      ].join('\n'),
    },
    rules: [
      rule('gameplay-no-pictures-a1b2c3d4', 'Keep the game visible', 'the clip is gameplay', 'Never cover the game with pictures or stickers.', {
        stage: 'edit',
        order: 10,
      }),
      rule('short-hooks-b2c3d4e5', 'Short hooks', 'choosing where a clip starts', 'Start on the line that makes the point; cut any warm-up.', {
        stage: 'clip',
        order: 20,
      }),
      rule('tutorial-template-c3d4e5f6', 'Tutorials use the explainer look', 'the clip explains how to do something', '', {
        templateId: 'missing-explainer',
        order: 30,
      }),
      rule('no-music-on-talk-d4e5f6a7', 'Quiet talking heads', 'the clip is a talking-head explainer', 'Leave the music out, or keep it under -24 dB.', {
        order: 40,
        enabled: false,
        note: 'Trying this for a week.',
      }),
    ],
  },
};

if (values.variant === 'fresh') {
  rmSync(file, { force: true });
} else {
  const seed = variants[values.variant];
  if (!seed) throw new Error(`Unknown variant: ${values.variant} (skipped, full or fresh)`);
  writeFileSync(file, JSON.stringify({ schemaVersion: 1, ...seed }, null, 2) + '\n');
}
console.log(`${values.variant} -> ${file}`);

if (values.project) {
  const projectFile = path.join(path.resolve(values.project), '.ccut', 'profile.json');
  mkdirSync(path.dirname(projectFile), { recursive: true });
  const projectProfile = {
    schemaVersion: 1,
    preferences: 'This channel is in English; captions stay in English even when a guest speaks Vietnamese.\nEnd every clip on the channel handle.',
    rules: [
      rule('guest-lower-third-e5f6a7b8', 'Name the guest', 'a guest speaks for the first time', 'Add a lower third with their name and role.', {
        stage: 'edit',
        order: 10,
      }),
    ],
  };
  writeFileSync(projectFile, JSON.stringify(projectProfile, null, 2) + '\n');
  console.log(`project -> ${projectFile}`);
}
