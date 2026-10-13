import type {
  Id,
  ToolCandidate,
  ToolCandidateDocument,
  ToolCandidatesParams,
  ToolCandidatesResult,
  ToolDefinition,
} from '@cuccut/protocol';
import type { SpaceCatalog } from '../space-catalog.ts';
import type { VideoFacts } from '../space/content-extract.ts';
import { visibleVideo, type SpaceViewer } from '../space/space-queries.ts';

/**
 * Candidate inputs for tools (`tools.candidates`, architecture design §7.9): optional video entries and, within each entry, optional documents. The facts come from the Space directory (§5.7)
 * and the content index (§5.11); no video is opened.
 *
 * - Scope is the same as `space.list` / `space.search`: filtered by subject (`SpaceViewer`), and can be filtered by project; videos in the trash are not listed.
 * - `videos`: all videos; `videos-with-transcript`: videos that have a transcript, each listing its transcript, existing translations and dubbing groups.
 * - Videos not yet indexed, queued for re-reading (cache from an older version, video changed), or failing to read are still listed, marked `indexed: false`. Tools that list only videos with a transcript also list them, because it cannot be concluded that there is no transcript; in that case `complete` is false. An old index with a transcript is used as before.
 * - For external services, unindexed videos are counted only when the scope is all videos (as with `space.search`; videos outside the list must not show up in the results).
 */

const DEFAULT_LIMIT = 100;

export function toolCandidates(
  catalog: SpaceCatalog,
  viewer: SpaceViewer,
  tool: ToolDefinition,
  params: Omit<ToolCandidatesParams, 'toolId'>,
): ToolCandidatesResult {
  const index = catalog.index;
  const matched: ToolCandidate[] = [];
  let pending = 0;
  if (tool.candidates !== null) {
    for (const video of catalog.videos()) {
      if (params.projectId !== undefined && video.projectId !== params.projectId) continue;
      if (!visibleVideo(viewer, video)) continue;
      const entry = catalog.get(video.entryId);
      if (entry.user.trashedAt !== null) continue;
      const indexed = index?.at(video.dir) ?? null;
      const videoId = indexed?.videoId ?? video.videoId;
      if (viewer.kind === 'service' && viewer.videos !== 'all') {
        // List scope: videos whose videoId is unknown are not listed (it cannot be judged whether they are on the list).
        if (!videoId || !viewer.videos.has(videoId)) continue;
      }
      const current = index !== null && indexed !== null && index.current(video.dir);
      if (!current) pending++;
      const documents = tool.candidates === 'videos-with-transcript' && indexed ? transcriptChoices(indexed.facts) : [];
      // Tools that list only videos with a transcript: the index is current and really has no transcript is the only case left out.
      if (tool.candidates === 'videos-with-transcript' && current && documents.length === 0) continue;
      matched.push({
        entryId: video.entryId,
        videoId,
        name: entry.name,
        projectId: video.projectId,
        lastActivityAt: video.lastActivityAt,
        indexed: current,
        indexedRevision: indexed?.revision ?? null,
        documents,
      });
    }
  }
  const offset = params.cursor ? Number(params.cursor) : 0;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const page = matched.slice(offset, offset + limit);
  const next = offset + page.length;
  return {
    toolId: tool.id,
    candidates: page,
    total: matched.length,
    nextCursor: next < matched.length ? String(next) : null,
    complete: pending === 0 && !catalog.scanning && index !== null,
    pendingVideos: pending,
    scanning: catalog.scanning,
  };
}

/** The transcript optionally available in a video, with the translation derived from it and the dubbing groups that use it. */
function transcriptChoices(facts: VideoFacts): ToolCandidateDocument[] {
  const transcripts = facts.transcripts ?? [];
  const translations = facts.translations ?? [];
  const dubGroups = facts.dubGroups ?? [];
  const sourceOf = new Map<Id, Id | null>(translations.map((t) => [t.documentId, t.sourceDocumentId]));
  return transcripts.map((transcript) => ({
    ...transcript,
    kind: 'speech' as const,
    translations: translations
      .filter((t) => t.sourceDocumentId === transcript.documentId)
      .map((t) => ({ documentId: t.documentId, language: t.language, units: t.units, staleUnits: t.staleUnits })),
    dubs: dubGroups
      .filter(
        (g) =>
          g.transcriptId === transcript.documentId || (g.translationId !== null && sourceOf.get(g.translationId) === transcript.documentId),
      )
      .map((g) => ({ groupId: g.groupId, language: g.language, translationId: g.translationId })),
  }));
}
