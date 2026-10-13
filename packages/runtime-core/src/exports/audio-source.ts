import { RpcError, type AudioExportSource, type Id, type VideoSnapshot } from '@cuccut/protocol';
import { RcExport } from '@cuccut/protocol/messages/runtime-core';

/**
 * The sound source for audio export (architecture design §9.13), replaced by the instance selection in the engine's sound plan (`audioItems` of `exports.plan`):
 *
 * - `original`: deactivate instances tagged `cuccut.dub` (the dubbing and the separated background); unmute the original audio that dubbing muted (the `mutedItemIds` recorded in the dub plan, which only includes instances not already muted before dubbing); ducking triggered by dubbing goes away together with the instance that triggered it.
 * - `{ dubGroupId }`: keep only the instances of this one dub group and deactivate everything else; reject if the video has no such group.
 *
 * Affects only this export's plan; the video itself is unchanged.
 */

/** Markers that dubbing writes on instances and on the dub plan (video format spec §7.2, §1.4). */
const DUB_EXTENSION = 'cuccut.dub';

export interface AudioItemSelection {
  disable: Id[];
  unmute: Id[];
}

function dubMark(item: unknown): { groupId?: unknown; stem?: unknown } | null {
  const extensions = (item as { extensions?: Record<string, unknown> }).extensions;
  const mark = extensions?.[DUB_EXTENSION];
  return mark && typeof mark === 'object' ? (mark as { groupId?: unknown; stem?: unknown }) : null;
}

export async function audioItemSelection(
  video: VideoSnapshot,
  sequenceId: Id,
  source: AudioExportSource | undefined,
  readBody: (documentId: Id) => Promise<unknown>,
): Promise<AudioItemSelection | null> {
  if (source === undefined || source === 'mix') return null;
  const items = video.sequences[sequenceId]?.items ?? [];
  if (source === 'original') {
    const ids = new Set(items.map((item) => item.id));
    const unmute = new Set<Id>();
    for (const [documentId, record] of Object.entries(video.documents)) {
      if (record.kind !== 'dubbing-plan') continue;
      const body = (await readBody(documentId).catch(() => null)) as {
        sequenceId?: unknown;
        extensions?: Record<string, { mutedItemIds?: unknown } | undefined>;
      } | null;
      if (body?.sequenceId !== sequenceId) continue;
      const muted = body.extensions?.[DUB_EXTENSION]?.mutedItemIds;
      if (Array.isArray(muted)) for (const id of muted) if (typeof id === 'string' && ids.has(id)) unmute.add(id);
    }
    return { disable: items.filter((item) => dubMark(item) !== null).map((item) => item.id), unmute: [...unmute] };
  }
  const { dubGroupId } = source;
  const keep = new Set(
    items
      .filter((item) => {
        const mark = dubMark(item);
        return mark !== null && mark.groupId === dubGroupId && mark.stem === undefined;
      })
      .map((item) => item.id),
  );
  if (keep.size === 0) {
    throw new RpcError('invalid-request', RcExport.dubGroupNotFound({ groupId: dubGroupId }), { code: 'DUB_GROUP_NOT_FOUND', groupId: dubGroupId });
  }
  return { disable: items.filter((item) => !keep.has(item.id)).map((item) => item.id), unmute: [] };
}
