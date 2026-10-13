/**
 * Host shim in the editor page: installs globalThis.slidesHost on the page, giving the Slides runtime file, asset, user and annotation capabilities
 * (types in slides-host.ts; docs/design/slides §4, §5).
 *
 * Files, assets and external changes go over same-origin HTTP (the runtime's slide routes, deck-routes.ts), not through the parent window;
 * annotations need the CucCut UI, so they are handed to the parent window via postMessage (comments-bridge.ts).
 * Comment threads, collaboration and agent sessions are left empty, so the runtime takes its own fallback path for “没有这项能力” (no such capability).
 */
import { DECK_ROUTES, isPublishError, isWriteEntry, type PublishBatch, type PublishError, type PublishResult, type UploadOptions, type UploadResult, type WirePublishRequest } from '../file-protocol.ts';
import { bytesOf, toBase64 } from './bytes.ts';
import type { HostChatCapability, HostCommentLabels, HostCommentsCapability, SlidesHost } from './slides-host.ts';

/** Storage behind the host capabilities. */
export interface Backend {
  publish(batch: PublishBatch): Promise<PublishResult>;
  upload(file: Blob, options?: UploadOptions): Promise<UploadResult>;
  /** Settles once all pending publishes and uploads have finished (succeeded or failed). */
  idle(): Promise<void>;
}

/** Converts a publish batch into JSON that can be sent over HTTP: content is always base64. */
export async function encodeWireBatch(batch: PublishBatch): Promise<WirePublishRequest> {
  const files: WirePublishRequest['files'] = {};
  for (const [p, entry] of Object.entries(batch)) {
    files[p] = isWriteEntry(entry)
      ? { base64: toBase64(await bytesOf(entry.content)), contentType: entry.contentType, ifMatch: entry.ifMatch }
      : entry;
  }
  return { files };
}

function upstreamError(message: string): PublishError {
  return { code: 'upstream_error', message };
}

/** Forwards to the runtime's slide routes (base is the editor page's address, ending in /). On failure, throws the PublishError returned by the route. */
export function createHttpBackend(base: string, fetchImpl: typeof fetch = (...args) => fetch(...args)): Backend {
  const pending = new Set<Promise<unknown>>();
  const track = <T>(work: Promise<T>): Promise<T> => {
    pending.add(work);
    const done = () => pending.delete(work);
    work.then(done, done);
    return work;
  };
  return {
    publish: batch =>
      track(
        (async () => {
          const res = await fetchImpl(base + DECK_ROUTES.publish, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(await encodeWireBatch(batch)),
          });
          const body: unknown = await res.json().catch(() => undefined);
          if (!res.ok) throw isPublishError(body) ? body : upstreamError(`publish failed: HTTP ${res.status}`);
          return body as PublishResult;
        })(),
      ),
    upload: (file, options) =>
      track(
        (async () => {
          const res = await fetchImpl(base + DECK_ROUTES.assets, {
            method: 'POST',
            headers: { 'Content-Type': options?.type || file.type || 'application/octet-stream' },
            body: file,
          });
          const body: unknown = await res.json().catch(() => undefined);
          if (!res.ok) throw isPublishError(body) ? body : upstreamError(`upload failed: HTTP ${res.status}`);
          return body as UploadResult;
        })(),
      ),
    async idle() {
      while (pending.size > 0) await Promise.allSettled([...pending]);
    },
  };
}

/** CucCut has only one user (§4). The name appears only in the runtime's own collaboration UI; CucCut does not provide collaboration, so it is not put in the copy catalog. */
export const LOCAL_USER = { id: 'user_local', name: 'You' } as const;

export interface EditorHostOptions {
  user?: { id: string; name: string };
  /** Whether editing is allowed; false in the web service's read-only mode, where publishes are also rejected by the route. */
  canEdit?: () => Promise<boolean>;
  comments?: HostCommentsCapability;
  chat?: HostChatCapability;
  commentLabels?: HostCommentLabels;
}

/** Wraps a Backend as the host object the runtime expects. */
export function createEditorHost(backend: Backend, options: EditorHostOptions = {}): SlidesHost {
  const user = options.user ?? LOCAL_USER;
  const canEdit = options.canEdit ?? (async () => true);
  const publish = (batch: PublishBatch) => backend.publish(batch);
  return {
    artifact: { publish },
    self: { publish },
    user: {
      id: async () => user.id,
      canEdit,
      can: async () => canEdit(),
      profiles: async ids => Object.fromEntries(ids.map(id => [id, { name: id === user.id ? user.name : id }])),
    },
    assets: { upload: (file, uploadOptions) => backend.upload(file, uploadOptions) },
    ...(options.comments ? { comments: options.comments } : {}),
    ...(options.chat ? { chat: options.chat } : {}),
    ...(options.commentLabels ? { commentLabels: options.commentLabels } : {}),
  };
}

/** `__deck/session`: whether this open can be edited. If it cannot be read, it is treated as editable; the real block is on the route's publish. */
export function readSessionCanEdit(base: string, fetchImpl: typeof fetch = (...args) => fetch(...args)): () => Promise<boolean> {
  let answer: Promise<boolean> | undefined;
  return () =>
    (answer ??= fetchImpl(base + DECK_ROUTES.session, { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : { canEdit: true }))
      .then((body: { canEdit?: unknown }) => body.canEdit !== false)
      .catch(() => true));
}
