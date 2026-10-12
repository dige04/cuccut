import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { bundledPackageDirs, thirdPartyLicenses } from './licenses.mjs';

/** build.mjs 第 1 步的产物（packages/design-runtime/src/generated/）。 */
const generated = resolve(import.meta.dirname, '../../packages/design-runtime/src/generated');

/**
 * 画板运行时与快速编辑 Worker 按原页面的布局放在 artifact-type/ 下，页面模板的 dc-runtime-file / fast-edit-worker-file
 * 指向这里（相对页面地址）。运行时把 artifact-type/ 下的路径当作编辑器自己的文件，不当作设计稿的文件。
 * Babel standalone 也放在这里（dc-babel-file，CucCut 加的）：原版从 CDN 按需加载，CucCut 的 CSP 不放行 CDN。
 */
function designRuntimeFiles(): Plugin {
  return {
    name: 'cuccut-design-runtime-files',
    apply: 'build',
    generateBundle() {
      for (const file of ['dc-runtime.js', 'babel.min.js', 'fast-edit-worker.js']) {
        this.emitFile({ type: 'asset', fileName: `artifact-type/${file}`, source: readFileSync(resolve(generated, file)) });
      }
    },
  };
}

/** 页面与上面两个文件打进去的第三方代码的原始许可，放在产物根目录的 third-party-licenses.txt。 */
function editorLicenses(): Plugin {
  return {
    name: 'cuccut-design-editor-licenses',
    apply: 'build',
    generateBundle() {
      const scripts = JSON.parse(readFileSync(resolve(generated, 'bundled-inputs.json'), 'utf8')) as string[];
      const source = thirdPartyLicenses(bundledPackageDirs([...this.getModuleIds(), ...scripts]));
      this.emitFile({ type: 'asset', fileName: 'third-party-licenses.txt', source });
    },
  };
}

/**
 * 设计稿编辑器页面（docs/design/canvas §3、§5）：由 Runtime 在 `/design/<grant>/` 下提供，所以资源用相对地址。
 * 运行时是工作区里的 @cuccut/design-runtime，页面模板是本目录的 index.html。
 */
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [designRuntimeFiles(), editorLicenses()],
  build: {
    target: 'es2022',
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    // 运行时本身就是一个大包（React、画布与属性编辑、导出），还以文本内嵌了画板运行时与注入脚本
    chunkSizeWarningLimit: 16000,
    rollupOptions: {
      // @base-ui 等依赖带 "use client" 指令，打成单包时 Rollup 会逐个警告，这里没有意义。
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
    },
  },
});
