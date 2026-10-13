import { describe, expect, it } from 'vitest';
import { exportCommand, FRAME_CHROME_POKE, readFrameChromeMessage } from './design-exports.ts';

describe('design runtime frame protocol', () => {
  it('accepts hello; touching does not take over save state (rows: false)', () => {
    expect(readFrameChromeMessage({ __frame_chrome_hello: true })).toEqual({ kind: 'hello' });
    expect(FRAME_CHROME_POKE).toEqual({ __frame_chrome_poke: true, rows: false });
  });

  it('report keeps only the formats in the menu, ordered HTML, PDF, PNG; fields accept only booleans', () => {
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

  it('a report without exports is an empty list; wrong version or wrong shape is rejected', () => {
    expect(readFrameChromeMessage({ __frame_chrome_report: true, snapshot: { v: 1, saved: 'saving' } })).toEqual({ kind: 'report', exports: [] });
    expect(readFrameChromeMessage({ __frame_chrome_report: true, snapshot: { v: 2, exports: [] } })).toBeNull();
    expect(readFrameChromeMessage({ __frame_chrome_report: true, snapshot: { v: 1, exports: {} } })).toBeNull();
    expect(readFrameChromeMessage({ __frame_chrome_report: true })).toBeNull();
    expect(readFrameChromeMessage({ __frame_chrome_decline: true, request: 'r'.repeat(20) })).toBeNull();
    expect(readFrameChromeMessage({ type: 'editor:ready', canEdit: true })).toBeNull();
    expect(readFrameChromeMessage(null)).toBeNull();
  });

  it('export command uses the interactive mode the runtime reports; bundle is included only in interactive mode', () => {
    const request = crypto.randomUUID();
    // The runtime only accepts 16–64 letters, digits, _, - (frame-host-bridge.tsx)
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
