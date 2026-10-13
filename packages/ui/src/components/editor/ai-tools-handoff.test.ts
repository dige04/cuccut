import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RpcError } from '@cuccut/protocol';
import { RuntimeSession } from '../../runtime/session.ts';
import { useDirectory } from '../../state/directory-store.ts';
import { conversationVisible, routeVideo, useShell, type Route } from '../../state/shell-store.ts';
import { handToAgent, sendOrQueue } from './ai-tools-handoff.ts';

vi.mock('@react-spectrum/s2', () => ({ ToastQueue: { info: vi.fn(), negative: vi.fn(), neutral: vi.fn() } }));

/** A fake conversation: uses RuntimeSession's own `send`; `client.request` only records the arguments of `conversations.send`. */
function fakeRuntime(fail?: unknown) {
  const sent: Record<string, unknown>[] = [];
  const runtime = Object.create(RuntimeSession.prototype) as RuntimeSession;
  Object.assign(runtime, {
    client: {
      request: async (method: string, params: Record<string, unknown>) => {
        if (method !== 'conversations.send') throw new Error(`没想到会调 ${method}`);
        if (fail) throw fail;
        sent.push(params);
        return { taskId: 'task-1' };
      },
    },
  });
  return { runtime, sent };
}

describe('hand off to agent: send the attached skills together', () => {
  beforeEach(() => {
    useDirectory.setState({ conversations: [] });
    useShell.setState({ queues: {} });
  });

  it('send directly when idle, skills carried as a group in the order they were attached', async () => {
    const { runtime, sent } = fakeRuntime();
    const result = await sendOrQueue(
      runtime,
      'c1',
      { text: '写成博客', attachments: [], skills: [{ id: 'blog-post' }, { id: 'caption-layout' }] },
      null,
    );
    expect(result).toEqual({ status: 'sent', taskId: 'task-1' });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ conversationId: 'c1', text: '写成博客', skills: [{ id: 'blog-post' }, { id: 'caption-layout' }] });
    expect(sent[0]).not.toHaveProperty('skill');
  });

  it('no skills carried when none are attached', async () => {
    const { runtime, sent } = fakeRuntime();
    await sendOrQueue(runtime, 'c1', { text: 'x', attachments: [], skills: [] }, null);
    expect(sent[0]).not.toHaveProperty('skills');
  });

  it('session busy: queued, and the queued message carries the whole skill group', async () => {
    const { runtime } = fakeRuntime(new RpcError('busy', '忙'));
    const result = await sendOrQueue(runtime, 'c1', { text: '再来', attachments: [], skills: [{ id: 'a' }, { id: 'b' }] }, null);
    expect(result).toEqual({ status: 'queued' });
    expect(useShell.getState().queues.c1?.[0]).toMatchObject({ text: '再来', skills: [{ id: 'a' }, { id: 'b' }] });
  });
});

/** A fake conversation: `conversations.create` returns a new conversation, and `conversations.send` records its arguments; `seen` holds the most recent arguments for each method. */
function handoffRuntime() {
  const calls: string[] = [];
  const seen: Record<string, Record<string, unknown>> = {};
  const runtime = Object.create(RuntimeSession.prototype) as RuntimeSession;
  Object.assign(runtime, {
    client: {
      request: async (method: string, params: Record<string, unknown>) => {
        calls.push(method);
        seen[method] = params;
        if (method === 'conversations.create') return { conversation: { id: 'c-new', projectId: params.projectId } };
        if (method === 'conversations.send') return { taskId: 'task-1' };
        throw new Error(`没想到会调 ${method}`);
      },
    },
  });
  return { runtime, calls, seen };
}

describe('hand off to agent: the session opens in front', () => {
  const video = { videoId: 'v1', name: '访谈', path: '/p/访谈', source: { projectId: 'p1', conversationId: null }, relPath: '访谈' };
  const target = { entryId: 'e1' };
  const request = { video, session: 'new' as const, text: '写成博客', attachments: [], skills: [], draftKey: 'tool:v1:blog' };

  beforeEach(() => {
    useDirectory.setState({ conversations: [] });
    useShell.setState({ queues: {}, views: {}, workspaces: {}, workspaceNarrow: false, hiddenBeforeNarrow: false });
  });

  it('video opened from Space: create a session, send it, switch to this session in Home, video kept as a tab on the right', async () => {
    useShell.setState({ route: { tab: 'space', category: 'all', projectId: 'p1', video: target } as unknown as Route });
    const { runtime, calls } = handoffRuntime();
    expect(await handToAgent(runtime, request)).toMatchObject({ conversationId: 'c-new', taskId: 'task-1', drafted: false });
    expect(calls).toEqual(['conversations.create', 'conversations.send']);
    const state = useShell.getState();
    expect(state.route).toMatchObject({ tab: 'home', conversationId: 'c-new' });
    expect(routeVideo(state.route)).toEqual(target);
    expect(conversationVisible(state, 'c-new')).toBe(true);
  });

  it('in a narrow window: selecting the session tab brings the session into view', async () => {
    useShell.setState({
      route: { tab: 'home', conversationId: 'c-old', projectId: null, pane: { kind: 'video', target } } as unknown as Route,
      workspaceNarrow: true,
    });
    const { runtime } = handoffRuntime();
    expect(await handToAgent(runtime, request)).not.toBeNull();
    const state = useShell.getState();
    expect(state.route).toMatchObject({ tab: 'home', conversationId: 'c-new' });
    expect(conversationVisible(state, 'c-new')).toBe(true);
  });

  it('continue current session: no new session, switch to that one', async () => {
    useDirectory.setState({ conversations: [{ id: 'c-old' }] as never });
    useShell.setState({ route: { tab: 'space', category: 'all', projectId: 'p1', video: target } as unknown as Route });
    const { runtime, calls } = handoffRuntime();
    expect(await handToAgent(runtime, { ...request, session: { id: 'c-old' } })).toMatchObject({ conversationId: 'c-old' });
    expect(calls).toEqual(['conversations.send']);
    expect(useShell.getState().route).toMatchObject({ tab: 'home', conversationId: 'c-old' });
    expect(conversationVisible(useShell.getState(), 'c-old')).toBe(true);
  });

  it('video not in a project: the new session is not in a project, shares the working directory of the session the video is in, and no project is created', async () => {
    useDirectory.setState({ conversations: [{ id: 'c-loose', projectId: null }] as never });
    useShell.setState({ route: { tab: 'space', category: 'all', projectId: null, video: target } as unknown as Route });
    const { runtime, calls, seen } = handoffRuntime();
    const loose = { ...video, source: { projectId: null, conversationId: 'c-loose' } };
    expect(await handToAgent(runtime, { ...request, video: loose })).toMatchObject({ conversationId: 'c-new', taskId: 'task-1' });
    expect(calls).toEqual(['conversations.create', 'conversations.send']);
    expect(seen['conversations.create']).toMatchObject({ projectId: null, folderOf: 'c-loose' });
  });
});

describe('hand off to agent: find cuttable speech gaps and refresh stale translations, staying in place', () => {
  const video = { videoId: 'v1', name: '访谈', path: '/p/访谈', source: { projectId: 'p1', conversationId: null }, relPath: '访谈' };
  const target = { entryId: 'e1' };
  const request = { video, session: 'new' as const, text: '找可剪的口', attachments: [], skills: [], draftKey: 'aitool:v1:cleanup', stay: true };

  beforeEach(() => {
    useDirectory.setState({ conversations: [] });
    useShell.setState({ queues: {}, views: {}, workspaces: {}, videoChats: {}, drafts: {}, workspaceNarrow: false, hiddenBeforeNarrow: false });
  });

  it('video open in Home: the session is still created and the message still sent, the route stays put, and the session and task number are returned', async () => {
    const route = { tab: 'home', conversationId: 'c-old', projectId: null, pane: { kind: 'video', target } } as unknown as Route;
    useShell.setState({ route });
    const { runtime, calls } = handoffRuntime();
    expect(await handToAgent(runtime, request)).toMatchObject({ conversationId: 'c-new', taskId: 'task-1', drafted: false });
    expect(calls).toEqual(['conversations.create', 'conversations.send']);
    expect(useShell.getState().route).toEqual(route);
  });

  it('video opened from Space: only recorded as a floating session of this video, no switch to Home', async () => {
    const route = { tab: 'space', category: 'all', projectId: 'p1', video: target } as unknown as Route;
    useShell.setState({ route });
    const { runtime } = handoffRuntime();
    expect(await handToAgent(runtime, request)).toMatchObject({ conversationId: 'c-new' });
    const state = useShell.getState();
    expect(state.route).toEqual(route);
    expect(Object.values(state.videoChats)).toEqual(['c-new']);
  });

  it('message not sent: put into that session\'s input box, session opened in front', async () => {
    useShell.setState({ route: { tab: 'space', category: 'all', projectId: 'p1', video: target } as unknown as Route });
    const runtime = Object.create(RuntimeSession.prototype) as RuntimeSession;
    Object.assign(runtime, {
      client: {
        request: async (method: string) => {
          if (method === 'conversations.create') return { conversation: { id: 'c-new', projectId: 'p1' } };
          throw new Error('断了');
        },
      },
    });
    expect(await handToAgent(runtime, request)).toMatchObject({ conversationId: 'c-new', taskId: null, drafted: true });
    const state = useShell.getState();
    expect(state.drafts['c-new']).toBe('找可剪的口');
    expect(state.route).toMatchObject({ tab: 'home', conversationId: 'c-new' });
  });
});
