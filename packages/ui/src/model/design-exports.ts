/**
 * Full export of a design draft (docs/design/canvas §8.3): the design runtime's own frame protocol (packages/design-runtime/src/platform/frame-host-bridge.tsx).
 *
 * After it starts, the runtime posts `__frame_chrome_hello` to the parent window. The parent replies `__frame_chrome_poke` (`rows: false`: saving state is still drawn by the editor itself). The runtime records the parent window and posts `__frame_chrome_report` every time the set of exportable formats changes. The parent picks one format in its menu and posts `export` in `__frame_chrome_cmd`. After making the file, the runtime hands it back to the parent through `downloads` for saving (`editor:save-file`). On failure or cancel, the runtime shows its own notice, and the parent shows nothing extra, so it does not read `__frame_chrome_decline`.
 *
 * This only accepts the formats in the CucCut menu. All field types are checked; the iframe is not trusted.
 */

/** The formats in the menu, listed in this order. */
export const DESIGN_EXPORT_FORMATS = ['html', 'pdf', 'png'] as const;
export type DesignExportFormat = (typeof DESIGN_EXPORT_FORMATS)[number];

/** One exportable format reported by the runtime. `interactive`: when there is more than one artboard, the runtime first lets the user pick an artboard in the editor. `bundle`: several artboards can be exported at once (archive). */
export interface DesignExportOption {
  format: DesignExportFormat;
  disabled: boolean;
  interactive: boolean;
  bundle: boolean;
}

/** Of the messages in the frame protocol sent by the editor iframe, the two kinds the parent wants. */
export type FrameChromeMessage = { kind: 'hello' } | { kind: 'report'; exports: DesignExportOption[] };

/** The message sent after replying to hello, once the editor has loaded. */
export const FRAME_CHROME_POKE = { __frame_chrome_poke: true, rows: false } as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const FORMATS = new Set<string>(DESIGN_EXPORT_FORMATS);

/** Whether the data the parent receives is a hello or report in the runtime frame protocol. Anything else (including editor messages) returns null. */
export function readFrameChromeMessage(data: unknown): FrameChromeMessage | null {
  if (!isRecord(data)) return null;
  if (data.__frame_chrome_hello === true) return { kind: 'hello' };
  if (data.__frame_chrome_report !== true) return null;
  const snapshot = data.snapshot;
  if (!isRecord(snapshot) || snapshot.v !== 1) return null;
  const list = snapshot.exports;
  if (list !== undefined && !Array.isArray(list)) return null;
  const exports: DesignExportOption[] = [];
  for (const item of list ?? []) {
    if (!isRecord(item) || typeof item.format !== 'string' || !FORMATS.has(item.format)) continue;
    if (exports.some((e) => e.format === item.format)) continue;
    exports.push({
      format: item.format as DesignExportFormat,
      disabled: item.disabled === true,
      interactive: item.interactive === true,
      bundle: item.bundle === true,
    });
  }
  exports.sort((a, b) => DESIGN_EXPORT_FORMATS.indexOf(a.format) - DESIGN_EXPORT_FORMATS.indexOf(b.format));
  return { kind: 'report', exports };
}

/**
 * Ask the runtime to export one format. `request` is the number of this call (the runtime only accepts 16–64 letters, digits, `_`, `-`).
 * `interactive` and `bundle` are passed as the runtime reported them. With several artboards, it lets the user pick one in the editor.
 */
export function exportCommand(option: DesignExportOption, request: string) {
  return {
    __frame_chrome_cmd: true,
    cmd: 'export',
    format: option.format,
    request,
    interactive: option.interactive,
    ...(option.interactive && option.bundle ? { bundle: true } : {}),
  } as const;
}
