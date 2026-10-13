import { PassThrough } from 'node:stream';
import type { CucCutClient } from '@cuccut/client';
import type { CatalogCallResult, JobRecord, JobsEvent, JobsSnapshot } from '@cuccut/protocol';
import { Output } from '../envelope.ts';

/**
 * Test stand-in for `CucCutClient`: only the few members the CLI's task and tool-calling code uses (`request`, `subscribeJobs`, `onState`, `state`). Gateway methods and catalog tools each get their handler by name; snapshots and events for the `jobs` topic are pushed by the test cases.
 */
export class FakeClient {
  state: { status: string; reason?: string } = { status: 'connected' };
  readonly calls: { method: string; params: Record<string, unknown> }[] = [];
  readonly methods: Record<string, (params: Record<string, unknown>) => unknown> = {};
  readonly tools: Record<string, (args: Record<string, unknown>) => CatalogCallResult> = {};
  #jobs: { snapshot: (snapshot: JobsSnapshot) => void; event: (event: JobsEvent) => void } | null = null;
  readonly #stateListeners = new Set<(state: { status: string; reason?: string }) => void>();

  get client(): CucCutClient {
    return this as unknown as CucCutClient;
  }

  async request(method: string, params: Record<string, unknown>): Promise<unknown> {
    this.calls.push({ method, params });
    if (method === 'catalog.call') {
      const tool = this.tools[params.name as string];
      if (!tool) throw new Error(`没有准备工具 ${String(params.name)}`);
      return tool((params.args ?? {}) as Record<string, unknown>);
    }
    const handler = this.methods[method];
    if (!handler) throw new Error(`没有准备方法 ${method}`);
    return handler(params);
  }

  /** Names of the tools called (`catalog.call`). */
  toolCalls(): string[] {
    return this.calls.filter((call) => call.method === 'catalog.call').map((call) => call.params.name as string);
  }

  subscribeJobs(handlers: { snapshot: (snapshot: JobsSnapshot) => void; event: (event: JobsEvent) => void }): () => void {
    this.#jobs = handlers;
    return () => {
      this.#jobs = null;
    };
  }

  onState(listener: (state: { status: string; reason?: string }) => void): () => void {
    this.#stateListeners.add(listener);
    return () => this.#stateListeners.delete(listener);
  }

  get subscribed(): boolean {
    return this.#jobs !== null;
  }

  snapshot(jobs: JobRecord[]): void {
    this.#jobs?.snapshot({ jobs });
  }

  emit(job: JobRecord): void {
    this.#jobs?.event({ type: 'job.updated', job });
  }

  disconnect(reason = '测试断开'): void {
    this.state = { status: 'disconnected', reason };
    for (const listener of this.#stateListeners) listener(this.state);
  }
}

/** One task record: only the fields the CLI reads are filled in; the rest are given empty values. */
export function jobRecord(partial: Partial<JobRecord> & { jobId: string }): JobRecord {
  return {
    kind: 'pipeline',
    state: 'running',
    phase: 'running',
    progress: null,
    videoId: null,
    assetId: null,
    assetRevision: null,
    contentHash: 'sha256:0',
    providerId: 'local',
    modelId: 'm',
    bundleId: null,
    inputHash: 'sha256:0',
    submitter: { kind: 'connection', id: 'c' },
    attempt: 1,
    createdAt: '2026-10-06T00:00:00.000Z',
    updatedAt: '2026-10-06T00:00:00.000Z',
    startedAt: null,
    endedAt: null,
    error: null,
    result: null,
    warnings: [],
    ...partial,
  } as JobRecord;
}

/** Collects the stdout / stderr output (a JSON envelope or human-readable text). */
export function captureOutput(json = true) {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let out = '';
  let err = '';
  stdout.on('data', (chunk) => (out += String(chunk)));
  stderr.on('data', (chunk) => (err += String(chunk)));
  return {
    output: new Output({ json, stdout, stderr }),
    stdout,
    stderr,
    out: () => out,
    err: () => err,
    /** The last JSON envelope on stdout. */
    envelope: () => JSON.parse(out.trim().split('\n').at(-1) ?? '{}') as Record<string, any>,
  };
}
