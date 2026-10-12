/**
 * 设计稿整份导出（docs/design/canvas §8.3）：设计稿运行时自己的 frame 协议（packages/design-runtime/src/platform/frame-host-bridge.tsx）。
 *
 * 运行时启动后向父窗口发 `__frame_chrome_hello`；父窗口回 `__frame_chrome_poke`（`rows: false`：保存状态仍由编辑器自己画），
 * 运行时记下父窗口，之后每次能导出的格式变了都发 `__frame_chrome_report`。父窗口在菜单里选一种，发 `__frame_chrome_cmd`
 * 的 `export`，运行时做出文件后经 `downloads` 交回父窗口保存（`editor:save-file`）。导出失败、取消时运行时自己提示，
 * 父窗口不另外提示，所以不读 `__frame_chrome_decline`。
 *
 * 这里只认 CucCut 菜单里有的格式；字段类型都核对，不信任 iframe。
 */

/** 菜单里的格式，按这个顺序列。 */
export const DESIGN_EXPORT_FORMATS = ['html', 'pdf', 'png'] as const;
export type DesignExportFormat = (typeof DESIGN_EXPORT_FORMATS)[number];

/** 运行时报的一种可导出格式。`interactive`：画板不止一个时，运行时先在编辑器里让用户挑画板；`bundle`：可以一次导出多个画板（压缩包）。 */
export interface DesignExportOption {
  format: DesignExportFormat;
  disabled: boolean;
  interactive: boolean;
  bundle: boolean;
}

/** 编辑器 iframe 发来的 frame 协议消息里，父窗口要的那两种。 */
export type FrameChromeMessage = { kind: 'hello' } | { kind: 'report'; exports: DesignExportOption[] };

/** 回 hello、编辑器载入后发的那一条。 */
export const FRAME_CHROME_POKE = { __frame_chrome_poke: true, rows: false } as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const FORMATS = new Set<string>(DESIGN_EXPORT_FORMATS);

/** 父窗口收到的数据是不是运行时 frame 协议里的 hello 或 report；别的（含编辑器消息）返回 null。 */
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
 * 要运行时导出一种格式。`request` 是这一次的编号（运行时只认 16–64 个字母、数字、`_`、`-`）；
 * `interactive` 与 `bundle` 照运行时报的给，多画板时它会在编辑器里让用户挑。
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
