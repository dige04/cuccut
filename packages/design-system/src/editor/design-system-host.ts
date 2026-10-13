/**
 * Host capabilities that the design system runtime (@cuccut/design-system-runtime) reads from globalThis.designSystemHost (docs/design/canvas §10.3).
 * The original runtime read globalThis.claude. When porting, all of these read points were changed to designSystemHost, each marked with a `CucCut:` comment.
 *
 * The host object is based on connectEditorHost from the design canvas and slide editors (@cuccut/slides/editor), with annotations, annotation labels and `use` removed,
 * and `user.name()` added. Where each capability is read in the runtime (paths relative to packages/design-system-runtime/src):
 *   artifact / self  files/browser-port.ts (publish batch-writes files, with ifMatch), documents/self-publish.ts (saving is allowed only if publish exists)
 *   user             host/user-api.ts: id / canEdit / can. name goes to lastChange.by (manifest.json), taken from `userName` of `__deck/session`,
 *                    an empty string if missing, which the runtime treats as no name available. isOwner is not provided, so the runtime treats the user as not the owner.
 *   assets           media/assets.ts, model/asset-store.ts (uploads images, fonts, etc., returning /_blob/<id>; `name` is unused, only `type` is passed on)
 *   chat             editor/claude-delivery.tsx resolvePromptSuggestion ("Ask the agent"-style requests: owner-voiced prompts are placed in the session's
 *                    input box for the user to send). When the page is not in CucCut's iframe this is absent, and the runtime falls back to copying to the clipboard.
 * Not provided (the runtime has fallbacks for all of them, see packages/design-system-runtime/README.md):
 *   use        asynchronously gets a capability by name (host/claude-capabilities.ts); without it, the fields above are read directly. Providing it would make the editor treat downloads as not permitted when the page declares downloads and the host does not provide them (editor/download-permission.tsx).
 *   comments   the runtime does not call it (it only marks targets on the DOM); the annotation bridge is handed to the host's own target layer (comment-targets.ts, docs/design/canvas §10.6).
 *              sendToClaude and anchorFor are not provided either, so claude-delivery skips the comment-thread path.
 *   room       multi-user online and session routing (resolveClaudeRoom in editor/claude-delivery.tsx); single user, so prompts go through chat.
 *   hot        applies external changes in place (host/hot-reload.ts); CucCut first publishes unsaved changes and then reloads (same as slides 6.5).
 *   db         the old database storage; the runtime works in file mode.
 *   downloads  same as the design canvas: export and download fall back to the browser download.
 *   commentLabels only the slide runtime asks for this.
 */
import type { HostUserCapability, SlidesHost } from '@cuccut/slides/editor';

type SlidesUpload = SlidesHost['assets']['upload'];
type UploadOptions = NonNullable<Parameters<SlidesUpload>[1]>;
type UploadResult = Awaited<ReturnType<SlidesUpload>>;

export interface DesignSystemUserCapability extends HostUserCapability {
  /** Local user name (`userName` of `__deck/session`); empty string if missing. */
  name(): Promise<string>;
}

export interface DesignSystemUploadOptions extends UploadOptions {
  /** Filename given by the runtime. CucCut's assets are content-addressed (`_blobs/<id>.<ext>`), so it is not used. */
  name?: string;
}

export interface DesignSystemAssetsCapability {
  upload(file: Blob, options?: DesignSystemUploadOptions): Promise<UploadResult>;
}

export type DesignSystemHost = Omit<SlidesHost, 'comments' | 'commentLabels' | 'use' | 'user' | 'assets'> & {
  user: DesignSystemUserCapability;
  assets: DesignSystemAssetsCapability;
};

/**
 * The window that has the host installed. `declare global` is not used here to declare designSystemHost: the runtime's own type (ProtocolGlobal in contracts/platform-host.ts)
 * already declares it, and two declarations checked together (packages/design-system-runtime/tsconfig.json checks them along with the page entry) would conflict.
 */
export type DesignSystemHostWindow = Window & typeof globalThis & { designSystemHost?: DesignSystemHost };
