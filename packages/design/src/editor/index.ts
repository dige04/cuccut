/**
 * Entry point of the design editor page (`@cuccut/design/editor`). apps/design-editor's main.ts first calls installDesignEditorHost to set up globalThis.designHost, then starts the design runtime (the runtime reads host capabilities at startup). docs/design/canvas §4, §5.
 *
 * The host object is built by the slide editor's connectEditorHost: files, assets, and external changes go over same-origin HTTP (`_files.json`, `__deck/*`), and messages with the parent window use the same set (packages/slides/src/editor-messages.ts). The design editor adds `downloads` (exported files are handed to the parent window to save), and makes the runtime's own frame protocol trust the parent window, so CucCut can ask it which formats it can export and ask it to export the whole design (§8.3).
 */
import { connectEditorHost, windowParentLink } from '@cuccut/slides/editor';
import { createDownloadsBridge } from './downloads-bridge.ts';

export type * from './design-host.ts';
export { createDownloadsBridge, type DownloadsBridge } from './downloads-bridge.ts';

export interface InstallDesignEditorHostOptions {
  /** The editor page's address (ends with /); routes are relative to it. Defaults to the directory the page is in. */
  base?: string;
  win?: Window & typeof globalThis;
}

/** The page declaration the runtime reads at startup (platform/frame-host-bridge.tsx). */
interface FramePreamble {
  origins?: string[];
  trustParent?: boolean;
}

/** Installs globalThis.designHost on the page (design editor). */
export function installDesignEditorHost(options: InstallDesignEditorHostOptions = {}): void {
  const win = options.win ?? window;
  const host = connectEditorHost({ base: options.base, win });
  const link = windowParentLink(win);
  if (!link) {
    // Page opened on its own (not in CucCut's iframe): there is no parent window to hand off to, so the runtime falls back to browser download
    win.designHost = host;
    return;
  }
  // In desktop, the parent page is file:// (origin is null), so origin can't identify it; like editor-messages, identify it by window.parent
  const page = win as unknown as { __FRAME_PREAMBLE?: FramePreamble };
  page.__FRAME_PREAMBLE = { ...page.__FRAME_PREAMBLE, trustParent: true };
  win.designHost = { ...host, downloads: createDownloadsBridge(link).capability };
}
