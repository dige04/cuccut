import type { FileTarget } from './methods.ts';

/**
 * 会话里的设计系统（docs/design/canvas §10）：设计系统是会话工作目录或项目目录里的一个目录（`design-system.json` v3、
 * `layout: "files"`，加 README.md、tokens.json、components/、assets/、fonts/），在功能区的设计系统标签里用设计系统编辑器打开。
 */

/** 设计系统的概要（读 `design-system.json`）。 */
export interface DesignSystemInfo {
  /** `design-system.json` 的 `title`，去掉首尾空白；没有时用目录名。 */
  title: string;
  /** 组件包的全局名（`window.<namespace>`）；索引里没有或不合规则时为 null。 */
  namespace: string | null;
}

/** `designSystem.open` 的结果。 */
export interface DesignSystemOpenResult {
  /**
   * 编辑器页面的地址，以 `/` 结尾：`<网关 HTTP 基址>/design-system/<grant>/`；Web 服务里是相对地址 `/design-system/<grant>/`，
   * 由 Web 客户端换到另一个回环主机名再加载（docs/design/canvas §10.4）。界面加载时另加 `?path=<FileTarget.path>&lang=…`。
   * grant 只在 Runtime 的内存里，Runtime 重启后要重新打开。
   */
  url: string;
  system: DesignSystemInfo;
  /** 这台机器有没有构建编辑器（`npm run build:design-system-editor`）。没有时界面显示不可用的说明，不加载 `url`。 */
  editorAvailable: boolean;
}

/** 设计系统标注的上限（docs/design/canvas §10.6）：与设计稿标注相同。 */
export const DESIGN_SYSTEM_ANNOTATION_LIMITS = { perMessage: 20, text: 2000 } as const;

/**
 * 一条设计系统标注（docs/design/canvas §10.6）：用户在设计系统标签里点一处（token、颜色组、文字样式、组件、素材、文档…）写的批注。
 * 随 `conversations.send` / `steer` 挂在消息上，Runtime 发送时拼成一段文字交给智能体；会话里的用户消息上另带一份。
 */
export interface DesignSystemAnnotation {
  /** 设计系统目录，与 `designSystem.open` 的 target 相同。 */
  system: FileTarget;
  /** 运行时标在目标上的 `data-id`（`<前缀>-<名字或哈希>`），用来在编辑器里重新定位与画标记；智能体不需要读懂。 */
  anchor: string;
  /** 目标所在的章节 id（`colors`、`components`…）；跳回去时先到这一章。 */
  section?: string;
  /** 给人看的位置，例如 `设计系统「Spectrum 2」 › Components › 组件 “Button”`。 */
  label: string;
  /** 为模型生成的定位描述（英文，带所在文件与锚点）。 */
  detail?: string;
  /** 用户写的批注，去掉首尾空白。 */
  text: string;
}
