import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { RpcError, newId, type Id, type ProfileEvent } from '@cuccut/protocol';
import { resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { ToolDriver, until, type ToolSession } from '../agent-tools/testing/fake-agent.ts';

/**
 * The profile end to end (docs/cuccut/m2-profile-rules.md §5): preferences and rules saved through the real RPC gateway reach a new native session's
 * developer instructions as `<cuccut-profile>`; a project session also gets its project's lines; the interview nudge is there while it is pending.
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

describe('profile end to end', () => {
  let dir: string;
  let builtin: string;
  let home: RuntimeHome;
  let driver: ToolDriver;
  let runtime: RunningRuntime;
  let client: CucCutClient;

  async function boot(): Promise<void> {
    driver = new ToolDriver();
    runtime = await startRuntime({ home, drivers: () => [driver], watchSpace: false, skillsDir: builtin });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
  }

  async function send(text: string, projectId: Id | null = null, conversationId?: Id): Promise<{ conversationId: Id; session: ToolSession }> {
    const id = conversationId ?? (await client.request('conversations.create', { projectId })).conversation.id;
    const before = driver.sessions.length;
    await client.request('conversations.send', { conversationId: id, text, commandId: newId('cmd') });
    if (conversationId) {
      const session = driver.sessions.find((s) => s.inputs.includes(text)) ?? (await until(() => driver.sessions.find((s) => s.inputs.includes(text))));
      return { conversationId: id, session };
    }
    const session = await until(() => driver.sessions[before]);
    await until(() => session.inputs.length > 0);
    return { conversationId: id, session };
  }

  const instructionsOf = (session: ToolSession) => session.options.developerInstructions ?? '';

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-profile-runtime-'));
    builtin = path.join(dir, 'builtin-skills');
    await fs.mkdir(builtin);
    home = resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') });
  });

  afterEach(async () => {
    client?.close();
    await runtime?.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('an empty profile adds no block, only the interview nudge while it is pending', async () => {
    await boot();
    const { session } = await send('hello');
    const text = instructionsOf(session);
    expect(text).not.toContain('<cuccut-profile>');
    expect(text).toContain('<cuccut-interview>');
    expect(text).toContain('who ("What do you make, and who is it for?")');

    // Skipped: no nudge, and still nothing else.
    await client.request('profile.skipInterview', {});
    const after = await send('again');
    expect(instructionsOf(after.session)).not.toContain('<cuccut-interview>');
    expect(instructionsOf(after.session)).not.toContain('<cuccut-profile>');
  });

  it('saved preferences and rules reach a new session; the topic follows each write', async () => {
    await boot();
    const events: ProfileEvent[] = [];
    let snapshotOwn: string | null = null;
    client.subscribeProfile({
      snapshot: (snapshot) => {
        snapshotOwn = snapshot.preferences.own;
      },
      event: (event) => events.push(event),
    });
    await until(() => snapshotOwn !== null);

    await client.request('profile.saveAnswers', { answers: { who: 'Coding streams for junior devs' } });
    await client.request('profile.setPreferences', { own: '- Hooks under 3 seconds' });
    const put = await client.request('profile.putRule', {
      rule: { name: 'Gameplay stays clear', when: 'the clip is gameplay', instruction: 'Never cover the game with pictures.', note: 'private note' },
    });
    expect(put.warnings).toEqual([]);
    await client.request('profile.putRule', { rule: { name: 'Paused one', when: 'x', instruction: 'y', enabled: false } });
    await client.request('library.put', {
      library: 'glossaries',
      content: { name: 'Names', kind: 'transcription', language: null, defaultEnabled: true, terms: [{ canonical: 'Deska', misheard: [] }] },
    });
    await until(() => events.length >= 4);
    expect(events.map((e) => e.type)).toEqual(['profile.updated', 'profile.updated', 'profile.updated', 'profile.updated']);

    const snapshot = await client.request('profile.get', {});
    expect(snapshot).toMatchObject({ hasPreferences: true, interview: { status: 'pending', answers: { who: 'Coding streams for junior devs' } } });

    const { session } = await send('cut me a clip');
    const text = instructionsOf(session);
    expect(text).toContain('<cuccut-profile>');
    expect(text).toContain('## In general\n- Hooks under 3 seconds');
    expect(text).toContain('1. Gameplay stays clear [any] — When: the clip is gameplay. Do: Never cover the game with pictures.');
    expect(text).not.toContain('Paused one');
    expect(text).not.toContain('private note');
    expect(text).toContain('## Names to spell exactly\nDeska');
    // There are preferences now: no nudge.
    expect(text).not.toContain('<cuccut-interview>');
    // The block comes after the guidance.
    expect(text.indexOf('<cuccut-profile>')).toBeGreaterThan(0);
  });

  it('a project session gets its project lines and rules; others do not', async () => {
    await boot();
    const { project } = await client.request('projects.create', { name: 'Shorts' });
    await client.request('profile.setPreferences', { projectId: project.id, own: '- Vertical 9:16 only' });
    await client.request('profile.putRule', { projectId: project.id, rule: { name: 'Project rule', when: 'always', instruction: 'Keep it under 60 seconds.' } });
    expect(await client.request('profile.getProject', { projectId: project.id })).toMatchObject({ preferences: '- Vertical 9:16 only', readOnly: false });

    const inProject = await send('make a short', project.id);
    expect(instructionsOf(inProject.session)).toContain('## For this project\n- Vertical 9:16 only');
    expect(instructionsOf(inProject.session)).toContain('1. Project rule [any] — When: always. Do: Keep it under 60 seconds.');

    const outside = await send('something else');
    expect(instructionsOf(outside.session)).not.toContain('Vertical 9:16 only');
    expect(instructionsOf(outside.session)).not.toContain('Project rule');

    const missing = await rejection(client.request('profile.getProject', { projectId: 'prj_missing' }));
    expect(missing).toMatchObject({ code: 'not-found', details: { code: 'PROFILE_PROJECT_NOT_FOUND' } });
  });

  it('a session started before an edit keeps the old text; a new session reads the new one', async () => {
    await boot();
    await client.request('profile.setPreferences', { own: '- first version' });
    const first = await send('one');
    await client.request('profile.setPreferences', { own: '- second version' });
    // The same conversation keeps its native session and what it was given.
    first.session.finish();
    await until(() => runtime.harness.agentRun(first.conversationId).taskId === null);
    await send('two', null, first.conversationId);
    expect(driver.sessions.filter((s) => s.inputs.includes('two'))).toEqual([first.session]);
    expect(instructionsOf(first.session)).toContain('- first version');
    expect(instructionsOf(first.session)).not.toContain('- second version');
    const second = await send('three');
    expect(instructionsOf(second.session)).toContain('- second version');
  });

  it('profile writes persist across a restart', async () => {
    await boot();
    await client.request('profile.saveAnswers', { answers: { who: 'me' } });
    await client.request('profile.dismissReminder', {});
    client.close();
    await runtime.close();
    await boot();
    expect((await client.request('profile.get', {})).interview).toMatchObject({ reminder: false, answers: { who: 'me' } });
    expect(JSON.parse(await fs.readFile(home.profileFile, 'utf8'))).toMatchObject({ schemaVersion: 1 });
  });
});
