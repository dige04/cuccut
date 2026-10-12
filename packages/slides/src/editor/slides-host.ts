/**
 * Slides 运行时（@cuccut/slides-runtime）从 globalThis.slidesHost 读取的宿主能力（docs/design/slides §4），
 * 由 editor-host.ts 提供。每项能力对应运行时里的读取点（路径相对 packages/slides-runtime/src）：
 *   user     host/user-api.ts（id / canEdit / can / profiles，拿不到就当只读）
 *   artifact files/browser-port.ts 的 publish
 *   self     documents/self-publish.ts（有 publish 方法才允许保存）
 *   assets   media/assets.ts（upload 返回 /_blob/<id>）
 *   comments comments/capability.ts 的 customAnchors（标注：运行时算锚点，宿主弹批注框）
 *   chat     host/agent-session.ts 的 resolvePromptSuggestion（「让智能体修好这页」：提示放进会话的输入框）
 *   commentLabels comments/labels.ts（标注位置标签里的词，跟随 CucCut 的界面语言；CucCut 加的，不是原宿主能力）
 * 不提供 db（文件模式不读）、room（单用户）、hot（外部改动时重新载入）与 downloads。
 */
import type { AnchorDescription, EditorPoint } from '../editor-messages.ts';
import type { PublishBatch, PublishResult, UploadOptions, UploadResult } from '../file-protocol.ts';

export interface UserProfile {
  name: string;
}

export interface HostUserCapability {
  /** 当前用户 id，非空字符串。 */
  id(): Promise<string>;
  canEdit(): Promise<boolean>;
  /** 细分权限（运行时会问 "comment" 等）；返回非布尔值视为未知。 */
  can(capability: string): Promise<boolean>;
  /** 头像、评论署名用；缺失的 id 显示为未知用户。 */
  profiles(ids: readonly string[]): Promise<Record<string, UserProfile>>;
}

export interface HostPublishCapability {
  /** 失败时抛 PublishError（带 code 的普通对象）。 */
  publish(batch: PublishBatch): Promise<PublishResult>;
}

export interface HostAssetsCapability {
  upload(file: Blob, options?: UploadOptions): Promise<UploadResult>;
}

/** 运行时交给宿主的回调（comments/slide-layer.ts 的 useSlideCommentController）。 */
export interface CommentAnchorHandlers {
  /** 标注模式开关。 */
  mode(on: boolean): void;
  /** 当前要画标记的标注；`active` 的那条保留选区高亮。`section` 只有设计系统的标注带（editor-messages.ts 的 `EditorThread`）。 */
  threads(list: { id: string; anchor: string; active: boolean; section?: string }[]): void;
  /** 批注框是否开着。 */
  composing(on: boolean): void;
  /** 拖动标记换位置；CucCut 不支持，不调用。 */
  move(input: unknown, options?: unknown): Promise<unknown>;
  /** 为 true 时运行时自己绑定快捷键 C 开关标注模式（调 enterMode / exitMode）。 */
  hotkey?: boolean;
  /** 跳到这条标注所在的页。 */
  reveal(id: string): void;
}

/** 宿主交回给运行时的控制器。 */
export interface CommentAnchorController {
  /** 请宿主在 point（文档坐标，含滚动）旁弹出批注框；批注框打开后兑现 `{ opened: true }`。 */
  compose(anchor: string, point: EditorPoint, description: AnchorDescription): Promise<{ opened: boolean }>;
  /** 运行时算好的各条标注的位置（文档坐标），宿主据此画编号标记。退出标注模式时给 {}。 */
  placed(positions: Record<string, EditorPoint>): void;
  /** 支持框选区域。 */
  readonly areas: boolean;
  enterMode(): void;
  exitMode(): void;
  release(): void;
}

export interface HostCommentsCapability {
  customAnchors(handlers: CommentAnchorHandlers): Promise<CommentAnchorController>;
}

/** 把提示交给智能体会话（chat-bridge.ts）。 */
export interface HostChatCapability {
  /** 把提示放进会话的输入框，由用户自己发送；放不进去时拒绝，运行时改为复制到剪贴板。 */
  suggestPrompt(prompt: string): Promise<void>;
}

/**
 * 标注位置标签（`label`）里的词（comment-labels.ts）。返回 undefined 或空串时运行时用自己的英文。
 * `detail` 给智能体定位，不经这里。
 */
export interface HostCommentLabels {
  /** 标签开头的页号，例如 `Slide 3`。 */
  slide(n: number): string;
  /** 文字角色（display、h1 … caption）。 */
  textRole(role: string): string | undefined;
  /** 其他节点的种类；形状带变体，表格带行列数。 */
  element(node: { kind: string; shape?: string; rows?: number; cols?: number }): string | undefined;
  /** 框选区域的方位：参数是运行时的英文短语（如 `top left`），返回值含前面的空格与括号。 */
  areaPart(part: string): string | undefined;
  /** 框选区域还盖住了几个元素，含前面的分隔符。 */
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
  /** 按名字异步加载能力（environment/host-capabilities.ts）。CucCut 不提供，运行时就直接读上面的字段。 */
  use?(name: string): Promise<unknown>;
}

declare global {
  // eslint-disable-next-line no-var -- 全局变量只能用 var 声明
  var slidesHost: SlidesHost | undefined;
}
