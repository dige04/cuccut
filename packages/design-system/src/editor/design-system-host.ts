/**
 * 设计系统运行时（@cuccut/design-system-runtime）从 globalThis.designSystemHost 读取的宿主能力（docs/design/canvas §10.3）。
 * 原运行时读 globalThis.claude；移植时把这些读取点都改成了 designSystemHost，每处带 `CucCut:` 注释。
 *
 * 宿主对象基于设计稿与幻灯片编辑器的 connectEditorHost（@cuccut/slides/editor），去掉标注、标注标签与 `use`，
 * 另给 `user.name()`。各能力在运行时里的读取点（路径相对 packages/design-system-runtime/src）：
 *   artifact / self  files/browser-port.ts（publish 批量写文件，带 ifMatch）、documents/self-publish.ts（有 publish 才允许保存）
 *   user             host/user-api.ts：id / canEdit / can；name 给 lastChange.by（manifest.json），取 `__deck/session` 的
 *                    `userName`，没有时为空串，运行时当作取不到名字；不提供 isOwner，运行时当作不是所有者
 *   assets           media/assets.ts、model/asset-store.ts（上传图片、字体等，返回 /_blob/<id>；`name` 不用，只转交 `type`）
 *   chat             editor/claude-delivery.tsx 的 resolvePromptSuggestion（「Ask the agent」类请求：owner 口吻的提示放进
 *                    会话的输入框，由用户发送）；页面不在 CucCut 的 iframe 里时没有，运行时退回复制到剪贴板
 * 不提供（运行时都有兜底，见 packages/design-system-runtime/README.md）：
 *   use        按名字异步取能力（host/claude-capabilities.ts）；没有时直接读上面的字段。提供了会让编辑器在页面声明了
 *              downloads 而宿主不给时判为不许下载（editor/download-permission.tsx）
 *   comments   运行时不调它（只在 DOM 上标目标）；标注的桥交给宿主自己的目标层（comment-targets.ts，docs/design/canvas §10.6）。
 *              也不提供 sendToClaude / anchorFor，claude-delivery 于是跳过评论线程这条路
 *   room       多人在线与会话路由（editor/claude-delivery.tsx 的 resolveClaudeRoom）；单用户，提示走 chat
 *   hot        外部改动就地应用（host/hot-reload.ts）；CucCut 先发布未保存的改动再重新载入（同幻灯片 6.5）
 *   db         旧的数据库存储；运行时按文件模式工作
 *   downloads  同设计稿：导出与下载退回浏览器下载
 *   commentLabels 只有幻灯片运行时会问
 */
import type { HostUserCapability, SlidesHost } from '@cuccut/slides/editor';

type SlidesUpload = SlidesHost['assets']['upload'];
type UploadOptions = NonNullable<Parameters<SlidesUpload>[1]>;
type UploadResult = Awaited<ReturnType<SlidesUpload>>;

export interface DesignSystemUserCapability extends HostUserCapability {
  /** 本机用户名（`__deck/session` 的 `userName`）；没有时为空串。 */
  name(): Promise<string>;
}

export interface DesignSystemUploadOptions extends UploadOptions {
  /** 运行时给的文件名；CucCut 的素材按内容寻址（`_blobs/<id>.<ext>`），不用它。 */
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
 * 装了宿主的窗口。这里不用 `declare global` 声明 designSystemHost：运行时自己的类型（contracts/platform-host.ts 的
 * ProtocolGlobal）已经声明了它，两份声明放进同一个检查（packages/design-system-runtime/tsconfig.json 连同页面入口一起查）会冲突。
 */
export type DesignSystemHostWindow = Window & typeof globalThis & { designSystemHost?: DesignSystemHost };
