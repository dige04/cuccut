import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { MCP_INTERFACE_VERSION, type Project } from '@cuccut/protocol';
import { CucCutClient } from '@cuccut/client';
import { resolveEngineHostCommand } from '../../../packages/runtime-core/src/videos/engine-host.ts';
import { startRuntime, type RunningRuntime } from '../../../packages/runtime-core/src/runtime.ts';
import { isProcessAlive } from './runtime/connection.ts';

/**
 * End-to-end: runs the CLI as a child process (`node apps/cli/src/main.ts`) against a real Runtime in an isolated CUCCUT_HOME.
 * Output is not a terminal, so the default is the JSON envelope; asserts the envelope, exit codes and files written to disk. Requires engine-host and ffmpeg; skipped if they are missing.
 */

const MAIN = fileURLToPath(new URL('./main.ts', import.meta.url));
const REPO_RUNTIME = fileURLToPath(new URL('../../runtime/src/main.ts', import.meta.url));

const engine = resolveEngineHostCommand();
const ffmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

interface Ran {
  code: number;
  stdout: string;
  stderr: string;
  json: Record<string, any>;
}

function cli(args: string[], options: { cwd: string; home: string; env?: Record<string, string>; input?: string }): Promise<Ran> {
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [MAIN, ...args],
      {
        cwd: options.cwd,
        env: { ...process.env, CUCCUT_HOME: options.home, CUCCUT_LOCALE: 'en', ...options.env },
        maxBuffer: 16 * 1024 * 1024,
        timeout: 120_000,
      },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
        let json: Record<string, any> = {};
        try {
          json = JSON.parse(stdout);
        } catch {
          // Non-JSON output (help text) is checked by each case itself.
        }
        resolve({ code, stdout, stderr, json });
      },
    );
    child.stdin?.end(options.input ?? '');
  });
}

describe.skipIf(!engine || !ffmpeg)('CLI subprocess (real Runtime)', () => {
  let dir: string;
  let fixtures: string;
  let clip: string;
  let movie: string;
  let runtime: RunningRuntime;
  let project: Project;
  let videoId: string;
  let videoPath: string;
  let revision: string;

  beforeAll(async () => {
    dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-cli-e2e-')));
    fixtures = path.join(dir, 'fixtures');
    await fs.mkdir(fixtures);
    clip = path.join(fixtures, 'clip.wav');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', clip]);
    movie = path.join(fixtures, 'movie.mp4');
    execFileSync('ffmpeg', [
      ...['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=30:duration=1'],
      ...['-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:v', 'mpeg4', '-c:a', 'aac', '-shortest', movie],
    ]);
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: dir }),
      drivers: () => [],
      watchSpace: false,
      engineHost: engine,
      videoGraceMs: 100,
    });
    const { endpoint, token } = runtime.discovery;
    const client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'cli', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
    ({ project } = await client.request('projects.create', { name: 'CLI e2e' }));
    client.close();
  }, 60_000);

  afterAll(async () => {
    await runtime?.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const run = (args: string[], input?: string) => cli(args, { cwd: project.path, home: dir, input });

  it('--help fits one screen, spec is JSON with the interface version', async () => {
    const help = await run(['--help']);
    expect(help.code).toBe(0);
    expect(help.stdout.trimEnd().split('\n').length).toBeLessThanOrEqual(40);
    const spec = await run(['spec']);
    expect(spec.code).toBe(0);
    expect(spec.json.interfaceVersion).toBe(MCP_INTERFACE_VERSION);
    expect(spec.json.tools.some((tool: { name: string }) => tool.name === 'videos_create')).toBe(true);
  });

  it('status defaults to a summary, --full includes each service\'s models; unknown argument exit code 4', async () => {
    const summary = await run(['status']);
    expect(summary.code, summary.stdout + summary.stderr).toBe(0);
    const capabilities = summary.json.result.capabilities.capabilities;
    expect(capabilities.length).toBeGreaterThan(0);
    for (const c of capabilities) {
      expect(Object.keys(c).sort()).toEqual(['capability', 'default', 'effective', 'next', 'providerCount', 'usableProviders']);
    }
    expect(summary.json.next).toContain('cuccut status --full');
    const full = await run(['status', '--full']);
    expect(full.code).toBe(0);
    expect(full.json.result.capabilities.capabilities.every((c: { providers: unknown[] }) => Array.isArray(c.providers))).toBe(true);
    expect(full.json.result.runtime).toMatchObject({ running: true });
    expect(full.stdout.length).toBeGreaterThan(summary.stdout.length);
    expect((await run(['status', '--bogus'])).code).toBe(4);
  });

  it('videos create builds in the project containing cwd', async () => {
    const created = await run(['videos', 'create', 'CLI 样片']);
    expect(created.code, created.stdout + created.stderr).toBe(0);
    expect(created.json.ok).toBe(true);
    videoId = created.json.result.videoId;
    videoPath = created.json.result.video;
    revision = created.json.result.revision;
    expect(videoId).toMatch(/^video_/);
    expect((await fs.stat(path.join(project.path, videoPath, 'video.db'))).isFile()).toBe(true);
  });

  it('videos inspect: a positional argument works the same as --video', async () => {
    const positional = await run(['videos', 'inspect', videoId]);
    const flagged = await run(['videos', 'inspect', '--video', videoPath]);
    for (const ran of [positional, flagged]) {
      expect(ran.code, ran.stdout).toBe(0);
      expect(ran.json.result).toMatchObject({ videoId, name: 'CLI 样片' });
    }
    // Giving both is a usage error.
    const both = await run(['videos', 'inspect', videoId, '--video', videoId]);
    expect(both.code).toBe(4);
    expect(both.json.error.code).toBe('INVALID_ARGUMENTS');
  });

  it('edits apply --dry-run only checks, does not write', async () => {
    const operations = JSON.stringify([
      { type: 'importAsset', path: clip, name: '片段', ref: 'a' },
      { type: 'addItem', asset: { ref: 'a' } },
    ]);
    const dry = await run(
      ['edits', 'apply', videoId, '--expected-revision', revision, '--label', '导入', '--operations', '-', '--dry-run'],
      operations,
    );
    expect(dry.code, dry.stdout + dry.stderr).toBe(0);
    expect(dry.json.result.dryRun).toBe(true);
    const after = await run(['videos', 'inspect', videoId]);
    expect(after.json.result.revision).toBe(revision);
    expect(after.json.result.assets ?? []).toEqual([]);
  });

  it('documents read --max-bytes 1024: the result is written to .cuccut-out/', async () => {
    const body = JSON.stringify({ text: '这是一段足够长的笔记。'.repeat(200) });
    const put = await run(['documents', 'put', videoId, '--kind', 'notes', '--body', '-'], body);
    expect(put.code, put.stdout + put.stderr).toBe(0);
    const documentId = put.json.result.documentId;
    expect(typeof documentId).toBe('string');

    const read = await run(['documents', 'read', videoId, '--document-id', documentId, '--max-bytes', '1024']);
    expect(read.code, read.stdout).toBe(0);
    expect(read.json.result.truncated).toBe(true);
    const spilled = read.json.result.path as string;
    expect(path.dirname(spilled)).toBe(path.join(project.path, '.cuccut-out'));
    const full = JSON.parse(await fs.readFile(spilled, 'utf8'));
    expect(JSON.stringify(full)).toContain('足够长的笔记');
    expect(read.stdout.length).toBeLessThan(4096);
  });

  it('videos delete without --yes: exit code 4, does not delete', async () => {
    const refused = await run(['videos', 'delete', videoId]);
    expect(refused.code).toBe(4);
    expect(refused.json.error.code).toBe('CONFIRMATION_REQUIRED');
    expect(refused.json.error.next).toContain('--yes');
    expect((await fs.stat(path.join(project.path, videoPath, 'video.db'))).isFile()).toBe(true);
  });

  it('transcribe --file … --no-wait: returns on submit', async () => {
    const ran = await run(['transcribe', '--file', clip, '--no-video', '--no-wait']);
    // This test Runtime has no transcription capability configured: either submission succeeds and returns a jobId, or it reports before submission that configuration is needed (exit code 2).
    if (ran.code === 0) {
      expect(ran.json.result.jobId).toMatch(/^job_/);
    } else {
      expect(ran.code, ran.stdout + ran.stderr).toBe(2);
      expect(ran.json.error.code).toBe('CAPABILITY_NOT_CONFIGURED');
    }
  });

  it('transcode: --no-wait returns jobId; by default waits until completion and includes the outputs', async () => {
    const submitted = await run(['transcode', movie, '--extract-audio', '--out-dir', path.join(dir, 'out-a'), '--no-wait']);
    expect(submitted.code, submitted.stdout + submitted.stderr).toBe(0);
    expect(submitted.json.result.jobId).toMatch(/^job_/);
    expect(submitted.json.result.job).toBeUndefined();

    const waited = await run(['transcode', movie, '--extract-audio', '--out-dir', path.join(dir, 'out-b')]);
    expect(waited.code, waited.stdout + waited.stderr).toBe(0);
    expect(waited.json.result.job.state).toBe('completed');
    expect((await fs.readdir(path.join(dir, 'out-b'))).length).toBeGreaterThan(0);
  });

  it('unknown argument exit code 4', async () => {
    const ran = await run(['videos', 'inspect', videoId, '--no-such-flag']);
    expect(ran.code).toBe(4);
    expect(ran.json.error.code).toBe('INVALID_ARGUMENTS');
  });

  it('admin bucket: envelope and exit codes match the derived commands; the remaining subcommands of some nouns are handed to derived commands', async () => {
    const dir = await run(['models', 'dir']);
    expect(dir.code, dir.stdout + dir.stderr).toBe(0);
    expect(dir.json.ok).toBe(true);
    expect(typeof dir.json.result.path).toBe('string');

    const settings = await run(['settings']);
    expect(settings.code, settings.stdout + settings.stderr).toBe(0);
    expect(settings.json.ok).toBe(true);

    // `jobs list` is a derived command; `jobs resources` is an admin command.
    const jobs = await run(['jobs', 'list']);
    expect(jobs.code, jobs.stdout + jobs.stderr).toBe(0);
    const resources = await run(['jobs', 'resources']);
    expect(resources.code, resources.stdout + resources.stderr).toBe(0);
    expect(resources.json.ok).toBe(true);

    for (const args of [['chat'], ['text'], ['models', 'configure'], ['settings', '--no-such-flag']]) {
      const ran = await run(args);
      expect(ran.code, args.join(' ')).toBe(4);
      expect(ran.json.error.code).toBe('INVALID_ARGUMENTS');
    }

    const usage = await run(['help', 'settings']);
    expect(usage.code).toBe(0);
    expect(usage.stdout).toContain('cuccut settings');
  }, 60_000);

  it('profile: answers, interview write (no agent: kept as typed), preferences from a file, rules list / disable / move / remove, show', async () => {
    const answered = await run(['profile', 'answers', 'set', 'who', 'Coding', 'tutorials']);
    expect(answered.code, answered.stdout + answered.stderr).toBe(0);
    expect(answered.json.result.answers).toEqual({ who: 'Coding tutorials' });
    expect((await run(['profile', 'answers', 'set', 'mood', 'x'])).code).toBe(4);

    const written = await run(['profile', 'interview', 'write']);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    expect(written.json.result).toMatchObject({ usedAgent: false, fallbackReason: 'no-agent', names: [] });
    expect(written.json.result.preferences).toContain('Coding tutorials');

    const file = path.join(dir, 'prefs.md');
    await fs.writeFile(file, '- Hooks under three seconds\n');
    const prefs = await run(['profile', 'preferences', '--file', file]);
    expect(prefs.code, prefs.stdout + prefs.stderr).toBe(0);
    expect(prefs.json.result.preferences.own).toBe('- Hooks under three seconds\n');
    expect((await run(['profile', 'preferences'])).code).toBe(4);
    const projectPrefs = await run(['profile', 'preferences', '--project', project.id, '--file', '-'], '- Vertical 9:16');
    expect(projectPrefs.code, projectPrefs.stdout + projectPrefs.stderr).toBe(0);
    expect(projectPrefs.json.result.preferences).toBe('- Vertical 9:16');

    // Rules are made in the desktop UI or by the agent; the CLI lists and manages them.
    const { endpoint, token } = runtime.discovery;
    const client = new CucCutClient({ resolve: async () => ({ endpoint, token }), client: { kind: 'cli', name: 'test', version: '0' }, reconnect: false });
    await client.connect();
    const a = (await client.request('profile.putRule', { rule: { name: 'A', when: 'always', instruction: 'Do A.' } })).rule;
    const b = (await client.request('profile.putRule', { rule: { name: 'B', when: 'always', instruction: 'Do B.' } })).rule;
    client.close();

    const listed = await run(['profile', 'rules', 'list']);
    expect(listed.json.result.rules.map((r: { id: string }) => r.id)).toEqual([a.id, b.id]);
    const disabled = await run(['profile', 'rules', 'disable', a.id]);
    expect(disabled.code, disabled.stdout + disabled.stderr).toBe(0);
    expect(disabled.json.result.rule).toMatchObject({ id: a.id, enabled: false, name: 'A' });
    const moved = await run(['profile', 'rules', 'move', b.id, 'up']);
    expect(moved.json.result.rules.map((r: { id: string }) => r.id)).toEqual([b.id, a.id]);
    const removed = await run(['profile', 'rules', 'remove', a.id]);
    expect(removed.json.result.removed.id).toBe(a.id);
    expect((await run(['profile', 'rules', 'enable', a.id])).code).toBe(4);

    // show is the profile_show view, with the project of the current folder.
    const shown = await run(['profile', 'show']);
    expect(shown.code, shown.stdout + shown.stderr).toBe(0);
    expect(shown.json.result.interview.status).toBe('done');
    expect(shown.json.result.preferences).toMatchObject({ general: '- Hooks under three seconds\n', project: '- Vertical 9:16' });
    expect(shown.json.result.rules.workspace.map((r: { id: string }) => r.id)).toEqual([b.id]);
    expect(shown.json.result.project).toEqual({ projectId: project.id, name: 'CLI e2e' });
    const human = await run(['profile', 'show', '--no-json']);
    expect(human.stdout).toContain('Hooks under three seconds');
  }, 60_000);
});

describe('runtime ensure / stop (isolated CUCCUT_HOME, launched from the repo entry)', () => {
  let home: string;
  let pid: number | null = null;

  beforeAll(async () => {
    home = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-cli-runtime-')));
  });

  afterAll(async () => {
    if (pid && isProcessAlive(pid)) process.kill(pid, 'SIGKILL');
    await fs.rm(home, { recursive: true, force: true });
  });

  const run = (args: string[]) => cli(args, { cwd: home, home, env: { CUCCUT_RUNTIME_ENTRY: REPO_RUNTIME } });

  it('ensure starts, a second ensure reuses, stop shuts down', async () => {
    const before = await run(['runtime', 'status']);
    expect(before.json).toMatchObject({ ok: true, result: { running: false }, next: 'cuccut runtime ensure' });

    const started = await run(['runtime', 'ensure']);
    expect(started.code, started.stdout + started.stderr).toBe(0);
    expect(started.json.result).toMatchObject({ status: 'started', launchedBy: 'cli' });
    expect(started.json.runtime).toEqual({ started: true });
    pid = started.json.result.pid;
    expect(isProcessAlive(pid!)).toBe(true);

    const reused = await run(['runtime', 'ensure']);
    expect(reused.json.result).toMatchObject({ status: 'reused', pid });

    const status = await run(['runtime', 'status']);
    expect(status.json.result).toMatchObject({ running: true, pid, launchedBy: 'cli', desktopConnected: false });
    expect(status.json.result.idleExit.minutes).toBe(10);
    // Checking status itself does not reset the idle timer: check again and idleSince does not change.
    expect(status.json.result.idleExit.idleSince).toEqual(expect.any(String));
    const again = await run(['runtime', 'status']);
    expect(again.json.result.idleExit.idleSince).toBe(status.json.result.idleExit.idleSince);

    const stopped = await run(['runtime', 'stop']);
    expect(stopped.code, stopped.stdout + stopped.stderr).toBe(0);
    expect(stopped.json.result).toMatchObject({ stopped: true, pid });
    expect(isProcessAlive(pid!)).toBe(false);
  }, 120_000);
});
