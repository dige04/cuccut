import { describe, expect, it, vi } from 'vitest';
import type { Conversation, Project } from '@cuccut/protocol';
import { HOME, type Route } from '../state/shell-store.ts';
import { rowActions } from './row-actions.ts';
import { S } from './shell-copy.ts';

const conversation = { id: 'c1', title: 'Trailer', pinned: false, archived: false, projectId: null } as unknown as Conversation;
const project = { id: 'p1', name: 'Launch', pinned: true, archived: false } as unknown as Project;

function setup(route: Route = HOME) {
  const runtime = {
    updateConversation: vi.fn(async () => {}),
    updateProject: vi.fn(async () => project),
  };
  const go = vi.fn();
  const toast = { negative: vi.fn(), undoable: vi.fn() };
  const actions = rowActions({ runtime, route: () => route, go, toast });
  return { runtime, go, toast, actions };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('rowActions', () => {
  it('pins and unpins sessions and projects', async () => {
    const { runtime, actions } = setup();
    actions.togglePin(conversation);
    actions.toggleProjectPin(project);
    await settle();
    expect(runtime.updateConversation).toHaveBeenCalledWith('c1', { pinned: true });
    expect(runtime.updateProject).toHaveBeenCalledWith('p1', { pinned: false });
  });

  it('archives a session at once and offers Undo', async () => {
    const { runtime, toast, go, actions } = setup();
    actions.archive(conversation);
    await settle();
    expect(runtime.updateConversation).toHaveBeenCalledWith('c1', { archived: true });
    expect(go).not.toHaveBeenCalled();
    expect(toast.undoable).toHaveBeenCalledWith(S.sidebar.archived('Trailer'), expect.any(Function));
    toast.undoable.mock.calls[0]?.[1]();
    expect(runtime.updateConversation).toHaveBeenLastCalledWith('c1', { archived: false });
  });

  it('archives a project with Undo and leaves it when it is open', async () => {
    const { runtime, toast, go, actions } = setup({ tab: 'home', conversationId: null, projectId: 'p1' });
    actions.archiveProject(project);
    await settle();
    expect(runtime.updateProject).toHaveBeenCalledWith('p1', { archived: true });
    expect(go).toHaveBeenCalledWith(HOME);
    toast.undoable.mock.calls[0]?.[1]();
    expect(runtime.updateProject).toHaveBeenLastCalledWith('p1', { archived: false });
  });

  it('reports a failed archive and offers no Undo', async () => {
    const { runtime, toast, actions } = setup();
    runtime.updateConversation.mockRejectedValueOnce(new Error('offline'));
    actions.archive(conversation);
    await settle();
    expect(toast.negative).toHaveBeenCalledWith('offline');
    expect(toast.undoable).not.toHaveBeenCalled();
  });

  it('renames through the same update commands', async () => {
    const { runtime, actions } = setup();
    await actions.rename(conversation, 'Teaser');
    await actions.renameProject(project, 'Launch 2');
    expect(runtime.updateConversation).toHaveBeenCalledWith('c1', { title: 'Teaser' });
    expect(runtime.updateProject).toHaveBeenCalledWith('p1', { name: 'Launch 2' });
  });
});
