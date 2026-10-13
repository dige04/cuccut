/**
 * Entry of the design system editor page (`@cuccut/design-system/editor`). main.ts of apps/design-system-editor first calls
 * installDesignSystemEditorHost to install globalThis.designSystemHost, then starts the design system runtime (which reads host capabilities at startup).
 * docs/design/canvas §10.2, §10.3.
 *
 * The host object is built by connectEditorHost from the design canvas and slide editors: files, assets and external changes go over same-origin HTTP (`_files.json`, `__deck/*`),
 * and messages with the parent window use the same set (packages/slides/src/editor-messages.ts). Here only the capabilities the design system runtime uses are picked out (see
 * design-system-host.ts), with annotations and `use` removed and `user.name()` added.
 *
 * Inside the iframe, connectEditorHost also wires up the annotation bridge (comments-bridge.ts) as a side effect. The design system runtime does not draw a comment layer and does not call `comments`;
 * it only marks targets on the DOM, so the bridge is not handed to the runtime but to the target layer here (comment-targets.ts, docs/design/canvas §10.6).
 */
import { connectEditorHost, localeFromSearch, type SlidesHost } from '@cuccut/slides/editor';
import { createCommentLabels } from './comment-labels.ts';
import { installCommentTargets } from './comment-targets.ts';
import type { DesignSystemHost, DesignSystemHostWindow } from './design-system-host.ts';

export type * from './design-system-host.ts';
export { createCommentLabels, type CommentLabelMessages, type DesignSystemCommentLabels } from './comment-labels.ts';
export { describeTarget, fileOf, findTarget, installCommentTargets, pinPoint, prefixOf, readTarget, REVEAL_COMMENT_TARGET_EVENT, type CommentTarget } from './comment-targets.ts';

/** `__deck/session`, relative to the editor page (DECK_ROUTES.session in @cuccut/slides). */
const SESSION_ROUTE = '__deck/session';

export interface InstallDesignSystemEditorHostOptions {
  /** Address of the editor page (ends with /); routes are all relative to it. Defaults to the directory the page is in. */
  base?: string;
  win?: Window & typeof globalThis;
}

/**
 * `userName` of `__deck/session` (the local user name given by the Runtime, docs/design/canvas §10.3), read once.
 * When it is missing, not a string, or unreadable, the empty string is returned, which the runtime treats as no name available.
 */
export function readSessionUserName(base: string, fetchImpl: typeof fetch = (...args) => fetch(...args)): () => Promise<string> {
  let answer: Promise<string> | undefined;
  return () =>
    (answer ??= fetchImpl(base + SESSION_ROUTE, { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then((body: { userName?: unknown } | null) => (typeof body?.userName === 'string' ? body.userName : ''))
      .catch(() => ''));
}

/** Picks from the editor host object the capabilities the design system runtime uses (design-system-host.ts). */
export function createDesignSystemHost(host: SlidesHost, userName: () => Promise<string>): DesignSystemHost {
  return {
    artifact: host.artifact,
    self: host.self,
    user: { ...host.user, name: userName },
    // Assets are content-addressed; the filename given by the runtime is not used, only type is passed on
    assets: { upload: (file, options) => host.assets.upload(file, options?.type === undefined ? undefined : { type: options.type }) },
    ...(host.chat ? { chat: host.chat } : {}),
  };
}

/**
 * Installs globalThis.designSystemHost on the page (design system editor). Inside CucCut's iframe, also installs the annotation target layer,
 * with position labels following CucCut's UI language (the ?lang= on the address). When opened standalone it is not present, so English is kept.
 */
export function installDesignSystemEditorHost(options: InstallDesignSystemEditorHostOptions = {}): void {
  const win: DesignSystemHostWindow = options.win ?? window;
  const base = options.base ?? new URL('./', win.location.href).href;
  const editor = connectEditorHost({ base, win });
  win.designSystemHost = createDesignSystemHost(editor, readSessionUserName(base, (...args) => win.fetch(...args)));
  if (editor.comments) installCommentTargets({ win, comments: editor.comments, labels: createCommentLabels(localeFromSearch(win.location.search)) });
}
