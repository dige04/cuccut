import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import type { JobRecord, ResourceCapacity } from '@cuccut/protocol';
import { ModelCatalog } from '@cuccut/models';
import { JobManager, ResourceScheduler, type CapacitySource, type JobVideos } from '@cuccut/jobs';
import { runWorker } from './video-export.ts';

/**
 * The lease for finished-video export and the Worker's process group (architecture design §7.7): when the Worker exits abnormally or is canceled, the Runtime kills its whole process group,
 * and the task does not end, nor the lease get returned, until the processes in the group have actually all exited. Uses a fake Worker (a Node script) and the fake ffmpeg it starts (ignores SIGTERM, and its stdin/stdout are not connected to the Worker's pipes); no real rendering is done. The `kill(-pgid, 0)` probe can be blocked by a "gate", which pretends the group still has processes:
 * while the gate is closed the lease must still be held; once it opens, the lease is returned, and at the moment it is returned the group has no processes left. Runs only on systems with process groups.
 */

const GiB = 1024 * 1024 * 1024;
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'interrupted']);

/** Fake Worker: starts a fake ffmpeg in the same group, atomically writes both pids into `<input>.pids`, and reports progress once; on receiving `cancel` it reports the cancellation and exits, without managing ffmpeg. */
const FAKE_WORKER = `
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const input = process.argv[3];
const ffmpeg = spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'], { stdio: 'ignore' });
fs.writeFileSync(input + '.pids.tmp', JSON.stringify({ worker: process.pid, ffmpeg: ffmpeg.pid }));
fs.renameSync(input + '.pids.tmp', input + '.pids');
process.stdout.write(JSON.stringify({ event: 'progress', frame: 1, total: 100 }) + '\\n');
let text = '';
process.stdin.setEncoding('utf8').on('data', (chunk) => {
  text += chunk;
  if (text.includes('cancel')) {
    process.stdout.write(JSON.stringify({ event: 'cancelled', frame: 1, total: 100 }) + '\\n', () => process.exit(0));
  }
});
setInterval(() => {}, 1000);
`;

class FixedCapacity implements CapacitySource {
  current(): ResourceCapacity {
    return {
      memory: 8 * GiB,
      gpuMemory: null,
      cpuThreads: 8,
      scratchDisk: null,
      unifiedMemory: false,
      sources: { memory: 'setting', gpuMemory: 'unknown', cpuThreads: 'setting', scratchDisk: 'unknown' },
    };
  }
}

const realKill = process.kill.bind(process);

function alive(pid: number): boolean {
  try {
    realKill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function until<T>(read: () => T | null | undefined | false | Promise<T | null | undefined | false>, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('等待超时');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe.skipIf(process.platform === 'win32')('成片导出：进程组退出之后才归还租约', () => {
  let dir: string;
  let workerScript: string;
  let scheduler: ResourceScheduler;
  let jobs: JobManager;
  /** While the gate is closed, `kill(-pgid, 0)` always counts as the group still having processes. */
  let gated: boolean;
  /** The number of probes blocked while the gate was closed. */
  let probesBlocked: number;
  /** Each time the lease is returned: whether the gate is closed, and whether the Worker's process group still has processes. */
  let releases: Array<{ gated: boolean; groupAlive: boolean }>;
  let pids: { worker: number; ffmpeg: number } | null;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-export-lease-'));
    // The Worker is started as an executable (`runWorker` passes only the two arguments `render <input>`): a wrapper that execs into node, so the pid is unchanged.
    const script = path.join(dir, 'fake-export-worker.cjs');
    await fs.writeFile(script, FAKE_WORKER);
    workerScript = path.join(dir, 'fake-export-worker');
    await fs.writeFile(workerScript, `#!/bin/sh\nexec '${process.execPath}' '${script}' "$@"\n`, { mode: 0o755 });
    gated = true;
    probesBlocked = 0;
    releases = [];
    pids = null;
    vi.spyOn(process, 'kill').mockImplementation(((pid: number, signal?: string | number) => {
      if (pid < 0 && signal === 0 && gated) {
        probesBlocked++;
        return true;
      }
      return realKill(pid, signal);
    }) as typeof process.kill);

    scheduler = new ResourceScheduler({
      capacity: new FixedCapacity(),
      reserves: () => ({
        system: { memory: 0, gpuMemory: null, cpuThreads: 0, scratchDisk: null },
        interactive: { memory: 0, gpuMemory: null, cpuThreads: 0, scratchDisk: null },
      }),
    });
    // Records the moment each lease return happens.
    const request = scheduler.request.bind(scheduler);
    scheduler.request = (req, handlers) =>
      request(req, {
        ...handlers,
        admit: (lease) =>
          handlers.admit({
            leaseId: lease.leaseId,
            release: () => {
              releases.push({ gated, groupAlive: pids !== null && alive(-pids.worker) });
              lease.release();
            },
          }),
      });
    const videos: JobVideos = {
      retain: () => {},
      release: () => {},
      source: async () => {
        throw new Error('不读素材');
      },
      current: () => null,
      videoRevision: () => null,
      apply: async () => ({}),
    };
    jobs = new JobManager({
      paths: {
        jobsFile: path.join(dir, 'store', 'jobs.jsonl'),
        stagingDir: path.join(dir, 'staging'),
        artifactsDir: path.join(dir, 'artifacts'),
        diagnosticsDir: path.join(dir, 'logs', 'diagnostics'),
      },
      catalog: new ModelCatalog({ root: path.join(dir, 'models'), bundles: [] }),
      router: {
        selectTranscribe: async () => {
          throw new Error('不转写');
        },
        transcriber: () => null,
        executors: () => [],
      },
      videos,
      resources: scheduler,
    });
    await jobs.open();
  });

  afterEach(async () => {
    gated = false;
    vi.restoreAllMocks();
    await jobs.shutdown();
    await fs.rm(dir, { recursive: true, force: true });
  });

  /** The same wiring as the export service: a task with resource requirements, inside which the Worker's `render` runs once. */
  async function startRender(): Promise<{ jobId: string; pids: { worker: number; ffmpeg: number } }> {
    const input = path.join(dir, `render-${crypto.randomBytes(4).toString('hex')}.json`);
    await fs.writeFile(input, '{}');
    const { jobId } = jobs.submitTask(
      {
        kind: 'export',
        spec: { task: 'export', snapshotArtifactId: 'sha256:' + '0'.repeat(64) },
        videoId: null,
        contentHash: 'sha256:' + '1'.repeat(64),
        inputHash: 'sha256:' + crypto.randomBytes(32).toString('hex'),
        providerId: 'local',
        modelId: 'export:video',
        queue: { key: 'export', concurrency: 2 },
        resources: { demand: { memory: 1 * GiB, cpuThreads: 2 } },
        run: async ({ signal }) => {
          await runWorker({ command: workerScript }, 'render', input, { signal });
          return { documentId: null, artifactId: 'sha256:' + '2'.repeat(64) };
        },
      },
      { kind: 'connection', id: 'conn_1' },
    );
    const read = await until(async () => {
      const text = await fs.readFile(`${input}.pids`, 'utf8').catch(() => '');
      return text ? (JSON.parse(text) as { worker: number; ffmpeg: number }) : null;
    });
    pids = read;
    onTestFinished(() => {
      for (const pid of [read.ffmpeg, read.worker]) if (alive(pid)) realKill(pid, 'SIGKILL');
    });
    expect(scheduler.snapshot().leases).toHaveLength(1);
    return { jobId, pids: read };
  }

  const record = (jobId: string): JobRecord => jobs.inspect(jobId);

  /** Gate closed: the group has been killed, but the probe says it is still there, so the task has not ended and the lease is still held. After the gate opens, the task ends, and the lease is returned once the group has actually exited. */
  async function expectLeaseHeldUntilGroupGone(jobId: string, worker: { worker: number; ffmpeg: number }): Promise<JobRecord> {
    await until(() => probesBlocked > 0);
    // The Runtime has already force-killed the whole group: the fake ffmpeg ignores SIGTERM, so only SIGKILL can stop it.
    await until(() => !alive(worker.ffmpeg) && !alive(worker.worker), 3_000);
    expect(TERMINAL.has(record(jobId).state)).toBe(false);
    expect(scheduler.snapshot().leases).toHaveLength(1);
    expect(releases).toEqual([]);
    gated = false;
    const done = await until(() => TERMINAL.has(record(jobId).state) && record(jobId));
    await until(() => scheduler.snapshot().leases.length === 0);
    expect(releases).toEqual([{ gated: false, groupAlive: false }]);
    expect(scheduler.outstanding).toBe(0);
    return done;
  }

  it('Worker 被强杀：任务失败；它留下的 ffmpeg 随组被杀掉，组退出之后才归还租约', async () => {
    const { jobId, pids: started } = await startRender();
    realKill(started.worker, 'SIGKILL');
    const done = await expectLeaseHeldUntilGroupGone(jobId, started);
    expect(done.state).toBe('failed');
  });

  it('取消：Worker 自己退出但没停下 ffmpeg；组被杀掉、退出之后才归还租约', async () => {
    const { jobId, pids: started } = await startRender();
    // Do not wait for `cancel` to take effect: it waits for the task to end, and the task waits for the gate to open.
    const cancelled = jobs.cancel(jobId);
    const done = await expectLeaseHeldUntilGroupGone(jobId, started);
    expect(done.state).toBe('cancelled');
    expect(await cancelled).toEqual({ state: 'cancelled' });
  });
});
