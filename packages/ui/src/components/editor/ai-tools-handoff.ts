import {
  RpcError,
  newId,
  nowIso,
  type AgentMode,
  type AttachmentRef,
  type DriverId,
  type EditorContext,
  type Id,
  type SkillSendRef,
  type VideoRef,
} from '@cuccut/protocol';
import { ToastQueue } from '@react-spectrum/s2';
import { mergeDraft, planHandoff } from '../../model/ai-tools-handoff.ts';
import { sendFailureMessage } from '../../model/agent-skills.ts';
import { enqueueMessage } from '../../model/message-queue.ts';
import { targetKey, workspaceKey } from '../../model/workspace.ts';
import { setDefaultAccessMode } from '../../runtime/agent-commands.ts';
import { drainQueue } from '../../runtime/message-queue-runner.ts';
import type { RuntimeSession } from '../../runtime/session.ts';
import { captureEditorContext } from '../../state/agent-context.ts';
import { useDirectory } from '../../state/directory-store.ts';
import { useDraftImages } from '../../state/draft-images-store.ts';
import { useDraftSkills } from '../../state/draft-skills-store.ts';
import { routeVideo, useShell } from '../../state/shell-store.ts';
import { AI_TOOLS_COPY as C } from './ai-tools-copy.ts';

/** A message to send: the body, the attachments already uploaded, and the attached skills. */
export interface OutgoingMessage {
  text: string;
  attachments: AttachmentRef[];
  skills: SkillSendRef[];
}

/**
 * Sends into the conversation. If it is busy (or messages are already queued ahead), it goes to the back of the queue and is sent in order after the current turn ends (same as the conversation page's input box). A message that is sent carries the task ID; a queued one does not.
 * Other errors are thrown to the caller.
 */
export async function sendOrQueue(
  runtime: RuntimeSession,
  conversationId: Id,
  message: OutgoingMessage,
  context: EditorContext | null,
): Promise<{ status: 'sent'; taskId: Id } | { status: 'queued' }> {
  const { text, attachments, skills } = message;
  const enqueue = () =>
    useShell.getState().setQueue(conversationId, (queue) =>
      enqueueMessage(queue, {
        id: newId('queue'),
        text,
        attachments,
        ...(context ? { context } : {}),
        ...(skills.length ? { skills } : {}),
        queuedAt: nowIso(),
      }),
    );
  const busy = (useDirectory.getState().conversations.find((c) => c.id === conversationId)?.activeTaskId ?? null) !== null;
  if (busy || useShell.getState().queues[conversationId]?.length) {
    enqueue();
    if (!busy) void drainQueue(runtime, conversationId);
    return { status: 'queued' };
  }
  try {
    const taskId = await runtime.send(
      conversationId,
      text,
      context ?? undefined,
      attachments.map((a) => a.id),
      undefined,
      skills,
    );
    return { status: 'sent', taskId };
  } catch (error) {
    // A task just started (from another window or entry point): queue this message so it is not lost.
    if (!(error instanceof RpcError && error.code === 'busy')) throw error;
    enqueue();
    return { status: 'queued' };
  }
}

/** One request to hand to the Agent (product design §5.10 “hand to Agent”). */
export interface HandoffRequest extends OutgoingMessage {
  video: VideoRef | null;
  /** The “Conversation” row's choice: start a new one, or continue this one. */
  session: 'new' | { id: Id };
  /** New conversation: carries only the access mode and Agent · model · effort chosen on this page; the rest is given by the Runtime according to preference (same as the floating conversation). */
  create?: { accessMode?: AgentMode; driverId?: DriverId; model?: string | null; effort?: string | null };
  /** The prompt box's draft key: if not sent, the attachments move from here to that conversation's input box. */
  draftKey: string;
  /** Stay on the page (`agentStaysOnPage`): the conversation is still created and the message still sent, but it is not switched to; the tool page draws the progress in place. */
  stay?: boolean;
}

/** Handed off: the conversation it went to. A message sent directly carries its task ID; a queued one, or one not sent (put into that conversation's input box), has none. */
export interface Handoff {
  conversationId: Id;
  taskId: Id | null;
  /** The message was not sent and was put into that conversation's input box: the conversation has already been brought into view (also for `stay`), and the tool page has no progress to draw. */
  drafted: boolean;
  /** At the moment of handing off: a queued message is matched to the task that later started (`agentRunState`). */
  handedAt: string;
}

/**
 * Brings that conversation into view: the conversation on the left, and the open video kept as a feature-area tab on the right. A video opened from Space also switches to Home (the floating conversation is only the input box of a new conversation and does not show the conversation, product design §5.1). The full view falls back to split view; on a narrow window the conversation tab is selected (a user click, not the Agent taking over the interface).
 */
export function showConversation(conversationId: Id): void {
  const target = routeVideo(useShell.getState().route);
  if (target) useShell.getState().openPane({ kind: 'video', target }, { conversationId });
  else useShell.getState().go({ tab: 'home', conversationId, projectId: null });
  useShell.getState().revealConversation();
}

/**
 * Hand off to the Agent (prototype tool-prompt.jsx `onStart` → `sendToAgent`): the parameters page is the confirmation. According to the “Conversation” row, either start a new conversation (default) or continue the one this video currently has,
 * and **send** the message in the prompt box directly, with its attachments and attached skills; if the conversation being continued is busy, the message is queued. That conversation is brought into view (`showConversation`);
 * `stay` does not switch to it, and only records it as this video's floating conversation in Space (prototype store.jsx `land`'s `stay`).
 * Returns null: nothing was sent and the prompt box is left as it is. If the conversation was created but the message was not sent, the message, attachments and skills are placed in that conversation's input box, which also counts as handed off.
 */
export async function handToAgent(runtime: RuntimeSession, request: HandoffRequest): Promise<Handoff | null> {
  const { video, session, create, draftKey, stay } = request;
  const source = video?.source ?? null;
  const plan = planHandoff({ session, source, conversations: useDirectory.getState().conversations });
  if (plan.kind === 'none') {
    ToastQueue.negative(C.noConversation, { timeout: 5000 });
    return null;
  }
  const shell = useShell.getState();
  const shown = routeVideo(shell.route);
  const floating = shell.route.tab === 'space' && shown ? targetKey(shown) : null;
  // Editor context follows the video's own source: the project it belongs to, or the no-project conversation it sits in (a new conversation and the continued one both share its working directory).
  const scope = { projectId: source?.projectId ?? null, conversationId: source?.conversationId ?? null };
  let conversationId: Id;
  if (plan.kind === 'create') {
    try {
      const folderOf = plan.projectId === null ? { folderOf: plan.folderOf } : {};
      conversationId = (await runtime.createConversation(plan.projectId, { ...create, ...folderOf })).id;
      // The access mode chosen here is also recorded as the default for new conversations (same as the floating conversation).
      if (create?.accessMode) void setDefaultAccessMode(runtime, create.accessMode).catch(() => {});
    } catch (error) {
      ToastQueue.negative(C.createFailed(error instanceof Error ? error.message : String(error)), { timeout: 5000 });
      return null;
    }
  } else conversationId = plan.conversationId;
  // The editor's state at this moment: version, selection and playhead are those at the moment the button was pressed.
  const context = captureEditorContext(scope);

  // The floating conversation records this one: the minimized icon lights up based on it.
  if (floating) useShell.getState().setVideoChat(floating, conversationId);
  if (!stay) {
    // Creating a conversation takes a while, so use the position at that time. A tab that was open on the project start page is carried over to the new conversation (same as when the first message is sent from Home).
    const now = useShell.getState().route;
    if (plan.kind === 'create' && now.tab === 'home' && now.conversationId === null) {
      useShell.getState().carryWorkspace(workspaceKey(null, now.projectId), conversationId);
    }
    showConversation(conversationId);
  }
  const handedAt = nowIso();
  try {
    const result = await sendOrQueue(runtime, conversationId, request, context);
    ToastQueue.info(result.status === 'queued' ? C.queued : plan.kind === 'create' ? C.sentNew : C.sentCurrent, { timeout: 5000 });
    return { conversationId, taskId: result.status === 'sent' ? result.taskId : null, drafted: false, handedAt };
  } catch (error) {
    ToastQueue.negative(sendFailureMessage(error), { timeout: 5000 });
    // Not sent: the message is placed in that conversation's input box (appended after existing text); images and skills move with it, and nothing is dropped. Local file paths are already written into the message.
    const after = useShell.getState();
    after.setDraft(conversationId, mergeDraft(after.drafts[conversationId], request.text));
    useDraftImages.getState().move(draftKey, conversationId);
    for (const skill of request.skills) useDraftSkills.getState().add(conversationId, skill.id);
    // Even when staying in place, the conversation is brought into view: the message waits in that conversation's input box to be resent.
    if (stay) showConversation(conversationId);
    return { conversationId, taskId: null, drafted: true, handedAt };
  }
}
