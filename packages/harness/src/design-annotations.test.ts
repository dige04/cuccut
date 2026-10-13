import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newId, type DesignAnnotation, type DesignSystemAnnotation, type DriverProbe, type Id } from '@cuccut/protocol';
import { ConversationStore, ProjectStore, resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import { DriverRegistry } from './agent-manager.ts';
import type { AgentDriver, AgentEvent, AgentSession } from './driver.ts';
import {
  Harness,
  withDesignAnnotations,
  withDesignSystemAnnotations,
  type ResolvedDesignAnnotation,
  type ResolvedDesignSystemAnnotation,
  type ResolvedSlideAnnotation,
} from './harness.ts';
import { silentLogger } from './logger.ts';

/** Design-canvas annotations (docs/design/canvas §9) and design-system annotations (§10.6) are sent with messages, alongside design cards and design-system cards (§7.3, §10.5). Fake Driver, all in a temp directory. */

const note = (over: Partial<DesignAnnotation> = {}): DesignAnnotation => ({
  canvas: { conversationId: 'c', path: 'poster' },
  anchor: 'Main.dc.html#el-12',
  board: 'Main.dc.html',
  label: 'Main › Button "Book now"',
  detail: 'Main.dc.html › body > div > button "Book now"',
  text: '按钮再大一点',
  ...over,
});

describe('withDesignAnnotations', () => {
  it('returns unchanged when there are no annotations', () => {
    expect(withDesignAnnotations('改一下', [])).toBe('改一下');
  });

  it('one section per design, in order of first appearance; the numbers are the order within this message\'s design annotations; multi-line comments are indented to align', () => {
    const text = withDesignAnnotations('按标注改', [
      { annotation: note(), canvasPath: 'poster/' },
      { annotation: note({ label: 'Area over Main', detail: undefined, area: true, text: '留白太多\n往上挪' }), canvasPath: '/abs/other/' },
      { annotation: note({ label: 'Cart › Title', text: '加粗' }), canvasPath: 'poster/' },
    ]);
    expect(text).toBe(
      [
        '按标注改',
        '',
        '<cuccut-design-annotations canvas="poster/">',
        '1. Main › Button "Book now"',
        '   Location: Main.dc.html › body > div > button "Book now"',
        '   Note: 按钮再大一点',
        '3. Cart › Title',
        '   Location: Main.dc.html › body > div > button "Book now"',
        '   Note: 加粗',
        '</cuccut-design-annotations>',
        '<cuccut-design-annotations canvas="/abs/other/">',
        '2. Area over Main',
        '   Note: 留白太多',
        '        往上挪',
        '</cuccut-design-annotations>',
      ].join('\n'),
    );
  });
});

const systemNote = (over: Partial<DesignSystemAnnotation> = {}): DesignSystemAnnotation => ({
  system: { conversationId: 'c', path: 'spectrum-2' },
  anchor: 'comp-Button',
  section: 'components',
  label: '设计系统「Spectrum 2」 › Components › 组件 “Button”',
  detail: 'Component "Button" in section components (components/Button/) · comp-Button',
  text: '圆角改小',
  ...over,
});

describe('withDesignSystemAnnotations', () => {
  it('returns unchanged when there are no annotations', () => {
    expect(withDesignSystemAnnotations('改一下', [])).toBe('改一下');
  });

  it('one section per design system, in order of first appearance; the numbers are the order within this message\'s design system annotations; multi-line comments are indented to align', () => {
    const text = withDesignSystemAnnotations('按标注改', [
      { annotation: systemNote(), systemPath: 'spectrum-2/' },
      { annotation: systemNote({ label: 'Colors › token “x”', detail: undefined, text: '改深一点\n对比度不够' }), systemPath: '/abs/ember/' },
      { annotation: systemNote({ label: 'Overview › 封面', text: '换张图' }), systemPath: 'spectrum-2/' },
    ]);
    expect(text).toBe(
      [
        '按标注改',
        '',
        '<cuccut-design-system-annotations system="spectrum-2/">',
        '1. 设计系统「Spectrum 2」 › Components › 组件 “Button”',
        '   Location: Component "Button" in section components (components/Button/) · comp-Button',
        '   Note: 圆角改小',
        '3. Overview › 封面',
        '   Location: Component "Button" in section components (components/Button/) · comp-Button',
        '   Note: 换张图',
        '</cuccut-design-system-annotations>',
        '<cuccut-design-system-annotations system="/abs/ember/">',
        '2. Colors › token “x”',
        '   Note: 改深一点',
        '        对比度不够',
        '</cuccut-design-system-annotations>',
      ].join('\n'),
    );
  });
});

const capabilities: DriverProbe['capabilities'] = { steer: true, approvals: true, resume: false, images: false };

/** Stays open from turn start; accepts interjections. */
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
  dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-design-notes-')));
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

describe('send and steer include design annotations', () => {
  it('the design annotation section comes after the slide annotation section, and a copy is recorded on the user message as-is (without the resolved paths)', async () => {
    const conversation = await harness.createConversation({ title: '改设计稿' });
    const designAnnotations: ResolvedDesignAnnotation[] = [{ annotation: note({ canvas: { conversationId: conversation.id, path: 'poster' } }), canvasPath: 'poster/' }];
    const slideAnnotations: ResolvedSlideAnnotation[] = [
      {
        annotation: { deck: { conversationId: conversation.id, path: 'talk' }, anchor: 'a', label: '第 1 页', text: '换图' },
        deckPath: 'talk/',
      },
    ];
    await harness.send({ conversationId: conversation.id, text: '按标注改', commandId: newId('cmd'), slideAnnotations, designAnnotations });
    const session = await until(() => driver.sessions.at(-1));
    const input = await until(() => session.inputs[0]);
    const slideAt = input.indexOf('<cuccut-slide-annotations deck="talk/">');
    const designAt = input.indexOf('<cuccut-design-annotations canvas="poster/">\n1. Main › Button');
    expect(slideAt).toBeGreaterThan(0);
    expect(designAt).toBeGreaterThan(slideAt);
    expect(input.trimEnd().endsWith('</cuccut-design-annotations>')).toBe(true);
    const [message] = userMessages(conversation.id);
    expect(message).toMatchObject({ text: '按标注改', designAnnotations: [designAnnotations[0]!.annotation] });
  });

  it('messages without annotations do not write this field; annotations carried by an interjection are attached and recorded the same way', async () => {
    const conversation = await harness.createConversation({ title: '插话' });
    await harness.send({ conversationId: conversation.id, text: '做一份设计稿', commandId: newId('cmd') });
    const session = await until(() => driver.sessions.at(-1));
    await until(() => harness.agentRun(conversation.id).taskId && session.turnId);
    expect(userMessages(conversation.id)[0]).not.toHaveProperty('designAnnotations');

    const annotation = note({ canvas: { conversationId: conversation.id, path: 'poster' }, text: '换个颜色' });
    const result = await harness.steer({
      conversationId: conversation.id,
      text: '顺便改这里',
      commandId: newId('cmd'),
      designAnnotations: [{ annotation, canvasPath: 'poster/' }],
    });
    expect(result).toEqual({ status: 'steered' });
    expect(session.inputs[1]).toContain('<cuccut-design-annotations canvas="poster/">');
    expect(session.inputs[1]).toContain('   Note: 换个颜色');
    expect(userMessages(conversation.id)[1]).toMatchObject({ text: '顺便改这里', designAnnotations: [annotation] });
  });
});

describe('send and steer include design system annotations', () => {
  it('the design system annotation section comes after the design annotation section, and a copy is recorded on the user message as-is (without the resolved paths)', async () => {
    const conversation = await harness.createConversation({ title: '改设计系统' });
    const designAnnotations: ResolvedDesignAnnotation[] = [{ annotation: note({ canvas: { conversationId: conversation.id, path: 'poster' } }), canvasPath: 'poster/' }];
    const designSystemAnnotations: ResolvedDesignSystemAnnotation[] = [
      { annotation: systemNote({ system: { conversationId: conversation.id, path: 'spectrum-2' } }), systemPath: 'spectrum-2/' },
    ];
    await harness.send({ conversationId: conversation.id, text: '按标注改', commandId: newId('cmd'), designAnnotations, designSystemAnnotations });
    const session = await until(() => driver.sessions.at(-1));
    const input = await until(() => session.inputs[0]);
    const designAt = input.indexOf('<cuccut-design-annotations canvas="poster/">');
    const systemAt = input.indexOf('<cuccut-design-system-annotations system="spectrum-2/">\n1. 设计系统「Spectrum 2」');
    expect(designAt).toBeGreaterThan(0);
    expect(systemAt).toBeGreaterThan(designAt);
    expect(input.trimEnd().endsWith('</cuccut-design-system-annotations>')).toBe(true);
    const [message] = userMessages(conversation.id);
    expect(message).toMatchObject({ text: '按标注改', designSystemAnnotations: [designSystemAnnotations[0]!.annotation] });
  });

  it('messages without annotations do not write this field; annotations carried by an interjection are attached and recorded the same way', async () => {
    const conversation = await harness.createConversation({ title: '插话' });
    await harness.send({ conversationId: conversation.id, text: '做一套设计系统', commandId: newId('cmd') });
    const session = await until(() => driver.sessions.at(-1));
    await until(() => harness.agentRun(conversation.id).taskId && session.turnId);
    expect(userMessages(conversation.id)[0]).not.toHaveProperty('designSystemAnnotations');

    const annotation = systemNote({ system: { conversationId: conversation.id, path: 'spectrum-2' }, text: '主色再亮一点' });
    const result = await harness.steer({
      conversationId: conversation.id,
      text: '顺便改这里',
      commandId: newId('cmd'),
      designSystemAnnotations: [{ annotation, systemPath: 'spectrum-2/' }],
    });
    expect(result).toEqual({ status: 'steered' });
    expect(session.inputs[1]).toContain('<cuccut-design-system-annotations system="spectrum-2/">');
    expect(session.inputs[1]).toContain('   Note: 主色再亮一点');
    expect(userMessages(conversation.id)[1]).toMatchObject({ text: '顺便改这里', designSystemAnnotations: [annotation] });
  });
});

describe('recordDesignCreated (docs/design/canvas §7.3)', () => {
  it('one entry per design: when it passes again, the title, artboard count and task are updated and the id stays the same; other designs get their own entry', async () => {
    const conversation = await harness.createConversation({ title: '设计稿卡片' });
    const target = { conversationId: conversation.id, path: 'poster' };
    const cards = () => harness.getConversation(conversation.id).items.filter((item) => item.kind === 'design-created');
    harness.recordDesignCreated(conversation.id, 'task-1', { target, title: 'Poster', boardCount: 1 });
    const [first] = cards();
    expect(first).toMatchObject({ kind: 'design-created', taskId: 'task-1', target, title: 'Poster', boardCount: 1 });
    expect(first!.id.startsWith('design')).toBe(true);
    harness.recordDesignCreated(conversation.id, 'task-2', { target: { ...target }, title: 'Spring Poster', boardCount: 3 });
    expect(cards()).toEqual([{ ...first, taskId: 'task-2', title: 'Spring Poster', boardCount: 3 }]);
    harness.recordDesignCreated(conversation.id, null, { target: { conversationId: conversation.id, path: 'menu' }, title: 'Menu', boardCount: 2 });
    expect(cards()).toHaveLength(2);
    harness.recordDesignCreated('missing', null, { target, title: 'x', boardCount: 1 });
  });
});

describe('recordDesignSystemCreated (docs/design/canvas §10.5)', () => {
  it('one entry per design system: when it passes again, the title and task are updated and the id stays the same; other design systems get their own entry', async () => {
    const conversation = await harness.createConversation({ title: '设计系统卡片' });
    const target = { conversationId: conversation.id, path: 'acme' };
    const cards = () => harness.getConversation(conversation.id).items.filter((item) => item.kind === 'design-system-created');
    harness.recordDesignSystemCreated(conversation.id, 'task-1', { target, title: 'Acme' });
    const [first] = cards();
    expect(first).toMatchObject({ kind: 'design-system-created', taskId: 'task-1', target, title: 'Acme' });
    expect(first!.id.startsWith('dsys')).toBe(true);
    harness.recordDesignSystemCreated(conversation.id, 'task-2', { target: { ...target }, title: 'Acme 2' });
    expect(cards()).toEqual([{ ...first, taskId: 'task-2', title: 'Acme 2' }]);
    harness.recordDesignSystemCreated(conversation.id, null, { target: { conversationId: conversation.id, path: 'ember' }, title: 'Ember' });
    expect(cards()).toHaveLength(2);
    harness.recordDesignSystemCreated('missing', null, { target, title: 'x' });
  });
});
