import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { patchPptxgenjs, pptxgenjsDistFile } from '@cuccut/slides-runtime/pptxgenjs-patch';
import { bundledPackageDirs, thirdPartyLicenses } from './licenses.mjs';

/** PptxGenJS 的应用扩展在构建时打进读到的发行文件，不改 node_modules（packages/slides-runtime/patches）。 */
function pptxgenjsExtensions(): Plugin {
  return {
    name: 'cuccut-pptxgenjs-extensions',
    load(id) {
      const file = pptxgenjsDistFile(id);
      return file ? patchPptxgenjs(readFileSync(id.replace(/\?.*$/, ''), 'utf8'), file) : null;
    },
  };
}

/** 页面打进去的第三方代码的原始许可，放在产物根目录的 third-party-licenses.txt。 */
function editorLicenses(): Plugin {
  return {
    name: 'cuccut-slides-editor-licenses',
    apply: 'build',
    generateBundle() {
      const source = thirdPartyLicenses(bundledPackageDirs(this.getModuleIds()));
      this.emitFile({ type: 'asset', fileName: 'third-party-licenses.txt', source });
    },
  };
}

/**
 * 幻灯片编辑器页面（docs/design/slides §3）：由 Runtime 在 `/slides/<grant>/` 下提供，所以资源用相对地址。
 * 运行时是工作区里的 @cuccut/slides-runtime，页面模板是本目录的 index.html。
 */
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [pptxgenjsExtensions(), editorLicenses()],
  build: {
    target: 'es2022',
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    // 运行时本身就是一个大包（React、编辑器、PPTX 导出）
    chunkSizeWarningLimit: 8000,
    rollupOptions: {
      // @base-ui 等依赖带 "use client" 指令，打成单包时 Rollup 会逐个警告，这里没有意义。
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
    },
  },
});
