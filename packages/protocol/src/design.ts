import type { FileTarget } from './methods.ts';

/**
 * 会话里的设计稿（docs/design/canvas）：设计稿是会话工作目录或项目目录里的一个目录（`canvas.json` v3 加画板文件 `*.dc.html`），
 * 在功能区的设计稿标签里用设计稿编辑器打开。
 */

/** 设计稿的概要（读 `canvas.json`）。 */
export interface DesignCanvasInfo {
  /** `canvas.json` 的 `title`，去掉首尾空白；没有时用目录名。 */
  title: string;
  /** `boards` 里的画板数。 */
  boardCount: number;
}

/** `design.open` 的结果。 */
export interface DesignOpenResult {
  /**
   * 编辑器页面的地址，以 `/` 结尾：`<网关 HTTP 基址>/design/<grant>/`；Web 服务里是相对地址 `/design/<grant>/`，
   * 由 Web 客户端换到另一个回环主机名再加载（docs/design/canvas §6.2）。grant 只在 Runtime 的内存里，Runtime 重启后要重新打开。
   */
  url: string;
  canvas: DesignCanvasInfo;
  /** 这台机器有没有构建编辑器（`npm run build:design-editor`）。没有时界面显示不可用的说明，不加载 `url`。 */
  editorAvailable: boolean;
}

/** 设计稿标注的上限（docs/design/canvas §9）：与幻灯片标注相同。 */
export const DESIGN_ANNOTATION_LIMITS = { perMessage: 20, text: 2000 } as const;

/**
 * 一条设计稿标注（docs/design/canvas §9）：用户在设计稿标签里点一个元素或框一块区域写的批注。
 * 随 `conversations.send` / `steer` 挂在消息上，Runtime 发送时拼成一段文字交给智能体；会话里的用户消息上另带一份。
 */
export interface DesignAnnotation {
  /** 设计稿目录，与 `design.open` 的 target 相同。 */
  canvas: FileTarget;
  /** 运行时的锚点串，用来在编辑器里重新定位与画标记；智能体不需要读懂。 */
  anchor: string;
  /** 画板文件（相对设计稿目录）；运行时的描述里能解析到时填。 */
  board?: string;
  /** 给人看的位置，例如 `Main › 按钮 "立即预订"`。 */
  label: string;
  /** 运行时为模型生成的定位描述（英文）。 */
  detail?: string;
  /** 区域标注为 true。 */
  area?: boolean;
  /** 用户写的批注，去掉首尾空白。 */
  text: string;
}
