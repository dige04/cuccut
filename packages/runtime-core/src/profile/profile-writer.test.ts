import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentDriver, AgentEvent, AgentSession, ApprovalResponse, CreateSessionOptions } from '@cuccut/harness';
import { RpcError, type DriverInfo, type ProfileEvent, type ProfileWriteState, type TranscriptionGlossary } from '@cuccut/protocol';
import { LibraryStore } from '@cuccut/runtime-storage/library';
import { fakeProbe } from '../agent-tools/testing/fake-agent.ts';
import { ProfileService } from './profile-service.ts';
import { profileMethods } from './profile-methods.ts';
import { PROFILE_WRITING_LINE_CHARS, PROFILE_WRITING_LINES, answersAsTyped, pickWriterAgent, type WriterAgent } from './profile-writer.ts';

/**
 * The profile writer (docs/cuccut/m2-profile-rules.md §4, "Writer") with a scripted fake agent: the output is parsed, `profile.json` is not there when
 * the turn starts, bad output, a timeout and no agent each keep the answers as typed, the scratch directory is removed, one write at a time, and the
 * progress lines are capped.
 */

async function rejection(promise: Promise<unknown>): Promise<RpcError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RpcError) return error;
    throw error;
  }
  throw new Error('expected a rejection');
}
const codeOf = (error: RpcError) => (error.details as { code?: string } | undefined)?.code;

/** What the fake agent does in its turn, given its session and working directory. */
type Script = (turn: ScriptTurn) => Promise<void> | void;

interface ScriptTurn {
  cwd: string;
  emit(event: AgentEvent): void;
  /** Ends the turn. */
  finish(outcome?: 'completed' | 'failed' | 'interrupted'): void;
  approval(): string;
}

class ScriptSession implements AgentSession {
  readonly id = 'script';
  readonly capabilities = { steer: false, approvals: true, resume: false, images: false };
  readonly inputs: string[] = [];
  readonly responses: { approvalId: string; decision: ApprovalResponse['decision'] }[] = [];
  interrupted = 0;
  closed = false;
  /** Whether the output file was there when the turn started. */
  outputAtStart: boolean | null = null;
  answersAtStart: unknown = null;
  readonly #listeners = new Set<(event: AgentEvent) => void>();

  readonly options: CreateSessionOptions;
  readonly script: Script;

  constructor(options: CreateSessionOptions, script: Script) {
    this.options = options;
    this.script = script;
  }

  async startTurn(input: { text: string }): Promise<{ turnId: string }> {
    this.inputs.push(input.text);
    const cwd = this.options.cwd;
    this.outputAtStart = await fs
      .access(path.join(cwd, 'profile.json'))
      .then(() => true)
      .catch(() => false);
    this.answersAtStart = JSON.parse(await fs.readFile(path.join(cwd, 'answers.json'), 'utf8'));
    const turn: ScriptTurn = {
      cwd,
      emit: (event) => this.#emit(event),
      finish: (outcome = 'completed') => this.#emit({ type: 'turn.completed', turnId: 't1', outcome, error: outcome === 'failed' ? 'boom' : null }),
      approval: () => {
        this.#emit({ type: 'approval.requested', turnId: 't1', approvalId: 'appr_1', request: { kind: 'command', command: 'curl example.com', cwd } as never });
        return 'appr_1';
      },
    };
    setTimeout(() => void this.script(turn), 1);
    return { turnId: 't1' };
  }

  async interrupt() {
    this.interrupted++;
    return { status: 'requested' as const };
  }

  async respondToApproval(approvalId: string, response: ApprovalResponse) {
    this.responses.push({ approvalId, decision: response.decision });
  }

  subscribe(listener: (event: AgentEvent) => void) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  describePersistence() {
    return null;
  }

  async close() {
    this.closed = true;
  }

  #emit(event: AgentEvent) {
    for (const listener of this.#listeners) listener(event);
  }
}

class ScriptDriver implements AgentDriver {
  readonly id = 'claude' as const;
  readonly sessions: ScriptSession[] = [];
  script: Script = () => {};

  async probe() {
    return fakeProbe();
  }

  async createSession(options: CreateSessionOptions): Promise<AgentSession> {
    const session = new ScriptSession(options, this.script);
    this.sessions.push(session);
    return session;
  }
}

const writeOutput = (cwd: string, value: unknown) => fs.writeFile(path.join(cwd, 'profile.json'), typeof value === 'string' ? value : JSON.stringify(value));

const GOOD = {
  preferences: '- Hooks under three seconds\n- Captions on every short\n- Never cover gameplay with pictures',
  names: [
    { term: 'Deska', misheard: ['desk a', 'Desca'] },
    { term: 'Next.js', misheard: [] },
  ],
};

describe('ProfileWriter', () => {
  let dir: string;
  let staging: string;
  let library: LibraryStore;
  let driver: ScriptDriver;
  let agent: WriterAgent | null;
  let profile: ProfileService;
  let events: ProfileEvent[];

  async function open(timeoutMs = 5_000): Promise<ProfileService> {
    const service = await ProfileService.open({
      home: { profileFile: path.join(dir, 'home', 'store', 'profile.json') },
      library,
      projects: () => [],
      writer: { agent: async () => agent, stagingDir: staging, timeoutMs },
    });
    events = [];
    service.topic.subscribe(undefined, (e) => events.push(e.event));
    return service;
  }

  const writingEvents = () => events.flatMap((e) => (e.type === 'profile.writing' ? [e.writing] : []));
  const stagingEntries = () => fs.readdir(staging).catch(() => [] as string[]);

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-profile-writer-'));
    staging = path.join(dir, 'home', 'staging', 'profile-runs');
    library = await LibraryStore.open({ dir: path.join(dir, 'home', 'library') });
    driver = new ScriptDriver();
    agent = { id: 'claude', driver, executable: '/opt/claude' };
    profile = await open();
    await profile.saveAnswers({ who: 'Tutorials for junior devs', names: 'Deska, Next.js' });
  });

  afterEach(async () => {
    await profile.close();
    await library.idle();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('parses the agent output into the interview section and the names glossary, and completes the interview', async () => {
    driver.script = async (turn) => {
      await writeOutput(turn.cwd, GOOD);
      turn.emit({ type: 'item.completed', turnId: 't1', item: { kind: 'agent-message', id: 'm1', text: 'DONE' } });
      turn.finish();
    };
    const result = await profile.writeFromAnswers({ platforms: 'YouTube Shorts, under 60 seconds' });

    expect(result).toEqual({ preferences: GOOD.preferences, names: ['Deska', 'Next.js'], usedAgent: true });
    const snapshot = profile.snapshot();
    expect(snapshot.preferences.interview).toBe(GOOD.preferences);
    expect(snapshot.interview).toMatchObject({
      status: 'done',
      usedAgent: true,
      answers: { who: 'Tutorials for junior devs', platforms: 'YouTube Shorts, under 60 seconds', names: 'Deska, Next.js' },
    });
    expect(snapshot.writing).toBeNull();
    const glossary = library.get({ library: 'glossaries', id: snapshot.interview.namesGlossaryId! }).content as TranscriptionGlossary;
    expect(glossary.terms.map((t) => t.canonical)).toEqual(['Deska', 'Next.js']);
    expect(glossary.terms[0]!.misheard).toEqual(['desk a', 'Desca']);

    // One confined turn: the scratch directory as cwd, no MCP tools, the user's executable, and the answers in answers.json.
    const [session] = driver.sessions;
    expect(session!.options).toMatchObject({ confinement: 'cwd-write-only', executable: '/opt/claude', resume: null, model: null });
    expect(session!.options.mcpServers).toBeUndefined();
    expect(path.dirname(session!.options.cwd)).toBe(staging);
    expect(session!.options.developerInstructions).toContain("Reply in no language other than the answers' language");
    expect(session!.answersAtStart).toEqual([
      { id: 'who', question: 'What do you make, and who is it for?', answer: 'Tutorials for junior devs' },
      { id: 'platforms', question: 'Where does it go, and how long should it be?', answer: 'YouTube Shorts, under 60 seconds' },
      { id: 'names', question: 'Names that must be spelled right', answer: 'Deska, Next.js' },
    ]);
    expect(session!.closed).toBe(true);
    // The scratch directory is gone, and writing was announced then cleared.
    expect(await stagingEntries()).toEqual([]);
    expect(writingEvents().at(0)).toMatchObject({ lines: [] });
    expect(writingEvents().at(-1)).toBeNull();
  });

  it('keeps answers saved while the agent runs (only the answers the write was given are put back)', async () => {
    driver.script = async (turn) => {
      await profile.saveAnswers({ names: 'Deska, Next.js, Pasho', record: 'Screen and webcam' });
      await writeOutput(turn.cwd, GOOD);
      turn.finish();
    };
    await profile.writeFromAnswers({ platforms: 'YouTube Shorts' });
    expect(profile.snapshot().interview.answers).toEqual({
      who: 'Tutorials for junior devs',
      record: 'Screen and webcam',
      platforms: 'YouTube Shorts',
      names: 'Deska, Next.js, Pasho',
    });
  });

  it('starts the turn without an output file, so a run that writes nothing cannot pass', async () => {
    driver.script = (turn) => turn.finish();
    const result = await profile.writeFromAnswers();
    expect(driver.sessions[0]!.outputAtStart).toBe(false);
    expect(result).toEqual({
      preferences: answersAsTyped({ who: 'Tutorials for junior devs', names: 'Deska, Next.js' }),
      names: [],
      usedAgent: false,
      fallbackReason: 'bad-output',
    });
  });

  it('keeps the answers as typed when the output is not valid JSON or not the agreed shape', async () => {
    driver.script = async (turn) => {
      await writeOutput(turn.cwd, '{"preferences": "- Hooks short",');
      turn.finish();
    };
    expect(await profile.writeFromAnswers()).toMatchObject({ usedAgent: false, fallbackReason: 'bad-output' });

    driver.script = async (turn) => {
      await writeOutput(turn.cwd, { preferences: '', names: [] });
      turn.finish();
    };
    expect(await profile.writeFromAnswers()).toMatchObject({ usedAgent: false, fallbackReason: 'bad-output' });

    driver.script = async (turn) => {
      await writeOutput(turn.cwd, { preferences: 'x'.repeat(4001) });
      turn.finish();
    };
    const result = await profile.writeFromAnswers();
    expect(result.fallbackReason).toBe('bad-output');
    expect(profile.snapshot().preferences.interview).toBe('- What do you make, and who is it for? Tutorials for junior devs\n- Names that must be spelled right: Deska, Next.js');
    expect(profile.snapshot().interview).toMatchObject({ status: 'done', usedAgent: false });
    expect(await stagingEntries()).toEqual([]);
  });

  it('keeps the answers as typed when the turn fails or times out, interrupting a turn that ran out of time', async () => {
    driver.script = (turn) => turn.finish('failed');
    expect(await profile.writeFromAnswers()).toMatchObject({ usedAgent: false, fallbackReason: 'agent-failed' });

    await profile.close();
    profile = await open(50);
    driver.script = () => {};
    expect(await profile.writeFromAnswers()).toMatchObject({ usedAgent: false, fallbackReason: 'agent-failed' });
    const last = driver.sessions.at(-1)!;
    expect(last.interrupted).toBe(1);
    expect(last.closed).toBe(true);
    expect(await stagingEntries()).toEqual([]);
  });

  it('keeps the answers as typed when no agent is installed and signed in, or the session does not start', async () => {
    agent = null;
    expect(await profile.writeFromAnswers()).toEqual({
      preferences: '- What do you make, and who is it for? Tutorials for junior devs\n- Names that must be spelled right: Deska, Next.js',
      names: [],
      usedAgent: false,
      fallbackReason: 'no-agent',
    });
    expect(profile.snapshot().interview.status).toBe('done');

    agent = {
      id: 'claude',
      driver: { id: 'claude', probe: async () => fakeProbe(), createSession: async () => Promise.reject(new Error('not signed in')) },
      executable: null,
    };
    expect(await profile.writeFromAnswers()).toMatchObject({ usedAgent: false, fallbackReason: 'agent-failed' });
    expect(await stagingEntries()).toEqual([]);
  });

  it('declines the approvals a confined run asks for', async () => {
    driver.script = async (turn) => {
      turn.approval();
      await writeOutput(turn.cwd, GOOD);
      turn.finish();
    };
    expect((await profile.writeFromAnswers()).usedAgent).toBe(true);
    expect(driver.sessions[0]!.responses).toEqual([{ approvalId: 'appr_1', decision: 'decline' }]);
  });

  it('runs one write at a time: a second call gets PROFILE_WRITE_BUSY', async () => {
    let finish!: () => void;
    driver.script = (turn) => {
      finish = () => {
        void writeOutput(turn.cwd, GOOD).then(() => turn.finish());
      };
    };
    const first = profile.writeFromAnswers();
    await vi_until(() => driver.sessions[0]?.inputs.length);
    const busy = await rejection(profile.writeFromAnswers());
    expect(busy.code).toBe('conflict');
    expect(codeOf(busy)).toBe('PROFILE_WRITE_BUSY');
    await vi_until(() => finish);
    finish();
    expect((await first).usedAgent).toBe(true);
    // Free again.
    driver.script = (turn) => turn.finish();
    expect((await profile.writeFromAnswers()).fallbackReason).toBe('bad-output');
  });

  it('sends the last three progress lines, each at most 400 characters', async () => {
    driver.script = async (turn) => {
      turn.emit({ type: 'item.started', turnId: 't1', item: { kind: 'tool-call', id: 'c1', tool: 'read' as never, title: 'Read answers.json', detail: null, output: null, status: 'running' as never, exitCode: null, durationMs: null } });
      turn.emit({ type: 'item.completed', turnId: 't1', item: { kind: 'agent-message', id: 'm1', text: 'Reading the answers' } });
      turn.emit({ type: 'item.completed', turnId: 't1', item: { kind: 'reasoning', id: 'r1', text: 'not shown' } });
      turn.emit({ type: 'item.completed', turnId: 't1', item: { kind: 'agent-message', id: 'm2', text: 'w'.repeat(1000) } });
      turn.emit({ type: 'item.completed', turnId: 't1', item: { kind: 'agent-message', id: 'm3', text: '  Writing   profile.json\n' } });
      await writeOutput(turn.cwd, GOOD);
      turn.finish();
    };
    await profile.writeFromAnswers();
    const states = writingEvents().filter((w): w is ProfileWriteState => w !== null);
    expect(states.length).toBe(5);
    for (const state of states) {
      expect(state.lines.length).toBeLessThanOrEqual(PROFILE_WRITING_LINES);
      for (const line of state.lines) expect([...line].length).toBeLessThanOrEqual(PROFILE_WRITING_LINE_CHARS);
    }
    const last = states.at(-1)!;
    expect(last.lines[0]).toBe('Reading the answers');
    expect(last.lines[1]).toBe(`${'w'.repeat(PROFILE_WRITING_LINE_CHARS - 1)}…`);
    expect(last.lines[2]).toBe('Writing profile.json');
    expect(new Set(states.map((s) => s.startedAt)).size).toBe(1);
    expect(writingEvents().at(-1)).toBeNull();
  });

  it('writes nothing when the Runtime stops during the run', async () => {
    driver.script = () => {};
    const running = profile.writeFromAnswers();
    await vi_until(() => driver.sessions[0]?.inputs.length);
    await profile.close();
    const stopped = await rejection(running);
    expect(codeOf(stopped)).toBe('PROFILE_WRITE_STOPPED');
    expect(profile.snapshot().interview.status).toBe('pending');
    expect(profile.snapshot().preferences.interview).toBe('');
    expect(profile.snapshot().writing).toBeNull();
    expect(await stagingEntries()).toEqual([]);
  });

  it('answers PROFILE_NO_ANSWERS through the method when nothing was answered', async () => {
    await profile.saveAnswers({ who: '', names: '' });
    const methods = profileMethods({ profile });
    const none = await rejection(Promise.resolve().then(() => methods['profile.writeFromAnswers']({}, undefined as never)));
    expect(none.code).toBe('invalid-request');
    expect(codeOf(none)).toBe('PROFILE_NO_ANSWERS');
    expect(driver.sessions).toEqual([]);
    agent = null;
    expect(await methods['profile.writeFromAnswers']({ answers: { who: 'Cooking shorts' } }, undefined as never)).toMatchObject({ fallbackReason: 'no-agent' });
  });

  it('removes scratch directories left by an earlier run when it opens', async () => {
    await fs.mkdir(path.join(staging, 'left-over'), { recursive: true });
    await profile.close();
    profile = await open();
    expect(await stagingEntries()).toEqual([]);
  });
});

describe('pickWriterAgent', () => {
  const info = (id: DriverInfo['id'], over: Partial<DriverInfo> = {}): DriverInfo =>
    ({ ...fakeProbe(), id, state: 'ready', enabled: true, isDefault: false, source: 'builtin', custom: null, defaultModel: null, defaultEffort: null, executableOverride: null, ...over }) as DriverInfo;

  it('takes the default agent when it is ready, or else the first ready one', () => {
    expect(pickWriterAgent([info('codex'), info('claude', { isDefault: true })])?.id).toBe('claude');
    expect(pickWriterAgent([info('codex', { isDefault: true, state: 'signed-out' }), info('claude')])?.id).toBe('claude');
    expect(pickWriterAgent([info('codex', { enabled: false }), info('claude', { state: 'not-installed' }), info('opencode', { verified: false })])).toBeNull();
    expect(pickWriterAgent([])).toBeNull();
  });
});

async function vi_until<T>(read: () => T | undefined | null | false | 0, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('Timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
