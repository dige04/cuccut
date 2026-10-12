/**
 * 编辑器页面的入口（`@cuccut/slides/editor`）：apps/slides-editor 的 main.ts 先调 installEditorHost 装好 globalThis.slidesHost，
 * 再启动 Slides 运行时（运行时启动时就读宿主能力）。docs/design/slides §5。设计稿编辑器用 connectEditorHost 拿同一个宿主对象，
 * 挂到 globalThis.designHost（docs/design/canvas §5）。
 */
import { DECK_ROUTES, type DeckChangeEvent } from '../file-protocol.ts';
import { createChatBridge } from './chat-bridge.ts';
import { createCommentLabels, localeFromSearch } from './comment-labels.ts';
import { createCommentsBridge, domPinLayer, windowParentLink, type ParentLink } from './comments-bridge.ts';
import { createEditorHost, createHttpBackend, readSessionCanEdit, type Backend } from './editor-host.ts';
import type { HostCommentLabels, SlidesHost } from './slides-host.ts';

export { createChatBridge, type ChatBridge } from './chat-bridge.ts';
export { createCommentLabels, localeFromSearch, type CommentLabelMessages } from './comment-labels.ts';
export { createCommentsBridge, domPinLayer, windowParentLink, type CommentsBridge, type ParentLink, type PinLayer } from './comments-bridge.ts';
export { createEditorHost, createHttpBackend, encodeWireBatch, LOCAL_USER, readSessionCanEdit, type Backend, type EditorHostOptions } from './editor-host.ts';
export type * from './slides-host.ts';

/** flush 最多等多久；超时按没保存完回报。 */
const FLUSH_TIMEOUT_MS = 8000;

/**
 * 把编辑器里未保存的改动发布完。运行时只在 beforeunload（有未保存的改动时）立刻发布，
 * 所以发一个可取消的 beforeunload：被取消说明还有改动，等这一轮发布结束再问一次。返回是否都保存了。
 */
export async function flushEdits(win: Window & typeof globalThis, backend: Backend, timeoutMs = FLUSH_TIMEOUT_MS): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  const dirty = () => !win.dispatchEvent(new Event('beforeunload', { cancelable: true }));
  while (dirty()) {
    const left = deadline - Date.now();
    if (left <= 0) return false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = await Promise.race([
      backend.idle().then(() => false),
      new Promise<boolean>(resolve => (timer = setTimeout(resolve, left, true))),
    ]);
    clearTimeout(timer);
    if (timedOut) return false;
    // 发布结束到运行时清掉 dirty 之间隔一个微任务，让它先处理完回应
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return true;
}

/** 订阅 `__deck/events`：deck 被编辑器以外的东西改了时，先把自己的改动发布完，再重新载入。 */
function watchDeckEvents(win: Window & typeof globalThis, base: string, backend: Backend, link: ParentLink | null): () => void {
  if (typeof win.EventSource !== 'function') return () => {};
  const source = new win.EventSource(base + DECK_ROUTES.events);
  let reloading = false;
  source.addEventListener('external-change', async event => {
    if (reloading) return;
    let change: DeckChangeEvent;
    try {
      change = JSON.parse((event as MessageEvent<string>).data) as DeckChangeEvent;
    } catch {
      return;
    }
    reloading = true;
    link?.post({ type: 'editor:external-change', paths: change.paths });
    await flushEdits(win, backend);
    source.close();
    win.location.reload();
  });
  return () => source.close();
}

export interface InstallEditorHostOptions {
  /** 编辑器页面的地址（以 / 结尾），路由都相对它。默认是页面所在目录。 */
  base?: string;
  win?: Window & typeof globalThis;
  /** 标注位置标签里的词（只有幻灯片运行时会问）。 */
  commentLabels?: HostCommentLabels;
}

/**
 * 做好宿主对象，并接上父窗口与外部改动的通知；由调用方挂到运行时读的全局上。
 * 幻灯片与设计稿编辑器共用（docs/design/canvas §5）。
 */
export function connectEditorHost(options: InstallEditorHostOptions = {}): SlidesHost {
  const win = options.win ?? window;
  const base = options.base ?? new URL('./', win.location.href).href;
  const backend = createHttpBackend(base, (...args) => win.fetch(...args));
  const canEdit = readSessionCanEdit(base, (...args) => win.fetch(...args));
  const link = windowParentLink(win);
  const bridge = link ? createCommentsBridge(link, domPinLayer(win.document)) : null;
  // 页面单独打开（不在 CucCut 的 iframe 里）时没有会话可放提示，不提供 chat，运行时直接复制到剪贴板
  const chat = link ? createChatBridge(link) : null;
  const host = createEditorHost(backend, {
    canEdit,
    ...(bridge ? { comments: bridge.capability } : {}),
    ...(chat ? { chat: chat.capability } : {}),
    ...(options.commentLabels ? { commentLabels: options.commentLabels } : {}),
  });
  watchDeckEvents(win, base, backend, link);
  if (link) {
    link.onMessage(async message => {
      if (message.type !== 'editor:flush') return;
      const saved = await flushEdits(win, backend);
      link.post({ type: 'editor:flushed', requestId: message.requestId, saved });
    });
    void canEdit().then(editable => link.post({ type: 'editor:ready', canEdit: editable }));
  }
  return host;
}

/** 在页面上装好 globalThis.slidesHost（幻灯片编辑器）。 */
export function installEditorHost(options: InstallEditorHostOptions = {}): void {
  const win = options.win ?? window;
  win.slidesHost = connectEditorHost({
    ...options,
    win,
    // 标注位置标签跟随 CucCut 的界面语言（地址上的 ?lang=）；单独打开时没带，保持英文
    commentLabels: options.commentLabels ?? createCommentLabels(localeFromSearch(win.location.search)),
  });
}
