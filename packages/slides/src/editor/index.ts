/**
 * Entry point of the editor page (`@cuccut/slides/editor`): apps/slides-editor's main.ts first calls installEditorHost to install globalThis.slidesHost,
 * then starts the Slides runtime (which reads the host capabilities when it starts). docs/design/slides §5. The design editor uses connectEditorHost to get the same host object,
 * and attaches it to globalThis.designHost (docs/design/canvas §5).
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

/** Longest time to wait for flush; on timeout, it reports that saving did not finish. */
const FLUSH_TIMEOUT_MS = 8000;

/**
 * Publishes all unsaved changes in the editor. The runtime publishes immediately only on beforeunload (when there are unsaved changes),
 * so fire a cancelable beforeunload: if it is canceled, there are still changes, so wait for this round of publishing to finish and ask again. Returns whether everything was saved.
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
    // Wait one microtask between publishing finishing and the runtime clearing dirty, so it handles the response first
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return true;
}

/** Subscribes to `__deck/events`: when the deck is changed by something other than the editor, first publish its own changes, then reload. */
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
  /** The editor page's address (ending in /); the routes are all relative to it. Defaults to the directory the page is in. */
  base?: string;
  win?: Window & typeof globalThis;
  /** Words used in annotation position labels (only the slides runtime asks for them). */
  commentLabels?: HostCommentLabels;
}

/**
 * Builds the host object and hooks up notifications from the parent window and external changes; the caller attaches it to the global the runtime reads.
 * Shared by the slides and design editors (docs/design/canvas §5).
 */
export function connectEditorHost(options: InstallEditorHostOptions = {}): SlidesHost {
  const win = options.win ?? window;
  const base = options.base ?? new URL('./', win.location.href).href;
  const backend = createHttpBackend(base, (...args) => win.fetch(...args));
  const canEdit = readSessionCanEdit(base, (...args) => win.fetch(...args));
  const link = windowParentLink(win);
  const bridge = link ? createCommentsBridge(link, domPinLayer(win.document)) : null;
  // When the page is opened on its own (not in CucCut's iframe), there is no session to put the hint in, so no chat is provided and the runtime copies to the clipboard directly
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

/** Installs globalThis.slidesHost on the page (slides editor). */
export function installEditorHost(options: InstallEditorHostOptions = {}): void {
  const win = options.win ?? window;
  win.slidesHost = connectEditorHost({
    ...options,
    win,
    // Annotation position labels follow CucCut's UI language (the ?lang= in the address); when opened on its own it is not passed, so it stays in English
    commentLabels: options.commentLabels ?? createCommentLabels(localeFromSearch(win.location.search)),
  });
}
