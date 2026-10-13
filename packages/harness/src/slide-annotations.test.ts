import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newId, type DriverProbe, type Id, type SlideAnnotation } from '@cuccut/protocol';
import { ConversationStore, ProjectStore, resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import { DriverRegistry } from './agent-manager.ts';
import type { AgentDriver, AgentEvent, AgentSession } from './driver.ts';
import { Harness, withSlideAnnotations, type ResolvedSlideAnnotation } from './harness.ts';
import { silentLogger } from './logger.ts';

/** Slide annotations are sent with the message (docs/design/slides §9): the text assembled for the agent, and the copy recorded on the user message. Fake Driver, everything in a temp directory. */

const note = (over: Partial<SlideAnnotation> = {}): SlideAnnotation => ({
  deck: { conversationId: 'c', path: 'talk' },
  anchor: 'sl1 > sb0101:nth-of-type(1)',
  slideId: 's03',
  label: '第 3 页 › 标题 “AI 时代该学什么”',
  detail: 'Element on slide 3 (s03) · title',
  text: '标题太长，拆成两行',
  ...over,
});

describe('withSlideAnnotations', () => {
  it('returns unchanged when there are no annotations', () => {
    expect(withSlideAnnotations('改一下', [])).toBe('改一下');
  });

  it('one section per deck; the numbers are the order within the whole message; multi-line comments are indented to align', () => {
    const text = withSlideAnnotations('按标注改', [
      { annotation: note(), deckPath: 'talk/' },
      { annotation: note({ label: '第 1 页 › 一块区域', detail: undefined, area: true, text: '留白太多\n往上挪' }), deckPath: 'other/' },
      { annotation: note({ label: '第 4 页 › 正文 “三个原则”', text: '加一个例子' }), deckPath: 'talk/' },
    ]);
    expect(text).toBe(
      [
        '按标注改',
        '',
        '<cuccut-slide-annotations deck="talk/">',
        '1. 第 3 页 › 标题 “AI 时代该学什么”',
        '   Location: Element on slide 3 (s03) · title',
        '   Note: 标题太长，拆成两行',
        '3. 第 4 页 › 正文 “三个原则”',
        '   Location: Element on slide 3 (s03) · title',
        '   Note: 加一个例子',
        '</cuccut-slide-annotations>',
        '<cuccut-slide-annotations deck="other/">',
        '2. 第 1 页 › 一块区域',
        '   Note: 留白太多',
        '        往上挪',
        '</cuccut-slide-annotations>',
      ].join('\n'),
    );
  });
});

const capabilities: DriverProbe['capabilities'] = { steer: true, approvals: true, resume: false, images: false };

/** Stays open from turn start until the end; accepts interjections. */
class Session implements AgentSession {
  readonly id = newId('fake');
  readonly capabilities = capabilities;
  readonly inputs: string[] = [];
  readonly #listeners = new Set<(event: AgentEvent) => void>();
  #turn = 0;
  turnId: string | null = null;

  startTurn(input: { text: string }): Promise<{ turnId: string }> {
    const turnId = `turn-${++this.#turn}`;
    this.turnId = turnId;
    this.inputs.push(input.text);
    setTimeout(() => this.#emit({ type: 'turn.started', turnId }), 1);
    return Promise.resolve({ turnId });
  }

  async steer(_turnId: string, input: { text: string }) {
    this.inputs.push(input.text);
    return 'accepted' as const;
  }

  async interrupt() {
    return { status: 'requested' as const };
  }

  async respondToApproval() {}

  subscribe(listener: (event: AgentEvent) => void) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  describePersistence() {
    return null;
  }

  async close() {}

  #emit(event: AgentEvent) {
    for (const listener of this.#listeners) listener(event);
  }
}

class Driver implements AgentDriver {
  readonly id = 'codex' as const;
  readonly sessions: Session[] = [];

  async probe(): Promise<DriverProbe> {
    return {
      id: 'codex',
      name: 'Fake',
      command: 'fake',
      state: 'ready',
      status: 'available',
      version: '0',
      minVersion: '0',
      latestVersion: null,
      unavailableReason: null,
      detail: null,
      executable: null,
      realExecutable: null,
      account: null,
      plan: '',
      loginCommand: null,
      install: [],
      models: [],
      configModel: null,
      configModelKnown: null,
      checkedAt: new Date().toISOString(),
      verified: true,
      tested: true,
      capabilities,
    };
  }

  async createSession(): Promise<AgentSession> {
    const session = new Session();
    this.sessions.push(session);
    return session;
  }
}

let dir: string;
let home: RuntimeHome;
let driver: Driver;
let harness: Harness;

async function until<T>(read: () => T | undefined | null | false, timeoutMs = 3000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('等待超时');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

const userMessages = (conversationId: Id) => harness.getConversation(conversationId).items.filter((item) => item.kind === 'user-message');

beforeEach(async () => {
  dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-slide-notes-')));
  home = resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') });
  driver = new Driver();
  const drivers = new DriverRegistry();
  drivers.register(driver);
  harness = await Harness.open({
    home,
    conversations: new ConversationStore(home.conversationsDir),
    projects: new ProjectStore(home.projectsFile),
    drivers,
    log: silentLogger,
  });
});

afterEach(async () => {
  await harness.shutdown();
  await fs.rm(dir, { recursive: true, force: true });
});

describe('send and steer include slide annotations', () => {
  it('annotations are appended to the end of the text handed to the agent, and a copy is recorded on the user message as-is (without the resolved paths)', async () => {
    const conversation = await harness.createConversation({ title: '改幻灯片' });
    const annotations: ResolvedSlideAnnotation[] = [{ annotation: note({ deck: { conversationId: conversation.id, path: 'talk' } }), deckPath: 'talk/' }];
    await harness.send({ conversationId: conversation.id, text: '按标注改', commandId: newId('cmd'), slideAnnotations: annotations });
    const session = await until(() => driver.sessions.at(-1));
    const input = await until(() => session.inputs[0]);
    expect(input.startsWith('按标注改\n\n<cuccut-slide-annotations deck="talk/">\n1. 第 3 页')).toBe(true);
    const [message] = userMessages(conversation.id);
    expect(message).toMatchObject({ text: '按标注改', slideAnnotations: [annotations[0]!.annotation] });
  });

  it('messages without annotations do not write this field; annotations carried by an interjection are attached and recorded the same way', async () => {
    const conversation = await harness.createConversation({ title: '插话' });
    await harness.send({ conversationId: conversation.id, text: '做一份幻灯片', commandId: newId('cmd') });
    const session = await until(() => driver.sessions.at(-1));
    await until(() => harness.agentRun(conversation.id).taskId && session.turnId);
    expect(userMessages(conversation.id)[0]).not.toHaveProperty('slideAnnotations');

    const annotation = note({ deck: { conversationId: conversation.id, path: 'talk' }, text: '换个颜色' });
    const result = await harness.steer({
      conversationId: conversation.id,
      text: '顺便改这里',
      commandId: newId('cmd'),
      slideAnnotations: [{ annotation, deckPath: 'talk/' }],
    });
    expect(result).toEqual({ status: 'steered' });
    expect(session.inputs[1]).toContain('<cuccut-slide-annotations deck="talk/">');
    expect(session.inputs[1]).toContain('   Note: 换个颜色');
    expect(userMessages(conversation.id)[1]).toMatchObject({ text: '顺便改这里', slideAnnotations: [annotation] });
  });
});
