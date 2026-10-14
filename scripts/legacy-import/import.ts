// Imports cuccut-app's `.ccut` projects and external video projects as videos. Usage is in the README.md in the same directory.
//
//   node scripts/legacy-import/import.ts --ccut <legacy-project-dir> --external <external-project-dir> --out <project-folder> [--dry-run] [--replace] [--only <name-fragment>]

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { planBcutProject } from './ccut-project.ts';
import { EngineHost } from './engine-host.ts';
import { planExternalProject } from './external-project.ts';
import { count } from './video-plan.ts';
import type { ProjectPlan, ProjectReport } from './video-plan.ts';
import { IMPORTER, dryAssets, planContent, writeVideo } from './video-writer.ts';

const { values } = parseArgs({
  options: {
    ccut: { type: 'string', multiple: true, default: [] },
    external: { type: 'string', multiple: true, default: [] },
    out: { type: 'string' },
    report: { type: 'string' },
    only: { type: 'string', multiple: true, default: [] },
    'dry-run': { type: 'boolean', default: false },
    replace: { type: 'boolean', default: false },
    engine: { type: 'string' },
    ffprobe: { type: 'string' },
  },
});

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const dryRun = values['dry-run'];
const outRoot = values.out ? path.resolve(values.out) : undefined;
const reportDir = values.report ? path.resolve(values.report) : outRoot;
if (!dryRun && !outRoot) fail('To write videos, pass --out <project-folder>; to only see what would be imported, add --dry-run');
if (!reportDir) fail('Use --report to set where the report goes (a dry run has no --out)');
if (values.ccut.length + values.external.length === 0) fail('Use --ccut <dir> or --external <dir> to name the legacy projects to import');

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

// ── Collection plan ──────────────────────────────────────────────────────────
const taken = new Set<string>();
const plans: ProjectPlan[] = [];
const skipped: string[] = [];
for (const root of values.ccut.map((dir) => path.resolve(dir))) {
  // Can be given a single `.ccut` directory, or a directory containing several of them.
  const dirs = existsSync(path.join(root, 'project.json'))
    ? [root]
    : readdirSync(root)
        .sort((a, b) => a.localeCompare(b))
        .map((entry) => path.join(root, entry));
  for (const dir of dirs) {
    if (path.basename(dir).startsWith('.')) continue;
    const plan = statSync(dir).isDirectory() ? planBcutProject(dir, taken) : null;
    if (plan) plans.push(plan);
    else skipped.push(dir);
  }
}
for (const dir of values.external.map((d) => path.resolve(d))) {
  const plan = planExternalProject(dir, taken);
  if (plan) plans.push(plan);
  else skipped.push(dir);
}
const wanted = values.only.map((text) => text.toLowerCase());
const selected = wanted.length === 0 ? plans : plans.filter((plan) => wanted.some((text) => plan.key.toLowerCase().includes(text)));
if (selected.length === 0) fail('No project selected');

// ── Execution ──────────────────────────────────────────────────────────────
const started = Date.now();
if (dryRun) {
  for (const plan of selected) {
    try {
      const content = planContent(plan, dryAssets(plan));
      // A copy of what each video will write is kept for dry-run, so each can be checked one by one; document bodies keep only a summary.
      const documents = content.documents.map(({ body, ...doc }) => ({ ...doc, bodyBytes: JSON.stringify(body).length }));
      mkdirSync(path.join(reportDir, 'plans'), { recursive: true });
      writeFileSync(path.join(reportDir, 'plans', `${plan.dirName}.json`), `${JSON.stringify({ ...content, documents }, null, 2)}\n`);
    } catch (error) {
      plan.report.failed.push(`Planning failed: ${(error as Error).message}`);
    }
    progress(plan);
  }
} else {
  const engine = values.engine ?? path.join(repoRoot, 'target', 'release', 'engine-host');
  if (!existsSync(engine)) fail(`engine-host not found: ${engine}\nRun cargo build --release -p engine-host first`);
  const ffprobe = values.ffprobe ?? process.env.CUCCUT_FFPROBE ?? execFileSync('which', ['ffprobe'], { encoding: 'utf8' }).trim();
  mkdirSync(outRoot as string, { recursive: true });
  const host = new EngineHost(engine, ffprobe);
  await host.request('host.hello', {});
  for (const plan of selected) {
    try {
      await writeVideo(host, plan, outRoot as string, values.replace);
    } catch (error) {
      plan.report.failed.push(`Import interrupted: ${(error as Error).message}`);
    }
    progress(plan);
  }
  host.close();
}

function progress(plan: ProjectPlan): void {
  const r = plan.report;
  const items = Object.values(r.items).reduce((a, b) => a + b, 0);
  const flags = [
    r.assets.missing.length ? `missing ${r.assets.missing.length} asset(s)` : '',
    r.failed.length ? `failed ${r.failed.length}` : '',
  ].filter(Boolean);
  process.stderr.write(`${r.failed.length ? '✗' : '✓'} ${plan.key} · ${r.kind} · ${items} instance(s) ${flags.join(' · ')}\n`);
}

// ── Report ──────────────────────────────────────────────────────────────
const reports = selected.map((plan) => plan.report);
const suffix = dryRun ? '.dry-run' : '';
mkdirSync(reportDir, { recursive: true });
const summary = {
  importer: IMPORTER,
  mode: dryRun ? 'dry-run' : 'import',
  generatedAt: new Date().toISOString(),
  elapsedSeconds: Math.round((Date.now() - started) / 1000),
  sources: { ccut: values.ccut, external: values.external },
  out: outRoot ?? null,
  skipped,
  projects: reports,
};
writeFileSync(path.join(reportDir, `import-report${suffix}.json`), `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(path.join(reportDir, `import-report${suffix}.md`), markdown(reports));
process.stderr.write(`Report: ${path.join(reportDir, `import-report${suffix}.md`)}\n`);
if (reports.some((r) => r.failed.length > 0)) process.exitCode = 1;

function markdown(all: ProjectReport[]): string {
  const total = (pick: (r: ProjectReport) => Record<string, number>): Record<string, number> => {
    const sum: Record<string, number> = {};
    for (const r of all) for (const [key, n] of Object.entries(pick(r))) count(sum, key, n);
    return sum;
  };
  const list = (table: Record<string, number>): string =>
    Object.entries(table)
      .sort((a, b) => b[1] - a[1])
      .map(([key, n]) => `${key} ${n}`)
      .join(', ') || 'none';
  const sum = (pick: (r: ProjectReport) => number): number => all.reduce((n, r) => n + pick(r), 0);
  const kinds: Record<string, number> = {};
  for (const r of all) count(kinds, r.kind);
  const fpsText = (r: ProjectReport): string => (r.fps.rate.den === 1 ? String(r.fps.rate.num) : `${r.fps.rate.num}/${r.fps.rate.den}`);
  const seconds = (r: ProjectReport): string =>
    r.durationFrames == null ? '—' : `${((r.durationFrames * r.fps.rate.den) / r.fps.rate.num).toFixed(1)}s`;
  const cell = (text: string): string => text.replaceAll('|', '\\|');

  const lines: string[] = [];
  lines.push(`# Legacy project import report${dryRun ? ' (dry run, no videos written)' : ''}`, '');
  lines.push(`- Generated: ${summary.generatedAt}; importer ${IMPORTER.name} v${IMPORTER.version}`);
  if (outRoot) lines.push(`- Project folder: \`${outRoot}\``);
  lines.push(`- Projects: ${all.length} (${list(kinds)}); with failures: ${all.filter((r) => r.failed.length > 0).length}`);
  lines.push(
    `- Assets: ${sum((r) => r.assets.linked)} registered (all linked by original path), ${sum((r) => r.assets.reused)} reused for identical content, ` +
      `${sum((r) => r.assets.missing.length)} file(s) not found, ${sum((r) => r.assets.hashChanged.length)} with content differing from the digest recorded in the legacy project`,
  );
  lines.push(`- Documents: ${list(total((r) => r.documents))}`);
  lines.push(`- Instances: ${list(total((r) => r.items))}; ${sum((r) => r.tracks)} track(s)`);
  lines.push(
    `- Timing: max frame-snap offset ${Math.max(0, ...all.map((r) => r.time.maxSnapMs)).toFixed(2)} ms; ${sum((r) => r.time.clampedTails)} tail(s) clamped to asset length`,
  );
  lines.push(`- Objects written to the sequence: ${list(total((r) => r.written))}`);
  lines.push(
    `- Word anchors: ${sum((r) => r.anchors.resolved)} element(s) resolved (written as speech-anchor), ${sum((r) => r.anchors.unresolved)} unresolved (not imported)`,
  );
  lines.push(`- One-sided transitions shorter than written: ${sum((r) => r.shortenedTransitions.length)}`);
  lines.push(`- Out-of-range values clamped: ${list(total((r) => r.clamped))}`);
  lines.push(`- Not accepted by the new format, not carried over: ${list(total((r) => r.dropped))}`);
  lines.push(`- No matching field, kept as-is in extensions: ${list(total((r) => r.unmapped))}`);
  lines.push(`- Not applicable (no equivalent in the new format; reason given in the key): ${list(total((r) => r.notApplicable))}`);
  lines.push(`- Estimated on import: ${list(total((r) => r.estimated))}`, '');

  lines.push(
    '## Per project',
    '',
    '| Project | Kind | FPS | Canvas | Assets | Docs | Items | Duration | Notes | Failed |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const r of all) {
    const assets = `${r.assets.linked + r.assets.reused}${r.assets.missing.length ? ` (missing ${r.assets.missing.length})` : ''}`;
    const docs = Object.values(r.documents).reduce((a, b) => a + b, 0);
    const items = Object.values(r.items).reduce((a, b) => a + b, 0);
    lines.push(
      `| ${cell(path.basename(r.source))} | ${r.kind} | ${fpsText(r)} | ${r.canvas.width}×${r.canvas.height} | ${assets} | ${docs} | ${items} | ${seconds(r)} | ${r.warnings.length} | ${r.failed.length} |`,
    );
  }
  lines.push('');

  const noted = all.filter(
    (r) =>
      r.failed.length + r.warnings.length + r.shortenedTransitions.length + r.assets.missing.length + r.assets.hashChanged.length > 0 ||
      r.fps.note ||
      r.canvas.note,
  );
  if (noted.length > 0) lines.push('## Projects to review', '');
  for (const r of noted) {
    lines.push(`### ${path.basename(r.source)}`, '');
    if (r.fps.note) lines.push(`- FPS: ${r.fps.note} (legacy value ${r.fps.legacy ?? 'none'})`);
    if (r.canvas.note) lines.push(`- Canvas: ${r.canvas.note}`);
    for (const text of r.failed) lines.push(`- **Failed**: ${text}`);
    for (const file of r.assets.missing) lines.push(`- Asset file not found: \`${file}\``);
    for (const file of r.assets.hashChanged) lines.push(`- File content differs from the digest recorded in the legacy project: \`${file}\``);
    for (const t of r.shortenedTransitions)
      lines.push(`- Instance ${t.sourceId} ${t.side} transition written as ${t.durationFrames} frame(s); instance too short, effective ${t.effectiveFrames} frame(s)`);
    for (const text of r.warnings) lines.push(`- ${text}`);
    lines.push('');
  }

  const left: Record<string, number> = {};
  for (const r of all) for (const text of r.notImported) count(left, text);
  if (Object.keys(left).length > 0) {
    lines.push('## Legacy data not imported', '');
    for (const [text, n] of Object.entries(left).sort((a, b) => b[1] - a[1])) lines.push(`- ${text} (${n} project(s))`);
    lines.push('');
  }
  if (skipped.length > 0) {
    lines.push('## Skipped entries (not projects)', '');
    for (const dir of skipped) lines.push(`- \`${dir}\``);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}
