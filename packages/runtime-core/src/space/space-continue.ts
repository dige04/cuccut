import {
  RpcError,
  nowIso,
  type Conversation,
  type Id,
  type SpaceContinueResult,
  type SpaceEntry,
  type SpaceEntryReference,
} from '@cuccut/protocol';
import type { Harness } from '@cuccut/harness';
import type { SpaceCatalog } from '../space-catalog.ts';
import { projectOf, visibleTo } from './space-queries.ts';
import { RcSpace } from '@cuccut/protocol/messages/runtime-core';

/**
 * Continue a conversation from a Space entry (`space.continueInConversation`, architecture design §5.7). Only creates (or finds) the conversation and attaches a reference to the entry; no task is started. The reference is attached to the user's next message.
 *
 * Which conversation it goes into:
 * - If `conversationId` is given, use it. It must be able to see the entry (the same rule as the agent tool `space_list`, from the `source` perspective of `visibleTo`). Otherwise it is rejected with `SPACE_CONVERSATION_MISMATCH`: the reference would be put in, but the agent could not fetch the content.
 * - An entry that belongs to a project: create a new conversation in that project. Conversations in a project each have their own topic, so it does not guess which one to attach to.
 * - An entry that does not belong to a project: return to the conversation it is in (or that produced it). If that conversation no longer exists, create a new conversation that does not belong to a project.
 *
 * The context carried is only the entry's identifier and metadata (`SpaceEntryReference`); file contents are not read. Entries in the trash are rejected (`SPACE_ENTRY_TRASHED`).
 * On a retry with the same `commandId`, it answers with the same conversation; no new one is created.
 */
export async function continueInConversation(
  space: SpaceCatalog,
  harness: Harness,
  params: { entryId: Id; conversationId?: Id; commandId?: Id },
): Promise<SpaceContinueResult> {
  const entry = space.get(params.entryId);
  if (entry.user.trashedAt !== null) {
    throw new RpcError('conflict', RcSpace.continueFromTrash(), { code: 'SPACE_ENTRY_TRASHED' });
  }
  const reference = referenceOf(entry);
  const projectId = projectOf(entry);

  let conversation: Conversation | null = null;
  let created = false;
  if (params.conversationId) {
    conversation = harness.getConversation(params.conversationId).conversation;
    if (!visibleTo({ kind: 'source', projectId: conversation.projectId, conversationId: conversation.folderOf ?? conversation.id }, entry)) {
      throw new RpcError('conflict', RcSpace.conversationCantSee(), {
        code: 'SPACE_CONVERSATION_MISMATCH',
      });
    }
  } else if (!projectId) {
    const origin = entry.source.conversationId ?? entry.origin?.conversationId ?? null;
    conversation = origin ? findConversation(harness, origin) : null;
  }
  if (!conversation) {
    // On a retry with the same `commandId`, the conversation returned is the one created last time. This is judged by whether the conversation existed before the call, not by timestamps (two events in the same millisecond cannot be ordered).
    const existing = new Set(harness.directorySnapshot().conversations.map((c) => c.id));
    conversation = await harness.createConversation({
      projectId,
      ...(params.commandId ? { commandId: `space-continue:${params.commandId}` } : {}),
    });
    // References are de-duplicated by entry, so attaching again is harmless.
    created = !existing.has(conversation.id);
  }
  conversation = harness.attachReference(conversation.id, reference);
  return { conversation, created, reference };
}

function findConversation(harness: Harness, conversationId: Id): Conversation | null {
  try {
    return harness.getConversation(conversationId).conversation;
  } catch {
    return null;
  }
}

/** The entry's reference: identifier and metadata, not file contents or generation parameters. */
export function referenceOf(entry: SpaceEntry): SpaceEntryReference {
  const inSource = entry.source.projectId !== null || entry.source.conversationId !== null;
  return {
    entryId: entry.id,
    kind: entry.kind,
    name: entry.name,
    projectId: projectOf(entry),
    relPath: inSource ? entry.relPath : null,
    videoId: entry.ref && 'videoId' in entry.ref ? entry.ref.videoId : (entry.origin?.videoId ?? null),
    artifactId: entry.ref && 'artifactId' in entry.ref ? entry.ref.artifactId : null,
    status: entry.status,
    origin: entry.origin
      ? {
          source: entry.origin.source,
          ...(entry.origin.capability ? { capability: entry.origin.capability } : {}),
          ...(entry.origin.jobId ? { jobId: entry.origin.jobId } : {}),
          ...(entry.origin.conversationId ? { conversationId: entry.origin.conversationId } : {}),
          ...(entry.origin.videoRevision ? { videoRevision: entry.origin.videoRevision } : {}),
        }
      : null,
    attachedAt: nowIso(),
  };
}
