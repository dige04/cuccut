import type { Conversation, Project } from '@cuccut/protocol';
import { untitled } from '../copy.ts';
import type { RuntimeSession } from '../runtime/session.ts';
import { HOME, type Route } from '../state/shell-store.ts';
import { S } from './shell-copy.ts';

/** How a row action reports back: a failure, or a done action the user can take back. */
export interface RowToasts {
  negative(message: string): void;
  undoable(message: string, undo: () => void): void;
}

/**
 * What a session or project row can do, wherever the row is listed (the sessions drawer, the landing's Recent).
 * One set of commands so both lists behave the same: archiving acts at once and offers Undo.
 */
export interface RowActions {
  togglePin(conversation: Conversation): void;
  archive(conversation: Conversation): void;
  rename(conversation: Conversation, title: string): Promise<void>;
  toggleProjectPin(project: Project): void;
  archiveProject(project: Project): void;
  renameProject(project: Project, name: string): Promise<void>;
}

export function rowActions({
  runtime,
  route,
  go,
  toast,
}: {
  runtime: Pick<RuntimeSession, 'updateConversation' | 'updateProject'>;
  /** The route at the moment of the action (archiving what is open goes back home). */
  route: () => Route;
  go: (route: Route) => void;
  toast: RowToasts;
}): RowActions {
  const fail = (error: Error) => toast.negative(error.message);
  return {
    togglePin: (conversation) => void runtime.updateConversation(conversation.id, { pinned: !conversation.pinned }).catch(fail),
    archive: (conversation) => {
      const title = conversation.title || untitled();
      runtime
        .updateConversation(conversation.id, { archived: true })
        .then(() => {
          const current = route();
          if (current.tab === 'home' && current.conversationId === conversation.id) go(HOME);
          toast.undoable(S.sidebar.archived(title), () => void runtime.updateConversation(conversation.id, { archived: false }).catch(fail));
        })
        .catch(fail);
    },
    rename: (conversation, title) => runtime.updateConversation(conversation.id, { title }),
    toggleProjectPin: (project) => void runtime.updateProject(project.id, { pinned: !project.pinned }).catch(fail),
    archiveProject: (project) => {
      runtime
        .updateProject(project.id, { archived: true })
        .then(() => {
          const current = route();
          if (current.tab === 'home' && current.projectId === project.id) go(HOME);
          toast.undoable(S.sidebar.archived(project.name), () => void runtime.updateProject(project.id, { archived: false }).catch(fail));
        })
        .catch(fail);
    },
    renameProject: async (project, name) => {
      await runtime.updateProject(project.id, { name });
    },
  };
}
