import path from 'node:path';
import { RpcError, newId, type Id, type RpcErrorCode, type VideoChange, type VideoOpenResult } from '@cuccut/protocol';
import { RcVideo } from '@cuccut/protocol/messages/runtime-core';
import type { Harness } from '@cuccut/harness';
import type { RpcHandlers } from '../handlers.ts';
import type { MediaRegistry } from '../media.ts';
import type { VideoService } from '../videos/video-service.ts';
import { ToolError } from '../agent-tools/tool-catalog.ts';
import { framesDirectory } from '../agent-tools/video-frames.ts';
import { videoChangeOf, type CompositionCaller, type CompositionService } from './composition-service.ts';

type CompositionMethod = 'compositions.preview' | 'compositions.import';

export interface CompositionMethodDeps {
  compositions: CompositionService;
  videos: VideoService;
  harness: Harness;
  /** The read handle for frames: the web service uses its own (same-origin address; requires a session). */
  media: MediaRegistry;
}

/**
 * Handlers for `compositions.*` (architecture §8), merged into the method table by `handlers.ts`. Reserved for the UI; no UI calls it at present. It shares `CompositionService` with the tools `compositions_preview` / `compositions_import` (same parameters, including `replace`):
 *
 * - The video must already be open (as with `edits.apply`). `path` is relative to the video's source directory (the project directory, or the working directory of a session that is not in a project), and by real path it must stay inside it. The desktop UI and the web service follow the same rule. Preview frames are written to `.cuccut-out/frames/<videoId>/` in the source directory (the same place the agent uses), and the handler returns a media handle.
 * - The writing operator is the connection's principal (the UI and browser are `user_local`), and it does not go through CucCut's approval. When `conversationId` is given, each edit places a change card in the session. (Edits started by the UI through `edits.apply` place no card; here the UI imports a code visual on the user's behalf, so a receipt should be left in the session.)
 * - A `ToolError` thrown by the service is converted to `RpcError`: the text is the catalog's "import / preview failed (error code)", and the error code, the original message, `next` and the validation items go into `details`.
 */
export function compositionMethods(deps: CompositionMethodDeps): Pick<RpcHandlers['methods'], CompositionMethod> {
  const { compositions, videos, harness, media } = deps;

  const open = async (videoId: Id): Promise<VideoOpenResult> => {
    const ref = videos.ref(videoId);
    const snapshot = videos.mirror(videoId);
    if (!ref || !snapshot) throw new RpcError('not-found', RcVideo.videoNotOpenOpenFirst(), { code: 'VIDEO_NOT_OPEN' });
    return { ref, snapshot };
  };
  /** The video's source directory: the directory of the project it belongs to, or the working directory of a session that is not in a project. */
  const sourceRoot = (opened: VideoOpenResult): string => {
    const { projectId, conversationId } = opened.ref.source;
    if (projectId) {
      const project = harness.listProjects().find((p) => p.id === projectId);
      if (project) return project.path;
    } else if (conversationId) {
      return harness.getConversation(conversationId).conversation.cwd;
    }
    throw new RpcError('not-found', RcVideo.videoNotInSourceDir(), { code: 'VIDEO_NOT_IN_SOURCE_DIR' });
  };
  const caller = (videoId: Id): CompositionCaller => ({
    open: () => open(videoId),
    importBase: (opened) => {
      const root = sourceRoot(opened);
      return { cwd: root, confine: root };
    },
  });

  return {
    'compositions.preview': async (p) => {
      const preview = await rpcErrors('preview', () =>
        compositions.preview(p, {
          ...caller(p.video),
          framesDir: (opened) => {
            const root = sourceRoot(opened);
            return framesDirectory(root, opened.ref.videoId, root);
          },
        }),
      );
      const frames = await Promise.all(
        preview.frames.map(async (frame) => ({
          at: frame.at,
          sampledSeconds: frame.sampledSeconds,
          clamped: frame.clamped,
          sha256: frame.sha256,
          width: preview.width,
          height: preview.height,
          media: await media.issue(path.dirname(frame.file), path.basename(frame.file)),
        })),
      );
      return { ...preview, frames };
    },

    'compositions.import': async ({ conversationId, ...args }, principal) => {
      // Check the session first: a bad ID should not only be found after baking has finished.
      if (conversationId !== undefined) harness.getConversation(conversationId);
      return rpcErrors('import', () =>
        compositions.import(args, {
          ...caller(args.video),
          confirm: async () => {},
          apply: async (opened, edit) => {
            const result = await videos.apply(
              {
                videoId: opened.ref.videoId,
                commandId: edit.commandId ?? newId('cmd'),
                expectedRevision: edit.expectedRevision,
                operations: edit.operations as never,
                label: edit.label,
              },
              principal,
            );
            if (conversationId !== undefined) {
              const change: VideoChange = videoChangeOf(videos, opened, result);
              const target =
                'conversationId' in change.target && !change.target.conversationId ? { ...change.target, conversationId } : change.target;
              harness.recordVideoChange(conversationId, null, { ...change, target });
            }
            return result;
          },
        }),
      );
    },
  };
}

/** Maps tool error codes to RPC error kinds; anything not listed (problems with the code package and parameters) is `invalid-request`. */
const RPC_CODES: Readonly<Record<string, RpcErrorCode>> = {
  COMPOSITION_HOST_UNAVAILABLE: 'unsupported',
  COMPOSITION_BAKE_FAILED: 'unsupported',
  ASSET_NOT_FOUND: 'not-found',
  PATH_OUTSIDE_PROJECT: 'forbidden',
  PROJECT_REVISION_CONFLICT: 'conflict',
};

/** Converts the service's `ToolError` to `RpcError`; an `RpcError` (video not open, engine errors) is thrown through unchanged. */
async function rpcErrors<T>(action: 'import' | 'preview', run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!(error instanceof ToolError)) throw error;
    const code = error.code;
    const message = action === 'import' ? RcVideo.compositionImportFailed({ code }) : RcVideo.compositionPreviewFailed({ code });
    throw new RpcError(RPC_CODES[code] ?? 'invalid-request', message, { ...error.extra, code, detail: error.message });
  }
}
