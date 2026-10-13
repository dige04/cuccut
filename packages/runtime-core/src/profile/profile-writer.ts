import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { AgentDriver, AgentEvent, Logger } from '@cuccut/harness';
import { runConfinedTurn } from '@cuccut/providers';
import {
  INTERVIEW_QUESTIONS,
  INTERVIEW_QUESTION_TEXT,
  RpcError,
  type DriverId,
  type DriverInfo,
  type InterviewAnswers,
  type ProfileWriteFallbackReason,
  type ProfileWriteResult,
  type ProfileWriteState,
} from '@cuccut/protocol';
import { RcProfile } from '@cuccut/protocol/messages/runtime-core';
import type { InterviewName } from './profile-names.ts';

/**
 * Writing preferences from the interview answers (docs/cuccut/m2-profile-rules.md §4, "Writer").
 *
 * - The agent: the default one when it is installed and signed in, or else the first one that is. With none, the answers are kept as typed.
 * - The run: one confined turn (`runConfinedTurn`: writes only in its scratch directory, no MCP tools, approvals declined, 3 minutes). The scratch
 *   directory is `<home>/staging/profile-runs/<uuid>/`, holding `answers.json` in and `profile.json` out, and it is removed when the run ends.
 * - The output must match `{preferences: 1..4000 characters, names: at most 60 × {term, misheard[]}}`. `profile.json` is deleted before the run, so a
 *   stale file cannot pass.
 * - The fallback (no agent, a failed or timed-out run, unusable output): one `- <question>: <answer>` line per answer, and no names.
 * - Progress: the agent's messages and tool titles, at most 400 characters each, the last 3 kept, sent as `profile.writing`.
 * - One write at a time: a second call while one runs gets `conflict` (`PROFILE_WRITE_BUSY`). A run cut short by the Runtime stopping writes nothing
 *   (`PROFILE_WRITE_STOPPED`).
 */

/** An agent that can run the writer's turn. */
export interface WriterAgent {
  id: DriverId;
  driver: AgentDriver;
  /** Executable the user specified manually; null lets the Driver find it. */
  executable: string | null;
}

/** What the writer needs from the profile service. */
export interface ProfileWriteTarget {
  assertWritable(): void;
  answersForWrite(given?: InterviewAnswers): InterviewAnswers;
  completeWrite(
    answers: InterviewAnswers,
    outcome: { preferences: string; names: readonly InterviewName[]; usedAgent: boolean },
  ): Promise<{ namesAdded: string[] }>;
  setWriting(writing: ProfileWriteState | null): void;
}

export interface ProfileWriterOptions {
  /** The agent for the run, or null when none is installed and signed in. */
  agent: () => Promise<WriterAgent | null>;
  /** Parent of the per-run scratch directories (`<home>/staging/profile-runs`). */
  stagingDir: string;
  /** Deadline of the agent's turn (default 3 minutes). */
  timeoutMs?: number;
  log?: Logger;
}

export const PROFILE_WRITER_TIMEOUT_MS = 3 * 60_000;
/** Progress lines kept, and the length of each. */
export const PROFILE_WRITING_LINES = 3;
export const PROFILE_WRITING_LINE_CHARS = 400;
const ANSWERS_FILE = 'answers.json';
const OUTPUT_FILE = 'profile.json';
const OUTPUT_PREFERENCES_CHARS = 4000;
const OUTPUT_NAMES = 60;

/** The agent's output file. */
const writerOutputSchema = z.object({
  preferences: z.string().trim().min(1).max(OUTPUT_PREFERENCES_CHARS),
  names: z
    .array(z.object({ term: z.string().trim().min(1).max(200), misheard: z.array(z.string().max(200)).max(50).default([]) }))
    .max(OUTPUT_NAMES)
    .default([]),
});

/** The writer's instructions (agent-facing English, not product copy). */
export const PROFILE_WRITER_INSTRUCTIONS = [
  'You are running as a non-interactive helper of CucCut, a video editor that is driven by an agent. Nobody reads your reply and nobody can approve anything.',
  `Someone is setting up the editor. Read ${ANSWERS_FILE} in the current working directory: their answers about what they make, for whom, what they record, where it goes, what annoys them and which names must be spelled right.`,
  `Write ${OUTPUT_FILE} in the current working directory as {"preferences":"<markdown>","names":[{"term":"","misheard":[]}]}.`,
  'preferences: 6-12 short lines in their voice, second person avoided, each a concrete editing preference the agent can act on (hook length, caption density, music level, platforms and lengths, what to never do). Only what the answers support; no invented taste. Markdown, one preference a line, each line starting with "- ".',
  'names: every proper name they mentioned that a speech recogniser could misspell, spelled exactly as they wrote it, with the ways it is likely to be misheard in misheard. Empty if none.',
  'Reply in no language other than the answers\' language: write the preferences in the language the answers are written in.',
  `Do not create, modify or delete any other file, do not touch anything outside the current working directory, and do not ask questions. When ${OUTPUT_FILE} is written, reply with just: DONE`,
].join('\n\n');

export class ProfileWriter {
  readonly #target: ProfileWriteTarget;
  readonly #options: ProfileWriterOptions;
  #running: AbortController | null = null;
  #done: Promise<unknown> = Promise.resolve();

  constructor(target: ProfileWriteTarget, options: ProfileWriterOptions) {
    this.#target = target;
    this.#options = options;
  }

  get busy(): boolean {
    return this.#running !== null;
  }

  /**
   * Writes the interview's section from the answers (the saved ones with `given` merged over them) and completes the interview. No answers:
   * `PROFILE_NO_ANSWERS`; a write already running: `PROFILE_WRITE_BUSY`; a profile from a newer version: `PROFILE_READ_ONLY`.
   */
  async write(given: InterviewAnswers = {}): Promise<ProfileWriteResult> {
    if (this.#running) throw new RpcError('conflict', RcProfile.writeBusy(), { code: 'PROFILE_WRITE_BUSY' });
    this.#target.assertWritable();
    const answers = this.#target.answersForWrite(given);
    const controller = new AbortController();
    this.#running = controller;
    const running = this.#write(answers, controller.signal);
    this.#done = running.catch(() => {});
    try {
      return await running;
    } finally {
      this.#running = null;
    }
  }

  /** Runtime stop: cancels a run in flight (nothing is written; it ends with `PROFILE_WRITE_STOPPED`) and waits for it to end. */
  async close(): Promise<void> {
    this.#running?.abort();
    await this.#done;
  }

  async #write(answers: InterviewAnswers, signal: AbortSignal): Promise<ProfileWriteResult> {
    const writing: ProfileWriteState = { startedAt: new Date().toISOString(), lines: [] };
    this.#target.setWriting(writing);
    try {
      const drafted = await this.#draft(answers, signal, writing.startedAt);
      // The Runtime is stopping: nothing is written, the answers stay saved for the next try.
      if (signal.aborted) throw new RpcError('busy', RcProfile.writeStopped(), { code: 'PROFILE_WRITE_STOPPED' });
      const outcome = drafted.ok
        ? { preferences: drafted.preferences, names: drafted.names, usedAgent: true }
        : { preferences: answersAsTyped(answers), names: [], usedAgent: false };
      const { namesAdded } = await this.#target.completeWrite(answers, outcome);
      return {
        preferences: outcome.preferences,
        names: namesAdded,
        usedAgent: outcome.usedAgent,
        ...(drafted.ok ? {} : { fallbackReason: drafted.reason }),
      };
    } finally {
      this.#target.setWriting(null);
    }
  }

  /** The agent's run. Anything short of a usable `profile.json` is a fallback reason. */
  async #draft(
    answers: InterviewAnswers,
    signal: AbortSignal,
    startedAt: string,
  ): Promise<{ ok: true; preferences: string; names: InterviewName[] } | { ok: false; reason: ProfileWriteFallbackReason }> {
    const log = this.#options.log;
    let agent: WriterAgent | null;
    try {
      agent = await this.#options.agent();
    } catch (error) {
      log?.warn('Finding an agent for the profile writer failed', { error: String(error) });
      agent = null;
    }
    if (!agent) return { ok: false, reason: 'no-agent' };
    if (signal.aborted) return { ok: false, reason: 'agent-failed' };

    const dir = path.join(this.#options.stagingDir, crypto.randomUUID());
    try {
      await fs.mkdir(dir, { recursive: true });
      const filled = INTERVIEW_QUESTIONS.filter((id) => answers[id]).map((id) => ({ id, question: INTERVIEW_QUESTION_TEXT[id], answer: answers[id]! }));
      await fs.writeFile(path.join(dir, ANSWERS_FILE), `${JSON.stringify(filled, null, 2)}\n`);
      const output = path.join(dir, OUTPUT_FILE);
      await fs.rm(output, { force: true });
      const progress = new WritingProgress((lines) => this.#target.setWriting({ startedAt, lines }));
      const outcome = await runConfinedTurn({
        driver: agent.driver,
        executable: agent.executable,
        cwd: dir,
        instructions: PROFILE_WRITER_INSTRUCTIONS,
        text: `Read ${ANSWERS_FILE} and write ${OUTPUT_FILE} as instructed.`,
        timeoutMs: this.#options.timeoutMs ?? PROFILE_WRITER_TIMEOUT_MS,
        signal,
        onEvent: (event) => progress.add(event),
      });
      if (!outcome.started || outcome.result.kind !== 'completed') {
        log?.warn('The profile writer run did not complete; keeping the answers as typed', {
          driverId: agent.id,
          result: outcome.started ? outcome.result.kind : 'not-started',
          ...(outcome.started ? {} : { error: String(outcome.error) }),
        });
        return { ok: false, reason: 'agent-failed' };
      }
      const raw = await fs.readFile(output, 'utf8').catch(() => null);
      const parsed = raw === null ? null : writerOutputSchema.safeParse(parseJson(raw));
      if (!parsed?.success) {
        log?.warn('The profile writer output was not usable; keeping the answers as typed', { driverId: agent.id, found: raw !== null });
        return { ok: false, reason: 'bad-output' };
      }
      return {
        ok: true,
        preferences: parsed.data.preferences.trim(),
        names: parsed.data.names.map((n) => ({ term: n.term, misheard: n.misheard })),
      };
    } catch (error) {
      log?.warn('The profile writer run failed; keeping the answers as typed', { error: String(error) });
      return { ok: false, reason: 'agent-failed' };
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/**
 * The fallback section: one `- <question>: <answer>` line per answer, in question order (English labels, the user's words on one line). A question that
 * ends with a question mark keeps it instead of the colon.
 */
export function answersAsTyped(answers: InterviewAnswers): string {
  return INTERVIEW_QUESTIONS.filter((id) => answers[id]?.trim())
    .map((id) => {
      const question = INTERVIEW_QUESTION_TEXT[id];
      return `- ${question}${question.endsWith('?') ? '' : ':'} ${answers[id]!.trim().replace(/\s*\n\s*/g, ' ')}`;
    })
    .join('\n');
}

/** The agent to write with: the default one when it is ready, or else the first ready one. Disabled, untested-by-design (`verified: false`) and not-ready agents are skipped. */
export function pickWriterAgent(drivers: readonly DriverInfo[]): DriverInfo | null {
  const usable = drivers.filter((d) => d.enabled && d.state === 'ready' && d.verified !== false);
  return usable.find((d) => d.isDefault) ?? usable[0] ?? null;
}

/** The last progress lines of a run: agent messages and tool titles, one line each, clipped. */
class WritingProgress {
  readonly #lines: string[] = [];
  readonly #publish: (lines: string[]) => void;

  constructor(publish: (lines: string[]) => void) {
    this.#publish = publish;
  }

  add(event: AgentEvent): void {
    const line = lineOf(event);
    if (!line) return;
    this.#lines.push(line);
    if (this.#lines.length > PROFILE_WRITING_LINES) this.#lines.splice(0, this.#lines.length - PROFILE_WRITING_LINES);
    this.#publish([...this.#lines]);
  }
}

function lineOf(event: AgentEvent): string | null {
  if (event.type === 'item.completed' && event.item.kind === 'agent-message') return clipLine(event.item.text);
  if (event.type === 'item.started' && event.item.kind === 'tool-call') return clipLine(event.item.title);
  return null;
}

function clipLine(text: string): string | null {
  const line = text.replace(/\s+/g, ' ').trim();
  if (!line) return null;
  const chars = [...line];
  return chars.length > PROFILE_WRITING_LINE_CHARS ? `${chars.slice(0, PROFILE_WRITING_LINE_CHARS - 1).join('')}…` : line;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
