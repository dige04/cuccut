import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApplicationLedger, type StoredApplication } from './application-ledger.ts';
import { JobLedger, type StoredJob } from './job-ledger.ts';

function job(jobId: string, state = 'queued', extra: Partial<StoredJob> = {}): StoredJob {
  return {
    record: { jobId, state, updatedAt: '2026-01-01T00:00:00.000Z' } as unknown as StoredJob['record'],
    spec: { hosted: 'test' },
    workerVersion: null,
    ...extra,
  };
}

function application(applicationId: string, jobId: string, state = 'pending'): StoredApplication {
  return {
    record: { applicationId, jobId, state } as unknown as StoredApplication['record'],
    place: null,
    submissions: 0,
  };
}

async function lines(file: string): Promise<Record<string, unknown>[]> {
  const text = await fs.readFile(file, 'utf8');
  return text
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('JobLedger (JSONL)', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-job-ledger-'));
    file = path.join(dir, 'store', 'jobs.jsonl');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('appends only changed and deleted tasks; replay matches the last snapshot', async () => {
    const ledger = new JobLedger(file);
    expect(await ledger.load()).toEqual([]);
    const a = job('job_a');
    const b = job('job_b');
    await ledger.save([a, b]);
    a.record.state = 'running';
    await ledger.save([a, b]);
    const c = job('job_c', 'queued', { publishing: { artifactIds: ['sha256:x'], result: {} as never, targetRefs: null, warnings: [] } });
    await ledger.save([a, c]);

    const written = await lines(file);
    expect(written[0]).toEqual({ op: 'header', formatVersion: 2 });
    expect(written.slice(1).map((row) => [row.op, (row.record as { jobId?: string } | undefined)?.jobId ?? row.jobId])).toEqual([
      ['put', 'job_a'],
      ['put', 'job_b'],
      ['put', 'job_a'],
      ['put', 'job_c'],
      ['remove', 'job_b'],
    ]);
    const reloaded = await new JobLedger(file).load();
    expect(reloaded).toEqual(JSON.parse(JSON.stringify([a, c])));
  });

  it('writes nothing when nothing changed', async () => {
    const ledger = new JobLedger(file);
    await ledger.load();
    const a = job('job_a');
    await ledger.save([a]);
    const before = await fs.readFile(file, 'utf8');
    await ledger.save([job('job_a')]);
    await ledger.flush();
    expect(await fs.readFile(file, 'utf8')).toBe(before);

    // Also the same after re-reading: what is read is the baseline for comparison.
    const again = new JobLedger(file);
    await again.save(await again.load());
    expect(await fs.readFile(file, 'utf8')).toBe(before);
  });

  it('takes a snapshot at save time: later changes to the object do not affect queued writes', async () => {
    const ledger = new JobLedger(file);
    await ledger.load();
    const a = job('job_a');
    const saved = ledger.save([a]);
    a.record.state = 'completed';
    await saved;
    expect((await new JobLedger(file).load())[0]!.record.state).toBe('queued');
  });

  it('a truncated partial line at the end is skipped and logged; the next write compacts the whole file, and then all records are read', async () => {
    const warnings: string[] = [];
    const log = { info() {}, warn: (message: string) => void warnings.push(message), error() {} };
    const ledger = new JobLedger(file);
    await ledger.load();
    await ledger.save([job('job_a'), job('job_b')]);
    await fs.appendFile(file, '{"op":"put","record":{"jobId":"job_c"');

    const recovered = new JobLedger(file, { log });
    const jobs = await recovered.load();
    expect(jobs.map((j) => j.record.jobId)).toEqual(['job_a', 'job_b']);
    expect(warnings).toHaveLength(1);
    await recovered.save([...jobs, job('job_d')]);
    const written = await lines(file);
    expect(written).toHaveLength(4);
    expect((await new JobLedger(file).load()).map((j) => j.record.jobId)).toEqual(['job_a', 'job_b', 'job_d']);
  });

  it('compacts when the line count exceeds the threshold: only live records are kept, and the content matches the replay from before compaction', async () => {
    const ledger = new JobLedger(file, { compaction: { ratio: 2, minLines: 4 } });
    await ledger.load();
    const a = job('job_a');
    const b = job('job_b');
    await ledger.save([a, b]); // 2 lines
    a.record.state = 'running';
    await ledger.save([a, b]); // 3 lines
    b.record.state = 'running';
    await ledger.save([a, b]); // 4 lines
    const before = await new JobLedger(file).load();
    a.record.state = 'completed';
    await ledger.save([a, b]); // 5 lines > max(2×2, 4): compact
    const written = await lines(file);
    expect(written).toHaveLength(3);
    expect(written.slice(1).map((row) => (row.record as { state: string }).state)).toEqual(['completed', 'running']);
    expect(await new JobLedger(file).load()).toEqual([{ ...before[0], record: { ...before[0]!.record, state: 'completed' } }, before[1]]);
    expect(await fs.readdir(path.dirname(file))).toEqual(['jobs.jsonl']);
    // Appending continues normally after compaction.
    b.record.state = 'failed';
    await ledger.save([a, b]);
    expect(await lines(file)).toHaveLength(4);
    expect((await new JobLedger(file).load()).map((j) => j.record.state)).toEqual(['completed', 'failed']);
  });

  it('old jobs.json: after import it is written as jobs.jsonl, and the old file is renamed to .migrated', async () => {
    const legacy = path.join(dir, 'store', 'jobs.json');
    await fs.mkdir(path.dirname(legacy), { recursive: true });
    const old = [job('job_a', 'completed'), job('job_b', 'failed')];
    await fs.writeFile(legacy, JSON.stringify({ formatVersion: 1, jobs: [...old, { bogus: true }] }));

    const ledger = new JobLedger(file);
    expect(await ledger.load()).toEqual(old);
    expect((await fs.readdir(path.dirname(file))).sort()).toEqual(['jobs.json.migrated', 'jobs.jsonl']);
    expect(await new JobLedger(file).load()).toEqual(old);
    // The imported record is the baseline: saved as it is, not written.
    const before = await fs.readFile(file, 'utf8');
    await ledger.save(old);
    expect(await fs.readFile(file, 'utf8')).toBe(before);
  });

  it('only half a file header (crash during first write): read as empty, not renamed; the next write rewrites the whole file', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '{"op":"header","form');
    const ledger = new JobLedger(file);
    expect(await ledger.load()).toEqual([]);
    expect(await fs.readdir(path.dirname(file))).toEqual(['jobs.jsonl']);
    await ledger.save([job('job_a')]);
    expect((await lines(file))[0]).toEqual({ op: 'header', formatVersion: 2 });
    expect((await new JobLedger(file).load()).map((j) => j.record.jobId)).toEqual(['job_a']);
  });

  it('an unrecognized file is renamed and kept, and starts empty', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '{"op":"header","formatVersion":99}\n');
    const ledger = new JobLedger(file);
    expect(await ledger.load()).toEqual([]);
    const names = await fs.readdir(path.dirname(file));
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/^jobs\.jsonl\.corrupt-\d+$/);
    await ledger.save([job('job_a')]);
    expect((await new JobLedger(file).load()).map((j) => j.record.jobId)).toEqual(['job_a']);

    await fs.writeFile(file, 'garbage\n');
    expect(await new JobLedger(file).load()).toEqual([]);
    expect((await fs.readdir(path.dirname(file))).filter((name) => name.includes('.corrupt-')).length).toBeGreaterThanOrEqual(1);
  });
});

describe('ApplicationLedger (JSONL)', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-application-ledger-'));
    file = path.join(dir, 'store', 'applications.jsonl');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('writing one entry appends one line; writing again moves it to the end; deletes by task; consistent after replay', async () => {
    const ledger = new ApplicationLedger(file);
    await ledger.load();
    const first = application('app_1', 'job_a');
    await ledger.put(first);
    await ledger.put(application('app_2', 'job_a'));
    await ledger.put(application('app_3', 'job_b'));
    first.record.state = 'committed';
    await ledger.put(first);
    await ledger.remove(new Set(['job_b']));
    await ledger.remove(new Set(['job_none']));

    expect((await lines(file)).map((row) => row.op)).toEqual(['header', 'put', 'put', 'put', 'put', 'remove']);
    const reloaded = new ApplicationLedger(file);
    await reloaded.load();
    expect(reloaded.all()).toEqual(JSON.parse(JSON.stringify(ledger.all())));
    expect(reloaded.all().map((item) => item.record.applicationId)).toEqual(['app_2', 'app_1']);
    expect(reloaded.latest('job_a')?.record.state).toBe('committed');
  });

  it('nothing is written to disk after freezing', async () => {
    const ledger = new ApplicationLedger(file);
    await ledger.load();
    await ledger.put(application('app_1', 'job_a'));
    ledger.freeze();
    await ledger.put(application('app_2', 'job_a'));
    await ledger.flush();
    const reloaded = new ApplicationLedger(file);
    await reloaded.load();
    expect(reloaded.all().map((item) => item.record.applicationId)).toEqual(['app_1']);
  });

  it('old applications.json: renamed to .migrated after import', async () => {
    const legacy = path.join(dir, 'store', 'applications.json');
    await fs.mkdir(path.dirname(legacy), { recursive: true });
    const old = [application('app_1', 'job_a', 'committed')];
    await fs.writeFile(legacy, JSON.stringify({ formatVersion: 1, applications: old }));
    const ledger = new ApplicationLedger(file);
    await ledger.load();
    expect(ledger.all()).toEqual(old);
    expect((await fs.readdir(path.dirname(file))).sort()).toEqual(['applications.json.migrated', 'applications.jsonl']);
  });
});
