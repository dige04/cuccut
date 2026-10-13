import type { Id } from '@cuccut/protocol';
import { ToastQueue } from '@react-spectrum/s2';
import { HOME_COPY } from '../../copy.ts';
import { addMaterials, EMPTY_HOME_BRIEF, MAX_HOME_MATERIALS } from '../../model/home-brief.ts';
import { workspaceKey } from '../../model/workspace.ts';
import { NEW_DRAFT, useShell } from '../../state/shell-store.ts';
import { useStartBrief } from '../../state/start-brief-store.ts';

/** Key for the start page draft: same as in start-page.tsx, separated by the project on the route. */
export function startDraftKey(projectId: Id | null): string {
  return projectId ? `${NEW_DRAFT}:${projectId}` : NEW_DRAFT;
}

/**
 * Arrived at the start page from elsewhere with a preset (prototype `app.newProject(preset)`: Space's “Create video from file”, the help center, and “Use local file instead” after an import failure):
 * lands on the start page of project `projectId`. `prompt`: if the input box is empty, fill in this sentence (existing text is left alone); `materials`: attached as local materials handed to the Agent.
 * If the editor is open, it stays open (the feature area's tab follows to that start page).
 */
export function openHome(projectId: Id | null, prefill: { prompt?: string; materials?: readonly string[] } = {}): void {
  const key = startDraftKey(projectId);
  const shell = useShell.getState();
  if (prefill.prompt && !(shell.drafts[key] ?? '').trim()) shell.setDraft(key, prefill.prompt);
  if (prefill.materials?.length) {
    const current = useStartBrief.getState().briefs[key] ?? EMPTY_HOME_BRIEF;
    const { list, rejected } = addMaterials(current.materials, prefill.materials);
    useStartBrief.getState().patch(key, { materials: list });
    if (rejected) ToastQueue.neutral(HOME_COPY.materialsFull(MAX_HOME_MATERIALS, rejected), { timeout: 5000 });
  }
  const { route } = shell;
  // Coming from another start page, the editor's tab moves along (same as switching projects on the start page); session tabs stay in the session.
  const fromStart = route.tab === 'home' && route.conversationId === null;
  const pane = fromStart ? route.pane : undefined;
  if (fromStart) {
    const from = workspaceKey(null, route.projectId);
    const to = workspaceKey(null, projectId);
    if (from !== to) shell.carryWorkspace(from, to);
  }
  shell.go({ tab: 'home', conversationId: null, projectId, ...(pane ? { pane } : {}) });
}
