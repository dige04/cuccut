/**
 * 设计系统编辑器页面的入口（`@cuccut/design-system/editor`）：apps/design-system-editor 的 main.ts 先调
 * installDesignSystemEditorHost 装好 globalThis.designSystemHost，再启动设计系统运行时（运行时启动时就读宿主能力）。
 * docs/design/canvas §10.2、§10.3。
 *
 * 宿主对象由设计稿与幻灯片编辑器的 connectEditorHost 做：文件、素材、外部改动走同源 HTTP（`_files.json`、`__deck/*`），
 * 与父窗口的消息也是同一套（packages/slides/src/editor-messages.ts）。这里只挑出设计系统运行时用得上的能力（见
 * design-system-host.ts），去掉标注与 `use`，另给 `user.name()`。
 *
 * connectEditorHost 在 iframe 里会顺带接好标注的桥（comments-bridge.ts）。设计系统运行时不画批注层、也不调 `comments`，
 * 只在 DOM 上标目标，所以桥不交给运行时，交给这里的目标层（comment-targets.ts，docs/design/canvas §10.6）。
 */
import { connectEditorHost, localeFromSearch, type SlidesHost } from '@cuccut/slides/editor';
import { createCommentLabels } from './comment-labels.ts';
import { installCommentTargets } from './comment-targets.ts';
import type { DesignSystemHost, DesignSystemHostWindow } from './design-system-host.ts';

export type * from './design-system-host.ts';
export { createCommentLabels, type CommentLabelMessages, type DesignSystemCommentLabels } from './comment-labels.ts';
export { describeTarget, fileOf, findTarget, installCommentTargets, pinPoint, prefixOf, readTarget, REVEAL_COMMENT_TARGET_EVENT, type CommentTarget } from './comment-targets.ts';

/** `__deck/session`，相对编辑器页面（@cuccut/slides 的 DECK_ROUTES.session）。 */
const SESSION_ROUTE = '__deck/session';

export interface InstallDesignSystemEditorHostOptions {
  /** 编辑器页面的地址（以 / 结尾），路由都相对它。默认是页面所在目录。 */
  base?: string;
  win?: Window & typeof globalThis;
}

/**
 * `__deck/session` 的 `userName`（Runtime 给的本机用户名，docs/design/canvas §10.3），只读一次。
 * 没有、不是字符串或读不到时为空串，运行时当作取不到名字。
 */
export function readSessionUserName(base: string, fetchImpl: typeof fetch = (...args) => fetch(...args)): () => Promise<string> {
  let answer: Promise<string> | undefined;
  return () =>
    (answer ??= fetchImpl(base + SESSION_ROUTE, { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then((body: { userName?: unknown } | null) => (typeof body?.userName === 'string' ? body.userName : ''))
      .catch(() => ''));
}

/** 从编辑器宿主对象挑出设计系统运行时用的能力（design-system-host.ts）。 */
export function createDesignSystemHost(host: SlidesHost, userName: () => Promise<string>): DesignSystemHost {
  return {
    artifact: host.artifact,
    self: host.self,
    user: { ...host.user, name: userName },
    // 素材按内容寻址，运行时给的文件名不用，只转交 type
    assets: { upload: (file, options) => host.assets.upload(file, options?.type === undefined ? undefined : { type: options.type }) },
    ...(host.chat ? { chat: host.chat } : {}),
  };
}

/**
 * 在页面上装好 globalThis.designSystemHost（设计系统编辑器）；在 CucCut 的 iframe 里时另装标注的目标层，
 * 位置标签跟随 CucCut 的界面语言（地址上的 ?lang=），单独打开时没带，保持英文。
 */
export function installDesignSystemEditorHost(options: InstallDesignSystemEditorHostOptions = {}): void {
  const win: DesignSystemHostWindow = options.win ?? window;
  const base = options.base ?? new URL('./', win.location.href).href;
  const editor = connectEditorHost({ base, win });
  win.designSystemHost = createDesignSystemHost(editor, readSessionUserName(base, (...args) => win.fetch(...args)));
  if (editor.comments) installCommentTargets({ win, comments: editor.comments, labels: createCommentLabels(localeFromSearch(win.location.search)) });
}
