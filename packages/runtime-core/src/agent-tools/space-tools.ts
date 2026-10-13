import { z } from 'zod';
import { SPACE_LIST_MAX_LIMIT, SPACE_SEARCH_MAX_LIMIT, type JobRecord, type SpaceEntry } from '@cuccut/protocol';
import type { SpaceCatalog } from '../space-catalog.ts';
import { USER_VIEWER, listEntries, projectOf, searchContent, videoOf, type SpaceViewer } from '../space/space-queries.ts';
import type { AgentAccess } from './agent-scope.ts';
import type { ServiceAccess } from '../services/service-scope.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import type { ToolAccess, ToolPrincipal, ToolScope } from './tool-scope.ts';

/**
 * Read-only Space tools (architecture design §3.5, §5.7, §5.11): `space_list` lists entries, `space_search` searches
 * transcripts, captions, translations and chapters across videos. Risk level `read`, available in plan mode and to
 * read-only external services. The scope is decided by the `ToolScope` principal (`space/space-queries.ts`): the agent
 * in a session sees entries in the session's source directory; an external service sees only videos within its scope
 * and entries generated or exported from them, and only the job artifacts it submitted itself.
 */

export interface SpaceToolsDeps {
  /** The Space catalog is built after the tool catalog: read it at call time. */
  space: () => SpaceCatalog;
  scope: ToolScope;
  jobs: { list(): JobRecord[] };
}

const KINDS = ['video', 'export', 'video-file', 'image', 'audio', 'subtitle', 'document', 'slides', 'design', 'design-system', 'package', 'template'] as const;
const STATUSES = ['generating', 'candidate', 'applied', 'published', 'source-changed', 'missing', 'failed', 'none'] as const;

const schemas = {
  space_list: z.strictObject({
    kind: z
      .array(z.enum(KINDS))
      .min(1)
      .max(KINDS.length)
      .optional()
      .describe(
        'Optional. List only these kinds: video (editable video), export (exported file), video-file, image, audio, subtitle, document, slides (slides directory), design (design directory), design-system (design system directory), package (portable package), template (template)',
      ),
    status: z
      .array(z.enum(STATUSES))
      .min(1)
      .max(8)
      .optional()
      .describe('Optional. List only these statuses: generating, failed, candidate, applied, published, source-changed, missing; none means plain files and videos'),
    videoId: z.string().min(1).max(200).optional().describe('Optional. This video itself, entries generated or exported from it, and sub-videos (shorts) cut from it'),
    favorite: z.boolean().optional().describe('Optional. List favorites only'),
    cursor: z
      .string()
      .regex(/^\d{1,9}$/)
      .optional()
      .describe('Optional. nextCursor from the previous page of results'),
    limit: z.number().int().min(1).max(SPACE_LIST_MAX_LIMIT).optional().describe('Optional. Entries per page, default 50'),
  }),
  space_search: z
    .strictObject({
      query: z.string().max(500).describe('Search terms: all whitespace-separated words must appear in the same segment, case-insensitive; CJK text is matched by character, without word segmentation'),
      videoIds: z.array(z.string().min(1).max(200)).min(1).max(200).optional().describe('Optional. Search only these videos'),
      kinds: z
        .array(z.enum(['speech', 'caption', 'translation', 'chapter']))
        .min(1)
        .max(4)
        .optional()
        .describe('Optional. Search only these documents: speech (transcript), caption (captions), translation (translation), chapter (chapters)'),
      speaker: z.string().trim().min(1).max(200).optional().describe('Optional. The speaker\'s name contains this text'),
      limit: z.number().int().min(1).max(SPACE_SEARCH_MAX_LIMIT).optional().describe('Optional. Maximum number of hits to return, default 30'),
    })
    .refine((p) => p.query.trim().length > 0 || p.speaker !== undefined, 'Give search terms or a speaker'),
};

type ToolName = keyof typeof schemas;

const DEFINITIONS: Record<ToolName, ToolInfo> = {
  space_list: {
    title: 'List Space entries',
    description: [
      'List the Space entries you can access.',
      'Entries include videos, asset files in projects, generated images / audio / text, exported files, and in-progress and failed generation jobs.',
      'Ordered by most recent activity, newest first, excluding the trash. Each entry has id, kind, name, status, project, related videoId and relative path.',
      'Includes nextCursor when there is another page. Read-only; does not open videos.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [
      { title: 'Recent entries', args: {} },
      { title: 'Files exported from one video', args: { videoId: 'vid_1', kind: ['export'] } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
  },
  space_search: {
    title: 'Search transcripts across videos',
    description: [
      'Search transcripts, captions, translations, chapters and speakers across videos.',
      'Covers all videos you can access, without opening them. Each hit has videoId, video name, document kind and documentId, time position (seconds on the timeline when clock is sequence, the asset\'s source time when source) and the matching snippet.',
      'Times reflect the revision at indexing time (indexedRevision): for exact positions, read the current revision with videos_inspect / documents_read.',
      'When complete is false, the index does not yet cover every video (recent changes, a rebuild in progress, or unreadable videos), so results may be incomplete; pendingVideos is how many.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [
      { title: 'Search for a word', args: { query: 'keynote' } },
      { title: 'Search translations only', args: { query: 'launch date', kinds: ['translation'], limit: 10 } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'query',
  },
};

export class SpaceTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #deps: SpaceToolsDeps;

  constructor(deps: SpaceToolsDeps) {
    this.#deps = deps;
  }

  async dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    switch (name as ToolName) {
      case 'space_list': {
        const p = args as z.infer<(typeof schemas)['space_list']>;
        const result = listEntries(this.#deps.space(), this.#viewer(principal), {
          ...(p.kind ? { kind: p.kind } : {}),
          ...(p.status ? { status: p.status } : {}),
          ...(p.videoId ? { videoId: p.videoId } : {}),
          ...(p.favorite !== undefined ? { favorite: p.favorite } : {}),
          ...(p.cursor ? { cursor: p.cursor } : {}),
          limit: p.limit ?? 50,
        });
        return {
          entries: result.entries.map(entryOf),
          total: result.total,
          nextCursor: result.nextCursor,
          ...(result.scanning ? { scanning: true } : {}),
        };
      }
      case 'space_search': {
        const p = args as z.infer<(typeof schemas)['space_search']>;
        const result = searchContent(this.#deps.space(), this.#viewer(principal), {
          query: p.query,
          ...(p.videoIds ? { videoIds: p.videoIds } : {}),
          ...(p.kinds ? { kinds: p.kinds } : {}),
          ...(p.speaker ? { speaker: p.speaker } : {}),
          limit: p.limit ?? 30,
        });
        return {
          hits: result.hits.map(({ highlights: _, entryId: __, ...hit }) => hit),
          complete: result.complete,
          pendingVideos: result.pendingVideos,
          truncated: result.truncated,
        };
      }
      default:
        throw new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`);
    }
  }

  /** Principal -> visible scope. The user themselves in a terminal sees everything, like the UI. */
  #viewer(principal: ToolPrincipal): SpaceViewer {
    const access: ToolAccess = this.#deps.scope.authorize(principal, false);
    if (access.principal.kind === 'local') return USER_VIEWER;
    if (access.principal.kind === 'agent') {
      const { conversation } = access as AgentAccess;
      return { kind: 'source', projectId: conversation.projectId ?? null, conversationId: conversation.folderOf ?? conversation.id };
    }
    const { policy } = access as ServiceAccess;
    const records = new Map(this.#deps.jobs.list().map((r) => [r.jobId, r]));
    return {
      kind: 'service',
      videos: policy.videos === 'all' ? 'all' : new Set(policy.videos.ids),
      owns: (record) => this.#deps.scope.owns(record, access),
      jobs: (jobId) => records.get(jobId) ?? null,
    };
  }
}

/** Entries for agents: without the source directory's absolute path. */
function entryOf(entry: SpaceEntry) {
  return {
    id: entry.id,
    kind: entry.kind,
    name: entry.name,
    status: entry.status,
    ...(entry.statusDetail ? { statusDetail: entry.statusDetail } : {}),
    projectId: projectOf(entry),
    videoId: videoOf(entry),
    ...(entry.source.projectId || entry.source.conversationId ? { path: entry.relPath } : {}),
    size: entry.size,
    ...(entry.deck ? { slideCount: entry.deck.slideCount } : {}),
    ...(entry.canvas ? { boardCount: entry.canvas.boardCount } : {}),
    lastActivityAt: entry.lastActivityAt,
    ...(entry.origin ? { origin: { source: entry.origin.source, ...(entry.origin.jobId ? { jobId: entry.origin.jobId } : {}) } } : {}),
    ...(entry.user.favorite ? { favorite: true } : {}),
  };
}
