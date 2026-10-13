import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** The distribution list for CucCut's license, source declarations, and third-party original licenses; shared by the desktop build, the web build, and the installers. */
export const DISTRIBUTED_NOTICES = [
  { source: 'LICENSE', fileName: 'LICENSE' },
  { source: 'THIRD_PARTY_NOTICES.md', fileName: 'THIRD_PARTY_NOTICES.md' },
  { source: 'crates/model-runtime/licenses/speech-swift.txt', fileName: 'crates/model-runtime/licenses/speech-swift.txt' },
] as const;

/** If a declaration is missing, fail the build, so that only executable code is never distributed on its own. */
export function thirdPartyNotices(root: string): Plugin {
  return {
    name: 'cuccut:third-party-notices',
    apply: 'build',
    generateBundle() {
      for (const { source, fileName } of DISTRIBUTED_NOTICES) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(resolve(root, source)) });
      }
    },
  };
}
