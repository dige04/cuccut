import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // As in both clients: PDF assets are imported as static bytes, not executed as JS or native WASM.
  assetsInclude: ['**/*.bcmap', '**/*.pfb', '**/*.wasm'],
  test: {
    // The tests under designs/ belong to the prototypes themselves; they are not run here.
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts', 'tools/*.test.ts'],
    environment: 'node',
    setupFiles: ['tools/vitest-storage.setup.ts'],
    // Runtime tests also spawn native workers, ffmpeg and Electron processes.
    maxWorkers: Math.min(4, os.availableParallelism()),
    // The CLI's offline catalog snapshot (apps/cli/src/generated/catalog.json, not in git): before the tests, write one from the current tool catalog.
    globalSetup: ['tools/catalog-snapshot.setup.ts'],
    testTimeout: 15_000,
    // When no download directory is set, the flow falls back to the host's Downloads, so tests always point to a temp directory created fresh for each run.
    // On-demand font download (§9.1) does not touch the network by default: a Runtime that was not given a font directory has no families to download.
    env: {
      CUCCUT_DOWNLOADS_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'cuccut-test-downloads-')),
      CUCCUT_FONT_DOWNLOADS: 'off',
      // Assertions are written against Simplified Chinese copy: the test process and the Runtime it launches are both pinned to Simplified Chinese (@cuccut/protocol i18n). To test English, swap it out with vi.stubEnv.
      CUCCUT_LOCALE: 'zh-Hans',
    },
  },
});
