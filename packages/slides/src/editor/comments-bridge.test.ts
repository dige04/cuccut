import { describe, expect, it, vi } from 'vitest';
import type { EditorPoint, EditorThread, EditorToHostMessage, HostToEditorMessage } from '../editor-messages.ts';
import { readEditorMessage, readHostMessage, SUGGESTED_PROMPT_MAX } from '../editor-messages.ts';
import type { CommentAnchorHandlers } from './slides-host.ts';
import { createCommentsBridge, domPinLayer, type ParentLink, type PinLayer } from './comments-bridge.ts';

/** Fake parent-window channel: records messages sent by the iframe; `deliver` simulates messages sent from the parent window. */
function fakeLink() {
  const sent: EditorToHostMessage[] = [];
  const listeners = new Set<(message: HostToEditorMessage) => void>();
  const link: ParentLink = {
    post: message => sent.push(message),
    onMessage: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const deliver = (message: HostToEditorMessage) => listeners.forEach(l => l(message));
  return { link, sent, deliver, listeners };
}

function fakePins() {
  const renders: { positions: Record<string, EditorPoint>; threads: readonly EditorThread[] }[] = [];
  let clears = 0;
  const pins: PinLayer = {
    render: (positions, threads) => renders.push({ positions, threads }),
    clear: () => (clears += 1),
  };
  return { pins, renders, clears: () => clears };
}

function fakeHandlers() {
  return {
    mode: vi.fn<(on: boolean) => void>(),
    threads: vi.fn<(list: { id: string; anchor: string; active: boolean }[]) => void>(),
    composing: vi.fn<(on: boolean) => void>(),
    move: vi.fn(async () => null),
    hotkey: true,
    reveal: vi.fn<(id: string) => void>(),
  } satisfies CommentAnchorHandlers;
}

const setup = async () => {
  const parent = fakeLink();
  const layer = fakePins();
  let n = 0;
  const bridge = createCommentsBridge(parent.link, layer.pins, () => `r${++n}`);
  const handlers = fakeHandlers();
  const ctl = await bridge.capability.customAnchors(handlers);
  return { parent, layer, bridge, handlers, ctl };
};

describe('createCommentsBridge', () => {
  it('compose converts document coordinates to viewport coordinates and sends them to the parent; fulfilled with opened once the comment box opens', async () => {
    const { parent, handlers, ctl } = await setup();
    vi.stubGlobal('scrollX', 10);
    vi.stubGlobal('scrollY', 100);
    try {
      const result = ctl.compose('slide:a#h1', { x: 50, y: 300 }, { label: '标题', detail: 'h1 标题', area: false });
      expect(parent.sent).toEqual([{ type: 'editor:compose', requestId: 'r1', anchor: 'slide:a#h1', point: { x: 40, y: 200 }, label: '标题', detail: 'h1 标题' }]);
      expect(handlers.composing).toHaveBeenLastCalledWith(true);
      parent.deliver({ type: 'editor:compose-result', requestId: 'r1', opened: true });
      expect(await result).toEqual({ opened: true });
      parent.deliver({ type: 'editor:composer-closed', requestId: 'r1' });
      expect(handlers.composing).toHaveBeenLastCalledWith(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('fulfilled with opened:false and ends composing when the parent doesn\'t open the comment box; area included', async () => {
    const { parent, handlers, ctl } = await setup();
    const result = ctl.compose('area:a:0.1,0.1,0.2,0.2', { x: 0, y: 0 }, { label: '区域', area: true });
    expect(parent.sent[0]).toMatchObject({ type: 'editor:compose', area: true });
    expect(parent.sent[0]).not.toHaveProperty('section');
    parent.deliver({ type: 'editor:compose-result', requestId: 'r1', opened: false });
    expect(await result).toEqual({ opened: false });
    expect(handlers.composing).toHaveBeenLastCalledWith(false);
  });

  it('times out as not opened when the parent never responds', async () => {
    vi.useFakeTimers();
    try {
      const { ctl, handlers } = await setup();
      const result = ctl.compose('x', { x: 0, y: 0 }, { label: 'x' });
      vi.advanceTimersByTime(10_000);
      expect(await result).toEqual({ opened: false });
      expect(handlers.composing).toHaveBeenLastCalledWith(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a new compose first treats the previous one as not opened', async () => {
    const { ctl, parent } = await setup();
    const first = ctl.compose('a', { x: 0, y: 0 }, { label: 'a' });
    ctl.compose('b', { x: 0, y: 0 }, { label: 'b' });
    expect(await first).toEqual({ opened: false });
    expect(parent.sent.map(m => (m.type === 'editor:compose' ? m.requestId : m.type))).toEqual(['r1', 'r2']);
  });

  it('annotation mode: runtime and parent can both toggle, changes notify the other side; repeated setting doesn\'t notify again', async () => {
    const { parent, handlers, ctl, bridge, layer } = await setup();
    ctl.enterMode();
    ctl.enterMode();
    expect(bridge.mode).toBe(true);
    expect(handlers.mode.mock.calls).toEqual([[true]]);
    expect(parent.sent).toEqual([{ type: 'editor:mode', on: true }]);
    parent.deliver({ type: 'editor:set-mode', on: false });
    expect(handlers.mode).toHaveBeenLastCalledWith(false);
    expect(parent.sent.at(-1)).toEqual({ type: 'editor:mode', on: false });
    expect(layer.clears()).toBeGreaterThan(0);
  });

  it('annotations from the parent handed to runtime (active false), given again when annotation mode is turned on', async () => {
    const { parent, handlers, ctl } = await setup();
    parent.deliver({ type: 'editor:threads', threads: [{ id: 't1', anchor: 'slide:a#p', n: 1 }] });
    expect(handlers.threads).toHaveBeenLastCalledWith([{ id: 't1', anchor: 'slide:a#p', active: false }]);
    handlers.threads.mockClear();
    ctl.enterMode();
    expect(handlers.threads).toHaveBeenCalledWith([{ id: 't1', anchor: 'slide:a#p', active: false }]);
  });

  it('design system sections sent with compose, returned with annotations', async () => {
    const { parent, handlers, ctl } = await setup();
    void ctl.compose('comp-Button', { x: 0, y: 0 }, { label: 'Components › 组件 “Button”', section: 'components' });
    expect(parent.sent[0]).toMatchObject({ type: 'editor:compose', anchor: 'comp-Button', section: 'components' });
    parent.deliver({ type: 'editor:threads', threads: [{ id: 't1', anchor: 'comp-Button', n: 1, section: 'components' }] });
    expect(handlers.threads).toHaveBeenLastCalledWith([{ id: 't1', anchor: 'comp-Button', active: false, section: 'components' }]);
  });

  it('placed positions drawn with the parent\'s numbering; when annotations change, redrawn at the last positions', async () => {
    const { parent, layer, ctl } = await setup();
    const thread = { id: 't1', anchor: 'slide:a#p', n: 3 };
    parent.deliver({ type: 'editor:threads', threads: [thread] });
    ctl.placed({ t1: { x: 5, y: 6 } });
    expect(layer.renders.at(-1)).toEqual({ positions: { t1: { x: 5, y: 6 } }, threads: [thread] });
    parent.deliver({ type: 'editor:threads', threads: [] });
    expect(layer.renders.at(-1)).toEqual({ positions: { t1: { x: 5, y: 6 } }, threads: [] });
  });

  it('reveal forwarded to runtime; after dispose no messages received, pending compose treated as not opened', async () => {
    const { parent, handlers, ctl, bridge } = await setup();
    parent.deliver({ type: 'editor:reveal', id: 't9' });
    expect(handlers.reveal).toHaveBeenCalledWith('t9');
    const result = ctl.compose('a', { x: 0, y: 0 }, { label: 'a' });
    bridge.dispose();
    expect(await result).toEqual({ opened: false });
    expect(parent.listeners.size).toBe(0);
  });

  it('when annotation mode was already on before customAnchors, handlers get synced immediately on receipt', async () => {
    const parent = fakeLink();
    const bridge = createCommentsBridge(parent.link, fakePins().pins);
    parent.deliver({ type: 'editor:set-mode', on: true });
    const handlers = fakeHandlers();
    const ctl = await bridge.capability.customAnchors(handlers);
    expect(handlers.mode).toHaveBeenCalledWith(true);
    expect(ctl.areas).toBe(true);
  });
});

describe('postMessage validation', () => {
  it('editor messages: only listed types allowed, field types and lengths checked', () => {
    expect(readEditorMessage({ type: 'editor:ready', canEdit: false })).toEqual({ type: 'editor:ready', canEdit: false });
    expect(readEditorMessage({ type: 'editor:compose', requestId: 'r', anchor: 'a', point: { x: 1, y: 2 }, label: 'l', extra: 1 })).toEqual({
      type: 'editor:compose',
      requestId: 'r',
      anchor: 'a',
      point: { x: 1, y: 2 },
      label: 'l',
    });
    expect(readEditorMessage({ type: 'editor:compose', requestId: 'r', anchor: 'a', point: { x: 1, y: 2 }, label: 'l', section: 'colors' })).toMatchObject({
      section: 'colors',
    });
    expect(readEditorMessage({ type: 'editor:suggest-prompt', requestId: 'p', prompt: 'Fix slide 2' })).toEqual({
      type: 'editor:suggest-prompt',
      requestId: 'p',
      prompt: 'Fix slide 2',
    });
    for (const bad of [
      null,
      'editor:ready',
      { type: 'slides:unknown' },
      { type: 'editor:ready' },
      { type: 'editor:compose', requestId: 'r', anchor: 'a', point: { x: Number.NaN, y: 0 }, label: 'l' },
      { type: 'editor:compose', requestId: 'r', anchor: 'a', point: { x: 0, y: 0 }, label: 'l'.repeat(1001) },
      { type: 'editor:compose', requestId: 'r', anchor: 'a', point: { x: 0, y: 0 }, label: 'l', section: 1 },
      { type: 'editor:compose', requestId: 'r', anchor: 'a', point: { x: 0, y: 0 }, label: 'l', section: 's'.repeat(201) },
      { type: 'editor:external-change', paths: [1] },
      { type: 'editor:suggest-prompt', requestId: 'p', prompt: '  ' },
      { type: 'editor:suggest-prompt', requestId: 'p', prompt: 'x'.repeat(SUGGESTED_PROMPT_MAX + 1) },
      { type: 'editor:suggest-prompt', prompt: 'Fix' },
    ]) {
      expect(readEditorMessage(bad), JSON.stringify(bad)).toBe(null);
    }
  });

  it('parent messages: threads takes only id, anchor, n and section', () => {
    expect(readHostMessage({ type: 'editor:threads', threads: [{ id: 't', anchor: 'a', n: 1, body: 'x' }] })).toEqual({
      type: 'editor:threads',
      threads: [{ id: 't', anchor: 'a', n: 1 }],
    });
    expect(readHostMessage({ type: 'editor:threads', threads: [{ id: 't', anchor: 'a', n: 1, section: 'colors' }] })).toEqual({
      type: 'editor:threads',
      threads: [{ id: 't', anchor: 'a', n: 1, section: 'colors' }],
    });
    expect(readHostMessage({ type: 'editor:threads', threads: [{ id: 't', anchor: 'a' }] })).toBe(null);
    expect(readHostMessage({ type: 'editor:threads', threads: [{ id: 't', anchor: 'a', n: 1, section: 2 }] })).toBe(null);
    expect(readHostMessage({ type: 'editor:flush', requestId: 'f' })).toEqual({ type: 'editor:flush', requestId: 'f' });
    expect(readHostMessage({ type: 'editor:suggest-prompt-result', requestId: 'p', ok: false })).toEqual({
      type: 'editor:suggest-prompt-result',
      requestId: 'p',
      ok: false,
    });
    expect(readHostMessage({ type: 'editor:suggest-prompt-result', requestId: 'p' })).toBe(null);
    expect(readHostMessage({ type: 'editor:ready', canEdit: true })).toBe(null);
  });
});

describe('domPinLayer', () => {
  /** Only the DOM pieces that domPinLayer uses. */
  function fakeDocument() {
    type Node = { textContent: string; style: { cssText: string }; children: Node[]; isConnected: boolean; setAttribute(): void; replaceChildren(...nodes: Node[]): void };
    const node = (): Node => ({
      textContent: '',
      style: { cssText: '' },
      children: [],
      isConnected: false,
      setAttribute() {},
      replaceChildren(...nodes) {
        this.children = nodes;
      },
    });
    const layers: Node[] = [];
    const doc = {
      createElement: node,
      body: {
        appendChild(child: Node) {
          child.isConnected = true;
          layers.push(child);
        },
      },
    };
    return { doc: doc as unknown as Document, layers };
  }

  it('n not greater than 0 is a temporary jump from the parent, no marker drawn', () => {
    const { doc, layers } = fakeDocument();
    domPinLayer(doc).render({ a: { x: 10, y: 20 }, tmp: { x: 30, y: 40 }, gone: { x: 0, y: 0 } }, [
      { id: 'a', anchor: 's1#t', n: 2 },
      { id: 'tmp', anchor: 's2#t', n: 0 },
      { id: 'missing', anchor: 's3#t', n: 3 },
    ]);
    expect(layers).toHaveLength(1);
    expect(layers[0]!.children.map(pin => pin.textContent)).toEqual(['2']);
    expect(layers[0]!.children[0]!.style.cssText).toContain('left:10px');
  });
});
