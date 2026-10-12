import type { FileTarget } from './methods.ts';

/**
 * 会话里的幻灯片（docs/design/slides）：deck 是会话工作目录或项目目录里的一个目录（`deck.json` 加 `slides/*.html`），
 * 在功能区的幻灯片标签里用 Slides 编辑器打开。
 */

/** deck 的概要（读 `deck.json`）。 */
export interface SlidesDeckInfo {
  /** `deck.json` 的 `title`，去掉首尾空白；没有时为空串。 */
  title: string;
  slideCount: number;
}

/** `slides.open` 的结果。 */
export interface SlidesOpenResult {
  /**
   * 编辑器页面的地址，以 `/` 结尾：`<网关 HTTP 基址>/slides/<grant>/`；Web 服务里是同源的相对地址 `/slides/<grant>/`。
   * grant 只在 Runtime 的内存里，Runtime 重启后要重新打开。
   */
  url: string;
  deck: SlidesDeckInfo;
  /** 这台机器有没有构建编辑器（`npm run build:slides-editor`）。没有时界面显示不可用的说明，不加载 `url`。 */
  editorAvailable: boolean;
}

/** 幻灯片标注的上限（docs/design/slides §9）：一条消息带几条、一条批注多长。 */
export const SLIDE_ANNOTATION_LIMITS = { perMessage: 20, text: 2000 } as const;

/**
 * 一条幻灯片标注（docs/design/slides §9）：用户在幻灯片标签里点一个元素或框一块区域写的批注。
 * 随 `conversations.send` / `steer` 挂在消息上，Runtime 发送时拼成一段文字交给智能体；会话里的用户消息上另带一份。
 */
export interface SlideAnnotation {
  /** deck 目录，与 `slides.open` 的 target 相同。 */
  deck: FileTarget;
  /** 运行时的锚点串，用来在编辑器里重新定位与画标记；智能体不需要读懂。 */
  anchor: string;
  /** slide id；运行时给的描述里能解析到时填。 */
  slideId?: string;
  /** 给人看的位置，例如「第 3 页 › 标题 “…”」。 */
  label: string;
  /** 运行时为模型生成的定位描述：页号、slide id、元素路径与原文。 */
  detail?: string;
  /** 区域标注为 true。 */
  area?: boolean;
  /** 用户写的批注，去掉首尾空白。 */
  text: string;
}
