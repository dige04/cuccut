import path from 'node:path';
import os from 'node:os';
import { resolveElectronBinary } from '@cuccut/code-runtime';
import { describe, expect, it } from 'vitest';
import { probeCompositionHost } from './self-check.ts';

describe('probeCompositionHost', () => {
  it.skipIf(!resolveElectronBinary())('with Electron, off-screen host starts and reaches ready', { timeout: 60_000 }, async () => {
    const result = await probeCompositionHost();
    expect(result.detail).toMatch(/^ready in \d+ ms$/);
    expect(result.ok).toBe(true);
  });

  it('without Electron, honestly reports it cannot start', async () => {
    const missing = path.join(os.tmpdir(), 'cuccut-self-check-no-electron', 'Electron');
    const result = await probeCompositionHost({ ...process.env, CUCCUT_ELECTRON: missing });
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/^COMPOSITION_HOST_UNAVAILABLE: /);
  });
});
