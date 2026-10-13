#!/usr/bin/env node
// CucCut visual QC: seeds a Runtime home with a publishing calendar so the calendar, Unscheduled inbox, attention bar and
// Publication dialog have something to show (docs/cuccut/m2-publishing.md §7).
//
//   node tools/qc-seed-publishing.mjs --home .dev/qc-publishing [--project <dir>] [--timezone Europe/Berlin]
//
// Then: node tools/qc-shot.mjs --home <same> --out <dir> /calendar /calendar?view=week /calendar?view=agenda /settings/publishing
//
// Connections, accounts and the schedule are owner-only (no agent or CLI tool writes them), so the script writes them into
// `store/publishing.json` while the Runtime is stopped. Publications go through the CLI tools (`publications prepare`,
// `publications update`, `publications reserve`) on fixture videos. Delivery states a CLI caller cannot reach (an
// owner-authorized by-hand send waiting for the owner, a recorded "Published") are then written into the store file,
// again with the Runtime stopped. Prints the IDs as JSON, including a publication to open with `/calendar?publication=`.
// Re-running resets the publishing store of that home.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const repo = path.resolve(import.meta.dirname, '..');
const { values } = parseArgs({
  options: {
    home: { type: 'string', default: path.join(repo, '.dev/qc-publishing') },
    project: { type: 'string' },
    timezone: { type: 'string', default: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
  },
});
const home = path.resolve(values.home);
const project = path.resolve(values.project ?? `${home}-project`);
const tz = values.timezone;
const env = { ...process.env, CUCCUT_HOME: home };
const storeFile = path.join(home, 'store', 'publishing.json');

function cliRaw(...args) {
  return execFileSync(process.execPath, ['--experimental-strip-types', path.join(repo, 'apps/cli/src/main.ts'), ...args], {
    env,
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}
function cli(...args) {
  const out = JSON.parse(cliRaw(...args, '--json'));
  if (!out.ok) throw new Error(`${args.slice(0, 2).join(' ')}: ${JSON.stringify(out.error)}`);
  return out.result;
}
const stop = () => {
  try {
    cliRaw('runtime', 'stop', '--json');
  } catch {}
};
const id = (prefix) => `${prefix}_${randomBytes(8).toString('hex')}`;
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

/** `YYYY-MM-DD` of `date` in the workspace timezone. */
function civil(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
/** The instant of `HH:MM` on the civil day `days` after today, in the workspace timezone (offset taken at that day's noon). */
function at(days, time) {
  const base = new Date(Date.now() + days * 86_400_000);
  const day = civil(base);
  const noonUtc = new Date(`${day}T12:00:00Z`);
  const local = new Date(noonUtc.toLocaleString('en-US', { timeZone: tz }));
  const utc = new Date(noonUtc.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMin = Math.round((local - utc) / 60_000);
  const [h, m] = time.split(':').map(Number);
  return iso(new Date(Date.parse(`${day}T00:00:00Z`) + (h * 60 + m - offsetMin) * 60_000));
}

// ---- 1. Owner settings, connection and accounts (Runtime stopped) ----
mkdirSync(path.dirname(storeFile), { recursive: true });
stop();
const now = new Date();
const connection = { id: id('pconn'), provider: 'manual', name: 'By hand', baseUrl: '', configured: true, checkedAt: null, error: null, errorRef: null };
const account = (network, name, remoteId) => ({
  id: id('pacct'),
  connectionId: connection.id,
  remoteId,
  network,
  name,
  disabled: false,
  needsReconnect: false,
  equivalentTo: null,
});
const youtube = account('youtube', 'CucCut Studio', '@cuccutstudio');
const instagram = account('instagram', 'cuccut.studio', 'cuccut.studio');
const tiktok = account('tiktok', 'cuccut', '@cuccut');
const accounts = [youtube, instagram, tiktok];
const settings = {
  timezone: tz,
  slots: [
    { weekday: 1, time: '18:00' },
    { weekday: 3, time: '12:30' },
    { weekday: 5, time: '18:00' },
  ],
  minGapMinutes: 60,
  leadMinutes: 30,
  defaultAccountIds: accounts.map((a) => a.id),
  writing: 'Short, direct, second person. One emoji at most.',
  autoPrepare: false,
  archivedRetentionDays: 90,
  revision: 1,
};
writeFileSync(
  storeFile,
  JSON.stringify({ schemaVersion: 1, settings, connections: [connection], accounts, publications: [], exports: [], history: [], imports: [] }, null, 2),
  { mode: 0o600 },
);

// ---- 2. Fixture videos and publications through the CLI ----
cli('runtime', 'ensure');
const names = ['Three editing tips', 'Behind the scenes', 'Launch teaser', 'Customer story', 'Weekly recap', 'Color grading in 60 seconds'];
const copies = [
  { title: 'Three editing tips you will use today', description: 'Cut faster with three habits from our editors.', hashtags: ['editing', 'shorts', 'tips'] },
  { title: 'Behind the scenes', description: 'How the autumn launch came together.', hashtags: ['bts'] },
  { title: 'Launch teaser', description: 'Something new is coming next week.', hashtags: ['launch', 'cuccut'] },
  { title: 'How Linh edits a week of shorts in one afternoon', description: 'A customer story about batching edits.', hashtags: ['story'] },
];
// Explicit times: one earlier today (due by hand), one in two days, one next week; index 2 gets a reserved weekly slot.
const times = { 0: at(0, '00:30'), 1: at(2, '09:15'), 3: at(8, '17:45') };
const pubs = [];
let videos = [];
let offline = false;
try {
  cli('projects', 'create', project, '--name', 'Autumn launch');
  videos = names.map((name) => {
    const v = cli('videos', 'create', name, '--width', '1080', '--height', '1920', '--project', project);
    return v.videoId ?? v.video?.id ?? v.id;
  });
} catch (error) {
  if (!String(error.stdout ?? error.message).includes('ENGINE_UNAVAILABLE')) throw error;
  // No engine-host on this machine (`npm run build:engine` not run): the videos cannot be created, so the publications are
  // written straight into the store for videos that are not on this computer (the calendar's "video missing" state).
  offline = true;
  console.error('qc-seed-publishing: engine-host not found; writing publications for videos that are not on this computer.');
}
if (!offline) {
  const prepared = cli('publications', 'prepare', ...videos.flatMap((v) => ['--videos', v]), '--project', project).publications;
  for (const p of prepared) pubs.push({ id: p.id, revision: p.revision });
  const update = (i, ...flags) => {
    const res = cli('publications', 'update', '--publication', pubs[i].id, '--revision', String(pubs[i].revision), ...flags, '--project', project);
    pubs[i].revision = (res.publication ?? res).revision;
  };
  copies.forEach((copy, i) => update(i, '--copy', JSON.stringify(copy)));
  for (const [i, t] of Object.entries(times)) update(Number(i), '--scheduled-at', t);
  const reserved = cli('publications', 'reserve', '--publications', pubs[2].id, '--revisions', JSON.stringify({ [pubs[2].id]: pubs[2].revision }), '--project', project);
  for (const d of reserved.publications ?? []) if (d.id === pubs[2].id) pubs[2].revision = d.revision;
} else {
  stop();
  const { publicationSchema, publicationDestinationSchema } = await import('@cuccut/protocol/schemas');
  const doc = JSON.parse(readFileSync(storeFile, 'utf8'));
  const stamp = iso(now);
  const formats = { youtube: 'youtube-short', instagram: 'instagram-reel', tiktok: 'tiktok-video' };
  // The first free weekly slot (Mon/Wed/Fri) at least two days out, for the "reserved" publication.
  let slotDay = 2;
  while (![1, 3, 5].includes(new Date(`${civil(new Date(Date.now() + slotDay * 86_400_000))}T12:00:00Z`).getUTCDay())) slotDay++;
  times[2] = at(slotDay, settings.slots.find((s) => s.weekday === new Date(`${civil(new Date(Date.now() + slotDay * 86_400_000))}T12:00:00Z`).getUTCDay()).time);
  names.forEach((name, i) => {
    const videoId = id('video');
    videos.push(videoId);
    const p = publicationSchema.parse({
      id: id('pub'),
      videoId,
      sequenceId: id('seq'),
      projectId: null,
      videoName: name,
      label: name,
      copy: copies[i] ?? { title: name, description: '', hashtags: [] },
      scheduledAt: times[i] ?? null,
      timezone: tz,
      destinations: accounts.map((a) => publicationDestinationSchema.parse({ id: id('pdest'), accountId: a.id, format: formats[a.network] })),
      revision: 3,
      createdAt: stamp,
      updatedAt: stamp,
    });
    doc.publications.push(p);
    pubs.push({ id: p.id, revision: p.revision });
  });
  writeFileSync(storeFile, JSON.stringify(doc, null, 2), { mode: 0o600 });
}

// ---- 3. Delivery states only the owner can reach (Runtime stopped) ----
stop();
const doc = JSON.parse(readFileSync(storeFile, 'utf8'));
const pub = (i) => doc.publications.find((p) => p.id === pubs[i].id);
const exportId = `sha256:${'0'.repeat(64)}`;
const payloadOf = (p, d) => {
  const a = accounts.find((x) => x.id === d.accountId);
  return {
    exportId,
    accountId: a.id,
    connectionId: connection.id,
    remoteAccountId: a.remoteId,
    network: a.network,
    format: d.format,
    title: p.copy.title,
    caption: [p.copy.description, p.copy.hashtags.map((h) => `#${h}`).join(' ')].filter(Boolean).join('\n\n'),
    hashtags: p.copy.hashtags,
    options: d.options,
    scheduledAt: d.scheduledAt ?? p.scheduledAt,
    timezone: p.timezone,
  };
};
// "Three editing tips": sent by hand, due now -> Waiting for you + attention bar; Instagram already recorded as published.
{
  const p = pub(0);
  for (const d of p.destinations) {
    d.payload = payloadOf(p, d);
    d.payloadHash = randomBytes(32).toString('hex');
    d.state = 'queued';
  }
  const ig = p.destinations.find((d) => d.accountId === instagram.id);
  if (ig) {
    ig.state = 'published';
    ig.publishedAt = p.scheduledAt;
    ig.remoteUrl = 'https://www.instagram.com/';
    ig.verification = { state: 'published', note: 'Saw the reel live on the profile grid.', by: 'qc-seed', at: iso(now) };
  }
  p.revision += 1;
  p.updatedAt = iso(now);
}
writeFileSync(storeFile, JSON.stringify(doc, null, 2), { mode: 0o600 });
cli('runtime', 'ensure');

console.log(JSON.stringify({ home, project, timezone: tz, videos, publications: pubs.map((p) => p.id), open: pubs[0].id, editable: pubs[1].id }, null, 2));
