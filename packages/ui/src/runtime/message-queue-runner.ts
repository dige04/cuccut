/*
 * Queued sends while busy: when a session's task ends, the message at the head of the queue is sent; “send now” on a queued row.
 *
 * The approach of “when an Agent goes from running to idle, take one message and send it, with at most one message per session at a time” is ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra)
 * packages/app/src/runtime/host-runtime.ts (`drainQueuedAgentMessage` and its in-flight set), modified:
 * it now subscribes to the session's `activeTaskId` in the catalog mirror changing from set to unset; the queue lives in shell-store; on a send failure the message goes back to the head of the queue and is not retried.
 */
import type { Conversation, Id } from '@cuccut/protocol';
import { sendQueueHead, sendQueuedNow, type QueueAccess, type QueuedMessage, type QueueSendResult, type QueueTransport } from '../model/message-queue.ts';
import { useDirectory } from '../state/directory-store.ts';
import { useShell } from '../state/shell-store.ts';
import type { RuntimeSession } from './session.ts';

function queueAccess(conversationId: Id): QueueAccess {
  return {
    read: () => useShell.getState().queues[conversationId] ?? [],
    write: (next) => useShell.getState().setQueue(conversationId, () => next),
  };
}

function transport(runtime: RuntimeSession, conversationId: Id): QueueTransport {
  const ids = (m: QueuedMessage) => m.attachments.map((a) => a.id);
  return {
    // Interjections carry no editor state: the protocol's steer does not accept context. Nor does it accept skills: a message with a skill is not interjected; if the turn is still running it waits for the turn to end, and if the turn has already ended it is sent directly.
    steer: (m) =>
      m.skills?.length
        ? Promise.resolve(
            useDirectory.getState().conversations.find((c) => c.id === conversationId)?.activeTaskId ? 'unsupported' : 'no-active-turn',
          )
        : runtime.steer(conversationId, m.text, ids(m), m.slideAnnotations, m.designAnnotations, m.designSystemAnnotations),
    send: async (m) => {
      await runtime.send(
        conversationId,
        m.text,
        m.context,
        ids(m),
        undefined,
        m.skills,
        m.slideAnnotations,
        m.designAnnotations,
        m.designSystemAnnotations,
      );
    },
  };
}

/** Sessions being sent to: task-end events may arrive back to back, so only one message is sent per session at a time. */
const draining = new Set<Id>();

/** Send the message at the head of this session's queue (called when the session is idle). */
export async function drainQueue(runtime: RuntimeSession, conversationId: Id): Promise<QueueSendResult> {
  if (draining.has(conversationId)) return { status: 'missing' };
  draining.add(conversationId);
  try {
    return await sendQueueHead(queueAccess(conversationId), transport(runtime, conversationId));
  } finally {
    draining.delete(conversationId);
  }
}

/** “Send now” on a queued row: first try to interject; if that is not supported, leave it in the queue; if no turn is running, send it directly. */
export function sendQueuedMessageNow(runtime: RuntimeSession, conversationId: Id, messageId: Id): Promise<QueueSendResult> {
  return sendQueuedNow(queueAccess(conversationId), transport(runtime, conversationId), messageId);
}

function activeTasks(conversations: readonly Conversation[]): Map<Id, Id | null> {
  return new Map(conversations.map((c) => [c.id, c.activeTaskId]));
}

/**
 * Watches the catalog mirror: when a session's task goes from present to absent (completed, failed, stopped), send the message at the head of its queue.
 * An idle session seen at startup does not count as “ended”: queued messages left unsent last time stay and wait for the user to send them; nothing is suddenly sent on the user's behalf when the app opens.
 */
export function startQueueRunner(runtime: RuntimeSession, onFailed: (message: string) => void): () => void {
  let previous = activeTasks(useDirectory.getState().conversations);
  return useDirectory.subscribe((state) => {
    const current = activeTasks(state.conversations);
    for (const [id, task] of previous) {
      if (task === null || !current.has(id) || current.get(id) !== null) continue;
      if (!useShell.getState().queues[id]?.length) continue;
      void drainQueue(runtime, id).then((result) => {
        if (result.status === 'failed') onFailed(result.error);
      });
    }
    previous = current;
  });
}
