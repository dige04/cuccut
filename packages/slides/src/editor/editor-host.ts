/**
 * 编辑器页面里的宿主 shim：在页面上装一个 globalThis.slidesHost，给 Slides 运行时提供文件、素材、用户与标注能力
 * （类型见 slides-host.ts，docs/design/slides §4、§5）。
 *
 * 文件、素材、外部改动走同源 HTTP（Runtime 的幻灯片路由，deck-routes.ts），不经父窗口；
 * 标注要 CucCut 界面，经 postMessage 交给父窗口（comments-bridge.ts）。
 * 评论线程、协作、智能体会话留空，运行时按「没有这项能力」走自己的降级路径。
 */
import { DECK_ROUTES, isPublishError, isWriteEntry, type PublishBatch, type PublishError, type PublishResult, type UploadOptions, type UploadResult, type WirePublishRequest } from '../file-protocol.ts';
import { bytesOf, toBase64 } from './bytes.ts';
import type { HostChatCapability, HostCommentLabels, HostCommentsCapability, SlidesHost } from './slides-host.ts';

/** 宿主能力背后的存储。 */
export interface Backend {
  publish(batch: PublishBatch): Promise<PublishResult>;
  upload(file: Blob, options?: UploadOptions): Promise<UploadResult>;
  /** 还没回来的发布与上传都结束（成功或失败）后兑现。 */
  idle(): Promise<void>;
}

/** publish 的批次转成 HTTP 能传的 JSON：内容一律 base64。 */
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

/** 转发给 Runtime 的幻灯片路由（base 是编辑器页面的地址，以 / 结尾）。失败时抛路由返回的 PublishError。 */
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

/** CucCut 里只有一个用户（§4）。名字只在运行时自己的协作界面里出现，CucCut 不提供协作，所以不进文案目录。 */
export const LOCAL_USER = { id: 'user_local', name: 'You' } as const;

export interface EditorHostOptions {
  user?: { id: string; name: string };
  /** 能不能编辑；Web 服务的只读模式下为 false，发布也会被路由拒绝。 */
  canEdit?: () => Promise<boolean>;
  comments?: HostCommentsCapability;
  chat?: HostChatCapability;
  commentLabels?: HostCommentLabels;
}

/** 把一个 Backend 包成运行时要的宿主对象。 */
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

/** `__deck/session`：这次打开能不能编辑。读不到时按能编辑处理，真正的拦截在路由的发布上。 */
export function readSessionCanEdit(base: string, fetchImpl: typeof fetch = (...args) => fetch(...args)): () => Promise<boolean> {
  let answer: Promise<boolean> | undefined;
  return () =>
    (answer ??= fetchImpl(base + DECK_ROUTES.session, { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : { canEdit: true }))
      .then((body: { canEdit?: unknown }) => body.canEdit !== false)
      .catch(() => true));
}
