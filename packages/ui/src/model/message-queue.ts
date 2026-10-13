/*
 * Queue while busy: a message sent while a task is running on the session is queued and sent in order after the task ends; it can also be “send now” to insert it into the current turn.
 *
 * The approach of “remove from the queue first, and put it back at the head if sending fails” is ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra)
 * packages/app/src/composer/actions.ts (`sendQueuedComposerMessageNow`, `editQueuedComposerMessage`), modified:
 * “send now” first goes through `conversations.steer`, and its result decides whether to remove the message, keep it in the queue, or switch to `conversations.send`; the queue is stored per session in shell-store.
 */
import { sendSkillRefs, type AttachmentRef, type EditorContext, type Id, type SkillSendRef, type SlideAnnotation, type DesignAnnotation, type DesignSystemAnnotation } from '@cuccut/protocol';

export interface QueuedMessage {
  id: Id;
  text: string;
  /** Images already uploaded before the message was queued. */
  attachments: AttachmentRef[];
  /** Editor state at the moment of queuing; included when going through `conversations.send` (`steer` does not accept context). */
  context?: EditorContext;
  /** Skills picked, in the order attached; included when going through `conversations.send` (`steer` does not accept skills, so a message with skills is not inserted mid-turn and waits until the current turn ends). */
  skills?: SkillSendRef[];
  /** Slide annotations added to the conversation (docs/design/slides §8.2); included for both `send` and `steer`. */
  slideAnnotations?: SlideAnnotation[];
  /** Design-canvas annotations added to the conversation (docs/design/canvas §8.2); same as slide annotations. */
  designAnnotations?: DesignAnnotation[];
  /** Design-system annotations added to the conversation (docs/design/canvas §10.6); same as slide annotations. */
  designSystemAnnotations?: DesignSystemAnnotation[];
  queuedAt: string;
}

export function enqueueMessage(queue: readonly QueuedMessage[], message: QueuedMessage): QueuedMessage[] {
  return [...queue, message];
}

export function removeQueuedMessage(queue: readonly QueuedMessage[], id: Id): QueuedMessage[] {
  return queue.filter((m) => m.id !== id);
}

/** Edited text of a queued message; setting it to empty deletes the message (a message must have a body; images and annotations cannot be sent on their own). */
export function editQueuedMessage(queue: readonly QueuedMessage[], id: Id, text: string): QueuedMessage[] {
  const trimmed = text.trim();
  return queue.flatMap((m) => {
    if (m.id !== id) return [m];
    return trimmed ? [{ ...m, text: trimmed }] : [];
  });
}

function isSkillRef(value: unknown): value is SkillSendRef {
  return !!value && typeof value === 'object' && typeof (value as SkillSendRef).id === 'string';
}

/** A persisted slide annotation: only the shape is checked here; length and count are enforced by the Runtime schema. */
function isSlideAnnotation(value: unknown): value is SlideAnnotation {
  if (!value || typeof value !== 'object') return false;
  const a = value as Record<string, unknown>;
  return (
    !!a.deck &&
    typeof a.deck === 'object' &&
    typeof a.anchor === 'string' &&
    typeof a.label === 'string' &&
    typeof a.text === 'string' &&
    (a.slideId === undefined || typeof a.slideId === 'string') &&
    (a.detail === undefined || typeof a.detail === 'string') &&
    (a.area === undefined || typeof a.area === 'boolean')
  );
}

/** A persisted design-canvas annotation: same as slide annotations, shape check only. */
function isDesignAnnotation(value: unknown): value is DesignAnnotation {
  if (!value || typeof value !== 'object') return false;
  const a = value as Record<string, unknown>;
  return (
    !!a.canvas &&
    typeof a.canvas === 'object' &&
    typeof a.anchor === 'string' &&
    typeof a.label === 'string' &&
    typeof a.text === 'string' &&
    (a.board === undefined || typeof a.board === 'string') &&
    (a.detail === undefined || typeof a.detail === 'string') &&
    (a.area === undefined || typeof a.area === 'boolean')
  );
}

/** A persisted design-system annotation: same as slide annotations, shape check only. */
function isDesignSystemAnnotation(value: unknown): value is DesignSystemAnnotation {
  if (!value || typeof value !== 'object') return false;
  const a = value as Record<string, unknown>;
  return (
    !!a.system &&
    typeof a.system === 'object' &&
    typeof a.anchor === 'string' &&
    typeof a.label === 'string' &&
    typeof a.text === 'string' &&
    (a.section === undefined || typeof a.section === 'string') &&
    (a.detail === undefined || typeof a.detail === 'string')
  );
}

/** Reads back a persisted entry: discard it if its shape is wrong. The `skill` field saved when only one skill could be picked is also accepted (`readQueuedMessage` converts it to `skills`). */
export function isQueuedMessage(value: unknown): value is QueuedMessage {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === 'string' &&
    typeof m.text === 'string' &&
    typeof m.queuedAt === 'string' &&
    Array.isArray(m.attachments) &&
    m.attachments.every((a) => !!a && typeof a === 'object' && typeof (a as AttachmentRef).id === 'string') &&
    (m.context === undefined || (!!m.context && typeof m.context === 'object')) &&
    (m.skill === undefined || isSkillRef(m.skill)) &&
    (m.skills === undefined || (Array.isArray(m.skills) && m.skills.every(isSkillRef))) &&
    (m.slideAnnotations === undefined || (Array.isArray(m.slideAnnotations) && m.slideAnnotations.every(isSlideAnnotation))) &&
    (m.designAnnotations === undefined || (Array.isArray(m.designAnnotations) && m.designAnnotations.every(isDesignAnnotation))) &&
    (m.designSystemAnnotations === undefined ||
      (Array.isArray(m.designSystemAnnotations) && m.designSystemAnnotations.every(isDesignSystemAnnotation)))
  );
}

/** Reads back a persisted entry, converting the old single `skill` into `skills`; null if the shape is wrong. */
export function readQueuedMessage(value: unknown): QueuedMessage | null {
  if (!isQueuedMessage(value)) return null;
  const { skill, skills, ...base } = value as QueuedMessage & { skill?: SkillSendRef };
  const refs = sendSkillRefs({ ...(skill ? { skill } : {}), ...(skills ? { skills } : {}) });
  return refs.length ? { ...base, skills: refs } : base;
}

/** The queue of one session: reads the latest, writes the whole queue back. */
export interface QueueAccess {
  read(): readonly QueuedMessage[];
  write(next: QueuedMessage[]): void;
}

export type SteerStatus = 'steered' | 'unsupported' | 'no-active-turn';

export interface QueueTransport {
  steer(message: QueuedMessage): Promise<SteerStatus>;
  send(message: QueuedMessage): Promise<void>;
}

export type QueueSendResult =
  | { status: 'missing' }
  /** Inserted into the current turn; removed from the queue. */
  | { status: 'steered' }
  /** No turn was running, so the message was sent directly as a new message. */
  | { status: 'sent' }
  /** The Agent does not support mid-turn insertion: put it back at the head of the queue and send it first once the current task ends. */
  | { status: 'deferred' }
  /** Send failed: put back at the head of the queue. */
  | { status: 'failed'; error: string };

/**
 * “send now”: first remove the message from the queue (so the same message is not sent again by the automatic send when the task ends), then try to insert it into the current turn.
 * `steered` is removed here; `unsupported` is put back at the head of the queue to wait for the task to end; `no-active-turn` means the task has just ended, so it is sent directly.
 */
export async function sendQueuedNow(queue: QueueAccess, transport: QueueTransport, id: Id): Promise<QueueSendResult> {
  const item = queue.read().find((m) => m.id === id);
  if (!item) return { status: 'missing' };
  queue.write(removeQueuedMessage(queue.read(), id));
  try {
    const status = await transport.steer(item);
    if (status === 'steered') return { status: 'steered' };
    if (status === 'unsupported') {
      queue.write([item, ...queue.read()]);
      return { status: 'deferred' };
    }
    await transport.send(item);
    return { status: 'sent' };
  } catch (error) {
    queue.write([item, ...queue.read()]);
    return { status: 'failed', error: (error as Error).message };
  }
}

/** Sends the head of the queue after a task ends. On failure it is put back at the head and not retried: wait for the next task to end, or for the user to press “send now”. */
export async function sendQueueHead(queue: QueueAccess, transport: Pick<QueueTransport, 'send'>): Promise<QueueSendResult> {
  const item = queue.read()[0];
  if (!item) return { status: 'missing' };
  queue.write(removeQueuedMessage(queue.read(), item.id));
  try {
    await transport.send(item);
    return { status: 'sent' };
  } catch (error) {
    queue.write([item, ...queue.read()]);
    return { status: 'failed', error: (error as Error).message };
  }
}
