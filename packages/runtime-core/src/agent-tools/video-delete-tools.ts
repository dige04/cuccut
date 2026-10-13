import path from 'node:path';
import { z } from 'zod';
import { RpcError } from '@cuccut/protocol';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import type { SpaceCatalog } from '../space-catalog.ts';
import type { VideoService } from '../videos/video-service.ts';
import type { VideoTrash } from '../videos/video-trash.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import { approvalField, confirmSummary, type ToolPrincipal, type ToolScope } from './tool-scope.ts';
import { videoArg } from './video-tools.ts';

/**
 * Video deletion (architecture design §5.5, §5.7) for agents in a session: one tool, `videos_delete`, risk `high`, asking
 * the user according to the access mode. Only videos in the session's source directory can be deleted; deleting moves it
 * to the trash, it can be restored in Space, and it is physically removed only after the retention period. `surfaces` is
 * the tool bridge and the CLI: the external MCP service does not have it.
 */

export interface VideoDeleteToolsDeps {
  space: () => SpaceCatalog;
  trash: () => VideoTrash;
  videos: VideoService;
  retentionDays: () => number;
  scope: ToolScope;
}

const schemas = {
  videos_delete: z.strictObject({ video: videoArg }),
};

const DEFINITIONS: Record<'videos_delete', ToolInfo> = {
  videos_delete: {
    title: 'Delete a video',
    description: [
      'Moves a video (the whole video directory) to the trash.',
      'Use only when the user explicitly asks to delete this video; the user is asked to confirm.',
      'Original files of linked assets are not affected, and files exported or generated from it are not deleted either. The user can restore it from the trash in Space; it is physically removed only after the retention period.',
      'Fails when the video is open elsewhere, has a running task or export, or is locked by another program (VIDEO_IN_USE, VIDEO_BUSY, VIDEO_LOCKED): tell the user why, and do not delete the directory by other means.',
    ].join('\n'),
    annotations: { destructiveHint: true, idempotentHint: true },
    effect: 'destructive',
    examples: [{ title: 'Delete a video', args: { video: 'demo' } }],
    surfaces: ['agent', 'cli'],
    positional: 'video',
  },
};

export class VideoDeleteTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #deps: VideoDeleteToolsDeps;

  constructor(deps: VideoDeleteToolsDeps) {
    this.#deps = deps;
  }

  dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    if (name !== 'videos_delete') return Promise.reject(new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`));
    return this.#delete(args as z.infer<(typeof schemas)['videos_delete']>, principal).catch((error: unknown) => {
      throw toolErrorOf(error);
    });
  }

  async #delete(args: { video: string }, principal: ToolPrincipal) {
    const { scope, videos } = this.#deps;
    const space = this.#deps.space();
    const access = scope.authorize(principal, true);
    // First find it in the session's source directory (anything out of scope gets no confirmation and the same answer as a missing video).
    const { root, scope: source } = await scope.createRoot(access, undefined, { locate: true });
    const known = videos.ref(args.video);
    const info = await space.videoEntryAt(known ? known.path : path.resolve(root, args.video));
    const sameSource =
      info !== null &&
      ('projectId' in source
        ? 'projectId' in info.scope && info.scope.projectId === source.projectId
        : 'conversationId' in info.scope && info.scope.conversationId === source.conversationId);
    if (!info || !sameSource) {
      throw new ToolError('VIDEO_NOT_FOUND', `Video "${args.video}" not found: use a path given by videos_list, or the videoId of an open video`);
    }
    const approval = await scope.confirm(access, {
      tool: 'videos_delete',
      video: info.relPath,
      ...confirmSummary(
        RcAgentTools.deleteVideoSummary({ name: info.entry.name, path: info.relPath, days: this.#deps.retentionDays() }),
      ),
      risk: 'high',
    });
    const result = await this.#deps.trash().delete({ entryId: info.entry.id }, access.principal);
    return {
      ...result,
      ...approvalField(approval),
      next: 'The video was moved to the trash. The user can restore it from the trash in Space; entries exported or generated from it stay where they are.',
    };
  }
}

/** Deletion rejections (`VIDEO_IN_USE`, `VIDEO_BUSY`, `VIDEO_LOCKED`, ...) become tool error codes. */
function toolErrorOf(error: unknown): unknown {
  if (error instanceof RpcError && typeof error.details === 'object' && error.details !== null) {
    const { code, ...rest } = error.details as Record<string, unknown>;
    if (typeof code === 'string') return new ToolError(code, error.message, rest);
  }
  return error;
}
