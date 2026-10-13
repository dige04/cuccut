import type { FileTarget } from './methods.ts';

/**
 * Slides in a session (docs/design/slides): a deck is a directory in the session's working directory or the project directory (`deck.json` plus `slides/*.html`),
 * opened with the Slides editor from the slides tab in the ribbon.
 */

/** Deck summary (read from `deck.json`). */
export interface SlidesDeckInfo {
  /** The `title` from `deck.json`, trimmed of leading and trailing whitespace; an empty string if there is none. */
  title: string;
  slideCount: number;
}

/** Result of `slides.open`. */
export interface SlidesOpenResult {
  /**
   * Address of the editor page, ending in `/`: `<gateway HTTP base>/slides/<grant>/`; in the Web service it is the same-origin relative address `/slides/<grant>/`.
   * The grant exists only in the Runtime's memory, so after the Runtime restarts the deck must be opened again.
   */
  url: string;
  deck: SlidesDeckInfo;
  /** Whether this machine has built the editor (`npm run build:slides-editor`). When it has not, the UI shows an unavailable notice and does not load `url`. */
  editorAvailable: boolean;
}

/** Limits on slide annotations (docs/design/slides §9): how many one message can carry, and how long one comment can be. */
export const SLIDE_ANNOTATION_LIMITS = { perMessage: 20, text: 2000 } as const;

/**
 * One slide annotation (docs/design/slides §9): a comment the user writes by clicking an element or boxing a region in the slides tab.
 * It is attached to a message via `conversations.send` / `steer`; the Runtime turns it into text when sending and hands it to the agent. The user message in the session carries a copy as well.
 */
export interface SlideAnnotation {
  /** The deck directory, the same as the target of `slides.open`. */
  deck: FileTarget;
  /** A runtime anchor string, used to re-locate the element and draw markers in the editor; the agent does not need to read it. */
  anchor: string;
  /** The slide id; filled in when it can be resolved from the description given by the runtime. */
  slideId?: string;
  /** A human-readable location, e.g. “第 3 页 › 标题 ‘…’” (page 3 › title ‘…’). */
  label: string;
  /** The location description the runtime generates for the model: page number, slide id, element path and original text. */
  detail?: string;
  /** True for region annotations. */
  area?: boolean;
  /** The comment the user wrote, trimmed of leading and trailing whitespace. */
  text: string;
}
