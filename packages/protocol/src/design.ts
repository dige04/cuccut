import type { FileTarget } from './methods.ts';

/**
 * A design in a session (docs/design/canvas): a design is a directory in the session working directory or the project directory (`canvas.json` v3 plus board files `*.dc.html`), opened in the design editor from the design tab of the feature area.
 */

/** Summary of a design (read from `canvas.json`). */
export interface DesignCanvasInfo {
  /** The `title` of `canvas.json`, trimmed; the directory name when there is none. */
  title: string;
  /** Number of boards in `boards`. */
  boardCount: number;
}

/** Result of `design.open`. */
export interface DesignOpenResult {
  /**
   * Address of the editor page, ending with `/`: `<gateway HTTP base URL>/design/<grant>/`. In the web service it is the relative address `/design/<grant>/`, which the web client swaps for another loopback hostname before loading (docs/design/canvas §6.2). The grant lives only in the Runtime's memory; after the Runtime restarts it must be opened again.
   */
  url: string;
  canvas: DesignCanvasInfo;
  /** Whether the editor has been built on this machine (`npm run build:design-editor`). When it has not, the UI shows an explanation that it is unavailable and does not load `url`. */
  editorAvailable: boolean;
}

/** Annotation limit for designs (docs/design/canvas §9): the same as for slide annotations. */
export const DESIGN_ANNOTATION_LIMITS = { perMessage: 20, text: 2000 } as const;

/**
 * One design annotation (docs/design/canvas §9): a comment the user writes after clicking an element or boxing a region in the design tab.
 * It is attached to the message with `conversations.send` / `steer`; when sending, the Runtime turns it into text for the agent. The user message in the session carries a copy as well.
 */
export interface DesignAnnotation {
  /** Design directory; same as the target of `design.open`. */
  canvas: FileTarget;
  /** The runtime's anchor string, used to relocate it in the editor and draw markers; the agent does not need to understand it. */
  anchor: string;
  /** Board file (relative to the design directory); filled in when the runtime's description can resolve it. */
  board?: string;
  /** Location for people to read, e.g. `Main › 按钮 “立即预订”` (Main › button “Book now”). */
  label: string;
  /** Location description generated for the model by the runtime (English). */
  detail?: string;
  /** True for region annotations. */
  area?: boolean;
  /** The comment the user wrote, trimmed. */
  text: string;
}
