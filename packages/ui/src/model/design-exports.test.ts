import { describe, expect, it } from 'vitest';
import { exportCommand, FRAME_CHROME_POKE, readFrameChromeMessage } from './design-exports.ts';

describe('设计稿运行时的 frame 协议', () => {
  it('认 hello；碰一下时不接管保存状态（rows: false）', () => {
    expect(readFrameChromeMessage({ __frame_chrome_hello: true })).toEqual({ kind: 'hello' });
    expect(FRAME_CHROME_POKE).toEqual({ __frame_chrome_poke: true, rows: false });
  });

  it('report 里只留菜单里有的格式，按 HTML、PDF、PNG 排，字段只认布尔值', () => {
    const message = readFrameChromeMessage({
      __frame_chrome_report: true,
      snapshot: {
        v: 1,
        saved: 'saved',
        exports: [
          { format: 'png', interactive: true, bundle: true, disabled: false },
          { format: 'pptx' },
          { format: 'html' },
          { format: 'pdf', disabled: true, interactive: 'yes' },
          { format: 'html', disabled: true },
          'html',
        ],
      },
    });
    expect(message).toEqual({
      kind: 'report',
      exports: [
        { format: 'html', disabled: false, interactive: false, bundle: false },
        { format: 'pdf', disabled: true, interactive: false, bundle: false },
        { format: 'png', disabled: false, interactive: true, bundle: true },
      ],
    });
  });

  it('没有 exports 的 report 是空列表；版本不对、形状不对的不认', () => {
    expect(readFrameChromeMessage({ __frame_chrome_report: true, snapshot: { v: 1, saved: 'saving' } })).toEqual({ kind: 'report', exports: [] });
    expect(readFrameChromeMessage({ __frame_chrome_report: true, snapshot: { v: 2, exports: [] } })).toBeNull();
    expect(readFrameChromeMessage({ __frame_chrome_report: true, snapshot: { v: 1, exports: {} } })).toBeNull();
    expect(readFrameChromeMessage({ __frame_chrome_report: true })).toBeNull();
    expect(readFrameChromeMessage({ __frame_chrome_decline: true, request: 'r'.repeat(20) })).toBeNull();
    expect(readFrameChromeMessage({ type: 'editor:ready', canEdit: true })).toBeNull();
    expect(readFrameChromeMessage(null)).toBeNull();
  });

  it('导出命令照运行时报的给 interactive；bundle 只在 interactive 时带', () => {
    const request = crypto.randomUUID();
    // 运行时只认 16–64 个字母、数字、_、-（frame-host-bridge.tsx）
    expect(request).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(exportCommand({ format: 'html', disabled: false, interactive: false, bundle: false }, request)).toEqual({
      __frame_chrome_cmd: true,
      cmd: 'export',
      format: 'html',
      request,
      interactive: false,
    });
    expect(exportCommand({ format: 'png', disabled: false, interactive: true, bundle: true }, request)).toMatchObject({ interactive: true, bundle: true });
    expect(exportCommand({ format: 'png', disabled: false, interactive: false, bundle: true }, request)).not.toHaveProperty('bundle');
  });
});
