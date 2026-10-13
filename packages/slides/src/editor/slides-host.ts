/**
 * Host capabilities that the Slides runtime (@cuccut/slides-runtime) reads from globalThis.slidesHost (docs/design/slides §4),
 * provided by editor-host.ts. Each capability corresponds to a read point in the runtime (paths relative to packages/slides-runtime/src):
 *   user     host/user-api.ts (id / canEdit / can / profiles; treated as read-only when missing)
 *   artifact publish in files/browser-port.ts
 *   self     documents/self-publish.ts (saving is allowed only when there is a publish method)
 *   assets   media/assets.ts (upload returns /_blob/<id>)
 *   comments customAnchors in comments/capability.ts (annotations: the runtime computes the anchor, the host opens the composer)
 *   chat     resolvePromptSuggestion in host/agent-session.ts (“have the agent fix this page”: the prompt is put into the session's input box)
 *   commentLabels words in comments/labels.ts (words for annotation position labels, following CucCut's UI language; added by CucCut, not an original host capability)
 * Does not provide db (file mode does not read it), room (single user), hot (reloads on external changes) or downloads.
 */
import type { AnchorDescription, EditorPoint } from '../editor-messages.ts';
import type { PublishBatch, PublishResult, UploadOptions, UploadResult } from '../file-protocol.ts';

export interface UserProfile {
  name: string;
}

export interface HostUserCapability {
  /** Current user id, a non-empty string. */
  id(): Promise<string>;
  canEdit(): Promise<boolean>;
  /** Fine-grained permission (the runtime asks for names such as "comment"); a return value that is not a boolean is treated as unknown. */
  can(capability: string): Promise<boolean>;
  /** Used for avatars and comment attribution; a missing id is shown as an unknown user. */
  profiles(ids: readonly string[]): Promise<Record<string, UserProfile>>;
}

export interface HostPublishCapability {
  /** Throws a PublishError (a plain object with a code) on failure. */
  publish(batch: PublishBatch): Promise<PublishResult>;
}

export interface HostAssetsCapability {
  upload(file: Blob, options?: UploadOptions): Promise<UploadResult>;
}

/** Callbacks the runtime hands to the host (useSlideCommentController in comments/slide-layer.ts). */
export interface CommentAnchorHandlers {
  /** Annotation mode toggle. */
  mode(on: boolean): void;
  /** The annotations to draw markers for now; the one that is `active` keeps its selection highlight. `section` is only present for the design system's annotation band (`EditorThread` in editor-messages.ts). */
  threads(list: { id: string; anchor: string; active: boolean; section?: string }[]): void;
  /** Whether the composer is open. */
  composing(on: boolean): void;
  /** Dragging a marker to move it; CucCut does not support this, so it is not called. */
  move(input: unknown, options?: unknown): Promise<unknown>;
  /** When true, the runtime binds the C shortcut itself to toggle annotation mode (calls enterMode / exitMode). */
  hotkey?: boolean;
  /** Jumps to the slide where this annotation is. */
  reveal(id: string): void;
}

/** Controller the host hands back to the runtime. */
export interface CommentAnchorController {
  /** Asks the host to open the composer next to `point` (document coordinates, including scroll); settles with `{ opened: true }` once the composer is open. */
  compose(anchor: string, point: EditorPoint, description: AnchorDescription): Promise<{ opened: boolean }>;
  /** The position (document coordinates) of each annotation, computed by the runtime; the host draws the numbered markers from these. Passed as {} when leaving annotation mode. */
  placed(positions: Record<string, EditorPoint>): void;
  /** Supports selecting an area by dragging a box. */
  readonly areas: boolean;
  enterMode(): void;
  exitMode(): void;
  release(): void;
}

export interface HostCommentsCapability {
  customAnchors(handlers: CommentAnchorHandlers): Promise<CommentAnchorController>;
}

/** Hands a prompt to the agent session (chat-bridge.ts). */
export interface HostChatCapability {
  /** Puts the prompt into the session's input box for the user to send; rejects if it cannot be put there, and the runtime then copies it to the clipboard instead. */
  suggestPrompt(prompt: string): Promise<void>;
}

/**
 * Words in annotation position labels (`label`) (comment-labels.ts). When this returns undefined or an empty string, the runtime uses its own English.
 * `detail` is for the agent to locate, and does not go through here.
 */
export interface HostCommentLabels {
  /** The slide number at the start of the label, e.g. `Slide 3`. */
  slide(n: number): string;
  /** Text role (display, h1 … caption). */
  textRole(role: string): string | undefined;
  /** Kind of other nodes; shapes carry a variant, and tables carry their row and column counts. */
  element(node: { kind: string; shape?: string; rows?: number; cols?: number }): string | undefined;
  /** Position of the selected area: the argument is the runtime's English phrase (e.g. `top left`), and the return value includes the leading space and parentheses. */
  areaPart(part: string): string | undefined;
  /** How many other elements the selected area covers, including the leading separator. */
  covered(n: number): string;
}

export interface SlidesHost {
  artifact: HostPublishCapability;
  self: HostPublishCapability;
  user: HostUserCapability;
  assets: HostAssetsCapability;
  comments?: HostCommentsCapability;
  chat?: HostChatCapability;
  commentLabels?: HostCommentLabels;
  /** Loads a capability asynchronously by name (environment/host-capabilities.ts). CucCut does not provide this, so the runtime reads the fields above directly. */
  use?(name: string): Promise<unknown>;
}

declare global {
  // eslint-disable-next-line no-var -- globals can only be declared with var
  var slidesHost: SlidesHost | undefined;
}
