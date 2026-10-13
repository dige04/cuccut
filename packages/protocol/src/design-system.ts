import type { FileTarget } from './methods.ts';

/**
 * A design system in a session (docs/design/canvas §10): a design system is a directory in the session working directory or the project directory (`design-system.json` v3, `layout: "files"`, plus README.md, tokens.json, components/, assets/, fonts/). It is opened in the design system editor from the design system tab of the feature area.
 */

/** Summary of a design system (read from `design-system.json`). */
export interface DesignSystemInfo {
  /** The `title` of `design-system.json`, trimmed; the directory name when there is none. */
  title: string;
  /** The global name of the component bundle (`window.<namespace>`); null when the index does not have it or it is not valid. */
  namespace: string | null;
}

/** Result of `designSystem.open`. */
export interface DesignSystemOpenResult {
  /**
   * Address of the editor page, ending with `/`: `<gateway HTTP base URL>/design-system/<grant>/`. In the web service it is the relative address `/design-system/<grant>/`, which the web client swaps for another loopback hostname before loading (docs/design/canvas §10.4). The UI appends `?path=<FileTarget.path>&lang=…` when it loads.
   * The grant lives only in the Runtime's memory; after the Runtime restarts it must be opened again.
   */
  url: string;
  system: DesignSystemInfo;
  /** Whether the editor has been built on this machine (`npm run build:design-system-editor`). When it has not, the UI shows an explanation that it is unavailable and does not load `url`. */
  editorAvailable: boolean;
}

/** Annotation limit for design systems (docs/design/canvas §10.6): the same as for design annotations. */
export const DESIGN_SYSTEM_ANNOTATION_LIMITS = { perMessage: 20, text: 2000 } as const;

/**
 * One design system annotation (docs/design/canvas §10.6): a comment the user writes after clicking a spot in the design system tab (a token, color group, text style, component, asset, document…).
 * It is attached to the message with `conversations.send` / `steer`; when sending, the Runtime turns it into text for the agent. The user message in the session carries a copy as well.
 */
export interface DesignSystemAnnotation {
  /** Design system directory; same as the target of `designSystem.open`. */
  system: FileTarget;
  /** The `data-id` the runtime puts on the target (`<prefix>-<name or hash>`), used to relocate it in the editor and draw markers; the agent does not need to understand it. */
  anchor: string;
  /** Id of the section the target is in (`colors`, `components`…); jumping back goes to that section first. */
  section?: string;
  /** Location for people to read, e.g. `设计系统「Spectrum 2」 › Components › 组件 “Button”` (design system “Spectrum 2” › Components › component “Button”). */
  label: string;
  /** Location description generated for the model (English, with the file it is in and its anchor). */
  detail?: string;
  /** The comment the user wrote, trimmed. */
  text: string;
}
